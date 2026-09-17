// Regras de pendência do Fechamento do Dia — fonte única para a tela de Fechamento e para os
// relatórios (Pendências de pesagem, Fechamento imprimível). Nenhuma lógica paralela.

const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export const PENDENCY_TYPES = Object.freeze({ PESO: 'Peso', LOTE: 'Lote', DOC: 'Doc' });

/** Documento obrigatório na saída: Abate sempre; Venda só com a política exigir_documento_venda. */
export function exitRequiresDocument(motivoSaida, salesPolicy = {}) {
  const motivo = String(motivoSaida ?? '').trim();
  if (motivo === 'Abate') return true;
  if (motivo === 'Venda') return salesPolicy?.exigir_documento_venda === true;
  return false;
}

/**
 * Pendências de um lançamento: GMD negativo (Peso), sem lote fora de saída (Lote) e saída que exige
 * documento sem embarque/documento (Doc).
 * @returns {{ key: string, type: string, danger: boolean }[]}
 */
export function pendenciesOf(row, salesPolicy = {}) {
  const result = [];
  if (hasNumber(row.gmd) && Number(row.gmd) < 0) result.push({ key: `peso:${row.id}`, type: PENDENCY_TYPES.PESO, danger: false });
  if (row.tipo_manejo !== 'Saída' && !row.lote_id && !row.nome_lote) result.push({ key: `lote:${row.id}`, type: PENDENCY_TYPES.LOTE, danger: false });
  if (row.tipo_manejo === 'Saída' && exitRequiresDocument(row.motivo_saida, salesPolicy) && !row.embarque_id && !row.documento_embarque_id) {
    result.push({ key: `doc:${row.id}`, type: PENDENCY_TYPES.DOC, danger: true });
  }
  return result;
}
