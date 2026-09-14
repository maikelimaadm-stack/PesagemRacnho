# SQLITE-ONLY-TRANSITION

## Entidades agora em SQLite

- PesagemIndividual (D.5)
- Apartacao / LoteApartacao (D.7A)
- ConfiguracaoSanidade / ItemSanidade / SanidadeAnimal (D.7B)
- Embarque / DocumentoEmbarque (D.7B)

## Telas atualizadas

- `src/components/sanidade/GerenciarSanidades.jsx` → healthService
- `src/components/embarque/GerenciarEmbarquesDialog.jsx` → shipmentService
- `src/pages/LancamentoPesagensIndividuais.jsx` → healthService + shipmentService
- `ResumoEmbarque.jsx` — props only (sem JSON)

## Fluxos ainda em JSON

- `electron/db.cjs` / `legacyJsonStorage.cjs` — API legada preservada para backup/migração
- Entidades não inventariadas (se houver chaves extras no JSON) — fora do escopo operacional

## Bridge PesagemIndividual

`legacyWeighingBridge.js` **mantida inativa** (fallback documentado; weighingService ainda importa, mas fluxo operacional é SQLite quando migration completed). Remoção definitiva sugerida em D.8+ após E2E instalado.

## Fluxo operacional final

```
UI React
  → healthService / shipmentService (+ mappers)
  → healthDataAdapter / shipmentDataAdapter
  → IPC (preload)
  → repositories SQLite
  → pesagens.db
```
