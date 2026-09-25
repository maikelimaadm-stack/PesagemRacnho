# E5 — Comercial: operação de venda, venda à vista no curral, abate, compra e acerto por proprietário (1.7.0, Dexie v10)

## Problema

Hoje venda/abate/compra são campos dentro da pesagem (`valor_venda_total`, `valor_arroba`, `comprador`
texto livre, `frigorifico` texto livre, carcaça só estimada). Não há operação, pagamento, recibo nem
acerto por dono. A fazenda vende muito à vista no curral, com vários donos e várias marcas.

## 1. Esquema v10

| Store | Campos principais | Índices |
|---|---|---|
| `operacoesComerciais` | `tipo` (VENDA_VISTA, VENDA_PRAZO, ABATE, COMPRA), `data`, `parceiro_id`, `status` (RASCUNHO, CONFIRMADA, CANCELADA), `modo_preco` (KG, ARROBA_VIVA, ARROBA_CARCACA, CABECA), `preco_unitario`, `frete`, `descontos[]` ({tipo: FUNRURAL, COMISSAO, OUTRO, valor ou %}), `total_bruto`, `total_liquido`, `numero_recibo`, `gta`, `nf`, `embarque_id`, `cancel_motivo` | `++localId, &id, empresa_id, tipo, data, parceiro_id, status, embarque_id, [empresa_id+numero_recibo], created_at, updated_at, deleted_at` |
| `itensOperacao` | `operacao_id`, `animal_id`, `pesagem_id` (pesagem de saída/entrada), `peso_kg`, `proprietario_parceiro_id` (foto no momento), `carcaca_kg_real`, `rendimento_real`, `arrobas`, `valor_item` | `++localId, &id, operacao_id, animal_id, proprietario_parceiro_id, created_at, updated_at, deleted_at` |
| `pagamentosOperacao` | `operacao_id`, `forma` (DINHEIRO, PIX, TRANSFERENCIA, CHEQUE, BOLETO), `valor`, `vencimento`, `pago_em`, `status` (ABERTO, PAGO, CANCELADO) | `++localId, &id, operacao_id, status, vencimento, created_at, updated_at, deleted_at` |
| `repassesProprietario` | `proprietario_parceiro_id`, `data`, `valor`, `operacoes_ids[]`, `forma`, `observacao` | `++localId, &id, proprietario_parceiro_id, data, created_at, updated_at, deleted_at` |

`parceiros` ganha `comissao_padrao_percent` (taxa que a fazenda cobra do proprietário sobre a venda).

## 2. Cálculos (domínio puro, `src/modules/commercial/domain/`)

- @ viva = peso_kg ÷ 30. @ carcaça = carcaça_kg ÷ 15; sem carcaça real: peso × rendimento ÷ 100 ÷ 15.
- Valor do item por modo: KG → peso × preço; ARROBA_VIVA → @viva × preço; ARROBA_CARCACA → @carcaça ×
  preço; CABECA → preço.
- Descontos e frete rateados entre itens proporcionalmente ao valor bruto (centavos: método do maior resto).
- Arredondamento só na apresentação; somas em centavos inteiros.
- Registrar no F0-02-CATALOGO-DE-FORMULAS.md.

## 3. Tela "Venda no curral" (Comercial › Nova venda)

1. Comprador (select com "+ Novo…"), modo de preço, preço.
2. Adicionar animais: digitar/bipar número ou EID, ou "adicionar lote inteiro", ou pesar agora (usa a
   balança da E4; cria pesagem de SAÍDA). Sem pesar agora → usa a última pesagem e mostra "há N dias".
3. Grade ao vivo: nº, marca, dono, peso, @, valor; totais por dono no rodapé.
4. **Bloqueios**: animal já vendido/morto; animal em carência sanitária (usar `aplicacoesSanidade` +
   `carencia_dias` da v8) → bloqueia, com liberação por GESTOR/ADMIN mediante justificativa auditada.
5. Pagamento: uma ou várias formas; troco em dinheiro; a prazo gera parcelas.
6. Confirmar → numera recibo, baixa animais (situação VENDIDO, saída na data), grava auditoria.
7. Recibo A4 e cupom 80 mm (impressora térmica), com itens, totais, formas de pagamento e resumo por dono.
8. Cancelar venda confirmada: só GESTOR/ADMIN, motivo obrigatório, reverte situação dos animais.

## 4. Abate e compra

- Abate: frigorífico, data, animais, preço/@; depois "Lançar romaneio do frigorífico" com carcaça e
  rendimento REAIS por animal (digitados ou importados de planilha) → recalcula valores.
- Compra: vendedor, animais que entram (liga à pesagem de ENTRADA), preço, frete, GTA, NF.

## 5. Proprietários

- Relatório **Acerto por proprietário** (novo): período × dono → cabeças, kg, @, bruto, comissão,
  descontos rateados, líquido a repassar, repasses feitos, saldo.
- Ação "Registrar repasse" a partir do relatório.

## 6. Migração do legado (backfill v10)

Pesagens com dados comerciais viram operações CONFIRMADAS agrupadas por (data, tipo, comprador/frigorífico
texto). Texto → parceiro por `nome_normalizado`; sem correspondência → cria parceiro com o papel certo e
observação "criado na migração 1.7.0" (aparece em Qualidade dos dados para revisão). Campos antigos
ficam somente leitura. Contagens e somas antes = depois (gate).

## 7. Relatórios

`comercial.vendas` e `comercial.abates` passam a ler operações (grão novo `SALE_ITEM`); desbloquear
`comercial.por-parceiro` e `comercial.operacao`; adicionar `comercial.acerto-proprietario`.

## 8. Gates

`migration:v10:verify`, `commercial:calculations:verify` (todos os modos, rateio, centavos),
`commercial:sale-flow:verify` (confirmar, cancelar, bloqueio por carência, dono na data),
`commercial:legacy-parity:verify`, `commercial:receipt:verify` (A4 e 80 mm).

## 9. Aceite humano

1. Vender 3 animais de 2 donos por kg à vista (dinheiro + PIX) → recibo impresso com resumo por dono.
2. Tentar vender animal em carência → bloqueado; liberar com justificativa como gestor.
3. Acerto por proprietário do dia → valores batem com o recibo.
4. Cancelar a venda → animais voltam para o rebanho.
5. Vendas antigas (antes da 1.7.0) aparecem no relatório de vendas com os mesmos totais.
