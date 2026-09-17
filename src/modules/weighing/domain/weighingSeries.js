import { calculateWeightGain } from './weighingCalculations.js';
import { legacyAnimalKey } from '../../animals/domain/animalHistory.js';

const identity = (entry) => entry.animal_id ? `id:${entry.animal_id}` : `legacy:${legacyAnimalKey(entry)}`;

// Ordem canônica do histórico de um animal (lançamento, importação, projeções e recálculo):
// data real do evento → tipo (Cadastro antes de Manejo antes de Saída, no mesmo dia) →
// momento de gravação → id. A ordem das linhas de um arquivo nunca define a cronologia.
export const EVENT_TYPE_RANK = Object.freeze({ Cadastro: 0, Manejo: 1, 'Saída': 2 });

export function compareWeighingEvents(left, right) {
  return String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || ''))
    || (EVENT_TYPE_RANK[left.tipo_manejo] ?? 1) - (EVENT_TYPE_RANK[right.tipo_manejo] ?? 1)
    || String(left.created_date || left.created_at || '').localeCompare(String(right.created_date || right.created_at || ''))
    || String(left.id || '').localeCompare(String(right.id || ''));
}

/** Peso medido: número finito > 0; null, vazio e 0 não são pesagem (Saída sem peso não vira 0 kg). */
export function measuredWeightOf(entry) {
  const raw = entry?.peso ?? entry?.peso_kg;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
const eventOrder = compareWeighingEvents;

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
      const measuredWeight = measuredWeightOf(entry);
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
      if (measuredWeight !== null) history.push(entry);
    }
  }
  return updates;
}

export function animalIdentityKey(entry) {
  return identity(entry);
}
