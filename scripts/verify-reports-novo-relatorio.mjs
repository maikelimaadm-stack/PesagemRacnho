// Gate reports:novo-relatorio:verify (E1F, item 4) — "Novo relatório" e "Meus relatórios" na tela única de
// Relatórios. Um relatório do usuário é um MODELO (appSettings, sem esquema novo): pessoal ou da empresa.
// Confere, com as MESMAS funções que a tela usa (application/customReports.js) e o serviço de modelos:
//  1. seletor "Relatório" com o grupo "Meus relatórios" por perfil e "➕ Novo relatório…" no fim;
//  2. criação com a seleção padrão da base (abre igual à base, sem "alterado"), para toda base de todo perfil;
//  3. regras do nome e de "Quem vê" (obrigatório, até 80, único por base/escopo; "A empresa" só com share);
//  4. Renomear e Excluir com as regras de dono/escopo e permissão;
//  5. detecção de alteração ("Salvar alterações") e ida e volta do que é salvo; último estado não grava no modelo;
//  6. título "Relatório de <nome>" na tela e na folha (impressão/PDF), sem campo novo no modelo;
//  7. nunca amplia permissão; 8. checagens mínimas de texto da tela.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { can } from '../src/modules/auth/domain/permissionService.js';
import {
  MY_REPORTS_FAMILY, MY_REPORTS_LABEL, NEW_REPORT_LABEL, NEW_REPORT_VALUE, REPORT_NAME_MAX,
  canEditReport, canShareReports, createCustomReport, defaultReportState, isReportChanged, myReportOptions, newReportBases, newReportInput,
  parseReportOption, reportNameError, reportSnapshot, reportTitle, selectorValue, templateOptionValue, withMyReports, withTemplateOption,
} from '../src/modules/reporting/application/customReports.js';
import { buildInitialReportState, typedViewSelection } from '../src/modules/reporting/application/reportInitialState.js';
import { reportSelectorOptions } from '../src/modules/reporting/application/reportScreenModel.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import {
  deleteTemplate, listTemplates, normalizeTemplateConfig, renameTemplate, saveReportViewState, saveTemplate, templateToRequest,
} from '../src/modules/reporting/application/reportTemplateService.js';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { buildReportDocument, sheetTitleOf } from '../src/modules/reporting/domain/reportDocument.js';
import { canRunReport, canSeeColumn } from '../src/modules/reporting/domain/reportPermissions.js';
import { templatePayload, viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';

const ACTORS = [ADMIN, GESTOR, OPERADOR, CONSULTA];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
const mineOf = (options) => options.filter((option) => option.family === MY_REPORTS_FAMILY);
const PESAGENS = getReportDefinition('pesagens');

const { db } = await seedReportFixture();
const storedTemplates = async () => (await db.table('appSettings').get('report-templates:local'))?.value?.templates ?? [];

// ---------------------------------------------------------------------------
// 1. Seletor "Relatório": "Meus relatórios" por perfil e "➕ Novo relatório…" no fim
// ---------------------------------------------------------------------------
const opMeu = await createCustomReport({ baseReportId: 'pesagens', name: 'Meu GMD', scope: 'PERSONAL' }, OPERADOR);
const opOutro = await createCustomReport({ baseReportId: 'desempenho', name: 'Abacate', scope: 'PERSONAL' }, OPERADOR);
const gestorEmpresa = await createCustomReport({ baseReportId: 'desempenho', name: 'Engorda da empresa', scope: 'SHARED' }, GESTOR);
const adminVendas = await createCustomReport({ baseReportId: 'comercial', name: 'Vendas da Ana', scope: 'PERSONAL' }, ADMIN);
const adminVendasEmpresa = await createCustomReport({ baseReportId: 'comercial', name: 'Vendas da empresa', scope: 'SHARED' }, ADMIN);
const cidaRebanho = await createCustomReport({ baseReportId: 'rebanho.atual', name: 'Rebanho da Cida', scope: 'PERSONAL' }, CONSULTA);

const EXPECTED_MINE = {
  ADMIN: ['Vendas da Ana', 'Engorda da empresa', 'Vendas da empresa'],
  GESTOR: ['Engorda da empresa', 'Vendas da empresa'],
  OPERADOR: ['Abacate', 'Meu GMD', 'Engorda da empresa'],
  CONSULTA: ['Rebanho da Cida', 'Engorda da empresa'],
};

await check('seletor: catálogo do perfil e, no fim, "Meus relatórios" (pessoais + da empresa) e "➕ Novo relatório…"', async () => {
  for (const actor of ACTORS) {
    const catalog = reportSelectorOptions(actor);
    const options = withMyReports(catalog, await listTemplates(actor), actor);
    assert.deepEqual(options.slice(0, catalog.length), catalog, `${actor.role}: o catálogo continua igual, antes`);
    const mine = mineOf(options);
    assert.deepEqual(options.slice(catalog.length), mine, `${actor.role}: "Meus relatórios" é o último grupo`);
    assert.ok(mine.every((option) => option.familyLabel === MY_REPORTS_LABEL), `${actor.role}: grupo "${MY_REPORTS_LABEL}"`);
    const last = options.at(-1);
    assert.deepEqual([last.value, last.label], [NEW_REPORT_VALUE, NEW_REPORT_LABEL], `${actor.role}: "➕ Novo relatório…" é a última opção`);
    const reports = mine.filter((option) => option.value !== NEW_REPORT_VALUE);
    assert.deepEqual(reports.map((option) => option.label), EXPECTED_MINE[actor.role], `${actor.role}: pessoais (por nome) e depois os da empresa`);
    for (const option of reports) {
      assert.equal(option.value, templateOptionValue(option.templateId), `${actor.role}: valor "m:<id>"`);
      assert.ok(canRunReport(getReportDefinition(option.baseReportId), actor.role), `${actor.role}: ${option.label} — base que o perfil abre`);
    }
    assert.equal(new Set(options.map((option) => option.value)).size, options.length, `${actor.role}: sem valor repetido`);
  }
});

await check('NEGATIVO: pessoal de outro usuário e relatório de base que o perfil não abre ficam fora', async () => {
  const everything = await storedTemplates();
  assert.equal(everything.length, 6);
  for (const actor of ACTORS) {
    // Mesmo com a lista crua (sem listTemplates), o grupo confere dono e base.
    const labels = myReportOptions(everything, actor).map((option) => option.label);
    assert.deepEqual(labels.slice(0, -1), EXPECTED_MINE[actor.role], `${actor.role}: só o que ele vê`);
  }
  for (const actor of [OPERADOR, CONSULTA]) {
    assert.ok(!mineOf(withMyReports(reportSelectorOptions(actor), await listTemplates(actor), actor)).some((option) => option.baseReportId === 'comercial'), `${actor.role}: nenhum relatório do Comercial`);
  }
  assert.deepEqual(myReportOptions([], null).map((option) => option.value), [NEW_REPORT_VALUE], 'sem relatórios: só "➕ Novo relatório…"');
});

await check('valor do seletor ↔ o que abrir (catálogo, relatório do usuário, Novo)', async () => {
  assert.deepEqual(parseReportOption('pesagens'), { kind: 'report', reportId: 'pesagens' });
  assert.deepEqual(parseReportOption(templateOptionValue(opMeu.id)), { kind: 'template', templateId: opMeu.id });
  assert.deepEqual(parseReportOption(NEW_REPORT_VALUE), { kind: 'new' });
  assert.equal(selectorValue('pesagens', null), 'pesagens', 'sem relatório do usuário: o id do relatório');
  assert.equal(selectorValue('pesagens', opMeu), templateOptionValue(opMeu.id), 'relatório do usuário aberto: ele no campo');
  const options = withMyReports(reportSelectorOptions(OPERADOR), [], OPERADOR);
  const withOpen = withTemplateOption(options, opMeu);
  assert.equal(withOpen.length, options.length + 1);
  assert.equal(withOpen.at(-2).value, templateOptionValue(opMeu.id), 'recém-salvo fora da lista: entra antes do "➕ Novo relatório…"');
  assert.equal(withOpen.at(-1).value, NEW_REPORT_VALUE);
  assert.equal(withTemplateOption(withOpen, opMeu), withOpen, 'já na lista: a mesma lista');
});

// ---------------------------------------------------------------------------
// 2. Criação com a seleção padrão da base — toda base de todo perfil
// ---------------------------------------------------------------------------
await check('bases do "Novo relatório" = o catálogo do perfil, agrupado por assunto', async () => {
  for (const actor of ACTORS) {
    const groups = newReportBases(actor);
    const catalog = reportSelectorOptions(actor);
    assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.value)), catalog.map((option) => option.value), `${actor.role}: as bases são o seletor`);
    assert.equal(new Set(groups.map((group) => group.family)).size, groups.length, `${actor.role}: um grupo por assunto`);
    assert.ok(groups.every((group) => group.label && group.items.length), `${actor.role}: grupos com rótulo`);
  }
});

let created = 0;
await check('criar em cada base: seleção padrão da base, abre igual a ela (sem "alterado") e roda', async () => {
  for (const actor of ACTORS) {
    for (const { value: baseId } of newReportBases(actor).flatMap((group) => group.items)) {
      const definition = getReportDefinition(baseId);
      const name = `Novo ${baseId}`;
      const saved = await createCustomReport({ baseReportId: baseId, name, scope: 'PERSONAL' }, actor);
      created += 1;
      assert.equal(saved.baseReportId, definition.id, `${actor.role}/${baseId}: base`);
      assert.deepEqual([saved.scope, saved.ownerUserId, saved.name], ['PERSONAL', actor.id, name], `${actor.role}/${baseId}: pessoal do autor`);
      const input = normalizeTemplateConfig(definition, newReportInput(definition, { name, scope: 'PERSONAL', role: actor.role }));
      assert.deepEqual(saved.columns, input.columns, `${actor.role}/${baseId}: colunas padrão da base`);
      assert.deepEqual(saved.groups, input.groups, `${actor.role}/${baseId}: agrupamento padrão`);
      for (const id of saved.columns) assert.ok(canSeeColumn(definition.columns.find((column) => column.id === id), actor.role), `${actor.role}/${baseId}: coluna ${id} visível ao autor`);
      const listed = (await listTemplates(actor)).find((item) => item.id === saved.id);
      const state = buildInitialReportState(definition, { template: listed, role: actor.role }).state;
      const baseline = reportSnapshot(definition, state, actor.role);
      assert.equal(baseline, reportSnapshot(definition, defaultReportState(definition, actor.role), actor.role), `${actor.role}/${baseId}: abre igual à base (tipo, colunas, filtros, período)`);
      assert.equal(isReportChanged(baseline, definition, state, actor.role), false, `${actor.role}/${baseId}: recém-aberto não está "alterado"`);
      const request = templateToRequest(listed, actor.role);
      const vm = await runReport(request.reportId, { today: TODAY, params: request.params, selection: request.selection, sheetTitle: listed.name }, actor);
      assert.equal(vm.reportId, definition.id, `${actor.role}/${baseId}: roda na base`);
      assert.match(sheetTitleOf(vm), new RegExp(`^Relatório de ${name.replace(/[.]/g, '\\.')} \\((Sintético|Analítico)\\)$`), `${actor.role}/${baseId}: título da folha com o nome`);
    }
  }
  assert.ok(created >= 36, `todas as bases dos 4 perfis (${created})`);
});

// ---------------------------------------------------------------------------
// 3. Nome e "Quem vê" (API criar)
// ---------------------------------------------------------------------------
await check('nome: obrigatório, até 80, único por base e escopo (sem diferença de maiúsculas)', async () => {
  const create = (actor, input) => code(() => createCustomReport(input, actor));
  assert.equal(await create(GESTOR, { baseReportId: 'pesagens', name: '   ' }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: sem nome');
  assert.equal(await create(GESTOR, { baseReportId: 'pesagens', name: 'x'.repeat(REPORT_NAME_MAX + 1) }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: 81 caracteres');
  assert.equal(await create(GESTOR, { baseReportId: 'pesagens', name: 'x'.repeat(REPORT_NAME_MAX) }), 'OK', '80 caracteres');
  assert.equal(await create(OPERADOR, { baseReportId: 'pesagens', name: '  meu gmd ' }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: repetido na mesma base e escopo (maiúsculas/espaços)');
  assert.equal(await create(OPERADOR, { baseReportId: 'saidas', name: 'Meu GMD' }), 'OK', 'mesmo nome em outra base');
  assert.equal(await create(GESTOR, { baseReportId: 'pesagens', name: 'Meu GMD' }), 'OK', 'mesmo nome, pessoal de outro usuário');
  assert.equal(await create(GESTOR, { baseReportId: 'desempenho', name: 'Engorda da empresa', scope: 'PERSONAL' }), 'OK', 'mesmo nome em outro escopo (pessoal × empresa)');
  assert.equal(await create(ADMIN, { baseReportId: 'desempenho', name: 'ENGORDA DA EMPRESA', scope: 'SHARED' }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: da empresa repetido, de outro autor');
  assert.equal(await create(GESTOR, { baseReportId: 'nao-existe', name: 'X' }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: base inexistente');
  assert.ok(canRunReport(getReportDefinition('controle.auditoria'), 'ADMIN'));
  assert.equal(await create(ADMIN, { baseReportId: 'controle.auditoria', name: 'Auditoria' }), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: base fora do catálogo (aba Controle da Manutenção)');
  assert.equal(await create(OPERADOR, { baseReportId: 'pesagens.pendencias', name: 'Pendências minhas' }), 'OK', 'OPERADOR: "Controle" está no catálogo dele');
});

await check('"Quem vê": "A empresa" só com reports.templates.share; base que o perfil não abre = proibido', async () => {
  for (const actor of ACTORS) {
    const result = await code(() => createCustomReport({ baseReportId: 'rebanho.atual', name: `Da empresa ${actor.role}`, scope: 'SHARED' }, actor));
    assert.equal(canShareReports(actor), can(actor.role, 'reports.templates.share'), `${actor.role}: canShareReports = a permissão`);
    assert.equal(result, canShareReports(actor) ? 'OK' : 'AUTH_FORBIDDEN', `${actor.role}: da empresa ${canShareReports(actor) ? 'pode' : 'NEGATIVO'}`);
  }
  assert.ok(!canShareReports(OPERADOR) && !canShareReports(CONSULTA) && canShareReports(ADMIN) && canShareReports(GESTOR), 'só ADMIN e GESTOR compartilham');
  assert.equal(await code(() => createCustomReport({ baseReportId: 'comercial', name: 'Vendas', scope: 'PERSONAL' }, CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: CONSULTA no Comercial');
  assert.equal(await code(() => createCustomReport({ baseReportId: 'pesagens', name: 'Sem ator' }, null)), 'AUTH_FORBIDDEN', 'NEGATIVO: sem sessão');
});

await check('reportNameError (diálogo) = a regra do serviço', async () => {
  const templates = await listTemplates(OPERADOR);
  const base = { templates, baseReportId: 'pesagens', scope: 'PERSONAL', actor: OPERADOR };
  assert.equal(reportNameError('', base), 'Informe o nome do relatório.');
  assert.equal(reportNameError('x'.repeat(81), base), 'Nome com mais de 80 caracteres.');
  assert.equal(reportNameError(' MEU gmd ', base), 'Você já tem um relatório com esse nome nesta base.');
  assert.equal(reportNameError('Meu GMD', { ...base, baseReportId: 'rebanho.atual' }), null, 'outra base: ok');
  assert.equal(reportNameError('Meu GMD', { ...base, exceptId: opMeu.id }), null, 'renomear para o próprio nome: ok');
  const gestor = await listTemplates(GESTOR);
  assert.equal(reportNameError('engorda da empresa', { templates: gestor, baseReportId: 'desempenho', scope: 'SHARED', actor: ADMIN }), 'Já existe um relatório da empresa com esse nome nesta base.');
  assert.equal(reportNameError('Novo nome', base), null);
});

// ---------------------------------------------------------------------------
// 4. Renomear e Excluir: dono, escopo e permissão
// ---------------------------------------------------------------------------
await check('Renomear: só o nome muda; pessoal só o dono; da empresa quem compartilha; nome único', async () => {
  const before = (await storedTemplates()).find((item) => item.id === opMeu.id);
  const renamed = await renameTemplate(opMeu.id, '  GMD dos machos ', OPERADOR, { now: '2026-09-30T12:00:00.000Z' });
  assert.equal(renamed.name, 'GMD dos machos');
  const after = (await storedTemplates()).find((item) => item.id === opMeu.id);
  const { name: _n1, updatedAt: _u1, updatedBy: _b1, ...restBefore } = before;
  const { name: _n2, updatedAt: _u2, updatedBy: _b2, ...restAfter } = after;
  assert.deepEqual(restAfter, restBefore, 'configuração, dono, escopo e criação intactos');
  assert.equal(after.updatedAt, '2026-09-30T12:00:00.000Z');
  assert.equal(await code(() => renameTemplate(opMeu.id, 'Invasão', ADMIN)), 'AUTH_FORBIDDEN', 'NEGATIVO: ADMIN não renomeia pessoal alheio');
  assert.equal(await code(() => renameTemplate(gestorEmpresa.id, 'Invasão', OPERADOR)), 'AUTH_FORBIDDEN', 'NEGATIVO: OPERADOR não renomeia da empresa');
  assert.equal(await code(() => renameTemplate(adminVendasEmpresa.id, 'Vendas (empresa)', GESTOR)), 'OK', 'GESTOR renomeia da empresa de outro autor');
  assert.equal(await code(() => renameTemplate(adminVendasEmpresa.id, 'Vendas (empresa)', CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: CONSULTA (nem abre o Comercial)');
  assert.equal(await code(() => renameTemplate(opOutro.id, 'gmd DOS MACHOS', OPERADOR)), 'OK', 'mesmo nome em outra base');
  assert.equal(await code(() => createCustomReport({ baseReportId: 'pesagens', name: 'Segundo', scope: 'PERSONAL' }, OPERADOR)), 'OK');
  const segundo = (await listTemplates(OPERADOR)).find((item) => item.name === 'Segundo');
  assert.equal(await code(() => renameTemplate(segundo.id, 'GMD DOS MACHOS', OPERADOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: nome repetido na base');
  assert.equal(await code(() => renameTemplate(opMeu.id, 'gmd dos MACHOS', OPERADOR)), 'OK', 'o próprio nome com outra caixa');
  assert.equal(await code(() => renameTemplate(opMeu.id, ' ', OPERADOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: vazio');
  assert.equal(await code(() => renameTemplate(opMeu.id, 'y'.repeat(81), OPERADOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: 81');
  assert.equal(await code(() => renameTemplate('nao-existe', 'X', OPERADOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: inexistente');
  await renameTemplate(opMeu.id, 'Meu GMD', OPERADOR);
});

await check('canEditReport (Salvar alterações/Renomear/Excluir) = as regras do serviço', async () => {
  const pairs = [[opMeu, OPERADOR, true], [opMeu, ADMIN, false], [gestorEmpresa, GESTOR, true], [gestorEmpresa, ADMIN, true], [gestorEmpresa, OPERADOR, false], [gestorEmpresa, CONSULTA, false], [cidaRebanho, CONSULTA, true], [cidaRebanho, GESTOR, false]];
  for (const [template, actor, expected] of pairs) assert.equal(canEditReport(template, actor), expected, `${template.name} × ${actor.role}`);
  assert.equal(canEditReport(null, ADMIN), false, 'sem relatório aberto');
});

await check('Excluir: só o dono (pessoal) ou quem compartilha (empresa); sai do seletor', async () => {
  assert.equal(await code(() => deleteTemplate(cidaRebanho.id, ADMIN)), 'AUTH_FORBIDDEN', 'NEGATIVO: ADMIN não exclui pessoal alheio');
  assert.equal(await code(() => deleteTemplate(gestorEmpresa.id, OPERADOR)), 'AUTH_FORBIDDEN', 'NEGATIVO: OPERADOR não exclui da empresa');
  assert.equal(await code(() => deleteTemplate(cidaRebanho.id, CONSULTA)), 'OK', 'a dona exclui o dela');
  assert.equal(await code(() => deleteTemplate(adminVendasEmpresa.id, GESTOR)), 'OK', 'GESTOR exclui da empresa');
  const consulta = mineOf(withMyReports(reportSelectorOptions(CONSULTA), await listTemplates(CONSULTA), CONSULTA)).map((option) => option.templateId);
  assert.ok(!consulta.includes(cidaRebanho.id), 'excluído sai de "Meus relatórios"');
  assert.ok(!(await storedTemplates()).some((item) => [cidaRebanho.id, adminVendasEmpresa.id].includes(item.id)), 'fora do armazenamento');
});

// ---------------------------------------------------------------------------
// 5. "Salvar alterações": detecção de alteração, ida e volta, último estado
// ---------------------------------------------------------------------------
const openTemplate = async (actor, id) => {
  const listed = (await listTemplates(actor)).find((item) => item.id === id);
  return { listed, state: buildInitialReportState(getReportDefinition(listed.baseReportId), { template: listed, role: actor.role }).state };
};

await check('alterado = difere do que está salvo (filtro, colunas, tipo, período, larguras, orientação)', async () => {
  const { state } = await openTemplate(OPERADOR, opMeu.id);
  const baseline = reportSnapshot(PESAGENS, state, 'OPERADOR');
  const changed = (patch) => isReportChanged(baseline, PESAGENS, { ...state, ...patch }, 'OPERADOR');
  assert.equal(changed({}), false, 'recém-aberto');
  assert.equal(changed({ uiFilters: { sexo: { operator: 'in', value: '', valueTo: '', values: ['Macho'] } } }), true, 'filtro');
  assert.equal(changed({ uiFilters: {} }), false, 'filtro tirado de novo');
  const a = { sexo: { operator: 'in', value: '', valueTo: '', values: ['Macho'] }, raca: { operator: 'in', value: '', valueTo: '', values: ['Nelore'] } };
  const b = { raca: a.raca, sexo: a.sexo };
  assert.equal(reportSnapshot(PESAGENS, { ...state, uiFilters: a }, 'OPERADOR'), reportSnapshot(PESAGENS, { ...state, uiFilters: b }, 'OPERADOR'), 'mesmos filtros em outra ordem = igual');
  assert.equal(changed({ widths: { peso: 140 } }), true, 'largura de coluna');
  assert.equal(changed({ orientation: 'portrait' }), true, 'orientação');
  assert.equal(changed({ params: { ...state.params, periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-08-31' } } }), true, 'período');
  const analitico = typedViewSelection(PESAGENS, 'analitico', null);
  assert.equal(changed({ view: analitico.view, groups: analitico.groups, mode: analitico.mode, columns: analitico.columns, aggregates: analitico.aggregates, sort: analitico.sort, summarySort: null }), true, 'tipo');
  assert.equal(changed({ columns: [...state.columns].reverse() }), true, 'ordem das colunas');
  assert.equal(changed({ showEmptyColumns: true, showDetails: true, detailSheet: true }), false, 'NEGATIVO: "Mostrar colunas vazias"/"Mostrar Detalhes" não vão para o modelo');
  assert.equal(changed({ drill: [{ columnId: 'nome_lote', key: 'Lote 01' }], mode: 'DETALHADO' }), false, 'NEGATIVO: detalhe de um grupo é passageiro');
  assert.equal(isReportChanged(null, PESAGENS, { ...state, orientation: 'portrait' }, 'OPERADOR'), false, 'sem relatório do usuário aberto: nunca "alterado"');
});

await check('Salvar alterações: grava a tela; reabre igual; o último estado nunca grava no modelo', async () => {
  const { listed, state } = await openTemplate(OPERADOR, opMeu.id);
  const edited = { ...state, uiFilters: { sexo: { operator: 'in', value: '', valueTo: '', values: ['Macho'] } }, widths: { peso: 150 }, orientation: 'portrait' };
  // O último estado da base (sem "Salvar") não mexe no modelo.
  const before = JSON.stringify((await storedTemplates()).find((item) => item.id === opMeu.id));
  await saveReportViewState('pesagens', viewStatePayload(PESAGENS, edited, 'OPERADOR'), OPERADOR);
  assert.equal(JSON.stringify((await storedTemplates()).find((item) => item.id === opMeu.id)), before, 'último estado não sobrescreve o modelo');
  // "Salvar alterações" = saveTemplate com o mesmo id, nome e escopo.
  const saved = await saveTemplate({ id: listed.id, name: listed.name, scope: listed.scope, ...templatePayload(PESAGENS, edited, 'OPERADOR') }, OPERADOR);
  assert.deepEqual([saved.id, saved.name, saved.scope, saved.ownerUserId], [listed.id, listed.name, listed.scope, OPERADOR.id], 'o mesmo relatório');
  const reopened = await openTemplate(OPERADOR, opMeu.id);
  const snapshot = reportSnapshot(PESAGENS, reopened.state, 'OPERADOR');
  assert.equal(snapshot, reportSnapshot(PESAGENS, edited, 'OPERADOR'), 'reabre exatamente como foi salvo');
  assert.equal(isReportChanged(snapshot, PESAGENS, reopened.state, 'OPERADOR'), false, 'depois de salvar, sem alteração');
  assert.deepEqual(reopened.state.widths, { peso: 150 }, 'largura guardada');
  // Salvar como… = outro relatório (sem id); o aberto não muda.
  const copy = await saveTemplate({ name: 'Meu GMD (cópia)', scope: 'PERSONAL', ...templatePayload(PESAGENS, { ...edited, orientation: 'landscape' }, 'OPERADOR') }, OPERADOR);
  assert.notEqual(copy.id, opMeu.id);
  assert.equal((await openTemplate(OPERADOR, opMeu.id)).state.orientation, 'portrait', 'Salvar como… não mexe no original');
  // Da empresa aberto por quem não compartilha: não salva (a tela nem mostra o botão).
  const { listed: empresa, state: empresaState } = await openTemplate(OPERADOR, gestorEmpresa.id);
  const definition = getReportDefinition(empresa.baseReportId);
  assert.equal(await code(() => saveTemplate({ id: empresa.id, name: empresa.name, scope: empresa.scope, ...templatePayload(definition, { ...empresaState, orientation: 'portrait' }, 'OPERADOR') }, OPERADOR)), 'AUTH_FORBIDDEN', 'NEGATIVO: OPERADOR não altera o da empresa');
});

// ---------------------------------------------------------------------------
// 6. Título "Relatório de <nome>" (tela e folha), sem campo novo no modelo
// ---------------------------------------------------------------------------
await check('título: tela e folha com o nome do relatório do usuário; sem ele, o de sempre', async () => {
  for (const definition of listAllReportDefinitions()) {
    assert.equal(reportTitle(definition), `Relatório de ${definition.sheetTitle ?? definition.title}`, `${definition.id}: título de sempre`);
  }
  assert.equal(reportTitle(PESAGENS, { name: 'Meu GMD' }), 'Relatório de Meu GMD');
  const { listed } = await openTemplate(OPERADOR, opMeu.id);
  const request = templateToRequest(listed, 'OPERADOR');
  const plain = await runReport('pesagens', { today: TODAY, params: request.params, selection: request.selection }, OPERADOR);
  assert.equal(sheetTitleOf(plain), 'Relatório de Pesagens Individuais (Sintético)', 'sem nome: a folha de sempre');
  const blank = await runReport('pesagens', { today: TODAY, params: request.params, selection: request.selection, sheetTitle: '   ' }, OPERADOR);
  assert.equal(blank.sheetTitle, plain.sheetTitle, 'nome em branco é ignorado');
  const vm = await runReport('pesagens', { today: TODAY, params: request.params, selection: request.selection, sheetTitle: listed.name, reuse: plain }, OPERADOR);
  assert.equal(vm.sheetTitle, 'Meu GMD');
  assert.equal(vm.reportName, plain.reportName, 'nome do relatório (manifesto, arquivo) continua o da base');
  assert.equal(buildReportDocument(vm).title, 'Relatório de Meu GMD (Sintético)', 'folha');
  // Impressão/PDF (OPERADOR não exporta: o mesmo relatório emitido por quem exporta).
  const forPrint = await runReport('pesagens', { today: TODAY, params: request.params, selection: request.selection, sheetTitle: listed.name }, GESTOR);
  const printed = preparePrint(forPrint, GESTOR, { orientation: 'landscape' });
  assert.ok(printed.html.includes('Relatório de Meu GMD (Sintético)'), 'impressão/PDF com o nome');
  // E1G: + defaultsVersion (revisão dos padrões dos tipos com que o modelo foi gravado).
  const keys = new Set(['version', 'id', 'name', 'baseReportId', 'baseReportVersion', 'defaultsVersion', 'scope', 'ownerUserId', 'ownerName', 'columns', 'filters', 'fixedFilters', 'groups', 'aggregates', 'sort', 'mode', 'summarySort', 'period', 'params', 'search', 'widths', 'orientation', 'view', 'matrix', 'sortChoice', 'createdAt', 'updatedAt', 'updatedBy']);
  for (const template of await storedTemplates()) {
    for (const key of Object.keys(template)) assert.ok(keys.has(key), `modelo sem campo novo (${key})`);
  }
});

// ---------------------------------------------------------------------------
// 7. Nunca amplia permissão
// ---------------------------------------------------------------------------
await check('relatório do usuário nunca amplia permissão', async () => {
  // OPERADOR no tipo Vendas de Pesagens: salva sem Valor @/Valor Total (o recorte do autor).
  const { listed, state } = await openTemplate(OPERADOR, opMeu.id);
  const vendas = typedViewSelection(PESAGENS, 'vendas', null);
  const vendasState = { ...state, view: vendas.view, matrix: null, groups: vendas.groups, mode: vendas.mode, columns: vendas.columns, aggregates: vendas.aggregates, sort: vendas.sort, summarySort: null };
  const saved = await saveTemplate({ id: listed.id, name: listed.name, scope: listed.scope, ...templatePayload(PESAGENS, vendasState, 'OPERADOR') }, OPERADOR);
  assert.ok(!saved.columns.some((id) => !canSeeColumn(PESAGENS.columns.find((column) => column.id === id), 'OPERADOR')), 'sem coluna de valor');
  // Da empresa com valores (ADMIN) aberto por CONSULTA: as colunas de valor saem ao abrir.
  const adminState = { ...defaultReportState(PESAGENS, 'ADMIN'), view: vendas.view, matrix: null, groups: vendas.groups, mode: vendas.mode, columns: vendas.columns, aggregates: vendas.aggregates, sort: vendas.sort };
  const shared = await saveTemplate({ name: 'Vendas com valor', scope: 'SHARED', ...templatePayload(PESAGENS, adminState, 'ADMIN') }, ADMIN);
  assert.ok(shared.columns.includes('valor_venda_calc'), 'ADMIN vê o valor');
  const forConsulta = (await listTemplates(CONSULTA)).find((item) => item.id === shared.id);
  assert.ok(forConsulta && !forConsulta.columns.includes('valor_venda_calc'), 'CONSULTA recebe o modelo sem a coluna de valor');
  const request = templateToRequest(forConsulta, 'CONSULTA');
  const vm = await runReport(request.reportId, { today: TODAY, params: request.params, selection: request.selection, sheetTitle: forConsulta.name }, CONSULTA);
  assert.ok(!vm.columns.some((column) => ['valor_arroba', 'valor_venda_calc', 'valor_venda_total'].includes(column.id)), 'NEGATIVO: nenhum valor na folha da CONSULTA');
  assert.equal(await code(() => saveTemplate({ baseReportId: 'pesagens', name: 'Tentativa', scope: 'PERSONAL', columns: ['valor_venda_total'] }, OPERADOR)), 'AUTH_FORBIDDEN', 'NEGATIVO: autor não grava coluna que não vê');
});

// ---------------------------------------------------------------------------
// 8. Checagens mínimas de texto da tela
// ---------------------------------------------------------------------------
await check('tela: seletor com Meus relatórios, diálogo Novo relatório, Salvar alterações, ⋯ Salvar como/Renomear/Excluir', async () => {
  const page = read('src/pages/Relatorios.jsx');
  assert.match(page, /reportOptions=\{withMyReports\(withCurrentOption\(options, resolved\.definition\), myTemplates, actor\)\}/, 'seletor com "Meus relatórios"');
  assert.match(page, /const choice = parseReportOption\(value\);/, 'valor do seletor decide o que abrir');
  assert.match(page, /if \(choice\.kind === "new"\) \{ setNewReportOpen\(true\); return; \}/, '"➕ Novo relatório…" abre o diálogo');
  assert.match(page, /createCustomReport\(\{ baseReportId, name, scope \}, actor\)[\s\S]{0,300}open\(saved\.baseReportId, saved\)/, 'criar abre o relatório (&m=)');
  assert.match(page, /<NewReportDialog[\s\S]{0,120}mode="new"/, 'diálogo Novo relatório');
  const dialog = read('src/components/reports/NewReportDialog.jsx');
  for (const text of ['Novo relatório', '>Nome<', '>Base<', 'Quem vê', 'Só eu', 'A empresa', 'Salvar como…', 'Renomear relatório']) assert.ok(dialog.includes(text), `diálogo: ${text}`);
  assert.match(dialog, /disabled=\{!canShare\}/, '"A empresa" só com share');
  assert.match(dialog, /maxLength=\{REPORT_NAME_MAX\}/, 'nome até 80');
  assert.match(dialog, /reportNameError\(name,/, 'nome conferido como no serviço');
  const screen = read('src/components/reports/MakgestaoScreen.jsx');
  assert.match(screen, /\{onSaveChanges \? \([\s\S]{0,400}Salvar alterações[\s\S]{0,200}\{canExport \? \([\s\S]{0,80}rpt-mak-print/, '"Salvar alterações" ao lado do Imprimir');
  for (const text of ['Salvar como…', 'Renomear…', '(empresa)']) assert.ok(screen.includes(text), `tela: ${text}`);
  const view = read('src/components/reports/ReportView.jsx');
  assert.match(view, /title=\{reportTitle\(definition, currentTemplate\)\}/, 'título "Relatório de <nome>"');
  assert.match(view, /presetId: preset && !template \? presetId : null,\s*sheetTitle,/, 'nome no título da folha (pedido do runReport)');
  assert.match(view, /onSaveChanges=\{editableTemplate && unsaved \? saveChanges : null\}/, '"Salvar alterações" só com alteração e permissão');
  assert.match(view, /const tracksViewState = allowPreferences && !template && !preset;/, 'NEGATIVO: com relatório do usuário aberto, o último estado não grava');
  assert.match(view, /value: selectorValue\(definition\.id, currentTemplate\)/, 'campo "Relatório" mostra o relatório do usuário');
  // Sair com alteração não salva pergunta antes (voltar e trocar de relatório), e "Salvar e sair" só sai se gravou.
  assert.match(view, /onBack=\{guardLeave\(onBack\)\}/, 'voltar pergunta "Salvar as alterações?"');
  assert.match(view, /onChange: guardLeave\(onSelectReport\)/, 'trocar de relatório pergunta "Salvar as alterações?"');
  assert.match(view, /if \(editableTemplate && unsaved\) setPendingLeave/, 'só pergunta com alteração não salva e permissão');
  assert.match(view, /if \(await saveChanges\(\)\) \{ setPendingLeave\(null\); go\?\.\(\); \}/, '"Salvar e sair" só sai depois de gravar');
});

// E1F: o relatório do usuário sai com o nome dele no arquivo e no Excel (título e aba); sem nome, o da base.
{
  const { exportFileName } = await import('../src/modules/reporting/application/reportExportService.js');
  const { buildXlsx, unzipStored } = await import('../src/modules/reporting/infrastructure/exporters/xlsxExporter.js');
  const nomeado = await runReport('pesagens', { today: TODAY, sheetTitle: 'Pesagem por Marca' }, ADMIN);
  assert.equal(nomeado.exportName, 'Pesagem por Marca', 'view model leva o nome do relatório do usuário');
  assert.match(exportFileName(nomeado, 'xlsx'), /^pesagem-por-marca_\d{8}-\d{6}_[0-9a-f-]{8}\.xlsx$/, 'arquivo com o nome do relatório do usuário');
  const files = unzipStored(buildXlsx(nomeado, {}));
  assert.ok(files['xl/workbook.xml'].includes('name="Pesagem por Marca"'), 'aba do Excel com o nome');
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('Pesagem por Marca'), 'título do Excel com o nome');
  const base = await runReport('pesagens', { today: TODAY }, ADMIN);
  assert.equal(base.exportName, null, 'NEGATIVO: sem relatório do usuário, sem nome próprio');
  assert.match(exportFileName(base, 'xlsx'), /^pesagens_/, 'NEGATIVO: a base sai com o nome dela');
  checks.push('nome do relatório do usuário no arquivo e no Excel');
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:novo-relatorio:verify', ok: true, created, checks }, null, 2));
