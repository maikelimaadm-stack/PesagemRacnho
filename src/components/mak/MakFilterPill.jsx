import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import MakColumnMenu, { isMakColumnFilterActive } from "./MakColumnMenu";

function describeFilter(label, filter) {
  if (!isMakColumnFilterActive(filter)) return label;
  if (Array.isArray(filter?.values) && filter.values.length) return `${label}: ${filter.values.join(", ")}`;
  if (filter?.valueTo) return `${label}: ${filter.value} – ${filter.valueTo}`;
  if (filter?.value != null && String(filter.value).trim()) return `${label}: ${filter.value}`;
  return label;
}

const NO_OPTIONS = [];

export default function MakFilterPill({
  label,
  value,
  filterType = "text",
  listOptions = [],
  onChange,
  disabled = false,
  openRequest = 0,
}) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const active = isMakColumnFilterActive(value);
  // listOptions pode ser função: os valores únicos só são calculados quando a pílula abre.
  const resolvedOptions = useMemo(
    () => (open ? (typeof listOptions === "function" ? listOptions() : listOptions) : NO_OPTIONS),
    [open, listOptions]
  );

  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);

  const clear = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onChange?.(null);
    setOpen(false);
  };

  return (
    <div
      ref={anchorRef}
      className={`mg-filter-pill${open ? " is-open" : ""}${active ? " is-active" : ""}`}
      title={describeFilter(label, value)}
    >
      <button
        type="button"
        className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost mg-filter-pill__trigger"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-label={`Filtrar ${label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{label}</span>
      </button>
      {active ? (
        <button
          type="button"
          className="mg-filter-pill__icon mg-filter-pill__icon--clear"
          onClick={clear}
          disabled={disabled}
          aria-label={`Limpar filtro ${label}`}
          title={`Limpar filtro ${label}`}
        >
          <X strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : (
        <ChevronDown className="mg-filter-pill__icon mg-filter-pill__icon--chevron" strokeWidth={2.2} aria-hidden="true" />
      )}
      <MakColumnMenu
        aberto={open}
        onFechar={() => setOpen(false)}
        label={label}
        valorFiltro={value}
        filterType={filterType}
        listOptions={resolvedOptions}
        onFiltrar={onChange}
        anchorRef={anchorRef}
        filterOnly
      />
    </div>
  );
}
