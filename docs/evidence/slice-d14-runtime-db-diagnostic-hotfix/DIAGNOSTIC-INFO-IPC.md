# DIAGNOSTIC-INFO-IPC

## IPCs
- `app:getReleaseInfo` → { version, productName, userDataPath, databasePath, logPath }
- `app:getDiagnosticInfo` → objeto completo de diagnóstico.

Construídos por `electron/diagnostics.cjs` `buildDiagnosticInfo(...)`, que lê o
runtime SSOT + estado do app (databaseReadyStatus, lastError, logPath).

## Campos de getDiagnosticInfo
version, productName, isPackaged, userDataPath, dataDir, databasePath,
databaseExists, dataDirExists, logPath, logExists, databaseReadyStatus, lastError.

Nenhum dado sensível (nenhuma pesagem). Nada enviado à internet.

## Consumo
`src/pages/ManutencaoSistema.jsx` chama `window.pesagemApp.getDiagnosticInfo()` e
exibe Versão, status do banco, caminho do banco e caminho do log; "Copiar
diagnóstico" inclui todos os campos.

## Prova
- `installed:runtime:diagnostic:verify`: chama `buildDiagnosticInfo` antes/depois
  do ensure (databaseExists false→true; version 1.0.2; logPath/dataDir corretos).
- `packaged:source:verify`: main.cjs (`app:getDiagnosticInfo`), preload
  (`getDiagnosticInfo`), diagnostics.cjs (`buildDiagnosticInfo`) no app.asar.
