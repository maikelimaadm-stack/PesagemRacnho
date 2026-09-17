// Massa pequena e verificável à mão para os gates de relatórios (programa reporting).
// Datas no passado (o mapper recusa data futura). Tudo pela cadeia oficial (weighingService).
import 'fake-indexeddb/auto';
import { deleteDbForTests } from '../../src/storage/indexedDb/db.js';
import storage from '../../src/storage/storageAdapter.js';
import * as weighingService from '../../src/modules/weighing/application/weighingService.js';

export const ADMIN = Object.freeze({ id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' });
export const GESTOR = Object.freeze({ id: 'u-gestor', nome: 'Gil Gestor', role: 'GESTOR' });
export const OPERADOR = Object.freeze({ id: 'u-op', nome: 'Otto Operador', role: 'OPERADOR' });
export const CONSULTA = Object.freeze({ id: 'u-consulta', nome: 'Cida Consulta', role: 'CONSULTA' });
export const TODAY = '2026-09-15';

const TS = '2026-09-01T00:00:00.000Z';
const registry = (id, nome, extra = {}) => ({ id, empresa_id: 'local', nome, nome_normalizado: nome.toUpperCase(), ativo: true, created_at: TS, updated_at: TS, deleted_at: null, ...extra });

/**
 * Animais (datas em ago–set/2026):
 *  A1 macho Nelore marca ALFA  lote L1: 300 (08-01) → 330 (08-21, 20 d, +30) → 345 (09-10, 20 d, +15)
 *  A2 fêmea Angus  marca BETA  lote L2: 250 (08-05) → 260 (08-15, 10 d, +10) → Saída Venda 280 (09-05)
 *  A3 macho Nelore marca ALFA  lote L1: 410 (08-10) → Saída Morte sem peso (09-01)
 *  A4 fêmea sem raça   marca "Álfa" (texto com acento) sem lote: 200 (09-12)
 */
export async function seedReportFixture() {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  await db.table('marcas').bulkAdd([registry('m-alfa', 'ALFA'), registry('m-beta', 'BETA')]);
  await db.table('racas').bulkAdd([registry('r-nelore', 'Nelore'), registry('r-angus', 'Angus')]);
  await db.table('apartacoes').bulkAdd([
    { id: 'ap1', empresa_id: 'local', nome_apartacao: 'Engorda', ativo: true, created_at: TS, updated_at: TS, deleted_at: null },
  ]);
  await db.table('loteApartacoes').bulkAdd([
    { id: 'L1', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: 'Lote 01', quantidade_maxima: 10, created_at: TS, updated_at: TS, deleted_at: null },
    { id: 'L2', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: 'Lote 02', quantidade_maxima: 10, created_at: TS, updated_at: TS, deleted_at: null },
  ]);
  const base = { empresa_id: 'local', status_animal: 'Ativo' };
  const lote = (id) => (id === 'L1'
    ? { lote_id: 'L1', nome_lote: 'Lote 01', apartacao_id: 'ap1', nome_apartacao: 'Engorda' }
    : id === 'L2' ? { lote_id: 'L2', nome_lote: 'Lote 02', apartacao_id: 'ap1', nome_apartacao: 'Engorda' } : {});
  const a1 = { ...base, animal_id: 'A1', numero_animal: '101', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore', ...lote('L1') };
  const a2 = { ...base, animal_id: 'A2', numero_animal: '202', marca: 'BETA', marca_id: 'm-beta', sexo: 'F', raca: 'Angus', raca_id: 'r-angus', ...lote('L2') };
  const a3 = { ...base, animal_id: 'A3', numero_animal: '303', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore', ...lote('L1') };
  const a4 = { ...base, animal_id: 'A4', numero_animal: '404', marca: 'Álfa', sexo: 'F' };
  const entries = [
    { ...a1, id: 'e1', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 300 },
    { ...a1, id: 'e2', tipo_manejo: 'Manejo', data_pesagem: '2026-08-21', peso: 330 },
    { ...a1, id: 'e3', tipo_manejo: 'Manejo', data_pesagem: '2026-09-10', peso: 345, observacao: 'conferência' },
    { ...a2, id: 'e4', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-05', peso: 250 },
    { ...a2, id: 'e5', tipo_manejo: 'Manejo', data_pesagem: '2026-08-15', peso: 260 },
    { ...a2, id: 'e6', tipo_manejo: 'Saída', motivo_saida: 'Venda', comprador: 'Frigo Sul', data_pesagem: '2026-09-05', peso: 280, valor_venda_total: 3000, valor_arroba: 300, rendimento_carcaca: 50, peso_carcaca_estimado: 140, quantidade_arrobas: 140 / 15, rendimento_origem: 'INFORMADO' },
    { ...a3, id: 'e7', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-10', peso: 410 },
    { ...a3, id: 'e8', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'Raio', data_pesagem: '2026-09-01', peso: null },
    { ...a4, id: 'e9', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-12', peso: 200 },
  ];
  for (const entry of entries) await weighingService.createEntry(entry);
  return { db, entries };
}

export async function resetDb() {
  await deleteDbForTests();
}
