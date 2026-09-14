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
