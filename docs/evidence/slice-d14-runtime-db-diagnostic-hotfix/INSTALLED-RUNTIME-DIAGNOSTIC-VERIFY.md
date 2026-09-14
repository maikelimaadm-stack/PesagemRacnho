# INSTALLED-RUNTIME-DIAGNOSTIC-VERIFY

`scripts/verify-installed-runtime-diagnostic.mjs`
(npm run `installed:runtime:diagnostic:verify`).

## Cenário (o mais próximo possível do runtime instalado, em Node)
1. userData temporário limpo; runtime configurado como no main
   (`configureDatabaseRuntime`), log inicializado.
2. `getDiagnosticInfo` ANTES: version 1.0.2, dataDir/databasePath do runtime,
   logPath existente, databaseExists=false.
3. `ensureDatabaseReady()` **sem argumento** (usa o runtime SSOT) → cria
   `pesagens.db` no caminho do runtime.
4. Registra os handlers reais e invoca `maintenance:backup:sqlite` e
   `maintenance:backup:full` (conexão resetada/fechada) → ambos ok.
5. `getDiagnosticInfo` DEPOIS: databaseExists=true, dataDirExists=true,
   databaseReadyStatus=ok.
6. Lê `app.log` e confirma eventos de bootstrap, ensureDatabaseReady, canal de
   backup chamado e backup success.

## Resultado (2026-07-20) — PASS
```json
{
  "version": "1.0.2",
  "databaseExists": true,
  "backupViaHandler": true,
  "fullBackupViaHandler": true
}
```

## Limitação honesta
Não usa o processo Electron real (transporte ipcRenderer entre processos). Cobre:
runtime SSOT, diagnóstico, handlers reais e app.log em Node. O elo final
(Electron empacotado) é o teste físico da Maike com o 1.0.2.
