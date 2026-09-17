# 12 — Contrato visual do relatório

Base: contrato UI **ModeloBase1-2.0** (tabela `d17b-modelobase1.css`, cabeçalhos e rodapés da Relação). Nenhum CSS
foi alterado nesta missão; o que segue é contrato para a implementação.

## 1. Tela (pré-visualização)

| Zona | Conteúdo | Reuso |
|---|---|---|
| Barra superior | título do relatório, seletor de modelo, botões Filtros · Colunas · Agrupar · Emitir/Exportar | padrão da barra da Relação |
| Faixa de filtros | pílulas dos filtros ativos (incluindo período resolvido) | pílulas atuais (seguem colunas visíveis) |
| Corpo | tabela ModeloBase1; linhas de grupo com recuo por nível; subtotal ao fim de cada grupo; total geral fixo no rodapé | `.d17c-table`; **reativar** métricas de rodapé hoje ocultas (`d17b-modelobase1.css:861,1133`) |
| Rodapé | contagem de linhas, “n ausentes” nas médias, aviso de colunas removidas por permissão | novo |

Estados: carregando, vazio (“Nenhum registro no período”), erro, parcial (limite de linhas atingido na tela).

## 2. Documento emitido (impressão/PDF)

**Cabeçalho (toda página)**
- Nome da empresa/propriedade, título do relatório, período resolvido (“01/09/2026 a 16/09/2026”).
- Filtros aplicados em texto (“Tipo: Manejo · Lote: L-03”) e agrupamento.

**Corpo**
- Tabela com cabeçalho de colunas **repetido** a cada página (`thead { display: table-header-group }`).
- Números alinhados à direita, unidade no cabeçalho (kg, kg/dia, @, R$), nulo = “—”.
- Linha de grupo em negrito; subtotal com fundo leve; total geral com borda superior dupla.
- `page-break-inside: avoid` em linhas; quebra de página opcional **por grupo de nível 1**.
- Zebra suave; fonte mínima 9 pt; A4 retrato até ~8 colunas, **paisagem** acima disso.

**Rodapé (toda página)**
- “Emitido por <usuário> (<perfil>) em dd/mm/aaaa hh:mm” · versão do app · `Página X de Y`.
- Identificador da emissão (primeiros 8 caracteres do sha256 do manifesto).

## 3. Formatação canônica (única para tela, impressão e exportação)

| Tipo | Tela/impressão | CSV |
|---|---|---|
| data | dd/mm/aaaa | `YYYY-MM-DD` |
| peso | `1.234,5` kg | `1234.5` |
| GMD | `0,812` | `0.812` |
| moeda | `R$ 12.345,67` | `12345.67` |
| sexo | Macho/Fêmea | `M`/`F` + coluna rótulo opcional |
| nulo | — | vazio |
| booleano | Sim/Não | `true`/`false` |

## 4. Acessibilidade e cor

Contraste AA; nada de informação só por cor (GMD negativo: sinal “−” e cor); impressão em preto e branco legível.
