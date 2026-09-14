# NEXT-SLICE-D7-READINESS — Slice D.6

## Estado após D.6

```
PesagemIndividual = SQLite operacional
Manutenção = backup/export/import/restore/integrity via IPC
Instalador = better-sqlite3 empacotado com asarUnpack
JSON legado = preservado
UI visual = inalterada
```

## O que está pronto

- Camada maintenance completa no main process
- Renderer service opcional (`maintenanceService`)
- Scripts verify D.6
- Dist/NSIS regenerado com nativo unpack

## O que ainda falta

- Tela de manutenção/backup para usuário final
- Remoção definitiva de `legacyWeighingBridge`
- Migração das entidades auxiliares JSON
- Suite `npm run test`
- Validação E2E do instalador em máquina limpa
- Ícone e code signing

## Recomendação para D.7

**Slice D.7** — Tela de manutenção/backup para usuário final **ou** migração planejada das entidades auxiliares restantes (`Apartacao`, `Sanidade`, `Embarque`), escolhendo uma frente por vez.

Preferência sugerida: tela de manutenção (expõe D.6 ao usuário) antes de migrar mais entidades.

## Entidades JSON restantes

Apartacao, LoteApartacao, SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade, Embarque, DocumentoEmbarque

## Instalador

Artefato gerado; falta teste instalado real + signing

## Testes

Verifies por script; falta suíte unificada

## Gates recomendados

- `maintenance:ui:verify` (quando houver tela)
- `installer:e2e:verify` (smoke no Setup.exe)
- `entities:apartacao:sqlite:verify` (se D.7 migrar entidades)
