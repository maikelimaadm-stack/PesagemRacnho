import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  FilterX,
  ListPlus,
  ListX,
} from "lucide-react";

const OPEN_ANIMATION_MS = 220;

export default function MakFilterRail({
  children,
  hasActiveFilters = false,
  onClear,
  onConfigureFilters,
  disabled = false,
  className = "",
}) {
  const viewportRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  const [open, setOpen] = useState(true);
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setScrollState({
      hasOverflow: maxScroll > 2,
      canScrollLeft: viewport.scrollLeft > 2,
      canScrollRight: viewport.scrollLeft < maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !expanded) return undefined;
    updateScrollState();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateScrollState);
    observer?.observe(viewport);
    if (viewport.firstElementChild) observer?.observe(viewport.firstElementChild);
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      observer?.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [expanded, updateScrollState, children]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const toggleExpanded = () => {
    window.clearTimeout(closeTimerRef.current);
    if (expanded) {
      setOpen(false);
      closeTimerRef.current = window.setTimeout(() => setExpanded(false), OPEN_ANIMATION_MS);
      return;
    }
    setExpanded(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };

  const scroll = (direction) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(160, viewport.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  const configTitle = hasActiveFilters ? "Limpar filtros" : "Configurar campos de filtros";

  return (
    <div
      className={`mg-filter-pills-rail mg-filter-pills-rail--track${expanded ? " is-expanded" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`mg-filter-pills-rail__toggle${expanded ? " is-active" : ""}`}
        onClick={toggleExpanded}
        aria-expanded={open}
        aria-label={open ? "Recolher faixa de filtros" : "Expandir faixa de filtros"}
        title={open ? "Recolher faixa de filtros" : "Expandir faixa de filtros"}
      >
        {open ? <ListX className="mg-filter-pills-rail__toggle-icon" aria-hidden="true" /> : <ListPlus className="mg-filter-pills-rail__toggle-icon" aria-hidden="true" />}
      </button>

      {expanded ? (
        <div className="mg-filter-pills-rail__content">
          {scrollState.hasOverflow ? (
            <button
              type="button"
              className="mg-filter-pills-rail__nav"
              onClick={() => scroll(-1)}
              disabled={!scrollState.canScrollLeft}
              aria-label="Ver filtros anteriores"
              title="Filtros anteriores"
            >
              <ChevronLeft className="mg-filter-pills-rail__nav-icon" aria-hidden="true" />
            </button>
          ) : null}

          <div ref={viewportRef} className="mg-filter-pills-rail__viewport">
            <div className="mg-filter-pills">
              {children}
              {hasActiveFilters ? (
                <button type="button" className="mg-filter-pill__trigger mg-filter-pill__trigger--clear" onClick={onClear} disabled={disabled}>
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>

          {scrollState.hasOverflow ? (
            <button
              type="button"
              className="mg-filter-pills-rail__nav"
              onClick={() => scroll(1)}
              disabled={!scrollState.canScrollRight}
              aria-label="Ver próximos filtros"
              title="Próximos filtros"
            >
              <ChevronRight className="mg-filter-pills-rail__nav-icon" aria-hidden="true" />
            </button>
          ) : null}

          <span className="mg-filter-pills-rail__divider" aria-hidden="true" />
          <span className="mg-filter-pills-rail__config-slot">
            <button
              type="button"
              className={`mg-filter-pills-rail__config${hasActiveFilters ? " is-clear is-clear-active" : ""}`}
              onClick={hasActiveFilters ? onClear : onConfigureFilters}
              disabled={disabled}
              aria-label={configTitle}
              title={configTitle}
            >
              {hasActiveFilters ? <FilterX aria-hidden="true" /> : <Filter aria-hidden="true" />}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
