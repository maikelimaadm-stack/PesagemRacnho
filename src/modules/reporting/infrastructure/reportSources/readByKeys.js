// Leitura de entidades referenciadas (animais, sessões, permanências) por uma lista de chaves.
// Poucas chaves: `anyOf` no índice. Muitas chaves: uma leitura da store + filtro por Set.
// Medido na massa 36k (Node + fake-indexeddb): anyOf com 2.768 ids = 94 s; ler os 12 mil
// animais = 0,3 s. No IndexedDB real o anyOf faz um salto de cursor por chave — também perde
// para uma leitura sequencial quando a lista é grande. Nunca usado na store `pesagens`
// (essa é sempre filtrada pelo índice de data).
export const ANY_OF_MAX_KEYS = 64;

export async function readByKeys(table, indexName, keys, { maxKeys = ANY_OF_MAX_KEYS } = {}) {
  if (table.name === 'pesagens') throw new Error('readByKeys: pesagens é lida pelo índice de data, nunca inteira');
  const unique = [...new Set((keys || []).filter((key) => key !== null && key !== undefined && key !== ''))];
  if (!unique.length) return [];
  if (unique.length <= maxKeys) return table.where(indexName).anyOf(unique).toArray();
  const wanted = new Set(unique);
  return (await table.toArray()).filter((row) => wanted.has(row[indexName]));
}
