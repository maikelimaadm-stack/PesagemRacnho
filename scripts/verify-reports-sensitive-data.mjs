// Gate reports:sensitive-data:verify (R3) — valores comerciais não vazam para quem não tem
// commercial.values em NENHUM canal (colunas, filtros, ordenação, totais, pesquisa, CSV, JSON,
// manifesto, modelos); nenhuma coluna de segredo de autenticação existe em definição alguma.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { FORBIDDEN_FIELD_PATTERN } from '../src/modules/reporting/domain/reportPermissions.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';

// 1. Nenhuma definição expõe segredo; toda coluna de valor é marcada como comercial.
const VALUE_IDS = /^(valor_|preco|quantidade_arrobas|peso_carcaca)/;
// E1: todas as definições do código (catálogo, Manutenção e ocultas).
for (const definition of listAllReportDefinitions()) {
  for (const column of definition.columns) {
    assert.ok(!FORBIDDEN_FIELD_PATTERN.test(column.id), `${definition.id}: coluna proibida ${column.id}`);
    if (VALUE_IDS.test(column.id)) assert.equal(column.sensitive, 'commercial', `${definition.id}: ${column.id} deve ser sensível`);
  }
}

await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const everything = getReportDefinition('pesagens.periodo').columns.map((column) => column.id);
const SENSITIVE_IDS = getReportDefinition('pesagens.periodo').columns.filter((column) => column.sensitive).map((column) => column.id);
// Valores exclusivos da venda da massa (o peso 300,00 kg existe e não é segredo).
// E1B: o segredo da @ de carcaça passou a ser conferido pelo PESO DE CARCAÇA "140,00" (280 kg × 50 % de
// rendimento, que só existe com o rendimento escondido). O antigo "9,33" (140 ÷ 15) é NUMERICAMENTE igual
// à @ de peso vivo da mesma venda (280 ÷ 30) — coluna não sensível "Peso em arrobas", que deriva do peso
// visível e não é segredo. A @ de carcaça continua conferida abaixo pela coluna e pelos rótulos.
const SECRET_VALUES = ['3000', '3.000', '140,00', 'Valor venda', 'Preço/@', '@ carcaça', 'Carcaça', 'Rendimento'];

// 2. Admin vê (controle positivo), O/C não veem em nenhum canal
const admin = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: everything } }, ADMIN);
const adminCsv = (await prepareEmission(admin, 'csv', ADMIN)).content;
assert.ok(adminCsv.includes('3000,00'), 'controle: ADMIN exporta o valor da venda');
assert.ok(adminCsv.includes('140,00') && adminCsv.includes('@ carcaça'), 'controle: ADMIN exporta a carcaça (140,00) e a @ de carcaça');
// ('3.000' é o formato com milhar da tela; o CSV não tem separador de milhar.)
for (const secret of SECRET_VALUES.filter((item) => item !== '3.000')) assert.ok(adminCsv.includes(secret), `controle: o segredo "${secret}" existe na massa (senão o teste não prova nada)`);

for (const actor of [OPERADOR, CONSULTA]) {
  const vm = await runReport('pesagens.periodo', {
    today: TODAY,
    params: period,
    selection: {
      columns: everything,
      filters: { valor_venda_total: { operator: 'equals', value: '3000' } },
      sort: [{ columnId: 'valor_venda_total', direction: 'desc' }],
      aggregates: [{ id: 'soma_venda', columnId: 'valor_venda_total', op: 'sum' }, { id: 'arroba', columnId: 'valor_arroba', op: 'weightedAvg' }, { id: 'registros', op: 'count' }],
      search: '3000',
    },
  }, actor);
  assert.ok(!vm.columns.some((column) => column.sensitive), `${actor.role}: sem colunas sensíveis`);
  assert.ok(!vm.availableColumns.some((column) => column.sensitive), `${actor.role}: nem oferecidas no configurador`);
  assert.deepEqual(Object.keys(vm.filters), [], `${actor.role}: filtro sensível descartado`);
  assert.ok(vm.sort.every((item) => !/valor/.test(item.columnId)), `${actor.role}: ordenação sensível descartada`);
  assert.deepEqual(Object.keys(vm.totals), ['registros'], `${actor.role}: totais de valor não calculados`);
  assert.equal(vm.rowCount, 0, `${actor.role}: pesquisa "3000" não casa com valor escondido`);
  if (actor.role === 'CONSULTA') {
    const vmSemPesquisa = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: everything } }, actor);
    for (const format of ['csv', 'json']) {
      const { content, manifest } = await prepareEmission(vmSemPesquisa, format, actor);
      for (const secret of SECRET_VALUES) assert.ok(!content.includes(secret), `${actor.role} ${format}: não contém "${secret}"`);
      assert.ok(!JSON.stringify(manifest).includes('valor_venda_total') || manifest.hiddenByPermission.includes('valor_venda_total'), 'manifesto só cita a coluna como oculta');
      // Nenhum campo comercial (valor, @ de carcaça, carcaça, rendimento) sai como chave do JSON.
      for (const id of SENSITIVE_IDS) assert.ok(!new RegExp(`"${id}":`).test(content), `${actor.role} ${format}: nenhum campo ${id}`);
    }
    // E1B: "9,33" no CSV de quem não vê valores só pode ser a @ de PESO VIVO (280 ÷ 30), na coluna
    // "Peso em arrobas (@)" — nunca numa coluna comercial.
    const csv = parseCsv((await prepareEmission(vmSemPesquisa, 'csv', actor)).content);
    const header = csv[0];
    for (const row of csv.slice(1)) {
      row.forEach((cell, index) => { if (cell === '9,33') assert.equal(header[index], 'Peso em arrobas (@)', `${actor.role}: 9,33 só como @ viva (coluna ${header[index]})`); });
    }
    assert.ok(csv.slice(1).some((row) => row[header.indexOf('Peso em arrobas (@)')] === '9,33'), 'controle: a @ viva da venda (280 ÷ 30) é visível para quem vê o peso');
    // E1: o Resumido também não vaza valor (métricas de valor nem entram na seleção de quem não vê).
    const vmResumido = await runReport('pesagens', {
      today: TODAY, params: period,
      selection: { mode: 'RESUMIDO', groups: [{ columnId: 'motivo_saida' }], aggregates: [{ id: 'soma_venda', columnId: 'valor_venda_total', op: 'sum' }, { id: 'registros', op: 'count' }] },
    }, actor);
    assert.deepEqual(vmResumido.aggregates.map((spec) => spec.id), ['registros'], 'Resumido: métrica de valor descartada');
    for (const format of ['csv', 'json', 'xlsx']) {
      const { content } = await prepareEmission(vmResumido, format, actor);
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      for (const secret of SECRET_VALUES) assert.ok(!text.includes(secret), `${actor.role} Resumido ${format}: não contém "${secret}"`);
      assert.ok(!/Valor \(R\$\)/.test(text), `${actor.role} Resumido ${format}: sem coluna de valor`);
    }
  }
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:sensitive-data:verify', ok: true }, null, 2));
