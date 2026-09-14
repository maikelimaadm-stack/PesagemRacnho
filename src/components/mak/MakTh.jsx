import React, { useRef } from "react";
import { ArrowUp, ArrowDown, MoreVertical, X } from "lucide-react";
import MakColumnMenu, { isMakColumnFilterActive } from "./MakColumnMenu";

/**
 * Célula de cabeçalho com o MESMO HTML do Cadastro de Empresas
 * (MakCadastroTable.jsx do modelobase1):
 *
 *   <th class="emp-th">
 *     <div class="emp-th-label-wrap">
 *       <span class="emp-th-label">Rótulo</span>
 *       <div class="emp-th-trailing">
 *         <span class="emp-th-icon-button emp-th-icon-button--indicator">…seta…</span>
 *         <button class="emp-th-menu-button"><MoreVertical class="emp-th-menu-button__icon"/></button>
 *       </div>
 *     </div>
 *   </th>
 *
 * Assim o CSS original (src/styles/modelobase1/) se aplica sem adaptação.
 */
export default function MakTh({
  label,
  sortDirection = null, // 'asc' | 'desc' | null
  onSort,
  onOpenMenu,
  menuOpen = false,
  className = "",
  style,
  colSpan,
  menu = null,
}) {
  const thRef = useRef(null);
  const hasActiveFilter = Boolean(menu && isMakColumnFilterActive(menu.valorFiltro));
  return (
    <th
      ref={thRef}
      className={`emp-th ${className}`.trim()}
      style={{ position: "relative", ...(style || {}) }}
      colSpan={colSpan}
      onClick={(event) => {
        if (event.target?.closest?.("button, [role='separator']")) return;
        onSort?.();
      }}
    >
      <div className="emp-th-label-wrap flex w-full h-full min-w-0 overflow-hidden">
        <span
          className="emp-th-label flex-1 min-w-0 truncate font-semibold whitespace-nowrap text-left"
          title={typeof label === "string" ? label : undefined}
        >
          {label}
        </span>
        <div className="emp-th-trailing flex shrink-0 items-center">
          {sortDirection ? (
            <span className="emp-th-icon-button emp-th-icon-button--indicator" aria-hidden="true">
              {sortDirection === "desc" ? (
                <ArrowDown className="emp-th-icon-button__icon" strokeWidth={2.2} />
              ) : (
                <ArrowUp className="emp-th-icon-button__icon" strokeWidth={2.2} />
              )}
            </span>
          ) : null}
          {hasActiveFilter ? (
            <button
              type="button"
              className="emp-th-icon-button emp-th-filter-clear-button is-active"
              aria-label={`Limpar filtro da coluna ${typeof label === "string" ? label : ""}`.trim()}
              title="Limpar filtro da coluna"
              onClick={(event) => {
                event.stopPropagation();
                menu?.onFiltrar?.(null);
              }}
            >
              <X className="emp-th-icon-button__icon" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
          {onOpenMenu !== null ? (
            <button
              type="button"
              className={`emp-th-menu-button${menuOpen ? " is-open" : ""}`}
              aria-label={`Abrir menu da coluna ${typeof label === "string" ? label : ""}`.trim()}
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu?.();
              }}
            >
              <MoreVertical className="emp-th-menu-button__icon" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {menu ? <MakColumnMenu aberto={menuOpen} onFechar={menu.onFechar} label={typeof label === "string" ? label : ""} valorFiltro={menu.valorFiltro} filterType={menu.filterType} onFiltrar={menu.onFiltrar} onCongelar={menu.onCongelar} onAutoAjustar={menu.onAutoAjustar} onOcultar={menu.onOcultar} congelada={menu.congelada} listOptions={menu.listOptions} anchorRef={thRef} /> : null}
    </th>
  );
}

/** Classe de linha igual à do modelo (zebra por índice + linha de dados). */
export function makRowClass(index) {
  return `emp-table-data-row ${index % 2 === 0 ? "emp-row-even" : "emp-row-odd"}`;
}
