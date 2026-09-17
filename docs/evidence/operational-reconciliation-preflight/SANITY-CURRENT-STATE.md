# SANITY-CURRENT-STATE — Sanidade no código e na documentação (pré-voo)

**Data:** 17/09/2026 · **Branch:** `program/sanity-launch-import` · **HEAD:** `d44d5b9` · **Árvore:** limpa (`git status` vazio)
**Modo:** somente leitura. Nada foi implementado. Fonte da verdade = código em HEAD; quando documentos divergem, a divergência está marcada como **DIVERGÊNCIA**.
**Finalidade:** mapa para desenhar a volta da Sanidade como stores Dexie próprias (`programasSanidade`, `medicamentos`, `aplicacoesSanidade`) integradas ao Lançamento, sem colidir com o que o produto removeu antes.

---

## 0. Resumo executivo

1. **Hoje não existe Sanidade ativa no produto.** Não há página, rota, item de menu, componente, serviço, store ou permissão de sanidade. O que sobra são **resíduos defensivos** (declaração histórica das stores v5 e remoção na v6, limpeza de `sanidade_ids`/`sanidades`, lista proibida do `legacy_payload`) e **um passo de migração** (B11 do backfill v7) que exporta e apaga a chave `cadastros-auxiliares:sanidade:*`.
2. A sanidade **já existiu três vezes**: (a) SQLite/JSON até 1.1.x (`configuracoes_sanidade`, `itens_sanidade`, `sanidades_animal`); (b) Dexie v5 com 3 stores e integração ao Lançamento (seleção múltipla, sugestões por apartação/faixa de peso, vínculo com a pesagem), removida pela **v6**; (c) tela `ConfiguracoesSanidade.jsx` gravando em `appSettings` (1.1.17/1.1.18), removida na 1.2.0 pela migração v7.
3. **ADR-007 × ADR-022:** ADR-007 é a decisão original "Sanidade permanece fora de escopo" (documenta a remoção das stores na v6); ADR-022 é a decisão do Programa 2.0 que retirou a reintrodução em `appSettings` (tela + grupo do registry + chave). O **código só cita ADR-022**; nenhum arquivo de `src/` ou `scripts/` cita ADR-007. As duas precisam ser **substituídas** por uma ADR nova.
4. **Pasta de ADRs:** não há pasta; todas as ADRs estão em um único arquivo, `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md`, numeradas **ADR-001…ADR-048 sem lacunas**. **Próximo número livre real: ADR-049** (e **DEC-031** no registro de decisões). Verificado nas 6 branches locais: nenhuma usa ADR-049+.
5. **Nomes novos não colidem com stores antigas** (`configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal`), mas **`programasSanidade` e `medicamentos` já são nomes de buckets** dentro do valor legado `appSettings['cadastros-auxiliares:sanidade:<empresa>']`, do arquivo `sanidade-export-*.json` e da fixture do gate `migration:v7:verify` — com campos em camelCase e formato diferente.
6. **Risco crítico fora da sanidade, mas disparado por ela:** qualquer store nova exige `DB_VERSION` 8; o coordenador de migração registra **um único backfill por versão** (`migrationCoordinator.js:31`, `:126`). Um banco v6 (1.1.17) ou um backup v5/v6 que chegue a um app v8 **pularia o backfill v7** se o encadeamento não for implementado. Além disso, ADR-034 reserva a v8 para operações comerciais.
7. **Permissões:** dá para cobrir sanidade sem ações novas — cadastros com `registry.read`/`registry.write`, aplicações com `launch.use` (tela) + `weighing.write`/`weighing.edit` (serviço), custos com `commercial.values`/`commercial.write`. O gate `auth:permissions:verify` fixa `ACTIONS.length === 28` (`scripts/verify-auth-permissions.mjs:84`).
8. **Gates que hoje afirmam "sanidade não existe" e quebram/precisam de revisão:** `verify-ui-consistency.mjs:20` (proíbe a palavra "sanidade" no Lançamento), `:185`, `:233`; `verify-registry-ui.mjs:57-79,272`; `verify-master-registry.mjs:62`; `verify-dexie-storage.mjs:59`; `verify-v7-migration.mjs` (inteiro, via coordenador em `DB_VERSION`). Os gates da lista proibida do payload (`sanidade_ids`, `sanidades`) **devem continuar valendo**.

---

## 1. Linha do tempo reconstruída

| Quando | Onde a sanidade vivia | Evidência |
|---|---|---|
| 1.0.0 (16/07/2026) | SQLite: migration 003 `configuracoes_sanidade`, `itens_sanidade`, `sanidades_animal`; entidades JSON `ConfiguracaoSanidade`, `ItemSanidade`, `SanidadeAnimal`; UI `src/components/sanidade/GerenciarSanidades.jsx`; `src/modules/health/infrastructure/healthDataAdapter.js` | `CHANGELOG.md:607-609`; `docs/evidence/slice-d7b-sanidade-embarque-sqlite/SANIDADE-SCHEMA.md:11-24`; `.../CURRENT-SANIDADE-EMBARQUE-INVENTORY.md:13-15,25-27`; `docs/release/1.0.0/RELEASE-NOTES.md:10` |
| 1.1.1–1.1.2 (03/08) | Cutover para Dexie: stores `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal`; IPC `sanidadeEmbarqueIpc.cjs` removido | `CHANGELOG.md:526,548`; `docs/evidence/slice-d16-dexie-operational-cutover/HEALTH-CUTOVER.md:3-5`; `docs/evidence/slice-d15-indexeddb-dexie-storage-decision/DEXIE-SCHEMA.md:11-13` |
| 1.1.9–1.1.11 (05–06/08) | Cadastro persistente de sanidades e medicamentos em abas; **condições por apartação e faixa de peso; seleção múltipla no Lançamento; sugestões compatíveis** | `CHANGELOG.md:313-316,325,351-356`; `docs/release/1.1.11/RELEASE-NOTES.md:8-11`; `docs/release/1.1.9/RELEASE-NOTES.md:3,10` |
| 1.1.16 (04/09) | Dexie **v5, 18 stores**; "aplicações de sanidade e medicamentos persistidas e encerradas logicamente junto da pesagem"; integridade cobria sanidade; importação transacional incluía sanidade | `CHANGELOG.md:236-237,246-247,256`; `docs/auditoria/REAUDITORIA-ENTERPRISE-2026-09-04.md:31,36,60-61,71` |
| entre 1.1.16 e 1.1.17 | **Dexie v6: "remoção integral do domínio de sanidade"** — as 3 stores apagadas fisicamente; `sanidade_ids`/`sanidades` removidos de `pesagens` e do `legacy_payload`; ADR-007 registrada | `git show 77eeb3b:src/storage/indexedDb/schema.js` (linha 5: `DB_VERSION = 6; // v6: remoção integral do domínio de sanidade`); hoje `src/storage/indexedDb/schema.js:31-44`, `src/storage/indexedDb/db.js:28-49`; `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:40-45` |
| 1.1.17 (10/09) e 1.1.18 (14/09) | "Frente paralela" **reintroduz** a tela `ConfiguracoesSanidade.jsx` (menu `pec-config-sanidade`, grupo Cadastros) gravando em `appSettings['cadastros-auxiliares:sanidade:<empresa>']` via `registryService` — **sem consumidor operacional** | `git show 77eeb3b:src/pages/ConfiguracoesSanidade.jsx`; `git show 77eeb3b:src/modules/auxiliary/application/registryService.js` (linha 7: `sanidade: ['programasSanidade', 'medicamentos']`); `git show 77eeb3b:src/Layout.jsx` (linhas 64-67); presente nas tags `v1.1.17-baseline` (77eeb3b) e `v1.1.18` (4d81b50); `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md:19,34,113,130`; `CHANGELOG.md:126` |
| 14/09 (auditoria master) | Contradição C-01; DEC-006 opção A (cumprir ADR-007) | `docs/evidence/auditoria-master-produto-pecuario/SANITY-ADR-REVIEW.md:23,35`; `.../CONTRADICTIONS-REGISTER.md:7`; `.../DECISION-REGISTER.md:14` |
| 1.2.0 (16/09) | ADR-022: tela, grupo do registry e chave removidos; backfill v7 B11 exporta e apaga a chave. Commit de remoção: `8a826bf` (ancestral de HEAD); ausente na tag `v1.2.0-rc1` (3b27958) | `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:146-150`; `src/storage/migrations/v7Backfill.js:659-707`; `CHANGELOG.md:65-66`; `docs/release/1.2.0/RELEASE-NOTES.md:48-50` |
| HEAD d44d5b9 (17/09) | Nenhuma funcionalidade; só resíduos (seção 2) | seções 2–4 |

**DIVERGÊNCIA (CHANGELOG):** a remoção v5→v6 **não tem entrada** no CHANGELOG. A 1.1.17 declara "Removed: Nenhum" e "Migration: Nenhuma — esquema Dexie 6 e backup formato 2 inalterados" (`CHANGELOG.md:215-219`), enquanto a reauditoria da 1.1.16 registra "esquema v5, 18 stores" (`REAUDITORIA-ENTERPRISE-2026-09-04.md:31`) e a própria 1.1.16 anuncia aplicações de sanidade persistidas (`CHANGELOG.md:236-237`). O git começa em 14/09 (`77eeb3b`, ADR-040 em `08-DECISOES-ARQUITETURAIS.md:280`), então a data exata da v6 não é reconstruível pelo repositório.

**Observação de dados:** a atualização v5→v6 do Dexie (`db.js:29-49`) **não exporta** nada antes de apagar as stores. Um banco v5 aberto **hoje** passa antes pelo coordenador, que grava backup pré-migração com **todas** as stores da origem (`migrationCoordinator.js:77-79` → `preMigrationBackup.js:55-59` → `backupService.js:48`, que usa `db.tables`), portanto os dados v5 de sanidade ficam preservados no arquivo `backups/pre-migration-v7-*.json`. Quem foi de 1.1.16 para 1.1.17 com o código da época não teve essa proteção.

---

## 2. Inventário no código atual (HEAD)

### 2.1 Verificação de existência pedida

| Item | Existe? | Evidência |
|---|---|---|
| `src/pages/ConfiguracoesSanidade.jsx` | **Não** | `ls src/pages` (14 páginas, nenhuma de sanidade); gates `scripts/verify-registry-ui.mjs:77-79` e `scripts/verify-ui-consistency.mjs:185` exigem a ausência |
| `src/components/sanidade/` | **Não** | `ls src/components` → `DbBootstrap.jsx, auth, cadastros, common, embarque, mak, modelobase1, pesagens, reports, ui` |
| `src/api/db.js` | **Sim**, sem sanidade | 94 linhas: bootstrap do banco via coordenador (`src/api/db.js:49-75`), retomada da migração (`:81-85`), porta de arquivos (`:23-25`), limpeza (`:91`). Nenhuma menção a sanidade |
| Rotas em `src/pages.config.js` | **Não** | `src/pages.config.js:7-23` (imports) e `:25-40` (PAGES): nenhuma rota de sanidade. Na baseline havia `ConfiguracoesSanidade` (`git show 77eeb3b:src/pages.config.js`, linhas 14 e 24) |
| Itens em `src/Layout.jsx` | **Não** | `src/Layout.jsx:19-154` — Cadastros = Marcas, Raças, Categorias, Parceiros, Propriedades, Mortalidade (`:65-124`). Na baseline havia `pec-config-sanidade` com ícone `HeartPulse` |
| `src/modules/health/` | **Diretório vazio, não versionado** | `src/modules/health/application/` existe vazio (git não rastreia diretório vazio). É **resíduo do módulo antigo de sanidade** (`healthDataAdapter.js`, ver `docs/evidence/slice-d16-dexie-operational-cutover/DEXIE-CUTOVER-IMPLEMENTATION.md:7`). Não confundir com `src/storage/indexedDb/health/health.js` (integridade do banco) |
| Textos de UI com "sanidade"/"sanitário" em `src/` | **Não** | `grep -i "sanidade\|sanit"` em `src/` só encontra `schema.js`, `db.js`, `weighingMapper.js`, `v7Backfill.js`, `migrationState.js` (resíduos listados abaixo) e falsos positivos `sanitize*` (auth/reporting) |
| Permissão de sanidade | **Não** | `src/modules/auth/domain/permissionService.js:18-48` (28 ações) |

### 2.2 `src/storage/indexedDb/schema.js`

| Linha | Conteúdo | Papel |
|---|---|---|
| `:5-6` | `DB_VERSION = 7` | esquema vigente |
| `:12-29` | `STORES_V6` (15 stores, inclui `lotes`) | referência histórica para migração/gates |
| `:31-38` | `STORES_V5 = { ...STORES_V6, configuracoesSanidade, itensSanidade, sanidadesAnimal }` com os índices v5: `configuracoesSanidade: '++localId, &id, empresa_id, nome, tipo, ativo, …'`; `itensSanidade: '++localId, &id, configuracao_id, nome, ativo, …'`; `sanidadesAnimal: '++localId, &id, animal_id, pesagem_id, configuracao_id, data_aplicacao, status, …'` | **necessário** para o Dexie executar v5→v6 (comentário `:31-32`) |
| `:40-44` | `REMOVED_STORES_V6 = { configuracoesSanidade: null, itensSanidade: null, sanidadesAnimal: null }` | exclusão física na v6 |
| `:51-82` | `STORES_V7` (23 stores) | sem sanidade |
| `:92`, `:95` | `STORE_NAMES`, `DOMAIN_STORES` derivados de `STORES` | stores novas entram automaticamente no backup e na checagem de ids |
| `:98-107` | `MASTER_REGISTRY_STORES` (8 stores preservadas por "Limpar dados operacionais", ADR-032) | cadastros de sanidade precisarão entrar aqui |
| `:110` | `PROTECTED_STORES = ['usuarios','appSettings','backupHistory']` | — |

Contagem real (executada com `node` sobre o módulo): **V5 = 18, V6 = 15, V7 = 23**, `DOMAIN_STORES` = 21.

### 2.3 `src/storage/indexedDb/db.js`

- `:5-9` comentário: versões declaradas 5 (histórica), 6 (1.1.17) e 7.
- `:28` `db.version(5).stores(STORES_V5)`.
- `:29-49` `db.version(6).stores({ ...STORES_V6, ...REMOVED_STORES_V6 }).upgrade(...)`: em **cada** linha de `pesagens` apaga `row.sanidade_ids` e `row.sanidades` (nível raiz, `:33-34`) e as mesmas chaves dentro de `legacy_payload` objeto (`:35-37`) ou string JSON (`:38-46`; JSON inválido fica intacto, `:44-46`).
- `:50-65` v7 (enums leves; sem sanidade).

### 2.4 `legacy_payload` — `src/modules/weighing/domain/weighingMapper.js`

- `:6-19` `LEGACY_PAYLOAD_ALLOWLIST` (48 chaves; **nenhuma** de sanidade).
- `:23-25` `LEGACY_PAYLOAD_FORBIDDEN = ['_localId','peso_kg','created_date','updated_date','status_animal','sanidade_ids','sanidades']`.
- `:30-36` `filterLegacyPayload` descarta tudo fora da lista; usado na gravação (`:89`).
- `:115-129` `storageRecordToViewModel` apaga `legacy.sanidade_ids`/`legacy.sanidades` **na leitura** (`:124-125`) — defesa para registros antigos.
- Backfill v7 B10 remove as chaves proibidas do payload persistido (`src/storage/migrations/v7Backfill.js:11,570-598`); `dryRunV7` conta pendências por essas chaves (`:831-836`).
- **DIVERGÊNCIA (doc 12 §6):** `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md:125` lista a allowlist sem `categoria_id`, `categoria_automatica`, `marca_id`, `raca_id`, `causa_morte_id`, `rendimento_origem`, que o código aceita (`weighingMapper.js:14-18`). A parte de sanidade (proibidas) está coerente.

### 2.5 Migração v7 — passo B11 (`src/storage/migrations/v7Backfill.js`)

| Linha | Comportamento |
|---|---|
| `:2` | cabeçalho cita ADR-018, 021, **022**, 028, 038 |
| `:29` | `LEGACY_SETTING_PATTERNS = [/^cadastros-auxiliares:/, /^perfis-saida:/]` |
| `:30` | `SANIDADE_PATTERN = /^cadastros-auxiliares:sanidade:/` |
| `:661-665` | `planSanidade(db)`: lê as chaves, soma registros de **todos os arrays** do valor (buckets `programasSanidade`, `medicamentos`) e devolve `{ chaves, registros, valores }` |
| `:667-682` | `exportSanidade`: sem registros → `{ exportado:false, registros:0 }` (`:668`); sem porta de arquivos → `{ exportado:false, motivo:'SEM_PORTA_DE_ARQUIVOS' }` (`:670-672`); com porta → grava `sanidade-export-<ISO com - no lugar de : e .>.json` em `subdir: 'exports'` com `motivo: 'ADR-022 — sanidade retirada do produto'` (`:673-676`); falha de gravação lança `MIGRATION_SANIDADE_EXPORT_FAILED` citando ADR-022 (`:678-680`) |
| `:695-707` | `runB11`: valida causas/parceiros (`:696`, `:684-693`), exporta sanidade, **mantém a chave só se havia registros e o export não aconteceu** (`:700`, `:704`), apaga as demais chaves legadas (`:705`) e acumula `chavesLegadasRemovidas` (`:706`) |
| `:816-818`, `:863` | `dryRunV7` inclui `sanidade: { registros, chaves }` |
| `:841` | `chavesLegadas` do dry-run inclui qualquer `cadastros-auxiliares:*` restante |

- Relatório técnico: `src/storage/migrations/migrationState.js:38` (`sanidade: null` no `emptyMigrationReport`).
- Destino físico do export: `electron/main.cjs:116-121` (`<dataDir>/exports`, `dataDir = getDataDir()` em `:71`) e `:123-143` (escrita atômica + SHA-256).
- **Lacuna de UI:** a Manutenção mostra o relatório da migração (`src/pages/ManutencaoSistema.jsx:466-480`) mas **não exibe `relatorio.sanidade`** (caminho do export, quantidade, ou `SEM_PORTA_DE_ARQUIVOS` com chave retida). O usuário não é informado de onde foi parar o dado.
- **DIVERGÊNCIA (destino do export):** ADR-022 diz "exportados para JSON em `docs/evidence/program-2.0/`" (`08-DECISOES-ARQUITETURAIS.md:149-150`), repetido em `docs/release/1.2.0/RELEASE-NOTES.md:48-50`; o `SANITY-ADR-REVIEW.md:41` sugeria `docs/evidence/auditoria-master-produto-pecuario/`. **O código grava em `<dataDir>/exports/` da máquina do usuário**, nunca no repositório. Não existe nenhum `sanidade-export-*.json` no repositório (`find` sem resultados) nem registro em `docs/evidence/program-2.0/`.

### 2.6 Backup / restauração (efeito indireto sobre sanidade)

`src/storage/indexedDb/backup/backupService.js`:

- `:143` `missingStores` = stores vigentes ausentes no backup; `:161-171` stores vigentes ausentes nascem vazias (`newStores`) e **stores que não existem mais são ignoradas (`ignoredStores`)**. Backup v5 com `configuracoesSanidade`/`itensSanidade`/`sanidadesAnimal` → as três aparecem em `ignoredStores` e **são descartadas em silêncio** (só o dry-run lista, `:198`).
- `:149-153` backup de banco mais novo é recusado (`DEXIE_BACKUP_005`).
- `:217-222` restauração faz `clear()` + `bulkAdd` **cru** de cada store vigente (sem mapeamento de formato).
- `:231-244` backup de esquema anterior grava `migration:v{atual}` PENDENTE e roda `runPendingBackfills` → B10 limpa `sanidade_ids`/`sanidades` do payload; **o nível raiz de `pesagens` não é limpo** nesse caminho (B10 só olha `legacy_payload`, `v7Backfill.js:578-598`; a limpeza da raiz só existe no upgrade Dexie `db.js:33-34`). Resíduo possível e inofensivo (o view model não espalha a raiz), mas **plausível**, não verificado com backup real.
- `:269-279` "Limpar dados operacionais" apaga toda store que não está em `MASTER_REGISTRY_STORES` ∪ `PROTECTED_STORES`.
- `:328-343` importação JSON de pesagens passa por `storageRecordToViewModel` (que remove sanidade) e pelo mapper (que descarta chave desconhecida) → **vínculos de sanidade de exports antigos são perdidos na reimportação**.
- Não há gate testando restauração de backup **v5** (só v6: `scripts/verify-dexie-backup.mjs:88-107`, `scripts/verify-dexie-import-restore.mjs:78-96`).

### 2.7 Pontos de integração relevantes para a volta (não são sanidade hoje)

- Transação do lançamento: `src/modules/weighing/infrastructure/weighingDataAdapter.js:297-317` monta a lista de tabelas (`:311-315`) e grava pesagem, sessão, auditoria, animal, movimentos e lotes **numa transação**; sessão aberta resolvida em `:318-329`. Aplicações de sanidade salvas junto do lançamento precisam entrar nessa lista para serem atômicas.
- Pós-salvar no Lançamento: `src/pages/LancamentoPesagensIndividuais.jsx:1055-1083` limpa animal, peso, observação, documentação (contexto a preservar — tema da missão 2).
- Linha do tempo da Ficha do Animal: `src/pages/FichaAnimal.jsx:169` (onde aplicações apareceriam). Protótipo de referência já prevê o evento "Sanidade aplicada" (`.tmp/formulario-escopo/Ficha do Animal.dc.html:208`, arquivo versionado).
- Integridade: `src/storage/indexedDb/health/health.js:27-35` checa id/duplicidade em todas as `DOMAIN_STORES` (stores novas entram sozinhas); referências específicas teriam de ser acrescentadas.

---

## 3. Formatos legados que a volta precisa conhecer

### 3.1 Tela `ConfiguracoesSanidade.jsx` / `appSettings` (1.1.17–1.1.18)

Fonte: `git show 77eeb3b:src/pages/ConfiguracoesSanidade.jsx` (linhas 5-29) e `git show 77eeb3b:src/modules/auxiliary/application/registryService.js` (linhas 4-19).

Chave: `cadastros-auxiliares:sanidade:<empresa_id>` (normalmente `local`). Valor: `{ programasSanidade: [...], medicamentos: [...] }`. Cada registro passava por `normalizeRecord`: `id` UUID gerado se ausente, `nome` com trim, `ativo = record.ativo !== false` (demais campos crus, **camelCase**, sem `empresa_id`, `nome_normalizado`, `created_at`, `deleted_at`).

| Bucket | Campos | Enumerações |
|---|---|---|
| `programasSanidade` | `nome` (obrig.), `tipo`, `intervaloDias`, `orientacao`, `ativo` | `tipo`: Vacinação (padrão), Vermifugação, Tratamento, Preventivo, Outro |
| `medicamentos` | `nome` (obrig.), `principioAtivo`, `fabricante`, `unidade`, `dosePadrao`, `carenciaDias`, `viaAplicacao`, `ativo` | `unidade`: mL (padrão), mg, g, dose, unidade · `viaAplicacao`: Subcutânea (padrão), Intramuscular, Oral, Tópica, Outra |

Screenshots de referência ModeloBase1 dessa tela: `docs/evidence/modelobase1-cadastros-2026-09-14/screens/ConfiguracoesSanidade-claro.png` e `-escuro.png` (`capture-report.json:7,65,125`).

### 3.2 Dexie v5 (até 1.1.16)

Índices em `schema.js:35-37` (ver 2.2). Campos completos não estão no repositório (o código do `healthDataAdapter` é anterior ao git). Pistas: aplicações ligadas a `animal_id` e `pesagem_id`, `configuracao_id`, `data_aplicacao`, `status`, com exclusão lógica; pesagens carregavam `sanidade_ids` e `sanidades` (`db.js:33-43`).

### 3.3 SQLite (1.0.x)

`docs/evidence/slice-d7b-sanidade-embarque-sqlite/SANIDADE-SCHEMA.md:17-24`: `configuracoes_sanidade(nome_sanidade…)`, `itens_sanidade(configuracao_sanidade_id, medicamento, finalidade, quantidade_padrao, unidade_medida, custo_unitario…)`, `sanidades_animal(configuracao_sanidade_id, numero_animal, data_aplicacao, medicamento, finalidade, quantidade, unidade_medida, custo_unitario, custo_total…)`. Referência de domínio apenas; não há caminho de dados vivo.

---

## 4. Gates que afirmam a ausência de sanidade

Todos os scripts abaixo estão em `test:full` (`package.json:68`), direta ou indiretamente via `storage:all:verify` (`package.json:31`).

| Gate (npm) | Arquivo:linha | O que afirma hoje | Efeito quando a Sanidade voltar | Ação proposta |
|---|---|---|---|---|
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:20` | `!/sanidade\|sanit[aá]ri/i.test(LancamentoPesagensIndividuais.jsx)` — "lançamento não pode expor controles ou configurações de Sanidade" | **Quebra** assim que o Lançamento importar/rotular qualquer coisa de sanidade | Substituir por contrato positivo: painel/diálogo de sanidade no Lançamento usa componentes ModeloBase1, só aparece com `launch.use` e **não** grava em `legacy_payload` |
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:185` | `ConfiguracoesSanidade.jsx` não existe (ADR-022) | Continua verdadeiro se as páginas novas tiverem outro nome | Reescrever a mensagem para "a tela legada em `appSettings` não volta (ADR-049)" e acrescentar asserções das páginas novas |
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:233` | resumo impresso `healthFeatureRemoved: true` | Informação falsa | Remover/renomear |
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:89` | comentário "cadastros auxiliares (Parceiros, Mortalidade, Sanidade)" | Comentário obsoleto já hoje | Corrigir |
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:179-183` | laço fixo das 6 páginas de cadastro | Não cobre páginas novas | Acrescentar as páginas de sanidade |
| `registry:ui:verify` | `scripts/verify-registry-ui.mjs:57` (comentário ADR-022), `:60-76` (6 wrappers), `:77-79` (`ConfiguracoesSanidade.jsx` e `CadastrosComerciais.jsx` ausentes) | "seis wrappers finos; páginas antigas removidas" | Páginas novas não validadas; ausência continua verdadeira | Incluir as páginas novas no array `PAGES`; manter a ausência da tela legada |
| `registry:ui:verify` | `scripts/verify-registry-ui.mjs:272-273` | `USAGE_IN_LIST_STORES` = exatamente marcas, raças, categorias, propriedades (`src/components/cadastros/registryFormModel.js:14`) | Quebra se "Em uso" for ligado para medicamentos/programas | Decidir e ajustar |
| `registry:master:verify` | `scripts/verify-master-registry.mjs:62` | `REGISTRY_DEFINITIONS.length === 6` (`src/modules/catalog/domain/registryDefinitions.js:331`) | **Quebra** se os cadastros de sanidade reutilizarem `createMasterRegistryService` | Atualizar a contagem e a lista esperada |
| `registry:master:verify` | `scripts/verify-master-registry.mjs:517-518` | `registryService.js` legado não volta | Deve continuar | Manter |
| `storage:dexie:verify` | `scripts/verify-dexie-storage.mjs:18-39` | abre v5, grava em `configuracoesSanidade`, sobe e exige que as 3 stores antigas sumam e que `sanidade_ids`/`sanidades` saiam do payload | Continua válido (nomes novos não colidem) | **Manter** — é a prova de que a v5 não ressuscita |
| `storage:dexie:verify` | `scripts/verify-dexie-storage.mjs:59` | `DB_VERSION === 7` fixo | **Quebra** em v8 | Parametrizar; criar bloco v7→v8 com as stores novas |
| `storage:dexie:verify` | `scripts/verify-dexie-storage.mjs:62` | `MASTER_REGISTRY_STORES` + `usuarios` criadas no upgrade v6→v7 | Se `programasSanidade`/`medicamentos` entrarem em `MASTER_REGISTRY_STORES`, a mensagem "store nova criada" no teste v6→v7 fica semanticamente errada | Separar listas por versão |
| `storage:backup:verify` | `scripts/verify-dexie-backup.mjs:51,69-70,106-107,140` | manifesto = `STORE_NAMES`; v6 ignora só `lotes`; preservação de cadastros | Automático; falta caso v5 | **Acrescentar** backup v5 com as 3 stores antigas → `ignoredStores` as contém e as stores novas ficam vazias |
| `migration:v7:verify` | `scripts/verify-v7-migration.mjs:100,262-271,428-431` | fixture `cadastros-auxiliares:sanidade:local` com `programasSanidade`/`medicamentos`; export em `exports/`; `chavesLegadasRemovidas.length === 4`; chave retida sem porta | Continua válido **se** B11 não mudar; o gate inteiro usa o coordenador em `DB_VERSION` (`:148,169,295`) e **quebra em v8** | Congelar como gate do caminho v6→v7 dentro de uma cadeia v6→v7→v8 |
| `weighing:mapper:verify` | `scripts/verify-weighing-mapper.mjs:58-65` | `sanidade_ids`/`sanidades` proibidas e descartadas | Continua válido | **Manter** (aplicações ficam em store própria, ADR-027) |
| `payload:allowlist:verify` | `scripts/verify-payload-allowlist.mjs:24-30` | idem | Continua válido | **Manter** |
| `perf:contract:verify` | `scripts/verify-perf-baseline-contract.mjs:195` | massa v7 sem chaves proibidas | Continua válido; `:120` exige que stores da massa existam no esquema | Acrescentar volume de aplicações à massa se houver orçamento de desempenho |
| `auth:permissions:verify` | `scripts/verify-auth-permissions.mjs:84` | `ACTIONS.length === 28` | Quebra só se criarem ação nova | Proposta da seção 6 mantém 28 |
| `reports:templates:verify` | `scripts/verify-reports-templates.mjs:15` | nenhuma store com `template`/`report` no nome | Irrelevante para os nomes propostos | — |
| (falso positivo) | `scripts/verify-packaged-build.mjs:332` | comentário "Sanidade do próprio self-test" (sentido de *sanity check*) | Um grep ingênuo por "sanidade" pega | Ignorar em qualquer varredura automática |

Resíduos de código (não são gates, mas afirmam a remoção):

| Arquivo:linha | Afirmação | Na volta |
|---|---|---|
| `src/storage/indexedDb/schema.js:31-44` | v5/v6 removem as 3 stores antigas | **Manter** (caminho de upgrade de bancos v5) |
| `src/storage/indexedDb/db.js:28-49` | idem + limpeza de payload | **Manter** |
| `src/modules/weighing/domain/weighingMapper.js:23-25,124-125` | chaves de sanidade proibidas | **Manter** |
| `src/storage/migrations/v7Backfill.js:675,679` | "ADR-022 — sanidade retirada do produto" | Texto fica historicamente correto para quem migra de 1.1.17, mas enganoso num produto com sanidade; decidir se B11 passa a **converter** a chave para as stores novas (ver 7.4) |
| `src/storage/migrations/migrationState.js:38` | `relatorio.sanidade` | Manter; exibir na Manutenção |

---

## 5. Documentação e textos que mencionam sanidade

### 5.1 Arquitetura (vigente — prevalece sobre evidências, `docs/arquitetura-produto/README.md:20-24`)

| Arquivo:linha | Diz | Precisa mudar na volta |
|---|---|---|
| `docs/arquitetura-produto/00-VISAO-E-PRINCIPIOS.md:97-100` | sanidade explicitamente fora; retomada exige módulo separado e nova decisão | Sim |
| `docs/arquitetura-produto/01-ESTADO-ATUAL-E-LACUNAS.md:43,120` | "Fora de escopo — removida do esquema v6"; não havia ADR | Sim |
| `docs/arquitetura-produto/02-ARQUITETURA-DE-DOMINIO.md:39` | "Sanidade não faz parte dos contextos ativos" | Sim (novo contexto) |
| `docs/arquitetura-produto/03-CADASTROS-E-FLUXOS.md:237-239` | §14 fora de escopo: "sanidade e medicamentos" | Sim |
| `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:40-45,128,146-150` | ADR-007, ADR-019 ("nada de medicamentos" no estoque), ADR-022 | Substituir por ADR-049 (seção 6) |
| `docs/arquitetura-produto/10-MODELO-PRODUTO-2.0.md:28,40` | "Não é: … veterinário"; menu "Removidos: Sanidade" | Sim |
| `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md:89-100,116,125,127-133` | v8 = operações comerciais; B11 exporta sanidade; proibidas; contagem v8 = 24 | Sim (versão e contagem) |
| `docs/arquitetura-produto/14-MIGRACOES.md:3,33` | ADR-022; chaves `migration:v7`, `migration:v8` | Sim (encadeamento) |
| `docs/arquitetura-produto/F0-01-MAPA-DE-CAMPOS.md:144-147` | §11 campos que não serão criados: sanidade, medicamentos | Sim |
| `docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md:50-72` | matriz sem sanidade | Só se mapear explicitamente ações existentes |

### 5.2 Usuário, release e changelog

| Arquivo:linha | Diz |
|---|---|
| `docs/user/GUIA-RAPIDO.md:23` | "A tela de Sanidade foi retirada nesta versão" |
| `CHANGELOG.md:65-66` | 1.2.0 Removed: tela de Configurações de Sanidade |
| `CHANGELOG.md:126` | 1.1.18: cadastros auxiliares (Parceiros, Mortalidade, **Sanidade**) na Tela Mãe |
| `CHANGELOG.md:236-237,246-247,256,313-316,325,351-356,483,526,548,607-609` | histórico 1.0.0–1.1.16 |
| `docs/release/1.2.0/RELEASE-NOTES.md:48-50` | removida; export para `docs/evidence/program-2.0/` (**DIVERGÊNCIA**, ver 2.5) |
| `docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md:71` | B11: sanidade exportada antes |
| `docs/release/1.1.16/RELEASE-NOTES.md:14-15`, `1.1.16/RELEASE-CHECKLIST.md:12`, `1.1.11/*`, `1.1.10/RELEASE-CHECKLIST.md:20`, `1.1.9/*`, `1.1.3/RELEASE-NOTES.md:29`, `1.0.0/RELEASE-NOTES.md:10` | histórico |

### 5.3 Evidências e auditorias (históricas; não definem arquitetura)

- `docs/evidence/auditoria-master-produto-pecuario/SANITY-ADR-REVIEW.md` (opções A/B/C; **opção B já propunha `programasSanidade`, `medicamentos` e um evento de aplicação por animal**, `:30`, porém como "nova **ADR-018**" — número hoje ocupado por cadastros mestres, `08:113`). **DIVERGÊNCIA de numeração.**
- `.../DECISION-REGISTER.md:14` (DEC-006), `.../CONTRADICTIONS-REGISTER.md:7,21` (C-01, C-15), `.../APPSETTINGS-AUDIT.md:11`, `.../INVENTORY-SCOPE-DECISION.md:28` ("Medicamentos não ganham estoque"), `.../OVERENGINEERING-GUARDRAILS.md:30` ("Veterinário: sanidade, carência, protocolo, necropsia — ADR-007"), `.../TARGET-ENTITY-MAP.md:46`, `.../TARGET-SCREEN-MAP.md:26`, `.../PRODUCT-CAPABILITY-MAP.md:39,63`, `.../EXECUTIVE-ASSESSMENT.md:23`, `.../IMPLEMENTATION-SLICE-PLAN.md:24,37`, `.../MASTER-ROADMAP-RECOMMENDATION.md:27`, `.../UX-FLOW-AUDIT.md:13`, `.../MODELOBASE1-PRODUCT-MAP.md:22`, `.../LEGACY-PAYLOAD-AUDIT.md:7,32`.
- `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md:18,19,34,51,111,113,130`; `docs/auditoria/REAUDITORIA-ENTERPRISE-2026-09-04.md:5,36,60-61,71`.
- `docs/evidence/auditoria-relatorios-profissionais/07-REPORTING-DATA-DICTIONARY.md:13` ("stores removidas … (v6) — não usar").
- `docs/evidence/DOCUMENTACAO-ATUAL-2026-09-15.md` é **cópia consolidada** dos documentos (ADRs em `:2193-2509`); não é fonte — não editar como se fosse.
- `docs/evidence/program-2.0/CHECKPOINT-2026-09-15-PAUSA.md:18`, `.../phase-00/EXECUTION-REPORT.md:44`, `docs/evidence/STATE-OF-REPO-BEFORE.md:18`.
- Slices antigos d7a, d7b, d8, d9, d10, d11, d15, d16, d17a, d17b, d17d2r5, d17d2r6 (histórico SQLite/Dexie v5).

---

## 6. ADRs

### 6.1 Localização e numeração

- **Não existe pasta de ADRs.** Todas estão em `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` (uma seção `## ADR-NNN` por decisão). O `Glob docs/**/*adr*` não encontra nenhum arquivo dedicado.
- Faixas: ADR-001…017 (pacote de arquitetura, já no baseline `77eeb3b`); ADR-018…040 (commit `39a2071`, Programa 2.0, `08:106-111`); ADR-041…048 (commit `bd0bb70`, `08:287-289`).
- Sequência **contínua de ADR-001 a ADR-048** (`08:3` … `08:319`). `grep "ADR-(049|0[5-9]\d|[1-9]\d\d)"` no repositório: nenhum resultado; `git grep` nas branches `main`, `preview/1.2.0-demo`, `program/pesagens-master-evolution`, `program/reporting-1.3.0`, `program/sanity-launch-import`, `release/1.1.18`: nenhum resultado.
- **Próximo número livre: ADR-049.** Registro de decisões: DEC-001…022 (auditoria master) e DEC-023…030 (`08:291-317`); **próximo: DEC-031**. Pendências: P-001…P-008 (`08:325-334`).
- Processo obrigatório (`08:336-340`): registrar contexto, opções, decisão, consequências, migração, rollback, impacto em dados, segurança, testes e documentação; **alterar decisão aceita exige nova ADR que substitui a anterior** (sem edição silenciosa).
- Duplicata: `docs/evidence/DOCUMENTACAO-ATUAL-2026-09-15.md:2193-2509` repete o texto das ADRs (snapshot).

### 6.2 ADR-007 × ADR-022 — qual é qual

| | ADR-007 | ADR-022 |
|---|---|---|
| Local | `08-DECISOES-ARQUITETURAIS.md:40-45` | `08-DECISOES-ARQUITETURAIS.md:146-150` |
| Título | "Sanidade permanece fora de escopo" | "Sanidade retirada do produto neste ciclo (DEC-006; reafirma ADR-007)" |
| Origem | pacote de arquitetura (antes do git; `01-ESTADO-ATUAL-E-LACUNAS.md:120-123` diz que não havia ADR e que o pacote corrige a lacuna) | Programa 2.0 / auditoria master (DEC-006, `DECISION-REGISTER.md:14`) |
| O que decide | não recriar cadastros, seleção, aplicação ou relatórios; registra que **o esquema v6 removeu as stores**; retorno exige nova ADR e módulo independente | remover a **tela** "Configurações de Sanidade", o **grupo `sanidade` do registry** e a **chave `cadastros-auxiliares:sanidade:*`**; exportar para JSON antes; retorno exige nova ADR e módulo próprio |
| Materialização no código | `schema.js:31-44`, `db.js:28-49`, `weighingMapper.js:23-25,124-125` (sem citar a ADR) | `v7Backfill.js:2,30,659-707` (citada em `:675,679`); commit `8a826bf` |
| Citada em código/gates | **nunca** | `v7Backfill.js:2,675,679`; `scripts/verify-ui-consistency.mjs:185`; `scripts/verify-registry-ui.mjs:57`; docs `12:116`, `14:3`, `RELEASE-NOTES 1.2.0:49` |

Conclusão: **ADR-007 retirou o domínio (stores v5→v6); ADR-022 retirou a reintrodução em `appSettings` (v7).** Ambas exigem "nova ADR" para o retorno.

### 6.3 ADRs e decisões afetadas pela volta (a ADR-049 precisa tratar)

| ADR/DEC | Trecho | Conflito com a missão |
|---|---|---|
| ADR-007 | `08:40-45` | substituir integralmente |
| ADR-022 | `08:146-150` | substituir; decidir destino da chave legada (exportar × converter) |
| ADR-019 + DEC-017 | `08:128`; `INVENTORY-SCOPE-DECISION.md:28` | "Estoque significa somente identificadores; nada de medicamentos". Store `medicamentos` como **cadastro sem estoque** é compatível; qualquer saldo/lote de produto exige substituir parcialmente |
| ADR-034 | `08:221-226` | v8 reservada a operações comerciais/embarques; sanidade antes disso **reordena a v8** (e `12-MODELO-DADOS-V7-V8.md:89-100,127-133`, marcos ADR-047 `08:317`) |
| ADR-018 | `08:113-121` | cadastros são stores com `id`, `nome_normalizado`, `ativo`, `deleted_at`; nada estrutural em `appSettings` → modelo dos cadastros de sanidade |
| ADR-027 | `08:178-184` | nenhuma chave estrutural nova no `legacy_payload` → aplicações em store própria, `sanidade_ids`/`sanidades` continuam proibidas |
| ADR-032 | `08:210-214` | "Limpar dados operacionais" preserva cadastros → `programasSanidade`/`medicamentos` em `MASTER_REGISTRY_STORES`; `aplicacoesSanidade` é operacional |
| ADR-038 | `08:259-266` | migração resumível, backup pré-migração, fail closed |
| ADR-030 | `08:199-203` | sessão fechada recusa novos eventos → aplicações vinculadas à sessão seguem a mesma regra |
| ADR-011, ADR-016 | `08:65-69`, `08:94-98` | relatórios por catálogo; telas ModeloBase1 |
| ADR-042/046 | `08:295-297`, `08:311-313` | autorização no serviço e auditoria por usuário |
| Guardrails | `OVERENGINEERING-GUARDRAILS.md:30`; `10-MODELO-PRODUTO-2.0.md:28` | carência, protocolo e "veterinário" listados como fora; a ADR precisa delimitar o mínimo (ex.: carência só informativa) |

---

## 7. Impacto técnico da volta com stores novas

### 7.1 Esquema Dexie

- Store nova ⇒ `DB_VERSION` 8 com `STORES_V8 = { ...STORES_V7, programasSanidade, medicamentos, aplicacoesSanidade }`; manter `db.version(5)`, `db.version(6)` e `db.version(7)` (`db.js:28-65`) — sem isso bancos antigos não sobem.
- `STORE_NAMES`/`DOMAIN_STORES` se ajustam sozinhos (`schema.js:92,95`); backup completo passa a incluir as stores (`backupService.js:85-88`); integridade checa ids (`health.js:27-35`).
- **Obrigatório:** acrescentar `programasSanidade` e `medicamentos` a `MASTER_REGISTRY_STORES` (`schema.js:98-107`), senão "Limpar dados operacionais" os apaga (`backupService.js:272-276`).
- `versionInfo.js:19` deriva `DB_SCHEMA_VERSION` de `DB_VERSION`; `verify-version-contract.mjs:170` espera `DATA_BUILD_ID = schema-v8`.

### 7.2 Coordenador de migração — **risco crítico**

- `BACKFILLS = { [V7_VERSION]: … }` e comentário "A v8 entra aqui na Fase 3" (`migrationCoordinator.js:30-31`).
- `runPendingBackfills` executa **somente** `BACKFILLS[DB_VERSION]` (`:126`); `recordPendingMigrationBeforeOpen` grava só `migration:v{DB_VERSION}` (`:95-111`); `applyRestore` grava PENDENTE só para `getDbVersion()` (`backupService.js:231-237`); a integridade só aplica o contrato v7 se `migration:v7` estiver CONCLUIDA (`health.js:24-25`).
- Consequência com `DB_VERSION = 8`: banco 1.1.17 (v6), banco novo (seeds B2/B3/B6 do v7) e restauração de backup v5/v6 **não rodariam o backfill v7**. É pré-requisito encadear v7→v8 (executar cada backfill pendente em ordem) antes de qualquer store de sanidade.

### 7.3 Backups antigos × nomes antigos e novos

| Fonte antiga | Conteúdo de sanidade | O que acontece hoje | Com as stores novas |
|---|---|---|---|
| Backup v5 (≤ 1.1.16; formato 2, `backupService.js:54`) | stores `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal`; `pesagens.legacy_payload.sanidade_ids/sanidades` (e possivelmente na raiz) | stores em `ignoredStores` (descartadas); payload limpo por B10 | Continua descartado (nomes diferentes). **Não reutilizar os nomes v5**: se reutilizados, `applyRestore` faria `bulkAdd` cru de linhas com formato v5 nas stores novas (`backupService.js:217-222`) |
| Pré-migração `backups/pre-migration-v7-*.json` gerado a partir de v5 | as 3 stores v5 completas | só restaurável (e descartado) | Única fonte real das **aplicações** antigas; um importador dedicado poderia lê-las |
| Backup v6 de 1.1.17/1.1.18 | `appSettings['cadastros-auxiliares:sanidade:*']` com `programasSanidade`/`medicamentos` | restauração → backfill v7 → B11 exporta e apaga | Mesmo nome de bucket das stores novas, **formato diferente** (camelCase, sem `nome_normalizado`/timestamps) → exige mapeamento explícito |
| `<dataDir>/exports/sanidade-export-*.json` | `{ exportadoEm, motivo, chaves: { '<chave>': { programasSanidade, medicamentos } } }` (`v7Backfill.js:675`) | nenhum consumidor | Fonte de importação dos cadastros |
| `appSettings` retido (`SEM_PORTA_DE_ARQUIVOS`, `v7Backfill.js:670-672,700-704`) | chave legada viva no banco com migração CONCLUIDA | nunca é reprocessada | Fonte de conversão; nenhuma UI avisa |
| Backup gerado pela versão nova restaurado em 1.2.0/1.3.0 | stores novas | recusado por `dbVersion` maior (`backupService.js:149-153`) | Comportamento correto |

Conflitos de nome:

| Nome | Já aparece em | Risco |
|---|---|---|
| `programasSanidade` | bucket do registry legado (`git show 77eeb3b:src/modules/auxiliary/application/registryService.js`, linha 7); export JSON; fixture `scripts/verify-v7-migration.mjs:100,269`; proposta `SANITY-ADR-REVIEW.md:30` | Semântico, não de Dexie: código de conversão pode confundir o array legado com a store |
| `medicamentos` | idem; ADR-019 `08:128`; `INVENTORY-SCOPE-DECISION.md:28` | Escopo (estoque) e formato legado |
| `aplicacoesSanidade` | nenhum lugar | — |
| `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` | `schema.js:35-43`; `verify-dexie-storage.mjs:29,33`; backups v5 | **Não reutilizar** |
| `sanidade_ids`, `sanidades` | lista proibida e limpezas | **Não reutilizar** em `pesagens`/payload |
| prefixo `cadastros-auxiliares:` | `v7Backfill.js:29` apaga tudo com esse prefixo sempre que o backfill v7 roda (inclusive após restore) | **Não gravar nada novo** com esse prefixo |
| `health` | `src/modules/health/application/` vazio; `src/storage/indexedDb/health/health.js` (integridade) | Ambiguidade de nome de módulo; preferir nome explícito |

### 7.4 B11 e a chave legada

Opções para a ADR-049: (a) manter B11 como está (exporta e apaga; histórico de quem vem da 1.1.17) e criar importação manual a partir do export; (b) no backfill v8, **converter** `cadastros-auxiliares:sanidade:*` retida e/ou arquivos `sanidade-export-*.json` para `programasSanidade`/`medicamentos` (id legado preservado, `nome_normalizado`, `ativo`, timestamps; mapa `intervaloDias→intervalo_dias`, `principioAtivo→principio_ativo`, `dosePadrao→dose_padrao`, `carenciaDias→carencia_dias`, `viaAplicacao→via_aplicacao`). Em qualquer caso, exibir `relatorio.sanidade` na Manutenção (`ManutencaoSistema.jsx:466-480`).

### 7.5 Lançamento, payload e importação

- Aplicações **fora** do `legacy_payload` (ADR-027; `weighingMapper.js:23-25`) e gravadas na mesma transação do lançamento (`weighingDataAdapter.js:311-317`).
- A importação atual (`backupService.js:328-354` → `weighingService.bulkCreateEntries`) não conhece sanidade e descarta vínculos antigos; a importação reconstruída precisa de caminho próprio para aplicações.
- O gate `verify-ui-consistency.mjs:20` precisa mudar **antes** de a primeira linha de sanidade entrar no Lançamento.

---

## 8. Permissões — cobrir sanidade sem ações novas

### 8.1 Estado atual

- Matriz: `src/modules/auth/domain/permissionService.js:18-48`, 28 ações (`ACTIONS`, `:50`), gate fixo em 28 (`scripts/verify-auth-permissions.mjs:84`). Fachada rev. 1: `src/modules/auth/domain/accessPolicy.js:1-43`.
- Pontos de aplicação no serviço:
  - cadastros: `assertRegistryWrite` → `registry.write` (`src/modules/catalog/application/registryAccess.js:10,25-30`), chamado em `masterRegistryService.js:268,290,319,337,351,370`;
  - pesagens: `requireWeighingPermission` falha fechada (`src/modules/weighing/application/weighingService.js:12-24`), `weighing.write` em `:54,106`, `weighing.edit` em `:118,138,200,219`; valores comerciais digitados removidos sem `commercial.write` (`:26-35`);
  - UI: `PesagensIndividuais.jsx:163-165` (`launch.use`, `weighing.edit`, `weighing.write`); menu por permissão (`Layout.jsx:158-162`);
  - relatórios: colunas sensíveis por `commercial.values`/`audit.read`/`users.manage` (`src/modules/reporting/domain/reportPermissions.js:7-11`), `requires` por definição (`:22-24`);
  - configurações: grupos com `settings.auth`/`settings.operational` (`src/modules/settings/application/appConfigService.js:50-54`).
- `animal.write` ("cadastro rápido") existe na matriz (`permissionService.js:24`) mas **não é verificado em nenhum serviço** (só no gate `verify-auth-permissions.mjs:31`).

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA |
|---|---|---|---|---|
| `launch.use` | ✔ | ✔ | ✔ | ✘ |
| `weighing.read` | ✔ | ✔ | ✔ | ✔ |
| `weighing.write` / `weighing.edit` | ✔ | ✔ | ✔ | ✘ |
| `animal.read` | ✔ | ✔ | ✔ | ✔ |
| `animal.write` | ✔ | ✔ | ✔ | ✘ |
| `registry.read` | ✔ | ✔ | ✔ | ✔ |
| `registry.write` | ✔ | ✔ | ✘ | ✘ |
| `commercial.values` / `commercial.write` | ✔ | ✔ | ✘ | ✘ |
| `settings.operational` | ✔ | ✔ | ✘ | ✘ |
| `reports.read` | ✔ | ✔ | ✔ | ✔ |

(valores do código, `permissionService.js:19-47`)

### 8.2 Cadastros (programas/procedimentos, medicamentos/produtos)

| Opção | Prós | Contras |
|---|---|---|
| **A. `registry.read` / `registry.write`** (recomendada) | Mesmo padrão dos 6 cadastros mestres (ADR-018): `createMasterRegistryService` + `CadastroAuxiliarPage` + `assertRegistryWrite` já prontos e com gates; menu Cadastros já usa `registry.read` (`Layout.jsx:73-123`); OPERADOR e CONSULTA leem; auditoria por usuário já existe | OPERADOR não cria produto/procedimento novo no curral (precisa do GESTOR antes); se medicamento tiver custo, a coluna precisa ser marcada como comercial |
| B. `settings.operational` | Só ADMIN/GESTOR; grupo de configuração já existe | Contraria ADR-018 (dado estrutural fora de `appSettings`) e repete exatamente o erro que ADR-022 corrigiu; item de menu Configurações exige `settings.manage` (`Layout.jsx:143`) enquanto a página aceita `settings.operational` (`Configuracoes.jsx:422`) — GESTOR não vê o menu |
| C. `animal.write` (cadastro rápido) | OPERADOR cria no curral | Semântica errada (ação é do animal); nenhum serviço a verifica hoje; abre o catálogo de produtos veterinários a qualquer operador |

### 8.3 Aplicações por animal

| Opção | Prós | Contras |
|---|---|---|
| **A. `launch.use` (tela) + `weighing.write` (registrar/importar) + `weighing.edit` (editar/cancelar); leitura por `weighing.read`/`animal.read`** (recomendada) | A aplicação nasce no Lançamento e na mesma transação da pesagem; reutiliza `requireWeighingPermission` (falha fechada sem sessão) e o gate `auth:weighing-access:verify`; importação histórica usa a mesma ação que já controla a importação (`PesagensIndividuais.jsx:165`); CONSULTA bloqueado | Não separa "quem pesa" de "quem medica"; aplicação avulsa (sem pesagem, ex.: vermifugação do lote) não é semanticamente uma pesagem; OPERADOR pode editar/excluir (exige exclusão lógica + auditoria) |
| B. `animal.write` (registrar/editar) + `animal.read` | Aplicação é evento do animal; cabe na Ficha do Animal (`FichaAnimal.jsx:169`) sem depender de pesagem | Mesmos papéis da opção A (nenhum ganho de segregação); uma única ação para criar e editar; seria o primeiro uso real de `animal.write`; doc 11 a descreve como "cadastro rápido" (`11-AUTENTICACAO-LOCAL.md:58`) |
| C. `registry.write` para aplicar | Só ADMIN/GESTOR aplicam | Inviável no curral (OPERADOR é quem lança) |

Complementos sem ação nova: custos/valores de produto ou aplicação → `commercial.values` (ver) e `commercial.write` (digitar), igual a `withoutCommercialInput`; relatórios de sanidade → `reports.read` + `requires` (`weighing.read`/`animal.read`); aplicação em sessão FECHADA → mesma recusa das pesagens (ADR-030) e reabertura por `session.reopen`.

**Limite desta proposta:** se o responsável quiser que OPERADOR pese mas **não** aplique medicamento (ou que só GESTOR registre carência), nenhuma ação existente expressa isso — seria preciso ação nova (ex.: `health.apply`), ADR e atualização do gate de 28 ações e do doc 11 §4.

### 8.4 Divergências de permissões (doc × código)

- `reports.read` para OPERADOR: doc ✘ (`11-AUTENTICACAO-LOCAL.md:66`), código ✔ (`permissionService.js:35`).
- `audit.read` para CONSULTA: doc ✔ (`11:72`), código ✘ (`permissionService.js:47`).
- `reports.export` e `reports.templates.share` (`permissionService.js:36-37`) não constam do doc 11 §4.
- ADR-036 (`08:242-250`) aponta `accessPolicy.js` como mapa e 3 perfis; substituída por ADR-042; `Layout.jsx:8` e `registryAccess.js:2-3` ainda citam o arranjo antigo.

---

## 9. Outras divergências documentação × código encontradas

1. **Contagem de stores v6:** `12-MODELO-DADOS-V7-V8.md:131` diz 16; o código tem **15** (`schema.js:12-29`, contado). `AUDITORIA-ESTADO-2026-09-14.md:18` também diz 16. A v5 tem 18 (bate com `REAUDITORIA:31`).
2. **Destino do export de sanidade:** ADR-022/RELEASE-NOTES 1.2.0 (`docs/evidence/program-2.0/`) × código (`<dataDir>/exports/`), ver 2.5.
3. **CHANGELOG sem a remoção v6** (seção 1).
4. **SANITY-ADR-REVIEW propõe "ADR-018"** para sanidade; o número foi usado por cadastros mestres.
5. **Allowlist do payload** no doc 12 §6 desatualizada (6 chaves a menos), ver 2.4.
6. **`CHANGELOG.md:126`** (1.1.18) cita Sanidade entre os cadastros na Tela Mãe; comentário equivalente obsoleto em `verify-ui-consistency.mjs:89`.

---

## 10. Riscos

| # | Risco | Gravidade | Evidência |
|---|---|---|---|
| R1 | Subir para v8 sem encadear backfills pula o v7 em bancos v6, bancos novos e restaurações v5/v6 | **Crítica** | `migrationCoordinator.js:31,126`; `backupService.js:231-244` |
| R2 | Reutilizar nomes v5 faz restauração crua de linhas de formato antigo nas stores novas | Alta | `backupService.js:161-171,217-222` |
| R3 | Cadastros de sanidade fora de `MASTER_REGISTRY_STORES` são apagados por "Limpar dados operacionais" | Alta | `schema.js:98-107`; `backupService.js:272-276` |
| R4 | Dados de sanidade antigos perdidos em silêncio (stores v5 ignoradas; payload limpo; export fora do repositório sem aviso na UI) | Média | `backupService.js:167`; `v7Backfill.js:570-598,667-682`; `ManutencaoSistema.jsx:466-480` |
| R5 | Confusão entre buckets legados `programasSanidade`/`medicamentos` (camelCase) e stores novas homônimas | Média | seção 3.1 e 7.3 |
| R6 | Colocar vínculos de aplicação no `legacy_payload` viola ADR-027 e é apagado por mapper/B10 | Média | `weighingMapper.js:23-36,124-125` |
| R7 | Aplicação gravada fora da transação do lançamento deixa pesagem sem aplicação (ou o inverso) | Média | `weighingDataAdapter.js:311-317` |
| R8 | Conflito de roadmap: v8 prometida para operações comerciais (ADR-034, doc 12 §4/§7) | Média | `08:221-226`; `12:89-100,127-133` |
| R9 | Escopo "veterinário" (carência bloqueando venda, calendário, estoque de medicamento) reabre o que ADR-019/DEC-017 e os guardrails vetaram | Média | `08:128`; `OVERENGINEERING-GUARDRAILS.md:30`; `INVENTORY-SCOPE-DECISION.md:28` |
| R10 | Gravar qualquer configuração nova com prefixo `cadastros-auxiliares:` faz o backfill v7 apagá-la após restauração | Baixa | `v7Backfill.js:29,701-705` |
| R11 | Resíduo `sanidade_ids`/`sanidades` na raiz de `pesagens` restauradas de backup v5 (não limpo pelo caminho de restore) | Baixa (plausível, não verificado) | `db.js:33-34` × `v7Backfill.js:578-598` |
| R12 | Varreduras por "sanidade" pegam falso positivo em `verify-packaged-build.mjs:332` | Baixa | — |
| R13 | Nome de módulo `health` ambíguo (diretório vazio residual × integridade do banco) | Baixa | `src/modules/health/application/`; `src/storage/indexedDb/health/health.js` |

---

## 11. Decisões que a ADR-049 precisa fechar

1. Substituir ADR-007 e ADR-022 (e, se houver saldo de produto, parte de ADR-019/DEC-017).
2. Versão do esquema (v8 para sanidade e v9 para comercial, ou v8 conjunta) e encadeamento obrigatório dos backfills.
3. Nomes definitivos das stores e índices (`programasSanidade`, `medicamentos`, `aplicacoesSanidade`), campos mínimos, soft delete, `empresa_id`, vínculos (`animal_id`, `pesagem_id` opcional, `sessao_id`, `lote_id`/`apartacao_id` para aplicação em grupo).
4. O que fazer com dados legados: export v7 (B11), chave retida, backups v5 e pré-migração — importar, converter ou apenas listar no dry-run.
5. Permissões: confirmar mapeamento para ações existentes (seção 8) ou aceitar ação nova.
6. Limites de escopo: carência (informativa ou bloqueante), sugestões por apartação/faixa de peso (existiam na 1.1.11), relatórios mínimos, sem estoque.
7. Revisão dos gates listados na seção 4 e atualização de `docs/user/GUIA-RAPIDO.md:23` e dos documentos da seção 5.1.
