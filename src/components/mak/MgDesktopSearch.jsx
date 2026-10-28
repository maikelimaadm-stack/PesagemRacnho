import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import MgSearchResultsDropdown from "./MgSearchResultsDropdown";

const DESKTOP_SEARCH_ANIM_MS = 220;

/**
 * Pesquisa da barra de ações do ModeloBase1: botão redondo que expande a
 * pílula "Pesquisar..." com lista suspensa de resultados (porte do bloco
 * `renderSearchField` de PROJETOMG-main/src/framework/mak/layout/MgActionBar.jsx).
 * Estilos: `.mg-desktop-search*`, `.mg-search-pill*`, `.mg-search-dropdown*` (mg-layout.css).
 */
export default function MgDesktopSearch({
  value = "",
  onValueChange,
  hasFilter = false,
  onClear,
  results = [],
  resultsTotal = 0,
  titleField,
  codeField = null,
  detailFields = [],
  getFieldValue,
  onSelectResult,
  onApplyAll,
  disabled = false,
  placeholder = "Pesquisar...",
  /** Referência Marcas: pílula larga sempre visível (não colapsa para o ícone). */
  alwaysExpanded = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [opened, setOpened] = useState(alwaysExpanded);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const animTimeoutRef = useRef(null);
  const expandedRef = useRef(false);
  const openedRef = useRef(false);

  const keepExpanded = hasFilter || String(value || "").trim().length > 0;

  useEffect(() => {
    expandedRef.current = expanded;
    openedRef.current = opened;
  }, [expanded, opened]);

  useEffect(() => () => {
    window.clearTimeout(blurTimeoutRef.current);
    window.clearTimeout(animTimeoutRef.current);
  }, []);

  const clearAnim = () => {
    window.clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = null;
  };

  const collapse = () => {
    if (alwaysExpanded) {
      setDropdownOpen(false);
      return;
    }
    if (animTimeoutRef.current) return;
    if (!expandedRef.current) {
      setDropdownOpen(false);
      setOpened(false);
      return;
    }
    setDropdownOpen(false);
    setOpened(false);
    animTimeoutRef.current = window.setTimeout(() => {
      setExpanded(false);
      animTimeoutRef.current = null;
    }, DESKTOP_SEARCH_ANIM_MS);
  };

  const expand = () => {
    if (disabled) return;
    clearAnim();
    setExpanded(true);
    setOpened(false);
    // Abre no quadro seguinte para a transição da pílula acontecer; o timer é
    // a garantia quando a aba não está pintando (requestAnimationFrame parado).
    let done = false;
    const open = () => {
      if (done) return;
      done = true;
      setOpened(true);
      inputRef.current?.focus();
      setDropdownOpen(true);
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(open));
    window.setTimeout(open, 60);
  };

  const toggle = () => {
    if (disabled) return;
    if (hasFilter) {
      onClear?.();
      return;
    }
    if (expandedRef.current && openedRef.current) {
      collapse();
      return;
    }
    expand();
  };

  const handleBlur = () => {
    window.clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      if (keepExpanded) return;
      if (animTimeoutRef.current) return;
      collapse();
    }, 120);
  };

  useEffect(() => {
    if (!dropdownOpen && !expanded) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        if (!keepExpanded) collapse();
        else setDropdownOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!keepExpanded) collapse();
        else setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen, expanded, keepExpanded]);

  const closeAfterAction = () => {
    if (!keepExpanded) collapse();
    else setDropdownOpen(false);
  };

  return (
    <div
      className={`mg-desktop-search${expanded || alwaysExpanded ? " is-expanded" : ""}${opened || alwaysExpanded ? " is-open" : ""}${alwaysExpanded ? " mg-desktop-search--always" : ""}`}
      ref={rootRef}
    >
      {alwaysExpanded ? null : (
      <button
        type="button"
        className={`ios-btn tb-btn tb-btn-ghost tb-btn-icon mg-desktop-search__trigger${hasFilter ? " mg-desktop-search__trigger--active" : ""}`}
        onClick={toggle}
        disabled={disabled}
        aria-label={hasFilter ? "Pesquisa ativa" : "Pesquisar"}
        title={hasFilter ? "Limpar pesquisa" : "Pesquisar"}
        aria-expanded={opened}
        tabIndex={opened ? -1 : 0}
      >
        {hasFilter ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      )}
      {expanded || alwaysExpanded ? (
        <div className="mg-desktop-search__panel" aria-hidden={!opened}>
          <div className="mg-desktop-search__panel-inner">
            <div className="mg-search-pill-wrap mg-desktop-search__field">
              <div className="mg-search-pill" role="search">
                {hasFilter ? (
                  <button
                    type="button"
                    className="mg-search-pill-clear"
                    aria-label="Limpar pesquisa"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { onClear?.(); collapse(); }}
                  >
                    <X className="mg-search-pill-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ) : alwaysExpanded ? (
                  <Search className="mg-search-pill-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    className="mg-search-pill-toggle"
                    aria-label="Fechar pesquisa"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { if (keepExpanded) setDropdownOpen(false); else collapse(); }}
                  >
                    <Search className="mg-search-pill-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={placeholder}
                  value={value}
                  onChange={(event) => { onValueChange?.(event.target.value); if (!disabled) setDropdownOpen(true); }}
                  onFocus={() => { if (!disabled) setDropdownOpen(true); }}
                  onBlur={handleBlur}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && String(value || "").trim()) {
                      event.preventDefault();
                      onApplyAll?.();
                      closeAfterAction();
                    }
                  }}
                  aria-label="Pesquisar"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="listbox"
                  disabled={disabled}
                  tabIndex={opened || alwaysExpanded ? 0 : -1}
                />
              </div>
              <MgSearchResultsDropdown
                open={dropdownOpen && !disabled}
                items={results}
                total={resultsTotal}
                query={value}
                titleField={titleField}
                codeField={codeField}
                detailFields={detailFields}
                getFieldValue={getFieldValue}
                onSelect={(record) => { onSelectResult?.(record); closeAfterAction(); }}
                onApplyAll={() => { onApplyAll?.(); closeAfterAction(); }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
