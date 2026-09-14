# AUDITORIA MASTER — PESAGENS INDIVIDUAIS (documento consolidado, 14/09/2026)

Conteúdo integral dos 45 documentos de docs/evidence/auditoria-master-produto-pecuario/, na ordem de leitura do AUDIT-INDEX.


---

<!-- AUDIT-INDEX.md -->

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

---

<!-- EXECUTIVE-ASSESSMENT.md -->

# EXECUTIVE-ASSESSMENT — Avaliação executiva

**Auditoria master · 14/09/2026 · Pesagens Individuais 1.1.17 · Electron 35 · React 18 · Dexie v6 (16 stores) · documento de auditoria, sem implementação**

## 1. Veredito

O produto tem um **núcleo confiável** (identidade canônica do animal, eventos de pesagem com cronologia e recálculo por animal, projeções em transação, backup com integridade, Tela Mãe do ModeloBase1 na Relação e nos cadastros). Sobre esse núcleo foram acrescentados, por atalho, os elementos que o responsável agora quer estruturar: marca, raça, era, identificadores, parceiros, compra/venda/abate, apartação, embarque e sessão. Esses elementos existem, mas como **texto livre no evento, popups dentro do lançamento e listas em `appSettings`**. Nada disso impede o uso diário; tudo isso impede cadastros de verdade, relatórios por dimensão e um curral rápido.

Resultado: **APROVADO PARA PLANEJAMENTO.** Há decisões a tomar (22, em `DECISION-REGISTER.md`), mas nenhuma delas bloqueia o desenho; bloqueariam apenas a implementação.

## 2. Estado por área (classificação em `PRODUCT-CAPABILITY-MAP.md`)

| Área | Estado | Nota |
|---|---|---|
| Identidade e histórico do animal | MADURA no núcleo; MAL MODELADA na marca (texto compõe a identidade) | `ANIMAL-IDENTIFICATION-MODEL.md` |
| Cadastros de marca/raça/era/categoria | MAL MODELADA / AINDA NÃO EXISTE | `BRAND/BREED/ANIMAL-CLASSIFICATION` |
| Estoque de identificadores | AINDA NÃO EXISTE (`SequenciaBrincos` é auxiliar de tela) | `IDENTIFIER-INVENTORY-MODEL.md` |
| Lançamento | MADURA na regra; FUNCIONAL MAS IMPROVISADA na tela (2 182 linhas, 6 fluxos, popups, ações ocultas) | `TARGET-LAUNCH-FLOW.md` |
| Compra/venda/abate | PARCIAL: campos por pesagem, parceiro por nome, dois cadastros de comprador | `TARGET-COMMERCIAL-FLOW.md` |
| Embarque | FUNCIONAL MAS IMPROVISADA: status sem regra, dados copiados por animal | `SHIPMENT-FLOW-MODEL.md` |
| Apartação/lotes | FUNCIONAL MAS IMPROVISADA + store `lotes` DUPLICADA | `HERD-LOT-MODEL.md` |
| Sessão/fechamento/ficha | PARCIAL: fechar não bloqueia; telas fora do ModeloBase1; leem a base inteira | `WEIGHING-SESSION`, `DAY-CLOSING`, `ANIMAL-PROFILE` |
| Sanidade | LEGADA, contradiz ADR-007 | `SANITY-ADR-REVIEW.md` |
| Persistência | MADURA (Dexie, backup, integridade); `legacy_payload` e `appSettings` acumulam estrutura | `LEGACY-PAYLOAD-AUDIT.md`, `APPSETTINGS-AUDIT.md` |
| Desempenho | PARCIAL: salvar 76 ms (Node) após F1; abertura da tela ainda reconstrói índice das pesagens; navegador não remedido | `TARGET-PERFORMANCE-RISKS.md` |

## 3. Principais riscos

1. **Marca em texto livre dentro da chave de identidade** (C-06). Um erro de digitação cria outro animal. Migrar para `marca_id` exige dry-run com fusão confirmada.
2. **Sessão sem efeito** (C-05): fechar o dia não impede lançamentos e pode gerar duas sessões por data.
3. **Crescimento do `legacy_payload` e da auditoria** por edição e por cópia de dados de embarque/parceiro.
4. **Trabalho paralelo** na mesma base deixou dois gates vermelhos no `test:quick` (C-17); sem disciplina de dono único, as fatias de modelagem vão colidir.
5. **Migrações**: v6→v7 com backfill em `animais`/`animalIdentificadores`; precisa de backup físico automático antes da abertura na versão nova e de medição em 250 mil.

## 4. Recomendação de sequência

`MASTER-ROADMAP-RECOMMENDATION.md`: M0 decisões → M1 cadastros mestres (v7) → M2 estoque de identificadores → M3 lançamento enxuto → M4 comercial e embarque (v8) → M5 sessão/fechamento/ficha → retomar F2–F5. Cadastros vêm antes de qualquer mudança no lançamento, como pedido.

## 5. Validação executada nesta auditoria (sem alterar código)

| Comando | Resultado |
|---|---|
| `npm.cmd run lint` | ver `AUDIT-INDEX.md` §3 (registro da execução) |
| `npm.cmd run build` | idem |
| `npm.cmd run test:quick` | idem; dois gates vermelhos conhecidos da sessão paralela, não corrigidos por regra desta missão |

## 6. Confirmação de escopo

Nenhum arquivo em `src/`, `electron/`, `package.json`, `package-lock.json`, esquema Dexie, CSS, serviços, adapters, stores ou release foi alterado. Toda a saída desta auditoria está em `docs/evidence/auditoria-master-produto-pecuario/` (45 documentos, índice em `AUDIT-INDEX.md`).

---

<!-- PRODUCT-CAPABILITY-MAP.md -->

# PRODUCT-CAPABILITY-MAP — Mapa de capacidades do Pesagens Individuais

**Auditoria master · 14/09/2026 · aplicação 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Escala de classificação

| Classe | Significado |
|---|---|
| MADURA | Regra, persistência, teste e UI coerentes; pode ser reutilizada sem retrabalho. |
| FUNCIONAL MAS IMPROVISADA | Funciona no dia a dia, mas depende de atalhos (texto livre, popup dentro de outra tela, config em vez de store). |
| PARCIAL | Existe fundação (store, serviço) e falta o fluxo ou a tela. |
| DUPLICADA | Duas implementações para a mesma informação. |
| MAL MODELADA | A forma de guardar o dado contradiz a arquitetura (identidade, evento × cadastro, projeção). |
| LEGADA | Mantida só por compatibilidade; deve ser retirada com migração. |
| AINDA NÃO EXISTE | Prevista na arquitetura, ausente no código. |

## 2. Mapa

| # | Capacidade | Onde vive hoje | Classe | Evidência no código |
|---|---|---|---|---|
| C01 | Identidade canônica do animal (UUID + projeção) | `animais`, `weighingDataAdapter.rebuildAnimalStateProjection` | MADURA | `schema.js` (`animais: &id`), projeção reconstruída a cada evento |
| C02 | Identidade visual número + marca | `animalIdentificadores.tipo='visual_marca'`, `valor_normalizado='NÚMERO::MARCA'` | FUNCIONAL MAS IMPROVISADA | a marca é texto livre dentro da chave de identidade |
| C03 | Identificadores RFID/SISBOV | apenas o índice `[tipo+valor_normalizado]` | PARCIAL | um único tipo é gravado; sem UI |
| C04 | Marca | `legacy_payload.marca`, `animais.marca`, `ComboboxComNovo` | MAL MODELADA | texto livre, sem cadastro, participa da identidade |
| C05 | Raça | `legacy_payload.raca`, `animais.raca`, padrão `'Nelore'` | MAL MODELADA | texto livre com "Adicionar" no combobox |
| C06 | Era / idade | `legacy_payload.era`, `animais.era` | MAL MODELADA | texto livre (`'2A'`, `'14'`), sem data de nascimento |
| C07 | Categoria animal | — | AINDA NÃO EXISTE | prevista em 02 §4.1 (`categoria_id`) |
| C08 | Estoque de identificadores (brincos) | — | AINDA NÃO EXISTE | `SequenciaBrincos.jsx` é apenas um contador de tela |
| C09 | Sequência de brincos no curral | `SequenciaBrincos.jsx` (`window.__sequenciaBrincos`) | FUNCIONAL MAS IMPROVISADA | estado global no `window`, não persiste |
| C10 | Lançamento Manejo (pesagem periódica) | `LancamentoPesagensIndividuais.jsx`, `weighingService.createEntry` | MADURA (regra) / FUNCIONAL MAS IMPROVISADA (tela de 2 182 linhas) | ganho/GMD, cronologia, outliers e sessão automática |
| C11 | Cadastro do animal | evento `tipo_manejo='Cadastro'` dentro do lançamento | MAL MODELADA | cadastro é um evento de pesagem; compra vem junto |
| C12 | Saída (Venda/Abate/Morte/Doação/Transferência/Outros) | evento `tipo_manejo='Saída'` + `motivo_saida` | FUNCIONAL MAS IMPROVISADA | dados comerciais dentro do payload da pesagem |
| C13 | Compra | campos `valor_pago_cabeca`, `origem_animal`, `documentacao` (JSON em string) | PARCIAL | sem entidade, sem status, sem conferência |
| C14 | Venda | campos `comprador` (nome), `destino_venda`, `valor_arroba`, `valor_venda_total`, rendimento | PARCIAL | comprador gravado por nome, não por id |
| C15 | Abate | `frigorifico` (nome), embarque + documento obrigatórios | PARCIAL | mesmo padrão da venda |
| C16 | Perfis de venda/abate (`perfis-saida:<empresa>`) | `GerenciarSaidasDialog.jsx` + `appSettings` | LEGADA e DUPLICADA | o registryService ainda sincroniza compradores para essa chave |
| C17 | Compradores / vendedores / frigoríficos | `registryService` → `appSettings['cadastros-auxiliares:comerciais:<empresa>']` | FUNCIONAL MAS IMPROVISADA | página ModeloBase1 existe; persistência é um único JSON |
| C18 | Causas de morte | `appSettings['cadastros-auxiliares:mortalidade:<empresa>']` | FUNCIONAL MAS IMPROVISADA | referenciada pelo nome em `causa_morte` |
| C19 | Programas sanitários e medicamentos | `ConfiguracoesSanidade.jsx` + `appSettings[...:sanidade:...]` | LEGADA (contradiz ADR-007) | tela ativa no menu com domínio declarado fora de escopo |
| C20 | Apartação e lotes | `apartacoes`, `loteApartacoes`, `GerenciarApartacoesDialog.jsx` | FUNCIONAL MAS IMPROVISADA | cadastro em popup do lançamento; renomear regrava `nome_lote` em todas as pesagens |
| C21 | Store `lotes` | `schema.js` | DUPLICADA | sem uso na UI; só `health.js` a lê |
| C22 | Permanência em lote (`animalLotes`) e movimentos | adapter | MADURA | projeção reconstruída em transação |
| C23 | Regra automática de lote | `getLoteAutomatico` na tela | PARCIAL | faixa de peso + capacidade contando pesagens (O(N)) |
| C24 | Embarque e documentos | `embarques`, `documentosEmbarque`, `GerenciarEmbarquesDialog.jsx` | FUNCIONAL MAS IMPROVISADA | status livre; dados copiados para o payload da pesagem |
| C25 | Sessão de pesagem | `sessoesPesagem` (auto por data) | PARCIAL | só `Aberta`/`Fechada`; sem operador real, sem snapshot |
| C26 | Fechamento do dia | `FechamentoDia.jsx`, `operationalInsightsService` | PARCIAL | pendências calculadas na tela; justificativas na sessão; lê a base inteira |
| C27 | Ficha do animal | `FichaAnimal.jsx` | PARCIAL | reconstrói perfis a partir de todas as pesagens; ignora `movimentosAnimais` |
| C28 | Relação de pesagens (Tela Mãe) | `PesagensIndividuais.jsx` | MADURA (UI) | painel de filtros, pesquisa, colunas, ModeloBase1 |
| C29 | Importação CSV | `PesagensIndividuais.jsx` + `bulkCreateEntries` | FUNCIONAL MAS IMPROVISADA | idempotente por hash; um único tipo para o arquivo inteiro; lote vinculado por nome |
| C30 | Importação JSON / Restauração / Backup | `backupService.js`, `maintenanceDataAdapter.js` | MADURA | SHA-256, pré-backup físico, dry-run |
| C31 | Integridade lógica | `health.js` | MADURA | referências, identificadores duplicados, datas |
| C32 | Auditoria | `auditoria` | PARCIAL | gravada; sem consulta; guarda `antes`/`depois` completos |
| C33 | Empresa / fazenda / curral | `localStorage.empresa_selecionada_id = 'local'` | AINDA NÃO EXISTE | `empresa_id` fixo |
| C34 | Resumos personalizados | `appSettings['resumo-personalizado:<empresa>']` | FUNCIONAL | configuração real de usuário |
| C35 | Desempenho em 36 mil / 250 mil | F1 parcial | PARCIAL | salvar 76 ms (Node); índice de animais ainda reconstruído na tela |
| C36 | Balança / RFID | — | AINDA NÃO EXISTE | P-001/P-002 pendentes |

## 3. Leitura executiva do mapa

- **Núcleo confiável:** C01, C10, C22, C28, C30, C31. É sobre ele que os cadastros devem ser construídos.
- **Maior dívida de modelagem:** C04–C08 (marca, raça, era, categoria, estoque de identificadores). São informações estruturais guardadas como texto no evento, e a marca ainda compõe a identidade.
- **Maior dívida de fluxo:** C11–C16 e C20/C24. Cadastro, compra, venda, abate, apartação e embarque acontecem dentro do lançamento, em popups ou colunas do payload.
- **Contradição aberta:** C19 (sanidade) contra ADR-007.
- **Duplicações a encerrar:** C16 × C17 (dois lugares para compradores), C21 × C20 (`lotes` × `loteApartacoes`).

## 4. Dependências entre capacidades

```text
C04 Marca ──┐
C05 Raça ───┼──► C11 Cadastro do animal ──► C10 Manejo ──► C12 Saída ──► C24 Embarque
C07 Categoria┘          ▲                                        ▲
C08 Estoque de ids ─────┘ (número do brinco vem do estoque)      │
C17 Parceiros ───────────────────────────────────────────────────┘ (comprador/frigorífico/vendedor)
C20 Apartação/lotes ──► C23 regra de lote ──► C26 Fechamento
```

Consequência prática: marcas, raças, categorias, parceiros e estoque de identificadores precisam existir **antes** de simplificar o lançamento. A ordem está em `MASTER-ROADMAP-RECOMMENDATION.md`.

---

<!-- DECISION-REGISTER.md -->

# DECISION-REGISTER — Decisões que o responsável precisa tomar

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

Nenhuma decisão abaixo foi tomada nesta auditoria. A coluna "Recomendação" é proposta técnica; a decisão é do responsável. Decisões P-001…P-008 do pacote de arquitetura continuam válidas e são referenciadas quando dependem.

| ID | Decisão | Opções | Recomendação | Impacto se adiar |
|---|---|---|---|---|
| DEC-001 | Onde persistir cadastros mestres (marca, raça, categoria, parceiro, causa, faixas) | (a) stores Dexie v7; (b) continuar em `appSettings` | **(a)** — têm id, histórico, vínculo, contagem e unicidade | cada cadastro novo em `appSettings` aumenta a migração futura e mantém vínculo por nome |
| DEC-002 | Estratégia do estoque de identificadores | (A) item a item; (B) faixas + exceções | **(B)** (`IDENTIFIER-INVENTORY-MODEL.md` §3) | sem estoque, a sequência de brincos continua a depender da lista de pesagens |
| DEC-003 | Identidade visual | (a) número + marca (marca por id); (b) número único por empresa | **(a)** — dados atuais dependem disso | (b) obrigaria renumerar animais existentes |
| DEC-004 | Migração de marca/raça em texto livre | (a) dry-run com fusão confirmada por grupo normalizado; (b) fusão automática | **(a)** para marca (identidade); (b) aceitável para raça | sem migração, telas novas convivem com texto e id |
| DEC-005 | Unicidade de identificador | (a) VISUAL única por marca; RFID/SISBOV únicos globais, verificados no serviço; (b) manter verificação só no diagnóstico | **(a)** | duplicidades silenciosas continuam possíveis |
| DEC-006 | Sanidade | (A) cumprir ADR-007 e remover tela/chave; (B) ADR-018 módulo mínimo; (C) manter como está | **(A)** (`SANITY-ADR-REVIEW.md`) | contradição permanente; dado estrutural em configuração |
| DEC-007 | Store `lotes` | (a) remover em v7; (b) migrar `loteApartacoes` para `lotes` | **(a)** | store morta no backup e nos gates |
| DEC-008 | Cadastros comerciais | (a) `parceiros` com papéis; (b) três stores separadas | **(a)** | duplicidade de pessoas |
| DEC-009 | Operação comercial | (a) entidade `operacoesComerciais` (v8); (b) manter campos por pesagem | **(a)**, após os cadastros mestres | relatórios comerciais permanecem inviáveis; valores repetidos por animal |
| DEC-010 | Embarque | (a) máquina de estados no serviço + parceiro por id; (b) status livre | **(a)** (v8) | embarque concluído continua aceitando saídas |
| DEC-011 | `legacy_payload` | (a) congelar + promover colunas + lista permitida; (b) deixar crescer | **(a)** | tamanho de banco/backup cresce com edições |
| DEC-012 | Era/idade/categoria | (a) nascimento estimado + categoria sugerida; (b) categoria informada, sem idade | **(a)**; (b) é aceitável se o responsável não usar idade | (b) fecha relatórios por idade |
| DEC-013 | Propriedade | (a) store mínima na v7; (b) adiar para F7 (P-003) | **(a)** se compra/transferência forem usadas em breve; senão (b) | origem/destino continuam texto |
| DEC-014 | Sessão | (a) manter automática por data com enum/snapshot/bloqueio (v7); (b) esperar F2 completa | **(a)** | fechamento continua sem efeito sobre novos lançamentos |
| DEC-015 | Regra de numeração de identificadores | (a) prefixo + número + padding por faixa; (b) livre | **(a)** (`SequenciaBrincos` já usa esse formato) | — |
| DEC-016 | `GerenciarSaidasDialog` / `perfis-saida` | (a) remover após migrar compradores; (b) manter | **(a)** | duplicidade e sincronismo legado |
| DEC-017 | Escopo de "estoque" | (a) só identificadores; (b) insumos genéricos | **(a)** (`INVENTORY-SCOPE-DECISION.md`) | (b) abre WMS |
| DEC-018 | `clearAllData` com cadastros em stores | (a) "limpar dados" preserva cadastros mestres; (b) apaga tudo exceto configuração | **(a)** com opção explícita "apagar também cadastros" | usuário perde marcas/raças ao limpar |
| DEC-019 | Documento obrigatório na venda | (a) configuração `exigir_documento_venda` (padrão falso); (b) sempre obrigatório; (c) nunca | **(a)** | regra divergente entre Lançamento e Fechamento persiste |
| DEC-020 | Corte das migrações | (a) v7 cadastros + identificadores; v8 comercial + embarque; (b) tudo em v7 | **(a)** | migração grande, difícil de validar |
| DEC-021 | Ordem entre cadastros e correção da F1 pendente (índice de animais na tela) | (a) cadastros primeiro, com a leitura por `animalIdentificadores` entrando junto; (b) concluir F1 antes | **(a)** — o índice por identificador é parte natural do slice de identificação | (b) adia os cadastros sem ganho |
| DEC-022 | Rendimento de carcaça | (a) por operação com origem (`informado`/`padrao` da empresa ou do parceiro); (b) 50 % fixo | **(a)** (resolve D4) | @ estimada continua sem rastreio |

## Como registrar a decisão

Para cada DEC aceita: nova ADR em `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` (ADR-018 em diante), com contexto, opção escolhida, migração, rollback e testes (processo definido em 08). Sem ADR, o plano de slices não deve começar.

---

<!-- CONTRADICTIONS-REGISTER.md -->

# CONTRADICTIONS-REGISTER — Contradições entre arquitetura, código e documentação

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

| ID | Contradição | Lado A | Lado B | Gravidade | Resolução proposta |
|---|---|---|---|---|---|
| C-01 | Sanidade | ADR-007 e 00 §4.10: fora de escopo; v6 removeu stores | `ConfiguracoesSanidade.jsx` no menu; `registryService` grupo `sanidade` em `appSettings` | Alta | DEC-006: cumprir ADR-007 (`SANITY-ADR-REVIEW.md`) |
| C-02 | Store `lotes` | 02 §8 "nenhuma store é removida sem decisão"; F0-01 §10 pede ADR antes da F2 | store existe sem uso; UI usa `loteApartacoes` | Média | DEC-007: ADR + remoção em v7 |
| C-03 | Compradores em dois lugares | `CadastrosComerciais` (registry) é o cadastro atual | `GerenciarSaidasDialog` (`perfis-saida`) continua ativo e sincronizado | Média | DEC-016: remover legado após migrar |
| C-04 | Documento obrigatório na venda | `FechamentoDia`: venda sem embarque/documento é pendência **crítica** | Lançamento: documento obrigatório só no abate | Média | DEC-019: configuração única aplicada no serviço |
| C-05 | Sessão fechada | `FechamentoDia` grava `Fechada` | `createEntry` cria **outra** sessão `Aberta` na mesma data e aceita o lançamento | Alta | DEC-014: bloqueio no serviço; uma sessão por data+local |
| C-06 | Identidade depende de texto | ADR-004 / 00 §4.3: identidade não depende de texto exibido | marca (texto livre) compõe `valor_normalizado` do identificador | Alta | `marca_id` na chave (M1/M2) |
| C-07 | Cadastro × evento | 00 §4.2: evento histórico não é cadastro | Cadastro do animal é um evento de pesagem com peso obrigatório; compra dentro dele | Alta | `ANIMAL-REGISTRATION-FLOW.md` |
| C-08 | Rendimento explícito | ADR-012 / 02 §4.8: valor informado ≠ calculado; rendimento explícito | `FichaAnimal` e `FechamentoDia` usam 50 % fixo para "@ carcaça"; D4 fallback silencioso | Média | DEC-022 |
| C-09 | Peso obrigatório por motivo | regra única desejada (02 §4.4) | três cópias da lista `['Morte','Doação','Transferência']` (mapper, tela, health) | Baixa | `weightRequiredFor` no domínio (M3) |
| C-10 | Duplicidade no dia | 02 §4.4: política no domínio | só na tela (D6) | Média | M3 |
| C-11 | `exige_observacao` da causa de morte | cadastrado com o campo | nenhuma validação lê o campo | Baixa | serviço valida (M1) |
| C-12 | Ocupação de lote | 02 §4.6: permanência é a fonte | `isLoteCheio` e `FechamentoDia` contam pesagens | Média | `animalLotes` (M3) |
| C-13 | Renomear apartação/lote | 00 §4.2: alterar cadastro não reescreve o fato | `propagateApartacaoRename` reescreve `nome_apartacao`/`nome_lote` em todas as pesagens com auditoria | Média | parar de propagar; junção por id (M3) |
| C-14 | Contrato visual | ADR-016: toda tela no ModeloBase1 | `FechamentoDia`, `FichaAnimal` em `op-screen`; cadastros em popups shadcn | Média | M5 / M3 |
| C-15 | Configuração × cadastro | 03 §1: entidades com histórico/vínculo têm cadastro próprio | parceiros, causas, sanidade em `appSettings` | Alta | DEC-001 |
| C-16 | `legacy_payload` como fonte de regra | F0-01 §1: promover campos quando houver consulta/regra | adapter lê `tipo_manejo`, `motivo_saida`, `apartacao_id`, `operador` do payload; `updateEntry` copia `_localId`/`peso_kg` para dentro | Média | DEC-011 |
| C-17 | Gate vermelho | 07 §13: lint/build/testes aprovados para entrega | dois gates de `test:quick` vermelhos desde 14/09 (sessão paralela) | Alta (processo) | resolver antes de M0 terminar; regra de dono único |
| C-18 | Documentação do usuário | `TESTE-MAQUINA-LIMPA.md` cita versão **1.1.16** | `package.json` e notas em 1.1.17 | Baixa | atualizar na próxima release |
| C-19 | Release checklist | "Suíte integral executada" não marcado; assinatura pendente | `RELEASE-NOTES.md` chama build de diagnóstico | Informativa | manter transparência; não é bloqueio da modelagem |
| C-20 | Auditoria append-only e leve | 06 §10: append-only, mascarável | `antes/depois` completos, inclusive payload, para toda edição coletiva | Baixa | `resumo` de campos (M5) |
| C-21 | Estoque de brincos | pedido do responsável: "cadastro de estoque de identificadores" | `SequenciaBrincos` é auxiliar de tela com `window` global | Média | M2 |
| C-22 | `situacao` do animal | 02 §4.1: ativo, vendido, abatido, transferido, morto, cancelado | só `Ativo`/`Inativo` | Baixa | derivar de `motivo_saida` (M1) |
| C-23 | Era | 03 §3.1: nascimento conhecido ou estimado; categoria | texto livre sem cálculo | Média | DEC-012 |

## Leitura

As contradições de gravidade Alta (C-01, C-05, C-06, C-07, C-15, C-17) são exatamente as que a orientação final do responsável já apontou: cadastros antes do lançamento, identidade permanente, nada estrutural em `appSettings`, sessão com efeito real, e disciplina de gates. Todas têm decisão proposta em `DECISION-REGISTER.md` e fatia em `IMPLEMENTATION-SLICE-PLAN.md`.

---

<!-- ANIMAL-LIFECYCLE-TARGET.md -->

# ANIMAL-LIFECYCLE-TARGET — Ciclo de vida alvo do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Ciclo de vida hoje (como o código se comporta)

```text
[evento Cadastro] ──► animais.situacao='Ativo' ──► [n eventos Manejo] ──► [evento Saída] ──► situacao='Inativo'
       │                                                                        │
       └─ cria animais + animalIdentificadores(visual_marca)                     └─ data_saida, motivo_saida
```

Regras vigentes (`weighingDataAdapter.validateAnimalChronology`):

- um único Cadastro por `animal_id`;
- nenhum evento antes da data do Cadastro;
- nenhum evento em data ≥ Saída;
- Saída retroativa recusada se houver eventos posteriores;
- Saída sem peso permitida só para Morte, Doação e Transferência.

Limitações:

| Item | Hoje | Problema |
|---|---|---|
| Situação | `Ativo` / `Inativo` | não distingue vendido, abatido, morto, doado, transferido |
| Nascimento do animal | não existe | "era" é texto livre; idade não é calculável |
| Entrada por compra | campos dentro do Cadastro | não há fato "compra" separado |
| Entrada por nascimento/transferência recebida | não existe | só Cadastro genérico |
| Reversão de saída | não existe | cancelar a pesagem de saída é o único caminho (recompõe projeção) |
| Animal sem identificação (`SN`) | perfil herdado do último SN | cria animal novo com UUID a cada SN |

## 2. Ciclo de vida alvo

### 2.1 Estados

| Estado | Como entra | Como sai | Observação |
|---|---|---|---|
| `ATIVO` | Cadastro (nascimento, compra, transferência recebida, legado) | qualquer saída | único estado que aceita Manejo |
| `VENDIDO` | Saída · Venda | reversão auditada | ligado a operação comercial |
| `ABATIDO` | Saída · Abate | reversão auditada | ligado a embarque e documento |
| `MORTO` | Saída · Morte | reversão auditada | exige causa de morte do cadastro |
| `DOADO` | Saída · Doação | reversão auditada | |
| `TRANSFERIDO` | Saída · Transferência | reversão auditada | destino: outra propriedade |
| `CANCELADO` | cancelamento do Cadastro sem histórico | — | exclusão lógica |

Regra: `situacao` continua sendo **projeção** reconstruída dos eventos (ADR-006). A única mudança é derivar o estado do `motivo_saida` em vez de gravar `Inativo`.

### 2.2 Eventos

```text
CADASTRO (origem: nascimento | compra | transferência recebida | legado/importação)
   └─ opcional: vínculo a Operação de Compra
MANEJO (pesagem periódica; única fonte de ganho/GMD)
MUDANÇA DE LOTE (já derivada hoje em movimentosAnimais)
SAÍDA (Venda | Abate | Morte | Doação | Transferência | Outros)
   └─ Venda/Abate: vínculo a Operação Comercial e a Embarque
REVERSÃO DE SAÍDA (novo; exige motivo; reabre ATIVO; auditoria)
```

### 2.3 Invariantes que devem continuar valendo

1. Cadastro precede tudo; um Cadastro por animal.
2. Nenhum evento após a saída, salvo reversão explícita.
3. Cadastro atual (marca, raça, categoria) muda sem reescrever o snapshot do evento.
4. O `animal_id` nunca muda; identificadores podem ser trocados com validade temporal.

## 3. O que muda no lançamento

| Passo | Hoje | Alvo |
|---|---|---|
| Criar animal | selecionar "Cadastro" no lançamento e preencher sexo/raça/era/marca + compra | tela de cadastro (ou cadastro rápido mínimo) **antes** de pesar; o lançamento apenas seleciona |
| Pesar | digitar número, sistema resolve por número+marca | igual, mas a marca vem do cadastro (não é digitada a cada animal) |
| Sair | escolher motivo e preencher comprador/frigorífico por nome | escolher motivo; parceiro e embarque são selecionados de cadastros |

## 4. Impacto em dados existentes

- Registros com `situacao='Inativo'` podem ser reprojetados a partir de `motivo_saida` sem perda (a projeção é reconstruível).
- Animais criados por `SN` continuam válidos; passam a exigir categoria/raça do cadastro.
- Nenhuma pesagem precisa ser reescrita; o snapshot histórico (`sexo`, `raca`, `era`, `marca` no evento) permanece como está.

## 5. Decisões que dependem do responsável

- DEC-012 (`DECISION-REGISTER.md`): substituir "era" por data de nascimento estimada + categoria calculada, ou manter "era" como categoria informada.
- DEC-003: manter número + marca como identidade visual (recomendado) ou tornar o número único por propriedade.

---

<!-- ANIMAL-IDENTIFICATION-MODEL.md -->

# ANIMAL-IDENTIFICATION-MODEL — Modelo de identificação do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Como a identificação funciona hoje

| Camada | Implementação | Arquivo |
|---|---|---|
| Identidade canônica | `animal_id` UUID em `animais.&id` | `schema.js`, `weighingDataAdapter.createEntry` |
| Identidade visual | `numero_animal` + `marca`, normalizados em maiúsculas → `NÚMERO::MARCA` | `animalHistory.legacyAnimalKey`, `animalIdentificadores.valor_normalizado` |
| Registro do identificador | uma linha `tipo='visual_marca'`, `principal=true`, `ativo=true` criada no Cadastro | `createEntry` / `bulkCreateEntries` |
| Resolução na tela | índice em memória por número (`buildAnimalLookupIndex`) construído de **todas** as pesagens; conflito de marcas abre `SelecionarAnimalDialog` | `LancamentoPesagensIndividuais.jsx`, `animalLookup.jsx` |
| Compatibilidade legada | pesagens sem `animal_id` casam por `legacy:NÚMERO::MARCA` | `weighingSeries.identity` |
| `SN` (sem número) | qualquer valor `SN`/`SN 12` cria animal novo, herdando sexo/raça/era/marca do último SN | `snAnimal.js`, `ConfirmarAnimalSnDialog.jsx` |
| Unicidade | índice `[tipo+valor_normalizado]` **não é único**; a duplicidade só aparece em `health.logicalIntegrity` | `schema.js`, `health.js` |

Pontos fortes a preservar: UUID estável; desambiguação explícita ao concluir a identificação; snapshot do número/marca gravado no evento.

Problemas:

1. A **marca é texto livre e faz parte da chave**. `ABC`, `abc ` e `A B C` viram identidades diferentes ou iguais conforme o `trim/upper`, sem cadastro que valide.
2. O identificador não tem **validade temporal** (`inicio`/`fim`), então troca de brinco não é representável.
3. Não há tipo para RFID/EID, SISBOV ou número de manejo.
4. O índice de animais é reconstruído da lista de pesagens a cada recarga (custo medido em F0: 2,0 s em 36 mil, D8).
5. `SN` gera um UUID por lançamento; não existe forma de depois "batizar" o animal com um brinco.

## 2. Modelo alvo

### 2.1 Entidades

```text
animais (cadastro/projeção)        1 ──── N   animalIdentificadores (identificadores com validade)
   id (UUID)                                      id (UUID)
   marca_id ─► marcas                             animal_id
   raca_id ─► racas                               tipo: VISUAL | RFID | SISBOV | MANEJO | TEMPORARIO | LEGADO
   categoria_id ─► categoriasAnimal               valor, valor_normalizado
   ...                                            marca_id (só para VISUAL; substitui o texto da chave)
                                                  faixa_id ─► faixasIdentificadores (opcional; origem no estoque)
                                                  principal, ativo, inicio, fim, motivo_troca
```

### 2.2 Regras de unicidade

| Tipo | Chave única enquanto ativo | Observação |
|---|---|---|
| VISUAL | `(marca_id, valor_normalizado)` | mesmo número em marcas diferentes continua permitido (DEC-003) |
| RFID | `valor_normalizado` global | nunca em dois animais ao mesmo tempo |
| SISBOV | `valor_normalizado` global; não reutilizável | ADR-004, 02 §4.2 |
| MANEJO | `valor_normalizado` por propriedade | |
| TEMPORARIO | `valor_normalizado` global | usado para `SN`; deve ser trocado |

A unicidade deve ser garantida **no serviço** (verificação em transação antes do `add`), não só no `health.js`. Dexie não oferece índice único composto condicional a `ativo`, então a verificação é aplicativa.

### 2.3 Normalização

- VISUAL: `trim`, maiúsculas, remover espaços internos duplicados; **não** remover zeros à esquerda (o operador escreve `0071` e `71` como coisas distintas se assim cadastrou; a faixa do estoque define o padding).
- RFID: só dígitos; 15 dígitos ISO quando aplicável.
- Marca: resolvida por `marca_id`; o texto histórico do evento não é normalizado retroativamente.

### 2.4 Resolução no curral (alvo)

1. Operador digita/lê o valor.
2. Serviço consulta `animalIdentificadores` por `valor_normalizado` (índice), **não** o histórico de pesagens.
3. Um resultado ativo → animal resolvido. Vários (marcas diferentes) → `SelecionarAnimalDialog` ao sair do campo, como hoje.
4. Nenhum → cadastro rápido (mínimo: marca, sexo, raça, categoria) ou pendência; nunca criar animal implícito no Manejo.

## 3. Migração dos dados atuais (v6 → v7)

| Dado v6 | Ação |
|---|---|
| `animalIdentificadores.tipo='visual_marca'` | reclassificar como `VISUAL`; preencher `marca_id` a partir do texto `marca` (após cadastro de marcas); `inicio` = `created_at` |
| `animais.marca/raca/era` (texto) | preencher `marca_id/raca_id/categoria_id` por correspondência normalizada; manter o texto como coluna legada até a próxima versão |
| pesagens sem `animal_id` (legado) | manter compatibilidade `legacy:` no cálculo de série; relatório de qualidade lista quantas existem |
| animais `SN` | identificador `TEMPORARIO` com o valor `SN…`; podem receber VISUAL depois |

## 4. Rastreabilidade do identificador

Todo identificador deve responder: de onde veio (faixa do estoque ou avulso), quando começou, quando terminou e por quê. Esse é o vínculo com `IDENTIFIER-INVENTORY-MODEL.md`.

## 5. Riscos

- Migrar a marca para `marca_id` sem antes deduplicar os textos pode fundir animais distintos. A migração deve ser **em dry-run com relatório** (`IMPORT-TARGET-MODEL.md` §5).
- A regra de unicidade VISUAL por marca precisa ser confirmada em DEC-003 antes de qualquer índice.

---

<!-- BRAND-REGISTRY-MODEL.md -->

# BRAND-REGISTRY-MODEL — Cadastro de marcas

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Aspecto | Hoje |
|---|---|
| Origem dos valores | `marcasExistentes = [...new Set(pesagens.map(p => p.marca))]` na tela de lançamento |
| Entrada | `ComboboxComNovo` com opção "Adicionar «texto»" |
| Persistência | `legacy_payload.marca` (evento), `animais.marca` (projeção), `animalIdentificadores.marca` |
| Papel na identidade | compõe `NÚMERO::MARCA`; obrigatória no Cadastro (exceto `SN`) |
| Validação | apenas `trim()`; sem lista fechada, sem inativação, sem dono |
| Uso em relatórios | `FechamentoDia` agrupa por `row.marca || 'Sem marca'` |

Consequências: uma marca digitada errada cria um animal "novo" que nunca casa com o histórico; não é possível inativar marcas; não há proprietário/propriedade da marca; nada impede `ABC` e `A.B.C`.

## 2. Modelo alvo

### 2.1 Store `marcas` (Dexie v7)

| Campo | Tipo | Regra |
|---|---|---|
| `id` | UUID | chave de domínio |
| `empresa_id` | string | `'local'` até F7 |
| `nome` | string | obrigatório; único por empresa após normalização (`trim`, maiúsculas, espaços internos únicos) |
| `nome_normalizado` | string | índice; usado na migração e na importação |
| `abreviacao` | string | opcional, ≤ 6 caracteres; aparece nas grades |
| `proprietario_parceiro_id` | UUID | opcional; parceiro com papel `PROPRIETARIO` (`COMMERCIAL-REGISTRY-MODEL.md`) |
| `propriedade_id` | UUID | opcional; ver `PROPERTY-FARM-MODEL.md` |
| `padrao` | boolean | uma por empresa; pré-selecionada no cadastro rápido |
| `ativo` | boolean | inativa não aparece em seleções; histórico preservado |
| `observacao` | string | |
| `created_at/updated_at/deleted_at` | ISO | padrão do repositório genérico |

Índices: `++localId, &id, empresa_id, nome_normalizado, ativo`.

### 2.2 Regras

1. Marca **não é apagada fisicamente** se houver animal ou pesagem que a use; só inativa.
2. Renomear marca **não** reescreve o snapshot `marca` dos eventos; a grade mostra o nome atual via `marca_id` e mantém o texto histórico disponível.
3. Uma marca `padrao` reduz digitação no curral; o operador só troca quando o animal for de outra marca.
4. Importação CSV resolve `Marca` por `nome_normalizado`; valor desconhecido gera erro por linha, ou cadastro sob confirmação (`IMPORT-TARGET-MODEL.md`).

### 2.3 Tela (ModeloBase1)

Lista com colunas Nome, Abreviação, Proprietário, Situação, Animais ativos (contagem por projeção); painel de filtros; ficha com os campos acima. Mesma composição de `CadastroAuxiliarPage` já portada, mas com persistência em store (não em `appSettings`).

## 3. Migração dos valores livres

| Passo | Ação | Saída |
|---|---|---|
| 1 | Coletar valores distintos de `animais.marca`, `animalIdentificadores.marca`, `pesagens.legacy_payload.marca` | lista com contagem por valor bruto |
| 2 | Agrupar por `nome_normalizado` | candidatos a fusão (`ABC` + `abc`) |
| 3 | Dry-run: apresentar grupos e pedir confirmação quando dois textos normalizarem igual | relatório em `docs/evidence` |
| 4 | Criar `marcas` a partir dos grupos confirmados; preencher `marca_id` em `animais` e `animalIdentificadores` | tabela de correspondência |
| 5 | Não tocar `legacy_payload.marca` | snapshot preservado |

Risco: a fusão de duas grafias pode unir dois animais com o mesmo número. O dry-run deve listar colisões `NÚMERO::MARCA_ID` resultantes e bloquear a migração até decisão.

## 4. O que não fazer

- Não guardar a lista de marcas em `appSettings`: ela tem histórico, vínculo e contagem.
- Não criar hierarquia de marcas, logotipo, registro no INPI ou desenho da marca a ferro: fora do escopo do produto.

---

<!-- BREED-REGISTRY-MODEL.md -->

# BREED-REGISTRY-MODEL — Cadastro de raças

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

- Valor padrão `'Nelore'` fixado em três lugares (`useState('Nelore')`, `criarConfiguracaoPadraoMovimentacao`, `snAnimal.findLatestSnProfile`).
- Lista de opções derivada de `pesagens.map(p => p.raca)`; qualquer texto pode ser adicionado no `ComboboxComNovo`.
- Gravado em `legacy_payload.raca` e `animais.raca`; importado do CSV pela coluna `Raça`/`Raca`.
- Não participa da identidade; usado como descrição na `SelecionarAnimalDialog`, `FichaAnimal` e resumos.
- Não há "Anelorado", "Cruzado", composição racial nem grupo genético, e o produto **não precisa** deles agora.

## 2. Modelo alvo

### 2.1 Store `racas` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `nome` | obrigatório; único por empresa após normalização |
| `nome_normalizado` | índice |
| `abreviacao` | opcional |
| `grupo` | opcional, lista curta: `ZEBUINO`, `TAURINO`, `CRUZADO`, `OUTRO` (apenas para agrupar relatórios) |
| `padrao` | uma por empresa (substitui o `'Nelore'` fixo no código) |
| `ativo` | boolean |
| `ordem` | inteiro; ordem de exibição na seleção |
| timestamps | padrão |

Índices: `++localId, &id, empresa_id, nome_normalizado, ativo`.

### 2.2 Regras

1. Raça padrão é configuração da empresa, não constante de código.
2. Inativar não apaga; animais existentes continuam a exibir a raça.
3. Renomear não altera o snapshot `raca` dos eventos.
4. O cadastro rápido no curral pré-seleciona a raça padrão e permite trocar por teclado.

### 2.3 Sementes iniciais

Ao criar a store na migração v7, semear apenas as raças encontradas nos dados existentes mais a padrão `Nelore` se ausente. Não carregar catálogo nacional completo: cadastro pequeno é mais rápido no curral.

## 3. Migração

Mesmo procedimento da marca (`BRAND-REGISTRY-MODEL.md` §3), sem risco de identidade: raça não participa da chave. Colisões de grafia (`Nelore` × `NELORE` × `nelore `) fundem automaticamente pelo `nome_normalizado`.

## 4. Fora de escopo

Genealogia, composição racial percentual, registro em associação de criadores e características fenotípicas.

---

<!-- ANIMAL-CLASSIFICATION-MODEL.md -->

# ANIMAL-CLASSIFICATION-MODEL — Sexo, era/idade e categoria

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Atributo | Hoje | Problema |
|---|---|---|
| Sexo | `M`/`F` fixos no `Select`; gravado no evento e na projeção | adequado; manter |
| Era | texto livre (`'14'`, `'2A'`, `''`); `erasExistentes` deriva das pesagens; `ComboboxComNovo` | não é comparável nem calculável; a "era" do Cadastro nunca envelhece |
| Categoria (bezerro, garrote, novilha, boi, vaca, touro) | não existe | relatórios e apartação não conseguem agrupar por categoria |
| Data de nascimento | não existe | idade real não é conhecida |

A "era" hoje mistura dois conceitos: idade aproximada em meses (`14`) e classificação por dentição (`2A` = duas dentes... na prática usada como faixa). Nenhum cálculo a utiliza.

## 2. Modelo alvo (mínimo)

### 2.1 Store `categoriasAnimal` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `nome` | obrigatório, único normalizado (`Bezerro`, `Garrote`, `Novilha`, `Boi`, `Vaca`, `Touro`, …) |
| `sexo_aplicavel` | `M`, `F` ou `AMBOS` |
| `idade_min_meses` / `idade_max_meses` | opcionais; permitem sugerir categoria pela idade |
| `ordem`, `ativo`, timestamps | padrão |

Sementes: as seis categorias usuais do produto brasileiro. O responsável pode editar.

### 2.2 Campos no animal

| Campo | Regra |
|---|---|
| `sexo` | mantém `M`/`F` |
| `categoria_id` | obrigatório no cadastro alvo; sugerido por sexo + idade quando houver nascimento |
| `nascimento` | data civil opcional |
| `nascimento_estimado` | boolean; verdadeiro quando derivado da "era" |
| `era` (legado) | mantido como texto até a migração concluir; depois vira campo somente-leitura |

Regra de sugestão (explicável, ADR-010): `idade_meses = meses(hoje − nascimento)` → primeira categoria com `sexo_aplicavel` compatível e faixa que contém a idade. A sugestão nunca sobrescreve uma categoria informada; a origem (`informada`/`sugerida`) fica visível.

### 2.3 Snapshot no evento

O evento de pesagem continua gravando `sexo` e passa a gravar `categoria_id` + `categoria_nome` no momento do fato. Isso permite "peso médio dos garrotes em agosto" mesmo que o animal depois vire boi.

## 3. Migração da "era"

| Valor encontrado | Interpretação | Ação |
|---|---|---|
| inteiro `n` (ex.: `14`) | idade em meses na data do Cadastro | `nascimento = data_cadastro − n meses`, `nascimento_estimado = true` |
| `nA`/`nD` (dentição) | faixa etária | mapear para faixa de meses configurável; `nascimento_estimado = true` |
| vazio ou outro texto | desconhecido | `categoria_id` fica nulo; relatório de qualidade lista o animal |

A categoria inicial é sugerida por sexo + idade estimada e marcada como `sugerida`. Nenhum evento é reescrito.

## 4. Decisão necessária

DEC-012 em `DECISION-REGISTER.md`: (a) adotar nascimento estimado + categoria calculada (recomendado); (b) manter "era" como categoria informada, sem idade. A opção (b) é mais simples, mas deixa relatórios por idade fora do alcance.

## 5. Fora de escopo

Pelagem, escore corporal, genealogia, estágio reprodutivo.

---

<!-- IDENTIFIER-INVENTORY-MODEL.md -->

# IDENTIFIER-INVENTORY-MODEL — Estoque de identificadores (brincos e afins)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que existe hoje

`src/components/pesagens/SequenciaBrincos.jsx` é um **auxiliar de digitação**, não um estoque:

- recebe brinco inicial/final e direção, extrai `prefixo + número` (`/^([A-Za-z]*)(\d+)$/`) e mantém o padding de dígitos;
- pula números já usados (conjunto `numerosUsados`, derivado das pesagens da **marca atual**);
- expõe `window.__sequenciaBrincos.avancar()` para o lançamento avançar após salvar;
- estado vive em `useState`/`useRef`; ao trocar de tela, some.

Não existe: registro de compra de brincos, quantidade disponível, faixa reservada, brinco perdido/danificado, brinco RFID pareado, relatório de saldo. **`SequenciaBrincos` não é estoque** e não deve ser transformado em um por acréscimo de campos.

## 2. Objetivo do estoque

1. Saber quantos identificadores de cada tipo/marca/faixa estão disponíveis.
2. Garantir que um número saído do estoque seja usado uma única vez.
3. Rastrear onde cada número foi parar (animal, perda, descarte).
4. Alimentar a sequência do curral com o **próximo número livre real**, não com a lista de pesagens.

## 3. Estratégias avaliadas

| Critério | Estratégia A — item a item | Estratégia B — faixas + exceções |
|---|---|---|
| Representação | uma linha por brinco (`itensIdentificador`) | uma linha por faixa (`faixasIdentificadores`: prefixo, início, fim, padding) + linhas só para exceções (usado fora de ordem, perdido, danificado, reservado) |
| Volume em 250 mil animais | ≥ 250 mil linhas só de estoque; dobra o backup | dezenas/centenas de faixas + exceções |
| Custo de "próximo livre" | consulta indexada por faixa/status (rápida, mas exige linha por item) | cursor da faixa (`proximo`) + conjunto de exceções da faixa |
| Compra de 500 brincos | inserção em lote de 500 linhas | uma linha |
| Brinco perdido | atualizar 1 linha | inserir 1 exceção |
| Consulta "quem tem o 7123?" | direta | `animalIdentificadores` responde; a faixa só diz de onde veio |
| Complexidade de código | maior (bulkAdd, status por item, migração pesada) | menor; exige regra clara para exceções |
| Risco de inconsistência | contagem sempre exata | saldo é derivado (`fim − proximo + 1 − exceções abertas`); precisa de teste |
| Aderência à orientação "offline e simples" | fraca | forte |

**Recomendação: Estratégia B (faixas + exceções), com materialização do item somente quando ele é usado** — o uso já é uma linha em `animalIdentificadores` (`faixa_id` aponta para a faixa). Assim o "item" só existe quando tem dono, e o estoque continua leve.

## 4. Modelo alvo (Estratégia B)

### 4.1 Store `faixasIdentificadores` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `tipo` | `VISUAL`, `RFID`, `SISBOV`, `MANEJO` |
| `marca_id` | obrigatório para VISUAL (o número visual só faz sentido com a marca) |
| `prefixo` | string opcional (`'BR'`, `''`) |
| `inicio`, `fim` | inteiros; `inicio ≤ fim` |
| `digitos` | padding (ex.: 4 → `0071`) |
| `proximo` | cursor do próximo número não utilizado em ordem |
| `direcao` | `CRESCENTE`/`DECRESCENTE` (padrão crescente) |
| `origem` | fornecedor/nota (texto curto) e `data_entrada` |
| `situacao` | `ATIVA`, `ESGOTADA`, `BLOQUEADA` |
| `observacao`, `ativo`, timestamps | padrão |

Índices: `++localId, &id, empresa_id, tipo, marca_id, situacao`.

Regra: duas faixas ativas do mesmo `tipo + marca_id + prefixo` não podem se sobrepor.

### 4.2 Store `excecoesIdentificadores` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `faixa_id` | obrigatório |
| `numero` | inteiro dentro da faixa |
| `motivo` | `USADO_FORA_DE_ORDEM`, `PERDIDO`, `DANIFICADO`, `RESERVADO`, `DEVOLVIDO` |
| `animal_id` | opcional (quando `USADO_FORA_DE_ORDEM`) |
| `observacao`, timestamps | padrão |

Índices: `++localId, &id, [faixa_id+numero]`.

### 4.3 Derivados (não persistidos)

```text
usados_em_ordem   = proximo − inicio
excecoes_abertas  = exceções com motivo ∈ {PERDIDO, DANIFICADO, RESERVADO} e numero ≥ proximo
disponiveis       = (fim − proximo + 1) − excecoes_abertas
```

Um número é "livre" se `numero ≥ proximo`, não está em `excecoesIdentificadores` e não existe `animalIdentificadores` ativo com o mesmo `(marca_id, valor_normalizado)`.

### 4.4 Serviço `identifierInventoryService` (alvo)

- `nextFree(faixaId)` → devolve o próximo livre pulando exceções; avança `proximo` só ao **confirmar** o uso (transação com o Cadastro).
- `useNumber(faixaId, numero, animalId)` → se `numero === proximo` avança; senão grava exceção `USADO_FORA_DE_ORDEM`.
- `markLost(faixaId, numero, motivo)`.
- `balance(faixaId)` → derivados acima.

`SequenciaBrincos` passa a ser uma **visão** desse serviço: escolhe a faixa, mostra "próximo: 0071 · disponíveis: 312", e o avanço acontece no salvamento, não em `window.__sequenciaBrincos`.

## 5. Migração e convivência

- Dados atuais: nenhum estoque existe; a migração v7 cria as stores vazias.
- Números já usados (existentes em `animalIdentificadores`) são respeitados: ao cadastrar uma faixa que os contenha, o sistema calcula `proximo` como primeiro livre e registra exceções `USADO_FORA_DE_ORDEM` para os intervalos já ocupados (relatório de conferência antes de gravar).
- Sem faixa cadastrada, o lançamento continua aceitando número digitado (identificador avulso, `faixa_id = null`).

## 6. Rastreabilidade

Relatório mínimo: por faixa → total, usados, perdidos, disponíveis, último uso; por animal → identificador atual, faixa de origem, histórico de trocas (`animalIdentificadores.inicio/fim`).

## 7. Fora de escopo

Preço unitário do brinco, fornecedor como cadastro completo, pedido de compra, curva ABC, código de barras da caixa. Se o responsável quiser custo por brinco, é um campo `custo_total` na faixa, nada mais.

---

<!-- INVENTORY-SCOPE-DECISION.md -->

# INVENTORY-SCOPE-DECISION — Escopo de "estoque" no produto

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Pergunta

O pedido "cadastro de estoque de identificadores (brincos etc.)" pode ser lido de duas formas: (a) estoque **de identificadores**, ou (b) um módulo de estoque de insumos (brincos, medicamentos, sal, ração) do qual brincos seriam o primeiro item. Esta auditoria precisa fixar qual dos dois entra no produto.

## 2. Análise

| Critério | (a) Estoque de identificadores | (b) Estoque de insumos genérico |
|---|---|---|
| Ligação com o núcleo | direta: cada número vira identidade de animal | indireta: consumo não muda o animal |
| Modelo | faixas + exceções (`IDENTIFIER-INVENTORY-MODEL.md`) | itens, unidades, entradas, saídas, saldo, custo médio, lotes de validade |
| Telas | 1 (faixas) + relatório | ≥ 4 (itens, movimentos, inventário, ajustes) |
| Regras | próximo livre, uso único, perda | valorização, validade, ponto de pedido, rateio de custo |
| Aderência à orientação "evitar WMS/ERP" | forte | fraca — é o começo de um WMS |
| Dependência de decisões | DEC-002 apenas | P-004 (método de custo) e definição de insumos |
| Valor para o curral | alto: número certo, sem duplicidade | baixo |

## 3. Decisão proposta

**Escopo = (a).** "Estoque" no Pesagens Individuais significa **estoque de identificadores** (visual, RFID, SISBOV, manejo), modelado por faixas e exceções, com rastreabilidade por animal. Nenhum outro insumo entra.

Consequências:

1. Não haverá store de "itens de estoque", "movimentações de estoque" ou "unidades de medida".
2. Medicamentos (hoje em sanidade) **não** ganham estoque, por este documento e por ADR-007.
3. Custo do brinco, se desejado, é um campo informativo na faixa (`custo_total`), sem valorização de saldo.
4. Ração, sal, vacinas e suplementos ficam explicitamente fora de escopo até nova ADR.

## 4. Critério para revisitar

Só reabrir (b) se o responsável decidir P-004 (método de custo) **e** houver relatório REP-304 (custo do ganho) aprovado que exija consumo de insumo por lote. Mesmo assim, a arquitetura sugere módulo separado (ADR-008), não extensão do estoque de identificadores.

## 5. Registro

DEC-002 (estratégia de estoque de identificadores) e DEC-017 (escopo de estoque) em `DECISION-REGISTER.md`.

---

<!-- ANIMAL-REGISTRATION-FLOW.md -->

# ANIMAL-REGISTRATION-FLOW — Fluxo de cadastro do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Fluxo atual (Lançamento → Tipo "Cadastro")

```text
Lançamento de Pesagens
  Tipo de Movimentação = "Cadastro (Novo Animal)"
  Data · Sexo(M/F) · Raça(combobox livre) · Era(combobox livre) · Marca(combobox livre)
  Nº Ident./Nome · Peso · Observação
  [olhinho] Dados da compra: valor/cabeça, vendedor(registry), GTA, NF-e, frete, obs
  [ícone]   Sequência de brincos
  Apartação · Transferência de lote (automático por faixa de peso)
  Salvar
    ├─ SN? → ConfirmarAnimalSnDialog (herda último SN)
    ├─ número existe em outra marca → SelecionarAnimalDialog / erro "já cadastrado"
    └─ createEntry → pesagens + animais + animalIdentificadores + animalLotes + movimentosAnimais('Entrada') + sessoesPesagem + auditoria
```

Observações:

- O cadastro é um **evento de pesagem** (`tipo_manejo='Cadastro'`) com peso obrigatório. Um animal comprado sem pesagem de entrada não pode ser cadastrado.
- A compra é gravada dentro do evento (`valor_pago_cabeca`, `origem_animal`, `documentacao` como **string JSON**).
- Sexo/raça/era/marca são digitados por animal; a "configuração por tipo" (`configuracoesPorTipoRef`) lembra os últimos valores só enquanto a tela está aberta.
- Duplicidade e existência são avaliadas na tela contra a lista completa de pesagens (`animalLookup.avaliarIdentificacaoAnimal`).
- Erro de marca gera um animal "novo" silenciosamente na importação (chave `NÚMERO::MARCA` diferente).

## 2. Informações que hoje são pré-digitadas e deveriam ser cadastro

| Informação | Hoje | Deve virar cadastro? | Cadastro sugerido | Motivo |
|---|---|---|---|---|
| Marca | texto livre por animal | Sim | `marcas` | compõe identidade; precisa de unicidade e inativação |
| Raça | texto livre, padrão `Nelore` no código | Sim | `racas` | agrupamento de relatórios; padrão por empresa |
| Era | texto livre | Sim (transformada) | `categoriasAnimal` + nascimento estimado | idade calculável e categoria comparável |
| Número do brinco | digitado ou sequência de tela | Sim (origem) | `faixasIdentificadores` | próximo livre real, rastreabilidade |
| Vendedor/origem | registry em `appSettings` | Sim | `parceiros` (papel VENDEDOR) | histórico e vínculo com compra |
| Propriedade de origem | texto `propriedade` no vendedor | Sim (mínimo) | `propriedades` | GTA e transferências referem propriedade |
| Apartação/lote inicial | popup dentro do lançamento | Já é store; mover a manutenção para tela própria | `apartacoes`/`loteApartacoes` | popup no curral atrasa |
| Documentos de compra (GTA/NF-e/frete) | string JSON no evento | Sim | `operacoesComerciais` (compra) + documentos | conferência e relatório REP-301 |
| Operador | `'LOCAL'` fixo | Depois (F2/F7) | operador | não bloqueia cadastros |

## 3. Fluxo alvo

### 3.1 Tela "Animais" (cadastro completo, ModeloBase1)

Lista de animais (projeção `animais`, não pesagens): Nº, Marca, Sexo, Raça, Categoria, Situação, Lote atual, Última pesagem, Último peso. Ficha com identificadores (histórico), origem (compra/nascimento/transferência), observações.

Criar animal aqui **não exige peso**. A entrada por compra gera o evento `CADASTRO` com `origem='compra'` e, opcionalmente, a pesagem de entrada.

### 3.2 Cadastro rápido no curral (dentro do Lançamento)

Quando o número digitado não existe: diálogo mínimo com Marca (padrão pré-selecionada), Sexo, Raça (padrão), Categoria (sugerida) e o peso já digitado. Nada de compra, GTA ou frete no curral; isso vai para a operação de compra depois.

### 3.3 Importação

CSV de cadastro resolve marca/raça/categoria por nome normalizado; linhas com valor desconhecido param no dry-run com a opção "criar cadastro para os valores novos" (`IMPORT-TARGET-MODEL.md`).

## 4. Regras do fluxo alvo

1. Não existe animal sem `marca_id` (exceto `TEMPORARIO`/`SN`, que exige marca padrão).
2. Cadastro cria `animais` + identificador VISUAL (+ consumo de faixa quando houver) + evento `CADASTRO` na mesma transação; **sem** pesagem obrigatória.
3. Compra é operação separada; o Cadastro pode apontar `operacao_compra_id`.
4. O lançamento de Manejo nunca cria animal por conta própria.

## 5. Impacto no código (para o plano, não para agora)

- `weighingDataAdapter.createEntry`: separar "criar animal" de "criar pesagem"; hoje estão na mesma função.
- `validateUiPayload`: peso obrigatório passa a depender do tipo de evento, não do motivo de saída.
- `LancamentoPesagensIndividuais.jsx`: remover blocos de compra e sequência; substituir comboboxes livres por seleção de cadastro.

---

<!-- ANIMAL-PROFILE-MODEL.md -->

# ANIMAL-PROFILE-MODEL — Ficha do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual (`src/pages/FichaAnimal.jsx`)

| Bloco | Implementação | Avaliação |
|---|---|---|
| Fonte | `buildProfiles(catalog)`: agrupa **todas as pesagens** por `animal_id` ou `NÚMERO::MARCA` | O(N) na abertura; em 36 mil pesagens gera ~12 mil perfis em memória; ignora `animais` exceto para sobrescrever campos do último perfil |
| Busca | filtro em memória por número/marca/raça; 12 resultados | ok em base pequena; sem índice |
| KPIs | peso atual, ganho total, GMD médio (ganho total / dias totais), GMD última, @ carcaça (50 % fixo), nº pesagens | "@ carcaça" com rendimento fixo contradiz ADR-012 (rendimento explícito) |
| Curva de peso | SVG próprio, 90 dias / 6 meses / tudo | adequado |
| Linha do tempo | derivada das pesagens (Cadastro, Pesagem, Saída) | não mostra mudança de lote (`movimentosAnimais`) nem identificadores |
| Histórico | tabela com dias/ganho/GMD/lote/apartação | ok |
| Exportar histórico | CSV | ok |
| Visual | `op-screen` | não é ModeloBase1 |
| Breadcrumb | evento `mb1:breadcrumb-detail` | bom padrão; manter |

## 2. Modelo alvo

### 2.1 Fonte de dados

- Perfil = `animais` (projeção) + identificadores ativos/histórico (`animalIdentificadores`) + marca/raça/categoria por id.
- Série = `pesagens.where('animal_id')` (índice).
- Linha do tempo = união ordenada de: eventos (`pesagens`), `movimentosAnimais` (entrada, mudança de lote com origem→destino, saída), trocas de identificador, operações comerciais vinculadas.
- Busca = `animalIdentificadores.valor_normalizado` + `animais.identificacao_normalizada` (índices), limitada a 20.

### 2.2 KPIs

| KPI | Regra |
|---|---|
| Peso atual | `animais.ultimo_peso_kg` / `ultima_pesagem_data` |
| Ganho total | último Manejo − primeiro peso conhecido (Cadastro com peso ou primeiro Manejo) |
| GMD médio ponderado | Σganho / Σdias dos Manejos (D5: distinguir do simples) |
| GMD última | do último Manejo |
| @ estimada | só se houver rendimento configurado (empresa ou categoria); caso contrário "—" com dica |
| Situação | estado do ciclo (`ATIVO`, `VENDIDO`…) com data e motivo |

### 2.3 Seções

1. Cabeçalho: número atual, marca, situação, sexo, raça, categoria, idade estimada, lote atual, propriedade.
2. Identificadores: tabela com tipo, valor, faixa de origem, início/fim, motivo.
3. Curva de peso (manter o componente).
4. Linha do tempo (com movimentos e comercial).
5. Histórico de pesagens (manter).
6. Ações: "Lançar pesagem" (pré-seleciona o animal), "Trocar identificador", "Editar cadastro" — nenhuma ação escondida atrás de ícone sem rótulo.

### 2.4 UI

Tela Mãe do ModeloBase1 no modo registro (`CadastroAuxiliarPage` já tem o padrão lista/registro); a curva de peso entra como painel.

## 3. Impacto

Não há migração de dados. O ganho é de desempenho (índices) e de correção conceitual (ficha lê o cadastro, não infere dele a partir de eventos).

## 4. Fora de escopo

Fotos do animal, genealogia, escore, histórico sanitário (ADR-007).

---

<!-- PURCHASE-FLOW-MODEL.md -->

# PURCHASE-FLOW-MODEL — Fluxo de compra

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Onde | Observação |
|---|---|---|
| Ativação | botão "olhinho" (`Eye`/`EyeOff`) "Dados da compra" no Cadastro | ação oculta; o operador precisa saber que existe |
| Campos | `valorPagoCabeca`, `origemAnimal` (vendedor do registry, por **nome**), `numeroGTA`, `numeroNFeCompra`, `valorFreteCompra`, `observacoesCompra` | por animal, repetidos a cada cadastro |
| Persistência | `legacy_payload.valor_pago_cabeca`, `origem_animal`, `documentacao = JSON.stringify({gta, nfe, frete, obs})` | string JSON dentro de um objeto JSON |
| Agregação | nenhuma; não há "lote de compra" | 40 animais da mesma nota são 40 cópias dos dados |
| Frete | por animal | não há rateio; o mesmo frete digitado 40 vezes soma 40 fretes |
| Relatório | coluna `valor_pago_cabeca` na relação | nenhum total por compra |

## 2. Modelo alvo (mínimo útil)

### 2.1 Store `operacoesComerciais` (tipo `COMPRA`)

| Campo | Regra |
|---|---|
| `id`, `empresa_id` | padrão |
| `tipo` | `COMPRA` (mesma store para VENDA/ABATE, ver `SALE-FLOW-MODEL.md`) |
| `data` | data civil da operação |
| `parceiro_id` | vendedor (`parceiros`, papel VENDEDOR) |
| `propriedade_origem_id` | opcional |
| `documentos` | lista curta: `{tipo: GTA|NFE|OUTRO, numero, data}` (dentro do registro; não é store) |
| `valor_total` | informado |
| `valor_frete`, `outros_custos` | informados, opcionais |
| `quantidade_prevista` | informada |
| `status` | `RASCUNHO` → `CONFERIDA` → `FECHADA`; `CANCELADA` |
| `observacao`, timestamps | padrão |

### 2.2 Vínculo animal ↔ compra

No evento `CADASTRO` do animal: `operacao_id` (coluna indexada em `pesagens`/eventos) e `valor_alocado` (custo individual: `valor_total / quantidade` por padrão, editável).

Regra de rateio inicial: **por cabeça**. Rateio por peso só entra se o responsável decidir (P-004). Nada de custo composto.

### 2.3 Fluxo

```text
Cadastros › Parceiros (vendedor)      ─┐
Cadastros › Propriedades (origem)     ─┤ antes
Cadastros › Marcas/Raças/Categorias   ─┘
Comercial › Nova compra (RASCUNHO): vendedor, data, documentos, valor, frete, quantidade
  └─ "Cadastrar animais desta compra": cadastro em série (marca padrão, faixa do estoque, categoria)
       └─ cada animal: evento CADASTRO com operacao_id; pesagem de entrada opcional no curral
Conferir: quantidade cadastrada = prevista; soma alocada = valor total → CONFERIDA → FECHADA
```

### 2.4 Cancelamento

Cancelar a compra não apaga animais; marca a operação como `CANCELADA` e remove `operacao_id` dos cadastros com auditoria. Se algum animal já tem Manejo, a compra só pode ser cancelada com justificativa.

## 3. Migração dos dados atuais

Para cada Cadastro com `valor_pago_cabeca` ou `documentacao`:

1. agrupar por `(data_pesagem, origem_animal, gta, nfe)`;
2. criar uma `operacoesComerciais` COMPRA por grupo (`status=FECHADA`, `origem='migracao'`), `valor_total = Σ valor_pago_cabeca`, `valor_frete` = frete do grupo (um só valor, não a soma);
3. gravar `operacao_id` e `valor_alocado = valor_pago_cabeca` no evento;
4. manter os campos legados no payload (somente leitura) até a limpeza de `legacy_payload`.

O dry-run mostra os grupos formados e os casos ambíguos (fretes diferentes no mesmo grupo).

## 4. Fora de escopo

Contas a pagar, adiantamento, comissão de compra, financiamento, ICMS, integração NF-e.

---

<!-- SALE-FLOW-MODEL.md -->

# SALE-FLOW-MODEL — Fluxo de venda

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

```text
Lançamento › Tipo "Saída" › Motivo "Venda"
  [botão] "Dados da venda" (oculto por padrão)
     Comprador (registry por nome) · Destino (texto) · Valor da arroba · Valor total
     Rendimento de carcaça (%) · Estimativa comercial (carcaça, @, valor)
     GTA · NF-e · Frete · Observações
  Embarque · Documento (GTA/NF-e) — opcionais na venda (obrigatórios só no abate)
  Salvar → pesagens(Saída) + movimentosAnimais('Venda') + animalLotes.fim + animais.situacao='Inativo'
```

Dois cadastros para a mesma informação:

- `GerenciarSaidasDialog.jsx` (perfis `perfis-saida:<empresa>` em `appSettings`, com abas Compradores/Vendas/Abates e botão "Usar no lançamento") — **legado**; ainda é sincronizado por `registryService.saveRegistryGroup`.
- `CadastrosComerciais.jsx` (registry `cadastros-auxiliares:comerciais`) — atual.

Cálculo (`commercialCalculations.calculateCarcassTrade`) está correto e separa peso vivo, carcaça, arrobas e valor (ADR-012). O problema é onde o resultado é gravado: dentro de cada pesagem, sem operação agregadora.

Problemas objetivos:

1. Venda de 30 animais = 30 lançamentos com comprador, valor da arroba, GTA e frete repetidos.
2. `comprador` é o **nome**; renomear o comprador no cadastro não atualiza o histórico nem permite filtro por id.
3. `valor_venda_total` por animal não tem relação garantida com `quantidade_arrobas × valor_arroba`; não há indicação de "informado × calculado".
4. `FechamentoDia` cobra embarque e documento para venda (pendência "Doc"), mas a tela de lançamento só obriga no abate: regras divergentes.

## 2. Modelo alvo

### 2.1 `operacoesComerciais` (tipo `VENDA`)

| Campo | Regra |
|---|---|
| `tipo` | `VENDA` |
| `data` | data civil |
| `parceiro_id` | comprador (`parceiros`, papel COMPRADOR) |
| `destino` | texto curto ou `propriedade_destino_id` |
| `preco_arroba` | informado |
| `rendimento_percentual` | informado; origem `informado`/`padrao` gravada (resolve D4) |
| `valor_total_informado` | opcional |
| `valor_total_calculado` | Σ (arrobas do animal × preço) — derivado, recalculável |
| `valor_frete`, `descontos` | opcionais |
| `embarque_id` | opcional; obrigatório para fechar se a política exigir |
| `documentos` | `{tipo, numero, data}` |
| `status` | `RASCUNHO` → `CONFERIDA` → `FECHADA` / `CANCELADA` |

### 2.2 Vínculo animal ↔ venda

Evento `SAÍDA` do animal grava `operacao_id`, `peso_kg` (peso vivo na saída), `carcaca_kg`, `arrobas`, `valor_animal` (derivado). Regra: um animal só entra em **uma** operação de venda aberta.

### 2.3 Fluxo

```text
Comercial › Nova venda (RASCUNHO): comprador, data, preço/@, rendimento, embarque (opcional)
  └─ Adicionar animais: seleção por lote/apartação/lista (somente ATIVOS)
       └─ peso de saída: última pesagem ou pesagem no curral (Lançamento com "operação ativa")
Conferir: quantidade, peso vivo total, arrobas, valor calculado × informado → CONFERIDA
Fechar: gera SAÍDA para cada animal na mesma transação; situação → VENDIDO → FECHADA
Cancelar (após fechada): reverte saídas com auditoria; animais voltam a ATIVO
```

No curral, o Lançamento em modo Saída pergunta só: motivo = Venda → "operação de venda aberta: [selecionar]" → pesa e salva. Sem digitar comprador, arroba, GTA por animal.

### 2.4 Regra de documentação

Uma única política, aplicada no serviço e no Fechamento: venda pode fechar sem documento se a empresa marcar `exigir_documento_venda=false` (configuração real); do contrário a operação fica `CONFERIDA` até o documento ser vinculado.

## 3. Migração

Agrupar Saídas com `motivo_saida='Venda'` por `(data_pesagem, comprador, valor_arroba, embarque_id)` → uma operação FECHADA por grupo, `origem='migracao'`; gravar `operacao_id` nas saídas; resolver `comprador` por nome normalizado em `parceiros` (criar parceiro quando não existir, com `origem='migracao'`). Relatório de dry-run obrigatório.

`perfis-saida` (venda/abate) viram operações-modelo? **Não.** São descartados após confirmar que compradores foram migrados; "modelo de venda" reaparece só como "repetir última operação".

## 4. Fora de escopo

Emissão de NF-e, boleto, comissão de corretor, contrato, adiantamento.

---

<!-- SLAUGHTER-FLOW-MODEL.md -->

# SLAUGHTER-FLOW-MODEL — Fluxo de abate

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

```text
Lançamento › Saída › Motivo "Abate"
  Embarque (obrigatório) · Documento GTA/NF-e (obrigatório)   ← única saída que exige documento
  [botão] "Dados do abate": Frigorífico (registry por nome) · Valor/@ · Valor total · Rendimento · GTA · NF-e · Frete · Obs
  Painel lateral "Abate": contagem por documento (previsto M/F × embarcados)
```

Persistência: `frigorifico` (nome), `valor_arroba_abate`, `valor_total_abate`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas`, `embarque_id`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` — tudo copiado para o payload de **cada** pesagem.

O embarque já tem `frigorifico` próprio; o abate repete o frigorífico por animal. `documentosEmbarque` já guarda GTA/NF-e/motorista/placa; o abate copia tudo de novo.

O que funciona bem e deve continuar: exigir embarque e documento antes de salvar; estimativa de carcaça/arrobas separada do peso vivo; previsão M/F por documento.

## 2. Modelo alvo

Abate é uma `operacoesComerciais` com `tipo='ABATE'` e a mesma estrutura da venda (`SALE-FLOW-MODEL.md` §2), com diferenças:

| Campo | Abate |
|---|---|
| `parceiro_id` | frigorífico (`parceiros`, papel FRIGORIFICO) |
| `embarque_id` | **obrigatório** para fechar |
| `retorno_frigorifico` | opcional, preenchido depois: `{peso_carcaca_real_kg, rendimento_real, arrobas_reais, valor_real, data_retorno}` (REP-303) |

Regras:

1. Todo animal abatido pertence a um embarque (`EMBARQUE-FLOW`), e o embarque referencia o frigorífico uma vez.
2. Frigorífico, motorista, placa e documentos **não** são copiados para a pesagem; a pesagem aponta `operacao_id` e `embarque_id`; a grade lê por junção.
3. Estimado × realizado: `valor_total_calculado` (estimativa) versus `retorno_frigorifico.valor_real`; ambos exibidos com rótulo.

### Fluxo

```text
Cadastros › Parceiros (frigorífico)          ─ antes
Embarques › Novo embarque (PLANEJADO): frigorífico, data, documentos, previsão M/F
Comercial › Novo abate (RASCUNHO) ligado ao embarque: preço/@, rendimento
Curral › Lançamento em modo Saída/Abate com "abate aberto" selecionado: pesa, salva, próximo
Embarque › conferir contagem previsto × embarcado → EM_ANDAMENTO → CONCLUÍDO
Comercial › fechar abate (gera SAÍDAs) → depois registrar retorno do frigorífico
```

## 3. Migração

Saídas com `motivo_saida='Abate'` agrupadas por `(embarque_id, documento_embarque_id, frigorifico, valor_arroba_abate)` → uma operação ABATE FECHADA por grupo; `frigorifico` resolvido por nome em `parceiros`. Os campos duplicados do payload (`motorista_nome`, `placa_carreta`, `documento_numero`…) permanecem só como legado somente-leitura.

## 4. Fora de escopo

Tipificação de carcaça, bonificação por programa, romaneio do frigorífico importado automaticamente, cálculo de ICMS. O retorno do frigorífico é digitado, não integrado.

---

<!-- SHIPMENT-FLOW-MODEL.md -->

# SHIPMENT-FLOW-MODEL — Fluxo de embarque e máquina de estados

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Store / tela | Campos | Observação |
|---|---|---|
| `embarques` | `nome`, `data`, `frigorifico` (texto), `status` (`Planejado`, `Em andamento`, `Concluido`, `Cancelado`), `empresa_id` | status é um `Select` livre; nenhuma transição é validada |
| `documentosEmbarque` | `embarque_id`, `tipo_documento` (`GTA`, `NF-e`, `GTA+NF-e`), `numero_gta`, `numero_nfe`, `motorista_nome`, `placa_carreta`, `previsao_machos`, `previsao_femeas` | motorista e placa estão no documento, não no embarque |
| `GerenciarEmbarquesDialog.jsx` | popup dentro do Lançamento | exclusão bloqueada se houver pesagens ou documentos vinculados |
| Vínculo com animais | `pesagens.embarque_id` + `documento_embarque_id` | não existe "item de embarque"; o animal entra no embarque quando a Saída é salva |
| `ResumoEmbarque.jsx` | previsão M/F × embarcados por documento | útil; manter a ideia |

Problemas: status sem regra; embarque "Concluído" ainda aceita saídas; o embarque não sabe quantos animais tem sem varrer pesagens; motorista/placa por documento em vez de por viagem; `frigorifico` texto.

## 2. Modelo alvo

### 2.1 Entidades

```text
embarques (viagem)              1 ── N  documentosEmbarque (GTA, NF-e, outro)
  frigorifico/destino: parceiro_id
  transportador: parceiro_id (opcional), motorista, placa(s)
  previsao_machos, previsao_femeas, capacidade
  status (máquina abaixo)
                                1 ── N  itens: evento SAÍDA do animal com embarque_id (índice já existe)
```

Não criar store `itensEmbarque`: o evento de saída com `embarque_id` **é** o item. A contagem usa o índice `pesagens.embarque_id`.

### 2.2 Máquina de estados

| De | Para | Condição | Efeito |
|---|---|---|---|
| — | `PLANEJADO` | criação | pode editar tudo |
| `PLANEJADO` | `EM_CARREGAMENTO` | ao menos um documento, ou política "documento depois" | aceita saídas (Venda/Abate/Transferência) |
| `EM_CARREGAMENTO` | `CONFERIDO` | contagem embarcada = prevista, ou divergência justificada | bloqueia novas saídas; permite corrigir documentos |
| `CONFERIDO` | `CONCLUIDO` | operação comercial vinculada fechada, ou nenhuma operação exigida | somente leitura |
| `PLANEJADO`/`EM_CARREGAMENTO` | `CANCELADO` | sem saídas vinculadas, ou saídas revertidas com auditoria | |
| `CONCLUIDO` | `CONFERIDO` (reabrir) | motivo obrigatório + auditoria | |

Transições fora da tabela são recusadas pelo serviço, não pela tela.

### 2.3 Regras

1. Saída só aceita `embarque_id` com status `EM_CARREGAMENTO`.
2. Animal só pode estar em um embarque não cancelado.
3. Cancelar embarque com saídas exige reverter as saídas primeiro (fluxo auditado de `ANIMAL-LIFECYCLE-TARGET.md`).
4. Conferência compara `previsao_machos/femeas` com a contagem por sexo dos animais embarcados; divergência exige justificativa gravada no embarque.

### 2.4 Tela

Tela própria "Embarques" (ModeloBase1): lista com status, destino, data, previsto/embarcado; ficha com documentos e lista de animais; ações de transição visíveis conforme o estado. O popup `GerenciarEmbarquesDialog` deixa de existir; no Lançamento fica apenas a seleção do embarque `EM_CARREGAMENTO`.

## 3. Migração

- `status` texto → enum: `Planejado`→`PLANEJADO`, `Em andamento`→`EM_CARREGAMENTO`, `Concluido`→`CONCLUIDO`, `Cancelado`→`CANCELADO`.
- `frigorifico` texto → `parceiro_id` por nome normalizado (criar parceiro se necessário).
- `motorista_nome`/`placa_carreta` do documento → copiados para o embarque quando houver um único documento; caso contrário mantidos no documento e listados no dry-run.
- Embarques `CONCLUIDO` com pesagens posteriores à data do embarque são listados como inconsistência (não corrigidos automaticamente).

## 4. Fora de escopo

Roteirização, rastreamento GPS, pesagem na balança rodoviária, integração com transportadora, emissão de GTA.

---

<!-- COMMERCIAL-REGISTRY-MODEL.md -->

# COMMERCIAL-REGISTRY-MODEL — Parceiros comerciais (comprador, vendedor, frigorífico, transportador)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual — duas implementações

| Implementação | Persistência | Campos | Uso |
|---|---|---|---|
| `CadastrosComerciais.jsx` via `registryService` | `appSettings['cadastros-auxiliares:comerciais:local']` = `{compradores[], vendedores[], frigorificos[]}` | nome, documento, telefone, email, cidade, ativo, observacoes; vendedor: propriedade; frigorífico: sif | Lançamento (`auxiliaryCatalogs`) seleciona por **nome** |
| `GerenciarSaidasDialog.jsx` | `appSettings['perfis-saida:local']` = `{compradores[], venda[], abate[]}` | comprador: nome, documento, telefone, cidade; venda/abate: perfis com preços | botão "Usar no lançamento"; `registryService` copia compradores para cá em toda gravação |

Consequências:

- a mesma pessoa pode existir em três listas (comprador, vendedor, frigorífico) com ids diferentes;
- o lançamento grava o **nome** (`comprador: 'Frigorífico X'`), então renomear quebra o vínculo;
- o JSON único cresce e é regravado inteiro a cada alteração (sem índice, sem paginação);
- não há transportador/motorista como cadastro;
- o `registryService` mantém sincronismo com uma chave legada — dívida em dobro.

## 2. Modelo alvo — Parceiro com papéis

### 2.1 Store `parceiros` (Dexie v7)

| Campo | Regra |
|---|---|
| `id`, `empresa_id` | padrão |
| `nome` | obrigatório; `nome_normalizado` indexado |
| `tipo_pessoa` | `FISICA` / `JURIDICA` |
| `documento` | CPF/CNPJ só dígitos; opcional; único por empresa quando informado |
| `papeis` | array: `COMPRADOR`, `VENDEDOR`, `FRIGORIFICO`, `TRANSPORTADOR`, `PROPRIETARIO` (dono de marca) — multiEntry index |
| `telefone`, `email`, `cidade`, `uf` | opcionais |
| `registro_sif` | opcional; só faz sentido para FRIGORIFICO |
| `rendimento_padrao` | opcional; FRIGORIFICO/COMPRADOR; usado como sugestão na operação |
| `observacao`, `ativo`, timestamps | padrão |

Índices: `++localId, &id, empresa_id, nome_normalizado, *papeis, ativo`.

### 2.2 Regras

1. Um parceiro, vários papéis: o frigorífico que também compra bezerros é um registro.
2. Operações e embarques referenciam `parceiro_id`, nunca o nome.
3. Inativar não apaga; exclusão só quando nenhum vínculo existir (mesma regra atual do `GerenciarSaidasDialog`, agora no serviço).
4. A tela lista por papel (aba/filtro) usando a Tela Mãe já portada; a ficha é única.

### 2.3 Propriedade do vendedor

`vendedor.propriedade` (texto) vira vínculo opcional com `propriedades` (`PROPERTY-FARM-MODEL.md`). Um parceiro pode ter várias propriedades de origem.

## 3. Migração

1. Ler os três buckets de `cadastros-auxiliares:comerciais` e `perfis-saida.compradores`.
2. Unir por `documento` (quando houver) ou `nome_normalizado`; consolidar `papeis`.
3. Criar `parceiros`; gerar tabela de correspondência `nome antigo → parceiro_id`.
4. Resolver nomes gravados nas pesagens (`comprador`, `frigorifico`, `origem_animal`) para `parceiro_id` **nas operações comerciais migradas**, não no payload.
5. Após validar: remover as chaves `cadastros-auxiliares:comerciais:*` e `perfis-saida:*` de `appSettings`, retirar `GerenciarSaidasDialog.jsx` e a sincronização legada do `registryService`.

## 4. Fora de escopo

Endereço completo com CEP/logradouro, dados bancários, limite de crédito, histórico de negociação, CRM. Dados fiscais sensíveis exigem análise própria (03 §5).

---

<!-- TARGET-COMMERCIAL-FLOW.md -->

# TARGET-COMMERCIAL-FLOW — Fluxo comercial alvo, separado do curral

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Separação de responsabilidades

| Onde | O que acontece | Quem |
|---|---|---|
| Escritório (telas Comercial/Embarques) | abre compra/venda/abate, escolhe parceiro, preço, rendimento, documentos, embarque; confere; fecha | administrativo/gestor |
| Curral (Lançamento) | seleciona a operação aberta uma vez; pesa e registra saída/entrada animal a animal | operador |
| Sistema | gera eventos, projeções, totais calculados; bloqueia inconsistências | serviço |

Regra: **nenhum valor monetário é digitado no curral.**

## 2. Entidade única `operacoesComerciais`

| Campo | COMPRA | VENDA | ABATE |
|---|---|---|---|
| `tipo` | COMPRA | VENDA | ABATE |
| `parceiro_id` | vendedor | comprador | frigorífico |
| `propriedade_origem_id` / `destino` | origem | destino | — |
| `preco_arroba` | — | sim | sim |
| `rendimento_percentual` (+ origem) | — | sim | sim |
| `valor_total_informado` | sim | opcional | opcional |
| `valor_total_calculado` | Σ alocado | Σ arrobas × preço | idem |
| `valor_frete`, `descontos`, `outros_custos` | opcionais | opcionais | opcionais |
| `documentos[]` | GTA, NF-e | GTA, NF-e | GTA, NF-e |
| `embarque_id` | — | opcional | obrigatório |
| `retorno_frigorifico` | — | — | opcional |
| `status` | RASCUNHO → CONFERIDA → FECHADA / CANCELADA | idem | idem |

Vínculo com animais: evento (`pesagens`) com `operacao_id` — CADASTRO para compra, SAÍDA para venda/abate. Índice `operacao_id`.

## 3. Máquina de estados da operação

| De | Para | Condição |
|---|---|---|
| — | RASCUNHO | criação com parceiro e data |
| RASCUNHO | CONFERIDA | ≥ 1 animal; quantidade e valores conferidos; para ABATE, embarque `CONFERIDO` ou superior |
| CONFERIDA | FECHADA | gera/valida os eventos; animais mudam de estado (VENDIDO/ABATIDO); operação somente leitura |
| RASCUNHO / CONFERIDA | CANCELADA | remove `operacao_id` dos eventos ainda não fechados |
| FECHADA | CANCELADA | reverte saídas com motivo e auditoria; animais voltam a ATIVO; embarque volta a CONFERIDO |

## 4. Fluxo ponta a ponta — venda

```text
Escritório: Parceiros (comprador existe) → Nova venda RASCUNHO (preço/@, rendimento, documentos, embarque opcional)
Curral:     Lançamento › Saída › Venda › operação "Venda JBS 14/09" → Nº → Peso → Salvar × N
Escritório: Operação mostra N animais, peso vivo, @ calculadas, valor calculado × informado → CONFERIDA → FECHADA
Relatórios: REP-302 (resultado), REP-401 (romaneio) a partir da operação + embarque
```

## 5. Fluxo ponta a ponta — abate

Igual à venda, com embarque obrigatório e, depois, `retorno_frigorifico` (peso de carcaça real, rendimento real, valor real) para REP-303 estimado × realizado.

## 6. Fluxo ponta a ponta — compra

```text
Escritório: Nova compra RASCUNHO (vendedor, propriedade origem, valor, frete, documentos, quantidade prevista)
Rebanho:    Cadastrar animais da compra (faixa de identificadores, marca padrão, categoria) → eventos CADASTRO com operacao_id
Curral:     (opcional) pesagem de entrada como MANEJO ou peso no CADASTRO
Escritório: conferência (cadastrados = previstos; alocado = total) → CONFERIDA → FECHADA
```

## 7. Convivência com dados atuais

Até a migração (v8), as saídas antigas mantêm os campos no payload e a Relação continua a exibi-los. O relatório comercial alvo lê **só** operações; saídas legadas sem operação aparecem em REP-502 (qualidade) como "saída sem operação (legado)". A migração agrupa e cria operações FECHADAS com `origem='migracao'` (ver `SALE-FLOW-MODEL.md` §3, `SLAUGHTER-FLOW-MODEL.md` §3, `PURCHASE-FLOW-MODEL.md` §3).

## 8. Fora de escopo

Financeiro (contas, caixa, boleto), fiscal (emissão), contrato, comissão, custo composto (P-004), integração com frigorífico.

---

<!-- MORTALITY-MODEL.md -->

# MORTALITY-MODEL — Mortalidade e causas de morte

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Implementação |
|---|---|
| Registro da morte | Lançamento › Saída › Motivo `Morte`; peso opcional; `causa_morte` obrigatória |
| Causas | `CausasMorte.jsx` (ModeloBase1) → `registryService` grupo `mortalidade` → `appSettings['cadastros-auxiliares:mortalidade:local'].causasMorte[]` com `nome`, `categoria` (Doença, Acidente, Predação, Parto, Desconhecida, Outra), `descricao`, `exigeObservacao`, `ativo` |
| Vínculo | `legacy_payload.causa_morte` = **nome** da causa |
| `exigeObservacao` | cadastrado, mas **não é aplicado** no Lançamento (nenhuma validação lê o campo) |
| Efeitos | `movimentosAnimais.tipo='Morte'`, `animais.situacao='Inativo'`, `motivo_saida='Morte'` |
| Relatório | nenhum específico; aparece na relação filtrando motivo |

Avaliação: o cadastro é o mais bem resolvido dos auxiliares (ModeloBase1, categoria, inativação). O problema é só a persistência em `appSettings` e o vínculo por nome.

## 2. Modelo alvo

### 2.1 Store `causasMorte` (Dexie v7)

Mesmos campos de hoje (`nome`, `nome_normalizado`, `categoria`, `descricao`, `exige_observacao`, `ativo`, `ordem`) + `empresa_id` e timestamps. Índices: `++localId, &id, empresa_id, nome_normalizado, ativo`.

### 2.2 Evento de morte

Em `pesagens` (evento SAÍDA/Morte): `causa_morte_id` (coluna) + `causa_morte` (snapshot do nome). `exige_observacao` passa a ser validado no serviço: sem observação → recusa.

Peso na morte: opcional, como hoje. Se informado, **não** entra na série de ganho (regra atual, D2 não se aplica à morte).

### 2.3 Relatório mínimo (REP-403 parcial)

Mortes por período, por causa (categoria), por lote e por categoria animal; taxa = mortes / animais ativos médios no período. Sem gráfico obrigatório; tabela com drill-down para os animais.

## 3. Migração

- `appSettings[...mortalidade...].causasMorte[]` → `causasMorte` (ids preservados).
- Saídas `Morte` → `causa_morte_id` por `nome_normalizado`; nome não encontrado cria causa `categoria='Outra'`, `origem='migracao'`, listada no relatório.
- Remover a chave de `appSettings` após validação.

## 4. Fora de escopo

Necropsia, laudo veterinário, notificação sanitária oficial, vínculo com programa sanitário (ADR-007).

---

<!-- SANITY-ADR-REVIEW.md -->

# SANITY-ADR-REVIEW — Sanidade × ADR-007

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que a arquitetura diz

- **00 §4.10:** "Sanidade permanece explicitamente fora do produto atual por decisão do responsável."
- **ADR-007 (aceita):** "não recriar cadastros, seleção, aplicação ou relatórios de sanidade. O esquema v6 removeu as stores correspondentes. Retorno exige nova ADR e módulo independente."
- **Dexie v6:** removeu `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` e limpa `sanidade_ids`/`sanidades` de `legacy_payload` na migração e na leitura (`weighingMapper`).
- **F0-01 §11:** "Campos que não serão criados: sanidade, medicamentos…".

## 2. O que o código faz

| Item | Evidência |
|---|---|
| Tela ativa no menu | `Layout.jsx`: "Sanidade — Configurações de Sanidade" → `ConfiguracoesSanidade.jsx` |
| Cadastro de programas sanitários | campos nome, tipo (Vacinação, Vermifugação, Tratamento, Preventivo, Outro), intervalo em dias, orientação, ativo |
| Cadastro de medicamentos | nome, princípio ativo, fabricante, unidade, dose padrão, carência, via de aplicação, ativo |
| Persistência | `registryService.REGISTRY_GROUPS.sanidade = ['programasSanidade','medicamentos']` → `appSettings['cadastros-auxiliares:sanidade:local']` |
| Uso operacional | **nenhum**: o Lançamento não lê `sanidade`; `loadAuxiliaryCatalogs` carrega o grupo mas a tela usa só comerciais e mortalidade |
| Gate | `ui:consistency:verify` do trabalho paralelo cobre a página de cadastro genérica, não a sanidade em si |

Conclusão: a tela é um cadastro sem consumidor, criado depois da ADR-007, guardado em `appSettings` (contorna a remoção das stores). É uma **contradição registrada**: viola a ADR sem ADR nova.

## 3. Opções

| Opção | Descrição | Custo | Consequência |
|---|---|---|---|
| A — Cumprir ADR-007 | remover a rota e o item de menu; remover `sanidade` de `REGISTRY_GROUPS`; migração v7 apaga a chave `appSettings` após exportar o conteúdo para um JSON em `docs/evidence` (se houver dados) | baixo | coerência com a arquitetura; zero manutenção |
| B — Nova ADR-018 "Sanidade como módulo mínimo" | manter apenas os dois cadastros como stores próprias (`programasSanidade`, `medicamentos`) e adicionar **um** evento "aplicação sanitária" por animal; sem carência aplicada a venda, sem estoque de medicamento, sem calendário | médio | reabre domínio; precisa de tela de aplicação, relatório e gates; entra em competição com cadastros mestres prioritários |
| C — Manter como está | tela sem uso, em `appSettings` | zero agora | contradição permanente; dado estrutural em configuração; confusão para o usuário |

## 4. Recomendação

**Opção A.** Motivos: (1) a decisão do responsável está registrada e não foi revogada; (2) nenhum fluxo consome o cadastro; (3) a prioridade declarada é cadastros de marca, raça e identificadores; (4) sanidade completa (carência × venda, calendário, estoque de medicamento) é exatamente o tipo de expansão veterinária que a orientação final pede para evitar.

Se o responsável quiser sanidade, o caminho correto é a Opção B com ADR-018 escrita antes de qualquer código, e **depois** dos cadastros mestres.

## 5. O que fazer com dados existentes

Antes de remover: verificar em Manutenção › Diagnóstico se `appSettings['cadastros-auxiliares:sanidade:local']` tem registros. Se tiver, exportar para `docs/evidence/auditoria-master-produto-pecuario/sanidade-export-<data>.json` e só então limpar. Isso é parte do slice de migração v7 (`IMPLEMENTATION-SLICE-PLAN.md`), não desta auditoria.

## 6. Registro

Contradição C-01 em `CONTRADICTIONS-REGISTER.md`; decisão DEC-006 em `DECISION-REGISTER.md`.

---

<!-- PROPERTY-FARM-MODEL.md -->

# PROPERTY-FARM-MODEL — Empresa, propriedade (fazenda) e local

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

- `empresa_id` é sempre `'local'` (`src/api/db.js`, `localStorage.empresa_selecionada_id`).
- Não existe fazenda, curral ou propriedade como entidade. O único vestígio é `vendedores[].propriedade` (texto) e `destino_venda` (texto).
- Todas as consultas filtram por `empresa_id` ou ignoram o filtro (`genericRepository.matchesFilters` aceita `empresa_id`/`empresaId`).
- A arquitetura (03 §2) posiciona Empresa/Fazenda na fase online (F7) e Curral no Modo Curral (F2). P-003 (estrutura organizacional real) está pendente.

## 2. O que o produto precisa agora (mínimo)

Sem decidir P-003 é impossível modelar multiempresa. Mas três necessidades já aparecem nos fluxos auditados:

| Necessidade | Origem | Solução mínima |
|---|---|---|
| Propriedade de origem na compra / destino na transferência | GTA cita propriedade; `origem_animal` é texto | store `propriedades` simples |
| Propriedade da marca | marcas registradas por proprietário | `marcas.propriedade_id` opcional |
| Local da sessão (curral) | F2 | adiado; um campo texto `local` na sessão basta até lá |

### 2.1 Store `propriedades` (Dexie v7, opcional na primeira fatia)

| Campo | Regra |
|---|---|
| `id`, `empresa_id` | padrão |
| `nome` | obrigatório; `nome_normalizado` único |
| `tipo` | `PROPRIA` / `TERCEIRO` |
| `parceiro_id` | opcional; dono quando TERCEIRO |
| `municipio`, `uf` | opcionais |
| `codigo_oficial` | opcional (código de propriedade usado em GTA); texto livre, sem validação oficial |
| `ativo`, timestamps | padrão |

Regras: a propriedade `PROPRIA` marcada como `padrao` é a origem implícita de todos os animais até existir fazenda real; transferência (Saída) pode informar `propriedade_destino_id`.

## 3. O que **não** fazer agora

- Não introduzir `fazenda_id` em todas as stores antes de P-003: seria backfill com valor único, sem uso, e um índice a mais em `pesagens`.
- Não criar seleção de empresa na UI: uma empresa `'local'` é o contrato até F7 (F0-01 §10).
- Não modelar curral, piquete, pasto, área em hectares.

## 4. Preparação para multiempresa (F7)

Manter `empresa_id` em toda store nova (`marcas`, `racas`, `parceiros`, `faixasIdentificadores`, `operacoesComerciais`), mesmo com valor único. Quando P-003 for decidido, a migração é apenas de valor, não de estrutura.

## 5. Decisão

DEC-013 em `DECISION-REGISTER.md`: criar `propriedades` na v7 (recomendado, custo baixo) ou adiar para F7.

---

<!-- HERD-LOT-MODEL.md -->

# HERD-LOT-MODEL — Apartação, lote e permanência

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Store / código | Estado |
|---|---|---|
| Apartação | `apartacoes` (`nome_apartacao`, `empresa_id`) | cadastro por popup (`GerenciarApartacoesDialog`) dentro do Lançamento |
| Lote | `loteApartacoes` (`nome_lote`, `apartacao_id`, `nome_apartacao` desnormalizado, `quantidade_maxima`, `peso_minimo`, `peso_maximo`, `fechado`) | idem; nomes duplicados dentro da apartação bloqueados na tela |
| Store `lotes` | `schema.js` | **sem uso**; só `health.js` a consulta ao montar `lotIds` |
| Permanência | `animalLotes` (`animal_id`, `lote_id`, `apartacao_id`, `inicio`, `fim`, `origem`) | projeção reconstruída em transação; correta |
| Movimento | `movimentosAnimais` (`tipo`: Entrada, Mudança de lote, Venda…; `lote_origem_id` sempre nulo) | origem não gravada |
| Regra automática | `getLoteAutomatico`: primeiro lote da apartação com `peso_minimo ≤ peso ≤ peso_maximo`, não fechado e não cheio | ocupação = contagem de **pesagens** com `lote_id` (O(N), e conta eventos, não animais) |
| Renomear apartação/lote | `propagateApartacaoRename`/`propagateLoteRename` | regrava `nome_apartacao`/`nome_lote` em **todas** as pesagens vinculadas via `bulkUpdateEntries` (auditoria por registro) |
| Fechamento | `FechamentoDia` calcula ocupação por lote contando pesagens do dia | não usa `animalLotes` |

## 2. Diagnóstico

1. **Duplicidade estrutural:** `lotes` × `loteApartacoes`. Decidir (DEC-007): tornar `loteApartacoes` a store canônica e remover `lotes` na v7, ou migrar para `lotes`. Recomendação: **manter `loteApartacoes`** (todos os vínculos apontam para ela) e remover `lotes` com ADR.
2. **Nome desnormalizado no evento:** `nome_lote`/`nome_apartacao` no payload existem para exibição sem junção. O custo é a propagação em massa ao renomear. Alternativa: manter o snapshot (é um fato: "naquele dia o lote se chamava X") e **parar de propagar**; a grade mostra o nome atual por `lote_id` quando disponível.
3. **Ocupação por contagem de pesagens** está errada conceitualmente (um animal com 5 manejos conta 5) e é O(N). A projeção `animalLotes` aberta (`fim == null`) responde em O(animais do lote) com índice `lote_id`.
4. **Cadastro em popup do curral**: cadastro de apartação/lote deve ser tela própria ModeloBase1; no Lançamento fica só a seleção.

## 3. Modelo alvo (mínimo)

### 3.1 `apartacoes`

Manter. Acrescentar: `ativo`, `ordem`, `observacao`. Sem perfil de regra por enquanto (F4).

### 3.2 `loteApartacoes` → canônica de lote

| Campo | Regra |
|---|---|
| existentes | manter |
| `codigo` | opcional, curto, para o curral |
| `capacidade` | renomear conceitualmente `quantidade_maxima` (manter o campo; alias na UI) |
| `situacao` | `ABERTO` / `FECHADO` (substitui `fechado` boolean via migração de valor) |
| `categoria_id` | opcional; objetivo do lote |
| `data_abertura`, `data_fechamento` | opcionais |
| `ativo`, timestamps | padrão |

Remover `nome_apartacao` desnormalizado do lote (junção por `apartacao_id`).

### 3.3 Regra automática (F1 custo / F4 motor)

Enquanto o motor de regras (ADR-010) não existe, a regra atual permanece com duas correções: ocupação por `animalLotes` abertos e registro de "sugerido × decidido" no evento (`lote_sugerido_id`, `lote_decidido_id`, `motivo_override`). Prioridade = `ordem` do lote, explícita.

### 3.4 Movimentos

Gravar `lote_origem_id` (o lote aberto anterior) na mudança de lote. É um campo já previsto no schema e sempre nulo.

## 4. Migração

- `lotes` → verificar vazio; remover na v7 (`REMOVED_STORES_V7`).
- `loteApartacoes.fechado` → `situacao`.
- Sem alteração em `animalLotes`, `movimentosAnimais` (apenas passa a preencher `lote_origem_id` daqui em diante).

## 5. Fora de escopo

Pasto/piquete, lotação em UA/ha, dieta por lote, custo por lote, rotação de pastagem.

---

<!-- WEIGHING-DOMAIN-MODEL.md -->

# WEIGHING-DOMAIN-MODEL — Domínio de pesagem

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que o domínio faz hoje (e faz bem)

| Função | Arquivo | Estado |
|---|---|---|
| Validação de payload (data civil, peso > 0, exceções de saída sem peso) | `weighingMapper.validateUiPayload` | MADURA |
| Ganho/dias/GMD contra a série do mesmo animal | `weighingCalculations.calculateWeightGain` | MADURA (D1: `gmd=0` quando `dias=0`, caso que não ocorre) |
| Recálculo de série por animal, incremental após F1 | `weighingService.createEntry` + `weighingSeries.recalculateWeightSeries` | MADURA para inserção cronológica; recálculo integral para registros legados sem `animal_id` |
| Cronologia (um Cadastro; nada antes dele; nada após Saída) | `weighingDataAdapter.validateAnimalChronology` | MADURA |
| Avisos de conferência (faixa 20–1500 kg, variação 35 %, GMD 5 kg/dia) | `weighingWarnings.js` | FUNCIONAL; limites em constante de código |
| Projeções (`animais`, `animalLotes`) e movimentos em transação | adapter | MADURA |
| Sessão automática por data | adapter | PARCIAL (ver `WEIGHING-SESSION-MODEL.md`) |
| Auditoria CRIAR/ATUALIZAR/CANCELAR | adapter | PARCIAL (sem consulta; `antes/depois` completos) |
| Duplicidade no mesmo dia | só na tela (`pesagensDia`) | D6: precisa descer ao serviço |
| Peso em kg numérico, parse brasileiro | `brazilianValues.js` | MADURA |

## 2. O que está mal posicionado

1. **`pesagens` é usada como evento genérico.** Cadastro, Manejo e Saída são todos linhas de `pesagens` com `tipo_pesagem`. Isso funciona, mas obriga peso em cadastro e mistura fato comercial com fato de pesagem.
2. **`legacy_payload` carrega o domínio inteiro.** Campos indexáveis e regras vivem dentro de um objeto opaco (`LEGACY-PAYLOAD-AUDIT.md`).
3. **Snapshot × cadastro.** O snapshot (`sexo`, `raca`, `era`, `marca`) está correto como fato; falta `marca_id`/`raca_id`/`categoria_id` ao lado do texto para junção.
4. **Peso obrigatório** é regra do **tipo de evento**, não do motivo de saída (`['Morte','Doação','Transferência']` hard-coded em mapper, tela e `health.js` — três cópias).

## 3. Modelo alvo (sem reescrever o núcleo)

### 3.1 Store `pesagens` mantém-se como store de eventos do animal

Renomear a store é desnecessário e caro (backup, gates, docs). O alvo é **promover colunas** na v7:

| Coluna nova/alterada | Índice | Motivo |
|---|---|---|
| `tipo_evento` (= `tipo_pesagem`: `CADASTRO`, `MANEJO`, `SAIDA`) | sim (já existe como `tipo_pesagem`) | tornar a coluna a fonte; `legacy_payload.tipo_manejo` vira alias de leitura (F0-01 §10) |
| `motivo_saida` | sim | filtros e relatórios de saída sem abrir payload |
| `operacao_id` | sim | vínculo com compra/venda/abate |
| `apartacao_id` | não | hoje só no payload |
| `marca_id`, `categoria_id` | não | snapshot por id além do texto |
| `peso_kg` nulo permitido | — | quando `tipo_evento='CADASTRO'` sem pesagem de entrada ou SAÍDA sem peso |
| `versao_formula` | não | rastrear versão do cálculo de ganho/GMD (ADR-006, 02 §4.4) |

### 3.2 Regras de peso por evento

| Evento | Peso |
|---|---|
| CADASTRO | opcional (entrada pesada ou não) |
| MANEJO | obrigatório > 0; única fonte de ganho/GMD |
| SAÍDA | obrigatório para Venda/Abate; opcional para Morte, Doação, Transferência, Outros |

Uma única função de domínio (`weightRequiredFor(tipo, motivo)`) substitui as três cópias.

### 3.3 Duplicidade

Política no domínio: mesmo `animal_id` + mesma `data_pesagem` + `MANEJO` → recusar, com exceção explícita "repesagem" (grava `substitui_pesagem_id`). Hoje a tela bloqueia; o serviço não.

### 3.4 Avisos configuráveis

`DEFAULT_WEIGHT_WARNING_POLICY` vira configuração real em `appSettings['politica-avisos:<empresa>']` com versão; permanece constante de código como fallback.

## 4. Impactos

- Séries e projeções não mudam; recálculo continua por `animal_id`.
- Gates `weighing:calculations`, `enterprise:hardening`, `animal:history-integrity` continuam válidos; ganham casos para CADASTRO sem peso.
- `health.js` deixa de repetir a lista de motivos.

## 5. Fora de escopo

Pesagem por lote (peso médio de grupo), balança dinâmica, pesagem de carcaça no frigorífico como evento do animal (fica no retorno da operação).

---

<!-- WEIGHING-SESSION-MODEL.md -->

# WEIGHING-SESSION-MODEL — Sessão de pesagem

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Aspecto | Implementação |
|---|---|
| Criação | automática na primeira pesagem de uma data (`createEntry`/`bulkCreateEntries`): `{data, status:'Aberta', operador:'LOCAL'|'IMPORTACAO', inicio}` |
| Vínculo | `pesagens.sessao_id` (índice) |
| Estados | `Aberta` → `Fechada` (`closeWeighingDay`) → `Aberta` (`reopenWeighingDay`, sem motivo) |
| Conteúdo | `justificativas[]` (chaves das pendências justificadas), `fim` |
| Bloqueio | **nenhum**: uma sessão `Fechada` continua aceitando novas pesagens; `createEntry` procura sessão `Aberta` da data e, se só existir a fechada, **cria outra sessão** para o mesmo dia |
| Operador | sempre `'LOCAL'` |
| UI | não existe abertura; `FechamentoDia` mostra "Sessão aberta/Fechado em" |

Consequência prática: "fechar o dia" não impede lançamentos; pode haver duas sessões na mesma data (uma fechada e uma aberta), e o fechamento perde a referência ao conjunto que conferiu.

## 2. Modelo alvo (compatível com F2, sem antecipar o Modo Curral inteiro)

### 2.1 Campos em `sessoesPesagem`

| Campo | Regra |
|---|---|
| existentes (`id`, `data`, `status`, `operador`, `inicio`, `fim`, `justificativas`) | manter |
| `status` | enum: `ABERTA`, `CONFERENCIA`, `FECHADA`, `CANCELADA` |
| `local` | texto curto (curral), opcional até P-003 |
| `tipo_manejo_padrao` | opcional: pré-seleciona o tipo no Lançamento |
| `marca_padrao_id`, `apartacao_padrao_id` | opcionais: reduzem digitação no curral |
| `snapshot` | objeto gravado no fechamento: contagens, peso total, pendências justificadas, versão |
| `motivo_reabertura` | obrigatório ao reabrir |
| `contadores` | derivados; não persistir |

### 2.2 Regras

1. Uma sessão por `data` + `local` (índice composto; hoje só `data`).
2. `createEntry` recusa evento cujo `sessao_id` está `FECHADA`/`CANCELADA`; nunca cria segunda sessão para a mesma data/local.
3. Fechar exige pendências críticas resolvidas ou justificadas (como hoje), e grava `snapshot`.
4. Reabrir exige motivo; auditoria registra.
5. Importação cria sessão com `operador='IMPORTACAO'` e status `FECHADA` diretamente (dado histórico), sem passar por conferência.

### 2.3 Máquina

```text
ABERTA ──(fechar: sem pendência crítica)──► FECHADA ──(reabrir + motivo)──► ABERTA
ABERTA ──(cancelar: sem eventos)──► CANCELADA
```

`CONFERENCIA` fica reservado para F2 (pausa de captura); não é necessário agora.

## 3. Relação com o Fechamento do Dia

`FechamentoDia` passa a operar sobre a sessão (`sessao_id`) e não sobre `data_pesagem` de toda a base. Ver `DAY-CLOSING-MODEL.md`.

## 4. Migração

- `Aberta`→`ABERTA`, `Fechada`→`FECHADA`.
- Datas com mais de uma sessão: fundir na mais antiga (reapontar `sessao_id` das pesagens), registrar no relatório de migração.
- `local` nulo para todas.

## 5. Fora de escopo agora

Dispositivo, modo de captura, contadores em tempo real, produtividade por hora (REP-004) — F2/F5.

---

<!-- DAY-CLOSING-MODEL.md -->

# DAY-CLOSING-MODEL — Fechamento do dia

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual (`src/pages/FechamentoDia.jsx`)

| Bloco | Como funciona | Avaliação |
|---|---|---|
| Carga | `loadOperationalCatalog()` = **todas** as pesagens + apartações + lotes + animais + sessões | O(N) a cada abertura e após cada ação; inviável em 36 mil+ |
| Filtro | `data_pesagem === date` e apartação opcional | não usa `sessao_id` |
| KPIs | lançamentos, animais únicos, peso médio, GMD médio, lotes movimentados, pendências | corretos para o dia |
| Pendências | GMD negativo (Peso), lançamento sem lote (Lote), Venda sem embarque/documento (Doc) | calculadas na tela; "Justificar" guarda a chave em `Set` local e, ao fechar, em `sessoesPesagem.justificativas` |
| Conferência por lote | contagem de pesagens do dia por lote × capacidade | conta eventos, não animais; ignora `animalLotes` |
| Conferência por marca | agrupamento por `row.marca` texto | ok como painel |
| Ações | Exportar CSV, Backup do dia (JSON das linhas), Fechar/Reabrir | backup do dia é só download no navegador; não passa pelo backup físico validado |
| Fechar | bloqueado se houver pendência não justificada; grava `status='Fechada'` | não gera snapshot; não bloqueia novos lançamentos (ver `WEIGHING-SESSION-MODEL.md`) |
| Reabrir | sem motivo | sem auditoria |
| Navegação | botão "Vincular/Reconferir" leva para `#/PesagensIndividuais` sem filtro | o usuário precisa procurar o registro |
| Visual | `op-screen`/`operational-insights.css` | **não** é ModeloBase1 (ver `MODELOBASE1-PRODUCT-MAP.md`) |

Divergência de regra: o fechamento exige documento para **Venda** (pendência `Doc`, `danger`), mas o Lançamento só obriga documento para **Abate**.

## 2. Modelo alvo

### 2.1 Escopo do fechamento = sessão

Entrada: `sessao_id` (data + local). Consulta: `pesagens.where('sessao_id')` (índice existente) em vez de carregar a base. Animais e lotes carregados apenas para os ids envolvidos.

### 2.2 Pendências (catálogo mínimo, avaliadas no serviço)

| Código | Severidade | Regra | Ação oferecida |
|---|---|---|---|
| `PESO_GMD_NEGATIVO` | atenção | `gmd < 0` | reconferir / justificar |
| `PESO_FORA_FAIXA` | atenção | aviso de conferência aceito com justificativa | ver justificativa |
| `SEM_LOTE` | atenção | Manejo/Cadastro sem `lote_id` | vincular |
| `SAIDA_SEM_OPERACAO` | crítica | Venda/Abate sem `operacao_id` | vincular |
| `ABATE_SEM_EMBARQUE` | crítica | Abate sem `embarque_id` EM_CARREGAMENTO | vincular |
| `VENDA_SEM_DOCUMENTO` | conforme configuração `exigir_documento_venda` | | vincular / justificar |
| `DUPLICIDADE_DIA` | crítica | mesmo animal, dois Manejos | cancelar um |
| `ANIMAL_TEMPORARIO` | atenção | identificador `SN` na sessão | batizar depois |

Crítica bloqueia; atenção pode ser justificada. Justificativa gravada por pendência (`{codigo, pesagem_id, texto, quando}`), não como conjunto de chaves.

### 2.3 Snapshot

Ao fechar: `{versao: 1, contagens por tipo/motivo, animais_unicos, peso_total, gmd_medio_simples, por_lote[], por_marca[], pendencias_justificadas[]}`. Relatório REP-001 lê o snapshot; reabrir invalida (`snapshot_invalido_em`).

### 2.4 Ações

- "Vincular" abre o registro exato (rota com `?editar=<id>` já existe no Lançamento).
- "Backup do dia" passa a ser "Exportar sessão" (CSV/JSON) e o backup fica com a Manutenção.
- Fechar bloqueia novos eventos na sessão (serviço).

### 2.5 UI

Migrar para a Tela Mãe do ModeloBase1: barra de ações (data/sessão, pendências, Fechar), painel de pendências como lista filtrável, conferências como tabelas padrão. KPIs em faixa de resumo (`PesagensResumoRodape` já existe como padrão de rodapé).

## 3. Migração

Nenhuma de dados além de `WEIGHING-SESSION-MODEL.md`. `justificativas[]` antigas (chaves `peso:<id>`) são convertidas em objetos `{codigo, pesagem_id}` quando possível.

## 4. Fora de escopo

Fechamento contábil, conciliação de caixa, aprovação por gerente com assinatura.

---

<!-- UX-FLOW-AUDIT.md -->

# UX-FLOW-AUDIT — Auditoria dos fluxos de uso

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Inventário de telas e rotas

| Rota | Tela | Padrão visual | Estado UX |
|---|---|---|---|
| `PesagensIndividuais` (inicial) | Relação de pesagens | Tela Mãe ModeloBase1 (R34) | conforme |
| `LancamentoPesagensIndividuais` | Lançamento | design v2 (R29–R33) sobre ModeloBase1 | funcional; concentra 6 fluxos |
| `FechamentoDia` | Fechamento do dia | `op-screen` próprio | fora do contrato visual |
| `FichaAnimal` | Ficha do animal | `op-screen` próprio | fora do contrato visual |
| `CadastrosComerciais`, `CausasMorte`, `ConfiguracoesSanidade` | Cadastros auxiliares | Tela Mãe (lista) + FormCard (registro) | conforme na lista; sanidade contradiz ADR-007 |
| `ManutencaoSistema` | Backup e manutenção | cartões | aceitável (tela administrativa) |
| Popups no Lançamento | Apartações/Lotes, Embarques/Documentos, Configurar resumos, Configurar colunas, SN, Selecionar animal, Excluir, Outlier | `d17b-standard-dialog` | os dois primeiros são **cadastros dentro de popup** |

## 2. Fluxo de Manejo (o mais frequente) — como está

```text
1 abrir Lançamento (Tipo já em Manejo)
2 Data (hoje)                         ← já preenchida
3 Sexo/Raça/Era/Marca                ← visíveis e editáveis mesmo em Manejo; valores vêm do Cadastro ao resolver o animal
4 Nº Ident./Nome  → Enter/Tab resolve ← bom: resolução ao concluir
   ├ número em várias marcas → diálogo de escolha
   └ não cadastrado → toast "use Cadastro"
5 Peso → prévia de ganho/GMD/avisos   ← bom
6 Apartação (opcional) → lote automático por faixa
7 Salvar (Enter)                      ← bom; sequência de brincos avança
```

Pontos de atrito:

- quatro campos de cadastro (3) ocupam a linha principal em Manejo, embora sejam somente-leitura na prática;
- a apartação precisa ser reescolhida a cada animal se o operador limpar o formulário; deveria ser "da sessão";
- avisos aparecem em toast e em faixa; três lugares para a mesma mensagem.

## 3. Fluxo de Cadastro — como está

Ver `ANIMAL-REGISTRATION-FLOW.md` §1. Atritos: marca/raça/era digitados; compra escondida no "olhinho"; sequência de brincos escondida em ícone; peso obrigatório.

## 4. Fluxo de Saída — como está

Motivo → (Venda) "Dados da venda" oculto → comprador/valores/documentos por animal; (Abate) embarque + documento obrigatórios → "Dados do abate" oculto → frigorífico/valores. Ver `SALE-FLOW-MODEL.md`, `SLAUGHTER-FLOW-MODEL.md`.

## 5. Ações ocultas ("olhinho") — inventário

| Local | Controle | O que esconde | Recomendação |
|---|---|---|---|
| Lançamento › Cadastro | `Eye/EyeOff` "Dados da compra" | 6 campos de compra | remover; compra vira operação própria |
| Lançamento › Cadastro | ícone `Tag` "Sequência de brincos" | painel de sequência | substituir por seleção de faixa do estoque, sempre visível quando houver faixa ativa |
| Lançamento › Saída/Venda | botão texto "Dados da venda" | 9 campos | remover; venda vira operação |
| Lançamento › Saída/Abate | botão texto "Dados do abate" | 8 campos | remover; abate vira operação |
| Lançamento › Mais opções | `MoreVertical` | gerenciar apartações, embarques, resumos, colunas | manter só colunas e resumos; cadastros saem para telas |
| Popups Apartações/Embarques | `DropdownMenu` por linha | editar/excluir | desaparece com as telas próprias (ações na barra, como na Tela Mãe) |

Regra: toda ação que muda dados fica na barra de ações ou no formulário visível; ícone sem rótulo só para ações de visualização (colunas, filtros).

## 6. Fluxos alvo (resumo)

| Fluxo | Alvo |
|---|---|
| Manejo | Tipo(Manejo) · Nº → resolve · Peso · Salvar. Marca/raça/categoria só exibidos na faixa do animal. Apartação/lote e marca padrão vêm da sessão. |
| Cadastro | tela Animais (ou cadastro rápido no curral com 4 campos). Compra separada. |
| Saída | Motivo · (operação aberta selecionada uma vez) · Nº · Peso · Salvar. |
| Cadastros mestres | telas ModeloBase1 próprias: Marcas, Raças, Categorias, Parceiros, Propriedades, Faixas de identificadores, Apartações/Lotes, Embarques, Causas de morte. |
| Fechamento | Tela Mãe por sessão. |
| Ficha | Tela Mãe modo registro. |

## 7. Critérios de aceite UX (para as fases)

1. Manejo em ≤ 3 campos digitados e 2 teclas de confirmação.
2. Nenhum cadastro em popup dentro do Lançamento.
3. Nenhuma ação de dados escondida atrás de ícone sem rótulo.
4. Todas as telas na Tela Mãe/registro do ModeloBase1, claro e escuro.
5. Uma única mensagem por aviso (faixa), toast só para resultado de salvar.

---

<!-- MODELOBASE1-PRODUCT-MAP.md -->

# MODELOBASE1-PRODUCT-MAP — Aderência ao contrato visual ModeloBase1

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contrato disponível no código

| Peça | Arquivo | Origem |
|---|---|---|
| Estilos base | `src/styles/modelobase1/*.css` (`mg-layout.css` etc.) | copiados do PROJETOMG-main |
| Composição do app | `src/styles/d17b-modelobase1.css` (blocos até `D.17D.2R34`) | específico do Pesagens |
| Tela Mãe (lista) | `MgFilterPanel`, `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`, `MgTablePanelStrip`, `MakTh`, `MakColumnMenu`, `MakFilterRail/Pill`, `MakColumnConfigDialog`, `MakTableSelectCheck`, `MakDateControl` | `src/components/mak/` |
| Registro (formulário) | `FormCard`, `ModeloBase1ViewSeg`, `ModeloBase1PageContainer/Header/ActionBar` | `src/components/modelobase1/`, `CadastroAuxiliarPage.jsx` |
| Diálogos | `d17b-standard-dialog` (`--compact`, `--medium`, `--large`), `d17d-management-dialog` | CSS |
| Evidência de referência | `docs/evidence/modelobase1-referencia/` (01–08 png, `estrutura-dom.json`) | renderização do projeto base |
| Gate | `scripts/verify-ui-consistency.mjs` (R34 + asserções da sessão paralela) | uma asserção paralela em vermelho |

## 2. Mapa por tela

| Tela | Lista (Tela Mãe) | Registro | Diálogos | Escuro | Situação |
|---|---|---|---|---|---|
| Relação de pesagens | ✔ R34 | n/a | colunas, importação | ✔ | conforme |
| Cadastros auxiliares (comerciais, causas, sanidade) | ✔ R34 | ✔ FormCard | excluir | ✔ | conforme |
| Lançamento | barra `mg-action-bar` + grade v2 | formulário v2 | vários `d17b-standard-dialog` | ✔ | conforme no visual; **não** na estrutura (cadastros em popup) |
| Fechamento do dia | ✘ `op-toolbar`/`op-kpis`/`op-card` | n/a | — | parcial (`operational-insights.css`) | **fora do contrato** |
| Ficha do animal | ✘ `op-screen` | ✘ | — | parcial | **fora do contrato** |
| Manutenção | cartões `Card` (shadcn) | n/a | confirmação | ✔ | aceitável para administrativo; migrar quando houver fatia livre |
| Gerenciar Apartações/Lotes (popup) | tabela shadcn dentro de dialog | inline | — | ✔ | substituir por tela própria |
| Gerenciar Embarques/Documentos (popup) | idem | inline | — | ✔ | substituir por tela própria |
| Compradores/Vendas/Abates (popup legado) | idem | inline | — | ✔ | **remover** |

## 3. Telas novas previstas e o padrão a usar

| Tela | Padrão | Componente base |
|---|---|---|
| Marcas, Raças, Categorias, Causas de morte, Parceiros, Propriedades | Tela Mãe + registro | `CadastroAuxiliarPage` com adaptador de persistência para store (hoje só `appSettings`) |
| Faixas de identificadores | Tela Mãe + registro com painel de saldo | idem + faixa de resumo |
| Apartações e lotes | Tela Mãe com duas abas (apartações, lotes) | idem |
| Embarques | Tela Mãe + registro com documentos e animais | idem + tabela secundária |
| Operações comerciais (compra/venda/abate) | Tela Mãe + registro com itens | idem |
| Animais | Tela Mãe + registro (ficha) | idem |
| Fechamento (por sessão) | Tela Mãe com painel de pendências | Relação como referência |

`CadastroAuxiliarPage` precisa de uma **porta de persistência** (`loadGroup/saveGroup` hoje presos ao `registryService`) para servir stores Dexie. Isso é um requisito do plano, não desta auditoria.

## 4. Desvios a corrigir por prioridade

1. Cadastros em popup no Lançamento (estrutura).
2. Fechamento e Ficha fora do contrato (visual).
3. Popup legado de Compradores/Vendas/Abates (duplicidade).
4. Manutenção em cartões (baixa prioridade).

## 5. Regra para o plano

Nenhuma tela nova sem: barra de ações padrão, painel de filtros, pesquisa em pílula, faixa de pílulas, configuração de colunas, modo escuro e asserção no `verify-ui-consistency.mjs` (ADR-016).

---

<!-- CORRAL-USABILITY-AUDIT.md -->

# CORRAL-USABILITY-AUDIT — Usabilidade no curral

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contexto de uso

Ruído, poeira, animais em movimento, operador com uma mão livre, teclado numérico, tela possivelmente com brilho baixo (00 §1). Tudo que exige mouse, leitura de texto longo ou decisão fora do fluxo custa segundos por animal.

## 2. Medição qualitativa do fluxo atual (Manejo)

| Ação | Hoje | Custo |
|---|---|---|
| Abrir a tela | carrega **todas** as pesagens, apartações, lotes, embarques, documentos; reconstrói índice de animais | segundos em base grande (R-01) |
| Campos visíveis antes do Nº | Data, Sexo, Raça, Era, Marca | 4 campos irrelevantes para Manejo no caminho do Tab |
| Digitar Nº + Enter | resolve; abre diálogo se houver marcas duplicadas | bom |
| Faixa do animal | mostra última pesagem, ganho, avisos | bom |
| Peso + Enter | salva? Não: Enter no peso salva se `handleSalvar` estiver ligado; confirmar contrato | verificar no plano |
| Apartação/lote | `Select` com lote automático | bom, mas reescolhido ao limpar |
| Avisos | toast + faixa + diálogo de outlier com justificativa | três canais |
| Após salvar | foco volta ao Nº; sequência avança em Cadastro | bom |
| Erro de identificação | toast vermelho com texto longo e emoji | difícil de ler à distância |

## 3. Problemas por severidade

| Sev. | Problema | Evidência |
|---|---|---|
| Alta | Cadastro no curral exige digitar marca/raça/era e abre compra por ícone | `ANIMAL-REGISTRATION-FLOW.md` |
| Alta | Venda/abate exigem dados comerciais por animal | `SALE-FLOW-MODEL.md` |
| Alta | Abertura da tela lenta em base grande | F0/F1 baseline |
| Média | Campos de cadastro visíveis em Manejo | tela |
| Média | Cadastro de apartação/lote/embarque em popup do Lançamento | popups |
| Média | Mensagens em toast com emoji e frases longas | `animalLookup.jsx`, `handleSalvar` |
| Média | Sem indicação visual grande de "salvo" / "erro" (só toast) | tela |
| Baixa | Sequência de brincos escondida em ícone | `UX-FLOW-AUDIT.md` §5 |
| Baixa | Sem som/feedback configurável | 03 §7 (planejado) |

## 4. Regras de usabilidade para o alvo

1. **Três campos no Manejo** (Nº, Peso, Obs opcional); Tab/Enter percorrem só eles.
2. **Contexto da sessão** (marca padrão, apartação, operação) definido uma vez, visível numa faixa, editável por atalho.
3. **Mensagens curtas e padronizadas** em faixa fixa: `ANIMAL NÃO CADASTRADO`, `JÁ PESADO HOJE`, `INATIVO (VENDIDO 12/08)`, `SALVO 4368 · 312 kg`. Toast só para erro de sistema.
4. **Confirmação visual grande** após salvar (faixa verde por 1 s com número e peso) — sem bloquear o foco.
5. **Teclado numérico**: Enter confirma, `+`/`-` ou F-keys para trocar tipo, Esc limpa; nada exige mouse.
6. **Diálogos por teclado**: seleção de animal com setas/Enter; cadastro rápido com Tab; nunca abrir diálogo enquanto o usuário ainda digita (já é regra: resolver ao concluir).
7. **Nada de valor monetário, documento ou frete** na tela do curral.
8. **Abertura rápida**: carregar apenas a sessão do dia e os índices de cadastro; o histórico do animal é lido sob demanda por `animal_id`.
9. **Fonte e contraste**: faixa do animal e resultado com tipografia maior que a grade (mantendo tokens do ModeloBase1); testar no tema escuro.
10. **Recuperação**: fechar e reabrir o app volta à mesma sessão e ao mesmo contexto (F2, mas o contexto da sessão persistido já ajuda).

## 5. Critérios mensuráveis

- Manejo: ≤ 2 Enter + digitação de Nº e peso; zero cliques.
- Abrir Lançamento: < 1 s na massa de 36 mil (navegador).
- Salvar: p95 < 250 ms (navegador, 36 mil).
- Identificação → peso: < 100 ms.
- Zero popups de cadastro no Lançamento.
- Teste de aceite humano: 50 animais em sequência sem tocar no mouse, gravado em `docs/evidence`.

## 6. O que não fazer

Não adicionar modo "tela cheia especial", gestos, voz ou hardware antes de P-001/P-002; não criar atalho para tudo — só os do caminho crítico.

---

<!-- TARGET-LAUNCH-FLOW.md -->

# TARGET-LAUNCH-FLOW — Fluxo alvo do Lançamento de Pesagens

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Princípios

1. O curral só **seleciona**: marca, raça, categoria, apartação, lote, operação comercial e embarque já existem.
2. O caminho do Manejo tem três campos: identificação, peso, confirmação.
3. Nada é criado implicitamente (animal, marca, parceiro) durante um Manejo.
4. O contexto da sessão (data, local, marca padrão, apartação padrão, operação aberta) é definido uma vez.

## 2. Estrutura da tela (alvo)

```text
┌ Barra de ações (mg-action-bar) ────────────────────────────────────────────────┐
│ Sessão: 14/09/2026 · Curral 1 [trocar]  Tipo: (Manejo|Cadastro|Saída)  Salvar  │
│ Pesquisa · Colunas · Mais opções (resumos, colunas)                             │
├ Faixa de contexto ──────────────────────────────────────────────────────────────┤
│ Marca padrão: ABC · Apartação: ROTINA (lote automático) · Operação: —           │
├ Formulário ─────────────────────────────────────────────────────────────────────┤
│ MANEJO:   [Nº identificação] [Peso kg] [Obs]          faixa do animal: 4368 · ABC · M · Nelore · Garrote · lote MEIO · última 12/08 206 kg · +14 kg · GMD 0,42
│ CADASTRO: [Nº ou próximo da faixa ▾] [Marca ▾] [Sexo] [Raça ▾] [Categoria ▾] [Peso opcional] [Obs]
│ SAÍDA:    [Motivo ▾] [Operação/Embarque aberto ▾ quando Venda/Abate] [Nº] [Peso] [Causa ▾ se Morte] [Obs]
├ Grade da sessão (eventos de hoje) ──────────────────────────────────────────────┤
└ Rodapé de resumos (existente) ──────────────────────────────────────────────────┘
```

Não existem: "Dados da compra", "Dados da venda", "Dados do abate", popups de cadastro, combobox com "Adicionar".

## 3. Fluxos

### 3.1 Manejo (caminho crítico)

| Passo | Tecla | Regra |
|---|---|---|
| Foco inicial em Nº identificação | — | ao abrir e após salvar |
| Digitar/ler identificador | Enter/Tab | resolve por `animalIdentificadores` (índice); mais de um → diálogo por teclado; nenhum → oferecer cadastro rápido (não cria sozinho) |
| Faixa do animal preenche | — | marca, sexo, raça, categoria, lote atual, última pesagem |
| Peso | Enter | prévia de ganho/GMD e avisos de conferência (faixa, não toast) |
| Lote | automático | apartação padrão da sessão + faixa de peso + ocupação por `animalLotes`; mostra "sugerido: MEIO" e permite trocar (registra decisão) |
| Salvar | Enter | transação: evento + projeções + auditoria; foco volta ao Nº; sequência de faixa avança só em Cadastro |

Bloqueios no serviço (não só na tela): animal inativo, duplicidade no dia, data anterior ao cadastro, sessão fechada.

### 3.2 Cadastro (curral)

Opção A (preferida): cadastrar pela tela Animais antes de pesar. Opção B (rápido): diálogo mínimo com Nº (próximo livre da faixa selecionada ou digitado), Marca (padrão), Sexo, Raça (padrão), Categoria (sugerida); peso opcional. Compra **não** aparece aqui.

### 3.3 Saída

Motivo → se Venda/Abate: selecionar operação aberta (obrigatória para Abate; para Venda conforme configuração) → Nº → Peso → Salvar. Comprador, frigorífico, preço, documentos vêm da operação; nada é digitado por animal. Morte: causa (cadastro) + observação se a causa exigir.

### 3.4 Edição

Continua por `?editar=<id>`; campos de cadastro do animal **não** são editáveis a partir da pesagem (vão para Animais).

## 4. O que sai do arquivo `LancamentoPesagensIndividuais.jsx`

| Bloco atual | Destino |
|---|---|
| estados de compra/venda/abate (≈ 25 `useState`) | operações comerciais |
| `GerenciarApartacoesDialog`, `GerenciarEmbarquesDialog` | telas próprias |
| `marcasExistentes/racasExistentes/erasExistentes` derivados das pesagens | cadastros |
| `numerosUsados` + `SequenciaBrincos` com `window.__sequenciaBrincos` | serviço de faixas |
| `configuracoesPorTipoRef` (lembra valores por tipo) | contexto da sessão persistido |
| `getLoteAutomatico`/`isLoteCheio` na tela | serviço de lote (`HERD-LOT-MODEL.md`) |
| validações duplicadas (peso opcional por motivo, duplicidade do dia) | domínio |

Estimativa qualitativa: a página cai para uma fração do tamanho atual e passa a orquestrar serviços; os componentes de faixa, grade e rodapé permanecem.

## 5. Critérios de aceite

- Manejo: Nº → Enter → Peso → Enter salva, com foco de volta ao Nº, sem mouse.
- Nenhum campo de cadastro editável em Manejo/Saída.
- Nenhum popup de cadastro acessível a partir do Lançamento.
- Salvamento p95 dentro do orçamento na massa de 36 mil no navegador.
- Gates `ui:operational-customization` e `ui:consistency` reescritos para o contrato novo (não "consertados" para o antigo).

---

<!-- TARGET-SCREEN-MAP.md -->

# TARGET-SCREEN-MAP — Mapa de telas alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Menu alvo (ordem de uso)

```text
Operação
  Lançamento de pesagens        (existe; enxugar)
  Relação de pesagens           (existe; Tela Mãe)
  Fechamento da sessão          (existe como "do dia"; refazer na Tela Mãe)
Rebanho
  Animais                       (novo; lista + ficha; absorve "Ficha do Animal")
  Apartações e lotes            (novo; sai do popup)
  Faixas de identificadores     (novo)
Comercial
  Operações (compra/venda/abate) (novo; v8)
  Embarques                     (novo; sai do popup)
Cadastros
  Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de morte   (novos/migrados)
Sistema
  Backup e manutenção           (existe)
  Configurações                 (novo, simples: padrões da empresa, políticas de aviso, documento em venda)
```

Removidos: "Configurações de Sanidade" (ADR-007), popup "Compradores, Vendas e Abates", popups de Apartações e Embarques dentro do Lançamento.

## 2. Telas

| Tela | Rota (proposta) | Padrão | Fonte de dados | Ações principais | Existe? |
|---|---|---|---|---|---|
| Lançamento | `LancamentoPesagensIndividuais` | v2 sobre ModeloBase1 | eventos da sessão, animal resolvido por identificador | Salvar, Próximo, Editar, Excluir; seleção de sessão/operação | sim (2 182 linhas → reduzir) |
| Relação | `PesagensIndividuais` | Tela Mãe | `pesagens` paginado + mapas de cadastro | filtros, pesquisa, colunas, exportar, importar | sim |
| Fechamento da sessão | `FechamentoSessao` | Tela Mãe + painel de pendências | `sessoesPesagem` + eventos por `sessao_id` | fechar, reabrir (motivo), justificar, exportar | parcial |
| Animais | `Animais` | Tela Mãe + registro | `animais`, identificadores, marcas/raças/categorias | novo, editar, inativar, trocar identificador, lançar pesagem | não (Ficha existe) |
| Ficha do animal | `Animais?id=` (modo registro) | registro | ver `ANIMAL-PROFILE-MODEL.md` | exportar histórico | parcial |
| Apartações e lotes | `ApartacoesLotes` | Tela Mãe (2 abas) | `apartacoes`, `loteApartacoes`, ocupação por `animalLotes` | novo, editar, fechar lote | popup |
| Faixas de identificadores | `FaixasIdentificadores` | Tela Mãe + registro com saldo | `faixasIdentificadores`, exceções | nova faixa, marcar perdido, ver uso | não |
| Operações comerciais | `OperacoesComerciais` | Tela Mãe + registro com animais | `operacoesComerciais`, eventos por `operacao_id` | nova compra/venda/abate, adicionar animais, conferir, fechar, cancelar, retorno de frigorífico | não |
| Embarques | `Embarques` | Tela Mãe + registro | `embarques`, documentos, eventos por `embarque_id` | novo, documentos, transições de estado | popup |
| Marcas | `Marcas` | Tela Mãe + registro | `marcas` | novo, editar, inativar, definir padrão | não |
| Raças | `Racas` | idem | `racas` | idem | não |
| Categorias | `Categorias` | idem | `categoriasAnimal` | idem, faixas de idade | não |
| Parceiros | `Parceiros` | Tela Mãe (filtro por papel) + registro | `parceiros` | novo, editar, papéis, inativar | sim (comerciais em appSettings) |
| Propriedades | `Propriedades` | idem | `propriedades` | | não |
| Causas de morte | `CausasMorte` | idem | `causasMorte` | | sim (appSettings) |
| Backup e manutenção | `ManutencaoSistema` | cartões → Tela Mãe quando houver fatia | backup, integridade, importação JSON, restore, **migração/backfill v7** | | sim |
| Configurações | `Configuracoes` | registro simples | `appSettings` | padrões, políticas | não |

## 3. Diálogos que permanecem

Selecionar animal (mesmo número em marcas), Cadastro rápido de animal (curral), Confirmar SN, Aviso de conferência (outlier), Excluir/Cancelar com motivo, Configurar colunas, Configurar resumos, Importação (assistente).

## 4. Ordem de construção (alinhada ao roadmap)

1. Marcas, Raças, Categorias, Causas de morte, Parceiros (Tela Mãe genérica com porta de store).
2. Faixas de identificadores.
3. Animais (lista + ficha).
4. Lançamento enxuto (seleção de cadastros; sem popups; sem olhinho).
5. Apartações e lotes; Embarques.
6. Operações comerciais.
7. Fechamento da sessão.
8. Configurações; Manutenção com migração.

## 5. Critério por tela

Cada tela nova entra com: asserção em `verify-ui-consistency.mjs`, captura claro/escuro em `docs/evidence`, atalhos de teclado do padrão (Enter salva, Esc fecha, F-keys da Tela Mãe se existirem), e registro na documentação do usuário.

---

<!-- MASTER-REGISTRY-MAP.md -->

# MASTER-REGISTRY-MAP — Mapa dos cadastros mestres

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Princípio

"Cadastros antes do lançamento; o lançamento seleciona dados existentes." Cadastro mestre é toda informação que (a) é reutilizada em muitos eventos, (b) precisa de unicidade/inativação, ou (c) é referenciada por id em relatório. O resto é enum de código ou configuração.

## 2. Mapa

| Cadastro | Hoje | Alvo | Chave de unicidade | Tem `padrao`? | Inativação | Usado por | Prioridade |
|---|---|---|---|---|---|---|---|
| Marca | texto livre | store `marcas` | `nome_normalizado` por empresa | sim | sim | animal, identificador, faixa, filtros | 1 |
| Raça | texto livre (`Nelore` fixo) | store `racas` | `nome_normalizado` | sim | sim | animal, cadastro rápido, relatórios | 1 |
| Categoria animal | não existe (era livre) | store `categoriasAnimal` | `nome_normalizado` | não (sugerida) | sim | animal, lote objetivo, relatórios | 1 |
| Causa de morte | appSettings | store `causasMorte` | `nome_normalizado` | não | sim | saída por morte | 1 |
| Parceiro | appSettings (3 listas) + perfis legado | store `parceiros` com papéis | `documento` ou `nome_normalizado` | não | sim | compra, venda, abate, embarque, marca (proprietário) | 1 |
| Faixa de identificadores | não existe | store `faixasIdentificadores` | tipo + marca + prefixo + intervalo sem sobreposição | não | `situacao` | cadastro do animal, sequência | 2 |
| Apartação | store, popup | store, tela própria | `nome_apartacao` normalizado | não | `ativo` | lançamento, lotes, fechamento | 2 |
| Lote | store `loteApartacoes`, popup | tela própria | `nome_lote` por apartação | não | `situacao` | lançamento, permanência, fechamento | 2 |
| Propriedade | texto no vendedor | store `propriedades` (opcional) | `nome_normalizado` | sim (própria) | sim | compra (origem), transferência (destino), marca | 3 |
| Embarque | store, popup | tela própria com estados | `nome` + data | não | `CANCELADO` | saída, operação | 3 |
| Sessão | automática | automática + padrões | `data + local` | — | `CANCELADA` | lançamento, fechamento | 3 |

Enums de código (não viram cadastro): sexo (`M/F`), tipo de evento (`CADASTRO/MANEJO/SAIDA`), motivo de saída (`Venda/Abate/Morte/Doação/Transferência/Outros`), tipo de documento (`GTA/NF-e/GTA+NF-e`), tipo de identificador, papéis de parceiro, status de embarque/operação/sessão.

Configurações (não viram cadastro): raça/marca/propriedade padrão (referências), política de avisos, exigir documento em venda, intervalo de pesagem vencida, rendimento padrão da empresa, modelos de importação, resumos personalizados.

## 3. Comportamentos comuns a todos os cadastros mestres

1. Tela Mãe do ModeloBase1 (lista) + registro; ações na barra; sem ícones ocultos.
2. `nome_normalizado` gerado no serviço; duplicidade recusada com mensagem clara.
3. Inativar em vez de excluir quando houver vínculo; excluir só sem vínculo (soft-delete com `deleted_at`).
4. Auditoria CRIAR/ATUALIZAR/CANCELAR (resumo de campos).
5. Importação CSV pelo assistente comum.
6. Contagem de uso visível na lista (animais ativos por marca, animais por raça, operações por parceiro) — calculada por índice, não por varredura das pesagens.
7. `empresa_id` presente, valor `'local'`.

## 4. Ordem de implementação recomendada

1. Marcas, Raças, Categorias, Causas de morte, Parceiros — todos com a mesma página genérica, num único slice de UI.
2. Faixas de identificadores — segundo slice, pois depende de marcas.
3. Apartações/Lotes e Embarques — telas que retiram popups do Lançamento.
4. Propriedades — quando DEC-013 for aceita.

---

<!-- TARGET-ENTITY-MAP.md -->

# TARGET-ENTITY-MAP — Mapa de entidades alvo e classificação

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Escala

| Classe | Critério |
|---|---|
| ESSENCIAL | sem ela o lançamento fica lento, ambíguo ou perde rastreabilidade |
| ÚTIL | melhora conferência ou relatório; pode entrar depois da essencial |
| FUTURO | depende de decisão pendente (P-00x) ou de fase F5+ |
| DESNECESSÁRIO | não deve existir no produto (evita ERP/CRM/WMS/veterinário) |

## 2. Entidades

| Entidade | Store | Classe | Fase sugerida | Depende de | Documento |
|---|---|---|---|---|---|
| Animal (cadastro + projeção) | `animais` | ESSENCIAL (existe) | v7 ajustes | marcas, raças, categorias | `ANIMAL-LIFECYCLE-TARGET.md` |
| Identificador do animal | `animalIdentificadores` | ESSENCIAL (existe) | v7 ajustes | marcas, faixas | `ANIMAL-IDENTIFICATION-MODEL.md` |
| Marca | `marcas` | ESSENCIAL | v7 | — | `BRAND-REGISTRY-MODEL.md` |
| Raça | `racas` | ESSENCIAL | v7 | — | `BREED-REGISTRY-MODEL.md` |
| Categoria animal | `categoriasAnimal` | ESSENCIAL | v7 | DEC-012 | `ANIMAL-CLASSIFICATION-MODEL.md` |
| Faixa de identificadores | `faixasIdentificadores` | ESSENCIAL | v7 | marcas, DEC-002 | `IDENTIFIER-INVENTORY-MODEL.md` |
| Exceção de identificador | `excecoesIdentificadores` | ESSENCIAL (com a faixa) | v7 | faixas | idem |
| Evento do animal (pesagem/cadastro/saída) | `pesagens` | ESSENCIAL (existe) | v7 índices | — | `WEIGHING-DOMAIN-MODEL.md` |
| Sessão de pesagem | `sessoesPesagem` | ESSENCIAL (existe) | v7 enum/snapshot | — | `WEIGHING-SESSION-MODEL.md` |
| Apartação | `apartacoes` | ESSENCIAL (existe) | v7 pequenos ajustes | — | `HERD-LOT-MODEL.md` |
| Lote | `loteApartacoes` | ESSENCIAL (existe) | v7 | categorias | idem |
| Permanência em lote | `animalLotes` | ESSENCIAL (existe) | — | — | idem |
| Movimento | `movimentosAnimais` | ESSENCIAL (existe) | preencher origem | — | idem |
| Parceiro (comprador/vendedor/frigorífico/transportador/proprietário) | `parceiros` | ESSENCIAL | v7 | — | `COMMERCIAL-REGISTRY-MODEL.md` |
| Causa de morte | `causasMorte` | ESSENCIAL (existe em appSettings) | v7 | — | `MORTALITY-MODEL.md` |
| Propriedade | `propriedades` | ÚTIL | v7 (opcional) / F7 | DEC-013 | `PROPERTY-FARM-MODEL.md` |
| Operação comercial (compra/venda/abate) | `operacoesComerciais` | ÚTIL → ESSENCIAL para relatório comercial | v8 | parceiros | `PURCHASE/SALE/SLAUGHTER-FLOW-MODEL.md` |
| Embarque | `embarques` | ESSENCIAL (existe) | v8 enum/parceiro | parceiros | `SHIPMENT-FLOW-MODEL.md` |
| Documento de embarque | `documentosEmbarque` | ESSENCIAL (existe) | v8 | — | idem |
| Auditoria | `auditoria` | ESSENCIAL (existe) | v7 resumo | — | `TARGET-PERFORMANCE-RISKS.md` |
| Importação (job) | `importacoes` | ESSENCIAL (existe) | — | — | `IMPORT-TARGET-MODEL.md` |
| Configuração | `appSettings` | ESSENCIAL (existe) | v7 limpeza | — | `APPSETTINGS-AUDIT.md` |
| Backup (histórico) | `backupHistory` | ESSENCIAL (existe) | — | — | `BACKUP-V7-IMPACT.md` |
| Regra de apartação versionada | — | FUTURO (F4) | — | ADR-010 | 02 §4.7 |
| Dispositivo / leitura de equipamento | — | FUTURO (F5) | — | P-001/P-002 | 05 |
| Empresa / fazenda / curral / usuário / papel | — | FUTURO (F7) | — | P-003/P-006 | 06 |
| Outbox / conflito | — | FUTURO (F7) | — | P-005 | 06 |
| Store `lotes` | `lotes` | DESNECESSÁRIO | remover v7 | DEC-007 | `HERD-LOT-MODEL.md` |
| Programa sanitário / medicamento | (appSettings) | DESNECESSÁRIO (ADR-007) | remover | DEC-006 | `SANITY-ADR-REVIEW.md` |
| Perfil de venda/abate (`perfis-saida`) | (appSettings) | DESNECESSÁRIO | remover | — | `SALE-FLOW-MODEL.md` |
| Estoque de insumos, unidade de medida, movimentação de estoque | — | DESNECESSÁRIO | — | DEC-017 | `INVENTORY-SCOPE-DECISION.md` |
| Item de embarque como store | — | DESNECESSÁRIO (o evento de saída é o item) | — | — | `SHIPMENT-FLOW-MODEL.md` |
| Snapshot/cache de relatório | — | DESNECESSÁRIO agora | — | ADR-017 | `REPORTING-DATA-REQUIREMENTS.md` |
| Contas a pagar/receber, NF-e, contrato, CRM | — | DESNECESSÁRIO | — | 00 §6 | — |

## 3. Diagrama alvo (v7 + v8)

```text
marcas ◄──── animais ────► racas
   ▲            │ ▲  └────► categoriasAnimal
   │            │ └──────── propriedades (opcional)
faixasIdentificadores ◄── animalIdentificadores ──► animais
   └── excecoesIdentificadores
animais 1──N pesagens (eventos) N──1 sessoesPesagem
pesagens ──► loteApartacoes ──► apartacoes
pesagens ──► operacoesComerciais ──► parceiros
pesagens ──► embarques ──► documentosEmbarque ; embarques ──► parceiros
pesagens (SAÍDA/Morte) ──► causasMorte
animais 1──N animalLotes ; animais 1──N movimentosAnimais
auditoria, importacoes, appSettings, backupHistory (plataforma)
```

## 4. Contagem

- Stores hoje: 16 (15 de domínio/plataforma + `lotes` sem uso).
- Stores alvo v7: 16 − 1 (`lotes`) + 8 (`marcas`, `racas`, `categoriasAnimal`, `parceiros`, `causasMorte`, `faixasIdentificadores`, `excecoesIdentificadores`, `propriedades` opcional) = 23.
- v8: + `operacoesComerciais` = 24.

Cada store nova tem uma tela ModeloBase1 correspondente ou é auxiliar de outra (`excecoesIdentificadores` aparece dentro da faixa).

---

<!-- DEXIE-V7-TARGET-MODEL.md -->

# DEXIE-V7-TARGET-MODEL — Modelo alvo do esquema Dexie v7

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Stores atuais (v6) e destino

| Store atual | Papel | Manter | Alterar | Substituir | Nova relação necessária | Observação |
|---|---|---|---|---|---|---|
| `pesagens` | eventos do animal (Cadastro/Manejo/Saída) + payload | Sim | Sim: índices `motivo_saida`, `operacao_id`; colunas `marca_id`, `categoria_id`, `causa_morte_id`, `apartacao_id`, `versao_formula` | Não | `operacoesComerciais`, `marcas`, `categoriasAnimal`, `causasMorte` | `legacy_payload` congelado (ver `LEGACY-PAYLOAD-AUDIT.md`) |
| `apartacoes` | agrupamento de lotes | Sim | Sim: `ativo`, `ordem` | Não | — | cadastro em tela própria |
| `loteApartacoes` | lote (canônico) | Sim | Sim: `situacao`, `codigo`, `categoria_id`; remover `nome_apartacao` desnormalizado | Não | `categoriasAnimal` | |
| `lotes` | sem uso | **Não** | — | — | — | remover em v7 (`REMOVED_STORES_V7`), após ADR e verificação de vazio |
| `embarques` | viagem | Sim | Sim: `status` enum, `parceiro_id`, `transportador_id`, `motorista`, `placas`, `capacidade` | Não | `parceiros` | máquina de estados no serviço |
| `documentosEmbarque` | GTA/NF-e | Sim | Sim: `tipo` enum; motorista/placa migram para o embarque quando único | Não | — | |
| `animais` | cadastro + projeção | Sim | Sim: `marca_id`, `raca_id`, `categoria_id`, `nascimento`, `nascimento_estimado`, `propriedade_id`, `situacao` enum do ciclo | Não | `marcas`, `racas`, `categoriasAnimal`, `propriedades` | texto `marca/raca/era` mantido como legado somente-leitura |
| `animalIdentificadores` | identificadores | Sim | Sim: `tipo` enum, `marca_id`, `faixa_id`, `inicio`, `fim`, `motivo_troca`; índice `[marca_id+valor_normalizado]` | Não | `marcas`, `faixasIdentificadores` | unicidade aplicativa em transação |
| `movimentosAnimais` | movimentos | Sim | Sim: passar a gravar `lote_origem_id` | Não | — | |
| `animalLotes` | permanência | Sim | Não | Não | — | |
| `sessoesPesagem` | sessão por data | Sim | Sim: `status` enum, `local`, `snapshot`, `motivo_reabertura`, padrões; índice `[data+local]` | Não | — | bloqueio de eventos em sessão fechada |
| `auditoria` | trilha | Sim | Sim: `resumo` (campos alterados) em vez de `antes/depois` integrais para ATUALIZAR em massa | Não | — | ver `TARGET-PERFORMANCE-RISKS.md` |
| `importacoes` | jobs de importação | Sim | Não | Não | — | |
| `appSettings` | configuração | Sim | Sim: retirar catálogos (`cadastros-auxiliares:*`, `perfis-saida:*`) | Não | — | ver `APPSETTINGS-AUDIT.md` |
| `backupHistory` | histórico de backup | Sim | Não | Não | — | |

## 2. Stores novas (v7)

| Store | Índices | Documento |
|---|---|---|
| `marcas` | `++localId, &id, empresa_id, nome_normalizado, ativo` | `BRAND-REGISTRY-MODEL.md` |
| `racas` | `++localId, &id, empresa_id, nome_normalizado, ativo` | `BREED-REGISTRY-MODEL.md` |
| `categoriasAnimal` | `++localId, &id, empresa_id, nome_normalizado, ativo` | `ANIMAL-CLASSIFICATION-MODEL.md` |
| `parceiros` | `++localId, &id, empresa_id, nome_normalizado, *papeis, ativo` | `COMMERCIAL-REGISTRY-MODEL.md` |
| `propriedades` | `++localId, &id, empresa_id, nome_normalizado, ativo` | `PROPERTY-FARM-MODEL.md` (opcional na v7) |
| `causasMorte` | `++localId, &id, empresa_id, nome_normalizado, ativo` | `MORTALITY-MODEL.md` |
| `faixasIdentificadores` | `++localId, &id, empresa_id, tipo, marca_id, situacao` | `IDENTIFIER-INVENTORY-MODEL.md` |
| `excecoesIdentificadores` | `++localId, &id, [faixa_id+numero]` | idem |
| `operacoesComerciais` | `++localId, &id, empresa_id, tipo, status, parceiro_id, embarque_id, data` | `PURCHASE/SALE/SLAUGHTER-FLOW-MODEL.md` — pode ficar para **v8** se a fatia comercial for adiada |

Recomendação de corte: **v7 = cadastros mestres + identificadores + ajustes de `animais`/`animalIdentificadores`/`sessoesPesagem`/`pesagens` índices; v8 = operações comerciais + embarque enum.** Duas migrações pequenas são mais seguras que uma grande (07 §1).

## 3. Migração v6 → v7 (ordem)

1. Backup físico validado (já exigido por `applyRestore`; a migração deve exigir o mesmo `safetyEvidence` — ponto novo, pois `db.version().upgrade` roda na abertura sem backup).
2. Criar stores novas vazias.
3. Semear `marcas/racas/categoriasAnimal/causasMorte/parceiros` a partir dos valores distintos (com dry-run prévio gerado em Manutenção e salvo em `docs/evidence`).
4. Preencher `marca_id/raca_id/categoria_id` em `animais` e `marca_id` em `animalIdentificadores`.
5. Promover índices em `pesagens` (`motivo_saida`, `operacao_id`) lendo do payload.
6. Converter enums (`situacao`, `status`, `tipo`).
7. Remover `lotes`.
8. Verificar contagens e `logicalIntegrity` estendido; gravar `backupHistory('migration-v7')`.

Ponto de atenção do Dexie: `upgrade()` roda dentro da transação de versão; leituras grandes (36 mil `modify`) já acontecem na v6. Para 250 mil, medir; se preciso, migrar em duas aberturas (v7 estrutura, v7.1 backfill em lote fora da transação de versão) — decisão a tomar com o baseline.

## 4. Backup e restauração

`STORE_NAMES` deriva de `STORES`, então as novas stores entram automaticamente no backup completo. Backups v6 restaurados em app v7 recebem stores vazias (comportamento já existente para `missingStores`), **mas** os campos novos (`marca_id`…) ficam nulos: a restauração de um backup v6 deve disparar o backfill (passo 3–6) após o restore. Ver `BACKUP-V7-IMPACT.md`.

## 5. Gates afetados

`storage:dexie:verify`, `storage:backup:verify`, `storage:import-restore:verify`, `animal:history-integrity:verify`, `enterprise:hardening:verify`, `perf:contract:verify` (massa de teste precisa gerar marcas/raças por id).

---

<!-- APPSETTINGS-AUDIT.md -->

# APPSETTINGS-AUDIT — O que vive em `appSettings` e em `localStorage`

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Chaves em `appSettings` (Dexie, store `key → value`)

| Chave | Conteúdo | Escrita por | Lida por | Classificação | Destino |
|---|---|---|---|---|---|
| `cadastros-auxiliares:comerciais:<empresa>` | `{compradores[], vendedores[], frigorificos[]}` | `registryService.saveRegistryGroup` (via `CadastroAuxiliarPage`) | `LancamentoPesagensIndividuais` (`auxiliaryCatalogs`) | **DEVERIA VIRAR STORE** | `parceiros` (v7) |
| `cadastros-auxiliares:mortalidade:<empresa>` | `{causasMorte[]}` | idem | Lançamento (causa da morte) | **DEVERIA VIRAR STORE** | `causasMorte` (v7) |
| `cadastros-auxiliares:sanidade:<empresa>` | `{programasSanidade[], medicamentos[]}` | idem | ninguém operacionalmente | **LEGADO** (contradiz ADR-007) | remover (`SANITY-ADR-REVIEW.md`) |
| `perfis-saida:<empresa>` | `{compradores[], venda[], abate[]}` | `GerenciarSaidasDialog`; `registryService` reescreve `compradores` a cada gravação | `GerenciarSaidasDialog`, `registryService.loadRegistryGroup` (compat) | **LEGADO** e DUPLICADO | migrar compradores para `parceiros`; descartar perfis |
| `resumo-personalizado:<empresa>` | lista de resumos configurados (campo, operação, escopo, agrupamento) | `ConfigurarResumosDialog` via Lançamento | Lançamento (`ResumoPersonalizado`) | **CONFIGURAÇÃO REAL** | manter |

Não há outras chaves gravadas pelo código atual (grep em `src/`: só `settingsService`, `registryService`, `GerenciarSaidasDialog`, Lançamento).

## 2. Chaves em `localStorage` (fora do backup)

| Chave | Conteúdo | Classificação | Observação |
|---|---|---|---|
| `empresa_selecionada_id` | `'local'` | CONFIGURAÇÃO REAL (de instalação) | fixa até F7 |
| `erp-tema` | claro/escuro | CONFIGURAÇÃO REAL (de usuário) | |
| `pesagens-colunas-*`, `aux-colunas:<grupo>:ordem|visiveis`, filtros salvos das telas | ordem/visibilidade de colunas | CONFIGURAÇÃO REAL (de usuário) | aceitável fora do backup; documentar que reinstalar perde |

## 3. Regras propostas

1. `appSettings` guarda **somente** configuração: preferências, políticas com versão (`politica-avisos`, `exigir_documento_venda`), resumos personalizados, última sessão aberta. Nada com id, histórico, contagem ou vínculo.
2. Catálogo com poucos valores e sem vínculo (ex.: lista de UFs) pode ser **CATÁLOGO SIMPLES** em `appSettings` — hoje não existe nenhum caso; sexo (`M/F`) e motivos de saída são enums de código, e devem continuar assim.
3. Toda chave nova recebe versão no valor (`{versao: 1, ...}`) para permitir migração sem tabela.
4. `registryService` é substituído por serviços de store; `CadastroAuxiliarPage` recebe uma porta de persistência.

## 4. Migração

Ordem: exportar as chaves atuais para JSON (evidência) → criar stores → semear → validar contagens → apagar chaves `cadastros-auxiliares:*` e `perfis-saida:*`. `resumo-personalizado` permanece.

## 5. Risco

`registryService.saveRegistryGroup` regrava o JSON inteiro por gravação e mantém sincronismo com `perfis-saida`; enquanto a migração não acontece, qualquer nova funcionalidade que grave nesses catálogos aumenta a dívida. Recomendação: **congelar** novas chaves de catálogo em `appSettings` a partir desta auditoria.

---

<!-- LEGACY-PAYLOAD-AUDIT.md -->

# LEGACY-PAYLOAD-AUDIT — `pesagens.legacy_payload`

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Como funciona

- `uiToStorageRecord` grava `legacy_payload = { ...uiPayload }` (cópia integral do objeto da tela, exceto `sanidade_ids/sanidades`), além das colunas `id, data_pesagem, peso_kg, lote_id, animal_id, tipo_pesagem, observacao`.
- `storageRecordToViewModel` faz `{ ...legacy, _localId, id, data_pesagem, peso, peso_kg, lote_id, animal_id, tipo_manejo, observacao, created_date, updated_date }`.
- O adapter lê regras de negócio **do payload**: `tipo_manejo`, `motivo_saida`, `apartacao_id`, `numero_animal`, `marca`, `operador`, `origem`, `sessao_id`.
- Recálculo de série grava `legacyPayload: { ...entry, ...patch }` (o view model inteiro de volta no payload).

## 2. Inventário de chaves (origem: objeto `data` em `LancamentoPesagensIndividuais.handleSalvar`, importação e recálculo)

| Chave | Origem | Classificação | Ação alvo |
|---|---|---|---|
| `id`, `data_pesagem`, `peso`, `observacao`, `animal_id`, `lote_id` | tela | DUPLICADA das colunas | remover do payload após promover (mapper já prefere coluna) |
| `empresa_id` | tela (`'local'`) | ESTRUTURAL | coluna indexada quando F7 |
| `tipo_manejo` | tela | ESTRUTURAL, fonte atual da regra | coluna `tipo_pesagem` vira fonte (F0-01 §10) |
| `motivo_saida`, `causa_morte`, `status_animal` | tela | ESTRUTURAL | `motivo_saida` coluna indexada; `causa_morte_id` coluna; `status_animal` **remover** (redundante com projeção) |
| `numero_animal`, `sexo`, `raca`, `era`, `marca` | tela | SNAPSHOT DO FATO | manter no payload (ou colunas não indexadas) + `marca_id/raca_id/categoria_id` novos |
| `apartacao_id`, `nome_apartacao`, `nome_lote` | tela | `apartacao_id` estrutural; nomes = SNAPSHOT | `apartacao_id` coluna; nomes ficam, **sem propagação** ao renomear |
| `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | serviço | DERIVADO | manter; acrescentar `versao_formula` |
| `alertas_confirmados`, `justificativa_alerta` | tela | FATO (pendência aceita) | manter |
| `valor_pago_cabeca`, `origem_animal`, `documentacao` (string JSON) | tela | COMERCIAL (compra) | migrar para `operacoesComerciais`; congelar como legado |
| `comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas` | tela | COMERCIAL (venda) | idem |
| `frigorifico`, `valor_arroba_abate`, `valor_total_abate` | tela | COMERCIAL (abate) | idem |
| `embarque_id`, `embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` | tela | `embarque_id` já é coluna; resto é CÓPIA de `documentosEmbarque` | parar de copiar; junção por id |
| `sessao_id`, `operador`, `origem` | adapter/importação | ESTRUTURAL | `sessao_id` já é coluna; `operador`/`origem` colunas simples |
| `id_externo` | importação | REFERÊNCIA | coluna não indexada |
| `created_date`, `updated_date` | view model | DUPLICADA de `created_at/updated_at` | remover |
| `_localId`, `peso_kg` | **vazamento** do view model em `updateEntry`/recalculo (`merged = {...existing, ...uiPayload}` → `legacySnapshot`) | LIXO | limpar na migração; corrigir origem no plano |
| `sanidade_ids`, `sanidades` | removidos na v6 | — | já tratado |

## 3. Por que "não pode crescer indefinidamente"

1. **Crescimento por edição:** cada `updateEntry` copia o view model inteiro (inclusive `_localId`, `peso_kg`, `created_date`) de volta ao payload; cada recálculo faz o mesmo. Um registro editado n vezes carrega chaves que não existiam ao ser criado.
2. **Crescimento por cópia:** dados de embarque/documento/parceiro são replicados em cada pesagem; renomear propaga escrita em massa.
3. **Auditoria:** `auditoria.antes/depois` guardam o registro **com** o payload; toda edição coletiva grava 2× o payload por registro.
4. **Backup:** o JSON de backup contém o payload de cada pesagem mais as cópias na auditoria — o tamanho cresce mais que linearmente com edições.

Medição recomendada antes da v7 (não feita nesta auditoria para não alterar nada): tamanho médio do payload por registro na massa de 36 mil e proporção `auditoria`/`pesagens` em bytes.

## 4. Estratégia alvo: congelar, promover, parar de copiar

| Fase | Ação |
|---|---|
| Agora (regra) | nenhuma **nova** chave entra no payload; toda informação nova nasce em coluna ou em store própria |
| v7 | promover `motivo_saida`, `operacao_id`, `apartacao_id`, `marca_id`, `categoria_id`, `causa_morte_id`, `versao_formula`; limpar `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal` do payload |
| v7 | `uiToStorageRecord` grava no payload **apenas** as chaves da lista permitida (snapshot + derivados + pendências + legado congelado) |
| v8 | após migrar comercial/embarque, campos comerciais e cópias de documento passam a somente-leitura (`legacy_comercial`) e deixam de ser gravados |
| depois | quando nenhum consumidor ler o bloco legado, remover com migração e backup |

## 5. Ordem de leitura garantida

Para não quebrar dados antigos: coluna → payload → nulo. O mapper já faz isso para as colunas existentes; a regra deve valer para cada campo promovido, com teste no gate `weighing:mapper:verify`.

---

<!-- TARGET-PERFORMANCE-RISKS.md -->

# TARGET-PERFORMANCE-RISKS — Riscos de desempenho do modelo alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Referência (F0/F1)

| Métrica p95 | F0 Node 36 mil | F0 navegador 36 mil | F1 Node 36 mil | Orçamento |
|---|---:|---:|---:|---:|
| Busca indexada por animal | 1,8 ms | 13 ms | 0,24 ms | < 100 ms |
| Identificação → peso | 8 ms | 20 ms | 2,8 ms | < 100 ms |
| Salvamento local | 4 980 ms | 3 169 ms | 76 ms | < 250 ms |
| Reconstrução do índice de animais (tela) | ~2 000 ms | 7 423 ms | pendente | — |

Fontes: `docs/evidence/f0-baseline/BASELINE.md`, `f1-optimized-final/BASELINE.md`, `F1-STATUS.md`. O navegador ainda não foi remedido após F1.

## 2. Riscos existentes que o modelo alvo herda

| ID | Risco | Onde | Efeito em 36 mil / 250 mil | Mitigação no alvo |
|---|---|---|---|---|
| R-01 | Índice de animais reconstruído das pesagens a cada recarga (D8) | Lançamento (`getRegisteredAnimals`) | 2–7 s / dezenas de s | resolver por `animalIdentificadores` + `animais` (índices); pendência F1 |
| R-02 | `FechamentoDia` e `FichaAnimal` carregam a base inteira | `loadOperationalCatalog` | segundos por abertura e por ação | consultas por `sessao_id` e `animal_id` |
| R-03 | Ocupação de lote por contagem de pesagens | `isLoteCheio` | O(N) por avaliação de lote, por animal | `animalLotes` abertos por `lote_id` |
| R-04 | Renomear apartação/lote regrava todas as pesagens + auditoria | `propagateApartacaoRename` | escrita em massa; auditoria dobra | parar de propagar; junção por id |
| R-05 | `auditoria.antes/depois` completos | adapter | backup cresce; restore lento | `resumo` de campos alterados para ATUALIZAR |
| R-06 | `bulkCreateEntries` carrega `animais`, `identificadores`, `pesagens` inteiros em memória | importação | 250 mil → heap alta (F0 exigiu 8 GB em Node) | consultas por chave em lote (`anyOf`) e importação em blocos com checkpoint |
| R-07 | `genericRepository.list()` faz `toArray()` + filtro em memória | todos os cadastros | irrelevante para cadastros pequenos; grave se `parceiros`/`animais` crescerem | usar `where()` nos índices declarados |

## 3. Riscos novos introduzidos pelo alvo

| ID | Risco | Análise | Mitigação |
|---|---|---|---|
| N-01 | Migração v7 com backfill de `marca_id/raca_id` em `animais` (12 mil em 36 mil pesagens; ~80 mil em 250 mil) dentro de `upgrade()` | `modify` em transação de versão; v6 já fez isso em `pesagens` | medir com massa 250 mil; opção de backfill fora da transação de versão |
| N-02 | Junção marca/raça/categoria/parceiro na grade da Relação | grades de 36 mil linhas paginadas; mapas em memória de ≤ centenas de registros | carregar cadastros uma vez em `Map`; custo desprezível |
| N-03 | Unicidade aplicativa de identificadores em transação | uma consulta indexada por `[marca_id+valor_normalizado]` por cadastro | dentro do orçamento (< 1 ms) |
| N-04 | Próximo número livre em faixa com muitas exceções | exceções por faixa raramente passam de dezenas; `[faixa_id+numero]` indexado | ok; teste com 1 000 exceções |
| N-05 | Operação comercial com centenas de animais fechada em uma transação | 1 evento SAÍDA + projeção por animal | igual a hoje por animal; transação única de ~300 animais é aceitável; acima disso, lotes com checkpoint |
| N-06 | Fechamento por sessão com snapshot | lê só a sessão | melhora em relação a hoje |
| N-07 | Stores novas no backup | dezenas/centenas de linhas cada | desprezível; `operacoesComerciais` cresce com as vendas (1 linha por operação, não por animal) |
| N-08 | Índices adicionais em `pesagens` (`motivo_saida`, `operacao_id`) | cada índice custa escrita; Dexie/IndexedDB tolera bem 2 índices a mais | medir salvamento após v7 contra 76 ms |

## 4. Orçamentos que o plano deve manter (ADR-017)

- salvar Manejo p95 < 250 ms na massa de 36 mil no **navegador** (ainda não remedido após F1);
- abertura de Lançamento < 1 s na massa de 36 mil (R-01);
- abertura de Fechamento < 500 ms por sessão (R-02);
- migração v7: < 60 s em 36 mil, com progresso visível; 250 mil medido antes de liberar.

## 5. Medições a fazer antes de implementar (sem alterar código)

1. Tamanho médio de `legacy_payload` e de `auditoria` por registro (massa 36 mil).
2. Tempo de `getRegisteredAnimals` no Chromium após F1.
3. Tempo de `db.version(7).upgrade` simulado em Node com `fake-indexeddb` na massa 250 mil.

Esses números entram como baseline do slice de migração (`IMPLEMENTATION-SLICE-PLAN.md`).

---

<!-- BACKUP-V7-IMPACT.md -->

# BACKUP-V7-IMPACT — Impacto da v7 em backup, restauração e importação JSON

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contrato atual (`backupService.js`)

- Formato `pesagens-individuais-indexeddb-backup`, `formatVersion 2`; manifesto com `dbVersion`, `appVersion`, `counts`, `stores` (= `STORE_NAMES`, derivado de `STORES`); `integrity.sha256` sobre o JSON sem o bloco `integrity`.
- `readBackup`: recusa formato desconhecido, hash divergente, `dbVersion` maior que o do app, contagem divergente; stores ausentes nascem vazias (`allowLegacy`).
- `applyRestore`: exige `safetyEvidence` (backup físico com path/size/sha256), limpa **todas** as stores e regrava sem `localId`; confere contagens; registra `backupHistory('restore')`.
- `applyImportPesagens`: JSON de pesagens → `bulkCreateEntries` com hash idempotente.
- `clearAllData`: preserva `appSettings` e `backupHistory`.

## 2. O que muda com a v7

| Item | Impacto | Ação necessária no plano |
|---|---|---|
| Stores novas | entram automaticamente em `STORE_NAMES`, no backup e no restore | nenhuma no formato; `formatVersion` → 3 para registrar a mudança |
| Store `lotes` removida | backups v6 contêm `lotes`; `applyRestore` itera `STORE_NAMES` (v7), então `lotes` do backup é ignorada silenciosamente | aceitável (store vazia); o dry-run deve **listar** stores ignoradas |
| Backup v6 restaurado em app v7 | stores novas vazias; `animais.marca_id` etc. nulos; `pesagens` sem colunas promovidas | após o restore, executar o **backfill v7** (mesma rotina da migração) e registrar em `backupHistory('backfill-v7')`; sem isso, a UI v7 mostra marcas vazias |
| Backup v7 em app v6 | recusado por `dbVersion` maior (regra existente) | manter |
| `manifest.counts` | inclui stores novas | ok |
| Enums convertidos (`situacao`, `status`) | backup v6 traz valores antigos | o backfill converte; o dry-run mostra "backup de esquema anterior: será convertido" |
| `appSettings` catálogos | backup v6 contém `cadastros-auxiliares:*`; app v7 não os lê | o backfill migra para as stores **se** as stores estiverem vazias; senão ignora e registra |
| `clearAllData` | continua preservando `appSettings` | rever: com catálogos em stores, "limpar dados" apaga marcas/raças/parceiros; decidir se cadastros mestres são "dados" ou "estrutura" (DEC-018) |
| Importação JSON de pesagens (`weighing-entries-export`) | entradas trazem `legacy_payload` com marca/raça texto | importação resolve por nome normalizado, como o CSV |
| `safetyEvidence` na migração | hoje a migração de versão roda na abertura sem backup | o plano deve criar backup físico automático antes de abrir na v7 pela primeira vez (Electron tem a ponte `writeUserFile`; no navegador de desenvolvimento, aviso) |

## 3. Regras propostas

1. **Nenhum restore cruza versão sem backfill**: `applyRestore` lê `manifest.dbVersion`; se menor que a atual, agenda o backfill na mesma sequência e só depois registra sucesso.
2. `dryRunRestore` passa a devolver `schemaUpgradeRequired: true/false` e a lista de stores ignoradas/novas.
3. `formatVersion 3` documenta: stores v7, enums, colunas promovidas. Backups `formatVersion 2` continuam restauráveis.
4. Massa de teste (`testMass.js`) gera dados v7 (marcas/raças por id) para os gates `storage:backup:verify` e `storage:import-restore:verify`.

## 4. Documentação do usuário afetada

`docs/user/BACKUP-E-RESTAURACAO.md` (mensagem de "backup de versão anterior: conversão automática"), `GUIA-RAPIDO.md` (novos cadastros), `TESTE-MAQUINA-LIMPA.md` (roteiro com marca/raça cadastradas e restauração de backup v6).

## 5. Risco residual

Um backup v6 restaurado e **não** backfilled deixa `marca_id` nulo em animais; a UI deve tratar nulo como "marca não resolvida" e o `logicalIntegrity` deve apontar. Isso é critério de aceite do slice de migração.

---

<!-- IMPORT-TARGET-MODEL.md -->

# IMPORT-TARGET-MODEL — Importação (CSV/JSON) no modelo alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Importação hoje

| Aspecto | Implementação |
|---|---|
| Entrada | CSV (`;`, tab ou `,` detectado; aspas; BOM) via Relação › Mais opções › Importar CSV; JSON de pesagens via Manutenção |
| Cabeçalhos | `ID`, `ID_Externo`, `Data`, `NumeroAnimal`/`Animal`, `Sexo`, `Raça`, `Era`, `Marca`, `Peso`, `Lote`, `Apartação`, `Observação`, `DataAnterior`, `PesoAnterior`, `Dias`, `Ganho`, `GMD` (derivados ignorados e recalculados) |
| Tipo de evento | **um só para o arquivo inteiro** (`tipoManejoImport`: Cadastro/Manejo/Saída + motivo + destino) |
| Identidade | `NÚMERO::MARCA` → animal existente ou **criado** (`animais`, `animalIdentificadores`) com `origem='importacao'` |
| Lote | vinculado por nome (`nome_lote|nome_apartacao`) com diálogo de seleção (`applyImportLotSelection`) |
| Idempotência | SHA-256 do arquivo em `importacoes.arquivo_hash` (único) |
| Transação | uma só; cronologia validada por animal; sessão `IMPORTACAO` por data |
| Erros | lista `erros[]` por linha na tela; sem exportação do relatório |

Limitações: marca/raça/era criadas como texto; um CSV com Cadastro e Manejo misturados precisa de dois arquivos; nomes de lote com grafia diferente não casam; não há importação de cadastros (marcas, parceiros) nem de identificadores.

## 2. Modelo alvo

### 2.1 Tipos de importação

| Tipo | Arquivo | Resolve | Cria |
|---|---|---|---|
| Cadastros mestres | CSV por cadastro (marcas, raças, categorias, parceiros, causas) | nome normalizado | registros novos; atualiza `ativo`/campos se `id` informado |
| Animais | CSV: número, marca, sexo, raça, categoria/era, nascimento, propriedade, lote inicial, `id_externo` | marca/raça/categoria por nome; lote por nome dentro da apartação | animal + identificador VISUAL + evento CADASTRO (sem peso) |
| Pesagens (Manejo) | CSV atual sem colunas de cadastro obrigatórias | animal por identificador ativo (número+marca, RFID) | apenas eventos; **não cria animal** (linha vai para pendência) |
| Saídas | CSV com motivo, data, operação (opcional) | animal, operação/embarque por código | eventos SAÍDA |
| Faixas de identificadores | CSV: tipo, marca, prefixo, início, fim, dígitos | marca | faixas |
| Legado completo (compatibilidade) | CSV atual com `Cadastro` selecionado | como hoje, mas resolvendo marca/raça por cadastro | animal + eventos; valores desconhecidos exigem confirmação |

### 2.2 Assistente (dry-run obrigatório)

1. Detectar delimitador e mapear colunas (mapeamento editável e salvável como modelo em `appSettings['modelo-importacao:<nome>']` — configuração real).
2. Validar por linha: obrigatórios, formato brasileiro, data civil, cronologia.
3. Resolver referências: marca, raça, categoria, parceiro, lote, embarque. Para cada valor não encontrado: opção "criar cadastro" (lista os valores novos) ou "rejeitar linhas".
4. Mostrar resumo: inserir / atualizar / ignorar (hash já importado) / rejeitar, por motivo.
5. Aplicar em transação única (≤ 20 mil linhas) ou em blocos com `importacoes.status='PARCIAL'` e checkpoint (`linhas_processadas`).
6. Gravar relatório da importação (JSON) em `exports/` via ponte de arquivo, com o hash.

### 2.3 Regras

- Identificador é obrigatório; marca obrigatória para VISUAL (padrão da empresa quando a coluna faltar, com aviso).
- Derivados do arquivo continuam ignorados e recalculados.
- Uma linha de Manejo para animal inexistente **não** cria animal (diferente de hoje) — vira pendência exportável; o usuário importa o cadastro antes.
- Sessões criadas por importação nascem `FECHADA` (`WEIGHING-SESSION-MODEL.md`).

## 3. Modelo CSV (novo) — colunas mínimas

`Data;NumeroAnimal;Marca;Peso;Lote;Apartacao;Observacao;IdExterno` para Manejo. `Marca;Raça;Categoria;Sexo;Nascimento;Propriedade` só no arquivo de animais. O modelo atual continua aceito.

## 4. Migração dos dados (reaproveita o mesmo motor)

O backfill v7 e a migração de valores livres (`BRAND-REGISTRY-MODEL.md` §3 etc.) usam o **mesmo** resolvedor por nome normalizado e o mesmo relatório de dry-run. Um único módulo `catalogResolver` evita duas implementações.

## 5. Fora de escopo

XLSX, importação de arquivos de balança (F5), importação de NF-e/GTA oficiais (F8), atualização em massa de pesagens existentes por CSV.

---

<!-- REPORTING-DATA-REQUIREMENTS.md -->

# REPORTING-DATA-REQUIREMENTS — Requisitos de dados para relatórios

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que existe

| Recurso | Onde | Limitação |
|---|---|---|
| Resumos de rodapé (contar, somar, média, mín, máx, amplitude, soma ÷ soma) | `PesagensResumoRodape`, `ResumoPersonalizado`, `ConfigurarResumosDialog` | agrupamentos: apartação, lote, tipo, motivo, sexo, marca; sem raça/categoria/parceiro/sessão |
| Resumo por lote / venda do dia / embarque | `ResumoLotes`, `ResumoVendaDia`, `ResumoEmbarque` | calculados na tela sobre a lista do dia |
| Fechamento (KPIs, lote, marca) | `FechamentoDia` | por data, não por sessão; sem snapshot |
| Ficha do animal | `FichaAnimal` | reconstrói da série; @ com rendimento fixo |
| Exportações | CSV da relação (mesmos cabeçalhos do modelo), CSV/JSON de pesagens (Manutenção), CSV do fechamento, CSV da ficha | sem manifesto de filtros/versão (04 §12) |
| `weighing.summary` (repositório) | total, soma, média, mín, máx de `peso_kg > 0` | correto |

## 2. Relatórios do catálogo (04) que o modelo alvo precisa suportar primeiro

| REP | Nome | Dados exigidos | Existe hoje? | O que a v7 precisa fornecer |
|---|---|---|---|---|
| 001 | Fechamento da sessão | sessão, eventos por `sessao_id`, pendências, snapshot | parcial (por data) | `sessoesPesagem.snapshot`, pendências estruturadas |
| 002 | Relação da sessão | uma linha por animal com identificadores, peso, ganho, destino, regra, alertas | parcial | `lote_sugerido_id/decidido_id`, identificador usado |
| 003 | Pendências | catálogo de pendências com severidade | parcial (3 tipos) | catálogo do `DAY-CLOSING-MODEL.md` |
| 101 | Histórico individual | cadastro, identificadores, série, movimentos, operações | parcial | `animalIdentificadores` com validade, `movimentosAnimais.lote_origem_id`, `operacao_id` |
| 102 | Desempenho do lote | inventário por `animalLotes`, GMD simples e **ponderado**, faixas, entradas/saídas | não | métricas canônicas; nada estrutural além do que existe |
| 103 | Ranking/exceções | GMD por animal, sem pesagem recente, perda de peso | não | índice `animais.ultima_pesagem_data` (existe como campo; falta índice) |
| 106 | Pesagens vencidas | `ultima_pesagem_data` por animal ativo, intervalo configurável | não | idem + configuração real `intervalo_pesagem_dias` |
| 201 | Inventário por lote | `animalLotes` abertos, capacidade, peso médio | não | índice `animalLotes.[lote_id+fim]` ou filtro por `fim == null` |
| 202 | Movimentação entre lotes | `movimentosAnimais` com origem/destino | parcial (origem nula) | `lote_origem_id` preenchido |
| 301–303 | Compra, venda, abate | `operacoesComerciais` + eventos por `operacao_id` | não (dados por pesagem) | store de operações; retorno do frigorífico |
| 401–403 | Romaneio, conciliação, livro de saídas | embarque com parceiro, documentos, animais por `embarque_id`; previsto × real | parcial (`ResumoEmbarque`) | `embarques.parceiro_id`, status, `previsao_*` no embarque |
| 501 | Trilha de auditoria | `auditoria` legível | não (sem UI) | `resumo` de campos; tela administrativa |
| 502 | Qualidade dos dados | `logicalIntegrity` + itens novos (marca não resolvida, identificador temporário, legado sem `animal_id`) | parcial | regras adicionais no `health.js` |

## 3. Dimensões que dependem de cadastro

| Dimensão (04 §2) | Requer |
|---|---|
| marca, raça, categoria | `marca_id/raca_id/categoria_id` no animal **e** snapshot no evento |
| comprador, frigorífico, destino | `parceiro_id` na operação/embarque |
| sessão e operador | `sessao_id` (existe), operador real (F2/F7) |
| propriedade | `propriedade_id` (opcional v7) |
| identificador usado | `identificador_id` no evento (novo, opcional; útil para RFID em F5) |

## 4. Métricas canônicas: o que muda

- **GMD ponderado** (Σganho ÷ Σdias) passa a existir ao lado do simples (D5).
- **Animais únicos** = `animal_id` distintos (hoje `animalKey` fallback por número+marca; manter fallback só para legado).
- **@ estimada** só com rendimento explícito (empresa, categoria ou operação); sem rendimento, "—".
- Nulos não viram zero (já respeitado em `weighing.summary`; `FechamentoDia` calcula `gmdAverage` corretamente ignorando nulos).

## 5. Exportação

Toda exportação alvo carrega manifesto: relatório, versão, filtros, período, data/hora, versão do app, contagem e SHA-256 (o `backupService` já tem a função de hash). Formato: CSV UTF-8 com BOM (como hoje) e JSON; PDF/XLSX ficam para P-008.

## 6. Nada disso exige store nova além das já propostas

Relatórios são consultas sobre índices existentes/propostos. Não criar store de "snapshots de relatório" nem cache de métricas antes de medir necessidade (ADR-011, ADR-017).

---

<!-- OVERENGINEERING-GUARDRAILS.md -->

# OVERENGINEERING-GUARDRAILS — Limites contra excesso de engenharia

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Regras de corte

| # | Regra | Teste rápido |
|---|---|---|
| G1 | Só existe cadastro para o que é referenciado por id em evento, relatório ou regra | "Se eu apagar este cadastro, alguma tela quebra?" Se não, é enum ou configuração |
| G2 | Só existe store para o que tem histórico, contagem ou vínculo | lista curta, sem vínculo → `appSettings` versionado |
| G3 | Nenhuma tela nova sem consumidor no fluxo de curral, comercial ou fechamento | "Quem abre isso na semana?" |
| G4 | Nenhum campo obrigatório que o operador não saiba na hora | obrigatório só no fechamento/conferência |
| G5 | Nenhum valor monetário no curral | ver `TARGET-COMMERCIAL-FLOW.md` |
| G6 | Nenhuma integração antes de P-001/P-002/P-005/P-007 | ADR-009, ADR-015 |
| G7 | Nenhuma store de cache/snapshot antes de medir (ADR-017) | baseline primeiro |
| G8 | Uma migração por corte; nunca migração + redesign + integração juntos (07 §1) | v7 ≠ v8 |
| G9 | Nada em `legacy_payload` novo; nada em `appSettings` com id | `LEGACY-PAYLOAD-AUDIT.md`, `APPSETTINGS-AUDIT.md` |
| G10 | Toda regra automática é explicável e substituível com motivo (ADR-010) | "sugerido × decidido" gravado |
| G11 | ModeloBase1 sem variações: nova tela reutiliza `CadastroAuxiliarPage`/Tela Mãe | ADR-016 |
| G12 | Offline permanece integral: nada depende de rede para salvar (ADR-003) | |

## 2. Lista do que NÃO entra (com o motivo)

| Tentação | Por que não | Onde está a decisão |
|---|---|---|
| ERP: contas a pagar/receber, caixa, centro de custo | 00 §6 e §4.10; P-004 pendente | `TARGET-COMMERCIAL-FLOW.md` §8 |
| CRM: funil, contatos múltiplos, histórico de negociação | parceiro é cadastro, não relacionamento | `COMMERCIAL-REGISTRY-MODEL.md` §4 |
| Fiscal: emissão NF-e/GTA, tributos | ADR-015; exige projeto próprio | `SHIPMENT-FLOW-MODEL.md` §4 |
| WMS: estoque de insumos, unidades, valorização | DEC-017 | `INVENTORY-SCOPE-DECISION.md` |
| Veterinário: sanidade, carência, protocolo, necropsia | ADR-007 | `SANITY-ADR-REVIEW.md` |
| Genealogia, reprodução, escore corporal | 03 §14 | `ANIMAL-CLASSIFICATION-MODEL.md` §5 |
| Pasto, piquete, UA/ha, dieta | 03 §14 | `HERD-LOT-MODEL.md` §5 |
| Motor de regras de apartação completo agora | F4; só corrigir custo e registrar decisão | `HERD-LOT-MODEL.md` §3.3 |
| Multiempresa/fazenda em todas as stores agora | P-003; só `empresa_id='local'` | `PROPERTY-FARM-MODEL.md` §3 |
| Item de embarque como store | evento de saída já é o item | `SHIPMENT-FLOW-MODEL.md` §2.1 |
| Store de snapshots de relatório | ADR-011/017 | `REPORTING-DATA-REQUIREMENTS.md` §6 |
| Renomear store `pesagens` para "eventos" | custo em backup/gates sem ganho funcional | `WEIGHING-DOMAIN-MODEL.md` §3.1 |
| Reescrever o Lançamento do zero | risco; enxugar por remoção de blocos com gates | `TARGET-LAUNCH-FLOW.md` §4 |
| Framework de formulários genérico / gerador de CRUD | `CadastroAuxiliarPage` com porta de persistência basta | `MODELOBASE1-PRODUCT-MAP.md` §3 |
| Sincronização, login, outbox | F7 | 06 |
| PDF/XLSX agora | P-008 | `REPORTING-DATA-REQUIREMENTS.md` §5 |
| Índice único composto "inteligente" no Dexie | não existe condicional a `ativo`; verificação no serviço | `ANIMAL-IDENTIFICATION-MODEL.md` §2.2 |

## 3. Sinais de alerta durante a implementação

- Uma fatia toca mais de uma store nova **e** uma tela **e** uma migração: dividir.
- Um campo "para o futuro" sem leitor: retirar.
- Um `Select` com mais de ~30 opções no curral: precisa de pesquisa, não de lista.
- Uma regra com três cópias (tela, mapper, health): centralizar antes de estender.
- Um gate "ajustado" para passar com o comportamento antigo: reescrever o gate para o contrato novo, com evidência.

## 4. Orçamento de complexidade por fase (proposta)

| Fase | Stores novas | Telas novas | Migração |
|---|---|---|---|
| M1 cadastros mestres | ≤ 6 | ≤ 6 (mesma página genérica) | v7 |
| M2 identificadores | ≤ 2 | 1 | v7 (mesma) |
| M3 lançamento enxuto | 0 | 0 (redução) | — |
| M4 comercial + embarque | 1 | 2 | v8 |
| M5 sessão/fechamento/ficha | 0 | 2 (refeitas) | — |

Estourar o orçamento exige atualizar este documento e a ADR correspondente.

---

<!-- MASTER-ROADMAP-RECOMMENDATION.md -->

# MASTER-ROADMAP-RECOMMENDATION — Roadmap recomendado (modelagem do produto)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 0. Relação com o roadmap F0–F8

O roadmap de arquitetura (07) continua válido. Esta recomendação **insere** uma trilha de modelagem de produto (M0–M5) entre a F1 (em andamento) e a F2 (Modo Curral), porque sessões, apartação avançada e equipamentos dependem de cadastros mestres e identidade limpa. M4 corresponde à parte inicial da F6; M5 antecipa fatias da F2/F3 sem o hardware.

```text
F0 ✔ → F1 (parcial) → M0 → M1 → M2 → M3 → M4 → M5 → F2 (restante) → F3 → F4 → F5 → F6 (restante) → F7 → F8
```

## M0 — Decisões e contratos

- **Objetivo:** fechar DEC-001…DEC-022 como ADRs; fixar orçamentos.
- **Escopo:** ADR-018+ em `08-DECISOES-ARQUITETURAIS.md`; medições de `LEGACY-PAYLOAD` e migração simulada (`TARGET-PERFORMANCE-RISKS.md` §5).
- **Stores:** nenhuma. **UI:** nenhuma.
- **Contratos:** lista permitida do payload; enums; formato de backup v3.
- **Gates:** nenhum novo; `test:quick` deve estar verde (os dois gates vermelhos da sessão paralela resolvidos por quem os introduziu).
- **Riscos:** decisões adiadas travam M1.
- **Dependências:** esta auditoria.
- **Critério de aceite:** ADRs publicadas; medições registradas em `docs/evidence`.

## M1 — Cadastros mestres (Dexie v7, parte 1)

- **Objetivo:** marcas, raças, categorias, causas de morte, parceiros (e propriedades se DEC-013) como stores com telas ModeloBase1.
- **Escopo:** migração v7 com dry-run e backup físico; porta de persistência em `CadastroAuxiliarPage`; `animais.marca_id/raca_id/categoria_id`; `animalIdentificadores.marca_id`; Lançamento passa a **selecionar** marca/raça/categoria (comboboxes livres removidos); `registryService` e `GerenciarSaidasDialog` retirados; sanidade removida (DEC-006).
- **Stores:** `marcas`, `racas`, `categoriasAnimal`, `causasMorte`, `parceiros`, (`propriedades`); remoção de `lotes`.
- **UI:** 5–6 telas com a mesma página genérica; ajustes no Lançamento.
- **Contratos:** `catalogResolver` (nome normalizado → id) compartilhado por migração e importação; mapper lê coluna → payload → nulo.
- **Gates:** `storage:dexie:verify` (v7), `storage:backup:verify` (formato 3, restore v6 + backfill), `animal:history-integrity:verify` (marca por id), `ui:consistency:verify` (telas novas), novo `registry:master:verify` (unicidade, inativação, resolução por nome).
- **Riscos:** fusão indevida de marcas (mitigado por dry-run); migração lenta em 250 mil (medir em M0).
- **Dependências:** M0.
- **Critério de aceite:** nenhuma marca/raça digitada livre em tela alguma; backup v6 restaurado em v7 com backfill validado; `test:quick` verde; capturas claro/escuro.

## M2 — Estoque de identificadores (Dexie v7, parte 2)

- **Objetivo:** faixas + exceções; sequência do curral alimentada pelo estoque; identificadores com validade temporal e tipos.
- **Escopo:** `faixasIdentificadores`, `excecoesIdentificadores`; `animalIdentificadores.tipo/faixa_id/inicio/fim`; unicidade no serviço (DEC-005); resolução do animal por índice de identificadores (encerra R-01/D8); tela Faixas; `SequenciaBrincos` como visão do serviço; troca de identificador na ficha.
- **UI:** 1 tela + ajuste do Lançamento.
- **Contratos:** `identifierInventoryService` (`nextFree`, `useNumber`, `markLost`, `balance`).
- **Gates:** novo `identifier:inventory:verify` (próximo livre com exceções, uso único, saldo); `perf:contract:verify` com identificação por índice.
- **Riscos:** faixas sobrepostas; números já usados fora de faixa (tratados como exceções na criação).
- **Dependências:** M1 (marcas).
- **Critério de aceite:** abrir Lançamento < 1 s em 36 mil (navegador); nenhum número duplicado por marca aceito pelo serviço; saldo por faixa confere com contagem.

## M3 — Lançamento enxuto

- **Objetivo:** curral só seleciona; Manejo em três campos; sem popups nem ações ocultas.
- **Escopo:** remover blocos de compra/venda/abate da tela (mantendo leitura dos dados legados na Relação); contexto de sessão (marca/apartação padrão) persistido; cadastro rápido mínimo; validações de peso/duplicidade no domínio (D6); ocupação de lote por `animalLotes`; parar de propagar renomeação.
- **Stores:** nenhuma nova; `sessoesPesagem` ganha padrões (parte do enum de DEC-014).
- **UI:** Lançamento reduzido; telas Apartações/Lotes próprias.
- **Gates:** `ui:operational-customization:verify` e `ui:consistency:verify` reescritos para o contrato novo; `enterprise:hardening:verify` com duplicidade no serviço.
- **Riscos:** perder funcionalidade usada (compra por animal) antes de M4 existir → manter leitura e edição dos campos legados **somente** pela Relação até M4.
- **Dependências:** M1, M2.
- **Critério de aceite:** `CORRAL-USABILITY-AUDIT.md` §5; teste humano de 50 animais sem mouse.

## M4 — Comercial e embarque (Dexie v8)

- **Objetivo:** operações de compra/venda/abate como entidade; embarque com máquina de estados e parceiro por id.
- **Escopo:** `operacoesComerciais`; enum de status em `embarques`; migração agrupando saídas/compras legadas; Lançamento seleciona operação aberta; telas Operações e Embarques; retorno de frigorífico; REP-302/303/401 mínimos (tabela + CSV com manifesto).
- **Gates:** `storage:dexie:verify` (v8), novo `commercial:operations:verify` (estados, totais calculados × informados, cancelamento com reversão), `shipment:state:verify`.
- **Riscos:** agrupamento de saídas legadas ambíguo → operações "migração" revisáveis.
- **Dependências:** M1 (parceiros), M3.
- **Critério de aceite:** nenhum valor monetário no Lançamento; total da operação = Σ eventos; embarque concluído recusa saída.

## M5 — Sessão, fechamento e ficha

- **Objetivo:** fechamento por sessão com snapshot e bloqueio; ficha do animal por projeções; ambas na Tela Mãe.
- **Escopo:** enum/snapshot/`motivo_reabertura` em `sessoesPesagem`; catálogo de pendências no serviço; REP-001/002/003 mínimos; Animais (lista + ficha) absorvendo Ficha do Animal; auditoria com resumo.
- **Gates:** novo `session:closing:verify` (bloqueio, snapshot, reabertura com motivo); `ui:consistency:verify`.
- **Dependências:** M3 (contexto de sessão), M4 (pendências comerciais).
- **Critério de aceite:** sessão fechada recusa eventos; snapshot igual à consulta de origem; abertura do fechamento < 500 ms.

## Depois de M5

Retomar F2 (captura, pausa, produtividade), F3 (catálogo de relatórios com GMD ponderado, ranking, vencidas), F4 (motor de regras), F5 (hardware, após P-001/P-002).

## Riscos transversais

1. Trabalho paralelo na mesma base de código (já observado em 14/09): cada slice precisa de dono único e gate verde antes de começar o próximo.
2. Assinatura Authenticode pendente: nenhuma fase acima depende dela, mas o teste em máquina limpa sim.
3. Baseline do navegador após F1 ainda não registrado: fazer em M0.

---

<!-- IMPLEMENTATION-SLICE-PLAN.md -->

# IMPLEMENTATION-SLICE-PLAN — Plano de fatias (para execução futura, após decisões)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

Cada fatia é pequena, deixa o sistema utilizável e termina com gate verde e evidência. Nenhuma fatia começa sem a ADR correspondente (M0). Os caminhos de arquivo são os atuais; nomes de arquivos novos são propostas.

## M0

### S-00.1 Medições prévias
- **Arquivos:** `scripts/measure-perf-baseline.mjs` (leitura), novo `scripts/measure-payload-size.mjs`.
- **Stores:** nenhuma. **Migração:** nenhuma. **UI:** nenhuma.
- **Testes:** execução das massas 36k/250k; relatório em `docs/evidence/auditoria-master-produto-pecuario/medicoes-m0/`.
- **Gate:** `perf:contract:verify`. **Rollback:** n/a.

### S-00.2 ADRs
- **Arquivos:** `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` (ADR-018…), `README.md` do pacote.
- **Gate:** revisão do responsável. **Rollback:** n/a.

## M1 — Cadastros mestres (v7)

### S-01.1 Esquema v7 + migração com dry-run
- **Arquivos:** `src/storage/indexedDb/schema.js` (`DB_VERSION=7`, `STORES_V6`, `REMOVED_STORES_V7`), `db.js` (upgrade), novo `src/storage/indexedDb/migrations/v7Backfill.js`, novo `src/modules/catalog/domain/catalogResolver.js`, `backupService.js` (`formatVersion 3`, `schemaUpgradeRequired`), `maintenanceDataAdapter.js` (backup físico antes da migração; ação "Executar backfill").
- **Stores:** `marcas`, `racas`, `categoriasAnimal`, `causasMorte`, `parceiros`, (`propriedades`); remover `lotes`.
- **Migração:** semear a partir dos valores distintos; preencher `marca_id/raca_id/categoria_id`; converter `situacao`; limpar `_localId/peso_kg/created_date/updated_date/status_animal` do payload; migrar `appSettings` catálogos; exportar sanidade e apagar chave.
- **UI:** Manutenção mostra dry-run e progresso.
- **Testes:** `verify-dexie-storage.mjs` (v7), `verify-dexie-backup.mjs` (restore v6 → backfill), `verify-dexie-import-restore.mjs`, novo `verify-v7-migration.mjs` com massas vazia/pequena/36k (250k opcional em `test:full`).
- **Gate:** `storage:all:verify`, `perf:contract:verify`.
- **Rollback:** backup físico pré-migração; app v6 recusa banco v7 (Dexie) → restaurar backup no v6.

### S-01.2 Serviços de cadastro
- **Arquivos:** novos `src/modules/catalog/application/{brandService,breedService,categoryService,deathCauseService,partnerService}.js` sobre `genericRepository`; retirar `registryService.js`.
- **Testes:** novo `scripts/verify-master-registry.mjs` (unicidade normalizada, inativação com vínculo, resolução por nome).
- **Gate:** `registry:master:verify` (novo, entra no `test:quick`).
- **Rollback:** fatia isolada; reverter arquivos.

### S-01.3 Telas ModeloBase1 dos cadastros
- **Arquivos:** `src/components/cadastros/CadastroAuxiliarPage.jsx` (porta `persistence: {list, save, remove}`), novas páginas `src/pages/{Marcas,Racas,Categorias,CausasMorte,Parceiros,Propriedades}.jsx`, `src/pages.config.js`, `src/Layout.jsx` (menu; remover Sanidade), `src/pages/CadastrosComerciais.jsx` e `ConfiguracoesSanidade.jsx` removidos.
- **Testes:** `verify-ui-consistency.mjs` (asserções por tela), capturas `evidence:screens` claro/escuro.
- **Gate:** `ui:consistency:verify`, `docs:user:verify` (guia atualizado).
- **Rollback:** reverter páginas; stores permanecem (sem dano).

### S-01.4 Lançamento seleciona cadastros
- **Arquivos:** `src/pages/LancamentoPesagensIndividuais.jsx` (substituir `ComboboxComNovo` de marca/raça/era por seletores de cadastro; remover `marcasExistentes/racasExistentes/erasExistentes`), `src/components/pesagens/ConfirmarAnimalSnDialog.jsx`, `src/modules/animals/domain/snAnimal.js` (raça padrão da empresa), `weighingMapper.js` (colunas `marca_id`, `categoria_id`), `weighingDataAdapter.js` (gravar ids no animal/identificador).
- **Testes:** `verify-animal-history-integrity.mjs`, `verify-enterprise-hardening.mjs`, `verify-operational-customization.mjs` (reescrito).
- **Gate:** `test:quick`.
- **Rollback:** reverter tela; dados já têm ids e texto.

### S-01.5 Remoção do legado comercial em `appSettings`
- **Arquivos:** `src/components/pesagens/GerenciarSaidasDialog.jsx` (remover), Lançamento (remover import/uso), `registryService.js` (remover).
- **Gate:** `runtime:legacy:verify`, `lint`.
- **Rollback:** reverter arquivos.

## M2 — Identificadores (v7, mesma versão se lançado junto; senão v7.1 lógica sem bump)

### S-02.1 Faixas e exceções
- **Arquivos:** `schema.js` (`faixasIdentificadores`, `excecoesIdentificadores`), novo `src/modules/identifiers/application/identifierInventoryService.js`, domínio `src/modules/identifiers/domain/rangeMath.js` (próximo livre, saldo).
- **Testes:** novo `scripts/verify-identifier-inventory.mjs`.
- **Gate:** `identifier:inventory:verify` (novo). **Rollback:** stores vazias; reverter.

### S-02.2 Identificadores com tipo e validade + unicidade no serviço
- **Arquivos:** `weighingDataAdapter.js` (criação do identificador: `tipo`, `marca_id`, `faixa_id`, `inicio`), novo `animalIdentifierService.js` (troca com `fim/motivo`), `health.js` (regras novas), migração de `visual_marca` → `VISUAL`.
- **Testes:** `verify-animal-history-integrity.mjs`, `verify-enterprise-hardening.mjs`.
- **Gate:** `test:quick`. **Rollback:** migração reversível (tipo é string).

### S-02.3 Resolução por índice no Lançamento e tela Faixas
- **Arquivos:** Lançamento (`buildAnimalLookupIndex` das pesagens → consulta a `animalIdentificadores`/`animais`), `SequenciaBrincos.jsx` (visão do serviço; remover `window.__sequenciaBrincos`), nova `src/pages/FaixasIdentificadores.jsx`, `Layout.jsx`.
- **Testes:** `perf:baseline` 36k navegador (abertura < 1 s), `verify-ui-consistency.mjs`.
- **Gate:** `perf:contract:verify`, `ui:consistency:verify`. **Rollback:** reverter tela; serviço permanece.

## M3 — Lançamento enxuto

### S-03.1 Domínio: peso por evento, duplicidade, lote por projeção
- **Arquivos:** `weighingMapper.js` (`weightRequiredFor`), `weighingDataAdapter.js` (duplicidade no dia; ocupação por `animalLotes`), `health.js` (usa a mesma função), novo `src/modules/lots/application/lotSuggestionService.js`.
- **Testes:** `verify-weighing-mapper.mjs`, `verify-enterprise-hardening.mjs` (casos novos).
- **Gate:** `test:quick`. **Rollback:** reverter.

### S-03.2 Telas Apartações/Lotes e remoção do popup
- **Arquivos:** nova `src/pages/ApartacoesLotes.jsx`, remover `GerenciarApartacoesDialog.jsx` e propagação de renome (`propagateApartacaoRename/propagateLoteRename`), Lançamento.
- **Gate:** `ui:consistency:verify`. **Rollback:** reverter.

### S-03.3 Formulário enxuto e contexto de sessão
- **Arquivos:** Lançamento (remover blocos compra/venda/abate e olhinhos; faixa de contexto; cadastro rápido), `sessoesPesagem` padrões (`weighingDataAdapter`), novo `sessionContextService.js`, `PesagensIndividuais.jsx` (edição dos campos comerciais legados permanece só aqui até M4).
- **Testes:** `verify-operational-customization.mjs` e `verify-ui-consistency.mjs` reescritos; roteiro humano de 50 animais.
- **Gate:** `test:quick` + evidência humana. **Rollback:** reverter tela (dados intactos).

## M4 — Comercial e embarque (v8)

### S-04.1 Esquema v8 + migração de operações
- **Arquivos:** `schema.js` (`operacoesComerciais`, índices `pesagens.operacao_id/motivo_saida`, enum `embarques.status`, `parceiro_id`), `migrations/v8Backfill.js` (agrupamento de saídas/compras legadas), `backupService.js`.
- **Testes:** `verify-v8-migration.mjs` (novo), `storage:all:verify`.
- **Gate:** `storage:all:verify`. **Rollback:** backup físico pré-migração.

### S-04.2 Serviços comerciais e de embarque
- **Arquivos:** novos `src/modules/commercial/application/commercialOperationService.js`, `domain/operationStateMachine.js`; `shipmentService.js` (máquina de estados), `shipmentMapper.js`.
- **Testes:** novos `verify-commercial-operations.mjs`, `verify-shipment-state.mjs`.
- **Gate:** ambos entram no `test:quick`. **Rollback:** reverter.

### S-04.3 Telas Operações e Embarques; Lançamento seleciona operação
- **Arquivos:** novas `src/pages/OperacoesComerciais.jsx`, `src/pages/Embarques.jsx`; remover `GerenciarEmbarquesDialog.jsx`; Lançamento (motivo → operação aberta); `ResumoVendaDia.jsx`/`ResumoEmbarque.jsx` lendo operação/embarque.
- **Gate:** `ui:consistency:verify`, capturas. **Rollback:** reverter telas.

### S-04.4 Relatórios comerciais mínimos com manifesto
- **Arquivos:** novo `src/modules/reports/application/reportExportService.js` (CSV + manifesto + hash), páginas de operação (aba Relatório).
- **Gate:** novo `reports:manifest:verify`. **Rollback:** reverter.

## M5 — Sessão, fechamento e ficha

### S-05.1 Sessão com enum, snapshot, bloqueio
- **Arquivos:** `weighingDataAdapter.js` (recusa evento em sessão fechada; índice `[data+local]`), `operationalInsightsService.js` (pendências no serviço, snapshot, `motivo_reabertura`), migração de valores.
- **Testes:** novo `verify-session-closing.mjs`. **Gate:** `session:closing:verify`. **Rollback:** reverter.

### S-05.2 Fechamento na Tela Mãe
- **Arquivos:** `src/pages/FechamentoDia.jsx` → `FechamentoSessao.jsx`, remover `operational-insights.css` desta tela.
- **Gate:** `ui:consistency:verify`, capturas. **Rollback:** reverter.

### S-05.3 Animais (lista + ficha) e auditoria com resumo
- **Arquivos:** nova `src/pages/Animais.jsx` (absorve `FichaAnimal.jsx`), `weighingDataAdapter.js` (auditoria `resumo`), tela administrativa de auditoria mínima em Manutenção.
- **Gate:** `ui:consistency:verify`, `animal:history-integrity:verify`. **Rollback:** reverter.

## Regras de execução

1. Uma fatia por vez, um dono por vez; a próxima só começa com `test:quick` verde.
2. Toda fatia registra evidência em `docs/evidence/<slice>/` (capturas, relatório, medição).
3. Documentação do usuário atualizada na mesma fatia quando o comportamento muda (07 §13).
4. Nenhuma fatia edita gates para "passar"; gates mudam apenas quando o contrato muda, com registro.

---

<!-- TARGET-GATE-PLAN.md -->

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
