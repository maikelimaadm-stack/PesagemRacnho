// Gate reports:pesagens-tipos:verify (E1D 1.4.0) — "Relatório de Pesagens Individuais" igual ao MAKGESTAO
// (docs/plano-mestre/E1D-RELATORIO-PESAGENS-INDIVIDUAIS.md, itens 1, 8 e 9; contratos em
// docs/evidence/e1d/CONTRATOS-AGENTES.md, linha D):
//   1. os 5 tipos, com os nomes e a ordem do antigo (lidos do próprio código do MAKGESTAO em
//      docs/evidence/e1d/referencia-makgestao), o padrão "Por Apartação (Resumo por Data)" e o título;
//   2. /Relatorios?r=pesagens sem modelo, visão antiga nem último estado abre no tipo padrão (o MESMO código
//      da tela: application/reportInitialState) e executa nele; os outros relatórios abrem como antes (sem
//      mandar id de tipo gerado ao serviço); link/favorito de visão antiga da E1 abre a seleção dele como
//      "Personalizado" (não converte);
//   3. modelos e último estado de antes da E1D (sem `view`) com tipo da E1B que saiu → tipo novo mais
//      próximo: em memória ao abrir e gravado uma vez, com auditoria "relatorios-tipos-e1d" (idempotente;
//      chamadas simultâneas = uma execução; o que já tem `view` nunca é regravado); filtros, período,
//      pesquisa, orientação e larguras mantidos; estrutura que não era tipo → "Personalizado"; modelo de
//      relatório antigo da E1 (migratedFrom) não converte;
//   4. título da folha pelo tipo: "(Analítico)" só no Analítico; Vendas (Detalhado) "(Sintético)"; sem tipo,
//      pelo modo — na tela, na impressão e no PDF (mesmo documento);
//   5. folha enxuta (item 8): período ao lado do título (sem "Resumido · …"), cabeçalho sem "Emitido em",
//      sem notas, rodapé só com filtros, "@ = peso vivo ÷ N" (quando há @ na folha — no período sem
//      pesagens, não), quem emitiu e quando, e
//      "Página X de Y"; CPF/CNPJ, IE e telefone só com "Mostrar no cabeçalho" (nasce desmarcado).
// Cada regra tem caso negativo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { buildInitialReportState } from '../src/modules/reporting/application/reportInitialState.js';
import {
  VIEW_TYPES_MIGRATION_ORIGIN, PREFERENCES_MIGRATION_ORIGIN, getFavorites, getRecents, getReportViewState, listTemplates, migrateReportPreferences,
  normalizeTemplateConfig, saveTemplate, templateToRequest,
} from '../src/modules/reporting/application/reportTemplateService.js';
import { getReportDefinition, listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { getLegacyAlias } from '../src/modules/reporting/definitions/legacyAliases.js';
import { SHEET_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { LEGACY_DEFAULT_COLUMNS, LEGACY_REPORT_VIEWS, convertLegacyViewConfig, matchLegacyView } from '../src/modules/reporting/definitions/legacyViews.js';
import { listReportViews, resolveViewId, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildReportDocument, sheetTitleOf } from '../src/modules/reporting/domain/reportDocument.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { buildPrintDocument } from '../src/modules/reporting/infrastructure/exporters/printDocument.js';
import { buildPropertyHeader } from '../src/modules/catalog/domain/propertyHeader.js';
import { PROPRIEDADES } from '../src/modules/catalog/domain/registryDefinitions.js';
import { emptyFor, headerPreviewFromForm } from '../src/components/cadastros/registryFormModel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PESAGENS = getReportDefinition('pesagens');
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const PERIOD = { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' };
const plain = (value) => JSON.parse(JSON.stringify(value));
const decode = (text) => String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const resumo = { gate: 'reports:pesagens-tipos:verify', ok: false, regras: [] };
const ok = (regra) => resumo.regras.push(regra);
// Seleção como a tela manda ao serviço (ReportView.execute).
const selectionOf = (state) => ({
  columns: state.columns, filters: state.uiFilters ?? {}, fixedFilters: state.fixedFilters ?? {}, groups: state.groups, aggregates: state.aggregates,
  sort: state.sort, search: state.search ?? '', mode: state.mode, summarySort: state.summarySort, drill: [], view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
});
const run = (selection, actor = ADMIN, params = P) => runReport('pesagens', { today: TODAY, params, selection, arrobaDivisor: 30 }, actor);

const { db } = await seedReportFixture();

// ---------------------------------------------------------------------------
// 1. Os 5 tipos: nomes e ordem do antigo, padrão, título
// ---------------------------------------------------------------------------
const reference = readFileSync(join(root, 'docs/evidence/e1d/referencia-makgestao/RelatorioPesagensIndividuais.jsx.txt'), 'utf8');
const tipoBlock = reference.slice(reference.indexOf('Tipo Relatório'), reference.indexOf('</Select>', reference.indexOf('Tipo Relatório')));
const oldTypes = [...tipoBlock.matchAll(/<SelectItem value="(\w+)">([^<]+)<\/SelectItem>/g)].map(([, value, label]) => ({ value, label: label.trim() }));
assert.equal(oldTypes.length, 5, 'o antigo tem 5 tipos (lidos do código de referência)');
const views = listReportViews(PESAGENS);
assert.deepEqual(views.map((view) => view.label), oldTypes.map((item) => item.label), 'os 5 tipos com os nomes EXATOS e a ordem do MAKGESTAO');
assert.deepEqual(views.map((view) => view.label), ['Analítico (Detalhado)', 'Sintético (Matriz)', 'Por Apartação/Lote', 'Por Apartação (Resumo por Data)', 'Vendas (Detalhado)'], 'nomes escritos à mão');
assert.deepEqual(views.map((view) => view.id), ['analitico', 'sintetico-matriz', 'por-apartacao-lote', 'por-apartacao-data', 'vendas'], 'ids estáveis (vão para último estado, modelos e manifesto)');
assert.ok(views.every((view) => !view.generated), 'nenhum tipo gerado ("Resumo por Sessão" saiu)');
assert.equal(PESAGENS.defaultView, 'por-apartacao-data', 'tipo padrão = Por Apartação (Resumo por Data) (o antigo abria no Analítico; a E1D pede este)');
assert.match(reference, /useState\("analitico"\)/, 'controle: o antigo abria no Analítico');
// Título: o antigo usa "(Analítico)" só no analítico e "(Sintético)" em todos os outros.
assert.match(reference, /Relatório de Pesagens Individuais \{tipoRelatorio === 'analitico' \? '\(Analítico\)' : '\(Sintético\)'\}/, 'regra do título no antigo');
assert.deepEqual(views.map((view) => [view.id, view.titleKind]), [['analitico', 'Analítico'], ['sintetico-matriz', 'Sintético'], ['por-apartacao-lote', 'Sintético'], ['por-apartacao-data', 'Sintético'], ['vendas', 'Sintético']], 'titleKind de cada tipo');
// Os outros relatórios não mudam de tipo (sem defaultView: padrão + analítico gerados).
for (const definition of listReportDefinitions({ visibility: 'catalog' }).filter((item) => item.id !== 'pesagens')) {
  assert.equal(definition.defaultView, null, `NEGATIVO: ${definition.id} sem tipo padrão`);
}
ok('tipos');

// ---------------------------------------------------------------------------
// 2. /Relatorios?r=pesagens: sem modelo, visão antiga nem último estado → tipo padrão (código da tela)
// ---------------------------------------------------------------------------
const { state: inicial, warnings: avisosIniciais } = buildInitialReportState(PESAGENS, { role: 'ADMIN' });
const padrao = viewSelection('por-apartacao-data', PESAGENS);
assert.deepEqual(avisosIniciais, [], 'sem avisos');
assert.equal(inicial.view, 'por-apartacao-data', 'abre no tipo padrão');
assert.deepEqual(plain({ groups: inicial.groups, mode: inicial.mode, aggregates: inicial.aggregates, columns: inicial.columns }), plain({ groups: padrao.groups, mode: padrao.mode, aggregates: padrao.aggregates, columns: padrao.columns }), 'seleção do tipo padrão (colunas padrão do tipo)');
assert.equal(inicial.sortChoice, 'data_desc', '"Ordenar por" padrão: Data (Mais Recente)');
assert.equal(inicial.matrix, null, 'sem eixos (não é a matriz)');
assert.deepEqual(inicial.params.periodo, PESAGENS.params[0].default, 'período padrão do relatório');
assert.equal(resolveViewId(PESAGENS, inicial), 'por-apartacao-data', 'o seletor "Tipo de relatório" mostra o tipo padrão');
const vmInicial = await run(selectionOf(inicial));
assert.equal(vmInicial.view?.id, 'por-apartacao-data', 'executa no tipo padrão');
assert.deepEqual(vmInicial.groups.map((group) => group.columnId), ['nome_apartacao', 'data_pesagem', 'nome_lote'], 'Apartação › Data › Lote');
// Os outros relatórios abrem como antes e executam (o id de tipo GERADO não vai ao serviço, que o recusa).
for (const definition of listReportDefinitions({ visibility: 'catalog' })) {
  const { state } = buildInitialReportState(definition, { role: 'ADMIN' });
  if (definition.defaultView) continue;
  assert.equal(state.view, null, `${definition.id}: sem tipo declarado → view null no estado`);
  assert.deepEqual(plain(state.groups), plain(definition.defaultGroups), `${definition.id}: agrupamento padrão da definição`);
  const vm = await runReport(definition.id, { today: TODAY, params: state.params, selection: selectionOf(state) }, ADMIN);
  assert.equal(vm.mode, definition.defaultMode, `${definition.id}: abre e executa`);
  if (definition.defaultGroups.length) assert.equal(resolveViewId(definition, state), 'padrao', `${definition.id}: o seletor continua mostrando "Resumo por …"`);
}
await assert.rejects(() => runReport('rebanho.atual', { today: TODAY, params: {}, selection: { view: 'padrao' } }, ADMIN), /tipo de relatório desconhecido/, 'controle: o serviço recusa id de tipo gerado (por isso ele não pode ir no estado)');
// Link/favorito de visão antiga da E1 (?r=pesagens.sessao): a seleção dela, "Personalizado", sem converter.
for (const aliasId of ['pesagens.periodo', 'pesagens.sessao', 'pesagens.lote', 'pesagens.operador', 'pesagens.origem', 'movimentacao.entradas-saidas']) {
  const preset = getLegacyAlias(aliasId);
  const { state } = buildInitialReportState(PESAGENS, { preset, role: 'ADMIN' });
  assert.equal(state.view, null, `${aliasId}: Personalizado`);
  assert.deepEqual(plain(state.groups), plain(preset.groups), `${aliasId}: agrupamento da visão antiga`);
  assert.equal(resolveViewId(PESAGENS, state), null, `${aliasId}: o seletor mostra Personalizado`);
  const vm = await run(selectionOf(state));
  assert.equal(vm.view, null, `${aliasId}: executa sem tipo`);
}
// Nenhuma visão antiga de hoje coincide com um tipo novo; se coincidisse, continuaria Personalizado (não converte).
const aliasQueCoincide = { ...getLegacyAlias('pesagens.lote'), groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], aggregates: SHEET_TOTALS, mode: 'RESUMIDO' };
assert.equal(resolveViewId(PESAGENS, { groups: aliasQueCoincide.groups, mode: 'RESUMIDO', aggregates: SHEET_TOTALS }), 'por-apartacao-lote', 'controle: pela estrutura bateria com "Por Apartação/Lote"');
assert.equal(buildInitialReportState(PESAGENS, { preset: aliasQueCoincide, role: 'ADMIN' }).state.view, null, 'NEGATIVO: visão antiga nunca vira tipo');
// Último estado com tipo: abre nele (precedência: modelo > visão antiga > último estado > padrão).
const comEstado = buildInitialReportState(PESAGENS, { role: 'ADMIN', savedState: templateToRequest({ ...normalizeTemplateConfig(PESAGENS, { ...viewSelection('analitico', PESAGENS), period: PERIOD }), baseReportId: 'pesagens' }, 'ADMIN') });
assert.equal(comEstado.state.view, 'analitico', 'último estado no Analítico → abre no Analítico');
ok('estado-inicial');

// ---------------------------------------------------------------------------
// 3. Conversão dos tipos da E1B (modelos e último estado sem `view`)
// ---------------------------------------------------------------------------
// As seleções que a E1B aplicava, ESCRITAS À MÃO (cópia de definitions/pesagens.js em 2d51951, a 1.4.0 da
// E1C) — nunca as constantes vivas de pesagens.js: se SHEET_TOTALS & cia. mudarem para os tipos novos, o
// que está gravado no banco continua sendo isto, e o gate tem de acusar se a conversão deixar de reconhecer.
const E1B_EVENT_TOTALS = [
  { id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'peso_min', columnId: 'peso', op: 'min' }, { id: 'peso_max', columnId: 'peso', op: 'max' }, { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
];
const E1B_SHEET_TOTALS = [
  { id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'faixa_min', columnId: 'lote_peso_minimo', op: 'min' }, { id: 'faixa_max', columnId: 'lote_peso_maximo', op: 'max' },
  { id: 'menor', columnId: 'peso', op: 'min' }, { id: 'maior', columnId: 'peso', op: 'max' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'media_arroba', columnId: 'peso_arroba', op: 'avg' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'total_arroba', columnId: 'peso_arroba', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' }, { id: 'ganho_medio_arroba', columnId: 'ganho_arroba', op: 'avg' }, { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_total_arroba', columnId: 'ganho_arroba', op: 'sum' }, { id: 'dias_medios', columnId: 'dias', op: 'avg' }, { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'machos', columnId: 'animais_machos', op: 'countDistinct' }, { id: 'femeas', columnId: 'animais_femeas', op: 'countDistinct' },
];
const E1B_SHEET_TOTALS_SEM_FAIXA = E1B_SHEET_TOTALS.filter((spec) => !['faixa_min', 'faixa_max'].includes(spec.id));
const E1B_ANALYTIC_COLUMNS = ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'peso', 'peso_arroba', 'peso_anterior', 'dias', 'ganho', 'gmd'];
const E1B_DEFAULT_COLUMNS = ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'categoria', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd'];
const E1B = {
  sessao: { id: 'padrao', label: 'Resumo por Sessão', groups: [{ columnId: 'sessao' }], mode: 'RESUMIDO', aggregates: E1B_EVENT_TOTALS, to: 'por-apartacao-data' },
  apdata: { id: 'por-apartacao-data', label: 'Por apartação (resumo por data)', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'nome_lote' }], mode: 'RESUMIDO', aggregates: E1B_SHEET_TOTALS, to: 'por-apartacao-data' },
  lote: { id: 'por-lote', label: 'Por lote', groups: [{ columnId: 'nome_lote' }], mode: 'RESUMIDO', aggregates: E1B_SHEET_TOTALS, to: 'por-apartacao-lote' },
  data: { id: 'por-data', label: 'Por data', groups: [{ columnId: 'data_pesagem', direction: 'desc' }], mode: 'RESUMIDO', aggregates: E1B_SHEET_TOTALS_SEM_FAIXA, to: 'por-apartacao-data' },
  analitico: { id: 'analitico', label: 'Analítico por animal', groups: [], mode: 'DETALHADO', aggregates: E1B_EVENT_TOTALS, columns: E1B_ANALYTIC_COLUMNS, to: 'analitico' },
};
assert.deepEqual(LEGACY_REPORT_VIEWS.pesagens.map((item) => [item.label, item.to]), Object.values(E1B).map((item) => [item.label, item.to]), 'mapa tipo antigo → tipo novo (documentado em legacyViews.js)');
// A tabela da conversão é a foto da E1B (não segue as constantes vivas): igual, campo a campo, ao escrito à mão.
assert.deepEqual(plain(LEGACY_REPORT_VIEWS.pesagens), plain(Object.values(E1B)), 'seleções da E1B congeladas em legacyViews.js = as da 1.4.0 da E1C');
assert.deepEqual(plain(LEGACY_DEFAULT_COLUMNS.pesagens), E1B_DEFAULT_COLUMNS, 'colunas padrão da E1B congeladas (modelo sem colunas gravadas)');
const legacyViewsSource = readFileSync(join(root, 'src/modules/reporting/definitions/legacyViews.js'), 'utf8');
assert.ok(!/from '\.\/pesagens\.js'/.test(legacyViewsSource), 'NEGATIVO: legacyViews.js não lê as constantes vivas de pesagens.js (mudança nelas não pode desligar a conversão)');
assert.ok(Object.isFrozen(LEGACY_REPORT_VIEWS.pesagens[2].aggregates[0]), 'tabela congelada até o fundo');
// O que a pessoa escolheu e tem de sobrar depois da conversão.
const PESSOA = { filters: { sexo: { operator: 'in', values: ['Macho'], match: 'label' } }, period: PERIOD, orientation: 'landscape', search: '101', widths: { peso: 150 } };
const e1bConfig = (key, extra = {}) => normalizeTemplateConfig(PESAGENS, {
  columns: E1B[key].columns ?? E1B_DEFAULT_COLUMNS, groups: E1B[key].groups, mode: E1B[key].mode, aggregates: E1B[key].aggregates, sort: PESAGENS.defaultSort, ...PESSOA, ...extra,
});
for (const [key, spec] of Object.entries(E1B)) {
  const config = e1bConfig(key);
  assert.equal(config.view, undefined, `${key}: config da E1B sem view`);
  assert.equal(matchLegacyView(PESAGENS, config)?.label, spec.label, `${key}: reconhecido como "${spec.label}"`);
  const converted = convertLegacyViewConfig(PESAGENS, config);
  const target = viewSelection(spec.to, PESAGENS);
  assert.equal(converted.config.view, spec.to, `${key}: vira ${spec.to}`);
  assert.deepEqual(plain({ groups: converted.config.groups, mode: converted.config.mode, aggregates: converted.config.aggregates, columns: converted.config.columns }), plain({ groups: target.groups, mode: target.mode, aggregates: target.aggregates, columns: target.columns }), `${key}: seleção (grupos/modo/colunas padrão) do tipo novo`);
  assert.equal(converted.config.sortChoice, 'data_desc', `${key}: "Ordenar por" padrão`);
  assert.equal(converted.config.summarySort, null, `${key}: ordem do Resumido do tipo`);
  for (const field of Object.keys(PESSOA)) assert.deepEqual(converted.config[field], config[field], `${key}: ${field} da pessoa mantido`);
  // Em memória ao abrir (templateToRequest): o mesmo resultado, e o serviço executa no tipo novo.
  const request = templateToRequest({ ...config, baseReportId: 'pesagens', name: 'x' }, 'ADMIN');
  assert.equal(request.selection.view, spec.to, `${key}: aberto em memória já no tipo novo`);
  assert.deepEqual(request.params.periodo, PERIOD, `${key}: período mantido`);
  assert.equal(request.orientation, 'landscape', `${key}: orientação mantida`);
  const vm = await run(request.selection, ADMIN, request.params);
  assert.equal(vm.view?.id, spec.to, `${key}: executa no tipo novo`);
  assert.ok(vm.rows.every((row) => row.sexo === 'M'), `${key}: filtro da pessoa continua valendo`);
}
// NEGATIVOS: o que não era tipo da E1B fica "Personalizado" e com a seleção da pessoa.
const personalizados = {
  'totais mudados': e1bConfig('lote', { aggregates: E1B_SHEET_TOTALS.filter((spec) => spec.id !== 'machos') }),
  'agrupamento sem tipo': normalizeTemplateConfig(PESAGENS, { groups: [{ columnId: 'marca' }], mode: 'RESUMIDO', aggregates: E1B_SHEET_TOTALS }),
  'data em ordem crescente': e1bConfig('data', { groups: [{ columnId: 'data_pesagem', direction: 'asc' }] }),
  'Detalhado com outras colunas': e1bConfig('analitico', { columns: E1B_ANALYTIC_COLUMNS.slice(1) }),
  'modo trocado': e1bConfig('lote', { mode: 'DETALHADO' }),
};
for (const [label, config] of Object.entries(personalizados)) {
  assert.equal(convertLegacyViewConfig(PESAGENS, config), null, `NEGATIVO ${label}: não converte`);
  const request = templateToRequest({ ...config, baseReportId: 'pesagens', name: label }, 'ADMIN');
  assert.equal(request.selection.view, null, `NEGATIVO ${label}: abre Personalizado (explícito)`);
  assert.deepEqual(plain(request.selection.groups), plain(config.groups), `NEGATIVO ${label}: agrupamento da pessoa`);
  assert.equal(buildInitialReportState(PESAGENS, { template: { ...config, baseReportId: 'pesagens', name: label }, role: 'ADMIN' }).state.view, null, `NEGATIVO ${label}: a tela mostra Personalizado`);
}
// Coincidência de estrutura com um tipo NOVO também não vira tipo (era Personalizado na E1B).
const coincide = normalizeTemplateConfig(PESAGENS, { groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], mode: 'RESUMIDO', aggregates: SHEET_TOTALS });
assert.equal(resolveViewId(PESAGENS, coincide), 'por-apartacao-lote', 'controle: pela estrutura bateria com "Por Apartação/Lote"');
assert.equal(templateToRequest({ ...coincide, baseReportId: 'pesagens', name: 'c' }, 'ADMIN').selection.view, null, 'NEGATIVO: modelo antigo nunca vira tipo só porque a estrutura coincide');
// Já tem view (E1D): nunca é convertido nem mexido.
const jaTipado = { ...e1bConfig('lote'), view: null };
assert.equal(convertLegacyViewConfig(PESAGENS, jaTipado), null, 'NEGATIVO: view null (Personalizado escolhido na E1D) não converte');
assert.equal(convertLegacyViewConfig(PESAGENS, { ...e1bConfig('analitico'), view: 'analitico' }), null, 'NEGATIVO: com view não converte');
// Modelo de relatório antigo da E1 (1.3.x "Pesagens por sessão"): a consolidação da E1 leva para Pesagens
// com a seleção do antigo, e a E1D NÃO converte (abre como o link antigo: Personalizado).
const modeloSessao13 = { id: 't-13', name: 'Sessões 1.3', baseReportId: 'pesagens.sessao', scope: 'PERSONAL', ownerUserId: GESTOR.id, columns: [], groups: [{ columnId: 'sessao' }], aggregates: E1B_EVENT_TOTALS, filters: {}, sort: [] };
const req13 = templateToRequest(modeloSessao13, 'GESTOR');
assert.equal(req13.selection.view, null, 'NEGATIVO: modelo da 1.3 (relatório antigo) não vira tipo');
assert.deepEqual(req13.selection.groups.map((group) => group.columnId), ['sessao'], 'modelo da 1.3 abre agrupado por Sessão, como antes');
// Relatório sem tipos fixos: nada muda (nem ganha view).
const desempenhoCfg = normalizeTemplateConfig(getReportDefinition('desempenho'), { groups: [{ columnId: 'lote' }], mode: 'RESUMIDO' });
assert.equal(convertLegacyViewConfig(getReportDefinition('desempenho'), desempenhoCfg), null, 'NEGATIVO: Desempenho não converte');
assert.equal('view' in templateToRequest({ ...desempenhoCfg, baseReportId: 'desempenho', name: 'd' }, 'ADMIN').selection, false, 'NEGATIVO: relatório sem tipos fixos não ganha view');
ok('conversao-em-memoria');

// Gravado uma vez, com auditoria própria (como a consolidação da E1).
const meta = (id, name, scope = 'PERSONAL', owner = GESTOR) => ({ version: 1, id, name, baseReportId: 'pesagens', baseReportVersion: 1, scope, ownerUserId: owner.id, ownerName: owner.nome, createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z', updatedBy: owner.id });
const storedTemplates = [
  { ...meta('t-lote', 'Lote do mês'), ...e1bConfig('lote') },
  { ...meta('t-data', 'Datas', 'SHARED'), ...e1bConfig('data') },
  { ...meta('t-analitico', 'Conferência', 'PERSONAL', OPERADOR), ...e1bConfig('analitico') },
  { ...meta('t-marca', 'Por marca'), ...personalizados['agrupamento sem tipo'] },
  { ...meta('t-e1d', 'Já da E1D'), ...normalizeTemplateConfig(PESAGENS, { ...viewSelection('vendas', PESAGENS), period: PERIOD }) },
  modeloSessao13,
];
const viewStateOf = (key) => ({ ...e1bConfig(key), baseReportId: 'pesagens', baseReportVersion: 1, showEmptyColumns: true, updatedAt: '2026-09-20T10:00:00.000Z' });
const seedPreferences = async () => {
  await db.table('auditoria').clear();
  await db.table('appSettings').put({ key: 'report-templates:local', value: { version: 1, templates: plain(storedTemplates) } });
  await db.table('appSettings').put({ key: `report-view-state:local:${GESTOR.id}`, value: { version: 1, reports: { pesagens: viewStateOf('sessao'), desempenho: { ...desempenhoCfg, baseReportId: 'desempenho' } } } });
  await db.table('appSettings').put({ key: `report-view-state:local:${OPERADOR.id}`, value: { version: 1, reports: { pesagens: viewStateOf('apdata') } } });
};
const audits = async (origin) => (await db.table('auditoria').toArray()).filter((row) => row.origem === origin);
await seedPreferences();
// Chamadas simultâneas (catálogo lê favoritos, recentes e modelos; a tela lê o último estado): uma execução.
await Promise.all([listTemplates(GESTOR), getFavorites(GESTOR), getRecents(GESTOR), getReportViewState('pesagens', GESTOR), migrateReportPreferences(GESTOR)]);
const tipos = await audits(VIEW_TYPES_MIGRATION_ORIGIN);
assert.equal(VIEW_TYPES_MIGRATION_ORIGIN, 'relatorios-tipos-e1d', 'origem própria da E1D');
assert.deepEqual(tipos.map((row) => row.resumo).sort(), [
  'Tipo de relatório convertido: Pesagens › Analítico por animal → Analítico (Detalhado) (modelo salvo “Conferência”).',
  'Tipo de relatório convertido: Pesagens › Por data → Por Apartação (Resumo por Data) (modelo salvo “Datas”).',
  'Tipo de relatório convertido: Pesagens › Por lote → Por Apartação/Lote (modelo salvo “Lote do mês”).',
  'Tipo de relatório convertido: Pesagens › Resumo por Sessão → Por Apartação (Resumo por Data) (último estado).',
].sort(), 'uma auditoria por modelo convertido + o último estado do ator (chamadas simultâneas = uma execução)');
assert.ok(tipos.every((row) => row.entidade === 'appSettings' && row.acao === 'ATUALIZAR' && row.usuario_id === GESTOR.id && row.campos_alterados.includes('view')), 'auditoria como na E1 (appSettings, ATUALIZAR, quem, campos)');
assert.deepEqual(tipos.map((row) => row.entidade_id).sort(), ['report-templates:local', 'report-templates:local', 'report-templates:local', `report-view-state:local:${GESTOR.id}`].sort(), 'chaves auditadas');
assert.equal((await audits(PREFERENCES_MIGRATION_ORIGIN)).length, 1, 'o modelo da 1.3 teve só a consolidação da E1 (uma auditoria, origem da E1)');
const gravados = (await db.table('appSettings').get('report-templates:local')).value.templates;
const byId = Object.fromEntries(gravados.map((template) => [template.id, template]));
assert.deepEqual([byId['t-lote'].view, byId['t-data'].view, byId['t-analitico'].view], ['por-apartacao-lote', 'por-apartacao-data', 'analitico'], 'modelos gravados com o tipo novo');
assert.deepEqual(plain(byId['t-lote'].filters), plain(e1bConfig('lote').filters), 'filtros gravados como a pessoa deixou');
assert.deepEqual(byId['t-lote'].filters.sexo.values, ['Macho'], 'filtro Sexo = Macho');
assert.deepEqual([byId['t-lote'].name, byId['t-lote'].ownerUserId, byId['t-data'].scope, byId['t-lote'].orientation], ['Lote do mês', GESTOR.id, 'SHARED', 'landscape'], 'nome, dono, escopo e orientação mantidos');
assert.equal(byId['t-marca'].view, undefined, 'NEGATIVO: modelo que não era tipo não é regravado');
assert.deepEqual(plain(byId['t-e1d']), plain(storedTemplates.find((item) => item.id === 't-e1d')), 'NEGATIVO: modelo da E1D (com view) intacto');
assert.equal(byId['t-13'].baseReportId, 'pesagens', 'modelo da 1.3 consolidado pela E1');
assert.equal(byId['t-13'].view, undefined, 'NEGATIVO: modelo da 1.3 sem tipo (abre Personalizado)');
const estadoGestor = (await db.table('appSettings').get(`report-view-state:local:${GESTOR.id}`)).value.reports;
assert.equal(estadoGestor.pesagens.view, 'por-apartacao-data', 'último estado gravado no tipo novo');
assert.equal(estadoGestor.pesagens.showEmptyColumns, true, 'preferência de tela do último estado mantida');
assert.equal(estadoGestor.desempenho.view, undefined, 'NEGATIVO: último estado de outro relatório intacto');
assert.equal((await db.table('appSettings').get(`report-view-state:local:${OPERADOR.id}`)).value.reports.pesagens.view, undefined, 'último estado é por usuário: o do OPERADOR espera a vez dele');
// Idempotente: de novo não grava nem audita.
await migrateReportPreferences(GESTOR);
await listTemplates(GESTOR);
await getReportViewState('pesagens', GESTOR);
assert.equal((await audits(VIEW_TYPES_MIGRATION_ORIGIN)).length, 4, 'idempotente: nenhuma auditoria nova');
// Outro usuário: converte o último estado DELE (os modelos já foram).
const doOperador = await getReportViewState('pesagens', OPERADOR);
assert.equal(doOperador.selection.view, 'por-apartacao-data', 'último estado do OPERADOR (E1B "Por apartação") no tipo novo');
assert.deepEqual(doOperador.selection.aggregates.map((spec) => spec.id), viewSelection('por-apartacao-data', PESAGENS).aggregates.map((spec) => spec.id), 'com as colunas padrão do tipo (11 métricas)');
assert.equal(doOperador.showEmptyColumns, true, 'preferência mantida');
const operadorAudits = (await audits(VIEW_TYPES_MIGRATION_ORIGIN)).filter((row) => row.usuario_id === OPERADOR.id);
assert.deepEqual(operadorAudits.map((row) => row.resumo), ['Tipo de relatório convertido: Pesagens › Por apartação (resumo por data) → Por Apartação (Resumo por Data) (último estado).'], 'uma auditoria para o último estado do OPERADOR; nenhuma de modelo');
// A tela abre o último estado convertido no tipo novo e executa.
const doGestor = await getReportViewState('pesagens', GESTOR);
const telaGestor = buildInitialReportState(PESAGENS, { role: 'GESTOR', savedState: doGestor }).state;
assert.equal(telaGestor.view, 'por-apartacao-data', 'tela abre no tipo novo');
assert.deepEqual(telaGestor.uiFilters.sexo.values, ['Macho'], 'com o filtro da pessoa');
assert.equal(telaGestor.orientation, 'landscape');
assert.equal((await run(selectionOf(telaGestor), GESTOR, telaGestor.params)).view?.id, 'por-apartacao-data', 'executa');
// Modelo convertido aberto pela tela: tipo novo; salvar de novo guarda o tipo (e não converte mais).
const listado = (await listTemplates(GESTOR)).find((template) => template.id === 't-lote');
assert.equal(buildInitialReportState(PESAGENS, { template: listado, role: 'GESTOR' }).state.view, 'por-apartacao-lote', 'modelo convertido abre no tipo novo');
const resalvo = await saveTemplate({ ...listado, id: 't-lote', name: 'Lote do mês' }, GESTOR);
assert.equal(resalvo.view, 'por-apartacao-lote', 'salvar de novo guarda o tipo');
assert.equal((await audits(VIEW_TYPES_MIGRATION_ORIGIN)).length, 5, 'nenhuma conversão nova (4 do GESTOR + 1 do OPERADOR)');
// Falha de gravação não impede abrir: a conversão em memória basta (templateToRequest do estado cru).
const cru = viewStateOf('lote');
assert.equal(templateToRequest({ ...cru, baseReportId: 'pesagens' }, 'OPERADOR').selection.view, 'por-apartacao-lote', 'sem gravar, abre convertido em memória');
// Só conversão de tipo (nenhum relatório antigo da E1 no mesmo passo): grava os modelos do mesmo jeito.
await db.table('appSettings').put({ key: 'report-templates:local', value: { version: 1, templates: [{ ...meta('t-so-tipo', 'Só tipo'), ...e1bConfig('data') }] } });
await migrateReportPreferences(ADMIN);
assert.equal((await db.table('appSettings').get('report-templates:local')).value.templates[0].view, 'por-apartacao-data', 'modelo gravado com o tipo novo (sem consolidação da E1 no mesmo passo)');
assert.equal((await audits(VIEW_TYPES_MIGRATION_ORIGIN)).filter((row) => row.usuario_id === ADMIN.id).length, 1, 'uma auditoria (quem abriu primeiro)');
ok('conversao-gravada-auditada');

// ---------------------------------------------------------------------------
// 4. Título da folha pelo tipo (tela, impressão e PDF usam o mesmo documento)
// ---------------------------------------------------------------------------
const TITLE = { Analítico: 'Relatório de Pesagens Individuais (Analítico)', Sintético: 'Relatório de Pesagens Individuais (Sintético)' };
const folhas = {};
for (const view of views) {
  const vm = await run(viewSelection(view, PESAGENS));
  folhas[view.id] = vm;
  const doc = buildReportDocument(vm);
  const expected = view.id === 'analitico' ? TITLE.Analítico : TITLE.Sintético;
  assert.equal(doc.title, expected, `${view.label}: ${expected}`);
  assert.equal(sheetTitleOf(vm), expected);
  const printed = buildPrintDocument(vm).html;
  assert.ok(decode(printed).includes(`<title>${expected}</title>`) && decode(printed).includes(`<h1 class="sheet-title">${expected}</h1>`), `${view.label}: título na impressão/PDF`);
  assert.ok(decode(renderSheetBody(doc, { mode: 'fragment' })).includes(`<h1 class="sheet-title">${expected}</h1>`), `${view.label}: título na tela`);
}
assert.equal(folhas.vendas.mode, 'DETALHADO', 'controle: Vendas é Detalhado');
assert.equal(buildReportDocument(folhas.vendas).title, TITLE.Sintético, 'Vendas (Detalhado) é "(Sintético)", como no antigo');
assert.equal(buildReportDocument(folhas.vendas).layout, 'vendas', 'Vendas: miolo do relatório de venda, com o título comum');
assert.equal(folhas.analitico.mode, 'DETALHADO');
// Sem tipo: pelo modo (Personalizado e os outros relatórios).
const semTipoDetalhado = await run({ ...viewSelection('vendas', PESAGENS), view: null, fixedFilters: {} });
assert.equal(buildReportDocument(semTipoDetalhado).title, TITLE.Analítico, 'NEGATIVO: a mesma estrutura de Vendas sem tipo (Personalizado Detalhado) → "(Analítico)"');
const semTipoResumido = await run({ mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }] });
assert.equal(buildReportDocument(semTipoResumido).title, TITLE.Sintético, 'Personalizado Resumido → "(Sintético)"');
const desempenho = await runReport('desempenho', { today: TODAY, params: P, selection: { mode: 'DETALHADO', groups: [] } }, ADMIN);
assert.equal(buildReportDocument(desempenho).title, 'Relatório de Desempenho (Analítico)', 'outros relatórios: pelo modo');
ok('titulo');

// ---------------------------------------------------------------------------
// 5. Folha enxuta (item 8) e cabeçalho da propriedade
// ---------------------------------------------------------------------------
const kaiman = { id: 'p-k', nome: 'FAZENDA KAIMAN', titular_nome: 'ZIGOMAR FERREIRA FRANCO FILHO', endereco: 'GLEBA RICARDO FRANCO SN', municipio: 'VILA BELA', uf: 'MT', documento: '12345678901', inscricao_estadual: 'ISENTO', telefone: '(65) 99999-0000' };
const vmFolha = await run({ ...viewSelection('por-apartacao-data', PESAGENS), filters: { sexo: { operator: 'in', values: ['Macho'], match: 'label' } } }, GESTOR);
const docFolha = buildReportDocument(vmFolha, { header: buildPropertyHeader(kaiman) });
const printFolha = buildPrintDocument(vmFolha, { header: buildPropertyHeader(kaiman) }).html;
for (const html of [renderSheetBody(docFolha, { mode: 'fragment', interactive: true }), renderSheetBody(docFolha, { mode: 'print' }), printFolha]) {
  const text = decode(html);
  assert.ok(text.includes('<span class="sheet-title-side">Período: 01/08/2026 a 15/09/2026</span>'), 'ao lado do título só o período');
  assert.ok(!text.includes('Resumido · ') && !text.includes('Apartação › Data › Lote'), 'NEGATIVO: sem a linha "Resumido · Apartação › Data › Lote"');
  assert.ok(text.includes('<div class="sheet-header__meta"></div>') && !text.includes('Emitido em'), 'NEGATIVO: sem "Emitido em" no canto do cabeçalho');
  assert.ok(!text.includes('<ul class="sheet-notes">') && !text.includes('GMD calculado com') && !text.includes('Ausentes aparecem') && !text.includes('Uma linha por pesagem'), 'NEGATIVO: sem notas longas');
  const footer = text.slice(text.indexOf('<div class="sheet-footer">'), text.indexOf('</div>', text.indexOf('<div class="sheet-footer">')));
  const parts = [...footer.matchAll(/<span(?: class="[^"]*")?>([^<]*)<\/span>/g)].map(([, part]) => part);
  assert.equal(parts.length, 4, `rodapé com 4 partes: ${parts.join(' | ')}`);
  assert.equal(parts[0], 'Filtros: Sexo em Macho', 'filtros aplicados numa linha');
  assert.equal(parts[1], '@ = peso vivo ÷ 30', '@ = peso vivo ÷ N');
  assert.match(parts[2], /^Emitido por Gil Gestor em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, 'emitido por + data/hora');
  assert.equal(parts[3], 'Página X de Y na impressão', 'Página X de Y');
  assert.ok(!text.includes('Pesagens Individuais v') && !text.includes(`Emissão ${vmFolha.emissionId.slice(0, 8)}`), 'NEGATIVO: sem versão nem código da emissão');
}
assert.match(printFolha, /@bottom-right \{ content: "Página " counter\(page\) " de " counter\(pages\)/, 'impressão/PDF: "Página X de Y" na margem');
assert.ok(!printFolha.includes('@bottom-left'), 'NEGATIVO: margem só com a página');
// Sem @ na folha (Analítico: nenhuma coluna nem total em @) → o rodapé não fala da @.
assert.equal(buildReportDocument(folhas.analitico).footer.arroba, null, 'Analítico sem @ → sem "@ = peso vivo ÷ N"');
// Período sem pesagens: a folha é só "Nenhum registro…" (nenhuma coluna em @ aparece) → o rodapé não fala da @,
// em nenhum tipo — nem nos que têm Média (@) entre as colunas padrão.
const SEM_PESAGENS = { periodo: { preset: 'personalizado', from: '2020-01-01', to: '2020-01-02' } };
for (const view of views) {
  const vmVazio = await run(viewSelection(view, PESAGENS), ADMIN, SEM_PESAGENS);
  const docVazio = buildReportDocument(vmVazio);
  assert.equal(docVazio.empty, true, `controle ${view.label}: período sem pesagens`);
  assert.equal(docVazio.footer.arroba, null, `NEGATIVO ${view.label} vazio: sem "@ = peso vivo ÷ N" no rodapé`);
  const htmlVazio = decode(renderSheetBody(docVazio, { mode: 'print' }));
  assert.ok(htmlVazio.includes('Nenhum registro para os filtros informados.') && !htmlVazio.includes('peso vivo'), `NEGATIVO ${view.label} vazio: folha e rodapé sem @`);
}
assert.ok(buildReportDocument(await run(viewSelection('por-apartacao-data', PESAGENS), ADMIN, SEM_PESAGENS)).columns.some((column) => column.metric?.column?.unit === '@' || column.unit === '@'), 'controle: o tipo padrão vazio ainda lista Média (@) entre as colunas (por isso o rodapé precisa olhar as linhas)');
assert.equal(docFolha.footer.omitidas, null, 'NEGATIVO: sem coluna omitida, sem aviso');
// Cabeçalho: logo, produtor, fazenda, endereço – município-UF; CPF/CNPJ, IE e telefone só com a opção.
const cabecalho = decode(renderSheetBody(docFolha, { mode: 'print' }));
assert.ok(cabecalho.includes('ZIGOMAR FERREIRA FRANCO FILHO') && cabecalho.includes('FAZENDA KAIMAN') && cabecalho.includes('GLEBA RICARDO FRANCO SN, VILA BELA-MT'), 'produtor, fazenda e endereço, município-UF');
assert.ok(!cabecalho.includes('123.456.789-01') && !cabecalho.includes('ISENTO') && !cabecalho.includes('99999-0000'), 'NEGATIVO: sem a opção, nada de CPF/CNPJ, IE e telefone');
const comOpcao = decode(renderSheetBody(buildReportDocument(vmFolha, { header: buildPropertyHeader({ ...kaiman, mostrar_documento_no_cabecalho: true }) }), { mode: 'print' }));
assert.ok(comOpcao.includes('CPF 123.456.789-01 · IE ISENTO') && comOpcao.includes('Tel. (65) 99999-0000'), 'com "Mostrar no cabeçalho": CPF/CNPJ, IE e telefone');
const campoOpcao = PROPRIEDADES.campos.find((campo) => campo.id === 'mostrar_documento_no_cabecalho');
assert.equal(campoOpcao.defaultValue, false, '"Mostrar no cabeçalho" nasce DESMARCADO');
assert.equal(emptyFor(PROPRIEDADES).mostrar_documento_no_cabecalho, false, 'ficha nova com a opção desmarcada');
const preview = headerPreviewFromForm(PROPRIEDADES, { ...emptyFor(PROPRIEDADES), nome: 'Fazenda X', documento: '123.456.789-01', telefone: '(65) 3333-0000', inscricao_estadual: 'ISENTO' });
assert.deepEqual([preview.documentos, preview.telefone], [null, null], 'ficha nova preenchida sem marcar a opção: cabeçalho sem CPF, IE e telefone');
ok('folha-enxuta');

await resetDb();
resumo.ok = true;
resumo.tipos = views.map((view) => view.label);
resumo.padrao = PESAGENS.defaultView;
console.log(JSON.stringify(resumo, null, 2));
