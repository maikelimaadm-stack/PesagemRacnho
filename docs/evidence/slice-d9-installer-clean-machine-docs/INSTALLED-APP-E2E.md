# INSTALLED-APP-E2E

## Setup.exe
`release/Pesagens Individuais Setup 1.0.0.exe` — ok (após `npm run dist`)

## app.asar
`release/win-unpacked/resources/app.asar` — ok

## app.asar.unpacked
Presente — ok

## better-sqlite3
`.../better_sqlite3.node` em asar.unpacked — ok

## Execução real
- Default: artefatos only
- Opcional: `D9_LAUNCH_PACKAGED=1` → lança `Pesagens Individuais.exe` ~4s e encerra — **PASS** neste ambiente
- Setup.exe instalação interativa: não automatizada

## Banco criado / Healthcheck
Não validados via instalação NSIS; cobertos por verifies Node + checklist manual

## Limitações
Sem silent install do Setup.exe; checklist em `docs/user/TESTE-MAQUINA-LIMPA.md`

## Resultado
PASS
