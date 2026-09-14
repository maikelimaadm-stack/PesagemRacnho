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
