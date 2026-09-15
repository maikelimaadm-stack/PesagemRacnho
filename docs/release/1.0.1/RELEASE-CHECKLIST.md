# Checklist da release 1.0.1

Itens **automáticos** marcados conforme execução real. Itens **manuais** só
podem ser marcados após execução física; enquanto isso, `PENDENTE`.

## Automático (execução real em 2026-07-20)

- [x] npm run lint
- [x] npm run build
- [x] npm run test (= test:full)
- [x] npm run test:quick
- [x] npm run test:full
- [x] first-run db bootstrap (first-run:db:verify)
- [x] first-run backup via handler IPC real (maintenance:first-run-backup:verify)
- [x] contrato do fluxo do botão de backup (maintenance:ui-backup-flow:verify)
- [x] backup/export/restore/integridade (maintenance:*:verify)
- [x] pacote contém a correção (packaged:source:verify) — app.asar 1.0.1 com ensureDatabaseReady
- [x] instalador gerado — Pesagens Individuais Setup 1.0.1.exe
- [x] checksum gerado (release:checksum)
- [x] manifesto gerado (release:manifest) — aponta para 1.0.1
- [x] e2e installed verify (estrito)
- [x] smoke desktop verify
- [x] preservação de dados (data:preservation:verify)
- [x] docs de usuário/release (docs:user:verify)

## Manual (máquina limpa real — Maike, com o instalador 1.0.1)

- [ ] PENDENTE — usar SOMENTE o instalador 1.0.1 (desinstalar versão anterior se preciso)
- [ ] PENDENTE — abrir o app e confirmar **Versão: 1.0.1** na tela de Manutenção
- [ ] PENDENTE — na primeira abertura, o banco foi criado automaticamente (data/ + pesagens.db)
- [ ] PENDENTE — o usuário não precisou configurar banco nem instalar SQLite
- [ ] PENDENTE — criar backup do banco logo após abrir (SEM criar pesagem antes)
- [ ] PENDENTE — criar backup completo logo após abrir
- [ ] PENDENTE — NÃO apareceu "Banco SQLite não inicializado"
- [ ] PENDENTE — criar pesagem → fechar → reabrir → dados salvos
- [ ] PENDENTE — exportar CSV e JSON
- [ ] PENDENTE — reinstalar por cima → dados preservados
- [ ] PENDENTE — se falhar, enviar `%APPDATA%\pesagens-individuais\logs\app.log`

> Registro assinável:
> `docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`
