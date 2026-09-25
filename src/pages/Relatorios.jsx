import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReportCatalog from "@/components/reports/ReportCatalog";
import ReportView from "@/components/reports/ReportView";
import { useReportActor } from "@/components/reports/reportUi";
import { resolveReportId } from "@/modules/reporting/definitions/reportCatalog";
import { getLegacyAlias } from "@/modules/reporting/definitions/legacyAliases";
import { listTemplates } from "@/modules/reporting/application/reportTemplateService";
import "@/styles/reports.css";

// Relatórios: uma entrada no menu. Sem `?r=` mostra o catálogo; com `?r=<id>` (e `&m=<modelo>`)
// abre o relatório. A URL leva só identificadores — nunca filtros ou dados.
// E1 (1.4.0): `?r=<id antigo>` (links e favoritos de antes da 1.4.0) abre o relatório novo com a
// seleção do antigo; `&v=<id antigo>` faz o mesmo a partir do id novo (favorito "novo#antigo").
export default function Relatorios() {
  const actor = useReportActor();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedId = params.get("r");
  const templateId = params.get("m");
  // Data civil (atalho do Fechamento do Dia): só pré-preenche o período; nunca filtros ou dados.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d") : null;
  const resolved = requestedId ? resolveReportId(requestedId) : null;
  const viewParam = params.get("v");
  const presetId = resolved?.aliasId ?? (viewParam && getLegacyAlias(viewParam)?.id === resolved?.definition?.id ? viewParam : null);
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
  const open = ({ reportId: id, template: chosen, presetId: view }) => navigate(`/Relatorios?r=${encodeURIComponent(id)}${chosen ? `&m=${encodeURIComponent(chosen.id)}` : ""}${!chosen && view ? `&v=${encodeURIComponent(view)}` : ""}`);

  if (resolved?.definition) {
    if (!templateReady) return null;
    return (
      <ReportView
        key={`${resolved.definition.id}:${presetId ?? ""}:${templateId ?? ""}:${day ?? ""}`}
        reportId={resolved.definition.id}
        presetId={template ? null : presetId}
        template={template}
        initialPeriod={day ? { preset: "personalizado", from: day, to: day } : null}
        actor={actor}
        onBack={() => navigate("/Relatorios")}
        onTemplateSaved={() => setRefreshKey((value) => value + 1)}
      />
    );
  }
  return <ReportCatalog actor={actor} onOpen={open} refreshKey={refreshKey} />;
}
