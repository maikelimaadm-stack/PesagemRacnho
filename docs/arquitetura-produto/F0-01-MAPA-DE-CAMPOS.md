# F0-01 — Mapa de campos: estado atual → modelo-alvo

**Base analisada:** aplicação 1.1.17, esquema Dexie v6 (`src/storage/indexedDb/schema.js`).  
**Modelo-alvo:** [02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) §4 e [03-CADASTROS-E-FLUXOS.md](./03-CADASTROS-E-FLUXOS.md).  
**Convenção de status:** a mesma do [README](./README.md): Atual, Parcial, Planejado, Opcional, Fora de escopo.

## 1. Como o dado é persistido hoje

Cada store Dexie tem chave primária técnica `localId` (autoincremento) e o
`id` de domínio (UUID) como índice. A store `pesagens` guarda os campos
indexados em colunas próprias e **o restante do lançamento inteiro dentro de
`legacy_payload`** (objeto com o shape da tela). O mapper
`storageRecordToViewModel` funde `legacy_payload` + colunas ao ler.

Consequência para o modelo-alvo: a maior parte dos campos de negócio já existe,
mas vive num objeto não indexado. A evolução deve promover campos para colunas
próprias somente quando houver consulta, índice ou regra sobre eles, com
`DB_VERSION` incrementado e backfill explícito (02 §8).

## 2. Pesagem (fato) — store `pesagens`

| Campo atual | Onde vive | Campo-alvo (02 §4.4) | Status | Observação |
|---|---|---|---|---|
| `id` | coluna (índice) | `id` | Atual | UUID |
| `animal_id` | coluna (índice, composto `[animal_id+data_pesagem]`) | `animal_id` | Atual | |
| `sessao_id` | coluna (índice) | `sessao_id` | Parcial | criado automaticamente por data; UI não expõe |
| `data_pesagem` | coluna (índice) | data operacional civil | Atual | `YYYY-MM-DD` |
| — | — | instante de captura | Planejado | hoje só `created_at` |
| `peso_kg` | coluna | `peso_kg` numérico | Atual | também `peso` no payload |
| `tipo_pesagem` | coluna (índice) | tipo de manejo | Atual | valores: `Cadastro`, `Manejo`, `Saída` (`legacy_payload.tipo_manejo` é a fonte lida pela UI) |
| `lote_id` | coluna (índice) | lote/apartação de destino | Atual | aponta para `loteApartacoes.id` |
| `embarque_id` | coluna (índice) | vínculo de embarque | Atual | somente em Saída |
| `observacao` | coluna | observação | Atual | |
| `legacy_payload.motivo_saida` | payload | motivo/tipo de saída | Atual | `Venda`, `Abate`, `Morte`, `Doação`, `Transferência` |
| `legacy_payload.apartacao_id`, `nome_apartacao`, `nome_lote` | payload | apartação/lote de origem e destino | Parcial | nomes desnormalizados; origem não é gravada |
| `legacy_payload.data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | payload | derivados versionados | Parcial | recalculados pelo `weighingSeries`; falta versão da fórmula |
| `legacy_payload.sexo`, `raca`, `era`, `marca`, `numero_animal` | payload | snapshot do animal no evento | Atual | preserva o fato mesmo se o cadastro mudar |
| `legacy_payload.status_animal` | payload | — | Atual | redundante com projeção em `animais.situacao` |
| `legacy_payload.alertas_confirmados`, `justificativa_alerta` | payload | pendência/justificativa | Parcial | só outliers de peso/GMD |
| `legacy_payload.valor_pago_cabeca`, `origem_animal`, `documentacao` (JSON) | payload | operação comercial de compra | Parcial | compra gravada dentro do Cadastro |
| `legacy_payload.comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas` | payload | operação comercial de venda | Parcial | venda gravada dentro da Saída |
| `legacy_payload.frigorifico`, `valor_arroba_abate`, `valor_total_abate` | payload | operação comercial de abate | Parcial | abate gravado dentro da Saída |
| `legacy_payload.embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` | payload | item de embarque + documento | Parcial | desnormalizado a partir de `documentosEmbarque` |
| `legacy_payload.operador`, `origem` | payload | operador, origem da captura | Parcial | valores `manual`/`importacao`; sem dispositivo |
| `created_at`, `updated_at`, `deleted_at` | colunas (índices) | auditoria temporal + cancelamento lógico | Atual | |
| — | — | `version` | Planejado | necessário para sincronização (06 §3) |
| — | — | `dispositivo_id`, `estado_sync` | Planejado | 06 §2 e §8 |
| — | — | `empresa_id`/`fazenda_id` na coluna | Parcial | `legacy_payload.empresa_id = 'local'`; não indexado |

## 3. Animal (cadastro/projeção) — store `animais`

| Campo atual | Campo-alvo (02 §4.1) | Status | Observação |
|---|---|---|---|
| `id` | `id` UUID imutável | Atual | |
| `empresa_id` | `empresa_id` | Parcial | sempre `'local'` ou nulo; sem `fazenda_id` |
| `numero_animal`, `identificacao_normalizada` | identificador visual | Atual | também em `animalIdentificadores` |
| `marca` | `marca_id` | Parcial | texto livre, não é cadastro |
| `sexo` | `sexo` | Atual | `M`/`F` |
| `raca` | `raca_id` | Parcial | texto livre, não é cadastro |
| `era` | nascimento/era calculável | Parcial | texto livre (meses) |
| — | `categoria_id` | Planejado | |
| `situacao` | `situacao` | Parcial | só `Ativo`/`Inativo`; alvo distingue vendido, abatido, transferido, morto, cancelado (`motivo_saida` já permite derivar) |
| `data_saida`, `motivo_saida` | projeção de saída | Atual | reconstruída dos eventos |
| `ultima_pesagem_data`, `ultimo_peso_kg` | projeção | Atual | |
| `lote_atual_id`, `apartacao_atual_id` | lote atual como projeção | Atual | reconstruída de `animalLotes` |
| `origem`, `nome` | origem/observações | Parcial | |
| `created_at`, `updated_at`, `deleted_at` | auditoria temporal | Atual | |
| — | `version` | Planejado | |

## 4. Identificador — store `animalIdentificadores`

| Campo atual | Campo-alvo (02 §4.2) | Status | Observação |
|---|---|---|---|
| `tipo` | tipo | Parcial | só `visual_marca`; alvo: visual, RFID/EID, SISBOV, manejo SISBOV, legado, temporário |
| `valor`, `valor_normalizado` | valor original/normalizado | Atual | normalizado = `NÚMERO::MARCA` |
| `marca` | — | Atual | parte da chave de identidade visual |
| `principal`, `ativo` | principal/secundário, ativo | Atual | |
| índice `[tipo+valor_normalizado]` | unicidade global por tipo | Parcial | índice não é único; unicidade verificada só no `health.js` |
| — | `inicio`, `fim`, `motivo_troca`, `usuario` | Planejado | validade temporal (03 §3.3) |

## 5. Sessão de pesagem — store `sessoesPesagem`

| Campo atual | Campo-alvo (02 §4.3) | Status | Observação |
|---|---|---|---|
| `id`, `data`, `inicio` | id, data operacional, início | Atual | criada automaticamente na primeira pesagem do dia |
| `status` | rascunho/aberta/conferência/encerrada/cancelada | Parcial | só `Aberta`; nunca é encerrada |
| `operador` | operador | Parcial | `LOCAL`, `IMPORTACAO` ou o operador do payload |
| — | empresa, fazenda, curral, dispositivo | Planejado | |
| — | tipo de manejo, lote de origem, perfil de apartação | Planejado | |
| — | modo de captura, contadores, término, snapshot | Planejado | F2 |

## 6. Lote, apartação e permanência

| Store atual | Campos atuais | Entidade-alvo (02 §4.6, 03 §4) | Status | Observação |
|---|---|---|---|---|
| `apartacoes` | `nome_apartacao`, `empresa_id` | Apartação | Parcial | falta destino, perfil de regra, política de lote cheio, validade |
| `loteApartacoes` | `nome_lote`, `apartacao_id`, `peso_minimo`, `peso_maximo`, `quantidade_maxima`, `fechado` | Lote | Parcial | falta fazenda/local, categoria, datas, meta |
| `lotes` | store existe sem uso ativo | Lote | Parcial | referenciada só em `health.js`; a UI usa `loteApartacoes` |
| `animalLotes` | `animal_id`, `lote_id`, `apartacao_id`, `inicio`, `fim`, `origem` | Permanência | Atual | reconstruída dos eventos (`origem` = lancamento/importacao/projecao) |
| `movimentosAnimais` | `animal_id`, `pesagem_id`, `tipo`, `data_evento`, `lote_origem_id` (sempre nulo), `lote_destino_id`, `motivo` | Movimento | Parcial | origem não é gravada |
| — | — | Regra de apartação (02 §4.7) | Parcial | só faixa `peso_minimo..peso_maximo` + capacidade, em `getLoteAutomatico` na tela |

## 7. Comercial, embarque e documentos

| Store/chave atual | Campos | Entidade-alvo | Status | Observação |
|---|---|---|---|---|
| `embarques` | `nome`, `data`, `status`, `frigorifico`, `empresa_id` | Embarque | Parcial | falta destino, capacidade, veículo, motorista no embarque |
| `documentosEmbarque` | `embarque_id`, `tipo_documento` (`GTA`, `NF-e`, `GTA+NF-e`), `numero_gta`, `numero_nfe`, `motorista_nome`, `placa_carreta` | Documento | Parcial | |
| `appSettings['perfis-saida:<empresa>']` | `compradores[]` (nome, documento, cidade, telefone), `venda[]`, `abate[]` | Pessoas/Comprador/Frigorífico, Perfil de venda/abate | Parcial | vivem como configuração, não como cadastro com histórico |
| dentro de `pesagens.legacy_payload` | ver §2 | Operação comercial (02 §4.8) | Parcial | não existe entidade própria com status rascunho/conferida/fechada |

## 8. Plataforma

| Store/mecanismo atual | Entidade-alvo | Status | Observação |
|---|---|---|---|
| `auditoria` (`entidade`, `entidade_id`, `acao` CRIAR/ATUALIZAR/CANCELAR, `antes`, `depois`, `origem`, `operador`, `motivo`) | Auditoria | Parcial | sem usuário/dispositivo; sem consulta administrativa |
| `importacoes` (`arquivo_hash` único, nome, tamanho, origem, status, contagens) | Importação/Job | Atual | idempotente por SHA-256 |
| `backupHistory`, `appSettings` | Backup, Configuração | Atual | |
| `localStorage` (`empresa_selecionada_id`, `erp-tema`, colunas/filtros das telas) | Configuração de UI | Atual | por navegador/instalação, fora do backup |
| — | Outbox, Conflito, Dispositivo, Usuário, Papel | Planejado | F7 |
| — | Empresa, Fazenda, Curral | Planejado | hoje `empresa_id = 'local'` fixo |
| — | Leitura de equipamento, Dispositivo, Perfil de conexão | Planejado | F5 |

## 9. Contrato de importação/exportação por arquivo (05 §7)

Cabeçalhos CSV aceitos hoje (normalização remove acentos, espaços e `_`):
`ID`, `ID_Externo`, `Data`, `NumeroAnimal`/`Animal`, `Sexo`, `Raça`, `Era`,
`Marca`, `Peso`, `Lote`, `Apartação`, `Observação`, `DataAnterior`,
`PesoAnterior`, `Dias`, `Ganho`, `GMD`. Delimitador detectado entre `;`, tab e
`,`. Exportação usa a mesma lista de cabeçalhos. **Lacuna:** não há mapeamento
explícito de colunas nem preview por linha com erro estruturado além da lista
`erros[]` na tela.

## 10. Ambiguidades P0 resolvidas nesta revisão

| Tema | Decisão registrada |
|---|---|
| Identidade visual | `numero_animal` + `marca` (normalizados em maiúsculas) → `animal_id` UUID. Mesmo número pode existir em marcas diferentes; conflito abre `SelecionarAnimalDialog`. |
| Tipo do evento | A UI lê `legacy_payload.tipo_manejo`; a coluna `tipo_pesagem` é espelho. Ao promover para coluna, `tipo_pesagem` passa a ser a fonte e `tipo_manejo` vira alias de leitura. |
| Lote de referência | `pesagens.lote_id` referencia `loteApartacoes.id` (não `lotes`). A store `lotes` deve ser reaproveitada ou removida por ADR antes da F2. |
| Empresa | Valor único `'local'` até a F7; todas as consultas filtram por ele. |
| Sessão | Existe uma sessão automática por data operacional com status `Aberta`; a F2 introduz o ciclo de vida sem quebrar `sessao_id` existente. |

## 11. Campos que **não** serão criados (fora de escopo)

Sanidade, medicamentos, reprodução, nutrição, máquinas, folha e contabilidade
(00 §4.10 e ADR-007).
