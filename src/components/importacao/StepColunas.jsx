import AfericaoArquivo from './AfericaoArquivo';

// Etapa 3 — Colunas. A lista de campos vem de listMappableFields (só o que a pessoa digita
// na planilha: nunca id, id do animal, id externo, ids de cadastro, peso anterior, data
// anterior, dias, ganho ou GMD). A sugestão automática vem de suggestMapping.
export default function StepColunas({ file, campos, mapping, faltando, afericao, type, onAlterar, onRestaurarSugestao, onConciliarAutomaticamente }) {
  const amostra = (file?.rows || []).slice(0, 3);
  const usados = new Set(Object.values(mapping || {}).filter(Boolean));

  return (
    <section className="importacao-step" aria-labelledby="importacao-step-colunas-titulo">
      <h2 id="importacao-step-colunas-titulo" className="importacao-step__title">Ligue as colunas do arquivo aos campos do sistema</h2>
      <p className="importacao-step__lead">
        O sistema já sugeriu o que reconheceu pelo nome da coluna. Confira e corrija o que estiver errado.
        Coluna marcada como “Não usar” é simplesmente ignorada.
      </p>

      <div className="importacao-step__tools">
        <button type="button" className="importacao-link-button" onClick={onRestaurarSugestao}>Voltar para a sugestão do sistema</button>
      </div>

      {faltando.length ? (
        <p className="importacao-alert importacao-alert--erro" role="alert" data-testid="importacao-colunas-faltando">
          Falta ligar: {faltando.map((campo) => campo.label).join(', ')}. Sem isso o sistema não consegue ler o arquivo.
        </p>
      ) : (
        <p className="importacao-alert importacao-alert--ok">Todas as colunas obrigatórias estão ligadas.</p>
      )}

      <AfericaoArquivo afericao={afericao} type={type} onConciliarAutomaticamente={onConciliarAutomaticamente} />

      <div className="importacao-table-wrap">
        <table className="importacao-table importacao-table--mapa">
          <thead>
            <tr>
              <th scope="col">Coluna do arquivo</th>
              <th scope="col">Campo do sistema</th>
              <th scope="col">Amostra das 3 primeiras linhas</th>
            </tr>
          </thead>
          <tbody>
            {(file?.headers || []).map((header) => {
              const escolhido = mapping?.[header] ?? '';
              return (
                <tr key={header}>
                  <th scope="row">{header}</th>
                  <td>
                    <select
                      className="importacao-select"
                      aria-label={`Campo do sistema para a coluna ${header}`}
                      data-coluna={header}
                      value={escolhido || ''}
                      onChange={(event) => onAlterar(header, event.target.value || null)}
                    >
                      <option value="">Não usar esta coluna</option>
                      {campos.map((campo) => (
                        <option key={campo.id} value={campo.id} disabled={usados.has(campo.id) && escolhido !== campo.id}>
                          {campo.label}{campo.required ? ' (obrigatório)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="importacao-table__sample">
                    {amostra.length
                      ? amostra.map((row) => String(row.values?.[header] ?? '').trim() || '—').join(' · ')
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!file?.headers?.length ? <p className="importacao-empty">O arquivo não tem colunas para ligar.</p> : null}
    </section>
  );
}
