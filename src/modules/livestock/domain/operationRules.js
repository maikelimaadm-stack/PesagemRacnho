// Regras das operações de rebanho (F01 Entradas, F02 Saídas, F03 Movimentações) — puras.
// Modelo: docs/arquitetura-produto/17-MODELO-DADOS-V9.md. Operação = cabeçalho + itens por animal; cada item
// confirmado gera exatamente UM efeito no livro de movimentos (`movimentosAnimais`). Pesagem não é
// pré-requisito: entrada sem peso cria o animal PENDENTE_PESAGEM; peso só é gravado quando medido ou
// informado (nunca 0 kg inventado).
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from '../../weighing/domain/brazilianValues.js';

export class OperationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    Object.assign(this, details);
  }
}

export const OPERACAO_TIPOS = Object.freeze({ ENTRADA: 'ENTRADA', SAIDA: 'SAIDA', MOVIMENTACAO: 'MOVIMENTACAO' });
export const OPERACAO_STATUS = Object.freeze({ RASCUNHO: 'RASCUNHO', CONFIRMADA: 'CONFIRMADA', CANCELADA: 'CANCELADA' });
export const ITEM_STATUS = Object.freeze({ RASCUNHO: 'RASCUNHO', CONFIRMADO: 'CONFIRMADO', CANCELADO: 'CANCELADO' });

export const SUBTIPOS = Object.freeze({
  ENTRADA: Object.freeze(['COMPRA', 'TRANSFERENCIA_RECEBIDA', 'NASCIMENTO', 'AJUSTE_ENTRADA']),
  SAIDA: Object.freeze(['VENDA', 'ABATE', 'TRANSFERENCIA_ENVIADA', 'MORTE', 'DOACAO', 'AJUSTE_SAIDA']),
  MOVIMENTACAO: Object.freeze(['MUDANCA_LOTE', 'MUDANCA_PROPRIEDADE']),
});

export const SUBTIPO_LABELS = Object.freeze({
  COMPRA: 'Compra',
  TRANSFERENCIA_RECEBIDA: 'Transferência recebida',
  NASCIMENTO: 'Nascimento',
  AJUSTE_ENTRADA: 'Ajuste de inventário (entrada)',
  VENDA: 'Venda',
  ABATE: 'Abate',
  TRANSFERENCIA_ENVIADA: 'Transferência enviada',
  MORTE: 'Morte',
  DOACAO: 'Doação',
  AJUSTE_SAIDA: 'Ajuste de inventário (saída)',
  MUDANCA_LOTE: 'Mudança de lote',
  MUDANCA_PROPRIEDADE: 'Mudança de propriedade',
  // Operações geradas pela atualização v9 a partir das pesagens antigas.
  LEGADO_CADASTRO: 'Cadastro (legado)',
  SAIDA_SEM_MOTIVO: 'Saída sem motivo (legado)',
});

export const TIPO_LABELS = Object.freeze({ ENTRADA: 'Entrada', SAIDA: 'Saída', MOVIMENTACAO: 'Movimentação' });
export const STATUS_LABELS = Object.freeze({ RASCUNHO: 'Rascunho', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' });

/** Tipo do movimento de ENTRADA no livro (natureza ENTRADA por movementNature). */
export const TIPO_MOVIMENTO_ENTRADA = Object.freeze({
  COMPRA: 'Compra',
  TRANSFERENCIA_RECEBIDA: 'Transferência recebida',
  NASCIMENTO: 'Nascimento',
  AJUSTE_ENTRADA: 'Ajuste de entrada',
});

/** Motivo da pesagem de Saída gerada pelo item (mesma lista do Lançamento). */
export const MOTIVO_SAIDA_POR_SUBTIPO = Object.freeze({
  VENDA: 'Venda',
  ABATE: 'Abate',
  TRANSFERENCIA_ENVIADA: 'Transferência',
  MORTE: 'Morte',
  DOACAO: 'Doação',
  AJUSTE_SAIDA: 'Outros',
});

/** Tipo do movimento INTERNO (não muda o saldo do rebanho). */
export const TIPO_MOVIMENTO_INTERNO = Object.freeze({
  MUDANCA_LOTE: 'Mudança de lote',
  MUDANCA_PROPRIEDADE: 'Mudança de propriedade',
});

// Venda e Abate exigem peso (medido ou informado no negócio); os demais aceitam sem peso.
export const SUBTIPOS_PESO_OBRIGATORIO = Object.freeze(['VENDA', 'ABATE']);
export const SUBTIPOS_AJUSTE = Object.freeze(['AJUSTE_ENTRADA', 'AJUSTE_SAIDA']);
export const PESO_ORIGENS = Object.freeze(['BALANCA', 'MANUAL', 'INFORMADO']);
export const PESO_ORIGEM_LABELS = Object.freeze({ BALANCA: 'Balança', MANUAL: 'Digitado (medido)', INFORMADO: 'Informado no negócio' });
export const SEXOS = Object.freeze(['M', 'F']);
const JUSTIFICATIVA_MIN = 5;

const trim = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};
export const trimOrNull = trim;

function money(value, rotulo, erros) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseBrazilianNumber(value);
  if (n === null || !Number.isFinite(n) || n < 0) { erros.push(`${rotulo}: valor inválido.`); return null; }
  return Math.round(n * 100) / 100;
}

function invalid(erros, message = erros[0]) {
  if (erros.length) throw new OperationError('OPERACAO_INVALIDA', message, { erros });
}

/**
 * Cabeçalho da operação. Documento (GTA, NF-e) é opcional: só o que se aplica ao evento.
 * Ajuste de inventário exige justificativa; mudança de lote/propriedade exige o destino.
 */
export function validateHeader(input = {}) {
  const erros = [];
  const tipo = String(input.tipo || '').toUpperCase();
  if (!SUBTIPOS[tipo]) erros.push('Tipo de operação inválido.');
  const subtipo = String(input.subtipo || '').toUpperCase();
  if (SUBTIPOS[tipo] && !SUBTIPOS[tipo].includes(subtipo)) erros.push('Escolha o tipo de ' + (TIPO_LABELS[tipo] || 'operação').toLowerCase() + '.');
  const data = parseCivilDate(input.data);
  if (!data) erros.push('Data da operação é obrigatória.');
  else if (isFutureCivilDate(data)) erros.push('A data da operação não pode estar no futuro.');
  let quantidade = null;
  if (input.quantidade_prevista !== null && input.quantidade_prevista !== undefined && input.quantidade_prevista !== '') {
    quantidade = Number(input.quantidade_prevista);
    if (!Number.isInteger(quantidade) || quantidade < 1) { erros.push('Quantidade prevista deve ser um número inteiro maior que zero.'); quantidade = null; }
  }
  const observacao = trim(input.observacao);
  if (SUBTIPOS_AJUSTE.includes(subtipo) && (!observacao || observacao.length < JUSTIFICATIVA_MIN)) {
    erros.push('Ajuste de inventário exige justificativa (observação).');
  }
  const loteDestino = trim(input.lote_destino_id);
  const propriedadeDestino = trim(input.propriedade_destino_id);
  if (subtipo === 'MUDANCA_LOTE' && !loteDestino) erros.push('Informe o lote de destino.');
  if (subtipo === 'MUDANCA_PROPRIEDADE' && !propriedadeDestino) erros.push('Informe a propriedade de destino.');
  const valorTotal = money(input.valor_total, 'Valor total', erros);
  const frete = money(input.frete, 'Frete', erros);
  invalid(erros);
  return {
    tipo,
    subtipo,
    data,
    quantidade_prevista: quantidade,
    parceiro_id: trim(input.parceiro_id),
    propriedade_origem_id: trim(input.propriedade_origem_id),
    propriedade_destino_id: propriedadeDestino,
    lote_destino_id: loteDestino,
    gta_numero: trim(input.gta_numero),
    nf_numero: trim(input.nf_numero),
    valor_total: valorTotal,
    frete,
    observacao,
  };
}

function pesoDoItem(input, erros, rotulo) {
  const raw = input.peso_kg ?? input.peso;
  if (raw === null || raw === undefined || raw === '') return { peso_kg: null, peso_origem: null };
  const peso = typeof raw === 'number' ? raw : parseBrazilianNumber(raw);
  if (peso === null || !Number.isFinite(peso) || peso <= 0) { erros.push(`${rotulo}: peso deve ser maior que zero (deixe em branco se não foi pesado).`); return { peso_kg: null, peso_origem: null }; }
  const origem = String(input.peso_origem || 'MANUAL').toUpperCase();
  if (!PESO_ORIGENS.includes(origem)) erros.push(`${rotulo}: origem do peso inválida.`);
  return { peso_kg: Math.round(peso), peso_origem: origem };
}

/**
 * Item da operação. ENTRADA: animal novo ({ numero_animal?, marca_id?, sexo, raca_id?, mae_animal_id? })
 * ou existente (animal_id). SAÍDA/MOVIMENTAÇÃO: animal_id. Peso opcional, exceto Venda/Abate.
 */
export function validateItem(header, input = {}, { posicao = null } = {}) {
  const erros = [];
  const rotulo = posicao ? `Animal ${posicao}` : 'Animal';
  const animalId = trim(input.animal_id);
  const out = { animal_id: animalId, valor: money(input.valor, `${rotulo}: valor`, erros), observacao: trim(input.observacao) };
  if (header.tipo === OPERACAO_TIPOS.ENTRADA) {
    if (!animalId) {
      const sexo = String(input.sexo || '').toUpperCase();
      if (!SEXOS.includes(sexo)) erros.push(`${rotulo}: informe o sexo (M ou F).`);
      Object.assign(out, {
        numero_animal: trim(input.numero_animal),
        marca_id: trim(input.marca_id),
        sexo: SEXOS.includes(sexo) ? sexo : null,
        raca_id: trim(input.raca_id),
        mae_animal_id: header.subtipo === 'NASCIMENTO' ? trim(input.mae_animal_id) : null,
        lote_id: trim(input.lote_id) || header.lote_destino_id || null,
      });
    } else {
      out.lote_id = trim(input.lote_id) || header.lote_destino_id || null;
    }
    Object.assign(out, pesoDoItem(input, erros, rotulo));
  } else if (header.tipo === OPERACAO_TIPOS.SAIDA) {
    if (!animalId) erros.push(`${rotulo}: escolha o animal.`);
    Object.assign(out, pesoDoItem(input, erros, rotulo));
    if (SUBTIPOS_PESO_OBRIGATORIO.includes(header.subtipo) && out.peso_kg === null) {
      erros.push(`${rotulo}: ${SUBTIPO_LABELS[header.subtipo]} exige o peso (medido na balança ou informado no negócio).`);
    }
  } else {
    if (!animalId) erros.push(`${rotulo}: escolha o animal.`);
  }
  invalid(erros);
  return out;
}

/**
 * Conferência antes de confirmar (F01/F02): quantidade esperada × itens, animal repetido e identificação
 * repetida entre os novos. `bloqueios` impedem a confirmação; `avisos` exigem ciência do operador.
 */
export function checkConference(header, itens = []) {
  const bloqueios = [];
  const avisos = [];
  const ativos = itens.filter((item) => item && item.status !== ITEM_STATUS.CANCELADO);
  if (!ativos.length) bloqueios.push('A operação não tem animais.');
  if (header.quantidade_prevista && header.quantidade_prevista !== ativos.length) {
    avisos.push(`Quantidade prevista ${header.quantidade_prevista}, conferida ${ativos.length}.`);
  }
  const porAnimal = new Map();
  const porIdentificacao = new Map();
  for (const item of ativos) {
    if (item.animal_id) porAnimal.set(item.animal_id, (porAnimal.get(item.animal_id) || 0) + 1);
    const dados = item.dados || item;
    if (!item.animal_id && dados.numero_animal) {
      const chave = `${String(dados.numero_animal).trim().toUpperCase()}|${dados.marca_id || ''}`;
      porIdentificacao.set(chave, (porIdentificacao.get(chave) || 0) + 1);
    }
  }
  for (const [animalId, n] of porAnimal) if (n > 1) bloqueios.push(`Animal repetido na operação (${animalId}).`);
  for (const [chave, n] of porIdentificacao) if (n > 1) bloqueios.push(`Identificação repetida na operação: ${chave.split('|')[0]}.`);
  if (header.tipo === OPERACAO_TIPOS.ENTRADA) {
    const semIdentificacao = ativos.filter((item) => !item.animal_id && !(item.dados || item).numero_animal).length;
    if (semIdentificacao) avisos.push(`${semIdentificacao} animal(is) sem identificação: ficam pendentes de identificação.`);
    const semPeso = ativos.filter((item) => (item.peso_kg ?? null) === null).length;
    if (semPeso) avisos.push(`${semPeso} animal(is) sem peso: ficam pendentes de pesagem (nenhum peso é inventado).`);
  }
  return { ok: !bloqueios.length, bloqueios, avisos, quantidade: ativos.length };
}

/** Resumo do cabeçalho: quantidade, pesos medidos/informados, valores. Nada é estimado. */
export function summarizeOperation(header, itens = []) {
  const ativos = itens.filter((item) => item && item.status !== ITEM_STATUS.CANCELADO);
  const pesados = ativos.filter((item) => Number(item.peso_kg) > 0);
  const pesoTotal = pesados.reduce((acc, item) => acc + Number(item.peso_kg), 0);
  const valoresItens = ativos.filter((item) => item.valor !== null && item.valor !== undefined);
  const valorItens = valoresItens.reduce((acc, item) => acc + Number(item.valor), 0);
  const valorTotal = header.valor_total ?? (valoresItens.length ? Math.round(valorItens * 100) / 100 : null);
  return {
    quantidade: ativos.length,
    quantidade_prevista: header.quantidade_prevista ?? null,
    pesados: pesados.length,
    sem_peso: ativos.length - pesados.length,
    peso_total_kg: pesados.length ? pesoTotal : null,
    peso_medio_kg: pesados.length ? Math.round((pesoTotal / pesados.length) * 10) / 10 : null,
    valor_total: valorTotal,
    valor_por_cabeca: valorTotal !== null && ativos.length ? Math.round((valorTotal / ativos.length) * 100) / 100 : null,
    frete: header.frete ?? null,
  };
}
