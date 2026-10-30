# Auditoria corretiva R1 — PR #4, Pesagens 1.6.0

| Campo | Valor |
|---|---|
| Missão | `PESAGENS-PR4-AUDITORIA-CORRETIVA-PRE-MERGE-R1-2026-10-29` |
| Branch | `claude/pesagens-estabilizacao-e-gestao-integrada-01` |
| PR | #4, em **DRAFT** |
| Base auditada | `479e653` (app 1.6.0, Dexie v9) |

## Escopo e regras

- Só foram usados dados **sintéticos**, em pastas temporárias, `fake-indexeddb` e perfis isolados do Electron. Nenhum
  banco de produção, dado real, credencial ou equipamento físico foi usado.
- Cada achado foi reproduzido **ANTES**, no worktree de `479e653`, com o mesmo teste novo ou um equivalente, e
  **DEPOIS**, na branch. Nenhuma PASS foi afirmada sem esse teste.
- Ficaram mantidos:
  - a decisão **peso inteiro no lançamento** (P15), sem recalcular pesos antigos;
  - `STORES_V7` e `STORES_V8` sem edição no lugar;
  - os logs de auditoria, nenhum removido.

### Classificação

| Achado | Classificação |
|---|---|
| R01 | CONFIRMADO |
| R02 | CONFIRMADO |
| R03 | CONFIRMADO |
| R04 | CONFIRMADO (o roteiro anterior estava errado) + LIMITAÇÃO DOCUMENTADA: passos de instalador **BLOQUEADOS PARA HOMOLOGAÇÃO WINDOWS** |
| R05 | CONFIRMADO, nos dois caminhos: operação e Lançamento |
| R06 | CONFIRMADO |
| R07 | CONFIRMADO |
| R08 | RISCO REPRODUZIDO, parcialmente REFUTADO COM TESTE: os 20 min eram do motor de teste. O defeito real (não idempotente) foi CONFIRMADO |
| R09 | Teste de regressão novo, sem falha encontrada |

---

## R01 — Backup de segurança antes de operação destrutiva

**Diagnóstico.** Antes de importar, restaurar, limpar ou fazer o reset, `persistFullBackup` gravava o arquivo e
entregava a "evidência" (caminho, tamanho e SHA-256 da gravação) **sem ler de volta**. Uma gravação truncada, um
conteúdo trocado ou uma falha de leitura passavam. Um anexo sumido do app também passava. A operação destrutiva
seguia mesmo assim.

**ANTES** (`scripts/verify-safety-backup.mjs` rodado em `479e653`):

```text
AssertionError: Missing expected rejection: TRUNCADO/importar: operação recusada
```

**Correção** (`maintenanceDataAdapter.js`). Novo `persistVerifiedSafetyBackup`, que usa o mesmo caminho do botão
"Criar backup agora". Ele confere:

- a gravação, lida de volta;
- o SHA-256 do arquivo e do conteúdo;
- se o conteúdo é **o mesmo backup gerado** (`payloadSha256`);
- as contagens por store;
- os anexos.

Qualquer falha gera `BACKUP_PRE_OPERACAO_FALHOU`, **antes** de qualquer escrita, e é registrada no histórico como
`safety-failed`.

Há uma única exceção, explícita e opcional: `aceitarAnexosAusentesNaOrigem`, só na restauração e só para anexos
**já ausentes**. Anexo corrompido nunca entra nela.

A retenção já protegia os backups `pre-*`, e isso foi mantido: só os `periodico` rotacionam.

**DEPOIS.** Gate `safety:backup:verify`:

- **Falhas.** São 5 falhas injetadas (gravação truncada, conteúdo trocado por outro backup válido, leitura de
  volta falhando, ENOSPC, anexo de origem apagado) × 4 operações (importar, restaurar, limpar, reset). Todas são
  recusadas, e o banco e a pasta de anexos ficam **idênticos por hash**. São 20 registros `safety-failed`.
- **Sucesso.** A evidência sai `verified: true`. O backup de segurança é restaurável e devolve as contagens de
  antes.

**Impacto.** A operação só começa com o backup conferido. Num disco com problema, a mensagem é clara e nada é
alterado.

## R02 — Conferir os anexos antes de trocar a base

**Diagnóstico.**

1. A restauração trocava o banco **e depois** copiava os anexos. Com a pasta `.anexos` ausente ou um anexo
   corrompido, o banco já estava substituído. O gate antigo `documents:backup` registrava isso como esperado:
   restaurava e listava `faltando = 2` depois.
2. A pasta de anexos vinha de `lastSelectedBackup`, uma variável **global** do processo principal. Era sobrescrita
   por qualquer diálogo posterior (TOCTOU), sem conferir se o arquivo ainda era o inspecionado.
3. Os erros de domínio do processo principal (`AttachmentError`) chegavam ao renderer como
   `{"code":"IPC_001","message":"Erro interno"}`. Esse é o aviso genérico que o prompt proíbe.

**ANTES:**

```text
toIpcError(new AttachmentError('ANEXO_CORROMPIDO', …)) → {"code":"IPC_001","message":"Erro interno"}
verify-documents-backup.mjs@479e653 l.153-159: applyRestoreBackup(sem .anexos) resolve; anexos.faltando = 2 depois
```

**Correção.**

- **Seleção vinculada** (`electron/ipc/backupSelection.cjs`). Cada escolha no diálogo recebe um token. O processo
  principal guarda pasta, nome, tamanho e SHA-256 **dos bytes entregues**. Antes de usar a pasta `.anexos`, ele
  relê e confere. Se o arquivo foi trocado, gera `BACKUP_ARQUIVO_TROCADO`.
- **Fases** (`applyRestoreBackup`):
  1. **Conferir.** Tudo é conferido (pacote JSON + `.anexos` ou anexos do `.pbk`). Se faltar algo, gera
     `BACKUP_ANEXOS_PREFLIGHT` e nada muda.
  2. **Backup de segurança** verificado (R01).
  3. **Preparar.** Os anexos são copiados e conferidos numa pasta de preparo, com tudo ou nada. Falha gera
     `BACKUP_ANEXOS_PREPARO`, e o preparo é descartado.
  4. **Banco.** A troca é atômica.
  5. **Efetivar** os anexos. Se falhar, há **compensação**: o banco volta pelo backup de segurança (gera
     `BACKUP_RESTAURACAO_REVERTIDA` e registra `restore-compensated`).
  6. **Conferir de novo** as contagens e os anexos. O resultado traz `recuperacaoCompleta`.
- **Senha errada no `.pbk`.** É recusada na inspeção, pela autenticação AES-GCM, antes de qualquer escrita. Um anexo
  adulterado dentro do envelope é recusado no preparo.
- **Erros visíveis.** `AttachmentError`, `SelectionError` e `BackupStoreError` passam a estender `AppError`. O
  código e a mensagem chegam ao renderer.
- **Tela.** O assistente mostra a recusa exata e só oferece a exceção cabível. Ela é explícita e existe só para
  anexos **ausentes**. Corrompido nunca é aceito.

**DEPOIS.** Gate `restore:preflight:verify`. Cada recusa abaixo deixa o banco e os anexos **idênticos por hash**:

| Caso | Resultado |
|---|---|
| Pasta `.anexos` ausente | recusada (`BACKUP_ANEXOS_PREFLIGHT`) |
| Um anexo ausente | recusada (`BACKUP_ANEXOS_PREFLIGHT`) |
| Anexo adulterado com o **mesmo tamanho** | recusada (`BACKUP_ANEXOS_PREFLIGHT`) |
| Arquivo selecionado trocado depois da inspeção (mesmo tamanho) | recusada (`BACKUP_ARQUIVO_TROCADO`) |
| Restauração sem seleção | recusada (`BACKUP_SELECAO_INVALIDA`) |
| Falha de gravação no preparo | recusada (`BACKUP_ANEXOS_PREPARO`), preparo descartado |
| Falha ao efetivar **depois** do banco | compensada: banco de antes, anexos anteriores intactos, histórico `restore-compensated` |
| Seleção posterior de outro arquivo | não muda o alvo; restauração boa com `recuperacaoCompleta = true`, anexos com o mesmo hash |
| `.pbk` com senha errada | recusado |
| `.pbk` com anexo adulterado | recusado, sem alteração |
| `.pbk` íntegro | `recuperacaoCompleta = true` |

**Limitação documentada.** O diálogo nativo não é dirigido pelo E2E. Os gates usam os **mesmos módulos** do processo
principal: `attachmentStore`, `backupSelection` e o formato do `wrapIpcHandler`. A ponte de teste fica em
`scripts/lib/gateAttachmentBridge.mjs`.

## R03 — Verificado, disponível, íntegro e cópia externa

**Diagnóstico.**

- `getBackupStatus` usava o **registro** da última verificação (caminho + tamanho), mesmo com o arquivo apagado,
  renomeado ou alterado.
- A cobertura dizia "Protegido".
- O agendador **adiava** o periódico com base nesse registro.
- A cópia externa era "OK" pelo registro da última cópia.

**ANTES** (arquivo verificado e depois apagado; `479e653`):

```text
{"cobertura":{"local":"OK"},"protecao":"VERIFICADO","lastVerified":true,"periodicoRodaria":false}
```

**Correção.**

- `getBackupStatus` separa quatro fatos:
  - **Verificado em**: o histórico;
  - **Disponível agora**: mesmo nome e tamanho, sem modificação posterior;
  - **Íntegro agora**: relido, com SHA-256 do arquivo e do conteúdo e anexos da pasta;
  - `INDISPONIVEL`: a pasta ilegível.
- `lastVerified` só aponta para um backup íntegro agora. Ele alimenta a cobertura, o agendador, a cópia externa e a
  retenção. Se o mais novo não confere, a proteção vale pelo anterior íntegro, e a tela avisa.
- **Cópia externa válida** é a cópia relida no destino e conferida (`backup:verify-external`).
- A tela mostra os quatro fatos separados.

**DEPOIS.** Gate `backup:availability:verify`:

- **Casos sem proteção.** Arquivo apagado, renomeado, truncado, alterado com **o mesmo tamanho e a mesma data de
  modificação**, anexo do backup adulterado e pasta inacessível. Em todos, o backup **não** protege, o histórico
  continua e o periódico **não é adiado**.
- **Backup mais novo alterado.** A proteção vale pelo anterior íntegro.
- **Cópia externa.** Apagada ou adulterada fica PENDENTE. Destino desconectado fica INDISPONIVEL.

Há também testes unitários da cobertura em `backupPolicy.test.js`.

## R04 — Voltar da 1.6.0 (v9) para a 1.5.x (v8)

**Diagnóstico.** O roteiro (`MIGRACAO-ROLLBACK.md`) dizia: "Na 1.5.x, a abertura recusa o banco 9; use Restaurar
backup". Isso foi testado com o **código real da 1.5.6** (commit `9392274`) e está **errado**:

- o Dexie 4 da 1.5.x **abre o banco v9 sem erro** (reporta verno 8) e grava nele;
- restaurar o backup pré-migração ali deixa as tabelas só da v9 com os dados da 1.6.0: banco **misto**.

**ANTES/DEPOIS** (`npm run rollback:v8:verify`):

```text
1.5.x (1.5.6) criou o banco v8: {"animais":3,"pesagens":4,"marcas":1,"movimentosAnimais":1,"usuarios":1}
1.6.0 migrou para v9 com backup pré-migração v8; 1 pesagem nova lançada na 1.6.0
1.5.x no MESMO perfil: abre o banco v9 sem erro (verno 8); restaurar ali volta as tabelas da v8 mas deixa 2 operação(ões) da v9 — estado misto
1.5.x em perfil SEPARADO: backup v9 comum recusado; pré-migração v8 restaurado com as contagens de antes (integridade OK); a pesagem lançada na 1.6.0 não volta
```

**Correção** (documentação e verificação executável). O roteiro novo:

1. Backup v9 na 1.6.0.
2. Copiar o `pre-migration-v9-….json`.
3. Desinstalar sem apagar os dados.
4. Abrir a 1.5.x **num perfil novo**, com `PESAGENS_USER_DATA_DIR`. A 1.5.6 honra essa variável.
5. Restaurar o backup ali.

O perfil da 1.6.0 **nunca** é apagado, renomeado nem aberto pela 1.5.x. A perda do que foi lançado na 1.6.0 está
documentada. `INSTALACAO-WINDOWS.md` aponta para esse roteiro.

**BLOQUEADO PARA HOMOLOGAÇÃO WINDOWS.** Os passos de instalar e desinstalar, e a abertura com a variável no Windows
real, não foram executados aqui (Linux, sem o instalador da 1.5.x). `rollback:v8:verify` fica fora do
`test:quick`, porque precisa do checkout da 1.5.x; ele cria um worktree sozinho.

## R05 — Carência desconhecida e abate

**Diagnóstico.**

- Carência **desconhecida** era só **aviso**. Abate com `aceitarAvisos` passava.
- A janela era de 120 dias. Há produtos de longa ação com carência acima disso.
- A **Saída por Abate lançada direto no Lançamento não conferia carência nenhuma**: nem aberta, nem desconhecida.
- Registros antigos sem `carencia_conhecida` eram ignorados.

**ANTES** (gate novo rodado em `479e653`):

```text
Lançamento Saída/Abate com carência desconhecida → AssertionError: Missing expected rejection (gravou)
Operação ABATE com carência desconhecida + aceitarAvisos → AssertionError: Missing expected rejection (confirmou)
```

**Correção.**

- `withdrawalCase` distingue **ZERO, ABERTA, ENCERRADA, CANCELADA, DESCONHECIDA** (inclui registro antigo sem o
  campo), **SEM_MEDICAMENTO** e **POSTERIOR**.
- A janela da desconhecida passou para **180 dias** (`JANELA_CARENCIA_DESCONHECIDA_DIAS`).
- **Abate** com desconhecida é **BLOQUEIO** até liberação técnica **documentada**, com responsável, motivo e
  **evidência** (`releaseCoversUnknown`).
- A Saída/Abate do Lançamento passa pela mesma regra (`CARENCIA_ABATE`) e aponta para Rebanho › Saídas. A operação
  confere e chama com `carenciaConferida`.
- Venda, transferência e doação continuam com aviso.

**DEPOIS:**

- Testes unitários: os casos, a janela de 150 e 181 dias e a liberação com e sem evidência.
- `sanity:posology:verify`, que cobre:
  - o Lançamento recusado sem gravar;
  - a operação recusada mesmo com `aceitarAvisos`;
  - liberação sem evidência, que ainda bloqueia;
  - liberação com evidência, que gera um aviso e confirma o abate;
  - carência zero ou encerrada, que não prende.

## R06 — Local do inventário na data

**Diagnóstico.** Em `locationStays`, sem destino na entrada, a propriedade caía na **atual** do animal. Um animal
movido ou editado depois aparecia no saldo **passado** da propriedade nova. O dossiê fazia o mesmo.

**ANTES** (os testes novos de `inventory.test.js` rodados em `479e653`): 5 falhas.

```text
fevereiro, propriedade P2: expected 1 to be +0   (animal sem destino contado em P2 pela propriedade ATUAL)
março: expected [1, 2, 3] to deeply equal [0, 2, 2]
```

**Correção.**

- A propriedade passa a vir do livro: destino da entrada, senão a origem da 1ª movimentação, senão
  **INDETERMINADO**.
- Os animais indeterminados ficam listados à parte, fora do saldo, e `fecha` fica falso.
- Com **uma só** propriedade já cadastrada, inclusive as excluídas, não há indeterminação.
- O resultado traz `limitacoes`. A tela e o CSV avisam que o **filtro de categoria usa a categoria atual**.
- O dossiê mostra "Indeterminado" em vez da propriedade atual.

**DEPOIS.** Testes de conciliação: a soma das propriedades mais os indeterminados é igual ao rebanho na data. Também
são testadas as transferências internas por data, a propriedade única e o aviso de categoria.

## R07 — Regra única de peso

**Diagnóstico.** Havia duas regras:

- o Lançamento (digitado e S3) truncava;
- `operationRules.pesoDoItem` **arredondava** e aceitava 0,5 kg como 1 kg.

Texto inválido numa saída sem peso obrigatório virava "sem peso" em silêncio.

**ANTES** (`479e653`):

```text
{"entrada":328.5,"s3_campo":"328","operacao":329}
{"entrada":328.99,"s3_campo":"328","operacao":329}
{"entrada":0.5,"s3_campo":"0","operacao":1}
```

**Correção.** `src/modules/weighing/domain/weightNormalization.js` aplica **inteiro por truncamento**, que é a
decisão P15 vigente. Ele é usado:

- pelo peso digitado;
- pela leitura S3 no Lançamento;
- pelo campo da balança;
- pelos itens de operação.

Zero, negativo, abaixo de 1 kg e texto inválido são recusados com motivo. Pesos antigos **não** são recalculados. A
edição e a importação mantêm o comportamento anterior; isso é uma limitação documentada.

**DEPOIS.** O teste `weightNormalization.test.js` cobre:

- 328,4, 328,5 e 328,99, que viram 328;
- negativo, zero e 0,5;
- vírgula decimal e separador de milhar;
- texto inválido e vazio;
- paridade entre balança, digitado e operação.

## R08 — "Reconciliar derivados" com 12 mil animais

**Diagnóstico.**

1. Os "mais de 20 min" foram medidos (sessão anterior) no **Node com `fake-indexeddb`**. O perfil de CPU mostra **66 % do tempo em
   `RecordStore.deleteByValue`** do fake-indexeddb. Ele varre o índice inteiro a cada atualização, o que dá
   custo ~N². Isso **não representa o app**.
2. Defeito real: `rebuildAnimalStateProjection` **regravava todo animal em toda execução**, mesmo sem mudança. Não
   era idempotente nas escritas.
3. Havia ~7 consultas por animal e uma leitura completa das categorias por animal.
4. Não havia cancelamento, e a tela não mostrava andamento.

**Correção.**

- O animal só é gravado quando muda. A 2ª execução não escreve nada: pesagens, animais, permanências e movimentos.
- Por bloco de 250 animais, numa transação, as leituras são feitas de uma vez (`anyOf`). As categorias são lidas
  uma vez por execução.
- `signal.aborted` interrompe entre blocos. O que foi feito fica consistente, e reexecutar termina o restante.
- A tela mostra "feitos de total" e tem o botão **Cancelar**.

**Medição no Electron real** (`npm run perf:reconcile:electron`). Motor: Electron 44.9.3 / Chromium 152, IndexedDB
real, perfil temporário. Base sintética de 3 pesagens por animal. Tempos em segundos; p50 e p95 por bloco de
animais, em ms.

| Animais | Versão | 1ª execução (s) | Animais/s | Bloco p50 / p95 (ms) | 2ª execução (s) | 2ª: bloco p50 / p95 (ms) | 2ª grava algo? |
|---|---|---|---|---|---|---|---|
| 1.000 | ANTES (`479e653`, blocos de 200) | 9,3 | 107 | 1.903 / 2.058 | 5,3 | 1.083 / 1.207 | **sim** |
| 1.000 | DEPOIS (blocos de 250) | 9,9 | 101 | 2.418 / 2.623 | **1,4** | 318 / 539 | não |
| 5.000 | ANTES | 47,2 | 106 | 1.877 / 2.256 | 24,4 | 987 / 1.113 | **sim** |
| 5.000 | DEPOIS | 44,5 | 112 | 2.205 / 2.725 | **5,7** | 251 / 520 | não |
| 12.000 | ANTES | 127,4 | 94 | 2.095 / 2.732 | 61,8 | 956 / 1.469 | **sim** |
| 12.000 | DEPOIS | **99,3** | 121 | 2.015 / 2.628 | **14,5** | 262 / 491 | não |

Leitura da tabela:

- No IndexedDB real, o custo é **linear**, e 12 mil animais nunca chegaram a 20 min: antes eram 2 min 7 s.
- A 1ª execução, que cria tudo, caiu 22 % em 12 mil animais.
- A 2ª execução, numa base já coerente, que é o uso comum, ficou **4 vezes mais rápida** e não grava nada.
- O bloco p95 fica abaixo de 2,8 s em todos os casos.

O cancelamento para depois do 1º bloco (250 de N), em todos os tamanhos.

**Node (`fake-indexeddb`, 1.000 animais).** Antes: 57,2 s na 1ª execução e 10,8 s na 2ª. Depois: 2ª execução em
3,6 s. A 1ª continua dominada pelo motor de teste.

**DEPOIS.** O gate barato `reconcile:derivations:verify` entra no `test:quick`. Ele usa 60 animais em blocos de 20
e confere a criação, a 2ª execução sem gravação e o cancelamento entre blocos. A medição pesada fica fora, em
`perf:reconcile:electron` e `perf:reconcile:node`.

## R09 — Regressões entre telas

O gate `cross:surface:verify` entra no `test:quick` e no `test:full`. Ele confere:

1. **Entrada sem peso seguida de Cadastro.** O Cadastro adota o animal pendente; fica uma entrada no livro.
2. **Saída confirmada e cancelada.** O animal volta a ATIVO, e o inventário volta ao saldo anterior.
3. **Movimentação interna de lote.** O rebanho fica igual, e o lote de destino mostra a transferência interna
   recebida.
4. **Peso manual × operação × balança.** A regra é a mesma: a operação grava 328,5 como 328, e o campo da balança
   mostra "328".
5. **Backup v8 pelo fluxo novo de restauração.** Ele migra para v9, sai com `recuperacaoCompleta` e cria a operação
   legada.
6. **Exportação JSON de pesagens.** A restauração a recusa: não é backup.
7. **Esquemas antigos.** `STORES_V7` e `STORES_V8` têm a impressão digital **igual à da 1.5.6**, ou seja, nenhuma
   edição no lugar.

Os demais cruzamentos ficam nos gates de cada achado:

- **Desempenho:** R08.
- **Abate no Lançamento:** R05.
- **v8→v9:** `migration:v9:verify`.

## Gates novos

| Script | Achado | Onde roda |
|---|---|---|
| `safety:backup:verify` | R01 | `test:quick` e `test:full` |
| `restore:preflight:verify` | R02 | `test:quick` e `test:full` |
| `backup:availability:verify` | R03 | `test:quick` e `test:full` |
| `rollback:v8:verify` | R04 | à mão (precisa da 1.5.x) |
| `reconcile:derivations:verify` | R08 | `test:quick` e `test:full` |
| `perf:reconcile:electron` e `perf:reconcile:node` | R08 | medição pesada, à mão ou em job separado |
| `cross:surface:verify` | R09 | `test:quick` e `test:full` |

R05, R06 e R07 entram nos testes unitários e em `sanity:posology:verify`.

## Risco residual

- **P16** (balança S3 física) e **P18** (proteção da `main`) continuam **BLOQUEADOS**.
- **R04:** os passos de instalador no Windows estão **BLOQUEADOS PARA HOMOLOGAÇÃO WINDOWS**.
- **R02:** o diálogo nativo de seleção não é dirigido pelo E2E. Os módulos do processo principal são testados
  diretamente.
- **R07:** a edição de pesagem e a importação mantêm os decimais, como antes da missão.
- **R08:** a 1ª reconciliação de 12 mil animais leva cerca de 1 min 40 s no Electron. Ela tem andamento e
  cancelamento.
