// Exportação de pesagens com permissão verificada no SERVIÇO (não só na tela).
// reports.export é obrigatória; valores comerciais só saem se o papel tiver commercial.values,
// mesmo que a tela peça (o pedido da tela só pode restringir, nunca ampliar).
// Mesmo padrão de requireWeighingPermission (weighingService): com sessão, a matriz decide;
// com o módulo de autenticação ativo e sem sessão, recusa (falha fechada); sem provedor de ator
// (gates em Node, harness de UI) a verificação não se aplica.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, can, forbiddenError } from '../../auth/domain/permissionService.js';
import { buildWeighingCsv } from './weighingExportContract.js';

export const EXPORT_PERMISSION = 'reports.export';
export const COMMERCIAL_VALUES_PERMISSION = 'commercial.values';

/** { actor, canSeeCommercial } do ator atual; lança AUTH_FORBIDDEN sem reports.export. */
export function resolveExportAccess() {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, EXPORT_PERMISSION);
    return { actor, canSeeCommercial: can(actor.role, COMMERCIAL_VALUES_PERMISSION) };
  }
  if (hasActorProvider()) throw forbiddenError(null, EXPORT_PERMISSION);
  return { actor: null, canSeeCommercial: true };
}

/** buildWeighingCsv com permissão: mesmas opções; canSeeCommercial = pedido da tela E permissão do papel. */
export function exportWeighingCsv(rows, options = {}) {
  const access = resolveExportAccess();
  return buildWeighingCsv(rows, { ...options, canSeeCommercial: Boolean(options.canSeeCommercial) && access.canSeeCommercial });
}
