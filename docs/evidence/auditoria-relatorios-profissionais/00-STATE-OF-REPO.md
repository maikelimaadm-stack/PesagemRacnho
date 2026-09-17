# 00 — Estado real do repositório (auditoria pré-relatórios)

Coletado em **16/09/2026** diretamente do repositório (git, `package.json`, `src/storage/indexedDb/schema.js`,
`src/versioning/versionInfo.js`). Nenhum documento antigo foi tomado como verdade.

## 1. Identificação

| Item | Valor real | Evidência |
|---|---|---|
| Branch | `program/pesagens-master-evolution` | `git branch --show-current` |
| HEAD | `cc024d8` (15/09/2026) — *fix(integration): finish users-store rename…* | `git log -1` |
| Versão do app | **1.2.0** (`package.json`, `package-lock.json` raiz, fallback `src/lib/appVersion.js`) — **alteração não commitada** | `git status` |
| Esquema Dexie | **7** (`DB_VERSION = 7`) | `schema.js:6` |
| Formato de backup | **3** (`BACKUP_FORMAT_VERSION = 3`, identificador `pesagens-individuais-indexeddb-backup`) | `versionInfo.js:20`, `schema.js:7` |
| Manifesto de release | formato 2 | `versionInfo.js:21` |
| Contratos | UI `ModeloBase1-2.0`; dados `2`; `DATA_BUILD_ID = 'schema-v7'` (literal) | `versionInfo.js:22-27` |
| Tags | `v1.1.18`, `v1.1.17-baseline` (não há tag `v1.2.0`) | `git tag` |
| Branches locais | `main`, `program/pesagens-master-evolution`, `release/1.1.18`, `preview/1.2.0-demo` (fora do HEAD; snapshot de demonstração, não integrar) | `git branch` |

## 2. Commits recentes

```
cc024d8 fix(integration): finish users-store rename in storage gates/adapter; settings permission assertion
4b673fc wip(onda-1): second partial state after interruption (auth screens rev.2, launch selectors, gates)
917052c docs: consolidated current documentation snapshot (2026-09-15 pause)
66e7c67 wip(onda-1): partial state of the review-fix wave (interrupted) + pause checkpoint 2026-09-15
10aa042 chore(ui-parity): keep the ModeloBase1 reference rendering harness in the repo (scripts/ui-parity)
c55a8ed docs(changelog): [1.1.17] block for the diagnostic build; build: mark dirty trees in gitCommit (-dirty)
939a49e merge: release/1.1.18 into program (version contract rev.2, …)
8a826bf wip(phase-1): agents' deliverables (storage v7 migration, auth local, master registries, …)
```

## 3. Working tree — mudanças NÃO commitadas (37 arquivos, +800/−746)

Tudo abaixo está no disco, **não no HEAD**. Um relatório construído sobre o HEAD não veria estas regras.

| Grupo | Arquivos | Natureza |
|---|---|---|
| Versão 1.2.0 | `package.json`, `package-lock.json`, `src/lib/appVersion.js`, `CHANGELOG.md`, `docs/release/1.2.0/RELEASE-CHECKLIST.md` | alinhamento de versão e notas |
| Paridade ModeloBase1 (15/09) | `MakFilterRail.jsx`, `MakFilterPill.jsx`, `MgTablePanelStrip.jsx`, `mgIcons.js` (novo), `MgFilterPanel.jsx` (**apagado**), `PesagensIndividuais.jsx`, `CadastroAuxiliarPage.jsx`, `index.css`, `d17b-modelobase1.css`, `auxiliary-registries.css` | faixa de filtros, grade, painel lateral removido, pílulas = colunas visíveis |
| Categoria automática por peso (16/09) | `registryDefinitions.js`, `seeds.js`, `categorySuggestion.js`, `weighingDataAdapter.js`, `weighingMapper.js`, `LancamentoPesagensIndividuais.jsx`, `ConfirmarAnimalSnDialog.jsx`, `v7Backfill.js`, `normalize.js`, `testMass.js`, `operationalInsightsService.js`, `registryFormModel.js` | sexo M/F + faixa de peso + era na categoria; nascimento eliminado; `categoria_id`/`categoria_automatica` gravados |
| Gates corrigidos/atualizados | `verify-local-auth`, `verify-v7-migration`, `verify-packaged-build`, `verify-version-contract`, `verify-master-registry`, `verify-registry-ui`, `verify-operational-customization`, `verify-perf-baseline-contract`, `verify-animal-history-integrity`, `verify-ui-consistency`, `generate-release-manifest` | gates desatualizados desde a onda 1 + regra nova de categoria |
| Artefatos | `release-archive/` (não rastreado; instalador 1.1.17 preservado) | — |

**Artefato desatualizado:** `release-unsigned/Pesagens Individuais Setup 1.2.0.exe` (92.036.630 bytes) foi gerado **antes** da mudança de categoria de 16/09 e registra `gitCommit: cc024d8-dirty`. Não representa o código atual.

## 4. Páginas existentes (`src/pages`)

| Página | Linhas | Papel para relatórios |
|---|---:|---|
| `PesagensIndividuais.jsx` (Relação) | 1569 | principal fonte de infraestrutura de lista (filtros, colunas, resumo, CSV) |
| `LancamentoPesagensIndividuais.jsx` | 2245 | grade do dia + resumos; entrada de dados |
| `FechamentoDia.jsx` | 179 | resumo diário (candidato a relatório operacional) |
| `FichaAnimal.jsx` | 148 | histórico individual |
| `ManutencaoSistema.jsx` | 685 | backup/restauração/integridade |
| `Configuracoes.jsx` | 400 | políticas (faixas de peso, rendimento, padrões) |
| `Usuarios.jsx` | 375 | usuários e papéis |
| `Marcas`, `Racas`, `Categorias`, `Parceiros`, `Propriedades`, `CausasMorte` | 8–9 cada | invólucros de `CadastroAuxiliarPage` |

Não existe página, rota nem módulo de **relatórios**.

## 5. Stores do esquema vigente (v7 — 23 stores)

`pesagens`, `apartacoes`, `loteApartacoes`, `embarques`, `documentosEmbarque`, `animais`, `animalIdentificadores`,
`movimentosAnimais`, `animalLotes`, `sessoesPesagem`, `auditoria`, `importacoes`, `appSettings`, `backupHistory`,
`marcas`, `racas`, `categoriasAnimal`, `parceiros`, `propriedades`, `causasMorte`, `faixasIdentificadores`,
`excecoesIdentificadores`, `usuarios` (`schema.js:51-82`). Removida na v7: `lotes` (`REMOVED_STORES_V7`).

Enumerações do contrato (`schema.js:114-125`): papéis `ADMIN/GESTOR/OPERADOR/CONSULTA`; situações do animal
`ATIVO/VENDIDO/ABATIDO/MORTO/DOADO/TRANSFERIDO/CANCELADO/INATIVO`; tipos de identificador; status de sessão
`ABERTA/CONFERENCIA/FECHADA/CANCELADA`; papéis de parceiro `COMPRADOR/VENDEDOR/FRIGORIFICO/TRANSPORTADOR/PROPRIETARIO`.

**Não existe `operacoesComerciais`** (planejada para v8/1.5.0 em `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md:96,133`).

Observação de campo: o IndexedDB de desenvolvimento aberto no navegador em 15/09 listava **24** stores, incluindo
`usuariosLocais` (nome da revisão 1). O esquema do código não declara essa store; bancos que passaram pela
revisão 1 podem carregá-la como resíduo. Detalhado em `17-GAPS-RISKS.md`.

## 6. Módulos (`src/modules`)

`animals` (histórico, SN), `auth` (sessão, usuários, permissões, recovery key, auditoria de acesso), `auxiliary`
(apartações/lotes, ponte de catálogos legados), `catalog` (cadastros mestres, definições, seeds, resolução por nome),
`maintenance`, `operations` (insights operacionais, políticas, sugestão de categoria, resolução de cadastros na
importação), `perf` (massa de teste e bench), `settings` (appConfig), `shipments` (embarques/documentos),
`weighing` (cálculos, série, comercial, CSV, avisos, mapper, adapter). `health` está vazio.

Dependências de runtime (`package.json`): **não há** biblioteca de PDF, XLSX, gráficos ou impressão.

## 7. Gates

48 scripts `*:verify`/`*:selftest` em `package.json`. `npm run test:quick` executa 30 deles.
Estado em 16/09/2026 (após as correções não commitadas): **`test:quick` verde**. Gates fora do `test:quick`
foram executados na validação desta auditoria e o resultado está em `17-GAPS-RISKS.md` §Validação.

## 8. Documentação × código (divergências confirmadas)

| Documento diz | Código atual | Consequência para relatórios |
|---|---|---|
| `12-MODELO-DADOS` §3: `categoriasAnimal` com `sexo_aplicavel M/F/AMBOS`, `idade_min_meses`, `idade_max_meses` | `sexo_aplicavel` só `M`/`F`; `peso_min_kg`, `peso_max_kg`, `era`; sem idade (`registryDefinitions.js`) | relatórios por categoria devem usar a regra por peso |
| `12-MODELO-DADOS`: `animais.nascimento` estimado a partir da era | nascimento sempre `null` (`weighingDataAdapter.js` `newAnimal`; `v7Backfill.js` B7) | nenhuma métrica de idade é possível |
| `12-MODELO-DADOS` §v8: `operacoesComerciais` e colunas promovidas em `pesagens` (`motivo_saida`, `operacao_id`, `causa_morte_id`…) | não existem; dados comerciais vivem no `legacy_payload` | relatórios comerciais dependem de modelagem futura (ver `10`) |
| Checkpoint 15/09 (`program-2.0/CHECKPOINT-2026-09-15-PAUSA.md`): gates `storage`, `auth`, `registry`, `ui:shell` vermelhos | `test:quick` verde | checkpoint obsoleto |
| Checkpoint 15/09: 1.2.0 “parcial”, sem instalador | versão 1.2.0 aplicada e instalador de diagnóstico gerado (desatualizado) | release ainda não fechada (sem commit/tag) |
| `docs/user` e notas antigas citam painel lateral “Filtrar” | painel removido (15/09) | infraestrutura de filtro = pílulas + menu de coluna |

Divergências de `04-RELATORIOS-E-INDICADORES.md` e `F0-02-CATALOGO-DE-FORMULAS.md` estão em `01` e `05`.
