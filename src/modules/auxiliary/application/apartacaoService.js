import * as adapter from '../infrastructure/auxiliaryDataAdapter.js';

/** Compatibilidade UI: mesmos campos esperados pelas telas de pesagens. */

function normalizeEmpresaPayload(payload = {}) {
  const empresaId = payload.empresa_id ?? payload.empresaId;
  const normalized = { ...payload };
  delete normalized.empresaId;
  if (empresaId != null) normalized.empresa_id = empresaId;
  return normalized;
}

export async function listApartacoes({ empresaId, empresa_id: empresaIdPersistido } = {}) {
  const filters = {};
  const id = empresaIdPersistido ?? empresaId;
  if (id) filters.empresa_id = id;
  return adapter.listApartacoes(filters);
}

export async function createApartacao(payload) {
  return adapter.createApartacao(normalizeEmpresaPayload(payload));
}

export async function updateApartacao(id, payload) {
  return adapter.updateApartacao(id, normalizeEmpresaPayload(payload));
}

export async function deleteApartacao(id) {
  return adapter.deleteApartacao(id);
}

export async function listLoteApartacoes({ empresaId, empresa_id: empresaIdPersistido, apartacaoId, apartacao_id: apartacaoIdPersistido } = {}) {
  const filters = {};
  const id = empresaIdPersistido ?? empresaId;
  const apartacao = apartacaoIdPersistido ?? apartacaoId;
  if (id) filters.empresa_id = id;
  if (apartacao) filters.apartacao_id = apartacao;
  return adapter.listLoteApartacoes(filters);
}

export async function filterLoteApartacoes(filters = {}) {
  return adapter.listLoteApartacoes({
    empresa_id: filters.empresa_id ?? filters.empresaId,
    apartacao_id: filters.apartacao_id,
  });
}

export async function createLoteApartacao(payload) {
  return adapter.createLoteApartacao(normalizeEmpresaPayload(payload));
}

export async function updateLoteApartacao(id, payload) {
  return adapter.updateLoteApartacao(id, normalizeEmpresaPayload(payload));
}

export async function deleteLoteApartacao(id) {
  return adapter.deleteLoteApartacao(id);
}

export async function isAvailable() {
  return adapter.isAuxiliaryStorageAvailable();
}
