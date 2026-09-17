// Gate reports:print-contract:verify (R4) — documento de impressão derivado do MESMO view model:
// cabeçalho (sistema, relatório, organização, período, filtros, emissão), cabeçalho de tabela
// repetido, A4 retrato/paisagem, grupos/subtotais/total geral iguais à árvore, rodapé com
// página X de Y, emissão e versão, escape de HTML, aviso quando não cabe (sem esconder coluna).
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { PRINT_LIMITS, buildPrintDocument, decidePrintLayout, escapeHtml } from '../src/modules/reporting/infrastructure/exporters/printDocument.js';
import { flattenTree } from '../src/modules/reporting/domain/groupEngine.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { cellRawValue } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const code = (fn) => { try { fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
await seedReportFixture();
await weighingService.updateEntry('e3', { observacao: '<script>alert(1)</script> & "aspas"' });
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

// Agrupado Apartação → Lote, com filtro
const vm = await runReport('pesagens.periodo', {
  today: TODAY, params: period,
  selection: { columns: ['data_pesagem', 'numero_animal', 'marca', 'peso', 'gmd', 'observacao'], groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], filters: { marca: { operator: 'contains', value: 'alfa' } } },
}, ADMIN);
const { html, layout, stats, manifest } = preparePrint(vm, ADMIN, { organization: 'Fazenda Modelo' });

// Cabeçalho
for (const text of ['Pesagens Individuais', 'Fazenda Modelo', escapeHtml('Pesagens por período'), 'Período', 'Filtros', 'Marca contém alfa', 'Agrupado por', 'Apartação › Lote', 'Emitido em', 'por Ana Admin (ADMIN)', `Versão ${vm.appVersion}`, 'esquema 8', `Emissão ${vm.emissionId.slice(0, 8)}`]) {
  assert.ok(html.includes(text), `cabeçalho contém: ${text}`);
}
assert.ok(html.includes('01/08/2026 a 15/09/2026'), 'período resolvido');
assert.ok(html.includes(`Registros: ${vm.rowCount}`), 'contagem de registros');

// Página, cabeçalho repetido, quebra e rodapé
assert.match(html, /@page \{ size: A4 portrait;/, 'A4 retrato (6 colunas)');
assert.match(html, /thead \{ display: table-header-group; \}/, 'cabeçalho da tabela repete em cada página');
assert.match(html, /tr \{ page-break-inside: avoid; break-inside: avoid; \}/, 'linha não quebra no meio');
assert.match(html, /counter\(page\) " de " counter\(pages\)/, 'página X de Y');
assert.ok(html.includes(`Emissão ${vm.emissionId.slice(0, 8)}`) && html.includes(`Pesagens Individuais ${vm.appVersion}`), 'rodapé com emissão e versão');
assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">/, 'documento sem script (CSP)');
assert.ok(!/<script>alert/.test(html), 'NEGATIVO: HTML do usuário escapado');
assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot;'));

// Mesma população e estrutura da tela
const flat = flattenTree(vm.tree);
assert.equal(stats.dataRows, vm.rowCount, 'linhas de dados = população');
assert.equal(stats.groupRows, flat.filter((item) => item.kind === 'GROUP').length, 'uma linha por grupo');
assert.equal(stats.subtotalRows, flat.filter((item) => item.kind === 'SUBTOTAL').length, 'uma linha de subtotal por grupo');
assert.equal(stats.totalRows, 1, 'um total geral');
const firstData = flat.find((item) => item.kind === 'DATA').row;
for (const column of vm.columns) {
  assert.ok(html.includes(escapeHtml(formatCell(column, cellRawValue(vm, column, firstData), 'print'))), `célula formatada igual à tela: ${column.id}`);
}
assert.ok(html.includes(`Animais únicos: <b>${vm.totals.animais.value}</b>`), 'total geral de animais únicos');
assert.ok(html.includes(`GMD ponderado — GMD (kg/dia): <b>${formatCell({ type: 'gmd' }, vm.totals.gmd_ponderado.value, 'print')}</b>`), 'GMD ponderado geral');
assert.ok(/class="num"/.test(html), 'números alinhados à direita');
assert.ok(html.includes('Peso (kg)') && html.includes('GMD (kg/dia)'), 'unidades no cabeçalho');
assert.equal(manifest.orientation, 'portrait');

// Orientação automática e aviso de largura
const mock = (count, width = 120) => ({ columns: Array.from({ length: count }, (_, i) => ({ id: `c${i}`, defaultWidth: width })) });
assert.equal(decidePrintLayout(mock(8)).orientation, 'portrait', 'até 8 colunas normais → retrato');
assert.equal(decidePrintLayout(mock(9)).orientation, 'landscape', 'acima de 8 → paisagem');
assert.equal(decidePrintLayout(mock(6, 200)).orientation, 'landscape', 'considera largura real, não só a contagem');
const tooWide = decidePrintLayout(mock(20, 120));
assert.equal(tooWide.fits, false);
assert.equal(tooWide.warning.message, 'Este relatório possui muitas colunas para impressão.');
assert.deepEqual(tooWide.warning.options, ['reduzir colunas', 'exportar XLSX/CSV']);
assert.deepEqual(decidePrintLayout(mock(9), { orientation: 'portrait' }).warning.options, ['paisagem', 'reduzir colunas', 'exportar XLSX/CSV']);
assert.ok(PRINT_LIMITS.LANDSCAPE_MAX_WIDTH > PRINT_LIMITS.PORTRAIT_MAX_WIDTH);
const wideVm = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'peso', 'nome_lote', 'nome_apartacao'] } }, ADMIN);
const wide = buildPrintDocument(wideVm);
assert.match(wide.html, /size: A4 landscape/, '11 colunas → paisagem');
assert.equal((wide.html.match(/<th /g) || []).length, 11, 'NEGATIVO: nenhuma coluna escondida');

// Permissão: imprimir = exportar
assert.equal(code(() => preparePrint(vm, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não imprime');
const vmConsulta = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: ['data_pesagem', 'numero_animal', 'valor_venda_total'] } }, CONSULTA);
const consultaDoc = preparePrint(vmConsulta, CONSULTA);
assert.ok(!consultaDoc.html.includes('Valor venda') && consultaDoc.html.includes('1 coluna(s) omitida(s) pelo perfil'), 'CONSULTA imprime sem valores, com aviso de omissão');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:print-contract:verify', ok: true, stats, htmlBytes: html.length }, null, 2));
