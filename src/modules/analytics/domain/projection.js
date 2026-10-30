// Projeção DIÁRIA de peso (F13) — pura. Parte do último peso REAL (data e origem conhecidas) e soma o GMD de
// cada dia do cenário até a data alvo: dia d em [base, alvo) contribui gmd(d). Assim janeiro (31 dias) e
// fevereiro (28 ou 29) têm o peso certo, e mudar de regime no meio do mês (seca/águas, lote planejado) muda a
// conta no dia exato. A projeção NUNCA é gravada como pesagem e sempre mostra base, horizonte e incerteza.
//
// Oráculo (prompt da missão): 300 kg em 01/01 de ano comum, janeiro 0,200 kg/dia × 31 = 6,2 kg, fevereiro
// 0,300 kg/dia × 28 = 8,4 kg → 314,6 kg em 01/03.
import { PERIODO_LABELS, addDays, daysBetween, seasonAt } from './seasonCalendar.js';

export const CENARIOS = Object.freeze(['CONSERVADOR', 'BASE', 'OTIMISTA']);
export const CENARIO_LABELS = Object.freeze({ CONSERVADOR: 'Conservador', BASE: 'Base', OTIMISTA: 'Otimista' });

const round = (n, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Resolve o GMD de um dia a partir de um cenário: { gmd_por_mes: { '1': 0.2, ... } } tem prioridade sobre
 * { gmd_por_periodo: { AGUAS, TRANSICAO, SECA } } (usa o calendário da propriedade). `regimes` opcionais
 * ({ de, ate, gmd }) sobrepõem o cenário em datas planejadas (ex.: confinamento a partir de 15/02).
 * Retorna { gmd, fonte } ou null quando não há regra para o dia.
 */
export function scenarioResolver(cenario = {}, { calendario = [], propriedadeId = null, regimes = [] } = {}) {
  return (dia) => {
    const regime = regimes.find((r) => r.de <= dia && (!r.ate || dia < r.ate));
    if (regime) return { gmd: Number(regime.gmd), fonte: regime.rotulo || 'regime planejado' };
    const mes = String(Number(dia.slice(5, 7)));
    if (cenario.gmd_por_mes && cenario.gmd_por_mes[mes] !== undefined && cenario.gmd_por_mes[mes] !== null && cenario.gmd_por_mes[mes] !== '') {
      return { gmd: Number(cenario.gmd_por_mes[mes]), fonte: `mês ${mes}` };
    }
    if (cenario.gmd_por_periodo) {
      const p = seasonAt(calendario, propriedadeId, dia);
      if (p && cenario.gmd_por_periodo[p.periodo] !== undefined && cenario.gmd_por_periodo[p.periodo] !== null && cenario.gmd_por_periodo[p.periodo] !== '') {
        return { gmd: Number(cenario.gmd_por_periodo[p.periodo]), fonte: PERIODO_LABELS[p.periodo] };
      }
    }
    if (cenario.gmd_kg_dia !== undefined && cenario.gmd_kg_dia !== null && cenario.gmd_kg_dia !== '') return { gmd: Number(cenario.gmd_kg_dia), fonte: 'GMD único' };
    return null;
  };
}

/**
 * @param {{ peso_kg: number, data: string, origem?: string }} base último peso real
 * @param {string} alvo data alvo (AAAA-MM-DD), > base.data
 * @param {(dia: string) => ({ gmd: number, fonte: string } | null)} resolver
 * @returns {{ ok, peso_kg, dias, base, alvo, trechos: { de, ate, dias, gmd, ganho, fonte }[], motivo? }}
 */
export function projectWeight(base, alvo, resolver) {
  if (!base || !(Number(base.peso_kg) > 0) || !base.data) return { ok: false, motivo: 'Sem peso real de base para projetar.' };
  if (['ESTIMADO', 'PROJETADO'].includes(String(base.origem || '').toUpperCase())) return { ok: false, motivo: 'A base da projeção precisa ser um peso medido.' };
  if (!alvo || alvo <= base.data) return { ok: false, motivo: 'A data alvo precisa ser depois da última pesagem.' };
  const trechos = [];
  let peso = Number(base.peso_kg);
  let dia = base.data;
  while (dia < alvo) {
    const r = resolver(dia);
    if (!r || !Number.isFinite(r.gmd)) return { ok: false, motivo: `Sem GMD de cenário para ${dia.split('-').reverse().join('/')}.`, trechos };
    const ultimo = trechos.at(-1);
    if (ultimo && ultimo.gmd === r.gmd && ultimo.fonte === r.fonte && ultimo.ate === dia) {
      ultimo.ate = addDays(dia, 1);
      ultimo.dias += 1;
    } else {
      trechos.push({ de: dia, ate: addDays(dia, 1), dias: 1, gmd: r.gmd, fonte: r.fonte });
    }
    peso += r.gmd;
    dia = addDays(dia, 1);
  }
  for (const t of trechos) t.ganho = round(t.gmd * t.dias);
  return { ok: true, peso_kg: round(peso, 3), dias: daysBetween(base.data, alvo), base: { ...base }, alvo, trechos, projetado: true };
}

/** Projeção nos três cenários (incerteza explícita). `cenarios` = { CONSERVADOR, BASE, OTIMISTA }. */
export function projectScenarios(base, alvo, cenarios = {}, ctx = {}) {
  const out = {};
  for (const nome of CENARIOS) {
    if (!cenarios[nome]) continue;
    out[nome] = projectWeight(base, alvo, scenarioResolver(cenarios[nome], ctx));
  }
  return out;
}

/**
 * GMD observado por mês (F14): só intervalos INTEIRAMENTE dentro do mês contam como observação do mês.
 * Dois pontos em 01/01 e 01/03 não dão "GMD de janeiro" nem "de fevereiro": o intervalo atravessa meses e
 * aparece como GMD do intervalo, marcado. Retorna { meses: { 'AAAA-MM': { gmd, n } | null }, atravessam }.
 */
export function monthlyObserved(intervalos = []) {
  const meses = {};
  const atravessam = [];
  for (const it of intervalos) {
    const mesIni = it.de.slice(0, 7);
    const ultimoDia = addDays(it.ate, -1).slice(0, 7);
    if (mesIni === ultimoDia) {
      const acc = meses[mesIni] || { ganho: 0, dias: 0, n: 0 };
      acc.ganho += it.ganho;
      acc.dias += it.dias;
      acc.n += 1;
      meses[mesIni] = acc;
    } else {
      atravessam.push({ de: it.de, ate: it.ate, gmd: it.gmd, nota: 'intervalo atravessa meses: GMD do intervalo, não de cada mês' });
    }
  }
  const out = {};
  for (const [mes, acc] of Object.entries(meses)) out[mes] = { gmd: acc.dias ? round(acc.ganho / acc.dias) : null, n: acc.n };
  return { meses: out, atravessam };
}
