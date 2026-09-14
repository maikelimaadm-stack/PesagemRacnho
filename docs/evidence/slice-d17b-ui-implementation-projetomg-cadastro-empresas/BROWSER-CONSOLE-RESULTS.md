# Console e runtime no navegador

Resultado: **APROVADO**.

## Build de produção

- URL usada durante a validação: `http://127.0.0.1:5176/`;
- rotas verificadas: `#/PesagensIndividuais`, `#/LancamentoPesagensIndividuais` e `#/ManutencaoSistema`;
- stream real de console consultado pelo recurso de logs do navegador integrado: `0` warnings e `0` errors;
- `vite-error-overlay`: ausente;
- erro de rota/runtime: ausente;
- assets remotos observados: nenhum;
- overflow horizontal no viewport desktop final: ausente;
- o registro sintético de CRUD não permaneceu após a limpeza e reload.

## Warnings técnicos fora do console da página

O build informou apenas avisos de tooling já observados no baseline: dados desatualizados de `baseline-browser-mapping`/`caniuse-lite` e chunk JavaScript maior que 500 kB. Não houve warning novo de runtime.
