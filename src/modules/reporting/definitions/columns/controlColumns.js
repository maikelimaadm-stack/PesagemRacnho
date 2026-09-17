// Colunas dos grãos LOT, LOT_STAY, SHIPMENT_DOCUMENT, AUDIT_ENTRY, DATA_ISSUE, BACKUP_ENTRY e
// REGISTRY_ITEM. Nenhuma coluna de segredo (senha, salt, chave de recuperação) existe aqui.
import { GRAINS } from '../../domain/reportGrain.js';
import { SENSITIVITY, defineColumn } from '../../domain/columnDefinition.js';
import { SEXO_OPTIONS } from './eventColumns.js';

const g = (grain) => [grain];

export const LOT_COLUMNS = [
  defineColumn({ id: 'apartacao', label: 'Apartação', type: 'text', grains: g(GRAINS.LOT), groupable: true, defaultVisible: true, groupKey: (row) => row.apartacao_id ?? null }),
  defineColumn({ id: 'lote', label: 'Lote', type: 'text', grains: g(GRAINS.LOT), groupable: true, defaultVisible: true, groupKey: (row) => row.lote_id }),
  defineColumn({ id: 'situacao_lote', label: 'Situação', type: 'enum', grains: g(GRAINS.LOT), groupable: true, defaultVisible: true, options: [{ value: 'ABERTO', label: 'Aberto' }, { value: 'FECHADO', label: 'Fechado' }] }),
  defineColumn({ id: 'capacidade', label: 'Capacidade', unit: 'cab.', type: 'integer', grains: g(GRAINS.LOT), defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({ id: 'animais', label: 'Animais atuais', unit: 'cab.', type: 'integer', grains: g(GRAINS.LOT), defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
  defineColumn({
    id: 'ocupacao', label: 'Ocupação', unit: '%', type: 'percentage', grains: g(GRAINS.LOT), defaultVisible: true,
    ratio: { numerator: 'animais_x100_com_capacidade', denominator: 'capacidade' }, aggregations: ['countValid', 'avg', 'min', 'max', 'ratio'],
    description: 'Animais atuais ÷ capacidade. Sem capacidade informada: ausente (não 0 nem 100 %). Total = Σ animais ÷ Σ capacidade.',
  }),
  defineColumn({ id: 'peso_medio_atual', label: 'Peso médio atual', unit: 'kg', type: 'weight', grains: g(GRAINS.LOT), defaultVisible: true, weightedBy: 'animais_com_peso', aggregations: ['countValid', 'avg', 'min', 'max', 'weightedAvg'] }),
  defineColumn({ id: 'peso_min_lote', label: 'Peso mínimo do lote', unit: 'kg', type: 'weight', grains: g(GRAINS.LOT), aggregations: ['countValid', 'min', 'max'] }),
  defineColumn({ id: 'peso_max_lote', label: 'Peso máximo do lote', unit: 'kg', type: 'weight', grains: g(GRAINS.LOT), aggregations: ['countValid', 'min', 'max'] }),
];

export const LOT_STAY_COLUMNS = [
  defineColumn({ id: 'animal', label: 'Animal', type: 'identifier', grains: g(GRAINS.LOT_STAY), defaultVisible: true, accessor: (row) => row.numero_animal, groupKey: (row) => row.animal_id, aggregations: ['count', 'countDistinct'] }),
  defineColumn({ id: 'marca', label: 'Marca', type: 'text', grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true, groupKey: (row) => row.marca_id ?? row.marca }),
  defineColumn({ id: 'sexo', label: 'Sexo', type: 'enum', options: SEXO_OPTIONS, grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'lote_origem', label: 'Lote anterior', type: 'text', grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true, groupKey: (row) => row.lote_origem_id }),
  defineColumn({ id: 'lote', label: 'Lote', type: 'text', grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true, groupKey: (row) => row.lote_id }),
  defineColumn({ id: 'apartacao', label: 'Apartação', type: 'text', grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true, groupKey: (row) => row.apartacao_id }),
  defineColumn({ id: 'inicio', label: 'Entrada no lote', type: 'date', grains: g(GRAINS.LOT_STAY), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'fim', label: 'Saída do lote', type: 'date', grains: g(GRAINS.LOT_STAY), defaultVisible: true }),
  defineColumn({ id: 'dias_no_lote', label: 'Dias no lote', type: 'integer', grains: g(GRAINS.LOT_STAY), defaultVisible: true, aggregations: ['countValid', 'avg', 'min', 'max', 'sum'] }),
  defineColumn({ id: 'mudanca', label: 'Mudança de lote', type: 'boolean', grains: g(GRAINS.LOT_STAY), groupable: true, description: 'Verdadeiro quando o animal veio de outro lote (não é a primeira permanência).' }),
];

export const SHIPMENT_DOCUMENT_COLUMNS = [
  defineColumn({ id: 'embarque', label: 'Embarque', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT), groupable: true, defaultVisible: true, groupKey: (row) => row.embarque_id }),
  defineColumn({ id: 'data_embarque', label: 'Data do embarque', type: 'date', grains: g(GRAINS.SHIPMENT_DOCUMENT), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'destino', label: 'Destino/frigorífico (texto)', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT), groupable: true, defaultVisible: true, source: 'legado-texto' }),
  defineColumn({ id: 'status_embarque', label: 'Status', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT), groupable: true }),
  defineColumn({ id: 'tipo_documento', label: 'Documento', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'numero_gta', label: 'Nº GTA', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT), defaultVisible: true }),
  defineColumn({ id: 'numero_nfe', label: 'Nº NF-e', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT) }),
  defineColumn({ id: 'motorista', label: 'Motorista', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT) }),
  defineColumn({ id: 'placa', label: 'Placa', type: 'text', grains: g(GRAINS.SHIPMENT_DOCUMENT) }),
  ...[['prev_machos', 'Previsto machos'], ['prev_femeas', 'Previsto fêmeas'], ['prev_total', 'Previsto total'], ['real_machos', 'Realizado machos'], ['real_femeas', 'Realizado fêmeas'], ['real_sem_sexo', 'Realizado sem sexo'], ['real_total', 'Realizado total'], ['diferenca_total', 'Diferença (real − previsto)']]
    .map(([id, label]) => defineColumn({ id, label, unit: 'cab.', type: 'integer', grains: g(GRAINS.SHIPMENT_DOCUMENT), defaultVisible: !['real_sem_sexo'].includes(id), aggregations: ['countValid', 'sum', 'min', 'max'] })),
  defineColumn({ id: 'peso_total_real', label: 'Peso embarcado', unit: 'kg', type: 'weight', grains: g(GRAINS.SHIPMENT_DOCUMENT), defaultVisible: true, aggregations: ['countValid', 'sum', 'avg', 'min', 'max'] }),
];

export const AUDIT_COLUMNS = [
  defineColumn({ id: 'data_hora', label: 'Data e hora', type: 'datetime', grains: g(GRAINS.AUDIT_ENTRY), defaultVisible: true, defaultWidth: 140 }),
  defineColumn({ id: 'dia', label: 'Dia', type: 'date', grains: g(GRAINS.AUDIT_ENTRY), groupable: true }),
  defineColumn({ id: 'usuario', label: 'Usuário', type: 'entity', grains: g(GRAINS.AUDIT_ENTRY), groupable: true, defaultVisible: true, accessor: (row) => row.usuario_id, display: (row) => row.usuario_nome, sensitive: SENSITIVITY.AUDIT }),
  defineColumn({ id: 'entidade', label: 'Entidade', type: 'text', grains: g(GRAINS.AUDIT_ENTRY), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'acao', label: 'Ação', type: 'text', grains: g(GRAINS.AUDIT_ENTRY), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'registro', label: 'Registro', type: 'identifier', grains: g(GRAINS.AUDIT_ENTRY), defaultVisible: true, aggregations: ['count', 'countDistinct'] }),
  defineColumn({ id: 'resumo', label: 'Resumo', type: 'text', grains: g(GRAINS.AUDIT_ENTRY), defaultVisible: true, defaultWidth: 260 }),
  defineColumn({ id: 'campos_alterados', label: 'Campos alterados', type: 'text', grains: g(GRAINS.AUDIT_ENTRY), defaultVisible: true, defaultWidth: 220 }),
  defineColumn({ id: 'origem', label: 'Origem', type: 'text', grains: g(GRAINS.AUDIT_ENTRY), groupable: true }),
  defineColumn({ id: 'motivo', label: 'Motivo', type: 'text', grains: g(GRAINS.AUDIT_ENTRY) }),
];

export const DATA_ISSUE_COLUMNS = [
  defineColumn({ id: 'categoria_problema', label: 'Tipo de problema', type: 'text', grains: g(GRAINS.DATA_ISSUE), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'gravidade', label: 'Gravidade', type: 'enum', grains: g(GRAINS.DATA_ISSUE), groupable: true, defaultVisible: true, options: [{ value: 'ALTA', label: 'Alta' }, { value: 'MEDIA', label: 'Média' }, { value: 'BAIXA', label: 'Baixa' }] }),
  defineColumn({ id: 'area', label: 'Área', type: 'text', grains: g(GRAINS.DATA_ISSUE), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'registro', label: 'Registro', type: 'identifier', grains: g(GRAINS.DATA_ISSUE), defaultVisible: true, aggregations: ['count', 'countDistinct'] }),
  defineColumn({ id: 'descricao', label: 'Descrição', type: 'text', grains: g(GRAINS.DATA_ISSUE), defaultVisible: true, defaultWidth: 380 }),
];

export const BACKUP_COLUMNS = [
  defineColumn({ id: 'data_hora', label: 'Data e hora', type: 'datetime', grains: g(GRAINS.BACKUP_ENTRY), defaultVisible: true, defaultWidth: 140 }),
  defineColumn({ id: 'tipo', label: 'Tipo', type: 'text', grains: g(GRAINS.BACKUP_ENTRY), groupable: true, defaultVisible: true }),
  defineColumn({ id: 'arquivo', label: 'Arquivo', type: 'text', grains: g(GRAINS.BACKUP_ENTRY), defaultVisible: true, defaultWidth: 280 }),
  defineColumn({ id: 'tamanho_bytes', label: 'Tamanho', unit: 'bytes', type: 'integer', grains: g(GRAINS.BACKUP_ENTRY), defaultVisible: true, aggregations: ['countValid', 'sum', 'max'] }),
  defineColumn({ id: 'sha256', label: 'SHA-256', type: 'identifier', grains: g(GRAINS.BACKUP_ENTRY), defaultVisible: true, defaultWidth: 200 }),
  defineColumn({ id: 'formato', label: 'Formato', type: 'text', grains: g(GRAINS.BACKUP_ENTRY), groupable: true }),
];

const R = g(GRAINS.REGISTRY_ITEM);
export const REGISTRY_BASE_COLUMNS = [
  defineColumn({ id: 'nome', label: 'Nome', type: 'text', grains: R, defaultVisible: true, defaultWidth: 200 }),
  defineColumn({ id: 'ativo', label: 'Ativo', type: 'boolean', grains: R, groupable: true, defaultVisible: true }),
  defineColumn({ id: 'padrao', label: 'Padrão', type: 'boolean', grains: R, groupable: true, defaultVisible: true }),
  defineColumn({ id: 'criado_em', label: 'Criado em', type: 'date', grains: R }),
];

export const REGISTRY_EXTRA_COLUMNS = {
  marcas: [defineColumn({ id: 'abreviacao', label: 'Abreviação', type: 'text', grains: R, defaultVisible: true })],
  racas: [
    defineColumn({ id: 'abreviacao', label: 'Abreviação', type: 'text', grains: R, defaultVisible: true }),
    defineColumn({ id: 'grupo', label: 'Grupo racial', type: 'text', grains: R, groupable: true, defaultVisible: true }),
  ],
  categoriasAnimal: [
    defineColumn({ id: 'sexo_aplicavel', label: 'Sexo', type: 'enum', grains: R, groupable: true, defaultVisible: true, options: [...SEXO_OPTIONS, { value: 'AMBOS', label: 'Ambos (legado)' }] }),
    defineColumn({ id: 'peso_min_kg', label: 'Peso mínimo', unit: 'kg', type: 'weight', grains: R, defaultVisible: true, aggregations: ['countValid', 'min', 'max'] }),
    defineColumn({ id: 'peso_max_kg', label: 'Peso máximo', unit: 'kg', type: 'weight', grains: R, defaultVisible: true, aggregations: ['countValid', 'min', 'max'] }),
    defineColumn({ id: 'era', label: 'Era', type: 'text', grains: R, defaultVisible: true }),
    defineColumn({ id: 'ordem', label: 'Ordem', type: 'integer', grains: R, defaultVisible: true, aggregations: ['countValid', 'min', 'max'] }),
  ],
  parceiros: [
    defineColumn({ id: 'tipo_pessoa', label: 'Pessoa', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'documento', label: 'CPF/CNPJ', type: 'identifier', grains: R, defaultVisible: true }),
    defineColumn({ id: 'papeis', label: 'Papéis', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'cidade', label: 'Cidade', type: 'text', grains: R, groupable: true }),
    defineColumn({ id: 'uf', label: 'UF', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'registro_sif', label: 'SIF', type: 'text', grains: R }),
    defineColumn({ id: 'rendimento_padrao', label: 'Rendimento padrão', unit: '%', type: 'percentage', grains: R, aggregations: ['countValid', 'avg', 'min', 'max'] }),
  ],
  propriedades: [
    defineColumn({ id: 'tipo', label: 'Tipo', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'municipio', label: 'Município', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'uf', label: 'UF', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'codigo_oficial', label: 'Código oficial', type: 'identifier', grains: R }),
  ],
  causasMorte: [
    defineColumn({ id: 'categoria', label: 'Categoria', type: 'text', grains: R, groupable: true, defaultVisible: true }),
    defineColumn({ id: 'exige_observacao', label: 'Exige observação', type: 'boolean', grains: R, defaultVisible: true }),
  ],
  usuarios: [
    defineColumn({ id: 'login', label: 'Login', type: 'identifier', grains: R, defaultVisible: true, sensitive: SENSITIVITY.PERSONAL }),
    defineColumn({ id: 'perfil', label: 'Perfil', type: 'enum', grains: R, groupable: true, defaultVisible: true, options: [{ value: 'ADMIN', label: 'Administrador' }, { value: 'GESTOR', label: 'Gestor' }, { value: 'OPERADOR', label: 'Operador' }, { value: 'CONSULTA', label: 'Consulta' }] }),
    defineColumn({ id: 'ultimo_acesso', label: 'Último acesso', type: 'datetime', grains: R, defaultVisible: true }),
  ],
};
