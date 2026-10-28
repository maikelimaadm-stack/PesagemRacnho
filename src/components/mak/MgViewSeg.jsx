import React, { useLayoutEffect, useRef } from "react";
import { FileText, LayoutDashboard, TableProperties } from "lucide-react";

/**
 * Segmento de visão da barra ModeloBase1 (porte de
 * PROJETOMG-main/.../MgViewSeg.jsx): Registro / Tabela / Cards.
 * Ativo = acento lima (#40de63); inativos = preto/cinza.
 */
const MODES = [
  { id: "registro", icon: FileText, title: "Registro" },
  { id: "tabela", icon: TableProperties, title: "Tabela" },
  { id: "cards", icon: LayoutDashboard, title: "Cards" },
];

export default function MgViewSeg({
  value = "tabela",
  onChange,
  disabled = false,
  canOpenRecord = true,
  className = "",
}) {
  const segRef = useRef(null);
  const sliderRef = useRef(null);

  useLayoutEffect(() => {
    const control = segRef.current;
    const slider = sliderRef.current;
    const active = control?.querySelector(".view-mode-btn.active");
    if (!control || !slider || !active) return;
    slider.style.width = `${active.offsetWidth}px`;
    slider.style.transform = `translateX(${active.offsetLeft}px)`;
  }, [value]);

  return (
    <div
      className={`view-seg${className ? ` ${className}` : ""}`}
      ref={segRef}
      role="group"
      aria-label="Modo de visualização"
    >
      <div className="view-seg-slider" ref={sliderRef} aria-hidden="true" />
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.id;
        const recordBlocked = mode.id === "registro" && !canOpenRecord && !active;
        return (
          <button
            key={mode.id}
            type="button"
            className={`view-mode-btn${active ? " active" : ""}`}
            data-view={mode.id}
            title={mode.title}
            aria-label={`Visualizar ${mode.title.toLocaleLowerCase("pt-BR")}`}
            aria-pressed={active}
            disabled={disabled || recordBlocked}
            onClick={() => onChange?.(mode.id)}
          >
            <Icon className="view-mode-btn__icon" strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
