// Utilitários de tela dos relatórios (sem regra de negócio: contas e filtros ficam no serviço).
import { useMemo } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { formatCell, headerLabel } from "@/modules/reporting/domain/reportFormatting";
import { aggregateLabel, aggregateValueColumn, cellRawValue } from "@/modules/reporting/infrastructure/exporters/reportLayout";
import { isFilterActive } from "@/modules/reporting/domain/filterEngine";

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
    out[columnId] = column && ["entity", "enum"].includes(column.type) && typeof filter === "object" ? { ...filter, match: "label" } : filter;
  }
  return out;
}

export function screenCell(viewModel, column, row) {
  return formatCell(column, cellRawValue(viewModel, column, row), "screen");
}

export function aggregateChips(viewModel, aggregatesMap) {
  return viewModel.aggregates.map((spec) => {
    const result = aggregatesMap?.[spec.id];
    return {
      id: spec.id,
      label: aggregateLabel(spec, viewModel.columns.length ? viewModel.availableColumns : viewModel.columns),
      value: formatCell(aggregateValueColumn(spec, viewModel.availableColumns), result?.value ?? null, "screen"),
      partial: result && result.n_ausentes > 0 && !["count", "countDistinct"].includes(spec.op) ? `${result.n_validos} de ${result.n_total}` : null,
    };
  });
}

export { headerLabel };

export const FAMILY_ORDER = ["rebanho", "pesagens", "desempenho", "movimentacao", "saidas", "comercial", "embarques", "controle", "cadastros"];
