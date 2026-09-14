# DIALOG-AND-PATH-SAFETY

## Dialogs criados
- `dialog:select-import-json`
- `dialog:select-sqlite-backup`
- `dialog:select-export-directory`

Módulo: `electron/ipc/dialogIpc.cjs`  
Preload: `pesagemApp.dialogs.*`

## Extensões permitidas
- Import: `.json` apenas
- Restore: `.db` apenas

## Validação de path
- Arquivo regular obrigatório
- Diretório rejeitado
- Restore: cópia para `dataDir/backups/imports/restore-staging-*.db` (fica dentro do dataDir)
- Import: conteúdo lido no main; apply usa **payload** (não path externo)

## Rejeições
Extensão errada, diretório, JSON inválido → AppError PATH_001 / IMPORT_001

## Limitações
Não é sandbox empresarial; apenas proteção contra acidente/path inválido
