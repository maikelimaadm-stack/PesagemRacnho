# Checklist da release 1.0.0

Os itens **automáticos** são marcados conforme execução real das suítes.
Os itens **manuais** só podem ser marcados após execução física; enquanto isso
permanecem como `PENDENTE`.

## Automático (execução real; instalador REGENERADO no D.11 em 2026-07-16)

- [x] npm run lint
- [x] npm run build
- [x] npm run test
- [x] npm run test:quick
- [x] npm run test:full
- [x] first-run db bootstrap (first-run:db:verify) — banco criado do zero, 16 tabelas, migrations 001–003, integrity ok
- [x] first-run backup (maintenance:first-run-backup:verify) — backup do banco + completo funcionam logo após a 1ª abertura, sem "Banco SQLite não inicializado"
- [x] instalador validado — `release/Pesagens Individuais Setup 1.0.0.exe` REGENERADO
      no D.12 (correção do bootstrap de backup). Novo SHA256.
- [x] checksum gerado (release:checksum) — SHA256 `292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52`
- [x] manifesto gerado (release:manifest) — release-manifest.json com o novo SHA256
- [x] installer sqlite verify (installer:sqlite:verify)
- [x] e2e installed verify (e2e:installed:verify) — modo estrito: Setup.exe + .sha256 + manifest exigidos
- [x] smoke desktop verify (desktop:smoke:verify)
- [x] preservação de dados (data:preservation:verify)
- [x] docs de usuário/release (docs:user:verify)

## Manual (máquina limpa real — Maike)

- [ ] PENDENTE — instalar em máquina limpa
- [ ] PENDENTE — abrir o app
- [ ] PENDENTE — na primeira abertura, o app criou automaticamente a pasta data
- [ ] PENDENTE — na primeira abertura, o app criou automaticamente pesagens.db
- [ ] PENDENTE — o usuário não precisou configurar banco
- [ ] PENDENTE — o usuário não precisou instalar SQLite
- [ ] PENDENTE — o arquivo pesagens.db apareceu em userData/data
- [ ] PENDENTE — a tela de manutenção mostrou banco OK
- [ ] PENDENTE — backup do banco funcionou logo após a primeira abertura
- [ ] PENDENTE — backup completo funcionou logo após a primeira abertura
- [ ] PENDENTE — NÃO apareceu "Banco SQLite não inicializado"
- [ ] PENDENTE — o app salvou uma pesagem sem configuração manual
- [ ] PENDENTE — fechar e abrir novamente
- [ ] PENDENTE — confirmar que a pesagem continuou salva
- [ ] PENDENTE — criar backup
- [ ] PENDENTE — exportar CSV
- [ ] PENDENTE — exportar JSON
- [ ] PENDENTE — verificar integridade
- [ ] PENDENTE — restaurar backup de teste
- [ ] PENDENTE — reinstalar por cima
- [ ] PENDENTE — confirmar que dados continuam

> Registro assinável do teste manual:
> `docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`
> Roteiro passo a passo: `docs/user/TESTE-MAQUINA-LIMPA.md`
