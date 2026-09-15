# Checklist da release 1.0.2

Itens **automáticos** marcados conforme execução real. Itens **manuais** só
podem ser marcados após execução física; enquanto isso, `PENDENTE`.

## Automático (execução real em 2026-07-20)

- [x] npm run lint
- [x] npm run build
- [x] npm run test (= test:full, 34 passos OK)
- [x] npm run test:quick
- [x] npm run test:full
- [x] first-run:db:verify
- [x] maintenance:first-run-backup:verify (handler IPC real, conexão fechada)
- [x] maintenance:ui-backup-flow:verify (contrato botão → withDatabaseReady → ensureDatabaseReady)
- [x] installed:runtime:diagnostic:verify (runtime SSOT + diagnóstico + backup via handler + app.log)
- [x] maintenance backup/export/restore/integridade
- [x] packaged:source:verify (app.asar 1.0.2 com databaseRuntime, ensureDatabaseReady, getDiagnosticInfo)
- [x] instalador gerado — Pesagens Individuais Setup 1.0.2.exe
- [x] release:checksum / release:manifest (apontam para 1.0.2)
- [x] e2e:installed:verify (estrito) / desktop:smoke:verify / installer:sqlite:verify
- [x] data:preservation:verify / docs:user:verify

## Manual (máquina limpa real — Maike, com o instalador 1.0.2)

- [ ] PENDENTE — usar SOMENTE o instalador 1.0.2 (desinstalar versão anterior)
- [ ] PENDENTE — Confirmar que Manutenção mostra **Versão 1.0.2**
- [ ] PENDENTE — Confirmar que Manutenção mostra o **caminho do banco**
- [ ] PENDENTE — Confirmar que Manutenção mostra o **caminho do log**
- [ ] PENDENTE — Confirmar que **app.log existe** (`%APPDATA%\pesagens-individuais\logs\app.log`)
- [ ] PENDENTE — Clicar **backup do banco** ANTES de criar pesagem
- [ ] PENDENTE — Clicar **backup completo** ANTES de criar pesagem
- [ ] PENDENTE — NÃO apareceu "Banco SQLite não inicializado"
- [ ] PENDENTE — criar pesagem → fechar → reabrir → dados salvos
- [ ] PENDENTE — Se falhar, **copiar diagnóstico** e enviar **app.log**

> Registro assinável:
> `docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`
