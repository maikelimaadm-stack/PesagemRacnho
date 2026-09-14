# 12 — Modelo de dados v7 e v8 (contrato de implementação)

**Programa 2.0 · 14/09/2026 · dono do arquivo `schema.js`: coordenador (ADR-040).**
Fonte: Auditoria Master (`DEXIE-V7-TARGET-MODEL.md` e modelos por domínio) e ADR-018…ADR-034.

## 1. Convenções

- Toda store: `++localId` (chave técnica), `id` UUID de domínio, `created_at`, `updated_at`, `deleted_at` (exclusão lógica), `empresa_id` (`'local'` até P-003).
- Cadastros mestres usam `&id` (único), `nome`, `nome_normalizado` (`trim` → maiúsculas pt-BR → espaços internos únicos), `ativo`.
- Enums em MAIÚSCULAS e ASCII (`ATIVO`, `EM_CARREGAMENTO`).
- Regra de leitura de campo migrado: **coluna nova → legado → nulo**.
- `legacy_payload` congelado (ADR-027): nenhuma chave nova; lista permitida em §6.

## 2. Esquema v7 (`DB_VERSION = 7`, `DATA_CONTRACT_VERSION = 2`, `BACKUP_FORMAT_VERSION = 3`)

```js
export const STORES_V7 = {
  // existentes (índices acrescentados marcados com +)
  pesagens: '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at',
  apartacoes: '++localId, id, nome, ativo, created_at, updated_at, deleted_at',                       // + ativo
  loteApartacoes: '++localId, id, apartacao_id, situacao, categoria_id, created_at, updated_at, deleted_at', // + situacao, categoria_id (lote_id removido: era índice sem campo)
  embarques: '++localId, id, data, status, parceiro_id, created_at, updated_at, deleted_at',            // + parceiro_id
  documentosEmbarque: '++localId, id, embarque_id, tipo, created_at, updated_at, deleted_at',
  animais: '++localId, &id, empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, created_at, updated_at, deleted_at',
  animalIdentificadores: '++localId, &id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo, created_at, updated_at, deleted_at',
  movimentosAnimais: '++localId, &id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id, created_at, updated_at, deleted_at',
  animalLotes: '++localId, &id, animal_id, lote_id, inicio, fim, created_at, updated_at, deleted_at',
  sessoesPesagem: '++localId, &id, data, [data+local], status, operador, operador_user_id, created_at, updated_at, deleted_at',
  auditoria: '++localId, &id, entidade, entidade_id, acao, actor_user_id, created_at',
  importacoes: '++localId, &id, &arquivo_hash, status, created_at, updated_at',
  appSettings: 'key',
  backupHistory: '++localId, id, tipo, created_at',
  // novas
  marcas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  racas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  categoriasAnimal: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  parceiros: '++localId, &id, empresa_id, nome_normalizado, documento, *papeis, ativo, created_at, updated_at, deleted_at',
  propriedades: '++localId, &id, empresa_id, nome_normalizado, tipo, parceiro_id, ativo, created_at, updated_at, deleted_at',
  causasMorte: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  faixasIdentificadores: '++localId, &id, empresa_id, tipo, marca_id, situacao, ativo, created_at, updated_at, deleted_at',
  excecoesIdentificadores: '++localId, &id, faixa_id, [faixa_id+numero], motivo, created_at, updated_at, deleted_at',
  usuariosLocais: '++localId, &id, empresa_id, login_normalizado, perfil, ativo, created_at, updated_at, deleted_at',
};
export const REMOVED_STORES_V7 = { lotes: null };
```

`db.js` mantém `version(5)`, `version(6)` e acrescenta `version(7).stores({...STORES_V7, ...REMOVED_STORES_V7})`. O `upgrade()` da v7 faz **somente** transformações leves e idempotentes (enums de `status`/`situacao`, `fechado→situacao`, `tipo 'visual_marca'→'VISUAL'`); o backfill pesado é resumível após a abertura (14-MIGRACOES).

Pré-condição da v7: `lotes` vazia (o coordenador de migração verifica antes; se não estiver, bloqueia e reporta).

## 3. Campos por store (v7)

### 3.1 Cadastros mestres

| Store | Campos além dos padrão |
|---|---|
| `marcas` | `nome`, `nome_normalizado`, `abreviacao`, `proprietario_parceiro_id`, `propriedade_id`, `padrao` (bool; uma por empresa), `observacao` |
| `racas` | `nome`, `nome_normalizado`, `abreviacao`, `grupo` (`ZEBUINO`/`TAURINO`/`CRUZADO`/`OUTRO`/null), `padrao`, `ordem` |
| `categoriasAnimal` | `nome`, `nome_normalizado`, `sexo_aplicavel` (`M`/`F`/`AMBOS`), `idade_min_meses`, `idade_max_meses`, `ordem` |
| `parceiros` | `nome`, `nome_normalizado`, `tipo_pessoa` (`FISICA`/`JURIDICA`), `documento` (só dígitos ou null), `papeis[]` (`COMPRADOR`,`VENDEDOR`,`FRIGORIFICO`,`TRANSPORTADOR`,`PROPRIETARIO`), `telefone`, `email`, `cidade`, `uf`, `registro_sif`, `rendimento_padrao`, `observacao` |
| `propriedades` | `nome`, `nome_normalizado`, `tipo` (`PROPRIA`/`TERCEIRO`), `parceiro_id`, `municipio`, `uf`, `codigo_oficial`, `padrao` |
| `causasMorte` | `nome`, `nome_normalizado`, `categoria` (`Doença`,`Acidente`,`Predação`,`Parto`,`Desconhecida`,`Outra`), `descricao`, `exige_observacao`, `ordem` |
| `faixasIdentificadores` | `tipo` (`VISUAL`,`RFID`,`SISBOV`,`MANEJO`), `marca_id` (obrigatório para VISUAL), `prefixo`, `inicio`, `fim`, `digitos`, `proximo`, `direcao` (`CRESCENTE`/`DECRESCENTE`), `origem`, `data_entrada`, `situacao` (`ATIVA`,`ESGOTADA`,`BLOQUEADA`), `observacao` |
| `excecoesIdentificadores` | `faixa_id`, `numero`, `motivo` (`USADO_FORA_DE_ORDEM`,`PERDIDO`,`DANIFICADO`,`RESERVADO`,`DEVOLVIDO`), `animal_id`, `observacao` |
| `usuariosLocais` | `nome`, `login`, `login_normalizado`, `senha_hash`, `senha_salt`, `senha_iteracoes`, `senha_algoritmo` (`PBKDF2-SHA256`), `perfil` (`ADMIN`,`GESTOR`,`OPERADOR`), `ativo`, `deve_trocar_senha`, `ultimo_login_at` |

Seeds na migração: categorias `Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro` (ids gerados, nunca fixos); uma propriedade `PROPRIA` padrão "Propriedade principal"; raça padrão `Nelore` se não existir nos dados; marca padrão = a mais usada nos dados (ou nenhuma).

### 3.2 Stores existentes alteradas

| Store | Campos novos / alterados |
|---|---|
| `animais` | `marca_id`, `raca_id`, `categoria_id`, `propriedade_id`, `nascimento` (civil ou null), `nascimento_estimado` (bool), `situacao` enum `ATIVO`,`VENDIDO`,`ABATIDO`,`MORTO`,`DOADO`,`TRANSFERIDO`,`CANCELADO` (derivada de `motivo_saida`: Venda→VENDIDO, Abate→ABATIDO, Morte→MORTO, Doação→DOADO, Transferência→TRANSFERIDO, Outros/sem motivo→VENDIDO? **não**: `Outros`→`TRANSFERIDO`? **não** — `Outros` e desconhecido → `INATIVO_LEGADO` não existe; usar `CANCELADO`? Decisão: `Outros`/desconhecido → `DOADO`? Nenhum. **Regra:** motivo `Outros` ou nulo com saída → `VENDIDO` é falso. Ficará `TRANSFERIDO`? Não inventar: manter enum com valor adicional `INATIVO` para saídas legadas sem motivo mapeável, e o relatório de migração lista quantas). Campos `marca`, `raca`, `era` permanecem como legado somente-leitura |
| `animalIdentificadores` | `tipo` enum (`VISUAL`,`RFID`,`SISBOV`,`MANEJO`,`TEMPORARIO`,`LEGADO`), `marca_id`, `faixa_id`, `inicio`, `fim`, `motivo_troca`; `valor_normalizado` de VISUAL passa a ser só o número normalizado (a marca vai em `marca_id`; o índice `[marca_id+valor_normalizado]` garante a unicidade por marca); campo legado `marca` (texto) mantido |
| `sessoesPesagem` | `status` enum (`ABERTA`,`CONFERENCIA`,`FECHADA`,`CANCELADA`), `local` (null), `operador_user_id`, `marca_padrao_id`, `apartacao_padrao_id`, `tipo_manejo_padrao`, `snapshot`, `motivo_reabertura` |
| `loteApartacoes` | `codigo`, `situacao` (`ABERTO`/`FECHADO`, de `fechado`), `categoria_id`, `data_abertura`, `data_fechamento`, `ativo`, `ordem`; `nome_apartacao` desnormalizado deixa de ser gravado (leitura por junção) |
| `apartacoes` | `ativo`, `ordem`, `observacao` |
| `auditoria` | `actor_user_id`, `actor_user_name`, `actor_user_profile`, `resumo`, `campos_alterados[]`; `antes/depois` completos só em ações críticas |
| `embarques` | `parceiro_id` (preenchido na v8) |

Enum de `animais.situacao` (definitivo): `ATIVO`, `VENDIDO`, `ABATIDO`, `MORTO`, `DOADO`, `TRANSFERIDO`, `CANCELADO`, `INATIVO` (somente para saídas legadas sem motivo mapeável; relatório de migração conta).

## 4. Esquema v8 (Fase 3 — release 1.4.0)

```js
STORES_V8 = {
  ...STORES_V7,
  pesagens: '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, motivo_saida, operacao_id, created_at, updated_at, deleted_at',
  embarques: '++localId, id, data, status, parceiro_id, transportador_id, created_at, updated_at, deleted_at',
  operacoesComerciais: '++localId, &id, empresa_id, tipo, status, parceiro_id, embarque_id, data, created_at, updated_at, deleted_at',
};
```

Colunas promovidas em `pesagens` (lidas do payload no backfill v8): `motivo_saida`, `operacao_id`, `causa_morte_id`, `marca_id`, `categoria_id`, `apartacao_id`, `versao_formula`. `operacoesComerciais`: campos de 25 da Auditoria (`tipo`, `data`, `parceiro_id`, `propriedade_origem_id`, `propriedade_destino_id`, `preco_arroba`, `rendimento_percentual`, `rendimento_origem` ∈ {`INFORMADO`,`PADRAO_EMPRESA`,`PADRAO_PARCEIRO`}, `valor_total_informado`, `valor_total_calculado`, `valor_frete`, `descontos`, `outros_custos`, `quantidade_prevista`, `embarque_id`, `documentos[]`, `retorno_frigorifico`, `status`, `observacao`). `embarques.status` enum `PLANEJADO`,`EM_CARREGAMENTO`,`CONFERIDO`,`CONCLUIDO`,`CANCELADO`.

## 5. Backfill v7 (resumível; ver 14-MIGRACOES)

| Passo | Origem | Destino | Regra |
|---|---|---|---|
| B1 marcas | valores distintos de `animais.marca`, `animalIdentificadores.marca`, `pesagens.legacy_payload.marca` | `marcas` | agrupar por `nome_normalizado`; **não fundir** grupos cuja fusão gere `(marca_id, numero)` duplicado entre animais distintos — nesses casos criar marcas separadas com o texto bruto e listar no relatório (ADR-021) |
| B2 raças | `animais.raca`, payload `raca` | `racas` | fusão automática por normalização; `Nelore` padrão |
| B3 categorias | seed fixo | `categoriasAnimal` | ids gerados |
| B4 causas | `appSettings['cadastros-auxiliares:mortalidade:*'].causasMorte` | `causasMorte` | ids preservados |
| B5 parceiros | `appSettings['cadastros-auxiliares:comerciais:*']` + `perfis-saida:*.compradores` | `parceiros` | união por `documento` ou `nome_normalizado`; papéis consolidados; ids do registry preservados quando possível |
| B6 propriedades | seed | `propriedades` | uma `PROPRIA` padrão; vendedores com `propriedade` texto geram `TERCEIRO` ligada ao parceiro |
| B7 animais | texto → ids | `animais` | `marca_id`, `raca_id` por normalização; `categoria_id` null; `situacao` enum; `nascimento` estimado a partir de `era` numérica (meses) com `nascimento_estimado=true`; lote de 500 por cursor `localId` |
| B8 identificadores | `tipo`, `marca_id`, `valor_normalizado` só número, `inicio=created_at` | `animalIdentificadores` | lote de 500 |
| B9 sessões/lotes | enums | `sessoesPesagem`, `loteApartacoes`, `apartacoes` | idempotente |
| B10 payload | remover `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal` do `legacy_payload` | `pesagens` | lote de 500; o mapper já cai para `created_at/updated_at` e projeção |
| B11 limpeza | chaves `cadastros-auxiliares:*`, `perfis-saida:*` | `appSettings` | só após B4/B5 validados (contagens); sanidade exportada antes (ADR-022) |
| B12 verificação | `logicalIntegrity` estendido + contagens | relatório | grava `migration:v7.status='CONCLUIDA'` |

## 6. Lista permitida de `legacy_payload` (gate `payload:allowlist:verify`)

Permitidas: `id, empresa_id, tipo_manejo, motivo_saida, causa_morte, status_animal(legado, só leitura), data_pesagem, animal_id, sessao_id, numero_animal, sexo, raca, era, marca, peso, observacao, apartacao_id, nome_apartacao, lote_id, nome_lote, origem, operador, id_externo, data_anterior, peso_anterior, dias, ganho, gmd, alertas_confirmados, justificativa_alerta, valor_pago_cabeca, origem_animal, documentacao, comprador, destino_venda, valor_venda_total, valor_arroba, rendimento_carcaca, peso_carcaca_estimado, quantidade_arrobas, frigorifico, valor_arroba_abate, valor_total_abate, embarque_id, embarque_nome, documento_embarque_id, documento_tipo, documento_numero, motorista_nome, placa_carreta`.

Proibidas em gravação nova: `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal`, `sanidade_ids`, `sanidades` e qualquer chave fora da lista. O mapper (`uiToStorageRecord`) filtra pela lista; o gate prova o filtro e a ausência das proibidas após criar e editar.
