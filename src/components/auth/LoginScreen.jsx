import { useEffect, useRef, useState } from 'react';
import AuthScreenShell, { AuthError, AuthField, AuthInfo } from './AuthScreenShell';

export const GENERIC_LOGIN_ERROR = 'Login ou senha inválidos';

/** Contagem regressiva do bloqueio temporário; devolve segundos restantes (0 = liberado). */
export function useLockCountdown(lockedUntil, onRelease) {
  const [remaining, setRemaining] = useState(0);
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;
  useEffect(() => {
    if (!lockedUntil) {
      setRemaining(0);
      return undefined;
    }
    const tick = () => {
      const ms = lockedUntil - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        releaseRef.current?.();
        return;
      }
      setRemaining(Math.ceil(ms / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  return remaining;
}

export default function LoginScreen({ onLogin, onForgotPassword }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);
  const remaining = useLockCountdown(lockedUntil, () => setLockedUntil(null));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || lockedUntil) return;
    setBusy(true);
    setError('');
    try {
      await onLogin(login, senha);
    } catch (err) {
      // Erro genérico por contrato: inexistente, inativo e senha errada são indistinguíveis.
      if (err?.until) setLockedUntil(err.until);
      else setError(GENERIC_LOGIN_ERROR);
      setSenha('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell title="Entrar" subtitle="Informe seu login e senha para acessar o sistema.">
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="login-usuario" label="Login" value={login} onChange={setLogin} autoFocus autoComplete="username" autoCapitalize="none" invalid={Boolean(error)} />
        <AuthField id="login-senha" label="Senha" type="password" value={senha} onChange={setSenha} autoComplete="current-password" invalid={Boolean(error)} />
        <AuthInfo message={lockedUntil ? `Muitas tentativas incorretas. Aguarde ${remaining} s para tentar novamente.` : ''} />
        <AuthError message={error} />
        <div className="auth-actions">
          <button type="submit" className="auth-button" disabled={busy || Boolean(lockedUntil)}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
        {onForgotPassword ? (
          <p className="auth-links">
            <button type="button" className="auth-link" onClick={onForgotPassword} disabled={busy}>Esqueci a senha do administrador</button>
          </p>
        ) : null}
      </form>
    </AuthScreenShell>
  );
}
