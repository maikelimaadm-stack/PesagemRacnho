# R0 — Arquivos alterados (`d389f06..872d6b2`)

| Arquivo | Mudança |
|---|---|
| `src/modules/maintenance/application/maintenanceService.js` | autorização pela matriz com papel real |
| `src/pages/ManutencaoSistema.jsx` | ações destrutivas visíveis só com permissão |
| `src/modules/auth/domain/permissionService.js` | `reports.read/export/templates.share`; `audit.read` A/G |
| `src/modules/weighing/infrastructure/weighingDataAdapter.js` | projeção por último evento com peso; herança de categoria; id de cadastro preferido |
| `src/modules/weighing/domain/weighingMapper.js` | allowlist com ids estruturais |
| `src/modules/weighing/domain/commercialCalculations.js` | fórmula canônica de arroba, sem 50 % |
| `src/modules/reporting/domain/aggregateEngine.js` | **novo** motor de agregação |
| `src/modules/settings/application/appConfigService.js` | `rendimento_padrao` padrão `null` |
| `src/modules/weighing/application/weighingService.js` | autorização de escrita no serviço |
| `src/components/pesagens/ResumoLotes.jsx`, `ResumoVendaDia.jsx` | motor canônico |
| `src/pages/FichaAnimal.jsx` | KPIs sem null→0, arroba canônica, mapa por id |
| `src/pages/PesagensIndividuais.jsx` | ações por permissão, colunas de valor, estatísticas canônicas |
| `src/pages/LancamentoPesagensIndividuais.jsx` | valores comerciais por permissão, estimativa sem rendimento |
| `package.json` | 4 gates novos no `test:quick` |
| `scripts/verify-maintenance-access.mjs`, `verify-category-projection.mjs`, `verify-weighing-access.mjs` | **novos** |
| `scripts/verify-auth-permissions.mjs`, `verify-access-policy.mjs`, `verify-payload-allowlist.mjs`, `verify-enterprise-hardening.mjs`, `verify-local-auth.mjs`, `verify-operational-customization.mjs` | contrato novo (decisões fechadas), com casos negativos adicionados |
