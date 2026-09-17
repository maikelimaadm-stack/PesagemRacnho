// Fontes Dexie dos grãos ANIMAL_CURRENT (projeção `animais`, sem reconstruir histórico) e
// ANIMAL_PERIOD (eventos do período pelo índice data_pesagem, agregados por animal).
import storage from '../../../../storage/storageAdapter.js';
import { loadEventRows } from './eventSource.js';
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

export async function loadAnimalCurrentRows({ empresaId, today, params } = {}) {
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const animals = await db.table('animais').toArray();
  const queriedAt = performance.now();
  const { lookups, categorias } = await loadLookups(db);
  const { bands, origin } = resolveBands(params, categorias);
  const scoped = animals.filter((row) => !empresaId || !row.empresa_id || row.empresa_id === empresaId);
  const rows = toAnimalCurrentRows(scoped, lookups, { today, bands });
  const warnings = [];
  if (!bands.length) warnings.push({ code: 'NO_WEIGHT_BANDS', message: 'Nenhuma faixa de peso configurada (categorias sem faixa e modelo sem faixas): faixa aparece como "Não informado".' });
  return { rows, strategy: 'projection:animais', rowsRead: animals.length, timings: { query: queriedAt - startedAt, transform: performance.now() - queriedAt }, warnings, bandsOrigin: origin };
}

export async function loadAnimalPeriodRows({ empresaId, period, params } = {}) {
  const events = await loadEventRows({ from: period.from, to: period.to, empresaId });
  const db = await storage.ensureReady();
  const startedAt = performance.now();
  const ids = [...new Set(events.rows.map((row) => row.animal_id || row.animal_id_resolvido).filter(Boolean))];
  const animals = ids.length ? (await db.table('animais').where('id').anyOf(ids).toArray()).filter((row) => !row.deleted_at) : [];
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
