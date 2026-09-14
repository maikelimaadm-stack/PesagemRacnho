const normalize = (value) => String(value ?? '').trim().toLocaleUpperCase('pt-BR');

export const importLotKey = (entry = {}) => `${normalize(entry.nome_lote)}|${normalize(entry.nome_apartacao)}`;

/** Applies the checkbox choices made in the lot-linking dialog. */
export function applyImportLotSelection(rows = [], candidates = [], selected = {}) {
  const candidatesByKey = new Map(candidates.map((candidate) => [importLotKey(candidate), candidate]));
  return rows
    .filter((row) => {
      const candidate = candidatesByKey.get(importLotKey(row));
      return !candidate || selected[importLotKey(candidate)] === true;
    })
    .map((row) => {
      const candidate = candidatesByKey.get(importLotKey(row));
      return candidate ? { ...row, lote_id: candidate.lote_id, apartacao_id: candidate.apartacao_id } : row;
    });
}
