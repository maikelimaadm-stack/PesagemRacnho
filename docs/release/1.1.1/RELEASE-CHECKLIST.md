# Checklist da release 1.1.1

## Automático (execução real)
- [x] lint / build
- [x] main:boot:verify (app inicializa sem SQLite)
- [x] storage:all:verify (8 gates Dexie)
- [x] weighing:mapper / maintenance:ui / maintenance:dialog / desktop:smoke
- [x] packaged:source:verify (pacote sem better-sqlite3, main enxuto)
- [x] e2e:installed:verify (sem módulo nativo em app.asar.unpacked)
- [x] docs:user:verify
- [x] instalador Setup 1.1.1.exe + checksum + manifesto

## Manual (máquina real — Maike)
- [ ] PENDENTE — instalar o Setup 1.1.1 (desinstalar anterior)
- [ ] PENDENTE — abrir → Manutenção → confirmar Versão 1.1.1 e "Armazenamento: IndexedDB local"
- [ ] PENDENTE — backup do banco ANTES de criar pesagem
- [ ] PENDENTE — criar pesagem → fechar → reabrir → dados salvos
- [ ] PENDENTE — exportar CSV/JSON, restaurar backup
