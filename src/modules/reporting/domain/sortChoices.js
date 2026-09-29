// "Ordenar por" fixo do relatório (E1D: as 8 opções do MAKGESTAO em Pesagens — definition.sortChoices).
// Uma opção vira a seleção equivalente do TIPO atual (contrato em docs/evidence/e1d/CONTRATOS-AGENTES.md §5):
//   Detalhado (Analítico, Vendas) → ordem das linhas (dentro de cada grupo);
//   Resumido                      → ordem das linhas dentro de cada seção pela métrica equivalente
//                                   (e a direção do nível de data, quando o tipo tem um).
// Nenhuma conta nova: só sort / summarySort / direção de grupo, que o motor da E1 já aplica.

/** Opção válida para a definição? (null/ausente = sem opção fixa) */
export function isKnownSortChoice(definition, choiceId) {
  return (definition?.sortChoices ?? []).some((choice) => choice.id === choiceId);
}

/**
 * Seleção equivalente à opção no tipo. Sem opção (ou relatório sem sortChoices) devolve a seleção como veio.
 * @param definition ReportDefinition
 * @param view tipo atual (objeto de listReportViews) ou null
 * @param {{ sort?: object[], summarySort?: object|null, groups?: object[] }} selection
 * @param {string|null} choiceId id de definition.sortChoices
 * @returns {{ sort: object[], summarySort: object|null, groups: object[] }}
 */
export function applySortChoice(definition, view, selection, choiceId) {
  const base = { sort: selection.sort ?? [], summarySort: selection.summarySort ?? null, groups: selection.groups ?? [] };
  if (!choiceId || !isKnownSortChoice(definition, choiceId)) return base;
  // Implementação: Agente C (E1D). Até lá, a opção não altera a seleção.
  void view;
  return base;
}
