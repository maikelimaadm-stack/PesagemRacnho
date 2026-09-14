# RISK-NOTES — Slice D.1

## Riscos eliminados neste slice

| ID | Risco | Como foi eliminado |
|----|-------|-------------------|
| R-04 | Código offline morto / lint break | Removido `pendingPesagensDB`, `editingOfflineId`; lint passa |
| R-05 | DbBootstrap texto SQLite errado | Texto atualizado para "storage local JSON provisório" |
| — | Runtime error potencial por variável indefinida | `editingOfflineId` / `setEditingOfflineId` removidos |

## Riscos reduzidos

| Risco | Redução |
|-------|---------|
| Confusão operacional (SQLite vs JSON) | Texto DbBootstrap alinhado à realidade |
| Manutenção de código morto | ~50 linhas/refs offline removidas |
| Props mortas em componentes filhos | Interface simplificada |

## Riscos ainda existentes

| ID | Risco | Severidade | Notas |
|----|-------|------------|-------|
| R-01 | Perda/corrupção JSON (writeFileSync sem atomic rename) | CRÍTICO | Pertence D.3 |
| R-02 | UI acoplada a `db.entities.*` | ALTO | Pertence D.3/D.4 |
| R-03 | Sem testes automatizados | MÉDIO | Fora escopo D.1 |
| R-12 | Performance tabela grande | ALTO (baixa prob.) | Pertence D.3/D.4 |
| B-07 | Campos legados Base44 no schema JSON | BAIXO | Migration D.3 |

## Riscos que pertencem ao Slice D.3

- Substituir JSON por SQLite transacional (better-sqlite3)
- Migrations versionadas
- Escrita atômica / WAL
- Migração de dados JSON → SQLite
- Índices para consultas frequentes
- Repository layer desacoplado da UI
