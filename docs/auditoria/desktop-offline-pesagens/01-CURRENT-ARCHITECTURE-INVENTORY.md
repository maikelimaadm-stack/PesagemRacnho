# 01 — Inventário da Arquitetura Atual

## Stack tecnológica

| Camada | Tecnologia | Versão (package.json) |
|--------|------------|----------------------|
| Frontend | React | ^18.2.0 |
| Build | Vite | ^6.1.0 |
| Roteamento | react-router-dom (HashRouter) | ^7.2.0 |
| Estado servidor | TanStack React Query | ^5.84.1 |
| UI | Radix + Tailwind + shadcn (14 componentes) | — |
| Desktop shell | Electron | ^35.7.5 |
| Empacotamento | electron-builder (NSIS) | ^25.1.8 |
| Persistência | JSON file (`electron/db.cjs`) | nativo Node `fs` |

**Não presente:** Tauri, PWA/service worker, `@base44/sdk`, IndexedDB (removido), sql.js (removido), better-sqlite3.

---

## Estrutura de pastas (src — 35 arquivos)

```
src/
├── App.jsx
├── Layout.jsx
├── main.jsx
├── index.css
├── pages.config.js
├── api/
│   └── db.js                    # Proxy IPC → window.pesagemApp
├── pages/
│   ├── PesagensIndividuais.jsx  # ~1700 linhas — listagem/importação
│   └── LancamentoPesagensIndividuais.jsx  # ~2200 linhas — lançamento
├── components/
│   ├── DbBootstrap.jsx
│   ├── ui/                      # 14 componentes shadcn
│   ├── pesagens/                # 7 componentes + animalLookup
│   ├── embarque/                # 2 componentes
│   ├── sanidade/                # 1 componente
│   └── common/formatNumber.jsx
├── lib/
│   ├── query-client.js
│   ├── PageNotFound.jsx
│   └── utils.js
└── utils/index.ts               # createPageUrl
```

```
electron/
├── main.cjs      # BrowserWindow, IPC, dataDir
├── preload.cjs   # contextBridge → pesagemApp
└── db.cjs        # JSON store CRUD
```

---

## Fluxo de dados (atual)

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React)                                       │
│  Pages/Components → db.entities.X.list/create/update    │
│       ↓                                                 │
│  src/api/db.js (Proxy)                                  │
│       ↓                                                 │
│  window.pesagemApp (preload)                            │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC invoke
┌───────────────────────▼─────────────────────────────────┐
│  Main Process (Electron)                                │
│  ipcMain.handle('db:*') → electron/db.cjs               │
│       ↓                                                 │
│  pesagens.json (dev: ./data | prod: userData/data)      │
└─────────────────────────────────────────────────────────┘
```

---

## Páginas ativas

| Rota (HashRouter) | Arquivo | Função |
|-------------------|---------|--------|
| `/PesagensIndividuais` | PesagensIndividuais.jsx | Tabela, filtros, import CSV, edição em lote |
| `/LancamentoPesagensIndividuais` | LancamentoPesagensIndividuais.jsx | Formulário de lançamento, sanidade, embarque |

---

## Entidades persistidas (8 buckets JSON)

Definidas em `electron/db.cjs`:

1. `PesagemIndividual`
2. `Apartacao`
3. `LoteApartacao`
4. `SanidadeAnimal`
5. `ConfiguracaoSanidade`
6. `ItemSanidade`
7. `Embarque`
8. `DocumentoEmbarque`

**Não existe entidade `Animal` separada** — identidade do animal está embutida nos registros de pesagem (`numero_animal`, `marca`, `sexo`, `raca`, etc.).

---

## localStorage (não é banco de negócio)

| Chave | Uso |
|-------|-----|
| `empresa_selecionada_id` | Sempre `'local'` — legado multi-empresa Base44 |
| `colunas_ordem_pesagens_individuais` | Preferência UI |
| `colunas_visiveis_pesagens_individuais` | Preferência UI |
| `colunas_ordem_lancamento_pesagens` | Preferência UI |
| `colunas_visiveis_lancamento_pesagens` | Preferência UI |
| `sanidade_em_uso` | Preferência UI |

---

## Scripts npm

| Script | Função |
|--------|--------|
| `dev` | Vite dev server |
| `build` | Build produção → `dist/` |
| `desktop` | build + electron . |
| `desktop:dev` | Vite + Electron hot |
| `dist` | build + electron-builder --win |
| `lint` | ESLint |

**Ausente:** `test`, `typecheck` (removido do package.json atual).

---

## Artefatos na raiz (problema de distribuição)

Ainda presentes fora do instalador:

- `iniciar-pesagens.bat` / `.vbs`
- `abrir-banco.bat` / `.vbs`
- `scripts/init-db.cjs`
- `data/pesagens.json` (dev)

Usuário final **não deveria ver** estes arquivos — apenas o instalador NSIS.

---

## Dependências de produção (17)

`@hello-pangea/dnd`, Radix (6 pacotes), `@tanstack/react-query`, `class-variance-authority`, `clsx`, `date-fns`, `lucide-react`, `react`, `react-dom`, `react-router-dom`, `sonner`, `tailwind-merge`, `tailwindcss-animate`.

**Sem dependência de rede em runtime.**

---

## Classificação arquitetural

**Parcialmente acoplada → tendendo a fortemente acoplada**

- ✅ Shell desktop existe
- ✅ IPC isolado (contextIsolation: true)
- ❌ Sem camada repository/service
- ❌ Regras de negócio dentro de JSX
- ❌ Duas páginas monolíticas
