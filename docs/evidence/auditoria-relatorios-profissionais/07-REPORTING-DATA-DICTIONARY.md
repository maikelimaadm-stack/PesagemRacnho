# 07 — Dicionário de dados para relatórios

Fonte: esquema real `src/storage/indexedDb/schema.js` (v7) e gravadores reais. Estado de 16/09/2026.

## 0. Regras que valem para todas as stores

| Regra | Evidência | Impacto em relatórios |
|---|---|---|
| Chave primária é `++localId`; `id` de domínio é só índice → pode haver linha duplicada (em `pesagens`, `apartacoes`, `loteApartacoes`, `embarques`, `documentosEmbarque` o índice `id` **não é único**) | `schema.js:53-58`; `genericRepository.js:45-51`; `health.js:27-35` | todo join precisa escolher “a linha ativa mais recente” |
| Exclusão lógica por `deleted_at` | todos os gravadores | filtrar sempre `!deleted_at` |
| IndexedDB **não indexa** booleano, `null` nem `undefined` | especificação IndexedDB | índices `ativo`, `local`, `fim`, `categoria_id` nulo ficam vazios/incompletos |
| `empresa_id` é sempre `'local'`; em `pesagens` vive **só no `legacy_payload`** | `api/db.js:16-21`; `weighingService.js:211-213` | pesagem importada sem esse campo some das telas |
| Stores removidas: `lotes` (v7), `configuracoesSanidade`/`itensSanidade`/`sanidadesAnimal` (v6) | `schema.js:35-44,84-86` | não usar |
| **Não existe `operacoesComerciais`** (só referência defensiva em `masterRegistryService.js:105`) | — | relatórios comerciais dependem do payload |

## 1. Stores

### `pesagens` — fato do evento

```text
Store: pesagens
Chave: ++localId (id não único)
Índices: id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id (VAZIO na prática), sessao_id, tipo_pesagem, created_at, updated_at, deleted_at
Quantidade esperada: 1 por evento (Cadastro, Manejo, Saída); massa 36k = 3/animal, 250k = 4/animal
Campos úteis (topo): id, data_pesagem (YYYY-MM-DD civil), peso_kg (null em Saída sem peso), lote_id, animal_id, tipo_pesagem, sessao_id, observacao, created_by_user_id, updated_by_user_id, created_at, updated_at
Campos úteis (legacy_payload): tipo_manejo, motivo_saida, causa_morte (texto), numero_animal, sexo, raca (texto), marca (texto), era, categoria_id, categoria_automatica, apartacao_id, nome_apartacao, nome_lote, origem, operador, id_externo, data_anterior, peso_anterior, dias, ganho, gmd, alertas_confirmados, justificativa_alerta, valor_pago_cabeca, origem_animal (texto), documentacao (JSON string), comprador (texto), destino_venda (texto), valor_venda_total, valor_arroba, rendimento_carcaca, peso_carcaca_estimado, quantidade_arrobas, frigorifico (texto), valor_arroba_abate, valor_total_abate, embarque_id, embarque_nome, documento_embarque_id, documento_tipo, documento_numero, motorista_nome, placa_carreta, empresa_id
Relacionamentos: animal_id→animais.id; lote_id→loteApartacoes.id; sessao_id→sessoesPesagem.id; payload.apartacao_id→apartacoes.id; payload.categoria_id→categoriasAnimal.id; payload.embarque_id/documento_embarque_id→embarques/documentosEmbarque; marca/raça/comprador/frigorífico/causa/origem SÓ POR NOME
Campo atual ou histórico: histórico (snapshot do momento)
Campo derivado: data_anterior, peso_anterior, dias, ganho, gmd (série, recalculada em cascata); peso_carcaca_estimado, quantidade_arrobas (tela); era/categoria_id (faixa de peso desde 16/09)
Risco de inconsistência: ALTO — snapshots de texto divergem do cadastro; marca_id/raca_id/rendimento_origem descartados; GTA/NF-e/frete de venda e abate nunca persistidos; SN em Manejo/Saída aponta para animal inexistente
Pode ser usado diretamente: só peso, data, tipo, lote, sessão
Precisa de join: sim (animal, lote, apartação, categoria, sessão, usuário)
Precisa de service: sim (parse do payload via storageRecordToViewModel)
```

### `animais` — estado atual projetado

```text
Store: animais
Chave: ++localId; &id único
Índices: empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, created_at, updated_at, deleted_at
Quantidade esperada: 1 por animal (12 mil na massa 36k; 62,5 mil na 250k)
Campos úteis: id, numero_animal, identificacao_normalizada (sem marca), sexo, marca_id, raca_id, categoria_id, categoria_automatica, era, propriedade_id, situacao, data_saida, motivo_saida, ultima_pesagem_data, ultimo_peso_kg, lote_atual_id, apartacao_atual_id (sem índice), origem, created_at; legado texto: marca, raca
Relacionamentos: por id para marcas, racas, categoriasAnimal, propriedades, loteApartacoes
Campo atual ou histórico: ATUAL (reconstruído por rebuildAnimalStateProjection a cada evento)
Campo derivado: situacao, data_saida, motivo_saida, ultima_pesagem_data, ultimo_peso_kg, lote_atual_id, apartacao_atual_id, categoria_id e era (automática)
Risco de inconsistência: MÉDIO — criado a partir do TEXTO de marca/raça (cria cadastro sem auditoria); categoria vira null quando o último evento é Saída sem peso; importação cria animal sem Cadastro; nascimento sempre null
Pode ser usado diretamente: sim, para inventário atual (melhor fonte)
Precisa de join: nomes de cadastro (mapa id→nome em memória, stores pequenas)
Precisa de service: leve
```

### `animalIdentificadores`

```text
Índices: &id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo (não indexável)
Quantidade: 1 por animal; só tipo VISUAL é gravado
Campos: animal_id, tipo, valor, valor_normalizado, marca_id, marca, faixa_id (null), inicio, fim (null), motivo_troca (null), principal, ativo
Atual/histórico: pretende ser histórico; na prática estático (edição do Cadastro NÃO atualiza)
Risco: ALTO para relatório de identificação (desatualiza; SN duplica)
Uso direto: não recomendado; usar animais
```

### `animalLotes` — permanência em lote

```text
Índices: &id, animal_id, lote_id, inicio, fim
Quantidade: ~1,2 por animal
Campos: animal_id, lote_id, apartacao_id (sem índice), inicio, fim (null = aberto), origem (lancamento/importacao/projecao)
Atual/histórico: histórico; atual quando fim null (null não indexado)
Derivado: sim — rebuildAnimalLotProjection marca todos como excluídos e recria a cada edição/exclusão
Risco: MÉDIO (ids mudam; excluídos acumulam), mas é a ÚNICA fonte de ocupação por período
Uso: sim, para “animais no lote em uma data” (precisa de join com loteApartacoes)
```

### `movimentosAnimais`

```text
Índices: &id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id
Quantidade: 1 por Cadastro, por Saída e por troca de lote
Campos: animal_id, pesagem_id (sem índice), tipo (Entrada | motivo da saída | Mudança de lote), data_evento, lote_origem_id, lote_destino_id, motivo, origem
Risco: ALTO — gravado só na criação; editar/excluir a pesagem NÃO atualiza nem cancela
Uso: NÃO usar como fonte primária; derivar movimentação de pesagens + animalLotes
```

### `apartacoes` e `loteApartacoes`

```text
apartacoes — Índices: id, nome (VAZIO: campo real é nome_apartacao), ativo, ... | Campos: empresa_id, nome_apartacao, ativo, ordem, observacao | Poucas | Sem auditoria | Uso direto
loteApartacoes — Índices: id, apartacao_id, situacao, categoria_id, ... | Campos: apartacao_id, nome_apartacao (snapshot), nome_lote, quantidade_maxima, peso_minimo, peso_maximo, fechado; só migrados: situacao, codigo, categoria_id, data_abertura, data_fechamento, ordem | Poucos | Lote novo sem situacao/categoria_id | Uso direto (capacidade = quantidade_maxima)
```

### Cadastros mestres (`marcas`, `racas`, `categoriasAnimal`, `parceiros`, `propriedades`, `causasMorte`)

| Store | Campos úteis | Observação para relatórios |
|---|---|---|
| `marcas` | nome, abreviacao, proprietario_parceiro_id, propriedade_id, padrao, ativo | criadas também pelo gravador de pesagem, sem auditoria |
| `racas` | nome, abreviacao, **grupo** (ZEBUINO/TAURINO/CRUZADO/OUTRO), padrao, ordem, ativo | `grupo` existe “para agrupar relatórios” |
| `categoriasAnimal` | nome, sexo_aplicavel (M/F; legado AMBOS), peso_min_kg, peso_max_kg, era, ordem, ativo | seeds sem faixa → categoria automática `null` até configurar |
| `parceiros` | tipo_pessoa, documento, papeis[], cidade, uf, registro_sif, rendimento_padrao, ativo | **nenhuma store referencia `parceiros.id`**; uso contado por nome |
| `propriedades` | tipo, parceiro_id, municipio, uf, codigo_oficial, padrao | animal recebe sempre a padrão |
| `causasMorte` | categoria, descricao, exige_observacao, ordem | pesagem guarda só o **nome** |

Todas: estado atual, poucas linhas, uso direto (mapa id→nome em memória). `faixasIdentificadores` e
`excecoesIdentificadores`: **sem gravador** (0 linhas).

### `sessoesPesagem`

```text
Índices: &id, data, [data+local] (VAZIO: local sempre null), status, operador, operador_usuario_id
Quantidade: ~1 por dia
Campos: data, status (ABERTA/FECHADA/CANCELADA), operador (texto), operador_usuario_id (não gravado no fechamento), inicio, fim, justificativas[]; snapshot/marca_padrao_id/... sempre null
Risco: MÉDIO — lançamento em dia FECHADO cria outra sessão ABERTA na mesma data; fechar/reabrir sem auditoria; números do fechamento NÃO congelados
Uso: sim para relatório por sessão (join por pesagens.sessao_id, indexado)
```

### `embarques` e `documentosEmbarque`

```text
embarques — Índices: id, data, status, parceiro_id (VAZIO: nunca gravado) | Campos: empresa_id, nome, data, frigorifico (texto), status | Sem auditoria
documentosEmbarque — Índices: id, embarque_id, tipo (VAZIO: campo real tipo_documento) | Campos: embarque_id, embarque_nome, tipo_documento, numero_gta, numero_nfe, motorista_nome, placa_carreta, qtd_prev_machos, qtd_prev_femeas
Ligação com pesagem: só legacy_payload.embarque_id / documento_embarque_id, sem índice
Uso: romaneio/conciliação possível com varredura das Saídas (tipo_pesagem indexado)
```

### `auditoria`

```text
Índices: &id, entidade, entidade_id, acao, usuario_id, created_at
Quantidade: ≥1 por pesagem, com registro completo em antes/depois (cresce mais que pesagens em bytes)
Campos: entidade, entidade_id, acao, resumo, campos_alterados[], antes, depois, origem, operador, motivo, detalhes, usuario_id, usuario_nome_snapshot, created_at
NÃO registra: exportação, consulta, backup, fechamento/reabertura, embarques, apartações, lotes, cadastros criados pelo lançamento
Risco: contém valores comerciais; nenhum leitor na UI
Uso: relatório de auditoria possível (índices bons); sensível
```

### `importacoes`, `usuarios`, `appSettings`, `backupHistory`

| Store | Campos úteis | Observação |
|---|---|---|
| `importacoes` | arquivo_hash, arquivo_nome, arquivo_tamanho, origem, status, linhas_total, registros_criados, animais_criados | pesagem **não guarda `importacao_id`** |
| `usuarios` | id, nome, login, role, ativo, last_login_at | **`password_*` e `recovery_*` nunca em relatório**; projeção segura = `sanitize` (`localAuthService.js:36-49`) |
| `appSettings` | chaves: `migration:v7`, `auth-policy:<empresa>`, `operational-defaults:<empresa>` (inclui `rendimento_padrao`), `sales-policy:<empresa>`, `weight-warning-policy:<empresa>`, `resumo-personalizado:<empresa>` | local natural para modelos de relatório (ver `11`) |
| `backupHistory` | tipo, created_at, detalhes (JSON string com caminho/tamanho/sha256) | não registra quem fez |

## 2. Onde estão os dados comerciais hoje

Só no `legacy_payload` das pesagens (`valor_pago_cabeca`, `origem_animal`, `documentacao`, `comprador`,
`destino_venda`, `valor_venda_total`, `valor_arroba`, `rendimento_carcaca`, `peso_carcaca_estimado`,
`quantidade_arrobas`, `frigorifico`, `valor_arroba_abate`, `valor_total_abate`), em `embarques.frigorifico` (texto) e
no rendimento padrão (`operational-defaults`, `parceiros.rendimento_padrao`). Parceiros por **nome**, sem operação que
agrupe animais.
