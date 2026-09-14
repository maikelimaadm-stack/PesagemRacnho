# TARGET-COMMERCIAL-FLOW — Fluxo comercial alvo, separado do curral

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Separação de responsabilidades

| Onde | O que acontece | Quem |
|---|---|---|
| Escritório (telas Comercial/Embarques) | abre compra/venda/abate, escolhe parceiro, preço, rendimento, documentos, embarque; confere; fecha | administrativo/gestor |
| Curral (Lançamento) | seleciona a operação aberta uma vez; pesa e registra saída/entrada animal a animal | operador |
| Sistema | gera eventos, projeções, totais calculados; bloqueia inconsistências | serviço |

Regra: **nenhum valor monetário é digitado no curral.**

## 2. Entidade única `operacoesComerciais`

| Campo | COMPRA | VENDA | ABATE |
|---|---|---|---|
| `tipo` | COMPRA | VENDA | ABATE |
| `parceiro_id` | vendedor | comprador | frigorífico |
| `propriedade_origem_id` / `destino` | origem | destino | — |
| `preco_arroba` | — | sim | sim |
| `rendimento_percentual` (+ origem) | — | sim | sim |
| `valor_total_informado` | sim | opcional | opcional |
| `valor_total_calculado` | Σ alocado | Σ arrobas × preço | idem |
| `valor_frete`, `descontos`, `outros_custos` | opcionais | opcionais | opcionais |
| `documentos[]` | GTA, NF-e | GTA, NF-e | GTA, NF-e |
| `embarque_id` | — | opcional | obrigatório |
| `retorno_frigorifico` | — | — | opcional |
| `status` | RASCUNHO → CONFERIDA → FECHADA / CANCELADA | idem | idem |

Vínculo com animais: evento (`pesagens`) com `operacao_id` — CADASTRO para compra, SAÍDA para venda/abate. Índice `operacao_id`.

## 3. Máquina de estados da operação

| De | Para | Condição |
|---|---|---|
| — | RASCUNHO | criação com parceiro e data |
| RASCUNHO | CONFERIDA | ≥ 1 animal; quantidade e valores conferidos; para ABATE, embarque `CONFERIDO` ou superior |
| CONFERIDA | FECHADA | gera/valida os eventos; animais mudam de estado (VENDIDO/ABATIDO); operação somente leitura |
| RASCUNHO / CONFERIDA | CANCELADA | remove `operacao_id` dos eventos ainda não fechados |
| FECHADA | CANCELADA | reverte saídas com motivo e auditoria; animais voltam a ATIVO; embarque volta a CONFERIDO |

## 4. Fluxo ponta a ponta — venda

```text
Escritório: Parceiros (comprador existe) → Nova venda RASCUNHO (preço/@, rendimento, documentos, embarque opcional)
Curral:     Lançamento › Saída › Venda › operação "Venda JBS 14/09" → Nº → Peso → Salvar × N
Escritório: Operação mostra N animais, peso vivo, @ calculadas, valor calculado × informado → CONFERIDA → FECHADA
Relatórios: REP-302 (resultado), REP-401 (romaneio) a partir da operação + embarque
```

## 5. Fluxo ponta a ponta — abate

Igual à venda, com embarque obrigatório e, depois, `retorno_frigorifico` (peso de carcaça real, rendimento real, valor real) para REP-303 estimado × realizado.

## 6. Fluxo ponta a ponta — compra

```text
Escritório: Nova compra RASCUNHO (vendedor, propriedade origem, valor, frete, documentos, quantidade prevista)
Rebanho:    Cadastrar animais da compra (faixa de identificadores, marca padrão, categoria) → eventos CADASTRO com operacao_id
Curral:     (opcional) pesagem de entrada como MANEJO ou peso no CADASTRO
Escritório: conferência (cadastrados = previstos; alocado = total) → CONFERIDA → FECHADA
```

## 7. Convivência com dados atuais

Até a migração (v8), as saídas antigas mantêm os campos no payload e a Relação continua a exibi-los. O relatório comercial alvo lê **só** operações; saídas legadas sem operação aparecem em REP-502 (qualidade) como "saída sem operação (legado)". A migração agrupa e cria operações FECHADAS com `origem='migracao'` (ver `SALE-FLOW-MODEL.md` §3, `SLAUGHTER-FLOW-MODEL.md` §3, `PURCHASE-FLOW-MODEL.md` §3).

## 8. Fora de escopo

Financeiro (contas, caixa, boleto), fiscal (emissão), contrato, comissão, custo composto (P-004), integração com frigorífico.
