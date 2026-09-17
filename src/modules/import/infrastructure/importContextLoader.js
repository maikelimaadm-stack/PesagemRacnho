// Leitura do banco para a análise da importação. Carrega só o necessário:
//   - cadastros e identidade (animais, identificadores, marcas, raças, categorias, causas,
//     apartações, lotes) — stores pequenas ou lidas uma vez;
//   - a série de pesagens SOMENTE dos animais candidatos das linhas.
// Poucos animais: índice `animal_id` por animal. Muitos: uma leitura de `pesagens` filtrada
// por Set — `anyOf` com milhares de chaves é quadrático no fake-indexeddb e perde para a
// leitura sequencial também no IndexedDB real (ver reporting/infrastructure/reportSources/readByKeys.js).
import { storageRecordToViewModel } from '../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents } from '../../weighing/domain/weighingSeries.js';

export const SERIES_INDEX_MAX_ANIMALS = 64;

const hasTable = (db, name) => db.tables.some((table) => table.name === name);
const readAll = async (db, name) => (hasTable(db, name) ? db.table(name).toArray() : []);

export async function loadImportRegistry(db) {
  const [animals, identifiers, marcas, racas, categorias, causas, apartacoes, lotes] = await Promise.all([
    readAll(db, 'animais'),
    readAll(db, 'animalIdentificadores'),
    readAll(db, 'marcas'),
    readAll(db, 'racas'),
    readAll(db, 'categoriasAnimal'),
    readAll(db, 'causasMorte'),
    readAll(db, 'apartacoes'),
    readAll(db, 'loteApartacoes'),
  ]);
  return { animals, identifiers, marcas, racas, categorias, causas, apartacoes, lotes };
}

const groupSeries = (rows, wanted) => {
  const series = new Map([...wanted].map((id) => [id, []]));
  for (const row of rows) {
    if (row.deleted_at || !wanted.has(String(row.animal_id))) continue;
    series.get(String(row.animal_id)).push(storageRecordToViewModel(row));
  }
  for (const list of series.values()) list.sort(compareWeighingEvents);
  return series;
};

/** Cadastros de sanidade da base (stores pequenas): programas e medicamentos. */
export async function loadSanityRegistry(db) {
  const [programas, medicamentos] = await Promise.all([readAll(db, 'programasSanidade'), readAll(db, 'medicamentos')]);
  return { programas, medicamentos };
}

/**
 * Map(animalId → aplicações NÃO canceladas) dos animais candidatos, para a detecção de
 * "JÁ EXISTE" na importação de aplicações de sanidade. Mesma estratégia da série: índice por
 * animal quando são poucos, leitura sequencial filtrada quando são muitos.
 */
export async function loadApplicationsForAnimals(db, animalIds, { empresaId = 'local', maxIndexed = SERIES_INDEX_MAX_ANIMALS } = {}) {
  const wanted = new Set([...animalIds].map(String).filter(Boolean));
  if (!wanted.size || !hasTable(db, 'aplicacoesSanidade')) return new Map();
  const table = db.table('aplicacoesSanidade');
  let rows;
  if (wanted.size <= maxIndexed) {
    rows = [];
    for (const animalId of wanted) rows.push(...await table.where('animal_id').equals(animalId).toArray());
  } else {
    rows = await table.toArray();
  }
  const byAnimal = new Map([...wanted].map((id) => [id, []]));
  for (const row of rows) {
    const animalId = String(row.animal_id ?? '');
    if (row.deleted_at || row.cancelled_at || !wanted.has(animalId)) continue;
    if ((row.empresa_id ?? row.empresaId ?? empresaId) !== empresaId) continue;
    byAnimal.get(animalId).push(row);
  }
  return byAnimal;
}

/** Map(animalId → view models ordenados pela ordem canônica), sem excluídos. */
export async function loadSeriesForAnimals(db, animalIds, { maxIndexed = SERIES_INDEX_MAX_ANIMALS } = {}) {
  const wanted = new Set([...animalIds].map(String).filter(Boolean));
  if (!wanted.size) return new Map();
  const table = db.table('pesagens');
  if (wanted.size <= maxIndexed) {
    const rows = [];
    for (const animalId of wanted) rows.push(...await table.where('animal_id').equals(animalId).toArray());
    return groupSeries(rows, wanted);
  }
  return groupSeries(await table.toArray(), wanted);
}
