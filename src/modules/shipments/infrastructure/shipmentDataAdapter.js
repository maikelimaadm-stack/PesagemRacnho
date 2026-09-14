// D.16 cutover: Embarque / DocumentoEmbarque agora em IndexedDB/Dexie.
import storage from '../../../storage/storageAdapter.js';

export async function createShipment(payload) {
  return storage.embarques.create(payload);
}
export async function updateShipment(id, payload) {
  return storage.embarques.update(id, payload);
}
export async function deleteShipment(id) {
  return storage.embarques.remove(id);
}
export async function getShipment(id) {
  return storage.embarques.get(id);
}
export async function listShipments(filters = {}) {
  return (await storage.embarques.list(filters)) || [];
}

export async function createDocument(payload) {
  return storage.documentosEmbarque.create(payload);
}
export async function updateDocument(id, payload) {
  return storage.documentosEmbarque.update(id, payload);
}
export async function deleteDocument(id) {
  return storage.documentosEmbarque.remove(id);
}
export async function listDocuments(filters = {}) {
  return (await storage.documentosEmbarque.list(filters)) || [];
}
