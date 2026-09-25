// Utilitários de tela dos relatórios (sem regra de negócio: contas e filtros ficam no serviço).
import { useMemo } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { formatCell, headerLabel } from "@/modules/reporting/domain/reportFormatting";
import { aggregateLabel, aggregateValueColumn, cellRawValue } from "@/modules/reporting/infrastructure/exporters/reportLayout";
import { isFilterActive } from "@/modules/reporting/domain/filterEngine";
import { isLeafGroupLevel, leafOnlyMetricKeys } from "@/modules/reporting/domain/summaryLayout";
import { rangeText } from "@/modules/reporting/domain/reportDocument";
import { filtersForDisplay } from "@/modules/reporting/domain/reportViews";

/** Ator da sessão para os serviços ({ id, nome, role }); null fora do AuthGate. */
export function useReportActor() {
  const auth = useAuth();
  const id = auth?.user?.id ?? null;
  const nome = auth?.user?.nome ?? auth?.user?.login ?? null;
  const role = auth?.role ?? auth?.user?.role ?? null;
  // Objeto estável: efeitos que dependem do ator não reexecutam a cada renderização.
  return useMemo(() => (id ? { id, nome, role } : null), [id, nome, role]);
}

export function useCan() {
  const auth = useAuth();
  return (action) => Boolean(auth?.can?.(action));
}

/** Tipo de controle da pílula: a tela só conhece texto, número e data. */
export function pillFilterType(column) {
  if (["number", "integer", "weight", "gmd", "money", "percentage"].includes(column.type)) return "number";
  if (column.type === "date" || column.type === "datetime") return "date";
  return "text";
}

const optionsCache = new WeakMap();

/** Opções da pílula: valores exibidos (nome para entidade, rótulo para enum) da população base. Calculadas uma vez por execução. */
export function pillOptions(viewModel, column, limit = 500) {
  if (!viewModel?.population) return [];
  let perColumn = optionsCache.get(viewModel);
  if (!perColumn) { perColumn = new Map(); optionsCache.set(viewModel, perColumn); }
  const cached = perColumn.get(column.id);
  if (cached) return cached;
  const accessor = viewModel.resolve(column.id);
  const seen = new Set();
  for (const row of viewModel.population) {
    const value = column.type === "entity" || column.type === "enum" ? accessor.displayOf(row) : accessor.valueOf(row);
    if (value === null || value === undefined || value === "") continue;
    seen.add(column.type === "date" ? String(value).slice(0, 10) : value);
    if (seen.size >= limit) break;
  }
  const options = [...seen].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
  perColumn.set(column.id, options);
  return options;
}

/**
 * Pílula (valores exibidos) → filtro do serviço. Enum/entidade vão com match "label": o serviço
 * compara o rótulo exibido na própria população da execução (funciona já na primeira execução e
 * em modelos salvos, sem depender da tela ter carregado antes).
 */
export function toServiceFilters(uiFilters, columns) {
  const out = {};
  for (const [columnId, filter] of Object.entries(uiFilters || {})) {
    if (!isFilterActive(filter)) continue;
    const column = columns.find((item) => item.id === columnId);
    // match "code": condição herdada de um relatório antigo, comparada pelo código como era.
    out[columnId] = column && ["entity", "enum"].includes(column.type) && typeof filter === "object" && filter.match !== "code" ? { ...filter, match: "label" } : filter;
  }
  return out;
}

/** Filtros em código → rótulo exibido (ver domain/reportViews.filtersForDisplay). */
export const toDisplayFilters = filtersForDisplay;

export function screenCell(viewModel, column, row) {
  return formatCell(column, cellRawValue(viewModel, column, row), "screen");
}

/** Totais em chips; `level` do nó (0 = Total geral): a faixa do lote (par leafOnly) só no nível folha. */
export function aggregateChips(viewModel, aggregatesMap, level = 0) {
  const hidden = new Set(viewModel.hiddenMetrics ?? []);
  const leafOnly = leafOnlyMetricKeys(viewModel);
  const shown = (spec) => !hidden.has(spec.id) && (!leafOnly.has(spec.id) || isLeafGroupLevel(viewModel, level));
  const specs = viewModel.aggregates.filter(shown);
  const ids = new Set(specs.map((spec) => spec.id));
  // Par "de–até" (faixa exigida do lote) num chip só, como na folha.
  const pairs = (viewModel.metricPairs ?? []).filter((pair) => ids.has(pair.from) && ids.has(pair.to));
  const paired = new Set(pairs.map((pair) => pair.to));
  return specs.filter((spec) => !paired.has(spec.id)).map((spec) => {
    const result = aggregatesMap?.[spec.id];
    const pair = pairs.find((item) => item.from === spec.id);
    if (pair) return { id: `pair:${pair.id}`, label: pair.label, value: rangeText(result?.value ?? null, aggregatesMap?.[pair.to]?.value ?? null), partial: null };
    return {
      id: spec.id,
      // Rótulo de curral da definição (metricLabels, o mesmo da folha) quando houver.
      label: viewModel.metricLabels?.[spec.id] || aggregateLabel(spec, viewModel.columns.length ? viewModel.availableColumns : viewModel.columns),
      value: formatCell(aggregateValueColumn(spec, viewModel.availableColumns), result?.value ?? null, "screen"),
      partial: result && result.n_ausentes > 0 && !["count", "countDistinct"].includes(spec.op) ? `${result.n_validos} de ${result.n_total}` : null,
    };
  });
}

export { headerLabel };

export const FAMILY_ORDER = ["rebanho", "pesagens", "desempenho", "movimentacao", "saidas", "comercial", "embarques", "controle", "cadastros"];
