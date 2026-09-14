# Mapa do shell de referência

## Fontes auditadas

- `src/shared/layouts/ErpShell.jsx`
- `src/framework/mak/layout/MgEmpresasShell.jsx`
- `src/framework/mak/layout/MgDesktopHeader.jsx`
- `src/framework/mak/layout/MgMobileHeader.jsx`
- `src/framework/mak/layout/MgPrototypeSidebar.jsx`
- `src/framework/mak/styles/mg-prototype.css`
- tokens D.17D.1 em `src/components/modelobase1/foundations/`

## Hierarquia oficial transportada

```text
janela 100dvh
├── desktop: topbar 36px
│   ├── menu
│   ├── breadcrumb
│   ├── sidebar flutuante 220px
│   └── status/produto
├── mobile: topbar 48px
├── área principal minmax(0, 1fr)
│   └── page slot sem scroll concorrente
└── mobile: navegação inferior 56px
```

## Contrato observado

- background de página: `#f0f2f5`;
- verde oficial: `#40de63`;
- topbar desktop: `36px`, padding horizontal `12px`;
- topbar mobile: `48px`, padding horizontal `8px`;
- sidebar: flutuante, `220px`, raio `10px`, sombra `0 14px 30px rgba(15,23,42,.22)`;
- controles do topbar: `26px`;
- breakpoint mobile: `max-width: 767px`;
- conteúdo empresarial: não perde largura para sidebar permanente;
- painel móvel: `280px`, backdrop `rgba(17,24,39,.35)`.

## Estado do runtime de referência

Em 03/08/2026, o runtime da referência apresentou:

```text
SyntaxError: .../erpOperationBadge.js does not provide an export named 'default'
```

`erpOperationBadge.js` exporta `getOperationBadge` como named export, enquanto `ErpShell.jsx` importa default. A referência não foi alterada. O contrato foi obtido do código oficial e das capturas reais anteriores.
