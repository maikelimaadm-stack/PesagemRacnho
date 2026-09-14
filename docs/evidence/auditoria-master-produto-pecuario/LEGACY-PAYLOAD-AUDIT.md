# LEGACY-PAYLOAD-AUDIT — `pesagens.legacy_payload`

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Como funciona

- `uiToStorageRecord` grava `legacy_payload = { ...uiPayload }` (cópia integral do objeto da tela, exceto `sanidade_ids/sanidades`), além das colunas `id, data_pesagem, peso_kg, lote_id, animal_id, tipo_pesagem, observacao`.
- `storageRecordToViewModel` faz `{ ...legacy, _localId, id, data_pesagem, peso, peso_kg, lote_id, animal_id, tipo_manejo, observacao, created_date, updated_date }`.
- O adapter lê regras de negócio **do payload**: `tipo_manejo`, `motivo_saida`, `apartacao_id`, `numero_animal`, `marca`, `operador`, `origem`, `sessao_id`.
- Recálculo de série grava `legacyPayload: { ...entry, ...patch }` (o view model inteiro de volta no payload).

## 2. Inventário de chaves (origem: objeto `data` em `LancamentoPesagensIndividuais.handleSalvar`, importação e recálculo)

| Chave | Origem | Classificação | Ação alvo |
|---|---|---|---|
| `id`, `data_pesagem`, `peso`, `observacao`, `animal_id`, `lote_id` | tela | DUPLICADA das colunas | remover do payload após promover (mapper já prefere coluna) |
| `empresa_id` | tela (`'local'`) | ESTRUTURAL | coluna indexada quando F7 |
| `tipo_manejo` | tela | ESTRUTURAL, fonte atual da regra | coluna `tipo_pesagem` vira fonte (F0-01 §10) |
| `motivo_saida`, `causa_morte`, `status_animal` | tela | ESTRUTURAL | `motivo_saida` coluna indexada; `causa_morte_id` coluna; `status_animal` **remover** (redundante com projeção) |
| `numero_animal`, `sexo`, `raca`, `era`, `marca` | tela | SNAPSHOT DO FATO | manter no payload (ou colunas não indexadas) + `marca_id/raca_id/categoria_id` novos |
| `apartacao_id`, `nome_apartacao`, `nome_lote` | tela | `apartacao_id` estrutural; nomes = SNAPSHOT | `apartacao_id` coluna; nomes ficam, **sem propagação** ao renomear |
| `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | serviço | DERIVADO | manter; acrescentar `versao_formula` |
| `alertas_confirmados`, `justificativa_alerta` | tela | FATO (pendência aceita) | manter |
| `valor_pago_cabeca`, `origem_animal`, `documentacao` (string JSON) | tela | COMERCIAL (compra) | migrar para `operacoesComerciais`; congelar como legado |
| `comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas` | tela | COMERCIAL (venda) | idem |
| `frigorifico`, `valor_arroba_abate`, `valor_total_abate` | tela | COMERCIAL (abate) | idem |
| `embarque_id`, `embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` | tela | `embarque_id` já é coluna; resto é CÓPIA de `documentosEmbarque` | parar de copiar; junção por id |
| `sessao_id`, `operador`, `origem` | adapter/importação | ESTRUTURAL | `sessao_id` já é coluna; `operador`/`origem` colunas simples |
| `id_externo` | importação | REFERÊNCIA | coluna não indexada |
| `created_date`, `updated_date` | view model | DUPLICADA de `created_at/updated_at` | remover |
| `_localId`, `peso_kg` | **vazamento** do view model em `updateEntry`/recalculo (`merged = {...existing, ...uiPayload}` → `legacySnapshot`) | LIXO | limpar na migração; corrigir origem no plano |
| `sanidade_ids`, `sanidades` | removidos na v6 | — | já tratado |

## 3. Por que "não pode crescer indefinidamente"

1. **Crescimento por edição:** cada `updateEntry` copia o view model inteiro (inclusive `_localId`, `peso_kg`, `created_date`) de volta ao payload; cada recálculo faz o mesmo. Um registro editado n vezes carrega chaves que não existiam ao ser criado.
2. **Crescimento por cópia:** dados de embarque/documento/parceiro são replicados em cada pesagem; renomear propaga escrita em massa.
3. **Auditoria:** `auditoria.antes/depois` guardam o registro **com** o payload; toda edição coletiva grava 2× o payload por registro.
4. **Backup:** o JSON de backup contém o payload de cada pesagem mais as cópias na auditoria — o tamanho cresce mais que linearmente com edições.

Medição recomendada antes da v7 (não feita nesta auditoria para não alterar nada): tamanho médio do payload por registro na massa de 36 mil e proporção `auditoria`/`pesagens` em bytes.

## 4. Estratégia alvo: congelar, promover, parar de copiar

| Fase | Ação |
|---|---|
| Agora (regra) | nenhuma **nova** chave entra no payload; toda informação nova nasce em coluna ou em store própria |
| v7 | promover `motivo_saida`, `operacao_id`, `apartacao_id`, `marca_id`, `categoria_id`, `causa_morte_id`, `versao_formula`; limpar `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal` do payload |
| v7 | `uiToStorageRecord` grava no payload **apenas** as chaves da lista permitida (snapshot + derivados + pendências + legado congelado) |
| v8 | após migrar comercial/embarque, campos comerciais e cópias de documento passam a somente-leitura (`legacy_comercial`) e deixam de ser gravados |
| depois | quando nenhum consumidor ler o bloco legado, remover com migração e backup |

## 5. Ordem de leitura garantida

Para não quebrar dados antigos: coluna → payload → nulo. O mapper já faz isso para as colunas existentes; a regra deve valer para cada campo promovido, com teste no gate `weighing:mapper:verify`.
