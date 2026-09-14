import React from "react";
import { renderSearchHighlight } from "./mgSearchHighlight";

/**
 * Lista suspensa de resultados da pesquisa do ModeloBase1 (porte simplificado de
 * PROJETOMG-main/src/framework/mak/layout/MgSearchResultsDropdown.jsx: sem
 * favoritos, sem configuração de campos e sem paginação remota — a base local
 * já está em memória).
 * Estilos: `.mg-search-dropdown*` (mg-layout.css).
 */
export default function MgSearchResultsDropdown({
  open = false,
  items = [],
  total = 0,
  query = "",
  titleField = "titulo",
  codeField = null,
  detailFields = [],
  getFieldValue = (record, key) => record?.[key],
  onSelect,
  onApplyAll,
  emptyLabel = "Nenhum registro encontrado",
  applyAllLabel = "Buscar todos",
}) {
  if (!open) return null;
  const term = String(query || "").trim();
  const hasQuery = term.length > 0;
  const hasListingData = hasQuery && total > 0;

  return (
    <div className="mg-search-dropdown" role="listbox" aria-label="Resultados da pesquisa">
      <div className={`mg-search-dropdown__list${!hasQuery ? " mg-search-dropdown__list--idle" : ""}`}>
        {!hasQuery ? null : items.length === 0 ? (
          <div className="mg-search-dropdown__empty">{emptyLabel}</div>
        ) : (
          items.map((record) => {
            const code = codeField ? getFieldValue(record, codeField) : null;
            const title = getFieldValue(record, titleField);
            return (
              <button
                key={record.id}
                type="button"
                className="mg-search-dropdown__item"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect?.(record)}
              >
                <div className="mg-search-dropdown__head">
                  <div className="mg-search-dropdown__title">
                    {code != null && code !== "" && code !== "—" ? (
                      <>
                        <span className="mg-search-dropdown__code">{renderSearchHighlight(String(code), term)}</span>
                        <span className="mg-search-dropdown__sep"> • </span>
                      </>
                    ) : null}
                    <span className="mg-search-dropdown__name">{renderSearchHighlight(String(title ?? "—"), term)}</span>
                  </div>
                </div>
                {detailFields.length > 0 ? (
                  <div className="mg-search-dropdown__meta">
                    {detailFields.map((field) => {
                      const value = getFieldValue(record, field.key);
                      return (
                        <div key={field.key} className="mg-search-dropdown__field">
                          <div className="mg-search-dropdown__field-line">
                            <span className="mg-search-dropdown__field-label">{field.label}:</span>
                            <span className="mg-search-dropdown__field-value">{renderSearchHighlight(value == null || value === "" ? "—" : String(value), term)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className={`mg-search-dropdown__footer${hasQuery ? " mg-search-dropdown__footer--with-counter" : ""}`}>
        <button
          type="button"
          className="mg-search-dropdown__footer-btn ios-btn tb-btn tb-btn-labeled tb-btn-ghost"
          disabled={!hasListingData}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { if (hasListingData) onApplyAll?.(); }}
        >
          {applyAllLabel}
        </button>
        {hasQuery ? (
          <span className="mg-search-dropdown__results-counter" aria-live="polite" aria-label={`${total} registros encontrados`}>
            {total}
          </span>
        ) : null}
      </div>
    </div>
  );
}
