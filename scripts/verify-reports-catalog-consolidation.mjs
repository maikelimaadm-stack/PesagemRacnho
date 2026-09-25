// Gate reports:catalog-consolidation:verify (E1 1.4.0) — catálogo enxuto sem quebrar ninguém.
//   1. 12 relatórios visíveis (ids exatos); 4 na aba Controle da Manutenção; cadastros e bloqueados ocultos.
//   2. Todo id antigo resolve para um alias válido de um relatório do catálogo, e abrir pelo id antigo
//      produz EXATAMENTE o mesmo resultado que o relatório novo com a seleção equivalente.
//   3. Comportamento dos relatórios antigos preservado (condições fixas viraram filtros com o mesmo efeito).
//   4. Migração de preferências (favoritos, recentes, modelos): id novo + seleção equivalente,
//      idempotente, auditada ("relatório consolidado"), nenhum modelo órfão.
//   5. Aceite 6: o favorito antigo "Rebanho por raça" abre agrupado por raça.
import assert from 'node:assert/strict';
import { ADMIN, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport, listReports } from '../src/modules/reporting/application/reportService.js';
import {
  LEGACY_REPORT_ALIASES, getReportDefinition, isLegacyReportId, listAllReportDefinitions, listReportDefinitions, resolveReportId,
} from '../src/modules/reporting/definitions/reportCatalog.js';
import { aliasSelection } from '../src/modules/reporting/definitions/legacyAliases.js';
import {
  PREFERENCES_MIGRATION_ORIGIN, favoriteKey, getFavorites, getRecents, listTemplates, migrateReportPreferences, parseFavoriteKey, templateToRequest,
} from '../src/modules/reporting/application/reportTemplateService.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const EXPECTED_CATALOG = [
  'rebanho.atual', 'rebanho.ocupacao-lotes', 'pesagens', 'controle.fechamento-dia', 'desempenho', 'movimentacao.lotes', 'saidas',
  'comercial.vendas', 'comercial.abates', 'comercial.compras', 'embarques.romaneio', 'embarques.previsto-realizado',
];

// ---- 1. Catálogo ----
const catalog = listReportDefinitions();
assert.deepEqual(catalog.map((d) => d.id), EXPECTED_CATALOG, '12 relatórios visíveis, nesta ordem');
assert.deepEqual([...new Set(catalog.map((d) => d.family))], ['rebanho', 'pesagens', 'desempenho', 'movimentacao', 'saidas', 'comercial', 'embarques'], 'famílias do catálogo');
assert.deepEqual(listReportDefinitions({ visibility: 'maintenance' }).map((d) => d.id).sort(), ['controle.auditoria', 'controle.backups', 'controle.qualidade-dados', 'pesagens.pendencias']);
const hidden = listReportDefinitions({ visibility: 'hidden' });
assert.equal(hidden.filter((d) => d.id.startsWith('cadastros.') && d.status !== 'blocked').length, 7, 'cadastros.* (7) fora da interface');
assert.equal(hidden.filter((d) => d.status === 'blocked').length, 10, 'os 10 bloqueados fora da interface (backlog)');
assert.equal(listAllReportDefinitions().length, 12 + 4 + 7 + 10, 'nada foi apagado: 33 definições + aliases');
assert.equal(listReports(ADMIN).length, 12, 'ADMIN vê 12 no catálogo');

// ---- 2. Aliases: todo id antigo resolve e equivale ----
const LEGACY_IDS = [
  'rebanho.inventario', 'rebanho.dimensao.marca', 'rebanho.dimensao.raca', 'rebanho.dimensao.categoria', 'rebanho.dimensao.sexo', 'rebanho.dimensao.situacao',
  'rebanho.dimensao.lote', 'rebanho.dimensao.apartacao', 'rebanho.dimensao.faixa_peso', 'rebanho.sem-pesagem-recente',
  'pesagens.periodo', 'pesagens.sessao', 'pesagens.lote', 'pesagens.operador', 'pesagens.origem', 'movimentacao.entradas-saidas',
  'desempenho.individual', 'desempenho.lote', 'desempenho.dimensao.marca', 'desempenho.dimensao.raca', 'desempenho.dimensao.categoria', 'desempenho.dimensao.sexo',
  'desempenho.dimensao.lote', 'desempenho.dimensao.apartacao', 'desempenho.perdendo-peso', 'desempenho.faixa-peso',
  'movimentacao.mudancas-lote', 'movimentacao.permanencias-lote',
  'saidas.motivo', 'saidas.mortes', 'saidas.mortes.causa', 'saidas.mortes.categoria', 'saidas.mortes.lote',
];
assert.deepEqual(Object.keys(LEGACY_REPORT_ALIASES).sort(), [...LEGACY_IDS].sort(), 'todos os ids antigos consolidados têm alias');
assert.equal(catalog.length + 4 + LEGACY_IDS.length + 7 + 10, 66, '12 + 4 + 33 aliases + 7 cadastros + 10 bloqueados');

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const comparable = (vm) => plain({ rows: vm.rows.map((row) => row.id), columns: vm.columns.map((c) => c.id), groups: vm.groups, tree: vm.tree.map(function strip(node) { return { id: node.id, rowCount: node.rowCount, aggregates: node.aggregates, children: node.children.map(strip) }; }), totals: vm.totals, mode: vm.mode, filters: vm.filters, sort: vm.sort });
for (const id of LEGACY_IDS) {
  const alias = LEGACY_REPORT_ALIASES[id];
  assert.ok(isLegacyReportId(id), `${id}: é id antigo`);
  const resolved = resolveReportId(id);
  assert.equal(resolved.definition.id, alias.id, `${id} → ${alias.id}`);
  assert.equal(getReportDefinition(id), getReportDefinition(alias.id), `getReportDefinition(${id}) devolve a definição nova`);
  assert.ok(EXPECTED_CATALOG.includes(alias.id), `${id}: aponta para relatório do catálogo`);
  const viaAlias = await runReport(id, { today: TODAY, params: P }, ADMIN);
  const viaNovo = await runReport(alias.id, { today: TODAY, params: P, selection: aliasSelection(alias) }, ADMIN);
  assert.equal(viaAlias.reportId, alias.id);
  assert.equal(viaAlias.presetId, id, `${id}: view model registra o id antigo`);
  assert.deepEqual(comparable(viaAlias), comparable(viaNovo), `${id}: abrir pelo id antigo = relatório novo com a seleção equivalente`);
  assert.equal(viaAlias.mode, alias.groups.length ? 'RESUMIDO' : 'DETALHADO', `${id}: agrupado abre Resumido, lista abre Detalhado`);
}

// ---- 3. Comportamento antigo preservado (valores conferidos à mão na massa) ----
const run = (id, extra = {}) => runReport(id, { today: TODAY, params: P, ...extra }, ADMIN);
const labels = (vm, agg) => Object.fromEntries(vm.tree.map((n) => [n.label, n.aggregates[agg].value]));
assert.deepEqual(labels(await run('saidas.mortes.causa'), 'mortes'), { Raio: 1 }, 'mortes por causa');
assert.deepEqual((await run('saidas.mortes')).rows.map((r) => r.id), ['e8'], 'só mortes');
assert.deepEqual(labels(await run('movimentacao.entradas-saidas'), 'registros'), { Cadastro: 4, 'Saída': 2 }, 'entradas e saídas');
assert.deepEqual((await run('rebanho.sem-pesagem-recente', { params: { dias_sem_pesagem: 4 } })).rows.map((r) => r.animal_id), ['A1'], 'parâmetro antigo vira filtro (> 4 dias)');
assert.deepEqual(labels(await run('rebanho.dimensao.sexo'), 'animais'), { 'Fêmea': 1, Macho: 1 }, 'rebanho por sexo (só ativos)');
assert.deepEqual(labels(await run('rebanho.dimensao.situacao'), 'animais'), { Ativo: 2, Morto: 1, Vendido: 1 }, 'por situação mostra todas');
const perdendo = await run('desempenho.perdendo-peso');
assert.ok(perdendo.rows.every((row) => row.ganho < 0), 'perdendo peso: ganho < 0');
const mudancas = await run('movimentacao.mudancas-lote');
assert.ok(mudancas.rows.every((row) => row.mudanca === true && row.entrada_no_periodo === true), 'mudanças de lote no período');
const permanencias = await run('movimentacao.permanencias-lote');
const esperado = permanencias.rows.filter((row) => row.mudanca && row.inicio >= P.periodo.from && row.inicio <= P.periodo.to).map((row) => row.id).sort();
assert.deepEqual(mudancas.rows.map((row) => row.id).sort(), esperado, 'filtro "entrou no período" = antiga condição inicio entre de e até');
// Filtros rápidos existem nos relatórios novos com o mesmo efeito dos antigos
const quick = (id, quickId) => getReportDefinition(id).quickFilters.find((item) => item.id === quickId).filters;
assert.deepEqual((await run('saidas', { selection: { filters: quick('saidas', 'somente-mortes'), groups: [] } })).rows.map((r) => r.id), ['e8'], 'filtro rápido "Somente mortes"');
assert.ok((await run('desempenho', { selection: { filters: quick('desempenho', 'perdendo-peso') } })).rows.every((row) => row.ganho < 0), 'filtro rápido "Somente perdendo peso"');

// ---- 4. Migração de preferências ----
const db = (await import('../src/storage/storageAdapter.js')).default;
const dexie = await db.ensureReady();
const put = (key, value) => dexie.table('appSettings').put({ key, value });
const legacyTemplates = [
  { version: 1, id: 't-mortes', name: 'Mortes do mês', baseReportId: 'saidas.mortes.causa', baseReportVersion: 1, scope: 'SHARED', ownerUserId: GESTOR.id, ownerName: GESTOR.nome, columns: ['data_pesagem', 'numero_animal', 'causa_morte'], filters: {}, groups: [{ columnId: 'causa_morte', direction: 'asc' }], aggregates: [], sort: [], period: { preset: 'ultimos_30_dias' }, params: {}, search: '', widths: {}, orientation: 'auto', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id },
  { version: 1, id: 't-sem-pesagem', name: 'Sem pesagem 60 dias', baseReportId: 'rebanho.sem-pesagem-recente', baseReportVersion: 1, scope: 'PERSONAL', ownerUserId: GESTOR.id, ownerName: GESTOR.nome, columns: [], filters: { situacao: { operator: 'in', value: '', valueTo: '', values: ['ATIVO'] } }, groups: [], aggregates: [], sort: [], period: null, params: { dias_sem_pesagem: 60 }, search: '', widths: {}, orientation: 'auto', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id },
  { version: 1, id: 't-individual', name: 'Individual machos', baseReportId: 'desempenho.individual', baseReportVersion: 1, scope: 'PERSONAL', ownerUserId: GESTOR.id, ownerName: GESTOR.nome, columns: ['animal', 'gmd'], filters: { sexo: { operator: 'in', value: '', valueTo: '', values: ['Macho'], match: 'label' } }, groups: [], aggregates: [], sort: [], period: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' }, params: {}, search: '', widths: {}, orientation: 'auto', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id },
  { version: 1, id: 't-vendas', name: 'Vendas', baseReportId: 'comercial.vendas', baseReportVersion: 1, scope: 'SHARED', ownerUserId: GESTOR.id, ownerName: GESTOR.nome, columns: [], filters: {}, groups: [], aggregates: [], sort: [], period: null, params: {}, search: '', widths: {}, orientation: 'auto', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id },
];
await put('report-templates:local', { version: 1, templates: legacyTemplates });
await put(`report-favorites:local:${GESTOR.id}`, ['rebanho.dimensao.raca', 'pesagens.periodo', 'comercial.vendas', 'rebanho.inventario']);
await put(`report-recents:local:${GESTOR.id}`, [{ reportId: 'saidas.mortes.causa', templateId: null, at: '2026-09-10T10:00:00.000Z' }, { reportId: 'desempenho.individual', templateId: 't-individual', at: '2026-09-09T10:00:00.000Z' }]);
const auditBefore = await dexie.table('auditoria').count();

const favorites = await getFavorites(GESTOR);
assert.deepEqual(favorites, ['rebanho.atual#rebanho.dimensao.raca', 'pesagens#pesagens.periodo', 'comercial.vendas', 'rebanho.atual#rebanho.inventario'], 'favoritos: id novo + visão do antigo');
assert.deepEqual((await dexie.table('appSettings').get(`report-favorites:local:${GESTOR.id}`)).value, favorites, 'favoritos reescritos no banco');
const recents = await getRecents(GESTOR);
assert.deepEqual(recents.map((item) => [item.reportId, item.presetId, item.templateId]), [['saidas', 'saidas.mortes.causa', null], ['desempenho', 'desempenho.individual', 't-individual']], 'recentes reescritos');
const stored = (await dexie.table('appSettings').get('report-templates:local')).value.templates;
assert.ok(stored.every((template) => !isLegacyReportId(template.baseReportId) && getReportDefinition(template.baseReportId)), 'nenhum modelo órfão / com id antigo');
const mortes = stored.find((t) => t.id === 't-mortes');
assert.equal(mortes.baseReportId, 'saidas');
assert.equal(mortes.migratedFrom, 'saidas.mortes.causa');
assert.deepEqual(mortes.filters.motivo_saida, { operator: 'in', values: ['Morte'] }, 'condição fixa "só mortes" acrescentada ao modelo');
assert.deepEqual(mortes.columns, ['data_pesagem', 'numero_animal', 'causa_morte'], 'o que o modelo guardava prevalece');
assert.equal(mortes.mode, 'RESUMIDO', 'modelo agrupado migra para Resumido');
const semPesagem = stored.find((t) => t.id === 't-sem-pesagem');
assert.deepEqual(semPesagem.filters.dias_sem_pesagem, { operator: 'greater', value: '60' }, 'parâmetro 60 dias vira filtro > 60');
assert.equal(semPesagem.params.dias_sem_pesagem, undefined, 'parâmetro extinto removido');
assert.equal(stored.find((t) => t.id === 't-individual').mode, 'DETALHADO', 'modelo sem grupo migra para Detalhado');
assert.equal(stored.find((t) => t.id === 't-vendas').migratedFrom, undefined, 'modelo de relatório que continua existindo não muda');
const audits = (await dexie.table('auditoria').toArray()).filter((row) => row.origem === PREFERENCES_MIGRATION_ORIGIN);
assert.equal(audits.length, 3 + 3 + 2, 'uma auditoria por item consolidado (3 modelos, 3 favoritos, 2 recentes)');
assert.ok(audits.every((row) => row.acao === 'ATUALIZAR' && /^Relatório consolidado: /.test(row.resumo) && row.usuario_id === GESTOR.id), 'auditoria "relatório consolidado" com o usuário');

// Idempotente: segunda leitura não grava nem audita de novo
const again = await migrateReportPreferences(GESTOR);
assert.equal(again.migrated, 0, 'idempotente');
assert.equal(await dexie.table('auditoria').count(), auditBefore + audits.length, 'nenhuma auditoria nova');

// Nenhum modelo órfão: todos abrem e rodam
for (const template of await listTemplates(GESTOR)) {
  const request = templateToRequest(template, GESTOR.role);
  const vm = await runReport(request.reportId, { today: TODAY, params: request.params, selection: request.selection }, GESTOR);
  assert.ok(vm.reportId && Array.isArray(vm.rows), `modelo "${template.name}" abre`);
  if (template.id === 't-mortes') assert.ok(vm.rows.every((row) => row.motivo_saida === 'Morte'), 'modelo de mortes continua só com mortes');
  if (template.id === 't-sem-pesagem') assert.ok(vm.rows.every((row) => row.dias_sem_pesagem > 60), 'modelo sem pesagem: > 60 dias');
}
// Modelo antigo que ainda não passou pela migração também abre (conversão na hora)
const naHora = templateToRequest(legacyTemplates[0], 'GESTOR');
assert.equal(naHora.reportId, 'saidas');
assert.deepEqual(naHora.selection.filters.motivo_saida, { operator: 'in', values: ['Morte'] });

// Outro usuário: as preferências dele migram quando ele abre
await put(`report-favorites:local:${OPERADOR.id}`, ['desempenho.lote']);
assert.deepEqual(await getFavorites(OPERADOR), ['desempenho#desempenho.lote']);

// ---- 5. Aceite 6: favorito antigo "Rebanho por raça" abre agrupado por raça ----
const { reportId, presetId } = parseFavoriteKey('rebanho.atual#rebanho.dimensao.raca');
assert.deepEqual([reportId, presetId], ['rebanho.atual', 'rebanho.dimensao.raca']);
assert.equal(favoriteKey(reportId, presetId), 'rebanho.atual#rebanho.dimensao.raca');
const porRaca = await runReport(presetId, { today: TODAY }, GESTOR);
assert.equal(porRaca.reportId, 'rebanho.atual');
assert.deepEqual(porRaca.groups.map((group) => group.columnId), ['raca'], 'agrupado por raça');
assert.equal(porRaca.mode, 'RESUMIDO');
assert.deepEqual(porRaca.summaryRows.map((row) => row.label), ['Nelore', 'Não informado'], 'uma linha por raça (ativos: A1 Nelore, A4 sem raça)');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:catalog-consolidation:verify', ok: true, catalog: catalog.length, aliases: LEGACY_IDS.length, auditsConsolidacao: audits.length }, null, 2));
