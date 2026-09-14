# D.17B — relatório de execução

Status: **CONCLUÍDO COM DESVIOS**. Resultado: **APROVADO COM DESVIOS**.

O modelo visual observado no Cadastro de Empresas foi aplicado às três rotas de Pesagens e aos dialogs alcançáveis, mantendo a aplicação React/Vite, Dexie e Electron. Foram registrados baseline técnico, referência real, antes, depois, comparações e smoke da build de produção.

## Resultado

- Shell full-height com header verde de 36 px, sidebar de 220 px, chrome mobile de 48/56 px e navegação funcional.
- Action bars, superfícies, filtros, KPIs, tabela densa, formulários, Manutenção e dialogs no mesmo contrato visual.
- Ações inertes removidas: menu de coluna não é exibido sem callback; “Auto ajustar coluna” só existe com implementação.
- Foco de dialog retorna ao acionador; Escape fecha o dialog.
- CRUD descartável criado pela UI, persistido após reload e removido pela ação real; o perfil terminou limpo.
- Build de produção aberta nas três rotas com console do navegador sem warnings/errors.
- `npm.cmd run lint`, `npm.cmd run build` e `npm.cmd run test`: aprovados.
- Hashes agregados de Electron, storage, módulos de domínio e manifests: idênticos antes/depois.

## Desvios honestos

- A referência precisou de harness visual temporário por colisão de caixa de arquivo no Windows; usou a App/rota/componentes/CSS reais e mock local documentado, sem backend externo. O harness foi removido.
- O modo edição da referência não ficou alcançável sem backend; a leitura, tabela, cards, filtro, dialog, desktop e mobile foram renderizados.
- DM Sans não foi incorporada por ausência de arquivo local/licença verificada; foi usado fallback local offline compatível.
- Não se declara pixel perfect: os domínios e a composição funcional são diferentes.

Não há Git no projeto; nenhum repositório foi inicializado, commit criado ou versão alterada.
