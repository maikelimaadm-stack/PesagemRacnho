// Metas e cenários de desempenho (F13) e planejado × realizado (F14) — puro.
//
// Meta: GMD (kg/dia) ou peso numa data, com escopo e vigência. Precedência explícita, da mais específica para a
// mais geral: INDIVIDUAL > LOTE > COORTE (raça/sexo/era/estação) > PROPRIEDADE > GERAL. Duas metas válidas no
// MESMO nível para o mesmo animal e data são CONFLITO: nenhuma é aplicada em silêncio. Metas são opcionais e
// versionadas pela vigência; o cenário usado numa avaliação vai junto do resultado (reprodução histórica).
import { parseBrazilianNumber, parseCivilDate } from '../../weighing/domain/brazilianValues.js';
import { CENARIOS } from './projection.js';
import { PERIODOS } from './seasonCalendar.js';

export class TargetError extends Error {
  constructor(message, erros = [message]) {
    super(message);
    this.name = 'TargetError';
    this.code = 'META_INVALIDA';
    this.erros = erros;
  }
}

export const ESCOPOS = Object.freeze(['INDIVIDUAL', 'LOTE', 'COORTE', 'PROPRIEDADE', 'GERAL']);
export const ESCOPO_LABELS = Object.freeze({ INDIVIDUAL: 'Animal', LOTE: 'Lote', COORTE: 'Coorte (raça/sexo/era/estação)', PROPRIEDADE: 'Propriedade', GERAL: 'Geral' });
export const TIPOS_META = Object.freeze(['GMD', 'PESO_DATA', 'CENARIO']);
export const TIPO_META_LABELS = Object.freeze({ GMD: 'GMD (kg/dia)', PESO_DATA: 'Peso em uma data', CENARIO: 'Cenário de projeção' });

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseBrazilianNumber(v);
  return Number.isFinite(n) ? n : NaN;
};

export function validateTargetInput(input = {}) {
  const erros = [];
  const escopo = String(input.escopo || '').toUpperCase();
  if (!ESCOPOS.includes(escopo)) erros.push('Escolha o escopo da meta.');
  const tipo = String(input.tipo || '').toUpperCase();
  if (!TIPOS_META.includes(tipo)) erros.push('Escolha o tipo (GMD, peso na data ou cenário).');
  const alvo = input.alvo_id ? String(input.alvo_id) : null;
  if (['INDIVIDUAL', 'LOTE', 'PROPRIEDADE'].includes(escopo) && !alvo) erros.push('Escolha o animal, lote ou propriedade da meta.');
  const inicio = parseCivilDate(input.vigencia_inicio);
  const fim = input.vigencia_fim ? parseCivilDate(input.vigencia_fim) : null;
  if (!inicio) erros.push('Informe o início da vigência.');
  if (input.vigencia_fim && !fim) erros.push('Fim da vigência inválido.');
  if (inicio && fim && fim < inicio) erros.push('Fim da vigência antes do início.');
  const coorte = {
    raca_id: input.coorte?.raca_id || null,
    sexo: input.coorte?.sexo || null,
    era: input.coorte?.era || null,
    estacao: input.coorte?.estacao || null,
  };
  if (coorte.estacao && !PERIODOS.includes(coorte.estacao)) erros.push('Estação da coorte inválida.');
  if (escopo === 'COORTE' && !Object.values(coorte).some(Boolean)) erros.push('Coorte: informe ao menos raça, sexo, era ou estação.');
  const out = { escopo, tipo, alvo_id: ['GERAL', 'COORTE'].includes(escopo) ? null : alvo, coorte, vigencia_inicio: inicio, vigencia_fim: fim, nome: input.nome ? String(input.nome).trim() : null, observacao: input.observacao ? String(input.observacao).trim() || null : null };
  if (tipo === 'GMD') {
    out.gmd_kg_dia = num(input.gmd_kg_dia);
    if (!(out.gmd_kg_dia >= -2 && out.gmd_kg_dia <= 5)) erros.push('GMD da meta entre -2 e 5 kg/dia.');
  }
  if (tipo === 'PESO_DATA') {
    out.peso_kg = num(input.peso_kg);
    out.data_alvo = parseCivilDate(input.data_alvo);
    if (!(out.peso_kg > 0)) erros.push('Peso da meta maior que zero.');
    if (!out.data_alvo) erros.push('Data alvo da meta.');
  }
  if (tipo === 'CENARIO') {
    out.cenario = String(input.cenario || 'BASE').toUpperCase();
    if (!CENARIOS.includes(out.cenario)) erros.push('Cenário: conservador, base ou otimista.');
    const porPeriodo = {};
    for (const p of PERIODOS) {
      const v = num(input.gmd_por_periodo?.[p]);
      if (v !== null) { if (!(v >= -2 && v <= 5)) erros.push(`GMD de ${p.toLowerCase()} entre -2 e 5.`); else porPeriodo[p] = v; }
    }
    const porMes = {};
    for (let m = 1; m <= 12; m += 1) {
      const v = num(input.gmd_por_mes?.[m] ?? input.gmd_por_mes?.[String(m)]);
      if (v !== null) { if (!(v >= -2 && v <= 5)) erros.push(`GMD do mês ${m} entre -2 e 5.`); else porMes[String(m)] = v; }
    }
    const unico = num(input.gmd_kg_dia);
    if (!Object.keys(porPeriodo).length && !Object.keys(porMes).length && unico === null) erros.push('Cenário: informe GMD por estação, por mês ou um GMD único.');
    out.gmd_por_periodo = Object.keys(porPeriodo).length ? porPeriodo : null;
    out.gmd_por_mes = Object.keys(porMes).length ? porMes : null;
    out.gmd_kg_dia = unico;
  }
  if (erros.length) throw new TargetError(erros[0], erros);
  return out;
}

const vigente = (m, data) => !m.deleted_at && m.vigencia_inicio <= data && (!m.vigencia_fim || m.vigencia_fim >= data);

function matches(meta, ctx) {
  switch (meta.escopo) {
    case 'INDIVIDUAL': return meta.alvo_id === ctx.animal_id;
    case 'LOTE': return meta.alvo_id === ctx.lote_id;
    case 'PROPRIEDADE': return meta.alvo_id === ctx.propriedade_id;
    case 'COORTE': {
      const c = meta.coorte || {};
      return (!c.raca_id || c.raca_id === ctx.raca_id) && (!c.sexo || c.sexo === ctx.sexo) && (!c.era || c.era === ctx.era) && (!c.estacao || c.estacao === ctx.estacao);
    }
    default: return true;
  }
}

/**
 * Meta aplicável ao animal na data. `tipos` limita (ex.: ['GMD','PESO_DATA'] ou ['CENARIO']).
 * Retorna { meta, nivel } | { conflito: [metas], nivel } | { meta: null }.
 */
export function resolveTarget(metas = [], ctx, data, { tipos = ['GMD', 'PESO_DATA'], cenario = null } = {}) {
  for (const nivel of ESCOPOS) {
    const candidatas = metas.filter((m) => m.escopo === nivel && tipos.includes(m.tipo) && (!cenario || m.cenario === cenario) && vigente(m, data) && matches(m, ctx));
    if (candidatas.length === 1) return { meta: candidatas[0], nivel };
    if (candidatas.length > 1) return { meta: null, conflito: candidatas, nivel };
  }
  return { meta: null };
}

/** Na gravação: outra meta do mesmo escopo/alvo/coorte/tipo/cenário com vigência sobreposta é conflito. */
export function findConflict(meta, existentes = [], selfId = null) {
  const mesmoAlvo = (m) => m.escopo === meta.escopo && (m.alvo_id || null) === (meta.alvo_id || null)
    && JSON.stringify(m.coorte || {}) === JSON.stringify(meta.coorte || {}) && m.tipo === meta.tipo && (m.cenario || null) === (meta.cenario || null);
  return existentes.find((m) => !m.deleted_at && m.id !== selfId && mesmoAlvo(m)
    && m.vigencia_inicio <= (meta.vigencia_fim || '9999-12-31') && meta.vigencia_inicio <= (m.vigencia_fim || '9999-12-31')) || null;
}

/**
 * Planejado × realizado (F14) de UM animal: GMD observado (intervalos confiáveis desde o início da meta) contra a
 * meta de GMD, ou peso projetado na data alvo contra a meta de peso. Classificação ACIMA / NO_ALVO / ABAIXO /
 * INSUFICIENTE (sem observação suficiente). Tolerância em kg/dia ou kg.
 */
export function compareToTarget(meta, { intervalos = [], projecao = null, ultimoPeso = null }, { toleranciaGmd = 0.05, toleranciaPeso = 5 } = {}) {
  if (!meta) return { situacao: 'SEM_META' };
  if (meta.tipo === 'GMD') {
    const obs = intervalos.filter((it) => it.confiavel && it.de >= meta.vigencia_inicio && (!meta.vigencia_fim || it.ate <= meta.vigencia_fim));
    const dias = obs.reduce((a, it) => a + it.dias, 0);
    if (!dias) return { situacao: 'INSUFICIENTE', meta_gmd: meta.gmd_kg_dia, motivo: 'Sem intervalo confiável desde o início da meta.' };
    const gmd = obs.reduce((a, it) => a + it.ganho, 0) / dias;
    const desvio = gmd - meta.gmd_kg_dia;
    return { situacao: Math.abs(desvio) <= toleranciaGmd ? 'NO_ALVO' : desvio > 0 ? 'ACIMA' : 'ABAIXO', meta_gmd: meta.gmd_kg_dia, gmd_observado: Math.round(gmd * 1000) / 1000, desvio_kg_dia: Math.round(desvio * 1000) / 1000, dias_observados: dias };
  }
  if (meta.tipo === 'PESO_DATA') {
    if (ultimoPeso && ultimoPeso.data >= meta.data_alvo) {
      const desvio = ultimoPeso.peso_kg - meta.peso_kg;
      return { situacao: Math.abs(desvio) <= toleranciaPeso ? 'NO_ALVO' : desvio > 0 ? 'ACIMA' : 'ABAIXO', meta_peso: meta.peso_kg, peso_observado: ultimoPeso.peso_kg, desvio_kg: Math.round(desvio * 10) / 10, base: 'observado' };
    }
    if (!projecao?.ok) return { situacao: 'INSUFICIENTE', meta_peso: meta.peso_kg, motivo: projecao?.motivo || 'Sem projeção para a data alvo.' };
    const desvio = projecao.peso_kg - meta.peso_kg;
    return { situacao: Math.abs(desvio) <= toleranciaPeso ? 'NO_ALVO' : desvio > 0 ? 'ACIMA' : 'ABAIXO', meta_peso: meta.peso_kg, peso_projetado: Math.round(projecao.peso_kg * 10) / 10, desvio_kg: Math.round(desvio * 10) / 10, base: 'projetado' };
  }
  return { situacao: 'SEM_META' };
}
