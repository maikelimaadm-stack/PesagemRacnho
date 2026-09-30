// Gate reports:folha-makgestao-todos:verify (E1E 1.4.0, parte F) — a FOLHA de todos os relatórios no estilo do
// MAKGESTAO (docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md, item 4):
//   1. todo relatório do catálogo e da aba Controle, em cada tipo do seletor (os declarados ou, sem eles, o
//      resumo padrão e o Analítico gerados) e nos casos de hoje (Resumido/Detalhado por agrupamento), sai com
//      data-style="makgestao" e um desenho conhecido: os 5 de Pesagens ou o 'resumo'/'lista' genéricos;
//   2. nenhuma coluna desalinhada: cada célula sob o cabeçalho da SUA coluna (data-col/data-key), com negativo;
//   3. cabeçalhos no jeito do antigo: Title Case e sem "(kg)", "(R$)", "(%)", "(kg/dia)" — a unidade vai na célula;
//   4. unidades nas células pelo tipo: kg em todo peso, R$ no dinheiro, GMD com 3 casas, @ com 2, contagem
//      inteira; zero de contagem e ausente "-" (nunca "—" nem "0");
//   5. Subtotal, Total e TOTAL GERAL em LINHA DE TEXTO (nenhum total vira linha da tabela) e cada número dela =
//      o motor sobre a população do nó (computeAggregates; "N animais" = animais distintos; "<Grupos>: N" =
//      groupRows), com negativos;
//   6. casos vazios: sem linhas, só o aviso (sem tabela e sem total); relatório sem período diz "Estado atual
//      (hoje)"; coluna sem nenhum valor some;
//   7. XLSX/CSV/JSON continuam com os números do motor, sem unidade (a folha só muda a apresentação).
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { REPORT_VISIBILITY } from '../src/modules/reporting/domain/reportDefinition.js';
import { listReportViews, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { DOC_ROW_TYPES, MAK_EMPTY_TEXT, MAK_MISSING, MAK_PESAGENS_VARIANTS, buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { computeAggregates } from '../src/modules/reporting/domain/reportAggregates.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const hasPeriod = (definition) => (definition.params ?? []).some((param) => param.type === 'period');
const paramsOf = (definition) => (hasPeriod(definition) ? P : {});
const close = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b);
const COUNT_OPS = new Set(['count', 'countValid', 'countDistinct']);
const GENERIC = new Set(['resumo', 'lista']);
const SMALL = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'por']);
const decode = (text) => String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const definitions = [...listReportDefinitions(), ...listReportDefinitions({ visibility: REPORT_VISIBILITY.MAINTENANCE })];
assert.ok(definitions.length >= 12, `catálogo + aba Controle (${definitions.length} relatórios)`);

// ---- 2. alinhamento célula × cabeçalho (o HTML que a tela, a impressão e o PDF desenham) ----
function assertTablesAligned(html, where) {
  const tables = [...html.matchAll(/<table class="sheet-table[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map(([, body]) => body);
  for (const body of tables) {
    const head = [...body.matchAll(/<th data-col="(\d+)" data-key="([^"]*)"/g)].map(([, col, key]) => [Number(col), key]);
    head.forEach(([col], index) => assert.equal(col, index, `${where}: cabeçalho em ordem de índice`));
    for (const [, type, rowBody] of body.matchAll(/<tr class="[^"]*" data-row-type="([A-Z_]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...rowBody.matchAll(/<td data-col="(\d+)" data-key="([^"]*)"/g)].map(([, col, key]) => [Number(col), key]);
      assert.equal(cells.length, head.length, `${where}: linha ${type} com ${cells.length} células para ${head.length} colunas`);
      cells.forEach(([col, key], index) => {
        assert.equal(col, index, `${where}: célula ${index} no índice ${col}`);
        assert.equal(key, head[index][1], `${where}: célula ${index} (${key}) sob o cabeçalho ${head[index][1]}`);
      });
    }
  }
  return tables.length;
}

// ---- 3. cabeçalho no jeito do antigo ----
function assertHeader(label, where) {
  assert.ok(!/\((kg|R\$|%|kg\/dia)\)$/.test(label), `${where}: cabeçalho "${label}" sem a unidade que a célula mostra`);
  let inside = false;
  label.split(/\s+/).forEach((word, index) => {
    const skip = inside || word.startsWith('(');
    if (word.startsWith('(')) inside = true;
    if (word.endsWith(')')) inside = false;
    if (skip || (index > 0 && SMALL.has(word))) return;
    const letter = word.match(/\p{L}/u)?.[0];
    if (letter && word.indexOf(letter) === 0) assert.equal(letter, letter.toLocaleUpperCase('pt-BR'), `${where}: cabeçalho "${label}" em Title Case`);
  });
}

// ---- 4. texto de uma célula pelo tipo do valor ----
function assertCellText(text, column, op, where) {
  assert.notEqual(text, '—', `${where}: ausente é "-" (nunca "—")`);
  if (text === MAK_MISSING || text === '') return;
  const type = column?.type ?? 'text';
  if (op && COUNT_OPS.has(op)) {
    assert.match(text, /^\d{1,3}(\.\d{3})*$/, `${where}: contagem inteira (${text})`);
    assert.notEqual(text, '0', `${where}: contagem zero é "-"`);
    return;
  }
  if (type === 'weight') assert.match(text, /^-?\d{1,3}(\.\d{3})*(,\d+)? kg$/, `${where}: peso com "kg" (${text})`);
  else if (type === 'money') assert.match(text, /^-?R\$\s\d{1,3}(\.\d{3})*,\d{2}$/u, `${where}: dinheiro com "R$" (${text})`);
  else if (type === 'gmd') assert.match(text, /^-?\d+,\d{3}$/, `${where}: GMD com 3 casas (${text})`);
  else if (column?.unit === '@') assert.match(text, /^-?\d{1,3}(\.\d{3})*,\d{2}$/, `${where}: @ com 2 casas (${text})`);
  else if (type === 'percentage') assert.match(text, /%$/, `${where}: porcentagem com % (${text})`);
  else if (type === 'integer') assert.match(text, /^-?\d{1,3}(\.\d{3})*(,\d)?$/, `${where}: número inteiro (${text})`);
}

// ---- 5. linha de total = motor sobre a população do nó ----
function nodeIndex(vm) {
  const byId = new Map();
  (function walk(nodes) { for (const node of nodes ?? []) { byId.set(node.id, node); walk(node.children); } })(vm.tree);
  return byId;
}
function checkLine(vm, row, byId, where) {
  assert.ok(row.line && Array.isArray(row.line.items) && row.line.items.length > 0, `${where}: ${row.type} em linha de texto`);
  const population = row.type === DOC_ROW_TYPES.GRAND_TOTAL ? vm.rows : byId.get(row.id.replace(/#(subtotal|total)$/, ''))?.rows;
  assert.ok(Array.isArray(population), `${where}: ${row.id} é um nó real da árvore`);
  const specs = vm.aggregates.map((spec) => ({ id: spec.id, op: spec.op, ...(spec.columnId ? { columnId: spec.columnId } : {}) }));
  const engine = computeAggregates(population, specs, vm.resolve);
  const lead = row.line.items[0];
  assert.match(lead.label, /^(Subtotal|Total|TOTAL GERAL)/, `${where}: 1º item leva o rótulo da linha (${lead.label})`);
  assert.match(lead.text, /^(\d{1,3}(\.\d{3})* \p{L}+|-)$/u, `${where}: "N <o que conta>" (${lead.text})`);
  for (const item of row.line.items) {
    if (item.key === '__rows__') assert.equal(item.raw, population.length, `${where}: linhas do grupo = ${population.length}`);
    else if (item.key === '__grupos__') {
      const leaf = vm.groups.at(-1);
      assert.equal(item.raw, groupRows(population, [{ columnId: leaf.columnId }], vm.resolve).nodes.length, `${where}: ${item.label} = grupos do nível folha (groupRows)`);
    } else if (item.key.startsWith('pair:')) {
      const pair = vm.metricPairs.find((candidate) => `pair:${candidate.id}` === item.key);
      assert.deepEqual(item.raw, [engine[pair.from]?.value ?? null, engine[pair.to]?.value ?? null], `${where}: faixa = motor`);
    } else {
      assert.ok(item.key in engine, `${where}: item ${item.key} é um total do relatório`);
      assert.ok(close(item.raw, engine[item.key]?.value ?? null), `${where}: ${item.label ?? 'rótulo'} = motor sobre a população (${item.raw} × ${engine[item.key]?.value})`);
    }
    assert.notEqual(item.text, '—', `${where}: ausente é "-" na linha`);
  }
  // "N animais" = animais distintos (nunca pesagens contadas como animais).
  if (/ anima(l|is)$/.test(lead.text)) {
    const animal = vm.animalColumnId ?? 'animal';
    assert.equal(lead.raw, computeAggregates(population, [{ id: 'n', op: 'countDistinct', columnId: animal }], vm.resolve).n.value, `${where}: "N animais" = animais distintos`);
  }
}

function assertNoTotalRowsInTables(html, where) {
  assert.ok(!/<tr class="[^"]*" data-row-type="(SUBTOTAL|TOTAL|GRAND_TOTAL)"/.test(html), `${where}: nenhum total como linha da tabela`);
}

// ---- casos: cada tipo de cada relatório + os agrupamentos de hoje que a responsável usa ----
const cases = [];
for (const definition of definitions) {
  for (const view of listReportViews(definition)) cases.push({ id: definition.id, definition, name: `${definition.id} › ${view.label}`, selection: viewSelection(view, definition) });
}
const byId = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
const extra = [
  ['rebanho.atual', 'Rebanho atual — resumo por lote', { mode: 'RESUMIDO', groups: [{ columnId: 'lote_atual' }] }],
  ['rebanho.atual', 'Rebanho atual — lista por lote', { mode: 'DETALHADO', groups: [{ columnId: 'lote_atual' }] }],
  ['desempenho', 'Desempenho — resumo por lote', { mode: 'RESUMIDO', groups: [{ columnId: 'lote' }] }],
  ['desempenho', 'Desempenho — lista por lote', { mode: 'DETALHADO', groups: [{ columnId: 'lote' }] }],
  ['saidas', 'Saídas — resumo por motivo', { mode: 'RESUMIDO', groups: [{ columnId: 'motivo_saida' }] }],
  ['saidas', 'Saídas — lista por motivo', { mode: 'DETALHADO', groups: [{ columnId: 'motivo_saida' }] }],
  ['movimentacao.lotes', 'Movimentação — resumo por lote', { mode: 'RESUMIDO', groups: [{ columnId: 'lote' }] }],
  ['rebanho.ocupacao-lotes', 'Ocupação — resumo por apartação', { mode: 'RESUMIDO', groups: [{ columnId: 'apartacao' }] }],
  ['embarques.romaneio', 'Romaneio — resumo 2 níveis', { mode: 'RESUMIDO', groups: [{ columnId: 'embarque_nome' }, { columnId: 'documento_numero' }] }],
  ['embarques.romaneio', 'Romaneio — lista 2 níveis', { mode: 'DETALHADO', groups: [{ columnId: 'embarque_nome' }, { columnId: 'documento_numero' }] }],
  ['controle.fechamento-dia', 'Fechamento do dia — lista por sessão', { mode: 'DETALHADO', groups: [{ columnId: 'sessao' }] }],
  ['pesagens', 'Pesagens Personalizado — resumo 3 níveis', { mode: 'RESUMIDO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem' }, { columnId: 'nome_lote' }] }],
  ['pesagens', 'Pesagens Personalizado — lista 2 níveis', { mode: 'DETALHADO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }] }],
];
for (const [id, name, selection] of extra) if (byId[id]) cases.push({ id, definition: byId[id], name, selection });

const seen = { variants: new Set(), pesagensVariants: new Set(), reports: new Set(), lines: 0, tables: 0, cells: 0, generic: 0 };
let genericResumo = null;
for (const testCase of cases) {
  const { definition, name } = testCase;
  const vm = await runReport(testCase.id, { today: TODAY, params: paramsOf(definition), selection: testCase.selection }, ADMIN);
  const doc = buildReportDocument(vm);
  const html = renderSheetBody(doc, { mode: 'print' });
  seen.reports.add(testCase.id);
  seen.variants.add(doc.variant);
  // 1. estilo e desenho
  assert.equal(doc.style, 'makgestao', `${name}: folha do MAKGESTAO`);
  assert.ok(html.includes(`data-style="makgestao" data-view="${doc.variant}"`), `${name}: CSS do MAKGESTAO escopado pelo documento`);
  assert.ok(GENERIC.has(doc.variant) || MAK_PESAGENS_VARIANTS.includes(doc.variant), `${name}: desenho conhecido (${doc.variant})`);
  if (testCase.id === 'pesagens' && vm.view) seen.pesagensVariants.add(doc.variant);
  if (testCase.id !== 'pesagens' && doc.layout !== 'vendas' && doc.layout !== 'matrix') assert.ok(GENERIC.has(doc.variant), `${name}: resumo/lista genéricos fora de Pesagens (${doc.variant})`);
  assert.match(doc.title, /^Relatório de .+ \((Analítico|Sintético)\)$/, `${name}: título (${doc.title})`);
  assert.equal(doc.periodText.startsWith('Período: '), hasPeriod(definition) && Boolean(vm.period), `${name}: período abaixo do título`);
  if (!hasPeriod(definition)) assert.equal(doc.periodText, 'Estado atual (hoje)', `${name}: sem período, "Estado atual (hoje)"`);
  // 2. alinhamento
  seen.tables += assertTablesAligned(html, name);
  if (!GENERIC.has(doc.variant) || doc.empty) continue;
  seen.generic += 1;
  // 3. cabeçalhos
  for (const column of doc.columns) {
    assertHeader(column.label, name);
    assert.ok(html.includes(`>${column.label.replace(/&/g, '&amp;')}</th>`) || html.includes(`>${column.label.replace(/&/g, '&amp;')}</button></th>`), `${name}: cabeçalho "${column.label}" na folha`);
  }
  // 4. células
  const rows = documentRows(doc);
  for (const row of rows) {
    if (row.line) continue;
    row.cells.forEach((cell, index) => {
      const column = doc.columns[index];
      if (column.kind === 'label') return;
      const valueColumn = column.kind === 'data' ? column.column : column.kind === 'pair' ? { type: 'weight', unit: 'kg' } : column.metric?.column;
      if (column.kind === 'pair') {
        if (cell.text) assert.match(cell.text, /^(\d[\d.]*-\d[\d.]* kg|[≥≤] \d[\d.]* kg|-)$/, `${name}: faixa "de-até kg" (${cell.text})`);
        return;
      }
      if (row.type === DOC_ROW_TYPES.DATA && column.kind === 'data' && cell.text === MAK_MISSING) return;
      assertCellText(cell.text, valueColumn, column.kind === 'metric' ? column.op : null, `${name} · ${row.id} · ${column.key}`);
      seen.cells += 1;
    });
  }
  // 5. totais em linha de texto, com os números do motor
  assertNoTotalRowsInTables(html, name);
  const index = nodeIndex(vm);
  const totalRows = rows.filter((row) => [DOC_ROW_TYPES.SUBTOTAL, DOC_ROW_TYPES.TOTAL, DOC_ROW_TYPES.GRAND_TOTAL].includes(row.type));
  assert.ok(totalRows.some((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL), `${name}: tem TOTAL GERAL`);
  for (const row of totalRows) checkLine(vm, row, index, `${name} · ${row.id}`);
  seen.lines += totalRows.length;
  assert.equal((html.match(/<div class="mk-line mk-line--(grid|flow|box)" data-row-type="(SUBTOTAL|TOTAL|GRAND_TOTAL)"/g) || []).length, totalRows.length, `${name}: um total = uma linha de texto na folha`);
  assert.match(html, /TOTAL GERAL:/, `${name}: "TOTAL GERAL:" na folha`);
  if (doc.variant === 'resumo' && vm.groups.length === 1 && testCase.id === 'rebanho.atual') genericResumo = { vm, doc };
}
assert.ok(seen.generic >= 20 && seen.lines >= 40 && seen.cells >= 100, `massa exercita o genérico (${seen.generic} folhas, ${seen.lines} totais, ${seen.cells} células)`);
assert.ok(seen.variants.has('resumo') && seen.variants.has('lista'), 'resumo e lista genéricos exercitados');
// 7 (parte). Pesagens continua com os desenhos dele (E1D).
for (const variant of MAK_PESAGENS_VARIANTS) assert.ok(seen.pesagensVariants.has(variant), `Pesagens: desenho "${variant}" continua`);
for (const definition of definitions) assert.ok(seen.reports.has(definition.id), `${definition.id} conferido`);

// ---- Rótulos da linha de total: "N animais", "<Grupos>: N" e a unidade da célula na linha ----
{
  const rebanho = byId['rebanho.atual'];
  const vm = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'lote_atual' }] } }, ADMIN);
  const grand = documentRows(buildReportDocument(vm)).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  assert.deepEqual(grand.line.items.map((item) => [item.label, item.text]), [['TOTAL GERAL', '2 animais'], ['Peso Médio', '272,5 kg'], ['Peso Total', '545,0 kg'], ['Lotes', '2']], 'Rebanho por lote: "TOTAL GERAL: 2 animais | Peso Médio: 272,5 kg | Peso Total: 545,0 kg | Lotes: 2"');
  assert.ok(rebanho);
  const saidas = await runReport('saidas', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'motivo_saida' }] } }, ADMIN);
  const saidasGrand = documentRows(buildReportDocument(saidas)).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  assert.deepEqual(saidasGrand.line.items.map((item) => item.text), ['2 saídas', '2', '280,0 kg', '2'], 'Saídas: contagem de registros com o nome dela ("2 saídas"), Motivos: 2');
  const ocupacao = await runReport('rebanho.ocupacao-lotes', { today: TODAY, params: {}, selection: {} }, ADMIN);
  const ocupacaoGrand = documentRows(buildReportDocument(ocupacao)).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  const capacidade = ocupacaoGrand.line.items.find((item) => item.key === 'capacidade');
  assert.deepEqual([capacidade.label, capacidade.text], ['Capacidade', '20 cab.'], 'unidade que não está na célula vai na linha, sem repetir no rótulo');
  assert.ok(ocupacaoGrand.line.items.find((item) => item.key === 'ocupacao').text.endsWith(' %'), 'porcentagem na linha');
  // Um item só = linha "de" 1: singular ("1 saída", "1 animal").
  const romaneio = await runReport('embarques.romaneio', { today: TODAY, params: P, selection: { mode: 'DETALHADO' } }, ADMIN);
  assert.equal(documentRows(buildReportDocument(romaneio)).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL).line.items[0].text, '1 saída', 'singular com 1');
  // Sem total que conte na frente, as linhas do grupo abrem a linha ("N pesagens").
  const semContagem = await runReport('pesagens', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'peso_medio', columnId: 'peso', op: 'avg' }] } }, ADMIN);
  const semContagemGrand = documentRows(buildReportDocument(semContagem)).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  assert.deepEqual(semContagemGrand.line.items.map((item) => item.key), ['__rows__', 'peso_medio', '__grupos__'], 'sem contagem: as linhas do grupo na frente');
  assert.equal(semContagemGrand.line.items[0].text, `${semContagem.rowCount} pesagens`, '"9 pesagens"');
}

// ---- Negativos: célula fora da coluna, total virando linha da tabela e número da linha adulterado ----
{
  const vm = genericResumo.vm;
  const html = renderSheetBody(genericResumo.doc, { mode: 'print' });
  assert.throws(() => assertTablesAligned(html.replace(/(<td data-col="1" data-key=")([^"]*)(")/, '$1__trocada__$3'), 'negativo'), 'NEGATIVO: célula sob a coluna errada é detectada');
  assert.throws(() => assertTablesAligned(html.replace(/<td data-col="2" data-key="[^"]*" class="[^"]*">[^<]*<\/td>/, ''), 'negativo'), 'NEGATIVO: célula faltando é detectada');
  const grand = documentRows(genericResumo.doc).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  const asTableRow = `<tr class="sheet-grand" data-row-type="GRAND_TOTAL" data-row-id="#grand"></tr>`;
  assert.throws(() => assertNoTotalRowsInTables(`${html}${asTableRow}`, 'negativo'), 'NEGATIVO: total como linha da tabela é detectado');
  const tampered = { ...grand, line: { ...grand.line, items: grand.line.items.map((item, index) => (index === 1 ? { ...item, raw: item.raw + 1 } : item)) } };
  assert.throws(() => checkLine(vm, tampered, nodeIndex(vm), 'negativo'), 'NEGATIVO: número da linha diferente do motor é detectado');
  const counted = { ...grand, line: { ...grand.line, items: grand.line.items.map((item, index) => (index === 0 ? { ...item, raw: vm.rowCount + 5 } : item)) } };
  assert.throws(() => checkLine(vm, counted, nodeIndex(vm), 'negativo'), 'NEGATIVO: "N animais" que não é o número de animais distintos é detectado');
  assert.throws(() => assertHeader('Peso médio (kg)', 'negativo'), 'NEGATIVO: unidade no cabeçalho é detectada');
  assert.throws(() => assertCellText('0', { type: 'integer' }, 'count', 'negativo'), 'NEGATIVO: contagem zero como "0" é detectada');
  assert.throws(() => assertCellText('345,0', { type: 'weight', unit: 'kg' }, 'avg', 'negativo'), 'NEGATIVO: peso sem "kg" é detectado');
}

// ---- 6. casos vazios: cada relatório com um filtro que não acha nada ----
let empties = 0;
for (const definition of definitions) {
  const selection = viewSelection(listReportViews(definition)[0], definition);
  const text = (definition.columns ?? []).find((column) => ['text', 'identifier'].includes(column.type) && (selection.columns ?? []).includes(column.id))
    ?? (definition.columns ?? []).find((column) => ['text', 'identifier'].includes(column.type));
  if (!text) continue;
  const vm = await runReport(definition.id, { today: TODAY, params: paramsOf(definition), selection: { ...selection, filters: { ...(selection.filters ?? {}), [text.id]: { operator: 'contains', value: 'zzzz-nenhum' } } } }, ADMIN);
  assert.equal(vm.rowCount, 0, `${definition.id}: filtro sem resultado`);
  const doc = buildReportDocument(vm);
  const html = renderSheetBody(doc, { mode: 'print' });
  assert.ok(doc.empty && doc.style === 'makgestao', `${definition.id}: folha vazia do MAKGESTAO`);
  assert.ok(html.includes(`<p class="sheet-empty">${doc.emptyText}</p>`), `${definition.id}: só o aviso (${doc.emptyText})`);
  assert.ok(!html.includes('<table class="sheet-table') && !html.includes('class="mk-line') && !html.includes('sheet-vendas'), `${definition.id}: vazia sem tabela e sem total`);
  if (definition.id !== 'pesagens') assert.equal(doc.emptyText, MAK_EMPTY_TEXT, `${definition.id}: "${MAK_EMPTY_TEXT}"`);
  assert.equal(doc.footer.arroba, null, `${definition.id}: vazia não explica @`);
  empties += 1;
}
assert.ok(empties >= definitions.length - 1, `casos vazios de (quase) todos os relatórios (${empties} de ${definitions.length})`);
// Coluna sem nenhum valor some (Fechamento do dia sem pendência e sem observação no dia).
const fechamento = await runReport('controle.fechamento-dia', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-09-05', to: '2026-09-05' } }, selection: { mode: 'DETALHADO', groups: [{ columnId: 'sessao' }] } }, ADMIN);
const fechamentoDoc = buildReportDocument(fechamento);
assert.ok(fechamentoDoc.hiddenColumns.some((column) => column.key === 'pendencias') && !fechamentoDoc.columns.some((column) => column.key === 'pendencias'), 'coluna sem valor some da folha');
assert.ok(buildReportDocument(fechamento, { showEmptyColumns: true }).columns.some((column) => column.key === 'pendencias'), '"mostrar colunas vazias" traz de volta');

// ---- 7. XLSX/CSV/JSON: números do motor, sem unidade ----
{
  const { vm, doc } = genericResumo;
  const grand = documentRows(doc).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
  const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
  for (const item of grand.line.items.filter((entry) => entry.key in (vm.totals ?? {}))) {
    assert.ok(close(json.totals[item.key].value, item.raw), `JSON: ${item.key} = o número da linha da folha`);
  }
  const csv = (await prepareEmission(vm, 'csv', ADMIN)).content;
  assert.ok(!/\d kg\b/.test(csv) && !/R\$/.test(csv) && csv.includes('545,0'), 'CSV: número sem unidade (Peso total 545,0)');
  const xlsx = await prepareEmission(vm, 'xlsx', ADMIN);
  assert.ok(xlsx.content?.length > 0, 'XLSX gerado');
  // Impressão = exportação: o documento impresso é a mesma folha (estilo do MAKGESTAO).
  assert.ok(preparePrint(vm, ADMIN, {}).html.includes('data-style="makgestao" data-view="resumo"'), 'impressão/PDF com a folha do MAKGESTAO');
}

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:folha-makgestao-todos:verify', ok: true,
  relatorios: [...seen.reports], casos: cases.length, desenhos: [...seen.variants].sort(), folhasGenericas: seen.generic,
  totaisEmLinha: seen.lines, celulasConferidas: seen.cells, tabelas: seen.tables, vazios: empties,
}, null, 2));
