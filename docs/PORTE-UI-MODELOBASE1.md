# Porte da biblioteca de UI do Cadastro de Empresas (modelobase1)

Objetivo: a tela de Lançamento e a de Relação devem ficar **exatamente iguais**
ao Cadastro de Empresas — tabela com menu/filtro por coluna, barra de ações,
painel de filtros, seleção, paginação e configuração de colunas.

## Onde está o modelo
`../arquivos do projetomgdomodelobase1/PROJETOMG-main/`

## O que já está feito (não refazer)
- **CSS original integral** em `src/styles/modelobase1/`
  (`erp-design-system-2030.css`, `emp-scope.css`, `mg-layout.css` = mg-prototype,
  `erp-responsive.css`, `erp-scrollbar.css`), importados em `src/main.jsx`.
- **Escopo** `cadastro-emp-scope mg-empresas-scope` no `Layout.jsx` e nas telas.
- **Regiões de layout** `mak-mother-page__toolbar / __panel-strip / __view-stack`
  aplicadas no Lançamento.
- **Cabeçalho de tabela** com o HTML do modelo via `src/components/mak/MakTh.jsx`
  (`emp-th-label-wrap`, `emp-th-label`, `emp-th-trailing`, `emp-th-menu-button`)
  + zebra `emp-row-even/odd` — nas DUAS tabelas.
- Medidas conferidas no navegador: cabeçalho 26px `#f2f5f9`; zebra
  `#ffffff`/`#fafbfc`; menu de coluna 16px com ícone 12px.

## O que falta (o porte em si)
A biblioteca do modelo tem **192 arquivos** em `src/framework/mak`. O núcleo da
tabela é `src/framework/mak/table/MakCadastroTable.jsx` (2.407 linhas) e importa:

```
@/framework/mak/filters                     @/framework/mak/layout
@/framework/mak/ux                          @/framework/mak/dock/MakDock
@/framework/mak/runtime/MakModuleContext    @/framework/mak/table/MakTableSelectCheck
@/framework/mak/table/useMakTableModuleConfig
@/framework/cadastro/configurators/EmpConfiguracaoColunasDialog
@/framework/cadastro/fields/campoEngine     @/framework/cadastro/pagination/EmpTablePagination
@/framework/cadastro/tables/empColumnLayout
@/shared/components/EmpVirtualTableBody     @/shared/components/ErpScrollNav
@/shared/filters                            @/shared/listing/listQueryConfig
@/shared/hooks/useDebouncedValue            @/shared/layouts/ErpTableFullscreenContext
@/shared/constants/erpLayout                @/hooks/use-mobile
```

### Ordem sugerida
1. **Menu de coluna** (o que o usuário mais quer): filtro por coluna, ordenar,
   fixar, ocultar, auto-ajustar. Gancho já existe: `onOpenMenu` em `MakTh.jsx`.
   Referência: bloco do `columnMenu` em `MakCadastroTable.jsx`.
2. **Painel de filtros** (`MakFilterPanel` / `@/framework/mak/filters`).
3. **Barra de ações** (`MakActionBar`) na região `__toolbar`.
4. **Seleção + paginação + configuração de colunas** (`MakTableSelectCheck`,
   `EmpTablePagination`, `EmpConfiguracaoColunasDialog`).

### Estratégia
Copiar os arquivos do modelo para `src/framework/mak/**` mantendo os mesmos
caminhos de import (o alias `@` já aponta para `src`), e ir removendo as
dependências que não existem aqui (react-query, permissões, metadata do ERP),
substituindo por nossa camada Dexie (`src/storage/storageAdapter.js`).

## Restrições
- **Não alterar os campos do formulário de lançamento** (serão ajustados depois).
- Sem login/permissões/cloud/servidor.
- Armazenamento continua IndexedDB/Dexie.
- **Validar no navegador com dados de teste antes de concluir** — o build passa
  mesmo com erro de runtime (já aconteceu: variável de ordenação inexistente
  deixou a tela de Relação em branco).

## Estado atual
`lint` e `build` passam; as duas telas renderizam; sem dados de teste no banco.

## Atualização de 14/09/2026 — Tela Mãe portada (Relação e cadastros)

Referência real renderizada com a API simulada do próprio PROJETOMG-main
(`docs/evidence/modelobase1-referencia/`). Portado para `src/components/mak/`:

| Peça do modelo | Componente aqui | Onde está aplicado |
|---|---|---|
| Barra de ações `mg-action-bar` (Filtrar, Novo, seleção, pesquisa, modos, Mais opções) | markup do modelo nas páginas + `MgDesktopSearch` + `MgSpeedDialMenu` | Relação (`PesagensIndividuais.jsx`), cadastros auxiliares (`CadastroAuxiliarPage.jsx`, modo lista) |
| Pesquisa expansível com resultados e "Buscar todos" | `MgDesktopSearch` + `MgSearchResultsDropdown` + `mgSearchHighlight` | idem |
| Faixa de pílulas + configurar colunas | `MgTablePanelStrip` (+ `MakFilterRail`/`MakFilterPill` já existentes) | idem |
| Painel lateral `filter-panel` (260 px, Limpar/Aplicar) | `MgFilterPanel` + `MgCmdSelect` + `MgPortalPanel` + `useMgPanelPosition` | idem |
| Configuração de colunas | `MakColumnConfigDialog` (já existia) | Relação e cadastros (ordem/visibilidade por grupo) |

Diferenças mantidas de propósito: sem "Buscar favoritos", sem configuração de
campos da pesquisa e sem botão de anexos (funcionalidades sem equivalente no
produto). Composição da página no bloco `D.17D.2R34` de
`src/styles/d17b-modelobase1.css`; contratos R34 em `verify-ui-consistency.mjs`.
Pendente: o Lançamento de Pesagens não recebe painel lateral nem pesquisa
(sua tabela é a do dia); avaliar na próxima rodada se o usuário quiser.
