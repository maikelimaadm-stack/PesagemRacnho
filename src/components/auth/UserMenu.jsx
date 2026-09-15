import { ChevronDown, KeyRound, LockKeyhole, LogOut, UserRound, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { profileLabel } from '@/modules/auth/domain/accessPolicy';
import { APP_VERSION } from '@/versioning/versionInfo';
import { useAuth } from './useAuth';

function initials(nome) {
  return String(nome || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('pt-BR'))
    .join('') || '?';
}

// Painel inline usado no menu lateral do celular (mesmas ações do menu suspenso).
function UserPanel({ user, role, lock, logout, switchUser, changePassword }) {
  return (
    <div className="mb1-user-panel" aria-label="Usuário atual">
      <div className="mb1-user-panel__identity">
        <span className="mb1-user-panel__avatar" aria-hidden="true">{initials(user.nome)}</span>
        <div>
          <strong>{user.nome}</strong>
          <span>{user.login} · {role} · Versão {APP_VERSION}</span>
        </div>
      </div>
      <div className="mb1-user-panel__actions">
        <button type="button" onClick={() => lock()}><LockKeyhole aria-hidden="true" />Bloquear</button>
        <button type="button" onClick={() => changePassword()}><KeyRound aria-hidden="true" />Alterar senha</button>
        <button type="button" onClick={() => switchUser()}><Users aria-hidden="true" />Trocar usuário</button>
        <button type="button" className="is-exit" onClick={() => logout()}><LogOut aria-hidden="true" />Sair</button>
      </div>
    </div>
  );
}

/**
 * Topbar: usuário, perfil, versão, Bloquear, Trocar usuário, Sair (doc 11 §2).
 * `variant="panel"` renderiza o bloco inline do menu lateral (celular).
 * Renderiza nada fora do AuthGate (ex.: capturas sem sessão).
 */
export default function UserMenu({ variant = 'dropdown' }) {
  const auth = useAuth();
  if (!auth?.user) return null;
  const { user, lock, logout, switchUser, changePassword } = auth;
  const role = profileLabel(user.perfil);
  const firstName = String(user.nome || user.login || '').trim().split(/\s+/)[0];

  if (variant === 'panel') {
    return <UserPanel user={user} role={role} lock={lock} logout={logout} switchUser={switchUser} changePassword={changePassword} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mb1-shell-topbar-button mb1-user-menu__trigger"
          aria-label={`Usuário ${user.nome} (${role}). Abrir menu do usuário`}
          title={`${user.nome} · ${role} · Versão ${APP_VERSION}`}
        >
          <UserRound aria-hidden="true" />
          <span>{firstName}</span>
          <span className="mb1-user-menu__role">{role}</span>
          <ChevronDown className="mb1-user-menu__chevron" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="mb1-user-menu">
        <div className="mb1-user-menu__identity">
          <strong>{user.nome}</strong>
          <span>{user.login} · {role}</span>
          <span className="mb1-user-menu__version">Pesagens Individuais · versão {APP_VERSION}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => lock()}><LockKeyhole aria-hidden="true" />Bloquear</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => changePassword()}><KeyRound aria-hidden="true" />Alterar minha senha</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => switchUser()}><Users aria-hidden="true" />Trocar usuário</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="is-exit" onSelect={() => logout()}><LogOut aria-hidden="true" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
