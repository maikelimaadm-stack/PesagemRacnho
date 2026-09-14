import React, { useEffect, useId } from "react";
import { MoreVertical } from "lucide-react";

/**
 * Menu "Mais opções" do ModeloBase1 (porte de
 * PROJETOMG-main/src/framework/mak/layout/MgSpeedDialMenu.jsx).
 * Estilos: `.mg-speed-dial*` em src/styles/modelobase1/mg-layout.css.
 */
export default function MgSpeedDialMenu({
  open = false,
  onOpenChange,
  disabled = false,
  items = [],
  triggerId = "more-btn",
  menuId = "more-dd",
  label = "Mais opções",
}) {
  const labelId = useId();

  useEffect(() => {
    if (!open || disabled) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disabled, onOpenChange, open]);

  const handleToggle = () => {
    if (disabled) return;
    onOpenChange?.(!open);
  };

  const handleAction = (item) => {
    if (item.disabled) return;
    item.onClick?.();
    onOpenChange?.(false);
  };

  return (
    <div className={`mg-speed-dial${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
      {open ? (
        <button
          type="button"
          className="mg-speed-dial__backdrop"
          aria-label="Fechar menu de opções"
          tabIndex={-1}
          onClick={() => onOpenChange?.(false)}
        />
      ) : null}

      <div id={menuId} className="mg-speed-dial__panel" role="menu" aria-labelledby={labelId} aria-hidden={!open}>
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="mg-speed-dial__item"
              role="menuitem"
              disabled={item.disabled}
              tabIndex={open ? 0 : -1}
              style={{ "--speed-dial-index": index, "--speed-dial-total": Math.max(items.length - 1, 0) }}
              onClick={() => handleAction(item)}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {item.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="mg-speed-dial__trigger ios-btn tb-btn tb-btn-ghost tb-btn-more tb-btn-icon mg-accent-icon-btn"
        id={triggerId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-labelledby={labelId}
        title={label}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span id={labelId} className="sr-only">{label}</span>
        <MoreVertical className="mg-speed-dial__trigger-icon h-4 w-4" stroke="currentColor" />
      </button>
    </div>
  );
}
