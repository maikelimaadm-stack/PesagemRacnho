// Gate reports:filters:verify (R1) — contrato do filterEngine compartilhado.
import assert from 'node:assert/strict';
import {
  FILTER_OPERATORS, applyFilters, isFilterActive, matchesAccessor, matchesFilter, normalizeFilter, normalizeText, serializeFilters,
} from '../src/modules/reporting/domain/filterEngine.js';
import { readFileSync } from 'node:fs';

const m = (raw, filter, type) => matchesFilter(raw, filter, type);
let checks = 0;
const yes = (raw, filter, type, msg) => { assert.equal(m(raw, filter, type), true, msg); checks += 1; };
const no = (raw, filter, type, msg) => { assert.equal(m(raw, filter, type), false, msg); checks += 1; };

// Ativo / inativo
assert.equal(isFilterActive(null), false);
assert.equal(isFilterActive({ operator: 'contains', value: '  ' }), false);
assert.equal(isFilterActive({ operator: 'empty' }), true);
assert.equal(isFilterActive({ operator: 'in', values: ['a'] }), true);
assert.equal(isFilterActive({ operator: 'equals', value: false }), true, 'booleano false é filtro ativo');
yes('qualquer', { operator: 'contains', value: '' }, 'text', 'filtro inativo não restringe');

// Texto: sem acento e sem caixa
yes('Álfa', { operator: 'equals', value: 'alfa' }, 'text', 'igualdade sem acento');
yes('ENGORDA Norte', { operator: 'contains', value: 'engorda' }, 'text');
no('ENGORDA Norte', { operator: 'not_contains', value: 'nórte' }, 'text', 'não contém sem acento');
yes('Nelore', { operator: 'starts_with', value: 'nel' }, 'text');
yes('Nelore', { operator: 'ends_with', value: 'ORE' }, 'text');
yes('Nelore', { operator: 'not_equals', value: 'angus' }, 'text');
yes('', { operator: 'empty' }, 'text');
yes(null, { operator: 'empty' }, 'text');
no(0, { operator: 'empty' }, 'number', 'zero não é vazio');
yes('  x ', { operator: 'not_empty' }, 'text');
assert.equal(normalizeText('  Fêmea   Àção '), 'femea acao');

// Listas respeitam o operador (antes "É diferente de" com caixas marcadas virava "está em")
yes('Manejo', { operator: 'in', values: ['Manejo', 'Saída'] }, 'text');
no('Cadastro', { operator: 'in', values: ['Manejo', 'Saída'] }, 'text');
yes('Cadastro', { operator: 'not_in', values: ['Manejo', 'Saída'] }, 'text');
no('Manejo', { operator: 'not_equals', values: ['Manejo'] }, 'text', 'not_equals com lista = fora da lista');
yes('Manejo', { operator: 'contains', values: ['Manejo'] }, 'text', 'operador positivo + lista = na lista (compatível)');
yes('saída', { operator: 'in', values: ['Saida'] }, 'text', 'lista de texto sem acento');
no(null, { operator: 'in', values: ['x'] }, 'text', 'vazio não está na lista');
yes(null, { operator: 'not_in', values: ['x'] }, 'text', 'vazio está fora da lista');

// Número: vírgula decimal em todos os operadores
yes(255.5, { operator: 'equals', value: '255,5' }, 'number');
yes(206.5, { operator: 'contains', value: '206,5' }, 'number', 'contém com vírgula (antes falhava)');
yes('1.234,5', { operator: 'greater', value: '1000' }, 'number', 'milhar com ponto');
yes(10, { operator: 'between', value: '20', valueTo: '5' }, 'number', 'limites invertidos');
yes(20, { operator: 'between', value: '5', valueTo: '20' }, 'number', 'between inclusivo');
yes(21, { operator: 'not_between', value: '5', valueTo: '20' }, 'number');
no(null, { operator: 'not_between', value: '5', valueTo: '20' }, 'number', 'ausente não entra em comparação numérica');
no(null, { operator: 'less', value: '5' }, 'number', 'ausente ≠ 0');
yes(3, { operator: 'less_equal', value: '3' }, 'number');
yes(3, { operator: 'greater_equal', value: '3,0' }, 'number');
no(10, { operator: 'between', value: '5' }, 'number', 'between sem limite superior não casa');
yes(0.75, { operator: 'in', values: ['0,75', '1'] }, 'number', 'lista numérica normalizada');
yes(2, { operator: 'not_equals', value: '3' }, 'number');

// Data civil
yes('2026-09-05', { operator: 'between', value: '2026-09-05', valueTo: '2026-09-01' }, 'date', 'between inclusivo e limites invertidos');
no('2026-09-06', { operator: 'between', value: '2026-09-01', valueTo: '2026-09-05' }, 'date');
yes('2026-09-06', { operator: 'not_between', value: '2026-09-01', valueTo: '2026-09-05' }, 'date');
yes('2026-09-05', { operator: 'before', value: '2026-09-06' }, 'date');
no('2026-09-06', { operator: 'before', value: '2026-09-06' }, 'date', 'antes é estrito');
yes('2026-09-06', { operator: 'on_or_before', value: '2026-09-06' }, 'date');
yes('2026-09-06', { operator: 'on_or_after', value: '06/09/2026' }, 'date', 'aceita data BR no valor');
yes('2026-09-06T23:59:59', { operator: 'equals', value: '2026-09-06' }, 'date', 'sem fuso: compara a data civil');
yes('2026-09-06', { operator: 'contains', value: '2026-09' }, 'date', 'contém mês');

// Enum, entidade (por id), booleano
yes('M', { operator: 'in', values: ['M'] }, 'enum');
no('F', { operator: 'equals', value: 'M' }, 'enum');
yes('m-alfa', { operator: 'in', values: ['m-alfa'] }, 'entity', 'entidade compara o id');
no('m-alfa', { operator: 'in', values: ['ALFA'] }, 'entity', 'NEGATIVO: entidade não casa pelo nome');
yes('m-beta', { operator: 'not_in', values: ['m-alfa'] }, 'entity');
yes(true, { operator: 'equals', value: true }, 'boolean');
yes(false, { operator: 'equals', value: 'não' }, 'boolean');
no(null, { operator: 'equals', value: false }, 'boolean', 'ausente não é falso');
assert.throws(() => m('x', { operator: 'equals', value: 'x' }, 'moeda'), /tipo desconhecido/, 'tipo de filtro inválido');

// Enum com pílula de texto: contém casa código ou rótulo
const sexo = { filterType: 'enum', filterValueOf: (row) => row.sexo, displayOf: (row) => (row.sexo === 'M' ? 'Macho' : 'Fêmea') };
assert.equal(matchesAccessor({ sexo: 'F' }, { operator: 'contains', value: 'fêm' }, sexo), true);
assert.equal(matchesAccessor({ sexo: 'M' }, { operator: 'not_contains', value: 'fem' }, sexo), true);
assert.equal(matchesAccessor({ sexo: 'M' }, { operator: 'in', values: ['F'] }, sexo), false);

// applyFilters: AND entre colunas + pesquisa sem acento
const resolve = (id) => ({ filterType: id === 'peso' ? 'number' : 'text', filterValueOf: (row) => row[id], displayOf: (row) => row[id] });
const rows = [{ id: 1, marca: 'Álfa', peso: 300 }, { id: 2, marca: 'ALFA', peso: 250 }, { id: 3, marca: 'Beta', peso: 300 }];
assert.deepEqual(applyFilters(rows, { filters: { marca: { operator: 'equals', value: 'alfa' }, peso: { operator: 'greater', value: '260' } } }, resolve).map((row) => row.id), [1]);
assert.deepEqual(applyFilters(rows, { search: 'ALFÁ', searchColumnIds: ['marca'] }, resolve).map((row) => row.id), [1, 2]);
assert.throws(() => applyFilters(rows, { filters: { inexistente: { operator: 'contains', value: 'x' } } }, () => null), /coluna desconhecida/);

// Serialização estável (modelos salvos) e string pura legada
assert.deepEqual(serializeFilters({ a: { operator: 'contains', value: '' }, b: 'texto', c: { operator: 'in', values: [1, null] } }), {
  b: { operator: null, value: 'texto', valueTo: '', values: [] },
  c: { operator: 'in', value: '', valueTo: '', values: ['1', ''] },
});
assert.deepEqual(normalizeFilter('300', 'number'), { operator: 'between', value: '300', valueTo: '', values: [] });
assert.ok(FILTER_OPERATORS.entity.includes('not_in') && FILTER_OPERATORS.boolean.includes('equals'));

// Fachada da tela = motor compartilhado (inspeção: JSX não roda em Node)
const menu = readFileSync(new URL('../src/components/mak/MakColumnMenu.jsx', import.meta.url), 'utf8');
assert.match(menu, /return matchesFilter\(rawValue, filter, filterType\);/, 'MakColumnMenu delega ao filterEngine');
assert.match(menu, /return isFilterActive\(filter\);/);

// Descrição legível (pílula fixa, impressão, XLSX): operador traduzido e código de enum → rótulo.
{
  const { describeFilter, applyFilters: apply } = await import('../src/modules/reporting/domain/filterEngine.js');
  const sexo = { options: [{ value: 'M', label: 'Macho' }, { value: 'F', label: 'Fêmea' }] };
  assert.equal(describeFilter({ operator: 'in', values: ['M'] }, sexo), 'em Macho');
  assert.equal(describeFilter({ operator: 'less', value: '0' }), '< 0');
  assert.equal(describeFilter({ operator: 'between', value: '1', valueTo: '5' }), 'entre 1 e 5');
  assert.equal(describeFilter({ operator: 'not_empty' }), 'preenchido');
  assert.equal(describeFilter({ operator: 'in', values: ['Fêmea'], match: 'label' }, sexo), 'em Fêmea');
  // match "label": compara o rótulo exibido; sem ele, o id (contrato original).
  const accessor = { filterType: 'entity', filterValueOf: (row) => row.id, valueOf: (row) => row.id, displayOf: (row) => row.nome };
  const rows = [{ id: 'l1', nome: 'Lote Água' }, { id: 'l2', nome: 'Lote Seco' }, { id: 'l3', nome: null }];
  const resolve = () => accessor;
  assert.deepEqual(apply(rows, { filters: { lote: { operator: 'in', values: ['lote agua'], match: 'label' } } }, resolve).map((r) => r.id), ['l1']);
  assert.deepEqual(apply(rows, { filters: { lote: { operator: 'not_in', values: ['Lote Água'], match: 'label' } } }, resolve).map((r) => r.id), ['l2', 'l3']);
  assert.deepEqual(apply(rows, { filters: { lote: { operator: 'in', values: ['Lote Água'] } } }, resolve).map((r) => r.id), [], 'sem match: compara id');
  assert.deepEqual(apply(rows, { filters: { lote: { operator: 'empty', match: 'label' } } }, resolve).map((r) => r.id), ['l3']);
}

console.log(JSON.stringify({ gate: 'reports:filters:verify', ok: true, checks }, null, 2));
