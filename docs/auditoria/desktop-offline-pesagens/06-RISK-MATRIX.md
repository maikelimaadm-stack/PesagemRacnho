# 06 — Matriz de Riscos

| ID | Risco | Sev. | Prob. | Área | Evidência | Impacto | Correção | Slice |
|----|-------|------|-------|------|-----------|---------|----------|-------|
| R-01 | Perda/corrupção de dados JSON | CRÍTICO | MÉDIA | electron/db.cjs | writeFileSync sem atomic rename | Perda total de lançamentos | SQLite + WAL + atomic write | D.3 |
| R-02 | Duas instâncias corrompem banco | ALTO | MÉDIA | electron/main.cjs | Sem single-instance lock | JSON corrompido | app.requestSingleInstanceLock | D.7 |
| R-03 | clearAll sem backup | CRÍTICO | BAIXA | Lancamento + IPC | Botão "Limpar dados" | Apagão total | Confirm + backup obrigatório | D.6 |
| R-04 | Código offline morto / lint break | ALTO | ALTA | LancamentoPesagensIndividuais | editingOfflineId undefined | Runtime error potencial | Remover resíduos | D.1 |
| R-05 | DbBootstrap texto SQLite errado | BAIXO | ALTA | DbBootstrap.jsx | Menciona SQLite | Confusão operacional | Atualizar texto | D.1 |
| R-06 | Sem migrations | CRÍTICO | ALTA | db.cjs | Sem schema_version | Evolução impossível | schema_migrations | D.3 |
| R-07 | UI acoplada ao storage | ALTO | ALTA | pages/*.jsx | db.entities direto | Refactor caro, bugs | Repository layer | D.4 |
| R-08 | Sem backup automático | ALTO | MÉDIA | — | Ausente | Perda irreversível | Backup diário | D.6 |
| R-09 | Sem export/import JSON oficial | MÉDIO | MÉDIA | — | Só CSV import | Migração difícil | Export/import tool | D.6 |
| R-10 | Instalador sem code signing | MÉDIO | ALTA | electron-builder | signAndEditExecutable: false | SmartScreen bloqueia | Certificado EV/OV | D.7 |
| R-11 | Scripts .bat/.vbs expostos | MÉDIO | ALTA | raiz projeto | iniciar-pesagens.* | UX não profissional | Só distribuir .exe | D.7 |
| R-12 | Performance tabela 100k+ | ALTO | BAIXA | PesagensIndividuais | Client-side filter, sem paginação server | UI trava | Índices SQLite + paginação | D.3/D.4 |
| R-13 | Hard delete sem audit | ALTO | MÉDIA | db.cjs deleteEntity | splice permanente | Sem rastreio | soft delete + audit_log | D.3 |
| R-14 | Duplicidade pesagem | MÉDIO | MÉDIA | UI validation only | Sem unique index | Dados duplicados | UNIQUE constraint | D.3 |
| R-15 | Cache React Query stale | MÉDIO | MÉDIA | PesagensIndividuais | staleTime: Infinity | Dados desatualizados | Invalidar on mutation | D.4 |
| R-16 | Dados legados pesagens.db | MÉDIO | BAIXA | data/ | .db antigo sem migração | Perda ao migrar | Script migração | D.5 |
| R-17 | Sem testes automatizados | ALTO | ALTA | — | 0 testes src | Regressões | Vitest + repo tests | D.4 |
| R-18 | Bundle JS 691KB | BAIXO | ALTA | dist/ | vite build warning | Startup lento | Code split (futuro) | — |
| R-19 | Sem logs/crash report | MÉDIO | MÉDIA | electron | Ausente | Debug difícil | electron-log | D.7 |
| R-20 | Validação data futura ausente | BAIXO | MÉDIA | handleSalvar | Não verifica | Dados inválidos | Domain rule | D.4 |
| R-21 | Nomenclatura Base44 residual | BAIXO | ALTA | db.entities | API compat | Confusão equipe | Renomear camadas | D.1/D.4 |
| R-22 | Update apaga dados | ALTO | BAIXA | userData path | Caminho correto hoje | Perda pós-update | Teste reinstalação | D.7 |
| R-23 | Import CSV sem transação | MÉDIO | MÉDIA | PesagensIndividuais | bulkCreate batches | Import parcial | Transaction wrap | D.4 |
| R-24 | Propagação rename N updates | MÉDIO | BAIXA | GerenciarApartacoes | Loop update | Lentidão | SQL UPDATE WHERE | D.3 |
| R-25 | empresa_id legado | BAIXO | BAIXA | db.js | 'local' fixo | Confusão | Remover quando possível | D.1 |

---

## Heat map (Severidade × Probabilidade)

```
         BAIXA    MÉDIA    ALTA
CRÍTICO   R-03     R-01     R-06
ALTO      R-16     R-02     R-04,R-07,R-17
MÉDIO     —        R-08+    R-11,R-15
BAIXO     R-05     R-20     R-18,R-21
```

---

## Top 3 ações imediatas (pós-auditoria)

1. **D.1** — Limpar resíduos offline + corrigir lint errors
2. **D.3** — SQLite + migrations + transações
3. **D.7** — Validar instalador NSIS em máquina limpa
