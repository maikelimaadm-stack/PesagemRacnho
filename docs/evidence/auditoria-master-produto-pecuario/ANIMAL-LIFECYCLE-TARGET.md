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
