# IDENTIFIER-INVENTORY-MODEL — Estoque de identificadores (brincos e afins)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que existe hoje

`src/components/pesagens/SequenciaBrincos.jsx` é um **auxiliar de digitação**, não um estoque:

- recebe brinco inicial/final e direção, extrai `prefixo + número` (`/^([A-Za-z]*)(\d+)$/`) e mantém o padding de dígitos;
- pula números já usados (conjunto `numerosUsados`, derivado das pesagens da **marca atual**);
- expõe `window.__sequenciaBrincos.avancar()` para o lançamento avançar após salvar;
- estado vive em `useState`/`useRef`; ao trocar de tela, some.

Não existe: registro de compra de brincos, quantidade disponível, faixa reservada, brinco perdido/danificado, brinco RFID pareado, relatório de saldo. **`SequenciaBrincos` não é estoque** e não deve ser transformado em um por acréscimo de campos.

## 2. Objetivo do estoque

1. Saber quantos identificadores de cada tipo/marca/faixa estão disponíveis.
2. Garantir que um número saído do estoque seja usado uma única vez.
3. Rastrear onde cada número foi parar (animal, perda, descarte).
4. Alimentar a sequência do curral com o **próximo número livre real**, não com a lista de pesagens.

## 3. Estratégias avaliadas

| Critério | Estratégia A — item a item | Estratégia B — faixas + exceções |
|---|---|---|
| Representação | uma linha por brinco (`itensIdentificador`) | uma linha por faixa (`faixasIdentificadores`: prefixo, início, fim, padding) + linhas só para exceções (usado fora de ordem, perdido, danificado, reservado) |
| Volume em 250 mil animais | ≥ 250 mil linhas só de estoque; dobra o backup | dezenas/centenas de faixas + exceções |
| Custo de "próximo livre" | consulta indexada por faixa/status (rápida, mas exige linha por item) | cursor da faixa (`proximo`) + conjunto de exceções da faixa |
| Compra de 500 brincos | inserção em lote de 500 linhas | uma linha |
| Brinco perdido | atualizar 1 linha | inserir 1 exceção |
| Consulta "quem tem o 7123?" | direta | `animalIdentificadores` responde; a faixa só diz de onde veio |
| Complexidade de código | maior (bulkAdd, status por item, migração pesada) | menor; exige regra clara para exceções |
| Risco de inconsistência | contagem sempre exata | saldo é derivado (`fim − proximo + 1 − exceções abertas`); precisa de teste |
| Aderência à orientação "offline e simples" | fraca | forte |

**Recomendação: Estratégia B (faixas + exceções), com materialização do item somente quando ele é usado** — o uso já é uma linha em `animalIdentificadores` (`faixa_id` aponta para a faixa). Assim o "item" só existe quando tem dono, e o estoque continua leve.

## 4. Modelo alvo (Estratégia B)

### 4.1 Store `faixasIdentificadores` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `tipo` | `VISUAL`, `RFID`, `SISBOV`, `MANEJO` |
| `marca_id` | obrigatório para VISUAL (o número visual só faz sentido com a marca) |
| `prefixo` | string opcional (`'BR'`, `''`) |
| `inicio`, `fim` | inteiros; `inicio ≤ fim` |
| `digitos` | padding (ex.: 4 → `0071`) |
| `proximo` | cursor do próximo número não utilizado em ordem |
| `direcao` | `CRESCENTE`/`DECRESCENTE` (padrão crescente) |
| `origem` | fornecedor/nota (texto curto) e `data_entrada` |
| `situacao` | `ATIVA`, `ESGOTADA`, `BLOQUEADA` |
| `observacao`, `ativo`, timestamps | padrão |

Índices: `++localId, &id, empresa_id, tipo, marca_id, situacao`.

Regra: duas faixas ativas do mesmo `tipo + marca_id + prefixo` não podem se sobrepor.

### 4.2 Store `excecoesIdentificadores` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `faixa_id` | obrigatório |
| `numero` | inteiro dentro da faixa |
| `motivo` | `USADO_FORA_DE_ORDEM`, `PERDIDO`, `DANIFICADO`, `RESERVADO`, `DEVOLVIDO` |
| `animal_id` | opcional (quando `USADO_FORA_DE_ORDEM`) |
| `observacao`, timestamps | padrão |

Índices: `++localId, &id, [faixa_id+numero]`.

### 4.3 Derivados (não persistidos)

```text
usados_em_ordem   = proximo − inicio
excecoes_abertas  = exceções com motivo ∈ {PERDIDO, DANIFICADO, RESERVADO} e numero ≥ proximo
disponiveis       = (fim − proximo + 1) − excecoes_abertas
```

Um número é "livre" se `numero ≥ proximo`, não está em `excecoesIdentificadores` e não existe `animalIdentificadores` ativo com o mesmo `(marca_id, valor_normalizado)`.

### 4.4 Serviço `identifierInventoryService` (alvo)

- `nextFree(faixaId)` → devolve o próximo livre pulando exceções; avança `proximo` só ao **confirmar** o uso (transação com o Cadastro).
- `useNumber(faixaId, numero, animalId)` → se `numero === proximo` avança; senão grava exceção `USADO_FORA_DE_ORDEM`.
- `markLost(faixaId, numero, motivo)`.
- `balance(faixaId)` → derivados acima.

`SequenciaBrincos` passa a ser uma **visão** desse serviço: escolhe a faixa, mostra "próximo: 0071 · disponíveis: 312", e o avanço acontece no salvamento, não em `window.__sequenciaBrincos`.

## 5. Migração e convivência

- Dados atuais: nenhum estoque existe; a migração v7 cria as stores vazias.
- Números já usados (existentes em `animalIdentificadores`) são respeitados: ao cadastrar uma faixa que os contenha, o sistema calcula `proximo` como primeiro livre e registra exceções `USADO_FORA_DE_ORDEM` para os intervalos já ocupados (relatório de conferência antes de gravar).
- Sem faixa cadastrada, o lançamento continua aceitando número digitado (identificador avulso, `faixa_id = null`).

## 6. Rastreabilidade

Relatório mínimo: por faixa → total, usados, perdidos, disponíveis, último uso; por animal → identificador atual, faixa de origem, histórico de trocas (`animalIdentificadores.inicio/fim`).

## 7. Fora de escopo

Preço unitário do brinco, fornecedor como cadastro completo, pedido de compra, curva ABC, código de barras da caixa. Se o responsável quiser custo por brinco, é um campo `custo_total` na faixa, nada mais.
