export const isSnIdentifier = (value) => /^SN\s*\d*$/i.test(String(value || '').trim());

export const normalizeAnimalIdentifier = (value) =>
  String(value || '').toLocaleUpperCase('pt-BR');

export function findLatestSnProfile(entries = []) {
  let latest = null;
  let latestKey = '';

  for (const entry of entries) {
    if (!isSnIdentifier(entry?.numero_animal)) continue;
    // "SN anterior" significa o último SN lançado. Em dados legados sem
    // timestamp de criação, a data da pesagem continua sendo o fallback.
    const chronologyKey = entry.created_date || entry.updated_date || entry.data_pesagem || '';
    if (!latest || chronologyKey >= latestKey) {
      latest = entry;
      latestKey = chronologyKey;
    }
  }

  if (!latest) return null;
  return {
    sexo: latest.sexo || 'M',
    raca: latest.raca || 'Nelore',
    era: latest.era || '',
    marca: latest.marca || '',
  };
}
