# HEALTH-CUTOVER

Sanidade (ConfiguracaoSanidade / ItemSanidade / SanidadeAnimal) migrada para Dexie.

- `healthDataAdapter.js` → `storageAdapter.configuracoesSanidade` / `.itensSanidade` / `.sanidadesAnimal`.
- Linhas cruas; list com limit 1000 (comportamento preservado). Assinaturas preservadas.
- Sem window.pesagemApp para dados.

Validação: storage:sqlite-detached; build PASS.
