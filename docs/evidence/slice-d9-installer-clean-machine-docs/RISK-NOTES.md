# RISK-NOTES

## Riscos eliminados
- Stub `legacyWeighingBridge` no tree
- Desinstalação apagando userData sem querer (`deleteAppDataOnUninstall: false`)
- Ausência de documentação simples para usuário
- `npm run test` sem cobertura smoke/e2e/metadata NSIS

## Riscos reduzidos
- Instalador one-click rígido → wizard com pasta alterável
- E2E apenas artefatos → launch opcional do exe empacotado

## Riscos ainda existentes
- Sem ícone customizado
- Sem code signing (SmartScreen)
- Checklist máquina limpa ainda manual
- `electron/db.cjs` JSON legado ainda presente (backup/migração)

## Riscos aceitos por simplicidade
- Sem login/permissões/cloud
- Sem assinatura digital paga neste estágio

## Mitigações
Docs usuário + Manutenção + deleteAppDataOnUninstall false + gates
