import React from "react";
import { MAX_GROUP_LEVELS } from "@/modules/reporting/domain/groupEngine";
import { activeGroupChoices, toggleGroupChoice } from "@/modules/reporting/domain/groupChoices";

// E1D — botões "Agrupar por" do Analítico (Detalhado), como no MAKGESTAO: Lote, Apartação, Sexo, Raça, vários
// ao mesmo tempo, na ORDEM DE CLIQUE (1º clique = 1º nível). Clicar de novo tira o nível. No máximo 3 níveis
// (limite do motor): com 3 ligados, o 4º não entra — a dica do botão explica. Regra em domain/groupChoices.js.
// Só troca os grupos: o tipo continua o Analítico (quem chama faz update({ groups, drill: [] }) sem mexer em
// view). Reusa a pílula dos filtros rápidos (rpt-quick-filter / is-on); o visual final é da E1E.

/**
 * @param {{ choices: string[], groups: { columnId: string }[], labelOf: (columnId: string) => string,
 *   onChange: (groups: { columnId: string }[]) => void }} props
 *   choices = view.groupChoices (ids de coluna, na ordem dos botões); groups = níveis atuais (state.groups).
 */
export default function AnalyticGroupButtons({ choices, groups, labelOf, onChange }) {
  const active = activeGroupChoices(choices, groups);
  const full = active.length >= MAX_GROUP_LEVELS;
  const toggle = (columnId) => {
    const next = toggleGroupChoice(choices, groups, columnId);
    if (!next.blocked) onChange(next.groups);
  };
  const hint = (columnId, label) => {
    const index = active.indexOf(columnId);
    if (index >= 0) return `${index + 1}º nível do agrupamento. Clique de novo para tirar ${label}.`;
    if (full) return `No máximo ${MAX_GROUP_LEVELS} níveis de agrupamento: tire um deles para agrupar por ${label}.`;
    return active.length ? `Agrupar também por ${label} (${active.length + 1}º nível).` : `Agrupar por ${label}.`;
  };
  return (
    <div className="rpt-bar-field" data-field="agrupar-tipo">
      <span className="rpt-bar-field__label" id="rpt-bar-label-agrupar-tipo">Agrupar por</span>
      <div className="rpt-bar-field__static" role="group" aria-labelledby="rpt-bar-label-agrupar-tipo">
        {choices.map((columnId) => {
          const label = labelOf(columnId);
          const on = active.includes(columnId);
          const blocked = !on && full;
          return (
            <button
              key={columnId}
              type="button"
              className={`rpt-quick-filter${on ? " is-on" : ""}`}
              aria-pressed={on}
              aria-disabled={blocked || undefined}
              title={hint(columnId, label)}
              onClick={() => toggle(columnId)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
