# 09 — Plano de Testes

## Estado atual

| Tipo | Existe? |
|------|---------|
| Testes unitários src | ❌ |
| Testes integração | ❌ |
| Testes E2E | ❌ |
| Script npm test | ❌ |
| CI | ❌ |

**Evidência:** Nenhum arquivo `*.test.*` ou `*.spec.*` em `src/`.

---

## Stack de testes proposta

| Camada | Ferramenta |
|--------|------------|
| Unit | Vitest |
| Component | Vitest + React Testing Library (mínimo) |
| Electron main | Vitest + node environment |
| E2E desktop | Playwright ou Spectron (fase 2) |

---

## Testes unitários (domínio)

| Caso | Input | Esperado |
|------|-------|----------|
| Peso obrigatório | peso=0 | erro |
| Peso negativo | peso=-1 | erro |
| Data futura | data=tomorrow | erro ou alerta |
| Duplicidade mesmo dia | mesmo animal+marca+data | erro |
| GMD cálculo | peso 300→320, 10 dias | gmd=2.0 |
| SN bypass cadastro | numero=SN | permite |
| Normalização brinco | " abc " | "ABC" |
| Manejo sem cadastro | tipo=Manejo, novo animal | erro |

**Arquivo alvo:** `src/modules/weighing/domain/` (criar no D.4)

---

## Testes de repository

| Caso | Esperado |
|------|----------|
| create pesagem | id gerado, timestamps |
| list ordenado por data desc | ordem correta |
| filter por lote_id | subset correto |
| update pesagem | updated_date muda |
| delete pesagem | removido ou soft-deleted |
| bulkCreate 1000 | transação atômica |
| transação com erro | rollback total |
| migration v001 | tabelas criadas |

**Arquivo alvo:** `electron/sqlite/` (D.3)

---

## Testes de integração

| Fluxo | Passos | Esperado |
|-------|--------|----------|
| Form→Table | Lançar pesagem → abrir listagem | Registro visível |
| Persistência | Salvar → fechar app → reabrir | Dados mantidos |
| Edição | Editar peso → salvar | Atualizado |
| Exclusão | Excluir → confirmar | Removido |
| Import CSV | Upload arquivo válido | N registros criados |
| Apartação rename | Renomear → pesagens atualizadas | nome propagado |
| clearAll | Limpar → confirmar | vazio + backup existia |

---

## Testes desktop (futuro — D.7)

| Caso | Esperado |
|------|----------|
| Build Windows | .exe gerado |
| Instalar limpo | Atalho desktop criado |
| Primeiro run | pesagens.db/json em userData |
| Segunda instância | bloqueada ou foca janela |
| Reinstalar | dados preservados |
| Desinstalar | app removido; dados em userData (documentar) |
| Offline | funciona sem rede |
| Queda energia simulada | SQLite WAL recovery (pós D.3) |

---

## Testes de migração (D.5)

| Cenário | Esperado |
|---------|----------|
| JSON vazio → SQLite | 0 registros |
| JSON 100 pesagens | count=100 |
| JSON inválido | erro + backup intacto |
| Rollback | app lê JSON backup |

---

## Testes de performance (benchmark manual)

| Volume | Métrica | Limite sugerido |
|--------|---------|-----------------|
| 10k pesagens | list + filter | < 500ms |
| 100k pesagens | list paginada | < 1s |
| 1M pesagens | arquitetura | exige paginação server-side + índices |

**Estado atual JSON:** Provavelmente degrada antes de 10k em write.

---

## Critérios de aceite globais (quality gates)

Antes de release produção:

- [ ] `npm run lint` — 0 erros
- [ ] `npm run build` — sucesso
- [ ] `npm run test` — 100% pass (quando criado)
- [ ] Cobertura domínio ≥ 80%
- [ ] Cobertura repository ≥ 70%
- [ ] Smoke test instalador VM limpa

---

## Testes executados nesta auditoria

```
npm run lint  → FAIL (4 errors)
npm run build → PASS
npm run test  → N/A (script missing)
```

### Erros lint (evidência)

```
LancamentoPesagensIndividuais.jsx:358  no-case-declarations
LancamentoPesagensIndividuais.jsx:359  no-case-declarations
LancamentoPesagensIndividuais.jsx:1177 editingOfflineId is not defined
LancamentoPesagensIndividuais.jsx:1227 setEditingOfflineId is not defined
```
