# Migração dos page containers

## Contrato compartilhado

`ModeloBase1PageContainer` fornece:

- `width: 100%`;
- `min-width: 0`;
- `min-height: 100%`;
- background `#f0f2f5`;
- padding desktop `8px 10px 10px`;
- padding mobile `6px 6px 10px`;
- variantes sem lógica de negócio: `table`, `form` e `maintenance`.

## Aplicação

| Página | Variante | Scroll efetivo |
|---|---|---|
| PesagensIndividuais | table | grid interno/table card |
| LancamentoPesagensIndividuais | form | `mak-mother-page__chrome` |
| ManutencaoSistema | maintenance | contêiner da própria página |

Os wrappers internos de tabela, formulário e cards foram mantidos porque pertencem aos próximos slices. Apenas o wrapper estrutural de cada página foi substituído.
