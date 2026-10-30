# Auditoria corretiva R2 — PR #4, Pesagens 1.6.0

| Campo | Valor |
|---|---|
| Missão | `PESAGENS-PR4-AUDITORIA-CORRETIVA-R2-PROTECAO-INTEGRIDADE-CI-2026-10-30` |
| Branch | `claude/pesagens-estabilizacao-e-gestao-integrada-01` |
| PR | #4, em **DRAFT** |
| HEAD auditado (R1) | `a14bc3fa9ef3cc8763bc91822d0a29ef422ed330` |
| `main` | `9392274972d41efb29007122c7a9ed826be9b283`, não alterada |
| Versão | app 1.6.0, Dexie v9 aditiva, backup formato 3. Sem v10 |

## Método

Cada achado foi feito na mesma ordem:

1. reproduzido **VERMELHO** em `a14bc3f`, num worktree isolado, com o teste novo ou com um trecho dele;
2. corrigido com a menor mudança coerente;
3. provado **VERDE** na branch.

Só foram usados dados sintéticos, pastas temporárias, `fake-indexeddb` e perfis temporários do Electron. Os mocks
ficaram restritos ao que não dá para forçar num banco sintético:

- a falha de gravação de anexo;
- os pontos de falha depois da troca da base, por `faltasRestauracaoParaTestes`, que é nulo fora dos gates.

| Achado | Classificação | Gravidade |
|---|---|---|
| R2-01 | CONFIRMADO | crítico |
| R2-02 | CONFIRMADO | crítico |
| R2-03 | CONFIRMADO | alto |
| R2-04 | CONFIRMADO | alto |
| R2-05 | CONFIRMADO: o `test:full` não terminava. A causa é o motor de teste, não o app | alto |
| R2-06 | CONFIRMADO: a conferência limitada a 3 backups não era declarada. As demais coerências foram verificadas por testes | — |

---

## R2-01 — Backup parcial não é proteção completa

**Evidência estática.** `createBackupNow({ aceitarAnexosAusentesNaOrigem: true })` gravava a verificação com
`ok: true, incompleto: true`. Em `getBackupStatus` havia duas falhas:

- `ultimaVerificacao` e os candidatos aceitavam essa verificação como `VERIFICADO`;
- `conferirAgora` pulava os anexos ausentes.

O resultado era `protecao = 'VERIFICADO'` com `lastVerified` apontando para o parcial. A tela dizia "Protegido" e o
periódico era adiado.

**VERMELHO** (`scripts/verify-backup-partial.mjs` rodado em `a14bc3f`):

```text
AssertionError: (b) parcial não é proteção
```

**Correção** (`maintenanceDataAdapter.getBackupStatus`, `backupPolicy.coverage`, `BackupRestauracao.jsx`):

- **Catálogo.** A verificação parcial vira o estado **PARCIAL**. Ela fica fora de `lastVerified`, de "Verificado em"
  e dos candidatos a "íntegro agora".
- **Proteção.** `protecao = 'PARCIAL'` quando só existe o parcial, com o motivo explicado. A cobertura `PARCIAL` nunca
  é OK nem valida a cópia externa.
- **Histórico e arquivo.** Ficam preservados (`ultimoParcial`). A retenção não remove os backups `pre-*`.
- **Tela.** Mostra o aviso "não conta como proteção completa".
- **Exceção.** Continua só na restauração e depende de confirmação separada, depois de uma recusa. Importar, limpar e
  fazer o reset não a aceitam.

**VERDE.** O gate `backup:partial:verify` cobre os casos (a)–(g):

| Caso | Resultado |
|---|---|
| (a) | o backup completo protege |
| (b) | o parcial é criado como PARCIAL e não protege |
| (c) | o periódico continua devido |
| (d) | o histórico fica, e a retenção não apaga |
| (e) | o completo anterior continua sendo a proteção |
| (f) | importar, limpar e reset recusam o pré-backup parcial |
| (g) | a tela rotula o parcial |

`backup:availability`, `safety:backup` e `backup:center` continuam verdes.

## R2-02 — Compensação cobre todo o pós-commit da restauração

**Evidência estática.**

- Em `applyRestoreBackup`, só a falha de `commitStage` compensava. Se `storage.applyRestore` gravasse e depois
  lançasse (migração ou backfill), o código descartava o preparo e subia o erro cru, com a base já trocada.
- `runSaidaDerivedBackfill()` não lança: devolve `{ error }`, e esse valor era ignorado.
- Uma divergência na conferência final só virava `recuperacaoCompleta = false`.

**VERMELHO** (em `a14bc3f`, com `storage.applyRestore` envolvido para lançar depois de gravar):

```text
RED-R2-02 {"erro":{"code":null,"message":"backfill falhou depois de gravar (simulado)"},"bancoMudou":true}
```

**Correção.**

- **Fases que podem mudar a base.** Há pontos de falha nomeados: `banco` (inclui migração e backfills), `anexos`,
  `derivados` (o retorno com `error` agora é falha) e `conferencia` (contagens e anexos inesperados).
- **Compensação.** Qualquer falha nessas fases aciona `compensarRestauracao`:
  - relê o backup de segurança e confere o SHA-256;
  - restaura esse backup;
  - **confere as contagens**.

  Ela é idempotente. O erro sai como `BACKUP_RESTAURACAO_REVERTIDA`, e o histórico `restore-compensated` registra a
  fase.
- **Se a compensação também falhar.** O erro é `BACKUP_RESTAURACAO_CRITICA`, com a mensagem "RESTAURAÇÃO NÃO
  CONCLUÍDA E BASE POSSIVELMENTE INCONSISTENTE". As **gravações ficam bloqueadas na sessão** (`RESTAURACAO_CRITICA`),
  o histórico ganha `restore-critical`, e o backup de segurança é indicado pelo nome e pelo SHA-256. Restaurá-lo
  desbloqueia.
- **Limite documentado.** Não existe transação única entre IndexedDB e disco. Os anexos são endereçados pelo
  conteúdo e nunca são sobrescritos quando íntegros, então o estado antigo deles permanece. O que volta é o banco.
- **Identidade do conteúdo.** Com arquivo selecionado, o arquivo é reconferido **mesmo sem anexos**. O conteúdo em
  memória precisa ser o do arquivo: o SHA-256 do conteúdo é lido no processo principal. Se não for, sai
  `BACKUP_CONTEUDO_DIVERGENTE`.
- **Assistente.** `restoreGuided` exige a seleção para backup comum (`BACKUP_SELECAO_INVALIDA`), então não há desvio
  chamando o serviço fora da tela. O logout só acontece depois de uma restauração aplicada e conferida. Em caso de
  falha, a tela mostra "NÃO concluída", sem logout.

**VERDE.** Gate `restore:compensation:verify`:

| Cenário | Resultado |
|---|---|
| Erro depois da transação | revertida na fase `banco`, banco idêntico por hash |
| Erro nos derivados | revertida na fase `derivados`, banco idêntico |
| Divergência real (um registro apagado depois da troca) | revertida na fase `conferencia`, banco idêntico |
| Compensação falhando | CRÍTICO, gravação bloqueada, backup de segurança íntegro; restaurá-lo libera |
| Conteúdo em memória diferente do arquivo (sem anexos) | recusado sem mudar nada |
| Assistente sem a seleção | recusado |
| v9→v9 e v8→v9 (migração) | `recuperacaoCompleta` |

Os gates de antes continuam verdes. `restore:preflight` cobre pasta ausente, anexo ausente ou adulterado com o mesmo
tamanho, arquivo trocado, falha de preparo, falha ao efetivar, `.pbk` com senha errada ou anexo adulterado e `.pbk`
íntegro.

## R2-03 — Carência desconhecida não expira por decurso de tempo

**Evidência estática.** `withdrawalStatus()` só contava a aplicação DESCONHECIDA se `data >= data_saida - 180 dias`.

**VERMELHO** (`a14bc3f`):

```text
{"dias":180,"desconhecidas_que_bloqueiam_abate":1}
{"dias":181,"desconhecidas_que_bloqueiam_abate":0}
{"dias":365,"desconhecidas_que_bloqueiam_abate":0}
```

**Correção** (`sanity/domain/posology.js`, adaptadores de operação e de pesagem, `sanityDataAdapter`, Sanidade ›
Aplicações).

- **Sem prazo de validade.** Toda aplicação DESCONHECIDA continua pendente, com qualquer idade. Os 180 dias só marcam
  `recente`, que é a prioridade do alerta.
- **Política única.** `withdrawalExitPolicy` vale para a operação de Saída **e** para o Lançamento, sem desvio por
  `aceitarAvisos`:
  - **abate:** bloqueia carência aberta ou desconhecida;
  - **venda, transferência e doação:** geram aviso.
- **Liberação técnica.** Para cobrir os tratamentos, ela precisa de responsável e de data **no dia ou depois do
  tratamento**. A desconhecida exige também **evidência**.
- **Esclarecimento** (`clarifyWithdrawal`). Registra o prazo em dias, a fonte (bula, receituário ou laudo) e o
  responsável, recalcula o fim da carência pela data da aplicação e audita (`ESCLARECER_CARENCIA_SANIDADE`). A ação
  fica em Sanidade › Aplicações. É assim que tratamentos antigos são regularizados.
- **Os seis casos continuam separados:** ZERO, ABERTA, ENCERRADA, CANCELADA, DESCONHECIDA (inclui registro antigo sem
  `carencia_conhecida`) e SEM_MEDICAMENTO.

Isto é **proteção operacional**, não decisão veterinária automática. Nenhuma exigência legal foi inventada.

**VERDE.**

- **Testes unitários:**
  - 0, 35, 150, 180, 181, 365 e 1000 dias;
  - registro sem o campo `carencia_conhecida`;
  - aplicação esclarecida;
  - carência zero e encerrada;
  - liberação sem evidência, datada antes do tratamento e válida;
  - venda, transferência e doação com aviso.
- **Gate `sanity:posology:verify`:**
  - aplicação de 292 dias bloqueia o abate no Lançamento e na operação, mesmo com `aceitarAvisos`;
  - liberação datada antes do tratamento não cobre;
  - venda gera aviso;
  - o esclarecimento é auditado, e depois dele o abate passa.

## R2-04 — Indeterminado no período não é indeterminado na data final

**Evidência estática.** `inventory.js` incluía em `indeterminados` todo animal com algum trecho INDETERMINADO que
cruzasse o período. Isso incluía quem tinha local conhecido no fim. Somado aos saldos por propriedade, o animal era
contado duas vezes, e `fecha` ficava falso.

**VERMELHO** (testes novos de `inventory.test.js` rodados em `a14bc3f`):

```text
expected [ 'K', 'L' ] to deeply equal [ 'L' ]   (K já em P2 no fim, contado como indeterminado)
expected 3 to be 2                              (P1 + P2 + indeterminados conta K duas vezes)
```

**Correção.**

- `indeterminados_no_fim` são os animais sem local **exatamente** na data final. É a categoria da conciliação.
- `incerteza_historica` é só alerta, sem divergência.
- `fecha` usa só os do fim. `indeterminados` foi mantido como apelido de `indeterminados_no_fim`, por compatibilidade.
- A tela e o CSV mostram as duas listas separadas, e o guia foi atualizado.
- A propriedade atual do animal continua fora da conta do passado.

**VERDE.** Os testes cobrem:

- entrada sem destino seguida de movimentação para P2: em março, P2 = 1 e indeterminado no fim = 0;
- animal indeterminado até o fim;
- saída posterior;
- consulta em data anterior;
- a soma **P1 + P2 + indeterminados no fim = rebanho total** em quatro períodos.

## R2-05 — Suíte completa: importação de 36 mil

**Evidência.** `test:full` executava `import:performance:verify`, que importa por padrão 12.000 × 3 = 36.000 linhas no
`fake-indexeddb`. No R1, a etapa ficou mais de 20 min sem terminar: o resultado foi 124 de 125 etapas.

**Medição antes de otimizar.** `applyImport` em blocos de 200 animais; os tempos estão em segundos.

| Animais | `fake-indexeddb` (Node 22) | IndexedDB real (Electron 44.9.3 / Chromium 152) |
|---|---|---|
| 500 | 2,2 | — |
| 1.000 | 6,0 | 7,4 (total 10,6) |
| 2.000 | 18,0 | — |
| 4.000 | 65,4 (total 1 min 39 s) | 19,8 (total 24,5) |
| **12.000 × 3 = 36.000** | **640,1 (total 16 min 21 s; retroativos 333,7 s; heap até 930 MB)** — terminou, conferências OK | **69,6 (total 85,3)** |

**Detalhe dos 36.000 no Electron real.**

| Fase | Tempo |
|---|---|
| Leitura | 89 ms |
| Análise em base vazia | 801 ms |
| Gravação | 69,6 s |
| Reanálise (100 % JÁ EXISTE) | 2,3 s |
| Reimportação sem gravar | 2,6 s |
| Análise dos retroativos | 1,2 s |
| Gravação dos retroativos (10 %) | 7,9 s |

Todas as conferências passaram: contagens, deduplicação, idempotência e só as séries afetadas. O heap ficou em até
194 MB.

**Leitura.** No `fake-indexeddb` o custo é **~N²**: dobrar a massa multiplica o tempo por 3 a 3,4. A causa é o
motor de teste, que varre o índice a cada gravação (o mesmo efeito medido no R08). No IndexedDB real o custo é
aproximadamente linear, e 36 mil terminam em 1 min 25 s. Não há gargalo do aplicativo que justifique mudar o
algoritmo de importação, então ele **não foi alterado**.

**Correção (separação, sem afrouxar).**

- `scripts/lib/importBenchCore.mjs`: a mesma importação e as mesmas conferências rodam no Node e no Electron.
- `test:full` passa a usar `import:contract:verify`: 600 × 3, determinístico, cerca de 4 s, e confere importação,
  deduplicação, reimportação, idempotência, retroativos e integridade.
- **Capacidade**, fora das suítes:
  - `perf:import:electron`: 36.000 linhas no IndexedDB real;
  - `perf:import:node`: 36.000 linhas no `fake-indexeddb`;
  - `import:performance:verify` agora aponta para o `perf:import:node`.
- `cross:surface:verify` (R2-06) cobre a importação na v9: entrada única, inventário, GMD, reimportação, edição e
  cancelamento.

## R2-06 — Coerência final

- **Conferência limitada a 3 candidatos.** Com os 3 backups mais novos corrompidos e um 4º íntegro, o status agora
  declara `conferenciaLimitada: { conferidos: 3, naoConferidos: 1 }`, explica no motivo e na tela que o 4º não foi
  relido, e orienta a usar Verificar. Removidos os corrompidos, o íntegro volta a proteger.
  - **VERMELHO** em `a14bc3f`: `AssertionError: limite da conferência declarado`.
  - **VERDE:** `backup:availability:verify`.
- **Importação × v9.** Veja R2-05. Lista e relatório continuam cobertos pelos gates de relatórios do `test:quick`.
- **Restauração.** A restauração de v8, v9 completo, `.pbk`, anexo ausente ou corrompido, arquivo trocado, senha
  errada e interrupção (estado crítico seguido de recuperação) está coberta por `restore:preflight`,
  `restore:compensation`, `documents:backup`, `backup:center` e `cross:surface`.
- **Nada alterado em:**
  - pesos gravados;
  - enums históricos;
  - identificação;
  - cálculo do GMD;
  - `STORES_V7` e `STORES_V8`.

  A impressão digital de `STORES_V7`/`V8` continua conferida no `cross:surface`.

## Gates

Execução local completa (Linux, Node v22.22.0, Electron 44.9.3, `xvfb-run`). O código é o mesmo do HEAD final;
só a documentação mudou depois.

| Comando | Resultado | Tempo |
|---|---|---|
| `npm ci` | OK | 19s |
| `npm run lint` | OK | 11s |
| `npm run test:unit` | OK | 11s |
| `npm run build` | OK | 13s |
| `xvfb-run -a npm run e2e:electron:verify` | OK | 37s |
| `npm run storage:all:verify` | OK | 24s |
| `npm run migration:v9:verify` | OK | 1s |
| `npm run backup:recovery:verify` | OK | 0s |
| `npm run documents:backup:verify` | OK | 1s |
| `npm run backup:center:verify` | FALHOU 1 vez (teste defeituoso, ver abaixo) → corrigido; OK 52/52 seguidas | 1s |
| `npm run safety:backup:verify` | OK | 1s |
| `npm run restore:preflight:verify` | OK | 1s |
| `npm run backup:availability:verify` | OK | 0s |
| `npm run livestock:operations:verify` | OK | 1s |
| `npm run sanity:posology:verify` | OK | 0s |
| `npm run weighing:integrity:verify` | OK | 1s |
| `npm run cross:surface:verify` | OK | 1s |
| `npm run backup:partial:verify` | OK | 0s |
| `npm run restore:compensation:verify` | OK | 1s |
| `npm run import:contract:verify` | OK | 5s |
| `xvfb-run -a npm run test:quick` | OK | 110s |
| `xvfb-run -a npm run test:full` | OK | 152s |

**Falha encontrada na execução isolada de `backup:center:verify`.** O teste "adulterava" o `.pbk` trocando o 1º
caractere do texto cifrado por `A`. Quando o texto já começava com `A` (1 em 64), nada mudava, a decifração
funcionava e o teste acusava "Missing expected rejection". O defeito estava no **teste**, desde a B5; o app recusa
corretamente um envelope alterado. Agora o caractere sempre muda. Depois da correção, o gate passou 52 vezes
seguidas (12 + 40).

**Medições pesadas**, fora das suítes: `perf:import:electron` com 36.000 linhas levou 85 s, com conferências OK;
`perf:import:node` com 36.000 linhas levou 16 min 21 s, com conferências OK.

O `test:full` **terminou** (152 s), com `import:contract:verify` no lugar do benchmark de 36 mil. No R1, ele ficava
em 124 de 125 etapas.

## Riscos e pendências

- **P16**, a balança S3 física, continua **BLOQUEADO**.
- **P18**, a proteção da `main`, continua **BLOQUEADO**: é ação do proprietário.
- **R04**, a volta para a 1.5.x pelo instalador no Windows real, está **BLOQUEADO PARA HOMOLOGAÇÃO WINDOWS**.
- **Banco real:** não houve homologação numa cópia isolada do banco real. Não foi pedido nem usado nenhum dado real.
- **Bloqueio crítico:** só vale na sessão. Ao reabrir o app, a base fica como estava, com o registro `restore-critical`
  no histórico. O caminho indicado é restaurar o backup de segurança.
- **Desempenho no fake-indexeddb:** a importação de 36 mil continua ~N². Ela é medida à parte e não entra nas suítes.
