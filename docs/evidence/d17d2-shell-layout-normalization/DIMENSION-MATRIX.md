# Matriz dimensional

| Elemento | ModeloBase1 | Antes em Pesagens | Implementado | Diferença final |
|---|---:|---:|---:|---:|
| Topbar desktop | 36px | 36px | 36px | 0px |
| Topbar mobile | 48px | 48px | 48px | 0px |
| Sidebar desktop | 220px flutuante | 220px permanente | 220px flutuante | 0px na largura; comportamento corrigido |
| Drawer mobile | 280px | até 300px/84vw | 280px ou viewport − 32px | 0px frente à referência |
| Controle do topbar | 26px | 28px | 26px | 0px frente à referência |
| Page padding desktop | 8px 10px 10px | 8px 10px 10px | 8px 10px 10px | 0px |
| Page padding mobile | 6px 6px 10px | 6px 6px 10px | 6px 6px 10px | 0px |
| Page header desktop | 44px | 44px, mas por classes diferentes | 44px único | 0px e regra consolidada |
| Action bar base desktop | 36px | 44px | 36px | 0px frente ao token |
| Toolbar de tabela em duas faixas | 88px | 88px | 88px | 0px; controles internos seguem para D.17D.3 |
| Botão desktop | 28px | 28px estrutural/36px na tabela | 28px base | 0px frente ao token |
| Botão mobile | 36px | 36px | 36px | 0px |
| Gap estrutural | 8px | 8px, não consolidado | 8px | 0px |
| Radius de container | 12px | 12px | 12px | 0px |
| Largura útil desktop | viewport | viewport − 220px | viewport | 0px frente à referência |
| Navegação inferior mobile | 56px | 56px | 56px | 0px |

“Diferença final” compara a medida implementada com a referência. Quando a medida anterior já coincidia, a correção foi de hierarquia, centralização ou comportamento.
