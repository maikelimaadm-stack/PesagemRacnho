# SHIPMENT-FLOW-MODEL — Fluxo de embarque e máquina de estados

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

| Store / tela | Campos | Observação |
|---|---|---|
| `embarques` | `nome`, `data`, `frigorifico` (texto), `status` (`Planejado`, `Em andamento`, `Concluido`, `Cancelado`), `empresa_id` | status é um `Select` livre; nenhuma transição é validada |
| `documentosEmbarque` | `embarque_id`, `tipo_documento` (`GTA`, `NF-e`, `GTA+NF-e`), `numero_gta`, `numero_nfe`, `motorista_nome`, `placa_carreta`, `previsao_machos`, `previsao_femeas` | motorista e placa estão no documento, não no embarque |
| `GerenciarEmbarquesDialog.jsx` | popup dentro do Lançamento | exclusão bloqueada se houver pesagens ou documentos vinculados |
| Vínculo com animais | `pesagens.embarque_id` + `documento_embarque_id` | não existe "item de embarque"; o animal entra no embarque quando a Saída é salva |
| `ResumoEmbarque.jsx` | previsão M/F × embarcados por documento | útil; manter a ideia |

Problemas: status sem regra; embarque "Concluído" ainda aceita saídas; o embarque não sabe quantos animais tem sem varrer pesagens; motorista/placa por documento em vez de por viagem; `frigorifico` texto.

## 2. Modelo alvo

### 2.1 Entidades

```text
embarques (viagem)              1 ── N  documentosEmbarque (GTA, NF-e, outro)
  frigorifico/destino: parceiro_id
  transportador: parceiro_id (opcional), motorista, placa(s)
  previsao_machos, previsao_femeas, capacidade
  status (máquina abaixo)
                                1 ── N  itens: evento SAÍDA do animal com embarque_id (índice já existe)
```

Não criar store `itensEmbarque`: o evento de saída com `embarque_id` **é** o item. A contagem usa o índice `pesagens.embarque_id`.

### 2.2 Máquina de estados

| De | Para | Condição | Efeito |
|---|---|---|---|
| — | `PLANEJADO` | criação | pode editar tudo |
| `PLANEJADO` | `EM_CARREGAMENTO` | ao menos um documento, ou política "documento depois" | aceita saídas (Venda/Abate/Transferência) |
| `EM_CARREGAMENTO` | `CONFERIDO` | contagem embarcada = prevista, ou divergência justificada | bloqueia novas saídas; permite corrigir documentos |
| `CONFERIDO` | `CONCLUIDO` | operação comercial vinculada fechada, ou nenhuma operação exigida | somente leitura |
| `PLANEJADO`/`EM_CARREGAMENTO` | `CANCELADO` | sem saídas vinculadas, ou saídas revertidas com auditoria | |
| `CONCLUIDO` | `CONFERIDO` (reabrir) | motivo obrigatório + auditoria | |

Transições fora da tabela são recusadas pelo serviço, não pela tela.

### 2.3 Regras

1. Saída só aceita `embarque_id` com status `EM_CARREGAMENTO`.
2. Animal só pode estar em um embarque não cancelado.
3. Cancelar embarque com saídas exige reverter as saídas primeiro (fluxo auditado de `ANIMAL-LIFECYCLE-TARGET.md`).
4. Conferência compara `previsao_machos/femeas` com a contagem por sexo dos animais embarcados; divergência exige justificativa gravada no embarque.

### 2.4 Tela

Tela própria "Embarques" (ModeloBase1): lista com status, destino, data, previsto/embarcado; ficha com documentos e lista de animais; ações de transição visíveis conforme o estado. O popup `GerenciarEmbarquesDialog` deixa de existir; no Lançamento fica apenas a seleção do embarque `EM_CARREGAMENTO`.

## 3. Migração

- `status` texto → enum: `Planejado`→`PLANEJADO`, `Em andamento`→`EM_CARREGAMENTO`, `Concluido`→`CONCLUIDO`, `Cancelado`→`CANCELADO`.
- `frigorifico` texto → `parceiro_id` por nome normalizado (criar parceiro se necessário).
- `motorista_nome`/`placa_carreta` do documento → copiados para o embarque quando houver um único documento; caso contrário mantidos no documento e listados no dry-run.
- Embarques `CONCLUIDO` com pesagens posteriores à data do embarque são listados como inconsistência (não corrigidos automaticamente).

## 4. Fora de escopo

Roteirização, rastreamento GPS, pesagem na balança rodoviária, integração com transportadora, emissão de GTA.
