/**
 * Normaliza os registros persistidos para o shape esperado pela UI de embarque.
 * O schema usa nomes de domínio em português (nome, frigorifico,
 * tipo_documento etc.).
 */

export function shipmentToUi(row) {
  if (!row) return null;
  return { ...row };
}

export function documentToUi(row) {
  if (!row) return null;
  return { ...row };
}

export function shipmentFromUi(payload) {
  return {
    ...payload,
    nome: payload.nome ?? payload.destino ?? payload.name,
    data: payload.data ?? payload.data_embarque,
    status: payload.status || 'Planejado',
  };
}

export function documentFromUi(payload) {
  return {
    ...payload,
    embarque_id: payload.embarque_id ?? payload.shipment_id,
    tipo_documento: payload.tipo_documento ?? payload.tipo,
  };
}
