import { useState } from 'react';
import { bootstrapFirstAdmin } from '@/modules/auth/application/localAuthService';
import AuthScreenShell, { AuthError, AuthField, AuthHint } from './AuthScreenShell';
import RecoveryKeyReveal from './RecoveryKeyReveal';

// Primeira execução (ADR-044): nenhum usuário ativo → cria o ADMIN inicial (sem senha padrão)
// e mostra a Recovery Key uma única vez antes de seguir para o login.
export default function FirstRunAdminSetupScreen({ onDone }) {
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (senha !== confirmar) {
      setError('A confirmação não confere com a senha.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await bootstrapFirstAdmin({ nome, login, senha });
      setSenha('');
      setConfirmar('');
      setRecoveryKey(result.recoveryKey);
    } catch (err) {
      setError(err?.message || 'Não foi possível criar o administrador.');
    } finally {
      setBusy(false);
    }
  };

  if (recoveryKey) {
    return (
      <AuthScreenShell title="Administrador criado" subtitle={`${nome.trim()} é o administrador do sistema.`}>
        <RecoveryKeyReveal recoveryKey={recoveryKey} continueLabel="Ir para o login" onContinue={() => { setRecoveryKey(null); onDone?.(); }} />
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell
      title="Configuração inicial"
      subtitle="Nenhum usuário foi encontrado. Crie o administrador do sistema para começar a usar o aplicativo."
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="setup-nome" label="Nome do administrador" value={nome} onChange={setNome} autoFocus autoComplete="name" />
        <AuthField id="setup-login" label="Login" value={login} onChange={setLogin} autoComplete="username" autoCapitalize="none" />
        <AuthField id="setup-senha" label="Senha" type="password" value={senha} onChange={setSenha} autoComplete="new-password" />
        <AuthField id="setup-confirmar" label="Confirmar senha" type="password" value={confirmar} onChange={setConfirmar} autoComplete="new-password" invalid={Boolean(error)} />
        <AuthHint>Mínimo de 6 caracteres. Senhas triviais (123456, admin, senha) ou iguais ao login não são aceitas. Uma chave de recuperação será gerada em seguida.</AuthHint>
        <AuthError message={error} />
        <div className="auth-actions">
          <button type="submit" className="auth-button" disabled={busy}>{busy ? 'Criando…' : 'Criar administrador'}</button>
        </div>
      </form>
    </AuthScreenShell>
  );
}
