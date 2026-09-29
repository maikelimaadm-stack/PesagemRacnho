// Botões "Agrupar por" de um tipo de relatório (E1D, item 4 — Analítico: Lote, Apartação, Sexo, Raça), como no
// MAKGESTAO: vários ao mesmo tempo, na ORDEM DE CLIQUE (1º clique = 1º nível), clicar de novo tira o nível, no
// máximo MAX_GROUP_LEVELS (limite do motor — o 4º clique não entra). Puro: a tela (AnalyticGroupButtons) e o
// gate reports:columns-per-type usam a mesma regra. Os níveis saem sem direção (ordem natural dos grupos).
import { MAX_GROUP_LEVELS } from './groupEngine.js';

const toGroups = (ids) => ids.map((columnId) => ({ columnId }));

/** Níveis ligados, na ordem de clique (só os que são botões do tipo). */
export function activeGroupChoices(choices, groups) {
  return (groups ?? []).map((group) => group?.columnId).filter((columnId) => (choices ?? []).includes(columnId));
}

/**
 * Clique num botão: liga no fim (próximo nível) ou desliga (os de baixo sobem). Com o máximo de níveis ligado,
 * o clique num botão desligado não muda nada (blocked). Coluna que não é botão do tipo também não muda nada.
 * @returns {{ groups: { columnId: string }[], blocked: boolean }}
 */
export function toggleGroupChoice(choices, groups, columnId) {
  const active = activeGroupChoices(choices, groups);
  if (!(choices ?? []).includes(columnId)) return { groups: toGroups(active), blocked: true };
  if (active.includes(columnId)) return { groups: toGroups(active.filter((id) => id !== columnId)), blocked: false };
  if (active.length >= MAX_GROUP_LEVELS) return { groups: toGroups(active), blocked: true };
  return { groups: toGroups([...active, columnId]), blocked: false };
}
