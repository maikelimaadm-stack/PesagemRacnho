import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PANEL_WIDTH = 286;
const PANEL_HEIGHT = 322;

function parseValue(value) {
  const normalized = String(value || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date();
}

function formatIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplay(value) {
  if (!value) return "";
  const date = parseValue(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - firstWeekday + 1);
    return { date, currentMonth: date.getMonth() === month };
  });
}

export default function MakDateControl({ value, onChange, disabled = false, readOnly = false, className = "", ariaLabel, showIcon = true }) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(() => parseValue(value));
  const selectedDate = value ? parseValue(value) : null;
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!open && value) setVisibleMonth(parseValue(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
      const top = rect.bottom + PANEL_HEIGHT + 6 <= window.innerHeight
        ? rect.bottom + 4
        : Math.max(8, rect.top - PANEL_HEIGHT - 4);
      // pointerEvents: aberto de dentro de um diálogo modal (ex.: posologia no Lançamento), o painel fica no body,
      // que o diálogo deixa sem eventos de ponteiro; o calendário precisa continuar clicável.
      setPanelStyle({ position: "fixed", left, top, width: PANEL_WIDTH, pointerEvents: "auto" });
    };

    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    updatePosition();
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const togglePicker = () => {
    if (disabled || readOnly) return;
    setOpen((current) => !current);
  };

  const emitValue = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
  };

  const selectDate = (date) => {
    emitValue(formatIso(date));
    setVisibleMonth(date);
    setOpen(false);
    inputRef.current?.focus();
  };

  const moveMonth = (amount) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const panel = open && panelStyle ? createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={ariaLabel ? `Calendário: ${ariaLabel}` : "Calendário"}
      className="mak-date-picker-panel"
      style={panelStyle}
    >
      <div className="mak-date-picker-panel__header">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft aria-hidden="true" /></button>
        <strong>{MONTHS[visibleMonth.getMonth()]} de {visibleMonth.getFullYear()}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="mak-date-picker-panel__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="mak-date-picker-panel__days" role="grid">
        {days.map(({ date, currentMonth }) => {
          const selected = selectedDate && sameDay(date, selectedDate);
          const isToday = sameDay(date, today);
          return (
            <button
              key={formatIso(date)}
              type="button"
              role="gridcell"
              className={`${currentMonth ? "" : "is-outside"}${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`.trim()}
              aria-selected={Boolean(selected)}
              onClick={() => selectDate(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mak-date-picker-panel__footer">
        <button type="button" onClick={() => selectDate(new Date())}>Hoje</button>
        <button type="button" onClick={() => { emitValue(""); setOpen(false); }} disabled={!value}>Limpar</button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} className={`mak-date-control${open ? " is-open" : ""}${showIcon ? "" : " is-iconless"}${className ? ` ${className}` : ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={formatDisplay(value)}
        readOnly
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        placeholder="dd/mm/aaaa"
        onClick={togglePicker}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) togglePicker();
          }
          if (event.key === "Tab" && open) setOpen(false);
        }}
      />
      {showIcon ? (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || readOnly}
          onClick={togglePicker}
          aria-label="Abrir calendário"
          title="Abrir calendário"
        >
          <Calendar aria-hidden="true" />
        </button>
      ) : null}
      {panel}
    </div>
  );
}
