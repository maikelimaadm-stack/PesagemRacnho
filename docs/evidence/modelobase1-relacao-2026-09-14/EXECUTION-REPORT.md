# Tela Mãe do ModeloBase1 — Relação de Pesagens e cadastros (14/09/2026)

## Pedido

"Ajeitar igual o ModeloBase1": faltavam os filtros e a pesquisa não era igual
ao modelo, no lançamento/relação e também nos cadastros.

## Referência usada

O ModeloBase1 real (Cadastro de Empresas do PROJETOMG-main) foi renderizado
com a API simulada do próprio projeto base (Playwright + Chrome do sistema,
sem backend) em `docs/evidence/modelobase1-referencia/`:

- `01-cadastro-empresas-tabela.png` — barra de ações, faixa de pílulas, tabela;
- `02-painel-filtros-aberto.png` — painel lateral de 260 px com campos
  rotulados, Status e Limpar/Aplicar;
- `03-menu-coluna.png`, `04-pesquisa-toolbar.png` (pílula de pesquisa com lista
  de resultados e "Buscar todos"), `05-config-colunas.png`, `06-config-filtros.png`,
  `07-menu-mais-opcoes.png`, `08-pill-filtro-aberta.png`;
- `estrutura-dom.json` — inventário de botões, classes e estilos computados.

Para rodar o projeto base no Windows foi preciso um plugin de resolução de
caixa (`erpOperationBadge.js` × `ErpOperationBadge.jsx`), fora do repositório
base (config no scratchpad; nada foi alterado no PROJETOMG-main).

## O que divergia e foi corrigido

| Elemento | Antes (nosso) | Modelo / depois |
|---|---|---|
| Filtros | cartão com listas suspensas | `aside.filter-panel` à esquerda: um campo "contém" por coluna, seleções (Sexo/Tipo/Status; Tipo de cadastro/Situação), datas, Limpar/Aplicar |
| Pesquisa | campo pequeno inline | botão redondo que expande a pílula "Pesquisar..." com lista de resultados (código • título + campos), contador e "Buscar todos"; Enter aplica; selecionar um resultado filtra o animal (Relação) ou abre o registro (cadastros) |
| Barra de ações | Lançar/Novo + 5 ícones soltos | `mg-action-bar`: Filtrar (com ponto de ativo), ação principal `tb-btn-green`, Editar/Excluir em slots animados da seleção; à direita pesquisa, modos e "Mais opções" (speed dial) com Atualizar, Exportar/Importar CSV, modelo, Configurar colunas |
| Faixa de pílulas | só na Relação; cadastros só "Tipo" | `mg-table-panel-strip` em ambos, uma pílula por coluna, botão de configurar colunas à direita |
| Configuração de colunas | só na Relação | também nos cadastros (ordem e visibilidade por grupo, `localStorage`) |
| Composição | grid 240 px + tabela | barra e faixa diretamente na página (36 px, sem cartão), corpo em linha com painel + tabela |

## Arquivos

- Novos em `src/components/mak/`: `MgFilterPanel.jsx`, `MgDesktopSearch.jsx`,
  `MgSearchResultsDropdown.jsx`, `MgSpeedDialMenu.jsx`, `MgTablePanelStrip.jsx`,
  `MgCmdSelect.jsx`, `MgPortalPanel.jsx`, `useMgPanelPosition.js`,
  `mgSearchHighlight.jsx` (portes do `framework/mak/layout` do modelo; os
  estilos já estavam em `src/styles/modelobase1/mg-layout.css`).
- `src/pages/PesagensIndividuais.jsx` — barra, faixa, painel e pesquisa.
- `src/components/cadastros/CadastroAuxiliarPage.jsx` — modo lista; o modo de
  registro (formulário) não foi tocado.
- `src/styles/d17b-modelobase1.css` — bloco `D.17D.2R34`.
- `scripts/verify-ui-consistency.mjs` — contratos R34 (Relação e cadastros).
- `scripts/capture-screens.electron.cjs` — `CAPTURE_STEPS` e `CAPTURE_PRELUDE`
  para capturar estados (painel aberto, pesquisa, menu) e semear cadastros.

## Verificação

- Estilos computados a 1440 px: barra 36 px; botões 28 px em pílula; painel
  260 px com campos de 38 px/13 px do modelo; Aplicar verde `#40de63`.
- Funcional (navegador): painel filtra e limpa; pesquisa lista resultados,
  aplica e limpa; "Mais opções" com 4/3 itens; configuração de colunas abre e
  persiste.
- Capturas claro/escuro: `screens/` desta pasta e em
  `../modelobase1-cadastros-2026-09-14/screens/`.
- `lint` limpo; contratos R34 aprovados isoladamente; `import:selection`,
  `ui:locale-dialog`, `animal:history-integrity`, `ui:scrollbar-contract` OK.

## Observação sobre trabalho paralelo

Outra sessão alterou hoje `LancamentoPesagensIndividuais.jsx`, blocos
`D.17D.2R30`–`R33` do CSS e `CadastroAuxiliarPage.jsx`, e acrescentou
asserções em `verify-ui-consistency.mjs`. Uma delas ("alternância
Registro/Tabela reutiliza a estrutura segmentada oficial") falha contra o
próprio código dessa sessão (espera `className={\`view-seg aux-view-seg` e o
arquivo tem `className="view-seg aux-view-seg"`), independentemente deste
porte. Não foi corrigida aqui para não interferir naquele trabalho.
