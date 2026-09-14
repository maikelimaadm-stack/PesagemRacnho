# SQLITE-ONLY-TRANSITION — Slice D.7A

## Entidades agora em SQLite

- PesagemIndividual (D.5)
- Apartacao / LoteApartacao (D.7A)
- animals / lots (D.3 — infra)

## Telas atualizadas

- `PesagensIndividuais.jsx`
- `LancamentoPesagensIndividuais.jsx`
- `GerenciarApartacoesDialog.jsx`

## Fluxos ainda em JSON

- Sanidade*
- Embarque*
- DocumentoEmbarque

## Bridge PesagemIndividual

Mantida, inativa quando migração completed.

## Fluxo operacional final (migradas)

```
UI → apartacaoService → auxiliaryDataAdapter → IPC → repository → SQLite
```
