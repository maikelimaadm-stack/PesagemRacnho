// Gate reports:tela-unica:verify (E1E, parte S) — Relatórios numa tela só, a do MAKGESTAO, com o campo
// "Relatório": opções do seletor por perfil, relatório inicial (último usado; sem histórico, Pesagens),
// campos do cartão por relatório (período × estado atual, Pesagem Anterior, parâmetros, botões de filtro,
// Ordenar Por) e as checagens mínimas de texto da tela (Relatorios.jsx, ReportView.jsx, MakgestaoScreen.jsx).
// As funções conferidas são as MESMAS que a tela usa (application/reportScreenModel.js).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, resetDb } from './lib/reportFixtures.mjs';
import { can } from '../src/modules/auth/domain/permissionService.js';
import { listReports } from '../src/modules/reporting/application/reportService.js';
import { getRecents, recordRecent } from '../src/modules/reporting/application/reportTemplateService.js';
import {
  DEFAULT_REPORT_ID, FAMILY_ORDER, FILTER_BUTTONS, MAK_FILTER_BUTTONS, PREVIOUS_COLUMN,
  cardFieldsOf, filterButtonsOf, initialReportId, reportSelectorOptions, withCurrentOption,
} from '../src/modules/reporting/application/reportScreenModel.js';
import { LEGACY_REPORT_ALIASES } from '../src/modules/reporting/definitions/legacyAliases.js';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { REPORT_VISIBILITY } from '../src/modules/reporting/domain/reportDefinition.js';
import { canRunReport, canSeeColumn } from '../src/modules/reporting/domain/reportPermissions.js';

const ACTORS = [ADMIN, GESTOR, OPERADOR, CONSULTA];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ids = (options) => options.map((option) => option.value);
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

// ---------------------------------------------------------------------------
// 1. Opções do campo "Relatório" por perfil
// ---------------------------------------------------------------------------
const optionsOf = Object.fromEntries(ACTORS.map((actor) => [actor.role, reportSelectorOptions(actor)]));

check('seletor = catálogo do perfil (sem bloqueados, sem repetidos, por família)', () => {
  for (const actor of ACTORS) {
    const options = optionsOf[actor.role];
    const expected = listReports(actor).filter((item) => item.available).map((item) => item.id);
    assert.deepEqual([...ids(options)].sort(), [...expected].sort(), `${actor.role}: as opções são o catálogo que o perfil abre`);
    assert.equal(new Set(ids(options)).size, options.length, `${actor.role}: sem opção repetida`);
    const ranks = options.map((option) => FAMILY_ORDER.indexOf(option.family));
    assert.ok(ranks.every((rank) => rank >= 0), `${actor.role}: toda opção tem família conhecida`);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${actor.role}: opções agrupadas na ordem das famílias`);
    for (const option of options) {
      const definition = getReportDefinition(option.value);
      assert.equal(definition?.id, option.value, `${actor.role}: ${option.value} é id atual (não alias)`);
      assert.ok(canRunReport(definition, actor.role), `${actor.role}: ${option.value} o perfil abre`);
      assert.notEqual(definition.status, 'blocked', `${actor.role}: ${option.value} não é bloqueado`);
      assert.notEqual(definition.visibility, REPORT_VISIBILITY.HIDDEN, `${actor.role}: ${option.value} não é oculto`);
      assert.ok(option.label && option.familyLabel, `${actor.role}: ${option.value} com rótulo e família`);
    }
    assert.ok(ids(options).includes(DEFAULT_REPORT_ID), `${actor.role}: Pesagens no seletor`);
    for (const hidden of listAllReportDefinitions().filter((definition) => definition.visibility === REPORT_VISIBILITY.HIDDEN)) {
      assert.ok(!ids(options).includes(hidden.id), `${actor.role}: ${hidden.id} (oculto/bloqueado) fora do seletor`);
    }
  }
});

check('Comercial só com commercial.values', () => {
  for (const actor of ACTORS) {
    const commercial = optionsOf[actor.role].filter((option) => option.family === 'comercial');
    if (can(actor.role, 'commercial.values')) assert.ok(commercial.length > 0, `${actor.role}: vê o Comercial`);
    else assert.equal(commercial.length, 0, `${actor.role}: NEGATIVO — sem Comercial`);
  }
  // Depois da parte C (definição única "comercial"): os ids antigos saem do seletor.
  if (getReportDefinition('comercial')?.id === 'comercial' && getReportDefinition('comercial').visibility === REPORT_VISIBILITY.CATALOG) {
    for (const actor of [ADMIN, GESTOR]) {
      assert.ok(ids(optionsOf[actor.role]).includes('comercial'), `${actor.role}: "Comercial" no seletor`);
      for (const old of ['comercial.vendas', 'comercial.abates', 'comercial.compras']) assert.ok(!ids(optionsOf[actor.role]).includes(old), `${actor.role}: ${old} fora do seletor (é tipo do Comercial)`);
    }
  }
});

check('"Controle" no seletor para quem não abre a Manutenção', () => {
  for (const actor of ACTORS) {
    const control = optionsOf[actor.role].filter((option) => getReportDefinition(option.value).visibility === REPORT_VISIBILITY.MAINTENANCE);
    if (can(actor.role, 'maintenance.backup')) assert.equal(control.length, 0, `${actor.role}: relatórios de controle ficam na aba da Manutenção`);
    else {
      assert.ok(control.length > 0, `${actor.role}: vê os relatórios de controle que pode abrir`);
      assert.ok(control.every((option) => option.family === 'controle' && option.familyLabel === 'Controle'), `${actor.role}: na família Controle`);
      assert.ok(ids(control).includes('pesagens.pendencias'), `${actor.role}: Pendências de pesagem`);
    }
  }
});

check('relatório aberto por link fora do seletor entra no fim (sem repetir)', () => {
  const admin = optionsOf.ADMIN;
  const auditoria = getReportDefinition('controle.auditoria');
  const extended = withCurrentOption(admin, auditoria);
  assert.equal(extended.length, admin.length + 1);
  assert.deepEqual(extended.at(-1), { value: 'controle.auditoria', label: auditoria.title, family: 'controle', familyLabel: 'Controle', extra: true });
  assert.equal(withCurrentOption(admin, getReportDefinition('pesagens')), admin, 'já no seletor: a mesma lista');
});

// ---------------------------------------------------------------------------
// 2. Relatório inicial (/Relatorios sem ?r=)
// ---------------------------------------------------------------------------
check('relatório inicial: último usado; sem histórico, Pesagens', () => {
  const admin = optionsOf.ADMIN;
  const consulta = optionsOf.CONSULTA;
  assert.equal(initialReportId([], admin), 'pesagens', 'sem histórico: Pesagens');
  assert.equal(initialReportId(undefined, admin), 'pesagens', 'recentes ilegíveis: Pesagens');
  assert.equal(initialReportId([{ reportId: 'desempenho' }, { reportId: 'saidas' }], admin), 'desempenho', 'o mais recente');
  assert.equal(initialReportId([{ reportId: 'nao-existe' }, { reportId: 'saidas' }], admin), 'saidas', 'id desconhecido: pula');
  const commercialId = ids(admin).find((id) => getReportDefinition(id).family === 'comercial');
  assert.equal(initialReportId([{ reportId: commercialId }, { reportId: 'rebanho.atual' }], consulta), 'rebanho.atual', 'NEGATIVO: CONSULTA não abre o Comercial nem pelo recente');
  assert.equal(initialReportId([{ reportId: 'controle.auditoria' }], admin), 'pesagens', 'recente fora do seletor (aba Controle): Pesagens');
  const [legacyId, legacy] = Object.entries(LEGACY_REPORT_ALIASES).find(([, alias]) => alias.id === 'desempenho');
  assert.equal(initialReportId([{ reportId: legacyId }], admin), 'desempenho', `id antigo (${legacyId}) vale pelo novo (${legacy.id})`);
  const semPesagens = admin.filter((option) => option.value !== 'pesagens');
  assert.equal(initialReportId([], semPesagens), semPesagens[0].value, 'sem Pesagens no perfil: o primeiro do seletor');
});

// Ponta a ponta com o serviço de recentes (o que Relatorios.jsx faz): abrir grava o recente; sem ?r= volta nele.
await resetDb();
assert.equal(initialReportId(await getRecents(GESTOR), optionsOf.GESTOR), 'pesagens', 'banco novo: Pesagens');
await recordRecent('rebanho.atual', GESTOR);
assert.equal(initialReportId(await getRecents(GESTOR), optionsOf.GESTOR), 'rebanho.atual', 'depois de abrir Rebanho atual: Rebanho atual');
await recordRecent('desempenho', GESTOR);
assert.equal(initialReportId(await getRecents(GESTOR), optionsOf.GESTOR), 'desempenho', 'o último aberto');
assert.equal(initialReportId(await getRecents(OPERADOR), optionsOf.OPERADOR), 'pesagens', 'recentes são por usuário');
await resetDb();
checks.push('relatório inicial pelos recentes gravados (recordRecent → getRecents)');

// ---------------------------------------------------------------------------
// 3. Campos do cartão por relatório
// ---------------------------------------------------------------------------
const fieldIds = (definitionId, options = {}) => cardFieldsOf(getReportDefinition(definitionId), { role: 'ADMIN', ...options }).fields.map((field) => field.id);

check('Pesagens: campos da E1D + Relatório, as 8 ordenações e os botões do antigo', () => {
  assert.deepEqual(fieldIds('pesagens'), ['relatorio', 'inicio', 'fim', 'orientacao', 'tipo', 'ordenar', 'anterior']);
  assert.deepEqual(fieldIds('pesagens', { viewId: 'sintetico-matriz' }), ['relatorio', 'inicio', 'fim', 'orientacao', 'tipo', 'linhas', 'colunas', 'ordenar', 'anterior'], 'Sintético (Matriz): Linhas/Colunas depois do tipo');
  const card = cardFieldsOf(getReportDefinition('pesagens'), { role: 'ADMIN' });
  assert.equal(card.sort, 'makgestao', 'Ordenar Por = as 8 do MAKGESTAO');
  assert.deepEqual(card.filterButtons, ['Lotes', 'Apartações', 'Sexo', 'Raças', 'Era', 'Marcas', 'Status'], 'botões da E1D, na ordem');
  assert.ok(!card.filterButtons.includes('Categoria') && !card.filterButtons.includes('Proprietário'), 'NEGATIVO: Pesagens sem Categoria/Proprietário');
  assert.deepEqual(card.quickFilters, [], 'Pesagens como a E1D: sem filtro rápido');
  assert.deepEqual(card.fields.map((field) => field.label), ['Relatório', 'Data Início', 'Data Fim', 'Orientação', 'Tipo Relatório', 'Ordenar Por', 'Pesagem Anterior']);
});

check('sem período: "Estado atual (hoje)" no lugar das datas', () => {
  for (const id of ['rebanho.atual', 'rebanho.ocupacao-lotes']) {
    const fields = fieldIds(id);
    assert.equal(fields[1], 'estado-atual', `${id}: estado atual`);
    assert.ok(!fields.includes('inicio') && !fields.includes('fim'), `${id}: NEGATIVO — sem Data Início/Fim`);
  }
  for (const id of ['desempenho', 'saidas', 'movimentacao.lotes']) assert.deepEqual(fieldIds(id).slice(1, 3), ['inicio', 'fim'], `${id}: com período`);
});

check('todos os relatórios do seletor: mesmo cartão, campos conforme o relatório', () => {
  for (const actor of ACTORS) {
    for (const option of optionsOf[actor.role]) {
      const definition = getReportDefinition(option.value);
      const card = cardFieldsOf(definition, { role: actor.role });
      const fields = card.fields.map((field) => field.id);
      const hasPeriod = definition.params.some((param) => param.type === 'period');
      assert.equal(fields[0], 'relatorio', `${option.value}: "Relatório" é o primeiro campo`);
      assert.deepEqual(fields.slice(1, hasPeriod ? 3 : 2), hasPeriod ? ['inicio', 'fim'] : ['estado-atual'], `${option.value}: período`);
      for (const field of ['orientacao', 'tipo', 'ordenar']) assert.ok(fields.includes(field), `${option.value}: ${field}`);
      const seesPrevious = definition.columns.some((column) => column.id === PREVIOUS_COLUMN && canSeeColumn(column, actor.role));
      assert.equal(fields.includes('anterior'), seesPrevious, `${option.value}: Pesagem Anterior só com a coluna`);
      assert.equal(card.sort, definition.sortChoices?.length ? 'makgestao' : 'e1b', `${option.value}: Ordenar Por (8 do MAKGESTAO só com sortChoices)`);
      const visible = definition.columns.filter((column) => canSeeColumn(column, actor.role));
      const list = definition.screen === 'makgestao' ? MAK_FILTER_BUTTONS : FILTER_BUTTONS;
      const expected = list.filter((button) => button.ids.some((id) => visible.some((column) => column.id === id))).map((button) => button.label);
      assert.deepEqual(card.filterButtons, expected, `${option.value}: botões de filtro das colunas que existem`);
      for (const label of ['Categoria', 'Proprietário']) {
        const column = FILTER_BUTTONS.find((button) => button.label === label).ids[0];
        if (definition.screen !== 'makgestao') assert.equal(card.filterButtons.includes(label), visible.some((item) => item.id === column), `${option.value}: ${label} só quando a coluna existe`);
      }
      assert.deepEqual(card.quickFilters, definition.screen === 'makgestao' ? [] : (definition.quickFilters ?? []).map((quick) => quick.label), `${option.value}: filtros rápidos do relatório`);
    }
  }
  const rebanho = cardFieldsOf(getReportDefinition('rebanho.atual'), { role: 'ADMIN' });
  assert.ok(rebanho.filterButtons.includes('Categoria'), 'Rebanho atual: Categoria (a coluna existe)');
  assert.deepEqual(rebanho.quickFilters, ['Sem pesagem há mais de 30 dias']);
  assert.deepEqual(cardFieldsOf(getReportDefinition('saidas'), { role: 'ADMIN' }).quickFilters, ['Somente mortes']);
});

check('parâmetro inteiro vira campo do cartão (ex.: dias)', () => {
  const base = getReportDefinition('rebanho.atual');
  const withDays = { ...base, params: [...base.params, { id: 'dias', type: 'integer', label: 'Dias sem pesagem', default: 30, min: 1 }] };
  const card = cardFieldsOf(withDays, { role: 'ADMIN' });
  assert.deepEqual(card.fields.at(-1), { id: 'param:dias', label: 'Dias sem pesagem' });
  assert.ok(!fieldIds('rebanho.atual').some((id) => id.startsWith('param:')), 'NEGATIVO: parâmetro de faixas (ranges) não é campo');
});

check('botões de filtro: a coluna é a primeira que o relatório tem', () => {
  const columns = [{ id: 'lote_atual' }, { id: 'nome_lote' }, { id: 'categoria' }];
  const buttons = filterButtonsOf({ columns }, columns);
  assert.deepEqual(buttons.map(({ button, column }) => [button.label, column.id]), [['Lotes', 'nome_lote'], ['Categoria', 'categoria']]);
});

// ---------------------------------------------------------------------------
// 4. Checagens mínimas de texto da tela
// ---------------------------------------------------------------------------
check('Relatorios.jsx: abre direto o ReportView (último usado; senão Pesagens) — sem catálogo', () => {
  const page = read('src/pages/Relatorios.jsx');
  assert.ok(!/ReportCatalog/.test(page), 'sem o catálogo em cartões');
  assert.match(page, /getRecents\(actor\)[\s\S]{0,200}initialReportId\(recents, options\)[\s\S]{0,40}\{ replace: true \}/, 'sem ?r=: último usado (replace)');
  assert.match(page, /reportSelectorOptions\(actor\)/, 'opções do seletor pelo perfil');
  // E1F: + o grupo "Meus relatórios" e "➕ Novo relatório…" no fim (gate reports:novo-relatorio).
  assert.match(page, /reportOptions=\{withMyReports\(withCurrentOption\(options, resolved\.definition\), myTemplates, actor\)\}/, 'passa as opções para a tela');
  assert.match(page, /onSelectReport=\{select\}/, 'trocar de relatório: pelo valor do seletor');
  assert.match(page, /const select = \(value\) => \{[\s\S]{0,400}open\(choice\.reportId\);/, 'relatório do catálogo navega para ?r=<id>');
  assert.match(page, /onOpenTemplate=\{\(chosen\) => open\(resolved\.definition\.id, chosen\)\}/, 'abrir modelo navega para &m=<modelo>');
  assert.match(page, /onBack=\{null\}/, 'sem "voltar" (a tela é a própria Relatórios)');
  assert.match(page, /getLegacyAlias\(viewParam\)/, 'links antigos (&v=) continuam');
  assert.ok(!existsSync(new URL('../src/components/reports/ReportCatalog.jsx', import.meta.url)), 'ReportCatalog removido (sem código morto)');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
  const src = walk(fileURLToPath(new URL('../src', import.meta.url)));
  for (const file of src.filter((name) => /\.(jsx?|mjs)$/.test(name))) assert.ok(!/ReportCatalog/.test(readFileSync(file, 'utf8')), `${file}: sem link para o catálogo`);
});

check('ReportView.jsx: tela do MAKGESTAO para todos em Relatórios; Manutenção intacta', () => {
  const view = read('src/components/reports/ReportView.jsx');
  assert.match(view, /const makScreen = Boolean\(reportOptions\) \|\| isPesagensScreen\(definition\);/, 'tela do MAKGESTAO sempre que há o campo Relatório');
  // E1F: título pelo customReports.reportTitle ("Relatório de <sheetTitle ?? title>"; relatório do usuário, o nome dele).
  assert.match(view, /title=\{reportTitle\(definition, currentTemplate\)\}/, 'título "Relatório de <nome>"');
  assert.match(read('src/modules/reporting/application/customReports.js'), /export const reportTitle = \(definition, template = null\) => `Relatório de \$\{template\?\.name \|\| definition\.sheetTitle \|\| definition\.title\}`;/, 'título: nome do relatório (sheetTitle ?? title)');
  assert.match(view, /report=\{reportOptions && onSelectReport \? \{ value: selectorValue\(definition\.id, currentTemplate\), options: withTemplateOption\(reportOptions, currentTemplate\), onChange: guardLeave\(onSelectReport\) \} : null\}/, 'campo Relatório no cartão (com a pergunta "Salvar as alterações?")');
  assert.match(view, /const buttonColumns = filterButtonsOf\(definition, available\);/, 'botões de filtro pelo reportScreenModel');
  assert.match(view, /params=\{integerParamsOf\(definition\)\.map/, 'parâmetros inteiros no cartão');
  assert.match(view, /quickFiltersOf\(definition\)\.map/, 'filtros rápidos no cartão');
  assert.match(view, /listTemplates\(actor, \{ reportId: definition\.id \}\)/, '"Abrir modelo" lista os modelos do relatório');
  assert.match(view, /onSaveTemplate=\{allowPreferences \? \(\) => setDialog\("save"\) : null\}/, '"Salvar modelo" no ⋯');
  assert.match(view, /const fixedSortChoices = definition\.sortChoices\?\.length \? definition\.sortChoices : null;/, 'Ordenar Por: as 8 só com sortChoices; nos outros o da E1B');
  const manutencao = read('src/pages/ManutencaoSistema.jsx');
  const block = manutencao.slice(manutencao.indexOf('<ReportView'), manutencao.indexOf('/>', manutencao.indexOf('<ReportView')));
  assert.ok(block.includes('allowPreferences={false}') && !block.includes('reportOptions'), 'aba Controle: ReportView sem preferências e sem o campo Relatório (tela da 1.4.0)');
});

check('MakgestaoScreen.jsx: campo Relatório, estado atual, ⋯ Abrir/Salvar modelo', () => {
  const screen = read('src/components/reports/MakgestaoScreen.jsx');
  assert.match(screen, /aria-label="Relatório"/, 'campo "Relatório"');
  assert.match(screen, /\{report \? <ReportSelect \{\.\.\.report\} \/> : null\}\s*\{onPeriod \?/, '"Relatório" é o primeiro campo da grade');
  assert.ok(screen.includes('Estado atual (hoje)'), 'sem período: "Estado atual (hoje)"');
  // E1F: os relatórios salvos abrem pelo campo "Relatório" (Meus relatórios); o ⋯ só salva.
  assert.ok(screen.includes('Salvar como meu relatório…'), '⋯: Salvar como meu relatório');
  assert.ok(!/DropdownMenuSubTrigger[^\n]*Abrir modelo/.test(screen), 'NEGATIVO: sem "Abrir modelo" repetido no ⋯');
  assert.match(screen, /\{onBack \? \(/, 'voltar só quando há para onde');
});

console.log(JSON.stringify({ gate: 'reports:tela-unica:verify', ok: true, checks }, null, 2));
