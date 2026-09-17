# CURRENT-IMPORT-EXPORT-CONTRACT — Contrato atual de importação e exportação

**Pré-voo da reconciliação operacional · 17/09/2026 · branch `program/sanity-launch-import` @ `d44d5b9` (árvore limpa) · app 1.2.0 · Dexie v7**

Documento de evidência **somente leitura**. Nada foi implementado. A fonte da verdade é o código lido nesta data; toda afirmação importante cita `arquivo:linha`. Quando um documento antigo diverge do código, a divergência está em §10.

Missão que este mapa alimenta (não implementada): (1) Sanidade como stores Dexie próprias integradas ao Lançamento; (2) Lançamento preservando o contexto após salvar; (3) nova Importação (assistente, mapeamento, dry-run, conciliação Cadastro+Manejos, cronologia, retroativos, idempotência, categoria automática só no Cadastro, Saídas em fluxo próprio) e nova Exportação (contrato de colunas, CSV amigável × CSV para reimportação); (4) importação que reconstrói a série e recalcula peso anterior/data anterior/dias/ganho/GMD com as **mesmas** funções canônicas do lançamento.

---

## 0. Resumo executivo (fatos que decidem o desenho)

1. **Existem só duas importações de dados operacionais e uma restauração**: IMP-1 CSV da Relação de Pesagens (`src/pages/PesagensIndividuais.jsx:347-588`), IMP-2 JSON de pesagens na Manutenção (`src/storage/indexedDb/backup/backupService.js:310-355`) e IMP-3 restauração de backup completo (`backupService.js:213-263`). **Não existe** importação de cadastros mestres, animais, identificadores, sanidade, saídas em fluxo próprio nem XLSX.
2. **IMP-1 e IMP-2 usam o mesmo motor**: `weighingService.bulkCreateEntries` (`src/modules/weighing/application/weighingService.js:105-115`) → `weighingDataAdapter.bulkCreateEntries` (`src/modules/weighing/infrastructure/weighingDataAdapter.js:442-666`), numa transação Dexie. O recálculo da série (`recalculateAllWeightSeries`, `weighingService.js:113`) roda **fora** dessa transação e sobre **todas** as pesagens da base.
3. **O tipo do evento é escolhido por arquivo, não por linha** (`PesagensIndividuais.jsx:153`, `:556-559`, diálogo `:1337-1347`). Um arquivo com Cadastro + Manejos do mesmo animal não pode ser importado como histórico: o segundo evento do tipo Cadastro aborta o lote inteiro (`weighingDataAdapter.js:580-582`).
4. **Ganho/GMD nunca vêm da planilha**: as colunas derivadas são lidas como `null` (`PesagensIndividuais.jsx:408-414`) e a base toda é recalculada pelas funções canônicas `recalculateWeightSeries` (`src/modules/weighing/domain/weighingSeries.js:10-46`) e `calculateWeightGain` (`src/modules/weighing/domain/weighingCalculations.js:13-35`), as mesmas do Lançamento (`weighingService.js:63-69`).
5. **Na importação, a identidade do animal é o texto `NÚMERO::MARCA`** (trim + maiúsculas; `weighingDataAdapter.js:36`, `:453`, `:512-523`), não o par `marca_id` + `valor_normalizado` do modelo v7 (índice existe em `src/storage/indexedDb/schema.js:62`, mas não é usado aqui). Consequências: marca em branco não casa com o animal existente; todas as linhas `SN` da mesma marca viram **um único animal**; um brinco reaproveitado casa com o último animal indexado, mesmo que já tenha saído.
6. **Idempotência só por hash do arquivo** (`importacoes.arquivo_hash` único, `schema.js:67`; checagem em `weighingDataAdapter.js:457-462`). Não há chave por linha: a coluna `ID` do CSV é mapeada (`PesagensIndividuais.jsx:370`) e **nunca usada**; toda linha recebe UUID novo (`weighingDataAdapter.js:479`). Um mesmo Manejo importado em dois arquivos diferentes vira duplicata.
7. **São 13 pontos de exportação** (§5): 6 formatos CSV diferentes, 5 saídas JSON (backup do dia, pesagens, backup completo, pré-migração e sanidade legada), cópia para a área de transferência e o módulo de relatórios pausado. **Nenhuma tela operacional usa o CSV canônico** do reporting (`src/modules/reporting/infrastructure/exporters/csvExporter.js`). Só o CSV da Relação tem cabeçalhos aceitos pela importação, e mesmo ele perde Tipo e Motivo, não escapa `;` nem quebras de linha e grava `--/--/----` quando a data anterior falta.
8. **A permissão de exportação nas telas só existe na UI** (`reports.export`); não há serviço de exportação operacional. A importação CSV é verificada também no serviço (`weighing.write`, `weighingService.js:106`). A exportação e a importação da Manutenção são verificadas no serviço (`maintenance.backup`, `src/modules/maintenance/application/maintenanceService.js:46-64`).

---

## 1. Escopo e método

- Termos pesquisados em `src/**` e `electron/**`: `Blob`, `createObjectURL`, `download`, `csv/CSV`, `export/Export/exportar/Exportar`, `import/importar/Importar`, `JSON.stringify`, `writeUserFile`, `saveFile`, `readFile`, `FileReader`, `parse`, `delimiter`, `BOM`, `﻿`, `bulkCreateEntries`, `dryRun`, `importacoes`, `bulkAdd/bulkCreate`, `clipboard`, `showOpenDialog/showSaveDialog`, `will-download`.
- Lidos por inteiro: `PesagensIndividuais.jsx`, `ManutencaoSistema.jsx`, `FechamentoDia.jsx`, `FichaAnimal.jsx`, trechos de exportação e salvamento de `LancamentoPesagensIndividuais.jsx` (`:1-130`, `:400-680`, `:779-1100`, `:1178-1272`, `:2255-2284`), `weighingService.js`, `weighingDataAdapter.js`, `weighingMapper.js`, `weighingSeries.js`, `weighingCalculations.js`, `csvParser.js`, `brazilianValues.js`, `snAnimal.js`, `importLotSelection.js`, `importRegistryResolution.js`, `catalogResolver.js` (application e domain), `normalize.js` (catalog e storage), `backupService.js`, `maintenanceDataAdapter.js`, `maintenanceService.js`, `schema.js`, `db.js`, `repositories/index.js`, `storageAdapter.js`, `eventSource.js`, `eventRows.js`, `eventColumns.js`, `relationPopulation.js`, `reportFormatting.js`, `formatNumber.js`, `categorySuggestion.js`, `closingPendencies.js`, `operationalPolicies.js`, `permissionService.js`, `Layout.jsx`, `electron/main.cjs`, `preload.cjs`, `ipc/dialogIpc.cjs`, `ipc/reportIpc.cjs`, `reportExportService.js`, `csvExporter.js`, `preMigrationBackup.js` e o trecho B11 de `v7Backfill.js`.
- Gates lidos: `verify-import-selection.mjs`, `verify-enterprise-hardening.mjs`, `verify-dexie-import-restore.mjs`, `verify-dexie-backup.mjs` (`:56-64`), `verify-weighing-access.mjs` (`:25-45`, `:85-105`), `verify-operational-customization.mjs` (`:236-262`), `verify-ui-consistency.mjs:79`, `verify-maintenance-ui-contract.mjs:30-31`.
- Nenhum servidor, build ou gate foi executado. Git só em leitura (`rev-parse`, `status`).

---

## 2. Inventário (mapa rápido)

| ID | Operação | Onde (tela/acionador) | Função de entrada | Formato | Canal | Permissão UI / serviço | Reimportável no app? |
|---|---|---|---|---|---|---|---|
| **IMP-1** | Importar CSV | Relação de Pesagens › Mais opções › "Importar CSV" (`PesagensIndividuais.jsx:884`) | `handleFileUpload` `:347` → `confirmarVinculacaoLotes` `:501` → `confirmarImportacao` `:534` | CSV (`;`, TAB ou `,`) | `<input type="file" accept=".csv,.txt">` `:889` + `FileReader` `:351` | `weighing.write` `:165` / `weighing.write` `weighingService.js:106`; criar marca/raça: `registry.write` `:160` | — |
| **IMP-2** | Importar JSON de pesagens | Manutenção › Importação › "Selecionar JSON e analisar" (`ManutencaoSistema.jsx:563`) | `onSelectImport` `:187` → `applyImportConfirmed` `:211` | JSON `{entries:[...]}` ou `{PesagemIndividual:[...]}` | IPC `dialog:select-import-json` (`electron/ipc/dialogIpc.cjs:29-55`) | rota `maintenance.backup` (`Layout.jsx:152`) / `maintenance.backup` (`maintenanceService.js:56-64`) + `weighing.write` | — |
| **IMP-3** | Restaurar backup | Manutenção › Restauração (`ManutencaoSistema.jsx:585-627`) | `onSelectRestore` `:229` → `applyRestoreConfirmed` `:254` | JSON de backup, formatos 1–3 | IPC `dialog:select-import-json` | `maintenance.restore` (só ADMIN) em `:585` / `maintenanceService.js:66-74` | — |
| **EXP-1** | Exportar CSV da Relação | Relação › Mais opções › "Exportar CSV" (`:882`) | `exportarCSV` `:720-750` | CSV `;`, BOM, LF | Blob + `<a download>` | `reports.export` `:166` / nenhuma | **Parcial** (IMP-1) |
| **EXP-2** | Baixar modelo CSV | Relação › Mais opções › "Baixar modelo CSV" (`:885`) | `baixarModelo` `:703-718` | CSV `;`, BOM, LF | Blob | `weighing.write` / nenhuma | Sim (é o modelo da IMP-1) |
| **EXP-3** | "Exportar" do rodapé do Lançamento | `PesagensResumoRodape.jsx:104-106` | `exportarExcel` (`LancamentoPesagensIndividuais.jsx:1178-1272`) | CSV `;`, BOM, LF (o nome diz "Excel") | Blob | `reports.export` `:2267` / nenhuma | Não |
| **EXP-4** | Exportar CSV do Fechamento | Fechamento do Dia (`FechamentoDia.jsx:186`) | `exportCsv` `:126-131` | CSV `;`, BOM, LF, células entre aspas | Blob | rota `session.close` (`Layout.jsx:45`) / nenhuma | Parcial |
| **EXP-5** | Backup do dia | Fechamento do Dia (`FechamentoDia.jsx:188`) | `backupDay` `:133-136` | JSON | Blob | rota `session.close` / nenhuma | Sim, estruturalmente, pela IMP-2 |
| **EXP-6** | Exportar histórico da Ficha | Ficha do Animal (`FichaAnimal.jsx:162`) | `exportHistory` `:141-146` | CSV `;`, BOM, LF, aspas | Blob | `reports.export` `:162` / nenhuma | Não |
| **EXP-7** | Exportar pesagens em CSV | Manutenção › Exportação (`ManutencaoSistema.jsx:549-551`) | `exportWeighingCsv` (`maintenanceDataAdapter.js:75-79`) → `exportPesagensCsv` (`backupService.js:97-104`) | CSV `,`, BOM, LF | IPC `app:writeUserFile` → `data/exports` | rota `maintenance.backup` / `maintenanceService.js:51-54` | Não |
| **EXP-8** | Exportar pesagens em JSON | Manutenção › Exportação (`:552-554`) | `exportWeighingJson` (`maintenanceDataAdapter.js:80-84`) → `exportPesagensJson` (`backupService.js:107-121`) | JSON | IPC `app:writeUserFile` → `data/exports` | idem / `maintenanceService.js:46-49` | Sim (IMP-2) |
| **EXP-9** | Backup completo (manual e automático antes de importar, restaurar, limpar e resetar) | Manutenção › Backup (`ManutencaoSistema.jsx:521-526`); automáticos em `maintenanceDataAdapter.js:113,129,152,158` | `persistFullBackup` (`maintenanceDataAdapter.js:40-54`) → `createFullBackup` (`backupService.js:85-88`) | JSON formato 3 + SHA-256 | IPC `app:writeUserFile` → `data/backups` | `maintenance.backup` / `maintenanceService.js:36-44` | Sim (IMP-3) |
| **EXP-10** | Backup pré-migração | automático (migração) | `createPreMigrationBackup` (`src/storage/migrations/preMigrationBackup.js:42-97`) | JSON (formato da versão de origem) | IPC → `data/backups` | sistema | Sim (IMP-3) |
| **EXP-11** | Exportação da sanidade legada (ADR-022) | automático, backfill v7, passo B11 | `exportSanidade` (`src/storage/migrations/v7Backfill.js:667-682`) | JSON | IPC → `data/exports` | sistema | **Não** (não há importador) |
| **EXP-12** | Copiar diagnóstico | Manutenção › Diagnóstico (`ManutencaoSistema.jsx:704`) | `copyDiag` `:321-358` | texto | `navigator.clipboard` | rota | n/a |
| **EXP-13** | Relatórios (**módulo pausado — só citação**) | Relatórios | `emitReport` (`reportExportService.js:138-152`), `reportPrintService.js:81-95` | CSV/JSON/XLSX/PDF + manifesto | IPC `writeUserFile` (`relatorios/`) e `reports:save-file` / `reports:print-to-pdf` | `reports.export` verificado no serviço (`reportExportService.js:85`) | Não (cabeçalhos `Peso (kg)` e prefixos `tipo_linha;...`) |

Observações:
- "Criar backup do banco" e "Criar backup completo" executam o **mesmo** código (`maintenanceDataAdapter.js:65-73`).
- Cadastros mestres (`src/components/cadastros/CadastroAuxiliarPage.jsx`; `src/pages/Marcas.jsx`, `Racas.jsx` etc. são invólucros de 10 linhas) **não têm** importação nem exportação: o único uso de `JSON.stringify` ali é a preferência de colunas em `localStorage` (`CadastroAuxiliarPage.jsx:354-355`). `Configuracoes.jsx:392` só remete à Manutenção.

---

## 3. Infraestrutura compartilhada

### 3.1 Canais de arquivo

| Canal | Onde | Comportamento | Rastreabilidade |
|---|---|---|---|
| `Blob` + `<a download>` | `PesagensIndividuais.jsx:710-716`, `:743-749`; `LancamentoPesagensIndividuais.jsx:1264-1270`; `FechamentoDia.jsx:24-31`; `FichaAnimal.jsx:18-25`; fallback do navegador em `reportExportService.js:127-134` | Não existe handler `will-download`/`setSavePath` em `electron/` (grep sem ocorrência). O destino segue o comportamento padrão de download do Electron. `URL.revokeObjectURL` é chamado logo após `click()` | Nenhuma: sem caminho, tamanho, SHA-256, `backupHistory` ou `auditoria` |
| IPC `app:writeUserFile` | `electron/main.cjs:123-144`; preload `electron/preload.cjs:12` | Grava texto UTF-8 em `<userData>/data/<subdir>` (em dev, `<repo>/data`, `main.cjs:24-25`). O subdir é saneado com `[^a-zA-Z0-9_-]` (`:118-121`) e o nome reduzido a `basename`. Grava em `.tmp`, faz fsync e rename, relê e devolve `{ok,path,size,sha256}` (`:128-143`). O usuário não escolhe a pasta | Caminho, tamanho e SHA-256 voltam para quem chamou; `persistFullBackup` registra `backupHistory 'full-durable'` (`maintenanceDataAdapter.js:43-52`); EXP-7 e EXP-8 **não** registram histórico |
| IPC `app:listUserFiles` | `main.cjs:146-159` | Lista `data/<subdir>`; usado só para listar backups (`maintenanceDataAdapter.js:97-101`) | — |
| IPC `dialog:select-import-json` | `dialogIpc.cjs:29-55`; preload `:23` | `showOpenDialog` com filtro `.json`; o main lê com `fs.readFileSync(...,'utf8')` e faz `JSON.parse`; devolve `{canceled,fileName,payload}` com o objeto já parseado, **sem limite de tamanho**. Serve à IMP-2 e à IMP-3 | O nome do arquivo volta, mas a IMP-2 não o repassa ao registro (`ManutencaoSistema.jsx:216`; `backupService.js:348`) |
| IPC `dialog:select-export-directory` | `dialogIpc.cjs:57-74`; preload `:24` | Exposto e **sem uso** em `src/` (grep) | — |
| IPC `reports:save-file`, `reports:print-to-pdf`, `reports:print` | `electron/ipc/reportIpc.cjs:109-141` | Diálogo nativo; extensões `.csv/.json/.xlsx/.pdf` (`:20-25`); texto em `args.text`, binário em `args.base64` (`:132-134`) | SHA-256 devolvido; usados só pelos relatórios |
| `openDataFolder` | preload `:10`; `src/api/db.js:88` | Exposto e **sem botão** na UI (grep em `.jsx` sem ocorrência) | — |
| Leitura de CSV | `PesagensIndividuais.jsx:351`, `:497` | `FileReader.readAsText(file, 'UTF-8')`: **sem detecção de codificação**. Um CSV salvo pelo Excel pt-BR em ANSI (Windows-1252) chega com os acentos corrompidos | — |

### 3.2 Parsers e normalizadores

| Função | Local | Contrato atual |
|---|---|---|
| `detectCsvDelimiter` | `src/modules/weighing/domain/csvParser.js:1-21` | Candidatos `;`, TAB e `,` (`:2`); conta só na primeira linha, fora de aspas (`:3-14`); em empate vence o primeiro candidato (`;`) |
| `parseCsv` | `csvParser.js:23-59` | Remove BOM (`:24`); aspas só abrem campo no início (`:43`); `""` é escape; aceita quebra de linha dentro de aspas; aplica `trim()` em todo campo (`:45`, `:49`); **descarta linhas totalmente vazias** (`:51`, `:57`); aspas não fechadas lançam erro (`:55`). Como as linhas vazias somem e um campo com quebra de linha ocupa duas linhas físicas, o "Linha N" das mensagens (`PesagensIndividuais.jsx:396`) é o índice da linha parseada, **não a linha física do arquivo** |
| `parseCsv` (segunda implementação) | `reporting/infrastructure/exporters/csvExporter.js:39-55` | Parser mínimo para gates, só `;`, sem trim |
| `parseBrazilianNumber` | `src/modules/weighing/domain/brazilianValues.js:4-34` | `1.234,56`, `1,234.56` e `206,5` funcionam. Um único ponto seguido de 1–2 casas é decimal; com 3 casas é milhar (`1.625` → **1625**, `:25-28`). Texto com unidade (`206 kg`) → `null` (`:12`) |
| `parseCivilDate` | `brazilianValues.js:42-61` | `YYYY-MM-DD` ou `D/M/YYYY` (ano de 4 dígitos entre 1900 e 2200), valida o dia do mês e devolve ISO. `dd/mm/aa` e serial do Excel → `null` |
| `isFutureCivilDate` | `brazilianValues.js:63-68` | Usada em `validateUiPayload` (`weighingMapper.js:67-69`) e no Lançamento (`LancamentoPesagensIndividuais.jsx:800`); **não** é usada no parse do CSV |
| `normalizeAnimalIdentifier` / `isSnIdentifier` | `src/modules/animals/domain/snAnimal.js:3-4` / `:1` | `toLocaleUpperCase('pt-BR')` / `/^SN\s*\d*$/i` |
| `sha256Hex` | `src/lib/sha256.js:1-5` | SHA-256 do `TextEncoder` da **string** |
| `normalizeName` (cadastros) | `src/modules/catalog/domain/normalize.js:4-9` ≡ `src/storage/indexedDb/normalize.js:13-15` | trim → maiúsculas pt-BR → espaços únicos; **mantém acentos** |
| `normalized` (identidade na importação) | `weighingDataAdapter.js:36` | `trim().toUpperCase()`; **não** colapsa espaços internos (difere de `normalizeName`) |
| `normalizeAnimalText` / `legacyAnimalKey` | `src/modules/animals/domain/animalHistory.js:1`, `:6-8` | igual a `normalized` |
| `normalizeText` (reporting) | `src/modules/reporting/domain/filterEngine.js:59-65` | remove acentos → minúsculas → espaços únicos → trim. Usada na identidade legada da Relação (`eventRows.js:47-58`, `:91`) |
| Normalização de cabeçalho da IMP-1 | `PesagensIndividuais.jsx:364`, `:367` | minúsculas; remove `_` e espaços; remove acentos |
| `importLotKey` | `src/modules/weighing/domain/importLotSelection.js:1-3` | `trim` + maiúsculas pt-BR de `nome_lote\|nome_apartacao` |

São **cinco normalizações diferentes** para textos de identidade e cadastro. É um risco direto para a conciliação (§8, P-15).

### 3.3 Formatadores usados nas exportações

| Função | Local | Saída |
|---|---|---|
| `fmtNum(v)` | `src/components/common/formatNumber.js:11-21` | pt-BR com milhar `.`; inteiro **sem casas** (`1.234`); fracionário com **2 casas** (`1.234,50`, com arredondamento); ausente → `-` |
| `fmtNum(v, 3)` | idem | 3 casas fixas |
| `fmtInt` | `:23-26` | truncado, com milhar `.`; ausente → `-` |
| `fmtCurrency` | `:32-42` | `R$ 1.234,56` (o `Intl` costuma inserir espaço não separável U+00A0) |
| `fmtDateBR(v)` | `:44-64` | `dd/mm/aaaa`; ausente → **`--/--/----`** (fallback `:44`) |
| `Intl.NumberFormat` locais | `FechamentoDia.jsx:14-16`; `FichaAnimal.jsx:10-12` | `nf` 2 casas fixas, `n3` 3 casas, `ni` inteiro |
| `dateBr` locais | `FechamentoDia.jsx:17`; `FichaAnimal.jsx:13` | `split('-').reverse().join('/')`; ausente → `—` |
| `formatCell` (canônico do reporting) | `src/modules/reporting/domain/reportFormatting.js:62-97` | Tela: peso com 2 casas fixas, GMD 3, moeda BRL, ausente `—`. CSV: sem milhar, vírgula decimal, ausente vazio. **Usado pela tabela da Relação** (`PesagensIndividuais.jsx:1030`), **não** pelo CSV da Relação |

### 3.4 Stores de rastreabilidade envolvidas

| Store | Esquema | Quem grava | Quem lê |
|---|---|---|---|
| `importacoes` | `'++localId, &id, &arquivo_hash, status, created_at, updated_at'` (`schema.js:67`) | Só `weighingDataAdapter.bulkCreateEntries` (`:465-473`, `:652-661`), campos `{id, arquivo_hash, arquivo_nome, arquivo_tamanho, origem:'csv'\|'json', status:'CONCLUIDA', linhas_total, registros_criados, animais_criados, movimentos_criados, created_at, updated_at, deleted_at}` | Só a checagem de hash (`:457-462`). Repositório exposto (`storageAdapter.js:49`), **nenhuma tela** lista o histórico. **Sem** `usuario_id`, `empresa_id`, tipo do manejo, linhas rejeitadas ou relatório. Não é store protegida: "Limpar dados operacionais" a apaga (`backupService.js:272-276`; `schema.js:98-110`) |
| `auditoria` | `schema.js:66` | Um `CRIAR` por pesagem importada, com `depois: entry` (`weighingDataAdapter.js:637`) + `usuario_id/usuario_nome_snapshot` (`src/storage/indexedDb/auditActor.js:33-40`) | Não há auditoria para animais, identificadores, sessões, movimentos, `animalLotes` e marcas/raças criados **dentro** do adapter, nem para o próprio registro de `importacoes`. O recálculo roda com `audit:false` (`weighingService.js:181-185`) |
| `backupHistory` | `schema.js:69` | `full-durable` (EXP-9), `import` (só IMP-2, `backupService.js:353`), `restore`, `backfill-v7`, `clear-operational`, `reset-all` | Manutenção (indiretamente) |

### 3.5 Permissões relevantes

Matriz (`src/modules/auth/domain/permissionService.js:18-48`), na ordem ADMIN / GESTOR / OPERADOR / CONSULTA:
- `weighing.read` ✔✔✔✔ · `weighing.write` ✔✔✔✘ · `launch.use` ✔✔✔✘ · `animal.read` ✔✔✔✔
- `registry.write` ✔✔✘✘ · `commercial.values` ✔✔✘✘ · `commercial.write` ✔✔✘✘
- `session.close` ✔✔✘✘ · `reports.export` ✔✔✘✔ · `maintenance.backup` ✔✔✘✘ · `maintenance.restore` ✔✘✘✘

Rotas (`src/Layout.jsx`): Lançamento `launch.use` (`:27`), Relação `weighing.read` (`:36`), Fechamento `session.close` (`:45`), Ficha `animal.read` (`:54`), Relatórios `reports.read` (`:63`), Manutenção `maintenance.backup` (`:152`), aplicadas por `RequirePermission` (`:162`).

Consequências: OPERADOR **importa** CSV e **não exporta** nada. CONSULTA **exporta** o CSV da Relação e a Ficha, mas não importa. O Fechamento exporta sem verificar `reports.export`; hoje isso é coberto só porque a rota exige `session.close` (ADMIN/GESTOR).

---

## 4. Importações

### 4.1 IMP-1 — CSV da Relação de Pesagens

#### 4.1.1 Entrada e fluxo

1. Menu "Mais opções" (`PesagensIndividuais.jsx:880-888`) → `<input type="file" accept=".csv,.txt">` (`:889`).
2. `handleFileUpload` (`:347-499`): `FileReader.readAsText(file,'UTF-8')` (`:497`). Calcula `sha256Hex(text)` sobre a **string decodificada**, não sobre os bytes (`:355`), e grava `importFileInfo = {id: randomUUID, name, size, hash, origin:'csv'}` (`:356`). Chama `parseCsv(text)` (`:357`); com menos de 2 linhas, mostra "Arquivo vazio" (`:359-362`).
3. Mapeia cabeçalhos (§4.1.2), converte e valida cada linha (§4.1.3), resolve marca/raça (§4.1.6) e procura lotes pelo nome (§4.1.7).
4. Se houver lotes existentes, abre "Lotes Encontrados no Sistema" (`:1240-1318`) → `confirmarVinculacaoLotes` (`:501-513`); senão abre o diálogo de importação (`:1321-1547`).
5. No diálogo, o usuário escolhe **Tipo de Movimentação** (`:1337-1347`), **Motivo da Saída** (obrigatório se Saída, `:1353-1365`, `:1540`) e **Destino da Venda** (só Venda, `:1368-1378`), e pode marcar "Criar estes cadastros ao importar" (`:1437-1446`).
6. `confirmarImportacao` (`:534-588`): cria os cadastros desconhecidos, se pedido (`:550-552`, `:520-532`); monta `registros` (`:553-560`); chama `weighingService.bulkCreateEntries(registros, {importMetadata: {...importFileInfo, totalRows, operador:'LOCAL'}})` (`:562-564`); em seguida invalida `pesagens-individuais` (`:581`).

#### 4.1.2 Cabeçalhos aceitos (aliases)

Normalização: `h.trim().toLowerCase()` e depois `normalizar` (remove `_`/espaços, remove acentos) (`:364`, `:367`). Vale o primeiro cabeçalho que casar (`findIndex`).

| Campo interno | Cabeçalhos aceitos (depois de normalizar) | Linha | Uso |
|---|---|---|---|
| `id_sistema` | `id` | `:370` | **Mapeado e nunca lido** |
| `id_externo` | `idexterno` (`ID_Externo`, `Id Externo`) | `:371` | Texto cru → `legacy_payload.id_externo` (sem unicidade) |
| `data` | `data` | `:372` | `parseCivilDate` → `data_pesagem`. `Data Pesagem`/`data_pesagem` **não** casam |
| `numero_animal` | `numeroanimal`, `animal` | `:373` | `normalizeAnimalIdentifier`. `Identificação`, `Brinco`, `Nº`, `Número do Animal` **não** casam |
| `sexo` | `sexo` | `:374` | `?.toUpperCase()` **sem validação** (`Macho` → `MACHO`) |
| `raca` | `raca` (o segundo teste, `'raça'`, nunca casa porque os acentos já foram removidos) | `:375` | Texto → resolução de `raca_id` |
| `era` | `era` | `:376` | Texto livre |
| `marca` | `marca` | `:377` | Texto → resolução de `marca_id` e identidade |
| `peso` | `peso` | `:378` | `parseBrazilianNumber`. `Peso (kg)` **não** casa |
| `nome_lote` | `lote`, `nomelote` | `:379` | Texto; vínculo opcional |
| `nome_apartacao` | `apartacao`, `nomeapartacao` | `:380` | Texto; vínculo opcional |
| `observacao` | `observacao`, `obs` | `:381` | Texto |
| `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | `dataanterior`, `pesoanterior`, `dias`, `ganho`, `gmd` | `:382-386` | **Mapeados e descartados**: o registro recebe `null` (`:408-414`) |

Não são lidos: Tipo, Motivo, Causa da morte, Categoria, valores comerciais, comprador, destino, rendimento, embarque/documento, sessão, `marca_id`/`raca_id` explícitos, `animal_id`. Se um cabeçalho obrigatório faltar, **não há erro de cabeçalho**: cada linha falha individualmente ("Número do animal não informado" etc.).

#### 4.1.3 Validação por linha (antes de gravar)

| Regra | Linha | Efeito |
|---|---|---|
| `numero_animal` vazio | `:418-421` | erro "Número do animal não informado" |
| `peso` não finito ou ≤ 0 | `:422-425` | erro. **Vale também para Saída por Morte/Doação/Transferência**, em que o serviço aceita peso ausente (`weighingMapper.js:58-59`) e o Lançamento também (`LancamentoPesagensIndividuais.jsx:809-814`) |
| `data_pesagem` inválida | `:426-429` | erro "Data inválida" |
| SN | `:431-439` | zera os derivados, que já eram `null` (sem efeito prático) |
| Data futura | **não** verificada aqui | a checagem acontece no serviço (`weighingMapper.js:67-69`) e **aborta o lote inteiro**, sem número de linha |
| Sexo, era, marca, raça | — | sem validação de domínio |

Erros aparecem por linha; o diálogo mostra só os **10 primeiros** (`:1461-1468`). Não há exportação do relatório de erros.

#### 4.1.4 Decisão de tipo (Cadastro/Manejo/Saída)

- **Um tipo para o arquivo inteiro**: `tipo_manejo: tipoManejoImport` em todos os registros (`:556`); `motivo_saida` e `destino_venda` também são globais (`:557`, `:559`). `status_animal` é preenchido (`:558`), mas é chave proibida e sai no mapper (`weighingMapper.js:23-25`, `:30-36`).
- Textos de ajuda do diálogo (`:1385-1391`): "Cadastro: ATIVOS (não calcula ganho)", "Saída: INATIVOS", "Manejo: cálculo de ganho".
- Na prática: histórico de Cadastro + Manejos exige **dois arquivos**; uma Saída exige um terceiro arquivo por motivo.

#### 4.1.5 Identificação do animal

Tudo acontece no adapter (`weighingDataAdapter.js:508-574`); a página não envia `animal_id`.

1. Índice `identifierByIdentity`:
   - identificadores ativos: `VISUAL` com `marca_id` → `NUM::NOME_DA_MARCA` (nome atual do cadastro, ou texto legado); outros → `valor_normalizado` (`:512-520`);
   - depois, **todos** os animais não excluídos → `NUM::animal.marca` (texto snapshot), sobrescrevendo entradas (`:521-523`). Não filtra `situacao`: em identidade repetida, **vence o último** (inclusive animal vendido ou morto).
2. Chave da linha: `NUM::MARCA` do texto do CSV (`:453`, `:553`).
3. `animalId = payload.animal_id || ui.animal_id || identifierByIdentity.get(key)` (`:554`). Se não achar, **cria o animal** (`:556-574`) com `origem:'importacao'`, `situacao` ATIVO (ou derivada do motivo, se Saída), `marca_id` pela **resolução de texto do adapter** (ignora o `marca_id` da página; marca vazia → marca com `padrao===true` no store, `:492`, `:558`), `raca_id` por texto, `propriedade_id` = propriedade `padrao` (`:493`), `categoria_automatica: true` (`:132`) e um identificador `VISUAL` (`:573`).
4. **Qualquer tipo** cria animal quando não há casamento, inclusive Manejo e Saída. Com isso nascem animais sem evento Cadastro e sem movimento "Entrada" (`:617`).

Efeitos no modelo novo:
- Marca vazia no CSV → chave `NUM::` → não casa com o animal existente que tem marca → **animal duplicado** com a marca padrão, enquanto o evento fica com `marca`/`marca_id` nulos.
- Marca renomeada no cadastro → o texto antigo não resolve na página (linha rejeitada), mas continuaria casando pela chave do texto snapshot `animal.marca`.
- `SN` sem número: todas as linhas `SN` da mesma marca caem na chave `SN::MARCA` e viram **um animal** com série e GMD calculados entre animais diferentes. No Lançamento, cada SN ganha `animal_id` novo (`LancamentoPesagensIndividuais.jsx:956`). Com tipo Cadastro, a segunda linha `SN` aborta o lote ("já possui cadastro").
- Espaços internos diferentes (`"12  A"` × `"12 A"`) geram chaves diferentes (`normalized` não colapsa espaços).

#### 4.1.6 Marca e raça (cadastros mestres)

- Dry-run na página: `resolveMany(collectRegistryTexts(dados), {empresaId})` (`PesagensIndividuais.jsx:447`; `catalog/application/catalogResolver.js:21-37`) resolve por `nome_normalizado`, inclusive cadastros inativos e exceto os excluídos (`catalog/domain/catalogResolver.js:17-25`).
- `splitImportRowsByRegistry(dados, resolucao, {criarDesconhecidos:false})` (`:448`; `src/modules/operations/domain/importRegistryResolution.js:57-98`) grava `marca_id`/`raca_id` nas linhas elegíveis (texto vazio → `null`) e **rejeita** as linhas com texto desconhecido, com erro nomeado (`:85-92`).
- Opção explícita "Criar estes cadastros ao importar" (`PesagensIndividuais.jsx:1437-1449`), com `registry.write` na UI (`:160`, `:521`, `:539`) e no serviço (`masterRegistryService.js:267-268`). Cria via `brandService.create`/`breedService.create` (`:525-526`), com auditoria (`masterRegistryService.js:209-222`, `:284`), e depois resolve de novo (`:527-531`).
- ⚠ Essa criação acontece **antes** e **fora** da transação da importação (cada `create` tem transação própria, `masterRegistryService.js:233`). Se a importação falhar depois (por exemplo, por cronologia), **as marcas e raças criadas permanecem**.
- ⚠ O adapter tem outro resolvedor, `resolveInBatch` (`weighingDataAdapter.js:496-506`), usado para animais novos. Ele **cria marca/raça em silêncio**, sem `registry.write` e sem auditoria (`:640-641`), quando o texto não existe. Na IMP-1 isso fica protegido pelo filtro da página; na IMP-2 **não há filtro** (§4.2).

#### 4.1.7 Lote e apartação

- Busca por nome exige `nome_lote` **e** `nome_apartacao` (`PesagensIndividuais.jsx:454`); casa apartação e lote com `toUpperCase()` exato (`:461-467`) sobre as queries `apartacoes`/`lotes` (`:191-205`). Se as queries ainda não carregaram, nenhum lote é encontrado.
- A chave de agrupamento usa o texto cru (`:454`) e a seleção usa `importLotKey` normalizado. Grafias diferentes do mesmo lote geram duas linhas no diálogo com a mesma chave React.
- `applyImportLotSelection` (`importLotSelection.js:6-17`): lote marcado → linha recebe `lote_id` e `apartacao_id`; lote existente **desmarcado → linha removida da importação** (`:11`; aviso `PesagensIndividuais.jsx:1253`); lote sem cadastro → linha segue **só com o texto** (sem `lote_id`), gerando lote órfão para relatórios e pendências.
- Não há lote automático por faixa de peso (no Lançamento: `getLoteAutomatico`, `LancamentoPesagensIndividuais.jsx:779`, `:935-943`), nem checagem de lote fechado ou capacidade.
- Projeção: `animalLotes` abre e fecha por evento (`weighingDataAdapter.js:616-631`); movimento "Mudança de lote" só quando já havia lote atual (`:630`).

#### 4.1.8 Ordenação e cronologia

- O adapter ordena os payloads por `data_pesagem` e depois por `id` (`weighingDataAdapter.js:550`). Como os ids são UUIDs aleatórios (`:479`), a **ordem entre eventos da mesma data é arbitrária**.
- Estado cronológico por animal a partir da base (`:529-539`) e atualizado linha a linha (`:592-595`). Regras (`:580-591`):
  - Cadastro com cadastro já existente → **aborta**;
  - não-Cadastro com data anterior ao cadastro → **aborta**;
  - evento com data ≥ saída → **aborta**;
  - Saída com evento posterior → **aborta**.
- Qualquer violação lança exceção e **reverte o lote inteiro** (gate `verify-enterprise-hardening.mjs:101-122`), sem número de linha na mensagem.
- Não são verificados: Cadastro com data **posterior** a Manejos já existentes (a regra `:583` só vale para não-Cadastro), eventos duplicados na mesma data e **dia fechado** (sessão `FECHADA`; ver §4.1.10).
- A cronologia do adapter é uma **segunda implementação**; o Lançamento usa `validateAnimalChronology` (`:165-191`).

#### 4.1.9 Ganho/GMD

- Nunca confia na planilha: `data_anterior`, `peso_anterior`, `dias`, `ganho` e `gmd` saem como `null` (`PesagensIndividuais.jsx:408-414`); a pré-visualização mostra GMD `-` (`:1503`).
- Depois do commit: `recalculateAllWeightSeries()` (`weighingService.js:113`, `:144-146`) → `listEntries()` da base inteira (`:152-153`) → `recalculateWeightSeries(entries, null)` (`weighingSeries.js:10-46`):
  - agrupa por `animal_id` (`id:`) ou pela chave legada `NUM::MARCA` (`:4`);
  - ordena por data, `created_date/created_at` e `id` (`:5-8`);
  - **só `tipo_manejo === 'Manejo'`** recebe derivados via `calculateWeightGain` (`:26-28`); Cadastro e Saída ficam `null`;
  - `calculateWeightGain` (`weighingCalculations.js:13-35`) usa o evento de data **estritamente anterior** com peso finito: `ganho` com 2 casas, `gmd` com 3 casas, `gmd = 0` se `dias ≤ 0`.
- Gravação: `bulkUpdateEntries(updates, {audit:false, origin:'recalculo-automatico', systemDerived:true})` (`weighingService.js:181-185`) **para todas as pesagens da base**, não só as alteradas.
- ⚠ Está fora da transação da importação. Se o recálculo falhar, a importação **já foi gravada** com derivados nulos, mas a tela mostra "Erro ao importar" (`PesagensIndividuais.jsx:582-583`) e deixa o diálogo aberto. Uma nova tentativa esbarra em "Arquivo já importado".
- ⚠ `calculateWeightGain` aceita `peso` `null`/`''` como 0, porque `Number(null)` é finito (`weighingCalculations.js:21`); `recalculateWeightSeries` empurra para o histórico qualquer peso cujo `Number()` seja finito (`weighingSeries.js:42`). A pré-visualização do Lançamento exige peso > 0 (`src/components/pesagens/weightPreview.js:11`).

#### 4.1.10 Sessões, categoria e projeções

- Sessão: reaproveita uma sessão **ABERTA** da data ou cria uma nova `ABERTA` com `operador = importMetadata.operador`, que na IMP-1 é o texto fixo `'LOCAL'` (`PesagensIndividuais.jsx:563`; `weighingDataAdapter.js:525-526`, `:597-602`, `:96-114`). Uma data com sessão `FECHADA` ganha **uma segunda sessão ABERTA**; o Fechamento lê a primeira que encontrar (`FechamentoDia.jsx:77`). Importar para um dia fechado não é bloqueado.
- Categoria: `bulkCreateEntries` **não** chama `stampAutomaticCategory` (chamada só em `createEntry`/`updateEntry`, `:332-334`, `:407-409`). Os eventos importados ficam **sem `categoria_id`** e com a `era` de texto do CSV. A categoria e a era do **animal** são recalculadas pela projeção a partir do último peso (`:234-243`, chamada em `:650`), inclusive para Manejo e Saída.
- Projeção do animal (`rebuildAnimalStateProjection`, `:215-258`) e movimentos (`:632-636`) são refeitos dentro da transação.

#### 4.1.11 Duplicidade e idempotência

| Mecanismo | Onde | Cobertura |
|---|---|---|
| Hash do arquivo | `weighingDataAdapter.js:457-462`; índice único `schema.js:67` | Bloqueia o **mesmo texto** já importado com `CONCLUIDA`, **qualquer que seja o tipo escolhido**. Arquivo re-salvo (outra quebra de linha, outra codificação ou colunas reordenadas) passa |
| Id duplicado no lote / já existente | `:477-484` | Só se `payload.id` vier preenchido; na IMP-1 nunca vem |
| Cadastro duplicado por animal | `:580-582` | Aborta o lote |
| Duplicidade de Manejo (mesmo animal, mesma data) | — | **Nenhuma**. O Lançamento bloqueia (`LancamentoPesagensIndividuais.jsx:868-875`) |
| `id_externo` | — | Não é índice nem é checado |

Se um registro anterior em `importacoes` tiver o mesmo hash e status diferente de `CONCLUIDA` (hoje nenhum fluxo grava outro status), o `importTable.add` violaria o índice único e abortaria com erro técnico.

#### 4.1.12 Dry-run

É só local e parcial: parse, validação de campos, resolução de marca/raça e busca de lotes. **Não simula** identidade (criará animal?), cronologia, duplicidade, sessões nem derivados. O resumo mostra apenas "Registros Válidos" e "Erros" (`PesagensIndividuais.jsx:1398-1419`).

#### 4.1.13 Permissões e auditoria

- UI: menu só com `weighing.write` (`:883`); rota `weighing.read`. Serviço: `requireWeighingPermission('weighing.write')` (`weighingService.js:16-24`, `:106`). Valores comerciais são removidos sem `commercial.write` (`:28-35`); o CSV não os traz.
- `importacoes` recebe `operador` fixo `'LOCAL'` e **nenhum id de usuário** (`PesagensIndividuais.jsx:563`). Os `CRIAR` de `auditoria` levam o ator da sessão (`auditActor.js:33-40`). `created_by_user_id` é o ator (`weighingDataAdapter.js:608`) e `origem: 'importacao'` (`:607`).
- **Não há backup automático** antes da IMP-1 (a IMP-2 exige, §4.2) e **nenhum** registro em `backupHistory`.

#### 4.1.14 Regras do Lançamento que a IMP-1 não aplica

| Regra | Lançamento | IMP-1 |
|---|---|---|
| Marca cadastrada obrigatória no Cadastro | `LancamentoPesagensIndividuais.jsx:849-852` | marca vazia aceita → marca padrão do store |
| Animal escolhido obrigatório em Manejo/Saída | `:853-857` | cria animal novo (`weighingDataAdapter.js:556-574`) |
| Um lançamento por animal por dia | `:868-875` | sem checagem |
| Avisos de peso/variação com justificativa | `:888-893` (`evaluateWeighingWarnings`) | nenhum |
| Rendimento obrigatório em Venda/Abate | `:894-901` | não há campo |
| Causa da morte obrigatória | `:820-823` | não há campo |
| Documento obrigatório (Abate sempre; Venda pela política) | `:826-833` | não verificado → vira pendência "Doc" (`closingPendencies.js:25-27`) que bloqueia o Fechamento |
| Peso opcional em Saída por Morte/Doação/Transferência | `:809-814` | peso sempre obrigatório |
| SN = novo animal a cada lançamento | `:956` | SN do mesmo texto e marca = um animal |
| Categoria gravada no evento | `weighingDataAdapter.js:332-334` | não gravada |
| Lote automático pela faixa de peso da apartação | `:935-943` | só por nome, com confirmação |
| Data futura | `:800-803` (mensagem clara) | erro do serviço sem linha, aborta tudo |
| Padrões da empresa (`marca_padrao_id` configurado) | `operationalPolicies.js:82-108` (`resolveDefaultRegistry`) | adapter usa só `marcas.padrao === true` (`weighingDataAdapter.js:492`); o comentário de `operationalPolicies.js:1` diz que a Relação consome as políticas, mas `PesagensIndividuais.jsx` não as importa |

#### 4.1.15 Gates que cobrem a IMP-1

- `import:selection:verify` (`scripts/verify-import-selection.mjs`, em `test:quick`): `applyImportLotSelection` (`:8-23`), `collectRegistryTexts`/`splitImportRowsByRegistry` (`:27-67`) e regex estáticos sobre a página (`:69-82`).
- `ui:operational-customization:verify` (`verify-operational-customization.mjs:241-257`): mesmas garantias estáticas de "nenhuma criação silenciosa" **na página**. Não cobre `resolveInBatch` do adapter.
- `enterprise:hardening:verify` (`verify-enterprise-hardening.mjs`): `parseCsv` com aspas e quebras (`:32-35`), atomicidade (`:45-52`), idempotência por hash (`:101-107`), cronologia (`:108-122`) e projeção (`:85-100`).
- `auth:weighing-access:verify` (`verify-weighing-access.mjs:37`, `:85-86`): CONSULTA recusado em `bulkCreateEntries`; menu com `podeImportar`.
- `ui:consistency:verify` (`verify-ui-consistency.mjs:79`): ordem dos itens do menu.
- **Nenhum gate** cobre: mapeamento de cabeçalhos, `parseBrazilianNumber` sobre as colunas do CSV exportado (ida e volta), marca vazia, SN, sessão fechada, recálculo pós-importação, falha do recálculo nem ANSI.

### 4.2 IMP-2 — JSON de pesagens (Manutenção)

#### 4.2.1 Fluxo

1. `selectImportJsonFile` (`maintenanceDataAdapter.js:104-108`) → IPC `dialog:select-import-json` (`dialogIpc.cjs:29-55`): objeto parseado + `fileName`.
2. `dryRunImportWeighingJson` (`maintenanceService.js:56-59` → `backupService.js:310-325`).
3. Confirmação (`ManutencaoSistema.jsx:206-209`, `:720-731`) → `applyImportWeighingJson(payload, {skipDuplicates:true})` (`:216-218`; a opção é **ignorada** pela assinatura em `maintenanceDataAdapter.js:112`).
4. `persistFullBackup({reason:'pre-import', automatic:true})` (`maintenanceDataAdapter.js:113`; exige a ponte de arquivos, `:29-31`, logo só no desktop) → `applyImportPesagens(payload, {safetyEvidence})` (`backupService.js:328-355`).

#### 4.2.2 Formatos aceitos

- `payload.entries` (EXP-8 `weighing-entries-export`, e também EXP-5 `daily-weighing-backup`) **ou** `payload.PesagemIndividual` (formato legado Base44) (`backupService.js:312`, `:332`). O campo `type` **não é verificado**.
- Cada entrada: se tiver `legacy_payload` (registro Dexie cru) → `storageRecordToViewModel(entry)`; senão → `{...entry, data_pesagem: entry.data_pesagem || entry.data}` (`:342`).

#### 4.2.3 Dry-run

`{ok, totalRecords, toInsert, duplicates, invalidRecords}` (`:324`):
- inválido = sem `data_pesagem` e sem `data` (`:318`);
- duplicado = `id` já existente na base (**inclusive excluídas logicamente**, porque `toArray()` não filtra `deleted_at`, `:314`) ou repetido no arquivo (`:320`).

Não verifica peso, identidade, cadastros, cronologia, lotes nem sessões. A tela lê `validRecords ?? valid` (`ManutencaoSistema.jsx:570`), mas o dry-run devolve `toInsert`, então **"Válidos" sempre mostra "—"**; "Conflitos" lê `conflicts` (`:573`), que não existe, então sempre mostra **0**.

#### 4.2.4 Identificação, tipo, ordenação, ganho/GMD

- **Tipo por linha**: vem de `tipo_manejo` (legacy) ou `tipo_pesagem` (`weighingMapper.js:131`, `:98`). É a única importação que aceita tipos misturados.
- Identidade: `payload.animal_id` **tem precedência** sobre número+marca (`weighingDataAdapter.js:554`). Se o id de origem não existe no destino, **cria animal com o id de origem**, mesmo que já exista ali um animal com o mesmo número e marca (duplicata física).
- Entradas sem `numero_animal` (como no próprio gate `verify-dexie-import-restore.mjs:29-36`) caem na chave `::` e **viram um único animal sem número**.
- Ordenação e cronologia: as mesmas do adapter (§4.1.8).
- Ganho/GMD: os derivados do arquivo entram no `legacy_payload` (a allowlist inclui `data_anterior...gmd`, `weighingMapper.js:9-10`) e são **sobrescritos** pelo recálculo global (`weighingService.js:113`).
- `created_at` de origem **se perde** (`uiToStorageRecord` não o copia; o adapter usa `payload.created_at || ts`, `:610`); `created_by_user_id` passa a ser o importador; `origem` vira `'importacao'` (`:607`); `sessao_id` é substituído pela sessão da data (`:606-607`).

#### 4.2.5 Problemas no modelo novo

- Ids estrangeiros sem resolução: `marca_id`, `raca_id`, `categoria_id`, `causa_morte_id` (no `legacy_payload`), `lote_id`/`apartacao_id`, `embarque_id`/`documento_embarque_id`. Como os seeds geram ids novos em cada instalação (`src/modules/catalog/domain/seeds.js:1-4`), a importação entre máquinas cria **referências penduradas**: `marca_nome` fica nulo e o agrupamento passa a ser por id inexistente (`eventRows.js:98-103`).
- Para animal novo, o adapter resolve marca e raça pelo **texto** e **cria cadastros em silêncio** (`resolveInBatch`, `weighingDataAdapter.js:496-506`, `:640-641`), sem `registry.write` e sem auditoria. O animal fica com `marca_id` local e o evento com o `marca_id` estrangeiro.
- O payload traz só `pesagens`: animais, identificadores, lotes, apartações, embarques e cadastros não vão junto.

#### 4.2.6 Duplicidade e idempotência, permissões e auditoria

- Pula ids existentes (`backupService.js:340`). Hash = `sha256(JSON.stringify(payload))` sobre o **objeto re-serializado** (`:344-345`): não depende da formatação do arquivo, mas depende da ordem das chaves.
- `importacoes.arquivo_nome` fica sempre `'importacao-pesagens.json'`, porque a tela não repassa `fileName` (`:348`; `ManutencaoSistema.jsx:216`). `operador` = `data?.operador || 'IMPORTACAO'` (`:350`).
- Se todas as entradas forem duplicadas: `bulkCreateEntries([], {hash})` grava `importacoes` com 0 registros (`weighingDataAdapter.js:464-474`) e o recálculo global roda mesmo assim.
- `requireDurableSafetyEvidence` (`backupService.js:174-180`) + `backupHistory 'import'` (`:353`). Permissões: `maintenance.backup` (`maintenanceService.js:61-64`) + `weighing.write` (`weighingService.js:106`). Auditoria: como na IMP-1.
- Gate `storage:import-restore:verify` (`verify-dexie-import-restore.mjs:28-51`; só em `test:full`, via `storage:all:verify`): conta dry-run, exige evidência física e bloqueia o hash repetido. Não verifica identidade, cadastros nem derivados.

### 4.3 IMP-3 — Restauração de backup completo

- `readBackup` (`backupService.js:123-172`): `format`, SHA-256 do conteúdo sem `integrity` (`:130-137`), stores ausentes (aceitas como novas em legado, `:143-148`, `:166-169`), `dbVersion` mais novo recusado (`:149-153`), contagens do manifesto (`:154-160`).
- `applyRestore` (`:213-263`): exige backup físico prévio; em **uma transação**, `clear()` + `bulkAdd` (sem `localId`) em **todas** as stores e confere as contagens (`:217-227`); roda o backfill se o esquema for anterior (`:231-248`); registra `backupHistory 'restore'` (`:250-260`); usuários restaurados encerram a sessão.
- **Não é uma importação conciliada**: substitui o banco inteiro (inclusive `usuarios`, `appSettings`, `importacoes`, `auditoria`). Não recalcula derivados. Stores de sanidade da v5 aparecem como `ignoredStores` (`schema.js:40-44`; `:167`).
- Só ADMIN (`maintenanceService.js:66-74`; `ManutencaoSistema.jsx:585`). Gates: `storage:import-restore:verify` (`:53-122`) e `storage:backup:verify`.

### 4.4 Motor compartilhado — pipeline de `bulkCreateEntries`

| Passo | Local | Observação |
|---|---|---|
| 1. Permissão `weighing.write` | `weighingService.js:106` | falha fechada com provedor e sem sessão (`:22`) |
| 2. Remove campos comerciais sem `commercial.write` | `:107`, `:28-35` | |
| 3. `validateUiPayload` + `uiToStorageRecord` por item | `:108-111`; `weighingMapper.js:51-113` | primeira linha inválida (data futura, peso ≤ 0) **aborta tudo, sem número de linha** |
| 4. `assertWritable` (bloqueio de migração) | `weighingDataAdapter.js:446` | |
| 5. Transação `rw` em 12 stores | `:450-456` | |
| 6. Hash já importado | `:457-462` | |
| 7. Ids (UUID novo quando ausente) | `:477-484` | |
| 8. Mapas de marca/raça, padrões | `:487-506` | cria cadastros em silêncio para animal novo |
| 9. Índice de identidade | `:508-523` | texto NÚMERO::MARCA |
| 10. Sessões abertas, lotes atuais, estado cronológico | `:525-539` | |
| 11. Laço ordenado por data e id | `:550-638` | animal novo, cronologia, sessão, entry (`filterLegacyPayload`), lote, movimento, auditoria |
| 12. `bulkAdd` de tudo | `:640-649` | |
| 13. Projeção de cada animal afetado | `:650` | categoria e era do animal |
| 14. Registro `importacoes` | `:652-662` | |
| 15. **Fora da transação**: `recalculateAllWeightSeries` | `weighingService.js:113` | base inteira; `audit:false` |

---

## 5. Exportações

### 5.1 EXP-1 — CSV da Relação de Pesagens

| Item | Contrato atual |
|---|---|
| Função | `exportarCSV` (`PesagensIndividuais.jsx:720-750`) |
| População | `pesagensFiltradas` (`:298-301`): pesquisa + filtros de coluna + ordenação da tela, **todas as páginas**, a partir de `loadEventRows` (`:279-286`; deduplicado por id em `eventRows.js:12-22`) |
| Colunas (exatas, fixas) | `ID;ID_Externo;Data;NumeroAnimal;Sexo;Raça;Era;Marca;Peso;Lote;Apartação;Observação;DataAnterior;PesoAnterior;Dias;Ganho;GMD` (`:721`). **Ignora** as colunas visíveis e sua ordem |
| Valores | `p.id`, `p.id_externo`, `fmtDateBR(data_pesagem)`, `numero_animal`, `sexo` (`M`/`F`), `raca`, `era`, `marca` (texto snapshot), `fmtNum(peso)`, `nome_lote`, `nome_apartacao`, `observacao`, `fmtDateBR(data_anterior)`, `fmtNum(peso_anterior)`, `fmtInt(dias)`, `fmtNum(ganho)`, `fmtNum(gmd,3)` (`:722-740`) |
| Separador / quebra / BOM | `;` / `\n` (LF) / `﻿` (`:742-743`) |
| Escape | **Nenhum**: `;`, `"` ou quebra de linha em observação, marca, raça, lote etc. deslocam colunas |
| Data | `dd/mm/aaaa`; `DataAnterior` ausente → **`--/--/----`** (fallback de `fmtDateBR`, `formatNumber.js:44`) |
| Decimal | pt-BR **com milhar** (`1.234`); peso inteiro sem casas, fracionário com 2 casas (arredondado); GMD 3 casas; Dias com milhar |
| Nulo | texto `''` via `\|\| ''`; números guardados por `!= null` → `''`; datas → `--/--/----` |
| `[object Object]` | não ocorre (todos os campos são primitivos) |
| Nome / destino | `pesagens_individuais_yyyyMMdd.csv` (`:747`); download por Blob |
| Permissão | UI `reports.export` (`:166`, `:882`); **nenhuma no serviço** |
| Omissões | Tipo, Motivo, causa, categoria, comerciais, embarque/documento, sessão, operador, origem do registro |
| Reimportável | **Parcial**. Os cabeçalhos são os do modelo da IMP-1, mas: `ID` é ignorado (novas pesagens); Tipo e Motivo se perdem (o arquivo inteiro recebe um tipo); texto com `;` quebra a linha; marca/raça renomeadas são rejeitadas; um arquivo com texto idêntico a outro já importado (`CONCLUIDA`) é bloqueado pelo hash, mas qualquer diferença (outro filtro ou outra data de exportação que mude as linhas) passa; importar na mesma base **duplica** Manejos e **aborta** no primeiro Cadastro ou Saída |

### 5.2 EXP-2 — Modelo CSV

| Item | Contrato atual |
|---|---|
| Função | `baixarModelo` (`PesagensIndividuais.jsx:703-718`) |
| Colunas | iguais às da EXP-1 (`:704`) |
| Exemplos | 3 linhas (`:705-707`) com `ID` vazio; `DataAnterior/PesoAnterior/Dias/Ganho/GMD` preenchidos, embora **ignorados** na importação; GMD com **ponto** (`1.625`), que `parseBrazilianNumber` leria como 1625 se fosse usado; a terceira linha tem marca vazia (dispara o problema de §4.1.5) |
| Formato | `;`, LF, BOM, sem escape; `modelo_pesagens_individuais.csv` |
| Permissão | UI `weighing.write` (`:883-886`) |

### 5.3 EXP-3 — "Exportar" do Lançamento (`exportarExcel`)

| Item | Contrato atual |
|---|---|
| Função | `LancamentoPesagensIndividuais.jsx:1178-1272`; botão "Exportar" em `PesagensResumoRodape.jsx:104-106` |
| População | `pesagensDia` (`:577-643`): data da tela + filtros de coluna + ordenação, todas as páginas; fonte `weighingService.listEntries` (`:537`), **sem** a deduplicação e o enriquecimento de `loadEventRows` |
| Colunas | rótulos das colunas **visíveis, na ordem atual**, exceto `acoes` (`:1180-1181`), a partir de `COLUNAS_DISPONIVEIS` (`:416-449`), filtradas por `commercial.values` (`:452`, `:504-507`). Rótulos possíveis: `Nº`, `Tipo`, `Motivo Saída`, `Identificação`, `Peso`, `Data`, `Sexo`, `Raça`, `Era`, `Marca`, `Apartação`, `Lote`, `Valor Compra`, `Origem`, `Comprador`, `Destino`, `Valor Venda`, `Preço/@ carcaça`, `@ carcaça estimada`, `Frigorífico`, `Embarque`, `Doc`, `Nº Doc`, `Motorista`, `Placa`, `Qtd Doc (Dia)`, `Data Anterior`, `Peso Anterior`, `Dias`, `Ganho`, `GMD`, `Observação`. Padrão visível: `Nº, Tipo, Motivo Saída, Identificação, Peso, Data, Sexo, Raça, Era, Marca, Apartação, Lote, GMD` |
| Valores | `val()` (`:1183-1188`): `null/undefined` → `''`; número → `String` com o primeiro `.` trocado por `,`; texto → `;` trocado por `,`. Peso, arrobas, ganho e peso anterior via `fmtNum`; GMD `fmtNum(,3)`; Dias `fmtInt`; moeda `fmtCurrency` (`R$ 1.234,56`); datas `fmtDateBR` (ausente → `--/--/----`); `doc_qtd` contado **dentro de `pesagensDia` filtrado** (`:653-660`, `:1244-1245`); coluna desconhecida → `''` |
| Separador / quebra / BOM | `;` / LF / `﻿` (`:1263-1264`) |
| Escape | só troca `;` por `,`; aspas e quebras de linha **não** são tratadas |
| `quantidade_arrobas` | valor bruto do view model; a Relação o **anula** sem rendimento válido (`eventRows.js:93-101`) → pode divergir |
| Não exportáveis | `valor_arroba_abate`, `valor_total_abate`, `rendimento_carcaca`, `peso_carcaca_estimado`, `categoria`, `causa_morte` (não estão em `COLUNAS_DISPONIVEIS`) |
| Nome / destino | `pesagens_<AAAA-MM-DD>.csv` (`:1268`); Blob |
| Permissão | UI `reports.export` (`:2267`; OPERADOR não vê o botão); nenhuma no serviço |
| Reimportável | **Não**: o cabeçalho `Identificação` não casa com `numeroanimal/animal` (`PesagensIndividuais.jsx:373`), então todas as linhas dão erro "Número do animal não informado"; `Tipo` é ignorado |

### 5.4 EXP-4 — CSV do Fechamento do Dia

| Item | Contrato atual |
|---|---|
| Função | `exportCsv` (`FechamentoDia.jsx:126-131`) |
| População | `rows` (`:70-75`): `loadOperationalCatalog().pesagens` (`operationalInsightsService.js:5-14`, sem filtro de empresa e sem deduplicar por id) da data, com filtro opcional de apartação por id **ou** nome |
| Colunas | `"Data";"Animal";"Marca";"Tipo";"Peso";"GMD";"Apartação";"Lote";"Observação"` (`:127`) |
| Valores | `data_pesagem` **ISO cru** (`AAAA-MM-DD`); `numero_animal`; `marca`; `tipo_manejo`; `nf.format(Number(peso) \|\| 0)` → **peso ausente vira `0,00`**; GMD `n3` ou `''`; `nome_apartacao`; `nome_lote`; `observacao` (`:128`) |
| Escape | `csvCell`: **toda célula entre aspas**, aspas dobradas (`:32`) |
| Separador / quebra / BOM | `;` / LF / `﻿` (`:129`) |
| Decimal | 2 casas fixas com milhar `.` |
| Nome / destino | `fechamento-<AAAA-MM-DD>.csv`; Blob |
| Permissão | rota `session.close`; **sem** checagem de `reports.export` |
| Reimportável | **Parcial**: `Data` (ISO aceito), `Animal`, `Marca`, `Peso`, `Apartação`, `Lote` e `Observação` casam; `Tipo` é ignorado; linhas sem peso (`0,00`) são rejeitadas; sem Sexo/Raça/Era |

### 5.5 EXP-5 — "Backup do dia" (JSON)

| Item | Contrato atual |
|---|---|
| Função | `backupDay` (`FechamentoDia.jsx:133-136`) |
| Conteúdo | `{type:'daily-weighing-backup', date, createdAt, count, entries: rows}`, indentado com 2 espaços |
| `entries` | view models completos de `storageRecordToViewModel` (`weighingMapper.js:132-149`): **todos** os campos do `legacy_payload` (inclusive valores comerciais), `_localId`, `peso_kg`, `status_animal`, `created_date`, `updated_date` |
| Nome / destino | `backup-do-dia-<data>.json`, `application/json`; Blob |
| Integridade | **nenhuma**, embora o toast diga "gerado e validado no navegador" (`:135`); não é backup restaurável (IMP-3 exige `format`) |
| Permissão | rota `session.close`; sem checagem de `reports.export` ou `commercial.values` |
| Reimportável | **Sim, estruturalmente, pela IMP-2** (`backupService.js:312`, `:342`); na mesma base, os ids repetidos são pulados |

### 5.6 EXP-6 — Histórico da Ficha do Animal

| Item | Contrato atual |
|---|---|
| Função | `exportHistory` (`FichaAnimal.jsx:141-146`) |
| População | `historyRows` = **todos** os eventos do perfil em ordem decrescente (`:128`), agrupados por `animal_id` ou `NUM::MARCA` (`:15`, `:28-58`). **Ignora** o recorte de 90 dias ou 6 meses do gráfico (`:88-98`) |
| Colunas | `"Data";"Tipo";"Peso";"Dias";"Ganho";"GMD";"Lote";"Apartação";"Observação"` (`:142`) |
| Valores | `dateBr` (`dd/mm/aaaa`); `tipo_manejo`; peso `nf` ou `''` (a tabela na tela mostra `0,00`, `:172`); `row.dias` **cru** (número sem formatação); ganho `nf` ou `''`; GMD `n3` ou `''`; lote; apartação; observação |
| Escape / separador / quebra / BOM | `csvCell` entre aspas / `;` / LF / `﻿` |
| Nome | `ficha-<número>-<marca>.csv`, com o nome da marca sem saneamento para nome de arquivo (`:144`) |
| Permissão | UI `reports.export` (`:162`) |
| Reimportável | **Não**: não há coluna Animal/Marca |

### 5.7 EXP-7 — CSV de pesagens da Manutenção

| Item | Contrato atual |
|---|---|
| Função | `exportPesagensCsv` (`backupService.js:97-104`), chamada por `maintenanceDataAdapter.js:75-79` |
| População | todas as pesagens com `deleted_at` vazio, na ordem de `localId`, **sem** deduplicar por id e **sem** filtro de empresa |
| Colunas | `id,data_pesagem,peso_kg,animal_id,lote_id,tipo_pesagem,operador,origem,observacao,created_at,updated_at` (`:100`) |
| Valores | crus do registro Dexie. `operador` e `origem` **não existem no topo** dos registros gravados por `createEntry`/`bulkCreateEntries` (ficam em `legacy_payload`: `weighingDataAdapter.js:305`, `:603-613`) → **colunas vazias**. Não traz número do animal, marca, `tipo_manejo`, derivados nem nenhum campo do `legacy_payload` |
| Separador / quebra / BOM | **`,`** / LF / BOM como caractere literal no template (`:103`, bytes `EF BB BF`) |
| Escape | `csvEscape` (`:90-94`): aspas quando há `"`, `,`, `\n` ou `\r` |
| Data / decimal / nulo | ISO / ponto (número JS) / `''` |
| Destino | IPC `app:writeUserFile` → `data/exports/pesagens-<ISO com - no lugar de : e .>.csv` (`maintenanceDataAdapter.js:25-27`, `:77`); devolve caminho, tamanho e SHA-256; **sem** `backupHistory` |
| Permissão | `maintenance.backup` na rota e no serviço |
| Reimportável | **Não**: não existe importação CSV na Manutenção. Na IMP-1 o delimitador `,` é detectado, mas `data_pesagem`/`peso_kg` não casam com `data`/`peso` e não há coluna de animal |

### 5.8 EXP-8 — JSON de pesagens da Manutenção

| Item | Contrato atual |
|---|---|
| Função | `exportPesagensJson` (`backupService.js:107-121`), via `maintenanceDataAdapter.js:80-84` |
| Conteúdo | `{type:'weighing-entries-export', createdAt, appVersion, count, entries}` com os **registros Dexie crus** (`localId`, `legacy_payload` completo, `created_by_user_id`, `sessao_id`...), indentado com 2 espaços |
| Não inclui | animais, identificadores, cadastros, lotes, embarques; versão de esquema ou contrato; SHA-256 interno |
| Destino | IPC → `data/exports/pesagens-<stamp>.json` (caminho, tamanho e SHA-256 devolvidos; sem `backupHistory`) |
| Permissão | `maintenance.backup` |
| Reimportável | Sim pela IMP-2, com as perdas de §4.2 (ids estrangeiros, `created_at`, autor) |

### 5.9 EXP-9 e EXP-10 — Backups completos

- `createFullBackupFromDb` (`backupService.js:47-82`): `{format:'pesagens-individuais-indexeddb-backup', formatVersion (2 se dbVersion ≤ 6, senão 3), version, dbVersion, createdAt, manifest{backupId, appVersion, dbVersion, createdAt, reason, automatic, counts, stores, schemaVersion, dataContractVersion, uiBuildId}, stores{<todas>}, integrity{algorithm:'SHA-256', sha256}}`. O SHA-256 é de `JSON.stringify(unsigned)` (`:80`). Inclui `usuarios` com hash e salt (`:84`).
- EXP-9: `data/backups/backup-completo-<stamp>.json`, indentado com 2 espaços, `backupHistory 'full-durable'` com o SHA do arquivo e do conteúdo (`maintenanceDataAdapter.js:40-54`). Automático antes da IMP-2 (`:113`), da IMP-3 (`:129`), da limpeza (`:152`) e do reset (`:158`). **Não** é gerado antes da IMP-1.
- EXP-10: `data/backups/pre-migration-v<alvo>-<AAAAMMDD-HHMMSS>.json`, tamanho e SHA-256 relidos e comparados (`preMigrationBackup.js:64-84`).

### 5.10 EXP-11 — Sanidade legada (relevante para a missão 1)

- O backfill v7, passo B11, exporta as chaves `appSettings` que casam com `/^cadastros-auxiliares:sanidade:/` (`v7Backfill.js:30`, `:661-665`) para `data/exports/sanidade-export-<stamp>.json` com `{exportadoEm, motivo:'ADR-022 — sanidade retirada do produto', chaves:{<chave>: <valor>}}` (`:667-682`). Só depois apaga as chaves (`:695-707`). Sem ponte de arquivos, mantém as chaves de sanidade (`:700`, `:704`).
- As stores `configuracoesSanidade`, `itensSanidade` e `sanidadesAnimal` foram **removidas fisicamente na v6** (`schema.js:31-44`; `db.js:29-49`), que também apagou `sanidade_ids/sanidades` das pesagens. O mapper proíbe essas chaves (`weighingMapper.js:23-25`, `:124-125`).
- **Não existe importador** desse JSON nem dos dados de sanidade das stores removidas; um backup v5 restaurado os descarta como `ignoredStores`.

### 5.11 EXP-12 — Copiar diagnóstico

`copyDiag` (`ManutencaoSistema.jsx:321-358`): texto com versões, migração, contagens e integridade em `navigator.clipboard`. Não é arquivo e não contém dados de usuário (`maintenanceDataAdapter.js:195-210`).

### 5.12 EXP-13 — Relatórios (módulo pausado; só citação)

- Serviços: `src/modules/reporting/application/reportExportService.js` (`prepareEmission` `:70-103`, `defaultReportWriter` `:112-135`, `emitReport` `:138-152`) e `reportPrintService.js:81-95`.
- Exportadores: `src/modules/reporting/infrastructure/exporters/csvExporter.js`, `jsonExporter.js`, `xlsxExporter.js`, `printDocument.js`, `reportLayout.js`.
- IPC: `electron/ipc/reportIpc.cjs`. Contrato: `docs/reporting/EXPORT-CONTRACT.md`.
- Gates: `reports:csv-parity`, `reports:xlsx-parity`, `reports:json-manifest`, `reports:print-contract`, `reports:pdf-contract`, `reports:sensitive-data`, `reports:permissions` (`package.json`).
- Ponto de reaproveitamento para a futura "exportação amigável": `csvCell`/`protectFormula`/`CSV_BOM` (`csvExporter.js:11-26`) e `formatCell(...,'csv')` (`reportFormatting.js:74`) já implementam escape, proteção contra fórmula e número sem milhar.

### 5.13 Comparativo de formato

| Exportação | Separador | Quebra | BOM | Escape | Data | Decimal | Milhar | Peso ausente | Data anterior ausente | Destino | Hash |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-1 Relação | `;` | LF | sim | **não** | dd/mm/aaaa | `,` | **sim** | `''` | `--/--/----` | Blob | não |
| EXP-2 Modelo | `;` | LF | sim | não | dd/mm/aaaa | exemplo com `.` | — | — | — | Blob | não |
| EXP-3 Lançamento | `;` | LF | sim | só `;`→`,` | dd/mm/aaaa | `,` | sim | `''` | `--/--/----` | Blob | não |
| EXP-4 Fechamento | `;` | LF | sim | aspas sempre | **ISO** | `,` | sim | **`0,00`** | n/a | Blob | não |
| EXP-5 Backup do dia | JSON | — | não | JSON | ISO | número | — | `null` | `null` | Blob | **não** (mensagem diz validado) |
| EXP-6 Ficha | `;` | LF | sim | aspas sempre | dd/mm/aaaa | `,` | sim (dias cru) | `''` | n/a | Blob | não |
| EXP-7 Manutenção CSV | **`,`** | LF | sim | RFC parcial | ISO | `.` | não | `''` | n/a | IPC `exports/` | SHA do arquivo |
| EXP-8 Manutenção JSON | JSON | — | não | JSON | ISO | número | — | `null` | `null` | IPC `exports/` | SHA do arquivo |
| EXP-13 Relatórios CSV | `;` | **CRLF** | sim | aspas quando preciso + fórmula | dd/mm/aaaa | `,` | **não** | `''` | `''` | IPC `relatorios/` | manifesto |

---

## 6. Gates relacionados

| Gate (`package.json`) | Script | Cobre | Em `test:quick`? | Lacunas relevantes |
|---|---|---|---|---|
| `import:selection:verify` (`:41`) | `verify-import-selection.mjs` | seleção de lotes, resolução de marca/raça, regex da página | sim | adapter `resolveInBatch`, cabeçalhos, formatos |
| `ui:operational-customization:verify` (`:39`) | `verify-operational-customization.mjs:241-257` | "sem criação silenciosa" na página | sim | criação silenciosa no adapter (IMP-2) |
| `enterprise:hardening:verify` (`:35`) | `verify-enterprise-hardening.mjs` | `parseCsv`, número e data BR, atomicidade, hash, cronologia, projeções | sim | SN, marca vazia, sessão fechada, recálculo pós-importação |
| `auth:weighing-access:verify` (`:104`) | `verify-weighing-access.mjs:37`, `:85-100` | CONSULTA negado em `bulkCreateEntries`; botões de exportação por `reports.export` | sim | exportação do Fechamento sem checagem |
| `ui:consistency:verify` (`:43`) | `verify-ui-consistency.mjs:79` | ordem Atualizar / Exportar / Importar / Modelo | sim | — |
| `weighing:calculations:verify` (`:34`) | `verify-weighing-calculations.mjs` | `calculateWeightGain`, `buildWeightPreview` | sim | peso nulo tratado como 0 |
| `storage:import-restore:verify` (`:26`) | `verify-dexie-import-restore.mjs` | IMP-2 (contagens, evidência, hash) e IMP-3 (v7 e v6) | **não** (só `test:full`) | identidade, ids estrangeiros, entradas sem número |
| `storage:backup:verify` (`:25`) | `verify-dexie-backup.mjs:59-64` | EXP-7 (cabeçalho e escape), EXP-8 (tipo, entradas), backup | não (só `test:full`) | colunas `operador/origem` vazias |
| `storage:maintenance-ui-flow:verify` (`:29`) | `verify-dexie-maintenance-ui-flow.mjs:26-27` | o adapter usa o storage | sim | — |
| `storage:ui-contract:verify` (`:27`) | `verify-dexie-ui-contract.mjs:16-22` | repositórios e métodos expostos (inclui `importacoes`) | não | — |
| `maintenance:ui:verify` (`:36`) | `verify-maintenance-ui-contract.mjs:30-31` | rótulos dos botões de exportação | não | "Válidos: —" e "Conflitos: 0" |
| `reports:*` | ver EXP-13 | módulo de relatórios | sim | não cobrem as telas |

Nenhum gate cobre EXP-1, EXP-2, EXP-3, EXP-4, EXP-5 ou EXP-6 quanto a conteúdo, escape ou ida e volta.

---

## 7. Funções canônicas (para "as mesmas funções do lançamento")

| Função | Local | Contrato |
|---|---|---|
| `calculateWeightGain({history,date,weight})` | `weighingCalculations.js:13-35` | → `{dataAnterior,pesoAnterior,dias,ganho,gmd}`; referência = evento de data **estritamente anterior** com `Number(peso)` finito; `ganho` com 2 casas, `gmd` com 3; `gmd=0` se `dias≤0`; tudo `null` sem referência |
| `recalculateWeightSeries(entries, affectedKeys?)` | `weighingSeries.js:10-46` | agrupa por `animalIdentityKey`; ordena data → created → id; só `Manejo` recebe derivados; devolve `{id,localId,legacyPayload,patch}` para **todas** as entradas do grupo |
| `animalIdentityKey(entry)` | `weighingSeries.js:48-50` (`:4`) | `id:<animal_id>` ou `legacy:<NUM::MARCA>` |
| `recalculateAllWeightSeries` / `recalculateWeightSeriesForKeys` | `weighingService.js:144-197` | global ou por chave (índice `animal_id`); grava com `systemDerived` |
| `createEntry` (caminho do Lançamento) | `weighingService.js:53-103` → `weighingDataAdapter.js:297-391` | derivados calculados antes; recálculo só se retroativo (`:81-88`); `stampAutomaticCategory`; `validateAnimalChronology` |
| `bulkCreateEntries` | `weighingService.js:105-115` → `weighingDataAdapter.js:442-666` | ver §4.4 |
| `validateUiPayload` / `uiToStorageRecord` / `filterLegacyPayload` / `storageRecordToViewModel` | `weighingMapper.js:51-79` / `:81-113` / `:30-36` / `:115-150` | validação (data obrigatória e não futura; peso > 0 exceto Saída sem peso); allowlist ADR-027 (`:6-19`); projeção de view model |
| `validateAnimalChronology` | `weighingDataAdapter.js:165-191` | cronologia do lançamento e da edição (a importação tem outra implementação, `:529-595`) |
| `stampAutomaticCategory` / `rebuildAnimalStateProjection` / `rebuildAnimalLotProjection` | `weighingDataAdapter.js:197-207` / `:215-258` / `:260-286` | categoria do evento; estado do animal; permanência em lotes |
| `suggestCategory` / `eraOfCategory` / `categoriesForSex` | `src/modules/operations/domain/categorySuggestion.js:48-50` / `:53-56` / `:43-45` | categoria por sexo e faixa de peso; era da categoria |
| `situacaoFromExitReason` | `src/storage/indexedDb/normalize.js:35-38` | motivo → enum de situação (desconhecido → `INATIVO`) |
| `isOpenSessionStatus` | `normalize.js:48-50` | `ABERTA`/`Aberta` |
| `parseCsv` / `detectCsvDelimiter` | `csvParser.js:23-59` / `:1-21` | ver §3.2 |
| `parseBrazilianNumber` / `parseCivilDate` / `isFutureCivilDate` | `brazilianValues.js:4-34` / `:42-61` / `:63-68` | ver §3.2 |
| `isSnIdentifier` / `normalizeAnimalIdentifier` / `findLatestSnProfile` | `snAnimal.js:1` / `:3-4` / `:6-28` | SN |
| `legacyAnimalKey` / `getAnimalHistory` / `getRegisteredAnimals` | `animalHistory.js:6-8` / `:17-20` / `:22-91` | identidade legada e histórico no Lançamento |
| `resolveMany` / `resolveNamesAgainst` / `buildNameIndex` / `normalizeName` | `catalog/application/catalogResolver.js:21-37` / `catalog/domain/catalogResolver.js:29-46` / `:17-25` / `catalog/domain/normalize.js:4-9` | texto → id de cadastro (inativos resolvem, excluídos não) |
| `collectRegistryTexts` / `splitImportRowsByRegistry` / `countUnknownRegistries` | `importRegistryResolution.js:22-35` / `:57-98` / `:101-103` | dry-run de cadastros |
| `applyImportLotSelection` / `importLotKey` | `importLotSelection.js:6-17` / `:3` | vínculo de lotes |
| `resolveDefaultRegistry` / `loadOperationalPolicies` | `operationalPolicies.js:102-108` / `:82-93` | padrões configurados da empresa |
| `exitRequiresDocument` / `pendenciesOf` | `closingPendencies.js:9-14` / `:21-29` | documento obrigatório; pendências |
| `evaluateWeighingWarnings` | `weighingWarnings.js:38` | avisos de peso |
| `loadEventRows` / `enrichEventRows` / `dedupeById` | `eventSource.js:52-89` / `eventRows.js:84-116` / `:12-22` | população da Relação e dos relatórios |
| `formatCell` / `headerLabel` | `reportFormatting.js:62-97` / `:100-102` | formatação canônica por destino |
| `csvCell` / `protectFormula` / `buildCsv` | `csvExporter.js:22-26` / `:16-19` / `:28-36` | CSV canônico (reporting) |
| `sha256Hex` | `src/lib/sha256.js:1-5` | hash de string |
| `createFullBackup` / `readBackup` / `applyRestore` / `dryRunImportPesagens` / `applyImportPesagens` / `exportPesagensCsv` / `exportPesagensJson` | `backupService.js:85-88` / `:123-172` / `:213-263` / `:310-325` / `:328-355` / `:97-104` / `:107-121` | manutenção |

---

## 8. Problemas e bugs encontrados

Severidade: **A** = corrompe ou duplica dados ou quebra rastreabilidade; **M** = resultado incorreto ou enganoso; **B** = cosmético ou baixo impacto.

| # | Sev. | Problema | Evidência |
|---|---|---|---|
| P-1 | A | Tipo de evento único por arquivo; histórico Cadastro + Manejos exige vários arquivos, e um segundo Cadastro aborta tudo | `PesagensIndividuais.jsx:556`; `weighingDataAdapter.js:580-582` |
| P-2 | A | Linha de Manejo ou Saída de animal inexistente **cria animal** sem Cadastro e sem "Entrada" | `weighingDataAdapter.js:556-574`, `:617` |
| P-3 | A | Identidade por texto `NUM::MARCA`: marca vazia duplica o animal (com marca padrão); espaços internos divergem; brinco reaproveitado casa com o último animal (inclusive vendido) e aborta o lote por "já possui saída" | `:36`, `:453`, `:512-523`, `:558`, `:586-588` |
| P-4 | A | Todas as linhas `SN` da mesma marca viram **um** animal, com GMD entre animais diferentes; no Lançamento cada SN é um animal | `:553-555`; `LancamentoPesagensIndividuais.jsx:956` |
| P-5 | A | Sem idempotência por linha: `ID` ignorado; Manejo duplicado (mesmo animal e data) entra sem aviso; o hash é da string, então arquivo re-salvo passa | `PesagensIndividuais.jsx:370`, `:355`; `weighingDataAdapter.js:479` |
| P-6 | A | O recálculo da série roda fora da transação e sobre a base inteira. Se falhar, os dados ficam gravados com derivados nulos, a tela diz "Erro ao importar" e a nova tentativa é bloqueada pelo hash | `weighingService.js:112-113`; `PesagensIndividuais.jsx:582-583` |
| P-7 | A | IMP-2 cria marcas e raças **em silêncio** (sem `registry.write` e sem auditoria) para animais novos; a garantia "nenhuma criação silenciosa" vale só na página da IMP-1 | `weighingDataAdapter.js:496-506`, `:640-641`; `verify-operational-customization.mjs:241-257` |
| P-8 | A | IMP-2 preserva ids estrangeiros (`marca_id`, `raca_id`, `categoria_id`, `lote_id`, `embarque_id`...) e dá precedência ao `animal_id` de origem sobre número+marca, criando duplicatas e referências penduradas entre instalações | `backupService.js:342`; `weighingDataAdapter.js:554`; `seeds.js:1-4` |
| P-9 | A | Cadastros criados pela opção "Criar estes cadastros" ficam gravados mesmo se a importação falhar depois (fora da transação) | `PesagensIndividuais.jsx:525-526`, `:550-552`; `masterRegistryService.js:233` |
| P-10 | A | CSV da Relação (EXP-1) e do Lançamento (EXP-3) sem escape: `;`, aspas e quebras de linha deslocam colunas | `PesagensIndividuais.jsx:742`; `LancamentoPesagensIndividuais.jsx:1183-1188`, `:1263` |
| P-11 | M | Importação para dia com sessão `FECHADA` cria uma segunda sessão ABERTA e não bloqueia | `weighingDataAdapter.js:525-526`, `:597-602`; `FechamentoDia.jsx:77` |
| P-12 | M | Eventos importados sem `categoria_id` (categoria só na projeção do animal); `era` do evento vem do texto do CSV | `weighingDataAdapter.js:603-613` × `:332-334` |
| P-13 | M | Regras do Lançamento ausentes na importação: causa da morte, rendimento, documento (vira pendência que bloqueia o fechamento), avisos de peso, duplicidade diária, peso opcional em Saída sem peso | §4.1.14 |
| P-14 | M | Erro de validação do serviço (data futura, peso) aborta o lote **sem número de linha**; os números de linha dos erros do parse não são a linha física do arquivo | `weighingService.js:108-111`; `csvParser.js:51`; `PesagensIndividuais.jsx:396` |
| P-15 | M | Cinco normalizações de texto diferentes (identidade, cadastro, relatório, cabeçalho, lote) | §3.2 |
| P-16 | M | O dry-run da Manutenção mostra "Válidos: —" e "Conflitos: 0" sempre; `skipDuplicates` é ignorado; o nome do arquivo não chega a `importacoes` | `ManutencaoSistema.jsx:216`, `:570`, `:573`; `backupService.js:324`, `:348` |
| P-17 | M | EXP-4 grava peso ausente como `0,00`, e a importação desse arquivo rejeita a linha | `FechamentoDia.jsx:128` |
| P-18 | M | "Backup do dia" anuncia validação inexistente e exporta valores comerciais sem checagem de permissão no código (protegido hoje só pela rota) | `FechamentoDia.jsx:133-136`; `Layout.jsx:45` |
| P-19 | M | EXP-7: colunas `operador` e `origem` sempre vazias; sem número, marca ou tipo, o CSV não identifica o animal | `backupService.js:100`; `weighingDataAdapter.js:305`, `:603-613` |
| P-20 | M | `sexo` do CSV não é validado (`Macho` → `MACHO`, sem categoria automática, rótulo incorreto) | `PesagensIndividuais.jsx:400`; `categorySuggestion.js:14-20` |
| P-21 | M | Lote existente desmarcado no diálogo **remove** as linhas; lote inexistente fica só como texto (órfão) | `importLotSelection.js:11`; `PesagensIndividuais.jsx:454-478` |
| P-22 | M | `doc_qtd` e `quantidade_arrobas` do Lançamento divergem da Relação (contagem sobre a lista filtrada; arrobas sem a regra de rendimento válido) | `LancamentoPesagensIndividuais.jsx:653-660`, `:1230-1231`; `eventRows.js:86-101` |
| P-23 | M | IMP-1 sem backup automático prévio e sem `backupHistory`; IMP-2 exige backup físico | `PesagensIndividuais.jsx:534-588` × `maintenanceDataAdapter.js:112-116` |
| P-24 | M | `calculateWeightGain` trata `peso` `null`/`''` como referência de 0 kg | `weighingCalculations.js:21`; `weighingSeries.js:42` |
| P-25 | M | Leitura do CSV presa a UTF-8: arquivos ANSI do Excel corrompem acentos (cabeçalhos `Apartação`/`Observação` e nomes de marca e raça) | `PesagensIndividuais.jsx:497` |
| P-26 | B | Modelo CSV com GMD `1.625` (ponto) e colunas derivadas que não são usadas | `PesagensIndividuais.jsx:704-707` |
| P-27 | B | `status_animal` montado na página e descartado no mapper | `PesagensIndividuais.jsx:558`; `weighingMapper.js:23-25` |
| P-28 | B | `dialog:select-export-directory` e `openDataFolder` expostos e sem uso | `dialogIpc.cjs:57-74`; `preload.cjs:10`, `:24` |
| P-29 | B | Nome de arquivo da Ficha usa marca e número sem saneamento; o botão do Lançamento chama `exportarExcel`, mas gera CSV | `FichaAnimal.jsx:144`; `LancamentoPesagensIndividuais.jsx:1178` |
| P-30 | B | Diálogo de importação mostra só os 10 primeiros erros, sem exportar o relatório | `PesagensIndividuais.jsx:1461-1468` |

---

## 9. Riscos para o desenho futuro

1. **Reaproveitar `bulkCreateEntries` como está** herda P-1 a P-9. A conciliação precisa de identidade por `marca_id`, de política explícita para animal inexistente (pendência em vez de criação) e de tipo por linha.
2. **Recálculo global a cada importação** cresce linearmente com a base (a massa de 36 mil ou 250 mil registros dos benchmarks). `recalculateWeightSeriesForKeys` por `animal_id` já existe (`weighingService.js:148-197`) e é o caminho natural para recalcular só os animais afetados, dentro ou logo após a transação.
3. **Duas implementações de cronologia** (`validateAnimalChronology` × laço do bulk) e de categoria (`stampAutomaticCategory` só no lançamento) podem fazer "mesmas funções do lançamento" divergir de novo se não forem unificadas.
4. **Exportação amigável × reimportável**: hoje o único CSV com cabeçalhos reimportáveis (EXP-1) usa formato "amigável" (milhar, `--/--/----`, sem escape, sem Tipo). Separar os dois contratos exige cabeçalhos estáveis (ids) e escape (`csvCell` do reporting).
5. **Hash de string** como idempotência não resiste a re-salvar no Excel. Uma chave por linha (`id` exportado, `id_externo` ou animal + data + tipo + peso) precisa de índice e de política de conflito.
6. **Importação para dia fechado** e sessões duplicadas afetam o Fechamento; qualquer retroativo importado deve respeitar `sessoesPesagem.status`.
7. **Permissões de exportação só na UI**: um serviço de exportação operacional deve repetir `reports.export` e `commercial.values`, como o reporting já faz (`reportExportService.js:85`).
8. **Sanidade**: o único artefato remanescente é o JSON de exportação da ADR-022 (EXP-11); não há importador, e as stores antigas foram removidas na v6. Um restore de backup v5 descarta essas stores (`ignoredStores`).
9. **Gates que só verificam regex** (IMP-1) dão falsa segurança: a proteção contra criação silenciosa não cobre o adapter.
10. **`test:quick` não roda** `storage:import-restore:verify` nem `storage:backup:verify`.
11. **Atomicidade e tamanho**: arquivo inteiro numa transação, sem limite; o IPC de JSON passa o objeto inteiro pelo `structuredClone`.

---

## 10. Divergências entre documentos antigos e o código atual

| Documento | Afirmação | Código atual |
|---|---|---|
| `docs/evidence/auditoria-master-produto-pecuario/IMPORT-TARGET-MODEL.md` §1 (14/09, v6) | "marca/raça/era criadas como texto" | marca e raça resolvidas por cadastro, com rejeição por linha e criação explícita (`PesagensIndividuais.jsx:447-449`, `:520-532`); era continua texto. **Divergente (desatualizado)** |
| idem §1 | "sessão `IMPORTACAO` por data" | IMP-1 grava `operador:'LOCAL'` (`:563`); só a IMP-2 usa `'IMPORTACAO'` (`backupService.js:350`); sessões nascem `ABERTA` (`weighingDataAdapter.js:101`), não `FECHADA` como no alvo §2.3 |
| idem §1 | "Idempotência: SHA-256 do arquivo" | SHA-256 da **string decodificada** (IMP-1) ou do **objeto re-serializado** (IMP-2) |
| idem §2.3 | "Manejo para animal inexistente não cria animal" (alvo) | ainda cria (`weighingDataAdapter.js:556-574`). Não implementado |
| `docs/evidence/auditoria-relatorios-profissionais/13-EXPORT-AUDIT.md` (16/09) | "CSV Ficha: peso null sai `0,00`" | a exportação da Ficha já grava `''` (`FichaAnimal.jsx:143`); a **tabela** na tela ainda mostra `0,00` (`:172`). O Fechamento continua com `0,00` (`FechamentoDia.jsx:128`) |
| idem | linhas citadas (`PesagensIndividuais.jsx:772-801`, `FechamentoDia.jsx:117-122`, `FichaAnimal.jsx:130-135`...) | linhas atuais: `:720-750`, `:126-131`, `:141-146` |
| idem | "JSON backup do dia não é restaurável" | não é restaurável pela IMP-3, mas **é importável pela IMP-2** (`backupService.js:312`, `:342`) |
| `docs/reporting/EXPORT-CONTRACT.md` §4 e comentário de `csvExporter.js:1` | "CSV canônico (substitui as implementações espalhadas)" | as telas operacionais (EXP-1 a EXP-7) **continuam** com implementações próprias |
| `docs/user/EXPORTAR-DADOS.md` | "abrir a pasta de dados pelo botão **Abrir pasta data** no topo do app" | não há botão; `openDataFolder` não é usado em nenhum `.jsx` |
| `docs/user/EXPORTAR-DADOS.md` | "JSON … importar depois no app" | verdadeiro só para pesagens e com as perdas de §4.2 (ids estrangeiros, `created_at`, autor) |
| comentário `src/modules/operations/application/operationalPolicies.js:1` | políticas "consumidas … pela Relação (importação)" | `PesagensIndividuais.jsx` não importa `operationalPolicies`; o adapter usa `padrao===true` |
| comentário `importRegistryResolution.js:7-11` | texto vazio → "o adapter aplica a marca padrão da empresa" | aplica ao **animal novo** (`weighingDataAdapter.js:558`); o **evento** fica com marca e `marca_id` nulos |
| comentário `PesagensIndividuais.jsx:65-69` | "Nenhuma criação silenciosa" | verdadeiro na página; falso no adapter para a IMP-2 (P-7) |
| `FechamentoDia.jsx:205` ("O que será gravado") | "Backup operacional disponível … exportados em JSON antes da conclusão" | não há exigência nem gravação; `toggleClosed` não chama backup (`:138-149`) |

---

## 11. Matriz de divergências — coluna na tabela × CSV × importação

### 11.1 Matriz principal: Relação de Pesagens

Legenda: **Tabela** = Relação (`RELATION_COLUMN_IDS`, `eventColumns.js:124-129`; rótulo; ● visível por padrão; formato de `formatCell 'screen'`). **EXP-1** = CSV da Relação (`PesagensIndividuais.jsx:721-740`). **IMP-1** = cabeçalho aceito e uso (`:369-415`). "—" = ausente.

| Campo | Tabela (Relação) | EXP-1 CSV | EXP-2 Modelo | IMP-1 Importação | Divergência |
|---|---|---|---|---|---|
| `id` | não é coluna | `ID` = id da pesagem | `ID` vazio | `id` mapeado e **ignorado**; UUID novo | exportado e descartado → sem idempotência por linha |
| `id_externo` | — | `ID_Externo` | `22207` | `ID_Externo` → `legacy_payload.id_externo` | invisível na tela e nos relatórios; sem unicidade |
| `data_pesagem` | `Data` ● dd/mm/aaaa | `Data` dd/mm/aaaa | `01/12/2025` | só `Data` → ISO; futura aborta no serviço | aliases `Data Pesagem`/`data_pesagem` não aceitos |
| `tipo_manejo` | `Tipo` ● badge | **—** | — | **não lido**; tipo global do diálogo | **perda do tipo na ida e volta** |
| `motivo_saida` | `Motivo da saída` ● | — | — | global do diálogo (só Saída) | idem |
| `causa_morte` | — (só relatórios) | — | — | — | Lançamento exige em Morte; importação não tem |
| `numero_animal` | `Animal` ● | `NumeroAnimal` | `4368` | `NumeroAnimal`/`Animal` (maiúsculas), obrigatório | Lançamento exporta `Identificação` (não aceito) |
| `marca` | `Marca` ● texto do evento | `Marca` texto | `ABC`/vazio | `Marca` → `marca_id` por nome (desconhecida rejeita); vazio aceito | marca renomeada não resolve; vazio → animal duplicado com marca padrão |
| `marca_id` | agrupa, não exibe | — | — | derivado na página; adapter ignora para animal novo | evento × animal podem divergir |
| `sexo` | `Sexo` ● `Macho`/`Fêmea` | `Sexo` `M`/`F` | `M`/`F` | `Sexo` → maiúsculas, sem validação | rótulo da tela ≠ código do CSV; `Macho` vira `MACHO` |
| `raca` | `Raça` ● | `Raça` | `Nelore` | `Raça`/`Raca` → `raca_id` | como marca |
| `era` | `Era` ● | `Era` | `2A` | `Era` texto → evento e animal novo | no modelo novo a era vem da categoria; a projeção sobrescreve a do animal |
| `categoria` | — (só relatórios) | — | — | — | evento importado sem `categoria_id` |
| `peso` | `Peso` ● 2 casas fixas (`1.234,00`) | `Peso` `fmtNum` (inteiro sem casas; fracionário com 2, arredondado; milhar `.`) | `206` | `Peso` → `parseBrazilianNumber`, > 0 obrigatório | formato ≠ tela; arredonda a 2 casas; Saída sem peso impossível |
| `nome_lote` | `Lote` ● texto do evento | `Lote` | `MEIO` | `Lote`/`NomeLote`; `lote_id` só com Apartação + confirmação | lote inexistente vira texto órfão; lote desmarcado remove a linha |
| `nome_apartacao` | `Apartação` ● | `Apartação` | `ROTINA` | `Apartação`/`NomeApartacao` | idem |
| `valor_pago_cabeca` | `Valor compra` (commercial.values) | — | — | — | não exportável nem importável |
| `origem_animal` | `Origem` | — | — | — | idem |
| `comprador` | `Comprador` | — | — | — | idem |
| `destino_venda` | `Destino` | — | — | global do diálogo (só Venda) | não exportado; importado só como constante |
| `valor_venda_total` | `Valor venda` (commercial) | — | — | — | — |
| `valor_arroba` | `Preço/@ carcaça` (commercial) | — | — | — | — |
| `quantidade_arrobas` | `@ carcaça estimada` (commercial; nula sem rendimento válido) | — | — | — | Lançamento exporta o bruto |
| `frigorifico` | `Frigorífico` | — | — | — | — |
| `embarque_nome` | `Embarque` | — | — | — | — |
| `documento_tipo` | `Doc` | — | — | — | Abate importado vira pendência Doc |
| `documento_numero` | `Nº doc` | — | — | — | — |
| `motorista_nome` | `Motorista` | — | — | — | — |
| `placa_carreta` | `Placa` (maiúsculas por CSS) | — | — | — | — |
| `doc_qtd` | `Qtd doc (dia)` (contagem na população) | — | — | — | Lançamento conta na lista filtrada |
| `data_anterior` | **não oferecida** na Relação | `DataAnterior` (ausente → `--/--/----`) | `15/11/2025` | lido e **forçado a null** | exportado sem estar na tela; recalculado |
| `peso_anterior` | **não oferecida** | `PesoAnterior` | `180` | forçado a null | idem |
| `dias` | `Dias` (inteiro) | `Dias` (`fmtInt`, com milhar) | `16` | forçado a null | recalculado |
| `ganho` | `Ganho` (2 casas) | `Ganho` (`fmtNum`) | `26` | forçado a null | recalculado; formato ≠ tela |
| `gmd` | `GMD` ● 3 casas, colorido | `GMD` 3 casas | `1.625` (ponto!) | forçado a null; prévia `-` | modelo com separador inconsistente |
| `observacao` | `Observação` | `Observação` **sem escape** | vazio | `Observação`/`Obs` | `;` ou quebra de linha corrompem o arquivo |
| `sessao` | — (relatórios) | — | — | sessão ABERTA por data (cria se não houver) | ignora dia fechado |
| `origem_registro` | — (relatórios) | — | — | fixa `importacao` | — |
| `operador` (`created_by_user_id`) | — (relatórios) | — | — | ator da sessão; `importacoes.operador='LOCAL'` | registro de importação sem usuário |
| `rendimento_carcaca`, `peso_carcaca_estimado`, `valor_arroba_abate`, `valor_total_abate` | — | — | — | — | nem o Lançamento os exporta |

### 11.2 Matriz secundária: demais exportações × aceitação pela IMP-1

| Campo | EXP-3 Lançamento (rótulo) | EXP-4 Fechamento | EXP-6 Ficha | EXP-7 Manutenção CSV | EXP-8 / EXP-5 JSON | Aceito pela IMP-1? |
|---|---|---|---|---|---|---|
| id | — | — | — | `id` | `id` | CSV: ignorado; JSON (IMP-2): usado para pular duplicata |
| data_pesagem | `Data` dd/mm/aaaa | `Data` **ISO** | `Data` dd/mm/aaaa | `data_pesagem` ISO | `data_pesagem` | `Data` sim; `data_pesagem` não |
| tipo_manejo | `Tipo` | `Tipo` | `Tipo` | `tipo_pesagem` | legacy/`tipo_manejo` | não (CSV); sim (IMP-2) |
| motivo_saida | `Motivo Saída` | — | — | — | sim | não / sim |
| numero_animal | **`Identificação`** | `Animal` | — | — | legacy | só `Animal`/`NumeroAnimal` |
| marca | `Marca` | `Marca` | — | — | legacy (+ `marca_id` estrangeiro) | sim |
| sexo / raça / era | `Sexo`/`Raça`/`Era` | — | — | — | legacy | sim |
| peso | `Peso` (`fmtNum`) | `Peso` (2 casas; ausente `0,00`) | `Peso` (2 casas; ausente `''`) | `peso_kg` (ponto) | `peso_kg` + legacy `peso` | `Peso` sim; `peso_kg` não |
| lote / apartação | `Lote`/`Apartação` | `Lote`/`Apartação` | `Lote`/`Apartação` | `lote_id` | ids estrangeiros + textos | textos sim |
| comerciais | se `commercial.values` (moeda `R$`) | — | — | — | todos (sem filtro) | não |
| embarque / documento | `Embarque`, `Doc`, `Nº Doc`, `Motorista`, `Placa`, `Qtd Doc (Dia)` | — | — | — | todos | não |
| derivados | `Data Anterior`, `Peso Anterior`, `Dias`, `Ganho`, `GMD` | `GMD` | `Dias` (cru), `Ganho`, `GMD` | — | todos (sobrescritos) | lidos e anulados |
| observação | `Observação` (`;`→`,`, sem aspas) | aspas | aspas | `observacao` (RFC) | sim | sim |
| operador / origem | — | — | — | `operador`, `origem` (**vazias**) | legacy | não |
| created_at / updated_at | — | — | — | ISO | sim (**perdido** no import) | não |
| **Resultado da reimportação** | **falha total** (sem número) | **parcial** (sem tipo; `0,00` rejeitado) | **falha total** (sem animal) | **falha total** | IMP-2 com perdas | — |
