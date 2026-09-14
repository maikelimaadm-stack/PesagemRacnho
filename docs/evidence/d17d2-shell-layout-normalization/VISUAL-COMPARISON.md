# Comparação visual

## Evidência disponível

- `screenshots/before/`: linha-base real D.17B e referência real.
- `screenshots/after/`: README com o bloqueio; sem imagens fabricadas.
- `screenshots/comparisons/`: README com o bloqueio; sem comparações fabricadas.

## Classificação deste slice

| Área | Classe | Fundamentação |
|---|---|---|
| Shell | P1 | hierarquia e dimensões transportadas; falta captura runtime pós-migração |
| Sidebar | P1 | 220px e comportamento flutuante reproduzidos; falta comparação visual final |
| Topbar | P1 | 36/48px, padding, cor e controles reproduzidos |
| Page container | P1 | largura útil, padding e scroll consolidados |
| Page header | P2 | regra única aplicada, ainda sem validação pixel a pixel |
| Action bar | P2 | componente comum aplicado; toolbar completa fica para D.17D.3 |
| Responsividade | P2 | breakpoints e safe area implementados; falta captura runtime |

Não se declara `IGUAL` porque as capturas de depois não puderam ser geradas. Tabela, filtros internos, campos, dialogs, popups e resumos estão fora do critério de fidelidade deste slice.
