# Referência visual em execução

A App real do PROJETOMG foi carregada localmente com `ErpShell`, a rota `/CadastroEmpresas`, `PAGEMP`, componentes MAK e estilos ativos. O login mock documentado foi usado somente localmente; não foram transmitidas credenciais nem acessado backend externo.

## Contingência aplicada

No Windows, o import default `@/shared/layouts/ErpOperationBadge` colidia com `erpOperationBadge.js` por resolução case-insensitive, causando erro de módulo. Um `vite.config.mjs` temporário, fora do projeto de referência, forçou exclusivamente a resolução para `ErpOperationBadge.jsx`. Um `.env.local` temporário habilitou mock local e rota inicial. Ambos foram removidos após as capturas.

Classificação: **harness visual temporário com componentes reais**, não rota autenticada de produção.

## Estados alcançados

- Tabela e filtro lateral.
- Registro em leitura.
- Cards.
- Dialog de configuração de layout.
- Desktop 1440 × 900 e 1366 × 768.
- Mobile 390 × 844 com menu.
- Empty state real com backend local indisponível.

O modo edição não foi habilitado sem o backend. A preferência remota indisponível apareceu como aviso esperado da referência e não foi copiada para Pesagens.
