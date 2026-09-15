import { useState } from 'react';
import { changeOwnPassword } from '@/modules/auth/application/localAuthService';
import AuthScreenShell, { AuthError, AuthField, AuthHint } from './AuthScreenShell';

// Troca da própria senha. `mandatory` = deve_trocar_senha (sem Cancelar; só Sair).
export default function TrocarSenhaScreen({ user, mandatory = false, onDone, onCancel, onLogout }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (novaSenha !== confirmar) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    if (novaSenha === senhaAtual) {
      setError('A nova senha deve ser diferente da atual.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await changeOwnPassword(user.id, senhaAtual, novaSenha);
      onDone?.(updated);
    } catch (err) {
      if (err?.code === 'AUTH_INVALID') setError('Senha atual incorreta.');
      else setError(err?.message || 'Não foi possível trocar a senha.');
      setSenhaAtual('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell
      title="Trocar senha"
      subtitle={mandatory
        ? `${user?.nome}, sua senha precisa ser trocada antes de continuar.`
        : `${user?.nome}, informe a senha atual e escolha a nova senha.`}
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="troca-atual" label="Senha atual" type="password" value={senhaAtual} onChange={setSenhaAtual} autoFocus autoComplete="current-password" />
        <AuthField id="troca-nova" label="Nova senha" type="password" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
        <AuthField id="troca-confirmar" label="Confirmar nova senha" type="password" value={confirmar} onChange={setConfirmar} autoComplete="new-password" invalid={Boolean(error)} />
        <AuthHint>Mínimo de 6 caracteres. Senhas triviais ou iguais ao login não são aceitas.</AuthHint>
        <AuthError message={error} />
        <div className="auth-actions">
          {mandatory
            ? <button type="button" className="auth-button auth-button--ghost" onClick={onLogout} disabled={busy}>Sair</button>
            : <button type="button" className="auth-button auth-button--ghost" onClick={onCancel} disabled={busy}>Cancelar</button>}
          <button type="submit" className="auth-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        </div>
      </form>
    </AuthScreenShell>
  );
}
