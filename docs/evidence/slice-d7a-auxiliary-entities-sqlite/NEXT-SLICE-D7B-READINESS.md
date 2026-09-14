# NEXT-SLICE-D7B-READINESS — Slice D.7A

## Estado após D.7A

```
PesagemIndividual = SQLite
Apartacao / LoteApartacao = SQLite
animals / lots = SQLite (infra)
Sanidade* / Embarque* = JSON
```

## Entidades migradas

Apartacao, LoteApartacao (+ animals/lots já existentes)

## Entidades pendentes

SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade, Embarque, DocumentoEmbarque

## Recomendação D.7B

Migrar **Sanidade*** e/ou **Embarque*** para SQLite com o mesmo padrão (schema + repo + IPC + service + migração idempotente), sem UI redesign.

Alternativa: tela de manutenção/backup (expõe D.6) se prioridade for usabilidade.

## Tela de manutenção

Ainda não existe — candidata a D.8

## Teste instalado

Pendente

## Gates recomendados

- `aux:sanidade:verify`
- `aux:embarque:verify`
- `maintenance:ui:verify`
- Remoção de legacyWeighingBridge após validação
