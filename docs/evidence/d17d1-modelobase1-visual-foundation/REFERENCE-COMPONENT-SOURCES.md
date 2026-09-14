# Fontes reais de componentes da referência

Referência auditada: `C:\Users\maike\Desktop\projeto\arquivos do projetomgdomodelobase1\PROJETOMG-main`.

| Área | Arquivo real | Imports/dependências visuais | CSS/tokens | Dependência de domínio removida na adaptação |
|---|---|---|---|---|
| Entrada da página | `src/modules/empresas/pages/PAGEMP.jsx` | `ModeloBase1CadastroPage`, configuração do módulo | escopo retornado por `buildModeloBase1ScopeCssClass` | configuração e serviços de empresas |
| Orquestração visual | `src/ModeloBase1/pages/ModeloBase1CadastroPage.jsx` | layouts, actions, table, dialogs | `cadastro-emp-scope mg-empresas-scope` | carregamento, CRUD e estado empresarial |
| Escopo mestre | `src/ModeloBase1/layout/modeloBase1ScopeCss.js` | nenhum | classes de escopo oficiais | `moduleId` empresarial |
| Tokens de formulário | `src/ModeloBase1/layout/modeloBase1VisualTokens.js` | aliases/classes oficiais | altura, grade e classes de input | metadados de 12 colunas |
| Action bar | `src/framework/mak/layout/MgActionBar.jsx` | Lucide, ações MAK | `.mg-action-bar`, `.tb-btn*` | permissões e callbacks CRUD |
| Botões | `src/framework/cadastro/toolbars/empToolbarStyles.js` | classes de toolbar | `.tb-btn`, variantes e ícones | nomes de ações empresariais |
| Filter rail/chips | `src/framework/mak/layout/MgFilterPills.jsx` | Lucide, `ErpFilterPopover` | `.mg-filter-pill*`, `.mg-filter-pills-rail*` | definições de filtros do cadastro |
| Popover de filtro | `src/shared/filters/ErpFilterPopover.jsx` | filtros, date range, selects | `.erp-filter-*`, painel flutuante | operadores e metadados de colunas |
| Select pesquisável | `src/framework/mak/fields/MgCmdSelect.jsx` | portal/painel, Lucide | `.cmd-select`, `.cmd-panel`, `.cmd-option` | lookup e fontes de dados empresariais |
| Campo de data | `src/framework/mak/fields/MgDatePicker.jsx` | React portal, Lucide | `.mg-dp*` | normalização de filtros empresariais |
| Controle de data | `src/framework/cadastro/formularios/EmpFormDateControl.jsx` | input, calendário/relógio | `.emp-form-date-control`, `.emp-form-date-btn` | integração com schema de campos |
| Tabela | `src/framework/mak/table/MakCadastroTable.jsx` | `MakDock`, tabela, filtros | `.emp-table-*`, `.mg-records-summary*` | paginação remota, seleção e CRUD |
| Paginação | `src/framework/cadastro/pagination/EmpTablePagination.jsx` | Lucide, select de page-size | `.emp-table-pagination*` | fonte de dados e totalizadores reais |
| Cabeçalho/células | `src/styles/mg-ui-system.css` e `src/styles/erp-design-system-2030.css` | nenhum | `.emp-th`, `.emp-td`, zebra/hover/seleção | nenhuma |
| Dialog configurador | `src/framework/cadastro/configurators/EmpConfigDialogKit.jsx` | Radix Dialog, Lucide, tabelas | `.emp-config-dialog*`, `.emp-config-transfer*` | drag/drop e persistência de layouts |
| Estilos de dialog | `src/framework/cadastro/styles/empConfigDialogStyles.js` | constantes de classe | classes do kit de configuração | nenhuma |
| Feedback | `src/framework/mak/ux/MakEmptyState.jsx`, `MakLoadingState.jsx`, `MakErrorState.jsx` | Lucide | tokens de superfície/texto | callbacks de retry/nova entidade |
| Primitivos | `src/shared/ui/button.jsx`, `input.jsx`, `dialog.jsx`, `popover.jsx`, `select.jsx`, `table.jsx`, `badge.jsx` | Radix, Lucide | Tailwind + estilos ERP/MG | nenhuma |
| CSS mestre | `src/styles/mg-prototype.css` | DM Sans e variáveis | tokens, campos, filtros, calendário, tabela e overlays | nenhuma |

## Critério de transporte

Foram preservados os contratos DOM essenciais e as classes conceituais da referência. A adaptação usa nomes `mb1-*` para impedir colisão com o CSS legado já global no projeto de Pesagens. Serviços, schemas, permissões, armazenamento, runtime empresarial e metadados do Cadastro de Empresas não foram copiados.
