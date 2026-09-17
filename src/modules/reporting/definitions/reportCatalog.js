// Catálogo de relatórios (Modelo 1). Uma entrada por relatório pronto; relatórios que a
// auditoria classificou como "REQUER NOVA MODELAGEM" ou "NÃO DEVE SER FEITO AGORA" aparecem
// como bloqueados (com motivo), nunca simulados.
import { PESAGENS_POR_LOTE, PESAGENS_POR_PERIODO, PESAGENS_POR_SESSAO } from './pesagens.js';
import { REBANHO_INVENTARIO, REBANHO_POR_DIMENSAO, REBANHO_SEM_PESAGEM } from './rebanho.js';
import { DESEMPENHO_FAIXA_PESO, DESEMPENHO_INDIVIDUAL, DESEMPENHO_PERDENDO_PESO, DESEMPENHO_POR_DIMENSAO, DESEMPENHO_POR_LOTE } from './desempenho.js';

const DEFINITIONS = [
  PESAGENS_POR_PERIODO,
  PESAGENS_POR_SESSAO,
  PESAGENS_POR_LOTE,
  REBANHO_INVENTARIO,
  ...REBANHO_POR_DIMENSAO,
  REBANHO_SEM_PESAGEM,
  DESEMPENHO_INDIVIDUAL,
  DESEMPENHO_POR_LOTE,
  ...DESEMPENHO_POR_DIMENSAO,
  DESEMPENHO_PERDENDO_PESO,
  DESEMPENHO_FAIXA_PESO,
];

const BY_ID = new Map();
for (const definition of DEFINITIONS) {
  if (BY_ID.has(definition.id)) throw new Error(`catálogo: relatório duplicado (${definition.id})`);
  BY_ID.set(definition.id, definition);
}

export function listReportDefinitions() {
  return [...DEFINITIONS];
}

export function getReportDefinition(id) {
  return BY_ID.get(id) ?? null;
}
