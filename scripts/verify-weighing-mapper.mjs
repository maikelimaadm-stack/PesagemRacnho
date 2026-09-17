// Gate weighing:mapper:verify — mapeamento UI ↔ registro Dexie, aliases,
// validação, lista permitida de legacy_payload (ADR-027) e projeções do view
// model (status_animal/created_date derivados). Testes negativos: peso/data
// inválidos, chave proibida ou desconhecida não entra no snapshot, edição com
// view model antigo não reverte o peso novo.
import {
  LEGACY_PAYLOAD_ALLOWLIST,
  LEGACY_PAYLOAD_FORBIDDEN,
  filterLegacyPayload,
  findDisallowedLegacyKeys,
  uiToStorageRecord,
  storageRecordToViewModel,
  validateUiPayload,
} from '../src/modules/weighing/domain/weighingMapper.js';
import { WeighingError } from '../src/modules/weighing/domain/weighingErrors.js';

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

const uiPayload = {
  empresa_id: 'local',
  tipo_manejo: 'Manejo',
  data_pesagem: '2026-07-09',
  numero_animal: '1234',
  peso: 320.5,
  sexo: 'M',
  raca: 'Nelore',
  marca: 'ABC',
  lote_id: 'lot-1',
  nome_lote: 'Lote A',
};

const storageRecord = uiToStorageRecord(uiPayload);
assert(storageRecord.data_pesagem === '2026-07-09', 'data_pesagem mapped');
assert(storageRecord.peso_kg === 320.5, 'peso_kg mapped');
assert(storageRecord.lote_id === 'lot-1', 'lote_id mapped');
assert(storageRecord.legacy_payload.numero_animal === '1234', 'compatibility snapshot preserves numero_animal');
assert(storageRecord.legacy_payload.nome_lote === 'Lote A', 'compatibility snapshot preserves nome_lote');

const aliasesPayload = uiToStorageRecord({
  dataPesagem: '2026-07-10',
  pesoKg: 400,
  loteId: 'lot-2',
  tipo_manejo: 'Cadastro',
  numero_animal: '999',
});
assert(aliasesPayload.data_pesagem === '2026-07-10', 'alias dataPesagem');
assert(aliasesPayload.peso_kg === 400, 'alias pesoKg');
assert(aliasesPayload.lote_id === 'lot-2', 'alias loteId');
assert(aliasesPayload.legacy_payload.peso === 400, 'snapshot recebe `peso` mesmo quando a UI manda só o alias');

// Lista permitida (ADR-027): exportada, disjunta da proibida e aplicada pelo mapper.
assert(Array.isArray(LEGACY_PAYLOAD_ALLOWLIST) && LEGACY_PAYLOAD_ALLOWLIST.length >= 40, 'LEGACY_PAYLOAD_ALLOWLIST exportada');
for (const key of ['_localId', 'peso_kg', 'created_date', 'updated_date', 'status_animal', 'sanidade_ids', 'sanidades']) {
  assert(LEGACY_PAYLOAD_FORBIDDEN.includes(key), `LEGACY_PAYLOAD_FORBIDDEN inclui ${key}`);
  assert(!LEGACY_PAYLOAD_ALLOWLIST.includes(key), `${key} fora da lista permitida`);
}
const dirty = uiToStorageRecord({ ...uiPayload, status_animal: 'Ativo', created_date: 'x', updated_date: 'y', _localId: 7, sanidade_ids: [1], sanidades: [{}], chave_nova: 'z' });
for (const key of LEGACY_PAYLOAD_FORBIDDEN) assert(!(key in dirty.legacy_payload), `teste negativo: ${key} não entra no snapshot`);
assert(!('chave_nova' in dirty.legacy_payload), 'teste negativo: chave desconhecida é descartada');
assert(findDisallowedLegacyKeys(dirty.legacy_payload).length === 0, 'snapshot só com chaves permitidas');
assert(findDisallowedLegacyKeys({ marca: 'A', chave_nova: 1, _localId: 2 }).join(',') === 'chave_nova,_localId', 'findDisallowedLegacyKeys aponta as chaves fora da lista');
assert(Object.keys(filterLegacyPayload({ marca: 'A', chave_nova: 1 })).join(',') === 'marca', 'filterLegacyPayload mantém só permitidas');
// Rastro da importação conciliada (importacao_id, import_fingerprint, id_externo) é permitido.
const imported = uiToStorageRecord({ ...uiPayload, importacao_id: 'job-1', import_fingerprint: 'local|a|2026-07-09|Manejo|320.50', id_externo: 'EXT-1', importacao_linha: 3 });
assert(imported.legacy_payload.importacao_id === 'job-1', 'importacao_id no snapshot');
assert(imported.legacy_payload.import_fingerprint === 'local|a|2026-07-09|Manejo|320.50', 'import_fingerprint no snapshot');
assert(imported.legacy_payload.id_externo === 'EXT-1', 'id_externo no snapshot');
assert(!('importacao_linha' in imported.legacy_payload), 'teste negativo: chave de importação não listada é descartada');

// Edição: o service mescla o view model (peso_kg antigo) com o payload novo (peso).
const edited = uiToStorageRecord({ peso_kg: 260, peso: 265, data_pesagem: '2026-07-09', tipo_manejo: 'Manejo' }, { isUpdate: true, id: 'x' });
assert(edited.peso_kg === 265, 'teste negativo: peso novo da UI prevalece sobre o peso_kg antigo do view model');
const noWeight = uiToStorageRecord({ observacao: 'só obs' }, { isUpdate: true, id: 'x' });
assert(!('peso_kg' in noWeight) && !('data_pesagem' in noWeight), 'atualização parcial não zera peso nem data');

const viewModel = storageRecordToViewModel({
  id: 'id-1',
  data_pesagem: '2026-07-09',
  peso_kg: 320.5,
  lote_id: 'lot-1',
  legacy_payload: uiPayload,
  created_at: '2026-07-09T12:00:00.000Z',
  updated_at: '2026-07-09T12:00:00.000Z',
});
assert(viewModel.id === 'id-1', 'viewModel id');
assert(viewModel.peso === 320.5, 'viewModel peso');
assert(viewModel.numero_animal === '1234', 'viewModel numero_animal from legacy');
assert(viewModel.__source === undefined, 'viewModel não expõe backend legado para a UI');
assert(viewModel.status_animal === 'Ativo', 'status_animal projetado (Manejo → Ativo) sem estar no payload');
assert(viewModel.created_date === '2026-07-09T12:00:00.000Z', 'created_date cai para created_at');
const exitView = storageRecordToViewModel({ id: 'id-2', data_pesagem: '2026-07-10', peso_kg: 300, legacy_payload: { tipo_manejo: 'Saída', motivo_saida: 'Venda' } });
assert(exitView.status_animal === 'Inativo', 'status_animal projetado (Saída → Inativo)');
const legacyView = storageRecordToViewModel({ id: 'id-3', data_pesagem: '2026-07-10', peso_kg: 300, legacy_payload: { tipo_manejo: 'Manejo', status_animal: 'Inativo', created_date: '2020-01-01T00:00:00.000Z' }, created_at: '2026-07-10T00:00:00.000Z' });
assert(legacyView.status_animal === 'Inativo' && legacyView.created_date === '2020-01-01T00:00:00.000Z', 'valores legados presentes no payload antigo continuam sendo lidos (só leitura)');

let rejected = false;
try {
  validateUiPayload({ peso: 0, data_pesagem: '2026-07-09' });
} catch (err) {
  rejected = err instanceof WeighingError && err.code === 'WEIGHING_MAP_001';
}
assert(rejected, 'peso invalido rejeitado');

let rejectedDate = false;
try {
  validateUiPayload({ peso: 100 });
} catch (err) {
  rejectedDate = err instanceof WeighingError;
}
assert(rejectedDate, 'data ausente rejeitada');

console.log('OK verify-weighing-mapper');
console.log(JSON.stringify({ allowlist: LEGACY_PAYLOAD_ALLOWLIST.length, forbidden: LEGACY_PAYLOAD_FORBIDDEN.length, projections: ['status_animal', 'created_date', 'updated_date'] }, null, 2));
