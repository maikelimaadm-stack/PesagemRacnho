// Colunas do grão EVENT (uma pesagem por linha) — compartilhadas pela Relação de Pesagens
// (tela operacional) e pelos relatórios de pesagens/saídas/embarques (emissão analítica).
// A linha é a "event row" produzida por enrichEventRows (infrastructure/reportSources/eventRows.js).
//
// Convenções:
// - marca/raça/lote/apartação exibem o TEXTO gravado no evento (histórico); agrupam pelo ID
//   quando existe (grafias diferentes do mesmo cadastro caem no mesmo grupo);
// - comprador/frigorífico/origem são texto livre do lançamento (DADOS LEGADOS/POR EVENTO);
// - valores (compra, venda, preço/@, arrobas) são sensíveis: exigem commercial.values.
import { GRAINS } from '../../domain/reportGrain.js';
import { SENSITIVITY, defineColumn } from '../../domain/columnDefinition.js';
import { normalizeText } from '../../domain/filterEngine.js';

const EVENT_GRAINS = [GRAINS.EVENT, GRAINS.EXIT, GRAINS.SHIPMENT_DOCUMENT];

export const TIPO_MANEJO_OPTIONS = [
  { value: 'Cadastro', label: 'Cadastro' },
  { value: 'Manejo', label: 'Manejo' },
  { value: 'Saída', label: 'Saída' },
];

export const MOTIVO_SAIDA_OPTIONS = ['Venda', 'Abate', 'Morte', 'Doação', 'Transferência', 'Outros'].map((value) => ({ value, label: value }));

export const SEXO_OPTIONS = [
  { value: 'M', label: 'Macho' },
  { value: 'F', label: 'Fêmea' },
];

const textKey = (id, text) => (row) => row[id] || (row[text] ? `txt:${normalizeText(row[text])}` : null);

// Animal único: pelo id do animal; registro legado sem id cai em número+marca (mesma chave de
// "Cabeças" em todas as contagens de animais — Machos, Fêmeas, com pesagem anterior).
const animalKeyOf = (row) => row.animal_key || row.animal_id || `legado:${normalizeText(row.numero_animal)}::${normalizeText(row.marca)}`;

// Sexo em código (M/F); legado gravado como "Macho"/"Fêmea" também casa.
const sexCodeOf = (row) => {
  const text = normalizeText(row?.sexo);
  if (text === 'm' || text === 'macho') return 'M';
  if (text === 'f' || text === 'femea') return 'F';
  return null;
};

const isBlank = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Mês da pesagem (E1D, eixo "Mês" da matriz): chave e ordem "aaaa-mm" (cronológica — o MAKGESTAO antigo
// ordenava por texto), rótulo "set/2026". Lido do texto da data civil, sem fuso.
const MONTHS_PT = Object.freeze(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']);
const monthKeyOf = (row) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(row?.data_pesagem ?? ''));
  return match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? `${match[1]}-${match[2]}` : null;
};
export function monthLabelOf(row) {
  const key = monthKeyOf(row);
  return key ? `${MONTHS_PT[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}` : null;
}

// E1B: @ de PESO VIVO = kg ÷ divisor da linha (30 padrão ou 15, Configurações › Relatórios; gravado
// em `arroba_divisor` pela fonte). NÃO é a @ de carcaça do Comercial (quantidade_arrobas = carcaça ÷ 15,
// com rendimento, sensível). Sem kg (ou sem divisor) → null, nunca 0.
const liveArrobaOf = (field) => (row) => {
  const kg = row?.[field];
  if (isBlank(kg)) return null;
  const number = Number(kg);
  const divisor = Number(row.arroba_divisor);
  if (!Number.isFinite(number) || !Number.isFinite(divisor) || divisor <= 0) return null;
  return number / divisor;
};

// Pesagem com anterior válida (entra no GMD ponderado): dias > 0 e ganho preenchido.
const hasPreviousGain = (row) => Number(row?.dias) > 0 && !isBlank(row?.ganho) && Number.isFinite(Number(row.ganho));

// Contagem condicional de animais sem operação nova: coluna identificador cuja chave de grupo só
// existe quando a condição vale; countDistinct conta animais únicos (0 quando ninguém casa).
const animalWhen = (test) => ({
  accessor: (row) => (test(row) ? row.numero_animal ?? null : null),
  groupKey: (row) => (test(row) ? animalKeyOf(row) : null),
});

const purchaseDocumentation = (row) => {
  const value = row?.documentacao;
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const purchaseFreight = (row) => {
  const raw = purchaseDocumentation(row).frete;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const normalized = String(raw).trim().replace(/\s/g, '').replace(/R\$/gi, '');
  const numeric = normalized.includes(',')
    ? Number(normalized.replace(/\./g, '').replace(',', '.'))
    : Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

export const EVENT_COLUMNS = [
  defineColumn({ id: 'data_pesagem', label: 'Data', type: 'date', grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 108 }),
  defineColumn({
    id: 'mes_pesagem', label: 'Mês', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'derivado', defaultWidth: 92,
    // Ordenar/filtrar pelo texto ("abr" < "jan") seria errado: o mês só agrupa (ordem cronológica pelo groupOrder).
    sortable: false, filterable: false,
    accessor: monthLabelOf, groupKey: monthKeyOf, groupLabel: monthLabelOf, groupOrder: monthKeyOf,
    description: 'Mês da data da pesagem ("set/2026"), em ordem cronológica — eixo "Mês" da matriz.',
  }),
  defineColumn({ id: 'tipo_manejo', label: 'Tipo', type: 'enum', options: TIPO_MANEJO_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 112 }),
  defineColumn({ id: 'motivo_saida', label: 'Motivo da saída', type: 'enum', options: MOTIVO_SAIDA_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true }),
  defineColumn({
    id: 'numero_animal', label: 'Animal', type: 'identifier', grains: EVENT_GRAINS, defaultVisible: true, defaultWidth: 116,
    aggregations: ['count', 'countDistinct'],
    // Animais únicos: pelo id do animal; registro legado sem id cai em número+marca.
    groupKey: animalKeyOf,
  }),
  defineColumn({
    id: 'marca', label: 'Marca', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: (row) => row.marca_grupo_id || textKey('marca_id', 'marca')(row), groupLabel: (row) => row.marca_nome || row.marca,
  }),
  defineColumn({ id: 'sexo', label: 'Sexo', type: 'enum', options: SEXO_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 92 }),
  defineColumn({
    id: 'raca', label: 'Raça', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: (row) => row.raca_grupo_id || textKey('raca_id', 'raca')(row), groupLabel: (row) => row.raca_nome || row.raca,
  }),
  defineColumn({ id: 'era', label: 'Era', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 88 }),
  defineColumn({
    id: 'categoria', label: 'Categoria', type: 'entity', grains: EVENT_GRAINS, groupable: true,
    accessor: (row) => row.categoria_id ?? null, display: (row) => row.categoria_nome ?? null,
    description: 'Categoria gravada na pesagem (histórico; eventos anteriores a 16/09/2026 podem não ter).',
  }),
  defineColumn({
    id: 'peso', label: 'Peso', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, defaultVisible: true, defaultWidth: 108,
    aggregations: ['countValid', 'sum', 'avg', 'min', 'max', 'range'],
  }),
  defineColumn({
    id: 'peso_arroba', label: 'Peso em arrobas', unit: '@', type: 'number', decimals: 2, grains: EVENT_GRAINS, source: 'derivado',
    accessor: liveArrobaOf('peso'), aggregations: ['countValid', 'sum', 'avg', 'min', 'max'],
    description: '@ de peso vivo: peso ÷ divisor da arroba (30 ou 15, Configurações › Relatórios). Não é a @ de carcaça do Comercial.',
  }),
  defineColumn({
    id: 'nome_lote', label: 'Lote', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('lote_id', 'nome_lote'), groupLabel: (row) => row.lote_nome_atual || row.nome_lote,
  }),
  defineColumn({
    id: 'nome_apartacao', label: 'Apartação', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('apartacao_id', 'nome_apartacao'), groupLabel: (row) => row.apartacao_nome_atual || row.nome_apartacao,
  }),
  // Faixa exigida do lote (E1B): peso_minimo/peso_maximo do cadastro ATUAL do lote, pelo lote_id.
  defineColumn({
    id: 'lote_peso_minimo', label: 'Faixa mínima do lote', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, source: 'atual',
    aggregations: ['min', 'max'], description: 'Peso mínimo do cadastro ATUAL do lote (não o do dia da pesagem).',
  }),
  defineColumn({
    id: 'lote_peso_maximo', label: 'Faixa máxima do lote', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, source: 'atual',
    aggregations: ['min', 'max'], description: 'Peso máximo do cadastro ATUAL do lote (não o do dia da pesagem).',
  }),
  defineColumn({
    id: 'sessao', label: 'Sessão', type: 'entity', grains: EVENT_GRAINS, groupable: true,
    accessor: (row) => row.sessao_id ?? null, display: (row) => row.sessao_label ?? null,
    groupOrder: (row) => row.sessao_ordem ?? null,
  }),
  defineColumn({ id: 'valor_pago_cabeca', label: 'Valor compra', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'origem_animal', label: 'Origem', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'compra_gta', label: 'GTA compra', type: 'text', grains: EVENT_GRAINS, accessor: (row) => purchaseDocumentation(row).gta || null, source: 'legado-documentacao' }),
  defineColumn({ id: 'compra_nfe', label: 'NF-e compra', type: 'text', grains: EVENT_GRAINS, accessor: (row) => purchaseDocumentation(row).nfe || null, source: 'legado-documentacao' }),
  defineColumn({ id: 'compra_frete', label: 'Frete compra', type: 'money', grains: EVENT_GRAINS, accessor: purchaseFreight, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'], source: 'legado-documentacao' }),
  defineColumn({ id: 'comprador', label: 'Comprador', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'destino_venda', label: 'Destino', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'valor_venda_total', label: 'Valor venda', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'valor_arroba', label: 'Preço/@ carcaça', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL,
    weightedBy: 'quantidade_arrobas', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'],
  }),
  defineColumn({ id: 'quantidade_arrobas', label: '@ carcaça estimada', type: 'number', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  // Rendimento também é sensível: peso × rendimento ÷ 100 ÷ 15 recalcula as arrobas.
  defineColumn({ id: 'rendimento_carcaca', label: 'Rendimento', unit: '%', type: 'percentage', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, weightedBy: 'peso', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'] }),
  // Carcaça estimada é sensível: arrobas = carcaça ÷ 15 (seria canal lateral para o valor).
  defineColumn({ id: 'peso_carcaca_estimado', label: 'Carcaça estimada', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'frigorifico', label: 'Frigorífico', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'valor_arroba_abate', label: 'Preço/@ abate', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, weightedBy: 'quantidade_arrobas', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'] }),
  defineColumn({ id: 'valor_total_abate', label: 'Valor abate', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'causa_morte', label: 'Causa da morte', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'embarque_nome', label: 'Embarque', type: 'text', grains: EVENT_GRAINS, groupable: true, groupKey: textKey('embarque_id', 'embarque_nome') }),
  defineColumn({ id: 'documento_tipo', label: 'Doc', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultWidth: 92 }),
  defineColumn({ id: 'documento_numero', label: 'Nº doc', type: 'text', grains: EVENT_GRAINS, groupable: true, groupKey: textKey('documento_embarque_id', 'documento_numero'), defaultWidth: 120 }),
  defineColumn({ id: 'motorista_nome', label: 'Motorista', type: 'text', grains: EVENT_GRAINS }),
  defineColumn({ id: 'placa_carreta', label: 'Placa', type: 'text', grains: EVENT_GRAINS, defaultWidth: 108 }),
  defineColumn({ id: 'doc_qtd', label: 'Qtd doc (dia)', type: 'integer', grains: EVENT_GRAINS, aggregations: ['countValid', 'max'], description: 'Pesagens ligadas ao mesmo documento de embarque.' }),
  // "Pesagem anterior" (filtro Todos/Com/Sem da E1B): data anterior preenchida. Só Manejo grava a
  // pesagem anterior; Cadastro e Saída ficam sempre "Não".
  defineColumn({
    id: 'tem_pesagem_anterior', label: 'Pesagem anterior', type: 'boolean', grains: EVENT_GRAINS, groupable: true, source: 'derivado',
    accessor: (row) => !isBlank(row.data_anterior), defaultWidth: 100,
  }),
  defineColumn({ id: 'data_anterior', label: 'Data anterior', type: 'date', grains: EVENT_GRAINS, defaultWidth: 108 }),
  defineColumn({ id: 'peso_anterior', label: 'Peso anterior', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, aggregations: ['countValid', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'dias', label: 'Dias', type: 'integer', grains: EVENT_GRAINS, defaultWidth: 82, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'ganho', label: 'Ganho', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, defaultWidth: 100, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'ganho_arroba', label: 'Ganho em arrobas', unit: '@', type: 'number', decimals: 2, grains: EVENT_GRAINS, source: 'derivado',
    accessor: liveArrobaOf('ganho'), aggregations: ['countValid', 'sum', 'avg', 'min', 'max'],
    description: '@ de peso vivo do ganho: ganho ÷ divisor da arroba (só pesagens com pesagem anterior).',
  }),
  defineColumn({
    id: 'gmd', label: 'GMD', unit: 'kg/dia', type: 'gmd', grains: EVENT_GRAINS, defaultVisible: true, defaultWidth: 92,
    weighted: { gain: 'ganho', days: 'dias' }, aggregations: ['countValid', 'avg', 'min', 'max', 'weightedGmd'],
  }),
  defineColumn({ id: 'observacao', label: 'Observação', type: 'text', grains: EVENT_GRAINS }),
  defineColumn({ id: 'pendencias', label: 'Pendências', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'derivado', description: 'Mesmas regras do Fechamento do Dia: Peso (GMD negativo), Lote (sem lote), Doc (saída sem documento exigido).' }),
  defineColumn({ id: 'embarque_vinculado', label: 'Vinculada a embarque', type: 'boolean', grains: EVENT_GRAINS, groupable: true, source: 'derivado' }),
  defineColumn({
    id: 'situacao_atual', label: 'Situação atual do animal', type: 'enum', grains: EVENT_GRAINS, groupable: true, source: 'atual',
    options: ['ATIVO', 'VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO'].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })),
    description: 'Estado ATUAL do animal (projeção), não o do dia da pesagem.',
  }),
  defineColumn({
    id: 'origem_registro', label: 'Origem do registro', type: 'enum', grains: EVENT_GRAINS, groupable: true,
    accessor: (row) => row.origem || 'manual',
    options: [{ value: 'manual', label: 'Lançamento' }, { value: 'importacao', label: 'Importação' }, { value: 'massa-teste', label: 'Massa de teste' }],
  }),
  defineColumn({
    id: 'operador', label: 'Operador', type: 'entity', grains: EVENT_GRAINS, groupable: true,
    accessor: (row) => row.created_by_user_id ?? null, display: (row) => row.operador_nome ?? null,
  }),
  // Contagens de animais da folha (E1B), por countDistinct: Machos, Fêmeas e animais com pesagem
  // anterior válida (base da nota "GMD calculado com N de M animais"). zeroAsEmpty: na folha a
  // contagem 0 aparece "—" e a coluna só com zeros some (o valor continua 0 no motor e no JSON).
  // Colunas SÓ de cálculo (metricOnly): servem ao countDistinct da folha (Machos, Fêmeas, nota do GMD);
  // não são dado de linha — fora do seletor de colunas, dos filtros, da ordenação e das exportações.
  defineColumn({
    id: 'animais_machos', label: 'Machos', type: 'identifier', grains: EVENT_GRAINS, source: 'derivado',
    aggregations: ['countDistinct'], zeroAsEmpty: true, metricOnly: true, filterable: false, sortable: false, exportable: false, ...animalWhen((row) => sexCodeOf(row) === 'M'),
  }),
  defineColumn({
    id: 'animais_femeas', label: 'Fêmeas', type: 'identifier', grains: EVENT_GRAINS, source: 'derivado',
    aggregations: ['countDistinct'], zeroAsEmpty: true, metricOnly: true, filterable: false, sortable: false, exportable: false, ...animalWhen((row) => sexCodeOf(row) === 'F'),
  }),
  defineColumn({
    id: 'animais_com_anterior', label: 'Animais com pesagem anterior', type: 'identifier', grains: EVENT_GRAINS, source: 'derivado',
    aggregations: ['countDistinct'], metricOnly: true, filterable: false, sortable: false, exportable: false, ...animalWhen(hasPreviousGain),
    description: 'Animais com ao menos uma pesagem com anterior válida (dias > 0 e ganho): os que entram no GMD.',
  }),
];

// Colunas que a Relação de Pesagens oferece (mesma ordem da tela). As demais são exclusivas dos relatórios.
export const RELATION_COLUMN_IDS = Object.freeze([
  'data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'peso', 'nome_lote',
  'nome_apartacao', 'valor_pago_cabeca', 'origem_animal', 'compra_gta', 'compra_nfe', 'compra_frete', 'comprador', 'destino_venda', 'valor_venda_total', 'valor_arroba',
  'quantidade_arrobas', 'frigorifico', 'embarque_nome', 'documento_tipo', 'documento_numero', 'motorista_nome', 'placa_carreta',
  'doc_qtd', 'dias', 'ganho', 'gmd', 'observacao',
]);

// Pesquisa rápida da Relação: número, marca, lote, apartação, raça.
export const RELATION_SEARCH_COLUMN_IDS = Object.freeze(['numero_animal', 'marca', 'nome_lote', 'nome_apartacao', 'raca']);
