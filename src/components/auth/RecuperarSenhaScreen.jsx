import { useState } from 'react';
import { recoverAdminPassword } from '@/modules/auth/application/localAuthService';
import AuthScreenShell, { AuthError, AuthField, AuthHint, AuthInfo } from './AuthScreenShell';
import { useLockCountdown } from './LoginScreen';
import RecoveryKeyReveal from './RecoveryKeyReveal';

export const GENERIC_RECOVERY_ERROR = 'Login ou chave de recuperação inválidos';

// Recuperação da senha do administrador pela Recovery Key (ADR-044). Key inválida conta
// como falha (mesmo bloqueio do login). Sucesso: nova senha, key anterior invalidada e uma
// NOVA key exibida uma única vez.
export default function RecuperarSenhaScreen({ onDone, onCancel }) {
  const [login, setLogin] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const remaining = useLockCountdown(lockedUntil, () => setLockedUntil(null));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || lockedUntil) return;
    if (novaSenha !== confirmar) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await recoverAdminPassword({ login, recoveryKey, novaSenha });
      setRecoveryKey('');
      setNovaSenha('');
      setConfirmar('');
      setNewKey(result.recoveryKey);
    } catch (err) {
      if (err?.until) setLockedUntil(err.until);
      else if (err?.code === 'AUTH_WEAK_PASSWORD') setError(err.message);
      else setError(GENERIC_RECOVERY_ERROR);
      setRecoveryKey('');
    } finally {
      setBusy(false);
    }
  };

  if (newKey) {
    return (
      <AuthScreenShell title="Senha redefinida" subtitle="A chave anterior foi invalidada. Guarde a nova chave de recuperação.">
        <RecoveryKeyReveal recoveryKey={newKey} title="Nova chave de recuperação" continueLabel="Ir para o login" onContinue={() => { setNewKey(null); onDone?.(); }} />
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell title="Recuperar senha do administrador" subtitle="Informe o login do administrador, a chave de recuperação mostrada na configuração inicial e a nova senha.">
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="recuperar-login" label="Login do administrador" value={login} onChange={setLogin} autoFocus autoComplete="username" autoCapitalize="none" invalid={Boolean(error)} />
        <AuthField id="recuperar-chave" label="Chave de recuperação" value={recoveryKey} onChange={setRecoveryKey} autoComplete="off" autoCapitalize="characters" invalid={Boolean(error)} />
        <AuthField id="recuperar-nova" label="Nova senha" type="password" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
        <AuthField id="recuperar-confirmar" label="Confirmar nova senha" type="password" value={confirmar} onChange={setConfirmar} autoComplete="new-password" />
        <AuthHint>Mínimo de 6 caracteres. Senhas triviais ou iguais ao login não são aceitas.</AuthHint>
        <AuthInfo message={lockedUntil ? `Muitas tentativas incorretas. Aguarde ${remaining} s para tentar novamente.` : ''} />
        <AuthError message={error} />
        <div className="auth-actions">
          <button type="button" className="auth-button auth-button--ghost" onClick={onCancel} disabled={busy}>Voltar ao login</button>
          <button type="submit" className="auth-button" disabled={busy || Boolean(lockedUntil)}>{busy ? 'Redefinindo…' : 'Redefinir senha'}</button>
        </div>
      </form>
    </AuthScreenShell>
  );
}
