# RISK-NOTES — Slice D.7A

## Riscos eliminados

- Apartacao/LoteApartacao editáveis só via JSON nas telas de pesagens
- Dependência JSON para filtros de apartação/lote no fluxo principal

## Riscos reduzidos

- Fragmentação de dados auxiliares (agora no mesmo pesagens.db)
- Perda em migração (backup + dry-run + idempotência)

## Riscos remanescentes

- Sanidade e Embarque ainda em JSON
- Bridge PesagemIndividual ainda no código
- better-sqlite3 ABI: Node vs Electron (rebuild necessário)
- Sem UI de manutenção
- Sem npm run test / E2E instalador

## Entidades ainda em JSON

SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade, Embarque, DocumentoEmbarque

## Riscos de regressão

- FK lote→apartacao: import/migração de lote sem pai é inválido
- Soft delete vs delete hard do JSON antigo (comportamento muda para soft)

## Mitigações

- Scripts aux:* verify
- Auto-migração no startup
- legacy_payload preserva campos extras
