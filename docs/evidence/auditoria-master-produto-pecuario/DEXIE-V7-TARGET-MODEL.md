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
