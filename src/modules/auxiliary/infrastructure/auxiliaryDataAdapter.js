// Apartação e lotes operam diretamente em IndexedDB/Dexie.
import storage from '../../../storage/storageAdapter.js';

export async function isAuxiliaryStorageAvailable() {
  try { await storage.ensureReady(); return true; } catch { return false; }
}

export async function createApartacao(payload) {
  return storage.apartacoes.create(payload);
}
export async function updateApartacao(id, payload) {
  return storage.apartacoes.update(id, payload);
}
export async function deleteApartacao(id) {
  return storage.apartacoes.remove(id);
}
export async function getApartacao(id) {
  return storage.apartacoes.get(id);
}
export async function listApartacoes(filters = {}) {
  return (await storage.apartacoes.list(filters)) || [];
}

export async function createLoteApartacao(payload) {
  return storage.loteApartacoes.create(payload);
}
export async function updateLoteApartacao(id, payload) {
  return storage.loteApartacoes.update(id, payload);
}
export async function deleteLoteApartacao(id) {
  return storage.loteApartacoes.remove(id);
}
export async function getLoteApartacao(id) {
  return storage.loteApartacoes.get(id);
}
export async function listLoteApartacoes(filters = {}) {
  return (await storage.loteApartacoes.list(filters)) || [];
}
