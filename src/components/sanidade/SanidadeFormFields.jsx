// Campos dos diálogos da Sanidade: rótulo + controle no acabamento dos pop-ups padronizados
// (d17b-standard-dialog). Seleções opcionais oferecem "Nenhum" para limpar o valor.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const NONE_VALUE = '__nenhum__';

export function SanidadeField({ id, label, required = false, wide = false, hint, children }) {
  return (
    <div className={`sanidade-form__field${wide ? ' sanidade-form__field--wide' : ''}`}>
      <label className={`sanidade-form__label${required ? ' is-required' : ''}`} htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="sanidade-form__hint">{hint}</p> : null}
    </div>
  );
}

export function SanidadeTextInput({ id, value, onChange, disabled, inputMode, autoFocus, maxLength, placeholder }) {
  return (
    <input
      id={id}
      type="text"
      className="sanidade-form__control"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      inputMode={inputMode}
      autoFocus={autoFocus}
      autoComplete="off"
      maxLength={maxLength}
      placeholder={placeholder}
    />
  );
}

export function SanidadeTextArea({ id, value, onChange, disabled, rows = 3, maxLength }) {
  return (
    <textarea
      id={id}
      className="sanidade-form__control sanidade-form__control--textarea"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      rows={rows}
      maxLength={maxLength}
    />
  );
}

export function SanidadeSelect({ id, value, onChange, options, disabled, required = false, noneLabel = 'Nenhum', ariaLabel, className = '' }) {
  const current = value ? String(value) : (required ? '' : NONE_VALUE);
  return (
    <Select value={current} onValueChange={(next) => onChange(next === NONE_VALUE ? '' : next)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={`sanidade-form__control sanidade-form__select ${className}`.trim()}>
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent position="popper" className="sanidade-select-panel">
        {!required ? <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem> : null}
        {options.map((option) => <SelectItem key={String(option.value)} value={String(option.value)}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
