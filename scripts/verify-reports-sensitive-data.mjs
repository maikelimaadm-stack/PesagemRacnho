// Gate reports:sensitive-data:verify (R3) — valores comerciais não vazam para quem não tem
// commercial.values em NENHUM canal (colunas, filtros, ordenação, totais, pesquisa, CSV, JSON,
// manifesto, modelos); nenhuma coluna de segredo de autenticação existe em definição alguma.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { FORBIDDEN_FIELD_PATTERN } from '../src/modules/reporting/domain/reportPermissions.js';

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
// Valores exclusivos da venda da massa (o peso 300,00 kg existe e não é segredo).
const SECRET_VALUES = ['3000', '3.000', '9,33', 'Valor venda', 'Preço/@', '@ carcaça'];

// 2. Admin vê (controle positivo), O/C não veem em nenhum canal
const admin = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: everything } }, ADMIN);
const adminCsv = (await prepareEmission(admin, 'csv', ADMIN)).content;
assert.ok(adminCsv.includes('3000,00'), 'controle: ADMIN exporta o valor da venda');

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
      assert.ok(!/"valor_venda_total":/.test(content), `${actor.role} ${format}: nenhum campo de valor`);
    }
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
