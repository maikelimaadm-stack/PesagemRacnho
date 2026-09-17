import React from "react";
import { Columns3Cog } from "./mgIcons";

/**
 * Faixa abaixo da barra de ações do ModeloBase1: pílulas de filtro à esquerda e
 * configuração de colunas à direita (porte de
 * PROJETOMG-main/src/framework/mak/layout/MgTablePanelStrip.jsx).
 * As pílulas são passadas como `children` (MakFilterRail + MakFilterPill).
 * Estilos: `.mg-table-panel-strip*`, `.mg-panel-strip__filters` (mg-layout.css).
 */
export default function MgTablePanelStrip({ children, onConfigColumns, disabled = false }) {
  return (
    <div data-template-id="table-panel" className="mg-table-panel-strip">
      <div className="mg-panel-strip__filters">{children}</div>
      <div className="mg-table-panel-strip__actions">
        <div className="mg-table-panel-strip__action">
          <button
            type="button"
            className="mg-nav-btn ios-btn mg-table-panel-strip__config-btn"
            onClick={onConfigColumns}
            disabled={disabled || !onConfigColumns}
            title="Configurar colunas da tabela"
            aria-label="Configurar colunas da tabela"
          >
            <Columns3Cog className="mg-table-panel-strip__config-icon" strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}
