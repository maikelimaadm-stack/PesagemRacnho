# Continuidade — missão pesagens-integrada

Este arquivo diz onde a missão está e como continuar sem refazer nada.

- **Branch:** `claude/pesagens-estabilizacao-e-gestao-integrada-01`
- **PR:** #4, que fica **DRAFT** até a decisão do proprietário.

## Estado

| Fase | Itens | Situação | Checkpoint (commits) |
|---|---|---|---|
| A0 | baseline, matriz, ADRs | feito | A0 |
| A1 | P01, P02, P03, P15, P16 | P16 bloqueado (balança física) | A1 |
| A2 | P04–P13, P17 | feito | A2 |
| A3/A4 | P19, P21, P24, P25, P26 (+ P18) | P18 bloqueado (configuração do GitHub, ação do proprietário) | A3, A4 |
| B0 | esquema v9, operações legadas | feito | B0 |
| B1a | F01, F02, F03, F17 | feito | B1a |
| B1b | F04, F05, F06, F07, F15 | feito | B1b |
| B2 | F08, F09, F10 | feito | B2 |
| B3 | F11, F12, F13, F14, F18 | feito | B3 |
| B4 | F16 | feito | B4 |
| B5 | F19–F26; fecha P14, P20, P22, P23 e P26 | feito | B5 |
| Final | versão 1.6.0 (sem tag), docs, rollback, desempenho | feito | final-hardening |
| R1 | auditoria corretiva R01–R09 (`AUDITORIA-CORRETIVA-R1.md`) | feito; R04 Windows bloqueado (homologação) | `fix(R1-R0x)`, `perf(R1-R08)`, `test(R1-R09)` |
| R2 | auditoria corretiva R2-01 a R2-06 (`AUDITORIA-CORRETIVA-R2.md`) | feito; `test:full` termina (36k medido à parte) | `fix(R2-0x)`, `test(R2-05/R2-06)` |
| R3 | auditoria corretiva R3-01 a R3-03 (`AUDITORIA-CORRETIVA-R3.md`), com 2ª passada no Electron real (login e faixa sob o estado crítico) | feito | `fix(R3-03)`, `fix(R3-01/R3-02)`, `perf(R3-02)`, `fix(R3-01)` |

A situação item a item (os 52, com evidência) está em `MATRIZ-52-ITENS.md`.

## O que depende de ação externa

- **P16 — balança S3 física.** Siga o roteiro `VALIDACAO-MANUAL-WINDOWS-S3.md` com a balança real no Windows.
  Os testes automáticos cobrem o portão de captura e o simulador no modo do S3 real. A homologação física não
  foi feita e **não deve ser declarada**.
- **P18 — proteção da branch main.** É uma configuração administrativa do GitHub, proibida pelo prompt da
  missão. A recomendação está em `RECOMENDACAO-P18.md`.
- **R04 — volta para a 1.5.x no Windows:** os dados estão verificados (`npm run rollback:v8:verify`). Os passos
  de instalador e de `PESAGENS_USER_DATA_DIR` no Windows real estão **BLOQUEADOS PARA HOMOLOGAÇÃO WINDOWS**. O
  roteiro está em `MIGRACAO-ROLLBACK.md`.
- **Homologação numa cópia isolada do banco real:** ainda não feita. O proprietário faz numa máquina de teste: copia a
  pasta de dados para um perfil separado (`PESAGENS_USER_DATA_DIR`), abre a 1.6.0 nessa cópia e confere a migração,
  o backup, a restauração e o inventário. Nenhum dado real foi pedido nem usado aqui.
- **Merge, tag e release:** somente pelo proprietário.

## Como verificar

```bash
npm ci
npm run test:quick
npm run build && xvfb-run -a npm run e2e:electron:verify
npm run test:full
```

Gates novos da missão (todos dentro de `test:quick` e `test:full`):

| Script | O que verifica |
|---|---|
| `weighing:integrity:verify` | integridade das pesagens (A2) |
| `backup:recovery:verify` | backup único verificado (A3) |
| `migration:v9:verify` | migração para o esquema v9 (B0) |
| `livestock:operations:verify` | Entradas, Saídas, Movimentações e Inventário (B1a) |
| `animal:profile:verify` | idade, identificadores e dossiê (B1b) |
| `sanity:posology:verify` | posologia, dose e carência (B2) |
| `analytics:forecast:verify` | desempenho, metas e projeção (B3) |
| `documents:backup:verify` | documentos e anexos no backup (B4) |
| `backup:center:verify` | central de backup (B5) |
| `safety:backup:verify` | R01: backup de segurança verificado; falha não altera nada |
| `restore:preflight:verify` | R02: anexos conferidos antes da troca da base; seleção vinculada; compensação |
| `backup:availability:verify` | R03: verificado × disponível × íntegro agora × cópia externa válida |
| `reconcile:derivations:verify` | R08: reconciliar idempotente e cancelável |
| `cross:surface:verify` | R09/R2-06: regressões entre telas e importação na v9 |
| `backup:partial:verify` | R2-01: backup parcial nunca é proteção completa |
| `restore:compensation:verify` | R2-02: compensação depois da troca da base; estado crítico |
| `restore:critical-restart:verify` | R3-01: estado crítico persistente; sobrevive a reabrir o app; só restauração conferida libera |
| `restore:content-integrity:verify` | R3-02: conteúdo conferido registro a registro (contagem igual não basta); v8→v9 por contrato |

O `test:full` usa `import:contract:verify` (600 × 3), que confere a correção da importação em massa pequena.

Verificações pesadas, fora do `test:quick`:

| Script | O que mede |
|---|---|
| `rollback:v8:verify` | R04, com o código real da 1.5.6 |
| `perf:reconcile:electron` (com `xvfb-run -a` no Linux) | R08, no Electron real |
| `perf:reconcile:node` | R08, no fake-indexeddb |
| `perf:import:electron` (com `xvfb-run -a`) | R2-05: 36.000 linhas no IndexedDB real; levou cerca de 85 s. R3-02: mede também a conferência de conteúdo (cerca de 8 s) |
| `perf:import:node` (o mesmo que `import:performance:verify`) | R2-05: 36.000 linhas no fake-indexeddb; cresce ~N² |

O E2E (`scripts/verify-electron-e2e.mjs`) percorre, no Electron real:

- o fluxo do curral e a balança;
- o backup e a manutenção;
- compra e inventário, com documento;
- identificadores e a ficha;
- posologias, parametrização e desempenho;
- o estado crítico de restauração ao reabrir (R3-01): login, aviso global e gravação recusada.

## Arquitetura

As decisões estão em `docs/arquitetura-produto/16-MISSAO-INTEGRADA.md`, nos ADR-051 a ADR-063. O modelo de
dados está em `17-MODELO-DADOS-V9.md`.

| Módulo | Conteúdo | Telas |
|---|---|---|
| `src/modules/livestock` | operações, inventário, idade, identificadores, dossiê | Rebanho › Entradas, Saídas, Movimentações e Inventário; Cadastros › Identificadores; Ficha do Animal |
| `src/modules/sanity` | posologia, dose e carência | Sanidade › Posologias; painel de Sanidade do Lançamento |
| `src/modules/analytics` | desempenho, calendário, metas, projeção, painel | Relatórios › Desempenho |
| `src/modules/documents` (com `electron/ipc/attachment*`) | documentos e anexos | quadro Documentos |
| `src/modules/backup` (com `electron/ipc/backup*`) | central de backup | Sistema › Backup e Restauração |

Telas reorganizadas:

- Configurações gerais;
- Parametrização (com as seções `ConfigSection`);
- Balança e Equipamentos;
- Manutenção avançada.

## Limites conhecidos

Cada limite também está documentado no ADR correspondente.

- Retorno de animal que já saiu não é aceito na Entrada (ADR-058).
- A identificação principal (número visual) continua sendo corrigida pela edição do Cadastro. O estoque controla
  brincos e códigos adicionais (ADR-059).
- O filtro de categoria do inventário usa a categoria atual (ADR-058). A tela e o CSV avisam isso. A era na data está
  no painel de Desempenho.
- R06: no inventário, a propriedade é a da data, pelo livro. Um animal sem propriedade registrada na entrada e sem
  movimentação interna fica com local INDETERMINADO e aparece listado. Ele não entra no saldo de nenhuma propriedade,
  a não ser que só exista uma propriedade cadastrada.
- O backup protegido aceita até 200 MB de anexos; acima disso, use o pacote comum (ADR-063).
- R3-01: o estado crítico tem duas cópias: um arquivo na pasta de dados e uma chave em `appSettings`. Se o arquivo
  não puder ser gravado, a tela pede para não fechar o app. A cópia no banco reinstala o bloqueio ao reabrir, desde
  que o banco ainda seja legível. Fora do aplicativo desktop (navegador), só existe a cópia no banco.
- R3-01: no Electron real, a reabertura com o marcador é coberta pelo E2E. A falha real de restauração e de
  compensação só é forçada nos gates em Node. A abertura do app não ficou mais lenta (`R3-ABERTURA-ELECTRON.txt`).
- R3-02: a conferência de conteúdo pós-restauração custa cerca de 8 s com 36 mil pesagens no Electron real
  (`R3-BENCH-CONFERENCIA-ELECTRON.txt`).
- A abertura do Lançamento com 36 mil pesagens já estava acima do orçamento antes da missão (aprox. 1,7 s;
  `BASELINE-E-GATES.md`).
