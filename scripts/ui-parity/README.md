# Harness de referência do ModeloBase1 (paridade de UI)

Ferramentas usadas em 14/09/2026 para renderizar o ModeloBase1 real (PROJETOMG-main, módulo
Cadastro de Empresas) sem backend, com a API simulada, e capturar telas + estilos computados em
`docs/evidence/modelobase1-referencia/`. Servem à fatia de paridade de UI (docs/evidence/ui-parity/).

## Como rodar

1. Projeto base: `C:\Users\maike\Desktop\projeto\arquivos do projetomgdomodelobase1\PROJETOMG-main`
   (não alterar nada lá). No Windows há colisão de caixa entre `erpOperationBadge.js` e
   `ErpOperationBadge.jsx`; por isso o Vite do projeto base é iniciado com o config externo
   `base-vite.config.mjs` (plugin de resolução exata de caixa):
   `npx vite --config <caminho absoluto de base-vite.config.mjs> --port 5175` (cwd = pasta do PROJETOMG-main).
2. Com o Vite base em `http://127.0.0.1:5175`, rodar
   `node scripts/ui-parity/capture-modelobase1-reference.mjs` (Playwright + Chrome do sistema; variáveis
   `OUT` e `BASE`). O script simula sessão/API (`**/*` com prefixo `/api/`), fixa preferências (modo tabela e
   colunas), fecha a sidebar e captura a barra de ações, painel de filtros, menu de coluna, pesquisa,
   configuração de colunas/filtros, "mais opções" e pílula aberta, além de `estrutura-dom.json`.
3. Para a tela de documentos fiscais (amostra do responsável, módulo `cadcps`), ajustar a rota e os mocks
   no mesmo script (o framework é o mesmo: `MgActionBar`, `MgFilterPills`, `MgTablePanelStrip`, `MakCadastroTable`).

`debug-modelobase1.mjs` imprime a estrutura do DOM/console para diagnosticar a renderização.
