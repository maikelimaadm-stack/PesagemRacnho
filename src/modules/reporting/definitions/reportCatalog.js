// Catálogo de relatórios (Modelo 1). E1 (1.4.0): 12 relatórios visíveis no catálogo (E1E: 10 — Vendas, Abates
// e Compras do período viraram os tipos do Comercial, e os 3 ids antigos são aliases); 4 de controle na
// aba Controle da Manutenção (M1 1.5.0: 5, com "Pesagens para conferir"); cadastros.* e os bloqueados (com
// motivo, nunca simulados) ficam fora da interface como backlog. Os 42 ids antigos consolidados continuam válidos como aliases
// (legacyAliases.js): getReportDefinition(idAntigo) devolve a definição nova.
import { REPORT_VISIBILITY } from '../domain/reportDefinition.js';
import { PESAGENS } from './pesagens.js';
import { REBANHO_ATUAL } from './rebanho.js';
import {
  EMBARQUES_ROMANEIO, FECHAMENTO_DIA, LOTES_OCUPACAO, MOV_LOTES, PESAGENS_PENDENCIAS, SAIDAS,
} from './operacional.js';
import { COMERCIAL } from './comercial.js';
import {
  CADASTROS_RELATORIOS, CADASTROS_USUARIOS, CONTROLE_AUDITORIA, CONTROLE_BACKUPS, CONTROLE_PESAGENS_CONFERIR, CONTROLE_QUALIDADE, EMBARQUES_PREVISTO_REALIZADO,
  RELATORIOS_BLOQUEADOS,
} from './controle.js';
import { DESEMPENHO } from './desempenho.js';
import { LEGACY_REPORT_ALIASES, getLegacyAlias } from './legacyAliases.js';

export { LEGACY_REPORT_ALIASES } from './legacyAliases.js';

// Ordem = ordem do catálogo dentro de cada família.
const DEFINITIONS = [
  REBANHO_ATUAL,
  LOTES_OCUPACAO,
  PESAGENS,
  FECHAMENTO_DIA,
  DESEMPENHO,
  MOV_LOTES,
  SAIDAS,
  // E1E: Vendas, Abates e Compras do período viraram os tipos do Comercial (os ids antigos são aliases).
  COMERCIAL,
  EMBARQUES_ROMANEIO,
  EMBARQUES_PREVISTO_REALIZADO,
  // Aba Controle da Manutenção
  CONTROLE_AUDITORIA,
  CONTROLE_QUALIDADE,
  CONTROLE_BACKUPS,
  PESAGENS_PENDENCIAS,
  // M1 (1.5.0): pesagem fora da curva — só aponta, nada sai das médias.
  CONTROLE_PESAGENS_CONFERIR,
  // Fora da interface
  ...CADASTROS_RELATORIOS,
  CADASTROS_USUARIOS,
  ...RELATORIOS_BLOQUEADOS,
];

const BY_ID = new Map();
for (const definition of DEFINITIONS) {
  if (BY_ID.has(definition.id)) throw new Error(`catálogo: relatório duplicado (${definition.id})`);
  BY_ID.set(definition.id, definition);
}
for (const [legacyId, entry] of Object.entries(LEGACY_REPORT_ALIASES)) {
  if (BY_ID.has(legacyId)) throw new Error(`catálogo: alias ${legacyId} colide com relatório existente`);
  if (!BY_ID.has(entry.id)) throw new Error(`catálogo: alias ${legacyId} aponta para relatório inexistente (${entry.id})`);
  // Modelo convertido leva a condição fixa do alias para `fixedFilters`, somada às lockedFilters da
  // definição num mapa por coluna: o relatório de destino não pode ter lockedFilters próprias.
  if (entry.fixed.length && BY_ID.get(entry.id).lockedFilters) throw new Error(`catálogo: alias ${legacyId} com condição fixa aponta para relatório com lockedFilters (${entry.id})`);
  // E1E: alias que virou TIPO (comercial.vendas → Comercial › Vendas) aponta para um tipo declarado do relatório.
  if (entry.view != null && !BY_ID.get(entry.id).views.some((view) => view.id === entry.view)) throw new Error(`catálogo: alias ${legacyId} aponta para tipo inexistente (${entry.id} › ${entry.view})`);
}

/** Relatórios de uma área da interface (padrão: catálogo de Relatórios — os 12). */
export function listReportDefinitions({ visibility = REPORT_VISIBILITY.CATALOG } = {}) {
  return DEFINITIONS.filter((definition) => definition.visibility === visibility);
}

/** Todas as definições do código (inclusive ocultas e bloqueadas) — gates e contratos. */
export function listAllReportDefinitions() {
  return [...DEFINITIONS];
}

/**
 * Resolve id atual OU id antigo consolidado.
 * @returns {{ definition: object, aliasId: string|null, alias: object|null } | null}
 */
export function resolveReportId(id) {
  const definition = BY_ID.get(id);
  if (definition) return { definition, aliasId: null, alias: null };
  const alias = getLegacyAlias(id);
  if (!alias) return null;
  return { definition: BY_ID.get(alias.id), aliasId: id, alias };
}

/** Definição pelo id; ids antigos consolidados devolvem a definição nova (alias). */
export function getReportDefinition(id) {
  return resolveReportId(id)?.definition ?? null;
}

export function isLegacyReportId(id) {
  return !BY_ID.has(id) && Boolean(getLegacyAlias(id));
}
