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
