# 10 — Modelo do produto (visão de execução) — Programa 1.1.17 → 1.6.0

**Programa Master de Evolução · iniciado em 14/09/2026 (refina o "Programa 2.0" do mesmo dia) · base 1.1.17 / Dexie v6.**
Estado real de partida: `docs/evidence/STATE-OF-REPO-BEFORE.md`. Entrada oficial: Auditoria Master
(`docs/evidence/auditoria-master-produto-pecuario/`). Este documento resume o que o produto final é, a ordem de
construção e a divisão de trabalho; os contratos detalhados estão nos documentos 11 (autenticação), 12 (dados),
13 (versionamento/release) e 14 (migrações). Os documentos 00–09 continuam válidos; onde houver diferença, as
ADR-018…048 prevalecem.

## 1. Cadeia do domínio

```text
CADASTROS → ANIMAIS → IDENTIFICADORES → LOTAÇÃO/LOTES → SESSÃO → PESAGEM/MANEJO
         → OPERAÇÕES COMERCIAIS → EMBARQUE → SAÍDA → FECHAMENTO → HISTÓRICO/RELATÓRIOS
```

Regra: cadastros são feitos antes; o lançamento seleciona; o curral pesa; o escritório configura e confere.

## 2. O que o produto final é e não é

É: offline-first, desktop Electron, IndexedDB/Dexie, login local com usuários e quatro papéis (ADMIN, GESTOR,
OPERADOR, CONSULTA), cadastros mestres como stores, identidade permanente do animal, estoque de identificadores
por faixas, pesagem rápida por sessão, animais com ficha, apartações/lotes, compras/vendas/abates como operações,
embarques com estados, fechamento de sessão, relatórios operacionais básicos (tabela + CSV/JSON com manifesto),
backup/restauração, auditoria por usuário, versionamento em quatro eixos, migrações com backup físico prévio,
UI ModeloBase1, instalador versionado e gates automatizados.

Não é: ERP financeiro, CRM, WMS, fiscal, veterinário, nem dependente de internet.

## 3. Menu final

```text
OPERAÇÃO   Lançamento de pesagens · Relação de pesagens · Fechamento da sessão
REBANHO    Animais · Apartações e lotes · Faixas de identificadores
COMERCIAL  Operações · Embarques
CADASTROS  Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de morte
SISTEMA    Usuários · Configurações · Backup e manutenção · Auditoria · Sobre/Versão (pode ficar em Manutenção)
```

Removidos: Sanidade, Cadastros Comerciais legado, popups de cadastro que viraram telas. Itens respeitam a matriz
do documento 11 §4. Topbar: usuário e papel discretos, versão, Bloquear, Trocar usuário, Sair, tema.

## 4. Marcos (ADR-047)

| Marco | Fatias | Escopo | Gate de saída |
|---|---|---|---|
| 1.1.18 | S-00.0 baseline recovery · S-00.1 contrato de versão, ADRs, docs de engenharia | gates verdes no contrato 1.1.17, `versionInfo`, manifesto, `release:version-contract`, Sobre/Status; **sem esquema novo** | `test:quick` verde, lint, build, notas, CHANGELOG |
| 1.2.0 | S-01.1 v7 + preflight/backfill · S-01.2 auth · S-01.3 serviços de cadastro · S-01.4 telas · S-01.5 Lançamento seleciona cadastros | documentos 11, 12, 14 | + `migration:v7`, `auth:*`, `registry:master`, `payload:allowlist`, restore v6→v7, `test:full` (físicos declarados) |
| 1.3.0 | S-02.1 faixas/exceções · S-02.2 animalIdentifierService · S-02.3 resolução indexada · S-02.4 tela Faixas | identificadores e desempenho | + `identifier:inventory`, `identifier:uniqueness`, `perf:contract` (Chromium: abrir Lançamento < 1 s em 36 mil) |
| 1.4.0 | S-03.x lançamento enxuto, Apartações/Lotes, contexto de sessão | Manejo = Nº → Enter → Peso → Enter | + `launch:contract`; aceite humano de 50 animais só com evidência |
| 1.5.0 | S-04.1 v8 · S-04.2 comercial · S-04.3 embarques · S-04.4 UI · S-04.5 relatórios | operações e embarques separados do curral | + `migration:v8`, `commercial:operations`, `shipment:state`, `reports:manifest` |
| 1.6.0 | S-05.1 sessão · S-05.2 fechamento · S-05.3 Animais · S-05.4 auditoria | sessão fechada bloqueia; ficha por projeções; auditoria consultável | + `session:closing`, `audit:actor`; `test:full`; 36k/250k; backup v6→v8; máquina limpa declarada |

## 5. Divisão de trabalho (ADR-040/048)

| Agente | Área | Arquivos que pode editar |
|---|---|---|
| A orquestrador/integrador | programa, branch de integração, conflitos, CHANGELOG, aceite | `docs/arquitetura-produto/**`, `CHANGELOG.md`, `package.json`, `vite.config.js`, `src/pages.config.js`, `src/Layout.jsx`, `src/App.jsx`, `src/storage/indexedDb/schema.js`, `src/styles/d17b-modelobase1.css`, `scripts/verify-ui-consistency.mjs` |
| B revisor de arquitetura/governança | read-only: ADRs, SSOT, escopo, dependências, riscos | nenhum |
| C storage/migrações | Dexie v7/v8, preflight, backfill, backup, restore, integridade | `src/storage/**` (exceto `schema.js`), `src/api/db.js`, `scripts/verify-dexie-*.mjs`, `scripts/verify-v7-migration.mjs`, `scripts/verify-payload-allowlist.mjs` |
| D auth/versionamento | login, usuários, papéis, sessão, recovery, `versionInfo`, manifesto | `src/modules/auth/**`, `src/components/auth/**`, `src/pages/Usuarios.jsx`, `src/versioning/**`, `scripts/verify-auth-*.mjs`, `scripts/verify-version-contract.mjs`, `scripts/generate-release-manifest.mjs` |
| E domínio/cadastros | marcas, raças, categorias, parceiros, causas, propriedades, identificadores | `src/modules/catalog/**`, `src/modules/identifiers/**`, `src/modules/animals/**`, `scripts/verify-master-registry.mjs`, `scripts/verify-identifier-*.mjs` |
| F UX/ModeloBase1 | telas, menu, lançamento, fluxo de curral, teclado | `src/components/cadastros/**`, `src/components/mak/**`, `src/components/modelobase1/**`, páginas em `src/pages/**` (exceto as de outros donos) |
| G QA/gates | scripts de verificação, massas, regressão, performance, evidências | `src/modules/perf/**`, `scripts/measure-*.mjs`, gates novos quando não pertencem a outro dono |
| H release/docs | docs do usuário, notas, instalação, hashes, compatibilidade | `docs/user/**`, `docs/release/**`, `docs/engineering/**`, `scripts/verify-packaged-build.mjs`, `scripts/verify-user-docs.mjs` |

Agentes não executam `npm run build`, `test:quick` nem comandos git (o orquestrador executa); podem rodar
`npx eslint <arquivos>` e os próprios scripts de verificação. Escrita de código em uma fatia tem um único dono;
integração é sequencial; uma fatia só entra na linha de integração com gates verdes.

## 6. Definition of Done de uma fatia/marco

Código, migração, testes, gates, evidências (`docs/evidence/<slice>/`: REPORT, FILES-CHANGED, TESTS, MIGRATION,
PERF, SCREENSHOTS, RISKS, ROLLBACK), docs do usuário, versão, build, `app.asar`, instalador, checksum, manifesto
e checkpoint do orquestrador. Condições de parada: perda de dados, migração irreversível, backup inválido,
integridade vermelha, duplicação de animal/identificador, falha de restore, corrupção do IndexedDB. Teste físico
só é declarado EXECUTADO com evidência humana.
