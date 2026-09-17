# R0 — Testes

## Gates novos

| Script | Gate | Casos |
|---|---|---|
| `verify-maintenance-access.mjs` | `auth:maintenance-access:verify` | 16 recusas (GESTOR/OPERADOR/CONSULTA/sem papel × restaurar/migrar/limpar/resetar); ADMIN passa da autorização; ator legado sem papel recusado |
| `verify-category-projection.mjs` | `category-projection:verify` | Saída por Morte sem peso; edição da saída; peso fora de faixa; manual preservada; cenário da regressão. **Contraprova:** com o adapter anterior falha em “Saída sem peso preserva a última categoria válida” |
| `verify-weighing-access.mjs` | `auth:weighing-access:verify` | CONSULTA recusada em create/update/delete/bulkUpdate/bulkDelete/bulkCreate; OPERADOR lança/edita; sem sessão não bloqueia; inspeção de fonte da Relação e do Lançamento |
| `verify-auth-permissions.mjs` (existente, agora no agregador) | `auth:permissions:verify` | matriz 28×4; negativos: CONSULTA sem `audit.read`, OPERADOR sem `reports.export`, CONSULTA sem `reports.templates.share` |

## Gates ajustados por decisão fechada (não afrouxados)

| Gate | Antes | Agora |
|---|---|---|
| `enterprise:hardening` | `normalizeCarcassYield('150') === 50` | `=== null`; novo caso “sem rendimento → arrobas null” |
| `auth:local` | default `rendimento_padrao: 50` | `null` |
| `ui:operational-customization` | default 50; regex do `rendimento_origem` | default `null`; origem só com rendimento válido |
| `auth:access` / `auth:permissions` | 26 ações | 28 ações |
| `payload:allowlist` | — | ids estruturais preservados + desconhecida descartada |

## Execução final

```text
npm run test:quick  → EXIT=0 (lint + 33 verificações)
npm run build       → ✓ built
```
