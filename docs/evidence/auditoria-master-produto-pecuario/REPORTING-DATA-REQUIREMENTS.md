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
