import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as localAuthService from '@/modules/auth/application/localAuthService';
import * as authSession from '@/modules/auth/application/authSession';
import { can } from '@/modules/auth/domain/permissionService';
import { getAuthPolicy } from '@/modules/settings/application/appConfigService';
import { ModeloBase1Tokens } from '@/components/modelobase1';
import { AuthContext } from './useAuth';
import FirstRunAdminSetupScreen from './FirstRunAdminSetupScreen';
import LoginScreen from './LoginScreen';
import RecuperarSenhaScreen from './RecuperarSenhaScreen';
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

// Lê a política de sessão (auth-policy.inactivity_lock_minutes; 0 desliga) com fallback no padrão.
async function applyInactivityPolicy() {
  try {
    const policy = await getAuthPolicy();
    authSession.setInactivityMinutes(policy.inactivity_lock_minutes);
  } catch {
    authSession.setInactivityMinutes(authSession.DEFAULT_INACTIVITY_MINUTES);
  }
}

/**
 * Decide: carregando → Configuração inicial (sem usuários) → Login (ou Recuperar senha) →
 * Troca obrigatória → aplicativo. Nenhuma tela de dados é montada antes da autenticação.
 * Bloqueio por inatividade e troca voluntária de senha são CAMADAS sobre o app (ADR-045):
 * a tela do operador continua montada, inerte, e volta exatamente onde estava.
 */
export default function AuthGate({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | setup | login | recover | change-password | app | error
  const [overlay, setOverlay] = useState(null); // null | 'locked' | 'change-password'
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState('');
  const userRef = useRef(null);
  userRef.current = user;

  const fail = useCallback((err) => {
    setBootError(err?.message || 'Falha ao preparar a autenticação.');
    setPhase('error');
  }, []);

  const goToEntry = useCallback(async () => {
    setUser(null);
    setOverlay(null);
    const total = await localAuthService.countActiveUsers();
    setPhase(total === 0 ? 'setup' : 'login');
  }, []);

  const enterApp = useCallback(async (authUser, { locked = false } = {}) => {
    setUser(authUser);
    await applyInactivityPolicy();
    setOverlay(locked ? 'locked' : null);
    setPhase(authUser.must_change_password ? 'change-password' : 'app');
  }, []);

  // Sessão encerrada por qualquer caminho (menu, restauração de backup, limpeza) → volta à entrada.
  // Bloqueio/desbloqueio vindos do serviço (inatividade) refletem na camada.
  useEffect(() => authSession.subscribe((session, reason) => {
    if (!session) {
      goToEntry().catch(fail);
      return;
    }
    if (reason === 'lock') setOverlay('locked');
    if (reason === 'unlock') setOverlay((current) => (current === 'locked' ? null : current));
  }), [goToEntry, fail]);

  useEffect(() => {
    applyStoredTheme();
    let active = true;
    (async () => {
      try {
        const restored = authSession.restoreSession();
        if (restored) {
          // Recarga técnica do renderer: ressincroniza com o banco e encerra se inativo/inexistente.
          const found = await localAuthService.findActiveUser(restored.userId);
          if (!active) return;
          if (found) {
            authSession.updateSessionUser(found);
            await enterApp(found, { locked: restored.locked });
            return;
          }
          authSession.logout(); // a assinatura acima leva à entrada
          return;
        }
        await goToEntry();
      } catch (err) {
        if (active) fail(err);
      }
    })();
    return () => { active = false; };
  }, [enterApp, goToEntry, fail]);

  // Atividade (teclado/mouse) com throttle no authSession; verificação periódica de inatividade.
  useEffect(() => {
    if (phase !== 'app' || overlay) return undefined;
    const onActivity = () => authSession.touch();
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    const timer = window.setInterval(() => {
      if (authSession.checkInactivity()) setOverlay('locked');
    }, INACTIVITY_POLL_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      window.clearInterval(timer);
    };
  }, [phase, overlay]);

  const handleLogin = useCallback(async (login, senha) => {
    const authUser = await localAuthService.authenticate(login, senha);
    authSession.startSession(authUser);
    await enterApp(authUser);
  }, [enterApp]);

  const handleUnlock = useCallback(async (senha) => {
    // Mesma regra de tentativas do login; a sessão é a mesma, só muda o estado de bloqueio.
    const current = userRef.current;
    const refreshed = await localAuthService.authenticate(current.login, senha);
    authSession.unlock();
    setUser(refreshed);
    setOverlay(null);
    if (refreshed.must_change_password) setPhase('change-password');
  }, []);

  const endSession = useCallback((motivo) => {
    const current = userRef.current;
    localAuthService.registerLogout(current, { motivo }).catch(() => {});
    if (motivo === 'TROCAR_USUARIO') authSession.switchUser();
    else authSession.logout();
  }, []);

  const contextValue = useMemo(() => ({
    user,
    role: user?.role ?? null,
    can: (action) => can(user?.role, action),
    lock: () => { authSession.lock(); setOverlay('locked'); },
    logout: () => endSession('SAIR'),
    switchUser: () => endSession('TROCAR_USUARIO'),
    changePassword: () => setOverlay('change-password'),
  }), [user, endSession]);

  if (phase === 'error') return <StatusScreen>Não foi possível preparar a autenticação. {bootError}</StatusScreen>;
  if (phase === 'loading') return <StatusScreen>Preparando o acesso…</StatusScreen>;
  if (phase === 'setup') return <FirstRunAdminSetupScreen onDone={() => setPhase('login')} />;
  if (phase === 'recover') return <RecuperarSenhaScreen onDone={() => setPhase('login')} onCancel={() => setPhase('login')} />;
  if (phase === 'login') return <LoginScreen onLogin={handleLogin} onForgotPassword={() => setPhase('recover')} />;
  if (phase === 'change-password') {
    // Troca OBRIGATÓRIA (must_change_password): tela cheia, antes de montar qualquer dado.
    return (
      <TrocarSenhaScreen
        user={user}
        mandatory
        onDone={(updated) => { setUser(updated); setPhase('app'); }}
        onLogout={() => endSession('SAIR')}
      />
    );
  }

  const inert = overlay ? '' : undefined; // React 18: atributo booleano `inert` via string vazia
  return (
    <AuthContext.Provider value={contextValue}>
      <div className={`auth-app${overlay ? ' auth-app--under-overlay' : ''}`} inert={inert} aria-hidden={overlay ? true : undefined}>
        {children}
      </div>
      {overlay === 'locked' ? (
        <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Sessão bloqueada">
          <LockScreen user={user} onUnlock={handleUnlock} onSwitchUser={() => endSession('TROCAR_USUARIO')} />
        </div>
      ) : null}
      {overlay === 'change-password' ? (
        <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Trocar senha">
          <TrocarSenhaScreen
            user={user}
            mandatory={false}
            onDone={(updated) => { setUser(updated); setOverlay(null); }}
            onCancel={() => setOverlay(null)}
            onLogout={() => endSession('SAIR')}
          />
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}
