# RISK-NOTES

## Riscos eliminados

- Sanidade/Embarque operacionais dependendo de JSON
- Telas usando `db.entities` para as 5 entidades P2
- Schema sem tabelas de sanidade/embarque

## Riscos reduzidos

- Perda de dados na migração (backup + dry-run + idempotência)
- Divergência UI↔schema (nomes PT alinhados ao domínio real)

## Riscos remanescentes

- Sem tela de manutenção para o usuário final
- Sem E2E do app instalado
- Sem `npm run test`
- `legacyWeighingBridge.js` ainda no tree (inativa)
- `electron/db.cjs` ainda escreve JSON (legado/backup)
- Integrity `shipmentAnimals: 0` (por design)

## Entidades ainda em JSON

Nenhuma das 5 P2 alvo. JSON permanece como arquivo legado/backup com as chaves históricas.

## Riscos de regressão

- Soft-delete vs `ativo: false` em configs (UI usa desativar via update)
- FK itens→config: itens órfãos no legado podem ser inválidos na migração

## Mitigações

- Verifies D.7B + gates anteriores
- Auto-migrate no boot (`tryAutoMigrateSanidadeEmbarque`)
- JSON nunca apagado
