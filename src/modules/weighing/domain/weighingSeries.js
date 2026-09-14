import { calculateWeightGain } from './weighingCalculations.js';
import { legacyAnimalKey } from '../../animals/domain/animalHistory.js';

const identity = (entry) => entry.animal_id ? `id:${entry.animal_id}` : `legacy:${legacyAnimalKey(entry)}`;
const eventOrder = (left, right) =>
  String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || ''))
  || String(left.created_date || left.created_at || '').localeCompare(String(right.created_date || right.created_at || ''))
  || String(left.id || '').localeCompare(String(right.id || ''));

export function recalculateWeightSeries(entries = [], affectedKeys = null) {
  const groups = new Map();
  for (const entry of entries.filter((row) => !row.deleted_at)) {
    const key = identity(entry);
    if (affectedKeys && !affectedKeys.has(key)) continue;
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  }

  const updates = [];
  for (const group of groups.values()) {
    group.sort(eventOrder);
    const history = [];
    for (const entry of group) {
      const measuredWeight = entry.peso ?? entry.peso_kg;
      const result = entry.tipo_manejo === 'Manejo'
        ? calculateWeightGain({ history, date: entry.data_pesagem, weight: measuredWeight })
        : { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
      const patch = {
        data_anterior: result.dataAnterior,
        peso_anterior: result.pesoAnterior,
        dias: result.dias,
        ganho: result.ganho,
        gmd: result.gmd,
      };
      updates.push({
        id: entry.id,
        localId: entry._localId ?? entry.localId ?? null,
        legacyPayload: { ...entry, ...patch },
        patch,
      });
      if (Number.isFinite(Number(measuredWeight))) history.push(entry);
    }
  }
  return updates;
}

export function animalIdentityKey(entry) {
  return identity(entry);
}
