import React, { useCallback, useMemo } from "react";
import { buildReportDocument } from "@/modules/reporting/domain/reportDocument";
import { renderSheetBody } from "@/modules/reporting/infrastructure/exporters/sheetHtml";
import { SHEET_CSS } from "@/modules/reporting/infrastructure/exporters/sheetStyles";

// Folha do relatório na tela (E1B 1.4.0): o MESMO documento (reportDocument) e a MESMA marcação/CSS
// (sheetHtml/sheetStyles) da impressão e do PDF — a tela é a pré-visualização do papel. Interativa por
// delegação: clique no nome de um grupo (ou no título da seção) abre o Detalhado recortado (detalhe da E1);
// clique no cabeçalho de uma métrica ordena os grupos por ela (dentro de cada seção).
// Detalhado como folha ("Ver como folha") limita as linhas na tela; a impressão leva todas.
export const SCREEN_MAX_DATA_ROWS = 2000;

export default function ReportSheetView({ viewModel, header = null, orientation = "auto", showEmptyColumns = false, sort = null, onDrill, onSort }) {
  const doc = useMemo(
    () => buildReportDocument(viewModel, { header, orientation, showEmptyColumns, maxDataRows: SCREEN_MAX_DATA_ROWS }),
    [viewModel, header, orientation, showEmptyColumns],
  );
  const html = useMemo(() => renderSheetBody(doc, { mode: "fragment", interactive: true, sort }), [doc, sort]);

  const activate = useCallback((target) => {
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
  }, [doc, onDrill, onSort]);

  return (
    <div className="rpt-sheet-host" data-orientation={doc.print.orientation}>
      <style>{SHEET_CSS}</style>
      {/* Delegação de clique: os alvos são <button> dentro da folha (teclado e foco nativos). */}
      <div
        className="rpt-sheet-host__paper"
        onClick={(event) => { if (activate(event.target)) event.preventDefault(); }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
