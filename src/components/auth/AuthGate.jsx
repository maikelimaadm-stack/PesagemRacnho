import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as localAuthService from '@/modules/auth/application/localAuthService';
import * as authSession from '@/modules/auth/application/authSession';
import { can } from '@/modules/auth/domain/accessPolicy';
import { getInactivityMinutes } from '@/modules/settings/application/appConfigService';
import { ModeloBase1Tokens } from '@/components/modelobase1';
import { AuthContext } from './useAuth';
import ConfiguracaoInicialScreen from './ConfiguracaoInicialScreen';
import LoginScreen from './LoginScreen';
import LockScreen from './LockScreen';
import TrocarSenhaScreen from './TrocarSenhaScreen';
import './auth-screens.css';

const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'mousemove', 'wheel', 'touchstart'];
const INACTIVITY_POLL_MS = 15000;

// Aplica o tema salvo antes do shell montar, para as telas de login respeitarem a preferência.
function applyStoredTheme() {
  try {
    const dark = localStorage.getItem('erp-tema') === 'escuro';
    const root = document.documentElement;
    for (const name of ['dark', 'tema-escuro', 'escuro']) root.classList.toggle(name, dark);
    root.classList.toggle('tema-claro', !dark);
  } catch {
    // Sem localStorage: tema claro.
  }
}

function StatusScreen({ children }) {
  return (
    <ModeloBase1Tokens enterpriseScope={false} className="auth-root">
      <main className="auth-screen"><p className="auth-version">{children}</p></main>
    </ModeloBase1Tokens>
  );
}

/**
 * Decide: carregando → Configuração inicial (sem usuários) → Login → Troca obrigatória →
 * Bloqueio por inatividade → aplicativo. Nenhuma tela de dados é montada antes da autenticação.
 */
export default function AuthGate({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | setup | login | change-password | locked | app | error
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState('');
  const voluntaryChange = useRef(false);

  const goToEntry = useCallback(async () => {
    setUser(null);
    const total = await localAuthService.countActiveUsers();
    setPhase(total === 0 ? 'setup' : 'login');
  }, []);

  const enterApp = useCallback(async (authUser) => {
    setUser(authUser);
    try {
      authSession.setInactivityMinutes(await getInactivityMinutes());
    } catch {
      authSession.setInactivityMinutes(authSession.DEFAULT_INACTIVITY_MINUTES);
    }
    voluntaryChange.current = false;
    setPhase(authUser.deve_trocar_senha ? 'change-password' : 'app');
  }, []);

  // Sessão encerrada por qualquer caminho (menu, restauração de backup, limpeza) → volta à entrada.
  useEffect(() => authSession.subscribe((session) => {
    if (!session) goToEntry().catch((err) => { setBootError(err?.message || 'Falha ao preparar a autenticação.'); setPhase('error'); });
  }), [goToEntry]);

  useEffect(() => {
    applyStoredTheme();
    let active = true;
    (async () => {
      try {
        const restored = authSession.restoreSession();
        if (restored) {
          const found = await localAuthService.findActiveUser(restored.userId);
          if (!active) return;
          if (found) {
            await enterApp(found);
            if (restored.locked) setPhase('locked');
            return;
          }
          authSession.logout(); // usuário inativado/excluído: a assinatura acima leva à entrada
          return;
        }
        await goToEntry();
      } catch (err) {
        if (!active) return;
        setBootError(err?.message || 'Falha ao preparar a autenticação.');
        setPhase('error');
      }
    })();
    return () => { active = false; };
  }, [enterApp, goToEntry]);

  // Atividade (teclado/mouse) com throttle no authSession; verificação periódica de inatividade.
  useEffect(() => {
    if (phase !== 'app') return undefined;
    const onActivity = () => authSession.touch();
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    const timer = window.setInterval(() => {
      if (authSession.checkInactivity()) setPhase('locked');
    }, INACTIVITY_POLL_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      window.clearInterval(timer);
    };
  }, [phase]);

  const handleLogin = useCallback(async (login, senha) => {
    const authUser = await localAuthService.authenticate(login, senha);
    authSession.startSession(authUser);
    await enterApp(authUser);
  }, [enterApp]);

  const handleUnlock = useCallback(async (senha) => {
    // Mesma regra de tentativas do login; a sessão é a mesma, só muda o estado de bloqueio.
    await localAuthService.authenticate(user.login, senha);
    authSession.unlock();
    setPhase(user.deve_trocar_senha ? 'change-password' : 'app');
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    can: (permission) => can(user?.perfil, permission),
    lock: () => { authSession.lock(); setPhase('locked'); },
    logout: () => authSession.logout(),
    switchUser: () => authSession.logout(),
    changePassword: () => { voluntaryChange.current = true; setPhase('change-password'); },
  }), [user]);

  if (phase === 'error') return <StatusScreen>Não foi possível preparar a autenticação. {bootError}</StatusScreen>;
  if (phase === 'loading') return <StatusScreen>Preparando o acesso…</StatusScreen>;
  if (phase === 'setup') return <ConfiguracaoInicialScreen onDone={() => setPhase('login')} />;
  if (phase === 'login') return <LoginScreen onLogin={handleLogin} />;
  if (phase === 'change-password') {
    return (
      <TrocarSenhaScreen
        user={user}
        mandatory={!voluntaryChange.current}
        onDone={(updated) => { setUser(updated); voluntaryChange.current = false; setPhase('app'); }}
        onCancel={() => { voluntaryChange.current = false; setPhase('app'); }}
        onLogout={() => authSession.logout()}
      />
    );
  }
  if (phase === 'locked') return <LockScreen user={user} onUnlock={handleUnlock} onSwitchUser={() => authSession.logout()} />;

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
