# INSTALLER-SQLITE-VALIDATION — Slice D.6

## Config electron-builder

- `appId`: com.pesagens.individuais
- `productName`: Pesagens Individuais
- `directories.output`: release
- `win.target`: nsis x64
- `nsis`: oneClick, perMachine=false (userData fora de Program Files)
- `files`: dist, electron, package.json, better-sqlite3
- `asarUnpack`: `node_modules/better-sqlite3/**`, `**/*.node`
- `postinstall`: `electron-builder install-app-deps` (rebuild nativo)

## better-sqlite3

- Em `dependencies`: `^12.11.1`
- `npm run dist` executou `@electron/rebuild` para Electron 35.7.5 com sucesso

## asarUnpack

Após `npm run dist` (2026-07-10):

- `release/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3` presente
- Binário `.node` empacotado fora do asar

## Artefato gerado

- `release/Pesagens Individuais Setup 1.0.0.exe`
- `release/win-unpacked/Pesagens Individuais.exe`
- blockmap gerado

## Teste em dist

- Empacotamento PASS
- Rebuild nativo PASS
- asarUnpack PASS

## Teste instalado

Não executado instalação interativa do Setup.exe neste ambiente (limitação). Validação máxima via artefatos + config + rebuild.

## Limitações do ambiente

- Sem teste E2E do app instalado em Program Files / userData real
- Ícone default do Electron (warning do builder)
- Sem code signing

## Riscos

- Dev mode (`desktop:dev`) pode falhar se better-sqlite3 não estiver rebuildado para ABI do Electron — mitigado por `postinstall` + rebuild no dist
- Artefato antigo (pré-D.6) não tinha `app.asar.unpacked`; regenerado neste slice

## Correções feitas

- Adicionado `**/*.node` ao asarUnpack
- Adicionado `postinstall: electron-builder install-app-deps`
- Regenerado instalador com rebuild nativo
