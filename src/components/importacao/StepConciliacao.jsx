import { Button } from '@/components/ui/button';
import { fmtDateBR, fmtInt } from '@/components/common/formatNumber';
import AfericaoArquivo from './AfericaoArquivo';
import { IMPORT_TYPES, animaisComVariasLinhas } from './importacaoModel';

function Contagem({ label, valor, tom = '' }) {
  return (
    <div className={`importacao-count${tom ? ` importacao-count--${tom}` : ''}`}>
      <span className="importacao-count__valor">{fmtInt(valor)}</span>
      <span className="importacao-count__label">{label}</span>
    </div>
  );
}

// Etapa 5 — Conciliação. O plano vem inteiro de analyzeImport (dry-run, nada gravado):
// aqui só se mostram as contagens do summary, o motivo do bloqueio e o que o sistema
// decidiu para os animais que aparecem em mais de uma linha.
export default function StepConciliacao({ plan, analisando, erro, onAnalisar, afericao, type, onConciliarAutomaticamente }) {
  const summary = plan?.summary;
  const repetidos = plan ? animaisComVariasLinhas(plan) : { total: 0, grupos: [] };
  const ausentes = summary?.cadastrosMestresAusentes || [];

  return (
    <section className="importacao-step" aria-labelledby="importacao-step-conciliacao-titulo">
      <h2 id="importacao-step-conciliacao-titulo" className="importacao-step__title">O que o sistema entendeu do arquivo</h2>
      <p className="importacao-step__lead">
        Esta é uma simulação: nada foi gravado. O sistema comparou cada linha com o que já existe e decidiu o que seria criado.
      </p>

      <AfericaoArquivo afericao={afericao} type={type} onConciliarAutomaticamente={onConciliarAutomaticamente} />

      <div className="importacao-step__tools">
        <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={analisando} onClick={onAnalisar} data-testid="importacao-analisar">
          {analisando ? 'Analisando…' : plan ? 'Refazer análise' : 'Analisar arquivo'}
        </Button>
      </div>

      {analisando ? <p className="importacao-hint" role="status">Comparando as linhas com o que já está no sistema…</p> : null}
      {erro ? <p className="importacao-alert importacao-alert--erro" role="alert">{erro}</p> : null}
      {!plan && !analisando && !erro ? <p className="importacao-empty">Use “Analisar arquivo” para ver o que seria gravado.</p> : null}

      {plan ? (
        <>
          {plan.blocking ? (
            <div className="importacao-alert importacao-alert--erro" role="alert" data-testid="importacao-bloqueio">
              <strong>Ainda não dá para importar.</strong>
              <span>
                {' '}Foram encontrados {fmtInt(summary.erros)} erro(s), {fmtInt(summary.conflitos)} conflito(s) e {fmtInt(summary.ambiguidades)} caso(s) em que mais de um animal atende à linha.
                Corrija o arquivo (ou os cadastros) e refaça a análise. A lista linha a linha está na próxima etapa.
              </span>
              {plan.fileErrors?.length ? (
                <ul className="importacao-list">
                  {plan.fileErrors.map((mensagem) => <li key={mensagem}>{mensagem}</li>)}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="importacao-alert importacao-alert--ok" data-testid="importacao-liberado">
              Nada impede a gravação. Confira as linhas na próxima etapa antes de importar.
            </p>
          )}

          <div className="importacao-counts" data-testid="importacao-resumo">
            <Contagem label="Linhas lidas" valor={summary.linhasLidas} />
            <Contagem label="Linhas a gravar" valor={summary.novos} tom="ok" />
            <Contagem label="Animais encontrados" valor={summary.animaisEncontrados} />
            <Contagem label="Animais novos" valor={summary.animaisNovos} />
            <Contagem label="Cadastros" valor={summary.cadastros} />
            <Contagem label="Manejos" valor={summary.manejos} />
            <Contagem label="Saídas" valor={summary.saidas} />
            <Contagem label="Já existem" valor={summary.jaExistem} />
            <Contagem label="Ignoradas" valor={summary.ignoradas} />
            <Contagem label="Possíveis duplicidades" valor={summary.duplicidades} tom={summary.duplicidades ? 'aviso' : ''} />
            <Contagem label="Ambiguidades" valor={summary.ambiguidades} tom={summary.ambiguidades ? 'erro' : ''} />
            <Contagem label="Conflitos" valor={summary.conflitos} tom={summary.conflitos ? 'erro' : ''} />
            <Contagem label="Erros" valor={summary.erros} tom={summary.erros ? 'erro' : ''} />
            <Contagem label="Cadastros mestres ausentes" valor={ausentes.length} tom={ausentes.length ? 'aviso' : ''} />
            <Contagem label="Categorias resolvidas pelo peso" valor={summary.categoriasAutomaticasResolvidas} />
            <Contagem label="Categorias não resolvidas" valor={summary.categoriasNaoResolvidas} tom={summary.categoriasNaoResolvidas ? 'aviso' : ''} />
            {type === IMPORT_TYPES.MESTRES ? <Contagem label="Cadastros mestres novos" valor={summary.cadastrosMestresNovos} tom="ok" /> : null}
            {type === IMPORT_TYPES.SANIDADE ? <Contagem label="Aplicações de sanidade" valor={summary.aplicacoes} tom="ok" /> : null}
          </div>

          {ausentes.length ? (
            <div className="importacao-alert importacao-alert--aviso">
              <strong>Cadastros citados no arquivo que ainda não existem:</strong>
              <ul className="importacao-list">
                {ausentes.map((item) => (
                  <li key={`${item.store}-${item.nome}`}>
                    {item.rotulo || item.store}: <strong>{item.nome}</strong> (linhas {item.linhas.slice(0, 8).join(', ')}{item.linhas.length > 8 ? '…' : ''})
                  </li>
                ))}
              </ul>
              <span>Volte à etapa Regras para criá-los junto com a importação, ou cadastre-os antes.</span>
            </div>
          ) : null}

          {repetidos.total ? (
            <div className="importacao-repetidos" data-testid="importacao-animais-repetidos">
              <h3 className="importacao-step__subtitle">Animais com várias linhas ({fmtInt(repetidos.total)})</h3>
              <p className="importacao-step__lead">O que o sistema decidiu para cada um, pela data:</p>
              <ul className="importacao-list">
                {repetidos.grupos.map((grupo) => (
                  <li key={grupo.chave}>
                    <strong>{grupo.label}</strong> — {fmtInt(grupo.linhas.length)} linhas:{' '}
                    {grupo.linhas.map((linha) => `${fmtDateBR(linha.data, '—')} ${linha.eventType || linha.status}`).join(', ')}
                  </li>
                ))}
              </ul>
              {repetidos.total > repetidos.grupos.length ? (
                <p className="importacao-hint">Mostrando os {fmtInt(repetidos.grupos.length)} primeiros. A lista completa está na próxima etapa e no relatório.</p>
              ) : null}
            </div>
          ) : null}

          {plan.previousImports?.length ? (
            <div className="importacao-alert importacao-alert--info">
              <strong>Este mesmo arquivo já foi importado antes.</strong>
              <ul className="importacao-list">
                {plan.previousImports.map((job) => (
                  <li key={job.id}>{fmtDateBR(job.created_at, '—')} · {job.status} · {fmtInt(job.registros_criados)} registros</li>
                ))}
              </ul>
              <span>Importar de novo não duplica: o que já existe é reconhecido e ignorado.</span>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
