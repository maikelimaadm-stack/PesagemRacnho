# Lint, build e verificação

Data: 2026-08-03.

| Comando | Resultado | Observações |
|---|---|---|
| `npm.cmd run lint` | PASS | 0 erros; 1 warning preexistente em `electron/logging/appLogger.cjs:32`, arquivo proibido neste slice |
| `npm.cmd run build` | PASS | 2120 módulos; aviso de chunk >500 kB e browsers data desatualizado |
| `npm.cmd run test` | PASS | suíte final `test:full` concluída em 44,1 s |

## Verificações incluídas no PASS de `npm test`

- main boot e preload contract;
- Dexie CRUD e first run;
- backup;
- importação e restauração;
- contrato UI → service → Dexie;
- persistência após reopen;
- fluxo de manutenção;
- SQLite desligado;
- mapper de pesagens;
- UI/dialog de manutenção;
- documentação de usuário;
- artefatos instaláveis em modo dev-permissive;
- desktop smoke.

## Saídas importantes

- Dexie: 12 stores, CRUD OK;
- backup: contagens e JSON/CSV OK;
- import/restore: integridade OK;
- storage adapters: nenhum infrator SQLite/IPC;
- desktop smoke: OK.

## VisualLab

- bundle/import da rota: PASS pelo build;
- servidor `5173`: respondeu HTTP 200;
- inspeção renderizada: BLOQUEADA pelo controle do navegador;
- screenshots/responsividade: BLOQUEADAS, não declaradas PASS.
