# Lint, build e testes

Execução em 03/08/2026.

## `npm.cmd run lint`

**PASSOU** — 0 erros.

Warning preexistente fora do escopo:

```text
electron/logging/appLogger.cjs:32:3
Unused eslint-disable directive
```

## `npm.cmd run build`

**PASSOU** — Vite 6.3.6, 2123 módulos transformados.

Warnings não bloqueantes: base de Browserslist desatualizada e chunk principal acima de 500 kB. Nenhuma dependência foi instalada ou atualizada.

## `npm.cmd run test`

**PASSOU integralmente** em duas execuções consecutivas; a certificação final levou 27,9 s.

Incluiu:

- lint e build;
- main boot e preload contract;
- todos os contratos Dexie/storage;
- persistência após reabertura;
- backup, importação e restauração;
- weighing mapper;
- manutenção UI e dialogs;
- documentação de usuário;
- E2E instalado em modo dev-permissive;
- smoke desktop.

## Contrato estrutural adicional

`rg` confirmou `ModeloBase1PageContainer`, `ModeloBase1PageHeader` e `ModeloBase1ActionBar` nas três páginas. Nenhum seletor do shell antigo permanece em `Layout.jsx`.
