// Gate reports:vendas-por-comprador:verify (E1D item 3) — tipo "Vendas (Detalhado)" do relatório Pesagens:
//   - população = "Vendas do período" (comercial.vendas): as MESMAS linhas, no mesmo período e filtros; cadastro,
//     manejo (mesmo com motivo "Venda"), abate, morte e venda fora do período ficam fora; filtro da pessoa só restringe;
//   - tela: "Resumido", "Agrupar por" e "Níveis" saem do tipo (Personalizado) levando a condição fixa, com cadeado
//     (tela, modelo e último estado) — nenhum controle amplia; escolher outro tipo a solta;
//   - agrupado por comprador (texto do lançamento), "Não informado" (comprador em branco) por último;
//   - subtotal por comprador e total geral conferidos à mão: animais distintos, peso total, peso médio, @ viva
//     (÷ 30 e ÷ 15, total e média) e valor total — total geral recalculado, nunca soma/média de subtotais;
//   - cabeçalhos do antigo "Qtd @", "Valor @", "Valor total" na grade, na folha, no CSV e no XLSX;
//   - decisão do valor total: sem valor digitado fica "—" e fora da soma (nada de peso ÷ 30 × valor @); os fatos
//     que a pergunta à responsável cita (≠ estimativa do "Resumo de Vendas" do Lançamento, 0 digitado, CSV sem
//     "(n de m)") ficam presos aqui;
//   - permissão comercial pela matriz real: ADMIN/GESTOR com valores; OPERADOR/CONSULTA sem colunas e sem totais
//     de valor (folha, CSV, XLSX, JSON, impressão), sem erro, com o aviso; modelo do ADMIN aberto por CONSULTA.
// Massa: a do fixture comum (A2 vendido à Frigo Sul) + as vendas deste gate, pela cadeia oficial (weighingService),
// no banco em memória deste processo (o fixture compartilhado não muda).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { getReportViewState, listTemplates, saveReportViewState, saveTemplate, templateToRequest } from '../src/modules/reporting/application/reportTemplateService.js';
import { can } from '../src/modules/auth/domain/permissionService.js';
import { calculateCarcassTrade } from '../src/modules/weighing/domain/commercialCalculations.js';
import { withoutHiddenColumns } from '../src/modules/reporting/domain/reportPermissions.js';
import { leaveViewPatch, screenFixedFilters, templatePayload, viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';
import { buildReportDocument, describeReportFilters, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { headerLabel, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { groupRows, NONE_GROUP_LABEL } from '../src/modules/reporting/domain/groupEngine.js';
import { getReportView, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { buildSheetRows, unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { VENDAS_COLUMNS, VENDAS_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';

const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const near = (actual, expected, message) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
const spaces = (text) => String(text ?? '').replace(/\s/g, ' ');
const br = (value, decimals) => roundTo(value, decimals).toFixed(decimals).replace('.', ',');
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const definition = getReportDefinition('pesagens');

// ---------------------------------------------------------------------------------------------------
// 1. O tipo (declaração)
// ---------------------------------------------------------------------------------------------------
const view = getReportView(definition, 'vendas');
assert.ok(view, 'tipo "vendas" declarado');
assert.equal(view.label, 'Vendas (Detalhado)');
assert.equal(view.mode, 'DETALHADO');
assert.equal(view.titleKind, 'Sintético', 'título da folha "(Sintético)" como no antigo (todo tipo que não é o Analítico)');
assert.deepEqual(view.groups.map((group) => group.columnId), ['comprador'], 'agrupado por comprador');
assert.deepEqual(JSON.parse(JSON.stringify(view.population)), {
  tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' },
  motivo_saida: { operator: 'in', values: ['Venda'], match: 'code' },
}, 'população fixa = Saída + motivo Venda, pelo código (como "Vendas do período")');
assert.deepEqual([...VENDAS_COLUMNS], ['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba', 'valor_arroba', 'valor_venda_total'], 'colunas padrão (item 3)');
assert.deepEqual([...view.columnChoices.defaults], [...VENDAS_COLUMNS]);
assert.ok(view.columnChoices.available.includes('destino_venda') && view.columnChoices.available.includes('observacao'), 'opcionais do antigo no seletor');
assert.deepEqual({ ...view.columnLabels }, { peso_arroba: 'Qtd @', valor_arroba: 'Valor @', valor_venda_total: 'Valor total' }, 'cabeçalhos do antigo');
assert.deepEqual(VENDAS_TOTALS.map((spec) => spec.id), ['animais_vendidos', 'peso_total', 'peso_medio', 'total_arroba', 'media_arroba', 'valor_total']);
assert.deepEqual(VENDAS_TOTALS.map((spec) => `${spec.op}:${spec.columnId}`), ['countDistinct:numero_animal', 'sum:peso', 'avg:peso', 'sum:peso_arroba', 'avg:peso_arroba', 'sum:valor_venda_total'], '@ = @ VIVA (peso_arroba), nunca a @ de carcaça (quantidade_arrobas)');
// Todo total de Vendas tem rótulo de curral pelo id: grade (metricLabels), folha, CSV e XLSX dizem o mesmo.
const TOTAL_LABELS = ['Animais', 'Peso total (kg)', 'Peso médio (kg)', 'Total (@)', 'Média (@)', 'Valor total'];
assert.deepEqual(VENDAS_TOTALS.map((spec) => definition.metricLabels[spec.id]), TOTAL_LABELS, 'rótulo de curral de cada total');

// ---------------------------------------------------------------------------------------------------
// 2. Massa: vendas conferíveis à mão (além de A2 → Frigo Sul, 280 kg, R$ 3.000, do fixture comum)
// ---------------------------------------------------------------------------------------------------
await seedReportFixture();
const base = { empresa_id: 'local', status_animal: 'Ativo' };
const L1 = { lote_id: 'L1', nome_lote: 'Lote 01', apartacao_id: 'ap1', nome_apartacao: 'Engorda' };
const L2 = { lote_id: 'L2', nome_lote: 'Lote 02', apartacao_id: 'ap1', nome_apartacao: 'Engorda' };
const bicho = (animalId, numero, extra = {}) => ({ ...base, animal_id: animalId, numero_animal: numero, sexo: 'M', ...extra });
const cadastro = (animal, id, data, peso) => ({ ...animal, id, tipo_manejo: 'Cadastro', data_pesagem: data, peso });
const saida = (animal, id, motivo, data, peso, extra = {}) => ({ ...animal, id, tipo_manejo: 'Saída', motivo_saida: motivo, data_pesagem: data, peso, ...extra });
const a5 = bicho('A5', '505', { marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore', ...L1 });
const a6 = bicho('A6', '606', { sexo: 'F', marca: 'BETA', marca_id: 'm-beta', raca: 'Angus', raca_id: 'r-angus', ...L2 });
const a7 = bicho('A7', '707', { ...L1 });
const a8 = bicho('A8', '808', { sexo: 'F', ...L2 });
const a9 = bicho('A9', '909', { ...L1 });
const a10 = bicho('A10', '1010', { ...L1 });
const a11 = bicho('A11', '1111', { ...L1 });
const a12 = bicho('A12', '1212');
const massa = [
  cadastro(a5, 'v5c', '2026-08-02', 400),
  // @ de carcaça gravada (52% → 234 kg ÷ 15 = 15,6 @) ≠ @ viva (450 ÷ 30 = 15): "Qtd @" é a viva.
  saida(a5, 'v5', 'Venda', '2026-09-06', 450, { comprador: 'Agropecuária Boa Vista', valor_venda_total: 6750, valor_arroba: 300, rendimento_carcaca: 52, rendimento_origem: 'INFORMADO', peso_carcaca_estimado: 234, quantidade_arrobas: 15.6 }),
  cadastro(a6, 'v6c', '2026-08-03', 300),
  // Sem valor total digitado (só o preço da @): "—", fora da soma.
  saida(a6, 'v6', 'Venda', '2026-09-07', 330, { comprador: 'Agropecuária Boa Vista', valor_arroba: 290 }),
  cadastro(a7, 'v7c', '2026-08-04', 420),
  // Comprador em branco (só espaços): grupo "Não informado".
  saida(a7, 'v7', 'Venda', '2026-09-08', 480, { comprador: '   ', valor_venda_total: 7200, valor_arroba: 300 }),
  cadastro(a8, 'v8c', '2026-08-06', 300),
  saida(a8, 'v8', 'Venda', '2026-09-09', 390, { comprador: 'Frigo Sul', valor_venda_total: 5850, valor_arroba: 300 }),
  cadastro(a12, 'v12c', '2026-08-08', 380),
  saida(a12, 'v12', 'Venda', '2026-09-11', 420, { comprador: 'Zeca Gado', valor_venda_total: 6300 }),
  // NEGATIVOS: abate com "comprador", manejo com motivo "Venda" (o lançamento aceita) e venda fora do período.
  cadastro(a9, 'v9c', '2026-08-07', 350),
  saida(a9, 'v9', 'Abate', '2026-09-10', 500, { comprador: 'Frigo Sul', frigorifico: 'Frigo Sul', valor_total_abate: 9000 }),
  cadastro(a11, 'v11c', '2026-08-07', 350),
  { ...a11, id: 'v11m', tipo_manejo: 'Manejo', motivo_saida: 'Venda', comprador: 'Frigo Sul', data_pesagem: '2026-09-01', peso: 370 },
  cadastro(a10, 'v10c', '2026-07-20', 350),
  saida(a10, 'v10', 'Venda', '2026-07-25', 380, { comprador: 'Frigo Sul', valor_venda_total: 5000, valor_arroba: 300 }),
];
for (const entry of massa) await weighingService.createEntry(entry);

// Conta à mão (independente do motor): venda = [id, comprador, peso, valor total digitado | null].
const VENDAS = [
  ['e6', 'Frigo Sul', 280, 3000],
  ['v5', 'Agropecuária Boa Vista', 450, 6750],
  ['v6', 'Agropecuária Boa Vista', 330, null],
  ['v7', NONE_GROUP_LABEL, 480, 7200],
  ['v8', 'Frigo Sul', 390, 5850],
  ['v12', 'Zeca Gado', 420, 6300],
];
const ORDEM = ['Agropecuária Boa Vista', 'Frigo Sul', 'Zeca Gado', NONE_GROUP_LABEL];
const naMao = (vendas, divisor) => {
  const pesos = vendas.map((venda) => venda[2]);
  const valores = vendas.map((venda) => venda[3]).filter((valor) => valor !== null);
  const pesoTotal = pesos.reduce((soma, peso) => soma + peso, 0);
  return {
    ids: vendas.map((venda) => venda[0]).sort(),
    animais_vendidos: vendas.length, // uma venda por animal (o lançamento recusa a segunda)
    peso_total: pesoTotal,
    peso_medio: pesoTotal / pesos.length,
    total_arroba: pesoTotal / divisor,
    media_arroba: pesoTotal / divisor / pesos.length,
    valor_total: valores.reduce((soma, valor) => soma + valor, 0),
    valorN: [valores.length, vendas.length],
  };
};
const esperado = (divisor) => ({
  grupos: ORDEM.map((comprador) => ({ comprador, ...naMao(VENDAS.filter((venda) => venda[1] === comprador), divisor) })),
  geral: naMao(VENDAS, divisor),
});

// ---------------------------------------------------------------------------------------------------
// 3. População = "Vendas do período"; filtro da pessoa só restringe
// ---------------------------------------------------------------------------------------------------
const vendas = (actor, selection = {}, request = {}) => runReport('pesagens', { today: TODAY, params: period, ...request, selection: { view: 'vendas', ...selection } }, actor);
const idsOf = (vm) => vm.rows.map((row) => row.id).sort();
const vm = await vendas(ADMIN);
const comercial = await runReport('comercial.vendas', { today: TODAY, params: period }, ADMIN);
assert.deepEqual(idsOf(vm), esperado(30).geral.ids, 'população = as 6 vendas do período, conferidas à mão');
assert.deepEqual(idsOf(vm), idsOf(comercial), 'MESMAS linhas (mesmos ids) de "Vendas do período"');
for (const fora of ['v9', 'v11m', 'v10', 'e8', 'e1', 'e5', 'v5c']) assert.ok(!idsOf(vm).includes(fora), `NEGATIVO: ${fora} fora de Vendas (abate, manejo com motivo Venda, fora do período, morte, cadastro/manejo)`);
const pesadoPessoa = { peso: { operator: 'greater', value: '400' } };
const vmPesado = await vendas(ADMIN, { filters: pesadoPessoa });
const comercialPesado = await runReport('comercial.vendas', { today: TODAY, params: period, selection: { filters: pesadoPessoa } }, ADMIN);
assert.deepEqual(idsOf(vmPesado), ['v12', 'v5', 'v7'], 'filtro da pessoa (peso > 400) restringe');
assert.deepEqual(idsOf(vmPesado), idsOf(comercialPesado), 'mesmas linhas com o mesmo filtro');
// Serviço: sem tipo e sem condição fixa, as outras pesagens voltam (a condição é do tipo). A TELA nunca manda
// isso ao sair de Vendas por um controle genérico: leva a condição junto (seção 4b).
const semTipo = await runReport('pesagens', { today: TODAY, params: period, selection: { view: null } }, ADMIN);
assert.ok(semTipo.rowCount > vm.rowCount && semTipo.rows.some((row) => row.id === 'v11m'), 'serviço sem tipo e sem condição: as outras pesagens voltam');
// A condição aparece como fixa (cadeado) na tela, na folha e nas exportações.
assert.deepEqual(Object.keys(vm.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], 'condição fixa do tipo');
assert.ok(Object.values(vm.lockedFilters).every((filter) => filter.match === 'code'), 'fixa pelo código');
assert.match(describeReportFilters(vm), /Tipo em Saída \(fixo\)/);
assert.match(describeReportFilters(vm), /Motivo da saída em Venda \(fixo\)/);
// Nenhum controle amplia: filtro em outro motivo/tipo só esvazia; condição fixa de modelo na mesma coluna perde para a do tipo.
assert.equal((await vendas(ADMIN, { filters: { motivo_saida: { operator: 'in', values: ['Abate'], match: 'label' } } })).rowCount, 0, 'NEGATIVO: filtro "Abate" não traz abates — só esvazia');
assert.equal((await vendas(ADMIN, { filters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Manejo', 'Saída'], match: 'label' } } })).rowCount, vm.rowCount, 'NEGATIVO: filtro com mais tipos não amplia');
const fixoAlheio = await vendas(ADMIN, { fixedFilters: { motivo_saida: { operator: 'in', values: ['Abate', 'Morte', 'Venda'] } } });
assert.deepEqual(idsOf(fixoAlheio), idsOf(vm), 'NEGATIVO: condição fixa de modelo na mesma coluna não amplia');
assert.deepEqual(fixoAlheio.lockedFilters.motivo_saida.values, ['Venda']);
assert.deepEqual(idsOf(await vendas(ADMIN, { search: 'Lote 02' })), ['e6', 'v6', 'v8'], 'pesquisa só restringe');
assert.equal((await vendas(ADMIN, { mode: 'RESUMIDO' })).mode, 'DETALHADO', 'o modo é o do tipo');
assert.match(await code(() => vendas(ADMIN, { groups: [{ columnId: 'marca' }] })), /agrupa por comprador/, 'NEGATIVO: outro agrupamento não é o tipo Vendas (a tela passa a Personalizado levando a condição — 4b)');

// ---------------------------------------------------------------------------------------------------
// 4. Por comprador, "Não informado" por último; subtotais e total geral à mão (÷ 30 e ÷ 15)
// ---------------------------------------------------------------------------------------------------
assert.equal(vm.mode, 'DETALHADO');
assert.deepEqual({ id: vm.view.id, titleKind: vm.view.titleKind }, { id: 'vendas', titleKind: 'Sintético' }, 'view model leva o tipo (o título da folha lê titleKind)');
assert.deepEqual(vm.groups.map((group) => group.columnId), ['comprador']);
assert.deepEqual(vm.tree.map((node) => node.label), ORDEM, 'compradores em ordem alfabética, "Não informado" por último');
assert.equal(vm.tree.at(-1).missing, true, 'comprador em branco = grupo ausente');
const confere = (viewModel, divisor) => {
  const conta = esperado(divisor);
  viewModel.tree.forEach((node, index) => {
    const grupo = conta.grupos[index];
    assert.deepEqual(node.rows.map((row) => row.id).sort(), grupo.ids, `${grupo.comprador}: linhas do grupo`);
    for (const id of ['animais_vendidos', 'peso_total', 'peso_medio', 'total_arroba', 'media_arroba', 'valor_total']) near(node.aggregates[id].value, grupo[id], `${grupo.comprador} ÷${divisor} · ${id}`);
    assert.deepEqual([node.aggregates.valor_total.n_validos, node.aggregates.valor_total.n_total], grupo.valorN, `${grupo.comprador}: valor digitado em n de m`);
  });
  for (const id of ['animais_vendidos', 'peso_total', 'peso_medio', 'total_arroba', 'media_arroba', 'valor_total']) near(viewModel.totals[id].value, conta.geral[id], `total geral ÷${divisor} · ${id}`);
  assert.equal(viewModel.arrobaDivisor, divisor);
};
confere(vm, 30);
const vm15 = await vendas(ADMIN, {}, { arrobaDivisor: 15 });
confere(vm15, 15);
// Total geral recalculado sobre a população (nunca média de subtotais).
const mediaDasMedias = vm.tree.reduce((soma, node) => soma + node.aggregates.peso_medio.value, 0) / vm.tree.length;
assert.ok(Math.abs(mediaDasMedias - vm.totals.peso_medio.value) > 1, 'NEGATIVO: peso médio geral ≠ média dos pesos médios dos compradores');
// Qtd @ = @ de PESO VIVO (peso ÷ divisor), não a @ de carcaça gravada no lançamento.
const linhaV5 = vm.rows.find((row) => row.id === 'v5');
near(vm.resolve('peso_arroba').valueOf(linhaV5), 15, 'v5: Qtd @ = 450 ÷ 30');
near(vm15.resolve('peso_arroba').valueOf(vm15.rows.find((row) => row.id === 'v5')), 30, 'v5: Qtd @ = 450 ÷ 15');
near(vm.resolve('quantidade_arrobas').valueOf(linhaV5), 15.6, 'v5: @ de carcaça gravada (outra coisa)');
// Decisão do item 4: sem valor digitado → "—" e fora da soma (o antigo somava 330 ÷ 30 × 290 = 3.190).
const linhaV6 = vm.rows.find((row) => row.id === 'v6');
assert.ok(vm.resolve('valor_venda_total').valueOf(linhaV6) == null, 'v6: valor total não digitado continua ausente (nunca 0)');
assert.equal(vm.tree[0].aggregates.valor_total.value, 6750, 'Agropecuária: R$ 6.750 (só o digitado)');
assert.notEqual(vm.tree[0].aggregates.valor_total.value, 6750 + (330 / 30) * 290, 'NEGATIVO: nada de peso ÷ 30 × valor @ inventado');
assert.notEqual(vm.totals.valor_total.value, 29100 + (330 / 30) * 290, 'NEGATIVO: total geral sem a conta do antigo');

// Motor (sem banco): animais DISTINTOS (dado legado com duas vendas do mesmo animal) e venda legada sem peso.
{
  const resolve = createColumnResolver(definition.columns);
  const linha = (id, animal, comprador, peso, valor) => ({ id, animal_id: animal, numero_animal: animal, comprador, peso, arroba_divisor: 30, valor_venda_total: valor, tipo_manejo: 'Saída', motivo_saida: 'Venda' });
  const tree = groupRows([linha('x1', 'B1', 'Frigo Sul', 300, 4500), linha('x2', 'B1', 'Frigo Sul', 330, 4950), linha('x3', 'B2', 'Frigo Sul', null, 1000)], [{ columnId: 'comprador' }], resolve, { aggregates: VENDAS_TOTALS });
  const agregados = tree.nodes[0].aggregates;
  assert.equal(agregados.animais_vendidos.value, 2, 'animais distintos (o antigo contava 3 linhas)');
  near(agregados.peso_total.value, 630, 'peso total só com peso');
  near(agregados.peso_medio.value, 315, 'peso médio sem o ausente (nunca 0)');
  near(agregados.total_arroba.value, 21, '@ viva sem o ausente');
  assert.deepEqual([agregados.total_arroba.n_validos, agregados.total_arroba.n_total], [2, 3]);
  near(agregados.valor_total.value, 10450, 'valor total = soma do digitado');
  // Fatos da decisão do item 4 (pesagens.js; pergunta à responsável no REPORT da E1D):
  // sem valor digitado, o "Resumo de Vendas" do Lançamento soma a estimativa pela @ de carcaça; o relatório não.
  const estimativa = calculateCarcassTrade({ weight: 450, yieldPercent: 52, pricePerArroba: 300 }).estimatedValue;
  near(estimativa, 4680, 'Resumo de Vendas do Lançamento: 450 × 52% = 234 kg ÷ 15 = 15,6 @ × R$ 300');
  const vendaSemValor = { ...linha('y1', 'C1', 'Frigo Sul', 450, null), valor_arroba: 300, rendimento_carcaca: 52 };
  const semValorDigitado = groupRows([vendaSemValor], [{ columnId: 'comprador' }], resolve, { aggregates: VENDAS_TOTALS }).nodes[0].aggregates.valor_total;
  assert.ok(semValorDigitado.value !== estimativa && !semValorDigitado.n_validos, 'relatório: sem valor digitado fica fora (≠ Resumo de Vendas do dia — divergência registrada)');
  // 0 digitado: o Lançamento grava 0 e o relatório conta R$ 0,00 digitado (o Resumo trata 0 como não informado).
  const zero = groupRows([linha('y2', 'C2', 'Frigo Sul', 450, 0)], [{ columnId: 'comprador' }], resolve, { aggregates: VENDAS_TOTALS }).nodes[0].aggregates.valor_total;
  assert.deepEqual([zero.value, zero.n_validos, zero.n_total], [0, 1, 1], '0 digitado = R$ 0,00 digitado (divergência registrada)');
}

// ---------------------------------------------------------------------------------------------------
// 4b. Tela: "Resumido", "Agrupar por" e "Níveis" tiram do tipo (Personalizado, contrato §3), mas a população de
//     Vendas continua fixa, com cadeado — nenhum controle a amplia. leaveViewPatch/screenFixedFilters são o MESMO
//     código da ReportView; rodaTela manda ao serviço o que o execute da tela manda.
// ---------------------------------------------------------------------------------------------------
const tipo = viewSelection('vendas', definition);
const telaVendas = (extra = {}) => ({
  view: 'vendas', matrix: null, sortChoice: definition.defaultSortChoice ?? null, params: { ...period }, uiFilters: {}, fixedFilters: {},
  columns: [...tipo.columns], groups: tipo.groups, aggregates: tipo.aggregates, sort: tipo.sort, search: '', widths: {}, mode: tipo.mode,
  summarySort: null, drill: [], orientation: 'auto', showEmptyColumns: false, ...extra,
});
const rodaTela = (estado, actor = ADMIN) => runReport('pesagens', {
  today: TODAY, params: estado.params,
  selection: {
    columns: estado.columns, filters: estado.uiFilters, fixedFilters: screenFixedFilters(estado), groups: estado.groups, aggregates: estado.aggregates,
    sort: estado.sort, search: estado.search, mode: estado.mode, summarySort: estado.summarySort, drill: estado.drill,
    view: estado.view, matrix: estado.matrix, sortChoice: estado.sortChoice,
  },
}, actor);
const travado = (viewModel, where) => {
  assert.deepEqual(Object.keys(viewModel.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], `${where}: condição fixa (cadeado) continua`);
  assert.ok(Object.values(viewModel.lockedFilters).every((filter) => filter.match === 'code'), `${where}: pelo código`);
};
// Mesmo estado de tela, tela antiga (view null sem levar a condição): 9 linhas de cadastros/manejos/saídas.
const antes = await rodaTela({ ...telaVendas(), mode: 'RESUMIDO', view: null });
assert.ok(antes.rowCount > vm.rowCount && antes.rows.some((row) => row.tipo_manejo === 'Cadastro'), 'NEGATIVO (o defeito): sair do tipo sem a condição soma cadastros debaixo dos totais de Vendas');
// "Resumido" (setMode): Personalizado, mas as MESMAS vendas — os "TOTAIS POR COMPRADOR" do antigo.
const vendasTela = telaVendas();
const resumido = { ...vendasTela, mode: 'RESUMIDO', drill: [], ...leaveViewPatch(definition, vendasTela) };
assert.equal(resumido.view, null, 'Resumido sai do tipo (Personalizado)');
assert.deepEqual(resumido.typePopulation, JSON.parse(JSON.stringify({ tipo_manejo: { operator: 'in', value: '', valueTo: '', values: ['Saída'], match: 'code' }, motivo_saida: { operator: 'in', value: '', valueTo: '', values: ['Venda'], match: 'code' } })), 'a população do tipo vai junto');
const vmResumido = await rodaTela(resumido);
assert.deepEqual([vmResumido.view, vmResumido.mode], [null, 'RESUMIDO']);
assert.deepEqual(idsOf(vmResumido), idsOf(vm), 'Resumido: as MESMAS vendas (nenhum cadastro/manejo)');
travado(vmResumido, 'Resumido');
assert.deepEqual(vmResumido.tree.map((node) => node.label), ORDEM, 'Resumido: por comprador, "Não informado" por último');
confere(vmResumido, 30);
// "Agrupar por Marca" (setGroups) — direto de Vendas e depois do Resumido (já fora do tipo): a condição continua.
const porMarca = { ...vendasTela, groups: [{ columnId: 'marca' }], drill: [], ...leaveViewPatch(definition, vendasTela) };
const resumidoMarca = { ...resumido, groups: [{ columnId: 'marca' }], drill: [], ...leaveViewPatch(definition, resumido) };
assert.deepEqual(resumidoMarca.typePopulation, resumido.typePopulation, 'fora do tipo, a condição herdada continua');
for (const [estado, where] of [[porMarca, 'Agrupar por Marca'], [resumidoMarca, 'Resumido › Agrupar por Marca']]) {
  const visto = await rodaTela(estado);
  assert.deepEqual(idsOf(visto), idsOf(vm), `${where}: as MESMAS vendas`);
  travado(visto, where);
  near(visto.totals.peso_total.value, 2350, `${where}: peso total só das vendas`);
  assert.equal(visto.totals.valor_total.value, 29100, `${where}: valor total só das vendas`);
}
// Níveis (diálogo, 2 níveis) também passa por setGroups.
const niveis = { ...vendasTela, groups: [{ columnId: 'comprador' }, { columnId: 'nome_lote' }], drill: [], ...leaveViewPatch(definition, vendasTela) };
assert.deepEqual(idsOf(await rodaTela(niveis)), idsOf(vm), 'Níveis: as MESMAS vendas');
// Filtro/pesquisa da pessoa, já no Personalizado, só restringem.
assert.equal((await rodaTela({ ...resumido, uiFilters: { motivo_saida: { operator: 'in', values: ['Abate'], match: 'label' } } })).rowCount, 0, 'NEGATIVO: filtro "Abate" não traz abates — só esvazia');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, uiFilters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Manejo', 'Saída'], match: 'label' } } })), idsOf(vm), 'NEGATIVO: filtro com mais tipos não amplia');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, uiFilters: pesadoPessoa })), ['v12', 'v5', 'v7'], 'filtro da pessoa restringe');
// Detalhe de um grupo do Resumido (clique na folha): só as vendas daquele comprador.
const frigo = vmResumido.tree.find((node) => node.label === 'Frigo Sul');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, mode: 'DETALHADO', drill: [{ columnId: 'comprador', key: frigo.key }] })), ['e6', 'v8'], 'detalhe: só as vendas da Frigo Sul');
// Escolher um tipo solta a condição herdada (com tipo, vale só a população dele); sair desse tipo não a ressuscita.
const analitico = { ...resumido, ...viewSelection('analitico', definition) };
assert.deepEqual(screenFixedFilters(analitico), {}, 'Analítico: sem a condição de Vendas');
const vmAnalitico = await rodaTela(analitico);
assert.ok(vmAnalitico.rowCount > vm.rowCount && !Object.keys(vmAnalitico.lockedFilters).length, 'Analítico: todas as pesagens do período, sem cadeado');
assert.equal(leaveViewPatch(definition, analitico).typePopulation, null, 'sair do Analítico não traz de volta a condição de Vendas');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, ...viewSelection('vendas', definition) })), idsOf(vm), 'voltar a Vendas: a população do próprio tipo');
// Condição fixa de modelo convertido continua junto da herdada (na mesma coluna, a do tipo prevalece).
assert.deepEqual(Object.keys(screenFixedFilters({ ...resumido, fixedFilters: { sexo: { operator: 'in', values: ['M'] }, motivo_saida: { operator: 'in', values: ['Abate', 'Venda'] } } })).sort(), ['motivo_saida', 'sexo', 'tipo_manejo']);
assert.deepEqual(screenFixedFilters({ ...resumido, fixedFilters: { motivo_saida: { operator: 'in', values: ['Abate', 'Venda'] } } }).motivo_saida.values, ['Venda'], 'NEGATIVO: condição de modelo na mesma coluna não amplia');
// Modelo salvo no Personalizado que saiu de Vendas: reabre com o mesmo cadeado.
const modeloResumido = await saveTemplate({ name: 'Totais por comprador', ...templatePayload(definition, resumido, 'ADMIN') }, ADMIN);
assert.deepEqual(Object.keys(modeloResumido.fixedFilters ?? {}).sort(), ['motivo_saida', 'tipo_manejo'], 'modelo: a condição vai como fixa');
const pedidoResumido = templateToRequest(modeloResumido, 'ADMIN');
const vmModeloResumido = await runReport('pesagens', { today: TODAY, params: pedidoResumido.params, selection: pedidoResumido.selection }, ADMIN);
assert.deepEqual(idsOf(vmModeloResumido), idsOf(vm), 'modelo reaberto: as MESMAS vendas');
travado(vmModeloResumido, 'modelo reaberto');
// Último estado (nunca guarda condição fixa — regra do serviço): a herdada vai como filtro comum pelo código.
const ultimoResumido = viewStatePayload(definition, resumido, 'ADMIN');
assert.deepEqual(Object.keys(ultimoResumido.filters).sort(), ['motivo_saida', 'tipo_manejo'], 'último estado: a condição vai como filtro');
assert.ok(Object.values(ultimoResumido.filters).every((filter) => filter.match === 'code'));
assert.deepEqual(viewStatePayload(definition, analitico, 'ADMIN').filters, {}, 'último estado com tipo: sem a condição herdada');
await saveReportViewState('pesagens', ultimoResumido, ADMIN);
const reabertoResumido = await getReportViewState('pesagens', ADMIN);
assert.deepEqual([reabertoResumido.selection.view, reabertoResumido.selection.fixedFilters], [null, undefined]);
assert.deepEqual(idsOf(await runReport('pesagens', { today: TODAY, params: reabertoResumido.params, selection: reabertoResumido.selection }, ADMIN)), idsOf(vm), 'último estado reaberto: as MESMAS vendas (não amplia em silêncio)');

// ---------------------------------------------------------------------------------------------------
// 5. Cabeçalhos do antigo e rótulos dos totais: grade, folha, CSV, XLSX (e JSON/manifesto)
// ---------------------------------------------------------------------------------------------------
const HEADERS = ['Comprador', 'Data', 'Animal', 'Peso (kg)', 'Qtd @', 'Valor @', 'Valor total'];
assert.deepEqual(vm.columns.map((column) => column.id), [...VENDAS_COLUMNS]);
assert.deepEqual(vm.columns.map(headerLabel), HEADERS, 'grade: cabeçalhos do antigo ("Qtd @" sem "(@)" repetido)');
assert.equal(vm.availableColumns.find((column) => column.id === 'peso_arroba').label, 'Qtd @', 'seletor "Colunas"/filtros com o mesmo nome');
assert.equal(headerLabel({ label: 'Peso', unit: 'kg' }), 'Peso (kg)', 'demais cabeçalhos continuam com a unidade');
const semTipoArroba = await runReport('pesagens', { today: TODAY, params: period, selection: { view: null, columns: ['numero_animal', 'peso_arroba'] } }, ADMIN);
assert.equal(headerLabel(semTipoArroba.columns[1]), 'Peso em arrobas (@)', 'NEGATIVO: fora do tipo Vendas a coluna mantém o nome dela');

const csvText = (await prepareEmission(vm, 'csv', ADMIN)).content;
const csv = parseCsv(csvText);
assert.deepEqual(csv[0], ['tipo_linha', 'nivel', 'grupo', 'metrica', 'valor', ...HEADERS], 'CSV: cabeçalho');
assert.deepEqual(csv.filter((row) => row[0] === 'GROUP').map((row) => row[2]), ORDEM.map((comprador) => `Comprador: ${comprador}`), 'CSV: grupos na ordem');
assert.equal(csv.filter((row) => row[0] === 'DATA').length, 6);
const csvV6 = csv.find((row) => row[0] === 'DATA' && row[7] === '606');
assert.deepEqual(csvV6.slice(5), ['Agropecuária Boa Vista', '07/09/2026', '606', '330,00', '11,00', '290,00', ''], 'CSV: v6 com Qtd @ viva e Valor total vazio');
const formatados = (conta) => [String(conta.animais_vendidos), br(conta.peso_total, 1), br(conta.peso_medio, 1), br(conta.total_arroba, 2), br(conta.media_arroba, 2), br(conta.valor_total, 2)];
esperado(30).grupos.forEach((grupo) => {
  const linhas = csv.filter((row) => row[0] === 'SUBTOTAL' && row[2] === grupo.comprador);
  assert.deepEqual(linhas.map((row) => row[3]), TOTAL_LABELS, `CSV: rótulos do subtotal ${grupo.comprador}`);
  assert.deepEqual(linhas.map((row) => row[4]), formatados(grupo), `CSV: subtotal ${grupo.comprador} à mão`);
});
const csvGeral = csv.filter((row) => row[0] === 'GRAND_TOTAL');
assert.deepEqual(csvGeral.map((row) => row[3]), TOTAL_LABELS, 'CSV: rótulos do total geral');
assert.deepEqual(csvGeral.map((row) => row[4]), ['6', '2350,0', '391,7', '78,33', '13,06', '29100,00'], 'CSV: total geral à mão');
// O "(5 de 6)" da folha não sai no CSV/XLSX: só a soma do digitado (registrado na pergunta à responsável).
assert.ok(csv.every((row) => !/ de \d/.test(row[4] ?? '')), 'CSV: valor sem "(n de m)"');

const xlsx = await prepareEmission(vm, 'xlsx', ADMIN);
const sheetXml = unzipStored(xlsx.content)['xl/worksheets/sheet1.xml'];
for (const header of ['Qtd @', 'Valor @', 'Valor total']) assert.ok(sheetXml.includes(`>${header}<`), `XLSX: cabeçalho "${header}"`);
const { rows: sheetRows } = buildSheetRows(vm);
const header = sheetRows.find((row) => row.kind === 'HEADER').cells.map((cell) => cell[0]);
assert.deepEqual(header.slice(4), HEADERS, 'XLSX: colunas');
assert.deepEqual(sheetRows.filter((row) => row.kind === 'GROUP').map((row) => row.cells[1][0]), ORDEM.map((comprador) => `Comprador: ${comprador}`), 'XLSX: grupos na ordem');
const decimals = [0, 1, 1, 2, 2, 2];
const numeros = (conta) => [conta.animais_vendidos, conta.peso_total, conta.peso_medio, conta.total_arroba, conta.media_arroba, conta.valor_total].map((value, index) => roundTo(value, decimals[index]));
esperado(30).grupos.forEach((grupo) => {
  const linhas = sheetRows.filter((row) => row.kind === 'SUBTOTAL' && row.cells[1][0] === grupo.comprador);
  assert.deepEqual(linhas.map((row) => row.cells[2][0]), TOTAL_LABELS, `XLSX: rótulos do subtotal ${grupo.comprador}`);
  assert.deepEqual(linhas.map((row) => row.cells[3][0]), numeros(grupo), `XLSX: subtotal ${grupo.comprador} em número`);
});
const xlsxGeral = sheetRows.filter((row) => row.kind === 'GRAND_TOTAL');
assert.deepEqual(xlsxGeral.map((row) => row.cells[2][0]), TOTAL_LABELS);
assert.deepEqual(xlsxGeral.map((row) => row.cells[3][0]), [6, 2350, 391.7, 78.33, 13.06, 29100], 'XLSX: total geral em número');
const xlsxV6 = sheetRows.find((row) => row.kind === 'DATA' && row.cells[6][0] === '606');
assert.equal(xlsxV6.cells[10][0], null, 'XLSX: v6 sem valor total (célula vazia, não 0)');

const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
assert.deepEqual(json.columns.map((column) => column.label), ['Comprador', 'Data', 'Animal', 'Peso', 'Qtd @', 'Valor @', 'Valor total'], 'JSON: rótulos do tipo');
assert.deepEqual(json.manifest.columns.map((column) => column.label), json.columns.map((column) => column.label), 'manifesto com os mesmos rótulos');
assert.equal(json.totals.valor_total.value, 29100);
assert.deepEqual(Object.keys(json.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], 'JSON: condição fixa do tipo');

// Folha (Detalhado como folha): seção por comprador com as linhas e o subtotal; total geral.
const doc = buildReportDocument(vm);
assert.equal(doc.layout, 'detail');
assert.deepEqual(doc.columns.map((column) => column.label), HEADERS, 'folha: cabeçalhos');
assert.deepEqual(doc.sections.map((section) => section.title), ORDEM.map((comprador) => `COMPRADOR: ${comprador.toLocaleUpperCase('pt-BR')}`), 'folha: uma seção por comprador, "Não informado" por último');
const valorCol = doc.columns.findIndex((column) => column.key === 'valor_venda_total');
const numberOf = (text) => Number(spaces(text).replace(/ \(\d+ de \d+\)$/, '').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
doc.sections.forEach((section, index) => {
  const grupo = esperado(30).grupos[index];
  const dados = section.table.rows.filter((row) => row.type === 'DATA');
  assert.equal(dados.length, grupo.ids.length, `folha ${grupo.comprador}: linhas`);
  const chips = section.table.rows.find((row) => row.type === 'SUBTOTAL').chips;
  assert.equal(chips.title, `Subtotal ${grupo.comprador}`);
  assert.deepEqual(chips.items.map((item) => item.label), TOTAL_LABELS, `folha ${grupo.comprador}: rótulos do subtotal`);
  // Folha × XLSX: o mesmo número em cada total (a folha arredonda para exibir; o XLSX guarda o número).
  const planilha = sheetRows.filter((row) => row.kind === 'SUBTOTAL' && row.cells[1][0] === grupo.comprador).map((row) => row.cells[3][0]);
  assert.deepEqual(chips.items.map((item) => numberOf(item.text)), planilha, `folha × XLSX ${grupo.comprador}`);
});
const chipsAgro = doc.sections[0].table.rows.find((row) => row.type === 'SUBTOTAL').chips.items;
assert.equal(spaces(chipsAgro.at(-1).text), 'R$ 6.750,00 (1 de 2)', 'folha: valor do comprador diz quantos tinham valor digitado');
const dadosAgro = doc.sections[0].table.rows.filter((row) => row.type === 'DATA');
assert.ok(dadosAgro.some((row) => row.cells[valorCol].text === '—'), 'folha: v6 com "—" no Valor total');
const chipsGeral = doc.grandTotal.rows[0].chips;
assert.equal(chipsGeral.title, 'Total geral');
assert.deepEqual(chipsGeral.items.map((item) => spaces(item.text)), ['6', '2.350,0', '391,7', '78,33', '13,06', 'R$ 29.100,00 (5 de 6)'], 'folha: total geral à mão');
assert.deepEqual(chipsGeral.items.map((item) => numberOf(item.text)), xlsxGeral.map((row) => row.cells[3][0]), 'folha × XLSX: total geral');
assert.ok(JSON.stringify(doc.footer).includes('@ = peso vivo ÷ 30'), 'folha: rodapé explica a @ viva');
assert.ok(JSON.stringify(buildReportDocument(vm15).footer).includes('@ = peso vivo ÷ 15'), 'folha: divisor 15');
assert.equal(documentRows(doc).filter((row) => row.type === 'DATA').length, vm.rowCount, 'folha: mesma população');

// ---------------------------------------------------------------------------------------------------
// 6. Permissão comercial (matriz real): quem não tem commercial.values não vê valor nenhum, sem erro
// ---------------------------------------------------------------------------------------------------
const comValores = [ADMIN, GESTOR];
const semValores = [OPERADOR, CONSULTA];
for (const actor of comValores) assert.equal(can(actor.role, 'commercial.values'), true, `${actor.role} vê valores`);
for (const actor of semValores) assert.equal(can(actor.role, 'commercial.values'), false, `${actor.role} não vê valores`);
for (const actor of comValores) {
  const visto = await vendas(actor);
  assert.deepEqual(visto.columns.map((column) => column.id), [...VENDAS_COLUMNS], `${actor.role}: com Valor @ e Valor total`);
  assert.equal(visto.totals.valor_total.value, 29100, `${actor.role}: total de valor`);
  assert.equal(visto.hiddenByPermission.length, 0);
}
const SEM_VALOR = ['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba'];
const semValorAlgum = (viewModel, where) => {
  assert.deepEqual(viewModel.columns.map((column) => column.id), SEM_VALOR, `${where}: sem colunas de valor (Qtd @ fica — não é valor comercial)`);
  assert.ok(!viewModel.aggregates.some((spec) => spec.id === 'valor_total'), `${where}: sem total de valor`);
  assert.ok(!('valor_total' in viewModel.totals), `${where}: total geral sem valor`);
  const nos = [];
  const walk = (node) => { nos.push(node); node.children.forEach(walk); };
  viewModel.tree.forEach(walk);
  assert.ok(nos.every((node) => !('valor_total' in node.aggregates)), `${where}: subtotal sem valor`);
  assert.ok(viewModel.warnings.some((warning) => warning.code === 'COLUMNS_HIDDEN_BY_PERMISSION' && warning.columns.includes('valor_venda_total') && warning.columns.includes('valor_arroba')), `${where}: aviso de colunas ocultas pelo perfil`);
  assert.deepEqual(idsOf(viewModel), esperado(30).geral.ids, `${where}: mesma população`);
  near(viewModel.totals.total_arroba.value, 2350 / 30, `${where}: @ viva continua`);
  const folha = buildReportDocument(viewModel);
  assert.ok(!folha.columns.some((column) => /Valor/.test(column.label)), `${where}: folha sem coluna de valor`);
  assert.ok(!JSON.stringify(folha.sections).includes('R$') && !JSON.stringify(folha.grandTotal).includes('R$'), `${where}: folha sem R$`);
  assert.deepEqual(folha.grandTotal.rows[0].chips.items.map((item) => item.label), TOTAL_LABELS.slice(0, 5), `${where}: total geral sem "Valor total"`);
};
for (const actor of semValores) {
  assert.equal(await code(() => vendas(actor)), 'OK', `${actor.role}: Vendas abre sem erro`);
  const visto = await vendas(actor);
  semValorAlgum(visto, actor.role);
  // Filtro/ordenação em coluna de valor não viram canal lateral.
  const tentativa = await vendas(actor, { filters: { valor_venda_total: { operator: 'greater', value: '6000' } }, sort: [{ columnId: 'valor_venda_total', direction: 'desc' }] });
  assert.equal(tentativa.rowCount, 6, `${actor.role}: filtro em valor removido`);
  assert.ok(tentativa.warnings.some((warning) => warning.code === 'FILTER_REMOVED_BY_PERMISSION'));
  assert.ok(!tentativa.sort.some((item) => item.columnId === 'valor_venda_total'), `${actor.role}: ordenação por valor removida`);
  // Seleção que já volta sem as colunas de valor (modelo/último estado desse perfil): o aviso continua.
  const explicita = await vendas(actor, { columns: SEM_VALOR });
  assert.ok(explicita.hiddenByPermission.includes('valor_venda_total'), `${actor.role}: aviso vem do tipo, não só do pedido`);
}
// Exportações de quem não vê valor: CONSULTA exporta sem valores; OPERADOR não exporta (regra de hoje).
const consulta = await vendas(CONSULTA);
// Valores procurados no formato de cada canal (nunca só os dígitos: o id da emissão tem dígitos ao acaso).
const semDinheiro = (text, where, valores) => {
  for (const proibido of ['R$', 'Valor @', 'Valor total', ...valores]) assert.ok(!text.includes(proibido), `${where}: sem "${proibido}"`);
};
semDinheiro((await prepareEmission(consulta, 'csv', CONSULTA)).content, 'CONSULTA CSV', ['6750,00', '29100,00', '8850,00', '290,00']);
semDinheiro(unzipStored((await prepareEmission(consulta, 'xlsx', CONSULTA)).content)['xl/worksheets/sheet1.xml'], 'CONSULTA XLSX', ['<v>6750</v>', '<v>29100</v>', '<v>8850</v>', '<v>290</v>']);
const jsonConsulta = JSON.parse((await prepareEmission(consulta, 'json', CONSULTA)).content);
assert.ok(!jsonConsulta.columns.some((column) => column.id.startsWith('valor_')) && !jsonConsulta.aggregates.some((spec) => spec.id === 'valor_total') && !('valor_total' in jsonConsulta.totals), 'CONSULTA JSON: sem coluna/total de valor');
assert.ok(jsonConsulta.data.every((row) => !('valor_venda_total' in row) && !('valor_arroba' in row)), 'CONSULTA JSON: linhas sem valor');
assert.deepEqual(jsonConsulta.manifest.hiddenByPermission, ['valor_arroba', 'valor_venda_total'], 'CONSULTA JSON: manifesto registra o que o perfil ocultou');
for (const proibido of ['6750', '29100', '8850', '5850']) assert.ok(!JSON.stringify({ ...jsonConsulta, manifest: null }).includes(proibido), `CONSULTA JSON: sem ${proibido}`);
semDinheiro(preparePrint(consulta, CONSULTA).html, 'CONSULTA impressão/PDF', ['6.750,00', '29.100,00', '8.850,00']);
const operador = await vendas(OPERADOR);
assert.equal(await code(() => prepareEmission(operador, 'csv', OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não exporta (regra de hoje)');
assert.equal(await code(() => preparePrint(operador, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não imprime (regra de hoje)');
// View model de ADMIN forjado na sessão da CONSULTA: recusado.
assert.equal(await code(() => prepareEmission({ ...vm, emittedBy: CONSULTA }, 'csv', CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: coluna de valor injetada no view model');

// Modelo salvo por ADMIN (compartilhado) com Vendas aberto por CONSULTA: sem valores, sem erro.
const modelo = await saveTemplate({
  baseReportId: 'pesagens', name: 'Vendas por comprador', scope: 'SHARED', view: 'vendas', period: period.periodo,
  columns: tipo.columns, groups: tipo.groups, aggregates: tipo.aggregates, sort: tipo.sort, mode: tipo.mode,
}, ADMIN, { now: '2026-09-15T10:00:00.000Z' });
assert.deepEqual(modelo.columns, [...VENDAS_COLUMNS], 'modelo do ADMIN guarda as colunas de valor');
const modeloConsulta = (await listTemplates(CONSULTA)).find((item) => item.id === modelo.id);
assert.ok(modeloConsulta, 'CONSULTA vê o modelo compartilhado');
const pedido = templateToRequest(modeloConsulta, 'CONSULTA');
assert.equal(pedido.selection.view, 'vendas');
const abertoConsulta = await runReport(pedido.reportId, { today: TODAY, params: pedido.params, selection: pedido.selection }, CONSULTA);
semValorAlgum(abertoConsulta, 'modelo do ADMIN aberto por CONSULTA');
const abertoAdmin = templateToRequest(modelo, 'ADMIN');
assert.equal((await runReport(abertoAdmin.reportId, { today: TODAY, params: abertoAdmin.params, selection: abertoAdmin.selection }, ADMIN)).totals.valor_total.value, 29100, 'o mesmo modelo com valores para o ADMIN');

// Tela: modelo e último estado de quem não vê valor são gravados sem as colunas/totais de valor
// (withoutHiddenColumns) — sem isso o serviço recusa tudo e a CONSULTA não salva nada em Vendas.
assert.equal(await code(() => saveTemplate({ baseReportId: 'pesagens', name: 'Minhas vendas', view: 'vendas', columns: tipo.columns, groups: tipo.groups, aggregates: tipo.aggregates, mode: tipo.mode }, CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: o serviço recusa modelo com coluna que o autor não vê');
const limpo = withoutHiddenColumns(definition, 'CONSULTA', tipo);
assert.deepEqual(limpo.columns, SEM_VALOR);
assert.ok(!limpo.aggregates.some((spec) => spec.columnId === 'valor_venda_total'));
assert.deepEqual(withoutHiddenColumns(definition, 'ADMIN', tipo).columns, [...VENDAS_COLUMNS], 'quem vê valores não perde nada');
// O que a tela grava vem de reportScreenState (o MESMO código da ReportView), a partir do estado da tela em Vendas.
const semValorGravado = (payload, where) => {
  assert.deepEqual(payload.columns, SEM_VALOR, `${where}: sem Valor @ e Valor total`);
  assert.ok(!payload.aggregates.some((spec) => spec.id === 'valor_total' || spec.columnId === 'valor_venda_total' || spec.columnId === 'valor_arroba'), `${where}: sem total de valor`);
  assert.deepEqual(payload.aggregates.map((spec) => spec.id), VENDAS_TOTALS.map((spec) => spec.id).filter((id) => id !== 'valor_total'), `${where}: os outros totais ficam`);
};
for (const [nome, montar] of [['modelo', templatePayload], ['último estado', viewStatePayload]]) {
  for (const role of ['CONSULTA', 'OPERADOR']) semValorGravado(montar(definition, telaVendas(), role), `tela (${nome}) de ${role}`);
  for (const role of ['ADMIN', 'GESTOR']) {
    const gravado = montar(definition, telaVendas(), role);
    assert.deepEqual(gravado.columns, [...VENDAS_COLUMNS], `tela (${nome}) de ${role}: com as colunas de valor`);
    assert.ok(gravado.aggregates.some((spec) => spec.id === 'valor_total'), `tela (${nome}) de ${role}: com o total de valor`);
  }
  const gravado = montar(definition, telaVendas({ drill: [{ columnId: 'comprador', key: 'frigo sul' }], mode: 'DETALHADO' }), 'ADMIN');
  assert.deepEqual([gravado.view, gravado.mode, gravado.period, gravado.params], ['vendas', 'RESUMIDO', period.periodo, {}], `tela (${nome}): tipo, período à parte e o detalhe de grupo não fica`);
}
assert.equal(templatePayload(definition, telaVendas(), 'ADMIN').baseReportId, 'pesagens');
const meu = await saveTemplate({ name: 'Minhas vendas', ...templatePayload(definition, telaVendas(), 'CONSULTA') }, CONSULTA);
assert.equal(meu.view, 'vendas', 'CONSULTA salva o próprio modelo de Vendas (pelo que a tela grava)');
assert.deepEqual(meu.columns, SEM_VALOR);
await saveReportViewState('pesagens', viewStatePayload(definition, telaVendas(), 'CONSULTA'), CONSULTA);
const estado = await getReportViewState('pesagens', CONSULTA);
assert.ok(estado, 'último estado da CONSULTA gravado (antes falhava em silêncio)');
assert.equal(estado.selection.view, 'vendas', 'último estado da CONSULTA reabre em Vendas');
semValorAlgum(await runReport('pesagens', { today: TODAY, params: estado.params, selection: estado.selection }, CONSULTA), 'último estado da CONSULTA');
// A tela grava pelo reportScreenState (nada de montar o payload à parte, com state.columns cru).
const tela = readFileSync(new URL('../src/components/reports/ReportView.jsx', import.meta.url), 'utf8');
assert.match(tela, /saveTemplate\(\{ id, name, scope, \.\.\.templatePayload\(definition, state, actor\.role\) \}, actor\)/, 'tela: "Salvar modelo" grava o templatePayload');
assert.match(tela, /const payload = viewStatePayload\(definition, state, actor\.role\);/, 'tela: último estado grava o viewStatePayload');
assert.ok(!/columns: state\.columns, filters: state\.uiFilters/.test(tela), 'NEGATIVO: a tela não monta outro payload com as colunas cruas');
// Controles genéricos saem do tipo pelo leaveViewPatch (a condição vai junto) e o execute manda a herdada (4b).
assert.match(tela, /const setGroups = \(groups\) => update\(\{ groups, drill: \[\], \.\.\.leaveViewPatch\(definition, state\) \}\);/, 'tela: Agrupar por/Níveis levam a condição do tipo');
assert.match(tela, /const setMode = [^\n]*: leaveViewPatch\(definition, state\)\) \}\);/, 'tela: Resumido/Detalhado levam a condição do tipo');
assert.match(tela, /fixedFilters: screenFixedFilters\(state\)/, 'tela: o execute manda a condição herdada');
assert.ok(!/view: null, matrix: null/.test(tela), 'NEGATIVO: a tela não sai do tipo largando a condição');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:vendas-por-comprador:verify',
  ok: true,
  vendas: vm.rowCount,
  compradores: vm.tree.map((node) => `${node.label} (${node.aggregates.animais_vendidos.value})`),
  totalGeral: { animais: vm.totals.animais_vendidos.value, pesoTotal: vm.totals.peso_total.value, arrobas30: roundTo(vm.totals.total_arroba.value, 2), valorTotal: vm.totals.valor_total.value, valorDigitado: `${vm.totals.valor_total.n_validos} de ${vm.totals.valor_total.n_total}` },
}, null, 2));
