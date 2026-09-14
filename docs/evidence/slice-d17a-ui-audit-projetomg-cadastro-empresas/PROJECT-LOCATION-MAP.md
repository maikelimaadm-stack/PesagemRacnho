# Mapa de localização dos projetos

## Raízes

| Item | Caminho real |
|---|---|
| Workspace | `C:\Users\maike\Desktop\projeto` |
| Pesagens Individuais Desktop | `C:\Users\maike\Desktop\projeto\MAKGESTAO-main` |
| PROJETOMG copiado | `C:\Users\maike\Desktop\projeto\arquivos do projetomgdomodelobase1\PROJETOMG-main` |
| Evidências D.17A | `MAKGESTAO-main/docs/evidence/slice-d17a-ui-audit-projetomg-cadastro-empresas/` |

## Cadastro de Empresas — entrada e composição

| Função | Arquivo |
|---|---|
| Rota oficial `/CadastroEmpresas` | `PROJETOMG-main/src/App.jsx` |
| Manifesto da rota | `PROJETOMG-main/src/modules/generatedModules.json` |
| Página fina | `PROJETOMG-main/src/modules/empresas/pages/PAGEMP.jsx` |
| Configuração agregadora | `PROJETOMG-main/src/modules/empresas/config/modeloBase1/empresasModeloBase1Config.js` |
| Layout do módulo | `PROJETOMG-main/src/modules/empresas/config/modeloBase1/empresasLayoutConfig.js` |
| Toolbar do módulo | `PROJETOMG-main/src/modules/empresas/config/modeloBase1/empresasToolbarConfig.js` |
| Busca/cards | `PROJETOMG-main/src/modules/empresas/config/modeloBase1/empresasSearchViewConfig.js` |
| Metadados do módulo | `PROJETOMG-main/src/modules/empresas/config/empresasModuleMetadata.js` |
| Configuração de cadastro | `PROJETOMG-main/src/modules/empresas/config/empresasCadastroConfig.js` |
| Constantes de formulário | `PROJETOMG-main/src/modules/empresas/components/formEmp.constants.js` |
| Constantes/filtros de tabela | `PROJETOMG-main/src/modules/empresas/components/tblEmp.constants.js`, `tblEmp.filters.js` |

`PAGEMP.jsx` não contém o desenho da tela: apenas injeta `empresasModeloBase1Config` em `ModeloBase1CadastroPage`. A referência real é a soma do runtime ModeloBase1, framework MAK, configurações de Empresas, shell e CSS ativo.

## Layout e UI de referência

- `PROJETOMG-main/src/ModeloBase1/render/ModeloBase1CadastroPage.jsx`
- `PROJETOMG-main/src/ModeloBase1/render/ModeloBase1PanelSections.jsx`
- `PROJETOMG-main/src/framework/mak/page/MakCadastroPage.jsx`
- `PROJETOMG-main/src/framework/mak/layout/`
- `PROJETOMG-main/src/framework/mak/form/MakCadastroForm.jsx`
- `PROJETOMG-main/src/framework/mak/form/MakFormShell.jsx`
- `PROJETOMG-main/src/framework/mak/table/MakCadastroTable.jsx`
- `PROJETOMG-main/src/framework/mak/table/MakTable.jsx`
- `PROJETOMG-main/src/ModeloBase1/search/MakCadastroSearchPanel.jsx`
- `PROJETOMG-main/src/shared/layouts/ErpShell.jsx`
- `PROJETOMG-main/src/framework/mak/layout/MgDesktopHeader.jsx`
- `PROJETOMG-main/src/framework/mak/layout/MgMobileHeader.jsx`
- `PROJETOMG-main/src/framework/mak/layout/MgPrototypeSidebar.jsx`

## Estilos de referência

- Ativo e determinante para Empresas: `src/styles/mg-prototype.css`.
- Base global: `src/index.css`, `src/styles/erp-design-system-2030.css`, `erp-responsive.css`, `erp-theme-escuro.css`, `erp-scrollbar.css`, `mak-switch.css`.
- `src/styles/mg-ui-system.css` existe, mas não integra o encadeamento ativo observado para a rota; seus tokens azuis não são o contrato de Empresas.

## Pesagens — entradas e telas

| Função | Arquivo |
|---|---|
| Roteamento | `MAKGESTAO-main/src/App.jsx`, `src/pages.config.js` |
| Layout global | `MAKGESTAO-main/src/Layout.jsx` |
| Listagem principal | `MAKGESTAO-main/src/pages/PesagensIndividuais.jsx` |
| Lançamento | `MAKGESTAO-main/src/pages/LancamentoPesagensIndividuais.jsx` |
| Manutenção | `MAKGESTAO-main/src/pages/ManutencaoSistema.jsx` |
| Componentes de pesagens | `MAKGESTAO-main/src/components/pesagens/` |
| Sanidade | `MAKGESTAO-main/src/components/sanidade/` |
| Embarque | `MAKGESTAO-main/src/components/embarque/` |
| Cabeçalho/menu de tabela parcial | `MAKGESTAO-main/src/components/mak/` |
| Primitivos UI | `MAKGESTAO-main/src/components/ui/` |
| CSS portado | `MAKGESTAO-main/src/styles/modelobase1/`, `src/styles/modelobase1.css` |

As rotas do Pesagens são HashRouter: `/PesagensIndividuais` (inicial), `/LancamentoPesagensIndividuais` e `/ManutencaoSistema`.
