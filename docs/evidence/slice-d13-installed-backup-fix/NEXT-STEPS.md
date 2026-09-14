# NEXT-STEPS (após D.13)

## Estado
Backup corrigido no caminho real do botão; pacote **1.0.1** provado contendo
`ensureDatabaseReady`; versão visível na UI; log local disponível. Todos os
gates verdes.

## Instrução para Maike (importante)
1. Usar **somente** o instalador `Pesagens Individuais Setup 1.0.1.exe`
   (SHA256 `23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7`).
2. Se houver versão anterior instalada, **desinstalar** antes (ou instalar por
   cima) para não rodar build antigo.
3. Abrir o app → **Manutenção** → conferir na parte de Diagnóstico:
   **Versão: 1.0.1**. Se não mostrar 1.0.1, ainda é o build antigo.
4. Testar **backup do banco** e **backup completo** imediatamente após abrir
   (sem criar pesagem antes). Não pode aparecer "Banco SQLite não inicializado".
5. Se ainda falhar, enviar o arquivo:
   `%APPDATA%\pesagens-individuais\logs\app.log`.

## Pendências
- Teste físico completo em máquina limpa com o 1.0.1 (assinar o
  CLEAN-MACHINE-TEST-RECORD).
- Ícone customizado.
- Code signing (SmartScreen / quarentena de antivírus).

## Só depois do teste físico OK
Criar `docs/HANDOFF-CLAUDE-CODE.md`.
