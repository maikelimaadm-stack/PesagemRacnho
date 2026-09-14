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
