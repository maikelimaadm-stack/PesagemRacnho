# R4 — Impressão profissional e PDF (16/09/2026)

Sem dependência nova: HTML próprio + `webContents.printToPDF` do Electron.

## Entregue

| Peça | Detalhe |
|---|---|
| `printDocument.js` | HTML autossuficiente com CSP sem script; cabeçalho (sistema, organização, relatório, período resolvido, grão, filtros incl. fixos, agrupamento, classificação legada, emitido em/por/perfil, registros, animais únicos, versão, esquema, emissão); tabela com `thead` repetido, linhas que não quebram, grupos por nível, subtotais e total geral com “n de N”; notas e aviso de colunas omitidas pelo perfil |
| Orientação | automática: retrato até 8 colunas que caibam; senão paisagem; se nem paisagem couber → aviso **“Este relatório possui muitas colunas para impressão.”** com opções (paisagem · reduzir colunas · exportar CSV/XLSX · continuar); nenhuma coluna é escondida |
| Paginação | tela/iframe: `@page` margin boxes “Página X de Y”; PDF: rodapé nativo do `printToPDF` (`pageNumber`/`totalPages`) com versão e emissão |
| IPC `electron/ipc/reportIpc.cjs` | `reports:print-to-pdf`, `reports:print`, `reports:save-file`; janela de renderização oculta com sandbox, contextIsolation, sem Node, sem preload, **sem JavaScript**, sem navegação e sem novas janelas; HTML por arquivo temporário removido ao fim; destino SÓ pelo diálogo nativo (renderer envia apenas nome sugerido → basename saneado); extensões fechadas (.pdf/.csv/.json/.xlsx); limite de tamanho; escrita atômica com SHA-256 |
| `reportPrintService.js` | imprimir/PDF = exportar (`reports.export` + colunas sensíveis); manifesto `.pdf.manifest.json` em `<dados>/relatorios` com o SHA-256 do PDF gravado; navegador de desenvolvimento: iframe + diálogo de impressão |
| Tela | botão Imprimir, Exportar › PDF (A4), escolha de orientação, diálogo de largura |

## Evidência em Electron real

`npm run evidence:report-pdf` gera, com as **mesmas opções** do IPC, dois PDFs a partir de massa de 270 pesagens:

| Arquivo | Resultado |
|---|---|
| `amostra-pesagens-periodo.pdf` | A4 retrato, 6 páginas, Apartação → Lote; `screenshots/pdf-pesagens-periodo-p1.png` (cabeçalho), `-p2-cabecalho-repetido.png` (thead repetido, subtotal do Lote 01, “Página 2 de 6”), `-p6-total-geral.png` (subtotal Lote 03, subtotal Engorda, TOTAL GERAL 270 registros / 90 animais) |
| `amostra-desempenho-individual.pdf` | 14 colunas → paisagem, 4 páginas, agrupado por lote; `screenshots/pdf-desempenho-paisagem-p1.png` |

Defeito encontrado e corrigido na verificação visual: o template de rodapé do `printToPDF` não trata UTF-8
(“Emissão” saía “EmissÃ£o”); agora todo não-ASCII vira entidade numérica.

## Gates

| Gate | Prova |
|---|---|
| `reports:print-contract:verify` | cabeçalho completo, A4, thead repetido, página X de Y, escape de HTML (`<script>` do usuário), linhas = população, grupos/subtotais = árvore, células = formatação da tela, total geral, orientação automática por contagem e largura, aviso sem esconder coluna, OPERADOR não imprime, CONSULTA imprime sem valores |
| `reports:pdf-contract:verify` | Electron stubado: janela trancada, opções de PDF, rodapé com emissão, HTML temporário removido, diálogo cancelado não grava, extensão/tamanho/orientação/doctype recusados, basename de nome malicioso, `save-file` XLSX com SHA-256, manifesto do PDF, OPERADOR recusado, preload sem caminho |

`npm run test:quick` → EXIT 0.

## Limites

- Impressão física e a caixa de diálogo de impressão do Windows não são automatizáveis aqui (teste físico).
- O limite de largura é conservador: 14 colunas em paisagem ainda couberam na amostra; o aviso aparece antes do corte real.
