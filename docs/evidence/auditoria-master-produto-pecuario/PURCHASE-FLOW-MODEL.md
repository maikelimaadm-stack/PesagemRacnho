# PURCHASE-FLOW-MODEL — Fluxo de compra

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Onde | Observação |
|---|---|---|
| Ativação | botão "olhinho" (`Eye`/`EyeOff`) "Dados da compra" no Cadastro | ação oculta; o operador precisa saber que existe |
| Campos | `valorPagoCabeca`, `origemAnimal` (vendedor do registry, por **nome**), `numeroGTA`, `numeroNFeCompra`, `valorFreteCompra`, `observacoesCompra` | por animal, repetidos a cada cadastro |
| Persistência | `legacy_payload.valor_pago_cabeca`, `origem_animal`, `documentacao = JSON.stringify({gta, nfe, frete, obs})` | string JSON dentro de um objeto JSON |
| Agregação | nenhuma; não há "lote de compra" | 40 animais da mesma nota são 40 cópias dos dados |
| Frete | por animal | não há rateio; o mesmo frete digitado 40 vezes soma 40 fretes |
| Relatório | coluna `valor_pago_cabeca` na relação | nenhum total por compra |

## 2. Modelo alvo (mínimo útil)

### 2.1 Store `operacoesComerciais` (tipo `COMPRA`)

| Campo | Regra |
|---|---|
| `id`, `empresa_id` | padrão |
| `tipo` | `COMPRA` (mesma store para VENDA/ABATE, ver `SALE-FLOW-MODEL.md`) |
| `data` | data civil da operação |
| `parceiro_id` | vendedor (`parceiros`, papel VENDEDOR) |
| `propriedade_origem_id` | opcional |
| `documentos` | lista curta: `{tipo: GTA|NFE|OUTRO, numero, data}` (dentro do registro; não é store) |
| `valor_total` | informado |
| `valor_frete`, `outros_custos` | informados, opcionais |
| `quantidade_prevista` | informada |
| `status` | `RASCUNHO` → `CONFERIDA` → `FECHADA`; `CANCELADA` |
| `observacao`, timestamps | padrão |

### 2.2 Vínculo animal ↔ compra

No evento `CADASTRO` do animal: `operacao_id` (coluna indexada em `pesagens`/eventos) e `valor_alocado` (custo individual: `valor_total / quantidade` por padrão, editável).

Regra de rateio inicial: **por cabeça**. Rateio por peso só entra se o responsável decidir (P-004). Nada de custo composto.

### 2.3 Fluxo

```text
Cadastros › Parceiros (vendedor)      ─┐
Cadastros › Propriedades (origem)     ─┤ antes
Cadastros › Marcas/Raças/Categorias   ─┘
Comercial › Nova compra (RASCUNHO): vendedor, data, documentos, valor, frete, quantidade
  └─ "Cadastrar animais desta compra": cadastro em série (marca padrão, faixa do estoque, categoria)
       └─ cada animal: evento CADASTRO com operacao_id; pesagem de entrada opcional no curral
Conferir: quantidade cadastrada = prevista; soma alocada = valor total → CONFERIDA → FECHADA
```

### 2.4 Cancelamento

Cancelar a compra não apaga animais; marca a operação como `CANCELADA` e remove `operacao_id` dos cadastros com auditoria. Se algum animal já tem Manejo, a compra só pode ser cancelada com justificativa.

## 3. Migração dos dados atuais

Para cada Cadastro com `valor_pago_cabeca` ou `documentacao`:

1. agrupar por `(data_pesagem, origem_animal, gta, nfe)`;
2. criar uma `operacoesComerciais` COMPRA por grupo (`status=FECHADA`, `origem='migracao'`), `valor_total = Σ valor_pago_cabeca`, `valor_frete` = frete do grupo (um só valor, não a soma);
3. gravar `operacao_id` e `valor_alocado = valor_pago_cabeca` no evento;
4. manter os campos legados no payload (somente leitura) até a limpeza de `legacy_payload`.

O dry-run mostra os grupos formados e os casos ambíguos (fretes diferentes no mesmo grupo).

## 4. Fora de escopo

Contas a pagar, adiantamento, comissão de compra, financiamento, ICMS, integração NF-e.
