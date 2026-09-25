import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Layers, SearchCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MakTh from "@/components/mak/MakTh";
import { fmtInt } from "@/components/common/formatNumber";
import { SUMMARY_LABEL_SORT, buildSummaryLayout } from "@/modules/reporting/domain/summaryLayout";

// Resumido (E1 1.4.0): uma linha por grupo com as métricas em colunas (ModeloBase1 `.emp-table-pro`).
// As células vêm de buildSummaryLayout(viewModel, 'screen') — o MESMO layout do CSV, XLSX, impressão
// e JSON. Ordenar por uma métrica reordena os grupos do MESMO nível (a hierarquia não se mistura) e
// vale também para a exportação; clicar num grupo abre o Detalhado já filtrado por aquele grupo.
export default function ReportSummaryTable({ viewModel, summarySort, onSummarySort, onDrill, onChooseGrouping }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const layout = useMemo(() => buildSummaryLayout(viewModel, "screen"), [viewModel]);
  const groupCount = layout.groupHeaders.length;
  const grouped = viewModel.groups.length > 0;
  const nodeRows = layout.rows.filter((row) => row.type === "SUMMARY");
  const total = layout.rows.find((row) => row.type === "GRAND_TOTAL");
  const totalPages = Math.max(1, Math.ceil(nodeRows.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = nodeRows.slice((current - 1) * pageSize, current * pageSize);
  const sortOf = (key) => (summarySort?.key === key ? summarySort.direction : null);
  const toggleSort = (key) => onSummarySort(summarySort?.key === key && summarySort.direction === "desc" ? { key, direction: "asc" } : { key, direction: summarySort?.key === key ? "desc" : (key === SUMMARY_LABEL_SORT ? "asc" : "desc") });
  const partialOf = (node, metric) => {
    const result = node?.aggregates?.[metric.key];
    return result && result.n_ausentes > 0 && !["count", "countDistinct"].includes(metric.spec.op) ? `Calculado com ${result.n_validos} de ${result.n_total} valores (ausentes não contam como zero)` : undefined;
  };
  const widths = [...layout.groupHeaders.map(() => 190), ...layout.metrics.map(() => 128)];

  return (
    <>
      {!grouped ? (
        <div className="rpt-summary-hint" role="note">
          <Layers className="h-4 w-4" aria-hidden="true" />
          <span>Escolha <strong>Agrupar por</strong> para ver uma linha por grupo (lote, categoria, raça…).</span>
          {onChooseGrouping ? <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={onChooseGrouping}>Agrupar por…</button> : null}
        </div>
      ) : null}
      <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll rpt-table-scroll">
        <Table className="emp-table-pro d17c-data-table rpt-table rpt-summary-table" style={{ minWidth: `${widths.reduce((sum, width) => sum + width, 0)}px` }} aria-label="Resumo por grupo">
          <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}px` }} />)}</colgroup>
          <TableHeader>
            <TableRow className="bg-white border-b">
              {layout.headers.map((header, index) => {
                const isGroup = index < groupCount;
                const key = isGroup ? SUMMARY_LABEL_SORT : layout.metrics[index - groupCount].key;
                return (
                  <MakTh
                    key={`${header}-${index}`}
                    label={header}
                    className={isGroup ? "" : "text-right"}
                    sortDirection={isGroup ? (index === 0 ? sortOf(SUMMARY_LABEL_SORT) : null) : sortOf(key)}
                    onSort={isGroup && index > 0 ? undefined : () => { toggleSort(key); setPage(1); }}
                    onOpenMenu={null}
                  />
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && grouped ? (
              <TableRow><TableCell colSpan={layout.headers.length} className="rpt-empty">Nenhum registro para os critérios informados.</TableCell></TableRow>
            ) : visible.map((row, rowIndex) => (
              <TableRow key={row.node.id} className={`emp-table-data-row ${rowIndex % 2 === 0 ? "emp-row-even" : "emp-row-odd"} rpt-sum-row rpt-sum-level-${row.level}`}>
                {row.cells.map((cell, index) => {
                  if (index < groupCount) {
                    if (index !== row.level - 1) return <TableCell key={index} className="text-xs rpt-sum-label-empty" aria-hidden="true" />;
                    return (
                      <TableCell key={index} className="text-xs rpt-sum-label">
                        <button
                          type="button"
                          className="rpt-sum-drill"
                          onClick={() => onDrill(row.node)}
                          title={`Abrir o detalhado de ${row.node.columnLabel}: ${row.label}`}
                          aria-label={`Abrir o detalhado de ${row.node.columnLabel}: ${row.label} (${fmtInt(row.node.rowCount)} registro(s))`}
                        >
                          <span>{cell}</span>
                          <SearchCheck className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </TableCell>
                    );
                  }
                  const metric = layout.metrics[index - groupCount];
                  const partial = partialOf(row.node, metric);
                  return (
                    <TableCell key={index} className={`text-xs text-right font-mono${partial ? " rpt-sum-partial" : ""}`} title={partial}>
                      {cell}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          {total ? (
            <tfoot>
              <TableRow className="rpt-sum-total" aria-label="Total geral">
                {total.cells.map((cell, index) => {
                  const metric = index >= groupCount ? layout.metrics[index - groupCount] : null;
                  const partial = metric ? partialOf({ aggregates: viewModel.totals }, metric) : undefined;
                  return <TableCell key={index} className={`text-xs${metric ? " text-right font-mono" : ""}`} title={partial}>{cell}</TableCell>;
                })}
              </TableRow>
            </tfoot>
          ) : null}
        </Table>
      </div>

      <div className="d17c-table-footer">
        <span><strong>Grupos:</strong> {fmtInt(nodeRows.length)}</span>
        <span><strong>Registros:</strong> {fmtInt(viewModel.rowCount)}</span>
        {viewModel.uniqueAnimalCount !== null ? <span><strong>Cabeças:</strong> {fmtInt(viewModel.uniqueAnimalCount)}</span> : null}
        {grouped ? <span className="rpt-sum-tip">Clique num grupo para ver os animais dele (Detalhado).</span> : null}
        {nodeRows.length > pageSize ? (
          <div className="d17c-table-footer__pagination">
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
              <SelectTrigger aria-label="Grupos por página"><SelectValue /></SelectTrigger>
              <SelectContent>{[50, 100, 250, 500].map((amount) => <SelectItem key={amount} value={String(amount)}>{amount}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
            <span>{fmtInt(current)}/{fmtInt(totalPages)}</span>
            <Button type="button" variant="ghost" size="icon" disabled={current >= totalPages} onClick={() => setPage(current + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" /></Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
