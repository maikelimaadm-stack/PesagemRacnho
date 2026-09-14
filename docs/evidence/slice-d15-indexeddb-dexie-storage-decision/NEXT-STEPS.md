# NEXT-STEPS (após D.15)

## Estado
Fundação IndexedDB/Dexie construída e validada (first-run, CRUD, backup,
import/restore, integridade), destacada de SQLite. UI ainda em SQLite. Nada
quebrado. Versão 1.0.2.

## Antes de um cutover grande — confirmar a causa raiz (barato)
A Maike instala o **1.0.2** atual, abre Manutenção e confirma **Versão: 1.0.2** +
envia `%APPDATA%\pesagens-individuais\logs\app.log` / "Copiar diagnóstico" da
falha. Isso revela se o problema físico é bug de código ou build antigo — pode
evitar/repriorizar a migração.

## Cutover Dexie (quando aprovado)
1. Reescrever os dataAdapters do renderer para o storageAdapter:
   weighing, health, auxiliary, shipments, maintenance + proxy `db.entities`.
2. Ajustar mappers de domínio para as linhas Dexie (mesmos nomes de campo).
3. Manutenção: apontar backup/export/import/restore/integridade para storageAdapter.
4. Rodar o app (dev + empacotado) e validar cada tela.
5. Só então: remover better-sqlite3 + electron/database/sqlite* + IPC de banco.
6. Bump 1.1.0 + dist + checksum + manifest + docs/release/1.1.0.
7. Teste físico da Maike com o 1.1.0.

## Pendências
- Cutover da UI; remoção do SQLite; release 1.1.0; migração de dados legados
  (opcional); ícone; code signing.

## Só depois do teste físico OK do fluxo final
Criar docs/HANDOFF-CLAUDE-CODE.md.
