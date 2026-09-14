# INSTALLER-REGENERATION

## Situação anterior
O instalador `release/Pesagens Individuais Setup 1.0.0.exe` estava **AUSENTE**
(removido externamente ao ambiente, provável antivírus/sandbox), fazendo
`release:checksum` e `release:manifest` falharem.

## Ação (D.11)
`npm run dist` (= `vite build && electron-builder --win`) → **exit 0**.

Log relevante do electron-builder:
- `@electron/rebuild electronVersion=35.7.5 arch=x64 buildFromSource=false`
- `preparing / finished moduleName=better-sqlite3 arch=x64`
- `packaging platform=win32 arch=x64 electron=35.7.5 → release\win-unpacked`
- `updating asar integrity executable resource`
- `building target=nsis file=release\Pesagens Individuais Setup 1.0.0.exe oneClick=false perMachine=false`
- `default Electron icon is used` (ícone pendente — decisão mantida)
- `no signing info identified, signing is skipped` (code signing pendente)
- `building block map`

## Resultado
- Instalador regenerado: `release/Pesagens Individuais Setup 1.0.0.exe`
- Tamanho: 93.849.464 bytes
- **Novo SHA256**: `9d8c97bc71ff6e7a51c873e26bc67155fd7bb815df54d7ed16f661a3cb75945a`
- Versão mantida em **1.0.0** (sem bump).

## Nota sobre o SHA256
O SHA256 mudou em relação ao registrado no D.10.1 (`e1315fee...2688`). Isso é
**esperado** ao regerar o instalador (metadados/timestamps/rebuild). O valor
antigo fica inválido; checksum e manifest foram refeitos com o novo.

## Nota sobre ABI (better-sqlite3)
O electron-builder recompila o native para o Electron durante o dist. better-sqlite3
v12 usa N-API (ABI-estável), então o módulo continua carregável tanto no Node
(testes) quanto no Electron (app). Verificado após o dist:
`node -e "require('better-sqlite3')"` → carregou OK.
