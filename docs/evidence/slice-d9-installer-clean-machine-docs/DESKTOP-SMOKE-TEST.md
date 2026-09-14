# DESKTOP-SMOKE-TEST

## Script
`scripts/verify-desktop-smoke.mjs`  
`npm run desktop:smoke:verify`

## Validações
- productName / main entry
- arquivos essenciais (main, preload, pages, Layout)
- docs/user presentes
- rotas Pesagens / Lançamento / Manutenção
- manutenção sem login/auth
- telas operacionais sem `db.entities.*` migradas e sem `legacyWeighingBridge`
- bridge file ausente
- userData path no main + título da janela

## Resultado
PASS

## Limitações
Não abre UI Electron; validação estática de contrato
