# Notas de risco

| Risco | Nível | Tratamento neste slice | Próxima ação |
|---|---|---|---|
| comparação visual não capturada | alto para aceite visual | classificado BLOQUEADO; nenhum `IGUAL` declarado | repetir quando localhost estiver liberado |
| select/combobox reduzidos | P2 | DOM/tokens básicos portados sem lookup empresarial | completar teclado/typeahead em D.17D.6 |
| calendário sem views mês/ano | P2 | calendário de dias, portal e medidas oficiais entregues | portar views/teclado em D.17D.6 |
| table shell sem filtro completo | P2 | apenas estrutura pedida neste primeiro slice | transportar cabeçalho/filtro em D.17D.4 |
| dialog sem drag/persistência | P2 | estrutura visual de transfer entregue | conectar comportamento existente, não novo, em D.17D.6 |
| CSS global legado já importado | médio | novos seletores escopados e prefixados | remover legado somente após pixel comparison final |
| chunk principal >500 kB | baixo/preexistente | sem mudança de dependências | avaliar code splitting fora deste slice |
| warning lint em Electron | baixo/preexistente | preservado por proibição explícita | tratar em tarefa específica de Electron |

Não há risco novo de persistência: o VisualLab não acessa dados e a suíte completa confirmou storage/backup/import/restore.
