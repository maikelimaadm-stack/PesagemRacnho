import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildReportDocument } from "@/modules/reporting/domain/reportDocument";
import { resizedWidth } from "@/modules/reporting/domain/headerActions";
import { renderSheetBody } from "@/modules/reporting/infrastructure/exporters/sheetHtml";
import { SHEET_CSS } from "@/modules/reporting/infrastructure/exporters/sheetStyles";
import SheetColumnMenu from "./SheetColumnMenu";

// Folha do relatório na tela (E1B 1.4.0): o MESMO documento (reportDocument) e a MESMA marcação/CSS
// (sheetHtml/sheetStyles) da impressão e do PDF — a tela é a pré-visualização do papel. Interativa por
// delegação: clique no nome de um grupo (ou no título da seção) abre o Detalhado recortado (detalhe da E1);
// clique no cabeçalho de uma métrica ordena os grupos por ela (dentro de cada seção).
// E1F (headerMenu, tela do MAKGESTAO): clique no título de QUALQUER coluna abre o menu da coluna
// (SheetColumnMenu — Ordenar, Calcular, Agrupar, Subtotal/Total, Ocultar, Adicionar) e arrastar a borda do
// título muda a largura (duplo clique: automática). As larguras (widths) vão para o documento: a tela, a
// impressão e o PDF usam as mesmas.
// Detalhado como folha ("Ver como folha") limita as linhas na tela; a impressão leva todas.
export const SCREEN_MAX_DATA_ROWS = 2000;

/**
 * @param headerMenu E1F: { menuFor(docColumn, layout) → menu|null, onAction(docColumn, action) } ou null (sem
 *   cabeçalho interativo — aba Controle da Manutenção)
 * @param widths larguras escolhidas ({ [chave da coluna]: px })
 */
export default function ReportSheetView({ viewModel, header = null, orientation = "auto", showEmptyColumns = false, showDetails = false, sort = null, widths = null, onDrill, onSort, headerMenu = null }) {
  const doc = useMemo(
    () => buildReportDocument(viewModel, { header, orientation, showEmptyColumns, showDetails, maxDataRows: SCREEN_MAX_DATA_ROWS, widths: widths ?? {} }),
    [viewModel, header, orientation, showEmptyColumns, showDetails, widths],
  );
  // Sem clique no grupo nem ordenação (Detalhado como folha): nenhum botão na folha.
  const interactive = Boolean(onDrill || onSort || headerMenu);
  const withMenu = Boolean(headerMenu);
  const html = useMemo(() => renderSheetBody(doc, { mode: "fragment", interactive, sort, headerMenu: withMenu }), [doc, interactive, sort, withMenu]);
  const hostRef = useRef(null);
  const [open, setOpen] = useState(null); // { key, anchor }
  const [guide, setGuide] = useState(null); // x da linha-guia do arraste (px dentro da folha)
  const dragRef = useRef(null);

  const columnOf = useCallback((key) => doc.columns.find((column) => column.key === key) ?? null, [doc]);
  // Folha nova (outra execução): o menu aberto era da anterior.
  useEffect(() => { setOpen(null); }, [doc]);

  const placeOf = (element) => {
    const host = hostRef.current;
    const rect = element.getBoundingClientRect();
    const base = host.getBoundingClientRect();
    return { left: rect.left - base.left + host.scrollLeft, top: rect.top - base.top + host.scrollTop, width: rect.width, height: rect.height };
  };

  const activate = useCallback((target) => {
    const menuButton = withMenu ? target.closest?.("[data-col-menu]") : null;
    if (menuButton) {
      const key = menuButton.getAttribute("data-col-menu");
      setOpen((current) => (current?.key === key ? null : { key, anchor: placeOf(menuButton.closest("th") ?? menuButton) }));
      return true;
    }
    const drill = target.closest?.("[data-drill]");
    if (drill) {
      const path = doc.drillTargets[drill.getAttribute("data-drill")];
      if (path && onDrill) onDrill(path);
      return true;
    }
    const sortButton = target.closest?.("[data-sort]");
    if (sortButton && onSort) {
      onSort(sortButton.getAttribute("data-sort"));
      return true;
    }
    return false;
  }, [doc, onDrill, onSort, withMenu]);

  // Arraste da borda do título: linha-guia enquanto arrasta; ao soltar, a largura que deixa a coluna com o
  // tamanho do arraste (headerActions.resizedWidth — as outras ficam como estão).
  const startResize = (event) => {
    const grip = event.target.closest?.("[data-col-grip]");
    if (!grip || !headerMenu || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const key = grip.getAttribute("data-col-grip");
    const th = grip.closest("th");
    const table = th?.closest("table");
    const index = doc.columns.findIndex((column) => column.key === key);
    if (!th || !table || index < 0) return;
    const startX = event.clientX;
    const startWidth = th.getBoundingClientRect().width;
    const edge = placeOf(th);
    dragRef.current = { key, index, startX, startWidth, tableWidth: table.getBoundingClientRect().width, edge: edge.left + edge.width };
    setGuide(dragRef.current.edge);
    const move = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = Math.max(16 - drag.startWidth, moveEvent.clientX - drag.startX);
      setGuide(drag.edge + dx);
    };
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const drag = dragRef.current;
      dragRef.current = null;
      setGuide(null);
      if (!drag) return;
      const dx = upEvent.clientX - drag.startX;
      if (Math.abs(dx) < 3) return;
      const width = resizedWidth({ widths: doc.print.widths.length === doc.columns.length ? doc.print.widths : doc.columns.map(() => drag.startWidth), index: drag.index, targetPx: Math.max(16, drag.startWidth + dx), tableWidthPx: drag.tableWidth });
      const column = columnOf(drag.key);
      if (width && column) headerMenu.onAction(column, { type: "resize", width, layout: doc.layout });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resetWidth = (event) => {
    const grip = event.target.closest?.("[data-col-grip]");
    if (!grip || !headerMenu) return;
    event.preventDefault();
    const column = columnOf(grip.getAttribute("data-col-grip"));
    if (column) headerMenu.onAction(column, { type: "resetWidth", layout: doc.layout });
  };

  const menu = open && headerMenu ? headerMenu.menuFor(columnOf(open.key), doc.layout) : null;

  return (
    <div className={`rpt-sheet-host${withMenu ? " rpt-sheet-host--interactive" : ""}`} data-orientation={doc.print.orientation} ref={hostRef}>
      <style>{SHEET_CSS}</style>
      {/* Delegação de clique: os alvos são <button> dentro da folha (teclado e foco nativos). */}
      <div
        className="rpt-sheet-host__paper"
        onClick={(event) => { if (activate(event.target)) event.preventDefault(); }}
        onPointerDown={withMenu ? startResize : undefined}
        onDoubleClick={withMenu ? resetWidth : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {guide !== null ? <div className="rpt-col-guide" style={{ left: guide }} aria-hidden="true" /> : null}
      {menu ? (
        <SheetColumnMenu
          menu={menu}
          anchor={open.anchor}
          onAction={(action) => headerMenu.onAction(columnOf(open.key), action)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
