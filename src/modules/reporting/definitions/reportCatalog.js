// Catálogo de relatórios (Modelo 1). E1 (1.4.0): 12 relatórios visíveis no catálogo; 4 de controle na
// aba Controle da Manutenção; cadastros.* e os bloqueados (com motivo, nunca simulados) ficam fora da
// interface como backlog. Os 42 ids antigos consolidados continuam válidos como aliases
// (legacyAliases.js): getReportDefinition(idAntigo) devolve a definição nova.
import { REPORT_VISIBILITY } from '../domain/reportDefinition.js';
import { PESAGENS } from './pesagens.js';
import { REBANHO_ATUAL } from './rebanho.js';
import {
  COMERCIAL_ABATES, COMERCIAL_COMPRAS, COMERCIAL_VENDAS, EMBARQUES_ROMANEIO, FECHAMENTO_DIA, LOTES_OCUPACAO, MOV_LOTES, PESAGENS_PENDENCIAS, SAIDAS,
} from './operacional.js';
import {
  CADASTROS_RELATORIOS, CADASTROS_USUARIOS, CONTROLE_AUDITORIA, CONTROLE_BACKUPS, CONTROLE_QUALIDADE, EMBARQUES_PREVISTO_REALIZADO, RELATORIOS_BLOQUEADOS,
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
  COMERCIAL_VENDAS,
  COMERCIAL_ABATES,
  COMERCIAL_COMPRAS,
  EMBARQUES_ROMANEIO,
  EMBARQUES_PREVISTO_REALIZADO,
  // Aba Controle da Manutenção
  CONTROLE_AUDITORIA,
  CONTROLE_QUALIDADE,
  CONTROLE_BACKUPS,
  PESAGENS_PENDENCIAS,
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
