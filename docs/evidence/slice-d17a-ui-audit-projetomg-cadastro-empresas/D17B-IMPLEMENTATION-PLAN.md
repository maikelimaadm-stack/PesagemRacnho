# Plano de implementação D.17B

## Objetivo

Aplicar ao Pesagens a aparência e a composição do Cadastro de Empresas, mantendo integralmente o runtime offline, Dexie, Electron, regras, handlers, dados e fluxos de backup/export/import.

## Estratégia técnica

Criar uma camada presentacional mínima no Pesagens, preferencialmente em `src/components/modelobase1/`, que receba `children`, estado visual e callbacks já existentes. Ela pode copiar markup, nomes de classes e tokens do PROJETOMG. Ela não deve copiar providers, hooks de domínio, preferências, permissões, fetch, Supabase, autenticação ou metadados empresariais.

Componentes candidatos: `PesagensShell`, `MakPageHeader`, `MakActionBarLite`, `MakFilterPanelLite`, `MakSectionCard`, `MakDialogShell`, `MakEmptyState`, `MakTableFooter` e `MakMobileBar`. Os nomes finais podem mudar, mas as responsabilidades devem permanecer visuais.

## O que pode ser copiado

- Tokens efetivos e regras escopadas do `mg-prototype.css` que ainda não estejam presentes.
- Estrutura/markup visual dos headers, sidebar, action bar, filtro, cards, estados vazios e dialogs.
- Convenções de classes `mg-*`, `emp-*`, `ios-btn` e `tb-btn` necessárias ao resultado.
- Geometria, breakpoints, ordem visual, estados e iconografia.

## O que precisa ser adaptado

- Menu: somente três rotas do Pesagens.
- Breadcrumbs/títulos: vocabulário do Pesagens.
- Action bar: somente ações reais, ligadas aos handlers atuais.
- Registro/cards/tabela: aplicar apenas modos que representem o conteúdo real.
- Formulários: manter campos, condicionais, validação e gravação existentes.
- Tabela: manter consulta/seleção/paginação atuais e adicionar comportamento apenas com teste explícito.
- Manutenção: traduzir para a linguagem visual de Empresas, sem simular equivalência de domínio.
- Fonte: resolver offline; não reintroduzir import remoto.

## Ordem segura

1. Registrar baseline funcional e visual executável; corrigir a infraestrutura de captura, não o produto.
2. Congelar o contrato de tokens/cascata e escolher a estratégia offline de tipografia.
3. Criar componentes base puramente visuais, com testes de renderização/props quando apropriado.
4. Aplicar shell global, header desktop/mobile e sidebar.
5. Adaptar `PesagensIndividuais.jsx` primeiro: é a maior correspondência com a listagem da referência.
6. Adaptar `LancamentoPesagensIndividuais.jsx` por regiões, sem mover lógica entre funções.
7. Adaptar `ManutencaoSistema.jsx`, preservando backup/export/import/restore/diagnóstico.
8. Adaptar dialogs de Apartação, Sanidade e Embarque e componentes de resumo.
9. Executar regressão funcional/Dexie e matriz visual desktop/mobile.
10. Gerar screenshots lado a lado e relatório de paridade/gaps residuais.

## Arquivos de Pesagens candidatos

- `src/Layout.jsx`, `src/App.jsx` (somente toaster/shell visual se necessário).
- `src/index.css`, `src/styles/modelobase1.css` e cópias em `src/styles/modelobase1/` apenas para reconciliação comprovada.
- As três páginas em `src/pages/`.
- `src/components/mak/`, `src/components/ui/` com impacto revisado.
- Componentes em `src/components/pesagens/`, `sanidade/` e `embarque/`.
- Novos componentes estritamente visuais em `src/components/modelobase1/`.

## Arquivos proibidos

- `src/storage/**`.
- `src/modules/**/application/**`, `domain/**`, `infrastructure/**`.
- `src/api/db.js`, `src/components/DbBootstrap.jsx`.
- `electron/**`, `data/**` e scripts de verificação Dexie.
- `package.json` e lockfile, salvo decisão explícita e separada sobre dependência visual indispensável.
- Artefatos de release/instalador.

## Como não recriar lógica

- Capturar os handlers existentes antes da edição e conectá-los às novas superfícies.
- Não mudar assinaturas de funções, queries, hooks, estados de domínio ou transações.
- Preferir wrappers e composição; evitar extrair blocos funcionais grandes no mesmo slice visual.
- Cada botão novo deve apontar para uma ação existente ou permanecer ausente; nunca criar affordance inerte.
- Revisar diff por categorias: markup/classes permitido; armazenamento/consulta proibido.

## Validação Dexie e operacional

- Rodar `npm run test` completo, além de lint/build.
- Validar primeiro uso/banco vazio.
- Criar, editar, excluir e recarregar pesagem; conferir persistência após reinício.
- Exercitar compra, venda, abate, embarque, apartação e sanidade.
- Gerar backup, exportar, importar e restaurar uma cópia de teste; comparar contagens/checksum quando disponível.
- Verificar diagnóstico e indicador de status do banco.
- Confirmar que nenhum schema/version/migração Dexie mudou.

## Validação visual

- Capturas nos tamanhos 1366×768, 1440×900, 1024×768, 768×1024 e 390×844.
- Comparação lado a lado/overlay para header, sidebar, toolbar, campos, cards, tabela e dialogs.
- Medir alturas, gaps, radius, cores computadas e overflow.
- Validar estados default, hover, focus, disabled, invalid, loading, empty e dialog aberto.
- Testar offline para confirmar fonte/fallback e ausência de requisição visual obrigatória.

## Critério de encerramento

A D.17B só pode declarar fidelidade quando houver evidência visual executável e regressão funcional verde. Sem screenshot da referência, o máximo aceitável é “aderência ao contrato derivado do código”, não “igualdade visual comprovada”.
