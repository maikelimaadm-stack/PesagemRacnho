// Colunas dos grãos ANIMAL_CURRENT (uma linha por animal, estado atual) e ANIMAL_PERIOD
// (uma linha por animal no período). Dimensões por id; exibição pelo nome do cadastro.
import { GRAINS } from '../../domain/reportGrain.js';
import { defineColumn } from '../../domain/columnDefinition.js';
import { SEXO_OPTIONS } from './eventColumns.js';

const CURRENT = [GRAINS.ANIMAL_CURRENT];
const PERIOD = [GRAINS.ANIMAL_PERIOD];
const BOTH = [GRAINS.ANIMAL_CURRENT, GRAINS.ANIMAL_PERIOD];

export const SITUACAO_OPTIONS = ['ATIVO', 'VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO']
  .map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }));

const entity = (id, label, idField, nameField, grains, extra = {}) => defineColumn({
  id, label, type: 'entity', grains, groupable: true,
  accessor: (row) => row[idField] ?? null,
  display: (row) => row[nameField] ?? null,
  ...extra,
});

export const ANIMAL_COMMON_COLUMNS = [
  defineColumn({
    id: 'animal', label: 'Animal', type: 'identifier', grains: BOTH, defaultVisible: true, defaultWidth: 116,
    accessor: (row) => row.numero_animal ?? null, groupKey: (row) => row.animal_id ?? row.animal_key ?? row.id, aggregations: ['count', 'countDistinct'],
  }),
  entity('marca', 'Marca', 'marca_id', 'marca_nome', BOTH, { defaultVisible: true, groupKey: (row) => row.marca_id ?? (row.marca_nome ? `txt:${row.marca_nome}` : null) }),
  defineColumn({ id: 'sexo', label: 'Sexo', type: 'enum', options: SEXO_OPTIONS, grains: BOTH, groupable: true, defaultVisible: true, defaultWidth: 92 }),
  entity('raca', 'Raça', 'raca_id', 'raca_nome', BOTH, { defaultVisible: true, groupKey: (row) => row.raca_id ?? (row.raca_nome ? `txt:${row.raca_nome}` : null) }),
  entity('categoria', 'Categoria', 'categoria_id', 'categoria_nome', BOTH, { defaultVisible: true, source: 'atual' }),
  defineColumn({ id: 'situacao', label: 'Situação', type: 'enum', options: SITUACAO_OPTIONS, grains: BOTH, groupable: true, source: 'atual' }),
  defineColumn({ id: 'faixa_peso', label: 'Faixa de peso', type: 'text', grains: BOTH, groupable: true, source: 'derivado', description: 'Faixas do modelo ou das categorias com faixa de peso configurada.' }),
];

export const ANIMAL_CURRENT_COLUMNS = [
  ...ANIMAL_COMMON_COLUMNS,
  defineColumn({ id: 'era', label: 'Era', type: 'text', grains: CURRENT, groupable: true }),
  entity('lote_atual', 'Lote atual', 'lote_atual_id', 'lote_atual_nome', CURRENT, { defaultVisible: true }),
  entity('apartacao_atual', 'Apartação atual', 'apartacao_atual_id', 'apartacao_atual_nome', CURRENT, { defaultVisible: true }),
  entity('propriedade', 'Propriedade', 'propriedade_id', 'propriedade_nome', CURRENT),
  defineColumn({ id: 'ultima_pesagem_data', label: 'Última pesagem', type: 'date', grains: CURRENT, groupable: true, defaultVisible: true, defaultWidth: 108 }),
  defineColumn({ id: 'ultimo_peso_kg', label: 'Peso atual', unit: 'kg', type: 'weight', grains: CURRENT, defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max', 'range'] }),
  defineColumn({ id: 'dias_sem_pesagem', label: 'Dias sem pesagem', type: 'integer', grains: CURRENT, defaultVisible: true, aggregations: ['countValid', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'data_saida', label: 'Data da saída', type: 'date', grains: CURRENT, groupable: true }),
  defineColumn({ id: 'motivo_saida', label: 'Motivo da saída', type: 'text', grains: CURRENT, groupable: true }),
  defineColumn({ id: 'data_cadastro', label: 'Cadastrado em', type: 'date', grains: CURRENT }),
  // E1G (A4): entrada = o Cadastro com peso; "desde a entrada" = da entrada até a última pesagem com peso (peso atual).
  // Último GMD = o GMD gravado na última pesagem com peso (contra a pesagem anterior). Sem par, "-".
  defineColumn({ id: 'peso_entrada', label: 'Peso de entrada', unit: 'kg', type: 'weight', grains: CURRENT, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'data_entrada', label: 'Data de entrada', type: 'date', grains: CURRENT, groupable: true, defaultWidth: 108 }),
  defineColumn({ id: 'ganho_entrada', label: 'Ganho desde a entrada', unit: 'kg', type: 'weight', grains: CURRENT, keepWhenEmpty: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'dias_entrada', label: 'Dias desde a entrada', type: 'integer', grains: CURRENT, keepWhenEmpty: true, aggregations: ['countValid', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'gmd_entrada', label: 'GMD desde a entrada', unit: 'kg/dia', type: 'gmd', grains: CURRENT,
    weighted: { gain: 'ganho_entrada', days: 'dias_entrada' }, aggregations: ['countValid', 'avg', 'min', 'max', 'weightedGmd'],
    description: '(Peso atual − peso de entrada) ÷ dias entre a entrada e a última pesagem com peso.',
  }),
  defineColumn({
    id: 'ultimo_gmd', label: 'Último GMD', unit: 'kg/dia', type: 'gmd', grains: CURRENT,
    weighted: { gain: 'ultimo_ganho', days: 'ultimo_dias' }, aggregations: ['countValid', 'avg', 'min', 'max', 'weightedGmd'],
    description: 'GMD da última pesagem com peso, contra a pesagem anterior (o mesmo do relatório Pesagens).',
  }),
];

export const ANIMAL_PERIOD_COLUMNS = [
  ...ANIMAL_COMMON_COLUMNS,
  entity('lote', 'Lote (última pesagem no período)', 'lote_id', 'lote_nome', PERIOD, { defaultVisible: true }),
  entity('apartacao', 'Apartação (última pesagem no período)', 'apartacao_id', 'apartacao_nome', PERIOD),
  defineColumn({ id: 'pesagens', label: 'Pesagens', type: 'integer', grains: PERIOD, defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'data_inicial', label: 'Data inicial', type: 'date', grains: PERIOD, defaultWidth: 108 }),
  defineColumn({ id: 'peso_inicial', label: 'Peso inicial', unit: 'kg', type: 'weight', grains: PERIOD, defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'data_final', label: 'Data final', type: 'date', grains: PERIOD, defaultWidth: 108 }),
  defineColumn({ id: 'peso_final', label: 'Peso final', unit: 'kg', type: 'weight', grains: PERIOD, defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  // E1G (A3): dias, ganho e GMD nunca somem da folha (keepWhenEmpty; o GMD pelo tipo) — sem valor, "-".
  defineColumn({ id: 'dias', label: 'Dias', type: 'integer', grains: PERIOD, defaultVisible: true, keepWhenEmpty: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'ganho', label: 'Ganho', unit: 'kg', type: 'weight', grains: PERIOD, defaultVisible: true, keepWhenEmpty: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max', 'range'] }),
  defineColumn({
    id: 'gmd', label: 'GMD', unit: 'kg/dia', type: 'gmd', grains: PERIOD, defaultVisible: true,
    weighted: { gain: 'ganho', days: 'dias' }, aggregations: ['countValid', 'avg', 'min', 'max', 'weightedGmd'],
  }),
];
