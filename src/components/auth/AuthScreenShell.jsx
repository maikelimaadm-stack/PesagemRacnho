import { Scale, ShieldAlert, TimerReset } from 'lucide-react';
import { ModeloBase1Tokens } from '@/components/modelobase1';
import { APP_VERSION } from '@/versioning/versionInfo';
import './auth-screens.css';

// Moldura comum das telas de autenticação: nome do produto, título e versão discreta.
// Nenhum dado operacional é montado aqui (doc 11 §3).
export default function AuthScreenShell({ title, subtitle, children }) {
  return (
    <ModeloBase1Tokens enterpriseScope={false} className="auth-root">
      <main className="auth-screen">
        <section className="auth-card" aria-labelledby="auth-screen-title">
          <header className="auth-brand">
            <span className="auth-brand__icon"><Scale aria-hidden="true" /></span>
            <div>
              <strong>Pesagens Individuais</strong>
              <span>Operação local · offline</span>
            </div>
          </header>
          <div className="auth-heading">
            <h1 id="auth-screen-title">{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {children}
          <p className="auth-version">Versão {APP_VERSION}</p>
        </section>
      </main>
    </ModeloBase1Tokens>
  );
}

// Campo padrão das telas de acesso: rótulo acima, altura e foco do ModeloBase1.
export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoFocus = false,
  autoComplete,
  autoCapitalize,
  disabled = false,
  invalid = false,
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        required
      />
    </div>
  );
}

// Faixa de erro (vermelha). Mensagens genéricas por contrato: nunca detalham o motivo.
export function AuthError({ message }) {
  if (!message) return null;
  return (
    <p className="auth-banner auth-banner--error" role="alert">
      <ShieldAlert aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

// Faixa informativa (âmbar), usada na contagem regressiva do bloqueio temporário.
export function AuthInfo({ message }) {
  if (!message) return null;
  return (
    <p className="auth-banner auth-banner--info" role="status" aria-live="polite">
      <TimerReset aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

// Regra de senha exibida sob os campos (texto discreto).
export function AuthHint({ children }) {
  return <p className="auth-hint">{children}</p>;
}
