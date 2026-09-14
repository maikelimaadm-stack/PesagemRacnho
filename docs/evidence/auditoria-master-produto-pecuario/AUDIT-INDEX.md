# AUDIT-INDEX — Auditoria master: modelagem profissional do Pesagens Individuais

**Data:** 14/09/2026 · **Aplicação:** 1.1.17 · **Esquema:** Dexie v6 · **Natureza:** documentação de auditoria e modelagem. **Nenhuma implementação foi realizada.**

## 1. Como ler

Comece por `EXECUTIVE-ASSESSMENT.md`, depois `PRODUCT-CAPABILITY-MAP.md` e `DECISION-REGISTER.md`. Os modelos por domínio detalham o "hoje" e o "alvo"; os documentos de dados (Dexie, appSettings, payload, backup, importação) explicam o custo; roadmap, fatias e gates dizem como executar depois das decisões.

## 2. Documentos (45)

### Visão e capacidade
| Documento | Conteúdo |
|---|---|
| `EXECUTIVE-ASSESSMENT.md` | veredito, estado por área, riscos, sequência |
| `PRODUCT-CAPABILITY-MAP.md` | 36 capacidades classificadas (MADURA … AINDA NÃO EXISTE) |

### Animal e identificação
| Documento | Conteúdo |
|---|---|
| `ANIMAL-LIFECYCLE-TARGET.md` | estados e eventos do animal, hoje e alvo |
| `ANIMAL-IDENTIFICATION-MODEL.md` | identidade canônica, identificadores com tipo/validade, unicidade |
| `BRAND-REGISTRY-MODEL.md` | cadastro de marcas e migração do texto livre |
| `BREED-REGISTRY-MODEL.md` | cadastro de raças |
| `ANIMAL-CLASSIFICATION-MODEL.md` | sexo, era → nascimento estimado, categoria |
| `IDENTIFIER-INVENTORY-MODEL.md` | estoque de identificadores: estratégia A × B, modelo de faixas + exceções |
| `ANIMAL-REGISTRATION-FLOW.md` | fluxo de cadastro; tabela "informação → deve virar cadastro?" |
| `ANIMAL-PROFILE-MODEL.md` | ficha do animal |

### Fluxos comerciais e de saída
| Documento | Conteúdo |
|---|---|
| `PURCHASE-FLOW-MODEL.md` | compra como operação |
| `SALE-FLOW-MODEL.md` | venda como operação; retirada do popup legado |
| `SLAUGHTER-FLOW-MODEL.md` | abate com embarque obrigatório e retorno do frigorífico |
| `SHIPMENT-FLOW-MODEL.md` | embarque e máquina de estados |
| `COMMERCIAL-REGISTRY-MODEL.md` | parceiro com papéis |
| `TARGET-COMMERCIAL-FLOW.md` | fluxo comercial separado do curral |
| `MORTALITY-MODEL.md` | mortalidade e causas de morte |

### Estrutura, lotes e sessão
| Documento | Conteúdo |
|---|---|
| `PROPERTY-FARM-MODEL.md` | empresa/propriedade mínima |
| `HERD-LOT-MODEL.md` | apartação, lote, permanência, store `lotes` |
| `WEIGHING-DOMAIN-MODEL.md` | domínio de pesagem; colunas a promover |
| `WEIGHING-SESSION-MODEL.md` | sessão com enum, bloqueio e snapshot |
| `DAY-CLOSING-MODEL.md` | fechamento por sessão e catálogo de pendências |

### Escopo e decisões de produto
| Documento | Conteúdo |
|---|---|
| `SANITY-ADR-REVIEW.md` | sanidade × ADR-007 |
| `INVENTORY-SCOPE-DECISION.md` | "estoque" = identificadores apenas |
| `DECISION-REGISTER.md` | DEC-001…DEC-022 com opções, recomendação e impacto |
| `CONTRADICTIONS-REGISTER.md` | C-01…C-23 |
| `OVERENGINEERING-GUARDRAILS.md` | regras de corte e lista do que não entra |

### UX e contrato visual
| Documento | Conteúdo |
|---|---|
| `UX-FLOW-AUDIT.md` | telas, fluxos, inventário de ações ocultas |
| `MODELOBASE1-PRODUCT-MAP.md` | aderência por tela; padrão para telas novas |
| `CORRAL-USABILITY-AUDIT.md` | usabilidade no curral e critérios mensuráveis |
| `TARGET-LAUNCH-FLOW.md` | lançamento alvo (Manejo em três campos) |
| `TARGET-SCREEN-MAP.md` | menu e telas alvo |
| `MASTER-REGISTRY-MAP.md` | mapa dos cadastros mestres e comportamentos comuns |
| `TARGET-ENTITY-MAP.md` | entidades ESSENCIAL/ÚTIL/FUTURO/DESNECESSÁRIO |

### Dados e plataforma
| Documento | Conteúdo |
|---|---|
| `DEXIE-V7-TARGET-MODEL.md` | tabela store atual → manter/alterar/substituir; stores novas; migração |
| `APPSETTINGS-AUDIT.md` | chaves classificadas (CONFIGURAÇÃO REAL / CATÁLOGO SIMPLES / DEVERIA VIRAR STORE / LEGADO) |
| `LEGACY-PAYLOAD-AUDIT.md` | inventário de chaves; estratégia congelar/promover |
| `TARGET-PERFORMANCE-RISKS.md` | riscos herdados e novos; orçamentos |
| `BACKUP-V7-IMPACT.md` | backup/restore/importação JSON com v7 |
| `IMPORT-TARGET-MODEL.md` | importação por tipo com assistente e dry-run |
| `REPORTING-DATA-REQUIREMENTS.md` | dados exigidos pelos relatórios do catálogo |

### Execução futura
| Documento | Conteúdo |
|---|---|
| `MASTER-ROADMAP-RECOMMENDATION.md` | M0–M5 com objetivo, escopo, stores, UI, contratos, gates, riscos, dependências, aceite |
| `IMPLEMENTATION-SLICE-PLAN.md` | fatias S-00…S-05 com arquivos, stores, migração, UI, testes, gate, rollback |
| `TARGET-GATE-PLAN.md` | gates existentes que mudam e gates novos |
| `AUDIT-INDEX.md` | este índice e o registro da validação |

## 3. Registro da validação (comandos permitidos pela missão)

Executado em 14/09/2026, ~17:15, após a escrita dos 45 documentos, sem qualquer alteração em `src/`, `electron/`, `package.json`, esquema, CSS ou gates.

| Comando | Resultado | Observação |
|---|---|---|
| `npm.cmd run lint` | **aprovado** (exit 0) | ESLint sem erros |
| `npm.cmd run build` | **aprovado** (exit 0) | Vite: `built in 17.04s` |
| `npm.cmd run test:quick` | **reprovado** (exit 1) | a cadeia `&&` para no primeiro gate vermelho conhecido: `ui:operational-customization:verify` falha em "venda e abate devem abrir cadastro em diálogo" (espera `GerenciarSaidasDialog` no Lançamento). Antes dele passaram: lint, `release:current-only`, `runtime:legacy`, `ui:locale-dialog`. Os gates seguintes não são executados pela cadeia; a execução isolada feita mais cedo em 14/09 (antes desta auditoria) registrou 14 gates verdes e 2 vermelhos (`ui:operational-customization:verify`, `ui:consistency:verify`), ambos introduzidos pela sessão paralela. Nenhum gate ou baseline foi alterado, conforme a regra da missão. |

Observação de rastreabilidade: os últimos arquivos alterados em `src/` datam de 16:04 (correção da pílula de pesquisa, tarefa anterior desta sessão); a escrita da auditoria começou às 16:53. Nenhum arquivo fora de `docs/evidence/auditoria-master-produto-pecuario/` foi criado ou alterado por esta missão.

## 4. Fontes lidas

`docs/arquitetura-produto/` (00–09, F0-01, F0-02, F0-STATUS, F1-STATUS, README), `docs/PORTE-UI-MODELOBASE1.md`, `docs/user/*`, `docs/release/1.1.17/*`, `CHANGELOG.md`, `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md`, `src/pages.config.js`, `src/Layout.jsx`, `src/api/db.js`, `src/storage/**` (schema, db, repositórios, backup, health), `src/modules/**` (weighing, animals, auxiliary, shipments, maintenance, operations, settings, perf), `src/pages/*` (Lançamento, Relação, Fechamento, Ficha, Cadastros Comerciais, Causas de Morte, Sanidade, Manutenção), `src/components/pesagens/*`, `src/components/embarque/*`, `src/components/cadastros/CadastroAuxiliarPage.jsx`, `src/components/mak/*`, `package.json` (scripts), evidências F0/F1 e ModeloBase1.

## 5. Limites desta auditoria

- Não mede tamanho real do `legacy_payload` nem tempo de migração (proposto em M0, sem alterar código).
- Não decide: registra opções e recomendações.
- Não corrige os dois gates vermelhos nem toca baselines.
