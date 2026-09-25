# Catálogo de relatórios

## 0. Catálogo consolidado (1.4.0, E1)

Desde a 1.4.0 o catálogo tem **12 relatórios** (`visibility: 'catalog'`), **4 de controle** na
Manutenção (`'maintenance'`) e **17 ocultos** (`'hidden'`: 7 de cadastros e os 10 bloqueados). As
33 definições antigas que eram variações de agrupamento/filtro viraram **visões**
(`LEGACY_REPORT_ALIASES` em `definitions/legacyAliases.js`): `resolveReportId(id)` devolve a definição
nova + a seleção equivalente (colunas, grupos, filtros, condições fixas, modo). Gates:
`reports:catalog-consolidation:verify` (equivalência das 33 visões e migração de preferências),
`reports:summary-mode:verify` e `reports:summary-export-parity:verify`.

| id | Título | Grão | Abre | Agrupamento padrão | Filtro rápido | Visões antigas |
|---|---|---|---|---|---|---|
| `rebanho.atual` | Rebanho atual | ANIMAL_CURRENT | Resumido | Lote atual | Sem pesagem há mais de 30 dias | `rebanho.inventario`, `rebanho.dimensao.*` (8), `rebanho.sem-pesagem-recente` |
| `rebanho.ocupacao-lotes` | Ocupação de lotes | LOT | Resumido | Apartação | — | — |
| `pesagens` | Pesagens | EVENT | Resumido | Sessão | Somente entradas e saídas | `pesagens.periodo/sessao/lote/operador/origem`, `movimentacao.entradas-saidas` |
| `controle.fechamento-dia` | Fechamento do dia (imprimível) | EVENT | Detalhado | Sessão | — | — |
| `desempenho` | Desempenho | ANIMAL_PERIOD | Resumido | Lote | Somente perdendo peso | `desempenho.individual`, `desempenho.lote`, `desempenho.dimensao.*` (6), `desempenho.perdendo-peso`, `desempenho.faixa-peso` |
| `movimentacao.lotes` | Movimentação de lotes | LOT_STAY | Resumido | Lote | Somente mudanças de lote no período | `movimentacao.mudancas-lote`, `movimentacao.permanencias-lote` |
| `saidas` | Saídas | EXIT | Resumido | Motivo | Somente mortes | `saidas.motivo`, `saidas.mortes`, `saidas.mortes.causa/categoria/lote` |
| `comercial.vendas` | Vendas do período | EXIT | Detalhado | — | — | — |
| `comercial.abates` | Abates do período | EXIT | Detalhado | — | — | — |
| `comercial.compras` | Compras do período | EVENT | Detalhado | — | — | — |
| `embarques.romaneio` | Romaneio de embarque | EXIT | Resumido | Embarque › Documento | — | — |
| `embarques.previsto-realizado` | Embarques: previsto × realizado | SHIPMENT_DOCUMENT | Resumido | Embarque | — | — |

Manutenção › aba Controle: `controle.auditoria`, `controle.qualidade-dados`, `controle.backups`,
`pesagens.pendencias` (todos abrem Detalhados). Ocultos: `cadastros.*` (as telas de Cadastros listam e
exportam) e os bloqueados (`blocked()`), que continuam resolvíveis por id mas não aparecem.

Regra de modo: `defaultMode` explícito ou, na falta, Resumido quando há `defaultGroups`. Visão antiga
com agrupamento abre Resumida; sem agrupamento, Detalhada.

As seções abaixo descrevem o catálogo **até a 1.3.2** e continuam válidas como referência das visões
(os ids antigos seguem abrindo pelo alias).

## Catálogo até a 1.3.2

Fonte: `src/modules/reporting/definitions/reportCatalog.js`, que importa `pesagens.js`, `rebanho.js`,
`desempenho.js`, `operacional.js` e `controle.js`. Total: **61 definições** — **51 disponíveis** e
**10 bloqueadas**. Ordem do catálogo na tela: Rebanho, Pesagens, Desempenho, Movimentação, Saídas,
Comercial, Embarques, Controle, Cadastros (`FAMILY_ORDER`).

Convenções das tabelas:

- **Permissões**: além de `reports.read` (exigida por todos). Entre parênteses, os perfis que podem abrir
  (A = ADMIN, G = GESTOR, O = OPERADOR, C = CONSULTA). Exportar/imprimir exige também `reports.export`
  (A, G, C). Colunas sensíveis (valores comerciais, usuário da auditoria, login) ficam ocultas para quem
  não tem a permissão correspondente — ver PERMISSIONS.md.
- **Período**: parâmetro `periodo` e preset padrão. "—" = sem período (estado atual ou lista).
- **Condição fixa** = `lockedFilters` (não removível).

## 1. Pesagens (grão EVENT — uma linha por pesagem)

Totais padrão dos três primeiros: Registros, Animais únicos, Peso médio, Peso mínimo, Peso máximo, GMD
ponderado. Os demais: Registros, Animais únicos, Peso médio, GMD ponderado (salvo indicação).

| id | Título | Permissões | Período | Agrupamento padrão | Observações |
|---|---|---|---|---|---|
| `pesagens.periodo` | Pesagens por período | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | — | Canário da arquitetura: paridade de população com a Relação de Pesagens. Um animal pesado 3 vezes aparece 3 vezes. |
| `pesagens.sessao` | Pesagens por sessão | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Sessão | Subtotal por sessão de pesagem. |
| `pesagens.lote` | Pesagens por lote e apartação | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Apartação › Lote | Agrupa pelo cadastro (id), não pelo nome digitado. |
| `pesagens.operador` | Pesagens por operador | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Operador | Registros antigos sem usuário aparecem como "Não informado". |
| `pesagens.pendencias` | Pendências de pesagem | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Pendências | Condição fixa: pendências preenchidas. Mesmas regras do Fechamento do Dia (Peso = GMD negativo; Lote = sem lote; Doc = saída sem documento exigido). Totais: Registros, Animais únicos. |
| `pesagens.origem` | Pesagens por origem do registro | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Origem do registro | Lançamento × importação × massa de teste. |

## 2. Rebanho

| id | Título | Grão | Permissões | Período | Agrupamento padrão | Observações |
|---|---|---|---|---|---|---|
| `rebanho.inventario` | Inventário atual do rebanho | ANIMAL_CURRENT | `animal.read` (A G O C) | — | — | Filtro inicial removível: situação Ativo. Totais: Animais únicos, Peso total/médio/mínimo/máximo (peso atual). |
| `rebanho.dimensao.marca` | Rebanho por marca | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Marca | `presetOf: rebanho.dimensao`; filtro inicial Ativo. |
| `rebanho.dimensao.raca` | Rebanho por raça | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Raça | idem |
| `rebanho.dimensao.categoria` | Rebanho por categoria | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Categoria | idem |
| `rebanho.dimensao.sexo` | Rebanho por sexo | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Sexo | idem |
| `rebanho.dimensao.situacao` | Rebanho por situação | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Situação | Sem filtro inicial: mostra todas as situações. |
| `rebanho.dimensao.lote` | Rebanho por lote | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Lote atual | filtro inicial Ativo |
| `rebanho.dimensao.apartacao` | Rebanho por apartação | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Apartação atual | filtro inicial Ativo |
| `rebanho.dimensao.faixa_peso` | Rebanho por faixa de peso | ANIMAL_CURRENT | `animal.read` (A G O C) | — | Faixa de peso | Faixas do parâmetro `faixas` ou das categorias com faixa de peso; sem faixas, "Não informado" com aviso. |
| `rebanho.sem-pesagem-recente` | Animais sem pesagem recente | ANIMAL_CURRENT | `animal.read` (A G O C) | — (parâmetro "Dias sem pesagem (mais de)", padrão 30, mín. 1) | — | Condição fixa: situação Ativo **e** dias sem pesagem > parâmetro. Animal sem data de pesagem não entra. Ordenado por dias sem pesagem (desc). |
| `rebanho.ocupacao-lotes` | Ocupação de lotes | LOT | `animal.read` (A G O C) | — | Apartação | Ocupação do grupo = Σ animais ÷ Σ capacidades (lotes sem capacidade não entram); peso médio ponderado. |

## 3. Desempenho (grão ANIMAL_PERIOD — uma linha por animal no período)

Todos: `weighing.read` (A G O C); período obrigatório, padrão **Últimos 90 dias**; parâmetro `faixas`.
Totais padrão: Animais, soma de pesagens, peso inicial médio, peso final médio, ganho total, ganho médio,
GMD ponderado, GMD simples. Ganho, dias e GMD só existem com duas ou mais pesagens com peso no período.

| id | Título | Agrupamento padrão | Observações |
|---|---|---|---|
| `desempenho.individual` | Desempenho individual | — | Peso inicial/final, ganho, dias e GMD de cada animal. |
| `desempenho.lote` | Desempenho por lote | Apartação › Lote | Lote/apartação da última pesagem do período. |
| `desempenho.dimensao.marca` | Desempenho por marca | Marca | `presetOf: desempenho.dimensao` |
| `desempenho.dimensao.raca` | Desempenho por raça | Raça | idem |
| `desempenho.dimensao.categoria` | Desempenho por categoria | Categoria | idem |
| `desempenho.dimensao.sexo` | Desempenho por sexo | Sexo | idem |
| `desempenho.dimensao.lote` | Desempenho por lote (sem apartação) | Lote | idem |
| `desempenho.dimensao.apartacao` | Desempenho por apartação | Apartação | idem |
| `desempenho.perdendo-peso` | Animais perdendo peso | — | Condição fixa: ganho < 0. Ordenado por ganho (asc). |
| `desempenho.faixa-peso` | Distribuição por faixa de peso (período) | Faixa de peso | Faixa pelo peso final. |

## 4. Movimentação

| id | Título | Grão | Permissões | Período | Agrupamento padrão | Observações |
|---|---|---|---|---|---|---|
| `movimentacao.entradas-saidas` | Entradas e saídas | EVENT | `weighing.read` (A G O C) | obrigatório · Últimos 30 dias | Tipo | Só lançamentos de Cadastro e Saída. Totais: Registros, Animais únicos, Peso médio, Peso total. |
| `movimentacao.mudancas-lote` | Mudanças de lote | LOT_STAY | `animal.read` (A G O C) | obrigatório · Últimos 30 dias | Lote | Condição fixa: mudança de lote = sim **e** entrada no lote dentro do período. Fonte: projeção `animalLotes`. |
| `movimentacao.permanencias-lote` | Permanência em lotes no período | LOT_STAY | `animal.read` (A G O C) | obrigatório · Últimos 30 dias | Lote | Permanências que tocam o intervalo. Totais: Permanências, Animais únicos, Dias médios no lote. |

## 5. Saídas (grão EXIT — só lançamentos de Saída)

Todos: `weighing.read` (A G O C); período obrigatório, padrão **Últimos 90 dias**.

| id | Título | Agrupamento padrão | Observações |
|---|---|---|---|
| `saidas.motivo` | Saídas por motivo | Motivo da saída | Totais: Saídas, Animais únicos, Peso médio. |
| `saidas.mortes` | Mortes por período | — | Condição fixa: motivo = Morte. `presetOf: saidas.mortes`. Quantidade de mortes; **taxa de mortalidade não é calculada**. |
| `saidas.mortes.causa` | Mortes por causa | Causa da morte | idem; causa = texto gravado no lançamento |
| `saidas.mortes.categoria` | Mortes por categoria | Categoria | idem; categoria gravada na pesagem de saída |
| `saidas.mortes.lote` | Mortes por lote | Lote | idem |

## 6. Comercial — DADOS LEGADOS/POR EVENTO

Todos: `weighing.read` + `commercial.values` (**A G**); período obrigatório, padrão **Últimos 90 dias**;
classificação `COMERCIAL — DADOS LEGADOS/POR EVENTO` (valores e parceiros vêm do texto de cada
lançamento; arrobas = carcaça ÷ 15 com o rendimento gravado; sem rendimento, arrobas ausentes).

| id | Título | Grão | Agrupamento padrão | Observações |
|---|---|---|---|---|
| `comercial.vendas` | Vendas do período | EXIT | — | Condição fixa: motivo = Venda. Totais: Cabeças, Peso total, Arrobas, Valor, Preço da @ ponderado pelas arrobas. |
| `comercial.abates` | Abates do período | EXIT | — | Condição fixa: motivo = Abate. Frigorífico em texto. Mesmos totais (valor e preço/@ do abate). |
| `comercial.compras` | Compras do período | EVENT | — | Só lançamentos de Cadastro; condição fixa: valor pago por cabeça preenchido. Totais: Cabeças, Peso total, Valor, Valor médio por cabeça. |

## 7. Embarques

| id | Título | Grão | Permissões | Período | Agrupamento padrão | Observações |
|---|---|---|---|---|---|---|
| `embarques.romaneio` | Romaneio de embarque | EXIT | `weighing.read` + `shipment.read` (A G O C) | obrigatório · Últimos 90 dias | Embarque › Nº doc | Condição fixa: vinculada a embarque = sim. Totais: Cabeças, Animais únicos, Peso total, Peso médio. |
| `embarques.previsto-realizado` | Embarques: previsto × realizado | SHIPMENT_DOCUMENT | `shipment.read` (A G O C) | **opcional** · Últimos 90 dias (pela data do embarque) | Embarque | Uma linha por documento. Destino/frigorífico em texto. Documento sem previsão: previsto e diferença ausentes (não zero). |

## 8. Controle

| id | Título | Grão | Permissões | Período | Agrupamento padrão | Observações |
|---|---|---|---|---|---|---|
| `controle.fechamento-dia` | Fechamento do dia (imprimível) | EVENT | `session.close` (A G) | obrigatório · Hoje | Sessão | Aberto pelo botão "Imprimir fechamento" do Fechamento do Dia com a data do dia. Totais de pesagens + Peso total. |
| `controle.auditoria` | Trilha de auditoria | AUDIT_ENTRY | `audit.read` (A G) | obrigatório · Últimos 7 dias | — | Sem conteúdo anterior/posterior; nenhum dado de autenticação. Totais: Ações, Registros distintos. |
| `controle.qualidade-dados` | Qualidade dos dados | DATA_ISSUE | `registry.read` + `weighing.read` (A G O C) | — | Gravidade › Tipo de problema | Referências quebradas, duplicidades, valores fora do padrão, registros legados, cadastros não resolvidos. |
| `controle.backups` | Histórico de backups | BACKUP_ENTRY | `maintenance.backup` (A G) | — | — | Somente metadados (data, tipo, arquivo, tamanho, SHA-256). Totais: Backups, Último backup. |

## 9. Cadastros (grão REGISTRY_ITEM)

| id | Título | Permissões | Agrupamento padrão | Observações |
|---|---|---|---|---|
| `cadastros.marcas` | Marcas | `registry.read` (A G O C) | — | `presetOf: cadastros`; Nome, Ativo, Padrão, Abreviação |
| `cadastros.racas` | Raças | `registry.read` (A G O C) | — | + Abreviação, Grupo racial |
| `cadastros.categoriasAnimal` | Categorias | `registry.read` (A G O C) | — | + Sexo, Peso mínimo/máximo, Era, Ordem |
| `cadastros.parceiros` | Parceiros | `registry.read` (A G O C) | — | + Pessoa, CPF/CNPJ, Papéis, Cidade, UF, SIF, Rendimento padrão |
| `cadastros.propriedades` | Propriedades | `registry.read` (A G O C) | — | + Tipo, Município, UF, Código oficial |
| `cadastros.causasMorte` | Causas de morte | `registry.read` (A G O C) | — | + Categoria, Exige observação |
| `cadastros.usuarios` | Usuários | `users.manage` (**A**) | Perfil | Login, perfil, situação, último acesso. Nunca exibe credenciais. |

## 10. Relatórios bloqueados

Aparecem no catálogo para todos os perfis como "Indisponível: <motivo>" e não podem ser abertos
(`REPORT_BLOCKED`).

| id | Título | Família | Grão | `blockedReason` |
|---|---|---|---|---|
| `rebanho.historico-data` | Rebanho em data passada | Rebanho | ANIMAL_CURRENT | não há fotografia do rebanho por data; reconstruir exige nova modelagem |
| `movimentacao.balanco` | Balanço de estoque (inicial + entradas − saídas) | Movimentação | EVENT | depende do rebanho em data passada (nova modelagem) |
| `saidas.taxa-mortalidade` | Taxa de mortalidade | Saídas | ANIMAL_PERIOD | denominador não definido (estoque médio × animais-dia); decisão futura |
| `comercial.por-parceiro` | Totais canônicos por comprador/frigorífico | Comercial | EVENT | comprador e frigorífico são texto; parceiro_id não é gravado (modelagem v8) |
| `comercial.operacao` | Operação comercial agregada (lote de venda, frete, líquido) | Comercial | EVENT | store de operações comerciais não existe (modelagem v8) |
| `comercial.resultado` | Resultado econômico / custo por arroba | Comercial | EVENT | o sistema não registra custos |
| `desempenho.projecao` | Projeção de peso e data de abate | Desempenho | ANIMAL_PERIOD | métrica sem fonte validada |
| `embarques.por-parceiro` | Embarques por parceiro | Embarques | SHIPMENT_DOCUMENT | embarques.parceiro_id nunca é gravado (índice vazio) |
| `cadastros.faixas-identificadores` | Faixas de identificadores | Cadastros | REGISTRY_ITEM | estrutura sem gravador (store vazia) |
| `controle.emissoes` | Registro de emissões de relatórios | Controle | AUDIT_ENTRY | a auditoria ainda não registra exportações; manifestos ficam na pasta de relatórios |

Os três bloqueados comerciais declaram `requires` com `commercial.values`; os demais só `reports.read`.
