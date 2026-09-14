# Mapa de preservação funcional

| Área | Fonte de estado/handler preservada | Alteração D.17B | Verificação |
|---|---|---|---|
| Lista | queries, filtros, sort, seleção, import/export, delete/update | somente composição/classes; filtro ganhou abrir/fechar | navegador + suíte |
| Lançamento | `handleSalvar`, validações, cálculo, atalhos, services | somente classes e acessibilidade | navegador + mapper/storage |
| Apartações/lotes | callbacks e dialog existentes | shell visual global | abre/fecha; storage backup/CRUD |
| Sanidade | callbacks/configuração existentes | shell visual global | abre/fecha; adapter intacto |
| Embarques/documentos | callbacks e relações existentes | shell visual global | fluxo Saída → Abate → dialog alcançado |
| Manutenção | backup, CSV, JSON, import, restore, integridade, diagnóstico | grid/card visual | contratos e storage flow aprovados |
| Colunas | ordenar, filtrar, congelar, ocultar | ação sem callback removida | menu real validado no navegador |
| Rotas | HashRouter e `pages.config.js` | links funcionais no shell | três rotas em dev e produção |

Assinaturas de service, payloads, hooks de persistência e handlers de domínio não foram modificados. Os testes de persistência usaram bancos/temporários descartáveis; nenhum dado real do usuário foi alterado.
