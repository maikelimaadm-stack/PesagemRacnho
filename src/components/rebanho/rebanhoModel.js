// Modelo das telas de Rebanho (Entradas, Saídas, Movimentações, Inventário): catálogo de apoio (animais,
// marcas, raças, lotes, propriedades, parceiros, causas de morte), formatação e permissões. As regras ficam
// no domínio (src/modules/livestock); aqui só o que a tela precisa para montar listas e textos.
import storage from '@/storage/storageAdapter';
import * as apartacaoService from '@/modules/auxiliary/application/apartacaoService';
import { brandService, breedService, deathCauseService, partnerService, propertyService } from '@/modules/catalog/application/registryServices';

export const READ_PERMISSION = 'weighing.read';

export function rebanhoPermissions(auth) {
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  return { canRead: can('weighing.read'), canWrite: can('weighing.write'), canCancel: can('weighing.edit') };
}

const SAIDA_DEFINITIVA = new Set(['VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO']);
export const isAnimalAtivo = (animal) => animal && !animal.deleted_at && !SAIDA_DEFINITIVA.has(animal.situacao);

const safeList = async (loader) => {
  try {
    return (await loader()) || [];
  } catch {
    return [];
  }
};

export async function loadRebanhoCatalog() {
  const [animais, marcas, racas, lotes, propriedades, parceiros, causasMorte] = await Promise.all([
    storage.animais.list(),
    safeList(() => brandService.list()),
    safeList(() => breedService.list()),
    safeList(() => apartacaoService.listLoteApartacoes()),
    safeList(() => propertyService.list()),
    safeList(() => partnerService.list()),
    safeList(() => deathCauseService.list()),
  ]);
  const active = (rows) => (rows || []).filter((row) => !row.deleted_at && row.ativo !== false);
  return {
    animais: (animais || []).filter((row) => !row.deleted_at),
    marcas: active(marcas),
    racas: active(racas),
    lotes: (lotes || []).filter((row) => !row.deleted_at),
    propriedades: active(propriedades),
    parceiros: active(parceiros),
    causasMorte: active(causasMorte),
  };
}

export const nameIndex = (rows, campo = 'nome') => new Map((rows || []).map((row) => [row.id, row[campo] || row.nome || row.id]));

export function fmtDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

export function fmtInt(value) {
  return value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
}

export function fmtKg(value) {
  return value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

export function fmtMoney(value) {
  return value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function firstDayOfMonth(iso = todayIso()) {
  return `${iso.slice(0, 7)}-01`;
}

export function describeError(error, fallback = 'A operação não pôde ser concluída.') {
  const message = error?.message ? String(error.message) : '';
  return message || fallback;
}

/** Texto do animal para listas: número, marca e situação de cadastro pendente. */
export function animalLabel(animal) {
  if (!animal) return '—';
  const numero = animal.numero_animal || '(sem identificação)';
  return animal.marca ? `${numero} · ${animal.marca}` : numero;
}

export const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
