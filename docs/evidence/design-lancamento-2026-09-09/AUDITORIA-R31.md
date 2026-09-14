# Auditoria visual R31 — Lançamento de Pesagens

Referência: `C:\Users\maike\Downloads\Lançamento de Pesagens.dc.html`

SHA-256 da referência: `5228D88D01AAD55D7FB406E8B959427F9F7A48C4EC95399BB7426AFEC8AE9691`.

## Contrato conferido

| Região | Referência | Runtime R31 |
| --- | ---: | ---: |
| Cabeçalho | 36 px | 36 px |
| Barra de comandos | 36 px | 36 px |
| Controles | 28 px | 28 px |
| Faixa de animal/ganho | 32 px | 32 px |
| Colunas do workspace | 3:1 | 3:1 |
| Espaço tabela/painel | 6 px | 6 px |
| Rodapé da tabela | mínimo 44 px | 45,8 px renderizados |
| Cabeçalho da tabela | 30 px / 12 px | 30 px / 12 px |
| Linha da tabela | 26 px / 12 px | 26 px / 12 px |

## Evidência funcional

- Visualização inicial: 14 colunas, igual ao array `HEADERS` da referência.
- Todas as demais colunas continuam configuráveis.
- Identificação e Peso: `#f59e0b`.
- Título da faixa: `#177a3e`; métricas: `#36c956`; valores: `#15913a`.
- Campo Peso focado: borda somente no contêiner, com brilho de 2 px a 10%.
- Prévia de ganho não grava dados e não conta o rascunho como histórico.
- Estados de equipamento não são falsificados: permanecem “não configurados”
  até existir integração real.
