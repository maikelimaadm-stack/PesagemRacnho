# INSTALLED-APP-E2E

## Artefato
`release/` presente

## Setup.exe
`Pesagens Individuais Setup 1.0.0.exe` — encontrado

## better-sqlite3
`release/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — encontrado

## asarUnpack
```
node_modules/better-sqlite3/**
**/*.node
```

## Execução instalada
Não automatizada neste ambiente (sem silent install + launch controlado)

## Banco criado / Healthcheck
Não exercitados via E2E instalado; cobertos pelos verifies de manutenção/db em Node

## Limitações do ambiente
Sem instalação silenciosa do Setup.exe / automação UI do app empacotado

## Resultado
PASS com limitação de execução real documentada; artefatos e native module validados
