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
