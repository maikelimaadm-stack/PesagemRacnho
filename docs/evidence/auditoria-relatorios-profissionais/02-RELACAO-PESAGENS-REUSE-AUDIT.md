# 02 — Relação de Pesagens: auditoria de reuso

Tela: `src/pages/PesagensIndividuais.jsx` (1569 linhas). Linhas citadas são desse arquivo salvo indicação.

## 1. Sete fatos que definem o reuso

1. **Carga completa em memória.** `useQuery(['pesagens-individuais', empresaId])` → `weighingService.listEntries`
   → `listAllEntries` → `storage.weighing.listByPeriodo({})` → **`table.toArray()`** (`repositories/index.js:76`).
   O filtro de empresa é aplicado **depois**, em memória, sobre `empresa_id` do `legacy_payload`
   (`weighingService.js:211-213`).
2. **Nenhum filtro de tela chega ao Dexie com índice.** `listByPeriodo` já aceita `dataInicial/dataFinal/loteId`
   indexados (`repositories/index.js:57-74`), mas nenhuma tela usa.
3. **Não há definição de coluna reutilizável** (ver `03`).
4. **O resumo configurável não está na Relação**: `PesagensResumoRodape`, `ResumoPersonalizado` e
   `ConfigurarResumosDialog` são usados só no Lançamento.
5. **4 das 8 métricas do rodapé nunca aparecem**: `.d17c-table-footer__metric { display: none }`
   (`styles/d17b-modelobase1.css:861,1133`).
6. **A pesagem não guarda `marca_id`/`raca_id`**: o Lançamento envia, o mapper descarta (fora da allowlist,
   `weighingMapper.js:6-17`); o adapter resolve marca/raça pelo **texto** e **cria o cadastro se não existir**
   (`weighingDataAdapter.js:52-63`).
7. **O CSV ignora a configuração de colunas** (17 colunas fixas, `:772-801`).

## 2. Matriz capacidade → componente → service → fonte → estado → reuso

| Capacidade | Componente | Service / função | Fonte | Estado / persistência | Reuso nos relatórios |
|---|---|---|---|---|---|
| Carga | `useQuery` (`:282-288`) | `weighingService.listEntries` | `pesagens.toArray()` + filtro de empresa em memória | cache react-query; empresa em localStorage (`api/db.js:16-21`) | **Adaptar**: contrato do view model serve; consulta precisa usar período/índice |
| Pesquisa | `MgDesktopSearch` + `MgSearchResultsDropdown` (`:899-912`) | `textoContem` + `normalizeSearchQuery` (sem acento, minúsculas) sobre número, marca, lote, apartação, raça (`:139,311,734`) | memória | `searchInput`/`searchTerm` em `useState` | **Adaptar**: substring da frase inteira; escolher resultado aplica `numero_animal` por substring (“12” casa “123”) |
| Filtros por pílula | `MgTablePanelStrip` → `MakFilterRail` → `MakFilterPill` → `MakColumnMenu filterOnly` (`:832-857,932-938`) | `matchesMakColumnFilter` (`:314-317`) | memória; `listOptions` recalculado sem memo | `filtrosColuna` em `useState` (não persiste) | **Reutilizar a UI**; adaptar semântica (ver `04`) |
| Filtro no cabeçalho | `MakTh` + `MakColumnMenu` (`:970-986`) | mesmo estado das pílulas | memória | idem | Reutilizar |
| Ordenação | `MakTh onSort` (`:975`) | `handleSort` + comparador (`:322-340,392-397`) | memória | `sortConfig` (não persiste) | **Adaptar**: vazio vira epoch/0; texto sem `localeCompare` (“10” < “9”); sem ordenação múltipla |
| Paginação | rodapé (`:1188-1198`) | `slice` (`:349-353`) | memória | `useState` (25/50/100/200) | Não (relatório pagina para impressão) |
| Configuração de colunas | `MakColumnConfigDialog` (`:1338-1347`) | ordem por arraste (`@hello-pangea/dnd`), visibilidade, restaurar padrão | `COLUNAS_DISPONIVEIS` (`:66-100`) | localStorage `colunas_ordem_…`/`colunas_visiveis_…` | **Reutilizar o diálogo**; largura fixa em `COLUMN_WIDTHS` (`:105-124`), sem redimensionar |
| Seleção | `MakTableSelectCheck` (`:956-961,1023-1028`) | “todos” seleciona todos os filtrados; Ctrl alterna | — | `useState`; não limpa ao filtrar | Adaptar (relatório raramente precisa) |
| Rodapé | próprio (`:1179-1199`) | `stats` (`:356-387`) | `pesagensFiltradas` | — | **Não**: fórmulas com null→0 (ver `05`) |
| Resumo configurável | ausente (só no Lançamento) | `resumo-personalizado:<empresa>` em `appSettings` | — | appSettings | Ideia reutilizável (escopo × operação × agrupamento); código não |
| Exportar CSV | `MgSpeedDialMenu` → `exportarCSV` (`:772-802`) | montagem manual | filtrados e ordenados | — | **Substituir** por exportação do view model (ver `13`) |
| Importar CSV | `:755-770,920-925` | `parseCsv` → `resolveMany` → `bulkCreateEntries` | — | — | Fora do escopo de relatórios |
| Menus | `MgSpeedDialMenu` (`:915-924`) | — | — | `moreOpen` | Reutilizar |
| Atalhos | só Esc/Enter nos componentes | — | — | — | Reutilizar |
| Responsividade | menu vira folha inferior < 768 px; tabela com `minWidth` e rolagem | — | — | — | Reutilizar |
| Tema claro/escuro | `ModeloBase1AppShell` (`erp-tema`) + bloco R35 | — | — | localStorage | Reutilizar tokens; a tela usa classes Tailwind fixas em badges |

## 3. Componentes — existência verificada

| Componente | Existe | Uso atual |
|---|---|---|
| `MgDesktopSearch`, `MgSearchResultsDropdown`, `MakFilterRail`, `MakFilterPill`, `MakColumnMenu`, `MakTh`, `MakColumnConfigDialog`, `MakTableSelectCheck`, `MgSpeedDialMenu`, `MgTablePanelStrip`, `MakDateControl`, `mgSearchHighlight`, `mgIcons` | sim (`components/mak/`) | Relação, Cadastros; Lançamento usa `MakTh`, `MakColumnMenu`, `MakColumnConfigDialog` |
| `PesagensResumoRodape`, `ResumoPersonalizado`, `ConfigurarResumosDialog` | sim (`components/pesagens/`) | só Lançamento |
| **`MgFilterPanel`** | **não** (apagado em 15/09) | — |
| `MgCmdSelect`, `MgPortalPanel`, `useMgPanelPosition` | sim, **órfãos** | nenhuma tela |
| `ModeloBase1ActionBar` | exportado | importado na Relação e não usado |

Sobras: `lotesUnicos`, `apartacoesUnicas`, `marcasExistentes`, `racasExistentes`, `erasExistentes` (`:301-305`)
sem uso; `MakFilterRail` mantém a prop `onConfigureFilters` sem chamador.

## 4. Decisão: infraestrutura compartilhada ou camada independente? (item 27)

**Recomendação: extrair o núcleo da Relação para infraestrutura compartilhada, e a Relação passa a ser o primeiro
consumidor — sem criar segunda implementação.**

Justificativa com o código:

| O que já é genérico e está bom | O que está preso à tela e precisa ser extraído |
|---|---|
| UI de filtro (`MakFilterRail`, `MakFilterPill`, `MakColumnMenu`, `MakTh`) — já compartilhada por Relação e Cadastros | definição de coluna (`COLUNAS_DISPONIVEIS` + `COLUMN_WIDTHS` + `getPesagemColumnValue` + sets de tipo + `if` de formatação na tabela e **outra** lista no CSV) |
| `matchesMakColumnFilter` puro e sem React | ordenação (`:322-340`) e pesquisa (`:309-313`) escritas na página |
| `MakColumnConfigDialog` genérico | agregações (`stats`, `estatisticas`, `ResumoPersonalizado`) escritas nos componentes |
| `formatNumber.js` (`fmtNum`, `fmtInt`, `fmtCurrency`, `fmtDateBR`) | exportação (três montagens manuais diferentes) |

Manter a Relação independente e criar uma camada de relatórios “reutilizando só componentes” obrigaria a reescrever
definição de coluna, ordenação, pesquisa, agregação e exportação — exatamente as partes que hoje já divergem entre
Relação e Lançamento (`doc_qtd` com duas semânticas, dois CSVs, dois conjuntos de tipos). Isso repetiria o problema.

A extração deve ser **de funções puras** (coluna, filtro, ordenação, agrupamento, agregação, exportação), sem mudar a
aparência da Relação; a troca da Relação para o núcleo é uma fatia própria com gate de paridade (mesmas linhas, mesma
ordem, mesmo CSV).
