// Calendário de águas, transição e seca por propriedade e ano (F12) — puro. As datas são as da propriedade,
// informadas (CONFIGURADO) ou observadas (OBSERVADO), com fonte; nada é imposto (maio–setembro não é regra
// universal). Períodos do mesmo escopo não se sobrepõem. Escopo: propriedade específica ou "todas"
// (propriedade_id null); a específica prevalece. Data sem período = sem calendário (nunca um padrão inventado).
import { parseCivilDate } from '../../weighing/domain/brazilianValues.js';

export class SeasonError extends Error {
  constructor(message, erros = [message]) {
    super(message);
    this.name = 'SeasonError';
    this.code = 'CALENDARIO_INVALIDO';
    this.erros = erros;
  }
}

export const PERIODOS = Object.freeze(['AGUAS', 'TRANSICAO', 'SECA']);
export const PERIODO_LABELS = Object.freeze({ AGUAS: 'Águas', TRANSICAO: 'Transição', SECA: 'Seca' });
export const FONTES_CALENDARIO = Object.freeze(['CONFIGURADO', 'OBSERVADO', 'ESTIMADO']);
export const FONTE_CALENDARIO_LABELS = Object.freeze({ CONFIGURADO: 'Configurado (planejamento)', OBSERVADO: 'Observado (chuva/pasto)', ESTIMADO: 'Estimado' });

const DAY = 86400000;
const utc = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
export const addDays = (iso, n) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);

export function validateSeasonInput(input = {}) {
  const erros = [];
  const periodo = String(input.periodo || '').toUpperCase();
  if (!PERIODOS.includes(periodo)) erros.push('Escolha o período (Águas, Transição ou Seca).');
  const inicio = parseCivilDate(input.inicio);
  const fim = parseCivilDate(input.fim);
  if (!inicio || !fim) erros.push('Informe início e fim do período.');
  else if (fim < inicio) erros.push('O fim do período é anterior ao início.');
  else if (daysBetween(inicio, fim) > 366) erros.push('Um período não passa de um ano.');
  const fonte = String(input.fonte || 'CONFIGURADO').toUpperCase();
  if (!FONTES_CALENDARIO.includes(fonte)) erros.push('Fonte do calendário inválida.');
  if (erros.length) throw new SeasonError(erros[0], erros);
  const ano = Number(input.ano) || Number(inicio.slice(0, 4));
  return { propriedade_id: input.propriedade_id || null, ano, periodo, inicio, fim, fonte, observacao: input.observacao ? String(input.observacao).trim() || null : null };
}

/** Sobreposição com períodos existentes do MESMO escopo (ignora o próprio id). */
export function findOverlap(periodo, existentes = [], selfId = null) {
  return existentes.find((p) => !p.deleted_at && p.id !== selfId && (p.propriedade_id || null) === (periodo.propriedade_id || null)
    && periodo.inicio <= p.fim && p.inicio <= periodo.fim) || null;
}

/** Período na data para a propriedade: específico da propriedade, senão o geral; null = sem calendário. */
export function seasonAt(calendario = [], propriedadeId, data) {
  const ativos = calendario.filter((p) => !p.deleted_at && p.inicio <= data && data <= p.fim);
  return ativos.find((p) => propriedadeId && p.propriedade_id === propriedadeId)
    || ativos.find((p) => !p.propriedade_id)
    || null;
}

/**
 * Dias de um intervalo [de, ate) por período sazonal. Dias sem calendário vão para SEM_CALENDARIO.
 * Retorna { AGUAS, TRANSICAO, SECA, SEM_CALENDARIO, total }.
 */
export function exposure(calendario, propriedadeId, de, ate) {
  const out = { AGUAS: 0, TRANSICAO: 0, SECA: 0, SEM_CALENDARIO: 0, total: 0 };
  if (!de || !ate || ate <= de) return out;
  let dia = de;
  // Caminha por blocos (fim do período corrente) para não iterar dia a dia em intervalos longos.
  while (dia < ate) {
    const p = seasonAt(calendario, propriedadeId, dia);
    let fimBloco;
    if (p) fimBloco = addDays(p.fim, 1);
    else {
      const proximo = calendario.filter((c) => !c.deleted_at && c.inicio > dia && (!c.propriedade_id || c.propriedade_id === propriedadeId)).map((c) => c.inicio).sort()[0];
      fimBloco = proximo || ate;
    }
    const fim = fimBloco < ate ? fimBloco : ate;
    const n = daysBetween(dia, fim);
    out[p ? p.periodo : 'SEM_CALENDARIO'] += n;
    out.total += n;
    dia = fim;
  }
  return out;
}

/**
 * Período predominante de um intervalo: só quando ≥ `minimo` (padrão 80%) dos dias caem num período. Abaixo
 * disso é MISTO — o GMD do intervalo não é atribuído a uma estação que ele só tocou.
 */
export function dominantSeason(exp, { minimo = 0.8 } = {}) {
  if (!exp.total) return null;
  for (const periodo of [...PERIODOS, 'SEM_CALENDARIO']) if (exp[periodo] / exp.total >= minimo) return periodo;
  return 'MISTO';
}
