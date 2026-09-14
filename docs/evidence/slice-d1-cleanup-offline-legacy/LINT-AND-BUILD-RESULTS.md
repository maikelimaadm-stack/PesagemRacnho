# LINT-AND-BUILD-RESULTS — Slice D.1

## npm run lint

### resultado antes (auditoria + início D.1)

```
4 errors in src/pages/LancamentoPesagensIndividuais.jsx:
- editingOfflineId is not defined (linha ~1177)
- setEditingOfflineId is not defined (linha ~1227)
- no-case-declarations (case 'numero_registro', linhas ~358-359)
- editingOfflineId is not defined (linha ~1150, prop em criarMensagemAnimal)
```

### resultado depois

```
> pesagens-individuais@1.0.0 lint
> eslint .

(exit code 0 — nenhum erro)
```

Data da execução: 2026-07-09

## npm run build

### resultado

```
> pesagens-individuais@1.0.0 build
> vite build

vite v6.3.6 building for production...
✓ 2072 modules transformed.
✓ built in ~30s
(exit code 0)
```

Warnings não bloqueantes:
- Chunk JS > 500 kB (pré-existente)
- baseline-browser-mapping / caniuse-lite desatualizados (pré-existente)

## npm run test

### resultado

```
npm error Missing script: "test"
(exit code 1 — esperado; script não existe no package.json)
```

Registro: **npm run test: indisponível / script inexistente**

## Observações

- Lint e build executados após todas as alterações do slice
- Nenhum warning ESLint novo introduzido pelo slice
- Build gera `dist/assets/index-zDSqCObx.js` (hash novo após alterações)
