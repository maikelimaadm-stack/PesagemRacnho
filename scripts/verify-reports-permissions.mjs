// Gate reports:permissions:verify (R3) — decisões fechadas por perfil, aplicadas NO SERVIÇO:
// ver catálogo, rodar, exportar, compartilhar; valores comerciais só A/G; CONSULTA exporta só o
// não sensível; chamada direta ao serviço não contorna a regra.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { listReports, runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { can } from '../src/modules/auth/domain/permissionService.js';
import { assertCanExport, canSeeColumn } from '../src/modules/reporting/domain/reportPermissions.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';

const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

// Matriz das decisões
const expected = {
  ADMIN: { 'reports.read': true, 'reports.export': true, 'reports.templates.share': true, 'commercial.values': true, 'audit.read': true, 'maintenance.reset': true },
  GESTOR: { 'reports.read': true, 'reports.export': true, 'reports.templates.share': true, 'commercial.values': true, 'audit.read': true, 'maintenance.reset': false },
  OPERADOR: { 'reports.read': true, 'reports.export': false, 'reports.templates.share': false, 'commercial.values': false, 'audit.read': false, 'users.manage': false },
  CONSULTA: { 'reports.read': true, 'reports.export': true, 'reports.templates.share': false, 'commercial.values': false, 'audit.read': false, 'weighing.edit': false },
};
for (const [role, actions] of Object.entries(expected)) for (const [action, value] of Object.entries(actions)) assert.equal(can(role, action), value, `${role} × ${action}`);

// Catálogo por perfil: todos veem os relatórios operacionais
for (const actor of [ADMIN, GESTOR, OPERADOR, CONSULTA]) {
  const ids = listReports(actor).filter((item) => item.available).map((item) => item.id);
  // E1 (1.4.0): catálogo consolidado (pesagens.periodo/rebanho.inventario/desempenho.individual viraram aliases).
  assert.ok(ids.includes('pesagens') && ids.includes('rebanho.atual') && ids.includes('desempenho'), `${actor.role} vê relatórios operacionais`);
}

// E1B (resposta 2 da responsável): quem não abre Backup e Manutenção (sem maintenance.backup) vê em
// Relatórios, família "Controle", os relatórios da aba Controle que o papel pode abrir.
for (const actor of [OPERADOR, CONSULTA]) {
  assert.equal(can(actor.role, 'maintenance.backup'), false, `${actor.role} não abre a Manutenção`);
  const controle = listReports(actor).filter((item) => item.available && item.family === 'controle').map((item) => item.id).sort();
  assert.deepEqual(controle, ['controle.qualidade-dados', 'pesagens.pendencias'], `${actor.role}: Pendências de pesagem e Qualidade dos dados em Relatórios › Controle`);
  assert.ok(!listReports(actor).some((item) => ['controle.auditoria', 'controle.backups'].includes(item.id)), `${actor.role}: auditoria e backups continuam fora (sem permissão)`);
  assert.equal(await code(() => runReport('pesagens.pendencias', { today: TODAY, params: period }, actor)), 'OK', `${actor.role} abre Pendências de pesagem`);
}
for (const actor of [ADMIN, GESTOR]) {
  const catalogo = listReports(actor).filter((item) => item.available);
  // E1E: Vendas, Abates e Compras do período viraram os tipos do Comercial (12 → 10).
  assert.equal(catalogo.length, 10, `${actor.role}: os 10 (controle fica na aba da Manutenção)`);
  assert.ok(!catalogo.some((item) => item.family === 'controle'), `${actor.role}: nenhum relatório de controle no catálogo`);
  assert.ok(listReports(actor, { visibility: 'maintenance' }).some((item) => item.id === 'pesagens.pendencias' && item.available), `${actor.role}: Pendências na aba Controle`);
}

// Sem sessão / papel desconhecido → recusado no serviço
assert.equal(await code(() => runReport('pesagens.periodo', { today: TODAY, params: period }, null)), 'AUTH_FORBIDDEN');
assert.equal(await code(() => runReport('pesagens.periodo', { today: TODAY, params: period }, { id: 'x', role: 'ROOT' })), 'AUTH_FORBIDDEN');

// Colunas comerciais: A/G veem; O/C não (tela, filtro, ordenação, agrupamento e exportação)
const commercialColumns = ['data_pesagem', 'numero_animal', 'valor_venda_total', 'valor_arroba', 'quantidade_arrobas'];
for (const actor of [ADMIN, GESTOR]) {
  const vm = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: commercialColumns } }, actor);
  assert.deepEqual(vm.columns.map((c) => c.id), commercialColumns, `${actor.role} vê valores`);
  assert.equal((await prepareEmission(vm, 'csv', actor)).manifest.columns.length, 5);
}
for (const actor of [OPERADOR, CONSULTA]) {
  const vm = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: commercialColumns, filters: { valor_venda_total: { operator: 'greater', value: '0' } }, sort: [{ columnId: 'valor_arroba', direction: 'desc' }] } }, actor);
  assert.deepEqual(vm.columns.map((c) => c.id), ['data_pesagem', 'numero_animal'], `${actor.role} sem valores`);
  assert.equal(vm.rowCount, 9, `${actor.role}: filtro em coluna sensível removido (não vira canal lateral)`);
  assert.ok(vm.warnings.some((w) => w.code === 'FILTER_REMOVED_BY_PERMISSION'));
  const agrupamentoValor = await code(() => runReport('pesagens.periodo', { today: TODAY, params: period, selection: { groups: [{ columnId: 'valor_arroba' }] } }, actor));
  assert.ok(agrupamentoValor !== 'OK', `${actor.role}: não agrupa por coluna de valor (${agrupamentoValor})`);
  const totals = (await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { aggregates: [{ id: 'v', columnId: 'valor_venda_total', op: 'sum' }] } }, actor)).totals;
  assert.ok(!('v' in totals), `${actor.role}: total de valor não é calculado`);
}

// Exportação: OPERADOR nunca; CONSULTA só o não sensível; view model forjado com coluna sensível é recusado
const vmOperador = await runReport('pesagens.periodo', { today: TODAY, params: period }, OPERADOR);
assert.equal(await code(() => prepareEmission(vmOperador, 'csv', OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não exporta');
const vmConsulta = await runReport('pesagens.periodo', { today: TODAY, params: period }, CONSULTA);
assert.equal(await code(() => prepareEmission(vmConsulta, 'csv', CONSULTA)), 'OK', 'CONSULTA exporta não sensível');
const forjado = { ...vmConsulta, columns: [...vmConsulta.columns, { id: 'valor_venda_total', label: 'Valor venda', type: 'money', sensitive: 'commercial' }] };
assert.equal(await code(() => prepareEmission(forjado, 'csv', CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: coluna sensível injetada no view model');
assert.equal(await code(() => prepareEmission(vmConsulta, 'csv', { ...CONSULTA, id: 'outra-sessao' })), 'AUTH_FORBIDDEN', 'view model de outra sessão');
assert.throws(() => assertCanExport(getReportDefinition('pesagens.periodo'), 'OPERADOR', []), (error) => error.code === 'AUTH_FORBIDDEN');

// Coluna com nome de segredo nunca é visível, para nenhum perfil
assert.equal(canSeeColumn({ id: 'password_hash' }, 'ADMIN'), false);
assert.equal(canSeeColumn({ id: 'recovery_key' }, 'ADMIN'), false);

// Rota e menu
const layout = readFileSync(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
assert.match(layout, /url: "Relatorios",[\s\S]{0,80}permission: "reports\.read"/, 'menu: uma entrada Relatórios com reports.read');
assert.equal((layout.match(/url: "Relatorio/g) || []).length, 1, 'uma única entrada de relatórios no menu');
const view = readFileSync(new URL('../src/components/reports/ReportView.jsx', import.meta.url), 'utf8');
assert.match(view, /can\("reports\.export"\) \?/, 'botão Exportar só com reports.export');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:permissions:verify', ok: true }, null, 2));
