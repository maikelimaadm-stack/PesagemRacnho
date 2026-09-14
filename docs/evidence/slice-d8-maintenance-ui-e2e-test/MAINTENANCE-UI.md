# MAINTENANCE-UI

## Tela criada
`src/pages/ManutencaoSistema.jsx` — título **Backup e Manutenção**

## Rota/menu
- Rota HashRouter: `/ManutencaoSistema`
- Menu superior (`Layout.jsx`): entrada **Manutenção**

## Seções
1. Status do banco
2. Backup
3. Exportação
4. Importação
5. Restauração
6. Diagnóstico

## Ações disponíveis
- Criar backup do banco / completo
- Exportar CSV / JSON
- Selecionar JSON + dry-run + Importar dados
- Selecionar .db + dry-run + Restaurar backup (confirm)
- Verificar integridade / rápida / estatísticas / Copiar diagnóstico

## Serviços usados
`maintenanceService` → `maintenanceDataAdapter` → IPC (`maintenance:*`, `dialog:*`)

## O que NÃO foi criado
- login
- permissões
- usuários
- roles
- autenticação
