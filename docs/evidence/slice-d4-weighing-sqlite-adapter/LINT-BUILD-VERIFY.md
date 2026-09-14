# LINT-BUILD-VERIFY — Slice D.4

## npm run lint
OK (exit 0)

## npm run build
OK (exit 0, ~27s)

## npm run test
Indisponível — script inexistente

## npm run db:verify
OK

## npm run db:migrations:verify
OK

## npm run db:repositories:verify
OK

## npm run weighing:mapper:verify
OK

## npm run weighing:adapter:verify
OK

## npm run weighing:hybrid:verify
OK

## rg final
```
src/pages/LancamentoPesagensIndividuais.jsx:
  db.entities.Apartacao, LoteApartacao, Sanidade*, Embarque, DocumentoEmbarque
  (PesagemIndividual removido — CRUD via weighingService)

src/modules/weighing/infrastructure/legacyWeighingBridge.js:
  db.entities.PesagemIndividual (bridge temporária D.5)

electron/, package.json: sem base44/offline residuals
```
