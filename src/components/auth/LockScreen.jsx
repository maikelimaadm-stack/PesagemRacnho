import { useState } from 'react';
import { profileLabel } from '@/modules/auth/domain/accessPolicy';
import AuthScreenShell, { AuthError, AuthField, AuthInfo } from './AuthScreenShell';
import { GENERIC_LOGIN_ERROR, useLockCountdown } from './LoginScreen';

function initials(nome) {
  return String(nome || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('pt-BR'))
    .join('') || '?';
}

// Bloqueio por inatividade ou manual: pede a senha do mesmo usuário; "Trocar usuário" volta ao login.
export default function LockScreen({ user, onUnlock, onSwitchUser }) {
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
      await onUnlock(senha);
    } catch (err) {
      if (err?.until) setLockedUntil(err.until);
      else setError(GENERIC_LOGIN_ERROR);
      setSenha('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell title="Sessão bloqueada" subtitle="Informe sua senha para continuar de onde parou.">
      <div className="auth-user-chip">
        <span className="auth-user-chip__avatar" aria-hidden="true">{initials(user?.nome)}</span>
        <div>
          <strong>{user?.nome}</strong>
          <span>{user?.login} · {profileLabel(user?.perfil)}</span>
        </div>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="lock-senha" label="Senha" type="password" value={senha} onChange={setSenha} autoFocus autoComplete="current-password" invalid={Boolean(error)} />
        <AuthInfo message={lockedUntil ? `Muitas tentativas incorretas. Aguarde ${remaining} s para tentar novamente.` : ''} />
        <AuthError message={error} />
        <div className="auth-actions">
          <button type="button" className="auth-button auth-button--ghost" onClick={onSwitchUser} disabled={busy}>Trocar usuário</button>
          <button type="submit" className="auth-button" disabled={busy || Boolean(lockedUntil)}>{busy ? 'Verificando…' : 'Desbloquear'}</button>
        </div>
      </form>
    </AuthScreenShell>
  );
}
