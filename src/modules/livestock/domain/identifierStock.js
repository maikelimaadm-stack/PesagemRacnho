// Estoque de identificadores (F06) — puro. Livro imutável `movimentosIdentificadores`: cada ação é um
// movimento; a situação de um código é a da ÚLTIMA ação válida. O saldo vem do livro, nunca de um contador
// solto. Unicidade por (tipo + valor normalizado). Código oficial (SISBOV, RFID) aplicado, perdido ou
// danificado nunca volta a ficar disponível (sem reaproveitamento indevido). "SN" não é código de estoque.

export class IdentifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IdentifierError';
    this.code = code;
    Object.assign(this, details);
  }
}

export const TIPOS_IDENTIFICADOR = Object.freeze(['BRINCO', 'RFID', 'SISBOV', 'TATUAGEM', 'OUTRO']);
export const TIPO_IDENTIFICADOR_LABELS = Object.freeze({
  BRINCO: 'Brinco visual',
  RFID: 'Brinco/bolus eletrônico (RFID)',
  SISBOV: 'Código SISBOV',
  TATUAGEM: 'Tatuagem',
  OUTRO: 'Outro',
});
// Tipos cujo código não pode ser reutilizado depois de aplicado/perdido/danificado.
export const TIPOS_OFICIAIS = Object.freeze(['SISBOV', 'RFID']);

export const ACOES = Object.freeze(['RECEBIDO', 'RESERVADO', 'LIBERADO', 'APLICADO', 'REMOVIDO', 'PERDIDO', 'DANIFICADO', 'DEVOLVIDO', 'BLOQUEADO']);
export const SITUACOES = Object.freeze(['DISPONIVEL', 'RESERVADO', 'APLICADO', 'PERDIDO', 'DANIFICADO', 'DEVOLVIDO', 'BLOQUEADO', 'BAIXADO']);
export const SITUACAO_LABELS = Object.freeze({
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  APLICADO: 'Aplicado',
  PERDIDO: 'Perdido',
  DANIFICADO: 'Danificado',
  DEVOLVIDO: 'Devolvido',
  BLOQUEADO: 'Bloqueado',
  BAIXADO: 'Retirado do animal',
});
export const ACAO_LABELS = Object.freeze({
  RECEBIDO: 'Recebido',
  RESERVADO: 'Reservado',
  LIBERADO: 'Liberado',
  APLICADO: 'Aplicado',
  REMOVIDO: 'Retirado do animal',
  PERDIDO: 'Perdido',
  DANIFICADO: 'Danificado',
  DEVOLVIDO: 'Devolvido ao fornecedor',
  BLOQUEADO: 'Bloqueado',
});

// Situação resultante e situações de onde a ação pode partir.
const TRANSICOES = Object.freeze({
  RECEBIDO: { de: [null], para: 'DISPONIVEL' },
  RESERVADO: { de: ['DISPONIVEL'], para: 'RESERVADO' },
  LIBERADO: { de: ['RESERVADO', 'BLOQUEADO'], para: 'DISPONIVEL' },
  APLICADO: { de: ['DISPONIVEL', 'RESERVADO'], para: 'APLICADO' },
  REMOVIDO: { de: ['APLICADO'], para: 'BAIXADO' },
  PERDIDO: { de: ['DISPONIVEL', 'RESERVADO', 'APLICADO', 'BLOQUEADO'], para: 'PERDIDO' },
  DANIFICADO: { de: ['DISPONIVEL', 'RESERVADO', 'APLICADO', 'BLOQUEADO'], para: 'DANIFICADO' },
  DEVOLVIDO: { de: ['DISPONIVEL', 'RESERVADO', 'BLOQUEADO'], para: 'DEVOLVIDO' },
  BLOQUEADO: { de: ['DISPONIVEL', 'RESERVADO'], para: 'BLOQUEADO' },
});

export const normalizeCode = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');

export function assertCode(tipo, valor) {
  const t = String(tipo || '').toUpperCase();
  if (!TIPOS_IDENTIFICADOR.includes(t)) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Tipo de identificador inválido.');
  const v = normalizeCode(valor);
  if (!v) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Informe o código do identificador.');
  if (v === 'SN' || v === 'S/N') throw new IdentifierError('IDENTIFICADOR_INVALIDO', '"SN" (sem número) não é um código de estoque.');
  if (t === 'SISBOV' && !/^\d{15}$/.test(v)) throw new IdentifierError('IDENTIFICADOR_INVALIDO', `Código SISBOV ${v}: use os 15 dígitos.`);
  return { tipo: t, valor_normalizado: v };
}

/** Situação atual a partir dos movimentos (ativos) de UM código, em ordem de gravação. */
export function currentSituation(movimentos = []) {
  const ordered = [...movimentos].filter((m) => m && !m.deleted_at)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  let situacao = null;
  let animalId = null;
  for (const mov of ordered) {
    situacao = TRANSICOES[mov.acao]?.para ?? situacao;
    if (mov.acao === 'APLICADO') animalId = mov.animal_id || null;
    if (['REMOVIDO', 'PERDIDO', 'DANIFICADO'].includes(mov.acao)) animalId = situacao === 'APLICADO' ? animalId : null;
  }
  return { situacao, animal_id: situacao === 'APLICADO' ? animalId : null, ultimo: ordered.at(-1) || null };
}

/**
 * Confere se a ação pode ser aplicada ao código na situação atual. Código oficial que já foi aplicado
 * (mesmo retirado) nunca volta ao estoque.
 */
export function assertTransition(tipo, situacao, acao, historico = []) {
  const regra = TRANSICOES[acao];
  if (!regra) throw new IdentifierError('IDENTIFICADOR_ACAO', 'Ação inválida.');
  if (!regra.de.includes(situacao ?? null)) {
    const atual = situacao ? SITUACAO_LABELS[situacao] : 'não recebido';
    throw new IdentifierError('IDENTIFICADOR_SITUACAO', `${ACAO_LABELS[acao]}: não é possível a partir de "${atual}".`);
  }
  if (TIPOS_OFICIAIS.includes(tipo) && acao === 'APLICADO' && historico.some((m) => !m.deleted_at && m.acao === 'APLICADO')) {
    throw new IdentifierError('IDENTIFICADOR_REUSO', 'Código oficial já foi aplicado antes; não pode ser reaproveitado.');
  }
  return regra.para;
}

/** Faixa numérica de recebimento (com prefixo opcional e zeros à esquerda preservados). */
export function expandRange({ prefixo = '', inicio, fim, largura = null } = {}) {
  const a = Number(inicio);
  const b = Number(fim);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Faixa inválida: início e fim inteiros, início ≤ fim.');
  if (b - a + 1 > 5000) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Faixa muito grande: receba no máximo 5.000 códigos por vez.');
  const pad = largura ? Number(largura) : Math.max(String(inicio).length, String(fim).length);
  const p = normalizeCode(prefixo);
  return Array.from({ length: b - a + 1 }, (_, i) => `${p}${String(a + i).padStart(pad, '0')}`);
}

/** Saldo por situação de uma lista de códigos { situacao }. */
export function stockSummary(codigos = []) {
  const out = Object.fromEntries(SITUACOES.map((s) => [s, 0]));
  for (const c of codigos) if (c.situacao && out[c.situacao] !== undefined) out[c.situacao] += 1;
  out.TOTAL = codigos.length;
  return out;
}

/**
 * Conferência física: códigos contados × DISPONÍVEIS no sistema. Não ajusta nada — devolve o que falta e o
 * que sobra para o operador decidir (marcar perdido, receber, investigar).
 */
export function physicalCount(codigosSistema = [], contados = []) {
  const disponiveis = new Set(codigosSistema.filter((c) => c.situacao === 'DISPONIVEL').map((c) => c.valor_normalizado));
  const todos = new Map(codigosSistema.map((c) => [c.valor_normalizado, c]));
  const contadosSet = new Set(contados.map(normalizeCode).filter(Boolean));
  const faltando = [...disponiveis].filter((v) => !contadosSet.has(v)).sort();
  const sobrando = [...contadosSet].filter((v) => !disponiveis.has(v)).sort().map((v) => ({ valor: v, situacao_no_sistema: todos.get(v)?.situacao || 'NAO_RECEBIDO' }));
  return { disponiveis_no_sistema: disponiveis.size, contados: contadosSet.size, conferem: disponiveis.size - faltando.length, faltando, sobrando, fecha: !faltando.length && !sobrando.length };
}
