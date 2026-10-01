// Gate reports:charts-print:verify (E1G 1.4.2 — docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B): os gráficos
// na impressão/PDF e no Excel. Massa de TESTE (scripts/lib/reportFixtures, fake-indexeddb). Casos:
//   a) documento "gráficos + folha": um <svg> INLINE por gráfico, um <img> só (o logo), nenhum <script>, nenhum
//      foreignObject/href, CSP do PDF intacta; os gráficos ANTES da folha, com quebra de página entre eles; o
//      cabeçalho da propriedade e o título continuam (thead); sem chartsConfig o documento é o de antes (NEGATIVO);
//   b) "só os gráficos": sem a folha, sem quebra final, e o aviso "muitas colunas" da folha não bloqueia;
//   c) retrato 718 px (1 por linha) e paisagem 515 px (grade 2 × 2); o SVG da tela e o do papel são a MESMA string
//      para o mesmo tamanho; tokens claros sempre (NEGATIVO: nenhuma regra/cor do tema escuro no PDF);
//   d) textos em pt-BR idênticos aos de sheetNumberText; tabela de dados embaixo de cada gráfico;
//   e) nome de lote hostil (<script>…) sai escapado no SVG, na legenda e na tabela (NEGATIVO: nunca cru);
//   f) manifesto com os gráficos; imprimir = exportar: OPERADOR recebe AUTH_FORBIDDEN, CONSULTA recebe os mesmos
//      gráficos; as colunas dos gráficos passam pelo mesmo assertCanExport (NEGATIVO: coluna sensível recusada);
//   g) Excel: aba "Gráficos" com as tabelas de dados — os MESMOS números (como números) da tela e do PDF; sem a
//      vista Gráficos o arquivo não ganha aba (NEGATIVO); CSV e JSON não mudam.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import storage from '../src/storage/storageAdapter.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { PRINT_CSP, buildPrintDocument } from '../src/modules/reporting/infrastructure/exporters/printDocument.js';
import { renderChartSvg, renderChartsBlock } from '../src/modules/reporting/infrastructure/exporters/chartSvg.js';
import { CHART_CSS, CHART_SCREEN_CSS, CHART_TOKENS } from '../src/modules/reporting/infrastructure/exporters/chartStyles.js';
import { escapeHtml } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { buildPropertyHeader } from '../src/modules/catalog/domain/propertyHeader.js';
import { buildReportCharts, chartColumnIds } from '../src/modules/reporting/domain/reportCharts.js';
import { chartGeometry, CHART_SIZES } from '../src/modules/reporting/domain/chartScale.js';
import { assertCanExport } from '../src/modules/reporting/domain/reportPermissions.js';
import { sheetNumberText } from '../src/modules/reporting/domain/reportDocument.js';
import { aggregateValueColumn } from '../src/modules/reporting/domain/aggregateLabels.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { PESAGENS } from '../src/modules/reporting/definitions/pesagens.js';

const results = [];
const PERIODO = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const header = buildPropertyHeader({ id: 'p1', nome: 'FAZENDA TESTE', titular_nome: 'PRODUTORA TESTE', endereco: 'ESTRADA 1', municipio: 'CIDADE', uf: 'MT', logo: LOGO });
const count = (text, pattern) => (text.match(pattern) || []).length;
const code = (fn) => { try { fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const decode = (text) => String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const svgsOf = (html) => html.match(/<svg class="rc-svg"[\s\S]*?<\/svg>/g) || [];

await seedReportFixture();
const matrixSelection = { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' } };
const vm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: matrixSelection }, ADMIN);

// ---------------------------------------------------------------------------------------------------------
// a) Gráficos + folha
// ---------------------------------------------------------------------------------------------------------
const printed = preparePrint(vm, ADMIN, { header, chartsConfig: {} });
{
  const { html } = printed;
  assert.equal(count(html, /<svg /g), PESAGENS.charts.length, 'um <svg> por gráfico');
  assert.equal(count(html, /<svg class="rc-svg" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 718 /g), 4, 'SVG INLINE com viewBox em px reais (retrato 718)');
  assert.equal(count(html, /<img /g), 1, 'um <img> só: o logo (NEGATIVO: gráfico nunca vira <img src=data:image/svg+xml>)');
  assert.ok(!/<script/i.test(html), 'nenhum <script>');
  assert.ok(!/foreignObject/i.test(html) && !/\shref=/i.test(html) && !/xlink:/i.test(html), 'sem foreignObject nem href');
  assert.ok(!/data:image\/svg/i.test(html), 'sem SVG em data URL');
  assert.ok(!/preserveAspectRatio="none"/.test(html), 'nunca preserveAspectRatio="none" (círculo deformado da curva antiga)');
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">`), 'CSP do PDF');
  assert.equal(PRINT_CSP, "default-src 'none'; img-src data:; style-src 'unsafe-inline'", 'CSP intacta');
  const blockAt = html.indexOf('<section class="rc-block');
  const sheetAt = html.indexOf('data-view="matriz"') >= 0 ? html.indexOf('<table class="sheet-table') : -1;
  assert.ok(blockAt > 0 && sheetAt > blockAt, 'bloco de gráficos ANTES da folha, no mesmo documento');
  assert.ok(html.indexOf('<thead><tr><td><div class="sheet-header">') < blockAt, 'cabeçalho da propriedade e título continuam no thead (repetem em cada página)');
  assert.ok(html.includes('<section class="rc-block rc-block--print rc-block--portrait rc-break"'), 'quebra de página depois dos gráficos (a folha começa em página nova)');
  assert.match(html, /\.rc-block--print\.rc-break \{ break-after: page; page-break-after: always; \}/, 'regra da quebra');
  assert.match(html, /\.rc-card \{[^}]*break-inside: avoid;/, 'cartão inteiro na página');
  assert.equal(count(html, /<table class="rc-table"/g), 4, 'tabela de dados embaixo de cada gráfico (no papel não há hover)');
  const plain = preparePrint(vm, ADMIN, { header });
  assert.ok(!plain.html.includes('rc-block') && count(plain.html, /<svg /g) === 0, 'NEGATIVO: sem a vista Gráficos, o documento não tem gráfico');
  assert.equal(plain.html, buildPrintDocument(vm, { header }).html, 'e é exatamente o documento de antes (prelude só com gráficos)');
  assert.ok(!plain.html.includes('.rc-svg'), 'sem gráficos, sem o CSS deles');
  assert.equal(printed.manifest.display, 'graficos', 'manifesto: vista Gráficos');
  assert.deepEqual(printed.manifest.charts.map((chart) => chart.id), PESAGENS.charts.map((chart) => chart.id), 'manifesto lista os gráficos');
  assert.deepEqual(printed.manifest.charts[0].config, { serie: 'lote', eixo: 'mes', metrica: 'peso' }, 'com as opções usadas');
  assert.equal(printed.manifest.chartsOnly, false);
  assert.equal(plain.manifest.charts, undefined, 'NEGATIVO: sem gráficos, manifesto sem a chave');
  results.push({ caso: 'gráficos + folha', svgs: count(html, /<svg /g), bytes: html.length });
}

// ---------------------------------------------------------------------------------------------------------
// b) Só os gráficos (e o aviso de largura da folha não vale)
// ---------------------------------------------------------------------------------------------------------
{
  const wideVm = await runReport('pesagens.periodo', { today: TODAY, params: PERIODO, selection: { columns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd', 'observacao', 'comprador', 'destino_venda', 'origem_animal', 'frigorifico', 'causa_morte'] } }, ADMIN);
  const wideSheet = preparePrint(wideVm, ADMIN, { orientation: 'portrait' });
  const only = preparePrint(wideVm, ADMIN, { orientation: 'portrait', chartsConfig: {}, chartsOnly: true });
  assert.equal(wideSheet.layout.fits, false, 'a folha de 20 colunas não cabe em retrato (aviso)');
  assert.equal(only.layout.fits, true, 'só os gráficos: sempre cabem (o aviso é da folha)');
  assert.equal(only.layout.warning, null);
  assert.ok(!only.html.includes('<table class="sheet-table') && !/data-row-type="DATA"/.test(only.html), 'só os gráficos: a folha não entra');
  assert.ok(!/<section class="[^"]*rc-break/.test(only.html), 'sem quebra no fim (nada vem depois)');
  assert.equal(count(only.html, /<svg /g), 4);
  assert.ok(only.html.includes('<title>Relatório de Pesagens Individuais (Analítico) — Gráficos</title>'), 'título do documento diz "Gráficos"');
  assert.equal(only.manifest.chartsOnly, true);
  results.push({ caso: 'só os gráficos', larguraFolha: wideSheet.layout.fits, graficos: only.layout.fits });
}

// ---------------------------------------------------------------------------------------------------------
// c) Tamanhos, tela = papel, tokens claros
// ---------------------------------------------------------------------------------------------------------
{
  const landscape = preparePrint(vm, ADMIN, { header, chartsConfig: {}, orientation: 'landscape' });
  assert.ok(landscape.html.includes('rc-block--landscape'), 'paisagem: grade 2 × 2');
  assert.equal(count(landscape.html, /viewBox="0 0 515 /g), 4, 'paisagem: cartões de 515 px');
  assert.match(landscape.html, /\.rc-block--landscape \.rc-cards \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'duas colunas');
  const charts = printed.charts;
  const screenBlock = renderChartsBlock(charts, { orientation: 'portrait', mode: 'screen' });
  assert.deepEqual(svgsOf(screenBlock), svgsOf(printed.html), 'o SVG da tela e o do papel são a MESMA string para o mesmo tamanho');
  charts.forEach((chart, index) => {
    const alone = renderChartSvg(chart, chartGeometry(chart, CHART_SIZES.PORTRAIT), { uid: `rc-${index}` });
    assert.ok(printed.html.includes(alone), `renderChartSvg = o SVG impresso (${chart.id})`);
  });
  assert.ok(printed.html.includes(`--rc-s1: ${CHART_TOKENS.light.s1};`), 'tokens claros no documento');
  assert.ok(!printed.html.includes(CHART_TOKENS.dark.s1) && !/html\.(dark|tema-escuro|escuro)/.test(printed.html), 'NEGATIVO: nenhuma cor/regra do tema escuro no PDF');
  assert.ok(!/html\.dark/.test(CHART_CSS) && /html\.dark/.test(CHART_SCREEN_CSS), 'o escuro fica só no CSS da tela');
  assert.ok(CHART_SCREEN_CSS.includes(CHART_TOKENS.dark.s1), 'a tela troca para os tokens escuros');
  results.push({ caso: 'tamanhos e tema', retrato: 718, paisagem: 515 });
}

// ---------------------------------------------------------------------------------------------------------
// d) Números em pt-BR = sheetNumberText; tabela de dados
// ---------------------------------------------------------------------------------------------------------
{
  const html = decode(printed.html);
  const evolucao = printed.charts.find((chart) => chart.id === 'evolucao-peso');
  const peso = PESAGENS.charts[0].controls.metrica.choices[0].valor;
  const column = aggregateValueColumn(peso, [vm.resolve('peso').column]);
  for (const series of evolucao.series) {
    for (const point of series.points) {
      assert.equal(point.text, sheetNumberText(column, point.y, { op: peso.op }), `texto do ponto = sheetNumberText (${series.label} ${point.xLabel})`);
      assert.ok(html.includes(point.text), `${point.text} aparece no documento`);
    }
  }
  assert.ok(html.includes('Lote 01 345,0 kg'), 'rótulo direto no fim da linha (série e valor)');
  assert.ok(html.includes('1,125 kg/dia · 2 cab. · GMD de 1'), 'rótulo de valor em toda barra');
  assert.ok(html.includes('Média geral 296,9 kg'), '"Média geral" = total da folha no texto da folha');
  for (const chart of printed.charts) {
    for (const line of chart.tabela.linhas) for (const cell of line) assert.ok(html.includes(`>${cell}<`), `célula da tabela no documento: ${chart.id} "${cell}"`);
  }
  assert.ok(html.includes('Sem GMD: Não informado (1 cab.)'), 'grupo sem GMD em texto');
  results.push({ caso: 'números pt-BR', exemplo: evolucao.series[0].points[0].text });
}

// ---------------------------------------------------------------------------------------------------------
// e) Nome de lote hostil sai escapado
// ---------------------------------------------------------------------------------------------------------
{
  const db = await storage.ensureReady();
  await db.table('loteApartacoes').where('id').equals('L1').modify({ nome_lote: '<script>alert(1)</script> & "x"' });
  const hostileVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: matrixSelection }, ADMIN);
  assert.ok(hostileVm.rows.some((row) => String(row.lote_nome_atual ?? '').includes('<script>')), 'a massa tem o nome hostil');
  const hostile = preparePrint(hostileVm, ADMIN, { header, chartsConfig: {} });
  assert.ok(!hostile.html.includes('<script>alert(1)</script>'), 'NEGATIVO: o nome nunca sai cru');
  assert.ok(!/<script/i.test(hostile.html), 'nenhum <script> no documento');
  assert.ok(hostile.html.includes(escapeHtml('<script>alert(1)</script> & "x"')), 'nome escapado');
  const block = hostile.html.slice(hostile.html.indexOf('<section class="rc-block'), hostile.html.indexOf('</section>', hostile.html.indexOf('<section class="rc-block')));
  assert.ok(count(block, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/g) >= 3, 'escapado no SVG, na legenda e na tabela do bloco de gráficos');
  assert.ok(!/id="[^"]*script/i.test(hostile.html), 'ids gerados (rc-<n>), nunca do nome');
  await db.table('loteApartacoes').where('id').equals('L1').modify({ nome_lote: 'Lote 01' });
  results.push({ caso: 'escape', ocorrencias: count(block, /&lt;script&gt;/g) });
}

// ---------------------------------------------------------------------------------------------------------
// f) Permissão (imprimir = exportar) e CONSULTA
// ---------------------------------------------------------------------------------------------------------
{
  const opVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: matrixSelection }, OPERADOR);
  assert.equal(code(() => preparePrint(opVm, OPERADOR, { chartsConfig: {} })), 'AUTH_FORBIDDEN', 'OPERADOR (sem reports.export) não imprime os gráficos');
  const consultaVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: matrixSelection }, CONSULTA);
  const consulta = preparePrint(consultaVm, CONSULTA, { chartsConfig: {} });
  assert.deepEqual(svgsOf(consulta.html), svgsOf(printed.html), 'CONSULTA imprime os mesmos gráficos');
  assert.deepEqual(consulta.charts, buildReportCharts(vm, PESAGENS, {}, ADMIN.role), 'os mesmos dados');
  const columns = chartColumnIds(PESAGENS);
  assert.ok(['peso', 'gmd', 'ganho', 'ganho_arroba', 'animais_com_anterior', 'nome_lote'].every((id) => columns.includes(id)), 'colunas dos gráficos para o assertCanExport');
  assert.equal(code(() => assertCanExport(PESAGENS, CONSULTA.role, columns)), 'OK', 'CONSULTA exporta as colunas dos gráficos (nenhuma sensível)');
  assert.equal(code(() => assertCanExport(PESAGENS, CONSULTA.role, [...columns, 'valor_arroba'])), 'AUTH_FORBIDDEN', 'NEGATIVO: uma coluna sensível entre as dos gráficos seria recusada no mesmo assertCanExport');
  results.push({ caso: 'permissão', operador: 'AUTH_FORBIDDEN', consulta: consulta.charts.length });
}

// ---------------------------------------------------------------------------------------------------------
// g) Excel: aba "Gráficos" com os mesmos números
// ---------------------------------------------------------------------------------------------------------
{
  const config = { 'ganho-por-mes': { metrica: 'arroba' } };
  const xlsx = await prepareEmission(vm, 'xlsx', ADMIN, { chartsConfig: config });
  const files = unzipStored(xlsx.content);
  assert.ok(files['xl/worksheets/sheet3.xml'], 'aba 3 no pacote');
  assert.match(files['xl/workbook.xml'], /<sheet name="Gráficos" sheetId="3" r:id="rId4"\/>/, 'aba "Gráficos"');
  assert.match(files['xl/_rels/workbook.xml.rels'], /Id="rId4"[^>]*Target="worksheets\/sheet3\.xml"/, 'relação da aba');
  assert.match(files['[Content_Types].xml'], /PartName="\/xl\/worksheets\/sheet3\.xml"/, 'tipo da aba');
  assert.equal(xlsx.manifest.display, 'graficos');
  assert.deepEqual(xlsx.manifest.charts.map((chart) => chart.id), PESAGENS.charts.map((chart) => chart.id), 'manifesto do Excel lista os gráficos');
  const sheet = files['xl/worksheets/sheet3.xml'];
  const rows = [...sheet.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map((match) => [...match[2].matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"(?: t="inlineStr")?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t xml:space="preserve">([^<]*)<\/t><\/is>)<\/c>)/g)].map((cell) => (cell[3] !== undefined ? Number(cell[3]) : cell[4] !== undefined ? decode(cell[4]) : null)));
  const charts = buildReportCharts(vm, PESAGENS, config, ADMIN.role);
  let numbers = 0;
  for (const chart of charts) {
    const headerIndex = rows.findIndex((row) => row[0] === chart.tabela.cabecalho[0] && row.slice(1).join('|') === chart.tabela.cabecalho.slice(1).join('|') && rows[rows.indexOf(row) - 1 - (chart.subtitle ? 1 : 0)]?.[0] === chart.title);
    assert.ok(headerIndex > 0, `tabela do gráfico ${chart.id} na aba`);
    chart.tabela.linhas.forEach((line, lineIndex) => {
      const row = rows[headerIndex + 1 + lineIndex];
      assert.equal(row[0], line[0], `${chart.id}: rótulo da linha ${line[0]}`);
      line.slice(1).forEach((text, cellIndex) => {
        const raw = chart.tabela.valores[lineIndex][cellIndex + 1];
        const format = chart.tabela.formatos[cellIndex + 1];
        const cell = row[cellIndex + 1];
        if (raw === null) { assert.equal(cell, null, `${chart.id}: sem valor = célula vazia (nunca 0)`); return; }
        assert.equal(typeof cell, 'number', `${chart.id}: número como número`);
        assert.equal(cell, formatCell(format, raw, 'xlsx'), `${chart.id}: mesmo número (arredondado nas casas da coluna)`);
        // O texto do PDF/tela é o mesmo número: "346,7 kg" ↔ 346.7.
        assert.equal(Number(text.replace(/[^\d,-]/g, '').replace(',', '.')), cell, `${chart.id}: "${text}" = ${cell}`);
        numbers += 1;
      });
    });
  }
  assert.ok(numbers >= 20, `números conferidos célula a célula (${numbers})`);
  const plainXlsx = await prepareEmission(vm, 'xlsx', ADMIN);
  const plainFiles = unzipStored(plainXlsx.content);
  assert.ok(!plainFiles['xl/worksheets/sheet3.xml'] && !plainFiles['xl/workbook.xml'].includes('Gráficos') && !plainFiles['[Content_Types].xml'].includes('sheet3'), 'NEGATIVO: sem a vista Gráficos, o Excel não ganha aba');
  assert.equal(plainXlsx.manifest.charts, undefined);
  for (const format of ['csv', 'json']) {
    const withCharts = await prepareEmission(vm, format, ADMIN, { chartsConfig: {} });
    const without = await prepareEmission(vm, format, ADMIN);
    assert.equal(withCharts.content, without.content, `${format.toUpperCase()} não muda (mesmo conteúdo, byte a byte)`);
    assert.equal(withCharts.manifest.charts, undefined, `${format.toUpperCase()}: sem gráficos no manifesto`);
  }
  const opVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: matrixSelection }, OPERADOR);
  await assert.rejects(prepareEmission(opVm, 'xlsx', OPERADOR, { chartsConfig: {} }), (error) => error.code === 'AUTH_FORBIDDEN', 'OPERADOR não exporta');
  results.push({ caso: 'Excel', numeros: numbers, abas: (files['xl/workbook.xml'].match(/<sheet /g) || []).length });
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:charts-print:verify', ok: true, cases: results }, null, 2));
