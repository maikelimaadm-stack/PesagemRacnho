// Família DESEMPENHO — grão ANIMAL_PERIOD: cada animal uma vez por período.
// GMD de grupo = Σ ganho ÷ Σ dias (ponderado), só animais com par válido de pesagens.
// E1 (1.4.0): "Desempenho" substitui individual, por lote, as seis dimensões, "Animais perdendo peso"
// e "Distribuição por faixa de peso" (aliases em legacyAliases.js).
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_PERIOD_COLUMNS } from './columns/animalColumns.js';
import { listaTipo, resumoTipo } from './tipos.js';

export const PERFORMANCE_PERIOD_PARAM = Object.freeze({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_90_dias' } });

// Totais completos (usados pelos aliases dos relatórios antigos de desempenho).
export const PERFORMANCE_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'pesagens', columnId: 'pesagens', op: 'sum' },
  { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
]);

export const PERFORMANCE_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'categoria', 'lote', 'pesagens', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd']);

export const PERFORMANCE_NOTES = Object.freeze([
  'Uma linha por animal com pesagem no período. Peso inicial/final = primeira/última pesagem com peso dentro do período.',
  'Ganho, dias e GMD só existem com duas ou mais pesagens com peso; sem par válido aparecem como "—" e não entram no GMD.',
  'GMD do grupo = soma dos ganhos ÷ soma dos dias (ponderado); GMD simples = média dos GMD individuais.',
]);

// E1E "Tipo Relatório" (definitions/tipos.js). Totais dos tipos = os dos antigos relatórios de desempenho
// (PERFORMANCE_TOTALS), na ordem da folha; "Pesagens" e "GMD simples" ficam só no "Colunas Painel".
const byId = (id) => PERFORMANCE_TOTALS.find((spec) => spec.id === id);
export const PERFORMANCE_TYPE_TOTALS = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'gmd_ponderado', 'pesagens', 'gmd_simples'].map(byId));
export const PERFORMANCE_TYPE_DEFAULTS = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'gmd_ponderado']);
// "Perdendo Peso" = o antigo "Animais perdendo peso": ganho < 0 é condição do tipo (população, com cadeado).
export const PERDENDO_PESO_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'lote', 'data_inicial', 'peso_inicial', 'data_final', 'peso_final', 'dias', 'ganho', 'gmd']);
export const PERDENDO_PESO_POPULATION = Object.freeze({ ganho: { operator: 'less', value: '0' } });
const perf = (id, label, groups) => resumoTipo(id, label, groups, PERFORMANCE_TYPE_TOTALS, { defaults: PERFORMANCE_TYPE_DEFAULTS });
export const DESEMPENHO_DEFAULT_VIEW = 'por-lote';
export const DESEMPENHO_VIEWS = Object.freeze([
  perf('por-lote', 'Por Lote', ['lote']),
  // = o antigo "Desempenho por lote" (apartação › lote).
  perf('por-apartacao-lote', 'Por Apartação/Lote', ['apartacao', 'lote']),
  perf('por-apartacao', 'Por Apartação', ['apartacao']),
  perf('por-categoria', 'Por Categoria', ['categoria']),
  perf('por-raca', 'Por Raça', ['raca']),
  perf('por-marca', 'Por Marca', ['marca']),
  perf('por-sexo', 'Por Sexo', ['sexo']),
  perf('por-faixa-peso', 'Por Faixa de Peso', ['faixa_peso']),
  // = o antigo "Desempenho individual".
  listaTipo('analitico', 'Analítico (Animal por Animal)', { columns: PERFORMANCE_COLUMNS, aggregates: PERFORMANCE_TYPE_TOTALS, sort: [{ columnId: 'animal', direction: 'asc' }] }),
  listaTipo('perdendo-peso', 'Perdendo Peso', { columns: PERDENDO_PESO_COLUMNS, aggregates: PERFORMANCE_TYPE_TOTALS, sort: [{ columnId: 'ganho', direction: 'asc' }], population: PERDENDO_PESO_POPULATION }),
]);

export const DESEMPENHO = defineReport({
  id: 'desempenho',
  family: 'desempenho',
  grain: GRAINS.ANIMAL_PERIOD,
  // 2 (E1E): ganhou os tipos (ver rebanho.js).
  version: 2,
  source: 'animals.period',
  requires: ['reports.read', 'weighing.read'],
  title: 'Desempenho',
  description: 'Peso inicial e final, ganho e GMD do período — por lote, categoria, raça, marca ou animal por animal.',
  metrics: ['Cabeças', 'Peso inicial/final', 'Ganho', 'GMD'],
  params: [PERFORMANCE_PERIOD_PARAM, { id: 'faixas', type: 'ranges', label: 'Faixas de peso', default: null }],
  columns: ANIMAL_PERIOD_COLUMNS,
  animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'raca', 'lote'],
  defaultColumns: [...PERFORMANCE_COLUMNS],
  defaultSort: [{ columnId: 'animal', direction: 'asc' }],
  defaultGroups: [{ columnId: 'lote' }],
  // Ordem = colunas do Resumido: Lote | Cabeças | Peso inicial médio | Peso final médio | Ganho total | Ganho médio | GMD.
  defaultAggregates: [
    { id: 'animais', columnId: 'animal', op: 'countDistinct' },
    { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
    { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
    { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
    { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
    { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  ],
  quickGroups: ['lote', 'apartacao', 'categoria', 'raca', 'marca', 'sexo', 'faixa_peso'],
  quickFilters: [
    { id: 'perdendo-peso', label: 'Somente perdendo peso', filters: { ganho: { operator: 'less', value: '0' } } },
  ],
  views: DESEMPENHO_VIEWS,
  defaultView: DESEMPENHO_DEFAULT_VIEW,
  notes: [...PERFORMANCE_NOTES],
});
