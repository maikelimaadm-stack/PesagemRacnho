import { WeighingError } from './weighingErrors.js';
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from './brazilianValues.js';

// `legacy_payload` congelado (ADR-027; docs 12 §6). Somente estas chaves são
// gravadas em novos registros; qualquer outra é descartada pelo mapper.
export const LEGACY_PAYLOAD_ALLOWLIST = Object.freeze([
  'id', 'empresa_id', 'tipo_manejo', 'motivo_saida', 'causa_morte', 'data_pesagem', 'animal_id', 'sessao_id',
  'numero_animal', 'sexo', 'raca', 'era', 'marca', 'peso', 'observacao', 'apartacao_id', 'nome_apartacao',
  'lote_id', 'nome_lote', 'origem', 'operador', 'id_externo', 'data_anterior', 'peso_anterior', 'dias', 'ganho',
  'gmd', 'alertas_confirmados', 'justificativa_alerta', 'valor_pago_cabeca', 'origem_animal', 'documentacao',
  'comprador', 'destino_venda', 'valor_venda_total', 'valor_arroba', 'rendimento_carcaca', 'peso_carcaca_estimado',
  'quantidade_arrobas', 'frigorifico', 'valor_arroba_abate', 'valor_total_abate', 'embarque_id', 'embarque_nome',
  'documento_embarque_id', 'documento_tipo', 'documento_numero', 'motorista_nome', 'placa_carreta',
  // Categoria do animal no momento da pesagem (automática pelo peso ou escolhida à mão).
  'categoria_id', 'categoria_automatica',
  // Referências estruturais por id (R0 reporting): agrupamento histórico por marca/raça/causa sem
  // depender do texto; origem do rendimento usado no cálculo de arrobas (informado × padrão).
  'marca_id', 'raca_id', 'causa_morte_id', 'rendimento_origem',
  // Rastro da importação conciliada (src/modules/import): job de origem e fingerprint canônico
  // do evento (empresa | animal | data | tipo | peso [| id_externo]). `id_externo` já consta acima.
  'importacao_id', 'import_fingerprint',
  // Missão pesagens-integrada (P01/P15): de onde veio o peso (BALANCA | MANUAL) e a leitura bruta da
  // balança usada { kg_bruto, seq, epoch, fonte, lida_em } — o peso gravado continua inteiro.
  'peso_origem', 'balanca_leitura',
  // v9 (Fase B): operação de Entrada/Saída que gerou a pesagem (17-MODELO-DADOS-V9).
  'operacao_id',
]);

// Proibidas em gravação nova: redundantes com colunas/timestamps do registro
// (`status_animal` é legado somente-leitura: o view model o deriva do evento).
export const LEGACY_PAYLOAD_FORBIDDEN = Object.freeze([
  '_localId', 'peso_kg', 'created_date', 'updated_date', 'status_animal', 'sanidade_ids', 'sanidades',
]);

const ALLOWED_KEYS = new Set(LEGACY_PAYLOAD_ALLOWLIST);

/** Mantém somente as chaves permitidas (chave desconhecida ou proibida é descartada). */
export function filterLegacyPayload(source) {
  const out = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (ALLOWED_KEYS.has(key)) out[key] = value;
  }
  return out;
}

/** Chaves de um payload fora da lista permitida (gates e diagnóstico). */
export function findDisallowedLegacyKeys(payload) {
  if (!payload || typeof payload !== 'object') return [];
  return Object.keys(payload).filter((key) => !ALLOWED_KEYS.has(key));
}

const pick = (obj, ...keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
};

export function validateUiPayload(payload, { isUpdate = false } = {}) {
  const dataPesagem = pick(payload, 'data_pesagem', 'dataPesagem', 'data');
  // `peso` é o campo da UI e prevalece: na edição o service mescla o view model
  // (que traz o peso_kg antigo) com o payload novo (que só traz `peso`).
  const pesoRaw = pick(payload, 'peso', 'pesoKg', 'peso_kg');
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
  const pesoKg = parseBrazilianNumber(pick(uiPayload, 'peso', 'pesoKg', 'peso_kg'));

  // Snapshot de compatibilidade filtrado pela lista permitida (ADR-027).
  const legacySnapshot = filterLegacyPayload(uiPayload);
  if (legacySnapshot.peso === undefined && pesoKg !== null) legacySnapshot.peso = pesoKg;

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

  const tipoManejo = legacy.tipo_manejo ?? row.tipo_pesagem ?? null;
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
    tipo_manejo: tipoManejo,
    observacao: row.observacao ?? legacy.observacao ?? null,
    // Projeções (não persistidas): status do evento e timestamps do registro.
    status_animal: legacy.status_animal ?? (tipoManejo === 'Saída' ? 'Inativo' : 'Ativo'),
    created_date: legacy.created_date ?? row.created_at ?? null,
    updated_date: legacy.updated_date ?? row.updated_at ?? null,
  };
}
