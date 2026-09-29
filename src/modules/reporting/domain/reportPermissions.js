// Permissões de relatório (docs/reporting/PERMISSIONS.md). Genéricas — nunca uma por relatório.
// Toda decisão vem da MATRIX do permissionService; este módulo só traduz "sensibilidade da
// coluna" e "requires da definição" para ações. Usado pelo SERVIÇO (autoridade) e pela UI (conforto).
import { can, forbiddenError } from '../../auth/domain/permissionService.js';
import { SENSITIVITY } from './columnDefinition.js';

export const SENSITIVITY_PERMISSION = Object.freeze({
  [SENSITIVITY.COMMERCIAL]: 'commercial.values',
  [SENSITIVITY.AUDIT]: 'audit.read',
  [SENSITIVITY.PERSONAL]: 'users.manage',
});

// Campos que nunca saem em relatório, independentemente do perfil.
export const FORBIDDEN_FIELD_PATTERN = /(password|senha|salt|hash_senha|recovery|recuperacao|secret|segredo|token|credential)/i;

export function canSeeColumn(column, role) {
  if (FORBIDDEN_FIELD_PATTERN.test(column.id)) return false;
  if (!column.sensitive) return true;
  return can(role, SENSITIVITY_PERMISSION[column.sensitive]);
}

export function canRunReport(definition, role) {
  return definition.status !== 'blocked' && definition.requires.every((action) => can(role, action));
}

export function assertCanRunReport(definition, role) {
  for (const action of definition.requires) {
    if (!can(role, action)) throw forbiddenError(role, action);
  }
  if (definition.status === 'blocked') {
    const error = new Error(`Relatório indisponível: ${definition.blockedReason || 'bloqueado'}`);
    error.code = 'REPORT_BLOCKED';
    throw error;
  }
}

export function visibleColumns(definition, role) {
  return definition.columns.filter((column) => canSeeColumn(column, role));
}

/** Colunas pedidas que o papel não pode ver (para recusar ou avisar). */
export function forbiddenColumnIds(definition, role, columnIds = []) {
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  return columnIds.filter((id) => {
    const column = byId.get(id);
    return column && !canSeeColumn(column, role);
  });
}

/**
 * Seleção da tela sem as colunas e os totais que o papel não vê (E1D: o tipo Vendas traz Valor @ e Valor
 * total por padrão). Usado ao gravar modelo e último estado: o serviço recusa inteiro o que carrega coluna
 * que o autor não vê, e quem não tem commercial.values ficaria sem conseguir salvar nada em Vendas. Só tira.
 * @returns {{ columns: string[], aggregates: object[] }}
 */
export function withoutHiddenColumns(definition, role, { columns = [], aggregates = [] } = {}) {
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  const visible = (id) => byId.has(id) && canSeeColumn(byId.get(id), role);
  return {
    columns: columns.filter(visible),
    aggregates: aggregates.filter((spec) => !spec?.columnId || visible(spec.columnId)),
  };
}

/**
 * Exportação: reports.export + tudo que a definição exige + nenhuma coluna sensível sem permissão.
 * Chamado pelo serviço de exportação — recusa mesmo se a UI for contornada.
 */
export function assertCanExport(definition, role, columnIds = []) {
  if (!can(role, 'reports.export')) throw forbiddenError(role, 'reports.export');
  assertCanRunReport(definition, role);
  const blocked = forbiddenColumnIds(definition, role, columnIds);
  if (blocked.length) {
    const column = definition.columns.find((item) => item.id === blocked[0]);
    throw forbiddenError(role, SENSITIVITY_PERMISSION[column.sensitive] || 'reports.export');
  }
}

export function canShareTemplates(role) {
  return can(role, 'reports.templates.share');
}
