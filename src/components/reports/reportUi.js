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

/** Opções da pílula: valores exibidos (nome para entidade, rótulo para enum) da população base. */
export function pillOptions(viewModel, column, limit = 500) {
  if (!viewModel?.population) return [];
  const accessor = viewModel.resolve(column.id);
  const seen = new Set();
  for (const row of viewModel.population) {
    const value = column.type === "entity" || column.type === "enum" ? accessor.displayOf(row) : accessor.valueOf(row);
    if (value === null || value === undefined || value === "") continue;
    seen.add(column.type === "date" ? String(value).slice(0, 10) : value);
    if (seen.size >= limit) break;
  }
  return [...seen].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
}

/**
 * Pílula (valores exibidos) → filtro do motor (códigos/ids). Para entidade/enum, cada rótulo
 * marcado vira todos os ids que exibem aquele rótulo na população base.
 */
export function toEngineFilters(uiFilters, viewModel, columns) {
  const out = {};
  for (const [columnId, filter] of Object.entries(uiFilters || {})) {
    if (!isFilterActive(filter)) continue;
    const column = columns.find((item) => item.id === columnId);
    if (!column || !["entity", "enum"].includes(column.type) || !filter.values?.length || !viewModel?.population) {
      out[columnId] = filter;
      continue;
    }
    const accessor = viewModel.resolve(columnId);
    const wanted = new Set(filter.values.map(String));
    const ids = new Set();
    for (const row of viewModel.population) {
      if (wanted.has(String(accessor.displayOf(row)))) ids.add(String(accessor.valueOf(row)));
    }
    out[columnId] = { ...filter, operator: ["not_in", "not_equals", "not_contains"].includes(filter.operator) ? "not_in" : "in", values: ids.size ? [...ids] : ["__nenhum__"] };
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
