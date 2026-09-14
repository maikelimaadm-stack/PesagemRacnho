# ANIMAL-CLASSIFICATION-MODEL — Sexo, era/idade e categoria

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Atributo | Hoje | Problema |
|---|---|---|
| Sexo | `M`/`F` fixos no `Select`; gravado no evento e na projeção | adequado; manter |
| Era | texto livre (`'14'`, `'2A'`, `''`); `erasExistentes` deriva das pesagens; `ComboboxComNovo` | não é comparável nem calculável; a "era" do Cadastro nunca envelhece |
| Categoria (bezerro, garrote, novilha, boi, vaca, touro) | não existe | relatórios e apartação não conseguem agrupar por categoria |
| Data de nascimento | não existe | idade real não é conhecida |

A "era" hoje mistura dois conceitos: idade aproximada em meses (`14`) e classificação por dentição (`2A` = duas dentes... na prática usada como faixa). Nenhum cálculo a utiliza.

## 2. Modelo alvo (mínimo)

### 2.1 Store `categoriasAnimal` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `nome` | obrigatório, único normalizado (`Bezerro`, `Garrote`, `Novilha`, `Boi`, `Vaca`, `Touro`, …) |
| `sexo_aplicavel` | `M`, `F` ou `AMBOS` |
| `idade_min_meses` / `idade_max_meses` | opcionais; permitem sugerir categoria pela idade |
| `ordem`, `ativo`, timestamps | padrão |

Sementes: as seis categorias usuais do produto brasileiro. O responsável pode editar.

### 2.2 Campos no animal

| Campo | Regra |
|---|---|
| `sexo` | mantém `M`/`F` |
| `categoria_id` | obrigatório no cadastro alvo; sugerido por sexo + idade quando houver nascimento |
| `nascimento` | data civil opcional |
| `nascimento_estimado` | boolean; verdadeiro quando derivado da "era" |
| `era` (legado) | mantido como texto até a migração concluir; depois vira campo somente-leitura |

Regra de sugestão (explicável, ADR-010): `idade_meses = meses(hoje − nascimento)` → primeira categoria com `sexo_aplicavel` compatível e faixa que contém a idade. A sugestão nunca sobrescreve uma categoria informada; a origem (`informada`/`sugerida`) fica visível.

### 2.3 Snapshot no evento

O evento de pesagem continua gravando `sexo` e passa a gravar `categoria_id` + `categoria_nome` no momento do fato. Isso permite "peso médio dos garrotes em agosto" mesmo que o animal depois vire boi.

## 3. Migração da "era"

| Valor encontrado | Interpretação | Ação |
|---|---|---|
| inteiro `n` (ex.: `14`) | idade em meses na data do Cadastro | `nascimento = data_cadastro − n meses`, `nascimento_estimado = true` |
| `nA`/`nD` (dentição) | faixa etária | mapear para faixa de meses configurável; `nascimento_estimado = true` |
| vazio ou outro texto | desconhecido | `categoria_id` fica nulo; relatório de qualidade lista o animal |

A categoria inicial é sugerida por sexo + idade estimada e marcada como `sugerida`. Nenhum evento é reescrito.

## 4. Decisão necessária

DEC-012 em `DECISION-REGISTER.md`: (a) adotar nascimento estimado + categoria calculada (recomendado); (b) manter "era" como categoria informada, sem idade. A opção (b) é mais simples, mas deixa relatórios por idade fora do alcance.

## 5. Fora de escopo

Pelagem, escore corporal, genealogia, estágio reprodutivo.
