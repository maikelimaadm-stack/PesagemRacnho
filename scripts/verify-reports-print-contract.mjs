// Gate reports:print-contract:verify (R4, refeito na E1B 1.4.0) — o documento de impressão É a folha do
// relatório, derivada do MESMO view model e do MESMO documento da tela (domain/reportDocument +
// sheetHtml): cabeçalho da propriedade (com logo) e título que se repetem em todas as páginas, rodapé
// (filtros, @, emitido por, versão) que se repete, "Página X de Y" na margem do @page, A4 retrato/paisagem
// com margens de 10 mm, seções que não deixam o título sozinho no fim da página, escape de HTML e de CSS,
// logo só em data URL PNG/JPEG, aviso quando não cabe (nunca esconde coluna), imprimir = exportar.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { PRINT_CSP, PRINT_LIMITS, buildPrintDocument, escapeHtml } from '../src/modules/reporting/infrastructure/exporters/printDocument.js';
import { buildReportDocument, decideSheetLayout, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { cssString } from '../src/modules/reporting/infrastructure/exporters/sheetStyles.js';
import { buildPropertyHeader } from '../src/modules/catalog/domain/propertyHeader.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { cellRawValue } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const code = (fn) => { try { fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const decode = (text) => String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
await seedReportFixture();
await weighingService.updateEntry('e3', { observacao: '<script>alert(1)</script> & "aspas"' });
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
// PNG 1×1 válido (logo de teste).
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const header = buildPropertyHeader({ id: 'p1', nome: 'FAZENDA KAIMAN', titular_nome: 'ZIGOMAR FERREIRA FRANCO FILHO', endereco: 'GLEBA RICARDO FRANCO SN - ZONA RURAL', municipio: 'VILA BELA DA SST. TRINDADE', uf: 'MT', logo: LOGO });

// 1. Detalhado agrupado Apartação → Lote, com filtro e texto hostil
const vm = await runReport('pesagens.periodo', {
  today: TODAY, params: period,
  selection: { columns: ['data_pesagem', 'numero_animal', 'marca', 'peso', 'gmd', 'observacao'], groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], filters: { marca: { operator: 'contains', value: 'alfa' } } },
}, ADMIN);
const { html, layout, stats, manifest, document: doc } = preparePrint(vm, ADMIN, { header });

// Cabeçalho da propriedade (com logo) + título + período + emissão
for (const text of ['ZIGOMAR FERREIRA FRANCO FILHO', 'FAZENDA KAIMAN', 'GLEBA RICARDO FRANCO SN - ZONA RURAL, VILA BELA DA SST. TRINDADE-MT', 'Relatório de Pesagens (Analítico)', 'Detalhado · Apartação › Lote', 'Período: 01/08/2026 a 15/09/2026', 'Emitido em']) {
  assert.ok(decode(html).includes(text), `cabeçalho contém: ${text}`);
}
assert.ok(html.includes(`<img class="sheet-logo" src="${LOGO}"`), 'logo embutido no cabeçalho');
assert.equal((html.match(/<img /g) || []).length, 1, 'logo uma vez só (o thead da folha repete)');
// Rodapé que se repete (tfoot) e margem da página
for (const text of ['Filtros: Marca contém alfa', 'Emitido por Ana Admin em', `Pesagens Individuais v${vm.appVersion}`]) assert.ok(decode(html).includes(text), `rodapé contém: ${text}`);
assert.ok(html.includes('<thead><tr><td><div class="sheet-header">') && html.includes('<tfoot><tr><td><div class="sheet-footer">'), 'cabeçalho e rodapé da folha em thead/tfoot (repetem em todas as páginas)');
assert.match(html, /@page \{ size: A4 (portrait|landscape); margin: 10mm 10mm 12mm 10mm;/, 'A4 com margens de 10 mm');
assert.match(html, /@bottom-right \{ content: "Página " counter\(page\) " de " counter\(pages\)/, 'Página X de Y');
assert.ok(html.includes(`Emissão ${vm.emissionId.slice(0, 8)}`), 'emissão na margem da página');
assert.match(html, /\.sheet-page > thead \{ display: table-header-group; \}/, 'cabeçalho da folha repete');
assert.match(html, /\.sheet-table > thead \{ display: table-header-group; \}/, 'cabeçalho da tabela repete');
assert.match(html, /\.sheet-table tr \{ break-inside: avoid; page-break-inside: avoid; \}/, 'linha não quebra no meio');
assert.match(html, /\.sheet-sec-title \{[^}]*break-after: avoid; page-break-after: avoid;/, 'título da seção nunca fica sozinho no fim da página');
assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">`), 'CSP do documento');
assert.equal(PRINT_CSP, "default-src 'none'; img-src data:; style-src 'unsafe-inline'", 'sem script; imagem só embutida');
assert.ok(!/<script/.test(html), 'NEGATIVO: nenhum script no documento');
assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot;'), 'texto do usuário escapado');

// Mesma população e estrutura da tela
assert.equal(stats.dataRows, vm.rowCount, 'linhas de dados = população');
const sections = (vm.tree ?? []).reduce(function count(total, node) { return total + 1 + (node.children ?? []).reduce(count, 0); }, 0);
assert.equal(stats.sections, sections, 'uma seção por grupo (Apartação e Lote)');
assert.equal(stats.subtotalRows, sections, 'um subtotal por grupo');
assert.equal(stats.grandRows, 1, 'um total geral');
const firstRow = vm.rows[0];
for (const column of doc.columns) {
  const sheetColumn = column.column;
  assert.ok(html.includes(escapeHtml(formatCell(sheetColumn, cellRawValue(vm, sheetColumn, firstRow), 'print'))), `célula formatada igual à folha da tela: ${column.key}`);
}
assert.ok(/<td data-col="\d+" data-key="peso" class="num">/.test(html), 'números alinhados à direita (monoespaçados)');
assert.ok(decode(html).includes('Peso (kg)') && decode(html).includes('GMD (kg/dia)'), 'unidades no cabeçalho');
assert.equal(manifest.orientation, layout.orientation);
// Tela = impressão: o mesmo renderizador (fragmento) com o mesmo texto
const screen = renderSheetBody(buildReportDocument(vm, { header }), { mode: 'fragment' });
const textOf = (markup) => decode(markup.replace(/<[^>]+>/g, ' ')).replace(/Página X de Y na impressão/g, '').replace(/Emitido em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/g, '').replace(/\s+/g, ' ').trim();
assert.equal(textOf(screen), textOf(renderSheetBody(doc, { mode: 'print' })), 'tela e impressão com o mesmo conteúdo');

// Sem propriedade → só o nome do sistema; logo inválido nunca entra; organização (compatibilidade)
const semPropriedade = buildPrintDocument(vm, {});
assert.ok(semPropriedade.html.includes('<div class="sheet-header sheet-header--system">') && semPropriedade.html.includes('Pesagens Individuais'), 'sem propriedade: só o nome do sistema');
for (const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)', 'http://exemplo.com/logo.png', 'file:///C:/logo.png']) {
  const hostile = buildPrintDocument(vm, { header: { ...header, logo: bad } });
  assert.ok(!hostile.html.includes('<img'), `logo recusado: ${bad.slice(0, 24)}`);
}
assert.ok(buildPrintDocument(vm, { organization: 'Fazenda Modelo' }).html.includes('Fazenda Modelo'), 'organização no cabeçalho');
// Texto do usuário na margem da página (dentro do CSS): escapado para CSS, não para HTML
assert.equal(cssString('A "x" \\ </style>'), 'A \\22 x\\22  \\5C  \\3C /style\\3E ');
assert.ok(!/<\/style>[^]*<\/style>/.test(html.replace(/<\/style>\s*<\/head>/, '')), 'nenhum </style> extra dentro do CSS');

// 2. Orientação e aviso de largura (larguras estimadas pelo conteúdo; nunca esconde coluna)
const wideVm = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'peso', 'nome_lote', 'nome_apartacao'] } }, ADMIN);
const wide = buildPrintDocument(wideVm);
assert.match(wide.html, /size: A4 landscape/, '11 colunas de dados → paisagem');
assert.equal(wide.document.columns.length + wide.document.hiddenColumns.length, 11, 'NEGATIVO: nenhuma coluna perdida (vazias só saem com aviso nas notas)');
assert.equal((wide.html.match(/<th /g) || []).length, wide.document.columns.length, 'um <th> por coluna visível');
const mockDetail = (count, width = 120) => ({ layout: 'detail', rows: [], columns: Array.from({ length: count }, (_, i) => ({ key: `c${i}`, column: { defaultWidth: width } })) });
assert.equal(decideSheetLayout(mockDetail(8)).orientation, 'portrait', 'até ~1000 px de colunas → retrato');
assert.equal(decideSheetLayout(mockDetail(9)).orientation, 'landscape', 'acima → paisagem');
const tooWide = decideSheetLayout(mockDetail(20, 120));
assert.equal(tooWide.fits, false);
assert.equal(tooWide.warning.message, 'Este relatório possui muitas colunas para impressão.');
assert.deepEqual(decideSheetLayout(mockDetail(12), { orientation: 'portrait' }).warning.options, ['paisagem', 'reduzir totais', 'exportar XLSX/CSV']);
assert.equal(PRINT_LIMITS.MARGIN_MM, 10);
assert.ok(PRINT_LIMITS.LANDSCAPE_WIDTH_PX > PRINT_LIMITS.PORTRAIT_WIDTH_PX);

// 3. Permissão: imprimir = exportar
assert.equal(code(() => preparePrint(vm, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não imprime');
const vmConsulta = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: ['data_pesagem', 'numero_animal', 'valor_venda_total'] } }, CONSULTA);
const consultaDoc = preparePrint(vmConsulta, CONSULTA);
assert.ok(!consultaDoc.html.includes('Valor venda') && consultaDoc.html.includes('1 coluna(s) omitida(s) pelo perfil'), 'CONSULTA imprime sem valores, com aviso de omissão');

// 4. Resumido (folha resumida): seções, subtotais e Total geral = árvore; cabe em A4 retrato; mesmas células da tela
const vmResumo = await runReport('desempenho.lote', { today: TODAY, params: period }, ADMIN);
assert.equal(vmResumo.mode, 'RESUMIDO');
const resumoDoc = preparePrint(vmResumo, ADMIN, { header });
assert.match(resumoDoc.html, /@page \{ size: A4 portrait;/, `Resumido de Desempenho por lote (${resumoDoc.layout.columnCount} colunas) cabe em A4 retrato`);
assert.equal(resumoDoc.layout.fits, true);
assert.equal(resumoDoc.stats.dataRows, 0, 'Resumido sem linha de animal');
const leafCount = vmResumo.tree.reduce((total, node) => total + node.children.length, 0);
assert.equal(resumoDoc.stats.groupRows, leafCount, 'uma linha por grupo do nível folha');
assert.equal(resumoDoc.stats.subtotalRows, vmResumo.tree.length, 'um subtotal por seção');
assert.equal(resumoDoc.stats.grandRows, 1, 'um Total geral');
for (const text of ['Relatório de Desempenho (Sintético)', 'Resumido · Apartação (última pesagem no período) › Lote (última pesagem no período)', 'Total geral']) {
  assert.ok(decode(resumoDoc.html).includes(text), `Resumido contém ${text}`);
}
for (const row of documentRows(resumoDoc.document)) {
  for (const cell of row.cells ?? []) if (cell.text) assert.ok(resumoDoc.html.includes(escapeHtml(cell.text)), `célula do Resumido igual à folha da tela: ${cell.text}`);
}
assert.equal((resumoDoc.html.match(/data-row-type="GROUP"/g) || []).length, leafCount);
assert.equal(resumoDoc.manifest.mode, 'RESUMIDO', 'manifesto da impressão registra o modo');
assert.ok(!/text-overflow:\s*ellipsis/.test(resumoDoc.html), 'folha nunca corta texto com reticências');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:print-contract:verify', ok: true, stats, summaryStats: resumoDoc.stats, orientation: layout.orientation, htmlBytes: html.length }, null, 2));
