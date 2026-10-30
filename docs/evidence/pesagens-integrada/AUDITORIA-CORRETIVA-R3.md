# Auditoria corretiva R3 — PR #4, Pesagens 1.6.0

| Campo | Valor |
|---|---|
| Missão | `PESAGENS-PR4-R3-GATES-INTEGRIDADE-RECUPERACAO-2026-10-30` |
| Branch | `claude/pesagens-estabilizacao-e-gestao-integrada-01` |
| PR | #4, em **DRAFT** |
| HEAD auditado (R2) | `b3f8b618a5f62216d4914e3a0c73edd171bf0c63` |
| `main` | `9392274972d41efb29007122c7a9ed826be9b283`, não alterada |
| Commits da R3 | `f102e6d` (R3-03), `aee8303` (R3-01/R3-02), `7ea8880` (custo da conferência), mais o commit desta documentação |
| Versão | app 1.6.0, Dexie v9 aditiva, backup formato 3. Sem v10, `STORES_V7`/`STORES_V8` intactos |

## Método

Cada achado foi tratado na mesma ordem:

1. reproduzido **VERMELHO** em `b3f8b61`, num worktree isolado;
2. corrigido;
3. provado **VERDE** na branch.

O roteiro de reprodução foi `scripts/red-r3.mjs`, um arquivo temporário do worktree que não foi versionado. Ele roda
sobre `fake-indexeddb`, com dados sintéticos e uma pasta temporária.

Esse roteiro não serve para provar o VERDE no HEAD. Ele chama os pontos de falha sem a trava nova (veja "Ponto de
falha só nos gates") e não tem a ponte do marcador em arquivo. A prova VERDE são os gates novos e os gates
atualizados, que exercitam as mesmas hipóteses pelo código real.

**Saída VERMELHO em `b3f8b61`** (`node scripts/red-r3.mjs`):

```text
{"hipotese":"R3-02 sucesso","recuperacaoCompleta":true,"erro":null}
{"hipotese":"R3-02 compensação","erro":"BACKUP_RESTAURACAO_REVERTIDA","compensado":true}
{"hipotese":"R3-01 histórico falhando","erro":null,"mensagem":"histórico indisponível (simulado)","escritaPermitida":true}
{"hipotese":"R3-01 crítico no processo","erro":"BACKUP_RESTAURACAO_CRITICA","escritaPermitida":false}
{"hipotese":"R3-01 reinício","escritaPermitidaAposReiniciar":true,"marcadoresNaPasta":["backups"]}
{"hipotese":"R3-03 carência não informada","resultado":{"null":0,"vazio":0,"branco":0,"false":0}}
```

O que cada linha mostra:

- **R3-02 sucesso.** O peso de uma pesagem foi alterado depois da troca da base, com as contagens iguais. A
  restauração terminou com `recuperacaoCompleta: true`.
- **R3-02 compensação.** O conteúdo foi alterado depois da compensação. Mesmo assim ela foi dada como bem-sucedida
  (`REVERTIDA`, `compensado: true`), porque só as contagens eram conferidas.
- **R3-01 histórico falhando.** No ramo crítico, a gravação no histórico de backup falhou. O erro original sumiu (o
  erro devolvido foi o do histórico) e a escrita ficou **liberada**.
- **R3-01 crítico no processo.** O bloqueio existia, mas só na memória.
- **R3-01 reinício.** Num processo novo, a escrita voltava a ser permitida. Nenhum marcador ficava na pasta de dados.
- **R3-03.** No esclarecimento de carência, `null`, `''`, `'  '` e `false` eram gravados como **0 dia**.

| Achado | Classificação | Gravidade |
|---|---|---|
| R3-01 | CONFIRMADO | crítico |
| R3-02 | CONFIRMADO | crítico |
| R3-03 | CONFIRMADO | alto |

---

## R3-01 — O estado crítico sobrevive a reiniciar

**Defeito.** O estado crítico existia só na memória do processo: restauração falhou e a volta automática também. Ao
fechar e abrir o app, as gravações voltavam numa base possivelmente inconsistente. Além disso, a gravação no
histórico vinha **antes** do bloqueio, e uma falha nela trocava o erro crítico por um erro comum.

**Correção.**

- **Marcador em arquivo.** `electron/ipc/criticalState.cjs` grava o arquivo `estado-restauracao-critica.json` na
  pasta de dados, fora do banco. A gravação é atômica:
  1. arquivo temporário;
  2. `fsync`;
  3. `rename`;
  4. `fsync` da pasta.

  O conteúdo é mínimo e validado:
  - `codigo: RESTAURACAO_CRITICA`;
  - o instante;
  - a fase, de uma lista fechada;
  - o nome do backup de segurança (só o nome do arquivo, conferido por expressão regular);
  - o SHA-256 do backup de segurança (64 dígitos hexadecimais).

  Não vão para o marcador: caminhos, senhas, payloads ou dados de animais.

  Os canais IPC são `app:critical-state-get`, `app:critical-state-set` e `app:critical-state-clear`, expostos no
  preload como `pesagemApp.criticalState`. Um marcador ilegível conta como crítico (fail-closed).
- **Cópia no banco.** A chave `restauracao:critica` em `appSettings` reforça o arquivo
  (`src/storage/criticalRestoreState.js`). Ela serve quando o arquivo não pôde ser gravado. Não há esquema novo.
- **Bloqueio na abertura.** `bootstrapLocalDb` lê o marcador **antes** de abrir e migrar o banco. A primeira
  `ensureReady` do processo lê de novo, já com o banco aberto (cópia em `appSettings`).

  Se o IPC der erro, também conta como crítico. O bloqueio crítico fica numa vaga própria (`criticalBlock`) de
  `migrationState.js`:
  - `clearWriteBlock` (da migração) não o apaga;
  - `assertWritable` recusa com `RESTAURACAO_CRITICA` e com o caminho de recuperação;
  - o login continua possível (`usuarios` e `auditoria`, como no bloqueio de migração).
- **Ordem no ramo crítico.** A ordem passou a ser:
  1. bloqueio em memória;
  2. marcador em arquivo e no banco;
  3. de novo o bloqueio em memória, agora com onde ele ficou gravado;
  4. só então o histórico, protegido por `try/catch`.

  Uma falha no histórico não muda o erro, que continua `BACKUP_RESTAURACAO_CRITICA`. Se o arquivo não pôde ser
  gravado, a mensagem diz: "o marcador em arquivo NÃO pôde ser gravado ... NÃO feche o aplicativo antes de
  restaurar".
- **Liberação.** O estado crítico só sai depois de uma restauração **conferida**: conteúdo, anexos e integridade.

  O canal `clear` só aceita `motivo: 'restauracao-verificada'` com o SHA-256 do conteúdo restaurado. Qualquer outro
  pedido é recusado com `CRITICO_LIBERACAO_INVALIDA`.

  A liberação vai para um histórico `.jsonl` ao lado do marcador e para o histórico de backup
  (`restore-critical-cleared`). Uma restauração de recuperação que falhe mantém o marcador.
- **Tela e guia.** A página Backup e Restauração mostra a faixa "Estado CRÍTICO" com o nome e o SHA-256 do backup
  de segurança e com o caminho de saída. O guia `docs/user/BACKUP-E-RESTAURACAO.md` §"Estado crítico" diz que o
  bloqueio sobrevive a reiniciar e que não se usa reset nem limpeza.

**VERDE** — `npm run restore:critical-restart:verify` (gate novo). Os cenários de "processo novo" rodam em
processos filhos de verdade (`node`), pela abertura real do app (`bootstrapLocalDb`), apontando para a mesma pasta
de dados:

```text
R3-01 crítico: marcador atômico na pasta de dados (código, instante, fase, nome e SHA-256 do backup de segurança — sem caminho nem dados), escrita bloqueada
R3-01 processo novo na MESMA pasta: escrita bloqueada (também depois de clearWriteBlock), login liberado; outra pasta: livre
R3-01 recuperação que falha: marcador e bloqueio continuam (também ao reabrir)
R3-01 recuperação conferida: marcador limpo e auditado; reabrir → escrita e CRUD normais
R3-01 histórico falhando no ramo crítico: erro continua CRÍTICO, escrita bloqueada, marcador gravado
R3-01 marcador em arquivo impossível: CRÍTICO avisa "NÃO feche"; cópia em appSettings reinstala o bloqueio
R3-01 bloqueio de migração continua funcionando e independente do crítico
```

`restore:compensation:verify` (R2-02) continua verde com a ponte do marcador.

**Limites.**

- No gate, o `fake-indexeddb` vive na memória de cada processo. Num processo filho, quem reinstala o bloqueio é o
  **arquivo**.
- A cópia em `appSettings` foi provada reabrindo no mesmo processo, numa conexão nova.
- No Electron real, as duas cópias valem. A abertura do app e as regressões ficam no E2E, mas uma reinicialização
  crítica no Electron real não foi encenada.

### Ponto de falha só nos gates

`faltasRestauracaoParaTestes` (os pontos de falha dos gates) só age quando `globalThis.__PESAGENS_GATE_FALTAS__ ===
true`. Essa variável só é definida pelos scripts de gate e não existe no app. O ponto `compensacao-aplicada` (depois
da compensação) foi incluído para provar o R3-02.

---

## R3-02 — A conferência compara o conteúdo, não só as contagens

**Defeito.** Depois de restaurar e depois de compensar, a conferência comparava só as quantidades por store. Uma
pesagem com outro peso, um brinco trocado ou um documento alterado passavam como "recuperação completa".

**Correção.** `src/storage/indexedDb/backup/contentIntegrity.js` → `conferirConteudoRestaurado(db, storesDoBackup,
{ migracao })`:

- **Comparação.** Para cada store do backup, cada registro precisa existir no banco com o **mesmo conteúdo
  canônico**:
  - a identidade é o `id` ou a `key`;
  - um registro sem identidade é comparado por multiconjunto;
  - o canônico é o JSON com as chaves ordenadas, sem `localId`, a chave técnica do Dexie;
  - um registro a mais no banco também é divergência.
- **Impressão digital.** Cada store recebe um SHA-256 dos canônicos ordenados pela identidade, do lado do backup e do
  lado do banco. O valor vai para `result.conferenciaConteudo.impressoes`, junto com o tempo de cada etapa.
- **Exceções explícitas**, todas no cabeçalho do módulo:
  - `backupHistory` não é comparada, porque recebe o registro da própria restauração;
  - em `appSettings`, ficam fora só as chaves técnicas `migration:*`, `derivados-saida-v1`, `backup-periodic-lock` e
    `restauracao:critica`.
- **v8 → v9 por contrato.** As tolerâncias foram medidas num backup v8 de verdade. A primeira versão tolerava também
  `origem`, mas a medição mostrou que não era preciso, e essa tolerância saiu.
  - Stores que não existiam no backup não são comparadas.
  - `movimentosAnimais`: ficam fora os campos que a v9 preenche (`natureza`, `operacao_id`, `updated_at`).
  - `pesagens`: ficam fora `updated_at` e os derivados que o passo E1G recalcula em `legacy_payload` (`data_anterior`,
    `peso_anterior`, `dias`, `ganho`, `gmd`).
  - `auditoria` pode ganhar registros da migração. Os registros do backup continuam exigidos e inalterados.
- **No fluxo.**
  - Na fase de conferência da restauração, uma divergência gera `CONFERENCIA_FINAL`. Daí vêm a compensação e
    `BACKUP_RESTAURACAO_REVERTIDA`, nunca `recuperacaoCompleta: true`.
  - A compensação confere o próprio resultado contra o conteúdo do backup de segurança. Se houver divergência, o
    resultado é **CRÍTICO** persistente (R3-01).

**VERDE** — `npm run restore:content-integrity:verify` (gate novo). A leitura é a do Dexie real, sobre
`fake-indexeddb`:

```text
R3-02 peso de pesagem alterado com contagens iguais: detectado na conferência de conteúdo e revertido
R3-02 identificação do animal alterado com contagens iguais: detectado na conferência de conteúdo e revertido
R3-02 documento alterado com contagens iguais: detectado na conferência de conteúdo e revertido
R3-02 movimento alterado com contagens iguais: detectado na conferência de conteúdo e revertido
R3-02 compensação com conteúdo divergente e contagens iguais: CRÍTICO persistente; recuperação conferida libera
R3-02 compensação com conteúdo divergente e contagens iguais + histórico quebrado: CRÍTICO persistente; recuperação conferida libera
R3-02 casos bons: v9→v9 com e sem anexo e v8→v9 (migração) — conteúdo conferido
```

Nos casos de reversão, o gate confere que o banco ficou **idêntico** ao de antes, comparando a impressão de todas as
stores.

**Custo medido no Electron real.** `xvfb-run -a node scripts/bench-import-electron.mjs 12000 3`, com Electron
44.9.3, Chromium 152, IndexedDB real, perfil temporário e massa sintética. O resultado completo está em
`R3-BENCH-CONFERENCIA-ELECTRON.txt`.

| Versão | `conferirConteudoRestaurado` (36k pesagens, ≈111k registros) | Heap ao fim |
|---|---|---|
| Primeira (serialização recursiva, impressão calculada duas vezes) | 17,7 s | 1135 MB |
| Final (JSON nativo com chaves ordenadas, impressão pela identidade, uma conta só quando idêntico) | **8,1 s** | 584 MB |

Por store, na versão final:

- `pesagens` (37.200): 2,6 s;
- `auditoria` (37.212): 4,4 s;
- as demais: menos de 0,5 s cada.

Em base pequena, nos gates: cerca de 10 ms. O custo só existe na restauração e, quando ela falha, na compensação.
O uso diário e a abertura do app não pagam esse custo. A abertura ganhou só uma leitura de marcador (um IPC e um
`get` em `appSettings`). Ela é coberta pelo E2E, e o `main:boot:verify` passou a exigir os três canais novos.

---

## R3-03 — Carência não informada nunca vira zero

**Defeito.** O esclarecimento de carência (`clarifyWithdrawal`) convertia a entrada com `Number(...)`. Por isso
`null`, `''`, espaços e `false` viravam **0 dia**, e a carência pendente sumia sem que ninguém tivesse dito "zero".

**Correção.**

- **Domínio.** `src/modules/sanity/domain/posology.js` ganhou `parseWithdrawalDays`. Ela só aceita:
  - um número inteiro de 0 a 9999;
  - um texto `^\d{1,4}$` depois de tirar os espaços.

  São recusados:
  - `null`, `undefined`, `''` e só espaços;
  - `false` e `true`;
  - `NaN`, decimais e negativos;
  - objetos e listas;
  - separadores como `1.000` e `1,5`.

  `validateWithdrawalClarification` exige `zero_confirmado === true` para aceitar 0. A recusa sai como
  `ESCLARECIMENTO_INVALIDO`.
- **Persistência.** `sanityDataAdapter.clarifyWithdrawal` valida de novo antes de gravar e guarda `zero_confirmado` em
  `carencia_esclarecimento`.
- **Tela.** O diálogo envia o texto como digitado e tem a caixa "Confirmo que a fonte indica carência de 0 dia".
- **Guia.** Atualizado em `docs/user/SANIDADE.md`.

**VERDE.**

- `posology.test.js` tem um teste novo com 19 entradas inválidas, zero sem confirmação (recusado), zero confirmado
  (aceito) e dias válidos.
- `npm run sanity:posology:verify` passou a cobrir:
  - o serviço e o adaptador recusam o vazio, e a aplicação e a auditoria ficam inalteradas;
  - o abate continua bloqueado;
  - o zero confirmado libera.

---

## Gates no HEAD da R3

GATES_R3

## Regressões conferidas

Todos verdes no HEAD da R3, nos gates da tabela acima:

- backup parcial (`backup:partial:verify`);
- migração v9 (`migration:v9:verify`; o caso v8 → v9 também em `restore:content-integrity:verify`);
- pesagens e integridade (`weighing:integrity:verify`, `storage:all:verify`);
- operações e inventário (`livestock:operations:verify`);
- sanidade (`sanity:posology:verify`);
- regressões entre telas (`cross:surface:verify`);
- E2E no Electron real.

## Pendências externas (inalteradas)

- **P16.** Homologação física da balança S3 no Windows.
- **P18.** Proteção da branch `main`, configuração do proprietário.
- **R04.** Volta pelo instalador no Windows real, com `PESAGENS_USER_DATA_DIR`.
- **Cópia isolada do banco real.** Teste a ser feito pelo proprietário.

Nada disso foi feito nem simulado aqui. Os 52 itens **não** são declarados homologados.
