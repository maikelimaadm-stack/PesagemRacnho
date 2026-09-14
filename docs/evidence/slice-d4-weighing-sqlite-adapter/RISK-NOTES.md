# RISK-NOTES — Slice D.4

## Riscos eliminados
- Novos lançamentos em JSON writeFileSync (tela principal)
- IPC espalhado na UI de pesagens
- CRUD pesagens acoplado a db.entities na tela de lançamento

## Riscos reduzidos
- Perda silenciosa de dados legado (merge híbrido)
- Payload incompatible SQLite (legacy_payload snapshot)

## Riscos remanescentes
- JSON legado ainda writable via bridge edit/delete
- PesagensIndividuais.jsx ainda JSON direto
- Sanidades/embarques ainda JSON
- Lista completa em memória

## Riscos transferidos para D.5
- Migração em massa JSON → SQLite
- Desativação bridge
- Divergência dual-storage

## Riscos de regressão
- Update parcial sem merge (mitigado: fetch+merge existing)
- SQLite indisponível (create falha com erro claro)

## Mitigações
- __source routing update/delete
- Verificação scripts mapper/adapter/hybrid
- JSON preservado no disco
