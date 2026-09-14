# QUALITY-SCALABILITY-NOTES — Slice D.4

## 10 mil registros
OK — SQLite paginado (1000/page) + merge legado

## 100 mil registros
Parcial — listAllEntries itera páginas; legado JSON carrega array completo (risco)

## 1 milhão de registros
Não pronto — legado JSON full load; UI filtra client-side

## Paginação
SQLite: limit 1000/offset loop | UI: ainda filtra dia client-side

## Deduplicação
Por `id` — SQLite prevalece

## Uso de memória
Híbrido carrega SQLite pages + JSON legado inteiro na bridge

## Riscos de performance
- loadAllData traz todas pesagens para state
- Resumos recalculam em useMemo

## Melhorias futuras
- Filtro data no SQLite IPC (D.5)
- Paginação na UI PesagensIndividuais
- Remover bridge após migração
