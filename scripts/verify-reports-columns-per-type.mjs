// Gate reports:columns-per-type:verify (E1D 1.4.0) — Pesagens igual ao MAKGESTAO, parte do Agente C.
//   1. Colunas padrão de cada tipo = especificação (itens 4 e 5): Analítico (10 + 3 opcionais), resumidos (Lote +
//      10 visíveis + 6 no seletor), Vendas (as do contrato); a Matriz não tem seletor.
//   2. Escolha de "Colunas" por tipo e por usuário (report-type-columns): persiste, na ordem escolhida, e é
//      independente entre tipos, usuários e empresas; aplicada, muda a folha/colunas do tipo e só dele.
//   3. Chave inválida (fora do tipo, repetida, de outro modo) descartada; lista vazia/igual ao padrão = padrão;
//      tipo sem seletor ou inexistente recusado; estado gravado adulterado é limpo ao ler.
//   4. Papel sem valores comerciais (OPERADOR, CONSULTA) não recebe nem grava coluna sensível.
//   5. As 8 ordenações do antigo: rótulos e ordem exatos; em cada tipo a ordem REAL das linhas/seções numa
//      massa pequena (ausentes por último, "2" antes de "10"); Personalizado; clique no cabeçalho → opção;
//      clique numa métrica sem opção (Peso total, Qtd) num tipo resumido não tira as seções da ordem do tipo;
//      estado/modelo de antes da E1D abre na opção que mostra a ordem dele (nada invertido).
//   6. Analítico: botões de agrupamento (ordem de clique, clicar de novo tira, 4º não entra) e subtotal por
//      grupo (animais distintos, peso médio, GMD ponderado) na folha, no CSV e no XLSX.
// A grade usa os mesmos agregados do view model (reportUi.aggregateChips) — conferida aqui pelo view model.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { readAppSetting, writeAppSetting } from '../src/storage/indexedDb/repositories/index.js';
import { runReport as runReportService } from '../src/modules/reporting/application/reportService.js';
import { getReportViewState, getTypeColumnPrefs, saveReportViewState, saveTypeColumnPrefs, typeColumnsKey } from '../src/modules/reporting/application/reportTemplateService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import {
  ANALITICO_AVAILABLE_COLUMNS, ANALITICO_COLUMNS, EVENT_TOTALS, PESAGENS_SORT_CHOICES, SHEET_COLUMN_KEYS, SHEET_DEFAULT_KEYS,
  SHEET_TOTALS, VENDAS_AVAILABLE_COLUMNS, VENDAS_COLUMNS,
} from '../src/modules/reporting/definitions/pesagens.js';
import { applyColumnKeys, columnKeysOf, getReportView, resolveViewId, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { hasTypeColumns, typeColumnDefaults, typeColumnOptions } from '../src/modules/reporting/domain/typeColumns.js';
import { SORT_CHOICE_RULES, applySortChoice, legacySortChoice, sortChoiceForColumn, sortChoiceForMetric } from '../src/modules/reporting/domain/sortChoices.js';
import { toggleGroupChoice } from '../src/modules/reporting/domain/groupChoices.js';
import { MAX_GROUP_LEVELS } from '../src/modules/reporting/domain/groupEngine.js';
import { headerLabel } from '../src/modules/reporting/domain/reportFormatting.js';
import { buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { PESAGENS_SHEET_HEADERS } from '../src/modules/reporting/definitions/pesagens.js';
import { buildReportLines } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import { buildSheetRows } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
// M1 (1.5.0): a massa de ago–set/2026 (scripts/lib/reportFixtures) tem intervalos de 10 e 20 dias entre pesagens; este
// gate confere à mão números de outro assunto, então fixa o intervalo mínimo do GMD em 7 (todos os intervalos
// confiáveis — os números de antes). A regra do mínimo (21 padrão, 28; cinza, aviso, rodapé e contas só com o
// confiável) tem gate próprio com a MESMA massa: reports:gmd-confiabilidade:verify.
const runReport = (id, request = {}, actor) => runReportService(id, { gmdDiasMinimos: 7, ...request }, actor);

// ---------------------------------------------------------------------------------------------------------
// Massa: a dos gates (A1 101, A2 202, A3 303, A4 404) + 4 animais para as ordenações ("2", "7", "9", "10"),
// um Lote 03 e mais duas vendas. Conta à mão (apartação Engorda):
//   10/09: Lote 01 = 101 (345, GMD 15/20) + 9 (350, GMD 40/20) → peso médio 347,5, GMD 55/40 = 1,375
//          Lote 02 = 10 (320, GMD 40/40) + 2 (250, GMD 10/40)  → peso médio 285,  GMD 50/80 = 0,625
//          Lote 03 = 7 (400, cadastro, sem anterior)           → peso médio 400,  GMD —
//   período: Lote 01 peso médio 2400/7 = 342,86, GMD 85/60 = 1,417; Lote 02 2210/8 = 276,25, GMD 60/90 = 0,667;
//            Lote 03 400, GMD —.  Sexo: Macho 3730/11 = 339,09, GMD 125/100 = 1,25; Fêmea 1480/6 = 246,67, GMD 20/50 = 0,4.
// ---------------------------------------------------------------------------------------------------------
const { db } = await seedReportFixture();
const TS = '2026-09-01T00:00:00.000Z';
await db.table('loteApartacoes').add({ id: 'L3', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: 'Lote 03', quantidade_maxima: 10, peso_minimo: 250, peso_maximo: 350, created_at: TS, updated_at: TS, deleted_at: null });
const lote = (id) => ({ lote_id: id, nome_lote: `Lote 0${id.slice(1)}`, apartacao_id: 'ap1', nome_apartacao: 'Engorda' });
const animal = (animalId, numero, sexo, loteId) => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: animalId, numero_animal: numero, sexo,
  ...(sexo === 'M' ? { marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore' } : { marca: 'BETA', marca_id: 'm-beta', raca: 'Angus', raca_id: 'r-angus' }),
  ...lote(loteId),
});
const a10 = animal('A10', '10', 'M', 'L2');
const a2 = animal('A20', '2', 'F', 'L2');
const a9 = animal('A9', '9', 'M', 'L1');
const a7 = animal('A7', '7', 'M', 'L3');
for (const entry of [
  { ...a10, id: 'x1', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 280 },
  { ...a10, id: 'x2', tipo_manejo: 'Manejo', data_pesagem: '2026-09-10', peso: 320 },
  { ...a10, id: 'x3', tipo_manejo: 'Saída', motivo_saida: 'Venda', comprador: 'Frigo Sul', data_pesagem: '2026-09-12', peso: 330, valor_arroba: 300, valor_venda_total: 3300 },
  { ...a2, id: 'x4', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 240 },
  { ...a2, id: 'x5', tipo_manejo: 'Manejo', data_pesagem: '2026-09-10', peso: 250 },
  { ...a9, id: 'x6', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-21', peso: 310 },
  { ...a9, id: 'x7', tipo_manejo: 'Manejo', data_pesagem: '2026-09-10', peso: 350 },
  { ...a9, id: 'x8', tipo_manejo: 'Saída', motivo_saida: 'Venda', comprador: 'Boi Bom', data_pesagem: '2026-09-12', peso: 355, valor_arroba: 310, valor_venda_total: 3700 },
  { ...a7, id: 'x9', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-10', peso: 400 },
]) await weighingService.createEntry(entry);

const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const run = (selection, actor = ADMIN, params = P) => runReport('pesagens', { today: TODAY, params, selection }, actor);
const definition = getReportDefinition('pesagens');
const view = (id) => getReportView(definition, id);
const ids = (vm) => vm.rows.map((row) => row.id);
const plain = (value) => JSON.parse(JSON.stringify(value));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

/** Resumido em árvore de rótulos (na ordem das linhas): [{ label, children }]. */
function outline(summaryRows) {
  const root = { label: null, children: [] };
  const stack = [root];
  for (const row of summaryRows) {
    const node = { label: row.label, children: [] };
    stack.length = row.level;
    stack[row.level - 1].children.push(node);
    stack[row.level] = node;
  }
  return root.children;
}
const labels = (nodes) => nodes.map((node) => node.label);
const child = (nodes, label) => nodes.find((node) => node.label === label)?.children ?? assert.fail(`sem o grupo ${label}`);

// ---- 1. Colunas padrão de cada tipo = especificação ----
const ANALITICO_HEADERS = ['Data', 'Animal', 'Sexo', 'Raça', 'Peso (kg)', 'Lote', 'Apartação', 'Dias', 'Ganho (kg)', 'GMD (kg/dia)'];
assert.deepEqual(ANALITICO_COLUMNS, ['data_pesagem', 'numero_animal', 'sexo', 'raca', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd'], 'Analítico: colunas do antigo, na ordem dele');
assert.deepEqual(viewSelection('analitico', definition).columns, ANALITICO_COLUMNS, 'Analítico: padrão do tipo');
const analitico = await run({ view: 'analitico' });
assert.deepEqual(analitico.columns.map((column) => headerLabel(column)), ANALITICO_HEADERS, 'Analítico: cabeçalhos Data, Animal, Sexo, Raça, Peso, Lote, Apartação, Dias, Ganho, GMD');
assert.deepEqual(typeColumnOptions(definition, view('analitico'), 'ADMIN').filter((option) => !option.default).map((option) => option.label), ['Data anterior', 'Peso anterior (kg)', 'Observação'], 'Analítico: opcionais no seletor');
assert.deepEqual(typeColumnOptions(definition, view('analitico'), 'ADMIN').map((option) => option.key), ANALITICO_AVAILABLE_COLUMNS, 'Analítico: seletor na ordem do antigo');

const SHEET_HEADERS = ['Lote', 'Qtd', 'Faixa exigida (kg)', 'Menor (kg)', 'Maior (kg)', 'Peso médio (kg)', 'Média (@)', 'Peso total (kg)', 'GMD médio (kg/dia)', 'Machos', 'Fêmeas'];
const SHEET_EXTRA_LABELS = ['Total (@)', 'Ganho médio (kg)', 'Ganho médio (@)', 'Ganho total (kg)', 'Ganho total (@)', 'Dias médios'];
// E1D visual: a FOLHA dos tipos tem os cabeçalhos do antigo (Title Case, sem unidade — o "kg" vai em cada
// número); o seletor "Colunas", a grade e as exportações continuam com os rótulos de curral (metricLabels).
const SHEET_DOC_HEADERS = ['Lote', 'Qtd', 'Faixa Exigida', 'Menor', 'Maior', 'Peso Médio', 'Média (@)', 'Peso Total', 'GMD Médio', 'Machos', 'Fêmeas'];
for (const id of ['por-apartacao-lote', 'por-apartacao-data']) {
  const typed = view(id);
  assert.deepEqual(typed.columnChoices.available, [...SHEET_COLUMN_KEYS], `${id}: as 16 chaves do painel`);
  assert.deepEqual(columnKeysOf(typed, definition, viewSelection(typed, definition)), [...SHEET_DEFAULT_KEYS], `${id}: padrão do tipo`);
  const vm = await run({ view: id });
  const doc = buildReportDocument(vm, { showEmptyColumns: true });
  assert.deepEqual(doc.columns.map((column) => column.label), SHEET_DOC_HEADERS, `${id}: folha com Lote + as 10 visíveis por padrão (cabeçalhos do antigo)`);
  const options = typeColumnOptions(definition, typed, 'ADMIN');
  assert.deepEqual(options.filter((option) => !option.default).map((option) => option.label), SHEET_EXTRA_LABELS, `${id}: as outras 6 no seletor`);
  assert.deepEqual(options.filter((option) => option.default).map((option) => option.label), SHEET_HEADERS.slice(1), `${id}: rótulos das visíveis no seletor (os da grade e das exportações)`);
  assert.deepEqual(options.filter((option) => option.default).map((option) => PESAGENS_SHEET_HEADERS.metrics[option.key]), SHEET_DOC_HEADERS.slice(1), `${id}: as visíveis do seletor = as colunas da folha, na mesma ordem`);
}

assert.deepEqual(VENDAS_COLUMNS, ['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba', 'valor_arroba', 'valor_venda_calc'], 'Vendas: colunas do contrato (Valor Total = valor_venda_calc: digitado, senão @ viva × Valor @)');
assert.deepEqual((await run({ view: 'vendas' })).columns.map((column) => column.id), VENDAS_COLUMNS, 'Vendas: padrão do tipo (ADMIN)');
assert.deepEqual(typeColumnOptions(definition, view('vendas'), 'ADMIN').map((option) => option.key), VENDAS_AVAILABLE_COLUMNS, 'Vendas: seletor = as disponíveis do tipo');

assert.equal(hasTypeColumns(view('sintetico-matriz')), false, 'Matriz: sem seletor de colunas (a célula é fixa)');
assert.deepEqual(typeColumnOptions(definition, view('sintetico-matriz'), 'ADMIN'), []);

// ---- 2. Escolha por tipo e por usuário persiste e é independente ----
assert.deepEqual(await getTypeColumnPrefs('pesagens', ADMIN), {}, 'sem escolha salva');
const escolhaLote = ['peso_medio', 'qtd', 'ganho_total', 'faixa'];
const escolhaAnalitico = ['numero_animal', 'data_pesagem', 'peso', 'observacao', 'peso_anterior'];
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'por-apartacao-lote', escolhaLote, ADMIN), escolhaLote, 'grava na ordem escolhida');
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'analitico', escolhaAnalitico, ADMIN), escolhaAnalitico);
assert.deepEqual(await getTypeColumnPrefs('pesagens', ADMIN), { 'por-apartacao-lote': escolhaLote, analitico: escolhaAnalitico }, 'relida do banco, por tipo');
assert.deepEqual(await readAppSetting(typeColumnsKey('local', ADMIN.id)), { version: 1, reports: { pesagens: { 'por-apartacao-lote': escolhaLote, analitico: escolhaAnalitico } } }, 'formato da chave report-type-columns');
assert.deepEqual(await getTypeColumnPrefs('pesagens', GESTOR), {}, 'outro usuário não herda a escolha');
assert.deepEqual(await getTypeColumnPrefs('pesagens', ADMIN, { empresaId: 'outra' }), {}, 'outra empresa não herda a escolha');
await saveTypeColumnPrefs('pesagens', 'por-apartacao-lote', ['qtd'], GESTOR);
assert.deepEqual(await getTypeColumnPrefs('pesagens', GESTOR), { 'por-apartacao-lote': ['qtd'] });
assert.deepEqual((await getTypeColumnPrefs('pesagens', ADMIN))['por-apartacao-lote'], escolhaLote, 'a escolha do GESTOR não muda a do ADMIN');
await saveTypeColumnPrefs('pesagens', 'por-apartacao-data', ['qtd', 'machos'], ADMIN);
assert.deepEqual((await getTypeColumnPrefs('pesagens', ADMIN))['por-apartacao-lote'], escolhaLote, 'gravar um tipo não muda o outro');

// Aplicada (como a tela faz ao abrir/trocar de tipo): muda só aquele tipo.
const prefs = await getTypeColumnPrefs('pesagens', ADMIN);
const typedSelection = (id) => ({ ...viewSelection(view(id), definition), ...(prefs[id] ? applyColumnKeys(view(id), definition, prefs[id]) : {}) });
const loteEscolhido = await run(typedSelection('por-apartacao-lote'));
assert.deepEqual(buildReportDocument(loteEscolhido, { showEmptyColumns: true }).columns.map((column) => column.label), ['Lote', 'Peso Médio', 'Qtd', 'Ganho Total', 'Faixa Exigida'], 'Por Apartação/Lote: folha com a escolha, na ordem');
assert.deepEqual(columnKeysOf(view('por-apartacao-lote'), definition, typedSelection('por-apartacao-lote')), escolhaLote, 'ida e volta chave → totais → chave');
assert.deepEqual((await run(typedSelection('analitico'))).columns.map((column) => column.id), escolhaAnalitico, 'Analítico: colunas da escolha, na ordem');
assert.equal(prefs['sintetico-matriz'], undefined, 'Matriz: nada salvo (sem seletor)');
assert.deepEqual(columnKeysOf(view('vendas'), definition, typedSelection('vendas')), VENDAS_COLUMNS, 'Vendas sem escolha: padrão do tipo');

// Lista vazia ou igual ao padrão = volta ao padrão (a escolha sai; os outros tipos ficam).
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'por-apartacao-data', [], ADMIN), [], 'lista vazia = padrão');
assert.deepEqual(Object.keys(await getTypeColumnPrefs('pesagens', ADMIN)).sort(), ['analitico', 'por-apartacao-lote']);
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'analitico', [...ANALITICO_COLUMNS], ADMIN), [], 'igual ao padrão = padrão');
assert.deepEqual(Object.keys(await getTypeColumnPrefs('pesagens', ADMIN)), ['por-apartacao-lote']);

// E1F (muda o contrato da E1D): coluna ESCOLHIDA em "Colunas" aparece mesmo sem valor ("-") — marcar faz a coluna
// aparecer, como no MAKGESTAO; no padrão do tipo, a coluna sem valor continua sumindo (E1C; "Mostrar colunas
// vazias" traz de volta). Gate reports:colunas-todas:verify cobre todos os relatórios.
const agosto = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-08-31' } };
const semObs = await run({ view: 'analitico', columns: ['data_pesagem', 'numero_animal', 'observacao'] }, ADMIN, agosto);
assert.equal(semObs.columnsChosen, true, 'escolha ≠ padrão do tipo');
assert.deepEqual(buildReportDocument(semObs).hiddenColumns, [], 'Observação escolhida e sem valor continua na folha');
assert.ok(documentRows(buildReportDocument(semObs)).filter((row) => row.type === 'DATA').every((row) => row.cells.find((cell) => cell.key === 'observacao').text === '-'), 'sem valor: "-"');
const padraoAgosto = await run({ view: 'analitico' }, ADMIN, agosto);
assert.equal(padraoAgosto.columnsChosen, false, 'padrão do tipo');
assert.ok(!buildReportDocument(padraoAgosto).columns.some((column) => column.key === 'observacao'), 'controle: Observação não é do padrão');
assert.equal(buildReportDocument(padraoAgosto, { showEmptyColumns: true }).hiddenColumns.length, 0, '"Mostrar colunas vazias" traz de volta as do padrão');

// ---- 3. Chave inválida descartada; recusas ----
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'por-apartacao-lote', ['xpto', 'qtd', 'qtd', 'numero_animal', 'faixa_min', 'faixa'], ADMIN), ['qtd', 'faixa'], 'NEGATIVO: fora do tipo, repetida e id de métrica solta saem');
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'analitico', ['peso', 'qtd', 'valor_venda_total', 'tipo_manejo'], ADMIN), ['peso'], 'NEGATIVO: chave de outro tipo/modo sai');
assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'por-apartacao-data', ['xpto'], ADMIN), [], 'NEGATIVO: tudo inválido = padrão');
assert.equal((await getTypeColumnPrefs('pesagens', ADMIN))['por-apartacao-data'], undefined);
await assert.rejects(() => saveTypeColumnPrefs('pesagens', 'sintetico-matriz', ['qtd'], ADMIN), /não tem seletor de colunas/, 'NEGATIVO: Matriz sem seletor');
await assert.rejects(() => saveTypeColumnPrefs('pesagens', 'por-lote', ['qtd'], ADMIN), /Tipo de relatório inexistente/, 'NEGATIVO: tipo da E1B que saiu');
await assert.rejects(() => saveTypeColumnPrefs('desempenho', 'padrao', ['animais'], ADMIN), /Tipo de relatório inexistente/, 'NEGATIVO: tipo gerado (sem declaração) não tem escolha');
await assert.rejects(() => saveTypeColumnPrefs('pesagens', 'analitico', 'peso', ADMIN), /lista/, 'NEGATIVO: chaves têm de ser lista');
await assert.rejects(() => saveTypeColumnPrefs('pesagens.periodo', 'analitico', ['peso'], ADMIN), /Relatório inexistente/, 'NEGATIVO: id antigo não grava');
await assert.rejects(() => saveTypeColumnPrefs('pesagens', 'analitico', ['peso'], { role: 'ADMIN' }), /AUTH|perfil|permiss/i, 'NEGATIVO: sem usuário');
// Estado adulterado: tipo que saiu, tipo sem seletor e chaves inválidas somem ao ler.
await writeAppSetting(typeColumnsKey('local', GESTOR.id), { version: 1, reports: { pesagens: { 'por-lote': ['qtd'], 'sintetico-matriz': ['qtd'], analitico: ['xpto'], vendas: ['comprador', 'xpto', 'peso'] }, desconhecido: { x: ['y'] } } });
assert.deepEqual(await getTypeColumnPrefs('pesagens', GESTOR), { vendas: ['comprador', 'peso'] }, 'NEGATIVO: estado adulterado limpo ao ler');
await writeAppSetting(typeColumnsKey('local', GESTOR.id), 'lixo');
assert.deepEqual(await getTypeColumnPrefs('pesagens', GESTOR), {}, 'NEGATIVO: estado ilegível = sem escolha');

// ---- 4. Papel sem valores comerciais não recebe nem grava coluna sensível ----
const SENSIVEIS = ['valor_arroba', 'valor_venda_calc'];
for (const actor of [OPERADOR, CONSULTA]) {
  const offered = typeColumnOptions(definition, view('vendas'), actor.role).map((option) => option.key);
  assert.ok(SENSIVEIS.every((key) => !offered.includes(key)), `${actor.role}: seletor sem valores comerciais`);
  assert.deepEqual(typeColumnDefaults(definition, view('vendas'), actor.role), VENDAS_COLUMNS.filter((key) => !SENSIVEIS.includes(key)), `${actor.role}: padrão que o papel vê`);
  assert.deepEqual(await saveTypeColumnPrefs('pesagens', 'vendas', ['comprador', 'valor_venda_calc', 'peso', 'valor_arroba'], actor), ['comprador', 'peso'], `NEGATIVO ${actor.role}: coluna sensível não é gravada`);
  assert.ok(!JSON.stringify(await readAppSetting(typeColumnsKey('local', actor.id))).includes('valor_'), `${actor.role}: nada de valor no banco`);
}
assert.ok(SENSIVEIS.every((key) => typeColumnOptions(definition, view('vendas'), 'ADMIN').some((option) => option.key === key)), 'ADMIN vê as colunas de valor');
// Escolha gravada com valor (papel rebaixado depois, ou banco mexido): ao ler, o papel sem valores não recebe.
await writeAppSetting(typeColumnsKey('local', CONSULTA.id), { version: 1, reports: { pesagens: { vendas: ['valor_venda_calc', 'comprador', 'valor_arroba', 'peso'] } } });
assert.deepEqual(await getTypeColumnPrefs('pesagens', CONSULTA), { vendas: ['comprador', 'peso'] }, 'NEGATIVO: a leitura nunca amplia permissão');

// ---- 5. As 8 ordenações ----
assert.deepEqual(plain(PESAGENS_SORT_CHOICES), [
  { id: 'data_desc', label: 'Data (Mais Recente)' }, { id: 'data_asc', label: 'Data (Mais Antiga)' },
  { id: 'peso_desc', label: 'Peso (Maior)' }, { id: 'peso_asc', label: 'Peso (Menor)' },
  { id: 'gmd_desc', label: 'GMD (Maior)' }, { id: 'gmd_asc', label: 'GMD (Menor)' },
  { id: 'animal_asc', label: 'Animal (A-Z)' }, { id: 'lote_asc', label: 'Lote (A-Z)' },
], 'as 8 opções do antigo, rótulos e ordem exatos');
assert.equal(definition.defaultSortChoice, 'data_desc', 'padrão: Data (Mais Recente)');
assert.deepEqual(Object.keys(SORT_CHOICE_RULES), PESAGENS_SORT_CHOICES.map((choice) => choice.id), 'cada opção tem regra');

// Analítico (Detalhado, sem grupo): ordem REAL das linhas.
// E1G: as saídas com peso (x3 5,0; x8 2,5; e6 0,952) têm GMD contra a pesagem anterior e saem dos "sem GMD".
const NULOS_GMD = ['e9', 'x9', 'e8', 'x6', 'e7', 'e4', 'x4', 'x1', 'e1'];
const ANALITICO_ORDENS = {
  data_desc: ['x8', 'x3', 'e9', 'x5', 'x9', 'x7', 'x2', 'e3', 'e6', 'e8', 'x6', 'e2', 'e5', 'e7', 'e4', 'x4', 'x1', 'e1'],
  data_asc: ['x4', 'x1', 'e1', 'e4', 'e7', 'e5', 'x6', 'e2', 'e8', 'e6', 'x5', 'x9', 'x7', 'x2', 'e3', 'x8', 'x3', 'e9'],
  peso_desc: ['e7', 'x9', 'x8', 'x7', 'e3', 'x3', 'e2', 'x2', 'x6', 'e1', 'e6', 'x1', 'e5', 'x5', 'e4', 'x4', 'e9', 'e8'],
  peso_asc: ['e9', 'x4', 'x5', 'e4', 'e5', 'e6', 'x1', 'e1', 'x6', 'x2', 'x3', 'e2', 'e3', 'x7', 'x8', 'x9', 'e7', 'e8'],
  gmd_desc: ['x3', 'x8', 'x7', 'e2', 'x2', 'e5', 'e6', 'e3', 'x5', ...NULOS_GMD],
  gmd_asc: ['x5', 'e3', 'e6', 'x2', 'e5', 'e2', 'x7', 'x8', 'x3', ...NULOS_GMD],
  animal_asc: ['x5', 'x4', 'x9', 'x8', 'x7', 'x6', 'x3', 'x2', 'x1', 'e3', 'e2', 'e1', 'e6', 'e5', 'e4', 'e8', 'e7', 'e9'],
  lote_asc: ['x8', 'x7', 'e3', 'e8', 'x6', 'e2', 'e7', 'e1', 'x3', 'x5', 'x2', 'e6', 'e5', 'e4', 'x4', 'x1', 'x9', 'e9'],
};
for (const [choice, expected] of Object.entries(ANALITICO_ORDENS)) {
  const vm = await run({ view: 'analitico', sortChoice: choice });
  assert.deepEqual(ids(vm), expected, `Analítico ${choice}: ordem das linhas`);
  assert.equal(vm.sortChoice, choice);
  assert.equal(vm.summarySort, null, `Analítico ${choice}: sem ordem de grupos`);
}
const porAnimal = await run({ view: 'analitico', sortChoice: 'animal_asc' });
assert.deepEqual([...new Set(porAnimal.rows.map((row) => row.numero_animal))], ['2', '7', '9', '10', '101', '202', '303', '404'], 'Animal (A-Z): "2" antes de "10" (numérico)');
assert.equal((await run({ view: 'analitico', sortChoice: 'peso_desc' })).rows.at(-1).peso, null, 'peso ausente por último no Maior');
assert.equal((await run({ view: 'analitico', sortChoice: 'peso_asc' })).rows.at(-1).peso, null, 'peso ausente por último no Menor');
// Com botões de agrupamento: grupos na ordem natural, a opção ordena dentro de cada grupo.
const analiticoLote = await run({ view: 'analitico', groups: [{ columnId: 'nome_lote' }], sortChoice: 'animal_asc' });
assert.deepEqual(analiticoLote.tree.map((node) => node.label), ['Lote 01', 'Lote 02', 'Lote 03', 'Não informado'], 'Analítico por Lote: grupos em ordem natural, "Não informado" por último');
assert.deepEqual(analiticoLote.tree[0].rows.map((row) => row.id), ['x8', 'x7', 'x6', 'e3', 'e2', 'e1', 'e8', 'e7'], 'Lote 01: linhas por Animal (A-Z), data mais recente');
const analiticoLoteGmd = await run({ view: 'analitico', groups: [{ columnId: 'nome_lote' }], sortChoice: 'gmd_desc' });
assert.deepEqual(analiticoLoteGmd.tree.map((node) => node.label), ['Lote 01', 'Lote 02', 'Lote 03', 'Não informado'], 'a opção não reordena os grupos do Detalhado');
assert.deepEqual(analiticoLoteGmd.tree[1].rows.map((row) => row.id), ['x3', 'x2', 'e5', 'e6', 'x5', 'e4', 'x4', 'x1'], 'Lote 02: GMD (Maior), sem GMD por último');

// Vendas (Detalhado): por comprador (ordem natural), a opção ordena as vendas dentro de cada comprador.
const VENDAS_ORDENS = { data_desc: ['x3', 'e6'], data_asc: ['e6', 'x3'], peso_desc: ['x3', 'e6'], peso_asc: ['e6', 'x3'], animal_asc: ['x3', 'e6'] };
for (const [choice, frigo] of Object.entries(VENDAS_ORDENS)) {
  const vm = await run({ view: 'vendas', sortChoice: choice });
  assert.deepEqual(vm.tree.map((node) => node.label), ['Boi Bom', 'Frigo Sul'], `Vendas ${choice}: compradores em ordem natural`);
  assert.deepEqual(vm.tree[1].rows.map((row) => row.id), frigo, `Vendas ${choice}: vendas do Frigo Sul`);
}

// Por Apartação (Resumo por Data): "Data" = direção do nível Data; peso/GMD ordenam os lotes de cada data.
const DATAS = ['2026-09-12', '2026-09-10', '2026-09-05', '2026-09-01', '2026-08-21', '2026-08-15', '2026-08-10', '2026-08-05', '2026-08-01'];
const RESUMO_DATA = {
  data_desc: { datas: DATAS, dia10: ['Lote 01', 'Lote 02', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: null },
  data_asc: { datas: [...DATAS].reverse(), dia10: ['Lote 01', 'Lote 02', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: null },
  peso_desc: { datas: DATAS, dia10: ['Lote 03', 'Lote 01', 'Lote 02'], dia12: ['Lote 01', 'Lote 02'], summarySort: { key: 'peso_medio', direction: 'desc', columnId: 'nome_lote' } },
  peso_asc: { datas: DATAS, dia10: ['Lote 02', 'Lote 01', 'Lote 03'], dia12: ['Lote 02', 'Lote 01'], summarySort: { key: 'peso_medio', direction: 'asc', columnId: 'nome_lote' } },
  // E1G: em 12/09 as duas vendas têm GMD (Lote 02 x3 5,0; Lote 01 x8 2,5). M1 (1.5.0): são 2 dias depois da pesagem de
  // 10/09 — intervalo curto (cinza), FORA do GMD médio do lote: o dia fica sem GMD confiável e os lotes vão na ordem
  // natural (antes da M1 o 5,0 de 2 dias punha o Lote 02 na frente). O GMD continua ordenando os lotes de 10/09.
  gmd_desc: { datas: DATAS, dia10: ['Lote 01', 'Lote 02', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: { key: 'gmd_medio', direction: 'desc', columnId: 'nome_lote' } },
  gmd_asc: { datas: DATAS, dia10: ['Lote 02', 'Lote 01', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: { key: 'gmd_medio', direction: 'asc', columnId: 'nome_lote' } },
  animal_asc: { datas: DATAS, dia10: ['Lote 01', 'Lote 02', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: null },
  lote_asc: { datas: DATAS, dia10: ['Lote 01', 'Lote 02', 'Lote 03'], dia12: ['Lote 01', 'Lote 02'], summarySort: null },
};
for (const [choice, expected] of Object.entries(RESUMO_DATA)) {
  const vm = await run({ view: 'por-apartacao-data', sortChoice: choice });
  const tree = outline(vm.summaryRows);
  assert.deepEqual(labels(tree), ['Engorda', 'Não informado'], `Resumo por Data ${choice}: apartações em ordem natural`);
  const engorda = child(tree, 'Engorda');
  assert.deepEqual(labels(engorda), expected.datas, `Resumo por Data ${choice}: ordem das datas`);
  assert.deepEqual(labels(child(engorda, '2026-09-10')), expected.dia10, `Resumo por Data ${choice}: lotes de 10/09 (GMD ausente por último)`);
  assert.deepEqual(labels(child(engorda, '2026-09-12')), expected.dia12, `Resumo por Data ${choice}: lotes de 12/09 (as duas vendas com GMD: ordem pelo GMD; sem GMD, ordem natural)`);
  assert.deepEqual(plain(vm.summarySort), expected.summarySort, `Resumo por Data ${choice}: métrica equivalente só no nível Lote`);
  // A folha segue a mesma ordem (seções, tabela de cada data e o TOTAL POR LOTE).
  const doc = buildReportDocument(vm, { showEmptyColumns: true });
  const secao = doc.sections[0];
  assert.deepEqual(secao.sections.map((section) => section.title.replace('DATA: ', '')), expected.datas.map((iso) => iso.split('-').reverse().join('/')), `folha ${choice}: seções de data`);
  const dia10 = secao.sections.find((section) => section.title === 'DATA: 10/09/2026');
  assert.deepEqual(dia10.table.rows.filter((row) => row.type === 'GROUP').map((row) => row.cells[0].text), expected.dia10, `folha ${choice}: tabela de 10/09`);
}
const totalPorLote = (vm) => buildReportDocument(vm, { showEmptyColumns: true }).sections[0].leafTotal.rows.filter((row) => row.type === 'LEAF_TOTAL').map((row) => row.cells[0].text);
assert.deepEqual(totalPorLote(await run({ view: 'por-apartacao-data', sortChoice: 'peso_desc' })), ['Lote 03', 'Lote 01', 'Lote 02'], 'TOTAL POR LOTE pelo peso médio (400; 342,86; 276,25)');
assert.deepEqual(totalPorLote(await run({ view: 'por-apartacao-data', sortChoice: 'gmd_asc' })), ['Lote 02', 'Lote 01', 'Lote 03'], 'TOTAL POR LOTE pelo GMD (Lote 02 < Lote 01 1,417; Lote 03 sem GMD — M1: as vendas de 2 dias ficam fora)');

// Por Apartação/Lote: sem nível de data — "Data" = ordem natural; peso/GMD como acima.
const APARTACAO_LOTE = {
  data_desc: ['Lote 01', 'Lote 02', 'Lote 03'], data_asc: ['Lote 01', 'Lote 02', 'Lote 03'],
  peso_desc: ['Lote 03', 'Lote 01', 'Lote 02'], peso_asc: ['Lote 02', 'Lote 01', 'Lote 03'],
  gmd_desc: ['Lote 01', 'Lote 02', 'Lote 03'], gmd_asc: ['Lote 02', 'Lote 01', 'Lote 03'],
  animal_asc: ['Lote 01', 'Lote 02', 'Lote 03'], lote_asc: ['Lote 01', 'Lote 02', 'Lote 03'],
};
for (const [choice, expected] of Object.entries(APARTACAO_LOTE)) {
  const vm = await run({ view: 'por-apartacao-lote', sortChoice: choice });
  const tree = outline(vm.summaryRows);
  assert.deepEqual(labels(tree), ['Engorda', 'Não informado'], `Por Apartação/Lote ${choice}: apartações`);
  assert.deepEqual(labels(child(tree, 'Engorda')), expected, `Por Apartação/Lote ${choice}: lotes da Engorda`);
  const doc = buildReportDocument(vm, { showEmptyColumns: true });
  assert.deepEqual(doc.sections[0].table.rows.filter((row) => row.type === 'GROUP').map((row) => row.cells[0].text), expected, `folha ${choice}: mesma ordem`);
}

// Sintético (Matriz): peso/GMD ordenam as linhas (eixo Y) pelo total da linha; "Data" vira a direção do Mês.
const MATRIZ = {
  peso_desc: ['Macho', 'Fêmea'], peso_asc: ['Fêmea', 'Macho'], gmd_desc: ['Macho', 'Fêmea'], gmd_asc: ['Fêmea', 'Macho'],
  data_desc: ['Fêmea', 'Macho'], data_asc: ['Fêmea', 'Macho'], animal_asc: ['Fêmea', 'Macho'], lote_asc: ['Fêmea', 'Macho'],
};
for (const [choice, expected] of Object.entries(MATRIZ)) {
  const vm = await run({ view: 'sintetico-matriz', sortChoice: choice });
  const tree = outline(vm.summaryRows);
  assert.deepEqual(labels(tree), expected, `Matriz ${choice}: linhas (Sexo)`);
  assert.deepEqual(labels(child(tree, 'Macho')), ['Lote 01', 'Lote 02', 'Lote 03'], `Matriz ${choice}: colunas (Lote) em ordem natural`);
  const rule = SORT_CHOICE_RULES[choice];
  const expectedSort = ['peso', 'gmd'].includes(rule.kind) ? { key: rule.kind === 'peso' ? 'peso_medio' : 'gmd_medio', direction: rule.direction, columnId: 'sexo' } : null;
  assert.deepEqual(plain(vm.summarySort), expectedSort, `Matriz ${choice}: summarySort = total da linha`);
}
for (const [choice, meses] of [['data_desc', ['set/2026', 'ago/2026']], ['data_asc', ['ago/2026', 'set/2026']], ['peso_desc', ['ago/2026', 'set/2026']]]) {
  const vm = await run({ view: 'sintetico-matriz', matrix: { eixoY: 'sexo', eixoX: 'mes' }, sortChoice: choice });
  assert.equal(vm.groups[1].columnId, 'mes_pesagem');
  assert.deepEqual(labels(child(outline(vm.summaryRows), 'Macho')), meses, `Matriz × Mês ${choice}: meses`);
}

// Clique no cabeçalho de uma métrica SEM opção equivalente (Qtd, Peso total, Média (@)…) dentro de um tipo
// resumido ("Personalizado"): como nas opções, só as linhas do nível folha (na Matriz, as linhas do eixo Y) —
// as seções (apartação, data) e as colunas da Matriz ficam na ordem do tipo. A tela grava sortChoice null,
// summarySort SEM nível e os níveis como estavam; o modelo e o último estado também guardam sem nível.
const resumoData = viewSelection('por-apartacao-data', definition);
const dataFolha = (iso) => iso.split('-').reverse().join('/');
for (const [antes, datas] of [['data_desc', DATAS], ['data_asc', [...DATAS].reverse()]]) {
  const niveis = applySortChoice(definition, view('por-apartacao-data'), resumoData, antes).groups;
  const vm = await run({ ...resumoData, groups: niveis, sortChoice: null, summarySort: { key: 'peso_total', direction: 'asc' } });
  const engorda = child(outline(vm.summaryRows), 'Engorda');
  assert.deepEqual(labels(engorda), datas, `Resumo por Data, "Peso total" depois de ${antes}: datas na ordem de antes (não pelo peso total)`);
  assert.deepEqual(labels(child(engorda, '2026-09-10')), ['Lote 03', 'Lote 02', 'Lote 01'], `Resumo por Data, "Peso total" depois de ${antes}: lotes de 10/09 pelo peso total (400; 570; 695)`);
  assert.deepEqual(plain(vm.summarySort), { key: 'peso_total', direction: 'asc', columnId: 'nome_lote' }, 'métrica sem opção: só no nível Lote');
  const secoes = buildReportDocument(vm, { showEmptyColumns: true }).sections[0].sections.map((section) => section.title.replace('DATA: ', ''));
  assert.deepEqual(secoes, datas.map(dataFolha), `folha, "Peso total" depois de ${antes}: seções de data na ordem de antes`);
}
await saveReportViewState('pesagens', { ...resumoData, sortChoice: null, summarySort: { key: 'peso_total', direction: 'asc' }, period: P.periodo }, ADMIN);
const reaberto = await getReportViewState('pesagens', ADMIN);
assert.deepEqual(plain(reaberto.selection.summarySort), { key: 'peso_total', direction: 'asc' }, 'último estado guarda a métrica sem o nível');
const vmReaberto = await run(reaberto.selection, ADMIN, reaberto.params);
assert.deepEqual(labels(child(outline(vmReaberto.summaryRows), 'Engorda')), DATAS, 'último estado reaberto: datas na ordem do tipo');
const matrizQtd = await run({ ...viewSelection('sintetico-matriz', definition), sortChoice: null, summarySort: { key: 'qtd', direction: 'asc' } });
assert.deepEqual(labels(outline(matrizQtd.summaryRows)), ['Fêmea', 'Macho'], 'Matriz, "Qtd" crescente: linhas (eixo Y) pela Qtd');
assert.deepEqual(labels(child(outline(matrizQtd.summaryRows), 'Macho')), ['Lote 01', 'Lote 02', 'Lote 03'], 'Matriz, "Qtd": colunas (Lote) em ordem natural, não pela Qtd');
assert.deepEqual(plain(matrizQtd.summarySort), { key: 'qtd', direction: 'asc', columnId: 'sexo' }, 'Matriz: métrica sem opção só no eixo Y');

// Personalizado (sem tipo): linhas pela opção; no Resumido a métrica equivalente se estiver nos totais.
assert.deepEqual(ids(await run({ view: null, mode: 'DETALHADO', groups: [], sortChoice: 'peso_desc' })), ANALITICO_ORDENS.peso_desc, 'Personalizado Detalhado: linhas pela opção');
const personalizadoGmd = await run({ view: null, mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: EVENT_TOTALS, sortChoice: 'gmd_desc' });
assert.deepEqual(plain(personalizadoGmd.summarySort), { key: 'gmd_ponderado', direction: 'desc', columnId: 'nome_lote' }, 'Personalizado Resumido: GMD achado pela operação (id gmd_ponderado)');
assert.deepEqual(personalizadoGmd.summaryRows.map((row) => row.label), ['Lote 01', 'Lote 02', 'Lote 03', 'Não informado'], 'Personalizado Resumido: por GMD, sem GMD e "Não informado" por último');
const semPeso = await run({ view: null, mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'registros', op: 'count' }], sortChoice: 'peso_desc' });
assert.equal(semPeso.summarySort, null, 'Personalizado Resumido sem peso médio nos totais: ordem natural');
assert.deepEqual(semPeso.summaryRows.map((row) => row.label), ['Lote 01', 'Lote 02', 'Lote 03', 'Não informado']);
const porData = await run({ view: null, mode: 'RESUMIDO', groups: [{ columnId: 'data_pesagem' }], sortChoice: 'data_asc' });
assert.equal(porData.groups[0].direction, 'asc', 'Personalizado por data: "Data (Mais Antiga)"');
assert.equal((await run({ view: null, mode: 'RESUMIDO', groups: [{ columnId: 'data_pesagem' }], sortChoice: 'data_desc' })).groups[0].direction, 'desc');
const semOpcao = await run({ view: null, mode: 'DETALHADO', groups: [], sort: [{ columnId: 'sexo', direction: 'asc' }], sortChoice: null });
assert.deepEqual(plain(semOpcao.sort), [{ columnId: 'sexo', direction: 'asc' }], 'sem opção ("Personalizado" de um clique): a ordem da tela vale');

// Modelo/último estado de antes da E1D (sem sortChoice): abre na opção que mostra a ordem que ele tinha. O
// "Data (mais antiga)" da E1B no Resumido gravava só a direção do nível — não pode abrir em "Data (Mais
// Recente)" com as datas invertidas. Com ordem própria (linhas, métrica), "Personalizado" (null).
const legado = {
  mode: 'RESUMIDO', aggregates: SHEET_TOTALS, sort: definition.defaultSort, summarySort: null,
  groups: [{ columnId: 'nome_apartacao', direction: 'asc' }, { columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'nome_lote', direction: 'asc' }],
};
await saveReportViewState('pesagens', { ...legado, period: P.periodo }, ADMIN);
const legadoReaberto = (await getReportViewState('pesagens', ADMIN)).selection;
assert.equal(legadoReaberto.sortChoice, undefined, 'estado antigo volta sem sortChoice');
const legadoTipo = resolveViewId(definition, legadoReaberto);
assert.equal(legadoTipo, null, 'data na mais antiga não é o tipo Resumo por Data (que abre na mais recente): Personalizado');
const legadoOpcao = legacySortChoice(definition, null, legadoReaberto);
assert.equal(legadoOpcao, 'data_asc', 'estado antigo com "Data (mais antiga)" abre em "Data (Mais Antiga)", não na padrão');
const datasLegado = async (sortChoice) => labels(child(outline((await run({ ...legadoReaberto, view: legadoTipo, sortChoice })).summaryRows), 'Engorda'));
assert.deepEqual(await datasLegado(null), [...DATAS].reverse(), 'estado antigo sozinho: datas da mais antiga para a mais recente');
assert.deepEqual(await datasLegado(legadoOpcao), [...DATAS].reverse(), 'com a opção escolhida: a mesma ordem (nada invertido)');
const legadoRecente = { ...legado, groups: view('por-apartacao-data').groups };
assert.equal(resolveViewId(definition, legadoRecente), 'por-apartacao-data');
assert.equal(legacySortChoice(definition, view('por-apartacao-data'), legadoRecente), 'data_desc', 'tipo com a data na mais recente: a padrão');
assert.equal(legacySortChoice(definition, null, { ...legado, groups: [{ columnId: 'nome_lote' }] }), 'data_desc', 'sem nível de data: a padrão');
assert.equal(legacySortChoice(definition, null, { ...legado, groups: [{ columnId: 'data_pesagem', direction: 'desc' }] }), 'data_desc', 'Personalizado por data, mais recente: a padrão');
assert.equal(legacySortChoice(definition, null, { ...legado, sort: [{ columnId: 'gmd', direction: 'desc' }] }), null, 'ordem de linhas própria: Personalizado');
assert.equal(legacySortChoice(definition, null, { ...legado, summarySort: { key: 'peso_total', direction: 'desc' } }), null, 'métrica própria: Personalizado');
assert.equal(legacySortChoice(getReportDefinition('desempenho'), null, legado), null, 'relatório sem "Ordenar por" fixo: sem opção');

// Negativos.
await assert.rejects(() => run({ view: 'analitico', sortChoice: 'xpto' }), /opção de ordenação desconhecida/, 'NEGATIVO: opção inexistente');
await assert.rejects(() => runReport('desempenho', { today: TODAY, params: P, selection: { sortChoice: 'data_desc' } }, ADMIN), /opção de ordenação desconhecida/, 'NEGATIVO: relatório sem "Ordenar por" fixo');
assert.deepEqual(plain(applySortChoice(definition, view('analitico'), { sort: [{ columnId: 'sexo', direction: 'asc' }], groups: [] }, null).sort), [{ columnId: 'sexo', direction: 'asc' }], 'sem opção: seleção como veio');

// Clique no cabeçalho (tela): a opção equivalente, ou null (o seletor mostra "Personalizado").
assert.equal(sortChoiceForColumn(definition, 'peso', 'asc'), 'peso_asc');
assert.equal(sortChoiceForColumn(definition, 'peso', 'desc'), 'peso_desc');
assert.equal(sortChoiceForColumn(definition, 'data_pesagem', 'desc'), 'data_desc');
assert.equal(sortChoiceForColumn(definition, 'gmd', 'asc'), 'gmd_asc');
assert.equal(sortChoiceForColumn(definition, 'numero_animal', 'asc'), 'animal_asc');
assert.equal(sortChoiceForColumn(definition, 'nome_lote', 'asc'), 'lote_asc');
assert.equal(sortChoiceForColumn(definition, 'numero_animal', 'desc'), null, 'Animal Z-A não é opção do antigo');
assert.equal(sortChoiceForColumn(definition, 'sexo', 'asc'), null, 'Sexo não é opção do antigo');
assert.equal(sortChoiceForMetric(definition, SHEET_TOTALS, 'peso_medio', 'desc'), 'peso_desc');
assert.equal(sortChoiceForMetric(definition, SHEET_TOTALS, 'gmd_medio', 'asc'), 'gmd_asc');
assert.equal(sortChoiceForMetric(definition, EVENT_TOTALS, 'gmd_ponderado', 'desc'), 'gmd_desc');
assert.equal(sortChoiceForMetric(definition, SHEET_TOTALS, 'media_arroba', 'desc'), null, 'Média (@) não é opção do antigo');
assert.equal(sortChoiceForMetric(definition, SHEET_TOTALS, 'xpto', 'desc'), null);

// ---- 6. Analítico: botões de agrupamento e subtotal por grupo ----
const CHOICES = view('analitico').groupChoices;
assert.deepEqual(CHOICES, ['nome_lote', 'nome_apartacao', 'sexo', 'raca'], 'botões Lote, Apartação, Sexo, Raça');
assert.deepEqual(CHOICES.map((id) => definition.columns.find((column) => column.id === id).label), ['Lote', 'Apartação', 'Sexo', 'Raça'], 'rótulos com acento');
let groups = [];
for (const id of ['sexo', 'nome_lote', 'raca']) groups = toggleGroupChoice(CHOICES, groups, id).groups;
assert.deepEqual(groups.map((group) => group.columnId), ['sexo', 'nome_lote', 'raca'], 'ordem de clique');
const quarto = toggleGroupChoice(CHOICES, groups, 'nome_apartacao');
assert.equal(quarto.blocked, true, `NEGATIVO: o ${MAX_GROUP_LEVELS + 1}º clique não entra`);
assert.deepEqual(quarto.groups, groups);
groups = toggleGroupChoice(CHOICES, groups, 'nome_lote').groups;
assert.deepEqual(groups.map((group) => group.columnId), ['sexo', 'raca'], 'clicar de novo tira; os de baixo sobem');
assert.equal(toggleGroupChoice(CHOICES, groups, 'tipo_manejo').blocked, true, 'NEGATIVO: coluna que não é botão');
const tresNiveis = await run({ view: 'analitico', groups: [{ columnId: 'sexo' }, { columnId: 'nome_lote' }, { columnId: 'raca' }] });
assert.deepEqual(tresNiveis.groups.map((group) => group.columnId), ['sexo', 'nome_lote', 'raca'], 'níveis do motor na ordem de clique');
assert.equal(tresNiveis.view.id, 'analitico', 'continua no tipo Analítico');
await assert.rejects(() => run({ view: 'analitico', groups: CHOICES.map((columnId) => ({ columnId })) }), /no máximo 3 níveis/, 'NEGATIVO: 4 níveis');
await assert.rejects(() => run({ view: 'analitico', groups: [{ columnId: 'tipo_manejo' }] }), /agrupa só por/, 'NEGATIVO: agrupamento fora dos botões');

const porLote = await run({ view: 'analitico', groups: [{ columnId: 'nome_lote' }] });
const lote01 = porLote.tree[0];
assert.deepEqual(porLote.aggregates.map((spec) => spec.id), ['animais', 'peso_medio', 'gmd_medio'], 'subtotal do Analítico: animais, peso médio, GMD médio');
assert.equal(lote01.aggregates.animais.value, 3, 'Lote 01: 3 animais distintos em 8 pesagens');
close(lote01.aggregates.peso_medio.value, 2400 / 7, 'Lote 01: peso médio');
// E1G: a venda x8 (350 → 355 em 2 d) entrava no GMD do Lote 01: (85 + 5) ÷ (60 + 2). M1 (1.5.0): 2 dias é intervalo
// curto (cinza, fora da média) — o GMD do lote fica 85 ÷ 60; o de antes (90 ÷ 62) é o NEGATIVO.
close(lote01.aggregates.gmd_medio.value, 85 / 60, 'Lote 01: GMD ponderado (nunca média simples dos GMD), sem o intervalo curto');
assert.ok(Math.abs(lote01.aggregates.gmd_medio.value - 90 / 62) > 1e-6, 'NEGATIVO (M1): a venda de 2 dias não puxa mais o GMD do lote');
assert.equal(porLote.totals.animais.value, 8, 'Total geral: 8 animais (recalculado, não soma)');
// E1D visual: na folha (cara do MAKGESTAO) o grupo é o próprio valor ("LOTE 01") e o subtotal é a linha de
// texto do antigo — "Subtotal: 3 animais | Peso Médio: 342,9 kg | GMD Médio: 1,417 kg/dia" (M1: sem a venda de 2 dias) — com os números do
// motor (animais distintos, GMD ponderado); o TOTAL GERAL leva também o Ganho Total, como o antigo.
const folhaPorLote = buildReportDocument(porLote, { showEmptyColumns: true });
assert.deepEqual(folhaPorLote.sections.map((section) => section.title), ['LOTE 01', 'LOTE 02', 'LOTE 03', 'NÃO INFORMADO'], 'folha: título do grupo = o valor, como no antigo');
const linhas = documentRows(folhaPorLote).filter((row) => row.line);
assert.deepEqual(linhas.map((row) => row.line.items[0].label), ['Subtotal', 'Subtotal', 'Subtotal', 'Subtotal', 'TOTAL GERAL'], 'folha: subtotal por grupo + TOTAL GERAL');
assert.deepEqual(linhas[0].line.items.map((item) => item.text), ['3 animais', '342,9 kg', '1,417 kg/dia'], 'folha: Lote 01');
assert.deepEqual(linhas[0].line.items.map((item) => item.raw), [lote01.aggregates.animais.value, lote01.aggregates.peso_medio.value, lote01.aggregates.gmd_medio.value], 'folha: Lote 01 = motor (animais distintos, GMD ponderado)');
assert.deepEqual(linhas[2].line.items.map((item) => item.text), ['1 animal', '400,0 kg', '-'], 'folha: Lote 03 sem GMD = "-"');
assert.equal(linhas.at(-1).line.items[0].raw, porLote.totals.animais.value, 'folha: TOTAL GERAL = animais distintos da população (8), não soma');
assert.equal(linhas.at(-1).line.items.at(-1).label, 'Ganho Total', 'folha: TOTAL GERAL com o Ganho Total do antigo');
const csvSub = buildReportLines(porLote, 'csv').lines.filter((line) => line.type === 'SUBTOTAL' && line.group === 'Lote 01');
assert.deepEqual(csvSub.map((line) => line.value), ['3', '342,9', '1,417'], 'CSV: subtotal do Lote 01');
const xlsxSub = buildSheetRows(porLote).rows.filter((row) => row.kind === 'SUBTOTAL' && row.cells[1][0] === 'Lote 01').map((row) => row.cells[3][0]);
assert.equal(xlsxSub.length, 3, 'XLSX: 3 linhas de subtotal do Lote 01');
// Número de verdade, com as casas da folha (kg agregado com 1 casa, GMD com 3) — como os demais totais do XLSX.
assert.deepEqual(xlsxSub, [3, 342.9, 1.417], 'XLSX: animais, peso médio e GMD ponderado do Lote 01 (números)');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:columns-per-type:verify', ok: true,
  tipos: ['analitico', 'sintetico-matriz', 'por-apartacao-lote', 'por-apartacao-data', 'vendas'],
  ordenacoes: PESAGENS_SORT_CHOICES.length,
}, null, 2));
