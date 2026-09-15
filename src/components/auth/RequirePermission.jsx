import { ShieldOff } from 'lucide-react';
import { roleLabel } from '@/modules/auth/domain/permissionService';
import { useAuth } from './useAuth';
import './auth-screens.css';

// `role` (rev. 2); `profile` continua aceito para chamadores da rev. 1.
export function AccessDenied({ role, profile, permission }) {
  return (
    <section className="auth-denied" role="alert" aria-live="polite" data-permission={permission || ''}>
      <div className="auth-denied__card">
        <ShieldOff aria-hidden="true" />
        <h2>Acesso não permitido</h2>
        <p>O papel <strong>{roleLabel(role ?? profile)}</strong> não tem acesso a esta área. Procure um administrador se precisar desta função.</p>
      </div>
    </section>
  );
}

/**
 * Envolve rotas ou ações. Sem `permission` renderiza os filhos; sem permissão mostra
 * "Acesso não permitido" (ou `fallback`). A validação definitiva continua nos serviços.
 */
export default function RequirePermission({ permission, children, fallback }) {
  const auth = useAuth();
  if (!permission) return children;
  if (auth?.can?.(permission)) return children;
  if (fallback !== undefined) return fallback;
  return <AccessDenied role={auth?.user?.role} permission={permission} />;
}
