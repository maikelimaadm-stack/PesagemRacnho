import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReportCatalog from "@/components/reports/ReportCatalog";
import ReportView from "@/components/reports/ReportView";
import { useReportActor } from "@/components/reports/reportUi";
import { getReportDefinition } from "@/modules/reporting/definitions/reportCatalog";
import { listTemplates } from "@/modules/reporting/application/reportTemplateService";
import "@/styles/reports.css";

// Relatórios: uma entrada no menu. Sem `?r=` mostra o catálogo; com `?r=<id>` (e `&m=<modelo>`)
// abre o relatório. A URL leva só identificadores — nunca filtros ou dados.
export default function Relatorios() {
  const actor = useReportActor();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const reportId = params.get("r");
  const templateId = params.get("m");
  const [template, setTemplate] = useState(null);
  const [templateReady, setTemplateReady] = useState(!templateId);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!templateId || !actor) { setTemplate(null); setTemplateReady(true); return undefined; }
    setTemplateReady(false);
    listTemplates(actor).then((items) => {
      if (!alive) return;
      setTemplate(items.find((item) => item.id === templateId) ?? null);
      setTemplateReady(true);
    });
    return () => { alive = false; };
  }, [templateId, actor]);

  if (!actor) return null;
  const open = ({ reportId: id, template: chosen }) => navigate(`/Relatorios?r=${encodeURIComponent(id)}${chosen ? `&m=${encodeURIComponent(chosen.id)}` : ""}`);

  if (reportId && getReportDefinition(reportId)) {
    if (!templateReady) return null;
    return (
      <ReportView
        key={`${reportId}:${templateId ?? ""}`}
        reportId={reportId}
        template={template}
        actor={actor}
        onBack={() => navigate("/Relatorios")}
        onTemplateSaved={() => setRefreshKey((value) => value + 1)}
      />
    );
  }
  return <ReportCatalog actor={actor} onOpen={open} refreshKey={refreshKey} />;
}
