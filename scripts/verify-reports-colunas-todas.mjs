// Gate reports:colunas-todas:verify (E1F 1.4.1, item 1 — docs/plano-mestre/E1F-COLUNAS-CABECALHO-NOVO-RELATORIO.md):
// "todas as opções de todos os tipos de todos os relatórios funcionam". Matriz relatório × tipo × opção do seletor
// "Colunas Painel / Colunas Detalhes / Colunas Visíveis" (columnChoices) e o "Colunas" genérico (Personalizado,
// detalhe de um grupo):
//   1. todo tipo tem o seletor (o resumido de totais, o lista de colunas; só a Matriz não) e ele oferece só o que o
//      perfil vê (OPERADOR/CONSULTA sem valor comercial; chave sensível nem gravada);
//   2. cada opção, SOZINHA: vai para o view model (coluna/total), para a folha (cabeçalho + células alinhadas por
//      data-col/data-key, texto formatado, sem "undefined"/"NaN"), para o HTML, o XLSX e o CSV; o par Faixa vira uma
//      coluna "de–até"; o desenho de venda leva a coluna no detalhe (Mostrar Detalhes) e no XLSX;
//   3. desmarcar tira (padrão menos a opção: some de todos os canais, as outras ficam na ordem);
//   4. a ORDEM escolhida vale (todas as opções invertidas) na folha, no XLSX e no CSV;
//   5. coluna escolhida SEM VALOR aparece ("-") — antes da E1F sumia da folha (tela/impressão/PDF); no padrão do
//      tipo a vazia continua sumindo (E1C) e "Mostrar colunas vazias" traz de volta;
//   6. rótulo: o do seletor = o da grade/XLSX com a opção sozinha ou com todas (antes: Romaneio "Saídas" × "Cabeças");
//   7. a escolha grava e volta (report-type-columns → typedViewSelection → columnKeysOf) por tipo e usuário, sem
//      vazar para outro tipo, e o último estado reabre no tipo com as colunas; antes, o tipo lista perdia a escolha
//      ao trocar de tipo (não tinha seletor próprio);
//   8. "Colunas" genérico (Personalizado e detalhe de grupo): coluna acrescentada aparece em todos os canais.
// Cada regra tem caso negativo (a regra antiga reprovaria).
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { getReportViewState, getTypeColumnPrefs, saveReportViewState, saveTypeColumnPrefs } from '../src/modules/reporting/application/reportTemplateService.js';
import { stateFromRequest, typedViewSelection } from '../src/modules/reporting/application/reportInitialState.js';
import { getReportDefinition, listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { REPORT_MODES, VIEW_LAYOUTS } from '../src/modules/reporting/domain/reportDefinition.js';
import { canRunReport, canSeeColumn } from '../src/modules/reporting/domain/reportPermissions.js';
import { columnKeysOf, listReportViews, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { sanitizeTypeColumnKeys, typeColumnOptions } from '../src/modules/reporting/domain/typeColumns.js';
import { viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';
import { summaryMetrics } from '../src/modules/reporting/domain/summaryLayout.js';
import { headerLabel } from '../src/modules/reporting/domain/reportFormatting.js';
import { LABEL_COLUMN_KEY, MAK_MISSING, buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { buildSheetRows } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { buildCsv, parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';

const { DETALHADO, RESUMIDO } = REPORT_MODES;
const resumo = { gate: 'reports:colunas-todas:verify', ok: false, regras: [], relatorios: {}, combinacoes: 0 };
const ok = (regra) => resumo.regras.push(regra);
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const paramsOf = (definition, params = P) => (definition.params.some((param) => param.type === 'period') ? params : {});
// Reaproveita as linhas lidas (mesmo relatório, período e perfil) — como a tela faz ao trocar só a seleção.
const loaded = new Map();
async function run(definition, selection, actor = ADMIN, params = P) {
  const key = JSON.stringify([definition.id, actor.role, params]);
  const vm = await runReport(definition.id, { today: TODAY, params: paramsOf(definition, params), selection, arrobaDivisor: 30, reuse: loaded.get(key) ?? null }, actor);
  loaded.set(key, vm);
  return vm;
}
const BROKEN = /undefined|NaN|\[object|null/;
const unquote = (header) => String(header ?? '').replace(/^'/, '');

// ---------------------------------------------------------------------------------------------------------
// Massa: a dos gates + um abate (com embarque e carcaça), uma venda com destino/observação e uma compra com
// GTA/NF-e/frete (documentação do lançamento) e era — para (quase) toda opção ter valor em algum lugar.
// ---------------------------------------------------------------------------------------------------------
await seedReportFixture();
const bicho = (id, numero, extra = {}) => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, sexo: 'M', marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore',
  lote_id: 'L1', nome_lote: 'Lote 01', apartacao_id: 'ap1', nome_apartacao: 'Engorda', era: '13-24', ...extra,
});
const carcaca = (peso, pct) => ({ rendimento_carcaca: pct, rendimento_origem: 'INFORMADO', peso_carcaca_estimado: (peso * pct) / 100, quantidade_arrobas: (peso * pct) / 100 / 15 });
const d1 = bicho('F1', '1001');
const v1 = bicho('F2', '2001', { sexo: 'F', marca: 'BETA', marca_id: 'm-beta' });
const c1 = bicho('F3', '3001');
for (const entry of [
  { ...d1, id: 'f1c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 400 },
  { ...d1, id: 'f1m', tipo_manejo: 'Manejo', data_pesagem: '2026-08-20', peso: 450, observacao: 'manejo' },
  { ...d1, id: 'f1s', tipo_manejo: 'Saída', motivo_saida: 'Abate', data_pesagem: '2026-09-05', peso: 500, frigorifico: 'Frigo Sul', ...carcaca(500, 52), valor_arroba_abate: 310, valor_total_abate: 5400, observacao: 'abate', embarque_id: 'E1', embarque_nome: 'Embarque Sul', documento_embarque_id: 'D1', documento_tipo: 'GTA', documento_numero: '12345' },
  { ...v1, id: 'f2c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 380 },
  { ...v1, id: 'f2s', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-09-08', peso: 450, comprador: 'W3', destino_venda: 'Fazenda X', valor_arroba: 300, observacao: 'venda' },
  { ...c1, id: 'f3c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-03', peso: 300, origem_animal: 'Fazenda Boa', valor_pago_cabeca: 2400, documentacao: { gta: 'G-1', nfe: 'N-1', frete: 150 }, observacao: 'compra' },
]) await weighingService.createEntry(entry);

const CATALOGO = listReportDefinitions();
const withTypes = CATALOGO.filter((definition) => definition.views.length);
const pairOf = (definition, key) => (definition.metricPairs ?? []).find((pair) => pair.id === key) ?? null;
const sheetKeyOf = (definition, view, key) => (view.mode === RESUMIDO && pairOf(definition, key) ? `pair:${key}` : key);
const isVendasDoc = (doc) => doc.layout === 'vendas';
const sheetColumns = (doc) => (isVendasDoc(doc) ? doc.vendas.grupos.detailColumns ?? [] : doc.columns);

// ---------------------------------------------------------------------------------------------------------
// 1. Todo tipo tem o seletor; opções só do que o perfil vê
// ---------------------------------------------------------------------------------------------------------
for (const definition of withTypes) {
  for (const view of listReportViews(definition)) {
    const where = `${definition.id} › ${view.id}`;
    if (view.layout === VIEW_LAYOUTS.MATRIX) {
      assert.equal(view.columnChoices, undefined, `${where}: a Matriz não tem seletor (a célula é fixa)`);
      continue;
    }
    assert.ok(view.columnChoices?.available?.length, `NEGATIVO antigo: ${where} sem seletor "Colunas" próprio (o tipo lista perdia a escolha ao trocar de tipo)`);
    if (view.mode === DETALHADO) {
      assert.deepEqual(view.columnChoices.defaults, view.columns, `${where}: padrão do seletor = colunas do tipo`);
      assert.ok(view.columnChoices.available.every((id) => definition.columns.some((column) => column.id === id && !column.metricOnly)), `${where}: só colunas de dado do relatório`);
    }
    for (const role of ['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA']) {
      const keys = typeColumnOptions(definition, view, role).map((option) => option.key);
      for (const key of view.columnChoices.available) {
        const column = view.mode === DETALHADO ? definition.columns.find((item) => item.id === key) : null;
        const specs = view.mode === RESUMIDO ? (pairOf(definition, key) ? [pairOf(definition, key).from, pairOf(definition, key).to] : [key]).map((id) => view.aggregates.find((spec) => spec.id === id)) : [];
        const visible = view.mode === DETALHADO ? canSeeColumn(column, role) : specs.every((spec) => !spec.columnId || canSeeColumn(definition.columns.find((item) => item.id === spec.columnId), role));
        assert.equal(keys.includes(key), visible, `${where}: ${role} ${visible ? 'vê' : 'NÃO vê'} a opção ${key}`);
        if (!visible) assert.deepEqual(sanitizeTypeColumnKeys(definition, view, [key], role), [], `NEGATIVO: ${where}: ${role} não grava ${key}`);
      }
    }
  }
}
ok('todo-tipo-com-seletor-e-perfil');

// ---------------------------------------------------------------------------------------------------------
// 2–4, 6. Cada opção sozinha, desmarcar e ordem — view model, folha, HTML, XLSX e CSV
// ---------------------------------------------------------------------------------------------------------
/**
 * Confere uma escolha de chaves de um tipo em todos os canais. Devolve o view model.
 * @param keys escolha (na ordem); absent = chaves que NÃO podem aparecer
 */
async function check(definition, view, keys, { actor = ADMIN, absent = [], tag = '' } = {}) {
  const where = `${definition.id} › ${view.id} [${tag}] ${actor.role}`;
  const vm = await run(definition, typedViewSelection(definition, view, { [view.id]: keys }), actor);
  // view model
  if (view.mode === DETALHADO) assert.deepEqual(vm.columns.map((column) => column.id), keys, `${where}: colunas no view model, na ordem`);
  else assert.deepEqual(columnKeysOf(view, definition, { aggregates: vm.aggregates }), keys, `${where}: totais no view model, na ordem`);
  const defaults = typeColumnOptions(definition, view, actor.role).filter((option) => option.default).map((option) => option.key);
  assert.equal(vm.columnsChosen, keys.join('|') !== defaults.join('|'), `${where}: escolha ≠ padrão`);
  // folha (como a tela abre: sem "Mostrar colunas vazias"), com Mostrar Detalhes no desenho de venda
  const doc = buildReportDocument(vm, { showDetails: true });
  const expected = [...(view.mode === RESUMIDO ? [LABEL_COLUMN_KEY] : []), ...keys.map((key) => sheetKeyOf(definition, view, key))];
  if (!vm.rowCount) return vm;
  assert.deepEqual(sheetColumns(doc).map((column) => column.key), expected, `${where}: colunas da folha, na ordem${doc.hiddenColumns.length ? ` (ocultas: ${doc.hiddenColumns.map((column) => column.key)})` : ''}`);
  for (const key of absent) assert.ok(!sheetColumns(doc).some((column) => column.key === sheetKeyOf(definition, view, key)), `${where}: ${key} desmarcada não está na folha`);
  for (const column of sheetColumns(doc)) assert.ok(column.label && !BROKEN.test(column.label), `${where}: cabeçalho de ${column.key} = "${column.label}"`);
  if (isVendasDoc(doc)) {
    for (const item of doc.vendas.grupos.items) for (const row of item.rows) {
      assert.deepEqual(row.cells.map((cell) => cell.key), expected, `${where}: detalhe de venda alinhado`);
      for (const cell of row.cells) assert.ok(!BROKEN.test(cell.text), `${where}: ${cell.key} = "${cell.text}"`);
    }
  } else {
    for (const row of documentRows(doc)) {
      if (!row.cells) continue;
      assert.deepEqual(row.cells.map((cell) => [cell.col, cell.key]), doc.columns.map((column, index) => [index, column.key]), `${where}: linha ${row.id} alinhada (data-col/data-key)`);
      for (const cell of row.cells) assert.ok(!BROKEN.test(cell.text), `${where}: ${cell.key} = "${cell.text}" (linha ${row.id})`);
    }
    const html = renderSheetBody(doc);
    const heads = [...html.matchAll(/<th data-col="(\d+)" data-key="([^"]*)"/g)].map((match) => [Number(match[1]), match[2]]);
    for (const [index, key] of doc.columns.map((column, i) => [i, column.key])) assert.ok(heads.some(([col, k]) => col === index && k === key.replace(/&/g, '&amp;')), `${where}: <th> de ${key}`);
    for (const match of html.matchAll(/<td data-col="(\d+)" data-key="([^"]*)"/g)) assert.equal(match[2], doc.columns[Number(match[1])].key.replace(/&/g, '&amp;'), `${where}: <td> sob o cabeçalho da sua coluna`);
  }
  // XLSX e CSV: cabeçalhos na ordem escolhida (Resumido: um por métrica — o par são as duas)
  const labels = view.mode === DETALHADO ? vm.columns.map((column) => column.label) : summaryMetrics(vm).map((metric) => metric.label);
  const xlsx = buildSheetRows(vm).dataHeaders;
  const positions = labels.map((label) => xlsx.findIndex((header) => header === label || header.startsWith(`${label} (`) || header === `${label}`));
  assert.ok(positions.every((position) => position >= 0), `${where}: XLSX com ${labels.filter((_, i) => positions[i] < 0).join(', ')} (${xlsx.join(' | ')})`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${where}: XLSX na ordem escolhida`);
  if (!isVendasDoc(doc)) {
    const csv = parseCsv(buildCsv(vm))[0].map(unquote);
    const csvPositions = labels.map((label) => csv.findIndex((header) => header === label || header.startsWith(`${label} (`)));
    assert.ok(csvPositions.every((position) => position >= 0), `${where}: CSV com todas as colunas escolhidas`);
    assert.deepEqual([...csvPositions].sort((a, b) => a - b), csvPositions, `${where}: CSV na ordem escolhida`);
  }
  resumo.combinacoes += 1;
  return vm;
}

for (const definition of withTypes) {
  const report = { tipos: 0, opcoes: 0 };
  for (const view of listReportViews(definition).filter((item) => item.columnChoices)) {
    report.tipos += 1;
    const options = typeColumnOptions(definition, view, 'ADMIN');
    const all = options.map((option) => option.key);
    const defaults = options.filter((option) => option.default).map((option) => option.key);
    for (const option of options) {
      report.opcoes += 1;
      // sozinha (e o rótulo dela é o mesmo sozinha e com todas)
      const alone = await check(definition, view, [option.key], { tag: `só ${option.key}` });
      if (view.mode === RESUMIDO && !pairOf(definition, option.key)) assert.equal(summaryMetrics(alone).find((metric) => metric.key === option.key)?.label, option.label, `NEGATIVO antigo: ${definition.id} › ${view.id}: rótulo de ${option.key} sozinha = o do seletor (Romaneio dizia "Cabeças" × "Saídas")`);
      if (view.mode === DETALHADO) assert.equal(headerLabel(alone.columns[0]), option.label, `${definition.id} › ${view.id}: rótulo de ${option.key} = o do seletor (grade, XLSX e CSV)`);
    }
    // desmarcar: padrão menos cada opção do padrão
    for (const key of defaults) {
      const rest = defaults.filter((item) => item !== key);
      if (rest.length) await check(definition, view, rest, { tag: `sem ${key}`, absent: [key] });
    }
    // ordem: todas, invertidas
    const reversed = [...all].reverse();
    const vm = await check(definition, view, reversed, { tag: 'todas invertidas' });
    if (view.mode === RESUMIDO) {
      const withAll = summaryMetrics(vm);
      for (const option of options) if (!pairOf(definition, option.key)) assert.equal(withAll.find((metric) => metric.key === option.key)?.label, option.label, `${definition.id} › ${view.id}: rótulo de ${option.key} com todas = o do seletor`);
    }
    // perfis sem valor comercial: cada opção que eles veem roda e aparece
    for (const actor of [OPERADOR, CONSULTA].filter((item) => canRunReport(definition, item.role))) {
      for (const option of typeColumnOptions(definition, view, actor.role)) await check(definition, view, [option.key], { actor, tag: `só ${option.key}` });
    }
  }
  resumo.relatorios[definition.id] = report;
}
ok('cada-opcao-sozinha-desmarcar-ordem-em-todos-os-canais');
ok('rotulo-do-seletor-igual-na-folha-e-no-xlsx');

// ---------------------------------------------------------------------------------------------------------
// 5. Coluna escolhida sem valor aparece ("-"); no padrão a vazia some (E1C)
// ---------------------------------------------------------------------------------------------------------
const soCadastros = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-08-12' } };
const PESAGENS = getReportDefinition('pesagens');
const pview = (id) => listReportViews(PESAGENS).find((view) => view.id === id);
// Pesagens › Analítico só com cadastros no período: Peso anterior não tem valor em linha nenhuma.
const analiticoVazio = await run(PESAGENS, typedViewSelection(PESAGENS, pview('analitico'), { analitico: ['data_pesagem', 'numero_animal', 'peso', 'peso_anterior'] }), ADMIN, soCadastros);
assert.ok(analiticoVazio.rowCount > 0 && analiticoVazio.rows.every((row) => analiticoVazio.resolve('peso_anterior').valueOf(row) == null), 'controle: Peso anterior sem valor no período');
const docAnalitico = buildReportDocument(analiticoVazio);
assert.ok(docAnalitico.columns.some((column) => column.key === 'peso_anterior'), 'NEGATIVO antigo: Peso anterior escolhido e sem valor continua na folha (antes sumia)');
assert.ok(documentRows(docAnalitico).filter((row) => row.type === 'DATA').every((row) => row.cells.find((cell) => cell.key === 'peso_anterior').text === MAK_MISSING), 'sem valor = "-"');
// Resumo por Data com Ganho total (sem pesagem anterior no período) + tirando Machos.
const resumoKeys = ['qtd', 'peso_medio', 'ganho_total', 'dias_medios', 'femeas'];
const resumoVazio = buildReportDocument(await run(PESAGENS, typedViewSelection(PESAGENS, pview('por-apartacao-data'), { 'por-apartacao-data': resumoKeys }), ADMIN, soCadastros));
assert.deepEqual(resumoVazio.columns.map((column) => column.key), [LABEL_COLUMN_KEY, ...resumoKeys], 'NEGATIVO antigo: Ganho Total e Dias Médios escolhidos continuam na folha (antes sumiam)');
// Rebanho › Analítico (tipo lista): Data da saída (todos ativos) escolhida.
const REBANHO = getReportDefinition('rebanho.atual');
const rview = listReportViews(REBANHO).find((view) => view.id === 'analitico');
const rebanhoVazio = await run(REBANHO, typedViewSelection(REBANHO, rview, { analitico: [...rview.columns, 'data_saida'] }));
assert.ok(buildReportDocument(rebanhoVazio).columns.some((column) => column.key === 'data_saida'), 'NEGATIVO antigo: Data da saída escolhida (todos ativos) na folha');
// Padrão do tipo: a coluna vazia continua sumindo; "Mostrar colunas vazias" traz de volta.
const padraoVazio = await run(PESAGENS, viewSelection('analitico', PESAGENS), ADMIN, soCadastros);
assert.equal(padraoVazio.columnsChosen, false);
const hiddenPadrao = buildReportDocument(padraoVazio).hiddenColumns.map((column) => column.key);
assert.ok(['dias', 'ganho', 'gmd'].every((key) => hiddenPadrao.includes(key)), `padrão do tipo: Dias, Ganho e GMD sem valor somem (E1C) — ${hiddenPadrao}`);
assert.deepEqual(buildReportDocument(padraoVazio, { showEmptyColumns: true }).hiddenColumns, [], '"Mostrar colunas vazias" traz de volta');
// Voltar ao padrão pelo seletor (mesmas chaves do padrão) = padrão (as vazias somem de novo).
const devolta = await run(PESAGENS, typedViewSelection(PESAGENS, pview('analitico'), { analitico: [...pview('analitico').columnChoices.defaults] }), ADMIN, soCadastros);
assert.equal(devolta.columnsChosen, false, 'escolha igual ao padrão = padrão');
ok('escolhida-vazia-aparece-padrao-vazia-some');

// ---------------------------------------------------------------------------------------------------------
// 7. A escolha grava e volta, por tipo e usuário; último estado reabre no tipo com as colunas
// ---------------------------------------------------------------------------------------------------------
let gravados = 0;
for (const definition of withTypes) {
  const typed = listReportViews(definition).filter((view) => view.columnChoices);
  for (const view of typed) {
    const options = typeColumnOptions(definition, view, 'ADMIN').map((option) => option.key);
    const keys = [...options].reverse().slice(0, Math.max(1, Math.min(options.length - 1, 6)));
    assert.deepEqual(await saveTypeColumnPrefs(definition.id, view.id, keys, ADMIN), keys, `${definition.id} › ${view.id}: grava na ordem`);
    const prefs = await getTypeColumnPrefs(definition.id, ADMIN);
    assert.deepEqual(prefs[view.id], keys, `${definition.id} › ${view.id}: relida`);
    const selection = typedViewSelection(definition, view, prefs);
    assert.deepEqual(columnKeysOf(view, definition, selection), keys, `${definition.id} › ${view.id}: aplicada ao abrir o tipo`);
    // não vaza para outro tipo
    for (const other of typed.filter((item) => item.id !== view.id && !prefs[item.id])) {
      assert.deepEqual(columnKeysOf(other, definition, typedViewSelection(definition, other, prefs)), other.columnChoices.defaults.filter((key) => typeColumnOptions(definition, other, 'ADMIN').some((option) => option.key === key)), `NEGATIVO: a escolha de ${view.id} não vale em ${other.id}`);
    }
    assert.deepEqual(await getTypeColumnPrefs(definition.id, GESTOR), {}, `${definition.id}: outro usuário não herda`);
    // último estado (tela → serviço → tela)
    const state = { ...selection, params: paramsOf(definition), uiFilters: {}, search: '', widths: {}, orientation: 'auto', showEmptyColumns: false };
    await saveReportViewState(definition.id, viewStatePayload(definition, state, 'ADMIN'), ADMIN);
    const reopened = stateFromRequest(definition, await getReportViewState(definition.id, ADMIN));
    assert.equal(reopened.view, view.id, `${definition.id} › ${view.id}: último estado reabre no tipo`);
    assert.deepEqual(columnKeysOf(view, definition, reopened), keys, `${definition.id} › ${view.id}: último estado com as colunas escolhidas`);
    gravados += 1;
  }
  for (const view of typed) await saveTypeColumnPrefs(definition.id, view.id, [], ADMIN);
  assert.deepEqual(await getTypeColumnPrefs(definition.id, ADMIN), {}, `${definition.id}: lista vazia volta ao padrão`);
}
// NEGATIVO: CONSULTA não grava coluna de valor (Pesagens › Vendas) — e o que grava é só o que vê.
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'vendas', ['comprador', 'valor_venda_calc', 'peso'], CONSULTA), ['comprador', 'peso'], 'NEGATIVO: CONSULTA sem Valor Total');
resumo.tiposGravados = gravados;
ok('escolha-grava-e-volta-por-tipo-e-usuario');

// ---------------------------------------------------------------------------------------------------------
// 8. "Colunas" genérico: Personalizado (sem tipo) e detalhe de um grupo
// ---------------------------------------------------------------------------------------------------------
const personalizado = await run(PESAGENS, { view: null, mode: DETALHADO, groups: [], columns: ['data_pesagem', 'numero_animal', 'compra_gta', 'peso'] });
assert.equal(personalizado.view, null);
assert.equal(personalizado.columnsChosen, true, 'Personalizado com coluna acrescentada = escolha');
const docPersonalizado = buildReportDocument(personalizado);
assert.deepEqual(docPersonalizado.columns.map((column) => column.key), ['data_pesagem', 'numero_animal', 'compra_gta', 'peso'], 'Personalizado: coluna acrescentada na folha, na ordem');
assert.ok(buildSheetRows(personalizado).dataHeaders.includes('GTA compra') && parseCsv(buildCsv(personalizado))[0].includes('GTA compra'), 'Personalizado: XLSX e CSV');
const padraoPersonalizado = await run(PESAGENS, { view: null, mode: DETALHADO, groups: [] });
assert.equal(padraoPersonalizado.columnsChosen, false, 'Personalizado com as colunas do relatório = padrão');
// Detalhe de um grupo do Resumido (clique na folha): as colunas de dados que a pessoa pôs.
const resumoData = await run(PESAGENS, viewSelection('por-apartacao-data', PESAGENS));
const grupo = resumoData.summaryRows[0];
const detalhe = await run(PESAGENS, { ...viewSelection('por-apartacao-data', PESAGENS), mode: DETALHADO, drill: [{ columnId: grupo.columnId, key: grupo.key }], columns: ['numero_animal', 'peso', 'origem_animal'] });
assert.equal(detalhe.mode, DETALHADO);
assert.deepEqual(buildReportDocument(detalhe).columns.map((column) => column.key), ['numero_animal', 'peso', 'origem_animal'], 'detalhe de grupo: colunas escolhidas na folha, mesmo vazia (Origem)');
ok('colunas-generico');

await resetDb();
resumo.ok = true;
console.log(JSON.stringify(resumo, null, 2));
