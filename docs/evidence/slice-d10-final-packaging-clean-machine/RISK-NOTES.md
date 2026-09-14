# RISK-NOTES (D.10)

## Riscos resolvidos/confirmados neste slice
- Versionamento sem política → CHANGELOG.md + VERSIONING-POLICY.md.
- Dúvida se o binário empacotado inicia → confirmado: launch real do exe PASS.
- Ausência de comprovante para o teste de máquina limpa → registro assinável
  criado (CLEAN-MACHINE-TEST-RECORD.md).

## Riscos ainda existentes (carregados do D.9)
- Sem ícone customizado (default Electron) — decisão do usuário de manter.
- Sem code signing → alerta SmartScreen. Documentado em CODE-SIGNING.md.
- Teste em máquina limpa ainda **manual e não assinado** — depende de execução
  física em Windows limpo.
- `electron/db.cjs` (JSON legado) presente para backup/migração.

## Riscos aceitos por simplicidade
- Sem login/permissões/cloud/servidor.
- Sem assinatura digital paga neste estágio.

## Mitigações
Docs de usuário + tela Manutenção + `deleteAppDataOnUninstall: false` +
gates de verificação (test:quick / test:full / e2e).
