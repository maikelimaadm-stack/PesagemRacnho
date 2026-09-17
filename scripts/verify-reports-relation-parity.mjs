// Gate reports:relation-parity:verify (R1).
// O mesmo critério aplicado à Relação de Pesagens (tela) e ao relatório "Pesagens por período"
// produz a MESMA população, na MESMA ordem, com as MESMAS células formatadas. A Relação filtra o
// período pela coluna Data (between); o relatório pelo índice data_pesagem.
// Negativos: um critério diferente (ou um filtro a mais) quebra a igualdade e é detectado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { loadEventRows } from '../src/modules/reporting/infrastructure/reportSources/eventSource.js';
import { relationPopulation, resolveEventColumn } from '../src/modules/reporting/application/relationPopulation.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { RELATION_COLUMN_IDS } from '../src/modules/reporting/definitions/columns/eventColumns.js';

await seedReportFixture();
const relationRows = (await loadEventRows({ empresaId: 'local' })).rows;

const cell = (row, id) => {
  const accessor = resolveEventColumn(id);
  return formatCell(accessor.column, accessor.column.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row), 'screen');
};

const CASES = [
  { name: 'período sem filtro', from: '2026-08-01', to: '2026-09-15', filters: {}, sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'período parcial', from: '2026-08-15', to: '2026-09-05', filters: {}, sort: { key: 'numero_animal', direction: 'desc' } },
  { name: 'tipo em lista', from: '2026-08-01', to: '2026-09-15', filters: { tipo_manejo: { operator: 'in', values: ['Manejo', 'Saída'] } }, sort: { key: 'peso', direction: 'asc' } },
  { name: 'tipo fora da lista (not_in)', from: '2026-08-01', to: '2026-09-15', filters: { tipo_manejo: { operator: 'not_in', values: ['Cadastro'] } }, sort: { key: 'data_pesagem', direction: 'desc' } },
  { name: 'marca sem acento casa "Álfa"', from: '2026-08-01', to: '2026-09-15', filters: { marca: { operator: 'equals', value: 'alfa' } }, sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'peso entre com vírgula', from: '2026-08-01', to: '2026-09-15', filters: { peso: { operator: 'between', value: '255,5', valueTo: '345' } }, sort: { key: 'peso', direction: 'desc' } },
  { name: 'peso vazio', from: '2026-08-01', to: '2026-09-15', filters: { peso: { operator: 'empty' } }, sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'sexo + lote', from: '2026-08-01', to: '2026-09-15', filters: { sexo: { operator: 'in', values: ['M'] }, nome_lote: { operator: 'contains', value: 'lote 01' } }, sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'pesquisa rápida', from: '2026-08-01', to: '2026-09-15', filters: {}, search: 'engorda', sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'gmd maior que', from: '2026-08-01', to: '2026-09-15', filters: { gmd: { operator: 'greater', value: '0,8' } }, sort: { key: 'gmd', direction: 'asc' } },
  { name: 'motivo contém (pílula de texto em enum)', from: '2026-08-01', to: '2026-09-15', filters: { motivo_saida: { operator: 'contains', value: 'mor' } }, sort: { key: 'data_pesagem', direction: 'asc' } },
  { name: 'observação não vazia', from: '2026-08-01', to: '2026-09-15', filters: { observacao: { operator: 'not_empty' } }, sort: { key: 'data_pesagem', direction: 'asc' } },
];

const results = [];
for (const testCase of CASES) {
  const relation = relationPopulation(relationRows, {
    searchTerm: testCase.search ?? '',
    filtrosColuna: { data_pesagem: { operator: 'between', value: testCase.from, valueTo: testCase.to }, ...testCase.filters },
    sortConfig: testCase.sort,
  });
  const report = await runReport('pesagens.periodo', {
    today: TODAY,
    params: { periodo: { preset: 'personalizado', from: testCase.from, to: testCase.to } },
    selection: { filters: testCase.filters, search: testCase.search ?? '', sort: [{ columnId: testCase.sort.key, direction: testCase.sort.direction }], columns: [...RELATION_COLUMN_IDS] },
  }, ADMIN);
  assert.deepEqual(report.rows.map((row) => row.id), relation.map((row) => row.id), `${testCase.name}: mesma população e ordem`);
  for (let index = 0; index < relation.length; index += 1) {
    for (const id of RELATION_COLUMN_IDS) {
      assert.equal(cell(report.rows[index], id), cell(relation[index], id), `${testCase.name}: célula ${id} da linha ${relation[index].id}`);
    }
  }
  results.push({ case: testCase.name, rows: relation.length, strategy: report.stats.strategy });
}

// Casos com resultado conhecido (a paridade não pode ser "vazio = vazio" por engano).
const byName = Object.fromEntries(results.map((item) => [item.case, item.rows]));
assert.equal(byName['período sem filtro'], 9);
assert.equal(byName['marca sem acento casa "Álfa"'], 6, 'ALFA (5 eventos) + Álfa (1)');
assert.equal(byName['peso vazio'], 1, 'só a Saída por Morte');
assert.equal(byName['tipo fora da lista (not_in)'], 5, 'not_in respeitado (antes a lista virava "está em")');
assert.equal(byName['motivo contém (pílula de texto em enum)'], 1);
assert.ok(results.every((item) => item.strategy === 'index:data_pesagem'), 'relatório sempre pelo índice');

// Negativo: critério diferente quebra a paridade.
const relationWrong = relationPopulation(relationRows, { filtrosColuna: { data_pesagem: { operator: 'between', value: '2026-08-01', valueTo: '2026-09-15' }, sexo: { operator: 'in', values: ['F'] } }, sortConfig: { key: 'data_pesagem', direction: 'asc' } });
const reportAll = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, selection: { sort: [{ columnId: 'data_pesagem', direction: 'asc' }] } }, ADMIN);
assert.notDeepEqual(reportAll.rows.map((row) => row.id), relationWrong.map((row) => row.id), 'NEGATIVO: critérios diferentes são detectados');

// Permissão não altera população: CONSULTA vê as mesmas linhas, sem as colunas de valor.
const consulta = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, selection: { columns: [...RELATION_COLUMN_IDS], sort: [{ columnId: 'data_pesagem', direction: 'asc' }] } }, CONSULTA);
assert.deepEqual(consulta.rows.map((row) => row.id), reportAll.rows.map((row) => row.id));
assert.ok(!consulta.columns.some((column) => column.sensitive === 'commercial'), 'CONSULTA sem colunas comerciais');
assert.deepEqual(consulta.hiddenByPermission.sort(), ['quantidade_arrobas', 'valor_arroba', 'valor_pago_cabeca', 'valor_venda_total']);

// A tela usa exatamente estas funções.
const page = readFileSync(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
assert.match(page, /return relationPopulation\(pesagens, \{ searchTerm, filtrosColuna, sortConfig \}\)/, 'Relação calcula a população pelo núcleo compartilhado');
assert.match(page, /\(await loadEventRows\(\{ empresaId: empresaSelecionadaId \}\)\)\.rows/, 'Relação carrega as mesmas event rows');
assert.match(page, /formatCell\(accessor\.column/, 'Relação formata células pela definição compartilhada');
assert.doesNotMatch(page, /matchesMakColumnFilter\(/, 'NEGATIVO: sem predicado paralelo na tela');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:relation-parity:verify', ok: true, cases: results }, null, 2));
