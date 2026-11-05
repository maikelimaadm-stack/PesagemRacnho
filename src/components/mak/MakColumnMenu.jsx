import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, EyeOff, Filter, PanelLeft, ScanLine, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MakDateControl from "./MakDateControl";
import { isFilterActive, matchesFilter } from "@/modules/reporting/domain/filterEngine";

const OPERATORS = {
  text: [
    ["contains", "Contém"],
    ["not_contains", "Não contém"],
    ["equals", "É igual a"],
    ["not_equals", "É diferente de"],
    ["starts_with", "Começa com"],
    ["ends_with", "Termina com"],
    ["empty", "Está vazio"],
    ["not_empty", "Não está vazio"],
  ],
  number: [
    ["contains", "Contém"],
    ["equals", "É igual a"],
    ["greater", "Maior que"],
    ["greater_equal", "Maior ou igual a"],
    ["less", "Menor que"],
    ["less_equal", "Menor ou igual a"],
    ["between", "Entre"],
    ["not_between", "Não está entre"],
    ["empty", "Está vazio"],
    ["not_empty", "Não está vazio"],
  ],
  date: [
    ["contains", "Contém"],
    ["equals", "Na data"],
    ["before", "Antes de"],
    ["after", "Depois de"],
    ["between", "Entre"],
    ["empty", "Está vazio"],
    ["not_empty", "Não está vazio"],
  ],
};

// Condições em que a lista de valores (caixas de marcar) faz sentido. Nas de comparação (maior que, começa com,
// antes de…) a lista virava "é um destes" e a condição escolhida era ignorada: nelas vai o campo de valor.
const LIST_OPERATORS = new Set(["contains", "not_contains", "equals", "not_equals"]);

const defaultOperatorFor = (filterType) => filterType === "text" ? "contains" : filterType === "number" ? "between" : "equals";

function normalizeFilter(filter, filterType = "text") {
  if (filter && typeof filter === "object") {
    return {
      operator: filter.operator || defaultOperatorFor(filterType),
      value: filter.value ?? "",
      valueTo: filter.valueTo ?? "",
      values: Array.isArray(filter.values) ? filter.values.map(String) : [],
    };
  }
  return {
    operator: defaultOperatorFor(filterType),
    value: filter == null ? "" : String(filter),
    valueTo: "",
    values: [],
  };
}

// Lista de valores: renderiza no máximo este número de caixas (listas de 36 mil valores travam a tela).
const MAX_RENDERED_OPTIONS = 500;

function MakConditionSelect({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || "Selecionar condição";
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const visibleOptions = normalizedQuery
    ? options.filter(([, optionLabel]) => optionLabel.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    : options;

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`mak-condition-select${open ? " is-open" : ""}`}
          aria-label={`Condição do filtro ${label}`}
          aria-expanded={open}
        >
          <span>{selectedLabel}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="mak-condition-popover" align="start" sideOffset={4}>
        <label className="mak-condition-popover__search">
          <Search aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar condição"
            aria-label="Procurar condição"
          />
        </label>
        <div className="mak-condition-popover__options" role="listbox" aria-label="Condições disponíveis">
          {visibleOptions.map(([optionValue, optionLabel]) => (
            <button
              key={optionValue}
              type="button"
              role="option"
              aria-selected={optionValue === value}
              className={optionValue === value ? "is-selected" : ""}
              onClick={() => { onChange(optionValue); setOpen(false); }}
            >
              <span>{optionLabel}</span>
              {optionValue === value ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
          {visibleOptions.length === 0 ? <p>Nenhuma condição encontrada.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// O predicado vive no núcleo de reporting (filterEngine) — uma única semântica para
// Relação, Lançamento, Cadastros e relatórios. Mantidos aqui como fachada de compatibilidade.
export function isMakColumnFilterActive(filter) {
  return isFilterActive(filter);
}

export function matchesMakColumnFilter(rawValue, filter, filterType = "text") {
  return matchesFilter(rawValue, filter, filterType);
}
export default function MakColumnMenu({
  aberto,
  onFechar,
  label,
  valorFiltro,
  filterType = "text",
  onFiltrar,
  onCongelar,
  onAutoAjustar,
  onOcultar,
  congelada = false,
  anchorRef,
  listOptions = [],
  filterOnly = false,
}) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(() => normalizeFilter(valorFiltro, filterType));
  const [position, setPosition] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [internalFrozen, setInternalFrozen] = useState(false);
  const [search, setSearch] = useState("");
  const operators = useMemo(() => OPERATORS[filterType] || OPERATORS.text, [filterType]);
  const normalizedOptions = useMemo(
    () => [...new Set(listOptions.map((option) => String(option ?? "")).filter(Boolean))],
    [listOptions]
  );
  const visibleOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return normalizedOptions;
    return normalizedOptions.filter((option) => option.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  }, [normalizedOptions, search]);
  const needsValue = !["empty", "not_empty"].includes(draft.operator);
  const needsRange = ["between", "not_between"].includes(draft.operator);
  const showValueList = needsValue && !needsRange && LIST_OPERATORS.has(draft.operator) && (filterType !== "date" || draft.operator === "contains") && normalizedOptions.length > 0;
  const formatOption = (option) => {
    if (filterType !== "date") return option;
    const [year, month, day] = option.slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}/${year}` : option;
  };

  useEffect(() => {
    if (aberto) {
      setDraft(normalizeFilter(valorFiltro, filterType));
      setFilterOpen(filterOnly);
      setSearch("");
    }
  }, [aberto, valorFiltro, filterType, filterOnly]);

  useEffect(() => {
    if (!aberto) return undefined;
    const updatePosition = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      if (window.innerWidth < 768) {
        setPosition({ position: "fixed", left: 6, right: 6, bottom: 62, top: "auto", width: "auto" });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const width = filterOnly || filterOpen ? 280 : 228;
      const popupHeight = ref.current?.getBoundingClientRect().height || (filterOnly || filterOpen ? 260 : 152);
      const viewportPadding = 8;
      const gap = 4;
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      const belowTop = rect.bottom + gap;
      const aboveTop = rect.top - popupHeight - gap;
      const top = belowTop + popupHeight <= window.innerHeight - viewportPadding
        ? belowTop
        : aboveTop >= viewportPadding
          ? aboveTop
          : Math.max(viewportPadding, Math.min(belowTop, window.innerHeight - popupHeight - viewportPadding));
      setPosition({ position: "fixed", left, top, width });
    };
    updatePosition();
    const outside = (event) => {
      if (ref.current?.contains(event.target)) return;
      if (event.target?.closest?.(".mak-date-picker-panel, [data-radix-popper-content-wrapper], [data-radix-select-content], .d17c-filter-data-popover")) return;
      onFechar?.();
    };
    const escape = (event) => event.key === "Escape" && onFechar?.();
    const reposition = () => updatePosition();
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(reposition) : null;
    if (ref.current) resizeObserver?.observe(ref.current);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      resizeObserver?.disconnect();
    };
  }, [aberto, filterOpen, filterOnly, onFechar, anchorRef]);

  if (!aberto) return null;

  const changeOperator = (operator) => setDraft((current) => ({
    ...current,
    operator,
    value: ["empty", "not_empty"].includes(operator) ? "" : current.value,
    valueTo: ["between", "not_between"].includes(operator) ? current.valueTo : "",
    values: [],
  }));

  const apply = () => {
    onFiltrar?.(isMakColumnFilterActive(draft) ? draft : null);
    onFechar?.();
  };

  const clear = () => {
    const empty = normalizeFilter(null, filterType);
    setDraft(empty);
    onFiltrar?.(null);
    onFechar?.();
  };

  const toggleOption = (option) => {
    setDraft((current) => ({
      ...current,
      values: current.values.includes(option)
        ? current.values.filter((item) => item !== option)
        : [...current.values, option],
    }));
  };

  const autoFitColumn = () => {
    if (typeof onAutoAjustar === "function") {
      onAutoAjustar();
      onFechar?.();
      return;
    }
    const anchor = anchorRef?.current;
    const table = anchor?.closest?.("table");
    const columnIndex = anchor?.cellIndex;
    if (!table || columnIndex == null) {
      onFechar?.();
      return;
    }
    const cells = Array.from(table.rows)
      .map((row) => row.cells[columnIndex])
      .filter(Boolean);
    cells.forEach((cell) => {
      cell.style.width = "auto";
      cell.style.minWidth = "0";
      cell.style.maxWidth = "none";
    });
    const width = Math.min(420, Math.max(72, ...cells.map((cell) => cell.scrollWidth + 20)));
    cells.forEach((cell) => {
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
      cell.style.maxWidth = `${width}px`;
    });
    onFechar?.();
  };

  const toggleFrozenColumn = () => {
    if (typeof onCongelar === "function") {
      onCongelar();
      onFechar?.();
      return;
    }
    const anchor = anchorRef?.current;
    const table = anchor?.closest?.("table");
    const columnIndex = anchor?.cellIndex;
    if (!table || columnIndex == null) {
      onFechar?.();
      return;
    }
    const nextFrozen = !internalFrozen;
    Array.from(table.rows).forEach((row) => {
      row.cells[columnIndex]?.classList.toggle("mak-column-frozen", nextFrozen);
    });
    const headerCells = Array.from(table.tHead?.rows?.[0]?.cells || []);
    let frozenLeft = 0;
    headerCells.forEach((headerCell, index) => {
      if (!headerCell.classList.contains("mak-column-frozen")) return;
      Array.from(table.rows).forEach((row) => {
        const cell = row.cells[index];
        if (cell) cell.style.left = `${frozenLeft}px`;
      });
      frozenLeft += headerCell.getBoundingClientRect().width;
    });
    setInternalFrozen(nextFrozen);
    onFechar?.();
  };

  const renderValue = (key, placeholder) => {
    if (filterType === "date") {
      return (
        <MakDateControl
          value={draft[key]}
          onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
          ariaLabel={placeholder}
          className="mak-column-filter__date"
          showIcon={false}
        />
      );
    }
    return (
      <input
        autoFocus={key === "value"}
        type={filterType === "number" ? "number" : "text"}
        inputMode={filterType === "number" ? "decimal" : undefined}
        value={draft[key]}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
        onKeyDown={(event) => event.key === "Enter" && apply()}
        placeholder={placeholder}
        className="mak-column-filter__input"
      />
    );
  };

  if (!position) return null;

  const effectiveFrozen = typeof onCongelar === "function" ? congelada : internalFrozen;

  if (!filterOnly && !filterOpen) {
    return createPortal(
      <div ref={ref} style={position} className="emp-col-popup-menu mak-column-options" onClick={(event) => event.stopPropagation()}>
        <div className="mak-column-options__list">
          <button type="button" className="mak-column-options__item" onClick={() => setFilterOpen(true)}>
            <Filter aria-hidden="true" />
            <span>Abrir filtro avançado</span>
          </button>
          <button type="button" className="mak-column-options__item" onClick={autoFitColumn}>
            <ScanLine aria-hidden="true" />
            <span>Auto ajustar coluna</span>
          </button>
          <button type="button" className={`mak-column-options__item${effectiveFrozen ? " is-active" : ""}`} onClick={toggleFrozenColumn}>
            <PanelLeft aria-hidden="true" />
            <span>{effectiveFrozen ? "Descongelar coluna" : "Congelar coluna"}</span>
          </button>
          <button type="button" className="mak-column-options__item" onClick={() => { onOcultar?.(); onFechar?.(); }} disabled={typeof onOcultar !== "function"}>
            <EyeOff aria-hidden="true" />
            <span>Ocultar coluna</span>
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div ref={ref} style={position} className="emp-column-menu mak-column-filter" onClick={(event) => event.stopPropagation()}>
      <div className="mak-column-filter__title">
        <span><Filter aria-hidden="true" /> Filtrar coluna</span>
        <button type="button" onClick={onFechar} aria-label="Fechar filtro"><X aria-hidden="true" /></button>
      </div>

      <div className="mak-column-filter__body">
        <label>Condição</label>
        <MakConditionSelect value={draft.operator} options={operators} onChange={changeOperator} label={label} />

        {needsRange || (needsValue && !showValueList) ? (
          <div className={`mak-column-filter__values${needsRange ? " is-range" : ""}`}>
            {renderValue("value", needsRange ? "De" : `Valor para ${label}`)}
            {needsRange ? renderValue("valueTo", "Até") : null}
          </div>
        ) : showValueList ? (
          <div className="mak-column-filter__data">
            <label className="mak-column-filter__search">
              <Search aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setDraft((current) => ({ ...current, value: event.target.value }));
                }}
                placeholder="Pesquisar..."
                aria-label={`Pesquisar valores de ${label}`}
              />
            </label>
            <div className="mak-column-filter__options">
              <label className="mak-column-filter__option is-all">
                <input
                  type="checkbox"
                  checked={visibleOptions.length > 0 && visibleOptions.every((option) => draft.values.includes(option))}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    values: event.target.checked
                      ? [...new Set([...current.values, ...visibleOptions])]
                      : current.values.filter((item) => !visibleOptions.includes(item)),
                  }))}
                />
                <span>(Selecionar Tudo)</span>
              </label>
              {visibleOptions.slice(0, MAX_RENDERED_OPTIONS).map((option) => (
                <label key={option} className="mak-column-filter__option">
                  <input type="checkbox" checked={draft.values.includes(option)} onChange={() => toggleOption(option)} />
                  <span title={option}>{formatOption(option)}</span>
                </label>
              ))}
              {visibleOptions.length === 0 ? <p className="mak-column-filter__empty">Nenhum valor encontrado.</p> : null}
              {visibleOptions.length > MAX_RENDERED_OPTIONS ? <p className="mak-column-filter__empty">Mostrando {MAX_RENDERED_OPTIONS} de {visibleOptions.length.toLocaleString("pt-BR")} valores — pesquise para refinar.</p> : null}
            </div>
          </div>
        ) : (
          <p className="mak-column-filter__hint">Esta condição não precisa de valor.</p>
        )}
      </div>

      <div className="mak-column-filter__footer">
        <button type="button" className="mak-column-filter__clear" onClick={clear} disabled={!isMakColumnFilterActive(valorFiltro)}>Limpar</button>
        <span />
        <button type="button" className="mak-column-filter__cancel" onClick={onFechar}>Cancelar</button>
        <button type="button" className="mak-column-filter__apply" onClick={apply} disabled={needsValue && draft.values.length === 0 && (!String(draft.value).trim() || (needsRange && !String(draft.valueTo).trim()))}>OK</button>
      </div>

    </div>,
    document.body
  );
}
