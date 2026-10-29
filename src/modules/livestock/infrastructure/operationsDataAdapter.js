// Persistência das operações de rebanho (F01–F03) — Dexie v9 (`operacoes`, `operacaoItens`, `movimentosAnimais`).
//
// Confirmar e cancelar rodam numa ÚNICA transação sobre todas as stores: as pesagens geradas (Cadastro com peso,
// Saída) passam pelo mesmo createEntry/bulkDeleteEntries do Lançamento — cujas transações o Dexie aninha nesta —
// e herdam linha do tempo (P05/P07), movimentos derivados (P04/P09), lotes (P13), derivados (P08) e estado.
// Se qualquer animal falhar, nada da operação fica gravado.
//
// Efeito no livro por item confirmado (exatamente um):
//   ENTRADA       → movimento ENTRADA da operação (Compra, Nascimento…) sem pesagem; com peso, o Cadastro gerado
//                   ADOTA esse movimento (weighingDataAdapter.reconcileWeighingMovements) — saldo +1, nunca +2.
//   SAÍDA         → pesagem de Saída (motivo do subtipo) com operacao_id; o movimento SAIDA deriva dela.
//   MOVIMENTAÇÃO  → movimento INTERNO da operação (lote/propriedade), sem pesagem; não muda o saldo.
import storage from '../../../storage/storageAdapter.js';
import { auditRow, newAnimal, newVisualIdentifier, reconcileAnimalAfterChange, removeOrphanAnimal } from '../../weighing/infrastructure/weighingDataAdapter.js';
import * as weighingAdapter from '../../weighing/infrastructure/weighingDataAdapter.js';
import { uiToStorageRecord } from '../../weighing/domain/weighingMapper.js';
import {
  ITEM_STATUS,
  MOTIVO_SAIDA_POR_SUBTIPO,
  OPERACAO_STATUS,
  OPERACAO_TIPOS,
  OperationError,
  SUBTIPO_LABELS,
  TIPO_MOVIMENTO_ENTRADA,
  TIPO_MOVIMENTO_INTERNO,
  checkConference,
} from '../domain/operationRules.js';

export const DEFAULT_EMPRESA_ID = 'local';
const SAIDA_DEFINITIVA = new Set(['VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO']);
const normalized = (value) => String(value || '').trim().toUpperCase();
const active = (row) => row && !row.deleted_at;

async function readyDb(acao) {
  if (acao) storage.assertWritable(acao);
  return storage.ensureReady();
}

async function byId(db, store, id) {
  if (!id) return null;
  return (await db.table(store).where('id').equals(String(id)).toArray()).find(active) || null;
}

async function itensDa(db, operacaoId) {
  return (await db.table('operacaoItens').where('operacao_id').equals(operacaoId).toArray()).filter(active);
}

function fail(code, message, extra = {}) {
  throw new OperationError(code, message, extra);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Operações (sem itens) com contagem; filtros por tipo, status e período (data civil). */
export async function listOperations({ tipo = null, status = null, from = null, to = null, includeLegacy = true } = {}) {
  const db = await readyDb();
  let rows = tipo
    ? await db.table('operacoes').where('tipo').equals(tipo).toArray()
    : await db.table('operacoes').toArray();
  rows = rows.filter(active)
    .filter((row) => !status || row.status === status)
    .filter((row) => (!from || String(row.data) >= from) && (!to || String(row.data) <= to))
    .filter((row) => includeLegacy || row.origem !== 'LEGADO');
  const itens = await db.table('operacaoItens').toArray();
  const contagem = new Map();
  for (const item of itens) {
    if (!active(item) || item.status === ITEM_STATUS.CANCELADO) continue;
    contagem.set(item.operacao_id, (contagem.get(item.operacao_id) || 0) + 1);
  }
  return rows
    .map((row) => strip({ ...row, quantidade: contagem.get(row.id) || 0 }))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.created_at).localeCompare(String(a.created_at)));
}

const strip = ({ localId: _localId, ...rest }) => rest;

export async function getOperation(id) {
  const db = await readyDb();
  const operacao = await byId(db, 'operacoes', id);
  if (!operacao) return null;
  const itens = await itensDa(db, operacao.id);
  // Pesagem cancelada fora da operação (Relação de Pesagens) aparece no item.
  const pesagensIds = itens.map((item) => item.pesagem_id).filter(Boolean);
  const pesagens = pesagensIds.length ? await db.table('pesagens').where('id').anyOf(pesagensIds).toArray() : [];
  const pesagemAtiva = new Set(pesagens.filter(active).map((row) => row.id));
  return {
    operacao: strip(operacao),
    itens: itens.map((item) => strip({ ...item, pesagem_cancelada: Boolean(item.pesagem_id) && !pesagemAtiva.has(item.pesagem_id) })),
  };
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

/**
 * Cria ou substitui o rascunho (cabeçalho + itens). Itens já validados pelo domínio.
 * Operação confirmada/cancelada não volta a rascunho.
 */
export async function saveDraft({ id = null, header, itens, empresaId = DEFAULT_EMPRESA_ID }) {
  const db = await readyDb('Rascunho de operação');
  const ts = new Date().toISOString();
  let operacaoId = id;
  await db.transaction('rw', db.table('operacoes'), db.table('operacaoItens'), db.table('auditoria'), async () => {
    if (operacaoId) {
      const atual = await byId(db, 'operacoes', operacaoId);
      if (!atual) fail('OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada.');
      if (atual.status !== OPERACAO_STATUS.RASCUNHO) fail('OPERACAO_NAO_EDITAVEL', 'Só rascunho pode ser editado; a operação confirmada se corrige cancelando e lançando de novo.');
      if (atual.tipo !== header.tipo) fail('OPERACAO_INVALIDA', 'O tipo da operação não muda depois de criada.');
      await db.table('operacoes').update(atual.localId, { ...header, updated_at: ts });
      for (const item of await itensDa(db, operacaoId)) {
        await db.table('operacaoItens').update(item.localId, { deleted_at: ts, updated_at: ts });
      }
    } else {
      operacaoId = crypto.randomUUID();
      await db.table('operacoes').add({
        id: operacaoId, empresa_id: empresaId, ...header, status: OPERACAO_STATUS.RASCUNHO, origem: 'OPERACAO',
        documento_situacao: header.gta_numero || header.nf_numero ? 'INFORMADO' : 'SEM_DOCUMENTO',
        created_at: ts, updated_at: ts, deleted_at: null,
      });
      await db.table('auditoria').add(auditRow({ entidade: 'operacoes', entidade_id: operacaoId, acao: 'CRIAR', resumo: `${SUBTIPO_LABELS[header.subtipo]} em ${header.data} (rascunho)`, created_at: ts }));
    }
    const rows = itens.map((item) => ({
      id: crypto.randomUUID(),
      operacao_id: operacaoId,
      animal_id: item.animal_id || null,
      status: ITEM_STATUS.RASCUNHO,
      dados: item.animal_id ? { lote_id: item.lote_id ?? null } : {
        numero_animal: item.numero_animal, marca_id: item.marca_id, sexo: item.sexo, raca_id: item.raca_id,
        mae_animal_id: item.mae_animal_id, lote_id: item.lote_id,
      },
      peso_kg: item.peso_kg ?? null,
      peso_origem: item.peso_origem ?? null,
      valor: item.valor ?? null,
      causa_morte_id: item.causa_morte_id ?? null,
      observacao: item.observacao ?? null,
      pesagem_id: null,
      origem_pesagem_id: null,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    }));
    if (rows.length) await db.table('operacaoItens').bulkAdd(rows);
    const operacao = await byId(db, 'operacoes', operacaoId);
    await db.table('operacoes').update(operacao.localId, {
      documento_situacao: operacao.gta_numero || operacao.nf_numero ? 'INFORMADO' : 'SEM_DOCUMENTO',
    });
  });
  return getOperation(operacaoId);
}

export async function discardDraft(id) {
  const db = await readyDb('Descartar rascunho');
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table('operacoes'), db.table('operacaoItens'), db.table('auditoria'), async () => {
    const atual = await byId(db, 'operacoes', id);
    if (!atual) fail('OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada.');
    if (atual.status !== OPERACAO_STATUS.RASCUNHO) fail('OPERACAO_NAO_EDITAVEL', 'Só rascunho pode ser descartado; operação confirmada se cancela com motivo.');
    await db.table('operacoes').update(atual.localId, { deleted_at: ts, updated_at: ts });
    for (const item of await itensDa(db, id)) await db.table('operacaoItens').update(item.localId, { deleted_at: ts, updated_at: ts });
    await db.table('auditoria').add(auditRow({ entidade: 'operacoes', entidade_id: id, acao: 'EXCLUIR', antes: atual, motivo: 'Rascunho descartado', created_at: ts }));
  });
  return true;
}

// ---------------------------------------------------------------------------
// Situação do animal na data (linha do tempo do livro)
// ---------------------------------------------------------------------------

async function movimentosDo(db, animalId) {
  return (await db.table('movimentosAnimais').where('animal_id').equals(animalId).toArray()).filter(active);
}

/** Lote do animal numa data (permanências em animalLotes). */
async function loteNaData(db, animalId, data) {
  const stays = (await db.table('animalLotes').where('animal_id').equals(animalId).toArray())
    .filter((row) => active(row) && String(row.inicio || '') <= data && (!row.fim || String(row.fim) > data))
    .sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
  return stays[0]?.lote_id || null;
}

async function assertNoRebanhoNaData(db, animal, data, rotulo) {
  if (!animal || animal.deleted_at) fail('ANIMAL_NAO_ENCONTRADO', `${rotulo}: animal não encontrado.`);
  const pesagens = (await db.table('pesagens').where('animal_id').equals(animal.id).toArray()).filter(active);
  const movimentos = await movimentosDo(db, animal.id);
  const entradas = [
    ...pesagens.filter((row) => (row.legacy_payload?.tipo_manejo ?? row.tipo_pesagem) === 'Cadastro').map((row) => row.data_pesagem),
    ...movimentos.filter((row) => row.natureza === 'ENTRADA').map((row) => row.data_evento),
  ].filter(Boolean).sort();
  if (entradas.length && entradas[0] > data) fail('OPERACAO_CRONOLOGIA', `${rotulo}: a data ${data} é anterior à entrada do animal (${entradas[0]}).`);
  const saidas = pesagens.filter((row) => (row.legacy_payload?.tipo_manejo ?? row.tipo_pesagem) === 'Saída').map((row) => row.data_pesagem).sort();
  if (saidas.length && saidas[0] <= data) fail('OPERACAO_CRONOLOGIA', `${rotulo}: o animal já saiu do rebanho em ${saidas[0]}.`);
  if (SAIDA_DEFINITIVA.has(animal.situacao) && !saidas.length) fail('OPERACAO_CRONOLOGIA', `${rotulo}: o animal não está ativo (${animal.situacao}).`);
}

function rotuloAnimal(animal, posicao) {
  return animal?.numero_animal ? `Animal ${animal.numero_animal}` : `Animal ${posicao}`;
}

// ---------------------------------------------------------------------------
// Confirmação
// ---------------------------------------------------------------------------

/**
 * Confirma o rascunho: conferência (bloqueios sempre impedem; avisos exigem `aceitarAvisos`) e efeito único
 * por item no livro, tudo numa transação.
 */
export async function confirmOperation(id, { aceitarAvisos = false, operador = null } = {}) {
  const db = await readyDb('Confirmar operação');
  const ts = new Date().toISOString();
  let resultado = null;
  await db.transaction('rw', db.tables, async () => {
    const operacao = await byId(db, 'operacoes', id);
    if (!operacao) fail('OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada.');
    if (operacao.status !== OPERACAO_STATUS.RASCUNHO) fail('OPERACAO_NAO_EDITAVEL', 'A operação já foi confirmada ou cancelada.');
    const itens = await itensDa(db, operacao.id);
    const conferencia = checkConference(operacao, itens);
    if (!conferencia.ok) fail('OPERACAO_CONFERENCIA', conferencia.bloqueios[0], { conferencia });
    if (conferencia.avisos.length && !aceitarAvisos) fail('OPERACAO_AVISOS', 'Confira os avisos antes de confirmar.', { conferencia });
    const ctx = { db, operacao, ts, operador, parceiro: await byId(db, 'parceiros', operacao.parceiro_id) };
    let posicao = 0;
    for (const item of itens) {
      posicao += 1;
      if (operacao.tipo === OPERACAO_TIPOS.ENTRADA) await confirmarEntrada(ctx, item, posicao);
      else if (operacao.tipo === OPERACAO_TIPOS.SAIDA) await confirmarSaida(ctx, item, posicao);
      else await confirmarMovimentacao(ctx, item, posicao);
    }
    await db.table('operacoes').update(operacao.localId, { status: OPERACAO_STATUS.CONFIRMADA, confirmada_em: ts, updated_at: ts });
    await db.table('auditoria').add(auditRow({
      entidade: 'operacoes', entidade_id: operacao.id, acao: 'CONFIRMAR',
      resumo: `${SUBTIPO_LABELS[operacao.subtipo]} em ${operacao.data}: ${itens.length} animal(is)`,
      created_at: ts,
    }));
    resultado = { quantidade: itens.length, avisos: conferencia.avisos };
  });
  return { ...(await getOperation(id)), ...resultado };
}

async function nomeDe(db, store, id, campo = 'nome') {
  const row = await byId(db, store, id);
  return row ? row[campo] || null : null;
}

async function confirmarEntrada({ db, operacao, ts, operador }, item, posicao) {
  const dados = item.dados || {};
  const lote = dados.lote_id || operacao.lote_destino_id || null;
  if (lote && !(await byId(db, 'loteApartacoes', lote))) fail('OPERACAO_INVALIDA', `Animal ${posicao}: lote de destino não encontrado.`);
  let animal;
  if (item.animal_id) {
    animal = await byId(db, 'animais', item.animal_id);
    if (!animal) fail('ANIMAL_NAO_ENCONTRADO', `Animal ${posicao}: animal não encontrado.`);
    const movimentos = await movimentosDo(db, animal.id);
    const pesagens = (await db.table('pesagens').where('animal_id').equals(animal.id).toArray()).filter(active);
    if (movimentos.some((row) => row.natureza === 'ENTRADA') || pesagens.length || SAIDA_DEFINITIVA.has(animal.situacao)) {
      fail('OPERACAO_INVALIDA', `${rotuloAnimal(animal, posicao)} já tem entrada no rebanho; use uma movimentação ou corrija o histórico.`);
    }
  } else {
    const numero = dados.numero_animal || null;
    const marca = dados.marca_id ? await byId(db, 'marcas', dados.marca_id) : null;
    if (dados.marca_id && !marca) fail('OPERACAO_INVALIDA', `Animal ${posicao}: marca não encontrada.`);
    const raca = dados.raca_id ? await byId(db, 'racas', dados.raca_id) : null;
    if (numero) {
      const colisoes = (await db.table('animais').where('identificacao_normalizada').equals(normalized(numero)).toArray())
        .filter((row) => active(row) && (row.marca_id || null) === (dados.marca_id || null) && !SAIDA_DEFINITIVA.has(row.situacao));
      if (colisoes.length) fail('IDENTIFICACAO_EM_USO', `A identificação ${numero}${marca ? ` (marca ${marca.nome})` : ''} já pertence a um animal ativo.`);
    }
    if (dados.mae_animal_id && !(await byId(db, 'animais', dados.mae_animal_id))) fail('OPERACAO_INVALIDA', `Animal ${posicao}: mãe não encontrada.`);
    const propriedadeId = operacao.propriedade_destino_id
      || (await db.table('propriedades').toArray()).find((row) => active(row) && row.padrao)?.id
      || null;
    const animalId = crypto.randomUUID();
    animal = {
      ...newAnimal({
        animalId,
        ui: { numero_animal: numero, sexo: dados.sexo, marca: marca?.nome || null, raca: raca?.nome || null, empresa_id: operacao.empresa_id },
        marcaId: marca?.id || null, racaId: raca?.id || null, propriedadeId, situacao: 'ATIVO', origem: SUBTIPO_LABELS[operacao.subtipo], ts,
      }),
      situacao_cadastro: !numero ? 'PENDENTE_IDENTIFICACAO' : (item.peso_kg ? 'OK' : 'PENDENTE_PESAGEM'),
      mae_animal_id: dados.mae_animal_id || null,
      operacao_entrada_id: operacao.id,
      ...(operacao.subtipo === 'NASCIMENTO'
        ? { nascimento: operacao.data, nascimento_data: operacao.data, nascimento_precisao: 'DIA', nascimento_fonte: 'OPERACAO_NASCIMENTO' }
        : {}),
    };
    await db.table('animais').add(animal);
    if (numero) await db.table('animalIdentificadores').add(newVisualIdentifier({ animalId, ui: { numero_animal: numero, marca: marca?.nome || null }, marcaId: marca?.id || null, inicio: operacao.data, ts }));
    await db.table('auditoria').add(auditRow({ entidade: 'animais', entidade_id: animalId, acao: 'CRIAR', resumo: `${SUBTIPO_LABELS[operacao.subtipo]} (operação)`, created_at: ts }));
  }
  const movimento = {
    id: crypto.randomUUID(), empresa_id: operacao.empresa_id, animal_id: animal.id, operacao_id: operacao.id, pesagem_id: null,
    tipo: TIPO_MOVIMENTO_ENTRADA[operacao.subtipo], natureza: 'ENTRADA', data_evento: operacao.data,
    lote_origem_id: null, lote_destino_id: lote,
    propriedade_origem_id: operacao.propriedade_origem_id || null, propriedade_destino_id: animal.propriedade_id || operacao.propriedade_destino_id || null,
    motivo: null, origem: 'operacao', created_at: ts, updated_at: ts, deleted_at: null,
  };
  await db.table('movimentosAnimais').add(movimento);
  let pesagemId = null;
  if (item.peso_kg) {
    // Cadastro com o peso medido/informado: adota o movimento acima (sem segunda entrada).
    const ui = {
      tipo_manejo: 'Cadastro', data_pesagem: operacao.data, peso: item.peso_kg, animal_id: animal.id,
      numero_animal: animal.numero_animal, marca: animal.marca, marca_id: animal.marca_id, sexo: animal.sexo,
      raca: animal.raca, raca_id: animal.raca_id, lote_id: lote, nome_lote: lote ? await nomeDe(db, 'loteApartacoes', lote, 'nome_lote') : null,
      operacao_id: operacao.id, peso_origem: item.peso_origem === 'BALANCA' ? 'BALANCA' : 'MANUAL', origem: 'operacao', operador,
      origem_animal: SUBTIPO_LABELS[operacao.subtipo], valor_pago_cabeca: item.valor ?? null,
      documentacao: [operacao.gta_numero && `GTA ${operacao.gta_numero}`, operacao.nf_numero && `NF ${operacao.nf_numero}`].filter(Boolean).join(' · ') || null,
      observacao: item.observacao || null,
    };
    const created = await weighingAdapter.createEntry(uiToStorageRecord(ui));
    pesagemId = created.id;
  } else {
    // Sem pesagem: lote (permanência) e estado do animal a partir do movimento.
    await reconcileAnimalAfterChange(db, animal.id, ts);
  }
  await db.table('operacaoItens').update(item.localId, { animal_id: animal.id, pesagem_id: pesagemId, status: ITEM_STATUS.CONFIRMADO, updated_at: ts });
}

async function confirmarSaida({ db, operacao, ts, operador, parceiro }, item, posicao) {
  const animal = await byId(db, 'animais', item.animal_id);
  const rotulo = rotuloAnimal(animal, posicao);
  await assertNoRebanhoNaData(db, animal, operacao.data, rotulo);
  const motivo = MOTIVO_SAIDA_POR_SUBTIPO[operacao.subtipo];
  const ui = {
    tipo_manejo: 'Saída', motivo_saida: motivo, data_pesagem: operacao.data, animal_id: animal.id,
    numero_animal: animal.numero_animal, marca: animal.marca, marca_id: animal.marca_id, sexo: animal.sexo, raca: animal.raca, raca_id: animal.raca_id,
    operacao_id: operacao.id, origem: 'operacao', operador,
    observacao: item.observacao || (operacao.subtipo === 'AJUSTE_SAIDA' ? operacao.observacao : null),
    documentacao: [operacao.gta_numero && `GTA ${operacao.gta_numero}`, operacao.nf_numero && `NF ${operacao.nf_numero}`].filter(Boolean).join(' · ') || null,
  };
  if (item.peso_kg) {
    ui.peso = item.peso_kg;
    ui.peso_origem = item.peso_origem === 'BALANCA' ? 'BALANCA' : 'MANUAL';
  }
  if (operacao.subtipo === 'VENDA') {
    ui.comprador = parceiro?.nome || null;
    if (item.valor !== null && item.valor !== undefined) ui.valor_venda_total = item.valor;
  }
  if (operacao.subtipo === 'ABATE') {
    ui.frigorifico = parceiro?.nome || null;
    if (item.valor !== null && item.valor !== undefined) ui.valor_total_abate = item.valor;
  }
  if (operacao.subtipo === 'MORTE' && item.causa_morte_id) {
    ui.causa_morte_id = item.causa_morte_id;
    ui.causa_morte = await nomeDe(db, 'causasMorte', item.causa_morte_id);
  }
  let created;
  try {
    created = await weighingAdapter.createEntry(uiToStorageRecord(ui));
  } catch (err) {
    fail(err.code || 'OPERACAO_SAIDA', `${rotulo}: ${err.message}`);
  }
  await db.table('operacaoItens').update(item.localId, { pesagem_id: created.id, status: ITEM_STATUS.CONFIRMADO, updated_at: ts });
}

async function confirmarMovimentacao({ db, operacao, ts }, item, posicao) {
  const animal = await byId(db, 'animais', item.animal_id);
  const rotulo = rotuloAnimal(animal, posicao);
  await assertNoRebanhoNaData(db, animal, operacao.data, rotulo);
  const loteDestino = operacao.lote_destino_id || null;
  if (loteDestino && !(await byId(db, 'loteApartacoes', loteDestino))) fail('OPERACAO_INVALIDA', 'Lote de destino não encontrado.');
  const loteOrigem = await loteNaData(db, animal.id, operacao.data);
  let propriedadeOrigem = null;
  let propriedadeDestino = null;
  if (operacao.subtipo === 'MUDANCA_LOTE') {
    if (loteOrigem && loteOrigem === loteDestino) fail('OPERACAO_INVALIDA', `${rotulo} já está nesse lote em ${operacao.data}.`);
  } else {
    propriedadeOrigem = animal.propriedade_id || null;
    propriedadeDestino = operacao.propriedade_destino_id;
    if (!(await byId(db, 'propriedades', propriedadeDestino))) fail('OPERACAO_INVALIDA', 'Propriedade de destino não encontrada.');
    if (propriedadeOrigem === propriedadeDestino) fail('OPERACAO_INVALIDA', `${rotulo} já está nessa propriedade.`);
  }
  await db.table('movimentosAnimais').add({
    id: crypto.randomUUID(), empresa_id: operacao.empresa_id, animal_id: animal.id, operacao_id: operacao.id, pesagem_id: null,
    tipo: TIPO_MOVIMENTO_INTERNO[operacao.subtipo], natureza: 'INTERNA', data_evento: operacao.data,
    lote_origem_id: loteDestino ? loteOrigem : null, lote_destino_id: loteDestino,
    propriedade_origem_id: propriedadeOrigem, propriedade_destino_id: propriedadeDestino,
    motivo: operacao.observacao || null, origem: 'operacao', created_at: ts, updated_at: ts, deleted_at: null,
  });
  if (propriedadeDestino) await db.table('animais').update(animal.localId, { propriedade_id: propriedadeDestino, updated_at: ts });
  // Permanências, movimentos derivados (sem segunda "Mudança de lote"), derivados e estado — retroativo ou não.
  await reconcileAnimalAfterChange(db, animal.id, ts);
  await db.table('operacaoItens').update(item.localId, { lote_origem_id: loteOrigem, status: ITEM_STATUS.CONFIRMADO, updated_at: ts });
}

// ---------------------------------------------------------------------------
// Cancelamento (fato não se apaga: deleted_at + auditoria + motivo)
// ---------------------------------------------------------------------------

export async function cancelOperation(id, { motivo }) {
  const db = await readyDb('Cancelar operação');
  const ts = new Date().toISOString();
  await db.transaction('rw', db.tables, async () => {
    const operacao = await byId(db, 'operacoes', id);
    if (!operacao) fail('OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada.');
    if (operacao.origem === 'LEGADO') fail('OPERACAO_LEGADA', 'Operação legada (gerada das pesagens antigas): corrija pela Relação de Pesagens.');
    if (operacao.status !== OPERACAO_STATUS.CONFIRMADA) fail('OPERACAO_NAO_EDITAVEL', 'Só operação confirmada pode ser cancelada (rascunho se descarta).');
    const itens = (await itensDa(db, operacao.id)).filter((item) => item.status === ITEM_STATUS.CONFIRMADO);
    let posicao = 0;
    for (const item of itens) {
      posicao += 1;
      const animal = await byId(db, 'animais', item.animal_id);
      const rotulo = rotuloAnimal(animal, posicao);
      if (operacao.tipo === OPERACAO_TIPOS.ENTRADA) {
        const outras = (await db.table('pesagens').where('animal_id').equals(item.animal_id).toArray())
          .filter((row) => active(row) && row.id !== item.pesagem_id);
        const outrosMovimentos = (await movimentosDo(db, item.animal_id)).filter((row) => row.operacao_id !== operacao.id && row.natureza === 'INTERNA');
        if (outras.length || outrosMovimentos.length) {
          fail('OPERACAO_CRONOLOGIA', `${rotulo} já tem pesagens ou movimentações depois da entrada; cancele-as antes de cancelar a entrada.`);
        }
      }
      await db.table('operacaoItens').update(item.localId, { status: ITEM_STATUS.CANCELADO, updated_at: ts });
      if (item.pesagem_id) {
        await weighingAdapter.bulkDeleteEntries([item.pesagem_id], { motivo: `Cancelamento da operação: ${motivo}` });
      }
      for (const movimento of (await movimentosDo(db, item.animal_id)).filter((row) => row.operacao_id === operacao.id && row.origem === 'operacao')) {
        await db.table('movimentosAnimais').update(movimento.localId, { deleted_at: ts, updated_at: ts });
        await db.table('auditoria').add(auditRow({ entidade: 'movimentosAnimais', entidade_id: movimento.id, acao: 'CANCELAR', antes: movimento, motivo: `Cancelamento da operação: ${motivo}`, created_at: ts }));
        if (movimento.propriedade_destino_id && movimento.natureza === 'INTERNA' && animal?.propriedade_id === movimento.propriedade_destino_id) {
          await db.table('animais').update(animal.localId, { propriedade_id: movimento.propriedade_origem_id || null, updated_at: ts });
        }
      }
      if (operacao.tipo === OPERACAO_TIPOS.ENTRADA && !(await removeOrphanAnimal(db, item.animal_id, ts))) {
        await reconcileAnimalAfterChange(db, item.animal_id, ts);
      } else if (operacao.tipo !== OPERACAO_TIPOS.ENTRADA) {
        await reconcileAnimalAfterChange(db, item.animal_id, ts);
      }
    }
    await db.table('operacoes').update(operacao.localId, { status: OPERACAO_STATUS.CANCELADA, cancelada_em: ts, motivo_cancelamento: motivo, updated_at: ts });
    await db.table('auditoria').add(auditRow({ entidade: 'operacoes', entidade_id: operacao.id, acao: 'CANCELAR', antes: operacao, motivo, created_at: ts }));
  });
  return getOperation(id);
}

// ---------------------------------------------------------------------------
// Inventário (F17): dados crus do livro para o domínio
// ---------------------------------------------------------------------------

export async function loadInventorySources() {
  const db = await readyDb();
  const [animais, movimentos, operacoes, animalLotes, pesagens] = await Promise.all([
    db.table('animais').toArray(),
    db.table('movimentosAnimais').toArray(),
    db.table('operacoes').toArray(),
    db.table('animalLotes').toArray(),
    db.table('pesagens').toArray(),
  ]);
  return {
    animais: animais.filter(active).map(strip),
    movimentos: movimentos.filter(active).map(strip),
    operacoes: operacoes.filter(active).map(strip),
    animalLotes: animalLotes.filter(active).map(strip),
    // Só o necessário para conferir animal sem movimento de entrada (dado antigo).
    cadastros: pesagens.filter((row) => active(row) && (row.legacy_payload?.tipo_manejo ?? row.tipo_pesagem) === 'Cadastro')
      .map((row) => ({ id: row.id, animal_id: row.animal_id, data_pesagem: row.data_pesagem })),
  };
}
