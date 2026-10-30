# Integração do Lançamento com Entradas, Saídas e Sanidade — relatório

| Campo | Valor |
|---|---|
| Base | `main` `be3d309` (merge da PR #4; app 1.6.0, Dexie v9) |
| Branch | `claude/pesagens-integracao-lancamento-rebanho-sanidade-01` (PR DRAFT) |
| Esquema | sem mudança: nenhuma v10, nenhuma store nova; `STORES_V7/V8/V9` intactos |
| Contrato | `CONTRATO-OPERACOES.md` (mapeamento tela → operação → movimento → pesagem) |

## Antes e depois

| | Antes (`be3d309`) | Depois |
|---|---|---|
| Entrada no Lançamento | Cadastro gravado só como pesagem; **nenhuma operação** no livro | Entrada com motivo (Compra, Transferência recebida, Nascimento, Ajuste) confirmada como operação, com ou sem peso |
| Saída no Lançamento | pesagem de Saída; **nenhuma operação** | Saída com motivo (Venda, Abate, Transferência enviada, Morte, Doação, Ajuste) confirmada como operação |
| Rebanho › Entradas/Saídas e Inventário | não viam o que foi feito no Lançamento | veem: é o mesmo livro e o mesmo serviço |
| Medicamento e posologia no Lançamento | só um link para a tela Sanidade | Novo/Editar/Consultar medicamento e Configurar/Consultar posologia em diálogo; catálogo e sugestão atualizados na hora |
| Por que não há dose | "sem posologia aprovada" para qualquer caso | situação real: sem posologia, rascunho, suspensa ou fora da vigência |
| Conferência da dose no serviço | aceitava "dose sugerida" vinculada a regra que não sugere (ex.: peso fora das faixas) | recalcula pela regra e pelo peso-base; exige regra aprovada e vigente, confirmação e peso-base igual ao peso gravado |
| Excluir uma Entrada/Saída no Lançamento | apagava a pesagem; a operação (quando existia) ficava | cancela a operação com motivo (auditado) |

**VERMELHO na `main`**, com dados sintéticos e o mesmo fluxo da tela.

- Serviço (`weighingService.createEntry`, como a tela gravava):

  ```text
  {"entrada":{"pesagem":true,"operacoesEntrada":0},"saida":{"operacoesSaida":0}}
  ```

- Tela, no Electron real (build de `be3d309`):

  ```text
  RED-MAIN {"pesagens":1,"operacoesEntrada":0,"motivoDaEntradaNaTela":0,"botaoNovoMedicamento":0,"botaoConfigurarPosologia":0,
            "textoDoPainel":"… Nenhum programa ou medicamento ativo. Cadastre-os na tela Sanidade para registrar aplicações no lançamento."}
  ```

Defeitos achados **durante** a implementação, cada um com teste novo que falha sem a correção:

- **Segundo animal na primeira pesagem.** A primeira pesagem de um animal que entrou sem peso criava um segundo
  animal, porque a tela manda um `animal_id` novo no Cadastro. O gate e o E2E cobrem.
- **Calendário inutilizável em diálogo.** O calendário da vigência não abria clicável dentro de um diálogo modal.
- **Dose de regra que não sugere.** Uma "dose sugerida" de regra que não sugere era aceita. O gate
  `sanity:posology` foi atualizado: o caso antigo documentava esse furo.

## Cenários

| # | Cenário | Resultado | Teste |
|---|---|---|---|
| 1 | Entrada COMPRA com pesagem: 1 animal, 1 operação, 1 item, 1 movimento e 1 pesagem; saldo +1 | PASS | `launch:operations:verify`, E2E integração |
| 2 | Entrada sem peso: pendente, sem pesagem fictícia; a 1ª pesagem adota o mesmo animal e liga ao item | PASS | idem |
| 3 | Saída VENDA com pesagem: 1 saída, saldo −1, ganho contra a entrada; Enter duplo não duplica | PASS | idem |
| 4 | Morte/Doação sem peso: sem peso nem GMD inventado; ABATE com carência desconhecida bloqueado no serviço | PASS | `launch:operations:verify`, E2E (Doação com aviso de carência) |
| 5 | Falha no meio (aplicação inválida, sanidade sem pesagem): rollback integral, nenhum rascunho | PASS | `launch:operations:verify` |
| 6 | Editar peso mantém o vínculo; mudar data é recusado; cancelar desfaz o livro | PASS | `launch:operations:verify`, E2E principal (Desfazer cancela a operação) |
| 7 | Posologia sintética 1 ml/50 kg: 300 kg → 6 ml sugerido, 5,5 ml aplicado e confirmado, gravado com snapshot, peso-base e carência; rascunho, suspensa e fora da vigência sem sugestão | PASS | `launch:operations:verify`, E2E integração, `SanidadeLancamentoPanel.test.jsx` |
| 8 | Balança instável ou desconectada, troca de animal, peso alterado: sem sugestão, ou sugestão e confirmação desfeitas; peso-base diferente do gravado recusado no serviço | PASS | `SanidadeLancamentoPanel.test.jsx`, `launch:operations:verify`; captura da balança P01–P03 no E2E principal |
| 9 | Perfis: OPERADOR lança e aplica sem cadastrar nem aprovar (e sem valores); CONSULTA não lança; painel em modo consulta sem `registry.write` | PASS | `launch:operations:verify`, `SanidadeLancamentoPanel.test.jsx` |
| 10 | Entrada/Manejo/Saída, Enter, sequência e documentos no Electron real; layout 1440/768/390 sem rolagem horizontal e com Salvar visível | PASS | `e2e:electron:verify`, `e2e:launch-integration:verify` |

Capturas (dados sintéticos, sem usuário real) em `telas/`:

- `lancamento-entrada-sanidade-1440.png`;
- `posologia-no-lancamento-1440.png`;
- `saida-aviso-carencia-1440.png`;
- `lancamento-entrada-1440.png`, `lancamento-entrada-768.png` e `lancamento-entrada-390.png`.

## Arquivos

- **Serviço:**
  - `src/modules/livestock/application/operationsService.js` (`registerLaunchOperation`, `findOperationOfEntry`,
    `findPendingEntryAnimal`);
  - `src/modules/livestock/infrastructure/operationsDataAdapter.js`.
- **Pesagem:**
  - `src/modules/weighing/infrastructure/weighingDataAdapter.js` (vínculo na edição, animal pendente,
    peso-base);
  - `src/modules/weighing/application/weighingService.js` (`prepareLaunchEntry`).
- **Sanidade:**
  - `src/modules/sanity/domain/posology.js` (`posologySituation`, `checkPosologyApplication`);
  - `sanityDataAdapter.js`;
  - `sanityService.js`.
- **Tela:**
  - `src/pages/LancamentoPesagensIndividuais.jsx`;
  - `src/modules/weighing/domain/launchOperation.js`;
  - `src/components/pesagens/SanidadeLancamentoPanel.jsx`;
  - `OperacaoAvisosDialog.jsx`;
  - `ConfirmarExclusaoLancamentoDialog.jsx`;
  - `src/components/sanidade/PosologiaDialog.jsx`;
  - `PosologiasPanel.jsx`;
  - `MakDateControl.jsx`.
- **Testes:**
  - `scripts/verify-launch-operations.mjs`;
  - `scripts/verify-launch-integration-e2e.mjs`;
  - `scripts/verify-electron-e2e.mjs` (rótulos novos; Desfazer de Entrada cancela a operação; o inventário conta a
    Compra do Lançamento);
  - `launchOperation.test.js`;
  - `SanidadeLancamentoPanel.test.jsx`;
  - `ConfirmarExclusaoLancamentoDialog.test.jsx`;
  - `scripts/verify-sanity-posology.mjs`.
- **Guias:** `docs/user/GUIA-RAPIDO.md`, `REBANHO-OPERACOES.md` e `SANIDADE.md`.

## Gates

| Comando | Resultado | Tempo |
|---|---|---|
| `npm ci` | OK | 11s |
| `npm run lint` | OK | 13s |
| `npm run test:unit` | OK | 12s |
| `npm run build` | OK | 11s |
| `xvfb-run -a npm run test:quick` | OK | 109s |
| `xvfb-run -a npm run test:full` | OK | 145s |
| `xvfb-run -a npm run e2e:electron:verify` | OK | 27s |
| `xvfb-run -a npm run e2e:launch-integration:verify` | OK | 60s |
| `npm run launch:operations:verify` | OK | 0s |
| `npm run storage:all:verify` | OK | 23s |
| `npm run migration:v9:verify` | OK | 0s |
| `npm run backup:recovery:verify` | OK | 0s |
| `npm run restore:critical-restart:verify` | OK | 2s |
| `npm run restore:content-integrity:verify` | OK | 1s |
| `npm run weighing:integrity:verify` | OK | 1s |
| `npm run livestock:operations:verify` | OK | 0s |
| `npm run sanity:posology:verify` | OK | 1s |
| `npm run cross:surface:verify` | OK | 0s |

Rodados em sequência, depois de um `npm ci` limpo, no código de `9a4aae1` (o commit seguinte só regera uma captura e acrescenta esta tabela). O `test:full` não carrega o benchmark de 16 min. CI da PR (Testes, com o E2E da integração, e Gerar instalador) verde em `9a4aae1`; o HEAD final está na descrição da PR.

## Limites reais

- **Animal "SN" (sem número).** Continua no fluxo de pesagem de antes, sem operação. Operações com vários animais e
  as Movimentações continuam nas telas de Rebanho (mesmo serviço).
- **Registros antigos.** Cadastros e Saídas da 1.5.x e da 1.6.0 não ganham operação retroativa: nenhum backfill.
  Contam no inventário como antes.
- **Venda e abate do Lançamento.** O comprador e o frigorífico do Lançamento continuam como texto da pesagem; a
  operação fica sem parceiro cadastrado. A liberação técnica de carência para abate continua em Rebanho › Saídas.
- **Homologação física.** Balança S3 física, Windows real e uma cópia do banco real não foram testados aqui. Os
  testes usam o simulador, fake-indexeddb e o Electron em Linux com perfis temporários.
