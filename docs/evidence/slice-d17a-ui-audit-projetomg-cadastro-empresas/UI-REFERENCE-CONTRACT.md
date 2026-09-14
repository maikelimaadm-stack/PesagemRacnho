# Contrato visual de referência

## Identificação

- **Módulo referência:** PROJETOMG — Cadastro de Empresas.
- **Rota:** `/CadastroEmpresas`.
- **Página:** `src/modules/empresas/pages/PAGEMP.jsx`.
- **Runtime visual:** `ModeloBase1CadastroPage` + framework MAK + `ErpShell`.
- **Escopo obrigatório:** `cadastro-emp-scope mg-empresas-scope`, acrescido do escopo específico da página quando necessário.

## Regra de fidelidade

A D.17B deve reproduzir a linguagem e a geometria abaixo preservando o conteúdo e os callbacks do Pesagens. Não deve importar autenticação, preferências, permissões, backend, domínio ou persistência do PROJETOMG. A unidade de cópia é visual/presentacional, não o runtime empresarial completo.

## Estrutura de página

1. Shell de altura integral.
2. Header desktop de 36 px ou header mobile de 48 px.
3. Sidebar desktop de 220 px, expansível/fixável.
4. Área principal com filtro lateral, action bar e faixa contextual.
5. Conteúdo em `mg-view-stack`, com modos Registro, Cards e Tabela conforme aplicável.
6. Barra inferior mobile de 56 px para alternância de modo.

A adaptação pode omitir um modo que não tenha significado no Pesagens, mas não pode substituí-lo por uma composição visual arbitrária. A decisão deve ser documentada por tela.

## Grid e espaçamento

- Formulários: grid de 12 colunas.
- Insets da view: 8 px no topo, 10 px laterais e 10 px abaixo.
- Gap de cards: 12 px.
- Gap interno recorrente: 10 px.
- Toolbar: linha de 36 px no desktop.
- Linha/cabeçalho de tabela: cerca de 26 px conforme constantes ativas.
- No mobile, controles relevantes devem ter pelo menos 36 px; alvos críticos de fechamento, 44 px.

## Tipografia

- Família primária declarada: DM Sans; fallback: fonte sans do sistema.
- Base do escopo: 13 px.
- Breadcrumbs do header: 11 px.
- Hierarquia é compacta e funcional; evitar títulos hero, cards de KPI excessivamente grandes ou peso visual promocional.
- O PROJETOMG importa DM Sans pela rede. Para o desktop offline, a D.17B deve decidir entre asset local licenciado/embutido ou fallback aceito; não deve depender da rede em runtime.

## Cores ativas

| Papel | Valor de referência |
|---|---|
| Fundo da página | `#f0f2f5` (fallback de `--background-page`) |
| Superfície/card | `#ffffff` |
| Preenchimento/borda suave | `#f1f3f4` / `#E7EAEE` |
| Marca, foco e ação primária | `#40de63` |
| Hover primário | `#36c956` |
| Acento suave | `rgba(64, 222, 99, .12)` |
| Glow/foco | `rgba(64, 222, 99, .18)` |
| Texto principal | `#111827` |
| Texto secundário | `#6b7280` |
| Texto terciário | `#9ca3af` |
| Ink | `#1a1f26` |
| Ícone neutro | `#5b6b80` |
| Aviso | `#d97706` |
| Destrutivo | `#dc2626` |

Tokens azuis existentes em `erp-design-system-2030.css` ou no `mg-ui-system.css` não prevalecem dentro do escopo ativo de Empresas e não são o alvo visual primário.

## Bordas, radius e sombras

- Divider/borda padrão: 1 px e baixo contraste.
- Controles: radius 8 px.
- Cards e menus de configuração: radius 12 px.
- Pills de toolbar/busca: radius 999 px.
- Card: `0 1px 2px rgba(15,23,42,.03), 0 2px 6px rgba(15,23,42,.02)`.
- Shadow média: `0 2px 8px rgba(0,0,0,.06)`.
- Shadow grande: `0 8px 24px rgba(0,0,0,.08)`.
- Evitar sombras espessas, glassmorphism, gradientes decorativos ou elevação não presente na referência.

## Inputs

- Altura padrão: 38 px.
- Idle: `#f1f3f4`; preenchido: branco; readonly: `#f6f8fa`; bloqueado: `#e9edf2`.
- Foco: borda verde translúcida e ring inset discreto.
- Inválido: equivalente em vermelho, com mensagem objetiva.
- Labels e mensagens mantêm densidade compacta.

## Botões e ícones

- Ícones: Lucide, traço consistente e tamanho compatível com controle de 28 px.
- Toolbar desktop: botão/ícone 28 px; mobile: 36 px.
- Variantes: ação verde, ghost/neutra e destrutiva vermelha.
- Estado desabilitado/bloqueado deve ser perceptível sem ocultar contexto.
- Ordem das ações deve refletir Novo/Salvar/Cancelar/Editar/Excluir/Duplicar quando semanticamente aplicável.

## Cards

- Fundo branco, borda `#E7EAEE`, radius 12 px e sombra mínima.
- Título e conteúdo compactos, sem padding inflado.
- Cards de formulário respeitam grid 12/6 colunas.
- Cards de listagem admitem favorito, campos configuráveis, abertura e estados de carga/vazio.

## Tabelas

- Cabeçalho sticky, densidade de 26 px, zebra e hover discretos.
- Menu de coluna funcional: ordenar, filtrar, limpar, pinagem, ocultação e ajuste/redimensionamento.
- Seleção, contagens e paginação/carregamento incremental devem ocupar áreas estáveis.
- Rodapé: Selecionados, Listados, Filtrados e Totais quando os dados existirem.
- Empty/loading são componentes dedicados.
- Virtualização só é obrigatória se o volume/UX do Pesagens exigir; a aparência e estabilidade da viewport são obrigatórias.

## Filtros, busca e toolbar

- Filtro desktop: painel lateral de 260 px; mobile: drawer até 280 px.
- Ações Limpar/Aplicar ancoradas no painel.
- Busca em pill, com popup de resultados/favoritos entre 240 e 300 px.
- Faixa contextual mantém identidade e navegação do registro.
- Toolbar deve ter versão mobile, não apenas quebra de linha da versão desktop.

## Modais

- Overlay, shell, header, corpo rolável e footer coerentes com Radix/shadcn.
- Diálogos densos usam a linguagem `mg-config-dialog`.
- Ações primária, cancelamento e destrutiva mantêm posição e variantes consistentes.
- Conteúdo interno precisa responder a 390 px sem grids fixos que extrapolem a viewport.

## Estados visuais e movimento

- Loading: skeleton no formulário ou overlay estável na tabela.
- Vazio: empty state com mensagem/ação, não uma linha crua isolada.
- Toast: canto superior direito, variantes semânticas; referência usa até cinco, offset 16 px, gap 10 px.
- Movimento padrão: 220 ms, `cubic-bezier(.2,.8,.2,1)`.
- Respeitar redução de movimento quando suportada pela base.

## Responsividade mínima para aceite

Validar pelo menos 1366×768, 1440×900, 1024×768, 768×1024 e 390×844. Abaixo de 768 px: header mobile, filtros em drawer, controles com alvo adequado, cards em uma coluna quando necessário, tabela com rolagem horizontal controlada e barra inferior sem cobrir conteúdo.

## Componentes reutilizáveis de referência

`ErpShell`, `MgDesktopHeader`, `MgMobileHeader`, `MgPrototypeSidebar`, `MakActionBar`, `MakFilterPanel`, `MakCadastroForm`, `MakFormShell`, `MakCadastroTable`, `MakTable`, `MakCadastroSearchPanel`, `MakEmptyState`, dialogs de configuração e `ErpToaster`.

Na D.17B, copiar markup/tokens ou criar adaptadores visuais mínimos. Não transportar provedores, acesso remoto, preferências, permissões ou configuração de domínio.
