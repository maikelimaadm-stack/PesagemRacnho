# Auditoria da UI atual do Pesagens

## Layout e rotas

`src/Layout.jsx` envolve todas as páginas em `cadastro-emp-scope mg-empresas-scope`, mas renderiza um header próprio: branco, sticky, com ícone de balança e três links horizontais. O conteúdo usa largura máxima de 1600 px e padding genérico. Não há header verde, breadcrumbs, sidebar, chrome mobile ou barra inferior da referência.

`src/App.jsx` mantém Query Client, `DbBootstrap`, HashRouter e um `Toaster` Sonner genérico. As rotas são declaradas em `src/pages.config.js`.

## `PesagensIndividuais.jsx`

- Cabeçalho branco próprio, com título/subtítulo e ações.
- Seis cards KPI antes da listagem.
- Card de filtros amplo com busca, selects, datas e limites de peso em grid próprio.
- Tabela com `MakTh`, zebra, seleção, paginação e diálogos de edição/importação/colunas/lotes.
- Não usa o mother-page, action bar, filtro lateral, faixa contextual, empty/loading states e rodapé de contagem do ModeloBase1.
- Estrutura é semanticamente próxima de uma listagem, tornando esta a melhor primeira tela para a D.17B.

## `LancamentoPesagensIndividuais.jsx`

- Já usa classes `mak-mother-page` e o escopo visual mestre.
- Chrome interno com padding/scroll próprios e toolbar simples de título + atualizar.
- Formulário denso e condicional para compra, venda, abate e embarque.
- Diversos resumos, cards, tabela do dia, rodapé e painel de sanidade.
- Conteúdo e callbacks estão muito acoplados à operação; a adaptação deve envolver regiões visualmente, sem decompor ou reescrever regras.

## `ManutencaoSistema.jsx`

- Coluna com largura máxima de 5xl, título/subtítulo e cards de status, backup, exportação, importação, restauração e diagnóstico.
- Usa algumas classes `emp-*`, mas não o shell/padrão de página da referência.
- A fidelidade precisa preservar todas as ações operacionais e alertas; somente organização, tokens e wrappers podem mudar.

## Componentes auxiliares

- Pesagens: `GerenciarApartacoesDialog`, `ComboboxComNovo`, `SequenciaBrincos`, `ResumoVendaDia`, `ResumoLotes`, `PesagensResumoRodape`, `animalLookup`.
- Sanidade: `GerenciarSanidades`.
- Embarque: `GerenciarEmbarquesDialog`, `ResumoEmbarque`.
- MAK parcial: `MakTh` e `MakColumnMenu` aproximam cabeçalho/ações de tabela, mas não formam o engine completo.
- `MakColumnMenu` oferece item “Auto ajustar coluna” sem callback observado, criando affordance visual inerte.
- Primitivos `components/ui`: Button, Card, Input, Dialog, Table, Badge e subconjunto Radix/shadcn.

## CSS existente

- `erp-design-system-2030.css`, `erp-responsive.css` e `erp-scrollbar.css` são cópias idênticas às da referência na comparação realizada.
- `src/styles/modelobase1/mg-layout.css` corresponde a `mg-prototype.css`, exceto pela remoção do import remoto do Google Fonts.
- `emp-scope.css` é um recorte do `index.css` da referência, não uma cópia integral.
- `src/styles/modelobase1.css` adiciona glue local para tabela, alturas, padding e ícones.
- Esses estilos são carregados globalmente em todas as rotas do Pesagens; no PROJETOMG, `mg-prototype.css` é carregado no contexto da rota MAK. Isso aumenta o risco de cascata global.
- Sem o import remoto, DM Sans não está garantida: o app cai no fallback do sistema, coerente com offline, mas não necessariamente idêntico.

## Padrão visual atual

A UI é híbrida: tokens verdes e classes copiadas do ModeloBase1 convivem com primitivos shadcn genéricos e utilitários slate, emerald, blue e purple. Cards genéricos usam `rounded-xl` e sombra própria; botões/inputs usam alturas do kit local; dialogs têm grids e estilos variados. Há aproximação maior nas tabelas, mas baixa uniformidade no shell, formulários, toolbars e estados.

## Responsividade atual

Predomina adaptação ad hoc com breakpoints Tailwind `md`, `lg` e `xl`. O header horizontal pode comprimir/estourar; vários dialogs usam grids fixos de seis colunas sem estratégia móvel dedicada. Não há troca explícita para header mobile/drawer/action bar/barra inferior.

## Riscos de adaptação

1. Alterar componentes grandes pode afetar handlers por engano.
2. Copiar o runtime MAK completo introduziria domínio, preferências e dependências indevidas.
3. CSS global já portado pode mascarar conflitos e produzir regressões cruzadas.
4. Densidade de tabela e grids de dialogs podem falhar em viewport pequena.
5. A fonte da referência depende de rede; o Pesagens é offline.
6. Backup/import/export e inicialização Dexie compartilham as páginas visuais e exigem regressão funcional específica.
