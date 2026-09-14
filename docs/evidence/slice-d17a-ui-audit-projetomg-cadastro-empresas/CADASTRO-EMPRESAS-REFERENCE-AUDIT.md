# Auditoria da referência — Cadastro de Empresas

## Fonte de verdade

A tela oficial é a rota `/CadastroEmpresas`. O caminho de renderização é:

`App.jsx` → `ErpShell` → `PAGEMP.jsx` → `empresasModeloBase1Config` → `ModeloBase1CadastroPage` → componentes MAK/ModeloBase1.

O escopo calculado é `cadastro-empresas-scope cadastro-emp-scope mg-empresas-scope`. As duas últimas classes são o escopo visual mestre compartilhado.

## Layout geral

- Aplicação ERP de altura integral, com header desktop verde ou header mobile dedicado.
- Sidebar de navegação agrupada, flutuante ou fixável, com 220 px no desktop.
- Área da página em coluna: filtro lateral, pilha de subtoolbars e pilha de views.
- `mg-view-stack` mantém Registro, Cards e Tabela como modos alternáveis sem mudar o contexto do cadastro.
- Desktop oferece seletor Registro/Cards/Tabela; mobile usa barra inferior fixa com os mesmos modos.
- Breadcrumbs aparecem no header, não como um bloco grande dentro do conteúdo.

## Header, sidebar e navegação

- `MgDesktopHeader`: 36 px, fundo verde, menu, breadcrumbs e ações de tema, notificações, ajuda, apps, usuário e marca.
- `MgMobileHeader`: 48 px, compacto e separado do desktop.
- `MgPrototypeSidebar`: 220 px, grupos, itens, estados ativos e mecanismo de fixação.
- Breakpoint estrutural principal: 768 px; CSS complementar também usa 640, 1024, 480 e 390 px.

## Toolbar e ações

- `MakActionBar` concentra filtro, Novo, Salvar, Cancelar, Editar, Excluir, Duplicar, busca/favoritos, anexos e menu de mais ações.
- O menu complementar contempla Excel, PDF, impressão, histórico, configuração e layout.
- Há variantes desktop e mobile, estados bloqueados, feedback de seleção e transições.
- Botões da toolbar têm 28 px no desktop; no mobile, 36 px. Ações usam `ios-btn`, `tb-btn` e `tb-btn-labeled`, com variantes verde, neutra e destrutiva.

## Filtros e busca

- Filtro desktop abre painel lateral de 260 px; mobile abre drawer fixo de até 280 px.
- Painel possui título, fechamento, corpo de campos e ações Limpar/Aplicar.
- Busca usa pill arredondado e dropdown entre 240 e 300 px, integrando resultados e favoritos.
- Uma faixa contextual mostra favorito, código/título do registro e navegação primeiro/anterior/contador/próximo/último.

## Formulários

- Formulário corporativo em grid de 12 colunas.
- Abas padrão: Principais, Endereço e Observações; campos personalizados podem acrescentar conteúdo.
- Principais: Dados principais (12 colunas), Informações adicionais (6) e Contato (6).
- Endereço e Observações usam cards de largura total.
- Estados leitura, edição e somente leitura possuem classes próprias.
- Campos ativos têm 38 px; idle, preenchido, readonly, bloqueado, foco e inválido possuem tratamento distinto.
- Mobile inclui navegação ajustada e footer fixo de formulário para Cancelar/Salvar.

## Tabela/listagem

- `MakCadastroTable`/`MakTable`: cabeçalho sticky, ordenação, filtros por coluna, limpar filtro, pinagem, ocultação, redimensionamento e menu de coluna.
- Linhas zebrada e hover; cabeçalho e linhas usam aproximadamente 26 px pelas constantes do módulo.
- Seleção, duplo clique/abertura, fullscreen de cadastro, totalizadores, paginação ou carregamento incremental.
- Rodapé informa Selecionados, Listados, Filtrados e Totais.
- Corpo virtualizado para volume, usando `@tanstack/react-virtual`.
- Empty state e overlay de carregamento são componentes, não apenas texto em uma célula.
- Empresas declara 20 colunas, iniciando por ID Global, Cód Empresa e Razão.

## Cards/listagem alternativa

- Grid virtualizado configurável, com campos e layout selecionáveis.
- Cards suportam favorito, abertura, estados vazios/carregamento e resumo de contagem.
- Gap de cards: 12 px; espaçamento interno recorrente: 10 px.

## Modais e dialogs

- Base Radix/shadcn e shells próprios do MAK.
- Inclui exportação, anexos, confirmação, configuração de colunas, campos de filtro e layout.
- Dialogs de configuração usam `mg-config-dialog`, header, corpo/lista/tabela e footer coerentes.

## Feedback e estados

- `ErpToaster` baseado em Sonner: canto superior direito, expandido, máximo de cinco, offset 16 px e gap 10 px.
- Classes específicas para sucesso, erro, aviso e informação.
- Há skeletons de formulário, overlays de tabela, empty states, warnings de preferências e aviso beta somente leitura.

## Tecnologia visual

- React 18, Tailwind/utilitários, CSS global escopado e componentes próprios MAK/ModeloBase1.
- Primitivos Radix/shadcn, Lucide para ícones, Sonner para toast.
- Não foi encontrada dependência Framer Motion; o movimento relevante está em CSS e estado React.
- `clsx`, CVA e `tailwind-merge` sustentam composição de classes.

## Limite da auditoria

Os valores e relações acima foram derivados de código, configurações e CSS ativos. Não houve validação por screenshot executável nesta máquina; portanto, efeitos dependentes do navegador, da fonte remota e de dados reais devem ser confirmados na baseline da D.17B.
