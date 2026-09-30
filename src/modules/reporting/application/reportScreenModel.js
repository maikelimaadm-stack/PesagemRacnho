// Tela única de Relatórios (E1E): o que a tela do MAKGESTAO mostra para cada relatório — seletor
// "Relatório", relatório inicial e campos do cartão. Funções puras (sem React), as mesmas que a tela usa
// (Relatorios.jsx, ReportView.jsx) e que o gate reports:tela-unica confere em Node. Só SELEÇÃO: permissão
// continua no serviço (listReports/runReport), contas continuam no motor.
import { REPORT_FAMILIES, VIEW_LAYOUTS } from '../domain/reportDefinition.js';
import { canSeeColumn } from '../domain/reportPermissions.js';
import { getReportView } from '../domain/reportViews.js';
import { resolveReportId } from '../definitions/reportCatalog.js';
import { listReports } from './reportService.js';

/** Sem histórico, Relatórios abre em Pesagens. */
export const DEFAULT_REPORT_ID = 'pesagens';
/** Coluna do campo "Pesagem Anterior" (Todos/Com/Sem). */
export const PREVIOUS_COLUMN = 'tem_pesagem_anterior';
/** Ordem das famílias no seletor (a mesma do catálogo em cartões da 1.4.0). */
export const FAMILY_ORDER = Object.freeze(['rebanho', 'pesagens', 'desempenho', 'movimentacao', 'saidas', 'comercial', 'embarques', 'controle', 'cadastros']);

// Botões de filtro gerais (E1B §3, linha 2): o primeiro id que o relatório tiver; Proprietário e Categoria
// só quando a coluna existe.
export const FILTER_BUTTONS = Object.freeze([
  { label: 'Lotes', ids: ['nome_lote', 'lote', 'lote_atual'] },
  { label: 'Apartações', ids: ['nome_apartacao', 'apartacao', 'apartacao_atual'] },
  { label: 'Sexo', ids: ['sexo'], narrow: true },
  { label: 'Raças', ids: ['raca'] },
  { label: 'Era', ids: ['era'], narrow: true },
  { label: 'Marcas', ids: ['marca'] },
  { label: 'Proprietário', ids: ['proprietario'] },
  { label: 'Categoria', ids: ['categoria'] },
  { label: 'Status', ids: ['situacao_atual', 'situacao'], narrow: true },
]);

// Pesagens (E1D): a linha de botões do antigo (L620–729), nesta ordem, sem Categoria e Proprietário.
// `narrow`: lista w-48 do antigo (Sexo, Era, Status); as outras w-64.
export const MAK_FILTER_BUTTONS = Object.freeze([
  { label: 'Lotes', ids: ['nome_lote', 'lote', 'lote_atual'] },
  { label: 'Apartações', ids: ['nome_apartacao', 'apartacao', 'apartacao_atual'] },
  { label: 'Sexo', ids: ['sexo'], narrow: true },
  { label: 'Raças', ids: ['raca'] },
  { label: 'Era', ids: ['era'], narrow: true },
  { label: 'Marcas', ids: ['marca'] },
  { label: 'Status', ids: ['situacao_atual', 'situacao'], narrow: true },
]);

/** Pesagens: tela copiada do antigo na E1D (definição com `screen: 'makgestao'`) — botões e sem filtro rápido. */
export const isPesagensScreen = (definition) => definition?.screen === 'makgestao';

const familyRank = (family) => {
  const index = FAMILY_ORDER.indexOf(family);
  return index < 0 ? FAMILY_ORDER.length : index;
};

/**
 * Opções do campo "Relatório": o catálogo do perfil (listReports — inclusive "Controle" para quem não abre a
 * Manutenção; o Comercial só com commercial.values), sem os bloqueados, por família e na ordem do catálogo.
 * @returns {{ value: string, label: string, family: string, familyLabel: string }[]}
 */
export function reportSelectorOptions(actor) {
  return listReports(actor)
    .map((report, index) => ({ report, index }))
    .filter(({ report }) => report.available)
    .sort((a, b) => familyRank(a.report.family) - familyRank(b.report.family) || a.index - b.index)
    .map(({ report }) => ({ value: report.id, label: report.title, family: report.family, familyLabel: REPORT_FAMILIES[report.family] ?? report.family }));
}

/**
 * Relatório aberto fora da lista (link antigo de um relatório da aba Controle, por exemplo): entra no fim
 * do seletor para o campo mostrar o nome dele.
 */
export function withCurrentOption(options, definition) {
  if (!definition || options.some((option) => option.value === definition.id)) return options;
  return [...options, { value: definition.id, label: definition.title, family: definition.family, familyLabel: REPORT_FAMILIES[definition.family] ?? definition.family, extra: true }];
}

/**
 * Relatório de /Relatorios sem `?r=`: o último usado (recentes do usuário) que ainda está no seletor; sem
 * histórico, Pesagens; sem Pesagens no perfil, o primeiro da lista. Id antigo nos recentes vale pelo novo.
 */
export function initialReportId(recents = [], options = []) {
  const allowed = new Set(options.map((option) => option.value));
  for (const item of recents ?? []) {
    const id = resolveReportId(item?.reportId ?? '')?.definition?.id;
    if (id && allowed.has(id)) return id;
  }
  if (allowed.has(DEFAULT_REPORT_ID) || !options.length) return DEFAULT_REPORT_ID;
  return options[0].value;
}

/**
 * Botões de filtro do cartão: `{ button, column }` na ordem da lista (Pesagens: a da E1D; os outros: a geral).
 * @param columns colunas que o perfil vê (viewModel.availableColumns ou visibleColumns da definição)
 */
export function filterButtonsOf(definition, columns = []) {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return (isPesagensScreen(definition) ? MAK_FILTER_BUTTONS : FILTER_BUTTONS)
    .map((button) => {
      const column = button.ids.map((id) => byId.get(id)).find(Boolean);
      return column ? { button, column } : null;
    })
    .filter(Boolean);
}

/**
 * E1F (item 3): colunas do "Mais filtros…" — todas as filtráveis do relatório que o perfil vê e que NÃO têm
 * botão próprio no cartão (nem são o campo Pesagem Anterior), em ordem alfabética. Cada uma abre a mesma
 * lista de marcar (ou a condição, em número/data) dos botões; filtrada, vira botão com contador na linha.
 * @param columns colunas que o perfil vê (viewModel.availableColumns ou as visíveis da definição)
 * @returns {object[]} colunas da definição (com filterable/metricOnly/type)
 */
export function moreFilterColumnsOf(definition, columns = []) {
  const seen = new Set(columns.map((column) => column.id));
  const covered = new Set([...filterButtonsOf(definition, columns).map(({ column }) => column.id), PREVIOUS_COLUMN]);
  return (definition?.columns ?? [])
    .filter((column) => seen.has(column.id) && column.filterable !== false && !column.metricOnly && !covered.has(column.id))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { sensitivity: 'base' }));
}

/** Filtros rápidos da definição que viram botões no cartão (Pesagens fica como a E1D: sem eles). */
export const quickFiltersOf = (definition) => (isPesagensScreen(definition) ? [] : definition?.quickFilters ?? []);

/** Parâmetros inteiros do relatório (ex.: dias) — campos numéricos no cartão. */
export const integerParamsOf = (definition) => (definition?.params ?? []).filter((param) => param.type === 'integer');

/** Parâmetro de período do relatório (Data Início/Data Fim) ou null (estado atual). */
export const periodParamOf = (definition) => (definition?.params ?? []).find((param) => param.type === 'period') ?? null;

/**
 * Campos do cartão para um relatório e um tipo (padrão: o tipo padrão; sem ele, o primeiro), na ordem da tela.
 * @returns {{ fields: { id: string, label: string }[], sort: 'makgestao'|'e1b', filterButtons: string[], quickFilters: string[] }}
 */
export function cardFieldsOf(definition, { role, viewId = null } = {}) {
  const columns = (definition?.columns ?? []).filter((column) => canSeeColumn(column, role));
  const view = getReportView(definition, viewId ?? definition.defaultView ?? '') ?? null;
  const fields = [{ id: 'relatorio', label: 'Relatório' }];
  if (periodParamOf(definition)) fields.push({ id: 'inicio', label: 'Data Início' }, { id: 'fim', label: 'Data Fim' });
  else fields.push({ id: 'estado-atual', label: 'Período' });
  fields.push({ id: 'orientacao', label: 'Orientação' }, { id: 'tipo', label: 'Tipo Relatório' });
  if (view?.layout === VIEW_LAYOUTS.MATRIX) fields.push({ id: 'linhas', label: 'Linhas (Eixo Y)' }, { id: 'colunas', label: 'Colunas (Eixo X)' });
  fields.push({ id: 'ordenar', label: 'Ordenar Por' });
  if (columns.some((column) => column.id === PREVIOUS_COLUMN)) fields.push({ id: 'anterior', label: 'Pesagem Anterior' });
  for (const param of integerParamsOf(definition)) fields.push({ id: `param:${param.id}`, label: param.label });
  return {
    fields,
    sort: definition.sortChoices?.length ? 'makgestao' : 'e1b',
    filterButtons: filterButtonsOf(definition, columns).map(({ button }) => button.label),
    quickFilters: quickFiltersOf(definition).map((quick) => quick.label),
  };
}
