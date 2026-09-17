// Família REBANHO — grão ANIMAL_CURRENT (projeção `animais`; não reconstrói histórico).
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_CURRENT_COLUMNS } from './columns/animalColumns.js';

const ATIVOS = { situacao: { operator: 'in', values: ['ATIVO'] } };

const CURRENT_TOTALS = [
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'peso_total', columnId: 'ultimo_peso_kg', op: 'sum' },
  { id: 'peso_medio', columnId: 'ultimo_peso_kg', op: 'avg' },
  { id: 'peso_min', columnId: 'ultimo_peso_kg', op: 'min' },
  { id: 'peso_max', columnId: 'ultimo_peso_kg', op: 'max' },
];

const base = {
  family: 'rebanho',
  grain: GRAINS.ANIMAL_CURRENT,
  version: 1,
  source: 'animals.current',
  requires: ['reports.read', 'animal.read'],
  params: [{ id: 'faixas', type: 'ranges', label: 'Faixas de peso', default: null }],
  columns: ANIMAL_CURRENT_COLUMNS,
  animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'raca', 'lote_atual', 'apartacao_atual'],
  defaultFilters: ATIVOS,
  defaultSort: [{ columnId: 'animal', direction: 'asc' }],
  defaultAggregates: CURRENT_TOTALS,
  notes: ['Estado ATUAL de cada animal (uma linha por animal). Peso atual = última pesagem com peso.'],
};

export const REBANHO_INVENTARIO = defineReport({
  ...base,
  id: 'rebanho.inventario',
  title: 'Inventário atual do rebanho',
  description: 'Uma linha por animal ativo com marca, sexo, raça, categoria, lote, última pesagem e peso atual.',
  metrics: ['Animais', 'Peso total', 'Peso médio'],
  defaultColumns: ['animal', 'marca', 'sexo', 'raca', 'categoria', 'situacao', 'lote_atual', 'apartacao_atual', 'ultima_pesagem_data', 'ultimo_peso_kg', 'dias_sem_pesagem'],
});

const DIMENSIONS = [
  ['marca', 'marca', 'Rebanho por marca'],
  ['raca', 'raca', 'Rebanho por raça'],
  ['categoria', 'categoria', 'Rebanho por categoria'],
  ['sexo', 'sexo', 'Rebanho por sexo'],
  ['situacao', 'situacao', 'Rebanho por situação'],
  ['lote', 'lote_atual', 'Rebanho por lote'],
  ['apartacao', 'apartacao_atual', 'Rebanho por apartação'],
  ['faixa_peso', 'faixa_peso', 'Rebanho por faixa de peso'],
];

export const REBANHO_POR_DIMENSAO = DIMENSIONS.map(([key, columnId, title]) => defineReport({
  ...base,
  id: `rebanho.dimensao.${key}`,
  presetOf: 'rebanho.dimensao',
  title,
  description: `Animais agrupados por ${title.replace('Rebanho por ', '')}, com quantidade, peso total e peso médio atuais por grupo.`,
  metrics: ['Animais por grupo', 'Peso médio', 'Peso total'],
  defaultColumns: ['animal', 'marca', 'sexo', 'raca', 'categoria', 'lote_atual', 'ultimo_peso_kg'].filter((id) => id !== columnId),
  defaultGroups: [{ columnId }],
  // Por situação mostra todas as situações; os demais consideram só ativos.
  defaultFilters: key === 'situacao' ? {} : ATIVOS,
}));

export const REBANHO_SEM_PESAGEM = defineReport({
  ...base,
  id: 'rebanho.sem-pesagem-recente',
  title: 'Animais sem pesagem recente',
  description: 'Animais ativos cuja última pesagem com peso tem mais dias que o limite informado.',
  metrics: ['Animais', 'Dias sem pesagem'],
  params: [...base.params, { id: 'dias_sem_pesagem', type: 'integer', label: 'Dias sem pesagem (mais de)', default: 30, min: 1 }],
  defaultColumns: ['animal', 'marca', 'sexo', 'categoria', 'lote_atual', 'ultima_pesagem_data', 'ultimo_peso_kg', 'dias_sem_pesagem'],
  defaultSort: [{ columnId: 'dias_sem_pesagem', direction: 'desc' }],
  defaultAggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'dias_medio', columnId: 'dias_sem_pesagem', op: 'avg' }, { id: 'dias_max', columnId: 'dias_sem_pesagem', op: 'max' }],
  // Condição do relatório (não removível): ativo e dias sem pesagem > parâmetro.
  // Sem data de última pesagem o valor é ausente e não entra (ausente ≠ 0).
  lockedFilters: (params) => ({ situacao: { operator: 'in', values: ['ATIVO'] }, dias_sem_pesagem: { operator: 'greater', value: String(params.dias_sem_pesagem) } }),
});
