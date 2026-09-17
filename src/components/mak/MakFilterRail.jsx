import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListPlus, ListX } from "lucide-react";
import { FunnelPlus, FunnelX } from "./mgIcons";

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

  // Sem configuração de filtros, o funil só existe para limpar o que está ativo.
  const showConfigButton = Boolean(onConfigureFilters) || hasActiveFilters;
  const configTitle = hasActiveFilters ? "Limpar filtros" : "Configurar campos de filtros";

  return (
    <div
      className={`mg-filter-pills-rail mg-filter-pills-rail--track${expanded ? " is-expanded" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`ios-btn mg-nav-btn mg-filter-pills-rail__toggle${expanded ? " is-active" : ""}`}
        onClick={toggleExpanded}
        disabled={disabled}
        aria-expanded={open}
        aria-label={open ? "Recolher faixa de filtros" : "Mostrar faixa de filtros"}
        title={open ? "Recolher faixa de filtros" : "Mostrar faixa de filtros"}
      >
        {open
          ? <ListX className="mg-filter-pills-rail__toggle-icon" strokeWidth={2.2} aria-hidden="true" />
          : <ListPlus className="mg-filter-pills-rail__toggle-icon" strokeWidth={2.2} aria-hidden="true" />}
      </button>

      {expanded ? (
        <div className="mg-filter-pills-rail__content">
          {scrollState.hasOverflow ? (
            <button
              type="button"
              className="ios-btn mg-nav-btn mg-filter-pills-rail__nav mg-filter-pills-rail__nav--prev"
              onClick={() => scroll(-1)}
              disabled={disabled || !scrollState.canScrollLeft}
              aria-label="Rolar filtros para a esquerda"
              title="Rolar filtros para a esquerda"
            >
              <ChevronLeft className="mg-filter-pills-rail__nav-icon" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}

          <div ref={viewportRef} className="mg-filter-pills-rail__viewport">
            <div className="mg-filter-pills">
              {children}
              {hasActiveFilters ? (
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost mg-filter-pill__trigger mg-filter-pill__trigger--clear" onClick={onClear} disabled={disabled}>
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>

          {scrollState.hasOverflow ? (
            <button
              type="button"
              className="ios-btn mg-nav-btn mg-filter-pills-rail__nav mg-filter-pills-rail__nav--next"
              onClick={() => scroll(1)}
              disabled={disabled || !scrollState.canScrollRight}
              aria-label="Rolar filtros para a direita"
              title="Rolar filtros para a direita"
            >
              <ChevronRight className="mg-filter-pills-rail__nav-icon" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}

          {showConfigButton ? (
            <>
              <span className="mg-filter-pills-rail__divider" aria-hidden="true" />
              <span className="mg-filter-pills-rail__config-slot">
                <button
                  type="button"
                  className={`ios-btn tb-btn tb-btn-ghost tb-btn-filter tb-btn-icon mg-filter-pills-rail__config${hasActiveFilters ? " is-clear-active tb-btn-danger" : ""}`}
                  onClick={hasActiveFilters ? onClear : onConfigureFilters}
                  disabled={disabled}
                  aria-label={configTitle}
                  title={configTitle}
                >
                  {hasActiveFilters
                    ? <FunnelX className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                    : <FunnelPlus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />}
                </button>
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
