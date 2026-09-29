import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MakDateControl from "@/components/mak/MakDateControl";
import { PERIOD_PRESETS } from "@/modules/reporting/domain/reportPeriod";

// Barra de filtros padrão dos relatórios (E1B §3, linha 1): campos com o rótulo em cima, como no modelo da
// responsável — Data início | Data fim | Período | Orientação | Tipo de relatório | Agrupar por | Ordenar por |
// Pesagem anterior. Só escolhe SELEÇÃO (período, agrupamento, modo, ordem, filtros): nenhuma conta aqui.
// Trocar uma data vira período "Personalizado" com as duas datas.

export const ORIENTATION_OPTIONS = Object.freeze([
  { value: "auto", label: "Automática" },
  { value: "portrait", label: "Retrato" },
  { value: "landscape", label: "Paisagem" },
]);

export const PREVIOUS_OPTIONS = Object.freeze([
  { value: "todos", label: "Todos" },
  { value: "com", label: "Com pesagem anterior" },
  { value: "sem", label: "Sem pesagem anterior" },
]);

function BarSelect({ id, label, value, options, onChange, disabled = false, title }) {
  return (
    <div className="rpt-bar-field" data-field={id}>
      <span className="rpt-bar-field__label" id={`rpt-bar-label-${id}`}>{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={`rpt-bar-${id}`} className="rpt-bar-field__control" aria-label={label} aria-labelledby={`rpt-bar-label-${id}`} title={title ?? label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function BarDate({ id, label, value, onChange }) {
  return (
    <div className="rpt-bar-field rpt-bar-field--date" data-field={id}>
      <span className="rpt-bar-field__label" id={`rpt-bar-label-${id}`}>{label}</span>
      <MakDateControl value={value ?? ""} onChange={(event) => onChange(event.target.value)} ariaLabel={label} className="rpt-bar-field__date" />
    </div>
  );
}

/**
 * @param {{ period?: object|null, resolvedPeriod?: {from, to}|null, onPeriod?: Function, orientation: string,
 *   onOrientation: Function, views: object[], viewId: string, onView: Function, groupOptions: object[],
 *   groupValue: string, onGroup: Function, sortOptions: object[], sortValue: string, onSort: Function,
 *   previous?: { value: string, onChange: Function }|null, typeControls?: React.ReactNode }} props
 *   typeControls (E1D): controles próprios do tipo atual (eixos da matriz, botões de agrupamento do
 *   Analítico), logo depois do "Tipo de relatório". O visual final é da E1E.
 */
export default function ReportFilterBar({
  period = null, resolvedPeriod = null, onPeriod,
  orientation, onOrientation,
  views, viewId, onView,
  groupOptions, groupValue, onGroup,
  sortOptions, sortValue, onSort,
  previous = null,
  typeControls = null,
}) {
  const from = period?.preset === "personalizado" ? period.from : resolvedPeriod?.from;
  const to = period?.preset === "personalizado" ? period.to : resolvedPeriod?.to;
  const setDate = (edge, value) => {
    if (!value) return;
    const next = { preset: "personalizado", from: from ?? value, to: to ?? value, [edge]: value };
    onPeriod(next);
  };
  const viewOptions = [...views.map((view) => ({ value: view.id, label: view.label })), ...(viewId === "custom" ? [{ value: "custom", label: "Personalizado" }] : [])];
  const sortChoices = sortValue === "custom" ? [...sortOptions, { value: "custom", label: "Personalizado" }] : sortOptions;
  return (
    <div className="rpt-filterbar" role="group" aria-label="Filtros do relatório">
      {onPeriod ? (
        <>
          <BarDate id="inicio" label="Data início" value={from} onChange={(value) => setDate("from", value)} />
          <BarDate id="fim" label="Data fim" value={to} onChange={(value) => setDate("to", value)} />
          <BarSelect
            id="periodo"
            label="Período"
            value={period?.preset ?? "ultimos_30_dias"}
            options={Object.entries(PERIOD_PRESETS).map(([value, label]) => ({ value, label }))}
            onChange={(preset) => onPeriod(preset === "personalizado" ? { preset, from, to } : { preset })}
          />
        </>
      ) : (
        <div className="rpt-bar-field rpt-bar-field--static" data-field="periodo">
          <span className="rpt-bar-field__label">Período</span>
          <span className="rpt-bar-field__static">Estado atual (hoje)</span>
        </div>
      )}
      <BarSelect id="orientacao" label="Orientação" value={orientation} options={ORIENTATION_OPTIONS} onChange={onOrientation} title="Orientação da folha na tela, na impressão e no PDF" />
      <BarSelect id="tipo" label="Tipo de relatório" value={viewId} options={viewOptions} onChange={(value) => value !== "custom" && onView(value)} />
      {typeControls}
      <BarSelect id="agrupar" label="Agrupar por" value={groupValue} options={groupOptions} onChange={onGroup} />
      <BarSelect id="ordenar" label="Ordenar por" value={sortValue} options={sortChoices} onChange={(value) => value !== "custom" && onSort(value)} />
      {previous ? <BarSelect id="anterior" label="Pesagem anterior" value={previous.value} options={PREVIOUS_OPTIONS} onChange={previous.onChange} /> : null}
    </div>
  );
}
