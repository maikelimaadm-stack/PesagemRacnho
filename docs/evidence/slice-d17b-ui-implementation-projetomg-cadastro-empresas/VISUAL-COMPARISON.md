# Comparação visual

As comparações usam capturas reais de navegador. Como os domínios e conteúdos são diferentes, a avaliação considera composição, geometria, densidade, tokens e comportamento, não um percentual global de pixels.

| Item | Classificação | Evidência/observação |
|---|---|---|
| shell full-height | IGUAL AO PADRÃO | header, sidebar desktop, conteúdo e chrome mobile seguem a mesma composição |
| header desktop | IGUAL AO PADRÃO | 36 px, verde de ação e breadcrumb operacional |
| sidebar | IGUAL AO PADRÃO | aproximadamente 220 px, grupos e estado recolhido |
| page header/action bar | IGUAL AO PADRÃO | hierarquia compacta, ações alinhadas e superfície branca |
| filtros | IGUAL AO PADRÃO | painel lateral/drawer e toolbar densa |
| cards/KPIs | IGUAL AO PADRÃO | superfícies brancas, borda sutil, radius e gap equivalentes |
| tabela | IGUAL AO PADRÃO | header sticky, zebra, densidade, menus de coluna somente funcionais |
| formulário de lançamento | EQUIVALENTE POR DIFERENÇA DE DOMÍNIO | os campos e validações de pesagens foram mantidos no grid/seções do padrão |
| manutenção | EQUIVALENTE POR DIFERENÇA DE DOMÍNIO | ações de armazenamento local usam cards e hierarquia equivalentes |
| dialogs | IGUAL AO PADRÃO | overlay, header, corpo rolável, footer e fechamento consistente |
| shell mobile | IGUAL AO PADRÃO | header compacto, drawer e navegação inferior |
| tipografia | DESVIO ACEITO E DOCUMENTADO | DM Sans não estava disponível como asset local licenciado; foi usado fallback de sistema offline |
| edição da referência | DESVIO ACEITO E DOCUMENTADO | o harness real de componentes não possuía backend para ativar com segurança esse estado; leitura, cards, tabela, filtros e dialog foram capturados |

Não há item crítico pendente. Não se declara “pixel perfect”.

## Comparações lado a lado

- `screenshots/comparisons/list-desktop.png`: referência, Pesagens antes e Pesagens depois em desktop;
- `screenshots/comparisons/launch-desktop.png`: referência/formulário, lançamento antes e lançamento depois;
- `screenshots/comparisons/list-mobile.png`: referência, Pesagens antes e Pesagens depois em mobile.

As capturas isoladas de filtros, dialogs, manutenção, desktop compacto e produção estão indexadas em `screenshots/README.md`.
