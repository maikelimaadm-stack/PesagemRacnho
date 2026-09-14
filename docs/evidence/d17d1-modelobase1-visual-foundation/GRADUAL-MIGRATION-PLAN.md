# Plano de migração gradual

Regras comuns a todos os slices: sem alteração de storage/domínio/infraestrutura, screenshots antes/depois nas seis resoluções, testes funcionais da área tocada, lint/build/test e classificação visual objetiva.

## D.17D.2 — Shell, header, sidebar e page container

- escopo: transportar o shell e alinhar containers, sem tocar nas operações;
- permitidos: `Layout.jsx`, novo diretório `modelobase1/layout`, CSS de shell;
- proibidos: pages de negócio, `src/storage/**`, `src/modules/**`, Electron e package files;
- evidência: shell antigo/referência/novo em desktop, tablet e mobile;
- teste funcional: navegação entre as três rotas atuais e VisualLab;
- aceite: dimensões, colapso, header e scroll iguais ao contrato da referência.

## D.17D.3 — Toolbar, action bar e trilho de filtros

- escopo: migrar somente as barras e filtros abaixo da pesagem;
- permitidos: componentes de toolbar/filtros e pontos visuais nas pages autorizadas;
- proibidos: queries, callbacks, conteúdo de filtros e persistência;
- evidência: estados normal/ativo/aberto/overflow antes e depois;
- teste funcional: adicionar, remover, limpar e preservar filtros existentes;
- aceite: alturas, gaps, ícones, pills, navegação e breakpoints equivalentes.

## D.17D.4 — Tabela, cabeçalhos, filtros de coluna e rodapé

- escopo: trocar apenas o revestimento visual da tabela operacional;
- permitidos: table shell/header/footer e adapters estritamente visuais;
- proibidos: mapper, storage, ordenação/seleção/regras de totalização;
- evidência: tabela, filtro de coluna, menu, seleção, scroll e rodapé;
- teste funcional: busca, sort, seleção, filtros, paginação e exportação atuais;
- aceite: grade 26/30px, cabeçalhos, estados e contadores fiéis sem regressão.

## D.17D.5 — Formulário de lançamento e campos

- escopo: migrar layout e controles do lançamento sem mudar validações;
- permitidos: JSX visual e wrappers de fields;
- proibidos: handlers, schemas, persistência e cálculo de pesagem;
- evidência: todos os estados de campo e proporções de colunas;
- teste funcional: lançar, editar, validar e cancelar pesagem;
- aceite: controles 38px, labels, foco/erro/readonly e layout equivalentes.

## D.17D.6 — Popups, dialogs, selects e calendários

- escopo: transportar overlays um por vez;
- permitidos: `components/modelobase1/overlay|fields` e dialogs autorizados;
- proibidos: ações internas, dados, drag/drop e persistência sem teste dedicado;
- evidência: aberto/fechado/scroll/mobile, calendário dia/mês/ano;
- teste funcional: foco, escape, retorno de foco, seleção e confirmação/cancelamento;
- aceite: portal, z-index, overlay, sombra, radius e comportamento equivalentes.

## D.17D.7 — Quadros de resumo e cards

- escopo: revestir distribuições, apartações e resumos;
- permitidos: cards e containers de resumo;
- proibidos: fórmulas, agrupamentos, totais e regras pecuárias;
- evidência: vazio, preenchido, seleção e overflow;
- teste funcional: valores e agrupamentos antes/depois idênticos;
- aceite: hierarquia, densidade, paddings e responsividade equivalentes.

## D.17D.8 — Responsividade e mobile

- escopo: consolidar breakpoints após os componentes estáveis;
- permitidos: CSS responsivo e pequenos wrappers de layout;
- proibidos: lógica baseada em viewport e duplicação de regras de negócio;
- evidência: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024 e 390×844;
- teste funcional: teclado, touch, scroll, drawer e overlays;
- aceite: sem corte, sobreposição, barra dupla ou perda de ação.

## D.17D.9 — Pixel comparison final e limpeza

- escopo: medir diferenças finais e remover ponte visual obsoleta;
- permitidos: somente CSS/componentes já migrados e docs;
- proibidos: novos recursos, regras ou dependências;
- evidência: side-by-side e overlay por página/estado/resolução;
- teste funcional: suíte completa e checklist manual crítico;
- aceite: nenhuma P1/P2; P3 explicitamente aprovada; artefatos antigos removidos com prova de não uso.
