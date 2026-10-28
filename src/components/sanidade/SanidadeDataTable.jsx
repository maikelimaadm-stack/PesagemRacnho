// Tabela da Tela Mãe (ModeloBase1) usada pelas abas da Sanidade: mesmas classes da
// tabela dos cadastros mestres (emp-table-pro/aux-data-table), cabeçalhos MakTh com
// filtro por coluna, seleção por caixa, estado vazio, rodapé com contadores e paginação
// e diálogo de configuração de colunas.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MakColumnConfigDialog from '@/components/mak/MakColumnConfigDialog';
import MakTableSelectCheck from '@/components/mak/MakTableSelectCheck';
import MakTh from '@/components/mak/MakTh';

export function SanidadeTone({ tone, children }) {
  return <span className={`sanidade-status sanidade-status--${tone}`}>{children}</span>;
}

export default function SanidadeDataTable({ table, totalLabel = 'Totais', totalCount, loading, loadingText, emptyText, filteredEmptyText, ariaLabel, onOpenRow, rowClassName }) {
  const {
    tableColumns, paginated, filtered, selected, getKey, cellText, columnFilters, setColumnFilter,
    columnMenuOpen, setColumnMenuOpen, columnListOptions, allPageSelected, somePageSelected,
    setPageChecked, setRowChecked, toggleRow, currentPage, totalPages, setCurrentPage, itemsPerPage, setItemsPerPage,
  } = table;
  const colSpan = tableColumns.length + 1;
  const emptyMessage = totalCount ? (filteredEmptyText || 'Nenhum registro atende aos filtros.') : emptyText;

  return (
    <>
      <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll aux-table-scroll" aria-label={ariaLabel}>
        <Table className="emp-table-pro d17c-data-table aux-data-table sanidade-data-table">
          <colgroup>
            <col style={{ width: '36px' }} />
            {tableColumns.map((column) => <col key={column.id} style={{ width: `${column.width || 160}px` }} />)}
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="emp-th-select aux-check-cell">
                <div className="emp-table-select-wrap">
                  <MakTableSelectCheck checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={setPageChecked} ariaLabel="Selecionar todos os registros listados" />
                </div>
              </TableHead>
              {tableColumns.map((column) => (
                <MakTh
                  key={column.id}
                  label={column.label}
                  menuOpen={columnMenuOpen === column.id}
                  onOpenMenu={() => setColumnMenuOpen(columnMenuOpen === column.id ? null : column.id)}
                  menu={{
                    onFechar: () => setColumnMenuOpen(null),
                    valorFiltro: columnFilters[column.id],
                    filterType: 'text',
                    // Valores únicos só para o menu aberto (listas grandes não pesam a cada render).
                    listOptions: columnMenuOpen === column.id ? columnListOptions(column) : [],
                    onFiltrar: (value) => setColumnFilter(column.id, value),
                  }}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading ? paginated.map((row, index) => {
              const key = getKey(row);
              const isSelected = selected.includes(key);
              return (
                <TableRow
                  key={key}
                  className={`${index % 2 ? 'emp-row-odd' : 'emp-row-even'} emp-table-data-row${isSelected ? ' emp-row-selected' : ''}${rowClassName ? ` ${rowClassName(row)}` : ''}`}
                  onClick={() => toggleRow(key)}
                  onDoubleClick={onOpenRow ? () => onOpenRow(row) : undefined}
                >
                  <TableCell className="emp-td-select aux-check-cell" onClick={(event) => event.stopPropagation()}>
                    <div className="emp-table-select-wrap">
                      <MakTableSelectCheck checked={isSelected} onChange={(checked) => setRowChecked(key, checked)} ariaLabel={`Selecionar ${cellText(tableColumns[0] || { text: () => '' }, row)}`} />
                    </div>
                  </TableCell>
                  {tableColumns.map((column) => {
                    const text = cellText(column, row);
                    return (
                      <TableCell key={column.id} className={`${column.strong ? 'font-semibold' : ''}${column.numeric ? ' sanidade-cell--number' : ''}`.trim() || undefined} title={text}>
                        {column.tone ? <SanidadeTone tone={column.tone(row)}>{text}</SanidadeTone> : text}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            }) : null}
            {!loading && !filtered.length ? <TableRow><TableCell colSpan={colSpan} className="d17d-empty-row sanidade-empty-row" role="status">{emptyMessage}</TableCell></TableRow> : null}
            {loading ? <TableRow><TableCell colSpan={colSpan} className="d17d-empty-row sanidade-empty-row" role="status">{loadingText}</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
      <footer className="d17c-table-footer aux-table-footer">
        <span><strong>Selecionados:</strong> {selected.length}</span>
        <span><strong>Listados:</strong> {loading ? 0 : paginated.length}</span>
        <span><strong>Filtrados:</strong> {loading ? 0 : filtered.length}</span>
        <span><strong>{totalLabel}:</strong> {totalCount}</span>
        <div className="d17c-table-footer__pagination">
          <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
            <SelectTrigger aria-label="Itens por página"><SelectValue /></SelectTrigger>
            <SelectContent>{[25, 50, 100, 200].map((amount) => <SelectItem key={amount} value={String(amount)}>{amount}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
          <span>{currentPage}/{totalPages}</span>
          <Button type="button" variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" /></Button>
        </div>
      </footer>
    </>
  );
}

export function SanidadeColumnConfig({ table }) {
  const { showColumnConfig, setShowColumnConfig, configurableColumns, columnOrder, visibleColumnIds, applyColumnConfig } = table;
  return (
    <MakColumnConfigDialog
      open={showColumnConfig}
      onOpenChange={setShowColumnConfig}
      columns={configurableColumns}
      order={columnOrder || configurableColumns.map((column) => column.id)}
      visible={visibleColumnIds || configurableColumns.map((column) => column.id)}
      onApply={applyColumnConfig}
    />
  );
}
