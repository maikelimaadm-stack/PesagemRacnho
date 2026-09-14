import React, { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export default function MakTableSelectCheck({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  disabled = false,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <span
      className={`mak-table-select-check${checked ? " is-checked" : ""}${indeterminate && !checked ? " is-indeterminate" : ""}${disabled ? " is-disabled" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => { event.stopPropagation(); onChange?.(event.target.checked, event); }}
        onClick={(event) => event.stopPropagation()}
      />
      {checked ? <Check aria-hidden="true" /> : null}
      {indeterminate && !checked ? <span className="mak-table-select-check__dash" aria-hidden="true" /> : null}
    </span>
  );
}
