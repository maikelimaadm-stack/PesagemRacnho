# D7B-SCOPE-DECISION

## Entidades escolhidas

- ConfiguracaoSanidade
- ItemSanidade
- SanidadeAnimal
- Embarque
- DocumentoEmbarque

## Motivo

Últimas entidades operacionais P2 ainda em JSON após D.7A (pesagens + apartações já SQLite-only). Inventário e UI confirmam uso direto nessas cinco.

## Entidades adiadas

- Nenhuma entidade operacional P2 adicional neste slice.
- `shipment_animals` (spec genérico EN) — **não aplicável** ao domínio real.
- Entidades não inventariadas / não usadas em telas.

## Motivo (adiadas)

Schema proposto em inglês (`health_configs`, `shipments` genéricos) não batia com campos reais da UI (nome_sanidade, medicamento, GTA/NFe, etc.). Optou-se por tabelas PT alinhadas ao domínio.

## Risco de escopo

Baixo — escopo limitado às 5 entidades + wiring IPC/services/migration/verifies/evidências.

## Como o escopo foi controlado

1. Inventário prévio (D.7A readiness + inventário D.7B).
2. Schema alinhado a campos reais das telas.
3. Sem redesenho UI; sem tela de manutenção; sem cloud.
4. Gates D.3–D.7A preservados.
