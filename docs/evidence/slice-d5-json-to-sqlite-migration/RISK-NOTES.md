# RISK-NOTES — Slice D.5

## Riscos eliminados

- Pesagens legadas editáveis diretamente no JSON via telas operacionais
- Lista híbrida carregando JSON completo em memória após migração concluída
- Duplicação de registros na migração (idempotência garantida)
- Perda de JSON legado (backup obrigatório + JSON preservado)
- Migração sem dry-run (dry-run obrigatório antes de apply)

## Riscos reduzidos

- Divergência SQLite vs JSON (fonte única operacional pós-migração)
- Registros ocultos (todos migrados ou registrados como inválidos)
- Falha silenciosa na migração (audit_log + app_settings + logs main)

## Riscos remanescentes

- `legacyWeighingBridge.js` ainda no codebase (fallback documentado)
- Outras entidades (Apartacao, Sanidade, Embarque) ainda em JSON
- Auto-migração no startup pode falhar em ambientes com JSON corrompido (bridge permanece ativa)
- Instalador real não validado neste slice

## Riscos de regressão

- Usuário com migração `pending` ainda vê modo híbrido
- Campos legados não mapeados dependem de `legacy_payload` para reconstrução

## Mitigações

- Scripts de verificação automatizados (4 novos)
- Status persistido em `app_settings`
- Backup com SHA256 antes de apply
- Transação SQLite com rollback
- Bridge condicional por `isMigrationCompleted()`
