# 17 — Modelo de dados v9 (missão pesagens-integrada, Fase B)

**Base:** Dexie v8. A **v9 é aditiva**: cria stores novas e acrescenta índices; nenhum dado existente é
reescrito pelo upgrade do Dexie. A projeção legada (operações a partir dos Cadastros e Saídas já gravados)
roda no backfill resumível `v9Backfill`, com backup pré-migração e estado técnico `migration:v9`, na
mesma cadeia da v7 e da v8 (`14-MIGRACOES.md`).

## Princípios

- **Livro de movimentos único** (`movimentosAnimais`). Todo efeito de saldo é um movimento com `natureza`
  ENTRADA, SAÍDA ou INTERNA, derivada do `tipo` (`domain/movementNature.js`). O inventário (F17) é calculado
  desse livro.
- **Operação = cabeçalho.** Uma operação (Entrada, Saída ou Movimentação) tem cabeçalho (data, tipo,
  subtipo, parceiro, propriedades, documentos, valores) e itens por animal. Exemplos:
  - **Compra de 80 animais:** 1 operação, 80 itens e 80 movimentos de ENTRADA.
  - **Venda de 50 animais:** 1 operação, 50 itens, 50 pesagens de Saída e 50 movimentos de SAÍDA.
- **Pesagem não é pré-requisito de operação.**
  - **Entrada com peso:** gera o Cadastro de sempre (`legacy_payload.operacao_id`).
  - **Entrada sem peso:** cria o animal `PENDENTE_PESAGEM` e o movimento de ENTRADA da operação. O primeiro
    Cadastro desse animal **adota** o movimento existente em vez de criar outro.
  - **Saída:** gera a pesagem de Saída (com peso só quando medido ou informado; morte, doação e
    transferência sem peso), para que relatórios, linha do tempo e "uma saída por animal" sigam valendo.
- **Movimentação interna** (lote, pasto, propriedade) não exige pesagem: é movimento INTERNO com
  `operacao_id` e `pesagem_id = null`. A reconciliação das pesagens nunca toca movimento sem `pesagem_id`.
- **Fato, projeção e estimativa:** fato é imutável e cancelado com auditoria; projeção é derivada; estimativa
  nunca vira fato. Exemplos de estimativa: idade aproximada, projeção de peso, dose sugerida.

## Stores novas (v9)

| Store | Para quê | Índices principais |
|---|---|---|
| `operacoes` | cabeçalho de Entrada, Saída e Movimentação (F01–F03) | `&id, tipo, subtipo, status, data, parceiro_id, propriedade_origem_id, propriedade_destino_id, origem, created_at, deleted_at` |
| `operacaoItens` | animal da operação: peso medido/informado, valor, pendências (F01/F02) | `&id, operacao_id, animal_id, [operacao_id+animal_id], status, pesagem_id, origem_pesagem_id, created_at, deleted_at` |
| `avaliacoesDenticao` | dentição observada (0/2/4/6/8 dentes), data e origem (F05) | `&id, animal_id, data, created_at, deleted_at` |
| `movimentosIdentificadores` | livro dos brincos: recebido, reservado, aplicado, perdido etc. (F06) | `&id, faixa_id, tipo, valor_normalizado, [tipo+valor_normalizado], acao, animal_id, data, created_at, deleted_at` |
| `posologias` | regra de dose versionada por medicamento, com carência (F08/F10) | `&id, medicamento_id, status, vigencia_inicio, created_at, deleted_at` |
| `calendariosSazonais` | águas, seca e transição por propriedade e ano (F12) | `&id, propriedade_id, ano, periodo, inicio, fim, created_at, deleted_at` |
| `metasDesempenho` | metas e cenários de GMD/peso com vigência e escopo (F13/F14) | `&id, escopo, alvo_id, vigencia_inicio, vigencia_fim, created_at, deleted_at` |
| `documentos` | metadados de GTA, NF-e, laudo e comprovante; hash e caminho do anexo (F16) | `&id, tipo, numero, data, operacao_id, animal_id, propriedade_id, sha256, created_at, deleted_at` |

## Índices acrescentados

- `movimentosAnimais`: `operacao_id`, `pesagem_id` e `natureza`, para o inventário e a rastreabilidade.
- `animais`: `situacao_cadastro` (`OK` ou `PENDENTE_PESAGEM` / `PENDENTE_IDENTIFICACAO`).

## Campos novos sem índice (não exigem versão, entram nos registros)

- **`animais`**:
  - `nascimento_data`;
  - `nascimento_precisao` (DIA, MES, IDADE_DECLARADA ou DESCONHECIDA);
  - `nascimento_fonte`;
  - `idade_declarada_meses` e `idade_referencia_data`;
  - `mae_animal_id`;
  - `propriedade_nascimento_id`;
  - `categoria_produtiva`.
- **`aplicacoesSanidade`**:
  - `posologia_id` e `posologia_snapshot`;
  - `dose_sugerida`, `dose_aplicada` e `unidade`;
  - `peso_base_kg`, `peso_base_data` e `peso_base_origem`;
  - `carencia_carne_ate` e `carencia_leite_ate`.
- **`legacy_payload`** (allowlist): `operacao_id`.

## Migração legada (v9Backfill)

| Passo | O que faz |
|---|---|
| **S1** | confere as stores criadas e registra as contagens |
| **S2** | define `natureza` em todo movimento existente (pelo `tipo`) |
| **S3** | para cada Cadastro ativo sem `operacao_id`, cria uma operação ENTRADA `LEGADO`, agrupada por data (subtipo `LEGADO_CADASTRO`, documento `SEM_DOCUMENTO`, status `CONFIRMADA`, `origem = LEGADO`), com um item por animal. O movimento de Entrada da pesagem recebe o `operacao_id`. |
| **S4** | mesma regra para as Saídas, agrupadas por data e motivo (subtipo = motivo: VENDA, ABATE, MORTE, DOACAO, TRANSFERENCIA_ENVIADA ou `SAIDA_SEM_MOTIVO`). Comprador e frigorífico vão como **texto legado**: nenhum parceiro é inventado. |

**Deduplicação.** O item legado guarda `origem_pesagem_id`. Uma pesagem já convertida nunca gera um segundo
item, e reexecutar o backfill não muda nada. Nenhuma compra financeira, preço ou parceiro é inventado.

## Compatibilidade

- **Restauração de backups anteriores.** Backups v6, v7 e v8 continuam restauráveis. As stores v9 nascem
  vazias, e a cadeia v9 roda depois da restauração.
- **Backup de banco mais novo.** É recusado (regra existente).
- **Downgrade.** Não é suportado. A volta para a versão anterior é feita pela **restauração do backup
  pré-migração** (`MIGRACAO-ROLLBACK.md`).
