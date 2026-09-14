# Programa Pesagens Individuais 2.0 — Fase 0: baseline e governança

**Data:** 14/09/2026 · **Base:** 1.1.17 / Dexie v6 · **Branch:** `program/2.0`

## 1. Entregas

| Item (programa §22) | Resultado | Evidência |
|---|---|---|
| Ler a Auditoria Master | lida integralmente (45 documentos) | `docs/evidence/auditoria-master-produto-pecuario/` |
| Estado real do workspace | sem Git; 1.1.17; `release-unsigned/` com Setup 1.1.17; `.tmp/formulario-escopo` (designs); `data/` legado ignorado | `.gitignore` |
| Inicializar Git | `git init`, `main`, `.gitignore`, commit `77eeb3b` "chore: baseline before professional product migration", tag `v1.1.17-baseline` (671 arquivos) | `git log`, `git tag` |
| lint / build | verdes (11 s / 22 s) | `GATES.md` |
| Gates individuais | 28 verificações: 26 verdes, 2 vermelhos conhecidos | `GATES.md` §1 |
| Correção dos dois gates | contrato real validado (registry selecionado no Lançamento; estrutura do segmento Registro/Tabela); commit `8c79022` | `GATES.md` §2 |
| `test:quick` | **20/20 verde** | `GATES.md` §3 |
| Medições | payload, auditoria, 36k e 250k em Node, 36k no Chromium | `PERFORMANCE.md` |
| ADRs | ADR-018…ADR-040 (22 decisões + login local, RBAC, versionamento, migrações, release, Git) — commit `39a2071` | `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` |
| Contratos da Fase 1 | documentos 10–14 (produto 2.0, autenticação local, dados v7/v8, versionamento/release, migrações) — commit `e4d4278` | `docs/arquitetura-produto/` |
| Esquema v7 (estrutura) | `schema.js`/`db.js` com STORES_V7, remoção de `lotes`, gates de storage verdes — commit `986c502` | `12-MODELO-DADOS-V7-V8.md` |

## 2. Commits da fase

```
77eeb3b chore: baseline before professional product migration            (main, tag v1.1.17-baseline)
8c79022 test(gates): align operational-customization and ui-consistency … (program/2.0)
39a2071 docs(adr): register ADR-018..ADR-040 …
c2a1a06 test(perf): add legacy_payload and audit size measurement
e4d4278 docs(program): phase 0 contracts … and gate/perf evidence
986c502 feat(storage): introduce Dexie v7 schema (structure only)
```

## 3. Decisão de governança aplicada

`main` guarda o baseline; todo o programa acontece em `program/2.0` (ADR-040). Agentes trabalham em áreas disjuntas na mesma árvore; arquivos compartilhados pertencem ao coordenador; commits são sequenciais e semânticos.

## 4. Riscos observados

- O trabalho paralelo de 14/09 deixou gates vermelhos por desalinhamento entre gate e código; a regra "gate valida contrato real" foi aplicada e registrada.
- A reconstrução do índice de animais na tela ainda custa 0,9 s no Chromium (36 mil) e 15,5 s em Node (250 mil): a Fase 2 resolve pela leitura por identificadores (ADR-034).
- `salvamento_local` está dentro do orçamento em 36 mil (Node 198 ms; Chromium 19 ms) e fora em 250 mil (Node 1,4 s): medir no Chromium na Fase 2 antes de decidir paginação/virtualização.

## 5. Próxima fase

Fase 1 (release 1.2.0): login local, usuários/RBAC, Dexie v7 completo (migration coordinator, backfill, backup v3), cadastros mestres com telas ModeloBase1, sanidade removida, versionamento, instalador 1.2.0.
