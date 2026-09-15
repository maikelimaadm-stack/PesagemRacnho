# S-00.0 — Riscos

| # | Risco | Situação | Mitigação |
|---|---|---|---|
| 1 | Gate "corrigido" apenas para passar, escondendo regressão real | descartado | a prova (`grep -c GerenciarSaidasDialog` = 0 na tag) mostra que o componente já não era usado; o novo gate é mais restritivo (proíbe o popup e exige seleção do registry) |
| 2 | Trabalho paralelo na mesma árvore voltar a deixar gates vermelhos | aberto | dono único por arquivo compartilhado (`verify-ui-consistency.mjs` pertence ao orquestrador, ADR-040/048); `test:quick` obrigatório antes de integrar |
| 3 | `ui:operational-customization` acoplado ao registry em `appSettings`, que será substituído por stores em 1.2.0 | aberto, previsto | o gate será trocado por `launch:contract:verify` em 1.4.0 (ADR-031/034); até lá protege o contrato vigente |
| 4 | `GerenciarSaidasDialog.jsx` órfão no repositório | aceito | remoção planejada em 1.4.0; o gate impede que volte ao Lançamento |
| 5 | Asserções estruturais de `ui:consistency` ainda dependem de nomes de classe/`aria-label` | aceito | são o contrato visual declarado (ModeloBase1); mudanças exigem atualizar o gate junto, com evidência |
