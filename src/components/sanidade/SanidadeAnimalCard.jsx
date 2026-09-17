// Seção "Sanidade" da Ficha do Animal: aplicações do animal (mais recentes primeiro),
// canceladas marcadas com o motivo. Somente leitura — registrar e cancelar ficam na tela
// Sanidade e no Lançamento. Mesmo acabamento dos cartões da ficha (op-card/op-table).
import {
  formatDateBR,
  formatDose,
  isApplicationCancelled,
  labelOf,
  medicamentoNomeDe,
  origemAplicacao,
  programaNomeDe,
  situacaoAplicacao,
  sortApplicationsNewestFirst,
} from './sanidadeModel.js';
import '@/styles/sanidade.css';

const ni = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export default function SanidadeAnimalCard({ applications = [], loading = false, error = '', viaLabels = {} }) {
  const rows = sortApplicationsNewestFirst(applications);
  const cancelled = rows.filter(isApplicationCancelled).length;
  const summary = loading
    ? 'Carregando…'
    : `${ni.format(rows.length)} aplicaç${rows.length === 1 ? 'ão' : 'ões'}${cancelled ? ` · ${ni.format(cancelled)} cancelada${cancelled === 1 ? '' : 's'}` : ''}`;

  return (
    <section className="op-card sanidade-ficha-card" aria-label="Sanidade do animal">
      <header className="op-card__header"><h2>Sanidade</h2><span>{summary}</span></header>
      {error ? <div className="op-empty">{error}</div> : null}
      {!error && !loading && !rows.length ? <div className="op-empty">Nenhuma aplicação de sanidade registrada para este animal.</div> : null}
      {!error && rows.length ? (
        <div className="op-table-scroll">
          <table className="op-table sanidade-ficha-table" style={{ minWidth: 980 }}>
            <thead>
              <tr><th>Data</th><th>Programa</th><th>Medicamento</th><th className="is-number">Dose</th><th>Via</th><th>Origem</th><th>Responsável</th><th>Situação</th><th>Observação</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCancelled = isApplicationCancelled(row);
                return (
                  <tr key={row.id} className={isCancelled ? 'is-cancelled' : undefined}>
                    <td>{formatDateBR(row.data)}</td>
                    <td>{programaNomeDe(row)}</td>
                    <td>{medicamentoNomeDe(row)}</td>
                    <td className="is-number">{formatDose(row.dose, row.unidade)}</td>
                    <td>{labelOf(viaLabels, row.via_aplicacao)}</td>
                    <td>{origemAplicacao(row)}</td>
                    <td>{row.created_by_nome || '—'}</td>
                    <td>
                      <span className={`op-type${isCancelled ? ' op-type--saida' : ' op-type--cadastro'}`} title={isCancelled && row.motivo_cancelamento ? `Motivo: ${row.motivo_cancelamento}` : undefined}>{situacaoAplicacao(row)}</span>
                    </td>
                    <td className="sanidade-ficha-table__note">{isCancelled && row.motivo_cancelamento ? `Cancelada: ${row.motivo_cancelamento}` : (row.observacao || '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
