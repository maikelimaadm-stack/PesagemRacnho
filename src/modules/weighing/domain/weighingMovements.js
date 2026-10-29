// Movimentos derivados das pesagens de UM animal (P04, P09, P13 — missão pesagens-integrada).
//
// Quem grava pesagem (lançamento, edição, cancelamento, repesagem) gera movimentos em `movimentosAnimais`
// (Entrada no Cadastro, motivo na Saída, "Mudança de lote" quando o lote muda) e permanências em
// `animalLotes`. Antes, cada caminho fazia isso do seu jeito e o cancelamento/edição deixava movimento
// órfão (P04/P09) e a reconstrução de lotes apagava e recriava tudo a cada chamada (P13).
// Aqui fica a regra única, pura: a partir da série ATIVA e ordenada, o conjunto esperado de movimentos e de
// permanências. O adapter compara com o gravado e só escreve a diferença (idempotente: reaplicar não muda
// nada). Movimentos que NÃO vêm de pesagem (sem pesagem_id — movimentações próprias, fase B) não entram aqui
// e nunca são apagados pela reconciliação.
import { compareWeighingEvents } from './weighingSeries.js';

const tipoOf = (row) => row?.legacy_payload?.tipo_manejo ?? row?.tipo_manejo ?? row?.tipo_pesagem ?? null;
const uiOf = (row) => (row && typeof row.legacy_payload === 'object' ? row.legacy_payload : row || {});
const sortView = (row) => ({ tipo_manejo: tipoOf(row), data_pesagem: row.data_pesagem, created_at: row.created_at, id: row.id });

export function sortEvents(rows = []) {
  return [...rows].filter((row) => row && !row.deleted_at).sort((a, b) => compareWeighingEvents(sortView(a), sortView(b)));
}

/**
 * Movimentos esperados a partir das pesagens ativas do animal.
 * @returns {{ pesagem_id, tipo, data_evento, lote_origem_id, lote_destino_id, motivo }[]}
 */
export function deriveWeighingMovements(rows = []) {
  const movements = [];
  let current = null;
  for (const row of sortEvents(rows)) {
    const tipo = tipoOf(row);
    const ui = uiOf(row);
    const lote = row.lote_id ?? ui.lote_id ?? null;
    const operacao = ui.operacao_id || null;
    if (tipo === 'Cadastro') {
      movements.push({ pesagem_id: row.id, operacao_id: operacao, tipo: 'Entrada', data_evento: row.data_pesagem, lote_origem_id: null, lote_destino_id: lote, motivo: null });
      if (lote) current = lote;
      continue;
    }
    if (tipo === 'Saída') {
      const motivo = ui.motivo_saida || null;
      movements.push({ pesagem_id: row.id, operacao_id: operacao, tipo: motivo || 'Saída', data_evento: row.data_pesagem, lote_origem_id: current, lote_destino_id: lote, motivo });
      current = null;
      continue;
    }
    if (lote && lote !== current) {
      if (current) {
        movements.push({ pesagem_id: row.id, operacao_id: operacao, tipo: 'Mudança de lote', data_evento: row.data_pesagem, lote_origem_id: current, lote_destino_id: lote, motivo: null });
      }
      current = lote;
    }
  }
  return movements;
}

/** Chave de comparação de um movimento derivado (o que importa para o histórico). */
export function movementKey(m) {
  return [m.pesagem_id, m.tipo, m.data_evento, m.lote_origem_id || '', m.lote_destino_id || '', m.motivo || ''].join('|');
}

/**
 * Permanências esperadas em lote a partir das pesagens (mesma regra da projeção da 1.x):
 * abre no evento que muda de lote, fecha no próximo lote ou na Saída.
 * @returns {{ lote_id, apartacao_id, inicio, fim }[]}
 */
export function deriveLotStays(rows = []) {
  const stays = [];
  let current = null;
  const ordered = [...rows].filter((row) => row && !row.deleted_at).sort((left, right) =>
    String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || ''))
    || String(left.created_at || '').localeCompare(String(right.created_at || ''))
    || String(left.id || '').localeCompare(String(right.id || '')));
  for (const row of ordered) {
    const ui = uiOf(row);
    if (tipoOf(row) === 'Saída') {
      if (current && !current.fim) current.fim = row.data_pesagem;
      current = null;
      continue;
    }
    if (row.lote_id && current?.lote_id !== row.lote_id) {
      if (current && !current.fim) current.fim = row.data_pesagem;
      current = { lote_id: row.lote_id, apartacao_id: ui.apartacao_id || null, inicio: row.data_pesagem, fim: null };
      stays.push(current);
    }
  }
  return stays;
}

export function stayKey(stay) {
  return `${stay.lote_id}|${stay.inicio}`;
}
