# HERD-LOT-MODEL — Apartação, lote e permanência

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Store / código | Estado |
|---|---|---|
| Apartação | `apartacoes` (`nome_apartacao`, `empresa_id`) | cadastro por popup (`GerenciarApartacoesDialog`) dentro do Lançamento |
| Lote | `loteApartacoes` (`nome_lote`, `apartacao_id`, `nome_apartacao` desnormalizado, `quantidade_maxima`, `peso_minimo`, `peso_maximo`, `fechado`) | idem; nomes duplicados dentro da apartação bloqueados na tela |
| Store `lotes` | `schema.js` | **sem uso**; só `health.js` a consulta ao montar `lotIds` |
| Permanência | `animalLotes` (`animal_id`, `lote_id`, `apartacao_id`, `inicio`, `fim`, `origem`) | projeção reconstruída em transação; correta |
| Movimento | `movimentosAnimais` (`tipo`: Entrada, Mudança de lote, Venda…; `lote_origem_id` sempre nulo) | origem não gravada |
| Regra automática | `getLoteAutomatico`: primeiro lote da apartação com `peso_minimo ≤ peso ≤ peso_maximo`, não fechado e não cheio | ocupação = contagem de **pesagens** com `lote_id` (O(N), e conta eventos, não animais) |
| Renomear apartação/lote | `propagateApartacaoRename`/`propagateLoteRename` | regrava `nome_apartacao`/`nome_lote` em **todas** as pesagens vinculadas via `bulkUpdateEntries` (auditoria por registro) |
| Fechamento | `FechamentoDia` calcula ocupação por lote contando pesagens do dia | não usa `animalLotes` |

## 2. Diagnóstico

1. **Duplicidade estrutural:** `lotes` × `loteApartacoes`. Decidir (DEC-007): tornar `loteApartacoes` a store canônica e remover `lotes` na v7, ou migrar para `lotes`. Recomendação: **manter `loteApartacoes`** (todos os vínculos apontam para ela) e remover `lotes` com ADR.
2. **Nome desnormalizado no evento:** `nome_lote`/`nome_apartacao` no payload existem para exibição sem junção. O custo é a propagação em massa ao renomear. Alternativa: manter o snapshot (é um fato: "naquele dia o lote se chamava X") e **parar de propagar**; a grade mostra o nome atual por `lote_id` quando disponível.
3. **Ocupação por contagem de pesagens** está errada conceitualmente (um animal com 5 manejos conta 5) e é O(N). A projeção `animalLotes` aberta (`fim == null`) responde em O(animais do lote) com índice `lote_id`.
4. **Cadastro em popup do curral**: cadastro de apartação/lote deve ser tela própria ModeloBase1; no Lançamento fica só a seleção.

## 3. Modelo alvo (mínimo)

### 3.1 `apartacoes`

Manter. Acrescentar: `ativo`, `ordem`, `observacao`. Sem perfil de regra por enquanto (F4).

### 3.2 `loteApartacoes` → canônica de lote

| Campo | Regra |
|---|---|
| existentes | manter |
| `codigo` | opcional, curto, para o curral |
| `capacidade` | renomear conceitualmente `quantidade_maxima` (manter o campo; alias na UI) |
| `situacao` | `ABERTO` / `FECHADO` (substitui `fechado` boolean via migração de valor) |
| `categoria_id` | opcional; objetivo do lote |
| `data_abertura`, `data_fechamento` | opcionais |
| `ativo`, timestamps | padrão |

Remover `nome_apartacao` desnormalizado do lote (junção por `apartacao_id`).

### 3.3 Regra automática (F1 custo / F4 motor)

Enquanto o motor de regras (ADR-010) não existe, a regra atual permanece com duas correções: ocupação por `animalLotes` abertos e registro de "sugerido × decidido" no evento (`lote_sugerido_id`, `lote_decidido_id`, `motivo_override`). Prioridade = `ordem` do lote, explícita.

### 3.4 Movimentos

Gravar `lote_origem_id` (o lote aberto anterior) na mudança de lote. É um campo já previsto no schema e sempre nulo.

## 4. Migração

- `lotes` → verificar vazio; remover na v7 (`REMOVED_STORES_V7`).
- `loteApartacoes.fechado` → `situacao`.
- Sem alteração em `animalLotes`, `movimentosAnimais` (apenas passa a preencher `lote_origem_id` daqui em diante).

## 5. Fora de escopo

Pasto/piquete, lotação em UA/ha, dieta por lote, custo por lote, rotação de pastagem.
