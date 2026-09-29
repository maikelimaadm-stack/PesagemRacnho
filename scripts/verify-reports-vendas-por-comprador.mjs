// Gate reports:vendas-por-comprador:verify (E1D) — tipo "Vendas (Detalhado)" do relatório Pesagens = o relatório de
// venda do MAKGESTAO (PDF da responsável: docs/evidence/e1d/referencia-makgestao/print-responsavel-vendas-w3.pdf):
//   - população = "Vendas do período" (comercial.vendas): as MESMAS linhas; cadastro, manejo (mesmo com motivo "Venda"),
//     abate, morte e venda fora do período ficam fora; filtro da pessoa só restringe;
//   - tela: "Resumido", "Agrupar por" e "Níveis" saem do tipo (Personalizado) levando a condição fixa, com cadeado
//     (tela, modelo e último estado) — nenhum controle amplia; escolher outro tipo a solta;
//   - Valor Total de uma venda = valor digitado quando > 0; senão Qtd @ (@ VIVA = peso ÷ divisor) × Valor @; sem os
//     dois, "-" e fora da soma (coluna derivada valor_venda_calc). O caso do PDF (90 animais, 40.968 kg, R$ 383/@,
//     ÷ 30 → R$ 523.024,80, Média (@) 15,17) é reproduzido texto a texto;
//   - folha no layout "vendas": Métrica | Valor, TOTAIS POR MARCA, TOTAIS POR COMPRADOR, VENDAS POR COMPRADOR
//     (DETALHADO) e TOTAL GERAL conferidos à mão (animais distintos, "Não informado" por último, divisor 30 e 15,
//     Média valor da arroba PONDERADA pela Qtd @ — e um caso em que a média simples do antigo dá outro número);
//     "Mostrar Detalhes" liga/desliga a tabela de vendas de cada comprador; drill volta ao Detalhado comum;
//   - XLSX com os MESMOS blocos (sempre com as vendas), números como números — paridade folha × XLSX; CSV e JSON
//     continuam o Detalhado (uma linha por venda, subtotal por comprador e total geral);
//   - permissão comercial pela matriz real: ADMIN/GESTOR com valores; OPERADOR/CONSULTA sem nenhum item de valor
//     (folha, CSV, XLSX, JSON, impressão), sem erro, com o aviso; modelo do ADMIN aberto por CONSULTA.
// Massa: a do fixture comum (A2 vendido à Frigo Sul) + as vendas deste gate, pela cadeia oficial (weighingService),
// no banco em memória deste processo (o fixture compartilhado não muda); o caso do PDF é massa sintética pura.
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
import { leaveViewPatch, screenFixedFilters, screenModePatch, templatePayload, viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';
import { buildReportDocument, describeReportFilters, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { headerLabel, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { NONE_GROUP_LABEL } from '../src/modules/reporting/domain/groupEngine.js';
import { getReportView, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildVendasBlocks, isVendasViewModel, VENDAS_BLOCK_TOTALS, VENDAS_MISSING } from '../src/modules/reporting/domain/vendasLayout.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { renderVendasBody } from '../src/modules/reporting/infrastructure/exporters/vendasHtml.js';
import { SHEET_CSS } from '../src/modules/reporting/infrastructure/exporters/sheetStyles.js';
import { buildSheetRows, unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { XLSX_VENDAS_KINDS } from '../src/modules/reporting/infrastructure/exporters/vendasXlsx.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { VENDAS_COLUMNS, VENDAS_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';

const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const near = (actual, expected, message) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
const spaces = (text) => String(text ?? '').replace(/\s/g, ' ');
const br = (value, decimals) => roundTo(value, decimals).toFixed(decimals).replace('.', ',');
// Texto da folha: "40.968,00", "R$ 523.024,80" (milhar com ponto), "-" sem valor.
const folha = (value, decimals, money = false) => {
  if (value === null) return VENDAS_MISSING;
  const [inteiro, fracao] = roundTo(value, decimals).toFixed(decimals).split('.');
  const texto = `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fracao ? `,${fracao}` : ''}`;
  return money ? `R$ ${texto}` : texto;
};
const numberOf = (text) => (spaces(text) === VENDAS_MISSING ? null : Number(spaces(text).replace('R$', '').replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')));
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
assert.deepEqual([...VENDAS_COLUMNS], ['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba', 'valor_arroba', 'valor_venda_calc'], 'colunas do "Mostrar Detalhes" do antigo');
assert.deepEqual([...view.columnChoices.defaults], [...VENDAS_COLUMNS]);
assert.deepEqual([...view.columnChoices.available].slice(VENDAS_COLUMNS.length), ['destino_venda', 'nome_lote', 'nome_apartacao', 'sexo', 'raca', 'era', 'marca', 'observacao'], 'opcionais do antigo no seletor "Colunas"');
assert.deepEqual({ ...view.columnLabels }, { peso_arroba: 'Qtd @', valor_arroba: 'Valor @', valor_venda_calc: 'Valor Total' }, 'cabeçalhos do antigo');
assert.equal(VENDAS_TOTALS, VENDAS_BLOCK_TOTALS, 'os totais do tipo SÃO os dos blocos da folha');
assert.deepEqual(VENDAS_TOTALS.map((spec) => spec.id), ['animais_vendidos', 'peso_total', 'peso_medio', 'media_arroba', 'media_valor_arroba', 'valor_total']);
assert.deepEqual(VENDAS_TOTALS.map((spec) => `${spec.op}:${spec.columnId}`), ['countDistinct:numero_animal', 'sum:peso', 'avg:peso', 'avg:peso_arroba', 'weightedAvg:valor_arroba_venda', 'sum:valor_venda_calc'], '@ = @ VIVA (peso_arroba), nunca a @ de carcaça; valor = coluna derivada');
// Todo total de Vendas tem rótulo de curral pelo id: grade (metricLabels), CSV e XLSX do Detalhado dizem o mesmo.
const TOTAL_LABELS = ['Animais vendidos', 'Peso total (kg)', 'Peso médio (kg)', 'Média (@)', 'Média valor da arroba', 'Valor total'];
assert.deepEqual(VENDAS_TOTALS.map((spec) => definition.metricLabels[spec.id]), TOTAL_LABELS, 'rótulo de curral de cada total');
const colunaValor = definition.columns.find((column) => column.id === 'valor_venda_calc');
const colunaPreco = definition.columns.find((column) => column.id === 'valor_arroba_venda');
assert.deepEqual([colunaValor.type, colunaValor.sensitive, colunaValor.source], ['money', 'commercial', 'derivado'], 'valor_venda_calc: dinheiro, sensível, derivado (conta no accessor, nunca na folha)');
assert.deepEqual([colunaPreco.sensitive, colunaPreco.metricOnly, colunaPreco.exportable], ['commercial', true, false], 'valor_arroba_venda: só de cálculo, sensível');

// ---------------------------------------------------------------------------------------------------
// 2. Caso do PDF da responsável (massa sintética pura, sem banco): texto a texto
// ---------------------------------------------------------------------------------------------------
const resolve = createColumnResolver(definition.columns);
const allColumns = definition.columns.map((column) => ({ id: column.id, label: column.label, type: column.type }));
const sintetico = (rows, extra = {}) => ({ view: { id: 'vendas' }, mode: 'DETALHADO', drill: [], groups: [{ columnId: 'comprador' }], rows, resolve, availableColumns: allColumns, ...extra });
const venda = (id, animal, extra) => ({ id, animal_id: animal, numero_animal: animal, tipo_manejo: 'Saída', motivo_saida: 'Venda', arroba_divisor: 30, ...extra });
{
  const zf = Array.from({ length: 88 }, (_, index) => (index < 87 ? 455 : 40029 - 87 * 455));
  const rows = [
    ...[469, 470].map((peso, index) => venda(`h${index}`, `H${index}`, { comprador: 'W3', marca: 'HR2', peso, valor_arroba: 383 })),
    ...zf.map((peso, index) => venda(`z${index}`, `Z${index}`, { comprador: 'W3', marca: 'ZF', peso, valor_arroba: 383 })),
  ];
  assert.equal(rows.reduce((soma, row) => soma + row.peso, 0), 40968, 'massa do PDF: 40.968 kg');
  const pdf = buildVendasBlocks(sintetico(rows));
  const textos = (items) => items.map((item) => spaces(item.text));
  assert.deepEqual(pdf.resumo.rows.map((row) => row.label), ['Animais vendidos', 'Peso total (kg)', 'Peso médio (kg)', 'Média (@)', 'Média valor da arroba', 'Valor total'], 'PDF: métricas na ordem');
  assert.deepEqual(textos(pdf.resumo.rows), ['90', '40.968,00', '455,20', '15,17', 'R$ 383,00', 'R$ 523.024,80'], 'PDF: Métrica | Valor igual ao papel (40.968 ÷ 30 × 383 = 523.024,80)');
  assert.deepEqual(pdf.resumo.rows.map((row) => row.strong), [false, false, false, false, false, true], 'PDF: "Valor total" em negrito');
  assert.deepEqual(pdf.porMarca.columns.map((column) => column.label), ['Marca', 'Qtd', 'Peso Total (kg)', 'Peso Médio (kg)', 'Média (@)', 'Média Valor @', 'Valor Total']);
  assert.deepEqual(pdf.porMarca.rows.map((row) => [row.label, ...textos(row.cells)]), [
    ['HR2', '2', '939,00', '469,50', '15,65', 'R$ 383,00', 'R$ 11.987,90'],
    ['ZF', '88', '40.029,00', '454,88', '15,16', 'R$ 383,00', 'R$ 511.036,90'],
  ], 'PDF: TOTAIS POR MARCA igual ao papel');
  assert.deepEqual(pdf.porComprador.columns.map((column) => column.label), ['Comprador', 'Qtd', 'Peso Total (kg)', 'Valor Total']);
  assert.deepEqual(pdf.porComprador.rows.map((row) => [row.label, ...textos(row.cells)]), [['W3', '90', '40.968,00', 'R$ 523.024,80']], 'PDF: TOTAIS POR COMPRADOR igual ao papel');
  assert.equal(pdf.compradores.title, 'VENDAS POR COMPRADOR (DETALHADO)');
  assert.deepEqual(pdf.compradores.items.map((item) => [item.title, ...item.totals.map((total) => `${total.label}: ${spaces(total.display)}`)]), [
    ['COMPRADOR: W3', 'Total: 90 animais', 'Peso Médio: 455,20 kg', 'Peso Total: 40.968,00 kg', 'Média (@): 15,17', 'Valor Total: R$ 523.024,80'],
  ], 'PDF: cartão do comprador igual ao papel');
  assert.equal(spaces(pdf.totalGeral.text), 'TOTAL GERAL: 90 animais | Peso Total: 40.968,00 kg | Peso Médio: 455,20 kg | Média (@): 15,17 | Valor Total: R$ 523.024,80', 'PDF: TOTAL GERAL igual ao papel');
  const html = spaces(renderVendasBody({ vendas: pdf }));
  for (const trecho of ['TOTAIS POR MARCA', 'TOTAIS POR COMPRADOR', 'VENDAS POR COMPRADOR (DETALHADO)', 'COMPRADOR: W3', 'R$ 523.024,80', '<strong>Peso Médio:</strong> 455,20 kg']) assert.ok(html.includes(trecho), `PDF: a folha desenha "${trecho}"`);
  assert.ok(!html.includes('sv-table--detail'), 'PDF: "Mostrar Detalhes" desligado = sem tabela de vendas');
}

// Motor (sem banco): animais DISTINTOS (dado legado com duas vendas do mesmo animal), venda sem peso, 0 digitado.
{
  const blocos = buildVendasBlocks(sintetico([
    venda('x1', 'B1', { comprador: 'Frigo Sul', marca: 'ALFA', peso: 300, valor_venda_total: 4500 }),
    venda('x2', 'B1', { comprador: 'Frigo Sul', marca: 'ALFA', peso: 330, valor_venda_total: 4950 }),
    venda('x3', 'B2', { comprador: 'Frigo Sul', marca: 'ALFA', peso: null, valor_venda_total: 1000 }),
  ]));
  const [frigo] = blocos.porComprador.rows;
  assert.equal(frigo.cells[0].value, 2, 'animais distintos por comprador (o antigo contava 3 linhas)');
  assert.equal(blocos.porMarca.rows[0].cells[0].value, 2, 'animais distintos por marca');
  near(frigo.cells[1].value, 630, 'peso total só com peso');
  near(blocos.resumo.rows[2].value, 315, 'peso médio sem o ausente (nunca 0)');
  near(blocos.resumo.rows[3].value, 10.5, 'Média (@) = média da @ viva (315 ÷ 30)');
  near(frigo.cells[2].value, 10450, 'valor = soma do digitado');
  assert.equal(blocos.resumo.rows[4].value, null, 'sem Valor @ nenhum: Média valor da arroba vazia ("-"), nunca 0');
  assert.equal(blocos.resumo.rows[4].text, VENDAS_MISSING);
  // 0 digitado não é valor: com Valor @ vale a conta (450 ÷ 30 × 300 = 4.500); sem Valor @, "-".
  near(resolve('valor_venda_calc').valueOf(venda('y1', 'C1', { peso: 450, valor_venda_total: 0, valor_arroba: 300 })), 4500, '0 digitado + Valor @ → @ viva × Valor @');
  assert.equal(resolve('valor_venda_calc').valueOf(venda('y2', 'C2', { peso: 450, valor_venda_total: 0 })), null, '0 digitado sem Valor @ → sem valor');
  assert.equal(resolve('valor_venda_calc').valueOf(venda('y3', 'C3', { peso: null, valor_arroba: 300 })), null, 'sem peso não há @: sem valor');
  // Fato para a pergunta à responsável: o "Resumo de Vendas"/"Estimativa comercial" do Lançamento usa a @ de
  // CARCAÇA — 450 kg × 52% = 234 kg ÷ 15 = 15,6 @ × R$ 300 = R$ 4.680; o relatório (@ viva, como o antigo) dá R$ 4.500.
  const estimativa = calculateCarcassTrade({ weight: 450, yieldPercent: 52, pricePerArroba: 300 }).estimatedValue;
  near(estimativa, 4680, 'Lançamento: estimativa pela @ de carcaça');
  near(resolve('valor_venda_calc').valueOf(venda('y4', 'C4', { peso: 450, valor_arroba: 300, rendimento_carcaca: 52 })), 4500, 'relatório: @ viva × Valor @ (divergência registrada)');
}

// ---------------------------------------------------------------------------------------------------
// 3. Massa no banco: vendas conferíveis à mão (além de A2 → Frigo Sul, 280 kg, R$ 3.000, R$ 300/@, do fixture)
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
const a13 = bicho('A13', '1313', { marca: 'ALFA', marca_id: 'm-alfa', ...L1 });
const massa = [
  cadastro(a5, 'v5c', '2026-08-02', 400),
  // Valor digitado PREVALECE: 450 ÷ 30 × R$ 300 daria R$ 4.500; vale o digitado, R$ 6.750. A @ de carcaça gravada
  // (52% → 234 kg ÷ 15 = 15,6 @) não entra: "Qtd @" é a viva (450 ÷ 30 = 15).
  saida(a5, 'v5', 'Venda', '2026-09-06', 450, { comprador: 'Agropecuária Boa Vista', valor_venda_total: 6750, valor_arroba: 300, rendimento_carcaca: 52, rendimento_origem: 'INFORMADO', peso_carcaca_estimado: 234, quantidade_arrobas: 15.6 }),
  cadastro(a6, 'v6c', '2026-08-03', 300),
  // Sem valor digitado, com Valor @: 330 ÷ 30 × R$ 290 = R$ 3.190 (÷ 15: R$ 6.380) — a conta do antigo/PDF.
  saida(a6, 'v6', 'Venda', '2026-09-07', 330, { comprador: 'Agropecuária Boa Vista', valor_arroba: 290 }),
  cadastro(a7, 'v7c', '2026-08-04', 420),
  // Comprador em branco (só espaços): grupo "Não informado".
  saida(a7, 'v7', 'Venda', '2026-09-08', 480, { comprador: '   ', valor_venda_total: 7200, valor_arroba: 300 }),
  cadastro(a8, 'v8c', '2026-08-06', 300),
  saida(a8, 'v8', 'Venda', '2026-09-09', 390, { comprador: 'Frigo Sul', valor_venda_total: 5850, valor_arroba: 300 }),
  cadastro(a12, 'v12c', '2026-08-08', 380),
  // Valor digitado sem Valor @: conta no Valor total, fica fora da Média valor da arroba.
  saida(a12, 'v12', 'Venda', '2026-09-11', 420, { comprador: 'Zeca Gado', valor_venda_total: 6300 }),
  cadastro(a13, 'v13c', '2026-08-09', 360),
  // Sem Valor @ e sem valor digitado: "-" e FORA da soma.
  saida(a13, 'v13', 'Venda', '2026-09-12', 400, { comprador: 'Zeca Gado' }),
  // NEGATIVOS: abate com "comprador", manejo com motivo "Venda" (o lançamento aceita) e venda fora do período.
  cadastro(a9, 'v9c', '2026-08-07', 350),
  saida(a9, 'v9', 'Abate', '2026-09-10', 500, { comprador: 'Frigo Sul', frigorifico: 'Frigo Sul', valor_total_abate: 9000 }),
  cadastro(a11, 'v11c', '2026-08-07', 350),
  { ...a11, id: 'v11m', tipo_manejo: 'Manejo', motivo_saida: 'Venda', comprador: 'Frigo Sul', data_pesagem: '2026-09-01', peso: 370 },
  cadastro(a10, 'v10c', '2026-07-20', 350),
  saida(a10, 'v10', 'Venda', '2026-07-25', 380, { comprador: 'Frigo Sul', valor_venda_total: 5000, valor_arroba: 300 }),
];
for (const entry of massa) await weighingService.createEntry(entry);

// Conta à mão (independente do motor): venda = [id, comprador, marca, peso, valor digitado | null, Valor @ | null].
const VENDAS = [
  ['e6', 'Frigo Sul', 'BETA', 280, 3000, 300],
  ['v5', 'Agropecuária Boa Vista', 'ALFA', 450, 6750, 300],
  ['v6', 'Agropecuária Boa Vista', 'BETA', 330, null, 290],
  ['v7', NONE_GROUP_LABEL, NONE_GROUP_LABEL, 480, 7200, 300],
  ['v8', 'Frigo Sul', NONE_GROUP_LABEL, 390, 5850, 300],
  ['v12', 'Zeca Gado', NONE_GROUP_LABEL, 420, 6300, null],
  ['v13', 'Zeca Gado', 'ALFA', 400, null, null],
];
const COMPRADORES = ['Agropecuária Boa Vista', 'Frigo Sul', 'Zeca Gado', NONE_GROUP_LABEL];
const MARCAS = ['ALFA', 'BETA', NONE_GROUP_LABEL];
const valorDe = ([, , , peso, digitado, preco], divisor) => (digitado > 0 ? digitado : preco > 0 ? (peso / divisor) * preco : null);
const naMao = (vendas, divisor) => {
  const pesoTotal = vendas.reduce((soma, item) => soma + item[3], 0);
  const valores = vendas.map((item) => valorDe(item, divisor)).filter((valor) => valor !== null);
  const comPreco = vendas.filter((item) => item[5] > 0);
  const arrobas = comPreco.reduce((soma, item) => soma + item[3] / divisor, 0);
  return {
    ids: vendas.map((item) => item[0]).sort(),
    animais_vendidos: vendas.length, // uma venda por animal (o lançamento recusa a segunda)
    peso_total: pesoTotal,
    peso_medio: pesoTotal / vendas.length,
    media_arroba: pesoTotal / divisor / vendas.length,
    // Média valor da arroba: Valor @ ponderado pela Qtd @ (só vendas com Valor @).
    media_valor_arroba: comPreco.length ? comPreco.reduce((soma, item) => soma + (item[3] / divisor) * item[5], 0) / arrobas : null,
    // O antigo fazia a média SIMPLES dos Valor @ (fica só para mostrar onde difere).
    media_simples_antigo: comPreco.length ? comPreco.reduce((soma, item) => soma + item[5], 0) / comPreco.length : null,
    valor_total: valores.length ? valores.reduce((soma, valor) => soma + valor, 0) : null,
    valorN: [valores.length, vendas.length],
  };
};
const porChave = (index, chaves, divisor) => chaves.map((chave) => ({ chave, ...naMao(VENDAS.filter((item) => item[index] === chave), divisor) }));
const esperado = (divisor) => ({ compradores: porChave(1, COMPRADORES, divisor), marcas: porChave(2, MARCAS, divisor), geral: naMao(VENDAS, divisor) });
// Conferência à mão, em números: 3.000 + 6.750 + 3.190 + 7.200 + 5.850 + 6.300 = 32.290 (÷ 15: 3.190 vira 6.380).
near(esperado(30).geral.valor_total, 32290, 'à mão: valor total ÷ 30');
near(esperado(15).geral.valor_total, 35480, 'à mão: valor total ÷ 15');
near(esperado(30).geral.media_valor_arroba, 575700 / 1930, 'à mão: (1.600 kg × 300 + 330 kg × 290) ÷ 1.930 kg = R$ 298,29');
assert.equal(esperado(30).geral.media_simples_antigo, 298, 'à mão: a média SIMPLES do antigo daria R$ 298,00');
assert.notEqual(br(esperado(30).geral.media_valor_arroba, 2), br(esperado(30).geral.media_simples_antigo, 2), 'ponderada (R$ 298,29) ≠ simples do antigo (R$ 298,00) quando os preços diferem');

// ---------------------------------------------------------------------------------------------------
// 4. População = "Vendas do período"; filtro da pessoa só restringe
// ---------------------------------------------------------------------------------------------------
const vendas = (actor, selection = {}, request = {}) => runReport('pesagens', { today: TODAY, params: period, ...request, selection: { view: 'vendas', ...selection } }, actor);
const idsOf = (vm) => vm.rows.map((row) => row.id).sort();
const vm = await vendas(ADMIN);
const comercial = await runReport('comercial.vendas', { today: TODAY, params: period }, ADMIN);
assert.deepEqual(idsOf(vm), esperado(30).geral.ids, 'população = as 7 vendas do período, conferidas à mão');
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
assert.deepEqual(Object.keys(vm.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], 'condição fixa do tipo');
assert.ok(Object.values(vm.lockedFilters).every((filter) => filter.match === 'code'), 'fixa pelo código');
assert.match(describeReportFilters(vm), /Tipo em Saída \(fixo\)/);
assert.match(describeReportFilters(vm), /Motivo da saída em Venda \(fixo\)/);
assert.equal((await vendas(ADMIN, { filters: { motivo_saida: { operator: 'in', values: ['Abate'], match: 'label' } } })).rowCount, 0, 'NEGATIVO: filtro "Abate" não traz abates — só esvazia');
assert.equal((await vendas(ADMIN, { filters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Manejo', 'Saída'], match: 'label' } } })).rowCount, vm.rowCount, 'NEGATIVO: filtro com mais tipos não amplia');
const fixoAlheio = await vendas(ADMIN, { fixedFilters: { motivo_saida: { operator: 'in', values: ['Abate', 'Morte', 'Venda'] } } });
assert.deepEqual(idsOf(fixoAlheio), idsOf(vm), 'NEGATIVO: condição fixa de modelo na mesma coluna não amplia');
assert.deepEqual(fixoAlheio.lockedFilters.motivo_saida.values, ['Venda']);
assert.deepEqual(idsOf(await vendas(ADMIN, { search: 'Lote 02' })), ['e6', 'v6', 'v8'], 'pesquisa só restringe');
assert.equal((await vendas(ADMIN, { mode: 'RESUMIDO' })).mode, 'DETALHADO', 'o modo é o do tipo');
assert.match(await code(() => vendas(ADMIN, { groups: [{ columnId: 'marca' }] })), /agrupa por comprador/, 'NEGATIVO: outro agrupamento não é o tipo Vendas (a tela passa a Personalizado levando a condição — 4b)');

// ---------------------------------------------------------------------------------------------------
// 5. Por comprador (motor do view model), "Não informado" por último; totais à mão (÷ 30 e ÷ 15)
// ---------------------------------------------------------------------------------------------------
assert.equal(vm.mode, 'DETALHADO');
assert.deepEqual({ id: vm.view.id, titleKind: vm.view.titleKind }, { id: 'vendas', titleKind: 'Sintético' }, 'view model leva o tipo (a folha lê o id e o titleKind)');
assert.deepEqual(vm.groups.map((group) => group.columnId), ['comprador']);
assert.deepEqual(vm.tree.map((node) => node.label), COMPRADORES, 'compradores em ordem alfabética, "Não informado" por último');
assert.equal(vm.tree.at(-1).missing, true, 'comprador em branco = grupo ausente');
const IDS = VENDAS_TOTALS.map((spec) => spec.id);
const confereNumero = (actual, expected, message) => (expected === null ? assert.equal(actual, null, message) : near(actual, expected, message));
const confere = (viewModel, divisor) => {
  const conta = esperado(divisor);
  viewModel.tree.forEach((node, index) => {
    const grupo = conta.compradores[index];
    assert.deepEqual(node.rows.map((row) => row.id).sort(), grupo.ids, `${grupo.chave}: linhas do grupo`);
    for (const id of IDS) confereNumero(node.aggregates[id].value, grupo[id], `${grupo.chave} ÷${divisor} · ${id}`);
    assert.deepEqual([node.aggregates.valor_total.n_validos, node.aggregates.valor_total.n_total], grupo.valorN, `${grupo.chave}: vendas com valor em n de m`);
  });
  for (const id of IDS) confereNumero(viewModel.totals[id].value, conta.geral[id], `total geral ÷${divisor} · ${id}`);
  assert.equal(viewModel.arrobaDivisor, divisor);
};
confere(vm, 30);
const vm15 = await vendas(ADMIN, {}, { arrobaDivisor: 15 });
confere(vm15, 15);
// Total geral recalculado sobre a população (nunca média de subtotais).
const mediaDasMedias = vm.tree.reduce((soma, node) => soma + node.aggregates.peso_medio.value, 0) / vm.tree.length;
assert.ok(Math.abs(mediaDasMedias - vm.totals.peso_medio.value) > 1, 'NEGATIVO: peso médio geral ≠ média dos pesos médios dos compradores');
// Qtd @ = @ de PESO VIVO (peso ÷ divisor), não a @ de carcaça gravada no lançamento.
const linha = (viewModel, id) => viewModel.rows.find((row) => row.id === id);
near(vm.resolve('peso_arroba').valueOf(linha(vm, 'v5')), 15, 'v5: Qtd @ = 450 ÷ 30');
near(vm15.resolve('peso_arroba').valueOf(linha(vm15, 'v5')), 30, 'v5: Qtd @ = 450 ÷ 15');
near(vm.resolve('quantidade_arrobas').valueOf(linha(vm, 'v5')), 15.6, 'v5: @ de carcaça gravada (outra coisa)');
// Valor Total de cada venda: digitado prevalece; senão @ viva × Valor @; sem os dois, sem valor.
near(vm.resolve('valor_venda_calc').valueOf(linha(vm, 'v5')), 6750, 'v5: valor digitado prevalece (a conta daria 4.500)');
near(vm.resolve('valor_venda_calc').valueOf(linha(vm, 'v6')), 3190, 'v6: 330 ÷ 30 × R$ 290');
near(vm15.resolve('valor_venda_calc').valueOf(linha(vm15, 'v6')), 6380, 'v6: 330 ÷ 15 × R$ 290');
near(vm.resolve('valor_venda_calc').valueOf(linha(vm, 'v12')), 6300, 'v12: digitado sem Valor @');
assert.equal(vm.resolve('valor_venda_calc').valueOf(linha(vm, 'v13')), null, 'v13: sem Valor @ nem valor digitado → sem valor (nunca 0)');
assert.equal(vm.resolve('valor_venda_total').valueOf(linha(vm, 'v6')) ?? null, null, 'v6: o valor digitado continua ausente no banco (a conta é só do relatório)');

// ---------------------------------------------------------------------------------------------------
// 5b. Tela: "Resumido", "Agrupar por" e "Níveis" tiram do tipo (Personalizado, contrato §3), mas a população de
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
const antes = await rodaTela({ ...telaVendas(), mode: 'RESUMIDO', view: null });
assert.ok(antes.rowCount > vm.rowCount && antes.rows.some((row) => row.tipo_manejo === 'Cadastro'), 'NEGATIVO (o defeito): sair do tipo sem a condição soma cadastros debaixo dos totais de Vendas');
const vendasTela = telaVendas();
const resumido = { ...vendasTela, ...screenModePatch(definition, vendasTela, 'RESUMIDO') };
assert.deepEqual(resumido, { ...vendasTela, mode: 'RESUMIDO', drill: [], ...leaveViewPatch(definition, vendasTela) }, 'aba Resumido = sair do tipo levando a população');
assert.equal(resumido.view, null, 'Resumido sai do tipo (Personalizado)');
assert.deepEqual(resumido.typePopulation, JSON.parse(JSON.stringify({ tipo_manejo: { operator: 'in', value: '', valueTo: '', values: ['Saída'], match: 'code' }, motivo_saida: { operator: 'in', value: '', valueTo: '', values: ['Venda'], match: 'code' } })), 'a população do tipo vai junto');
const vmResumido = await rodaTela(resumido);
assert.deepEqual([vmResumido.view, vmResumido.mode], [null, 'RESUMIDO']);
assert.deepEqual(idsOf(vmResumido), idsOf(vm), 'Resumido: as MESMAS vendas (nenhum cadastro/manejo)');
travado(vmResumido, 'Resumido');
assert.deepEqual(vmResumido.tree.map((node) => node.label), COMPRADORES, 'Resumido: por comprador, "Não informado" por último');
confere(vmResumido, 30);
assert.equal(buildReportDocument(vmResumido).layout, 'summary', 'Personalizado (fora do tipo): a folha comum do Resumido, não o relatório de venda');
const porMarcaTela = { ...vendasTela, groups: [{ columnId: 'marca' }], drill: [], ...leaveViewPatch(definition, vendasTela) };
const resumidoMarca = { ...resumido, groups: [{ columnId: 'marca' }], drill: [], ...leaveViewPatch(definition, resumido) };
assert.deepEqual(resumidoMarca.typePopulation, resumido.typePopulation, 'fora do tipo, a condição herdada continua');
for (const [estado, where] of [[porMarcaTela, 'Agrupar por Marca'], [resumidoMarca, 'Resumido › Agrupar por Marca']]) {
  const visto = await rodaTela(estado);
  assert.deepEqual(idsOf(visto), idsOf(vm), `${where}: as MESMAS vendas`);
  travado(visto, where);
  near(visto.totals.peso_total.value, 2750, `${where}: peso total só das vendas`);
  near(visto.totals.valor_total.value, 32290, `${where}: valor total só das vendas`);
}
const niveis = { ...vendasTela, groups: [{ columnId: 'comprador' }, { columnId: 'nome_lote' }], drill: [], ...leaveViewPatch(definition, vendasTela) };
assert.deepEqual(idsOf(await rodaTela(niveis)), idsOf(vm), 'Níveis: as MESMAS vendas');
assert.equal((await rodaTela({ ...resumido, uiFilters: { motivo_saida: { operator: 'in', values: ['Abate'], match: 'label' } } })).rowCount, 0, 'NEGATIVO: filtro "Abate" não traz abates — só esvazia');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, uiFilters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Manejo', 'Saída'], match: 'label' } } })), idsOf(vm), 'NEGATIVO: filtro com mais tipos não amplia');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, uiFilters: pesadoPessoa })), ['v12', 'v5', 'v7'], 'filtro da pessoa restringe');
const frigo = vmResumido.tree.find((node) => node.label === 'Frigo Sul');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, mode: 'DETALHADO', drill: [{ columnId: 'comprador', key: frigo.key }] })), ['e6', 'v8'], 'detalhe: só as vendas da Frigo Sul');
const analitico = { ...resumido, ...viewSelection('analitico', definition) };
assert.deepEqual(screenFixedFilters(analitico), {}, 'Analítico: sem a condição de Vendas');
const vmAnalitico = await rodaTela(analitico);
assert.ok(vmAnalitico.rowCount > vm.rowCount && !Object.keys(vmAnalitico.lockedFilters).length, 'Analítico: todas as pesagens do período, sem cadeado');
assert.equal(leaveViewPatch(definition, analitico).typePopulation, null, 'sair do Analítico não traz de volta a condição de Vendas');
assert.deepEqual(idsOf(await rodaTela({ ...resumido, ...viewSelection('vendas', definition) })), idsOf(vm), 'voltar a Vendas: a população do próprio tipo');
assert.deepEqual(Object.keys(screenFixedFilters({ ...resumido, fixedFilters: { sexo: { operator: 'in', values: ['M'] }, motivo_saida: { operator: 'in', values: ['Abate', 'Venda'] } } })).sort(), ['motivo_saida', 'sexo', 'tipo_manejo']);
assert.deepEqual(screenFixedFilters({ ...resumido, fixedFilters: { motivo_saida: { operator: 'in', values: ['Abate', 'Venda'] } } }).motivo_saida.values, ['Venda'], 'NEGATIVO: condição de modelo na mesma coluna não amplia');
const modeloResumido = await saveTemplate({ name: 'Totais por comprador', ...templatePayload(definition, resumido, 'ADMIN') }, ADMIN);
assert.deepEqual(Object.keys(modeloResumido.fixedFilters ?? {}).sort(), ['motivo_saida', 'tipo_manejo'], 'modelo: a condição vai como fixa');
const pedidoResumido = templateToRequest(modeloResumido, 'ADMIN');
const vmModeloResumido = await runReport('pesagens', { today: TODAY, params: pedidoResumido.params, selection: pedidoResumido.selection }, ADMIN);
assert.deepEqual(idsOf(vmModeloResumido), idsOf(vm), 'modelo reaberto: as MESMAS vendas');
travado(vmModeloResumido, 'modelo reaberto');
const ultimoResumido = viewStatePayload(definition, resumido, 'ADMIN');
assert.deepEqual(Object.keys(ultimoResumido.filters).sort(), ['motivo_saida', 'tipo_manejo'], 'último estado: a condição vai como filtro');
assert.ok(Object.values(ultimoResumido.filters).every((filter) => filter.match === 'code'));
assert.deepEqual(viewStatePayload(definition, analitico, 'ADMIN').filters, {}, 'último estado com tipo: sem a condição herdada');
await saveReportViewState('pesagens', ultimoResumido, ADMIN);
const reabertoResumido = await getReportViewState('pesagens', ADMIN);
assert.deepEqual([reabertoResumido.selection.view, reabertoResumido.selection.fixedFilters], [null, undefined]);
assert.deepEqual(idsOf(await runReport('pesagens', { today: TODAY, params: reabertoResumido.params, selection: reabertoResumido.selection }, ADMIN)), idsOf(vm), 'último estado reaberto: as MESMAS vendas (não amplia em silêncio)');

// ---------------------------------------------------------------------------------------------------
// 6. Folha = o relatório de venda do MAKGESTAO (layout "vendas"), conferida à mão
// ---------------------------------------------------------------------------------------------------
const HEADERS = ['Comprador', 'Data', 'Animal', 'Peso (kg)', 'Qtd @', 'Valor @', 'Valor Total'];
assert.equal(isVendasViewModel(vm), true, 'o view model do tipo vai para o layout de Vendas');
const doc = buildReportDocument(vm);
assert.equal(doc.layout, 'vendas', 'folha no layout "vendas"');
assert.equal(doc.title, 'Relatório de Pesagens Individuais (Sintético)', 'título comum da folha (como no PDF)');
assert.deepEqual([doc.sections.length, doc.flat, doc.grandTotal], [0, null, null], 'sem as seções da folha comum (os blocos estão em doc.vendas)');
assert.deepEqual(doc.columns.map((column) => column.label), HEADERS, 'colunas da tabela "Mostrar Detalhes": cabeçalhos do antigo');
const blocos = doc.vendas;
assert.equal(blocos.showDetails, false, '"Mostrar Detalhes" nasce desligado (como o antigo)');
const textosDe = (items) => items.map((item) => spaces(item.text));
const conta30 = esperado(30);
const linhaFolha = (conta) => [String(conta.animais_vendidos), folha(conta.peso_total, 2), folha(conta.peso_medio, 2), folha(conta.media_arroba, 2), folha(conta.media_valor_arroba, 2, true), folha(conta.valor_total, 2, true)];
assert.deepEqual(textosDe(blocos.resumo.rows), linhaFolha(conta30.geral), 'Métrica | Valor à mão');
assert.deepEqual(textosDe(blocos.resumo.rows), ['7', '2.750,00', '392,86', '13,10', 'R$ 298,29', 'R$ 32.290,00'], 'Métrica | Valor: os números');
assert.deepEqual(blocos.porMarca.rows.map((row) => row.label), MARCAS, 'TOTAIS POR MARCA: marcas em ordem, "Não informado" por último');
blocos.porMarca.rows.forEach((row, index) => assert.deepEqual(textosDe(row.cells), linhaFolha(conta30.marcas[index]), `TOTAIS POR MARCA ${row.label} à mão`));
assert.deepEqual(blocos.porMarca.rows.map((row) => [row.label, ...textosDe(row.cells)]), [
  ['ALFA', '2', '850,00', '425,00', '14,17', 'R$ 300,00', 'R$ 6.750,00'],
  ['BETA', '2', '610,00', '305,00', '10,17', 'R$ 294,59', 'R$ 6.190,00'],
  [NONE_GROUP_LABEL, '3', '1.290,00', '430,00', '14,33', 'R$ 300,00', 'R$ 19.350,00'],
], 'TOTAIS POR MARCA: os números (ALFA: v13 sem valor fica fora da soma e da média do Valor @)');
assert.deepEqual(blocos.porComprador.rows.map((row) => [row.label, ...textosDe(row.cells)]), conta30.compradores.map((grupo) => [grupo.chave, String(grupo.animais_vendidos), folha(grupo.peso_total, 2), folha(grupo.valor_total, 2, true)]), 'TOTAIS POR COMPRADOR à mão');
assert.deepEqual(textosDe(blocos.porComprador.rows[0].cells), ['2', '780,00', 'R$ 9.940,00'], 'Agropecuária: 6.750 digitado + 3.190 pela @');
assert.deepEqual(blocos.compradores.items.map((item) => item.title), COMPRADORES.map((comprador) => `COMPRADOR: ${comprador.toLocaleUpperCase('pt-BR')}`), 'um cartão por comprador, "Não informado" por último');
blocos.compradores.items.forEach((item, index) => {
  const grupo = conta30.compradores[index];
  assert.deepEqual(item.totals.map((total) => `${total.label}: ${spaces(total.display)}`), [
    `Total: ${grupo.animais_vendidos} ${grupo.animais_vendidos === 1 ? 'animal' : 'animais'}`, `Peso Médio: ${folha(grupo.peso_medio, 2)} kg`, `Peso Total: ${folha(grupo.peso_total, 2)} kg`,
    `Média (@): ${folha(grupo.media_arroba, 2)}`, `Valor Total: ${folha(grupo.valor_total, 2, true)}`,
  ], `cartão ${grupo.chave} à mão`);
  assert.equal(item.rows, null, `cartão ${grupo.chave}: sem "Mostrar Detalhes", sem vendas`);
});
assert.equal(spaces(blocos.totalGeral.text), 'TOTAL GERAL: 7 animais | Peso Total: 2.750,00 kg | Peso Médio: 392,86 kg | Média (@): 13,10 | Valor Total: R$ 32.290,00', 'TOTAL GERAL à mão');
// Média valor da arroba: ponderada pela Qtd @ (R$ 298,29), não a média simples do antigo (R$ 298,00).
assert.notEqual(spaces(blocos.resumo.rows[4].text), `R$ ${br(conta30.geral.media_simples_antigo, 2)}`, 'NEGATIVO: não é a média simples do antigo');
// Zeca Gado: v12 (digitado, sem Valor @) + v13 (sem nada) → valor 6.300 e Média valor da arroba "-".
near(blocos.compradores.items[2].totals.at(-1).value, 6300, 'Zeca Gado: só o que tem valor');
// ÷ 15: a @ viva e a conta do valor mudam; a média ponderada do preço não (o divisor cancela).
const doc15 = buildReportDocument(vm15);
assert.deepEqual(textosDe(doc15.vendas.resumo.rows), linhaFolha(esperado(15).geral), 'Métrica | Valor ÷ 15 à mão');
assert.deepEqual(textosDe(doc15.vendas.resumo.rows).slice(3), ['26,19', 'R$ 298,29', 'R$ 35.480,00'], '÷ 15: Média (@) 26,19 e valor R$ 35.480 (v6 = 330 ÷ 15 × 290)');
assert.ok(JSON.stringify(doc.footer).includes('@ = peso vivo ÷ 30'), 'rodapé explica a @ viva');
assert.ok(JSON.stringify(doc15.footer).includes('@ = peso vivo ÷ 15'), 'rodapé: divisor 15');
// "Mostrar Detalhes": a tabela de vendas de cada comprador abaixo do cartão (na ordem das linhas do view model).
const docDetalhes = buildReportDocument(vm, { showDetails: true });
assert.equal(docDetalhes.vendas.showDetails, true);
assert.deepEqual(docDetalhes.vendas.compradores.detailColumns.map((column) => column.label), HEADERS, 'tabela de detalhe com as colunas do tipo');
assert.deepEqual(docDetalhes.vendas.compradores.items.map((item) => item.rows.map((row) => row.id)), vm.tree.map((node) => node.rows.map((row) => row.id)), 'as vendas de cada comprador, na ordem do "Ordenar por"');
assert.equal(docDetalhes.vendas.compradores.items.reduce((soma, item) => soma + item.rows.length, 0), vm.rowCount, 'com detalhes: todas as vendas');
assert.equal(docDetalhes.stats.dataRows, vm.rowCount);
const detalheV6 = docDetalhes.vendas.compradores.items[0].rows.find((row) => row.id === 'v6');
assert.deepEqual(detalheV6.cells.map((cell) => spaces(cell.text)), ['Agropecuária Boa Vista', '07/09/2026', '606', '330', '11,00', 'R$ 290,00', 'R$ 3.190,00'], 'v6 no detalhe (peso sem casas, como o antigo)');
const detalheV13 = docDetalhes.vendas.compradores.items[2].rows.find((row) => row.id === 'v13');
assert.deepEqual(detalheV13.cells.slice(-2).map((cell) => cell.text), [VENDAS_MISSING, VENDAS_MISSING], 'v13: Valor @ e Valor Total "-"');
const htmlSem = renderSheetBody(doc, { mode: 'print' });
const htmlCom = renderSheetBody(docDetalhes, { mode: 'print' });
assert.ok(htmlSem.includes('data-layout="vendas"') && htmlSem.includes('class="sheet-vendas"'), 'folha desenha o miolo de Vendas');
assert.ok(!htmlSem.includes('sv-table--detail'), 'NEGATIVO: sem "Mostrar Detalhes", nenhuma tabela de vendas');
assert.equal((htmlCom.match(/sv-table--detail/g) ?? []).length, COMPRADORES.length, 'com "Mostrar Detalhes": uma tabela por comprador');
assert.ok(spaces(htmlSem).includes('<h1 class="sheet-title">Relatório de Pesagens Individuais (Sintético)</h1>'), 'cabeçalho e título comuns');
// Impressão/PDF: preparePrint repassa showDetails ao documento (printReport/exportPdf repassam as mesmas opções).
const impressoSem = preparePrint(vm, ADMIN);
const impressoCom = preparePrint(vm, ADMIN, { showDetails: true });
// A marcação da tabela (o CSS embutido também cita a classe).
const tabelaDetalhe = 'class="sv-table sv-table--detail"';
assert.ok(!impressoSem.html.includes(tabelaDetalhe) && impressoCom.html.includes(tabelaDetalhe), 'impressão/PDF: "Mostrar Detalhes" liga e desliga a tabela');
assert.deepEqual([impressoSem.manifest.showDetails, impressoCom.manifest.showDetails], [false, true], 'manifesto registra se saiu com detalhes');
// TOTAL GERAL nunca sozinho na última página (conferido no PDF do Electron): depois da tabela de detalhe, a última
// linha reserva o lugar dele; depois do cartão, break-before: avoid.
assert.match(SHEET_CSS, /\.sv-comprador:last-child \.sv-table--detail > tbody > tr:last-child > td::after \{ content: ""; display: block; height: 3\.5em; margin-bottom: -3\.5em; \}/, 'folha: a última venda desce junto com o TOTAL GERAL');
assert.match(SHEET_CSS, /\.sv-total-geral \{[^}]*break-before: avoid;/, 'folha: TOTAL GERAL colado no último cartão');
assert.equal(impressoSem.layout.orientation, 'portrait', 'retrato, como o PDF');
// Muitas colunas no seletor: só a tabela de detalhe precisa de largura — sem "Mostrar Detalhes" continua retrato.
const todasColunas = await vendas(ADMIN, { columns: [...view.columnChoices.available] });
assert.equal(buildReportDocument(todasColunas).print.orientation, 'portrait', 'sem detalhes: retrato, mesmo com todas as colunas escolhidas');
assert.equal(buildReportDocument(todasColunas, { showDetails: true }).print.orientation, 'landscape', 'com detalhes e todas as colunas: paisagem (a tabela não cabe no retrato)');
const servicoImpressao = readFileSync(new URL('../src/modules/reporting/application/reportPrintService.js', import.meta.url), 'utf8');
assert.match(servicoImpressao, /preparePrint\(viewModel, actor, \{ \.\.\.options, format: 'print' \}\)/, 'printReport repassa as opções (showDetails)');
assert.match(servicoImpressao, /preparePrint\(viewModel, actor, \{ \.\.\.options, format: 'pdf' \}\)/, 'exportPdf repassa as opções (showDetails)');
// Detalhe de um grupo (clique) e período sem vendas: a folha comum / "Nenhum registro".
const drill = await vendas(ADMIN, { mode: 'DETALHADO', drill: [{ columnId: 'comprador', key: frigo.key }] });
assert.deepEqual([isVendasViewModel(drill), buildReportDocument(drill).layout], [false, 'detail'], 'detalhe de um comprador (clique): o Detalhado comum');
const vazio = await vendas(ADMIN, {}, { params: { periodo: { preset: 'personalizado', from: '2020-01-01', to: '2020-01-02' } } });
const docVazio = buildReportDocument(vazio);
assert.deepEqual([docVazio.layout, docVazio.empty, docVazio.footer.arroba], ['vendas', true, null]);
assert.ok(renderSheetBody(docVazio, { mode: 'print' }).includes('Nenhum registro para os filtros informados.'), 'período sem vendas: "Nenhum registro"');

// ---------------------------------------------------------------------------------------------------
// 7. XLSX = os MESMOS blocos (sempre com as vendas), números como números — paridade folha × XLSX
// ---------------------------------------------------------------------------------------------------
const xlsx = await prepareEmission(vm, 'xlsx', ADMIN);
const sheetXml = unzipStored(xlsx.content)['xl/worksheets/sheet1.xml'];
for (const header of ['Qtd @', 'Valor @', 'Valor Total', 'Média valor da arroba', 'TOTAIS POR MARCA', 'TOTAIS POR COMPRADOR', 'VENDAS POR COMPRADOR (DETALHADO)', 'TOTAL GERAL']) assert.ok(sheetXml.includes(`>${header}<`), `XLSX: "${header}"`);
assert.ok(sheetXml.includes('<v>32290</v>') && sheetXml.includes('<v>298.29</v>'), 'XLSX: valor total e média do preço como número');
const { rows: planilha } = buildSheetRows(vm);
const valoresDe = (row) => row.cells.map((cell) => cell[0]);
const linhasTotais = planilha.filter((row) => row.kind === XLSX_VENDAS_KINDS.ROW || row.kind === XLSX_VENDAS_KINDS.TOTAL).map(valoresDe);
// Folha → números (o que está escrito no papel) na mesma ordem das linhas de total da planilha.
const daFolha = [
  ...blocos.resumo.rows.map((row) => [row.label, numberOf(row.text)]),
  ...blocos.porMarca.rows.map((row) => [row.label, ...row.cells.map((cell) => numberOf(cell.text))]),
  ...blocos.porComprador.rows.map((row) => [row.label, ...row.cells.map((cell) => numberOf(cell.text))]),
  ...blocos.compradores.items.map((item) => [`Total ${item.label}`, ...item.totals.map((total) => numberOf(total.text))]),
  ['TOTAL GERAL', ...blocos.totalGeral.items.map((total) => numberOf(total.text))],
];
assert.deepEqual(linhasTotais, daFolha, 'paridade folha × XLSX: cada total da folha é o mesmo número na planilha');
assert.ok(linhasTotais.flat().filter((value) => typeof value !== 'string' && value !== null).every((value) => typeof value === 'number'), 'XLSX: totais como números');
assert.deepEqual(valoresDe(planilha.find((row) => row.kind === XLSX_VENDAS_KINDS.TOTAL)), ['TOTAL GERAL', 7, 2750, 392.86, 13.1, 32290], 'XLSX: TOTAL GERAL em número');
const dadosPlanilha = planilha.filter((row) => row.kind === XLSX_VENDAS_KINDS.DATA);
assert.equal(dadosPlanilha.length, vm.rowCount, 'XLSX: sempre com as vendas (o "Mostrar Detalhes" é só da folha)');
assert.deepEqual(valoresDe(dadosPlanilha.find((row) => row.cells[2][0] === '606')), ['Agropecuária Boa Vista', '07/09/2026', '606', 330, 11, 290, 3190], 'XLSX: v6 com os números');
assert.deepEqual(valoresDe(dadosPlanilha.find((row) => row.cells[2][0] === '1313')).slice(-2), [null, null], 'XLSX: v13 sem valor (célula vazia, não 0)');
// Detalhe folha × XLSX: o mesmo número (a folha mostra o peso sem casas, como o antigo).
docDetalhes.vendas.compradores.items.flatMap((item) => item.rows).forEach((row, index) => {
  const xl = valoresDe(dadosPlanilha[index]);
  row.cells.forEach((cell, col) => {
    const naFolha = HEADERS[col] === 'Peso (kg)' ? roundTo(xl[col], 0) : xl[col];
    if (typeof xl[col] === 'number') assert.equal(numberOf(cell.text), naFolha, `detalhe ${row.id} · ${HEADERS[col]}: folha × XLSX`);
    else assert.equal(spaces(cell.text), xl[col] === null ? VENDAS_MISSING : xl[col], `detalhe ${row.id} · ${HEADERS[col]}: texto`);
  });
});

// ---------------------------------------------------------------------------------------------------
// 8. CSV e JSON continuam o Detalhado (uma linha por venda, subtotal por comprador, total geral)
// ---------------------------------------------------------------------------------------------------
assert.deepEqual(vm.columns.map((column) => column.id), [...VENDAS_COLUMNS]);
assert.deepEqual(vm.columns.map(headerLabel), HEADERS, 'grade: cabeçalhos do antigo ("Qtd @" sem "(@)" repetido)');
assert.equal(vm.availableColumns.find((column) => column.id === 'peso_arroba').label, 'Qtd @', 'seletor "Colunas"/filtros com o mesmo nome');
const semTipoArroba = await runReport('pesagens', { today: TODAY, params: period, selection: { view: null, columns: ['numero_animal', 'peso_arroba'] } }, ADMIN);
assert.equal(headerLabel(semTipoArroba.columns[1]), 'Peso em arrobas (@)', 'NEGATIVO: fora do tipo Vendas a coluna mantém o nome dela');
const csv = parseCsv((await prepareEmission(vm, 'csv', ADMIN)).content);
assert.deepEqual(csv[0], ['tipo_linha', 'nivel', 'grupo', 'metrica', 'valor', ...HEADERS], 'CSV: cabeçalho (Detalhado)');
assert.deepEqual(csv.filter((row) => row[0] === 'GROUP').map((row) => row[2]), COMPRADORES.map((comprador) => `Comprador: ${comprador}`), 'CSV: grupos na ordem');
assert.equal(csv.filter((row) => row[0] === 'DATA').length, 7);
assert.deepEqual(csv.find((row) => row[0] === 'DATA' && row[7] === '606').slice(5), ['Agropecuária Boa Vista', '07/09/2026', '606', '330,00', '11,00', '290,00', '3190,00'], 'CSV: v6 com Qtd @ viva e Valor Total pela @');
assert.equal(csv.find((row) => row[0] === 'DATA' && row[7] === '1313')[11], '', 'CSV: v13 sem valor (vazio)');
const csvTotais = (conta) => [String(conta.animais_vendidos), br(conta.peso_total, 1), br(conta.peso_medio, 1), br(conta.media_arroba, 2), conta.media_valor_arroba === null ? '' : br(conta.media_valor_arroba, 2), conta.valor_total === null ? '' : br(conta.valor_total, 2)];
conta30.compradores.forEach((grupo) => {
  const linhas = csv.filter((row) => row[0] === 'SUBTOTAL' && row[2] === grupo.chave);
  assert.deepEqual(linhas.map((row) => row[3]), TOTAL_LABELS, `CSV: rótulos do subtotal ${grupo.chave}`);
  assert.deepEqual(linhas.map((row) => row[4]), csvTotais(grupo), `CSV: subtotal ${grupo.chave} à mão`);
});
const csvGeral = csv.filter((row) => row[0] === 'GRAND_TOTAL');
assert.deepEqual(csvGeral.map((row) => row[3]), TOTAL_LABELS, 'CSV: rótulos do total geral');
assert.deepEqual(csvGeral.map((row) => row[4]), ['7', '2750,0', '392,9', '13,10', '298,29', '32290,00'], 'CSV: total geral à mão');
assert.ok(csv.every((row) => !/ de \d/.test(row[4] ?? '')), 'CSV: valor sem "(n de m)"');
const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
assert.deepEqual(json.columns.map((column) => column.label), ['Comprador', 'Data', 'Animal', 'Peso', 'Qtd @', 'Valor @', 'Valor Total'], 'JSON: rótulos do tipo');
assert.deepEqual(json.manifest.columns.map((column) => column.label), json.columns.map((column) => column.label), 'manifesto com os mesmos rótulos');
near(json.totals.valor_total.value, 32290, 'JSON: valor total');
assert.deepEqual(Object.keys(json.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], 'JSON: condição fixa do tipo');
assert.equal(documentRows(buildReportDocument({ ...vm, view: null })).filter((row) => row.type === 'DATA').length, vm.rowCount, 'a mesma população na folha comum (fora do tipo)');

// ---------------------------------------------------------------------------------------------------
// 9. Permissão comercial (matriz real): quem não tem commercial.values não vê valor nenhum, sem erro
// ---------------------------------------------------------------------------------------------------
const comValores = [ADMIN, GESTOR];
const semValores = [OPERADOR, CONSULTA];
for (const actor of comValores) assert.equal(can(actor.role, 'commercial.values'), true, `${actor.role} vê valores`);
for (const actor of semValores) assert.equal(can(actor.role, 'commercial.values'), false, `${actor.role} não vê valores`);
for (const actor of comValores) {
  const visto = await vendas(actor);
  assert.deepEqual(visto.columns.map((column) => column.id), [...VENDAS_COLUMNS], `${actor.role}: com Valor @ e Valor Total`);
  near(visto.totals.valor_total.value, 32290, `${actor.role}: total de valor`);
  assert.equal(visto.hiddenByPermission.length, 0);
  assert.equal(buildReportDocument(visto).vendas.hasValues, true, `${actor.role}: folha com valores`);
}
const SEM_VALOR = ['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba'];
const VALOR_IDS = ['media_valor_arroba', 'valor_total'];
const semValorAlgum = (viewModel, where) => {
  assert.deepEqual(viewModel.columns.map((column) => column.id), SEM_VALOR, `${where}: sem colunas de valor (Qtd @ fica — não é valor comercial)`);
  assert.ok(!viewModel.aggregates.some((spec) => VALOR_IDS.includes(spec.id)), `${where}: sem total de valor`);
  assert.ok(VALOR_IDS.every((id) => !(id in viewModel.totals)), `${where}: total geral sem valor`);
  assert.ok(viewModel.tree.every((node) => VALOR_IDS.every((id) => !(id in node.aggregates))), `${where}: subtotal sem valor`);
  assert.ok(viewModel.warnings.some((warning) => warning.code === 'COLUMNS_HIDDEN_BY_PERMISSION' && warning.columns.includes('valor_venda_calc') && warning.columns.includes('valor_arroba')), `${where}: aviso de colunas ocultas pelo perfil`);
  assert.deepEqual(idsOf(viewModel), esperado(30).geral.ids, `${where}: mesma população`);
  const papel = buildReportDocument(viewModel, { showDetails: true });
  const v = papel.vendas;
  assert.equal(v.hasValues, false, `${where}: blocos sem valores`);
  assert.deepEqual(v.resumo.rows.map((row) => row.label), ['Animais vendidos', 'Peso total (kg)', 'Peso médio (kg)', 'Média (@)'], `${where}: Métrica | Valor sem Média valor da arroba e Valor total`);
  assert.deepEqual(textosDe(v.resumo.rows), ['7', '2.750,00', '392,86', '13,10'], `${where}: os outros números continuam`);
  assert.deepEqual(v.porMarca.columns.map((column) => column.label), ['Marca', 'Qtd', 'Peso Total (kg)', 'Peso Médio (kg)', 'Média (@)'], `${where}: TOTAIS POR MARCA sem Média Valor @ e Valor Total`);
  assert.deepEqual(v.porComprador.columns.map((column) => column.label), ['Comprador', 'Qtd', 'Peso Total (kg)'], `${where}: TOTAIS POR COMPRADOR sem Valor Total`);
  assert.ok(v.compradores.items.every((item) => item.totals.map((total) => total.label).join('|') === 'Total|Peso Médio|Peso Total|Média (@)'), `${where}: cartão sem Valor Total`);
  assert.ok(!v.totalGeral.text.includes('Valor'), `${where}: TOTAL GERAL sem valor`);
  assert.deepEqual(v.compradores.detailColumns.map((column) => column.label), HEADERS.slice(0, 5), `${where}: detalhe sem Valor @ e Valor Total`);
  const texto = JSON.stringify(v);
  for (const proibido of ['R$', 'Valor Total', 'Valor total', 'Média valor', 'Média Valor', '32.290', '298,29']) assert.ok(!texto.includes(proibido), `${where}: folha sem "${proibido}"`);
  assert.match(papel.footer.omitidas ?? '', /2 coluna\(s\) omitida\(s\) pelo perfil/, `${where}: rodapé avisa as colunas omitidas`);
};
for (const actor of semValores) {
  assert.equal(await code(() => vendas(actor)), 'OK', `${actor.role}: Vendas abre sem erro`);
  semValorAlgum(await vendas(actor), actor.role);
  const tentativa = await vendas(actor, { filters: { valor_venda_calc: { operator: 'greater', value: '6000' } }, sort: [{ columnId: 'valor_venda_calc', direction: 'desc' }] });
  assert.equal(tentativa.rowCount, 7, `${actor.role}: filtro em valor removido`);
  assert.ok(tentativa.warnings.some((warning) => warning.code === 'FILTER_REMOVED_BY_PERMISSION'));
  assert.ok(!tentativa.sort.some((item) => item.columnId === 'valor_venda_calc'), `${actor.role}: ordenação por valor removida`);
  const explicita = await vendas(actor, { columns: SEM_VALOR });
  assert.ok(explicita.hiddenByPermission.includes('valor_venda_calc'), `${actor.role}: aviso vem do tipo, não só do pedido`);
}
// Exportações de quem não vê valor: CONSULTA exporta sem valores; OPERADOR não exporta (regra de hoje).
const consulta = await vendas(CONSULTA);
const semDinheiro = (text, where, valores) => {
  for (const proibido of ['R$', 'Valor @', 'Valor Total', 'Valor total', 'Média valor da arroba', 'Média Valor @', ...valores]) assert.ok(!text.includes(proibido), `${where}: sem "${proibido}"`);
};
semDinheiro((await prepareEmission(consulta, 'csv', CONSULTA)).content, 'CONSULTA CSV', ['6750,00', '32290,00', '3190,00', '290,00', '298,29']);
semDinheiro(unzipStored((await prepareEmission(consulta, 'xlsx', CONSULTA)).content)['xl/worksheets/sheet1.xml'], 'CONSULTA XLSX', ['<v>6750</v>', '<v>32290</v>', '<v>3190</v>', '<v>290</v>', '<v>298.29</v>']);
const jsonConsulta = JSON.parse((await prepareEmission(consulta, 'json', CONSULTA)).content);
assert.ok(!jsonConsulta.columns.some((column) => column.id.startsWith('valor_')) && !jsonConsulta.aggregates.some((spec) => VALOR_IDS.includes(spec.id)) && VALOR_IDS.every((id) => !(id in jsonConsulta.totals)), 'CONSULTA JSON: sem coluna/total de valor');
assert.ok(jsonConsulta.data.every((row) => !('valor_venda_calc' in row) && !('valor_venda_total' in row) && !('valor_arroba' in row)), 'CONSULTA JSON: linhas sem valor');
assert.deepEqual(jsonConsulta.manifest.hiddenByPermission, ['valor_arroba', 'valor_venda_calc'], 'CONSULTA JSON: manifesto registra o que o perfil ocultou');
for (const proibido of ['6750', '32290', '3190', '5850']) assert.ok(!JSON.stringify({ ...jsonConsulta, manifest: null }).includes(proibido), `CONSULTA JSON: sem ${proibido}`);
for (const showDetails of [false, true]) semDinheiro(preparePrint(consulta, CONSULTA, { showDetails }).html, `CONSULTA impressão/PDF${showDetails ? ' com detalhes' : ''}`, ['6.750,00', '32.290,00', '3.190,00']);
const operador = await vendas(OPERADOR);
assert.equal(await code(() => prepareEmission(operador, 'csv', OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não exporta (regra de hoje)');
assert.equal(await code(() => preparePrint(operador, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não imprime (regra de hoje)');
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
semValorAlgum(await runReport(pedido.reportId, { today: TODAY, params: pedido.params, selection: pedido.selection }, CONSULTA), 'modelo do ADMIN aberto por CONSULTA');
const abertoAdmin = templateToRequest(modelo, 'ADMIN');
near((await runReport(abertoAdmin.reportId, { today: TODAY, params: abertoAdmin.params, selection: abertoAdmin.selection }, ADMIN)).totals.valor_total.value, 32290, 'o mesmo modelo com valores para o ADMIN');
// Modelo com OUTROS totais (antigo, ou mexido): o relatório de venda continua com os totais dos blocos.
const vmTotaisAntigos = await vendas(ADMIN, { aggregates: [{ id: 'valor_total', columnId: 'valor_venda_total', op: 'sum' }] });
assert.deepEqual(textosDe(buildReportDocument(vmTotaisAntigos).vendas.resumo.rows), textosDe(blocos.resumo.rows), 'NEGATIVO: totais do modelo não mudam os blocos (o valor segue a regra do relatório de venda)');

// Tela: modelo e último estado de quem não vê valor são gravados sem as colunas/totais de valor.
assert.equal(await code(() => saveTemplate({ baseReportId: 'pesagens', name: 'Minhas vendas', view: 'vendas', columns: tipo.columns, groups: tipo.groups, aggregates: tipo.aggregates, mode: tipo.mode }, CONSULTA)), 'AUTH_FORBIDDEN', 'NEGATIVO: o serviço recusa modelo com coluna que o autor não vê');
const limpo = withoutHiddenColumns(definition, 'CONSULTA', tipo);
assert.deepEqual(limpo.columns, SEM_VALOR);
assert.ok(!limpo.aggregates.some((spec) => ['valor_venda_calc', 'valor_arroba_venda'].includes(spec.columnId)));
assert.deepEqual(withoutHiddenColumns(definition, 'ADMIN', tipo).columns, [...VENDAS_COLUMNS], 'quem vê valores não perde nada');
const semValorGravado = (payload, where) => {
  assert.deepEqual(payload.columns, SEM_VALOR, `${where}: sem Valor @ e Valor Total`);
  assert.deepEqual(payload.aggregates.map((spec) => spec.id), VENDAS_TOTALS.map((spec) => spec.id).filter((id) => !VALOR_IDS.includes(id)), `${where}: os outros totais ficam`);
};
for (const [nome, montar] of [['modelo', templatePayload], ['último estado', viewStatePayload]]) {
  for (const role of ['CONSULTA', 'OPERADOR']) semValorGravado(montar(definition, telaVendas(), role), `tela (${nome}) de ${role}`);
  for (const role of ['ADMIN', 'GESTOR']) {
    const gravado = montar(definition, telaVendas(), role);
    assert.deepEqual(gravado.columns, [...VENDAS_COLUMNS], `tela (${nome}) de ${role}: com as colunas de valor`);
    assert.ok(VALOR_IDS.every((id) => gravado.aggregates.some((spec) => spec.id === id)), `tela (${nome}) de ${role}: com os totais de valor`);
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
assert.ok(estado, 'último estado da CONSULTA gravado');
assert.equal(estado.selection.view, 'vendas', 'último estado da CONSULTA reabre em Vendas');
semValorAlgum(await runReport('pesagens', { today: TODAY, params: estado.params, selection: estado.selection }, CONSULTA), 'último estado da CONSULTA');
const tela = readFileSync(new URL('../src/components/reports/ReportView.jsx', import.meta.url), 'utf8');
assert.match(tela, /saveTemplate\(\{ id, name, scope, \.\.\.templatePayload\(definition, state, actor\.role\) \}, actor\)/, 'tela: "Salvar modelo" grava o templatePayload');
assert.match(tela, /const payload = viewStatePayload\(definition, state, actor\.role\);/, 'tela: último estado grava o viewStatePayload');
assert.ok(!/columns: state\.columns, filters: state\.uiFilters/.test(tela), 'NEGATIVO: a tela não monta outro payload com as colunas cruas');
assert.match(tela, /const setGroups = \(groups\) => update\(\{ groups, drill: \[\], \.\.\.leaveViewPatch\(definition, state\) \}\);/, 'tela: Agrupar por/Níveis levam a condição do tipo');
assert.match(tela, /const setMode = \(mode\) => update\(screenModePatch\(definition, state, mode\)\);/, 'tela: Resumido/Detalhado levam a condição do tipo (screenModePatch)');
assert.match(tela, /fixedFilters: screenFixedFilters\(state\)/, 'tela: o execute manda a condição herdada');
assert.ok(!/view: null, matrix: null/.test(tela), 'NEGATIVO: a tela não sai do tipo largando a condição');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:vendas-por-comprador:verify',
  ok: true,
  vendas: vm.rowCount,
  pdf: 'Métrica | Valor, TOTAIS POR MARCA/COMPRADOR, cartão e TOTAL GERAL iguais ao PDF (90 animais, 40.968 kg, R$ 523.024,80)',
  compradores: blocos.porComprador.rows.map((row) => `${row.label} (${row.cells[0].text})`),
  totalGeral: spaces(blocos.totalGeral.text),
  mediaValorArroba: { ponderada: spaces(blocos.resumo.rows[4].text), simplesDoAntigo: `R$ ${br(conta30.geral.media_simples_antigo, 2)}` },
  xlsx: `${planilha.length} linhas, ${dadosPlanilha.length} vendas`,
  csvJson: 'Detalhado (uma linha por venda, subtotal por comprador, total geral)',
}, null, 2));
