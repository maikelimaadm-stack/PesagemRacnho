import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MakTh, { makRowClass } from "@/components/mak/MakTh";
import { fmtInt } from "@/components/common/formatNumber";
import { flattenTree } from "@/modules/reporting/domain/groupEngine";
import { formatGroupLabel } from "@/modules/reporting/domain/summaryLayout";
import { aggregateChips, headerLabel, screenCell } from "./reportUi";

// Tabela do relatório (ModeloBase1 `.emp-table-pro`): linhas de grupo, dados e subtotal vindas da
// árvore do view model; paginação SOMENTE de apresentação — subtotais e total geral são sempre da
// população inteira filtrada.
export default function ReportTable({ viewModel, sort, onSort, widths = {}, filters = {}, onFilter, onHide, optionsFor, filterTypeFor }) {
  const [page, setPage] = useState(1);
  const [menuColumn, setMenuColumn] = useState(null);
  const [pageSize, setPageSize] = useState(100);
  const columns = viewModel.columns;

  const lines = useMemo(() => (viewModel.tree.length
    ? flattenTree(viewModel.tree)
    : viewModel.rows.map((row) => ({ kind: "DATA", row }))), [viewModel]);
  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = lines.slice((current - 1) * pageSize, current * pageSize);
  const minWidth = columns.reduce((total, column) => total + (widths[column.id] || column.defaultWidth || 120), 0);
  const sortOf = (columnId) => sort.find((item) => item.columnId === columnId)?.direction ?? null;
  const totals = aggregateChips(viewModel, viewModel.totals);
  // Rótulo do grupo no formato brasileiro (data dd/mm/aaaa, Sim/Não), como na folha e nas exportações.
  const groupColumns = viewModel.availableColumns ?? viewModel.columns;
  const groupLabel = (node) => formatGroupLabel(groupColumns.find((column) => column.id === node.columnId) ?? null, node.label, "screen", node.missing);

  let dataIndex = 0;
  return (
    <>
      <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll rpt-table-scroll">
        <Table className="emp-table-pro d17c-data-table rpt-table" style={{ minWidth: `${minWidth}px` }}>
          <colgroup>
            {columns.map((column) => <col key={column.id} style={{ width: `${widths[column.id] || column.defaultWidth || 120}px` }} />)}
          </colgroup>
          <TableHeader>
            <TableRow className="bg-white border-b">
              {columns.map((column) => (
                <MakTh
                  key={column.id}
                  label={headerLabel(column)}
                  className={column.align === "right" ? "text-right" : ""}
                  sortDirection={sortOf(column.id)}
                  onSort={() => onSort(column.id)}
                  menuOpen={menuColumn === column.id}
                  onOpenMenu={() => setMenuColumn(menuColumn === column.id ? null : column.id)}
                  menu={{
                    onFechar: () => setMenuColumn(null),
                    valorFiltro: filters[column.id] || "",
                    filterType: filterTypeFor(column),
                    listOptions: menuColumn === column.id ? optionsFor(column) : [],
                    onFiltrar: (value) => onFilter(column.id, value),
                    onOcultar: () => { setMenuColumn(null); onHide(column.id); },
                  }}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="rpt-empty">Nenhum registro para os critérios informados.</TableCell></TableRow>
            ) : visible.map((line, index) => {
              if (line.kind === "GROUP") {
                return (
                  <TableRow key={`g-${line.node.id}-${index}`} className={`rpt-group-row rpt-level-${line.node.level}`}>
                    <TableCell colSpan={columns.length}>
                      <span className="rpt-group-label" style={{ paddingLeft: `${(line.node.level - 1) * 16}px` }}>
                        {line.node.columnLabel}: <strong>{groupLabel(line.node)}</strong>
                      </span>
                      <span className="rpt-group-count">{fmtInt(line.node.rowCount)} {line.node.rowCount === 1 ? "registro" : "registros"}</span>
                    </TableCell>
                  </TableRow>
                );
              }
              if (line.kind === "SUBTOTAL") {
                const chips = aggregateChips(viewModel, line.node.aggregates, line.node.level);
                return (
                  <TableRow key={`s-${line.node.id}-${index}`} className={`rpt-subtotal-row rpt-level-${line.node.level}`}>
                    <TableCell colSpan={columns.length}>
                      <span className="rpt-subtotal-label" style={{ paddingLeft: `${(line.node.level - 1) * 16}px` }}>Subtotal · {groupLabel(line.node)}</span>
                      {chips.map((chip) => (
                        <span key={chip.id} className="rpt-chip" title={chip.partial ? `Calculado com ${chip.partial} valores (ausentes não contam como zero)` : undefined}>
                          {chip.label}: <strong>{chip.value}</strong>{chip.partial ? <em> ({chip.partial})</em> : null}
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                );
              }
              const rowClass = makRowClass(dataIndex);
              dataIndex += 1;
              return (
                <TableRow key={`d-${line.row.id ?? index}-${index}`} className={`${rowClass} emp-table-data-row`}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={`text-xs${column.align === "right" ? " text-right font-mono" : ""}`}>
                      {screenCell(viewModel, column, line.row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="rpt-grand-total" role="region" aria-label="Total geral">
        <span className="rpt-grand-total__label">Total geral</span>
        {totals.map((chip) => (
          <span key={chip.id} className="rpt-chip rpt-chip--total" title={chip.partial ? `Calculado com ${chip.partial} valores` : undefined}>
            {chip.label}: <strong>{chip.value}</strong>{chip.partial ? <em> ({chip.partial})</em> : null}
          </span>
        ))}
      </div>

      <div className="d17c-table-footer">
        <span><strong>Registros:</strong> {fmtInt(viewModel.rowCount)}</span>
        {viewModel.uniqueAnimalCount !== null ? <span><strong>Animais únicos:</strong> {fmtInt(viewModel.uniqueAnimalCount)}</span> : null}
        {viewModel.tree.length ? <span><strong>Grupos (nível 1):</strong> {fmtInt(viewModel.tree.length)}</span> : null}
        <span><strong>Linhas na página:</strong> {fmtInt(visible.length)}</span>
        <div className="d17c-table-footer__pagination">
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger aria-label="Linhas por página"><SelectValue /></SelectTrigger>
            <SelectContent>{[50, 100, 250, 500].map((amount) => <SelectItem key={amount} value={String(amount)}>{amount}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
          <span>{fmtInt(current)}/{fmtInt(totalPages)}</span>
          <Button type="button" variant="ghost" size="icon" disabled={current >= totalPages} onClick={() => setPage(current + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
    </>
  );
}
