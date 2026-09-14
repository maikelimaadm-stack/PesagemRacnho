# Mapa de arquivos para a D.17B

## Referência PROJETOMG — somente leitura

- `src/App.jsx`
- `src/shared/layouts/ErpShell.jsx`
- `src/modules/empresas/pages/PAGEMP.jsx`
- `src/modules/empresas/config/modeloBase1/*.js`
- `src/modules/empresas/config/empresasModuleMetadata.js`
- `src/modules/empresas/config/empresasCadastroConfig.js`
- `src/modules/empresas/components/formEmp.constants.js`
- `src/modules/empresas/components/tblEmp.constants.js`
- `src/modules/empresas/components/tblEmp.filters.js`
- `src/ModeloBase1/render/ModeloBase1CadastroPage.jsx`
- `src/ModeloBase1/render/ModeloBase1PanelSections.jsx`
- `src/ModeloBase1/search/MakCadastroSearchPanel.jsx`
- `src/framework/mak/layout/**`
- `src/framework/mak/form/**`
- `src/framework/mak/table/**`
- `src/styles/mg-prototype.css`, `src/index.css`, `src/styles/erp-*.css`, `src/styles/mak-switch.css`

## Pesagens — prováveis alterações visuais

### Shell e configuração visual

- `src/Layout.jsx`
- `src/App.jsx` — apenas wrapper/configuração visual do toast, se necessário.
- `src/index.css`
- `src/styles/modelobase1.css`
- `src/styles/modelobase1/*.css` — apenas diferenças justificadas pelo contrato.
- Novo diretório proposto `src/components/modelobase1/`.

### Páginas

- `src/pages/PesagensIndividuais.jsx`
- `src/pages/LancamentoPesagensIndividuais.jsx`
- `src/pages/ManutencaoSistema.jsx`

### Componentes

- `src/components/mak/MakTh.jsx`
- `src/components/mak/MakColumnMenu.jsx`
- `src/components/pesagens/GerenciarApartacoesDialog.jsx`
- `src/components/pesagens/ComboboxComNovo.jsx`
- `src/components/pesagens/SequenciaBrincos.jsx`
- `src/components/pesagens/ResumoVendaDia.jsx`
- `src/components/pesagens/ResumoLotes.jsx`
- `src/components/pesagens/PesagensResumoRodape.jsx`
- `src/components/sanidade/GerenciarSanidades.jsx`
- `src/components/embarque/GerenciarEmbarquesDialog.jsx`
- `src/components/embarque/ResumoEmbarque.jsx`
- `src/components/ui/{button,card,input,dialog,table,badge}.jsx` apenas se a mudança global for intencional; preferir wrappers escopados para reduzir regressão.

## Pesagens — não alterar na D.17B

- `src/pages.config.js`, salvo necessidade estritamente visual comprovada; as rotas atuais já bastam.
- `src/components/pesagens/animalLookup.jsx` — utilitário de dados, não UI.
- Queries, serviços, hooks e funções de domínio dentro das páginas/componentes.
- Testes existentes, exceto adição de testes visuais/renderização claramente separada.

## Banco/storage — proibido

- `src/storage/**`
- `src/modules/**/application/**`
- `src/modules/**/domain/**`
- `src/modules/**/infrastructure/**`
- `src/api/db.js`
- `src/components/DbBootstrap.jsx`
- `scripts/verify-dexie*`
- Qualquer schema, versão, migração, seed ou rotina de importação/exportação.

## Electron e distribuição — proibido

- `electron/**`
- `data/**`
- Configuração de build/installer e artefatos `dist`/release.

## Dependências — congeladas por padrão

- `package.json`
- `package-lock.json`

Uma alteração nesses dois arquivos exige decisão explícita após prova de que a fidelidade não pode ser alcançada com o stack atual.
