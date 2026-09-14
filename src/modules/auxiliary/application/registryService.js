import { ensureEmpresaId } from '@/api/db';
import { getSetting, setSetting } from '@/modules/settings/application/settingsService';

export const REGISTRY_GROUPS = {
  comerciais: ['compradores', 'vendedores', 'frigorificos'],
  mortalidade: ['causasMorte'],
  sanidade: ['programasSanidade', 'medicamentos'],
};

const emptyGroup = (group) => Object.fromEntries((REGISTRY_GROUPS[group] || []).map((bucket) => [bucket, []]));
const keyFor = (group, empresaId = ensureEmpresaId()) => `cadastros-auxiliares:${group}:${empresaId}`;

function normalizeRecord(record) {
  return {
    ...record,
    id: record.id || globalThis.crypto.randomUUID(),
    nome: String(record.nome || '').trim(),
    ativo: record.ativo !== false,
  };
}

export async function loadRegistryGroup(group, empresaId = ensureEmpresaId()) {
  const fallback = emptyGroup(group);
  const stored = await getSetting(keyFor(group, empresaId), fallback);
  const normalized = { ...fallback };
  for (const bucket of REGISTRY_GROUPS[group] || []) {
    normalized[bucket] = Array.isArray(stored?.[bucket]) ? stored[bucket].map(normalizeRecord) : [];
  }

  // Compatibilidade com os compradores já cadastrados no popup antigo.
  if (group === 'comerciais') {
    const legacy = await getSetting(`perfis-saida:${empresaId}`, { compradores: [], venda: [], abate: [] });
    const ids = new Set(normalized.compradores.map((item) => item.id));
    for (const buyer of legacy?.compradores || []) {
      if (!ids.has(buyer.id)) normalized.compradores.push(normalizeRecord(buyer));
    }
  }
  return normalized;
}

export async function saveRegistryGroup(group, value, empresaId = ensureEmpresaId()) {
  const normalized = { ...emptyGroup(group) };
  for (const bucket of REGISTRY_GROUPS[group] || []) {
    normalized[bucket] = Array.isArray(value?.[bucket]) ? value[bucket].map(normalizeRecord) : [];
  }
  await setSetting(keyFor(group, empresaId), normalized);

  if (group === 'comerciais') {
    const legacyKey = `perfis-saida:${empresaId}`;
    const legacy = await getSetting(legacyKey, { compradores: [], venda: [], abate: [] });
    await setSetting(legacyKey, { ...legacy, compradores: normalized.compradores });
  }
  return normalized;
}

export async function loadAuxiliaryCatalogs(empresaId = ensureEmpresaId()) {
  const [comerciais, mortalidade, sanidade] = await Promise.all([
    loadRegistryGroup('comerciais', empresaId),
    loadRegistryGroup('mortalidade', empresaId),
    loadRegistryGroup('sanidade', empresaId),
  ]);
  return { ...comerciais, ...mortalidade, ...sanidade };
}
