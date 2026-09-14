# D.17D.2R3 — Auditoria integral da UI ModeloBase1

Referência auditada diretamente no `PROJETOMG-main`: `MgFilterPills`,
`ErpFilterPopover`, `MakCadastroTable`, `MakFilterFieldsConfigDialog`, tokens de
toolbar, grade, scrollbar e `erp-theme-escuro.css`.

## Contratos aplicados

- toolbar em duas linhas de 36 px, com controles de 28 px e respiro vertical;
- ação primária `Novo` em cápsula verde;
- faixa de filtros recolhível, navegável e configurável;
- filtros personalizados com pesquisa, listagem, seleção múltipla, Cancelar e OK;
- filtro ativo limpo individualmente ou pela ação global;
- pop-up de filtro com largura oficial de 280 px;
- operadores de texto, número e data, incluindo intervalos;
- calendário portado tratado como painel aninhado, sem fechar o filtro pai;
- tabela com largura de coluna preservada e scrollbar horizontal visível;
- diálogo de colunas/filtros compactado conforme os tokens atuais;
- tema escuro Supabase/GitHub-dark persistido em `erp-tema` e alternado na topbar.

Marcador: `D.17D.2R3 · ModeloBase1 · d17d2r3-full-ui-audit-2026-08-05`.
