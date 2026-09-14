# Conflitos estruturais removidos ou neutralizados

## Layout.jsx

Deixaram de ser renderizados:

- `d17b-desktop-header`;
- `d17b-shell-body`;
- `d17b-sidebar` permanente;
- `d17b-main`;
- `d17b-page-slot`;
- `d17b-mobile-header`;
- `d17b-mobile-drawer-*`;
- `d17b-mobile-bottom-nav`.

Essas regras permanecem no CSS legado apenas para não ampliar o escopo de limpeza global, mas não participam mais da árvore do shell.

## Páginas

- wrappers raiz `<div>` foram substituídos por `ModeloBase1PageContainer`;
- `d17b-page-heading` foi removido de Manutenção;
- o header/actionbar combinado do Lançamento foi dividido em page header e action bar;
- o botão Atualizar status deixou de ficar dentro do card de status;
- as utilities `p-3 pb-24` do chrome de lançamento foram neutralizadas pelo seletor escopado para `8px 10px 18px` no desktop e `6px 6px 18px` no mobile;
- `max-w-5xl` de Manutenção continua no JSX por compatibilidade, mas é neutralizado pela regra D.17B já existente `max-width: none !important`.

## Não removido

Utilities internas de campos, tabelas, filtros, dialogs, cards e resumos foram mantidas intencionalmente, conforme o limite do slice.
