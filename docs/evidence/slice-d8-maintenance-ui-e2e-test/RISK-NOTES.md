# RISK-NOTES

## Riscos eliminados
- Usuário sem UI para backup/export/restore/integridade
- Ausência de `npm run test`
- Bridge legada ainda no caminho operacional de pesagens

## Riscos reduzidos
- Restore/import acidental (dry-run + confirm + backup prévio)
- Path traversal / extensão errada nos dialogs

## Riscos remanescentes
- E2E não executa o .exe instalado automaticamente
- Stub `legacyWeighingBridge.js` ainda no tree
- `electron/db.cjs` JSON legado ainda existe (backup/migração)
- Sem teste em máquina limpa

## Riscos aceitos por simplicidade
- Sem login/senha/permissões
- Sem criptografia avançada
- Confirmação via `window.confirm` (simples)

## Mitigações
- Serviços D.6 + UI D.8 + verifies + staging de restore
