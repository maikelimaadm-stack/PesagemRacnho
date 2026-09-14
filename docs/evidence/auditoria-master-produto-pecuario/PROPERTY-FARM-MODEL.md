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
