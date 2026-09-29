# E1D — "Relatório de Pesagens Individuais" igual ao MAKGESTAO (parte FUNCIONAL)

Versão alvo: ainda a **1.4.0** (não distribuída), branch `program/e1-relatorios`. Sem mudança de esquema.
Referência obrigatória (código do MAKGESTAO antigo que a responsável usa e aprova):
`docs/evidence/e1d/referencia-makgestao/RelatorioPesagensIndividuais.jsx.txt` (cópia de
`Desktop\PROJETOMG\MAKGESTAO-main\src\pages\RelatorioPesagensIndividuais.jsx`) e o print
`docs/evidence/e1d/referencia-makgestao/print-responsavel-apartacao-resumo-por-data.png`.

## Por quê

A responsável achou a 1.4.0 confusa: informação demais na tela e na folha. Ela quer o relatório de
pesagens como era no MAKGESTAO: uma tela só, com um "Tipo de relatório" e poucos controles. Esta etapa é
**só a parte funcional** (tipos, cálculos, colunas, ordenação). O visual da tela vem num prompt
separado (E1E), quando a responsável disser "visual". Nada de mexer em layout/CSS aqui.

## O que o antigo tinha (copiar o comportamento, com as contas corretas do motor atual)

| Tipo (nome igual ao antigo) | O que mostra | Situação na 1.4.0 |
|---|---|---|
| Analítico (Detalhado) | uma linha por pesagem; botões "Agrupar por" Lote/Apartação/Sexo/Raça (vários ao mesmo tempo, na ordem clicada); subtotal por grupo (animais, peso médio, GMD médio); total geral | existe "Analítico por animal", sem os botões de agrupamento e com colunas demais |
| Sintético (Matriz) | tabela cruzada: Linhas (Eixo Y) × Colunas (Eixo X), cada um entre Lote, Apartação, Sexo, Raça, Mês; célula = Qtd / Peso médio / GMD médio; linha e coluna TOTAL | **não existe** |
| Por Apartação/Lote | por apartação, uma tabela com uma linha por lote (colunas do painel) e total da apartação | parecido com "Por lote" |
| Por Apartação (Resumo por Data) | apartação › data › lote, subtotal por data, TOTAL POR LOTE, TOTAL GERAL | existe (E1B) |
| Vendas (Detalhado) | só saídas por venda, agrupadas por COMPRADOR: animal, data, peso, @, valor @, valor total; subtotal por comprador; total geral | **não existe dentro de Pesagens** (há "Vendas do período" separado) |

## Requisitos

1. **Tipos**: o relatório Pesagens passa a ter exatamente estes 5 tipos, com estes nomes e nesta ordem.
   "Resumo por Sessão", "Por lote" e "Por data" da E1B deixam de aparecer como tipos (continuam
   possíveis por Agrupar por nos outros relatórios; modelos salvos que usam esses tipos continuam
   abrindo — converter para o tipo mais próximo e registrar na auditoria como na E1).
   Tipo padrão ao abrir: **Por Apartação (Resumo por Data)**.
2. **Sintético (Matriz)**: novo modo de visão no domínio (`reportDocument`/`summaryLayout`), não um
   relatório novo. Parâmetros `eixoY` e `eixoX` ∈ {lote, apartação, sexo, raça, mês}; eixos iguais são
   recusados. Célula: Qtd (animais distintos), Peso médio (kg), GMD médio (ponderado, `weightedGmd`; "—"
   sem pesagem anterior). Linha TOTAL e coluna TOTAL recalculadas sobre a população (nunca soma de
   médias). Mês = "set/2026". Exporta para XLSX (uma planilha com a matriz) e sai na folha/PDF.
3. **Vendas (Detalhado)**: população = pesagens de saída com motivo Venda no período. Agrupado por
   Comprador (texto atual; na E5 vira o parceiro). Colunas padrão: Comprador, Data, Animal, Peso (kg),
   Qtd @, Valor @, Valor total. Subtotal por comprador (animais, peso total, peso médio, @, valor total) e
   total geral. Respeita a permissão comercial (CONSULTA não vê valores — mesma regra de hoje).
4. **Analítico (Detalhado)**: botões de agrupamento Lote, Apartação, Sexo, Raça (multi, em ordem de
   clique, máximo 3 níveis — limite do motor). Colunas padrão **iguais às do antigo**: Data, Animal,
   Sexo, Raça, Peso (kg), Lote, Apartação, Dias, Ganho (kg), GMD. Opcionais (escolhidas em "Colunas"):
   Data anterior, Peso anterior, Observação. Subtotal por grupo: animais, peso médio, GMD médio.
5. **Por Apartação/Lote** e **Por Apartação (Resumo por Data)**: colunas **visíveis por padrão**
   reduzidas para: Lote, Qtd, Faixa exigida, Menor, Maior, Peso médio, Média (@), Peso total, GMD médio,
   Machos, Fêmeas. As demais (Total @, Ganho médio, Ganho médio @, Ganho total, Ganho total @, Dias médios)
   ficam disponíveis no seletor "Colunas", como no antigo. Escolha e ordem das colunas salvas **por tipo
   e por usuário** (o antigo guardava por tipo).
6. **Ordenar por** — exatamente as 8 opções do antigo: Data (Mais recente), Data (Mais antiga), Peso
   (Maior), Peso (Menor), GMD (Maior), GMD (Menor), Animal (A-Z), Lote (A-Z). Nos tipos resumidos,
   ordena as linhas dentro de cada seção pela métrica equivalente.
7. **Filtros** (já existem, só confirmar): Data início, Data fim, Orientação (Retrato/Paisagem),
   Pesagem anterior (Todos/Com/Sem), e os botões Lotes, Apartações, Sexo, Raças, Era, Marcas, Status com
   contador. Nada de filtro novo.
8. **Menos informação na folha** (conteúdo, não estilo):
   - cabeçalho: logo, produtor, fazenda, endereço – município-UF. CPF/CNPJ, IE e telefone só aparecem se
     "Mostrar no cabeçalho" estiver marcado (já é assim) — confirmar que o padrão é **desmarcado**;
   - título: "Relatório de Pesagens Individuais (Analítico)" ou "(Sintético)" (como no antigo: todo tipo
     que não é Analítico é "Sintético"); abaixo, só "Período: dd/mm/aaaa a dd/mm/aaaa";
   - remover da folha: a linha "Resumido · Apartação › Data › Lote", o bloco "Emitido em" do canto
     direito do cabeçalho (vai só para o rodapé) e as notas longas — manter no rodapé só: filtros
     aplicados em uma linha, "@ = peso vivo ÷ 30", emitido por/data/hora e "Página X de Y".
9. **Navegação fica para a E1E**: fazer o menu Relatórios abrir direto nesta tela é visual/navegação e
   não entra aqui. Nesta etapa, só garanta que `/Relatorios?r=pesagens` abre com o tipo padrão do item 1.

## Gates

- `reports:pesagens-tipos:verify` — os 5 tipos, nomes, ordem, padrão; conversão de modelos antigos.
- `reports:matrix:verify` — matriz com casos conferíveis à mão (2×2 e 3×4), totais recalculados, GMD
  ponderado, eixos iguais recusados, mês formatado, paridade folha × XLSX.
- `reports:vendas-por-comprador:verify` — população só de vendas, subtotais, permissão comercial.
- `reports:columns-per-type:verify` — colunas padrão de cada tipo iguais às desta especificação; escolha
  por tipo e por usuário persiste.
- Atualizar document-layout, sheet-data, templates, summary-export-parity.

## Aceite humano (depois da E1E visual)

Abrir Relatórios › Pesagens, trocar entre os 5 tipos e conferir que cada um mostra o que o MAKGESTAO
mostrava, com menos colunas por padrão e o seletor "Colunas" para o resto.
