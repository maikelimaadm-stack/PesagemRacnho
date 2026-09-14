# NPM-TEST-AGGREGATOR

## npm run test criado
Sim — em `package.json`

## Comandos incluídos
```
lint, build, db:verify, db:migrations:verify, db:repositories:verify,
weighing:sqlite-only:verify,
maintenance:backup|export|import|restore|integrity:verify,
aux:sqlite-only:verify, d7b:sqlite-only:verify,
maintenance:ui:verify, maintenance:dialog:verify
```

Também:
- `test:quick` — subset rápido
- `test:full` — inclui mappers, migrations, installer, e2e, aux/d7b completos

## Tempo/observações
~30–40s neste ambiente (inclui vite build)

## Resultado
PASS (2026-07-13)
