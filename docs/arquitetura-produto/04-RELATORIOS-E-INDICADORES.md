# 04 — Arquitetura de relatórios e indicadores

## 1. Princípios

Todo relatório deve declarar:

- objetivo e público;
- período e data operacional;
- população incluída e excluída;
- filtros aplicados;
- unidade de cada métrica;
- fórmula e versão;
- data/hora de emissão;
- usuário emissor;
- possibilidade de abrir os registros de origem;
- exportação consistente com a tela.

Um painel é uma visão navegável. Um relatório oficial é um resultado reproduzível,
com parâmetros e versão. Um snapshot de fechamento não muda silenciosamente
depois da emissão.

## 2. Dimensões padronizadas

- empresa, fazenda e curral;
- sessão e operador;
- animal e identificadores;
- lote, apartação e permanência;
- sexo, raça, categoria, marca e origem;
- tipo de manejo e situação;
- data, semana, mês, trimestre e safra configurável;
- comprador, frigorífico, destino e embarque;
- dispositivo e método de captura;
- qualidade/estado do registro.

## 3. Métricas canônicas

| Métrica | Definição |
|---|---|
| Animais únicos | quantidade distinta de `animal_id` no escopo |
| Pesagens | quantidade de fatos de pesagem válidos |
| Peso total | soma dos pesos em kg |
| Peso médio | peso total / pesagens elegíveis |
| Ganho total | soma dos ganhos elegíveis |
| Ganho médio | média dos ganhos elegíveis, sem converter nulo em zero |
| GMD médio simples | média dos GMDs elegíveis |
| GMD ponderado | soma dos ganhos / soma dos dias elegíveis, quando metodologicamente aplicável |
| Dias médios | média dos intervalos elegíveis |
| Arrobas estimadas | carcaça estimada / 15 |
| Lotação atual | animais com permanência aberta no lote |
| Produtividade da sessão | registros concluídos / duração efetiva em horas |
| Taxa de pendência | pendências / animais processados |
| Taxa de captura automática | pesos automáticos / pesos totais |

O relatório deve diferenciar GMD médio simples de GMD ponderado. Não apresentar
valor quando a população não for elegível.

## 4. Catálogo de relatórios operacionais

### REP-001 — Fechamento da sessão de pesagem

**Objetivo:** conferir o trabalho realizado antes de encerrar.

Conteúdo:

- início, término, duração e pausas;
- operador, curral e dispositivo;
- animais processados e pesagens válidas;
- produtividade por hora;
- peso mínimo, máximo, médio e total;
- ganho e GMD;
- distribuição por destino/lote;
- desconhecidos, duplicados, outliers e pendências;
- substituições manuais de apartação;
- integridade do fechamento.

Drill-down obrigatório para cada grupo. Fase: Modo Curral.

### REP-002 — Relação operacional da sessão

Uma linha por animal processado, com sequência, hora, identificadores, peso,
histórico anterior, ganho, GMD, origem, destino, regra, alertas e estado.

Fase: Modo Curral.

### REP-003 — Pendências e exceções

Agrupa:

- animal não resolvido;
- identificador duplicado;
- pesagem repetida;
- peso/GMD fora da faixa;
- data incompatível;
- destino sem capacidade;
- documento ausente;
- falha de dispositivo;
- conflito de sincronização futuro.

Deve permitir atribuir responsável, resolver, justificar e auditar. Fase: Modo
Curral.

### REP-004 — Produtividade do curral

- animais por hora;
- tempo médio e percentis por animal;
- pausas;
- falhas por equipamento;
- capturas manuais versus automáticas;
- comparação por operador, sessão e dispositivo.

Fase: Integração de equipamentos.

## 5. Catálogo de relatórios zootécnicos de peso

### REP-101 — Histórico individual do animal

- cadastro e identificadores atuais/históricos;
- linha do tempo de pesagens e movimentos;
- peso, ganho, dias e GMD em cada intervalo;
- lote em cada período;
- gráfico da evolução;
- metas e previsão;
- operações de compra/saída;
- auditoria associada.

Fase: Relatórios 1.

### REP-102 — Desempenho do lote

- inventário inicial e atual;
- entradas e saídas;
- peso e GMD médio;
- mediana, mínimo, máximo e dispersão;
- distribuição por faixa;
- animais acima/abaixo da meta;
- melhores e piores desempenhos;
- comparação com período anterior;
- custo e valor estimado quando disponíveis.

Fase: Relatórios 1; economia na fase Comercial.

### REP-103 — Ranking e exceções de desempenho

Filtros por lote/período e listas de:

- maior e menor GMD;
- perda de peso;
- sem pesagem recente;
- peso parado;
- previsão atrasada;
- fora da curva do grupo.

Cada exceção deve abrir a lista, não apenas mostrar um cartão. Fase: Relatórios 1.

### REP-104 — Evolução por grupo/coorte

Comparar lote, marca, raça, sexo, categoria ou origem ao longo do tempo. Para
evitar comparação enganosa, exibir tamanho da amostra e política de inclusão.

Fase: Relatórios 2.

### REP-105 — Metas e projeções

- peso atual e meta;
- kg restantes;
- GMD usado;
- dias e data estimados;
- nível de confiança;
- animais que atingirão a meta no prazo;
- simulação por GMD desejado.

Projeção é estimativa, nunca fato. Fase: Relatórios 2.

### REP-106 — Pesagens vencidas

Animais sem nova pesagem após intervalo configurável, agrupados por lote e
prioridade. Fase: Relatórios 1.

## 6. Relatórios de lote e apartação

### REP-201 — Inventário atual por lote

- capacidade, ocupação e percentual;
- animais atuais;
- peso total/médio;
- faixas de peso;
- entradas/saídas recentes;
- metas;
- inconsistências de permanência.

Fase: Relatórios 1.

### REP-202 — Movimentação entre lotes

Livro cronológico de origem, destino, motivo, sessão, operador e animais.
Suporta conciliação de saldo inicial + entradas − saídas = saldo final.

Fase: Relatórios 1.

### REP-203 — Resultado da apartação

- perfil e versão das regras;
- quantidades e peso por destino;
- capacidade prevista/real;
- animais sem destino;
- conflitos;
- sugestões substituídas manualmente.

Fase: Motor de apartação.

### REP-204 — Simulação de apartação

Executa regras sem alterar dados. Compara cenário atual e proposto, inclusive
reprocessamento com limites diferentes. Fase: Motor de apartação.

## 7. Relatórios comerciais

### REP-301 — Desempenho da compra

- animais, peso e valor de entrada;
- frete e custos adicionais;
- custo médio por cabeça/kg;
- situação atual;
- ganho desde a compra;
- valor estimado e margem, quando configurados.

Fase: Comercial.

### REP-302 — Resultado de venda

- animais vendidos;
- peso vivo;
- carcaça estimada/real claramente separada;
- rendimento;
- arrobas;
- preço por arroba ou cabeça;
- receita bruta, descontos, frete, comissão e receita líquida;
- margem por animal e lote, quando custos existirem.

Fase: Comercial.

### REP-303 — Resultado de abate

Além do conteúdo de venda, deve permitir importar retorno real do frigorífico:
peso de carcaça, rendimento, classificação, preço e descontos. Comparar estimado
versus realizado. Fase: Comercial 2.

### REP-304 — Custo do ganho

- custo total elegível;
- kg ganhos;
- custo por kg ganho;
- arrobas produzidas;
- custo por arroba produzida;
- ponto de equilíbrio;
- margem estimada/real.

Não implementar antes de definir origem e rateio dos custos. Fase: Comercial 2.

### REP-305 — Posição estimada do rebanho

Valor indicativo por lote/animal com preço e data da referência. Deve carregar a
expressão “estimado” e jamais ser tratado como contabilidade oficial.

Fase: Comercial 2.

## 8. Relatórios de embarque e documentação

### REP-401 — Romaneio de embarque

- empresa/fazenda;
- comprador/destino;
- motorista, veículo e placas;
- GTA/NF-e e demais referências;
- animais, sexo, marca, lote e peso;
- totais, médias e observações;
- responsável, emissão e código de verificação.

Saídas: PDF, impressão, XLSX/CSV e JSON de integração. Fase: Embarque.

### REP-402 — Conciliação de embarque

Compara quantidade/peso previstos e realizados, documentos, animais duplicados,
ausentes ou inelegíveis. Fase: Embarque.

### REP-403 — Livro de saídas

Venda, abate, transferência e outras baixas por período, com situação e motivo de
cancelamento. Fase: Embarque.

## 9. Relatórios de governança e qualidade

### REP-501 — Trilha de auditoria

Filtros por usuário, entidade, ação, data e sessão. Exibe antes/depois de forma
legível e exportável. Campos sensíveis são mascarados conforme permissão.

### REP-502 — Integridade e qualidade dos dados

- referências órfãs;
- identificadores conflitantes;
- animais sem cadastro completo;
- séries cronológicas inválidas;
- projeções divergentes;
- campos legados;
- duplicidades e documentos inconsistentes.

### REP-503 — Backup e recuperação

Último backup, tamanho, checksum, destino, resultado de verificação e testes de
restauração.

### REP-504 — Sincronização

Operações pendentes, falhas, conflitos, última sincronização por dispositivo e
volume enviado/recebido. Somente na fase online.

## 10. Painel inicial

O painel deve usar apenas métricas do catálogo:

- animais ativos;
- lotação por lote;
- sessões abertas;
- pesagens recentes;
- animais sem pesagem no prazo;
- GMD e tendência;
- animais perdendo peso;
- próximos da meta;
- pendências;
- embarques em preparação;
- último backup e sincronização.

Não criar cartão sem ação. Clicar deve abrir o relatório/lista filtrada.

## 11. Filtros e comparação

Todos os relatórios devem usar o mesmo motor de filtros das tabelas:

- condições por tipo de dado;
- múltiplas condições;
- período relativo e absoluto;
- filtros salvos;
- compartilhamento futuro por usuário/equipe;
- comparação com período anterior ou grupo de referência;
- indicação visível de filtros ativos.

## 12. Exportação

| Formato | Uso |
|---|---|
| PDF | relatório fechado, romaneio e impressão |
| XLSX | análise administrativa preservando tipos e abas |
| CSV UTF-8 | interoperabilidade e grandes volumes |
| JSON versionado | backup e integração máquina a máquina |

Toda exportação inclui manifesto: versão do relatório, filtros, fuso, locale,
gerador e checksum quando aplicável.

## 13. Critérios de aceite para qualquer relatório

- total confere com consulta de origem;
- nulos não viram zero indevidamente;
- datas e números seguem pt-BR na apresentação;
- valores exportados continuam numéricos;
- mesma população na tela e arquivo;
- teste com zero, um e muitos registros;
- teste com cancelados e retroativos;
- desempenho homologado;
- permissão aplicada;
- fórmula documentada e testada.

