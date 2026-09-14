# MORTALITY-MODEL — Mortalidade e causas de morte

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Elemento | Implementação |
|---|---|
| Registro da morte | Lançamento › Saída › Motivo `Morte`; peso opcional; `causa_morte` obrigatória |
| Causas | `CausasMorte.jsx` (ModeloBase1) → `registryService` grupo `mortalidade` → `appSettings['cadastros-auxiliares:mortalidade:local'].causasMorte[]` com `nome`, `categoria` (Doença, Acidente, Predação, Parto, Desconhecida, Outra), `descricao`, `exigeObservacao`, `ativo` |
| Vínculo | `legacy_payload.causa_morte` = **nome** da causa |
| `exigeObservacao` | cadastrado, mas **não é aplicado** no Lançamento (nenhuma validação lê o campo) |
| Efeitos | `movimentosAnimais.tipo='Morte'`, `animais.situacao='Inativo'`, `motivo_saida='Morte'` |
| Relatório | nenhum específico; aparece na relação filtrando motivo |

Avaliação: o cadastro é o mais bem resolvido dos auxiliares (ModeloBase1, categoria, inativação). O problema é só a persistência em `appSettings` e o vínculo por nome.

## 2. Modelo alvo

### 2.1 Store `causasMorte` (Dexie v7)

Mesmos campos de hoje (`nome`, `nome_normalizado`, `categoria`, `descricao`, `exige_observacao`, `ativo`, `ordem`) + `empresa_id` e timestamps. Índices: `++localId, &id, empresa_id, nome_normalizado, ativo`.

### 2.2 Evento de morte

Em `pesagens` (evento SAÍDA/Morte): `causa_morte_id` (coluna) + `causa_morte` (snapshot do nome). `exige_observacao` passa a ser validado no serviço: sem observação → recusa.

Peso na morte: opcional, como hoje. Se informado, **não** entra na série de ganho (regra atual, D2 não se aplica à morte).

### 2.3 Relatório mínimo (REP-403 parcial)

Mortes por período, por causa (categoria), por lote e por categoria animal; taxa = mortes / animais ativos médios no período. Sem gráfico obrigatório; tabela com drill-down para os animais.

## 3. Migração

- `appSettings[...mortalidade...].causasMorte[]` → `causasMorte` (ids preservados).
- Saídas `Morte` → `causa_morte_id` por `nome_normalizado`; nome não encontrado cria causa `categoria='Outra'`, `origem='migracao'`, listada no relatório.
- Remover a chave de `appSettings` após validação.

## 4. Fora de escopo

Necropsia, laudo veterinário, notificação sanitária oficial, vínculo com programa sanitário (ADR-007).
