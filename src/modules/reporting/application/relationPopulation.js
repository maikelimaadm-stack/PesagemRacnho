// População da Relação de Pesagens (tela operacional) calculada pelo núcleo de reporting.
// A tela chama esta função; o gate reports:relation-parity:verify compara o resultado com o
// relatório "Pesagens por período" — mesma transformação de linhas, mesmo filtro, mesma ordem.
import { applyFilters } from '../domain/filterEngine.js';
import { sortRows } from '../domain/sortEngine.js';
import { createColumnResolver } from '../domain/reportDefinition.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from '../definitions/columns/eventColumns.js';

export const resolveEventColumn = createColumnResolver(EVENT_COLUMNS);

/**
 * @param rows event rows (loadEventRows)
 * @param {{ searchTerm?: string, filtrosColuna?: object, sortConfig?: { key: string, direction: 'asc'|'desc' } }} state
 */
export function relationPopulation(rows, { searchTerm = '', filtrosColuna = {}, sortConfig = { key: 'data_pesagem', direction: 'desc' } } = {}) {
  const filtered = applyFilters(rows, { search: searchTerm, searchColumnIds: RELATION_SEARCH_COLUMN_IDS, filters: filtrosColuna }, resolveEventColumn);
  return sortRows(filtered, sortConfig?.key ? [{ columnId: sortConfig.key, direction: sortConfig.direction }] : [], resolveEventColumn);
}
