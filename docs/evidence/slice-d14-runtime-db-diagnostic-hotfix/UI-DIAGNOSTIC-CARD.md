# UI-DIAGNOSTIC-CARD

Alterada SOMENTE a seção Diagnóstico da tela de Manutenção
(`src/pages/ManutencaoSistema.jsx`). Sem redesenhar o app, sem tela nova.

## Mostra
- Versão: 1.0.2
- Banco: OK/verificar · <databaseReadyStatus>
- Caminho do banco: `%APPDATA%\pesagens-individuais\data\pesagens.db`
- Log: `%APPDATA%\pesagens-individuais\logs\app.log`

## Botão "Copiar diagnóstico"
Copia para a área de transferência: versão, isPackaged, status do banco,
databaseExists, caminho do banco, dataDirExists, caminho do log, logExists,
databaseReadyStatus, lastError, última verificação e stats. Sem dados sensíveis.

## Fonte
Consome `window.pesagemApp.getDiagnosticInfo()` (IPC `app:getDiagnosticInfo`).

## Objetivo
Maike confirmar na máquina física que está rodando o **1.0.2** (não um build
antigo) e enviar diagnóstico + app.log se o backup falhar.

## Prova
`packaged:source:verify` confirma no app.asar (bundle do renderer) os tokens
`getDiagnosticInfo` e `Caminho do banco`.
