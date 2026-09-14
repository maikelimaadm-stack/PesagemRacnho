export const normalizeAnimalText = (value) => String(value ?? '').trim().toUpperCase();

export const createAnimalId = () =>
  crypto.randomUUID();

export function legacyAnimalKey(entry = {}) {
  return `${normalizeAnimalText(entry.numero_animal)}::${normalizeAnimalText(entry.marca)}`;
}

export function sameAnimal(left = {}, right = {}) {
  if (left.animal_id && right.animal_id) return left.animal_id === right.animal_id;
  if (left.animal_id && !right.animal_id) return legacyAnimalKey(left) === legacyAnimalKey(right);
  if (!left.animal_id && right.animal_id) return legacyAnimalKey(left) === legacyAnimalKey(right);
  return legacyAnimalKey(left) === legacyAnimalKey(right);
}

export function getAnimalHistory(entries = [], target) {
  if (!target) return [];
  return entries.filter((entry) => sameAnimal(entry, target));
}

export function getRegisteredAnimals(entries = []) {
  const registrations = entries
    .filter((entry) => entry.tipo_manejo === 'Cadastro')
    .sort((a, b) => String(a.data_pesagem || '').localeCompare(String(b.data_pesagem || '')));
  const seen = new Set();
  const registrationRecords = [];
  const idAliases = new Map();
  const legacyAliases = new Map();

  for (const registration of registrations) {
    const key = registration.animal_id ? `id:${registration.animal_id}` : `legacy:${legacyAnimalKey(registration)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    registrationRecords.push({ key, registration });

    if (registration.animal_id) idAliases.set(String(registration.animal_id), key);
    if (registration.id) idAliases.set(String(registration.id), key);

    const legacyKey = legacyAnimalKey(registration);
    const aliases = legacyAliases.get(legacyKey) || [];
    aliases.push({ key, hasCanonicalId: Boolean(registration.animal_id) });
    legacyAliases.set(legacyKey, aliases);
  }

  // Monta os históricos em uma única passagem. A implementação anterior
  // filtrava todos os lançamentos uma vez para cada Cadastro (O(n²)), o que
  // bloqueava a interface ao concluir a identificação em bases grandes.
  const histories = new Map(registrationRecords.map(({ key }) => [key, []]));
  for (const entry of entries) {
    let targetKeys = [];
    if (entry.animal_id) {
      const aliasedKey = idAliases.get(String(entry.animal_id));
      if (aliasedKey) {
        targetKeys = [aliasedKey];
      } else {
        // Registros legados podem ter recebido animal_id antes do Cadastro.
        // Nesse caso só casam por número/marca com Cadastros sem ID canônico.
        targetKeys = (legacyAliases.get(legacyAnimalKey(entry)) || [])
          .filter((alias) => !alias.hasCanonicalId)
          .map((alias) => alias.key);
      }
    } else {
      targetKeys = (legacyAliases.get(legacyAnimalKey(entry)) || []).map((alias) => alias.key);
    }

    for (const key of new Set(targetKeys)) histories.get(key)?.push(entry);
  }

  const result = registrationRecords.map(({ key, registration }) => {
    const history = histories.get(key) || [];
    let latest = registration;
    for (const entry of history) {
      if (String(entry.data_pesagem || '').localeCompare(String(latest.data_pesagem || '')) > 0) latest = entry;
    }

    return {
      ...registration,
      animal_id: registration.animal_id || registration.id,
      status_animal: latest?.status_animal || registration.status_animal || 'Ativo',
      total_registros: history.length,
      ultima_pesagem: latest?.data_pesagem || registration.data_pesagem,
      ultimo_peso: latest?.peso ?? registration.peso,
    };
  });

  return result.sort((a, b) => {
    const number = normalizeAnimalText(a.numero_animal).localeCompare(normalizeAnimalText(b.numero_animal), 'pt-BR', { numeric: true });
    return number || normalizeAnimalText(a.marca).localeCompare(normalizeAnimalText(b.marca), 'pt-BR');
  });
}

export function buildAnimalLookupIndex(animals = []) {
  const byId = new Map();
  const byNumber = new Map();

  for (const animal of animals) {
    const id = animal?.animal_id || animal?.id;
    if (id != null) byId.set(String(id), animal);

    const number = normalizeAnimalText(animal?.numero_animal);
    if (!number) continue;
    const matches = byNumber.get(number) || [];
    matches.push(animal);
    byNumber.set(number, matches);
  }

  return { byId, byNumber };
}

export function findAnimalsByNumber(entries = [], number) {
  const normalized = normalizeAnimalText(number);
  if (!normalized) return [];
  return getRegisteredAnimals(entries).filter((animal) => normalizeAnimalText(animal.numero_animal) === normalized);
}

export function needsImmediateAnimalChoice(entries = [], number) {
  return findAnimalsByNumber(entries, number).length > 1;
}

export function buildDeletionPlan(entries = [], requestedIds = []) {
  const requested = new Set(requestedIds);
  const targets = entries.filter((entry) => requested.has(entry.id));
  const deleteIds = new Set();
  const cascades = [];

  for (const target of targets) {
    deleteIds.add(target.id);
    if (target.tipo_manejo === 'Cadastro') {
      const history = getAnimalHistory(entries, target);
      cascades.push({
        target,
        entries: history,
        laterEntries: history.filter((entry) => entry.id !== target.id),
        blocked: history.some((entry) => entry.id !== target.id),
      });
    }
  }

  return { requestedIds: [...requested], ids: [...deleteIds], targets, cascades };
}

export function canonicalProfile(registration, animalId = registration?.animal_id || registration?.id || createAnimalId()) {
  return {
    animal_id: animalId,
    numero_animal: String(registration?.numero_animal || '').trim(),
    sexo: registration?.sexo || null,
    raca: registration?.raca || null,
    era: registration?.era || null,
    marca: registration?.marca || null,
  };
}
