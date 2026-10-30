# Contrato: Lançamento de Pesagens × operações de rebanho

Este documento diz o que o Lançamento grava quando o operador salva uma Entrada, uma Saída ou um Manejo. A regra
central: um evento real gera um único efeito no livro. O código fica em:

- `src/modules/weighing/domain/launchOperation.js` (mapeamento);
- `src/modules/livestock/application/operationsService.js` (`registerLaunchOperation`);
- `src/modules/livestock/infrastructure/operationsDataAdapter.js` (transação).

## Mapeamento

O Lançamento continua gravando os modos históricos `Cadastro`, `Manejo` e `Saída`, com os motivos de saída de
antes. Stores, relatórios, contexto da tela e registros antigos não mudam. Só o rótulo na tela mudou.

| Na tela | `tipo_manejo` gravado | Operação v9 (tipo / subtipo) | Movimento no livro | Pesagem | Estado do animal |
|---|---|---|---|---|---|
| Entrada · Compra | `Cadastro` | ENTRADA / COMPRA | 1 ENTRADA (da operação; a pesagem o adota) | com peso: 1; sem peso: nenhuma | ATIVO; sem peso = `PENDENTE_PESAGEM` |
| Entrada · Transferência recebida | `Cadastro` | ENTRADA / TRANSFERENCIA_RECEBIDA | idem | idem | idem |
| Entrada · Nascimento | `Cadastro` | ENTRADA / NASCIMENTO (nascimento = data) | idem | idem | idem |
| Entrada · Ajuste de entrada | `Cadastro` | ENTRADA / AJUSTE_ENTRADA (justificativa na Observação) | idem | idem | idem |
| Manejo / Pesagem | `Manejo` | nenhuma (pesagem, como sempre) | só Mudança de lote, quando muda | 1 | — |
| Saída · Venda | `Saída` + `Venda` | SAIDA / VENDA (peso obrigatório) | 1 SAIDA (derivado da pesagem de saída) | 1 | VENDIDO |
| Saída · Abate | `Saída` + `Abate` | SAIDA / ABATE (peso obrigatório; carência bloqueia) | 1 SAIDA | 1 | ABATIDO |
| Saída · Transferência enviada | `Saída` + `Transferência` | SAIDA / TRANSFERENCIA_ENVIADA | 1 SAIDA | 1 (peso opcional) | TRANSFERIDO |
| Saída · Morte | `Saída` + `Morte` | SAIDA / MORTE (causa) | 1 SAIDA | 1 (peso opcional, nunca inventado) | MORTO |
| Saída · Doação | `Saída` + `Doação` | SAIDA / DOACAO | 1 SAIDA | 1 (peso opcional) | DOADO |
| Saída · Ajuste de saída | `Saída` + `Outros` | SAIDA / AJUSTE_SAIDA (justificativa) | 1 SAIDA | 1 (peso opcional) | — |

A Saída sempre gera o registro de saída, que é a pesagem com `tipo_manejo = Saída`, mesmo sem peso. Isso é igual
em Rebanho › Saídas. Sem peso, `peso_kg`, ganho e GMD ficam nulos: nenhum valor é inventado.

## Caminho canônico (fonte única)

1. A tela monta o payload de sempre do `createEntry`: identificação, lote e apartação, categoria, leitura da balança,
   documentação, dados de venda e abate, aplicações de sanidade.
2. `buildLaunchOperationInput` deriva desses mesmos dados o cabeçalho e o item da operação.
3. `operationsService.registerLaunchOperation` faz:
   - permissão `weighing.write`;
   - `validateHeader` e `validateItem` (as regras de Rebanho › Entradas e Saídas);
   - as regras do `createEntry` sobre o payload: valores comerciais só com `commercial.write`, aplicações de sanidade
     validadas;
   - tipo, motivo, data e peso da pesagem impostos pela operação.
4. `operationsDataAdapter.registerLaunchOperation` faz tudo numa **única transação Dexie** sobre todas as stores:
   1. cria a operação (`origem: LANCAMENTO`) e o item;
   2. roda a conferência (e a carência na Saída);
   3. confirma pelo **mesmo** `confirmarEntrada` ou `confirmarSaida` das telas de Rebanho (animal, movimento,
      `createEntry` da pesagem com o payload da tela e as aplicações, lote, auditoria);
   4. marca CONFIRMADA.

   Qualquer erro aborta tudo. Não sobra rascunho, animal, pesagem, movimento ou aplicação.
5. **Idempotência.** O `id` da operação e da pesagem é o ciclo do Lançamento (`cicloLancamentoRef`). Um Enter duplo
   ou um retry depois de gravado devolve a mesma operação (`repetida: true`) sem segundo efeito. O ciclo só muda
   depois do sucesso.

## Um movimento só

- **Entrada com peso.** O movimento ENTRADA é criado pela operação. A pesagem Cadastro leva `operacao_id`, e a
  reconciliação (`weighingMovements`) o adota em vez de criar outro.
- **Entrada sem peso.** O movimento da operação vale sozinho. A primeira pesagem do animal:
  - é a mesma identidade (o adaptador procura o animal `PENDENTE_PESAGEM` com o mesmo número e marca, mesmo que a
    tela mande um `animal_id` novo);
  - leva o `operacao_id` da entrada;
  - faz o item da operação apontar para ela;
  - não cria animal nem movimento.
- **Saída.** O movimento SAIDA é derivado da pesagem de saída, que leva `operacao_id`.

## Editar, excluir, repesar

- **Editar uma pesagem que é efeito de operação** (`operacaoItens.pesagem_id`). Peso, lote e observação podem mudar,
  e o item acompanha o peso. Tipo, motivo, data ou animal são recusados (`OPERACAO_VINCULADA`): para mudar, cancele e
  lance de novo.
- **Excluir ou Desfazer no Lançamento.** Uma pesagem de operação com um animal faz a operação ser **cancelada** pelo
  `cancelOperation`, com motivo obrigatório e auditoria. Ela nunca é apagada em silêncio. Se a operação tiver vários
  animais (feita em Rebanho), o Lançamento orienta a cancelar lá.
- **Repesagem no mesmo dia.** Continua só para Manejo, que não tem operação.

## Sanidade no Lançamento

- **Onde se aplica.** Aplicações vão com a pesagem, na mesma transação, na Entrada **com peso** e no Manejo.
  - Entrada sem peso com aplicação é recusada; use a aplicação avulsa da Sanidade.
  - A Saída não registra aplicação (regra clínica). O painel não aparece na Saída, e o serviço recusa.
- **Dose sugerida.** Só sai de posologia **aprovada e vigente na data**, com peso real:
  - balança estável liberada pelo portão, ou peso digitado (`MANUAL`);
  - nunca peso estimado ou projetado.
- **Conferência no serviço** (`checkPosologyApplication`):
  - a regra está aprovada e vigente;
  - a dose sugerida gravada é a que a regra dá para o peso-base;
  - o peso-base é o peso gravado;
  - a dose aplicada foi confirmada.
- **Sugerida ≠ aplicada.** A dose aplicada é o que o operador confirmou e é gravada separada da sugerida, com o
  snapshot da regra.
- **Carência.** Carência desconhecida nunca vira zero. O abate com carência aberta ou desconhecida é bloqueado no
  serviço; a liberação técnica documentada fica em Rebanho › Saídas.

## Registros antigos

Nenhum backfill nem reclassificação:

- Cadastros e Saídas da 1.5.x e da 1.6.0 continuam como estão, consultáveis, e não ganham operação retroativa.
- As operações `LEGADO` da migração v9 continuam corrigíveis só pela Relação de Pesagens.

## Fora do Lançamento (de propósito)

- **Animal "SN" (sem número).** Segue o fluxo de pesagem de antes, sem operação, porque a identidade dele não é
  conferível no livro.
- **Operações com vários animais, sem pesagem em lote, e Movimentações (lote ou propriedade).** Ficam em
  Rebanho › Entradas, Saídas e Movimentações, que chamam o mesmo serviço.
