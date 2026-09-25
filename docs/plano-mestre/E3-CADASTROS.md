# E3 — Cadastros reorganizados + proprietário no animal + metas (1.6.0, Dexie v9)

## Problema

- A responsável acha os cadastros confusos: sete telas soltas, sem ordem de uso, com campos demais.
- Proprietário só existe via marca (`marcas.proprietario_parceiro_id`). A fazenda tem várias marcas e
  vários donos, e um animal pode ser de dono diferente do dono da marca (decisão 24/09/2026).
- Categoria não tem fase nem meta de GMD; lote (`loteApartacoes`) não tem tipo nem área.

## Passo 0 — antes de codar

Capturar as telas atuais (`scripts/capture-screens.*`) em `docs/evidence/e3/ANTES/` e listar no REPORT,
para cada cadastro: campos obrigatórios, campos nunca preenchidos (contar no banco de teste
`generate-test-mass`) e cliques para criar um registro. Isso orienta o que sai.

## 1. Esquema v9 (`STORES_V9 = { ...STORES_V8, ... }`)

| Store | Mudança | Índices |
|---|---|---|
| `animais` | + `proprietario_parceiro_id` | acrescentar índice `proprietario_parceiro_id` |
| `movimentosAnimais` | novo tipo `TROCA_PROPRIETARIO` (origem/destino em `dados`) | — |
| `pastos` (nova) | `id, empresa_id, propriedade_id, nome, nome_normalizado, area_ha, forrageira, ativo` | `++localId, &id, empresa_id, propriedade_id, nome_normalizado, ativo, created_at, updated_at, deleted_at` |
| `loteApartacoes` | + `tipo_lote` (PASTO, CONFINAMENTO, SEMICONFINAMENTO), + `pasto_id` | + `pasto_id` |
| `categoriasAnimal` | + `fase` (CRIA, RECRIA, ENGORDA, REPRODUCAO), + `meta_gmd_kg` | — |
| `parceiros` | papel novo `FORNECEDOR`; + `chave_pix` | — |

Backfill v9 (idempotente, com backup pré-migração):
- `animais.proprietario_parceiro_id` ← `marcas.proprietario_parceiro_id` da marca do animal; sem dono →
  `null` e entra em "Qualidade dos dados" como "animal sem proprietário".
- `categoriasAnimal.fase` pelos seeds: Bezerro/Bezerra → CRIA; Garrote leve, Garrote, Novilha leve,
  Novilha, Novilha pesada → RECRIA; Boi magro, Boi em engorda, Boi terminado, Boi pesado → ENGORDA;
  Fêmea adulta → REPRODUCAO. Categorias do usuário sem correspondência → `null`.
- `meta_gmd_kg` sugerida (editável): CRIA 0,70 · RECRIA 0,50 · ENGORDA 0,80 (pasto) — texto de ajuda
  diz que é ponto de partida.
- `tipo_lote` ← `PASTO` para todos.

Gates: `migration:v9:verify`, restore de backup v8 em v9, contagens iguais antes/depois.

## 2. Proprietário no animal (regra de negócio)

- Ao criar animal: dono = dono padrão da marca (sugestão); pode trocar.
- Trocar dono: ação "Trocar proprietário" na ficha e em lote (seleção múltipla na relação), com data e
  motivo → grava `movimentosAnimais` `TROCA_PROPRIETARIO` e auditoria. Nunca reescreve o passado:
  relatórios de período usam o dono vigente na data do evento.
- Coluna/agrupamento "Proprietário" em rebanho, pesagens, desempenho, saídas e vendas (reporting:
  nova coluna `proprietario` groupable nos grãos com animal).
- Filtro global opcional "Proprietário" no topo do Lançamento e da Relação (para pesar gado de um dono só).

## 3. Menu e telas

Menu CADASTROS vira cinco grupos (cada grupo = uma rota com abas ModeloBase1):

| Grupo | Abas |
|---|---|
| Pessoas | Parceiros (com filtro por papel: Proprietários, Compradores, Frigoríficos, Fornecedores, Transportadores) |
| Marcas | Marcas (mostra dono padrão e quantidade de animais por dono) |
| Fazenda | Propriedades · Pastos · Lotes e apartações (mover a gestão de lotes para cá; o diálogo do Lançamento continua como atalho) |
| Rebanho | Raças · Categorias (com fase, faixa de peso, meta de GMD) · Causas de morte |
| Sanidade | Programas · Medicamentos (mover do /Sanidade; a rota Sanidade fica só com Aplicações/Calendário) |

Regras de tela (todas):
1. Lista à esquerda (busca, filtro Ativos/Inativos), ficha à direita; nada de popup para cadastro.
2. Obrigatório só o nome (e sexo em Categoria, papel em Parceiro). O resto em "Mais detalhes" recolhido.
3. Criar na hora: nos selects do Lançamento, Sanidade e Venda, item "+ Novo…" (e F2) abre mini-ficha
   inline com os obrigatórios; ao salvar, já fica selecionado.
4. Inativar em vez de excluir quando houver uso; excluir só se nunca usado.
5. Contador de uso na lista ("132 animais", "4 vendas") para a responsável saber o que é usado.

## 4. Gates

`registry:v9:verify` (novos campos/papéis), `animal:owner:verify` (troca de dono, histórico,
relatório por dono na data), `registry:inline-create:verify`, `ui:consistency:verify` atualizado,
`reports:columns:verify` com a coluna proprietário.

## 5. Aceite humano

1. Cadastrar dono "Fulano" como Proprietário e a marca "FL" com dono padrão Fulano.
2. Pesar animal novo da marca FL → dono sugerido Fulano; trocar para outro dono no mesmo lançamento.
3. Na ficha do animal, "Trocar proprietário" com data de ontem → histórico mostra a troca.
4. Rebanho atual agrupado por Proprietário → cabeças por dono.
5. Criar categoria nova direto do Lançamento (F2) sem sair da tela.
