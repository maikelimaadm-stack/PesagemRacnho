# E7 — Evolução de peso e farol de metas (1.8.x, sem mudança de esquema)

Depende de E1 (modo Resumido) e E3 (fase e `meta_gmd_kg` na categoria, dono no animal).

## 1. Relatório `desempenho.evolucao` (novo, grão ANIMAL_PERIOD)

Matriz: linhas = grupo; colunas = períodos; célula = peso médio e GMD do grupo naquele período.

```
Categoria (início)  Cab | Jul: peso  GMD | Ago: peso  GMD | Set: peso  GMD | GMD período | Meta | Farol
Garrote             120 |   285     0,62 |   301     0,55 |   322     0,70 |    0,62     | 0,50 |  verde
```

- Parâmetros: período (obrigatório), coluna de tempo (Mês | Sessão de pesagem | Semana), linha
  (Categoria no INÍCIO do período — padrão —, Lote, Raça, Sexo, Proprietário, Marca, Fase).
- **Categoria no início**: a categoria é trocada automaticamente pelo peso; usar a categoria vigente na
  primeira pesagem do período, senão animais que engordam mudam de linha. Mostrar o critério no cabeçalho.
- GMD de duas formas (colunas escolhíveis): entre pesagens consecutivas e acumulado desde a entrada.
  GMD do grupo = ganho total ÷ soma dos dias (ponderado; já existe `weightedGmd`).
- @ produzidas no período = ganho total ÷ 30 (peso vivo).
- Gráfico de linhas (peso médio por período, uma linha por grupo) acima da matriz; mesma paleta do app;
  exporta como imagem no PDF.

## 2. Farol de meta

- Meta vem de `categoriasAnimal.meta_gmd_kg` (E3). Sem meta → sem farol.
- Verde ≥ meta; amarelo entre 70 % e 100 % da meta; vermelho < 70 %; roxo = perdendo peso (GMD < 0).
- Mesmo farol em: relatório Desempenho, ficha do animal, tela de curral (E9) e Lançamento (após gravar).
- Distribuição: quantos animais em cada cor por grupo (colunas extras no Resumido).

## 3. Alertas de curral

No Lançamento, ao gravar peso: "Perdeu X kg desde DD/MM" e "Abaixo da meta" em destaque discreto.
Lista "Animais para olhar" (perdendo peso ou vermelho há 2 pesagens) acessível do Fechamento do dia.

## 4. Gates

`reports:evolution:verify` (categoria no início, ponderação, período vazio, animal com 1 pesagem no
período fica fora do GMD e conta como "sem GMD"), `reports:goal-light:verify` (limites das cores),
paridade CSV/XLSX/PDF.

## 5. Aceite humano

1. Evolução por categoria, jul–set, por mês → matriz e gráfico coerentes com 3 animais conferidos à mão.
2. Trocar linha para Proprietário → mesma soma de cabeças.
3. Animal que perdeu peso aparece roxo na ficha e no relatório.
