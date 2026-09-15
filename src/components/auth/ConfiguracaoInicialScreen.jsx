import { useState } from 'react';
import { createInitialAdmin } from '@/modules/auth/application/localAuthService';
import AuthScreenShell, { AuthError, AuthField, AuthHint } from './AuthScreenShell';

// Primeira execução: nenhum usuário ativo → cria o administrador (sem senha padrão, ADR-035).
export default function ConfiguracaoInicialScreen({ onDone }) {
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      await createInitialAdmin({ nome, login, senha });
      onDone?.();
    } catch (err) {
      setError(err?.message || 'Não foi possível criar o administrador.');
    } finally {
      setBusy(false);
    }
  };

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
        <AuthHint>Mínimo de 6 caracteres. Senhas triviais (123456, admin, senha) ou iguais ao login não são aceitas.</AuthHint>
        <AuthError message={error} />
        <div className="auth-actions">
          <button type="submit" className="auth-button" disabled={busy}>{busy ? 'Criando…' : 'Criar administrador'}</button>
        </div>
      </form>
    </AuthScreenShell>
  );
}
