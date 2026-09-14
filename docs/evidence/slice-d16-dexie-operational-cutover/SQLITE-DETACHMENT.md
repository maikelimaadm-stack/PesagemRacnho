# SQLITE-DETACHMENT (D.16)

## Fluxo operacional: 100% destacado de SQLite
Gate `storage:sqlite-detached:verify` (rígido) — PASS:
- `src/storage/**` sem better-sqlite3/sqliteConnection/ensureDatabaseReady.
- adapters + services operacionais + `src/api/db.js` + `ManutencaoSistema.jsx`:
  0 referências a SQLite; 0 IPC de dados (`pesagemApp.weighing/entities/...`,
  `maintenance:backup:sqlite`, `ipcRenderer.invoke('db:...')`).
- todos os `*DataAdapter` importam `storageAdapter` (Dexie).

`rg` confirma: 0 SQLite/IPC-de-banco em `src`; 0 "Banco SQLite não inicializado"
no renderer; db.entities operacional 0; login/permiss/cloud 0.

## better-sqlite3: mantido como LEGADO (justificativa forte)
Não removido neste slice porque:
1. Remover exige gutar `electron/main.cjs` (requires + registro de IPC SQLite +
   init) e ajustar diagnostics/runtime. **Não consigo bootar o app** para
   validar; um erro deixaria o app sem abrir — pior que o bug atual.
2. O fluxo do usuário já é 100% Dexie, então "Banco SQLite não inicializado" não
   chega mais ao usuário mesmo com better-sqlite3 presente.
3. A spec permite: "se não remover neste slice... o fluxo operacional deve estar
   100% destacado" — satisfeito.

## Próximo (com validação física)
Remover better-sqlite3 de dependencies + asarUnpack + postinstall; enxugar
`main.cjs` (só dialogs/files/release/diagnóstico) → instalador sem módulo nativo.
