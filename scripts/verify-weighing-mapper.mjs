import {
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
