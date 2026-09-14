import * as adapter from '../infrastructure/shipmentDataAdapter.js';
import {
  documentFromUi,
  documentToUi,
  shipmentFromUi,
  shipmentToUi,
} from '../domain/shipmentMapper.js';

export async function listShipments({ empresaId } = {}) {
  return (await adapter.listShipments(empresaId ? { empresaId } : {})).map(shipmentToUi);
}

export async function getShipment(id) {
  return shipmentToUi(await adapter.getShipment(id));
}

export async function createShipment(payload) {
  return shipmentToUi(await adapter.createShipment(shipmentFromUi(payload)));
}

export async function updateShipment(id, payload) {
  return shipmentToUi(await adapter.updateShipment(id, shipmentFromUi(payload)));
}

export async function deleteShipment(id) {
  return adapter.deleteShipment(id);
}

export async function listDocuments({ empresaId, embarqueId } = {}) {
  const filters = {};
  if (empresaId) filters.empresaId = empresaId;
  if (embarqueId) filters.embarque_id = embarqueId;
  return (await adapter.listDocuments(filters)).map(documentToUi);
}

export async function createDocument(payload) {
  return documentToUi(await adapter.createDocument(documentFromUi(payload)));
}

export async function updateDocument(id, payload) {
  return documentToUi(await adapter.updateDocument(id, documentFromUi(payload)));
}

export async function deleteDocument(id) {
  return adapter.deleteDocument(id);
}
