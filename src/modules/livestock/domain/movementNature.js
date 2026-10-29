// Natureza do movimento no livro único (`movimentosAnimais`) — missão pesagens-integrada, Fase B.
// ENTRADA e SAÍDA mudam o saldo do rebanho; INTERNA (lote, pasto, propriedade própria) não. O inventário
// (F17) soma pela natureza, nunca pelo texto do tipo. Tipos antigos (1.x) e novos caem na mesma regra.

export const NATUREZAS = Object.freeze({ ENTRADA: 'ENTRADA', SAIDA: 'SAIDA', INTERNA: 'INTERNA' });

const ENTRADAS = new Set(['entrada', 'compra', 'nascimento', 'transferência recebida', 'transferencia recebida', 'ajuste de entrada']);
const SAIDAS = new Set(['venda', 'abate', 'morte', 'doação', 'doacao', 'transferência', 'transferencia', 'transferência enviada', 'transferencia enviada', 'saída', 'saida', 'ajuste de saída', 'ajuste de saida', 'outros']);
const INTERNAS = new Set(['mudança de lote', 'mudanca de lote', 'transferência interna', 'transferencia interna', 'mudança de pasto', 'mudanca de pasto', 'mudança de propriedade', 'mudanca de propriedade']);

/** Natureza a partir do tipo do movimento; null quando o tipo não é reconhecido. */
export function naturezaDoTipo(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  if (ENTRADAS.has(t)) return NATUREZAS.ENTRADA;
  if (SAIDAS.has(t)) return NATUREZAS.SAIDA;
  if (INTERNAS.has(t)) return NATUREZAS.INTERNA;
  return null;
}

/** Natureza gravada ou derivada (movimentos antigos sem o campo). */
export function naturezaDe(movimento) {
  return movimento?.natureza || naturezaDoTipo(movimento?.tipo);
}
