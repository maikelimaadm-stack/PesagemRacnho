# CURRENT-UI-CONTRACT — Slice D.4

## Tela auditada
`src/pages/LancamentoPesagensIndividuais.jsx`

## Métodos antigos usados (PesagemIndividual — antes D.4)
| Operação | Método antigo |
|----------|---------------|
| Listar | `db.entities.PesagemIndividual.list('-data_pesagem')` |
| Criar | `db.entities.PesagemIndividual.create(data)` |
| Atualizar | `db.entities.PesagemIndividual.update(id, data)` |
| Excluir | `db.entities.PesagemIndividual.delete(id)` |
| Propagação cadastro | `db.entities.PesagemIndividual.update` (loop) |

## Entidades antigas ainda usadas (fora escopo pesagens)
- `Apartacao`, `LoteApartacao`, `SanidadeAnimal`, `ConfiguracaoSanidade`, `ItemSanidade`, `Embarque`, `DocumentoEmbarque`

## Shape atual do lançamento (data object em handleSalvar)
Campos principais: `empresa_id`, `tipo_manejo`, `motivo_saida`, `status_animal`, `data_pesagem`, `numero_animal`, `sexo`, `raca`, `era`, `marca`, `peso`, `observacao`, `apartacao_id`, `nome_apartacao`, `lote_id`, `nome_lote`, campos compra/venda/abate/embarque, `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd`, `created_date`, `updated_date`.

## Campos obrigatórios (UI)
- `data_pesagem`
- `numero_animal`
- `peso` > 0
- `motivo_saida` (se tipo Saída)
- embarque/documento (se Saída Abate)

## Fluxo de criação
1. Validações inline + avisos
2. Monta objeto `data`
3. ~~`db.entities.PesagemIndividual.create`~~ → **`weighingService.createEntry(data)`** (SQLite)
4. Sanidades via JSON (inalterado)
5. `loadAllData()`

## Fluxo de edição
1. `handleEditar(p)` preenche formulário + `editingId`
2. ~~`db.entities.PesagemIndividual.update`~~ → **`weighingService.updateEntry(id, data, { source })`**
3. Propagação cadastro via `weighingService.updateEntry` por registro

## Fluxo de exclusão
1. Confirm dialog
2. Remove sanidades JSON
3. ~~`PesagemIndividual.delete`~~ → **`weighingService.deleteEntry(pesagem)`** (SQLite ou legacy)

## Fluxo de listagem
1. ~~`PesagemIndividual.list`~~ → **`weighingService.listEntries({ empresaId })`**
2. Filtro dia via `pesagensDia` useMemo (client-side)
3. Resumos calculados sobre `pesagens` / `pesagensDia` props

## Riscos encontrados
- Lista híbrida carrega SQLite paginado + JSON legado completo (memória em volumes grandes)
- Sanidades ainda em JSON — desacoplado de SQLite
- `PesagensIndividuais.jsx` (outra página) ainda usa JSON direto — fora escopo D.4
