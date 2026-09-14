# NEXT-SLICE-D6-READINESS — Slice D.5

## Estado após D.5

```
PesagemIndividual = SQLite como fonte única operacional
JSON legado = backup histórico preservado
Bridge JSON = desativada operacionalmente após migração
```

## O que está pronto

- Migração controlada com backup, dry-run, apply, idempotência
- IPC de migração exposto
- Auto-migração no startup do Electron
- `weighingService` SQLite-only pós-migração
- Telas operacionais usando `weighingService`
- Scripts de verificação completos
- Evidências D.5

## O que ainda falta

- Remover `legacyWeighingBridge.js` definitivamente (após validação em produção)
- Migrar outras entidades (Apartacao, Sanidade, Embarque) — fora de escopo D.5
- Backup/exportação/importação profissional
- Validação do instalador real com SQLite empacotado
- Suite de testes automatizados (`npm run test`)

## Backup/export/import recomendado

- Export SQLite → JSON/CSV para portabilidade
- Import com validação e deduplicação
- Backup automático periódico do `.db`
- Restore com verificação de integridade

## Arquivos candidatos

- `electron/database/backupService.cjs` (novo)
- `electron/ipc/backupIpc.cjs` (novo)
- `legacyWeighingBridge.js` (remoção futura)
- `electron/db.cjs` (redução gradual de entidades JSON)

## Gates recomendados

- `backup:export:verify`
- `backup:import:verify`
- `installer:sqlite:verify`
- Remoção de bridge após 1 release estável

## Próximo slice

**Slice D.6** — Backup/exportação/importação profissional + validação de instalador real com SQLite.
