// Famílias EMBARQUES (previsto × realizado), CONTROLE, CADASTROS e relatórios BLOQUEADOS
// (classificados na auditoria como "requer nova modelagem" ou "não deve ser feito agora").
// E1 (1.4.0): auditoria, qualidade dos dados e backups aparecem na aba Controle da Manutenção;
// cadastros.* (as telas de cadastro já listam e exportam) e os bloqueados saem da interface (backlog).
// M1 (1.5.0): "Pesagens para conferir" (pesagem fora da curva) também na aba Controle da Manutenção.
import { REPORT_VISIBILITY, defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { defineColumn } from '../domain/columnDefinition.js';
import {
  AUDIT_COLUMNS, BACKUP_COLUMNS, DATA_ISSUE_COLUMNS, REGISTRY_BASE_COLUMNS, REGISTRY_EXTRA_COLUMNS, SHIPMENT_DOCUMENT_COLUMNS,
} from './columns/controlColumns.js';
import { EVENT_COLUMNS } from './columns/eventColumns.js';
import { listaTipo, resumoTipo } from './tipos.js';
import { CLASSE_PESAGEM } from '../../weighing/domain/weightOutliers.js';

// E1E "Tipo Relatório" (definitions/tipos.js); versão 2 = ganhou os tipos (ver rebanho.js).
const PREVISTO_COLUMNS = Object.freeze(['embarque', 'data_embarque', 'destino', 'tipo_documento', 'numero_gta', 'prev_machos', 'real_machos', 'prev_femeas', 'real_femeas', 'prev_total', 'real_total', 'diferenca_total', 'peso_total_real']);
const PREVISTO_TOTALS = Object.freeze([{ id: 'documentos', op: 'count' }, { id: 'previsto', columnId: 'prev_total', op: 'sum' }, { id: 'realizado', columnId: 'real_total', op: 'sum' }, { id: 'diferenca', columnId: 'diferenca_total', op: 'sum' }, { id: 'peso', columnId: 'peso_total_real', op: 'sum' }]);
export const PREVISTO_REALIZADO_VIEWS = Object.freeze([
  resumoTipo('por-embarque', 'Por Embarque', ['embarque'], PREVISTO_TOTALS),
  resumoTipo('por-destino', 'Por Destino', ['destino'], PREVISTO_TOTALS),
  listaTipo('analitico', 'Analítico (Lista de Documentos)', { from: SHIPMENT_DOCUMENT_COLUMNS, columns: PREVISTO_COLUMNS, aggregates: PREVISTO_TOTALS, sort: [{ columnId: 'data_embarque', direction: 'asc' }] }),
]);

export const EMBARQUES_PREVISTO_REALIZADO = defineReport({
  id: 'embarques.previsto-realizado', family: 'embarques', grain: GRAINS.SHIPMENT_DOCUMENT, version: 2, source: 'shipments.documents',
  requires: ['reports.read', 'shipment.read'], columns: SHIPMENT_DOCUMENT_COLUMNS, title: 'Embarques: previsto × realizado',
  description: 'Por documento de embarque: machos e fêmeas previstos contra as saídas efetivamente vinculadas.',
  params: [{ id: 'periodo', type: 'period', label: 'Período do embarque', required: false, default: { preset: 'ultimos_90_dias' } }],
  metrics: ['Previsto', 'Realizado', 'Diferença'],
  defaultColumns: [...PREVISTO_COLUMNS],
  defaultGroups: [{ columnId: 'embarque' }],
  defaultSort: [{ columnId: 'data_embarque', direction: 'asc' }],
  defaultAggregates: [...PREVISTO_TOTALS],
  views: PREVISTO_REALIZADO_VIEWS,
  defaultView: 'por-embarque',
  notes: ['Destino/frigorífico é o texto do embarque (sem vínculo canônico por parceiro).', 'Documento sem previsão informada: previsto e diferença ausentes (não zero).'],
});

export const CONTROLE_AUDITORIA = defineReport({
  id: 'controle.auditoria', family: 'controle', visibility: REPORT_VISIBILITY.MAINTENANCE, grain: GRAINS.AUDIT_ENTRY, version: 1, source: 'audit.byPeriod',
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
  id: 'controle.qualidade-dados', family: 'controle', visibility: REPORT_VISIBILITY.MAINTENANCE, defaultMode: 'DETALHADO', grain: GRAINS.DATA_ISSUE, version: 1, source: 'data.quality',
  requires: ['reports.read', 'registry.read', 'weighing.read'], columns: DATA_ISSUE_COLUMNS, title: 'Qualidade dos dados',
  description: 'Referências quebradas, duplicidades, valores fora do padrão, registros legados e cadastros não resolvidos.',
  metrics: ['Problemas por tipo', 'Por gravidade'],
  defaultColumns: ['gravidade', 'categoria_problema', 'area', 'registro', 'descricao'],
  defaultGroups: [{ columnId: 'gravidade' }, { columnId: 'categoria_problema' }],
  defaultSort: [{ columnId: 'area', direction: 'asc' }],
  defaultAggregates: [{ id: 'problemas', op: 'count' }, { id: 'registros', columnId: 'registro', op: 'countDistinct' }],
});

export const CONTROLE_BACKUPS = defineReport({
  id: 'controle.backups', family: 'controle', visibility: REPORT_VISIBILITY.MAINTENANCE, grain: GRAINS.BACKUP_ENTRY, version: 1, source: 'backups.history',
  requires: ['reports.read', 'maintenance.backup'], columns: BACKUP_COLUMNS, title: 'Histórico de backups',
  description: 'Backups registrados: data, tipo, arquivo, tamanho e SHA-256 (somente metadados).',
  metrics: ['Backups', 'Último backup'],
  defaultColumns: ['data_hora', 'tipo', 'arquivo', 'tamanho_bytes', 'sha256'],
  defaultSort: [{ columnId: 'data_hora', direction: 'desc' }],
  defaultAggregates: [{ id: 'backups', op: 'count' }, { id: 'ultimo', columnId: 'data_hora', op: 'max' }],
});

// M1 (1.5.0) — "Pesagens para conferir" (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §3). Uma linha por pesagem com
// classe ≠ OK (weighing/domain/weightOutliers.js; fonte weighings.check em controlSources.js). Só APONTA: a pesagem
// continua em média, total e gráfico de todos os relatórios — excluir exige gravar a resolução (M2).
export const PESAGENS_CONFERIR_ID = 'controle.pesagens-conferir';
const CLASSE_CONFERENCIA_OPTIONS = Object.freeze([
  { value: CLASSE_PESAGEM.SUSPEITA_ERRO, label: 'Suspeita de erro' },
  { value: CLASSE_PESAGEM.SUSPEITA_LOTE, label: 'Fora da curva do lote' },
  { value: CLASSE_PESAGEM.PERDA_POSSIVEL, label: 'Perda possível' },
]);
// Agrupar pela classe segue a ordem das regras (erro, lote, perda), não a do alfabeto.
const CLASSE_ORDEM = Object.freeze(Object.fromEntries(CLASSE_CONFERENCIA_OPTIONS.map((option, index) => [option.value, index + 1])));
export const PESAGENS_CONFERIR_COLUMNS = Object.freeze([
  ...EVENT_COLUMNS,
  defineColumn({
    id: 'classe_conferencia', label: 'Classe', type: 'enum', options: CLASSE_CONFERENCIA_OPTIONS, grains: [GRAINS.EVENT], groupable: true, defaultVisible: true,
    source: 'derivado', defaultWidth: 150, groupOrder: (row) => CLASSE_ORDEM[row?.classe_conferencia] ?? null,
    description: 'Suspeita de erro (variação acima de 25 %, ou perda acima de 10 % em menos de 14 dias), fora da curva do lote (8 animais ou mais) ou perda possível (até 5 % em até 28 dias, animal presente).',
  }),
  defineColumn({ id: 'motivo_conferencia', label: 'Motivo', type: 'text', grains: [GRAINS.EVENT], defaultVisible: true, source: 'derivado', defaultWidth: 260 }),
]);
export const PESAGENS_CONFERIR_COLUMN_IDS = Object.freeze([
  'numero_animal', 'data_pesagem', 'peso', 'peso_anterior', 'dias', 'ganho', 'gmd', 'classe_conferencia', 'motivo_conferencia', 'nome_lote', 'operador', 'origem_registro',
]);

export const CONTROLE_PESAGENS_CONFERIR = defineReport({
  id: PESAGENS_CONFERIR_ID, family: 'controle', visibility: REPORT_VISIBILITY.MAINTENANCE, grain: GRAINS.EVENT, version: 1, source: 'weighings.check',
  requires: ['reports.read', 'weighing.read'], columns: PESAGENS_CONFERIR_COLUMNS, title: 'Pesagens para conferir',
  description: 'Pesagens fora da curva: provável erro de balança ou digitação, fora da curva do lote ou perda possível. Só aponta — nada sai das médias.',
  params: [{ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_30_dias' } }],
  metrics: ['Por classe', 'Animais'],
  animalColumnId: 'numero_animal',
  defaultColumns: [...PESAGENS_CONFERIR_COLUMN_IDS],
  searchColumns: ['numero_animal', 'marca', 'nome_lote', 'motivo_conferencia'],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'numero_animal', direction: 'asc' }],
  defaultAggregates: [{ id: 'pesagens', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }],
  notes: [
    'A pesagem apontada continua na média, no total e nos gráficos dos relatórios: conferir não exclui nada.',
    'Fora da curva do lote: só com 8 animais ou mais com GMD confiável no mesmo lote e período.',
    'GMD de intervalo curto (menor que o mínimo de Configurações › Relatórios) não entra na mediana do lote.',
  ],
});

// Ações por linha na aba Controle (o que JÁ existe, sem esquema novo). `page` = createPageUrl(page):
// - Corrigir → o Lançamento com a pesagem aberta para edição (?editar=<id>, o mesmo link do "Editar" da Relação de
//   Pesagens): corrigir o peso (auditoria ATUALIZAR, série recalculada) ou Excluir a linha (exclusão lógica com
//   auditoria CANCELAR) e lançar de novo;
// - Ver ficha do animal → a Ficha do Animal (?animal=<id do animal>). Registro antigo sem animal: sem ação.
export const PESAGENS_CONFERIR_ACOES = Object.freeze([
  Object.freeze({ id: 'corrigir', label: 'Corrigir', permission: 'weighing.edit', page: (row) => (row?.id ? `LancamentoPesagensIndividuais?editar=${encodeURIComponent(row.id)}` : null) }),
  Object.freeze({
    id: 'ficha', label: 'Ver ficha do animal', permission: 'animal.read',
    page: (row) => {
      const animalId = row?.animal_id_resolvido ?? row?.animal_id ?? null;
      return animalId ? `FichaAnimal?animal=${encodeURIComponent(animalId)}` : null;
    },
  }),
]);

const REGISTRIES = [
  ['marcas', 'Marcas'], ['racas', 'Raças'], ['categoriasAnimal', 'Categorias'], ['parceiros', 'Parceiros'],
  ['propriedades', 'Propriedades'], ['causasMorte', 'Causas de morte'],
];

export const CADASTROS_RELATORIOS = REGISTRIES.map(([store, title]) => defineReport({
  id: `cadastros.${store}`, family: 'cadastros', grain: GRAINS.REGISTRY_ITEM, version: 1, source: `registry.${store}`,
  requires: ['reports.read', 'registry.read'], title, presetOf: 'cadastros', visibility: REPORT_VISIBILITY.HIDDEN,
  description: `Lista de ${title.toLowerCase()} com situação e campos do cadastro.`,
  columns: [...REGISTRY_BASE_COLUMNS, ...(REGISTRY_EXTRA_COLUMNS[store] || [])],
  metrics: ['Itens', 'Ativos'],
  defaultSort: [{ columnId: 'nome', direction: 'asc' }],
  defaultAggregates: [{ id: 'itens', op: 'count' }],
}));

export const CADASTROS_USUARIOS = defineReport({
  id: 'cadastros.usuarios', family: 'cadastros', grain: GRAINS.REGISTRY_ITEM, version: 1, source: 'registry.usuarios',
  requires: ['reports.read', 'users.manage'], title: 'Usuários', presetOf: 'cadastros', visibility: REPORT_VISIBILITY.HIDDEN,
  description: 'Usuários locais com login, perfil, situação e último acesso. Nunca exibe credenciais.',
  columns: [REGISTRY_BASE_COLUMNS[0], REGISTRY_BASE_COLUMNS[1], REGISTRY_BASE_COLUMNS[3], ...REGISTRY_EXTRA_COLUMNS.usuarios],
  metrics: ['Usuários por perfil'],
  defaultColumns: ['nome', 'login', 'perfil', 'ativo', 'ultimo_acesso', 'criado_em'],
  defaultGroups: [{ columnId: 'perfil' }],
  defaultSort: [{ columnId: 'nome', direction: 'asc' }],
  defaultAggregates: [{ id: 'usuarios', op: 'count' }],
});

const blocked = (id, family, grain, title, blockedReason, requires = ['reports.read']) => defineReport({
  id, family, grain, version: 1, title, requires, status: 'blocked', blockedReason, description: title, visibility: REPORT_VISIBILITY.HIDDEN,
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
