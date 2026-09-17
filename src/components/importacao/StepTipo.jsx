import { CONCILIACAO_OPCOES, CONCILIACAO_PERGUNTA, IMPORT_TYPES, IMPORT_TYPE_HINTS, IMPORT_TYPE_LABELS, TIPOS_UNICOS } from './importacaoModel';

// Etapa 2 — Tipo. A pergunta principal é sobre o arquivo, não sobre o nome interno do
// tipo: "tem mais de uma pesagem do mesmo animal?" (pedido do responsável em 17/09/2026).
// "Sim" é o Histórico conciliado; "Não" abre Cadastros / Manejos / Saídas; cadastros
// mestres ficam como terceira opção.
export default function StepTipo({ resposta, type, onResponder, onEscolherTipo, podeCadastrosMestres }) {
  return (
    <section className="importacao-step" aria-labelledby="importacao-step-tipo-titulo">
      <h2 id="importacao-step-tipo-titulo" className="importacao-step__title">{CONCILIACAO_PERGUNTA}</h2>
      <p className="importacao-step__lead">
        É comum a mesma planilha trazer duas ou três pesagens do mesmo animal. Responda abaixo e o sistema já sabe o que fazer com elas.
      </p>

      <div className="importacao-choice-grid" role="radiogroup" aria-label={CONCILIACAO_PERGUNTA}>
        {CONCILIACAO_OPCOES.map((opcao) => {
          const selecionada = resposta === opcao.id;
          const bloqueada = opcao.id === 'MESTRES' && !podeCadastrosMestres;
          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={selecionada}
              disabled={bloqueada}
              data-opcao={opcao.id}
              data-testid={`importacao-conciliacao-${opcao.id}`}
              className={`importacao-choice${selecionada ? ' importacao-choice--ativa' : ''}`}
              onClick={() => onResponder(opcao.id)}
            >
              <strong>{opcao.titulo}</strong>
              <span>{opcao.texto}</span>
              <small>{opcao.detalhe}</small>
              {bloqueada ? <small className="importacao-choice__bloqueio">Seu perfil não pode gravar cadastros mestres.</small> : null}
            </button>
          );
        })}
      </div>

      {resposta === 'NAO' ? (
        <div className="importacao-subchoice" data-testid="importacao-tipos-unicos">
          <h3 className="importacao-step__subtitle">Então o arquivo é de quê?</h3>
          <div className="importacao-choice-grid importacao-choice-grid--compacta" role="radiogroup" aria-label="Tipo único das linhas">
            {TIPOS_UNICOS.map((tipo) => (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={type === tipo}
                data-tipo={tipo}
                className={`importacao-choice${type === tipo ? ' importacao-choice--ativa' : ''}`}
                onClick={() => onEscolherTipo(tipo)}
              >
                <strong>{IMPORT_TYPE_LABELS[tipo]}</strong>
                <span>{IMPORT_TYPE_HINTS[tipo]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {type ? (
        <p className="importacao-alert importacao-alert--info" data-testid="importacao-tipo-escolhido">
          Escolhido: <strong>{IMPORT_TYPE_LABELS[type]}</strong>. {IMPORT_TYPE_HINTS[type]}
          {type === IMPORT_TYPES.HISTORICO ? ' Peso anterior, dias, ganho e GMD são sempre recalculados pelo sistema.' : ''}
        </p>
      ) : null}
    </section>
  );
}
