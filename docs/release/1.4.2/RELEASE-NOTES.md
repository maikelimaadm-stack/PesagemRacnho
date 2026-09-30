# Pesagens Individuais 1.4.2 — notas da versão

Data: 30/09/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

A 1.4.2 é a 1.4.1 com o pedido de 30/09/2026 (E1G): GMD em todos os relatórios e gráficos de peso e ganho.

## O que muda para quem usa
- **GMD no Desempenho:** o ganho do período passa a contar desde a última pesagem ANTES do período. Quem pesa
  por aparte, com meses entre as pesagens, volta a ter GMD — o mesmo número do relatório Pesagens.
- **O GMD não some mais da folha:** sem pesagem anterior aparece "-", com a nota de quantos animais têm GMD.
- **Rebanho atual com GMD:** peso e data de entrada, ganho e dias desde a entrada, GMD desde a entrada e o
  último GMD de cada animal; os resumos (Por Lote, Categoria…) mostram o GMD médio.
- **Venda e abate com peso** passam a ter ganho e GMD desde a última pesagem (Vendas, Saídas, Comercial e
  Romaneio oferecem essas colunas). Na primeira abertura, o programa recalcula uma vez esses campos.
- **Importação:** o mesmo brinco escrito de outro jeito ("01016", "1016,0") casa com o animal que já existe, em
  vez de criar um animal novo; "Dt.Ant." e "Peso Ant." são reconhecidos; o histórico anterior ao Cadastro entra
  (o Cadastro antigo vira Manejo).
- **Qualidade dos dados:** mostra animais com uma pesagem só, pesagens sem GMD (e o motivo) e números parecidos.
- **Gráficos:** em Pesagens, Desempenho e Rebanho atual, o botão **Folha | Gráficos** mostra evolução do peso
  médio, GMD por lote/categoria/sexo/raça, ganho e @ por mês, faixas de peso, peso inicial × final e faixas de
  GMD. Saem também na impressão e no PDF, e o Excel ganha a aba "Gráficos".
- **Ficha do Animal:** curva de peso com as datas na escala certa, valores e GMD de cada trecho.

## Atualização
- Da 1.3.x ou de uma 1.4.x: faça o backup, feche o programa e rode o **Setup 1.4.2** por cima.

## Assinatura
- Instalador sem assinatura: o SmartScreen avisa ("Mais informações › Executar assim mesmo").
