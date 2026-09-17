# 04 — Motor de filtros

## 1. Motor único existente: `src/components/mak/MakColumnMenu.jsx`

**Formato:** `{ operator, value, valueTo, values[] }`; string pura recebe o operador padrão (`normalizeFilter`, `:43-58`).
Padrões (`:41`): texto `contains`, número `between`, data `equals`. **Consequência:** string pura em campo numérico sem
`valueTo` nunca casa (`:145`).

| Tipo | Operadores (`:7-39`) |
|---|---|
| texto | contains, not_contains, equals, not_equals, starts_with, ends_with, empty, not_empty |
| número | contains, equals, greater, greater_equal, less, less_equal, between, not_between, empty, not_empty |
| data | contains, equals, before, after, between, empty, not_empty |

Não existem: “entre” para texto, “não entre” para data, “em lista” explícito, **período relativo**, enum/booleano/
entidade como tipos próprios.

### Semântica de `matchesMakColumnFilter(raw, filter, type)` (`:123-172`)

| Aspecto | Comportamento | Risco para relatórios |
|---|---|---|
| Ativo | `empty/not_empty`, ou `values` não vazio, ou `value.trim()` (`:114-121`); `valueTo` sozinho não ativa | baixo |
| Nulo/vazio | `null/undefined` → `""`; `empty` é `raw === ""`; `0` não é vazio | ok |
| Múltiplos valores | se há `values`: `values.includes(raw)` **antes de olhar o operador** (`:130`) — OR, igualdade exata, sensível a caixa, valor cru | **“É diferente de” com caixas marcadas vira “está em”** |
| Número | `contains` = substring com ponto decimal (“206,5” não casa); demais convertem vírgula→ponto; não finito → `false` (inclusive em `not_between`); `between` inclusivo e aceita limites invertidos | médio |
| Data | compara **strings `YYYY-MM-DD`** (`slice(0,10)`); sem `Date` e sem timezone; `before/after` estritos; `between` inclusivo; `contains` “2026-09” = mês | **correto para data civil** (a pesagem é gravada civil via `parseCivilDate`) |
| Texto | `toLocaleLowerCase('pt-BR')`, **sem remover acentos** | médio (pesquisa remove acento; filtro não) |
| Entre colunas | **AND** (Relação `:314-317`, Lançamento `every`, Cadastros `some(!match)`); pesquisa AND filtros; não há OR nem grupos | ok para relatórios |
| Persistência | **nenhuma** (`useState` em todas as telas) | relatório salvo precisa serializar |
| Limpeza | faixa, pílula, cabeçalho, menu; Lançamento sem “limpar tudo” | ok |

## 2. Inventário de filtros

Onde roda: **UI** memória da tela; **Serviço** memória após `toArray`; **Índice** Dexie `where()`.

| # | Tela | Filtro | Classificação | Onde |
|---|---|---|---|---|
| 1 | Relação | Pesquisa (número, marca, lote, apartação, raça) | pesquisa | UI |
| 2 | Relação | Data | data/período | UI |
| 3–4 | Relação | Tipo, Tipo de Saída | enum como texto / motivo | UI |
| 5 | Relação | Animal | identificador | UI |
| 6–9 | Relação | Marca, Sexo (código cru M/F), Raça, Era | marca, sexo, raça, categoria (texto) | UI |
| 10 | Relação | Peso | intervalo numérico | UI |
| 11–12 | Relação | Lote, Apartação (**por nome**) | lote, apartação | UI |
| 13–18 | Relação | valores, parceiros (texto), embarque/documento, `doc_qtd`, dias/ganho/GMD, observação | número, parceiro, embarque | UI |
| 19 | Relação | Empresa | entidade por id | **Serviço** |
| 20 | Lançamento | Data do dia | data/sessão | UI |
| 21 | Lançamento | Cabeçalho (sem lista de valores) | vários | UI |
| 22 | Lançamento | `doc_qtd` | número — **não funciona** (`linha['doc_qtd']` sempre `undefined`, `:629`) | UI |
| 23 | Lançamento | Recarga por `animal_id` | entidade | **Índice** (`repositories/index.js:64-65`) |
| 24–27 | Lançamento | documento/embarque; `ResumoLotes`; `ResumoVendaDia`; `ResumoPersonalizado` (escopo + agrupamento) | embarque, apartação, período, motivo | UI; config em `appSettings` |
| 29–33 | Cadastros | pesquisa; coluna (texto **formatado**; booleano/enum/referência viram texto; números com operadores de texto); papéis (OR); `_uso`; tipo | vários | UI |
| 34 | Cadastros | empresa + inativos | entidade/situação | Serviço (`genericRepository.list`: `toArray` + filtro) |
| 35–39 | Fechamento | data; apartação (id **ou** nome); lote (id ou nome); pendências; sessão | data, apartação, lote, sessão | UI |
| 40–42 | Ficha | busca (sem normalizar acento); período relativo à **última pesagem** (não a hoje); série | pesquisa, período relativo | UI |
| 43 | Fechamento/Ficha | carga `listEntries()` **sem `empresaId`** | — | `toArray` |
| 44–45 | Diálogos Embarques/Apartações | por id | embarque, apartação | UI |

Classificação por tipo pedido: texto ✔, pesquisa ✔, enum (como texto), booleano (como texto), número ✔, intervalo ✔,
data ✔, período (absoluto ✔; relativo só na Ficha), entidade por id (só empresa/animal), múltipla escolha ✔ (valor
cru), situação (texto), marca/raça/categoria (texto), sexo (código), lote/apartação (nome), sessão (Fechamento),
parceiro (texto), operação (**não existe**), embarque (texto/id em diálogo), motivo (texto), identificador ✔.

## 3. Filtros que chegam ao IndexedDB com índice

**Nenhum filtro escolhido pelo usuário vira `where()`.** Consultas indexadas existentes são internas: série por
`animal_id`, `[animal_id+data_pesagem]`, `data_pesagem` e `lote_id` em `listByPeriodo` (usados só pelo benchmark),
unicidade por `nome_normalizado`/`documento`, projeções por `animal_id`, sessão por `data`.
`genericRepository.list` faz `toArray` + filtro em memória para apartações, lotes, embarques, documentos e cadastros.

## 4. Recomendação

1. **Manter `matchesMakColumnFilter` como motor de predicado**, extraído para módulo de domínio e corrigido:
   (a) `values` respeita o operador (`in` / `not_in`); (b) comparação de texto sem acento, igual à pesquisa;
   (c) número aceita vírgula também em `contains`; (d) tipos `enum`, `boolean` e `entity` (compara **id**, exibe nome).
2. **Separar duas etapas no relatório**:
   - **Pré-filtro indexado** (no repositório): período por `data_pesagem`, `animal_id`, `lote_id`, `sessao_id`,
     `tipo_pesagem` — sempre que o relatório tiver período obrigatório.
   - **Filtro de predicado em memória** sobre o conjunto já reduzido, com o mesmo motor da tela.
3. **Período**: absoluto inclusivo em data civil (como hoje) + presets relativos resolvidos para datas **no momento
   da emissão** e gravados no manifesto (“Últimos 30 dias = 17/08/2026 a 15/09/2026”).
4. **Filtro serializável** (`{ columnId, operator, value, valueTo, values }`) para modelos salvos; nada de função.
5. **Filtros por id** para marca, raça, categoria, lote, apartação, sessão e parceiro — depende de corrigir a gravação
   de `marca_id`/`raca_id` na pesagem (ver `17`).
