# RISK-NOTES — Slice D.6

## Riscos eliminados

- Ausência de backup SQLite profissional com manifesto/SHA256
- Ausência de export JSON/CSV estruturado
- Ausência de import controlado com dry-run
- Restore sem validação de integridade/checksum
- Empacotamento sem asarUnpack efetivo (artefato antigo)

## Riscos reduzidos

- Perda de dados em import/restore (backup prévio obrigatório)
- Path traversal via IPC (paths restritos a dataDir)
- Módulo nativo inacessível no instalador (asarUnpack + rebuild)

## Riscos remanescentes

- Sem UI de manutenção para usuário final
- `legacyWeighingBridge.js` ainda no codebase (inativa)
- Outras entidades ainda em JSON
- Instalador sem code signing / ícone custom
- Teste E2E do Setup.exe instalado não executado
- `npm run test` inexistente
- Dev Electron pode falhar se nativo não rebuildado (`postinstall` mitiga)

## Riscos fora do escopo

- Migração Apartacao/Sanidade/Embarque
- Cloud sync
- Autenticação remota

## Mitigações

- Scripts de verificação automatizados
- Backup pré-import e pré-restore
- Safety copy `.bak` no restore
- Documentação de limitações honesta
