# NEXT-STEPS (após D.16)

## Instrução para Maike (crítico)
1. Usar SOMENTE `Pesagens Individuais Setup 1.1.0.exe`
   (SHA256 `616a3059566a5f9a2f7f1a0e68967c891dd18991111eb54c74f634531ba04a49`).
   Desinstalar a versão anterior.
2. Abrir → Manutenção → confirmar **Versão: 1.1.0** e
   **"Armazenamento: IndexedDB local (Dexie)"**.
3. Testar **backup do banco** e **backup completo** logo ao abrir (sem criar
   pesagem antes). NÃO deve aparecer "Banco SQLite não inicializado".
4. Criar pesagem → fechar → reabrir → dados salvos. Exportar CSV/JSON. Restaurar backup.
5. Se falhar, "Copiar diagnóstico" + enviar o `app.log`
   (`%APPDATA%\pesagens-individuais\logs\app.log`).

## Follow-up técnico (com validação física)
- Remover better-sqlite3 de dependencies + asarUnpack + postinstall; enxugar
  `main.cjs` (só dialogs/files/release/diagnóstico) → instalador sem native.
- Migração opcional de dados SQLite → Dexie (importador).
- Ícone; code signing.

## Só depois do teste físico OK do 1.1.0
Criar `docs/HANDOFF-CLAUDE-CODE.md`.
