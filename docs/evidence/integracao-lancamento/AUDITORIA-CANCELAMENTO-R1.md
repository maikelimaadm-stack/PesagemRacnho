# PR #5 · R1 — cancelamento seguro de pesagem vinculada a operação

| Campo | Valor |
|---|---|
| Missão | `PESAGENS-PR5-R1-CANCELAMENTO-SEGURO-2026-10-30` |
| Branch / PR | `claude/pesagens-integracao-lancamento-rebanho-sanidade-01` · PR #5 (DRAFT) |
| HEAD auditado | `51a9a28420cc984024d9dfc9b9181d67643cfa45` |
| Base | `main` `be3d309` |
| Correção | `a5dbe0d` (código e testes), mais o commit desta documentação |
| Esquema | sem mudança: Dexie v9, nenhuma store, índice ou migração nova |

## Achado e reprodução

O achado foi confirmado por **execução**, não só por leitura do código.

A falha começa na tela: `handleExcluir` trata a falha de `findOperationOfEntry` como "sem vínculo". O
problema de fundo é que `weighingDataAdapter.bulkDeleteEntries` aceitava excluir sozinha uma pesagem que é o efeito
de uma operação confirmada, por qualquer caminho:

- `weighingService.bulkDeleteEntries`;
- `deleteEntry`;
- `deleteEntriesRespectingHistory` (Relação).

**VERMELHO em `51a9a28`.** Sonda isolada num worktree, com fake-indexeddb e dados sintéticos:

| Caso | Chamada | Resultado em `51a9a28` | Estado depois |
|---|---|---|---|
| Entrada COMPRA com peso | `bulkDeleteEntries([pesagem])` | aceitou (1 removida) | operação CONFIRMADA, item CONFIRMADO, **pesagem cancelada**, movimento de entrada ainda ativo |
| Saída VENDA | `deleteEntry(pesagem)` | aceitou | operação CONFIRMADA, item CONFIRMADO, pesagem cancelada, **movimento de saída sumiu, animal ATIVO** (o livro diz "vendido", o rebanho diz "ativo") |
| Lista mista `[Manejo, vinculada]` | `bulkDeleteEntries` | aceitou as 2 | a vinculada ficou cancelada com a operação confirmada |
| Entrada sem peso + 1ª pesagem adotada | Relação (`deleteEntriesRespectingHistory`) | aceitou | operação CONFIRMADA com o item apontando para uma pesagem cancelada |

Os testes novos rodados contra `51a9a28` também falham:

```text
launch:cancel-safety:verify → AssertionError: bulkDeleteEntries(Entrada): recusado com código estável
  actual: undefined   expected: 'PESAGEM_VINCULADA_OPERACAO'
ConfirmarExclusaoLancamentoDialog.test.jsx → 3 failed:
  × consulta do vínculo em andamento: não deixa confirmar
  × consulta do vínculo falhou: diz que nada foi apagado, não confirma e permite tentar de novo
  × consulta concluída com vínculo: vira cancelamento da operação
```

## Correção B — guarda no serviço (transação)

**`weighingDataAdapter.bulkDeleteEntries`** passou a fazer a conferência dentro da **mesma transação** Dexie
(com `operacoes` e `operacaoItens` no escopo), **antes** de marcar `deleted_at` em qualquer pesagem:

- **Regra.** Se alguma pesagem pedida é `pesagem_id` de um item ativo de uma operação CONFIRMADA (não LEGADO), a
  chamada é recusada com o erro `PESAGEM_VINCULADA_OPERACAO` e uma mensagem que orienta cancelar a operação.
- **Lista mista.** Tudo ou nada.
- **Alcance.** Vale para todos os chamadores: `bulkDeleteEntries`, `deleteEntry`, `deleteEntriesRespectingHistory`
  e a repesagem (`replaceEntries`, que só repesa Manejo).

**Exceção única.** É o cancelamento canônico, `operationsDataAdapter.cancelOperation`, que passa
`cancelamentoOperacaoId`. Ela só vale se as três condições forem verdadeiras:

1. a chamada está **dentro de uma transação** (`Dexie.currentTransaction`), a do `cancelOperation`;
2. o id é o **da operação daquele item**;
3. o item **já está CANCELADO** naquela transação.

A operação continua CONFIRMADA até o fim da mesma transação, e por isso a liberação não depende só do status do
item. Não existe um "ignorar proteção" genérico: o `weighingService` não repassa a opção.

Operações LEGADO (geradas das pesagens antigas) continuam corrigidas pela Relação, como antes.

## Correção A — tela fail-closed

- **`useVinculoOperacao`.** É um hook novo com os estados `carregando`, `erro` e `pronto`, este último com ou sem
  vínculo.
  - Cada consulta tem um número de sequência. A resposta atrasada de outro animal (ou de uma tentativa anterior) é
    descartada.
  - `vinculoConferido(estado, pesagemId)` só libera a exclusão com a consulta concluída **para aquela pesagem**.
- **Diálogo de exclusão.** Enquanto a consulta carrega ou se ela falhou, não dá para confirmar. Na falha, a tela
  diz "Não foi possível confirmar se o lançamento … pertence a uma operação. Nenhum dado foi apagado." e mostra o
  erro real e **Tentar de novo**.
  - **Com vínculo de um animal:** cancela a operação pelo `cancelOperation`, com motivo obrigatório.
  - **Com vínculo de vários animais:** fica bloqueado e orienta a usar Rebanho › Entradas/Saídas.
- **Falhas na gravação.** Se o cancelamento falhar, o diálogo e os dados ficam e o erro real aparece (nada é
  anunciado). Se o serviço recusar uma exclusão "sem vínculo" (o vínculo mudou depois da consulta), o diálogo fica
  e a consulta é refeita.
- **Sucesso.** O cancelamento confirma com um toast.
- **Relação de Pesagens.** A recusa agora mostra o motivo real, em vez de "Erro ao excluir".

## T01–T10

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| T01 | Consulta do vínculo falhando ou em andamento: sem caminho destrutivo, nada muda; corrida A/B; tentar de novo | PASS | `useVinculoOperacao.test.js` (4), `ConfirmarExclusaoLancamentoDialog.test.jsx` (3 novos, vermelhos em `51a9a28`); no Electron real, no E2E (T10) |
| T02 | Saída VENDA e Entrada vinculadas: `bulkDeleteEntries`, `deleteEntry` e a Relação recusados (`PESAGEM_VINCULADA_OPERACAO`), banco idêntico | PASS | `launch:cancel-safety:verify` |
| T03 | Lista `[Manejo, vinculada]` recusada inteira; as duas intactas | PASS | idem |
| T04 | `cancelOperation` de Saída e de Entrada (com aplicação): operação e item cancelados; pesagem, movimento e aplicação fora; saldo de volta; auditoria com motivo; sem órfãos | PASS | idem |
| T05 | Operação de 2 animais (Rebanho): nenhum sai sozinho; a tela sabe `quantidade: 2` (bloqueia); cancelamento canônico da operação inteira funciona | PASS | idem, mais o diálogo (operação com vários animais) |
| T06 | Entrada sem peso + 1ª pesagem adotada: exclusão isolada recusada; com Manejo posterior o cancelamento é recusado (`OPERACAO_CRONOLOGIA`); sem ele, cancela tudo | PASS | `launch:cancel-safety:verify` |
| T07 | Manejo sem operação: repesagem e exclusão continuam | PASS | idem, mais `weighing:repesagem:verify` |
| T08 | Erro injetado (hook Dexie) no meio do `cancelOperation`: rollback integral (impressão SHA-256 das stores igual), item e operação seguem CONFIRMADOS; nova tentativa cancela | PASS | `launch:cancel-safety:verify` |
| T09 | CONSULTA e sem sessão: não cancelam nem excluem (banco igual); OPERADOR (`weighing.edit`) cancela pelo caminho canônico | PASS | idem |
| T10 | Electron real, ver detalhes abaixo | PASS | `e2e:launch-integration:verify` (passo 3b), `e2e:electron:verify`, `telas/desfazer-consulta-falhou-1440.png` |

Detalhes do T10, no Electron real:

- Desfazer da Saída (Doação) **com falha injetada** na leitura do índice `operacaoItens.pesagem_id` do IndexedDB:
  o diálogo bloqueia e diz "Nenhum dado foi apagado"; o banco não muda.
- **Tentar de novo** mostra o cancelamento com motivo: a operação fica CANCELADA, o animal ATIVO e a saída fora do
  livro.
- Desfazer da Entrada (Compra) com motivo, no E2E principal.

## Arquivos

- **Serviço:**
  - `src/modules/weighing/infrastructure/weighingDataAdapter.js` (`assertNoConfirmedOperationLinks`;
    `bulkDeleteEntries` com `operacoes` no escopo; `REWEIGH_TABLES`);
  - `src/modules/livestock/infrastructure/operationsDataAdapter.js` (`cancelOperation` passa
    `cancelamentoOperacaoId`).
- **Tela:**
  - `src/components/pesagens/useVinculoOperacao.js` (novo);
  - `ConfirmarExclusaoLancamentoDialog.jsx`;
  - `src/pages/LancamentoPesagensIndividuais.jsx`;
  - `src/pages/PesagensIndividuais.jsx` (mensagem da recusa).
- **Testes:**
  - `scripts/verify-launch-cancel-safety.mjs` (novo, no `test:quick`/`test:full`);
  - `useVinculoOperacao.test.js` (novo);
  - `ConfirmarExclusaoLancamentoDialog.test.jsx`;
  - `scripts/verify-launch-integration-e2e.mjs`.

## Gates

GATES_CANCEL_R1

## Risco residual

- **Edição.** A edição de uma pesagem vinculada continua protegida pela guarda de edição da integração
  (`OPERACAO_VINCULADA`): tipo, motivo, data e animal não mudam.
- **Esquema.** Fora do escopo e sem mudança.
- **Homologações externas** ainda pendentes, não feitas aqui:
  - balança S3 física;
  - Windows real;
  - cópia isolada do banco real.
