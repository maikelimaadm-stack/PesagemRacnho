import React, { useMemo } from "react";
import { FileText, Lock } from "lucide-react";
import { REPORT_VISIBILITY } from "@/modules/reporting/domain/reportDefinition";
import { listReports } from "@/modules/reporting/application/reportService";
import "@/styles/reports.css";

// Aba Controle da Manutenção (E1 1.4.0): relatórios de conferência do sistema — trilha de auditoria,
// qualidade dos dados, histórico de backups e pendências de pesagem. Saíram do catálogo de Relatórios
// (que ficou com os 12 do dia a dia) e abrem na mesma tela de relatório (ReportView).
export default function MaintenanceControlReports({ actor, onOpen }) {
  const reports = useMemo(() => (actor ? listReports(actor, { visibility: REPORT_VISIBILITY.MAINTENANCE }) : []), [actor]);
  const available = reports.filter((report) => report.available);
  return (
    <section className="rpt-page rpt-maintenance" aria-labelledby="rpt-controle-titulo" id="manutencao-panel-controle" role="tabpanel">
      <h2 id="rpt-controle-titulo" className="rpt-maintenance__title">Relatórios de controle</h2>
      <p className="rpt-maintenance__hint">Conferência do sistema: quem fez o quê, dados a revisar, backups e lançamentos com pendência.</p>
      {available.length ? (
        <ul className="rpt-card-list">
          {available.map((report) => (
            <li key={report.id} className="rpt-card">
              <button type="button" className="rpt-card__main" onClick={() => onOpen(report.id)}>
                <span className="rpt-card__title"><FileText className="h-3.5 w-3.5" aria-hidden="true" />{report.title}</span>
                <span className="rpt-card__desc">{report.description}</span>
                {report.metrics?.length ? <span className="rpt-card__meta"><span>{report.metrics.join(" · ")}</span></span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rpt-empty"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Seu perfil não abre os relatórios de controle.</p>
      )}
    </section>
  );
}
