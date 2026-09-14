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
