// Famílias EMBARQUES (previsto × realizado), CONTROLE, CADASTROS e relatórios BLOQUEADOS
// (classificados na auditoria como "requer nova modelagem" ou "não deve ser feito agora").
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import {
  AUDIT_COLUMNS, BACKUP_COLUMNS, DATA_ISSUE_COLUMNS, REGISTRY_BASE_COLUMNS, REGISTRY_EXTRA_COLUMNS, SHIPMENT_DOCUMENT_COLUMNS,
} from './columns/controlColumns.js';

export const EMBARQUES_PREVISTO_REALIZADO = defineReport({
  id: 'embarques.previsto-realizado', family: 'embarques', grain: GRAINS.SHIPMENT_DOCUMENT, version: 1, source: 'shipments.documents',
  requires: ['reports.read', 'shipment.read'], columns: SHIPMENT_DOCUMENT_COLUMNS, title: 'Embarques: previsto × realizado',
  description: 'Por documento de embarque: machos e fêmeas previstos contra as saídas efetivamente vinculadas.',
  params: [{ id: 'periodo', type: 'period', label: 'Período do embarque', required: false, default: { preset: 'ultimos_90_dias' } }],
  metrics: ['Previsto', 'Realizado', 'Diferença'],
  defaultColumns: ['embarque', 'data_embarque', 'destino', 'tipo_documento', 'numero_gta', 'prev_machos', 'real_machos', 'prev_femeas', 'real_femeas', 'prev_total', 'real_total', 'diferenca_total', 'peso_total_real'],
  defaultGroups: [{ columnId: 'embarque' }],
  defaultSort: [{ columnId: 'data_embarque', direction: 'asc' }],
  defaultAggregates: [{ id: 'documentos', op: 'count' }, { id: 'previsto', columnId: 'prev_total', op: 'sum' }, { id: 'realizado', columnId: 'real_total', op: 'sum' }, { id: 'diferenca', columnId: 'diferenca_total', op: 'sum' }, { id: 'peso', columnId: 'peso_total_real', op: 'sum' }],
  notes: ['Destino/frigorífico é o texto do embarque (sem vínculo canônico por parceiro).', 'Documento sem previsão informada: previsto e diferença ausentes (não zero).'],
});

export const CONTROLE_AUDITORIA = defineReport({
  id: 'controle.auditoria', family: 'controle', grain: GRAINS.AUDIT_ENTRY, version: 1, source: 'audit.byPeriod',
  requires: ['reports.read', 'audit.read'], columns: AUDIT_COLUMNS, title: 'Trilha de auditoria',
  description: 'Quem fez o quê e quando: criação, edição, cancelamento e demais ações auditadas no período.',
  params: [{ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_7_dias' } }],
  metrics: ['Ações', 'Registros afetados', 'Por usuário'],
  defaultColumns: ['data_hora', 'usuario', 'entidade', 'acao', 'registro', 'resumo', 'campos_alterados'],
  searchColumns: ['usuario', 'entidade', 'registro', 'resumo'],
  defaultSort: [{ columnId: 'data_hora', direction: 'desc' }],
  defaultAggregates: [{ id: 'acoes', op: 'count' }, { id: 'registros', columnId: 'registro', op: 'countDistinct' }],
  notes: ['Conteúdo anterior/posterior dos registros não é exibido (pode conter valores comerciais). Nenhum dado de autenticação é exibido.'],
});

export const CONTROLE_QUALIDADE = defineReport({
  id: 'controle.qualidade-dados', family: 'controle', grain: GRAINS.DATA_ISSUE, version: 1, source: 'data.quality',
  requires: ['reports.read', 'registry.read', 'weighing.read'], columns: DATA_ISSUE_COLUMNS, title: 'Qualidade dos dados',
  description: 'Referências quebradas, duplicidades, valores fora do padrão, registros legados e cadastros não resolvidos.',
  metrics: ['Problemas por tipo', 'Por gravidade'],
  defaultColumns: ['gravidade', 'categoria_problema', 'area', 'registro', 'descricao'],
  defaultGroups: [{ columnId: 'gravidade' }, { columnId: 'categoria_problema' }],
  defaultSort: [{ columnId: 'area', direction: 'asc' }],
  defaultAggregates: [{ id: 'problemas', op: 'count' }, { id: 'registros', columnId: 'registro', op: 'countDistinct' }],
});

export const CONTROLE_BACKUPS = defineReport({
  id: 'controle.backups', family: 'controle', grain: GRAINS.BACKUP_ENTRY, version: 1, source: 'backups.history',
  requires: ['reports.read', 'maintenance.backup'], columns: BACKUP_COLUMNS, title: 'Histórico de backups',
  description: 'Backups registrados: data, tipo, arquivo, tamanho e SHA-256 (somente metadados).',
  metrics: ['Backups', 'Último backup'],
  defaultColumns: ['data_hora', 'tipo', 'arquivo', 'tamanho_bytes', 'sha256'],
  defaultSort: [{ columnId: 'data_hora', direction: 'desc' }],
  defaultAggregates: [{ id: 'backups', op: 'count' }, { id: 'ultimo', columnId: 'data_hora', op: 'max' }],
});

const REGISTRIES = [
  ['marcas', 'Marcas'], ['racas', 'Raças'], ['categoriasAnimal', 'Categorias'], ['parceiros', 'Parceiros'],
  ['propriedades', 'Propriedades'], ['causasMorte', 'Causas de morte'],
];

export const CADASTROS_RELATORIOS = REGISTRIES.map(([store, title]) => defineReport({
  id: `cadastros.${store}`, family: 'cadastros', grain: GRAINS.REGISTRY_ITEM, version: 1, source: `registry.${store}`,
  requires: ['reports.read', 'registry.read'], title, presetOf: 'cadastros',
  description: `Lista de ${title.toLowerCase()} com situação e campos do cadastro.`,
  columns: [...REGISTRY_BASE_COLUMNS, ...(REGISTRY_EXTRA_COLUMNS[store] || [])],
  metrics: ['Itens', 'Ativos'],
  defaultSort: [{ columnId: 'nome', direction: 'asc' }],
  defaultAggregates: [{ id: 'itens', op: 'count' }],
}));

export const CADASTROS_USUARIOS = defineReport({
  id: 'cadastros.usuarios', family: 'cadastros', grain: GRAINS.REGISTRY_ITEM, version: 1, source: 'registry.usuarios',
  requires: ['reports.read', 'users.manage'], title: 'Usuários', presetOf: 'cadastros',
  description: 'Usuários locais com login, perfil, situação e último acesso. Nunca exibe credenciais.',
  columns: [REGISTRY_BASE_COLUMNS[0], REGISTRY_BASE_COLUMNS[1], REGISTRY_BASE_COLUMNS[3], ...REGISTRY_EXTRA_COLUMNS.usuarios],
  metrics: ['Usuários por perfil'],
  defaultColumns: ['nome', 'login', 'perfil', 'ativo', 'ultimo_acesso', 'criado_em'],
  defaultGroups: [{ columnId: 'perfil' }],
  defaultSort: [{ columnId: 'nome', direction: 'asc' }],
  defaultAggregates: [{ id: 'usuarios', op: 'count' }],
});

const blocked = (id, family, grain, title, blockedReason, requires = ['reports.read']) => defineReport({
  id, family, grain, version: 1, title, requires, status: 'blocked', blockedReason, description: title,
});

export const RELATORIOS_BLOQUEADOS = [
  blocked('rebanho.historico-data', 'rebanho', GRAINS.ANIMAL_CURRENT, 'Rebanho em data passada', 'não há fotografia do rebanho por data; reconstruir exige nova modelagem'),
  blocked('movimentacao.balanco', 'movimentacao', GRAINS.EVENT, 'Balanço de estoque (inicial + entradas − saídas)', 'depende do rebanho em data passada (nova modelagem)'),
  blocked('saidas.taxa-mortalidade', 'saidas', GRAINS.ANIMAL_PERIOD, 'Taxa de mortalidade', 'denominador não definido (estoque médio × animais-dia); decisão futura'),
  blocked('comercial.por-parceiro', 'comercial', GRAINS.EVENT, 'Totais canônicos por comprador/frigorífico', 'comprador e frigorífico são texto; parceiro_id não é gravado (modelagem v8)', ['reports.read', 'commercial.values']),
  blocked('comercial.operacao', 'comercial', GRAINS.EVENT, 'Operação comercial agregada (lote de venda, frete, líquido)', 'store de operações comerciais não existe (modelagem v8)', ['reports.read', 'commercial.values']),
  blocked('comercial.resultado', 'comercial', GRAINS.EVENT, 'Resultado econômico / custo por arroba', 'o sistema não registra custos', ['reports.read', 'commercial.values']),
  blocked('desempenho.projecao', 'desempenho', GRAINS.ANIMAL_PERIOD, 'Projeção de peso e data de abate', 'métrica sem fonte validada'),
  blocked('embarques.por-parceiro', 'embarques', GRAINS.SHIPMENT_DOCUMENT, 'Embarques por parceiro', 'embarques.parceiro_id nunca é gravado (índice vazio)'),
  blocked('cadastros.faixas-identificadores', 'cadastros', GRAINS.REGISTRY_ITEM, 'Faixas de identificadores', 'estrutura sem gravador (store vazia)'),
  blocked('controle.emissoes', 'controle', GRAINS.AUDIT_ENTRY, 'Registro de emissões de relatórios', 'a auditoria ainda não registra exportações; manifestos ficam na pasta de relatórios'),
];
