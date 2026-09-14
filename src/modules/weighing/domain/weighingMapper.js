import { WeighingError } from './weighingErrors.js';
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from './brazilianValues.js';

const pick = (obj, ...keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
};

export function validateUiPayload(payload, { isUpdate = false } = {}) {
  const dataPesagem = pick(payload, 'data_pesagem', 'dataPesagem', 'data');
  const pesoRaw = pick(payload, 'peso_kg', 'pesoKg', 'peso');
  const peso = parseBrazilianNumber(pesoRaw);
  const movementType = pick(payload, 'tipo_manejo', 'tipo_pesagem', 'tipo');
  const exitReason = pick(payload, 'motivo_saida', 'motivoSaida');
  const weightOptional = movementType === 'Saída' && ['Morte', 'Doação', 'Transferência'].includes(exitReason);

  if (!isUpdate && !parseCivilDate(dataPesagem)) {
    throw new WeighingError('WEIGHING_MAP_001', 'Data da pesagem é obrigatória');
  }
  if (isUpdate && dataPesagem != null && !parseCivilDate(dataPesagem)) {
    throw new WeighingError('WEIGHING_MAP_001', 'Data da pesagem inválida');
  }
  if (dataPesagem && isFutureCivilDate(dataPesagem)) {
    throw new WeighingError('WEIGHING_MAP_001', 'A data da pesagem não pode estar no futuro');
  }
  if (!isUpdate && !weightOptional && (peso === null || peso <= 0)) {
    throw new WeighingError('WEIGHING_MAP_001', 'Peso deve ser numérico e maior que zero');
  }
  if (isUpdate && pesoRaw != null && (peso === null || peso <= 0)) {
    throw new WeighingError('WEIGHING_MAP_001', 'Peso deve ser numérico e maior que zero');
  }
  if (payload.id != null && typeof payload.id !== 'string' && typeof payload.id !== 'number') {
    throw new WeighingError('WEIGHING_MAP_001', 'Identificador inválido');
  }
}

export function uiToStorageRecord(uiPayload, options = {}) {
  const { isUpdate = false, id } = options;
  validateUiPayload(uiPayload, { isUpdate });

  const dataPesagem = pick(uiPayload, 'data_pesagem', 'dataPesagem', 'data');
  const pesoKg = parseBrazilianNumber(pick(uiPayload, 'peso_kg', 'pesoKg', 'peso'));

  const legacySnapshot = { ...uiPayload };
  delete legacySnapshot.sanidade_ids;
  delete legacySnapshot.sanidades;

  const storageRecord = {
    id: id || uiPayload.id,
    data_pesagem: dataPesagem ? parseCivilDate(dataPesagem) : dataPesagem,
    peso_kg: pesoKg,
    lote_id: pick(uiPayload, 'lote_id', 'loteId') ?? null,
    animal_id: pick(uiPayload, 'animal_id', 'animalId') ?? null,
    tipo_pesagem: pick(uiPayload, 'tipo_pesagem', 'tipo_manejo', 'tipo') ?? null,
    observacao: pick(uiPayload, 'observacao', 'observação', 'obs') ?? null,
    legacy_payload: legacySnapshot,
  };

  if (isUpdate) {
    const partial = { ...storageRecord };
    if (!dataPesagem) delete partial.data_pesagem;
    if (uiPayload.peso == null && uiPayload.peso_kg == null && uiPayload.pesoKg == null) {
      delete partial.peso_kg;
    }
    return partial;
  }

  return storageRecord;
}

export function storageRecordToViewModel(row) {
  if (!row) return null;

  let legacy = {};
  if (row.legacy_payload) {
    try {
      legacy = typeof row.legacy_payload === 'string'
        ? JSON.parse(row.legacy_payload)
        : { ...row.legacy_payload };
      delete legacy.sanidade_ids;
      delete legacy.sanidades;
    } catch {
      legacy = {};
    }
  }

  return {
    ...legacy,
    // Chave técnica local, usada somente pelos adapters para atualizações em
    // lote sem uma segunda busca pelo id de domínio. Não substitui `id`.
    _localId: row.localId ?? null,
    id: row.id ?? legacy.id,
    data_pesagem: row.data_pesagem ?? legacy.data_pesagem,
    peso: row.peso_kg ?? legacy.peso,
    peso_kg: row.peso_kg ?? legacy.peso,
    lote_id: row.lote_id ?? legacy.lote_id ?? null,
    animal_id: row.animal_id ?? legacy.animal_id ?? null,
    tipo_manejo: legacy.tipo_manejo ?? row.tipo_pesagem ?? null,
    observacao: row.observacao ?? legacy.observacao ?? null,
    created_date: legacy.created_date ?? row.created_at ?? null,
    updated_date: legacy.updated_date ?? row.updated_at ?? null,
  };
}
