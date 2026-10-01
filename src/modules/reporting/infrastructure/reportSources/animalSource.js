// Fontes Dexie dos grãos ANIMAL_CURRENT (projeção `animais`, sem reconstruir histórico) e
// ANIMAL_PERIOD (eventos do período pelo índice data_pesagem, agregados por animal).
import storage from '../../../../storage/storageAdapter.js';
import { storageRecordToViewModel } from '../../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents, measuredWeightOf } from '../../../weighing/domain/weighingSeries.js';
import { loadEventRows } from './eventSource.js';
import { readByKeys } from './readByKeys.js';
import { bandsFromCategories, buildAnimalLookups, toAnimalCurrentRows, toAnimalPeriodRows } from './animalRows.js';
import { addDays } from '../../domain/reportPeriod.js';
import { annotateGmdQuality } from '../../domain/gmdColumns.js';
import { ANIMAL_CURRENT_COLUMNS, GMD_REGRESSAO_COLUMN_ID } from '../../definitions/columns/animalColumns.js';
import { GMD_DIAS_MINIMOS_PADRAO, normalizeGmdDiasMinimos } from '../../../weighing/domain/gmdQuality.js';
import { REGRESSAO_JANELA_DIAS, computeWeightedGmd } from '../../../weighing/domain/weightRegression.js';

// A coluna "GMD (regressão)" é a mesma nos dois grãos (mesma declaração de qualidade).
const REGRESSION_COLUMNS = ANIMAL_CURRENT_COLUMNS.filter((column) => column.id === GMD_REGRESSAO_COLUMN_ID);

async function readAllActive(table) {
  return (await table.toArray()).filter((row) => !row.deleted_at);
}

async function loadLookups(db) {
  const [marcas, racas, categorias, apartacoes, lotes, propriedades] = await Promise.all([
    readAllActive(db.table('marcas')), readAllActive(db.table('racas')), readAllActive(db.table('categoriasAnimal')),
    readAllActive(db.table('apartacoes')), readAllActive(db.table('loteApartacoes')), readAllActive(db.table('propriedades')),
  ]);
  return { lookups: buildAnimalLookups({ marcas, racas, categorias, apartacoes, lotes, propriedades }), categorias };
}

function resolveBands(params, categorias) {
  const custom = Object.values(params || {}).find((value) => Array.isArray(value) && value.every((band) => band && 'label' in band));
  return custom && custom.length ? { bands: custom, origin: 'modelo' } : { bands: bandsFromCategories(categorias), origin: 'categorias' };
}

/**
 * E1G (A4): pesagens gravadas EXATAMENTE nas datas pedidas — uma consulta `equals` por data no índice `data_pesagem`,
 * todas na mesma transação de leitura. Revisão E1G: nem `anyOf` (no fake-indexeddb, 8 datas na massa 36k = 2,3 s;
 * 64 datas em paralelo por `equals` = 0,18 s) nem o intervalo entre a data mais antiga e a mais recente (o rebanho
 * atual inclui vendidos e mortos: a última pesagem deles vai até o começo do histórico, e o intervalo virava a base
 * inteira). Lê só as linhas dessas datas.
 */
export async function readWeighingsOnDates(db, dates) {
  const unique = [...new Set((dates || []).filter(Boolean))];
  if (!unique.length) return [];
  const table = db.table('pesagens');
  const parts = await db.transaction('r', table, () => Promise.all(unique.map((date) => table.where('data_pesagem').equals(date).toArray())));
  return parts.flat();
}

/**
 * E1G (A4): entrada e última pesagem de cada animal do rebanho atual, SEM ler a base inteira e sem uma consulta por
 * animal — duas leituras pelo índice:
 *  - entrada: `tipo_pesagem` = Cadastro (uma linha por animal), o Cadastro com peso mais antigo na ordem canônica;
 *  - última: `data_pesagem` nas datas da última pesagem da projeção (`ultima_pesagem_data`), uma consulta por data
 *    (readWeighingsOnDates); do animal naquela data, a última com peso na ordem canônica (como a projeção) — os
 *    derivados gravados nela (GMD, ganho, dias).
 * @returns {Promise<{ weighings: Map<string, { entrada: object|null, ultima: object|null }>, rowsRead: number }>}
 */
export async function loadCurrentWeighings(db, animals) {
  const wanted = new Map(animals.filter((row) => !row.deleted_at && row.id).map((row) => [row.id, row]));
  const weighings = new Map();
  const slot = (animalId) => {
    if (!weighings.has(animalId)) weighings.set(animalId, { entrada: null, ultima: null, entradaView: null, ultimaView: null });
    return weighings.get(animalId);
  };
  const cadastros = await db.table('pesagens').where('tipo_pesagem').equals('Cadastro').toArray();
  for (const row of cadastros) {
    if (row.deleted_at || !wanted.has(row.animal_id)) continue;
    const view = storageRecordToViewModel(row);
    const peso = measuredWeightOf(view);
    if (peso === null) continue;
    const entry = slot(row.animal_id);
    if (entry.entradaView && compareWeighingEvents(view, entry.entradaView) >= 0) continue;
    entry.entradaView = view;
    entry.entrada = { data: String(view.data_pesagem || '').slice(0, 10) || null, peso };
  }
  const lastDateOf = (animal) => (animal.ultima_pesagem_data ? String(animal.ultima_pesagem_data).slice(0, 10) : null);
  // A data gravada na projeção (igual à da pesagem) e a data civil (aaaa-mm-dd) — registro antigo com hora também casa.
  const lastRows = await readWeighingsOnDates(db, [...wanted.values()].flatMap((animal) => [animal.ultima_pesagem_data, lastDateOf(animal)]));
  for (const row of lastRows) {
    const animal = row.deleted_at ? null : wanted.get(row.animal_id);
    if (!animal || String(row.data_pesagem || '').slice(0, 10) !== lastDateOf(animal)) continue;
    const view = storageRecordToViewModel(row);
    if (measuredWeightOf(view) === null) continue;
    const entry = slot(row.animal_id);
    if (entry.ultimaView && compareWeighingEvents(view, entry.ultimaView) <= 0) continue;
    entry.ultimaView = view;
    entry.ultima = { gmd: view.gmd ?? null, ganho: view.ganho ?? null, dias: view.dias ?? null };
  }
  for (const entry of weighings.values()) {
    delete entry.entradaView;
    delete entry.ultimaView;
  }
  return { weighings, rowsRead: cadastros.length + lastRows.length };
}

/** M1: gmdDiasMinimos = intervalo mínimo do GMD (7/14/21/28; padrão 21) — qualidade do Último GMD e do desde a entrada. */
export async function loadAnimalCurrentRows({ empresaId, today, params, gmdDiasMinimos = GMD_DIAS_MINIMOS_PADRAO } = {}) {
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const animals = await db.table('animais').toArray();
  const scoped = animals.filter((row) => !empresaId || !row.empresa_id || row.empresa_id === empresaId);
  const current = await loadCurrentWeighings(db, scoped);
  const queriedAt = performance.now();
  const { lookups, categorias } = await loadLookups(db);
  const { bands, origin } = resolveBands(params, categorias);
  const minimo = normalizeGmdDiasMinimos(gmdDiasMinimos);
  const rows = toAnimalCurrentRows(scoped, lookups, { today, bands, weighings: current.weighings, gmdDiasMinimos: minimo });
  const warnings = [];
  if (!bands.length) warnings.push({ code: 'NO_WEIGHT_BANDS', message: 'Nenhuma faixa de peso configurada (categorias sem faixa e modelo sem faixas): faixa aparece como "Não informado".' });
  return {
    rows,
    strategy: 'projection:animais+index:pesagens(cadastro,ultima)',
    rowsRead: animals.length + current.rowsRead,
    // E1G: quantas linhas de pesagem foram lidas pelo índice (entrada e última pesagem) — nunca a base inteira.
    weighingRowsRead: current.rowsRead,
    timings: { query: queriedAt - startedAt, transform: performance.now() - queriedAt },
    warnings,
    bandsOrigin: origin,
    gmdDiasMinimos: minimo,
  };
}

/** M1: gmdDiasMinimos = intervalo mínimo do GMD (7/14/21/28; padrão 21) — qualidade do GMD do período de cada animal. */
export async function loadAnimalPeriodRows({ empresaId, period, params, gmdDiasMinimos = GMD_DIAS_MINIMOS_PADRAO } = {}) {
  const minimo = normalizeGmdDiasMinimos(gmdDiasMinimos);
  const events = await loadEventRows({ from: period.from, to: period.to, empresaId, gmdDiasMinimos: minimo });
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const ids = [...new Set(events.rows.map((row) => row.animal_id || row.animal_id_resolvido).filter(Boolean))];
  const animals = (await readByKeys(db.table('animais'), 'id', ids)).filter((row) => !row.deleted_at);
  const { lookups, categorias } = await loadLookups(db);
  const { bands } = resolveBands(params, categorias);
  const rows = toAnimalPeriodRows(events.rows, new Map(animals.map((row) => [row.id, row])), lookups, { bands, gmdDiasMinimos: minimo });
  return {
    rows,
    strategy: `${events.strategy}+group:animal`,
    rowsRead: events.rowsRead,
    timings: { query: events.timings.query, transform: events.timings.transform + (performance.now() - startedAt) },
    gmdDiasMinimos: minimo,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// M1 §2 — "GMD (regressão)" (coluna opcional do Desempenho e do Rebanho atual)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Data de referência ("hoje") da regressão: no Rebanho atual, hoje; no Desempenho, o fim do período (nunca depois
 * de hoje) — a janela de 120 dias termina onde o relatório termina.
 */
export function regressionReferenceDate({ period = null, today }) {
  const to = period?.to ? String(period.to).slice(0, 10) : null;
  return to && today && to < today ? to : today;
}

/**
 * Pontos (data, peso) de cada animal na janela [hoje − 120, hoje]: UMA consulta pelo índice `data_pesagem` (as linhas
 * canônicas do grão EVENT, com a mesma identidade de animal do Desempenho — animal_key), nunca uma consulta por animal.
 * Só pesagens com peso medido (Saída sem balança não vira 0 kg); canceladas ficam fora (a fonte já tira).
 * @returns {Promise<{ points: Map<string, { data: string, peso: number }[]>, rowsRead: number, from: string, to: string }>}
 */
export async function loadRegressionPoints({ hoje, empresaId, janelaDias = REGRESSAO_JANELA_DIAS } = {}) {
  const from = addDays(hoje, -janelaDias);
  const events = await loadEventRows({ from, to: hoje, empresaId });
  const points = new Map();
  for (const row of events.rows) {
    const peso = measuredWeightOf(row);
    if (peso === null) continue;
    const key = row.animal_key;
    if (!key) continue;
    const list = points.get(key);
    const point = { data: String(row.data_pesagem).slice(0, 10), peso };
    if (list) list.push(point);
    else points.set(key, [point]);
  }
  return { points, rowsRead: events.rowsRead, from, to: hoje };
}

/**
 * Acrescenta às linhas do animal o "GMD (regressão)" (computeWeightedGmd, interface congelada da M1) e a qualidade
 * dele (pelos dias cobertos, com o mesmo mínimo do relatório): gmd_regressao, gmd_regressao_n, gmd_regressao_dias,
 * gmd_regressao_erro_padrao, gmd_regressao_qualidade, gmd_regressao_motivo. Muta as linhas (canônicas, da fonte).
 * @param rows linhas ANIMAL_CURRENT (chave animal_id) ou ANIMAL_PERIOD (chave animal_key)
 */
export function attachWeightRegression(rows, points, { hoje, gmdDiasMinimos = GMD_DIAS_MINIMOS_PADRAO } = {}) {
  const minimo = normalizeGmdDiasMinimos(gmdDiasMinimos);
  for (const row of rows ?? []) {
    const key = row.animal_key ?? row.animal_id ?? null;
    const result = computeWeightedGmd(key ? points.get(key) ?? [] : [], { hoje, diasMinimos: minimo });
    row.gmd_regressao = result?.gmd ?? null;
    row.gmd_regressao_n = result?.n ?? 0;
    row.gmd_regressao_dias = result?.diasCobertos ?? null;
    row.gmd_regressao_erro_padrao = result?.erroPadrao ?? null;
  }
  // Qualidade pelos dias cobertos — a mesma regra (classifyGmd) e o mesmo mínimo de todos os GMD do relatório.
  annotateGmdQuality(rows ?? [], REGRESSION_COLUMNS, minimo);
  return rows;
}

/**
 * Lê os pontos da janela e acrescenta o GMD (regressão) às linhas já carregadas (runReport chama só quando a coluna
 * está em uso). @returns {{ hoje: string, rowsRead: number }}
 */
export async function loadAnimalRegression(rows, { period = null, today, empresaId, gmdDiasMinimos } = {}) {
  const hoje = regressionReferenceDate({ period, today });
  const { points, rowsRead } = await loadRegressionPoints({ hoje, empresaId });
  attachWeightRegression(rows, points, { hoje, gmdDiasMinimos });
  return { hoje, rowsRead };
}
