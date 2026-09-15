# Checklist da release 1.1.0

## Automático (execução real em 2026-07-20)
- [x] npm run lint / build
- [x] npm run test:full (Dexie-centric)
- [x] storage:dexie / first-run / backup / import-restore / ui-contract
- [x] storage:ui-first-run-persistence (persistência via service da UI)
- [x] storage:maintenance-ui-flow (contrato Manutenção → Dexie)
- [x] storage:sqlite-detached (fluxo operacional sem SQLite/IPC de banco)
- [x] docs:user:verify
- [x] instalador Pesagens Individuais Setup 1.1.0.exe
- [x] release:checksum / release:manifest (1.1.0)

## Manual (máquina real — Maike, com o instalador 1.1.0)
- [ ] PENDENTE — usar SOMENTE o Setup 1.1.0 (desinstalar anterior)
- [ ] PENDENTE — abrir → Manutenção → confirmar Versão 1.1.0 + "Armazenamento: IndexedDB local"
- [ ] PENDENTE — criar backup do banco (SEM criar pesagem antes) — deve funcionar
- [ ] PENDENTE — NÃO aparece "Banco SQLite não inicializado"
- [ ] PENDENTE — criar pesagem → fechar → reabrir → dados salvos
- [ ] PENDENTE — exportar CSV/JSON; restaurar backup
