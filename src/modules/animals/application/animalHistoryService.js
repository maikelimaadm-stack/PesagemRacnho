import * as weighingService from '../../weighing/application/weighingService.js';
import { buildDeletionPlan, canonicalProfile, getAnimalHistory } from '../domain/animalHistory.js';

export async function propagateAnimalProfile({ entries = [], registration, profile }) {
  const history = getAnimalHistory(entries, registration);
  const canonical = canonicalProfile({ ...registration, ...profile }, registration?.animal_id || registration?.id);
  // O cadastro atual pode mudar, mas fatos históricos não são reescritos. Para
  // registros legados, consolidamos apenas a referência canônica do animal.
  const aliases = history
    .filter((entry) => !entry.animal_id && entry.id !== registration?.id)
    .map((entry) => ({ id: entry.id, patch: { animal_id: canonical.animal_id } }));
  if (aliases.length) await weighingService.bulkUpdateEntries(aliases, { recalculate: false });
  return { updated: aliases.length, animalId: canonical.animal_id, profile: canonical };
}

export async function deleteEntriesRespectingHistory({ entries = [], ids = [] }) {
  const plan = buildDeletionPlan(entries, ids);
  const blocked = plan.cascades.filter((cascade) => cascade.blocked);
  if (blocked.length) {
    throw new Error('O cadastro possui histórico. Inative o animal ou cancele apenas o evento desejado; o histórico não será apagado.');
  }
  await weighingService.bulkDeleteEntries(plan.ids, { recalculate: true });
  return plan;
}
