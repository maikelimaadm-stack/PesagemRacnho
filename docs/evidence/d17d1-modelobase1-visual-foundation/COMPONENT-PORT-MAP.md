# Mapa de transporte de componentes

| Componente destino | Fonte real | Tipo | Mantido | Removido/adaptado |
|---|---|---|---|---|
| `ModeloBase1Tokens` | `modeloBase1ScopeCss.js`, `modeloBase1VisualTokens.js`, `mg-prototype.css` | adaptado | escopo, tokens, tipografia | configuração por módulo |
| `ModeloBase1ActionBar` | `MgActionBar.jsx` | adaptado | clusters, altura e gaps | registro dinâmico de ações |
| `ModeloBase1Button/IconButton` | `.tb-btn*` e `empToolbarStyles.js` | adaptado | variantes, pill, 28px, foco/active | permissões/atalhos do CRUD |
| `ModeloBase1Input/NumberInput` | formulários ModeloBase1 | adaptado | campo 38px, label flutuante, estados | schema de entidade |
| `ModeloBase1Select/Combobox` | `MgCmdSelect.jsx` | adaptação reduzida | DOM de display/label/chevron, busca, painel | provider assíncrono/lookup empresarial |
| `ModeloBase1DateField` | `MgDatePicker.jsx` | adaptação reduzida | portal, 320×320, header, grade 6×7, estados | views de mês/ano e integração de filtros |
| `ModeloBase1FilterRail/Chip` | `MgFilterPills.jsx` | adaptado | trilho expansível, pills, clear/config/nav | definição dinâmica e persistência de filtros |
| `ModeloBase1TableShell/Header/Footer` | `MakCadastroTable.jsx` | shell adaptado | DOM tabular, 26/30px, zebra, seleção, resumo | virtualização, filtros reais, busca e CRUD |
| `ModeloBase1Pagination` | `EmpTablePagination.jsx` | shell adaptado | botões 22px e navegação visual | alteração de página real |
| `ModeloBase1DialogShell` | `EmpConfigDialogKit.jsx` | adaptação reduzida | portal, overlay, header/body/footer, transfer grid | drag/drop e salvamento de layout |
| `ModeloBase1PopoverShell` | Radix/ERP popovers | adaptado | portal, sombra, radius e cabeçalho | comandos de domínio |
| `ModeloBase1Feedback` | `Mak*State.jsx` | adaptado | estados, ícones e superfícies | retry e criação operacionais |

## Componentes recriados

Nenhum componente foi criado a partir de uma imagem. Os wrappers são recortes de contrato dos componentes reais. As versões reduzidas existem porque este slice proíbe transportar runtime empresarial e lógica operacional; as diferenças estão classificadas em `FOUNDATION-VISUAL-COMPARISON.md`.
