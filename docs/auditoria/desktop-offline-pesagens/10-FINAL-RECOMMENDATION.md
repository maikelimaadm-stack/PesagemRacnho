# 10 — Recomendação Final

## Decisão arquitetural

### ✅ PRINCIPAL: Electron + SQLite

**Justificativa baseada no estado real do projeto:**

| Critério | Electron+SQLite | Tauri+SQLite | Web/PWA |
|----------|-----------------|--------------|---------|
| Retrabalho frontend | Mínimo | Médio | N/A |
| Shell já implementado | ✅ | ❌ | ❌ |
| IPC já implementado | ✅ | ❌ | ❌ |
| Instalador NSIS gerado | ✅ | ❌ | ❌ |
| SQLite transacional | ✅ (better-sqlite3) | ✅ | ❌ |
| Hardware futuro (balança) | ✅ | ✅ | ❌ |
| Tamanho instalador | ~87MB | ~15-30MB | — |
| Curva manutenção Cursor | Baixa (JS) | Média (Rust) | — |
| Offline real | ✅ | ✅ | ⚠️ |

**Conclusão:** O projeto **já investiu em Electron**. Migrar para Tauri agora seria **recomeçar o shell** sem ganho proporcional imediato. SQLite no main process é o caminho natural.

### ⚠️ ALTERNATIVA: Tauri + SQLite

Considerar **somente se** após release Windows v1:
- Tamanho do instalador for bloqueador comercial
- Equipe adicionar competência Rust
- Requisitos de segurança exigirem sandbox mais rígido

Estimativa esforço Tauri: **3-4 semanas** para paridade com Electron atual.

### ❌ DESCARTADA: Web/PWA/IndexedDB

**Motivos:**
- Não gera aplicativo instalável real (experiência atual do usuário exige .exe)
- Backup/restore frágeis
- Sem acesso confiável a filesystem e hardware
- Dados presos ao perfil do navegador
- Já foi abandonado neste projeto (IndexedDB removido)

---

## Banco local definitivo

### Recomendação: SQLite via better-sqlite3 (main process)

**Por que não JSON (atual):**
- Sem transações
- Corrupção em crash
- O(n) por write
- Sem índices/constraints
- Classificação: **INSEGURO PARA PRODUÇÃO**

**Por que SQLite e não só JSON "leve":**
- JSON é leve mas **não confiável** para pecuária operacional
- SQLite oferece WAL, transações, índices com overhead aceitável (~1 arquivo .db)
- Tamanho .db compacto para centenas de milhares de registros

**Plano B (se better-sqlite3 falhar compilação):** sql.js no main process com persistência .db — já foi testado no histórico do projeto.

---

## Schema SQLite proposto (não implementar ainda)

```txt
schema_migrations     (version INTEGER PRIMARY KEY, applied_at TEXT)
app_settings          (key TEXT PRIMARY KEY, value TEXT)

animals               (id, brinco, marca, sexo, raca, era, status, ...)
lots                  (id, apartacao_id, nome, peso_min, peso_max, fechado, ...)
weighing_sessions     (id, data, lote_id, operador, status, ...)  -- fase 2
weighing_entries      (id, animal_id, session_id, data_pesagem, peso_kg, ...)
                      -- ou manter flat PesagemIndividual inicialmente

sanidade_*            (migrar entidades atuais)
embarque_*            (migrar entidades atuais)
audit_log             (id, entity, entity_id, action, payload_old, payload_new, ...)
backup_history        (id, path, created_at, size_bytes, checksum)
```

**Estratégia:** Migration v001 espelha JSON atual (8 entidades) → refatorar para modelo relacional em v002+.

---

## Estrutura de pastas futura sugerida

```txt
src/
  app/                    # App.jsx, router, providers
  modules/
    weighing/
      domain/             # regras pure JS
      application/        # services/use-cases
      infrastructure/     # repository IPC client
      ui/                 # pages (visual intacto)
  shared/
    database/             # tipos, contratos IPC
    validation/
    backup/
    errors/
electron/
  main.cjs
  preload.cjs
  sqlite/
    db.cjs
    migrations/
  backup/
docs/
  auditoria/
  architecture/
release/                  # instaladores gerados
dev/                      # .bat/.vbs só para devs
```

---

## Distribuição ao usuário final

**O usuário deve receber apenas:**
```
Pesagens Individuais Setup X.Y.Z.exe
```

**O usuário NÃO deve ver:**
- node_modules, src, .bat, .vbs, scripts, data/ do projeto

**Dados do usuário ficam em:**
```
C:\Users\{user}\AppData\Roaming\pesagens-individuais\data\pesagens.db
```

---

## Critérios de aceite do projeto "pronto para produção"

1. Base44 zero resíduos funcionais
2. SQLite com migrations
3. Backup automático
4. Instalador Windows testado em VM limpa
5. Single instance lock
6. Zero erros lint
7. Testes domínio + repository
8. Documentação operacional (backup, restore, suporte)

---

## Primeiro slice após auditoria

**Slice D.1** — Limpar resíduos offline + lint + mover scripts dev

**Segundo slice:** **D.3** — SQLite (não pular para instalador antes do banco confiável)

---

## Arquivos NÃO alterar agora

- `src/pages/PesagensIndividuais.jsx` (visual)
- `src/pages/LancamentoPesagensIndividuais.jsx` (visual)
- `src/Layout.jsx` (visual)
- `src/components/ui/*`
- `src/index.css`

## Arquivos candidatos a refatoração futura

- `src/pages/*.jsx` (extração lógica → services)
- `electron/db.cjs` (substituir por sqlite)
- `src/api/db.js` (renomear contrato)
- `src/components/DbBootstrap.jsx`

---

## Observação final

O projeto **não está "errado"** — está **em transição incompleta**. A UI de pesagens é funcional e rica. O gap principal é **infraestrutura de dados e empacotamento profissional**, não funcionalidade de tela.

A auditoria confirma: **não mascarar** — falta camada de persistência production-grade antes de distribuir amplamente.
