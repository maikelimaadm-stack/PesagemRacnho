// Gate reports:comercial:verify (E1E) — o relatório "Comercial" com os tipos Vendas, Abates e Compras, todos no desenho
// do relatório de venda do MAKGESTAO (PDF da W3; docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md, item 5):
//   1. declaração: uma definição, 3 tipos (ids, rótulos, ordem, padrão Vendas), sheetLayout validado, população fixa
//      por tipo; os 3 relatórios antigos saíram do catálogo e viraram aliases de tipo;
//   2. população de cada tipo conferida à mão (e os negativos: manejo, morte, fora do período, cadastro sem valor,
//      venda × abate); filtro da pessoa só restringe; nenhum controle amplia;
//   3. contas conferidas à mão, bloco a bloco (Métrica | Valor, por marca, pelo grupo, cartões, TOTAL GERAL):
//      Vendas = as de Pesagens › Vendas (mesmos blocos, texto a texto); Abates = @ de carcaça, rendimento ponderado
//      pelo peso, Valor @ ponderado pela @ de carcaça e SÓ o valor do abate digitado; Compras = valor por cabeça;
//   4. permissão: só com commercial.values (OPERADOR e CONSULTA nem abrem, nem pelo id antigo, nem por modelo);
//   5. aliases e preferências antigas: comercial.vendas/abates/compras abrem no tipo (serviço e tela); modelos,
//      favoritos, recentes e último estado convertidos UMA vez, com auditoria "relatorios-comercial-e1e"; modelo com
//      agrupamento próprio abre "Personalizado" com a população do tipo fixa;
//   6. paridade folha × XLSX nos 3 tipos (blocos e lançamentos), CSV com os rótulos do tipo.
// Massa: o fixture comum (A2 vendido à Frigo Sul) + vendas, abates e compras deste gate, pela cadeia oficial.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { listReports, runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { buildInitialReportState } from '../src/modules/reporting/application/reportInitialState.js';
import {
  COMERCIAL_MIGRATION_ORIGIN, PREFERENCES_MIGRATION_ORIGIN, getFavorites, getRecents, getReportViewState, listTemplates, migrateReportPreferences, parseFavoriteKey, saveTemplate, templateToRequest,
} from '../src/modules/reporting/application/reportTemplateService.js';
import { COMERCIAL, COMERCIAL_VIEW_IDS } from '../src/modules/reporting/definitions/comercial.js';
import { getLegacyAlias } from '../src/modules/reporting/definitions/legacyAliases.js';
import { getReportDefinition, isLegacyReportId, listAllReportDefinitions, listReportDefinitions, resolveReportId } from '../src/modules/reporting/definitions/reportCatalog.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { SHEET_LAYOUT_GROUPS, defineReport } from '../src/modules/reporting/domain/reportDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { getReportView, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildReportDocument } from '../src/modules/reporting/domain/reportDocument.js';
import { roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { NONE_GROUP_LABEL } from '../src/modules/reporting/domain/groupEngine.js';
import { ABATES_BLOCK_TOTALS, COMPRAS_BLOCK_TOTALS, VENDAS_BLOCK_TOTALS, VENDAS_MISSING, buildVendasBlocks, isVendasViewModel } from '../src/modules/reporting/domain/vendasLayout.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { XLSX_VENDAS_KINDS } from '../src/modules/reporting/infrastructure/exporters/vendasXlsx.js';
import { buildSheetRows, unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';

const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const near = (actual, expected, message) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
const spaces = (text) => String(text ?? '').replace(/\s/g, ' ');
const plain = (value) => JSON.parse(JSON.stringify(value));
// Texto da folha: "1.970,00", "R$ 14.800,00", "51,92 %"; sem valor "-".
const folha = (value, decimals, kind = null) => {
  if (value === null) return VENDAS_MISSING;
  const [inteiro, fracao] = roundTo(value, decimals).toFixed(decimals).split('.');
  const texto = `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fracao ? `,${fracao}` : ''}`;
  return kind === 'R$' ? `R$ ${texto}` : kind === '%' ? `${texto} %` : texto;
};
const numberOf = (text) => (spaces(text) === VENDAS_MISSING ? null : Number(spaces(text).replace('R$', '').replace('%', '').replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')));
const textos = (items) => items.map((item) => spaces(item.text));
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

// ---------------------------------------------------------------------------------------------------
// 1. Declaração
// ---------------------------------------------------------------------------------------------------
const definition = getReportDefinition('comercial');
assert.equal(definition, COMERCIAL);
assert.deepEqual([definition.family, definition.title, definition.grain, definition.source], ['comercial', 'Comercial', GRAINS.EVENT, 'events.byPeriod'], 'uma definição: família comercial, "Comercial", grão EVENT, events.byPeriod');
assert.ok(definition.requires.includes('commercial.values'), 'exige commercial.values');
assert.deepEqual(definition.sourceOptions.tipos, ['Saída', 'Cadastro'], 'fonte só com saídas (vendas, abates) e cadastros (compras)');
assert.equal(definition.defaultView, 'vendas', 'abre em Vendas');
const views = definition.views;
assert.deepEqual(views.map((view) => [view.id, view.label]), [['vendas', 'Vendas'], ['abates', 'Abates'], ['compras', 'Compras']], 'os 3 tipos, nesta ordem');
assert.deepEqual([...COMERCIAL_VIEW_IDS], views.map((view) => view.id));
assert.ok(views.every((view) => view.mode === 'DETALHADO' && view.titleKind === 'Sintético' && view.sheetLayout === view.id), 'Detalhado, "(Sintético)" e o desenho de venda do próprio tipo');
assert.deepEqual(views.map((view) => view.groups.map((group) => group.columnId)), [['comprador'], ['frigorifico'], ['origem_animal']], 'por comprador, frigorífico e origem');
assert.deepEqual({ ...SHEET_LAYOUT_GROUPS }, { vendas: 'comprador', abates: 'frigorifico', compras: 'origem_animal' });
assert.deepEqual(plain(views.map((view) => view.population)), [
  { tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' }, motivo_saida: { operator: 'in', values: ['Venda'], match: 'code' } },
  { tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' }, motivo_saida: { operator: 'in', values: ['Abate'], match: 'code' } },
  { tipo_manejo: { operator: 'in', values: ['Cadastro'], match: 'code' }, valor_pago_cabeca: { operator: 'not_empty' } },
], 'população fixa de cada tipo = a dos relatórios antigos (Vendas, Abates e Compras do período)');
assert.deepEqual(views.map((view) => view.aggregates.map((spec) => spec.id)), [VENDAS_BLOCK_TOTALS, ABATES_BLOCK_TOTALS, COMPRAS_BLOCK_TOTALS].map((list) => list.map((spec) => spec.id)), 'totais de cada tipo = os dos blocos');
assert.deepEqual(ABATES_BLOCK_TOTALS.map((spec) => `${spec.id}=${spec.op}:${spec.columnId}`), [
  'animais_abatidos=countDistinct:numero_animal', 'peso_total=sum:peso', 'peso_medio=avg:peso', 'rendimento_medio=weightedAvg:rendimento_carcaca',
  'arrobas_carcaca=sum:quantidade_arrobas', 'media_arroba_carcaca=avg:quantidade_arrobas', 'media_valor_arroba=weightedAvg:valor_arroba_abate', 'valor_total=sum:valor_total_abate',
], 'Abates: só colunas gravadas no lançamento (nenhuma conta nova)');
assert.deepEqual(COMPRAS_BLOCK_TOTALS.map((spec) => `${spec.id}=${spec.op}:${spec.columnId}`), [
  'animais_comprados=countDistinct:numero_animal', 'peso_total=sum:peso', 'peso_medio=avg:peso', 'valor_medio_cabeca=avg:valor_pago_cabeca', 'valor_total=sum:valor_pago_cabeca',
], 'Compras: valor pago por cabeça');
const colunaDe = (id) => definition.columns.find((column) => column.id === id);
assert.deepEqual([colunaDe('rendimento_carcaca').weightedBy, colunaDe('valor_arroba_abate').weightedBy], ['peso', 'quantidade_arrobas'], 'rendimento ponderado pelo peso; Valor @ do abate pela @ de carcaça');
assert.equal(getReportView(getReportDefinition('pesagens'), 'vendas').sheetLayout, 'vendas', 'Pesagens › Vendas declara o mesmo desenho');
// Catálogo: o Comercial no lugar dos 3; os ids antigos são aliases de tipo.
assert.ok(listReportDefinitions().some((item) => item.id === 'comercial'), 'Comercial no catálogo');
for (const [legacyId, viewId] of [['comercial.vendas', 'vendas'], ['comercial.abates', 'abates'], ['comercial.compras', 'compras']]) {
  assert.ok(!listAllReportDefinitions().some((item) => item.id === legacyId), `${legacyId}: saiu do catálogo (não é mais definição)`);
  assert.ok(isLegacyReportId(legacyId), `${legacyId}: é alias`);
  assert.equal(resolveReportId(legacyId).definition.id, 'comercial');
  assert.equal(getLegacyAlias(legacyId).view, viewId, `${legacyId} → Comercial › ${viewId}`);
  assert.deepEqual(parseFavoriteKey(legacyId), { reportId: 'comercial', presetId: legacyId });
}
// sheetLayout validado na definição (chave nova de visão).
const tipoBase = { id: 'x', label: 'X', mode: 'DETALHADO', groups: [{ columnId: 'frigorifico' }], sheetLayout: 'abates', population: { motivo_saida: { operator: 'in', values: ['Abate'] } } };
const definicao = (view) => () => defineReport({ id: 't.sheet', family: 'comercial', title: 'T', grain: GRAINS.EVENT, version: 1, source: 'events.byPeriod', requires: ['reports.read'], params: [{ id: 'periodo', type: 'period', required: true }], columns: EVENT_COLUMNS, views: [view] });
assert.doesNotThrow(definicao(tipoBase), 'sheetLayout válido');
assert.throws(definicao({ ...tipoBase, sheetLayout: 'mortes' }), /sheetLayout inválido/, 'NEGATIVO: layout desconhecido');
assert.throws(definicao({ ...tipoBase, groups: [{ columnId: 'comprador' }] }), /agrupa só por frigorifico/, 'NEGATIVO: agrupado por outra coluna');
assert.throws(definicao({ ...tipoBase, mode: 'RESUMIDO' }), /é do Detalhado/, 'NEGATIVO: desenho de venda no Resumido');
assert.throws(definicao({ ...tipoBase, population: undefined }), /exige population/, 'NEGATIVO: sem população fixa');

// ---------------------------------------------------------------------------------------------------
// 2. Massa (além de A2 → comprador Frigo Sul, 280 kg, R$ 3.000, R$ 300/@, e da morte de A3, do fixture)
// ---------------------------------------------------------------------------------------------------
await seedReportFixture();
const base = { empresa_id: 'local', status_animal: 'Ativo' };
const ALFA = { marca: 'ALFA', marca_id: 'm-alfa' };
const BETA = { marca: 'BETA', marca_id: 'm-beta' };
const bicho = (id, numero, extra = {}) => ({ ...base, animal_id: id, numero_animal: numero, sexo: 'M', ...extra });
const cadastro = (animal, id, data, peso, extra = {}) => ({ ...animal, id, tipo_manejo: 'Cadastro', data_pesagem: data, peso, ...extra });
const saida = (animal, id, motivo, data, peso, extra = {}) => ({ ...animal, id, tipo_manejo: 'Saída', motivo_saida: motivo, data_pesagem: data, peso, ...extra });
const rendimento = (peso, pct) => ({ rendimento_carcaca: pct, rendimento_origem: 'INFORMADO', peso_carcaca_estimado: (peso * pct) / 100, quantidade_arrobas: (peso * pct) / 100 / 15 });
const [d1, d2, d3, d4, d5] = [bicho('D1', '1001', ALFA), bicho('D2', '1002', BETA), bicho('D3', '1003', ALFA), bicho('D4', '1004'), bicho('D5', '1005', ALFA)];
const [e1, e2] = [bicho('E1', '2001', ALFA), bicho('E2', '2002', ALFA)];
const [c1, c2, c3, c4, c5, c6] = [bicho('C1', '3001', ALFA), bicho('C2', '3002', BETA), bicho('C3', '3003', BETA), bicho('C4', '3004'), bicho('C5', '3005', ALFA), bicho('C6', '3006', ALFA)];
const massa = [
  // Abates: [frigorífico, peso, rendimento, Valor @, valor digitado].
  cadastro(d1, 'd1c', '2026-08-01', 400), saida(d1, 'd1', 'Abate', '2026-09-05', 500, { frigorifico: 'Frigo Sul', ...rendimento(500, 52), valor_arroba_abate: 310, valor_total_abate: 5400 }),
  cadastro(d2, 'd2c', '2026-08-01', 420), saida(d2, 'd2', 'Abate', '2026-09-05', 540, { frigorifico: 'Frigo Sul', ...rendimento(540, 50), valor_arroba_abate: 300, valor_total_abate: 5400 }),
  // Sem valor digitado: "-" e fora da soma (nenhuma conta inventada), mas a @ de carcaça e o Valor @ contam.
  cadastro(d3, 'd3c', '2026-08-02', 380), saida(d3, 'd3', 'Abate', '2026-09-10', 480, { frigorifico: 'Frigorífico Norte', ...rendimento(480, 54), valor_arroba_abate: 305 }),
  // Sem rendimento: sem @ de carcaça (o Valor @ dele não entra na média ponderada); frigorífico em branco.
  cadastro(d4, 'd4c', '2026-08-02', 360), saida(d4, 'd4', 'Abate', '2026-09-12', 450, { frigorifico: '  ', valor_arroba_abate: 300, valor_total_abate: 4000 }),
  // NEGATIVO: abate fora do período.
  cadastro(d5, 'd5c', '2026-07-01', 350), saida(d5, 'd5', 'Abate', '2026-07-25', 470, { frigorifico: 'Frigo Sul', valor_total_abate: 5000 }),
  // Vendas (com e6 do fixture): E1 sem valor digitado (450 ÷ 30 × 300 = 4.500); E2 com valor digitado (7.000).
  cadastro(e1, 'e1c', '2026-08-04', 400), saida(e1, 'v1', 'Venda', '2026-09-08', 450, { comprador: 'W3', valor_arroba: 300 }),
  cadastro(e2, 'e2c', '2026-08-04', 420), saida(e2, 'v2', 'Venda', '2026-09-09', 480, { comprador: 'W3', valor_venda_total: 7000, valor_arroba: 290 }),
  // Compras: [origem, marca, peso, valor pago por cabeça].
  cadastro(c1, 'k1', '2026-08-03', 300, { origem_animal: 'Fazenda Boa Esperança', valor_pago_cabeca: 2400 }),
  cadastro(c2, 'k2', '2026-08-03', 320, { origem_animal: 'Fazenda Boa Esperança', valor_pago_cabeca: 2600 }),
  cadastro(c3, 'k3', '2026-08-10', 280, { origem_animal: 'Leilão Central', valor_pago_cabeca: 2100 }),
  cadastro(c4, 'k4', '2026-08-12', 250, { valor_pago_cabeca: 1900 }),
  // NEGATIVOS: cadastro sem valor pago; compra fora do período; manejo depois da compra.
  cadastro(c5, 'k5', '2026-08-12', 260, { origem_animal: 'Leilão Central' }),
  cadastro(c6, 'k6', '2026-07-10', 270, { origem_animal: 'Leilão Central', valor_pago_cabeca: 2000 }),
  { ...c1, id: 'k1m', tipo_manejo: 'Manejo', data_pesagem: '2026-09-01', peso: 330 },
];
for (const entry of massa) await weighingService.createEntry(entry);

// Conta à mão (independente do motor).
const ABATES = [
  // [id, frigorífico, marca, peso, rendimento, Valor @, valor digitado]
  ['d1', 'Frigo Sul', 'ALFA', 500, 52, 310, 5400],
  ['d2', 'Frigo Sul', 'BETA', 540, 50, 300, 5400],
  ['d3', 'Frigorífico Norte', 'ALFA', 480, 54, 305, null],
  ['d4', NONE_GROUP_LABEL, NONE_GROUP_LABEL, 450, null, 300, 4000],
];
const abatesNaMao = (lista) => {
  const peso = lista.reduce((soma, item) => soma + item[3], 0);
  const comRend = lista.filter((item) => item[4] !== null);
  const arroba = (item) => (item[3] * item[4]) / 100 / 15;
  const arrobas = comRend.reduce((soma, item) => soma + arroba(item), 0);
  const valores = lista.filter((item) => item[6] !== null);
  return {
    ids: lista.map((item) => item[0]).sort(),
    animais_abatidos: lista.length,
    peso_total: peso,
    peso_medio: peso / lista.length,
    rendimento_medio: comRend.length ? comRend.reduce((soma, item) => soma + item[4] * item[3], 0) / comRend.reduce((soma, item) => soma + item[3], 0) : null,
    arrobas_carcaca: comRend.length ? arrobas : null,
    media_arroba_carcaca: comRend.length ? arrobas / comRend.length : null,
    media_valor_arroba: comRend.length ? comRend.reduce((soma, item) => soma + item[5] * arroba(item), 0) / arrobas : null,
    valor_total: valores.length ? valores.reduce((soma, item) => soma + item[6], 0) : null,
  };
};
const COMPRAS = [
  // [id, origem, marca, peso, valor pago]
  ['k1', 'Fazenda Boa Esperança', 'ALFA', 300, 2400],
  ['k2', 'Fazenda Boa Esperança', 'BETA', 320, 2600],
  ['k3', 'Leilão Central', 'BETA', 280, 2100],
  ['k4', NONE_GROUP_LABEL, NONE_GROUP_LABEL, 250, 1900],
];
const comprasNaMao = (lista) => {
  const peso = lista.reduce((soma, item) => soma + item[3], 0);
  const valor = lista.reduce((soma, item) => soma + item[4], 0);
  return { ids: lista.map((item) => item[0]).sort(), animais_comprados: lista.length, peso_total: peso, peso_medio: peso / lista.length, valor_medio_cabeca: valor / lista.length, valor_total: valor };
};
const VENDAS = [
  // [id, comprador, marca, peso, valor digitado, Valor @]
  ['e6', 'Frigo Sul', 'BETA', 280, 3000, 300],
  ['v1', 'W3', 'ALFA', 450, null, 300],
  ['v2', 'W3', 'ALFA', 480, 7000, 290],
];
const vendasNaMao = (lista) => {
  const peso = lista.reduce((soma, item) => soma + item[3], 0);
  const valor = (item) => item[4] ?? (item[3] / 30) * item[5];
  return {
    ids: lista.map((item) => item[0]).sort(), animais_vendidos: lista.length, peso_total: peso, peso_medio: peso / lista.length, media_arroba: peso / 30 / lista.length,
    media_valor_arroba: lista.reduce((soma, item) => soma + (item[3] / 30) * item[5], 0) / (peso / 30), valor_total: lista.reduce((soma, item) => soma + valor(item), 0),
  };
};
const porChave = (lista, index, chaves, conta) => chaves.map((chave) => ({ chave, ...conta(lista.filter((item) => item[index] === chave)) }));
near(abatesNaMao(ABATES).valor_total, 14800, 'à mão: 5.400 + 5.400 + 4.000 (o abate sem valor digitado fica fora)');
near(abatesNaMao(ABATES).rendimento_medio, 78920 / 1520, 'à mão: (52×500 + 50×540 + 54×480) ÷ 1.520 kg');
near(abatesNaMao(ABATES).arrobas_carcaca, 260 / 15 + 18 + 17.28, 'à mão: 17,33 + 18 + 17,28 @ de carcaça');
near(comprasNaMao(COMPRAS).valor_total, 9000, 'à mão: 2.400 + 2.600 + 2.100 + 1.900');
near(vendasNaMao(VENDAS).valor_total, 14500, 'à mão: 3.000 + 450 ÷ 30 × 300 + 7.000');

// ---------------------------------------------------------------------------------------------------
// 3. População de cada tipo; filtro da pessoa só restringe
// ---------------------------------------------------------------------------------------------------
const run = (view, selection = {}, request = {}, actor = ADMIN) => runReport('comercial', { today: TODAY, params: period, ...request, selection: { view, ...selection } }, actor);
const idsOf = (vm) => vm.rows.map((row) => row.id).sort();
const vms = { vendas: await run('vendas'), abates: await run('abates'), compras: await run('compras') };
assert.deepEqual(idsOf(vms.abates), abatesNaMao(ABATES).ids, 'Abates: os 4 abates do período');
assert.deepEqual(idsOf(vms.compras), comprasNaMao(COMPRAS).ids, 'Compras: os 4 cadastros com valor pago');
assert.deepEqual(idsOf(vms.vendas), vendasNaMao(VENDAS).ids, 'Vendas: as 3 vendas do período');
for (const fora of ['d5', 'e8', 'v1', 'e6', 'd1c']) assert.ok(!idsOf(vms.abates).includes(fora), `NEGATIVO Abates: ${fora} fora (fora do período, morte, venda, cadastro)`);
for (const fora of ['k5', 'k6', 'k1m', 'e1', 'd1c', 'd1']) assert.ok(!idsOf(vms.compras).includes(fora), `NEGATIVO Compras: ${fora} fora (sem valor, fora do período, manejo, cadastro sem valor, abate)`);
for (const fora of ['d1', 'd4', 'e8', 'k1']) assert.ok(!idsOf(vms.vendas).includes(fora), `NEGATIVO Vendas: ${fora} fora`);
for (const [view, keys] of [['vendas', ['motivo_saida', 'tipo_manejo']], ['abates', ['motivo_saida', 'tipo_manejo']], ['compras', ['tipo_manejo', 'valor_pago_cabeca']]]) {
  const vm = vms[view];
  assert.deepEqual(Object.keys(vm.lockedFilters).sort(), keys, `${view}: condição fixa do tipo`);
  assert.deepEqual([vm.view.id, vm.view.sheetLayout, vm.mode], [view, view, 'DETALHADO'], `${view}: view model leva o tipo e o desenho`);
  assert.equal(isVendasViewModel(vm), true, `${view}: vai para o desenho de venda`);
  assert.equal((await run(view, { mode: 'RESUMIDO' })).mode, 'DETALHADO', `${view}: o modo é o do tipo`);
}
// Filtro da pessoa só restringe; filtro na coluna da condição não amplia.
assert.deepEqual(idsOf(await run('abates', { filters: { peso: { operator: 'greater', value: '490' } } })), ['d1', 'd2'], 'Abates: peso > 490 restringe');
assert.equal((await run('abates', { filters: { motivo_saida: { operator: 'in', values: ['Abate', 'Venda', 'Morte'], match: 'label' } } })).rowCount, 4, 'NEGATIVO Abates: filtro com mais motivos não amplia');
assert.deepEqual(idsOf(await run('abates', { fixedFilters: { motivo_saida: { operator: 'in', values: ['Venda'] } } })), abatesNaMao(ABATES).ids, 'NEGATIVO: condição de modelo na mesma coluna não troca a do tipo');
assert.equal((await run('compras', { filters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Manejo', 'Saída'], match: 'label' } } })).rowCount, 4, 'NEGATIVO Compras: filtro de tipo não amplia');
assert.match(await code(() => run('abates', { groups: [{ columnId: 'comprador' }] })), /agrupa por frigorifico/, 'NEGATIVO: outro agrupamento não é o tipo Abates');
// Sem tipo ("Personalizado", pelo serviço): a população sai do tipo — por isso a tela leva a condição junto (E1D).
const semTipo = await runReport('comercial', { today: TODAY, params: period, selection: { view: null } }, ADMIN);
assert.ok(semTipo.rows.every((row) => ['Saída', 'Cadastro'].includes(row.tipo_manejo)), 'sem tipo: só saídas e cadastros (a fonte)');
assert.equal(isVendasViewModel(semTipo), false, 'sem tipo: folha comum');

// ---------------------------------------------------------------------------------------------------
// 4. Contas conferidas à mão, bloco a bloco
// ---------------------------------------------------------------------------------------------------
const FRIGORIFICOS = ['Frigo Sul', 'Frigorífico Norte', NONE_GROUP_LABEL];
const MARCAS = ['ALFA', 'BETA', NONE_GROUP_LABEL];
const ORIGENS = ['Fazenda Boa Esperança', 'Leilão Central', NONE_GROUP_LABEL];
const blocosAbates = buildReportDocument(vms.abates).vendas;
const contaAbates = abatesNaMao(ABATES);
const linhaAbate = (conta) => [String(conta.animais_abatidos), folha(conta.peso_total, 2), folha(conta.peso_medio, 2), folha(conta.rendimento_medio, 2, '%'), folha(conta.arrobas_carcaca, 2), folha(conta.media_arroba_carcaca, 2), folha(conta.media_valor_arroba, 2, 'R$'), folha(conta.valor_total, 2, 'R$')];
assert.equal(blocosAbates.layout, 'abates');
assert.deepEqual(blocosAbates.resumo.rows.map((row) => row.label), ['Animais abatidos', 'Peso total (kg)', 'Peso médio (kg)', 'Rendimento médio', 'Total @ carcaça', 'Média @ carcaça', 'Média valor da arroba', 'Valor total'], 'Abates: Métrica | Valor');
assert.deepEqual(textos(blocosAbates.resumo.rows), linhaAbate(contaAbates), 'Abates: Métrica | Valor à mão');
assert.deepEqual(textos(blocosAbates.resumo.rows), ['4', '1.970,00', '492,50', '51,92 %', '52,61', '17,54', 'R$ 304,94', 'R$ 14.800,00'], 'Abates: os números');
assert.deepEqual(blocosAbates.porMarca.columns.map((column) => column.label), ['Marca', 'Qtd', 'Peso Total (kg)', 'Peso Médio (kg)', 'Total @ Carcaça', 'Média Valor @', 'Valor Total']);
assert.deepEqual(blocosAbates.porMarca.rows.map((row) => [row.label, ...textos(row.cells)]), porChave(ABATES, 2, MARCAS, abatesNaMao).map((grupo) => [grupo.chave, String(grupo.animais_abatidos), folha(grupo.peso_total, 2), folha(grupo.peso_medio, 2), folha(grupo.arrobas_carcaca, 2), folha(grupo.media_valor_arroba, 2, 'R$'), folha(grupo.valor_total, 2, 'R$')]), 'Abates: TOTAIS POR MARCA à mão');
assert.equal(blocosAbates.porGrupo.title, 'TOTAIS POR FRIGORÍFICO');
assert.deepEqual(blocosAbates.porGrupo.columns.map((column) => column.label), ['Frigorífico', 'Qtd', 'Peso Total (kg)', 'Total @ Carcaça', 'Valor Total']);
const porFrigorifico = porChave(ABATES, 1, FRIGORIFICOS, abatesNaMao);
assert.deepEqual(blocosAbates.porGrupo.rows.map((row) => [row.label, ...textos(row.cells)]), porFrigorifico.map((grupo) => [grupo.chave, String(grupo.animais_abatidos), folha(grupo.peso_total, 2), folha(grupo.arrobas_carcaca, 2), folha(grupo.valor_total, 2, 'R$')]), 'Abates: TOTAIS POR FRIGORÍFICO à mão ("Não informado" por último)');
assert.deepEqual(textos(blocosAbates.porGrupo.rows[1].cells), ['1', '480,00', '17,28', VENDAS_MISSING], 'Frigorífico Norte: sem valor digitado → "-" (não 0, não @ × Valor @)');
assert.deepEqual(textos(blocosAbates.porGrupo.rows[2].cells), ['1', '450,00', VENDAS_MISSING, 'R$ 4.000,00'], 'sem rendimento: sem @ de carcaça');
assert.equal(blocosAbates.grupos.title, 'ABATES POR FRIGORÍFICO (DETALHADO)');
assert.deepEqual(blocosAbates.grupos.items.map((item) => item.title), FRIGORIFICOS.map((nome) => `FRIGORÍFICO: ${nome.toLocaleUpperCase('pt-BR')}`), 'um cartão por frigorífico');
blocosAbates.grupos.items.forEach((item, index) => {
  const grupo = porFrigorifico[index];
  assert.deepEqual(item.totals.map((total) => `${total.label}: ${spaces(total.display)}`), [
    `Total: ${grupo.animais_abatidos} ${grupo.animais_abatidos === 1 ? 'animal' : 'animais'}`, `Peso Médio: ${folha(grupo.peso_medio, 2)} kg`, `Peso Total: ${folha(grupo.peso_total, 2)} kg`,
    `Rendimento Médio: ${folha(grupo.rendimento_medio, 2, '%')}`, `Total @ Carcaça: ${folha(grupo.arrobas_carcaca, 2)}`, `Valor Total: ${folha(grupo.valor_total, 2, 'R$')}`,
  ], `cartão ${grupo.chave} à mão`);
});
assert.equal(spaces(blocosAbates.totalGeral.text), 'TOTAL GERAL: 4 animais | Peso Total: 1.970,00 kg | Peso Médio: 492,50 kg | Total @ Carcaça: 52,61 | Valor Total: R$ 14.800,00', 'Abates: TOTAL GERAL à mão');
// Média valor da arroba ponderada pela @ de carcaça ≠ média simples dos Valor @ (o d4 sem rendimento fica fora).
assert.notEqual(textos(blocosAbates.resumo.rows)[6], folha((310 + 300 + 305 + 300) / 4, 2, 'R$'), 'NEGATIVO: não é a média simples');
assert.notEqual(textos(blocosAbates.resumo.rows)[7], folha(14800 + 17.28 * 305, 2, 'R$'), 'NEGATIVO: o abate sem valor digitado não vira @ × Valor @');

const blocosCompras = buildReportDocument(vms.compras).vendas;
const linhaCompra = (conta) => [String(conta.animais_comprados), folha(conta.peso_total, 2), folha(conta.peso_medio, 2), folha(conta.valor_medio_cabeca, 2, 'R$'), folha(conta.valor_total, 2, 'R$')];
assert.deepEqual(blocosCompras.resumo.rows.map((row) => row.label), ['Animais comprados', 'Peso total (kg)', 'Peso médio (kg)', 'Valor médio por cabeça', 'Valor total'], 'Compras: Métrica | Valor');
assert.deepEqual(textos(blocosCompras.resumo.rows), linhaCompra(comprasNaMao(COMPRAS)), 'Compras: Métrica | Valor à mão');
assert.deepEqual(textos(blocosCompras.resumo.rows), ['4', '1.150,00', '287,50', 'R$ 2.250,00', 'R$ 9.000,00'], 'Compras: os números');
assert.deepEqual(blocosCompras.porMarca.rows.map((row) => [row.label, ...textos(row.cells)]), porChave(COMPRAS, 2, MARCAS, comprasNaMao).map((grupo) => [grupo.chave, ...linhaCompra(grupo)]), 'Compras: TOTAIS POR MARCA à mão');
assert.equal(blocosCompras.porGrupo.title, 'TOTAIS POR ORIGEM');
const porOrigem = porChave(COMPRAS, 1, ORIGENS, comprasNaMao);
assert.deepEqual(blocosCompras.porGrupo.rows.map((row) => [row.label, ...textos(row.cells)]), porOrigem.map((grupo) => [grupo.chave, String(grupo.animais_comprados), folha(grupo.peso_total, 2), folha(grupo.valor_total, 2, 'R$')]), 'Compras: TOTAIS POR ORIGEM à mão');
assert.equal(blocosCompras.grupos.title, 'COMPRAS POR ORIGEM (DETALHADO)');
blocosCompras.grupos.items.forEach((item, index) => {
  const grupo = porOrigem[index];
  assert.equal(item.title, `ORIGEM: ${grupo.chave.toLocaleUpperCase('pt-BR')}`);
  assert.deepEqual(item.totals.map((total) => `${total.label}: ${spaces(total.display)}`), [
    `Total: ${grupo.animais_comprados} ${grupo.animais_comprados === 1 ? 'animal' : 'animais'}`, `Peso Médio: ${folha(grupo.peso_medio, 2)} kg`, `Peso Total: ${folha(grupo.peso_total, 2)} kg`,
    `Valor Médio/Cabeça: ${folha(grupo.valor_medio_cabeca, 2, 'R$')}`, `Valor Total: ${folha(grupo.valor_total, 2, 'R$')}`,
  ], `cartão ${grupo.chave} à mão`);
});
assert.equal(spaces(blocosCompras.totalGeral.text), 'TOTAL GERAL: 4 animais | Peso Total: 1.150,00 kg | Peso Médio: 287,50 kg | Valor Total: R$ 9.000,00', 'Compras: TOTAL GERAL à mão');

// Vendas do Comercial = Pesagens › Vendas (a E1D): os mesmos blocos, texto a texto, e as contas à mão.
const blocosVendas = buildReportDocument(vms.vendas).vendas;
const pesagensVendas = await runReport('pesagens', { today: TODAY, params: period, selection: { view: 'vendas' } }, ADMIN);
const semTitulo = (blocos) => plain({ ...blocos, emptyText: null });
assert.deepEqual(idsOf(vms.vendas), idsOf(pesagensVendas), 'Vendas: as mesmas linhas de Pesagens › Vendas');
assert.deepEqual(semTitulo(blocosVendas), semTitulo(buildReportDocument(pesagensVendas).vendas), 'Vendas: os mesmos blocos de Pesagens › Vendas');
const contaVendas = vendasNaMao(VENDAS);
assert.deepEqual(textos(blocosVendas.resumo.rows), [String(contaVendas.animais_vendidos), folha(contaVendas.peso_total, 2), folha(contaVendas.peso_medio, 2), folha(contaVendas.media_arroba, 2), folha(contaVendas.media_valor_arroba, 2, 'R$'), folha(contaVendas.valor_total, 2, 'R$')], 'Vendas: Métrica | Valor à mão');
assert.deepEqual(textos(blocosVendas.resumo.rows).at(-1), 'R$ 14.500,00');
assert.equal(blocosVendas.porGrupo.title, 'TOTAIS POR COMPRADOR');
// Divisor 15: a @ viva e o valor sem digitado mudam (Vendas), a @ de carcaça do abate não (÷ 15 é da carcaça).
const vendas15 = buildReportDocument(await run('vendas', {}, { arrobaDivisor: 15 })).vendas;
assert.equal(textos(vendas15.resumo.rows).at(-1), folha(3000 + (450 / 15) * 300 + 7000, 2, 'R$'), 'Vendas ÷ 15: 450 ÷ 15 × 300');
assert.deepEqual(textos(buildReportDocument(await run('abates', {}, { arrobaDivisor: 15 })).vendas.resumo.rows), textos(blocosAbates.resumo.rows), 'Abates: o divisor da @ viva não muda nada (@ de carcaça gravada)');
// Título da folha e rodapé.
const docAbates = buildReportDocument(vms.abates);
assert.equal(docAbates.title, 'Relatório de Vendas, Abates e Compras (Sintético)', 'título da folha');
assert.equal(docAbates.layout, 'vendas', 'miolo do relatório de venda (sheetHtml → vendasHtml)');
// Rodapé "@ = peso vivo ÷ N" só onde há @ viva (Vendas); Abates usa a @ de carcaça gravada, Compras não tem @.
assert.deepEqual(COMERCIAL_VIEW_IDS.map((view) => buildReportDocument(vms[view]).footer.arroba), ['@ = peso vivo ÷ 30', null, null], 'rodapé da @ viva só em Vendas');
// Folha vazia: o texto do tipo.
const vazio = { params: { periodo: { preset: 'personalizado', from: '2020-01-01', to: '2020-01-02' } } };
for (const [view, texto] of [['vendas', 'Nenhuma venda encontrada'], ['abates', 'Nenhum abate encontrado'], ['compras', 'Nenhuma compra encontrada']]) {
  assert.ok(renderSheetBody(buildReportDocument(await run(view, {}, vazio)), { mode: 'print' }).includes(`${texto} com os filtros aplicados.`), `${view} vazio: "${texto}…"`);
}
const htmlAbates = spaces(renderSheetBody(buildReportDocument(vms.abates, { showDetails: true }), { mode: 'print' }));
for (const trecho of ['data-sheet-layout="abates"', 'TOTAIS POR FRIGORÍFICO', 'ABATES POR FRIGORÍFICO (DETALHADO)', 'FRIGORÍFICO: FRIGO SUL', 'R$ 14.800,00', '<strong>Rendimento Médio:</strong>', 'class="sv-table sv-table--detail"']) assert.ok(htmlAbates.includes(trecho), `folha de Abates desenha "${trecho}"`);
assert.deepEqual([blocosVendas.emptyText, blocosAbates.emptyText, blocosCompras.emptyText], ['Nenhuma venda encontrada com os filtros aplicados.', 'Nenhum abate encontrado com os filtros aplicados.', 'Nenhuma compra encontrada com os filtros aplicados.'], 'texto da folha vazia de cada tipo (doc.vendas.emptyText)');
// Detalhe de um frigorífico (clique): o Detalhado comum.
const drill = await run('abates', { drill: [{ columnId: 'frigorifico', key: vms.abates.tree[0].key }] });
assert.deepEqual([isVendasViewModel(drill), buildReportDocument(drill).layout, idsOf(drill)], [false, 'detail', ['d1', 'd2']], 'detalhe de um frigorífico: Detalhado comum');

// ---------------------------------------------------------------------------------------------------
// 5. Permissão: só com commercial.values
// ---------------------------------------------------------------------------------------------------
for (const actor of [ADMIN, GESTOR]) {
  assert.ok(listReports(actor).some((item) => item.id === 'comercial' && item.available), `${actor.role} vê o Comercial`);
  for (const view of COMERCIAL_VIEW_IDS) assert.equal(await code(() => run(view, {}, {}, actor)), 'OK', `${actor.role} abre ${view}`);
}
for (const actor of [OPERADOR, CONSULTA]) {
  assert.ok(!listReports(actor).some((item) => item.id === 'comercial'), `${actor.role}: Comercial fora da lista`);
  for (const view of COMERCIAL_VIEW_IDS) assert.equal(await code(() => run(view, {}, {}, actor)), 'AUTH_FORBIDDEN', `NEGATIVO ${actor.role}: ${view}`);
  for (const legacyId of ['comercial.vendas', 'comercial.abates', 'comercial.compras']) assert.equal(await code(() => runReport(legacyId, { today: TODAY, params: period }, actor)), 'AUTH_FORBIDDEN', `NEGATIVO ${actor.role}: ${legacyId} (id antigo)`);
  assert.equal(await code(() => saveTemplate({ baseReportId: 'comercial', name: 'Meu', ...viewSelection('compras', definition) }, actor)), 'AUTH_FORBIDDEN', `NEGATIVO ${actor.role}: não salva modelo`);
  assert.equal(await getReportViewState('comercial', actor), null, `${actor.role}: sem último estado`);
}
// Defesa em profundidade: os blocos só levam os totais das colunas que o perfil vê (availableColumns do serviço).
const semValores = { ...vms.abates, availableColumns: vms.abates.availableColumns.filter((column) => !column.sensitive) };
const cegos = buildVendasBlocks(semValores);
assert.deepEqual(cegos.resumo.rows.map((row) => row.label), ['Animais abatidos', 'Peso total (kg)', 'Peso médio (kg)'], 'sem colunas comerciais: nenhum total de valor, @ ou rendimento');
assert.ok(!JSON.stringify(cegos).includes('R$'), 'sem colunas comerciais: nenhum R$');

// ---------------------------------------------------------------------------------------------------
// 6. Aliases e preferências antigas
// ---------------------------------------------------------------------------------------------------
const plainRows = (vm) => plain({ ids: idsOf(vm), totals: vm.totals, groups: vm.groups.map((group) => group.columnId), columns: vm.columns.map((column) => column.id), locked: vm.lockedFilters });
for (const [legacyId, view] of [['comercial.vendas', 'vendas'], ['comercial.abates', 'abates'], ['comercial.compras', 'compras']]) {
  const viaAlias = await runReport(legacyId, { today: TODAY, params: period }, ADMIN);
  assert.deepEqual([viaAlias.reportId, viaAlias.view.id, viaAlias.presetId], ['comercial', view, legacyId], `${legacyId}: abre o Comercial no tipo, registrando o id antigo`);
  assert.deepEqual(plainRows(viaAlias), plainRows(vms[view]), `${legacyId}: o mesmo resultado do tipo`);
  // Tela: favorito/link antigo (?r=comercial&v=comercial.abates) abre no tipo, com as colunas escolhidas para ele.
  const { state } = buildInitialReportState(definition, { preset: getLegacyAlias(legacyId), role: 'ADMIN', typeColumns: view === 'abates' ? { abates: ['frigorifico', 'numero_animal', 'valor_total_abate'] } : null });
  assert.equal(state.view, view, `${legacyId}: a tela abre no tipo`);
  assert.deepEqual(plain(state.groups), plain(getReportView(definition, view).groups), `${legacyId}: agrupamento do tipo`);
  if (view === 'abates') assert.deepEqual(state.columns, ['frigorifico', 'numero_animal', 'valor_total_abate'], 'com as colunas que a pessoa escolheu para o tipo');
}
// Relatórios de antes do Comercial: modelos, favoritos, recentes e último estado.
const dexie = await (await import('../src/storage/storageAdapter.js')).default.ensureReady();
const put = (key, value) => dexie.table('appSettings').put({ key, value });
const get = async (key) => (await dexie.table('appSettings').get(key))?.value;
const antigo = (id, name, baseReportId, extra = {}) => ({
  version: 1, id, name, baseReportId, baseReportVersion: 1, scope: 'SHARED', ownerUserId: GESTOR.id, ownerName: GESTOR.nome,
  columns: [], filters: {}, groups: [], aggregates: [], sort: [], period: period.periodo, params: {}, search: '', widths: {}, orientation: 'landscape',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id, ...extra,
});
const modelosAntigos = [
  // Lista (como o relatório antigo abria), com filtro próprio: vira o tipo Vendas, o filtro fica.
  antigo('t-v', 'Vendas W3', 'comercial.vendas', { filters: { comprador: { operator: 'contains', value: 'W3', valueTo: '', values: [] } }, columns: ['data_pesagem', 'numero_animal', 'valor_venda_total'] }),
  antigo('t-a', 'Mensal', 'comercial.abates'),
  // Agrupado por origem (escolha da pessoa): "Personalizado" com a população de Compras fixa; nome repetido.
  antigo('t-c', 'Mensal', 'comercial.compras', { groups: [{ columnId: 'origem_animal', direction: 'asc' }] }),
];
await put('report-templates:local', { version: 1, templates: modelosAntigos });
await put(`report-favorites:local:${GESTOR.id}`, ['comercial.abates', 'pesagens']);
await put(`report-recents:local:${GESTOR.id}`, [{ reportId: 'comercial.compras', templateId: null, at: '2026-09-10T10:00:00.000Z' }, { reportId: 'comercial.vendas', templateId: 't-v', at: '2026-09-09T10:00:00.000Z' }]);
const periodoAbates = { preset: 'personalizado', from: '2026-09-01', to: '2026-09-15' };
await put(`report-view-state:local:${GESTOR.id}`, { version: 1, reports: {
  'comercial.vendas': { ...antigo('s', 's', 'comercial.vendas'), period: { preset: 'ultimos_30_dias' }, updatedAt: '2026-09-02T10:00:00.000Z' },
  'comercial.abates': { ...antigo('s', 's', 'comercial.abates'), period: periodoAbates, search: '100', updatedAt: '2026-09-12T10:00:00.000Z' },
  pesagens: { ...antigo('s', 's', 'pesagens'), view: 'analitico', updatedAt: '2026-09-11T10:00:00.000Z' },
} });
const consolidacaoAntes = (await dexie.table('auditoria').toArray()).filter((row) => row.origem === PREFERENCES_MIGRATION_ORIGIN).length;
await Promise.all([getFavorites(GESTOR), getRecents(GESTOR), listTemplates(GESTOR), getFavorites(GESTOR)]);
const auditorias = (await dexie.table('auditoria').toArray()).filter((row) => row.origem === COMERCIAL_MIGRATION_ORIGIN);
assert.equal(auditorias.length, 3 + 1 + 2 + 2, 'uma auditoria por item (3 modelos, 1 favorito, 2 recentes, 2 últimos estados), mesmo com leituras em paralelo');
assert.ok(auditorias.every((row) => row.acao === 'ATUALIZAR' && row.usuario_id === GESTOR.id && /^Relatório virou tipo do Comercial: comercial\.(vendas|abates|compras) → comercial › /.test(row.resumo)), 'auditoria própria com o tipo de destino');
for (const trecho of ['comercial.abates → comercial › Abates (favorito)', 'comercial.compras → comercial › Personalizado (modelo salvo “Mensal”, agora “Mensal (Compras do período)”)', 'comercial.vendas → comercial › Vendas (último estado mais antigo, descartado)']) {
  assert.ok(auditorias.some((row) => row.resumo.includes(trecho)), `auditoria: "${trecho}"`);
}
assert.equal((await dexie.table('auditoria').toArray()).filter((row) => row.origem === PREFERENCES_MIGRATION_ORIGIN).length, consolidacaoAntes, 'nenhuma auditoria de "relatório consolidado" (é outra conversão)');
assert.deepEqual(await get(`report-favorites:local:${GESTOR.id}`), ['comercial#comercial.abates', 'pesagens'], 'favorito: Comercial + o id antigo (abre no tipo)');
assert.deepEqual((await get(`report-recents:local:${GESTOR.id}`)).map((item) => [item.reportId, item.presetId, item.templateId]), [['comercial', 'comercial.compras', null], ['comercial', null, 't-v']], 'recentes');
const modelos = new Map((await get('report-templates:local')).templates.map((template) => [template.id, template]));
const tv = modelos.get('t-v');
assert.deepEqual([tv.baseReportId, tv.migratedFrom, tv.view, tv.mode, tv.columns, tv.orientation], ['comercial', 'comercial.vendas', 'vendas', 'DETALHADO', viewSelection('vendas', definition).columns, 'landscape'], 'modelo de lista → tipo Vendas (colunas do tipo; orientação fica)');
assert.deepEqual(tv.filters.comprador.value, 'W3', 'o filtro da pessoa fica');
assert.equal(modelos.get('t-a').view, 'abates');
const tc = modelos.get('t-c');
assert.deepEqual([tc.view, tc.mode, tc.name, tc.renamedFrom], [null, 'RESUMIDO', 'Mensal (Compras do período)', 'Mensal'], 'modelo agrupado → Personalizado (Resumido), nome repetido ganha o relatório antigo');
assert.deepEqual(plain(tc.fixedFilters), plain({ tipo_manejo: { operator: 'in', value: '', valueTo: '', values: ['Cadastro'], match: 'code' }, valor_pago_cabeca: { operator: 'not_empty', value: '', valueTo: '', values: [] } }), 'Personalizado: a população de Compras vai como condição fixa');
assert.deepEqual(tc.columns, getLegacyAlias('comercial.compras').legacy.columns, 'Personalizado: sem colunas gravadas, as do relatório antigo');
const estados = (await get(`report-view-state:local:${GESTOR.id}`)).reports;
assert.deepEqual(Object.keys(estados).sort(), ['comercial', 'pesagens'], 'último estado: os antigos saem, o Comercial fica, os outros não mudam');
assert.deepEqual([estados.comercial.view, estados.comercial.search, plain(estados.comercial.period)], ['abates', '100', periodoAbates], 'último estado = o usado por último (Abates), com período e pesquisa');
assert.equal(estados.pesagens.view, 'analitico');
// Idempotente.
const denovo = await migrateReportPreferences(GESTOR);
assert.equal(denovo.migrated, 0, 'idempotente');
assert.equal((await dexie.table('auditoria').toArray()).filter((row) => row.origem === COMERCIAL_MIGRATION_ORIGIN).length, auditorias.length, 'nenhuma auditoria nova');
// Tudo abre e roda com a população certa.
const abre = async (template, actor = GESTOR) => {
  const request = templateToRequest(template, actor.role);
  return runReport(request.reportId, { today: TODAY, params: request.params, selection: request.selection }, actor);
};
const vmTv = await abre(tv);
assert.deepEqual([vmTv.view.id, idsOf(vmTv)], ['vendas', ['v1', 'v2']], 'modelo Vendas W3: tipo Vendas, só W3');
assert.deepEqual(idsOf(await abre(modelos.get('t-a'))), idsOf(vms.abates), 'modelo de Abates: os abates');
const vmTc = await abre(tc);
assert.deepEqual([vmTc.view, vmTc.mode, idsOf(vmTc)], [null, 'RESUMIDO', idsOf(vms.compras)], 'modelo agrupado: Personalizado, Resumido, só as compras (a população não amplia)');
assert.deepEqual(vmTc.tree.map((node) => node.label), ORIGENS, 'agrupado por origem, como a pessoa salvou');
const estado = await getReportViewState('comercial', GESTOR);
assert.deepEqual([estado.selection.view, estado.params.periodo], ['abates', periodoAbates], 'Comercial reabre no último estado convertido');
// Modelo antigo que ainda não passou pela conversão também abre (na hora).
const naHora = templateToRequest(antigo('t-x', 'X', 'comercial.abates'), 'GESTOR');
assert.deepEqual([naHora.reportId, naHora.selection.view], ['comercial', 'abates'], 'conversão na hora');
assert.equal((await listTemplates(OPERADOR)).some((template) => template.baseReportId === 'comercial'), false, 'NEGATIVO: OPERADOR não vê modelo do Comercial');

// ---------------------------------------------------------------------------------------------------
// 7. Paridade folha × XLSX (os 3 tipos) e CSV
// ---------------------------------------------------------------------------------------------------
const valoresDe = (row) => row.cells.map((cell) => cell[0]);
const paridade = {};
for (const view of COMERCIAL_VIEW_IDS) {
  const vm = vms[view];
  const doc = buildReportDocument(vm, { showDetails: true });
  const blocos = doc.vendas;
  const { rows: planilha } = buildSheetRows(vm);
  const totais = planilha.filter((row) => row.kind === XLSX_VENDAS_KINDS.ROW || row.kind === XLSX_VENDAS_KINDS.TOTAL).map(valoresDe);
  const daFolha = [
    ...blocos.resumo.rows.map((row) => [row.label, numberOf(row.text)]),
    ...blocos.porMarca.rows.map((row) => [row.label, ...row.cells.map((cell) => numberOf(cell.text))]),
    ...blocos.porGrupo.rows.map((row) => [row.label, ...row.cells.map((cell) => numberOf(cell.text))]),
    ...blocos.grupos.items.map((item) => [`Total ${item.label}`, ...item.totals.map((total) => numberOf(total.text))]),
    ['TOTAL GERAL', ...blocos.totalGeral.items.map((total) => numberOf(total.text))],
  ];
  assert.deepEqual(totais, daFolha, `${view}: cada total da folha é o mesmo número na planilha`);
  const dados = planilha.filter((row) => row.kind === XLSX_VENDAS_KINDS.DATA);
  assert.equal(dados.length, vm.rowCount, `${view}: planilha sempre com os lançamentos`);
  const headers = blocos.grupos.detailColumns.map((column) => column.label);
  blocos.grupos.items.flatMap((item) => item.rows).forEach((row, index) => {
    const xl = valoresDe(dados[index]);
    row.cells.forEach((cell, col) => {
      const peso = blocos.grupos.detailColumns[col].column?.type === 'weight';
      if (typeof xl[col] === 'number') assert.equal(numberOf(cell.text), peso ? roundTo(xl[col], 0) : xl[col], `${view} ${row.id} · ${headers[col]}: folha × XLSX`);
      else assert.equal(spaces(cell.text), xl[col] === null ? VENDAS_MISSING : xl[col], `${view} ${row.id} · ${headers[col]}: texto`);
    });
  });
  const xml = unzipStored((await prepareEmission(vm, 'xlsx', ADMIN)).content)['xl/worksheets/sheet1.xml'];
  for (const titulo of [blocos.porGrupo.title, blocos.grupos.title, 'TOTAL GERAL', `${blocos.groupLabel} · ${getReportView(definition, view).label}`]) assert.ok(xml.includes(`>${titulo}<`), `${view} XLSX: "${titulo}"`);
  assert.equal(preparePrint(vm, ADMIN, { showDetails: true }).manifest.showDetails, true, `${view}: impressão com "Mostrar Detalhes"`);
  paridade[view] = `${totais.length} totais, ${dados.length} lançamentos`;
}
assert.deepEqual(valoresDe(buildSheetRows(vms.abates).rows.find((row) => row.kind === XLSX_VENDAS_KINDS.TOTAL)), ['TOTAL GERAL', 4, 1970, 492.5, 52.61, 14800], 'XLSX Abates: TOTAL GERAL em número');
// CSV continua o Detalhado, com os rótulos de curral do tipo.
const csv = parseCsv((await prepareEmission(vms.abates, 'csv', ADMIN)).content);
const geral = csv.filter((row) => row[0] === 'GRAND_TOTAL');
assert.deepEqual(geral.map((row) => row[3]), ['Animais abatidos', 'Peso total (kg)', 'Peso médio (kg)', 'Rendimento médio (%)', 'Total @ carcaça', 'Média @ carcaça', 'Média valor da arroba', 'Valor total'], 'CSV Abates: rótulos do total geral');
assert.equal(geral.at(-1)[4], '14800,00', 'CSV Abates: valor total');
assert.equal(csv.filter((row) => row[0] === 'DATA').length, 4);
assert.deepEqual(csv[0].slice(5), ['Frigorífico', 'Data', 'Animal', 'Peso (kg)', 'Rendimento (%)', 'Qtd @ Carcaça', 'Valor @', 'Valor Total'], 'CSV Abates: cabeçalhos do tipo (nada começa com @ — o CSV protege a célula)');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:comercial:verify',
  ok: true,
  tipos: COMERCIAL_VIEW_IDS,
  vendas: textos(blocosVendas.resumo.rows),
  abates: spaces(blocosAbates.totalGeral.text),
  compras: spaces(blocosCompras.totalGeral.text),
  auditorias: auditorias.length,
  paridade,
}, null, 2));
