# Implementação do shell

## Componentes

- `ModeloBase1AppShell.jsx`: composição do chrome desktop/mobile, estado do menu, navegação e page slot.
- `ModeloBase1PageContainer.jsx`: contêiner operacional e page header compartilhado.
- `modelo-base1-shell.css`: dimensões, layout, scroll, breakpoints e ponte escopada para o CSS D.17B.

`Sidebar` e `Topbar` foram mantidos como subestruturas privadas do `ModeloBase1AppShell`, evitando API pública desnecessária neste slice.

## Layout real aplicado

- grid raiz com `36px minmax(0,1fr)` no desktop;
- grid raiz com `48px minmax(0,1fr) 56px` no mobile;
- sidebar desktop absoluta/flutuante, sem alterar a largura do conteúdo;
- page slot com `overflow: hidden` para impedir scroll concorrente;
- páginas responsáveis pelo scroll de seu próprio tipo;
- menu desktop inicialmente fechado, como no shell de referência;
- drawer mobile inicialmente fechado e com backdrop.

## Navegação

Os três itens, os `createPageUrl(...)`, os ícones, os títulos e as rotas foram preservados. A alteração foi exclusivamente de apresentação e composição.
