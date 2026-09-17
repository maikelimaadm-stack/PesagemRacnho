# 18 — Permissões para relatórios

## 1. Estado atual

Perfis: **ADMIN, GESTOR, OPERADOR, CONSULTA**.

Fonte: `src/modules/auth/domain/permissionService.js:18-45` (`MATRIX`).

| Ação declarada | ADMIN | GESTOR | OPERADOR | CONSULTA | Usada no código |
|---|---|---|---|---|---|
| `weighing.read` | ✔ | ✔ | ✔ | ✔ | rotas |
| `launch.use` | ✔ | ✔ | ✔ | ✖ | rota Lançamento |
| `weighing.write` / `weighing.edit` | ✔ | ✔ | ✔ | ✖ | **não aplicada na Relação** (CONSULTA vê editar/excluir) |
| `session.close` / `session.reopen` | ✔ | ✔ | ✖ | ✖ | rota Fechamento (`Layout.jsx:44`) |
| `animal.read` | ✔ | ✔ | ✔ | ✔ | rota Ficha |
| `registry.read` / `registry.write` | ✔/✔ | ✔/✔ | ✔/✖ | ✔/✖ | **service** de cadastro |
| `commercial.read` | ✔ | ✔ | ✖ | ✔ | **não usada** |
| `commercial.values` | ✔ | ✔ | ✖ | ✖ | **não usada** — valores visíveis a todos |
| `shipment.read` / `shipment.write` | ✔/✔ | ✔/✔ | ✔/✖ | ✔/✖ | parcial |
| `reports.read` | ✔ | ✔ | ✖ | ✔ | **não usada** |
| `audit.read` | ✔ | ✔ | ✖ | ✔ | **não usada** (não há tela) |
| `maintenance.backup` | ✔ | ✔ | ✖ | ✖ | rota |
| `maintenance.restore/clear/reset/migrate` | ✔ | ✖ | ✖ | ✖ | service verifica, mas **não dispara** (G-P0-01) |
| `users.manage` | ✔ | ✖ | ✖ | ✖ | service + rota |
| `settings.operational` | ✔ | ✔ | ✖ | ✖ | **não usada** — rota exige `settings.manage` e bloqueia GESTOR |
| `settings.auth` / `settings.manage` | ✔ | ✖ | ✖ | ✖ | service + rota |
| exportação | — | — | — | — | **não existe** |

Só os services de cadastro, usuários e configurações aplicam autorização; o resto depende de `RequirePermission` na rota.
Ator disponível para “emitido por”: `authSession.getSessionActor()`, `getCurrentActor()`, `useAuth().user`.

## 2. Problemas

1. CONSULTA vê Exportar/Importar/editar em lote/excluir na Relação.
2. Valores comerciais aparecem para todos os perfis.
3. Nada impede exportar dados de usuários ou auditoria (quando existir relatório).
4. OPERADOR não tem `reports.read` — mas usa Fechamento e resumos do dia.

## 3. Proposta (mínima — sem permissão por relatório)

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA | Onde aplicar |
|---|---|---|---|---|---|
| `reports.read` (ver/emitir relatórios operacionais A–E, G, I1) | ✔ | ✔ | ✔ (decisão) | ✔ | rota + service de relatório |
| `reports.export` (**nova**) — CSV/JSON/PDF/impressão | ✔ | ✔ | ✖ | ✖ (decisão) | service de exportação |
| `commercial.values` — colunas `sensitive: 'commercial'` e família F | ✔ | ✔ | ✖ | ✖ | ColumnDefinition: coluna some da lista, do filtro e da exportação |
| `audit.read` — H2 (matriz atual: A/G/C) | ✔ | ✔ | ✖ | ✔ (decisão: auditoria contém valores em `antes/depois`; mascarar sem `commercial.values`) | rota + service |
| `users.manage` — I4 | ✔ | ✖ | ✖ | ✖ | service (sempre via `sanitize`) |
| `reports.templates.share` (**nova**, opcional) — salvar modelo compartilhado | ✔ | ✔ | ✖ | ✖ | service de modelos |

Regras:
- Autorização **no service** (não só na rota), porque a exportação chama o service direto.
- A **definição do relatório** declara `requires: ['reports.read', 'commercial.values'?]`; o registro de relatórios filtra o catálogo pelo perfil.
- Modelo salvo não amplia permissão: ao abrir, colunas não autorizadas são removidas e o usuário é avisado.
- O manifesto de emissão registra usuário, perfil, data/hora, filtros e hash (ver `13`).
- Colunas proibidas em qualquer relatório: `password_*`, `recovery_*`.
