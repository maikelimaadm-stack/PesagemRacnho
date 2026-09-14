# 08 — Plano de Implementação por Slices

> **Regra:** Nenhum slice altera layout visual das telas. Apenas backend, infra, limpeza e comportamento de persistência.

---

## Slice D.0 — Auditoria e documentação final

**Objetivo:** Documentar estado atual, riscos e plano (este pacote).

**Arquivos:** `docs/auditoria/desktop-offline-pesagens/*.md`

**Critérios de aceite:**
- [x] 11 documentos criados
- [x] Matriz de riscos
- [x] Recomendação Tauri/Electron/Web
- [x] Plano de slices

**Testes:** lint + build registrados

**Riscos:** Nenhum (read-only)

---

## Slice D.1 — Remoção definitiva Base44/offline residual

**Objetivo:** Eliminar código morto, inconsistências documentais, erros lint.

**Arquivos:**
- `src/pages/LancamentoPesagensIndividuais.jsx` (pendingPesagensDB, _offlineId, editingOfflineId)
- `src/components/DbBootstrap.jsx` (texto SQLite)
- `src/components/embarque/GerenciarEmbarquesDialog.jsx` (comentários)
- `src/components/pesagens/Resumo*.jsx` (props pendingPesagensDB se mortas)
- Mover `.bat/.vbs` → `dev/` (não distribuir)

**Critérios de aceite:**
- [ ] `npm run lint` zero erros
- [ ] Zero referências `_offlineId`, `pendingPesagensDB` funcional
- [ ] DbBootstrap descreve storage real

**Testes:** lint, build, smoke manual lançamento+listagem

**Riscos:** Remover prop usada inadvertidamente — grep antes

---

## Slice D.2 — Definição desktop shell (hardening)

**Objetivo:** Consolidar Electron como shell definitivo.

**Arquivos:**
- `electron/main.cjs` — single instance, logging
- `package.json` build — ícone, metadados
- Remover scripts dev da raiz

**Critérios de aceite:**
- [ ] Segunda instância foca janela existente
- [ ] Ícone customizado no instalador
- [ ] Instalação limpa sem Node.js

**Testes:** VM Windows limpa, instalar .exe, abrir app

**Riscos:** Code signing ausente (SmartScreen)

---

## Slice D.3 — Banco SQLite + migrations

**Objetivo:** Substituir JSON por SQLite transacional.

**Arquivos:**
- `electron/sqlite/db.cjs` (novo)
- `electron/sqlite/migrations/001_initial.sql`
- `electron/main.cjs` (trocar adapter)
- `package.json` (+better-sqlite3)

**Critérios de aceite:**
- [ ] CRUD via mesma IPC API
- [ ] schema_migrations funcional
- [ ] Transações em bulkCreate
- [ ] Índices: data_pesagem, numero_animal, lote_id
- [ ] WAL mode

**Testes:** unitários adapter; integração create/list/update/delete

**Riscos:** better-sqlite3 compile Windows — plano B: `@journeyapps/sqlcipher` ou sql.js temporário

---

## Slice D.4 — Repository de pesagens

**Objetivo:** Desacoplar UI do storage sem mudar visual.

**Arquivos:**
- `src/modules/weighing/infrastructure/weighingRepository.js` (novo)
- `src/modules/weighing/application/weighingService.js` (novo)
- `src/pages/*.jsx` — trocar `db.entities` → service (mesmo comportamento)

**Critérios de aceite:**
- [ ] Pages não importam electron/db diretamente
- [ ] Validações domínio centralizadas (peso, data, duplicidade)
- [ ] React Query invalidation consistente

**Testes:** unit domain rules; integration form→table

**Riscos:** Regressão comportamental — testar todos fluxos manejo

---

## Slice D.5 — Migração storage antigo

**Objetivo:** JSON/.db legado → SQLite.

**Arquivos:**
- `electron/sqlite/migrate-from-json.cjs`
- `scripts/verify-migration.cjs`

**Critérios de aceite:**
- [ ] Backup automático pré-migração
- [ ] Contagens batem
- [ ] Rollback documentado

**Testes:** vazio, 100 registros, JSON corrupto

**Riscos:** Perda dados — exigir backup

---

## Slice D.6 — Backup/exportação/importação

**Objetivo:** Proteção operacional dos dados.

**Arquivos:**
- `electron/backup/backupService.cjs`
- IPC: exportJson, exportCsv, importJson, restoreBackup
- UI: **mesmos botões existentes** — apenas wiring (sem redesign)

**Critérios de aceite:**
- [ ] Backup diário em `{userData}/backups/`
- [ ] Export manual funcional
- [ ] clearAll exige backup ou confirmação dupla

**Testes:** backup→corrupt db→restore

**Riscos:** Espaço em disco

---

## Slice D.7 — Empacotamento desktop Windows

**Objetivo:** Distribuição profissional.

**Arquivos:**
- `package.json` build config
- `build/icon.ico`
- CI script (opcional)

**Critérios de aceite:**
- [ ] Um único `.exe` instalador entregue ao usuário
- [ ] Atalho desktop + menu iniciar
- [ ] Dados em userData após instalar
- [ ] Reinstalar preserva dados
- [ ] Desinstalar: dados preservados (documentado)

**Testes:** checklist VM limpa (seção 04)

**Riscos:** Tamanho ~90MB; SmartScreen

---

## Ordem de execução recomendada

```
D.0 ✅ → D.1 → D.3 → D.5 → D.4 → D.6 → D.2 → D.7
```

D.2 e D.7 podem paralelizar após D.3 estável.

---

## Arquivos que NÃO devem ser alterados nos primeiros slices

- Layout visual / CSS / Tailwind tokens
- Estrutura de colunas das tabelas
- Fluxo Cadastro/Manejo/Saída (comportamento)
- Componentes Radix UI (visual)
- `src/index.css` (salvo tokens necessários)

## Candidatos a refatoração futura (pós D.4)

- Dividir `LancamentoPesagensIndividuais.jsx` em subcomponentes
- Dividir `PesagensIndividuais.jsx`
- Virtualização de tabela
- Code splitting Vite
