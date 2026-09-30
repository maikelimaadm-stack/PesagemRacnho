// E1F — "Meus relatórios" e "Novo relatório" na tela única de Relatórios. Um relatório do usuário é um MODELO
// (reportTemplateService, em appSettings — sem esquema novo): pessoal (só o dono vê) ou da empresa (compartilhado,
// só com reports.templates.share). Abre como qualquer relatório (?r=<base>&m=<id>), com o título "Relatório de
// <nome>", e só grava com "Salvar alterações" (o último estado não mexe nele). Funções puras que a tela usa
// (Relatorios.jsx, ReportView.jsx, MakgestaoScreen.jsx) e que o gate reports:novo-relatorio confere em Node;
// permissão continua no serviço (saveTemplate/renameTemplate/deleteTemplate, templateToRequest ao abrir).
import { can } from '../../auth/domain/permissionService.js';
import { getReportDefinition } from '../definitions/reportCatalog.js';
import { canRunReport } from '../domain/reportPermissions.js';
import { templatePayload } from '../domain/reportScreenState.js';
import { buildInitialReportState } from './reportInitialState.js';
import { reportSelectorOptions } from './reportScreenModel.js';
import { TEMPLATE_SCOPES, canManageTemplate, normalizeTemplateConfig, saveTemplate, templateNameTaken } from './reportTemplateService.js';

export const MY_REPORTS_FAMILY = 'meus';
export const MY_REPORTS_LABEL = 'Meus relatórios';
/** Valor da última opção do seletor "Relatório": abre o diálogo "Novo relatório" (não navega). */
export const NEW_REPORT_VALUE = '__novo-relatorio__';
export const NEW_REPORT_LABEL = '➕ Novo relatório…';
export const REPORT_NAME_MAX = 80;
const TEMPLATE_PREFIX = 'm:';

/** Valor no seletor de um relatório do usuário ("m:<id do modelo>"; os do catálogo são o id do relatório). */
export const templateOptionValue = (templateId) => `${TEMPLATE_PREFIX}${templateId}`;

/** Valor do seletor → o que abrir: relatório do catálogo, relatório do usuário (modelo) ou o diálogo "Novo". */
export function parseReportOption(value) {
  const text = String(value ?? '');
  if (text === NEW_REPORT_VALUE) return { kind: 'new' };
  if (text.startsWith(TEMPLATE_PREFIX) && text.length > TEMPLATE_PREFIX.length) return { kind: 'template', templateId: text.slice(TEMPLATE_PREFIX.length) };
  return { kind: 'report', reportId: text };
}

/** Quem pode pôr "A empresa" em "Quem vê" (e Salvar como… compartilhado). */
export const canShareReports = (actor) => Boolean(actor?.role && can(actor.role, 'reports.templates.share'));

/** Pode "Salvar alterações", Renomear e Excluir: pessoal só o dono; da empresa, quem compartilha. */
export const canEditReport = (template, actor) => canManageTemplate(template, actor);

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const isShared = (template) => template?.scope === TEMPLATE_SCOPES.SHARED;

/** Visível ao ator (mesma regra de listTemplates): base que o perfil abre; pessoal só do dono. */
function visibleTo(template, actor) {
  const definition = template?.id ? getReportDefinition(template.baseReportId) : null;
  if (!definition || !actor?.role || !canRunReport(definition, actor.role)) return false;
  return isShared(template) || template.ownerUserId === actor.id;
}

/** Opção de um relatório do usuário no seletor (grupo "Meus relatórios"). */
export function myReportOption(template) {
  const definition = getReportDefinition(template.baseReportId);
  return {
    value: templateOptionValue(template.id), label: template.name, family: MY_REPORTS_FAMILY, familyLabel: MY_REPORTS_LABEL,
    templateId: template.id, baseReportId: definition?.id ?? template.baseReportId, baseLabel: definition?.title ?? template.baseReportId, shared: isShared(template),
  };
}

/**
 * Grupo "Meus relatórios" do seletor: os pessoais do usuário e os da empresa, de todas as bases que ele abre
 * (listTemplates — conferido de novo aqui), pessoais primeiro e cada parte por nome; no fim, "➕ Novo relatório…".
 */
export function myReportOptions(templates = [], actor = null) {
  const mine = (templates ?? []).filter((template) => visibleTo(template, actor))
    .sort((a, b) => Number(isShared(a)) - Number(isShared(b)) || collator.compare(String(a.name), String(b.name)));
  return [
    ...mine.map(myReportOption),
    { value: NEW_REPORT_VALUE, label: NEW_REPORT_LABEL, family: MY_REPORTS_FAMILY, familyLabel: MY_REPORTS_LABEL, action: 'new' },
  ];
}

/** Seletor "Relatório" completo: o catálogo do perfil (+ o aberto por link) e, no fim, "Meus relatórios". */
export const withMyReports = (options, templates, actor) => [...(options ?? []), ...myReportOptions(templates, actor)];

/**
 * Relatório do usuário aberto que ainda não está na lista (recém-salvo, lista relendo): entra no grupo, antes do
 * "➕ Novo relatório…", para o campo mostrar o nome dele.
 */
export function withTemplateOption(options, template) {
  if (!template?.id || options.some((option) => option.value === templateOptionValue(template.id))) return options;
  const at = options.findIndex((option) => option.value === NEW_REPORT_VALUE);
  const option = myReportOption(template);
  return at < 0 ? [...options, option] : [...options.slice(0, at), option, ...options.slice(at)];
}

/** Valor do seletor para a tela aberta: o relatório do usuário (modelo) ou o relatório do catálogo. */
export const selectorValue = (definitionId, template = null) => (template?.id ? templateOptionValue(template.id) : definitionId);

/** Título da tela: "Relatório de <nome do relatório do usuário>" ou "Relatório de <relatório>". */
export const reportTitle = (definition, template = null) => `Relatório de ${template?.name || definition.sheetTitle || definition.title}`;

/** Bases do "Novo relatório": os relatórios do catálogo do perfil, agrupados por assunto (a ordem do seletor). */
export function newReportBases(actor) {
  const groups = [];
  for (const option of reportSelectorOptions(actor)) {
    const last = groups[groups.length - 1];
    if (last && last.family === option.family) last.items.push({ value: option.value, label: option.label });
    else groups.push({ family: option.family, label: option.familyLabel, items: [{ value: option.value, label: option.label }] });
  }
  return groups;
}

/** Estado padrão da base (como ela abre sem modelo nem último estado): tipo padrão, colunas, filtros e período padrão. */
export const defaultReportState = (definition, role) => buildInitialReportState(definition, { role }).state;

/**
 * Pedido de saveTemplate de um relatório novo: a seleção padrão da base (o mesmo recorte que "Salvar modelo" grava —
 * só colunas e totais que o autor vê), com nome e "Quem vê".
 */
export function newReportInput(definition, { name, scope = TEMPLATE_SCOPES.PERSONAL, role }) {
  return { ...templatePayload(definition, defaultReportState(definition, role), role), name: String(name ?? '').trim(), scope: scope === TEMPLATE_SCOPES.SHARED ? TEMPLATE_SCOPES.SHARED : TEMPLATE_SCOPES.PERSONAL };
}

function invalid(message) {
  const error = new Error(message);
  error.code = 'REPORT_TEMPLATE_INVALID';
  return error;
}

/**
 * Cria um relatório do usuário a partir de uma base do catálogo do perfil. Regras do serviço (saveTemplate): nome
 * obrigatório, até 80, único por base e escopo; "A empresa" só com reports.templates.share; base que o perfil
 * não abre = AUTH_FORBIDDEN. Base fora do catálogo (aba Controle da Manutenção, ocultos) não vira relatório.
 */
export async function createCustomReport({ baseReportId, name, scope = TEMPLATE_SCOPES.PERSONAL } = {}, actor, options = {}) {
  const definition = getReportDefinition(baseReportId);
  if (!definition) throw invalid('Relatório base inexistente');
  const inCatalog = actor?.role && canRunReport(definition, actor.role) ? reportSelectorOptions(actor).some((option) => option.value === definition.id) : true;
  if (!inCatalog) throw invalid('Esta base não está no catálogo de Relatórios');
  return saveTemplate({ ...newReportInput(definition, { name, scope, role: actor?.role }), baseReportId: definition.id }, actor, options);
}

/**
 * Nome do relatório (Novo, Salvar como…, Renomear), antes de chamar o serviço: obrigatório, até 80 e único na base
 * e no escopo (a regra de saveTemplate). null = ok.
 * @param templates relatórios que o ator vê (listTemplates); exceptId = o próprio (Renomear)
 */
export function reportNameError(name, { templates = [], baseReportId, scope = TEMPLATE_SCOPES.PERSONAL, actor, ownerUserId = actor?.id, exceptId = null } = {}) {
  const clean = String(name ?? '').trim();
  if (!clean) return 'Informe o nome do relatório.';
  if (clean.length > REPORT_NAME_MAX) return `Nome com mais de ${REPORT_NAME_MAX} caracteres.`;
  if (baseReportId && templateNameTaken(templates, { baseReportId, scope, ownerUserId, name: clean, exceptId })) {
    return scope === TEMPLATE_SCOPES.SHARED ? 'Já existe um relatório da empresa com esse nome nesta base.' : 'Você já tem um relatório com esse nome nesta base.';
  }
  return null;
}

// JSON com as chaves em ordem: a mesma seleção dá o mesmo texto (filtro marcado em outra ordem não é "alteração").
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Retrato do que "Salvar alterações" gravaria (templatePayload normalizado como o serviço grava): comparar com o
 * retrato de quando o relatório abriu (ou foi salvo) diz se há alteração. Não entra o que não vai para o modelo
 * (detalhe de um grupo, "Mostrar colunas vazias", "Mostrar Detalhes").
 */
export function reportSnapshot(definition, state, role) {
  const payload = templatePayload(definition, state, role);
  let config = payload;
  try {
    config = normalizeTemplateConfig(definition, payload);
  } catch {
    /* seleção que o serviço recusaria: compara como está (o Salvar mostra o erro) */
  }
  return stableStringify(config);
}

/** Há alteração não salva no relatório do usuário aberto (baseline = reportSnapshot de quando abriu/salvou). */
export const isReportChanged = (baseline, definition, state, role) => Boolean(baseline) && reportSnapshot(definition, state, role) !== baseline;
