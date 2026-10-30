// Desempenho comparativo (F11) — puro. A unidade é o INTERVALO observado entre duas pesagens com peso do
// mesmo animal (sem cancelados). Cada intervalo carrega as dimensões NO INÍCIO dele (raça, sexo, era pela
// idade na data, categoria produtiva, lote vigente, origem da entrada, estação predominante): mudança de
// lote/era durante o intervalo não é atribuída ao grupo novo. Intervalo curto (< mínimo de dias de
// Configurações › Relatórios) fica fora da média — o mesmo contrato do GMD dos relatórios.
//
// Por grupo: n_animais, n_intervalos, n_pesagens, dias observados, ganho total, GMD ponderado (Σganho/Σdias),
// média e desvio do GMD individual, IC 95%, quantos ganharam/perderam/mantiveram, animais sem GMD confiável e
// a suficiência da amostra. Grupo sem dados suficientes = "sem dados suficientes", nunca zero.
import { eraAt } from '../../livestock/domain/ageModel.js';
import { dominantSeason, exposure } from './seasonCalendar.js';

export const DIMENSOES = Object.freeze(['raca', 'sexo', 'era', 'categoria_produtiva', 'lote', 'origem', 'estacao', 'propriedade']);
export const DIMENSAO_LABELS = Object.freeze({
  raca: 'Raça', sexo: 'Sexo', era: 'Era (idade)', categoria_produtiva: 'Categoria produtiva', lote: 'Lote',
  origem: 'Origem', estacao: 'Estação', propriedade: 'Propriedade',
});
export const AMOSTRA_MINIMA = Object.freeze({ animais: 3, dias: 21 });
export const MANTEVE_TOLERANCIA_KG_DIA = 0.05;

const round = (n, casas = 3) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10 ** casas) / 10 ** casas);
const tipoOf = (row) => row?.legacy_payload?.tipo_manejo ?? row?.tipo_manejo ?? row?.tipo_pesagem ?? null;
const pesoOf = (row) => {
  const n = Number(row?.peso_kg ?? row?.legacy_payload?.peso);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const DAY = 86400000;
const utc = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);

function loteNaData(stays, data) {
  const s = stays.filter((x) => x.inicio <= data && (!x.fim || x.fim > data)).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))[0];
  return s?.lote_id || null;
}

/**
 * Intervalos observados de todos os animais, com dimensões no início do intervalo.
 * @param {object} fontes { pesagens, animais, animalLotes, movimentos, operacoes, calendario }
 * @param {object} opts { from, to, diasMinimos, policy, nomes: { racas, lotes, propriedades } }
 */
export function buildIntervals(fontes, { from = null, to = null, diasMinimos = 21, policy } = {}) {
  const { pesagens = [], animais = [], animalLotes = [], movimentos = [], operacoes = [], calendario = [] } = fontes;
  const porAnimal = new Map();
  for (const row of pesagens) {
    if (row.deleted_at || !row.animal_id || pesoOf(row) === null || !row.data_pesagem) continue;
    const lista = porAnimal.get(row.animal_id) || [];
    lista.push(row);
    porAnimal.set(row.animal_id, lista);
  }
  const animalPorId = new Map(animais.map((a) => [a.id, a]));
  const staysPorAnimal = new Map();
  for (const s of animalLotes) {
    if (s.deleted_at) continue;
    const l = staysPorAnimal.get(s.animal_id) || [];
    l.push(s);
    staysPorAnimal.set(s.animal_id, l);
  }
  const opPorId = new Map(operacoes.map((o) => [o.id, o]));
  const origemPorAnimal = new Map();
  for (const m of movimentos) {
    if (m.deleted_at || (m.natureza || '') !== 'ENTRADA' || origemPorAnimal.has(m.animal_id)) continue;
    const op = m.operacao_id ? opPorId.get(m.operacao_id) : null;
    origemPorAnimal.set(m.animal_id, op && op.subtipo !== 'LEGADO_CADASTRO' ? op.subtipo : 'CADASTRO');
  }
  const intervalos = [];
  for (const [animalId, rows] of porAnimal) {
    // Uma pesagem por dia (a última gravada) — a repesagem já cancela a anterior; isto só protege dado antigo.
    const porDia = new Map();
    for (const r of rows.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))) porDia.set(r.data_pesagem, r);
    const serie = [...porDia.values()].sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem));
    const animal = animalPorId.get(animalId) || {};
    for (let i = 1; i < serie.length; i += 1) {
      const a = serie[i - 1];
      const b = serie[i];
      if ((from && a.data_pesagem < from) || (to && b.data_pesagem > to)) continue;
      const dias = daysBetween(a.data_pesagem, b.data_pesagem);
      if (dias <= 0) continue;
      const ganho = pesoOf(b) - pesoOf(a);
      const era = eraAt(animal, a.data_pesagem, policy);
      const propriedadeId = animal.propriedade_id || null;
      const exp = exposure(calendario, propriedadeId, a.data_pesagem, b.data_pesagem);
      intervalos.push({
        animal_id: animalId,
        de: a.data_pesagem,
        ate: b.data_pesagem,
        dias,
        peso_ini: pesoOf(a),
        peso_fim: pesoOf(b),
        ganho,
        gmd: ganho / dias,
        confiavel: dias >= diasMinimos,
        saida: tipoOf(b) === 'Saída',
        dims: {
          raca: animal.raca_id || animal.raca || null,
          sexo: animal.sexo || null,
          era: era ? era.rotulo : null,
          categoria_produtiva: animal.categoria_produtiva || null,
          lote: loteNaData(staysPorAnimal.get(animalId) || [], a.data_pesagem) || a.lote_id || null,
          origem: origemPorAnimal.get(animalId) || null,
          estacao: dominantSeason(exp),
          propriedade: propriedadeId,
        },
        exposicao: exp,
      });
    }
  }
  return intervalos;
}

function stats(values) {
  if (!values.length) return { media: null, desvio: null };
  const media = values.reduce((a, b) => a + b, 0) / values.length;
  const desvio = values.length > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - media) ** 2, 0) / (values.length - 1)) : null;
  return { media, desvio };
}

/**
 * Agrupa por uma ou mais dimensões. `animaisNoEscopo` (ids) define quem conta como "sem GMD" (animal do
 * escopo sem nenhum intervalo confiável).
 */
export function groupPerformance(intervalos, dimensoes = ['raca'], { animaisNoEscopo = null, rotulos = {} } = {}) {
  const grupos = new Map();
  const chave = (it) => dimensoes.map((d) => it.dims[d] ?? null);
  for (const it of intervalos) {
    const k = JSON.stringify(chave(it));
    const g = grupos.get(k) || { valores: chave(it), intervalos: [] };
    g.intervalos.push(it);
    grupos.set(k, g);
  }
  const linhas = [];
  for (const g of grupos.values()) {
    const confiaveis = g.intervalos.filter((it) => it.confiavel);
    const animais = new Set(g.intervalos.map((it) => it.animal_id));
    const animaisConfiaveis = new Set(confiaveis.map((it) => it.animal_id));
    const ganho = confiaveis.reduce((a, it) => a + it.ganho, 0);
    const dias = confiaveis.reduce((a, it) => a + it.dias, 0);
    // GMD individual: ponderado pelos intervalos confiáveis de cada animal no grupo.
    const porAnimal = new Map();
    for (const it of confiaveis) {
      const acc = porAnimal.get(it.animal_id) || { ganho: 0, dias: 0 };
      acc.ganho += it.ganho;
      acc.dias += it.dias;
      porAnimal.set(it.animal_id, acc);
    }
    const individuais = [...porAnimal.values()].map((acc) => acc.ganho / acc.dias);
    const { media, desvio } = stats(individuais);
    const suficiente = animaisConfiaveis.size >= AMOSTRA_MINIMA.animais && dias >= AMOSTRA_MINIMA.dias;
    const ic = desvio !== null && individuais.length > 1 ? 1.96 * (desvio / Math.sqrt(individuais.length)) : null;
    linhas.push({
      grupo: Object.fromEntries(dimensoes.map((d, i) => [d, g.valores[i]])),
      rotulo: dimensoes.map((d, i) => (g.valores[i] === null ? `${DIMENSAO_LABELS[d]} não informada` : (rotulos[d]?.get?.(g.valores[i]) || g.valores[i]))).join(' · '),
      n_animais: animais.size,
      n_animais_com_gmd: animaisConfiaveis.size,
      n_intervalos: g.intervalos.length,
      n_intervalos_confiaveis: confiaveis.length,
      n_pesagens: g.intervalos.length + animais.size,
      dias_observados: dias,
      ganho_total_kg: round(ganho, 1),
      gmd_ponderado: suficiente ? round(ganho / dias) : null,
      gmd_medio_individual: suficiente ? round(media) : null,
      desvio_gmd: suficiente ? round(desvio) : null,
      ic95: suficiente && ic !== null ? [round(media - ic), round(media + ic)] : null,
      ganharam: individuais.filter((v) => v > MANTEVE_TOLERANCIA_KG_DIA).length,
      perderam: individuais.filter((v) => v < -MANTEVE_TOLERANCIA_KG_DIA).length,
      mantiveram: individuais.filter((v) => Math.abs(v) <= MANTEVE_TOLERANCIA_KG_DIA).length,
      sem_gmd: animais.size - animaisConfiaveis.size,
      amostra: suficiente ? 'SUFICIENTE' : 'INSUFICIENTE',
      exposicao: g.intervalos.reduce((acc, it) => {
        for (const k of Object.keys(it.exposicao)) acc[k] = (acc[k] || 0) + it.exposicao[k];
        return acc;
      }, {}),
    });
  }
  const semIntervalo = animaisNoEscopo ? [...animaisNoEscopo].filter((id) => !intervalos.some((it) => it.animal_id === id)).length : null;
  // Ranking: suficientes primeiro (maior GMD ponderado), insuficientes no fim — nunca misturados com zero.
  linhas.sort((a, b) => (a.amostra === b.amostra ? (b.gmd_ponderado ?? -Infinity) - (a.gmd_ponderado ?? -Infinity) : a.amostra === 'SUFICIENTE' ? -1 : 1));
  linhas.forEach((l, i) => { l.posicao = l.amostra === 'SUFICIENTE' ? i + 1 : null; });
  return { linhas, animais_sem_intervalo: semIntervalo };
}

/** Animais cujo intervalo confiável MAIS RECENTE perdeu peso (quem está perdendo agora). */
export function losingWeight(intervalos) {
  const ultimo = new Map();
  for (const it of intervalos) {
    if (!it.confiavel || it.saida) continue;
    const atual = ultimo.get(it.animal_id);
    if (!atual || it.ate > atual.ate) ultimo.set(it.animal_id, it);
  }
  return [...ultimo.values()].filter((it) => it.gmd < -MANTEVE_TOLERANCIA_KG_DIA)
    .map((it) => ({ animal_id: it.animal_id, de: it.de, ate: it.ate, dias: it.dias, ganho: round(it.ganho, 1), gmd: round(it.gmd), lote: it.dims.lote }))
    .sort((a, b) => a.gmd - b.gmd);
}
