import React from "react";
import { X } from "lucide-react";
import MgCmdSelect from "./MgCmdSelect";
import MakDateControl from "./MakDateControl";

/**
 * Painel lateral de filtros do ModeloBase1 (porte de
 * PROJETOMG-main/src/framework/mak/layout/MgFilterPanel.jsx), com os campos
 * declarados por tipo: texto (contém), seleção e data.
 * Estilos: `.filter-panel*`, `.fg`, `.fg-label`, `.cmd-select`, `.tb-btn` (mg-layout.css).
 * Valores seguem o contrato do modelo: array vazio = sem filtro; [valor] = filtro ativo.
 */
export default function MgFilterPanel({
  open,
  values = {},
  onChange,
  onClose,
  onClear,
  onApply,
  disabled = false,
  textFields = [],
  selectFields = [],
  dateFields = [],
  title = "Filtros",
  applyLabel = "Aplicar",
  clearLabel = "Limpar",
}) {
  const readSingle = (key) => {
    const current = values[key];
    if (Array.isArray(current) && current.length > 0) return current[0];
    return "";
  };
  const writeSingle = (key, next) => onChange?.(key, next ? [next] : []);

  return (
    <aside id="filter-panel" className={`filter-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="filter-panel__inner">
        <div className="filter-panel__header">
          <span className="filter-panel__title">{title}</span>
          <button type="button" className="filter-panel__close ios-btn" onClick={onClose} aria-label="Fechar filtros">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="filter-panel__body">
          {textFields.map((field) => (
            <div key={field.key} className="fg">
              <label className="fg-label" htmlFor={`filter-panel-${field.key}`}>{field.label}</label>
              <input
                id={`filter-panel-${field.key}`}
                type="text"
                value={readSingle(field.key)}
                placeholder={field.placeholder || ""}
                disabled={disabled}
                onChange={(event) => writeSingle(field.key, event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") onApply?.(); }}
              />
            </div>
          ))}

          {dateFields.map((field) => (
            <div key={field.key} className="fg">
              <label className="fg-label">{field.label}</label>
              <MakDateControl
                value={readSingle(field.key)}
                onChange={(event) => writeSingle(field.key, event.target.value)}
                ariaLabel={field.label}
              />
            </div>
          ))}

          {selectFields.map((field) => {
            const options = field.options ?? [];
            const allValue = field.allValue ?? "Todos";
            const current = readSingle(field.key) || allValue;
            return (
              <MgCmdSelect
                key={field.key}
                label={field.label}
                value={current}
                options={options}
                disabled={disabled}
                onChange={(next) => onChange?.(field.key, next === allValue || !next ? [] : [next])}
              />
            );
          })}
        </div>

        <div className="filter-panel__footer">
          <button type="button" className="tb-btn tb-btn-ghost" onClick={onClear} disabled={disabled}>
            {clearLabel}
          </button>
          <button type="button" className="tb-btn tb-btn-blue" onClick={() => onApply?.()} disabled={disabled}>
            {applyLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
