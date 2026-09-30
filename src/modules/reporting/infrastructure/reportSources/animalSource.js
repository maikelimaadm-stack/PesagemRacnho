// Fontes Dexie dos grãos ANIMAL_CURRENT (projeção `animais`, sem reconstruir histórico) e
// ANIMAL_PERIOD (eventos do período pelo índice data_pesagem, agregados por animal).
import storage from '../../../../storage/storageAdapter.js';
import { storageRecordToViewModel } from '../../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents, measuredWeightOf } from '../../../weighing/domain/weighingSeries.js';
import { loadEventRows } from './eventSource.js';
import { readByKeys } from './readByKeys.js';
import { bandsFromCategories, buildAnimalLookups, toAnimalCurrentRows, toAnimalPeriodRows } from './animalRows.js';

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

// Até quantas datas distintas de última pesagem a leitura vai por `anyOf` no índice de data; acima disso, pelo
// intervalo entre a mais antiga e a mais recente (anyOf com muitas chaves é lento — ver readByKeys.js).
export const LAST_DATES_ANY_OF_MAX = 64;

/**
 * E1G (A4): entrada e última pesagem de cada animal do rebanho atual, SEM ler a base inteira e sem uma consulta por
 * animal — duas leituras pelo índice:
 *  - entrada: `tipo_pesagem` = Cadastro (uma linha por animal), o Cadastro com peso mais antigo na ordem canônica;
 *  - última: `data_pesagem` nas datas da última pesagem da projeção (`ultima_pesagem_data`); do animal naquela data,
 *    a última com peso na ordem canônica (como a projeção) — os derivados gravados nela (GMD, ganho, dias).
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
  const dates = [...new Set([...wanted.values()].map(lastDateOf).filter(Boolean))].sort();
  let lastRows = [];
  if (dates.length) {
    const index = db.table('pesagens').where('data_pesagem');
    lastRows = dates.length <= LAST_DATES_ANY_OF_MAX
      ? await index.anyOf(dates).toArray()
      : await index.between(dates[0], dates.at(-1), true, true).toArray();
  }
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

export async function loadAnimalCurrentRows({ empresaId, today, params } = {}) {
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const animals = await db.table('animais').toArray();
  const scoped = animals.filter((row) => !empresaId || !row.empresa_id || row.empresa_id === empresaId);
  const current = await loadCurrentWeighings(db, scoped);
  const queriedAt = performance.now();
  const { lookups, categorias } = await loadLookups(db);
  const { bands, origin } = resolveBands(params, categorias);
  const rows = toAnimalCurrentRows(scoped, lookups, { today, bands, weighings: current.weighings });
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
  };
}

export async function loadAnimalPeriodRows({ empresaId, period, params } = {}) {
  const events = await loadEventRows({ from: period.from, to: period.to, empresaId });
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const ids = [...new Set(events.rows.map((row) => row.animal_id || row.animal_id_resolvido).filter(Boolean))];
  const animals = (await readByKeys(db.table('animais'), 'id', ids)).filter((row) => !row.deleted_at);
  const { lookups, categorias } = await loadLookups(db);
  const { bands } = resolveBands(params, categorias);
  const rows = toAnimalPeriodRows(events.rows, new Map(animals.map((row) => [row.id, row])), lookups, { bands });
  return {
    rows,
    strategy: `${events.strategy}+group:animal`,
    rowsRead: events.rowsRead,
    timings: { query: events.timings.query, transform: events.timings.transform + (performance.now() - startedAt) },
  };
}
