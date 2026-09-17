import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { fmtInt } from '@/components/common/formatNumber';

function Contagem({ label, valor, tom = '' }) {
  return (
    <div className={`importacao-count${tom ? ` importacao-count--${tom}` : ''}`}>
      <span className="importacao-count__valor">{fmtInt(valor)}</span>
      <span className="importacao-count__label">{label}</span>
    </div>
  );
}

// Etapa 7 — Resultado. Todas as contagens vêm do ImportResult devolvido por applyImport;
// o arquivo baixado é o resultToCsv do motor.
export default function StepResultado({ resultado, erro, onBaixarResultado, onNovaImportacao }) {
  if (!resultado) {
    return (
      <section className="importacao-step">
        <h2 className="importacao-step__title">Resultado</h2>
        {erro ? <p className="importacao-alert importacao-alert--erro" role="alert">{erro}</p> : <p className="importacao-empty">Nenhuma importação concluída nesta sessão.</p>}
      </section>
    );
  }

  const semAlteracoes = resultado.status === 'SEM_ALTERACOES';
  return (
    <section className="importacao-step" aria-labelledby="importacao-step-resultado-titulo">
      <h2 id="importacao-step-resultado-titulo" className="importacao-step__title">
        {semAlteracoes ? 'Nada novo para gravar' : 'Importação concluída'}
      </h2>
      <p className="importacao-step__lead" data-testid="importacao-resultado-situacao">
        {semAlteracoes
          ? 'Todas as linhas já estavam no sistema. Nenhum registro foi duplicado.'
          : `Os dados já estão no sistema.${resultado.retomada ? ' Esta importação continuou de onde uma anterior parou.' : ''}`}
      </p>

      <div className="importacao-counts" data-testid="importacao-resultado">
        <Contagem label="Linhas processadas" valor={resultado.linhasProcessadas} />
        <Contagem label="Cadastros criados" valor={resultado.cadastrosCriados} tom="ok" />
        <Contagem label="Manejos criados" valor={resultado.manejosCriados} tom="ok" />
        <Contagem label="Saídas criadas" valor={resultado.saidasCriadas} tom="ok" />
        <Contagem label="Aplicações de sanidade criadas" valor={resultado.aplicacoesCriadas} tom="ok" />
        <Contagem label="Animais novos" valor={resultado.animaisNovos} />
        <Contagem label="Animais conciliados" valor={resultado.animaisConciliados} />
        <Contagem label="Duplicidades ignoradas" valor={resultado.duplicidadesIgnoradas} />
        <Contagem label="Erros" valor={resultado.erros} tom={resultado.erros ? 'erro' : ''} />
        <Contagem label="Séries recalculadas" valor={resultado.seriesRecalculadas} />
        <Contagem label="Eventos recalculados" valor={resultado.eventosRecalculados} />
        <Contagem label="Categorias pelo peso" valor={resultado.categoriasResolvidasAutomaticamente} />
        <Contagem label="Cadastros mestres criados" valor={resultado.cadastrosMestresCriados} />
        <Contagem label="Lotes gravados" valor={resultado.lotes} />
        <Contagem label="Linhas gravadas" valor={(resultado.linhasGravadas || []).length} />
      </div>

      {erro ? <p className="importacao-alert importacao-alert--erro" role="alert">{erro}</p> : null}

      <div className="importacao-step__tools importacao-step__tools--fim">
        <Button type="button" variant="outline" onClick={onBaixarResultado}>
          <Download className="w-4 h-4 mr-1" aria-hidden="true" />
          Baixar resultado
        </Button>
        <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" onClick={onNovaImportacao}>Importar outro arquivo</Button>
        <Link className="importacao-link-button" to={createPageUrl('PesagensIndividuais')}>Ver a Relação de Pesagens</Link>
      </div>
    </section>
  );
}
