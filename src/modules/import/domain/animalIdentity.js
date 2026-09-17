// Identidade canônica do animal (missão §18-§22). UMA função, pura, reutilizável pelo
// Lançamento no futuro. Ordem de resolução:
//   1. animal_id explícito que existe na base;
//   2. identificador ativo: VISUAL por [marca_id + valor_normalizado]; demais tipos
//      (RFID, SISBOV…) por [tipo + valor_normalizado], que não dependem de marca;
//   3. número + marca_id do animal;
//   4. número + nome normalizado da marca (animais antigos sem marca_id);
//   5. sem marca na linha: todos os animais com o número.
// Mais de um candidato elegível → AMBÍGUO (nunca "o último vence"). Animal que saiu
// (vendido, morto…) não casa com evento POSTERIOR à data da saída; se só ele casa →
// INELEGÍVEL (erro explicado). Identificação vazia ou "SN" → INVÁLIDA (SNs nunca se agrupam).
// Um animal que ainda não estava cadastrado na data do evento perde para outro candidato
// cuja permanência (Cadastro → Saída) contém a data.
import { normalizeName } from '../../catalog/domain/normalize.js';
import { isSnIdentifier } from '../../animals/domain/snAnimal.js';

export const IDENTITY_STATUS = Object.freeze({
  MATCH: 'MATCH',
  NONE: 'NONE',
  AMBIGUOUS: 'AMBIGUOUS',
  INELIGIBLE: 'INELIGIBLE',
  INVALID: 'INVALID',
});

/** Valor de identificação comparável: trim → maiúsculas pt-BR → espaços únicos (= nome_normalizado). */
export function normalizeIdentifierValue(value) {
  return normalizeName(value);
}

/** Identificação ausente ou SN: não identifica animal nenhum. */
export function isMissingIdentification(value) {
  return !normalizeIdentifierValue(value) || isSnIdentifier(value);
}

const add = (map, key, value) => {
  if (!key) return;
  const set = map.get(key) || new Set();
  set.add(value);
  map.set(key, set);
};

const isActiveRow = (row) => Boolean(row) && !row.deleted_at;

/**
 * Índice em memória a partir das stores `animais`, `animalIdentificadores` e `marcas`.
 * Todas as comparações usam normalizeIdentifierValue dos dois lados (o banco guarda
 * `valor_normalizado` sem colapsar espaços em registros antigos).
 */
export function buildAnimalIdentityIndex({ animals = [], identifiers = [], marcas = [] } = {}) {
  const animalsById = new Map();
  for (const animal of animals) if (isActiveRow(animal) && animal.id != null) animalsById.set(String(animal.id), animal);
  const marcaNameById = new Map(marcas.filter(isActiveRow).map((row) => [String(row.id), normalizeName(row.nome)]));

  const visualByBrand = new Map(); // `${marca_id}|${valor}` → Set(animalId)
  const visualLegacyByBrandName = new Map(); // `${marcaNome}|${valor}` → Set (VISUAL sem marca_id)
  const visualByValue = new Map(); // valor → Set (VISUAL de qualquer marca)
  const typedByValue = new Map(); // valor → Set (tipos que não dependem de marca)
  for (const identifier of identifiers) {
    if (!isActiveRow(identifier) || identifier.ativo === false) continue;
    const animalId = String(identifier.animal_id ?? '');
    if (!animalsById.has(animalId)) continue;
    const value = normalizeIdentifierValue(identifier.valor_normalizado ?? identifier.valor);
    if (!value) continue;
    const tipo = String(identifier.tipo || 'VISUAL').toUpperCase();
    if (tipo === 'VISUAL' || tipo === 'LEGADO') {
      add(visualByValue, value, animalId);
      if (identifier.marca_id) add(visualByBrand, `${identifier.marca_id}|${value}`, animalId);
      else add(visualLegacyByBrandName, `${normalizeName(identifier.marca)}|${value}`, animalId);
    } else {
      add(typedByValue, value, animalId);
    }
  }

  const byBrandIdNumber = new Map();
  const byBrandNameNumber = new Map();
  const byNumber = new Map();
  for (const [animalId, animal] of animalsById) {
    const value = normalizeIdentifierValue(animal.numero_animal ?? animal.identificacao_normalizada);
    if (!value) continue;
    add(byNumber, value, animalId);
    if (animal.marca_id) add(byBrandIdNumber, `${animal.marca_id}|${value}`, animalId);
    const brandName = normalizeName(animal.marca) || marcaNameById.get(String(animal.marca_id ?? '')) || '';
    if (brandName) add(byBrandNameNumber, `${brandName}|${value}`, animalId);
  }

  return { animalsById, visualByBrand, visualLegacyByBrandName, visualByValue, typedByValue, byBrandIdNumber, byBrandNameNumber, byNumber };
}

/**
 * Candidatos pela ordem canônica, sem olhar datas.
 * query = { animalId, numero, marcaId, marcaNome } → { via, candidates: [animal], invalidAnimalId }
 */
export function findIdentityCandidates(index, { animalId = null, numero = null, marcaId = null, marcaNome = null } = {}) {
  const toAnimals = (ids) => [...ids].map((id) => index.animalsById.get(id)).filter(Boolean);
  let invalidAnimalId = false;
  if (animalId !== null && animalId !== undefined && String(animalId).trim() !== '') {
    const explicit = index.animalsById.get(String(animalId).trim());
    if (explicit) return { via: 'animal_id', candidates: [explicit], invalidAnimalId };
    invalidAnimalId = true;
  }
  const value = normalizeIdentifierValue(numero);
  if (!value) return { via: null, candidates: [], invalidAnimalId };
  const brandName = normalizeName(marcaNome);
  const hasBrand = Boolean(marcaId || brandName);

  // 2. Identificadores ativos.
  const viaIdentifier = new Set();
  const union = (set) => { for (const id of set || []) viaIdentifier.add(id); };
  union(index.typedByValue.get(value));
  if (hasBrand) {
    if (marcaId) union(index.visualByBrand.get(`${marcaId}|${value}`));
    if (brandName) union(index.visualLegacyByBrandName.get(`${brandName}|${value}`));
  } else {
    union(index.visualByValue.get(value));
  }
  if (viaIdentifier.size) return { via: 'identificador', candidates: toAnimals(viaIdentifier), invalidAnimalId };

  // 3. Número + marca_id; 4. número + marca normalizada.
  if (marcaId) {
    const ids = index.byBrandIdNumber.get(`${marcaId}|${value}`);
    if (ids?.size) return { via: 'numero_marca_id', candidates: toAnimals(ids), invalidAnimalId };
  }
  if (brandName) {
    const ids = index.byBrandNameNumber.get(`${brandName}|${value}`);
    if (ids?.size) return { via: 'numero_marca', candidates: toAnimals(ids), invalidAnimalId };
  }
  // 5. Sem marca na linha: qualquer animal com o número.
  if (!hasBrand) {
    const ids = index.byNumber.get(value);
    if (ids?.size) return { via: 'numero', candidates: toAnimals(ids), invalidAnimalId };
  }
  return { via: null, candidates: [], invalidAnimalId };
}

const describe = (animal) => `${animal.numero_animal ?? animal.identificacao_normalizada ?? '?'} / ${animal.marca || 'sem marca'}`;

/**
 * resolveAnimalIdentity(index, query, { eventDate, lifecycleOf }) →
 * { status, animal, candidates, via, invalidAnimalId, message }
 * `lifecycleOf(animal)` → { registrationDate, exitDate, exitReason } (datas ISO ou null).
 */
export function resolveAnimalIdentity(index, query = {}, { eventDate = null, lifecycleOf = () => ({}) } = {}) {
  const found = findIdentityCandidates(index, query);
  const base = { via: found.via, invalidAnimalId: found.invalidAnimalId, candidates: found.candidates, animal: null, message: null };
  if (found.via === 'animal_id') return { ...base, status: IDENTITY_STATUS.MATCH, animal: found.candidates[0] };
  if (isMissingIdentification(query.numero)) {
    const text = String(query.numero ?? '').trim();
    return { ...base, status: IDENTITY_STATUS.INVALID, message: text ? `Identificação "${text}" (SN) não identifica um animal; cada SN precisa do ID do animal.` : 'Identificação do animal não informada.' };
  }
  if (!found.candidates.length) return { ...base, status: IDENTITY_STATUS.NONE };

  const lifecycle = new Map(found.candidates.map((animal) => [animal, lifecycleOf(animal) || {}]));
  // Evento posterior à saída não pode ser do animal que saiu (no dia da saída ainda pode).
  const eligible = found.candidates.filter((animal) => {
    const { exitDate } = lifecycle.get(animal);
    return !(exitDate && eventDate && eventDate > exitDate);
  });
  if (!eligible.length) {
    const details = found.candidates.map((animal) => {
      const { exitDate, exitReason } = lifecycle.get(animal);
      return `${describe(animal)} saiu em ${exitDate}${exitReason ? ` (${exitReason})` : ''}`;
    }).join('; ');
    return {
      ...base,
      status: IDENTITY_STATUS.INELIGIBLE,
      message: `A identificação pertence a animal que já saiu (${details}). O evento de ${eventDate} é posterior à saída e não pode ser vinculado a ele; número reaproveitado precisa de outra marca ou identificação.`,
    };
  }
  if (eligible.length === 1) return { ...base, status: IDENTITY_STATUS.MATCH, animal: eligible[0] };
  const inWindow = eligible.filter((animal) => {
    const { registrationDate } = lifecycle.get(animal);
    return !registrationDate || !eventDate || registrationDate <= eventDate;
  });
  if (inWindow.length === 1) return { ...base, status: IDENTITY_STATUS.MATCH, animal: inWindow[0] };
  const ambiguous = inWindow.length ? inWindow : eligible;
  return {
    ...base,
    candidates: ambiguous,
    status: IDENTITY_STATUS.AMBIGUOUS,
    message: `Identificação ambígua: ${ambiguous.map(describe).join(', ')}. Informe a marca ou o ID do animal.`,
  };
}
