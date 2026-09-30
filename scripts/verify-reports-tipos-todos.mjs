// Gate reports:tipos-todos:verify (E1E 1.4.0, parte T) — "Tipo Relatório" em todos os relatórios do catálogo
// (docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md, item 3; Pesagens e Comercial têm gates próprios):
//   1. cada relatório declara os seus tipos (nomes, ordem e agrupamento escritos à mão), o padrão, um tipo lista
//      (Analítico) e titleKind pelo modo; nenhum tipo gerado; versão 2 (ganhou tipos); Controle continua sem;
//   2. cada tipo roda no motor com a massa do fixture, sem erro, no modo/agrupamento/totais dele, com a população
//      dele (cadeado) quando tem — e é só atalho: o mesmo resultado que a seleção equivalente sem tipo;
//   3. contas conferidas à mão em cada relatório;
//   4. /Relatorios?r=<id> sem modelo, visão antiga nem último estado abre no tipo padrão (código da tela);
//   5. estados antigos: visão antiga (favorito/link, alias da E1), modelo da 1.3.x, último estado da E1B/E1C (sem
//      `view`) e da E1D (`view: null`, versão 1) abrem no tipo que bate pela estrutura, com os MESMOS dados do
//      relatório antigo; o que não bate — ou bateria só estreitando a população — abre "Personalizado";
//   6. ida e volta: cada tipo gravado no último estado reabre nele.
// Cada regra tem caso negativo.
import assert from 'node:assert/strict';
import { ADMIN, GESTOR, TODAY, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { buildInitialReportState } from '../src/modules/reporting/application/reportInitialState.js';
import { getReportViewState, saveReportViewState, templateToRequest } from '../src/modules/reporting/application/reportTemplateService.js';
import { LEGACY_REPORT_ALIASES, getReportDefinition, listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { getLegacyAlias } from '../src/modules/reporting/definitions/legacyAliases.js';
import { typesByStructure } from '../src/modules/reporting/definitions/legacyViews.js';
import { getReportView, listReportViews, matchView, resolveViewId, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { isFilterActive } from '../src/modules/reporting/domain/filterEngine.js';
import { writeAppSetting } from '../src/storage/indexedDb/repositories/index.js';

const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const plain = (value) => JSON.parse(JSON.stringify(value));
const resumo = { gate: 'reports:tipos-todos:verify', ok: false, regras: [], relatorios: {} };
const ok = (regra) => resumo.regras.push(regra);
const paramsOf = (definition) => (definition.params.some((param) => param.type === 'period') ? P : {});
const run = (definition, selection, { today = TODAY, actor = ADMIN } = {}) => runReport(definition.id, { today, params: paramsOf(definition), selection, arrobaDivisor: 30 }, actor);
// Filtros da tela → serviço (components/reports/reportUi.toServiceFilters, que importa React): enum/entidade pelo
// rótulo exibido, exceto a condição herdada de relatório antigo (match "code").
const serviceFilters = (definition, uiFilters = {}) => Object.fromEntries(Object.entries(uiFilters).filter(([, filter]) => isFilterActive(filter)).map(([columnId, filter]) => {
  const column = definition.columns.find((item) => item.id === columnId);
  return [columnId, column && ['entity', 'enum'].includes(column.type) && typeof filter === 'object' && filter.match !== 'code' ? { ...filter, match: 'label' } : filter];
}));
// Seleção como a tela manda ao serviço (ReportView.execute).
const selectionOf = (state, definition) => ({
  columns: state.columns, filters: serviceFilters(definition, state.uiFilters), fixedFilters: state.fixedFilters ?? {}, groups: state.groups, aggregates: state.aggregates,
  sort: state.sort, search: state.search ?? '', mode: state.mode, summarySort: state.summarySort, drill: [], view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
});
// Identidade de uma linha em qualquer grão (pesagem, animal, permanência, lote, documento).
const keyOfRow = (row) => JSON.stringify([row.id ?? null, row.animal_id ?? null, row.numero_animal ?? null, row.data_pesagem ?? row.inicio ?? null, row.lote_id ?? null, row.documento_id ?? null]);
const rowKeys = (vm) => vm.rows.map(keyOfRow).sort();
const totalsOf = (vm) => Object.fromEntries(Object.entries(vm.totals).map(([id, total]) => [id, total.value]));
const levelRows = (vm, level = 1) => vm.summaryRows.filter((row) => row.level === level);
const metric = (row, id) => row.aggregates[id]?.value ?? null;

await seedReportFixture();

// ---------------------------------------------------------------------------
// 1. Tipos declarados (escritos à mão: nome, ordem, modo, agrupamento), padrão, lista, titleKind
// ---------------------------------------------------------------------------
const R = 'RESUMIDO';
const D = 'DETALHADO';
const ESPERADO = {
  'rebanho.atual': ['por-lote', [
    ['por-lote', 'Por Lote', R, ['lote_atual']],
    ['por-apartacao-lote', 'Por Apartação/Lote', R, ['apartacao_atual', 'lote_atual']],
    ['por-apartacao', 'Por Apartação', R, ['apartacao_atual']],
    ['por-categoria', 'Por Categoria', R, ['categoria']],
    ['por-raca', 'Por Raça', R, ['raca']],
    ['por-marca', 'Por Marca', R, ['marca']],
    ['por-sexo', 'Por Sexo', R, ['sexo']],
    ['por-situacao', 'Por Situação', R, ['situacao']],
    ['por-faixa-peso', 'Por Faixa de Peso', R, ['faixa_peso']],
    ['analitico', 'Analítico (Lista de Animais)', D, []],
    ['sem-pesagem-recente', 'Sem Pesagem Recente', D, []],
  ]],
  'rebanho.ocupacao-lotes': ['por-apartacao', [
    ['por-apartacao', 'Por Apartação', R, ['apartacao']],
    ['por-apartacao-lote', 'Por Apartação/Lote', R, ['apartacao', 'lote']],
    ['analitico', 'Analítico (Lista de Lotes)', D, []],
  ]],
  'controle.fechamento-dia': ['por-sessao', [
    ['por-sessao', 'Por Sessão (Lista)', D, ['sessao']],
    ['resumo-por-sessao', 'Resumo por Sessão', R, ['sessao']],
    ['por-apartacao-lote', 'Por Apartação/Lote', R, ['nome_apartacao', 'nome_lote']],
    ['com-pendencias', 'Com Pendências', D, ['pendencias']],
    ['analitico', 'Analítico (Lista do Dia)', D, []],
  ]],
  desempenho: ['por-lote', [
    ['por-lote', 'Por Lote', R, ['lote']],
    ['por-apartacao-lote', 'Por Apartação/Lote', R, ['apartacao', 'lote']],
    ['por-apartacao', 'Por Apartação', R, ['apartacao']],
    ['por-categoria', 'Por Categoria', R, ['categoria']],
    ['por-raca', 'Por Raça', R, ['raca']],
    ['por-marca', 'Por Marca', R, ['marca']],
    ['por-sexo', 'Por Sexo', R, ['sexo']],
    ['por-faixa-peso', 'Por Faixa de Peso', R, ['faixa_peso']],
    ['analitico', 'Analítico (Animal por Animal)', D, []],
    ['perdendo-peso', 'Perdendo Peso', D, []],
  ]],
  'movimentacao.lotes': ['por-lote', [
    ['por-lote', 'Por Lote', R, ['lote']],
    ['por-apartacao-lote', 'Por Apartação/Lote', R, ['apartacao', 'lote']],
    ['mudancas-lote', 'Mudanças de Lote', R, ['lote']],
    ['por-lote-anterior', 'Por Lote Anterior', R, ['lote_origem']],
    ['por-marca', 'Por Marca', R, ['marca']],
    ['por-sexo', 'Por Sexo', R, ['sexo']],
    ['analitico', 'Analítico (Lista de Permanências)', D, []],
  ]],
  saidas: ['por-motivo', [
    ['por-motivo', 'Por Motivo', R, ['motivo_saida']],
    ['por-lote', 'Por Lote', R, ['nome_lote']],
    ['por-categoria', 'Por Categoria', R, ['categoria']],
    ['por-marca', 'Por Marca', R, ['marca']],
    ['por-data', 'Por Data', R, ['data_pesagem']],
    ['mortes-por-causa', 'Mortes por Causa', R, ['causa_morte']],
    ['mortes-por-lote', 'Mortes por Lote', R, ['nome_lote']],
    ['mortes-por-categoria', 'Mortes por Categoria', R, ['categoria']],
    ['analitico', 'Analítico (Lista de Saídas)', D, []],
    ['mortes', 'Mortes (Lista)', D, []],
  ]],
  'embarques.romaneio': ['por-embarque-documento', [
    ['por-embarque-documento', 'Por Embarque/Documento', R, ['embarque_nome', 'documento_numero']],
    ['por-embarque', 'Por Embarque', R, ['embarque_nome']],
    ['romaneio-lista', 'Romaneio (Lista por Documento)', D, ['embarque_nome', 'documento_numero']],
    ['analitico', 'Analítico (Lista de Animais)', D, []],
  ]],
  'embarques.previsto-realizado': ['por-embarque', [
    ['por-embarque', 'Por Embarque', R, ['embarque']],
    ['por-destino', 'Por Destino', R, ['destino']],
    ['analitico', 'Analítico (Lista de Documentos)', D, []],
  ]],
};
// População (condição fixa, com cadeado) de cada tipo que tem uma: colunas.
const POPULACAO = {
  'rebanho.atual/sem-pesagem-recente': ['dias_sem_pesagem'],
  'desempenho/perdendo-peso': ['ganho'],
  'movimentacao.lotes/mudancas-lote': ['mudanca', 'entrada_no_periodo'],
  'saidas/mortes-por-causa': ['motivo_saida'],
  'saidas/mortes-por-lote': ['motivo_saida'],
  'saidas/mortes-por-categoria': ['motivo_saida'],
  'saidas/mortes': ['motivo_saida'],
  'controle.fechamento-dia/com-pendencias': ['pendencias'],
};

// Todos os relatórios do catálogo, menos Pesagens (reports:pesagens-tipos) e Comercial (reports:comercial).
const CATALOGO = listReportDefinitions().filter((definition) => definition.id !== 'pesagens' && definition.family !== 'comercial');
assert.deepEqual(CATALOGO.map((definition) => definition.id).sort(), Object.keys(ESPERADO).sort(), 'a lista do gate cobre todos os relatórios do catálogo (relatório novo sem tipos declarados reprova aqui)');
for (const definition of CATALOGO) {
  const [padrao, tipos] = ESPERADO[definition.id];
  const views = listReportViews(definition);
  assert.deepEqual(views.map((view) => [view.id, view.label, view.mode, view.groups.map((group) => group.columnId)]), tipos, `${definition.id}: tipos (nomes, ordem, modo, agrupamento)`);
  assert.ok(views.every((view) => !view.generated), `${definition.id}: nenhum tipo gerado ("Resumo por …"/"Analítico" automáticos saíram)`);
  assert.equal(definition.defaultView, padrao, `${definition.id}: tipo padrão`);
  assert.equal(definition.version, 2, `${definition.id}: versão 2 (ganhou tipos — estado gravado na 1 sem tipo abre pela estrutura)`);
  assert.ok(typesByStructure(definition), `${definition.id}: estado antigo sem tipo abre pela estrutura`);
  assert.ok(views.some((view) => view.mode === D && view.id === 'analitico' && view.groups.length === 0), `${definition.id}: tem o tipo lista Analítico`);
  for (const view of views) {
    assert.equal(view.titleKind, view.mode === R ? 'Sintético' : 'Analítico', `${definition.id}/${view.id}: titleKind pelo modo`);
    assert.match(view.id, /^[a-z]+(-[a-z]+)*$/, `${definition.id}/${view.id}: id estável em minúsculas`);
    assert.ok(view.aggregates?.length, `${definition.id}/${view.id}: totais próprios (subtotais e total geral)`);
    if (view.mode === R) assert.ok(view.columnChoices?.available?.length && view.columnChoices.defaults.every((key) => view.columnChoices.available.includes(key)), `${definition.id}/${view.id}: resumido com "Colunas Painel"`);
    if (view.mode === D) assert.ok(view.columns?.length, `${definition.id}/${view.id}: lista com colunas próprias`);
    assert.deepEqual(Object.keys(view.population ?? {}), POPULACAO[`${definition.id}/${view.id}`] ?? [], `${definition.id}/${view.id}: população do tipo`);
  }
  assert.equal(new Set(views.map((view) => view.label)).size, views.length, `${definition.id}: rótulos únicos`);
  resumo.relatorios[definition.id] = { padrao, tipos: views.map((view) => view.label) };
}
// Controle (aba da Manutenção) e Pesagens não mudam aqui.
for (const definition of listReportDefinitions({ visibility: 'maintenance' })) {
  assert.equal(definition.defaultView, null, `NEGATIVO: ${definition.id} (Controle) continua sem tipos declarados`);
  assert.equal(typesByStructure(definition), false, `NEGATIVO: ${definition.id} sem tipos, nada a reconhecer`);
}
const PESAGENS = getReportDefinition('pesagens');
assert.equal(typesByStructure(PESAGENS), false, 'NEGATIVO: Pesagens continua como na E1D (o que não converte abre Personalizado)');
ok('tipos-declarados');

// ---------------------------------------------------------------------------
// 2. Cada tipo roda no motor: modo, agrupamento, totais, população — e é só atalho
// ---------------------------------------------------------------------------
let tiposRodados = 0;
for (const definition of CATALOGO) {
  for (const view of listReportViews(definition)) {
    const where = `${definition.id}/${view.id}`;
    const selection = viewSelection(view, definition);
    const vm = await run(definition, selection);
    assert.deepEqual(vm.view, { id: view.id, label: view.label, layout: null, titleKind: view.titleKind }, `${where}: executa no tipo`);
    assert.equal(vm.mode, view.mode, `${where}: modo do tipo`);
    assert.deepEqual(vm.groups.map((group) => group.columnId), view.groups.map((group) => group.columnId), `${where}: agrupamento do tipo`);
    const expectedMetrics = view.columnChoices ? view.columnChoices.defaults : view.aggregates.map((spec) => spec.id);
    assert.deepEqual(vm.aggregates.map((spec) => spec.id), expectedMetrics, `${where}: totais do tipo, na ordem da folha`);
    if (view.mode === D) assert.deepEqual(vm.columns.map((column) => column.id), view.columns, `${where}: colunas da lista`);
    const locked = Object.keys(definition.lockedFilters ? definition.lockedFilters({}) : {});
    assert.deepEqual(Object.keys(vm.lockedFilters).sort(), [...new Set([...locked, ...(POPULACAO[where] ?? [])])].sort(), `${where}: população do tipo com cadeado (só a dele)`);
    // Só atalho (nenhuma conta nova): a mesma seleção sem tipo, com a população como condição fixa, dá o mesmo.
    const equivalente = await run(definition, { ...selection, view: null, fixedFilters: view.population ?? {} });
    assert.equal(equivalente.view, null, `${where}: controle sem tipo`);
    assert.deepEqual(rowKeys(vm), rowKeys(equivalente), `${where}: mesma população da seleção equivalente`);
    assert.deepEqual(totalsOf(vm), totalsOf(equivalente), `${where}: mesmos totais da seleção equivalente`);
    if (vm.summaryRows) assert.deepEqual(plain(vm.summaryRows.map((row) => [row.level, row.label, row.aggregates])), plain(equivalente.summaryRows.map((row) => [row.level, row.label, row.aggregates])), `${where}: mesmas linhas do resumo`);
    tiposRodados += 1;
  }
}
// Negativos: tipo inexistente e agrupamento fora do tipo são recusados pelo serviço.
const REBANHO = getReportDefinition('rebanho.atual');
await assert.rejects(() => run(REBANHO, { view: 'por-era' }), /tipo de relatório desconhecido/, 'NEGATIVO: tipo inexistente');
await assert.rejects(() => run(REBANHO, { ...viewSelection('por-lote', REBANHO), groups: [{ columnId: 'era' }] }), /agrupa por lote_atual/, 'NEGATIVO: agrupamento fora do tipo');
resumo.tiposRodados = tiposRodados;
ok('tipos-rodam');

// ---------------------------------------------------------------------------
// 3. Contas à mão (massa de reportFixtures: A1 macho L1 300→330→345; A2 fêmea L2 250→260→venda 280; A3 macho L1
//    410→morte sem peso; A4 fêmea sem lote 200; embarque Sul/GTA 12345 com a venda de A2, previsto 2 fêmeas)
// ---------------------------------------------------------------------------
const byView = async (definitionId, viewId, options) => {
  const definition = getReportDefinition(definitionId);
  return run(definition, viewSelection(viewId, definition), options);
};
// Rebanho: só ativos (A1 em Lote 01, A4 sem lote); peso atual = última pesagem.
const rebLote = await byView('rebanho.atual', 'por-lote');
assert.deepEqual(levelRows(rebLote).map((row) => [row.label, metric(row, 'animais'), metric(row, 'peso_total')]), [['Lote 01', 1, 345], ['Não informado', 1, 200]], 'Rebanho Por Lote: Lote 01 (A1 345 kg) e sem lote (A4 200 kg)');
assert.deepEqual(totalsOf(rebLote), { animais: 2, peso_min: 200, peso_max: 345, peso_medio: 272.5, peso_total: 545 }, 'Rebanho Por Lote: total geral');
const rebSituacao = await byView('rebanho.atual', 'por-situacao');
assert.deepEqual(levelRows(rebSituacao).map((row) => [row.label, metric(row, 'animais')]), [['Ativo', 2], ['Morto', 1], ['Vendido', 1]], 'Rebanho Por Situação: todas as situações (sem o filtro de ativos)');
const rebApLote = await byView('rebanho.atual', 'por-apartacao-lote');
assert.deepEqual(rebApLote.summaryRows.map((row) => [row.level, row.label, metric(row, 'animais')]), [[1, 'Engorda', 1], [2, 'Lote 01', 1], [1, 'Não informado', 1], [2, 'Não informado', 1]], 'Rebanho Por Apartação/Lote: seção Engorda › Lote 01');
// Sem Pesagem Recente: em 20/10 A1 está há 40 dias e A4 há 38 (mais de 30); em 15/09, ninguém.
const semPesagem = await byView('rebanho.atual', 'sem-pesagem-recente', { today: '2026-10-20' });
assert.deepEqual(semPesagem.rows.map((row) => [row.numero_animal, row.dias_sem_pesagem]), [['101', 40], ['404', 38]], 'Sem Pesagem Recente: mais de 30 dias, maior primeiro');
assert.deepEqual(totalsOf(semPesagem), { animais: 2, dias_medio: 39, dias_max: 40 }, 'Sem Pesagem Recente: totais');
assert.equal((await byView('rebanho.atual', 'sem-pesagem-recente')).rowCount, 0, 'NEGATIVO: em 15/09 ninguém passou de 30 dias');
// Ocupação: Lote 01 com A1 (10 vagas), Lote 02 vazio (A2 vendida); ocupação = 1 ÷ 20.
const ocup = await byView('rebanho.ocupacao-lotes', 'por-apartacao-lote');
assert.deepEqual(ocup.summaryRows.map((row) => [row.level, row.label, metric(row, 'animais'), metric(row, 'capacidade')]), [[1, 'Engorda', 1, 20], [2, 'Lote 01', 1, 10], [2, 'Lote 02', 0, 10]], 'Ocupação Por Apartação/Lote');
assert.equal(ocup.totals.ocupacao.value, 5, 'Ocupação: 1 animal ÷ 20 vagas = 5%');
// Desempenho: ganho A1 +45 em 40 d, A2 +30 em 31 d (a venda pesou 280); GMD ponderado = 75 ÷ 71.
const desLote = await byView('desempenho', 'por-lote');
assert.deepEqual(levelRows(desLote).map((row) => [row.label, metric(row, 'animais'), metric(row, 'ganho_total')]), [['Lote 01', 2, 45], ['Lote 02', 1, 30], ['Não informado', 1, null]], 'Desempenho Por Lote');
assert.equal(desLote.totals.gmd_ponderado.value, 75 / 71, 'Desempenho: GMD do grupo ponderado (Σ ganho ÷ Σ dias), nunca média de médias');
assert.equal((await byView('desempenho', 'perdendo-peso')).rowCount, 0, 'Perdendo Peso: ninguém perdeu peso na massa');
// Saídas: uma venda (A2 280 kg) e uma morte (A3, "Raio", sem peso).
const saiMotivo = await byView('saidas', 'por-motivo');
assert.deepEqual(levelRows(saiMotivo).map((row) => [row.label, metric(row, 'animais'), metric(row, 'peso_total')]), [['Morte', 1, null], ['Venda', 1, 280]], 'Saídas Por Motivo');
const mortesCausa = await byView('saidas', 'mortes-por-causa');
assert.deepEqual(levelRows(mortesCausa).map((row) => [row.label, metric(row, 'mortes'), metric(row, 'animais')]), [['Raio', 1, 1]], 'Mortes por Causa: só as mortes');
assert.deepEqual((await byView('saidas', 'mortes')).rows.map((row) => row.numero_animal), ['303'], 'Mortes (Lista): só a morte de A3');
// Movimentação: A1 e A3 no Lote 01, A2 no Lote 02; ninguém mudou de lote.
const movLote = await byView('movimentacao.lotes', 'por-lote');
assert.deepEqual(levelRows(movLote).map((row) => [row.label, metric(row, 'animais'), metric(row, 'permanencias')]), [['Lote 01', 2, 2], ['Lote 02', 1, 1]], 'Movimentação Por Lote');
assert.equal((await byView('movimentacao.lotes', 'mudancas-lote')).totals.animais.value, 0, 'Mudanças de Lote: ninguém veio de outro lote');
// Fechamento: 9 lançamentos de 4 animais; só a pesagem de A4 (sem lote) tem pendência.
const fechamento = await byView('controle.fechamento-dia', 'por-sessao');
assert.deepEqual([fechamento.rowCount, fechamento.totals.animais.value, fechamento.totals.peso_total.value], [9, 4, 2375], 'Fechamento Por Sessão (Lista)');
const pendencias = await byView('controle.fechamento-dia', 'com-pendencias');
assert.deepEqual(pendencias.rows.map((row) => row.numero_animal), ['404'], 'Com Pendências: só A4 (sem lote)');
// Embarques: a venda de A2 no embarque Sul, GTA 12345 (previstas 2 fêmeas, realizada 1).
const romaneio = await byView('embarques.romaneio', 'por-embarque-documento');
assert.deepEqual(romaneio.summaryRows.map((row) => [row.level, row.label, metric(row, 'animais'), metric(row, 'peso_total')]), [[1, 'Embarque Sul', 1, 280], [2, '12345', 1, 280]], 'Romaneio Por Embarque/Documento');
assert.deepEqual((await byView('embarques.romaneio', 'romaneio-lista')).rows.map((row) => row.numero_animal), ['202'], 'Romaneio (Lista por Documento)');
const previsto = await byView('embarques.previsto-realizado', 'por-embarque');
assert.deepEqual(levelRows(previsto).map((row) => [row.label, metric(row, 'previsto'), metric(row, 'realizado'), metric(row, 'diferenca')]), [['Embarque Sul', 2, 1, -1]], 'Previsto × realizado Por Embarque');
ok('contas-a-mao');

// ---------------------------------------------------------------------------
// 4. Abertura sem modelo, visão antiga nem último estado: tipo padrão (o MESMO código da tela)
// ---------------------------------------------------------------------------
for (const definition of CATALOGO) {
  const { state, warnings } = buildInitialReportState(definition, { role: 'ADMIN' });
  assert.deepEqual(warnings, [], `${definition.id}: sem avisos`);
  assert.equal(state.view, definition.defaultView, `${definition.id}: abre no tipo padrão`);
  assert.equal(resolveViewId(definition, state), definition.defaultView, `${definition.id}: o seletor "Tipo Relatório" mostra o padrão`);
  const padrao = viewSelection(definition.defaultView, definition);
  assert.deepEqual(plain({ groups: state.groups, mode: state.mode, aggregates: state.aggregates, columns: state.columns }), plain({ groups: padrao.groups, mode: padrao.mode, aggregates: padrao.aggregates, columns: padrao.columns }), `${definition.id}: seleção do tipo padrão`);
  const vm = await run(definition, selectionOf(state, definition));
  assert.equal(vm.view?.id, definition.defaultView, `${definition.id}: executa no tipo padrão`);
}
ok('abre-no-padrao');

// ---------------------------------------------------------------------------
// 5. Estados antigos
// ---------------------------------------------------------------------------
// 5a. Visão antiga (favorito, recente ou link ?r=<id antigo>, alias da E1) → o tipo que É o relatório antigo, com
//     os mesmos dados do relatório antigo (runReport pelo id antigo = a seleção congelada da E1).
const ALIAS_TIPO = {
  'rebanho.inventario': 'analitico',
  'rebanho.dimensao.marca': 'por-marca',
  'rebanho.dimensao.raca': 'por-raca',
  'rebanho.dimensao.categoria': 'por-categoria',
  'rebanho.dimensao.sexo': 'por-sexo',
  'rebanho.dimensao.situacao': 'por-situacao',
  'rebanho.dimensao.lote': 'por-lote',
  'rebanho.dimensao.apartacao': 'por-apartacao',
  'rebanho.dimensao.faixa_peso': 'por-faixa-peso',
  'rebanho.sem-pesagem-recente': 'sem-pesagem-recente',
  'desempenho.individual': 'analitico',
  'desempenho.lote': 'por-apartacao-lote',
  'desempenho.dimensao.marca': 'por-marca',
  'desempenho.dimensao.raca': 'por-raca',
  'desempenho.dimensao.categoria': 'por-categoria',
  'desempenho.dimensao.sexo': 'por-sexo',
  'desempenho.dimensao.lote': 'por-lote',
  'desempenho.dimensao.apartacao': 'por-apartacao',
  'desempenho.perdendo-peso': 'perdendo-peso',
  'desempenho.faixa-peso': 'por-faixa-peso',
  'movimentacao.mudancas-lote': 'mudancas-lote',
  'movimentacao.permanencias-lote': 'por-lote',
  'saidas.motivo': 'por-motivo',
  'saidas.mortes': 'mortes',
  'saidas.mortes.causa': 'mortes-por-causa',
  'saidas.mortes.categoria': 'mortes-por-categoria',
  'saidas.mortes.lote': 'mortes-por-lote',
};
const aliasesDestes = Object.entries(LEGACY_REPORT_ALIASES).filter(([, entry]) => CATALOGO.some((definition) => definition.id === entry.id)).map(([id]) => id).sort();
assert.deepEqual(aliasesDestes, Object.keys(ALIAS_TIPO).sort(), 'todo relatório antigo consolidado nestes relatórios tem o seu tipo (alias novo sem tipo reprova aqui)');
for (const [aliasId, viewId] of Object.entries(ALIAS_TIPO)) {
  const preset = getLegacyAlias(aliasId);
  const definition = getReportDefinition(preset.id);
  const { state } = buildInitialReportState(definition, { preset, role: 'ADMIN' });
  assert.equal(state.view, viewId, `${aliasId}: abre no tipo "${getReportView(definition, viewId).label}"`);
  const today = aliasId === 'rebanho.sem-pesagem-recente' ? '2026-10-20' : TODAY;
  const vm = await run(definition, selectionOf(state, definition), { today });
  const antigo = await runReport(aliasId, { today, params: paramsOf(definition), arrobaDivisor: 30 }, ADMIN);
  assert.equal(vm.view?.id, viewId, `${aliasId}: executa no tipo`);
  assert.deepEqual(rowKeys(vm), rowKeys(antigo), `${aliasId}: mesma população do relatório antigo`);
  assert.deepEqual(totalsOf(vm), totalsOf(antigo), `${aliasId}: mesmos totais do relatório antigo`);
  if (antigo.summaryRows) assert.deepEqual(plain(vm.summaryRows.map((row) => [row.label, row.aggregates])), plain(antigo.summaryRows.map((row) => [row.label, row.aggregates])), `${aliasId}: mesmas linhas do resumo`);
}
// Pesagens (controle): visão antiga continua Personalizado, como na E1D.
assert.equal(buildInitialReportState(PESAGENS, { preset: getLegacyAlias('pesagens.sessao'), role: 'ADMIN' }).state.view, null, 'NEGATIVO: visão antiga de Pesagens continua Personalizado');
ok('visao-antiga');

// 5b. Modelos da 1.3.x (id do relatório antigo, convertidos em memória ao abrir — templateToRequest).
const T = (id, baseReportId, extra) => ({
  version: 1, id, name: id, baseReportId, baseReportVersion: 1, scope: 'PERSONAL', ownerUserId: GESTOR.id, ownerName: GESTOR.nome,
  columns: [], filters: {}, groups: [], sort: [], period: null, params: {}, search: '', widths: {}, orientation: 'auto',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: GESTOR.id, ...extra,
});
// Totais como a tela da 1.3.x gravava (os padrão de cada relatório antigo), escritos à mão.
const HERD_13 = [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'peso_total', columnId: 'ultimo_peso_kg', op: 'sum' }, { id: 'peso_medio', columnId: 'ultimo_peso_kg', op: 'avg' }, { id: 'peso_min', columnId: 'ultimo_peso_kg', op: 'min' }, { id: 'peso_max', columnId: 'ultimo_peso_kg', op: 'max' }];
const PERF_13 = [
  { id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'pesagens', columnId: 'pesagens', op: 'sum' }, { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' }, { id: 'ganho_total', columnId: 'ganho', op: 'sum' }, { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' }, { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
];
const DEATH_13 = [{ id: 'mortes', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }];
const modelos = [
  ['raça', T('m-raca', 'rebanho.dimensao.raca', { groups: [{ columnId: 'raca', direction: 'asc' }], aggregates: HERD_13, filters: { situacao: { operator: 'in', value: '', valueTo: '', values: ['ATIVO'] } } }), 'rebanho.atual', 'por-raca'],
  ['individual', T('m-individual', 'desempenho.individual', { aggregates: PERF_13, period: P.periodo }), 'desempenho', 'analitico'],
  ['mortes por causa', T('m-causa', 'saidas.mortes.causa', { groups: [{ columnId: 'causa_morte' }], aggregates: DEATH_13, period: P.periodo }), 'saidas', 'mortes-por-causa'],
  ['sem pesagem 30', T('m-sem-30', 'rebanho.sem-pesagem-recente', { params: { dias_sem_pesagem: 30 }, aggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'dias_medio', columnId: 'dias_sem_pesagem', op: 'avg' }, { id: 'dias_max', columnId: 'dias_sem_pesagem', op: 'max' }] }), 'rebanho.atual', 'sem-pesagem-recente'],
  // NEGATIVOS: com 60 dias o tipo (30) mudaria a população → Personalizado com o filtro > 60; colunas próprias
  // ou sem totais (escolha da pessoa) não são o tipo.
  ['sem pesagem 60', T('m-sem-60', 'rebanho.sem-pesagem-recente', { params: { dias_sem_pesagem: 60 }, aggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'dias_medio', columnId: 'dias_sem_pesagem', op: 'avg' }, { id: 'dias_max', columnId: 'dias_sem_pesagem', op: 'max' }] }), 'rebanho.atual', null],
  ['individual com colunas próprias', T('m-ind-cols', 'desempenho.individual', { columns: ['animal', 'gmd'], aggregates: PERF_13, period: P.periodo }), 'desempenho', null],
  ['marca sem totais', T('m-marca-0', 'rebanho.dimensao.marca', { groups: [{ columnId: 'marca' }], aggregates: [] }), 'rebanho.atual', null],
];
for (const [label, template, reportId, viewId] of modelos) {
  const definition = getReportDefinition(reportId);
  const { state } = buildInitialReportState(definition, { template, role: 'GESTOR' });
  assert.equal(state.view, viewId, `modelo 1.3.x "${label}": ${viewId ?? 'Personalizado'}`);
  const vm = await run(definition, selectionOf(state, definition), { actor: GESTOR, today: '2026-10-20' });
  assert.equal(vm.view?.id ?? null, viewId, `modelo 1.3.x "${label}": executa`);
}
const sessenta = buildInitialReportState(REBANHO, { template: modelos[4][1], role: 'GESTOR' }).state;
assert.equal(sessenta.uiFilters.dias_sem_pesagem.value, '60', 'modelo de 60 dias continua com o filtro dele (nem 30, nem sem filtro)');
ok('modelo-antigo');

// 5c. Último estado: E1B/E1C (sem `view`), E1D (`view: null` gravado quando o relatório não tinha tipos — versão 1)
//     e E1E (`view: null` = Personalizado escolhido, versão 2). Lido como a tela lê (getReportViewState).
const DESEMP_E1 = [
  { id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' }, { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' }, { id: 'ganho_medio', columnId: 'ganho', op: 'avg' }, { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
];
const REBANHO_E1 = [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'ultimo_peso_kg', op: 'avg' }, { id: 'peso_total', columnId: 'ultimo_peso_kg', op: 'sum' }];
const SAIDAS_E1 = [{ id: 'saidas', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }];
const estado = (reportId, extra) => ({
  columns: [], filters: {}, groups: [], aggregates: [], sort: [], mode: 'RESUMIDO', summarySort: null, period: null, params: {}, search: '', widths: {}, orientation: 'auto',
  baseReportId: reportId, baseReportVersion: 1, showEmptyColumns: false, updatedAt: '2026-09-25T10:00:00.000Z', ...extra,
});
const casos = [
  ['E1C saídas por motivo (sem view)', 'saidas', estado('saidas', { groups: [{ columnId: 'motivo_saida' }], aggregates: SAIDAS_E1, period: P.periodo }), 'por-motivo'],
  ['E1D desempenho por lote (view null, v1)', 'desempenho', estado('desempenho', { view: null, groups: [{ columnId: 'lote' }], aggregates: DESEMP_E1, period: P.periodo }), 'por-lote'],
  ['E1D rebanho por lote (view null, v1)', 'rebanho.atual', estado('rebanho.atual', { view: null, groups: [{ columnId: 'lote_atual' }], aggregates: REBANHO_E1 }), 'por-lote'],
  ['E1D fechamento (view null, v1)', 'controle.fechamento-dia', estado('controle.fechamento-dia', { view: null, mode: 'DETALHADO', groups: [{ columnId: 'sessao' }], columns: [...getReportDefinition('controle.fechamento-dia').defaultColumns], aggregates: plain(getReportDefinition('controle.fechamento-dia').defaultAggregates), period: P.periodo }), 'por-sessao'],
  ['E1E tipo gravado', 'rebanho.atual', estado('rebanho.atual', { view: 'por-raca', groups: [{ columnId: 'raca' }], aggregates: HERD_13, baseReportVersion: 2 }), 'por-raca'],
  // NEGATIVOS
  ['E1E Personalizado escolhido (view null, v2)', 'rebanho.atual', estado('rebanho.atual', { view: null, groups: [{ columnId: 'lote_atual' }], aggregates: REBANHO_E1, baseReportVersion: 2 }), null],
  ['E1D agrupamento sem tipo (Era)', 'rebanho.atual', estado('rebanho.atual', { view: null, groups: [{ columnId: 'era' }], aggregates: REBANHO_E1 }), null],
  ['E1D totais fora do tipo', 'rebanho.atual', estado('rebanho.atual', { view: null, groups: [{ columnId: 'lote_atual' }], aggregates: [...REBANHO_E1, { id: 'dias', columnId: 'dias_sem_pesagem', op: 'avg' }] }), null],
];
for (const [label, reportId, config, viewId] of casos) {
  await writeAppSetting(`report-view-state:local:${GESTOR.id}`, { version: 1, reports: { [reportId]: plain(config) } });
  const definition = getReportDefinition(reportId);
  const savedState = await getReportViewState(reportId, GESTOR);
  assert.ok(savedState, `${label}: último estado legível`);
  const { state } = buildInitialReportState(definition, { role: 'GESTOR', savedState });
  assert.equal(state.view, viewId, `${label}: ${viewId ?? 'Personalizado'}`);
  assert.deepEqual(plain(state.groups.map((group) => group.columnId)), config.groups.map((group) => group.columnId), `${label}: agrupamento do estado mantido`);
  const vm = await run(definition, selectionOf(state, definition), { actor: GESTOR });
  assert.equal(vm.view?.id ?? null, viewId, `${label}: executa`);
}
// Em memória: templateToRequest não inventa tipo para o estado da E1E (Personalizado escolhido).
assert.equal(templateToRequest(estado('saidas', { view: null, baseReportVersion: 2, groups: [{ columnId: 'motivo_saida' }], aggregates: SAIDAS_E1 }), 'GESTOR').selection.view, null, 'NEGATIVO: view null da versão 2 fica null');
assert.equal(templateToRequest(estado('saidas', { view: null, groups: [{ columnId: 'motivo_saida' }], aggregates: SAIDAS_E1 }), 'GESTOR').selection.view, undefined, 'view null da versão 1 = sem tipo (a tela reconhece pela estrutura)');
ok('ultimo-estado');

// 5d. População: o tipo só bate quando os filtros já trazem a população dele, e vence o genérico de mesma estrutura.
const MOV = getReportDefinition('movimentacao.lotes');
const porLoteMov = viewSelection('por-lote', MOV);
const mudancas = { mudanca: { operator: 'equals', value: 'sim' }, entrada_no_periodo: { operator: 'equals', value: 'sim', match: 'code' } };
assert.equal(matchView(MOV, { ...porLoteMov, filters: mudancas }), 'mudancas-lote', 'com a população nos filtros: Mudanças de Lote');
assert.equal(matchView(MOV, { ...porLoteMov, filters: {} }), 'por-lote', 'NEGATIVO: sem ela, Por Lote (o tipo de população não estreita o estado)');
assert.equal(matchView(MOV, { ...porLoteMov, filters: { mudanca: mudancas.mudanca } }), 'por-lote', 'NEGATIVO: população pela metade → o genérico');
const DES = getReportDefinition('desempenho');
const perdendo = viewSelection('perdendo-peso', DES);
assert.equal(matchView(DES, { ...perdendo, filters: { ganho: { operator: 'less', value: '0' } } }), 'perdendo-peso', 'Perdendo Peso com ganho < 0');
assert.equal(matchView(DES, { ...perdendo, filters: { ganho: { operator: 'less', value: '-10' } } }), null, 'NEGATIVO: ganho < -10 não é o tipo (Personalizado)');
const SAI = getReportDefinition('saidas');
assert.equal(matchView(SAI, { ...viewSelection('mortes-por-causa', SAI), filters: { motivo_saida: { operator: 'in', values: ['Morte'], match: 'label' } } }), 'mortes-por-causa', 'rótulo ou código do motivo: a mesma população');
assert.equal(matchView(SAI, { ...viewSelection('mortes-por-causa', SAI), filters: { motivo_saida: { operator: 'in', values: ['Morte', 'Abate'] } } }), null, 'NEGATIVO: Morte + Abate não é o tipo Mortes');
// Tipo resumido com "Colunas": parte dos totais do tipo é o tipo; total fora dele, não.
assert.equal(matchView(REBANHO, { groups: [{ columnId: 'marca' }], mode: R, aggregates: [HERD_13[0]], filters: {} }), 'por-marca', 'só Cabeças: Por Marca');
assert.equal(matchView(REBANHO, { groups: [{ columnId: 'marca' }], mode: R, aggregates: [], filters: {} }), null, 'NEGATIVO: sem totais → Personalizado');
ok('populacao');

// ---------------------------------------------------------------------------
// 6. Ida e volta: cada tipo gravado no último estado (como a tela grava) reabre nele
// ---------------------------------------------------------------------------
for (const definition of CATALOGO) {
  for (const view of listReportViews(definition)) {
    const selection = viewSelection(view, definition);
    const period = paramsOf(definition).periodo ?? null;
    await saveReportViewState(definition.id, { ...selection, period, params: {} }, ADMIN);
    const { state } = buildInitialReportState(definition, { role: 'ADMIN', savedState: await getReportViewState(definition.id, ADMIN) });
    assert.equal(state.view, view.id, `${definition.id}/${view.id}: reabre no tipo`);
    // Reconhecido pela estrutura (estado sem view) com a população nos filtros — o tipo não se confunde com outro.
    assert.equal(matchView(definition, { ...selection, filters: { ...selection.filters, ...(view.population ?? {}) } }), view.id, `${definition.id}/${view.id}: a estrutura dele é ele`);
  }
}
ok('ida-e-volta');

resumo.ok = true;
console.log(JSON.stringify(resumo, null, 2));
