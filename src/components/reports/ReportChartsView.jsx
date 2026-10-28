import React, { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { buildReportChart, chartOptionsOf, chartsOf, inLegend, normalizeChartConfig, withHiddenSeries } from "@/modules/reporting/domain/reportCharts";
import { renderChartTable } from "@/modules/reporting/infrastructure/exporters/chartSvg";
import { CHART_SCREEN_CSS } from "@/modules/reporting/infrastructure/exporters/chartStyles";
import ChartPlot from "./ChartPlot";

// E1G etapa 2 — vista "Gráficos" da tela única (docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B). Grade de
// cartões (2 colunas com a área ≥ 1200 px, 1 abaixo): título e subtítulo (período, definição do GMD, cobertura),
// os controles do próprio gráfico, o SVG da MESMA renderChartSvg da impressão (ChartPlot) com hover/foco, a legenda
// que liga/desliga série (sem recalcular nem repintar: a cor é da entidade), grupos sem valor, notas e "Ver tabela"
// (a mesma tabela de dados do papel). Os números saem de buildReportChart sobre o view model JÁ carregado — nenhum
// gráfico volta ao banco, e trocar de vista não roda o relatório de novo. Clique numa barra → onDrill (a folha no
// detalhe daquele grupo).

const slotName = (slot) => (typeof slot === "number" ? `s${slot}` : String(slot ?? "demais"));
// Até 3 opções: botões lado a lado; mais que isso, lista.
const SEGMENTED_MAX = 3;

function ChartControl({ chartId, control, onOption }) {
  if (control.choices.length < 2) return null;
  const id = `rpt-chart-${chartId}-${control.id}`;
  if (control.choices.length <= SEGMENTED_MAX) {
    return (
      <div className="rpt-chart__ctl" role="group" aria-label={control.label}>
        <span className="rpt-chart__ctl-label">{control.label}</span>
        <span className="rpt-chart__seg">
          {control.choices.map((choice) => (
            <button key={choice.id} type="button" className={`rpt-chart__seg-btn${choice.id === control.value ? " is-on" : ""}`} aria-pressed={choice.id === control.value} onClick={() => choice.id !== control.value && onOption(control.id, choice.id)}>
              {choice.label}
            </button>
          ))}
        </span>
      </div>
    );
  }
  return (
    <div className="rpt-chart__ctl">
      <label className="rpt-chart__ctl-label" htmlFor={id}>{control.label}</label>
      <select id={id} className="rpt-chart__select" value={control.value ?? ""} onChange={(event) => onOption(control.id, event.target.value)}>
        {control.choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
      </select>
    </div>
  );
}

function ChartLegend({ chart, onToggle }) {
  if (!chart.legenda) return null;
  const shape = chart.kind === "linha" ? " rc-key--line" : chart.kind === "halteres" ? " rc-key--dot" : "";
  const series = chart.series.filter(inLegend);
  // Linha e colunas: cada item liga/desliga a série. Halteres: legenda fixa (peso inicial × final).
  const interactive = chart.kind === "linha" || chart.kind === "colunas";
  return (
    <ul className="rc-legend rpt-chart__legend" aria-label={interactive ? "Séries (clique para esconder ou mostrar)" : "Legenda"}>
      {series.map((item) => (
        <li key={item.key} className={`rc-legend__item${item.oculto ? " is-off" : ""}`}>
          {interactive ? (
            <button type="button" className={`rpt-chart__legend-btn${item.oculto ? " is-off" : ""}`} aria-pressed={!item.oculto} title={item.oculto ? `Mostrar ${item.label}` : `Esconder ${item.label}`} onClick={() => onToggle(item.key)}>
              <span className={`rc-key${shape} rc-${slotName(item.slot)}`} aria-hidden="true" />{item.label}
            </button>
          ) : (
            <><span className={`rc-key${shape} rc-${slotName(item.slot)}`} aria-hidden="true" />{item.label}</>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({ viewModel, chart, config, index, onOption, onToggleSeries, onDrill }) {
  const options = chartOptionsOf(chart, config, viewModel);
  const optionsKey = Object.keys(chart.controls).map((id) => `${id}=${options[id]?.id ?? ""}`).join("|");
  const hiddenKey = options.oculto.join("|");
  // Um gráfico por vez, só com a vista aberta; a legenda (séries ocultas) não volta ao motor.
  const base = useMemo(() => buildReportChart(viewModel, chart, { ...options, oculto: [] }), [viewModel, chart, optionsKey]);
  const data = useMemo(() => withHiddenSeries(base, options.oculto), [base, hiddenKey]);
  const [table, setTable] = useState(false);
  const tableHtml = useMemo(() => (table ? renderChartTable(data) : ""), [table, data]);
  const controls = data.controls.filter((control) => control.choices.length > 1);
  return (
    <figure className="rpt-chart" data-chart-id={chart.id} data-kind={chart.kind}>
      <figcaption className="rpt-chart__head">
        <span className="rpt-chart__title">{data.title}</span>
        {data.subtitle ? <span className="rpt-chart__sub">{data.subtitle}</span> : null}
      </figcaption>
      {controls.length ? (
        <div className="rpt-chart__controls" role="group" aria-label={`Opções do gráfico ${data.title}`}>
          {controls.map((control) => <ChartControl key={control.id} chartId={chart.id} control={control} onOption={(key, value) => onOption(chart.id, key, value)} />)}
        </div>
      ) : null}
      {data.vazio ? (
        <p className="rpt-chart__empty" role="note">{data.textoVazio}</p>
      ) : (
        <ChartPlot chart={data} uid={`rcs-${index}`} onDrill={onDrill} />
      )}
      <ChartLegend chart={data} onToggle={(key) => onToggleSeries(chart.id, key)} />
      {data.semValor?.texto ? <p className="rc-semvalor">{data.semValor.texto}</p> : null}
      {data.notas?.length ? <ul className="rc-notes">{data.notas.map((nota) => <li key={nota}>{nota}</li>)}</ul> : null}
      {data.tabela?.linhas?.length ? (
        <div className="rpt-chart__foot">
          <button type="button" className="rpt-mak-btn rpt-mak-btn--sm rpt-chart__table-btn" aria-expanded={table} onClick={() => setTable((open) => !open)}>
            <Table2 aria-hidden="true" />{table ? "Esconder tabela" : "Ver tabela"}
          </button>
        </div>
      ) : null}
      {table ? <div className="rpt-chart__table" dangerouslySetInnerHTML={{ __html: tableHtml }} /> : null}
    </figure>
  );
}

/**
 * @param viewModel resultado de runReport já carregado (o mesmo da folha)
 * @param config state.charts ({ [chartId]: { serie?, eixo?, metrica?, faixa?, oculto? } })
 * @param onOption (chartId, controle, opção) · onToggleSeries (chartId, série) · onDrill (caminho do grupo)
 */
export default function ReportChartsView({ viewModel, definition, config, role, onOption, onToggleSeries, onDrill }) {
  const charts = useMemo(() => chartsOf(definition, role), [definition, role]);
  const normalized = useMemo(() => normalizeChartConfig(definition, config).config, [definition, config]);
  return (
    <section className="rpt-charts-host rpt-charts" aria-label="Gráficos do relatório">
      <style>{CHART_SCREEN_CSS}</style>
      <p className="rpt-charts__intro">Os mesmos números da folha. Passe o mouse sobre o gráfico para ver os valores; clique numa barra para abrir a folha daquele grupo.</p>
      <div className="rpt-charts__grid">
        {charts.map((chart, index) => (
          <ChartCard key={chart.id} viewModel={viewModel} chart={chart} config={normalized} index={index} onOption={onOption} onToggleSeries={onToggleSeries} onDrill={onDrill} />
        ))}
      </div>
    </section>
  );
}
