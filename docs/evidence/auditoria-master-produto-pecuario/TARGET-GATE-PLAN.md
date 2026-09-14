# TARGET-GATE-PLAN — Plano de gates para o modelo alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Estado dos gates hoje

| Grupo | Gates | Estado em 14/09/2026 |
|---|---|---|
| `test:quick` (16 verificações + lint + release:current-only) | lint, release:current-only, runtime:legacy, ui:locale-dialog, ui:operational-customization, animal:history-integrity, import:selection, ui:scrollbar-contract, ui:consistency, weighing:calculations, perf:contract, enterprise:hardening, main:boot, preload:contract, storage:dexie, storage:first-run, storage:ui-first-run-persistence, storage:maintenance-ui-flow, storage:legacy-detached, desktop:smoke | dois vermelhos conhecidos: `ui:operational-customization:verify` (espera `GerenciarSaidasDialog` no Lançamento) e `ui:consistency:verify` (asserção de template literal do `aux-view-seg`), ambos introduzidos pela sessão paralela; **não alterados nesta auditoria** (resultado da execução em `EXECUTIVE-ASSESSMENT.md`) |
| `test:full` | os acima + build, storage:all, weighing:mapper, maintenance:ui, maintenance:dialog, docs:user, e2e:installed:dev | não executado nesta auditoria (fora do escopo pedido) |

## 2. Gates existentes que mudam de contrato

| Gate | Mudança | Fase |
|---|---|---|
| `storage:dexie:verify` | v7/v8: stores novas, `lotes` removida, índices promovidos | M1, M4 |
| `storage:backup:verify` | `formatVersion 3`; restore v6 → backfill; stores ignoradas listadas | M1 |
| `storage:import-restore:verify` | importação resolve marca/raça por cadastro; Manejo não cria animal | M1/M3 |
| `animal:history-integrity:verify` | identidade `NÚMERO::MARCA_ID`; identificadores com validade; massa com ids | M1, M2 |
| `enterprise:hardening:verify` | duplicidade no serviço; peso por evento; sessão fechada recusa evento | M3, M5 |
| `weighing:mapper:verify` | colunas promovidas; lista permitida do payload; leitura coluna → payload → nulo | M1 |
| `perf:contract:verify` | massa gera cadastros por id; identificação por índice de identificadores; abertura do Lançamento medida | M2 |
| `ui:operational-customization:verify` | contrato do Lançamento enxuto (sem popups, sem olhinho, seleção de cadastros) — **reescrito**, não corrigido para o antigo | M3 |
| `ui:consistency:verify` | asserções por tela nova (Tela Mãe) e remoção das telas retiradas | M1–M5 |
| `runtime:legacy:verify` | proíbe `registryService`, `GerenciarSaidasDialog`, `window.__sequenciaBrincos`, `perfis-saida` | M1, M2 |
| `docs:user:verify` | guia com cadastros, faixas, operações, fechamento por sessão | cada fase |
| `maintenance:ui:verify` / `maintenance:dialog:verify` | ações de dry-run/backfill de migração | M1 |

## 3. Gates novos

| Gate (script) | O que prova | Entra em | Fase |
|---|---|---|---|
| `registry:master:verify` (`scripts/verify-master-registry.mjs`) | unicidade por `nome_normalizado`; inativação com vínculo; resolução por nome; `padrao` único | `test:quick` | M1 |
| `migration:v7:verify` (`verify-v7-migration.mjs`) | migração em massas vazia/pequena/36k: contagens, ids preenchidos, payload limpo, `lotes` removida, tempo < orçamento | `test:quick` (36k só em `test:full`) | M1 |
| `identifier:inventory:verify` | próximo livre com exceções; uso fora de ordem; perdido; saldo; sobreposição recusada; unicidade por marca | `test:quick` | M2 |
| `launch:contract:verify` (substitui `ui:operational-customization`) | Manejo com 3 campos; sem popups de cadastro; cadastro rápido mínimo; contexto de sessão | `test:quick` | M3 |
| `migration:v8:verify` | agrupamento de saídas/compras em operações; `operacao_id`; enums de embarque | `test:full` | M4 |
| `commercial:operations:verify` | máquina de estados; totais calculados × informados; cancelamento reverte saídas e projeções | `test:quick` | M4 |
| `shipment:state:verify` | transições válidas/inválidas; saída só em `EM_CARREGAMENTO`; conferência previsto × real | `test:quick` | M4 |
| `reports:manifest:verify` | exportação com manifesto e hash; mesma população tela/arquivo; nulos não viram zero | `test:quick` | M4/M5 |
| `session:closing:verify` | bloqueio de sessão fechada; snapshot = consulta; reabertura com motivo; uma sessão por data+local | `test:quick` | M5 |
| `payload:allowlist:verify` | nenhuma chave fora da lista permitida entra em `legacy_payload`; edição não infla o payload | `test:quick` | M1 |

## 4. Evidências obrigatórias por fase (além dos gates)

- Capturas claro/escuro de cada tela nova/refeita (`evidence:screens` com `CAPTURE_STEPS`).
- Baseline de desempenho comparado (ADR-017): Node **e** navegador na massa de 36 mil; 250 mil em M1 e M2.
- Relatório de dry-run da migração real do responsável (anonimizado) antes de liberar a versão.
- Roteiro humano de curral (50 animais) em M3.
- Teste em máquina limpa com restauração de backup v6 em app v7 (M1).

## 5. Regra sobre gates vermelhos

Gate vermelho bloqueia a fatia seguinte. Um gate só é alterado quando o contrato muda, na mesma fatia que muda o contrato, com o motivo registrado no `CHANGELOG.md` e evidência. Os dois gates vermelhos atuais devem ser resolvidos pela sessão que os introduziu antes de M0 terminar.
