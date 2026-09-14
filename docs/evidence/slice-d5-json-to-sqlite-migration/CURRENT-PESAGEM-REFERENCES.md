# CURRENT-PESAGEM-REFERENCES — Slice D.5

## Comando usado

```bash
rg -n "PesagemIndividual|db\.entities\.PesagemIndividual|legacyWeighingBridge|__source|legacy-json" src electron scripts package.json
```

(Excluindo `node_modules`, `dist`.)

## Referências encontradas antes

| Arquivo | Linha(s) | Classificação |
|---------|----------|---------------|
| `src/modules/weighing/infrastructure/legacyWeighingBridge.js` | 4,20,32-33,42,51 | bridge-temporária |
| `src/modules/weighing/application/weighingService.js` | 8,31,43,69-72,92-93,109,135 | bridge-temporária (condicional) |
| `src/modules/weighing/domain/weighingMapper.js` | 37,88,97 | legado-inofensivo (mapper) |
| `src/pages/PesagensIndividuais.jsx` | — | atualizado para weighingService |
| `src/pages/LancamentoPesagensIndividuais.jsx` | — | atualizado para weighingService |
| `src/components/pesagens/GerenciarApartacoesDialog.jsx` | — | atualizado para weighingService |
| `electron/database/legacyPesagemMigration.cjs` | 38,267 | ativo-operacional (migração) |
| `electron/database/weighingPayloadMapper.cjs` | 24,47,62 | ativo-operacional (mapper main) |
| `electron/database/legacyJsonStorage.cjs` | 7 | legado-inofensivo (entidade JSON) |
| `electron/db.cjs` | 5 | legado-inofensivo (JSON storage) |
| `electron/preload.cjs` | 4 | legado-inofensivo (entidade JSON para outras rotas) |
| `data/pesagens.json` | 2 | legado-inofensivo (backup) |
| `scripts/migration-test-helper.mjs` | 13 | teste/script |
| `scripts/verify-*.mjs` | vários | teste/script |

## Classificação

- **ativo-operacional**: migração e mapper no Electron main
- **bridge-temporária**: `legacyWeighingBridge.js` + ramos condicionais em `weighingService.js`
- **teste/script**: scripts de verificação
- **legado-inofensivo**: JSON storage, preload entity list, mapper `__source`
- **deve-ser-removido**: nenhuma tela operacional

## Referências removidas

- `db.entities.PesagemIndividual` removido de:
  - `src/pages/PesagensIndividuais.jsx`
  - `src/pages/LancamentoPesagensIndividuais.jsx`
  - `src/components/pesagens/GerenciarApartacoesDialog.jsx`

## Referências mantidas

- `legacyWeighingBridge.js` — fallback desativado quando `legacy_pesagem_migration_status = completed`
- `electron/db.cjs` / `preload.cjs` — entidade JSON para storage geral e outras entidades
- `weighingMapper.js` — campo `__source` para merge híbrido (testes e pré-migração)

## Referências finais

Nenhuma tela operacional chama `db.entities.PesagemIndividual` diretamente.

`legacyWeighingBridge` aparece apenas em:
- arquivo da bridge
- `weighingService.js` (ramos condicionais, inativos após migração)
- scripts/testes
- documentação/evidence
