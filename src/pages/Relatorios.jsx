import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReportView from "@/components/reports/ReportView";
import { useReportActor } from "@/components/reports/reportUi";
import { resolveReportId } from "@/modules/reporting/definitions/reportCatalog";
import { getLegacyAlias } from "@/modules/reporting/definitions/legacyAliases";
import { getRecents, getReportViewState, getTypeColumnPrefs, listTemplates } from "@/modules/reporting/application/reportTemplateService";
import { initialReportId, reportSelectorOptions, withCurrentOption } from "@/modules/reporting/application/reportScreenModel";
import "@/styles/reports.css";

// Relatórios: uma entrada no menu e uma tela só (E1E, decisão da responsável em 30/09/2026): abre direto no
// relatório, na tela do MAKGESTAO, e o campo "Relatório" do cartão troca de relatório (?r=<id>). Sem `?r=`
// (ou id desconhecido) abre o último relatório usado; sem histórico, Pesagens. O catálogo em cartões saiu
// da navegação; modelos abrem e salvam pelo menu ⋯ da tela. A URL leva só identificadores — nunca filtros
// ou dados.
// E1 (1.4.0): `?r=<id antigo>` (links e favoritos de antes da 1.4.0) abre o relatório novo com a
// seleção do antigo; `&v=<id antigo>` faz o mesmo a partir do id novo (favorito "novo#antigo").
// E1B: sem modelo e sem visão antiga, o relatório volta como a pessoa deixou (último estado por usuário),
// lido ANTES de montar a tela (sem piscar nem calcular duas vezes). Precedência: modelo > visão antiga >
// último estado > padrão do relatório; `&d=` (atalho do Fechamento) só troca o período.
// E1D: a escolha de "Colunas" de cada tipo (por usuário) também é lida antes de montar — o relatório abre
// no tipo padrão já com as colunas que a pessoa escolheu para ele.
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
  const reportId = resolved?.definition?.id ?? null;
  const [template, setTemplate] = useState(null);
  const [templateReady, setTemplateReady] = useState(!templateId);
  const [savedState, setSavedState] = useState(null);
  const [savedReady, setSavedReady] = useState(false);
  const [typeColumns, setTypeColumns] = useState(null);
  const [typeColumnsReady, setTypeColumnsReady] = useState(false);
  const hasTypeColumns = Boolean(resolved?.definition?.views?.some((view) => view.columnChoices));
  // Campo "Relatório": o catálogo do perfil (+ o relatório aberto por link, se estiver fora dele).
  const options = useMemo(() => (actor ? reportSelectorOptions(actor) : []), [actor]);

  // Sem relatório na URL: último usado (ou Pesagens), trocando a URL (voltar do navegador não cai aqui de novo).
  useEffect(() => {
    if (!actor || reportId) return undefined;
    let alive = true;
    getRecents(actor)
      .catch(() => [])
      .then((recents) => { if (alive) navigate(`/Relatorios?r=${encodeURIComponent(initialReportId(recents, options))}`, { replace: true }); });
    return () => { alive = false; };
  }, [actor, reportId, options, navigate]);

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

  useEffect(() => {
    let alive = true;
    setSavedReady(false);
    if (!reportId || !actor || templateId || presetId) { setSavedState(null); setSavedReady(true); return undefined; }
    getReportViewState(reportId, actor)
      .then((state) => { if (alive) setSavedState(state); })
      .catch(() => { if (alive) setSavedState(null); })
      .finally(() => { if (alive) setSavedReady(true); });
    return () => { alive = false; };
  }, [reportId, actor, templateId, presetId]);

  useEffect(() => {
    let alive = true;
    setTypeColumnsReady(false);
    if (!reportId || !actor || !hasTypeColumns) { setTypeColumns(null); setTypeColumnsReady(true); return undefined; }
    getTypeColumnPrefs(reportId, actor)
      .then((prefs) => { if (alive) setTypeColumns(prefs); })
      .catch(() => { if (alive) setTypeColumns(null); })
      .finally(() => { if (alive) setTypeColumnsReady(true); });
    return () => { alive = false; };
  }, [reportId, actor, hasTypeColumns]);

  if (!actor || !resolved?.definition) return null;
  if (!templateReady || !savedReady || !typeColumnsReady) return null;
  const open = (id, chosen = null) => navigate(`/Relatorios?r=${encodeURIComponent(id)}${chosen ? `&m=${encodeURIComponent(chosen.id)}` : ""}`);
  return (
    <ReportView
      key={`${resolved.definition.id}:${presetId ?? ""}:${templateId ?? ""}:${day ?? ""}`}
      reportId={resolved.definition.id}
      presetId={template ? null : presetId}
      template={template}
      savedState={template || presetId ? null : savedState}
      typeColumnPrefs={typeColumns}
      initialPeriod={day ? { preset: "personalizado", from: day, to: day } : null}
      actor={actor}
      onBack={null}
      reportOptions={withCurrentOption(options, resolved.definition)}
      // Trocar de relatório abre o outro com o último estado dele; abrir um modelo, o modelo (&m=).
      onSelectReport={(id) => open(id)}
      onOpenTemplate={(chosen) => open(resolved.definition.id, chosen)}
    />
  );
}
