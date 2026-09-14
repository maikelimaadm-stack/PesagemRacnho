import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import MakColumnMenu, { isMakColumnFilterActive } from "./MakColumnMenu";

function describeFilter(label, filter) {
  if (!isMakColumnFilterActive(filter)) return label;
  if (Array.isArray(filter?.values) && filter.values.length) return `${label}: ${filter.values.join(", ")}`;
  if (filter?.valueTo) return `${label}: ${filter.value} – ${filter.valueTo}`;
  if (filter?.value != null && String(filter.value).trim()) return `${label}: ${filter.value}`;
  return label;
}

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
        className="d17c-filter-pill mg-filter-pill__trigger"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-label={`Filtrar ${label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{label}</span>
        {!active ? <ChevronDown aria-hidden="true" /> : null}
      </button>
      {active ? (
        <button
          type="button"
          className="mg-filter-pill__clear"
          onClick={clear}
          disabled={disabled}
          aria-label={`Limpar filtro ${label}`}
          title={`Limpar filtro ${label}`}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
      <MakColumnMenu
        aberto={open}
        onFechar={() => setOpen(false)}
        label={label}
        valorFiltro={value}
        filterType={filterType}
        listOptions={listOptions}
        onFiltrar={onChange}
        anchorRef={anchorRef}
        filterOnly
      />
    </div>
  );
}
