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

export const EVENT_COLUMNS = [
  defineColumn({ id: 'data_pesagem', label: 'Data', type: 'date', grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 108 }),
  defineColumn({ id: 'tipo_manejo', label: 'Tipo', type: 'enum', options: TIPO_MANEJO_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 112 }),
  defineColumn({ id: 'motivo_saida', label: 'Motivo da saída', type: 'enum', options: MOTIVO_SAIDA_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true }),
  defineColumn({
    id: 'numero_animal', label: 'Animal', type: 'identifier', grains: EVENT_GRAINS, defaultVisible: true, defaultWidth: 116,
    aggregations: ['count', 'countDistinct'],
    // Animais únicos: pelo id do animal; registro legado sem id cai em número+marca.
    groupKey: (row) => row.animal_id || `legado:${normalizeText(row.numero_animal)}::${normalizeText(row.marca)}`,
  }),
  defineColumn({
    id: 'marca', label: 'Marca', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('marca_id', 'marca'), groupLabel: (row) => row.marca_nome || row.marca,
  }),
  defineColumn({ id: 'sexo', label: 'Sexo', type: 'enum', options: SEXO_OPTIONS, grains: EVENT_GRAINS, groupable: true, defaultVisible: true, defaultWidth: 92 }),
  defineColumn({
    id: 'raca', label: 'Raça', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('raca_id', 'raca'), groupLabel: (row) => row.raca_nome || row.raca,
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
    id: 'nome_lote', label: 'Lote', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('lote_id', 'nome_lote'), groupLabel: (row) => row.lote_nome_atual || row.nome_lote,
  }),
  defineColumn({
    id: 'nome_apartacao', label: 'Apartação', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultVisible: true,
    groupKey: textKey('apartacao_id', 'nome_apartacao'), groupLabel: (row) => row.apartacao_nome_atual || row.nome_apartacao,
  }),
  defineColumn({
    id: 'sessao', label: 'Sessão', type: 'entity', grains: EVENT_GRAINS, groupable: true,
    accessor: (row) => row.sessao_id ?? null, display: (row) => row.sessao_label ?? null,
  }),
  defineColumn({ id: 'valor_pago_cabeca', label: 'Valor compra', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'origem_animal', label: 'Origem', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'comprador', label: 'Comprador', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'destino_venda', label: 'Destino', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'valor_venda_total', label: 'Valor venda', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'valor_arroba', label: 'Preço/@ carcaça', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL,
    weightedBy: 'quantidade_arrobas', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'],
  }),
  defineColumn({ id: 'quantidade_arrobas', label: '@ carcaça estimada', type: 'number', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'rendimento_carcaca', label: 'Rendimento', unit: '%', type: 'percentage', grains: EVENT_GRAINS, weightedBy: 'peso', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'] }),
  // Carcaça estimada é sensível: arrobas = carcaça ÷ 15 (seria canal lateral para o valor).
  defineColumn({ id: 'peso_carcaca_estimado', label: 'Carcaça estimada', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'frigorifico', label: 'Frigorífico', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'valor_total_abate', label: 'Valor abate', type: 'money', grains: EVENT_GRAINS, sensitive: SENSITIVITY.COMMERCIAL, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'causa_morte', label: 'Causa da morte', type: 'text', grains: EVENT_GRAINS, groupable: true, source: 'legado-texto' }),
  defineColumn({ id: 'embarque_nome', label: 'Embarque', type: 'text', grains: EVENT_GRAINS, groupable: true, groupKey: textKey('embarque_id', 'embarque_nome') }),
  defineColumn({ id: 'documento_tipo', label: 'Doc', type: 'text', grains: EVENT_GRAINS, groupable: true, defaultWidth: 92 }),
  defineColumn({ id: 'documento_numero', label: 'Nº doc', type: 'text', grains: EVENT_GRAINS, groupable: true, groupKey: textKey('documento_embarque_id', 'documento_numero'), defaultWidth: 120 }),
  defineColumn({ id: 'motorista_nome', label: 'Motorista', type: 'text', grains: EVENT_GRAINS }),
  defineColumn({ id: 'placa_carreta', label: 'Placa', type: 'text', grains: EVENT_GRAINS, defaultWidth: 108 }),
  defineColumn({ id: 'doc_qtd', label: 'Qtd doc (dia)', type: 'integer', grains: EVENT_GRAINS, aggregations: ['countValid', 'max'], description: 'Pesagens ligadas ao mesmo documento de embarque.' }),
  defineColumn({ id: 'data_anterior', label: 'Data anterior', type: 'date', grains: EVENT_GRAINS, defaultWidth: 108 }),
  defineColumn({ id: 'peso_anterior', label: 'Peso anterior', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, aggregations: ['countValid', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'dias', label: 'Dias', type: 'integer', grains: EVENT_GRAINS, defaultWidth: 82, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'ganho', label: 'Ganho', unit: 'kg', type: 'weight', grains: EVENT_GRAINS, defaultWidth: 100, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'gmd', label: 'GMD', unit: 'kg/dia', type: 'gmd', grains: EVENT_GRAINS, defaultVisible: true, defaultWidth: 92,
    weighted: { gain: 'ganho', days: 'dias' }, aggregations: ['countValid', 'avg', 'min', 'max', 'weightedGmd'],
  }),
  defineColumn({ id: 'observacao', label: 'Observação', type: 'text', grains: EVENT_GRAINS }),
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
];

// Colunas que a Relação de Pesagens oferece (mesma ordem da tela). As demais são exclusivas dos relatórios.
export const RELATION_COLUMN_IDS = Object.freeze([
  'data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'peso', 'nome_lote',
  'nome_apartacao', 'valor_pago_cabeca', 'origem_animal', 'comprador', 'destino_venda', 'valor_venda_total', 'valor_arroba',
  'quantidade_arrobas', 'frigorifico', 'embarque_nome', 'documento_tipo', 'documento_numero', 'motorista_nome', 'placa_carreta',
  'doc_qtd', 'dias', 'ganho', 'gmd', 'observacao',
]);

// Pesquisa rápida da Relação: número, marca, lote, apartação, raça.
export const RELATION_SEARCH_COLUMN_IDS = Object.freeze(['numero_animal', 'marca', 'nome_lote', 'nome_apartacao', 'raca']);
