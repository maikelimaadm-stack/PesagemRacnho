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
// E1G: número de brinco NUMÉRICO que não casa pelo valor exato tenta de novo pela chave
// numérica (sem zeros à esquerda e sem o ",0"/".0" do Excel: "01016", "1016,0" → "1016"),
// na mesma ordem de resolução. Só serve para ACHAR o animal na importação; o número gravado
// não muda e a identidade do resto do app (Lançamento, relatórios) continua a exata.
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

// Só dígitos, com zeros à esquerda opcionais e o sufixo decimal zerado que o Excel acrescenta
// (",0" ou ",00"). Três zeros depois do ponto/vírgula é separador de MILHAR ("1.000" = mil),
// não decimal: fica fora, senão "1.000" casaria com o animal 1 (E1G, revisão).
const NUMERIC_IDENTIFIER = /^0*(\d+?)(?:[.,]0{1,2})?$/;

/**
 * E1G: chave numérica do brinco para a importação: "01016", "1016,0", "1016.0" → "1016";
 * "000" → "0". Número com letra, espaço, decimal de verdade ("1016.5") ou milhar ("1.000",
 * "10,000") → null (não é número de brinco; casa só pelo valor exato).
 */
export function importNumberKey(value) {
  const match = NUMERIC_IDENTIFIER.exec(normalizeIdentifierValue(value));
  return match ? match[1] : null;
}

/**
 * E1G: chave com que a importação agrupa as linhas do mesmo animal dentro da planilha:
 * a numérica quando o número é só dígitos ("007" e "7" = o mesmo animal), senão a exata.
 */
export function importGroupingKey(value) {
  return importNumberKey(value) ?? normalizeIdentifierValue(value);
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
// Mapas de busca com a chave de valor `keyOf` (exata ou, na E1G, a numérica da importação).
// Valor sem chave (vazio; ou não numérico, na chave numérica) fica fora do mapa.
function buildLookupMaps(animalsById, identifiers, marcaNameById, keyOf) {
  const visualByBrand = new Map(); // `${marca_id}|${valor}` → Set(animalId)
  const visualLegacyByBrandName = new Map(); // `${marcaNome}|${valor}` → Set (VISUAL sem marca_id)
  const visualByValue = new Map(); // valor → Set (VISUAL de qualquer marca)
  const typedByValue = new Map(); // valor → Set (tipos que não dependem de marca)
  for (const identifier of identifiers) {
    if (!isActiveRow(identifier) || identifier.ativo === false) continue;
    const animalId = String(identifier.animal_id ?? '');
    if (!animalsById.has(animalId)) continue;
    const value = keyOf(identifier.valor_normalizado ?? identifier.valor);
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
    const value = keyOf(animal.numero_animal ?? animal.identificacao_normalizada);
    if (!value) continue;
    add(byNumber, value, animalId);
    if (animal.marca_id) add(byBrandIdNumber, `${animal.marca_id}|${value}`, animalId);
    const brandName = normalizeName(animal.marca) || marcaNameById.get(String(animal.marca_id ?? '')) || '';
    if (brandName) add(byBrandNameNumber, `${brandName}|${value}`, animalId);
  }
  return { visualByBrand, visualLegacyByBrandName, visualByValue, typedByValue, byBrandIdNumber, byBrandNameNumber, byNumber };
}

export function buildAnimalIdentityIndex({ animals = [], identifiers = [], marcas = [] } = {}) {
  const animalsById = new Map();
  for (const animal of animals) if (isActiveRow(animal) && animal.id != null) animalsById.set(String(animal.id), animal);
  const marcaNameById = new Map(marcas.filter(isActiveRow).map((row) => [String(row.id), normalizeName(row.nome)]));
  return {
    animalsById,
    ...buildLookupMaps(animalsById, identifiers, marcaNameById, normalizeIdentifierValue),
    // E1G: os mesmos mapas pela chave numérica, só para o "número parecido".
    numeric: buildLookupMaps(animalsById, identifiers, marcaNameById, importNumberKey),
  };
}

// Passos 2 a 5 da ordem canônica em um conjunto de mapas, com o valor já normalizado.
function lookupByValue(maps, value, { marcaId, brandName, hasBrand }) {
  // 2. Identificadores ativos.
  const viaIdentifier = new Set();
  const union = (set) => { for (const id of set || []) viaIdentifier.add(id); };
  union(maps.typedByValue.get(value));
  if (hasBrand) {
    if (marcaId) union(maps.visualByBrand.get(`${marcaId}|${value}`));
    if (brandName) union(maps.visualLegacyByBrandName.get(`${brandName}|${value}`));
  } else {
    union(maps.visualByValue.get(value));
  }
  if (viaIdentifier.size) return { via: 'identificador', ids: viaIdentifier };

  // 3. Número + marca_id; 4. número + marca normalizada.
  if (marcaId) {
    const ids = maps.byBrandIdNumber.get(`${marcaId}|${value}`);
    if (ids?.size) return { via: 'numero_marca_id', ids };
  }
  if (brandName) {
    const ids = maps.byBrandNameNumber.get(`${brandName}|${value}`);
    if (ids?.size) return { via: 'numero_marca', ids };
  }
  // 5. Sem marca na linha: qualquer animal com o número.
  if (!hasBrand) {
    const ids = maps.byNumber.get(value);
    if (ids?.size) return { via: 'numero', ids };
  }
  return null;
}

/**
 * Candidatos pela ordem canônica, sem olhar datas.
 * query = { animalId, numero, marcaId, marcaNome } →
 * { via, candidates: [animal], invalidAnimalId, similarNumber }
 * `similarNumber` = true quando só casou pela chave numérica (E1G: "01016" → 1016).
 */
export function findIdentityCandidates(index, { animalId = null, numero = null, marcaId = null, marcaNome = null } = {}) {
  const toAnimals = (ids) => [...ids].map((id) => index.animalsById.get(id)).filter(Boolean);
  let invalidAnimalId = false;
  if (animalId !== null && animalId !== undefined && String(animalId).trim() !== '') {
    const explicit = index.animalsById.get(String(animalId).trim());
    if (explicit) return { via: 'animal_id', candidates: [explicit], invalidAnimalId, similarNumber: false };
    invalidAnimalId = true;
  }
  const value = normalizeIdentifierValue(numero);
  if (!value) return { via: null, candidates: [], invalidAnimalId, similarNumber: false };
  const brandName = normalizeName(marcaNome);
  const scope = { marcaId, brandName, hasBrand: Boolean(marcaId || brandName) };

  const exact = lookupByValue(index, value, scope);
  if (exact) return { via: exact.via, candidates: toAnimals(exact.ids), invalidAnimalId, similarNumber: false };
  // E1G: nada pelo valor exato → mesma ordem pela chave numérica (índice sem `numeric` = só exata).
  const numericKey = importNumberKey(value);
  const similar = numericKey && index.numeric ? lookupByValue(index.numeric, numericKey, scope) : null;
  if (similar) return { via: similar.via, candidates: toAnimals(similar.ids), invalidAnimalId, similarNumber: true };
  return { via: null, candidates: [], invalidAnimalId, similarNumber: false };
}

const describe = (animal) => `${animal.numero_animal ?? animal.identificacao_normalizada ?? '?'} / ${animal.marca || 'sem marca'}`;

/**
 * resolveAnimalIdentity(index, query, { eventDate, lifecycleOf }) →
 * { status, animal, candidates, via, invalidAnimalId, message }
 * `lifecycleOf(animal)` → { registrationDate, exitDate, exitReason } (datas ISO ou null).
 */
export function resolveAnimalIdentity(index, query = {}, { eventDate = null, lifecycleOf = () => ({}) } = {}) {
  const found = findIdentityCandidates(index, query);
  const base = { via: found.via, invalidAnimalId: found.invalidAnimalId, similarNumber: found.similarNumber, candidates: found.candidates, animal: null, message: null };
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
