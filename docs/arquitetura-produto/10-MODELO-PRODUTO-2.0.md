# 10 — Modelo do produto 2.0 (visão de execução)

**Programa Pesagens Individuais 2.0 · iniciado em 14/09/2026 · base 1.1.17 / Dexie v6.**
Entrada oficial: Auditoria Master (`docs/evidence/auditoria-master-produto-pecuario/`). Este
documento resume o que o 2.0 é, a ordem de construção e a divisão de trabalho; os contratos
detalhados estão nos documentos 11 (autenticação), 12 (dados), 13 (versionamento/release) e
14 (migrações). Os documentos 00–09 continuam válidos; onde houver diferença, as ADR-018…040 prevalecem.

## 1. Cadeia do domínio

```text
CADASTROS → ANIMAIS → IDENTIFICADORES → LOTAÇÃO/LOTES → SESSÃO → PESAGEM/MANEJO
         → OPERAÇÕES COMERCIAIS → EMBARQUE → SAÍDA → FECHAMENTO → HISTÓRICO/RELATÓRIOS
```

Regra: cadastros são feitos antes; o lançamento seleciona; o curral pesa; o escritório configura e confere.

## 2. O que o 2.0 é e não é

É: offline-first, desktop Electron, IndexedDB/Dexie, login local com usuários e três perfis,
cadastros mestres, identidade permanente do animal, estoque de identificadores por faixas,
pesagem rápida por sessão, animais com ficha, apartações/lotes, compras/vendas/abates como
operações, embarques com estados, fechamento de sessão, relatórios operacionais básicos
(tabela + CSV), backup/restauração, auditoria por usuário, versionamento em cinco eixos,
migrações resumíveis, UI ModeloBase1, instalador versionado e gates automatizados.

Não é: ERP financeiro, CRM, WMS, fiscal, veterinário, nem dependente de internet.

## 3. Menu final

```text
OPERAÇÃO   Lançamento · Relação de Pesagens · Fechamento da Sessão
REBANHO    Animais · Apartações e Lotes · Identificadores
COMERCIAL  Operações · Embarques
CADASTROS  Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de Morte
SISTEMA    Usuários · Configurações · Backup e Manutenção
```

Itens respeitam permissões (documento 11 §2.2). Topbar: usuário, perfil, versão, Bloquear, Sair, tema.

## 4. Fases e releases

| Fase | Release | Escopo | Gate de saída |
|---|---|---|---|
| 0 | — | Git, baseline, gates verdes, ADRs, medições | `test:quick` 20/20 (concluído em 14/09) |
| 1 | 1.2.0 | login local, usuários/RBAC, Dexie v7, cadastros mestres, sanidade removida, backup v3, migration coordinator, versionamento | `test:quick`, `migration:v7`, restore v6→v7, `auth:*`, backup, Setup 1.2.0 |
| 2 | 1.3.0 | faixas/exceções, identificadores, Animais/Ficha, Apartações/Lotes, Lançamento enxuto, cadastro rápido, contexto de sessão | + `identifier:inventory`, `launch:contract`, aceite humano (50 animais sem mouse) |
| 3 | 1.4.0 | Dexie v8, operações comerciais, embarques, retorno de frigorífico | + `migration:v8`, `commercial:operations`, `shipment:state` |
| 4 | 1.5.0 | sessão, fechamento, snapshot, pendências, relatórios mínimos, auditoria | + `session:closing`, `reports:manifest` |
| 5 | 2.0.0 | estabilização, migrações certificadas, UI final, instalador, máquina limpa, docs | `test:full`, 36k/250k, backup v6→v8, clean machine |

## 5. Divisão de trabalho (ADR-040)

| Agente | Área | Arquivos que pode editar |
|---|---|---|
| A coordenador | arquitetura, integração, versões, gates, commits | `docs/arquitetura-produto/**`, `CHANGELOG.md`, `package.json`, `src/pages.config.js`, `src/Layout.jsx`, `src/App.jsx`, `src/storage/indexedDb/schema.js`, `src/styles/d17b-modelobase1.css`, `scripts/verify-ui-consistency.mjs` |
| B storage/migrations | Dexie v7/v8, coordinator, backfill, backup v3, integridade | `src/storage/**` (exceto `schema.js`), `src/storage/migrations/**`, `scripts/verify-dexie-*.mjs`, `scripts/verify-v7-migration.mjs` |
| C auth | login, usuários, perfis, sessão, guards, auditoria por usuário | `src/modules/auth/**`, `src/components/auth/**`, `src/pages/Usuarios.jsx`, `scripts/verify-local-auth.mjs`, `scripts/verify-access-policy.mjs`, pontos de auditoria em `weighingDataAdapter.js` |
| D animais/identificadores + cadastros | serviços de cadastro, resolver, faixas, identificadores, animais | `src/modules/catalog/**`, `src/modules/identifiers/**`, `src/modules/animals/**`, `scripts/verify-master-registry.mjs`, `scripts/verify-identifier-inventory.mjs` |
| E comercial | parceiros/propriedades (serviços em D na Fase 1), operações, embarques | `src/modules/commercial/**`, `src/modules/shipments/**` (Fase 3) |
| F UI ModeloBase1 | telas, componentes, acessibilidade, temas | `src/components/cadastros/**`, `src/components/mak/**`, `src/components/modelobase1/**`, páginas de cadastro e configurações em `src/pages/**` (exceto as de outros donos) |
| G performance | massas, benchmarks, índices, paginação | `src/modules/perf/**`, `scripts/measure-*.mjs` |
| H QA/release | gates, instalador, manifesto, docs do usuário, migração docs | `scripts/verify-packaged-build.mjs`, `scripts/generate-release-*.mjs`, `docs/user/**`, `docs/release/**`, `src/versioning/**` |

Agentes não executam `npm run build` nem `test:quick` (o coordenador executa); podem rodar `npx eslint <arquivos>` e os próprios scripts de verificação.

## 6. Definition of Done de uma fase

Código, migração, testes, gates, evidências (`docs/evidence/program-2.0/<fase>/`), docs do usuário,
versão, build, `app.asar`, instalador, checksum, manifesto e relatório do coordenador. Condições de
parada: perda de dados, migração irreversível, backup inválido, integridade vermelha, duplicação de
animal/identificador, falha de restore, corrupção do IndexedDB.
