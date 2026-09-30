import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CHART_SIZES, chartGeometry, chartHoverTargets } from "@/modules/reporting/domain/chartScale";
import { CHART_DRILL_HINT, chartTargetDrill, chartTargetTip } from "@/modules/reporting/domain/reportCharts";
import { renderChartSvg } from "@/modules/reporting/infrastructure/exporters/chartSvg";

// E1G etapa 2 — um gráfico na TELA: o SVG é a MESMA string da impressão/PDF (renderChartSvg sobre chartGeometry,
// dangerouslySetInnerHTML como a folha faz), medido pela largura do cartão (ResizeObserver). Por cima, uma camada
// React fina com os alvos tirados da MESMA geometria (chartHoverTargets): cruz vertical + dica em linha; dica por
// barra; foco por teclado (Tab nas barras, setas na linha) e Enter/clique abre o detalhe quando o ponto tem um.
// Usado nos relatórios (ReportChartsView) e na Ficha do Animal (curva de peso). Cores só por tokens --rc-* (tema).

const slotName = (slot) => (typeof slot === "number" ? `s${slot}` : String(slot ?? "demais"));
const drillOfTarget = chartTargetDrill;

/**
 * @param chart ChartData (buildReportCharts / buildAnimalWeightCurve)
 * @param uid prefixo dos ids do SVG (único na página)
 * @param describe (chart, alvo) → { title, lines?, rows? } — dica própria (a Ficha do Animal); padrão chartTargetTip
 * @param onDrill caminho → abre o detalhe (null = sem clique)
 */
export default function ChartPlot({ chart, uid, height = CHART_SIZES.SCREEN.height, describe = chartTargetTip, onDrill = null, label = null }) {
  const hostRef = useRef(null);
  const tipId = useId();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null); // índice do alvo sob o mouse/foco

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => setWidth(Math.floor(host.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => (width > 0 ? chartGeometry(chart, { width, height }) : null), [chart, width, height]);
  const svg = useMemo(() => (geometry ? renderChartSvg(chart, geometry, { uid }) : ""), [chart, geometry, uid]);
  const targets = useMemo(() => chartHoverTargets(geometry), [geometry]);
  const current = active !== null && active < targets.length ? targets[active] : null;
  const tip = current ? describe(chart, current) : null;
  const drillPath = current && onDrill ? drillOfTarget(chart, current) : null;

  const open = (target) => {
    const path = onDrill ? drillOfTarget(chart, target) : null;
    if (path) onDrill(path);
  };
  // Linha: o x mais próximo do ponteiro (coordenadas do viewBox; o SVG pode estar reduzido pela largura).
  const nearestX = (event) => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) * geometry.width) / Math.max(1, box.width);
    let best = 0;
    targets.forEach((target, index) => { if (Math.abs(target.anchor.x - x) < Math.abs(targets[best].anchor.x - x)) best = index; });
    return best;
  };
  const lineKeys = (event) => {
    const last = targets.length - 1;
    const moves = { ArrowRight: Math.min(last, (active ?? -1) + 1), ArrowLeft: Math.max(0, (active ?? targets.length) - 1), Home: 0, End: last };
    if (event.key in moves) { event.preventDefault(); setActive(moves[event.key]); return; }
    if ((event.key === "Enter" || event.key === " ") && current) { event.preventDefault(); open(current); }
    if (event.key === "Escape") setActive(null);
  };

  const scale = geometry && width > 0 ? Math.min(1, width / geometry.width) : 1;
  const tipStyle = (() => {
    if (!current || !geometry) return null;
    const x = current.anchor.x * scale;
    const y = current.anchor.y * scale;
    if (current.kind === "x") {
      // Dica ao lado da cruz, do lado com mais espaço.
      const right = current.anchor.x < geometry.width * 0.55;
      return { left: x, top: y, transform: right ? "translate(12px, 0)" : "translate(calc(-100% - 12px), 0)" };
    }
    const above = current.anchor.y > 56;
    const align = x < 110 ? "0%" : x > width - 110 ? "-100%" : "-50%";
    // Colunas: a dica sobe acima do rótulo de valor da coluna (o número continua visível).
    const gap = chart.kind === "colunas" || chart.kind === "histograma" ? 20 : 8;
    return { left: x, top: above ? y : (current.mark ? (current.mark.y + current.mark.h) * scale : y), transform: `translate(${align}, ${above ? `calc(-100% - ${gap}px)` : "8px"})` };
  })();

  return (
    <div className="rc-plot" ref={hostRef}>
      {geometry ? (
        <>
          <div className="rc-plot__svg" dangerouslySetInnerHTML={{ __html: svg }} />
          {targets.length ? (
            <svg className="rc-hover" viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width} height={geometry.height} onPointerLeave={() => setActive(null)}>
              {current?.kind === "x" ? (
                <g className="rc-hover__cross" aria-hidden="true">
                  <line x1={current.anchor.x} x2={current.anchor.x} y1={geometry.plot.y} y2={geometry.plot.y + geometry.plot.h} />
                  {(current.items ?? []).map((item) => <circle key={item.key} className={`rc-hover__ring rc-${slotName(item.slot)}`} cx={item.point.x} cy={item.point.y} r="6.5" />)}
                </g>
              ) : null}
              {current?.kind === "mark" && current.mark ? <rect className="rc-hover__band" x={current.hit.x} y={current.hit.y} width={current.hit.w} height={current.hit.h} aria-hidden="true" /> : null}
              {targets[0].kind === "x" ? (
                <rect
                  className={`rc-hit rc-hit--line${onDrill ? " is-drill" : ""}`}
                  x={geometry.plot.x} y={geometry.plot.y} width={geometry.plot.w} height={geometry.plot.h}
                  tabIndex={0}
                  role="img"
                  aria-label={`${label ?? chart.title}: use as setas para ver os valores de cada ponto${onDrill ? "; Enter abre a folha" : ""}`}
                  aria-describedby={current ? tipId : undefined}
                  onPointerMove={(event) => setActive(nearestX(event))}
                  onFocus={() => setActive((value) => value ?? targets.length - 1)}
                  onBlur={() => setActive(null)}
                  onKeyDown={lineKeys}
                  onClick={() => current && open(current)}
                />
              ) : targets.map((target, index) => {
                const path = onDrill ? drillOfTarget(chart, target) : null;
                return (
                  <rect
                    key={`${target.key}-${target.xKey}-${index}`}
                    className={`rc-hit${path ? " is-drill" : ""}`}
                    x={target.hit.x} y={target.hit.y} width={target.hit.w} height={target.hit.h}
                    tabIndex={0}
                    role={path ? "button" : "img"}
                    aria-label={`${target.tooltip ?? ""}${path ? ` — ${CHART_DRILL_HINT}` : ""}`}
                    aria-describedby={active === index ? tipId : undefined}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    onClick={() => open(target)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(target); } }}
                  />
                );
              })}
            </svg>
          ) : null}
          {tip && tipStyle ? (
            <div className="rc-tip" id={tipId} role="tooltip" style={tipStyle}>
              {tip.title ? <strong className="rc-tip__title">{tip.slot != null ? <i className={`rc-key rc-${slotName(tip.slot)}`} aria-hidden="true" /> : null}{tip.title}</strong> : null}
              {(tip.rows ?? []).map((row) => (
                <span key={row.key} className="rc-tip__row"><i className={`rc-key rc-key--line rc-${slotName(row.slot)}`} aria-hidden="true" /><span>{row.label}:</span> <b>{row.text}</b></span>
              ))}
              {(tip.lines ?? []).map((line) => <span key={line} className="rc-tip__line">{line}</span>)}
              {drillPath ? <span className="rc-tip__hint">{CHART_DRILL_HINT}</span> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
