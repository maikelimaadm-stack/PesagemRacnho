# ANIMAL-PROFILE-MODEL — Ficha do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual (`src/pages/FichaAnimal.jsx`)

| Bloco | Implementação | Avaliação |
|---|---|---|
| Fonte | `buildProfiles(catalog)`: agrupa **todas as pesagens** por `animal_id` ou `NÚMERO::MARCA` | O(N) na abertura; em 36 mil pesagens gera ~12 mil perfis em memória; ignora `animais` exceto para sobrescrever campos do último perfil |
| Busca | filtro em memória por número/marca/raça; 12 resultados | ok em base pequena; sem índice |
| KPIs | peso atual, ganho total, GMD médio (ganho total / dias totais), GMD última, @ carcaça (50 % fixo), nº pesagens | "@ carcaça" com rendimento fixo contradiz ADR-012 (rendimento explícito) |
| Curva de peso | SVG próprio, 90 dias / 6 meses / tudo | adequado |
| Linha do tempo | derivada das pesagens (Cadastro, Pesagem, Saída) | não mostra mudança de lote (`movimentosAnimais`) nem identificadores |
| Histórico | tabela com dias/ganho/GMD/lote/apartação | ok |
| Exportar histórico | CSV | ok |
| Visual | `op-screen` | não é ModeloBase1 |
| Breadcrumb | evento `mb1:breadcrumb-detail` | bom padrão; manter |

## 2. Modelo alvo

### 2.1 Fonte de dados

- Perfil = `animais` (projeção) + identificadores ativos/histórico (`animalIdentificadores`) + marca/raça/categoria por id.
- Série = `pesagens.where('animal_id')` (índice).
- Linha do tempo = união ordenada de: eventos (`pesagens`), `movimentosAnimais` (entrada, mudança de lote com origem→destino, saída), trocas de identificador, operações comerciais vinculadas.
- Busca = `animalIdentificadores.valor_normalizado` + `animais.identificacao_normalizada` (índices), limitada a 20.

### 2.2 KPIs

| KPI | Regra |
|---|---|
| Peso atual | `animais.ultimo_peso_kg` / `ultima_pesagem_data` |
| Ganho total | último Manejo − primeiro peso conhecido (Cadastro com peso ou primeiro Manejo) |
| GMD médio ponderado | Σganho / Σdias dos Manejos (D5: distinguir do simples) |
| GMD última | do último Manejo |
| @ estimada | só se houver rendimento configurado (empresa ou categoria); caso contrário "—" com dica |
| Situação | estado do ciclo (`ATIVO`, `VENDIDO`…) com data e motivo |

### 2.3 Seções

1. Cabeçalho: número atual, marca, situação, sexo, raça, categoria, idade estimada, lote atual, propriedade.
2. Identificadores: tabela com tipo, valor, faixa de origem, início/fim, motivo.
3. Curva de peso (manter o componente).
4. Linha do tempo (com movimentos e comercial).
5. Histórico de pesagens (manter).
6. Ações: "Lançar pesagem" (pré-seleciona o animal), "Trocar identificador", "Editar cadastro" — nenhuma ação escondida atrás de ícone sem rótulo.

### 2.4 UI

Tela Mãe do ModeloBase1 no modo registro (`CadastroAuxiliarPage` já tem o padrão lista/registro); a curva de peso entra como painel.

## 3. Impacto

Não há migração de dados. O ganho é de desempenho (índices) e de correção conceitual (ficha lê o cadastro, não infere dele a partir de eventos).

## 4. Fora de escopo

Fotos do animal, genealogia, escore, histórico sanitário (ADR-007).
