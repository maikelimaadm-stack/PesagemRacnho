import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtDateBR, fmtInt, fmtNum } from '@/components/common/formatNumber';
import { IMPORT_TYPES, ROW_STATUS, ROW_STATUS_HINTS, ROW_STATUS_TONE } from './importacaoModel';

const POR_PAGINA = 50;

// Etapa 6 — Conferência. Uma linha por linha do plano, paginada, com filtro por situação.
// O relatório baixado é o planToCsv do próprio motor.
export default function StepConferencia({ plan, erro, onBaixarRelatorio, onImportar, podeImportar, gravando }) {
  const [filtro, setFiltro] = useState('TODAS');
  const [pagina, setPagina] = useState(1);
  const linhas = plan?.rows || [];
  // Aplicações de sanidade não têm categoria nem peso: a coluna mostra a própria aplicação.
  const sanidade = plan?.type === IMPORT_TYPES.SANIDADE;

  const contagemPorStatus = useMemo(() => {
    const mapa = new Map();
    for (const linha of linhas) mapa.set(linha.status, (mapa.get(linha.status) || 0) + 1);
    return mapa;
  }, [linhas]);

  const filtradas = useMemo(
    () => (filtro === 'TODAS' ? linhas : linhas.filter((linha) => linha.status === filtro)),
    [linhas, filtro],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const trocarFiltro = (valor) => { setFiltro(valor); setPagina(1); };

  return (
    <section className="importacao-step" aria-labelledby="importacao-step-conferencia-titulo">
      <h2 id="importacao-step-conferencia-titulo" className="importacao-step__title">Confira linha por linha</h2>
      <p className="importacao-step__lead">
        A situação de cada linha diz o que vai acontecer com ela. Só as linhas marcadas como “NOVO” serão gravadas.
        {sanidade ? ' Cada linha é uma aplicação de sanidade ligada ao animal, na data do próprio evento.' : ''}
      </p>

      <div className="importacao-step__tools">
        <div className="importacao-field importacao-field--inline">
          <label htmlFor="importacao-filtro-status">Mostrar</label>
          <select id="importacao-filtro-status" className="importacao-select" value={filtro} onChange={(event) => trocarFiltro(event.target.value)}>
            <option value="TODAS">Todas as linhas ({fmtInt(linhas.length)})</option>
            {Object.values(ROW_STATUS).map((status) => (
              <option key={status} value={status} disabled={!contagemPorStatus.get(status)}>
                {status} ({fmtInt(contagemPorStatus.get(status) || 0)})
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={onBaixarRelatorio} disabled={!linhas.length}>
          <Download className="w-4 h-4 mr-1" aria-hidden="true" />
          Baixar relatório de conciliação
        </Button>
      </div>

      {plan?.blocking ? (
        <p className="importacao-alert importacao-alert--erro" role="alert">
          A importação está bloqueada enquanto houver erro, conflito ou ambiguidade. Filtre por essas situações para ver o que corrigir.
        </p>
      ) : null}

      <div className="importacao-table-wrap importacao-table-wrap--rolagem">
        <table className="importacao-table importacao-table--linhas">
          <thead>
            <tr>
              <th scope="col">Linha</th>
              <th scope="col">Situação</th>
              <th scope="col">Evento</th>
              <th scope="col">Animal</th>
              <th scope="col">Data</th>
              <th scope="col">Peso</th>
              <th scope="col">{sanidade ? 'Aplicação' : 'Categoria'}</th>
              <th scope="col">Observações do sistema</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => (
              <tr key={`${linha.line}-${linha.identity?.key ?? ''}-${linha.status}`}>
                <td>{linha.line}</td>
                <td>
                  <span className={`importacao-status ${ROW_STATUS_TONE[linha.status] || ''}`} title={ROW_STATUS_HINTS[linha.status] || ''}>
                    {linha.status}
                  </span>
                </td>
                <td>{linha.eventType || '—'}</td>
                <td>
                  {linha.identity?.label || '—'}
                  <small className="importacao-table__nota">{linha.identity?.isNew ? 'animal novo' : linha.identity?.animalId ? 'já cadastrado' : ''}</small>
                </td>
                <td>{fmtDateBR(linha.data, '—')}</td>
                <td className="importacao-table__num">{linha.peso === null || linha.peso === undefined ? '—' : fmtNum(linha.peso)}</td>
                <td>{(sanidade ? linha.sanidade?.resumo : linha.categoria?.nome) || '—'}</td>
                <td className="importacao-table__mensagens">{(linha.messages || []).join(' · ') || '—'}</td>
              </tr>
            ))}
            {!visiveis.length ? (
              <tr><td colSpan={8} className="importacao-empty">Nenhuma linha nesta situação.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="importacao-pager">
        <Button type="button" variant="outline" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button>
        <span>Página {fmtInt(paginaAtual)} de {fmtInt(totalPaginas)} · {fmtInt(filtradas.length)} linhas</span>
        <Button type="button" variant="outline" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button>
      </div>

      {erro ? <p className="importacao-alert importacao-alert--erro" role="alert">{erro}</p> : null}

      <div className="importacao-step__tools importacao-step__tools--fim">
        <Button
          type="button"
          className="emp-toolbar-btn emp-toolbar-btn-save"
          data-testid="importacao-importar"
          disabled={!plan || plan.blocking || !podeImportar || gravando || !plan.summary?.novos}
          onClick={onImportar}
        >
          {gravando ? 'Gravando…' : `Importar ${fmtInt(plan?.summary?.novos || 0)} linha(s)`}
        </Button>
        {plan && !plan.blocking && !plan.summary?.novos ? (
          <span className="importacao-hint">Não há nada novo para gravar neste arquivo.</span>
        ) : null}
        {!podeImportar ? <span className="importacao-hint">Seu perfil não pode gravar pesagens.</span> : null}
      </div>
    </section>
  );
}
