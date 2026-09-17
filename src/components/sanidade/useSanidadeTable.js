// Estado de tabela da Tela Mãe (ModeloBase1) compartilhado pelas três abas da Sanidade:
// pesquisa da barra, filtros por coluna (pílulas e menus de cabeçalho), seleção,
// paginação e configuração de colunas com preferência local por aba.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isMakColumnFilterActive, matchesMakColumnFilter } from '@/components/mak/MakColumnMenu';
import { matchesSanitySearch } from './sanidadeModel.js';

const SELECTION_COLUMN = { id: 'selecao', label: 'Seleção', default: true, fixo: true };
const keyById = (row) => row.id;

function readPref(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* preferência é opcional */ }
}

export function useSanidadeTable({ rows, columns, ctx, prefsKey, getKey = keyById }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [columnMenuOpen, setColumnMenuOpen] = useState(null);
  const [selected, setSelected] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState(() => readPref(`${prefsKey}:ordem`));
  const [visibleColumnIds, setVisibleColumnIds] = useState(() => readPref(`${prefsKey}:visiveis`));

  const cellText = useCallback((column, row) => column.text(row, ctx), [ctx]);
  const configurableColumns = useMemo(() => [
    SELECTION_COLUMN,
    ...columns.map((column) => ({ id: column.id, label: column.label, default: true })),
  ], [columns]);
  const tableColumns = useMemo(() => {
    const known = new Set(columns.map((column) => column.id));
    const order = (columnOrder || []).filter((id) => known.has(id));
    const ordered = [...order, ...columns.map((column) => column.id).filter((id) => !order.includes(id))];
    const visible = visibleColumnIds ? new Set(visibleColumnIds) : null;
    return ordered
      .filter((id) => !visible || visible.has(id))
      .map((id) => columns.find((column) => column.id === id))
      .filter(Boolean);
  }, [columns, columnOrder, visibleColumnIds]);
  const applyColumnConfig = ({ order, visible }) => {
    setColumnOrder(order);
    setVisibleColumnIds(visible);
    writePref(`${prefsKey}:ordem`, order);
    writePref(`${prefsKey}:visiveis`, visible);
  };

  const filtered = useMemo(() => rows.filter((row) => {
    const failsColumn = columns.some((column) => isMakColumnFilterActive(columnFilters[column.id])
      && !matchesMakColumnFilter(cellText(column, row), columnFilters[column.id], 'text'));
    return !failsColumn && matchesSanitySearch(row, columns, search, ctx);
  }), [rows, columns, columnFilters, search, cellText, ctx]);

  // Resultados da pesquisa expansível (até 30), antes de "Buscar todos".
  const searchResults = useMemo(() => {
    const term = searchInput.trim();
    if (!term) return { items: [], total: 0 };
    const matches = rows.filter((row) => matchesSanitySearch(row, columns, term, ctx));
    return {
      total: matches.length,
      items: matches.slice(0, 30).map((row) => ({
        id: getKey(row),
        _row: row,
        titulo: cellText(columns[0], row),
        ...Object.fromEntries(columns.slice(1).map((column) => [column.id, cellText(column, row)])),
      })),
    };
  }, [rows, columns, searchInput, ctx, cellText, getKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageKeys = paginated.map(getKey);
  const selectedRows = rows.filter((row) => selected.includes(getKey(row)));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(filtered.length / itemsPerPage))));
  }, [filtered.length, itemsPerPage]);
  // Depois de recarregar, a seleção guarda só chaves que continuam na lista.
  useEffect(() => {
    const keys = new Set(rows.map(getKey));
    setSelected((current) => (current.every((key) => keys.has(key)) ? current : current.filter((key) => keys.has(key))));
  }, [rows, getKey]);

  const columnListOptions = useCallback((column) => [...new Set(rows.map((row) => cellText(column, row)).filter(Boolean))], [rows, cellText]);
  const setColumnFilter = (columnId, value) => { setColumnFilters((current) => ({ ...current, [columnId]: value })); setCurrentPage(1); };
  const clearFilters = () => { setColumnFilters({}); setSearch(''); setSearchInput(''); setCurrentPage(1); };
  const toggleRow = (key) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  const setRowChecked = (key, checked) => setSelected((current) => (checked ? [...new Set([...current, key])] : current.filter((item) => item !== key)));
  const setPageChecked = (checked) => setSelected((current) => (checked ? [...new Set([...current, ...pageKeys])] : current.filter((key) => !pageKeys.includes(key))));

  return {
    getKey,
    cellText,
    searchInput,
    setSearchInput,
    search,
    applySearch: () => { setSearch(searchInput.trim()); setCurrentPage(1); },
    clearSearch: () => { setSearchInput(''); setSearch(''); setCurrentPage(1); },
    searchResults,
    columnFilters,
    setColumnFilter,
    hasActiveColumnFilters: Object.values(columnFilters).some(isMakColumnFilterActive),
    clearFilters,
    columnMenuOpen,
    setColumnMenuOpen,
    columnListOptions,
    configurableColumns,
    tableColumns,
    columnOrder,
    visibleColumnIds,
    applyColumnConfig,
    showColumnConfig,
    setShowColumnConfig,
    filtered,
    paginated,
    pageKeys,
    totalPages,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage: (amount) => { setItemsPerPage(amount); setCurrentPage(1); },
    selected,
    selectedRows,
    setSelected,
    toggleRow,
    setRowChecked,
    setPageChecked,
    allPageSelected: pageKeys.length > 0 && pageKeys.every((key) => selected.includes(key)),
    somePageSelected: pageKeys.some((key) => selected.includes(key)),
  };
}
