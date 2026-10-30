// Persistência do perfil do animal (F04/F05), do estoque de identificadores (F06) e do dossiê de
// rastreabilidade (F15). Toda correção grava auditoria com antes/depois; nada é apagado.
import storage from '../../../storage/storageAdapter.js';
import { auditRow } from '../../weighing/infrastructure/weighingDataAdapter.js';
import { naturezaDe } from '../domain/movementNature.js';
import { AGE_POLICY_DEFAULTS, normalizeAgePolicy } from '../domain/ageModel.js';
import {
  IdentifierError,
  TIPOS_OFICIAIS,
  assertCode,
  assertTransition,
  currentSituation,
  expandRange,
  normalizeCode,
} from '../domain/identifierStock.js';

const active = (row) => row && !row.deleted_at;
const strip = ({ localId: _l, ...rest }) => rest;
export const AGE_POLICY_KEY = 'age-policy:local';

async function readyDb(acao) {
  if (acao) storage.assertWritable(acao);
  return storage.ensureReady();
}

async function animalOrFail(db, animalId) {
  const animal = (await db.table('animais').where('id').equals(String(animalId || '')).toArray()).find(active);
  if (!animal) throw new IdentifierError('ANIMAL_NAO_ENCONTRADO', 'Animal não encontrado.');
  return animal;
}

// ---------------------------------------------------------------------------
// Política de idade (chave própria, aditiva: não duplica as cinco chaves existentes)
// ---------------------------------------------------------------------------

export async function getAgePolicy() {
  const stored = await storage.settings.get(AGE_POLICY_KEY);
  try {
    return normalizeAgePolicy(stored && typeof stored === 'object' ? stored : AGE_POLICY_DEFAULTS);
  } catch {
    return normalizeAgePolicy(AGE_POLICY_DEFAULTS);
  }
}

export async function saveAgePolicy(raw) {
  const db = await readyDb('Política de idade');
  const before = await getAgePolicy();
  const next = normalizeAgePolicy(raw);
  await storage.settings.set(AGE_POLICY_KEY, { versao: 1, ...next });
  await db.table('auditoria').add(auditRow({ entidade: 'appSettings', entidade_id: AGE_POLICY_KEY, acao: 'ATUALIZAR', antes: before, depois: next, resumo: 'Parametrização de idade/era/categorias alterada.', created_at: new Date().toISOString() }));
  return next;
}

// ---------------------------------------------------------------------------
// Nascimento, categoria produtiva (correção auditada)
// ---------------------------------------------------------------------------

export async function updateBirth(animalId, birth) {
  const db = await readyDb('Nascimento do animal');
  const ts = new Date().toISOString();
  let updated = null;
  await db.transaction('rw', db.table('animais'), db.table('auditoria'), async () => {
    const animal = await animalOrFail(db, animalId);
    const antes = { nascimento_data: animal.nascimento_data ?? null, nascimento_precisao: animal.nascimento_precisao ?? null, nascimento_fonte: animal.nascimento_fonte ?? null, idade_declarada_meses: animal.idade_declarada_meses ?? null, idade_referencia_data: animal.idade_referencia_data ?? null };
    const changes = {
      ...birth,
      // Campos legados da 1.x mantidos coerentes (data e flag de estimativa), sem inventar dia.
      nascimento: birth.nascimento_precisao === 'DIA' || birth.nascimento_precisao === 'MES' ? birth.nascimento_data : null,
      nascimento_estimado: birth.nascimento_precisao !== 'DIA',
      updated_at: ts,
    };
    await db.table('animais').update(animal.localId, changes);
    await db.table('auditoria').add(auditRow({ entidade: 'animais', entidade_id: animal.id, acao: 'CORRIGIR', antes, depois: birth, campos_alterados: Object.keys(birth), resumo: 'Nascimento/idade corrigido na ficha', created_at: ts }));
    updated = { ...strip(animal), ...changes };
  });
  return updated;
}

export async function setProductiveCategory(animalId, categoria) {
  const db = await readyDb('Categoria produtiva');
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table('animais'), db.table('auditoria'), async () => {
    const animal = await animalOrFail(db, animalId);
    await db.table('animais').update(animal.localId, { categoria_produtiva: categoria, updated_at: ts });
    await db.table('auditoria').add(auditRow({ entidade: 'animais', entidade_id: animal.id, acao: 'CORRIGIR', antes: { categoria_produtiva: animal.categoria_produtiva ?? null }, depois: { categoria_produtiva: categoria }, campos_alterados: ['categoria_produtiva'], created_at: ts }));
  });
  return true;
}

// ---------------------------------------------------------------------------
// Dentição observada
// ---------------------------------------------------------------------------

export async function addDentition(animalId, avaliacao) {
  const db = await readyDb('Avaliação de dentição');
  const ts = new Date().toISOString();
  const row = { id: crypto.randomUUID(), animal_id: null, ...avaliacao, origem: 'OBSERVADA', created_at: ts, updated_at: ts, deleted_at: null };
  await db.transaction('rw', db.table('animais'), db.table('avaliacoesDenticao'), db.table('auditoria'), async () => {
    const animal = await animalOrFail(db, animalId);
    row.animal_id = animal.id;
    if (animal.nascimento_data && animal.nascimento_precisao === 'DIA' && avaliacao.data < animal.nascimento_data) {
      throw new IdentifierError('DENTICAO_INVALIDA', 'A avaliação não pode ser anterior ao nascimento.');
    }
    await db.table('avaliacoesDenticao').add(row);
    await db.table('auditoria').add(auditRow({ entidade: 'avaliacoesDenticao', entidade_id: row.id, acao: 'CRIAR', depois: row, created_at: ts }));
  });
  return strip(row);
}

export async function cancelDentition(id, { motivo }) {
  const db = await readyDb('Cancelar avaliação de dentição');
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table('avaliacoesDenticao'), db.table('auditoria'), async () => {
    const row = (await db.table('avaliacoesDenticao').where('id').equals(id).toArray()).find(active);
    if (!row) throw new IdentifierError('DENTICAO_INVALIDA', 'Avaliação não encontrada.');
    await db.table('avaliacoesDenticao').update(row.localId, { deleted_at: ts, updated_at: ts, motivo_cancelamento: motivo });
    await db.table('auditoria').add(auditRow({ entidade: 'avaliacoesDenticao', entidade_id: id, acao: 'CANCELAR', antes: row, motivo, created_at: ts }));
  });
  return true;
}

export async function listDentitions(animalId) {
  const db = await readyDb();
  return (await db.table('avaliacoesDenticao').where('animal_id').equals(animalId).toArray()).filter(active).map(strip)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

// ---------------------------------------------------------------------------
// Estoque de identificadores (livro movimentosIdentificadores)
// ---------------------------------------------------------------------------

async function historyOf(db, tipo, valor) {
  return (await db.table('movimentosIdentificadores').where('[tipo+valor_normalizado]').equals([tipo, valor]).toArray()).filter(active);
}

function movement(fields, ts) {
  return { id: crypto.randomUUID(), empresa_id: 'local', faixa_id: null, animal_id: null, observacao: null, ...fields, created_at: ts, updated_at: ts, deleted_at: null };
}

/** Recebimento por faixa (ou lista): uma movimentação RECEBIDO por código; repetido aborta tudo. */
export async function receiveIdentifiers({ tipo, codigos, data, fornecedor = null, descricao = null, faixa = null }) {
  const db = await readyDb('Recebimento de identificadores');
  const ts = new Date().toISOString();
  const lote = { id: crypto.randomUUID(), empresa_id: 'local', tipo, marca_id: null, descricao, fornecedor, data, prefixo: faixa?.prefixo || null, inicio: faixa?.inicio ?? null, fim: faixa?.fim ?? null, quantidade: codigos.length, situacao: 'ATIVA', ativo: true, origem: 'RECEBIMENTO', created_at: ts, updated_at: ts, deleted_at: null };
  await db.transaction('rw', db.table('movimentosIdentificadores'), db.table('faixasIdentificadores'), db.table('auditoria'), async () => {
    const rows = [];
    const vistos = new Set();
    for (const codigo of codigos) {
      const { valor_normalizado: valor } = assertCode(tipo, codigo);
      if (vistos.has(valor)) throw new IdentifierError('IDENTIFICADOR_REPETIDO', `Código ${valor} repetido no recebimento.`);
      vistos.add(valor);
      if ((await historyOf(db, tipo, valor)).length) throw new IdentifierError('IDENTIFICADOR_REPETIDO', `Código ${valor} já está no estoque (${tipo}).`);
      rows.push(movement({ tipo, valor, valor_normalizado: valor, acao: 'RECEBIDO', data, faixa_id: lote.id }, ts));
    }
    await db.table('faixasIdentificadores').add(lote);
    await db.table('movimentosIdentificadores').bulkAdd(rows);
    await db.table('auditoria').add(auditRow({ entidade: 'faixasIdentificadores', entidade_id: lote.id, acao: 'CRIAR', resumo: `Recebidos ${rows.length} identificadores ${tipo}`, created_at: ts }));
  });
  return { faixa_id: lote.id, quantidade: codigos.length };
}

/** Ação de estoque sem animal (reservar, liberar, perder, danificar, devolver, bloquear). */
export async function stockAction({ tipo, valor, acao, data, observacao = null }) {
  const db = await readyDb('Movimentação de identificador');
  const ts = new Date().toISOString();
  const { valor_normalizado: v } = assertCode(tipo, valor);
  await db.transaction('rw', db.table('movimentosIdentificadores'), db.table('animalIdentificadores'), db.table('auditoria'), async () => {
    const historico = await historyOf(db, tipo, v);
    const atual = currentSituation(historico);
    assertTransition(tipo, atual.situacao, acao, historico);
    await db.table('movimentosIdentificadores').add(movement({ tipo, valor: v, valor_normalizado: v, acao, data, observacao, animal_id: atual.animal_id, faixa_id: atual.ultimo?.faixa_id || null }, ts));
    // Perdido/danificado com o animal: o identificador do animal fecha na data (histórico preservado).
    if (atual.situacao === 'APLICADO' && atual.animal_id) await closeAnimalIdentifier(db, atual.animal_id, tipo, v, data, acao, ts);
    await db.table('auditoria').add(auditRow({ entidade: 'movimentosIdentificadores', entidade_id: `${tipo}:${v}`, acao, resumo: observacao || null, created_at: ts }));
  });
  return true;
}

async function closeAnimalIdentifier(db, animalId, tipo, valor, data, motivo, ts) {
  const rows = (await db.table('animalIdentificadores').where('animal_id').equals(animalId).toArray())
    .filter((row) => active(row) && row.ativo !== false && row.tipo === tipo && row.valor_normalizado === valor);
  for (const row of rows) await db.table('animalIdentificadores').update(row.localId, { fim: data, ativo: false, motivo_troca: motivo, updated_at: ts });
}

async function applyInTransaction(db, { animal, tipo, valor, data, ts, observacao }) {
  const historico = await historyOf(db, tipo, valor);
  const atual = currentSituation(historico);
  let situacao = atual.situacao;
  if (situacao === null) {
    // Código oficial só sai do estoque recebido; brinco visual comprado avulso entra recebido + aplicado.
    if (TIPOS_OFICIAIS.includes(tipo)) throw new IdentifierError('IDENTIFICADOR_SITUACAO', `O código ${valor} não foi recebido no estoque.`);
    await db.table('movimentosIdentificadores').add(movement({ tipo, valor, valor_normalizado: valor, acao: 'RECEBIDO', data, observacao: 'Aplicado sem recebimento prévio' }, ts));
    situacao = 'DISPONIVEL';
  }
  assertTransition(tipo, situacao, 'APLICADO', historico);
  const emUso = (await db.table('animalIdentificadores').where('[tipo+valor_normalizado]').equals([tipo, valor]).toArray())
    .filter((row) => active(row) && row.ativo !== false && row.animal_id !== animal.id);
  if (emUso.length) throw new IdentifierError('IDENTIFICADOR_EM_USO', `O código ${valor} já está em outro animal.`);
  await db.table('movimentosIdentificadores').add(movement({ tipo, valor, valor_normalizado: valor, acao: 'APLICADO', data, animal_id: animal.id, observacao, faixa_id: atual.ultimo?.faixa_id || null }, ts));
  await db.table('animalIdentificadores').add({
    id: crypto.randomUUID(), animal_id: animal.id, tipo, valor, valor_normalizado: valor, marca_id: null, marca: null,
    faixa_id: atual.ultimo?.faixa_id || null, inicio: data, fim: null, motivo_troca: null, principal: false, ativo: true,
    created_at: ts, updated_at: ts, deleted_at: null,
  });
}

/** Aplica um código no animal (saldo muda exatamente uma vez; concorrência serializada pela transação). */
export async function applyIdentifier({ animalId, tipo, valor, data, observacao = null }) {
  const db = await readyDb('Aplicação de identificador');
  const ts = new Date().toISOString();
  const { valor_normalizado: v } = assertCode(tipo, valor);
  await db.transaction('rw', db.table('animais'), db.table('movimentosIdentificadores'), db.table('animalIdentificadores'), db.table('auditoria'), async () => {
    const animal = await animalOrFail(db, animalId);
    const temMesmoTipo = (await db.table('animalIdentificadores').where('animal_id').equals(animal.id).toArray())
      .some((row) => active(row) && row.ativo !== false && row.tipo === tipo && TIPOS_UNICOS_POR_ANIMAL.has(tipo));
    if (temMesmoTipo) throw new IdentifierError('IDENTIFICADOR_DUPLO', `O animal já tem um ${tipo} ativo; use "Substituir".`);
    await applyInTransaction(db, { animal, tipo, valor: v, data, ts, observacao });
    await db.table('auditoria').add(auditRow({ entidade: 'animalIdentificadores', entidade_id: animal.id, acao: 'APLICAR', resumo: `${tipo} ${v}`, created_at: ts }));
  });
  return true;
}
const TIPOS_UNICOS_POR_ANIMAL = new Set(['SISBOV', 'RFID']);

/** Troca: o código antigo sai (perdido/danificado/retirado) e o novo entra, no mesmo animal (histórico conservado). */
export async function substituteIdentifier({ animalId, tipo, antigo, novo, motivo, data }) {
  const db = await readyDb('Substituição de identificador');
  const ts = new Date().toISOString();
  const { valor_normalizado: velho } = assertCode(tipo, antigo);
  const { valor_normalizado: v } = assertCode(tipo, novo);
  if (!['PERDIDO', 'DANIFICADO', 'REMOVIDO'].includes(motivo)) throw new IdentifierError('IDENTIFICADOR_ACAO', 'Motivo da troca: perdido, danificado ou retirado.');
  await db.transaction('rw', db.table('animais'), db.table('movimentosIdentificadores'), db.table('animalIdentificadores'), db.table('auditoria'), async () => {
    const animal = await animalOrFail(db, animalId);
    const atualDoAnimal = (await db.table('animalIdentificadores').where('animal_id').equals(animal.id).toArray())
      .find((row) => active(row) && row.ativo !== false && row.tipo === tipo && row.valor_normalizado === velho);
    if (!atualDoAnimal) throw new IdentifierError('IDENTIFICADOR_SITUACAO', `O animal não tem o ${tipo} ${velho} ativo.`);
    const historicoVelho = await historyOf(db, tipo, velho);
    if (historicoVelho.length) {
      assertTransition(tipo, currentSituation(historicoVelho).situacao, motivo, historicoVelho);
      await db.table('movimentosIdentificadores').add(movement({ tipo, valor: velho, valor_normalizado: velho, acao: motivo, data, animal_id: animal.id }, ts));
    }
    await db.table('animalIdentificadores').update(atualDoAnimal.localId, { fim: data, ativo: false, motivo_troca: motivo, substituido_por: v, updated_at: ts });
    await applyInTransaction(db, { animal, tipo, valor: v, data, ts, observacao: `Substitui ${velho}` });
    await db.table('auditoria').add(auditRow({ entidade: 'animalIdentificadores', entidade_id: animal.id, acao: 'SUBSTITUIR', resumo: `${tipo} ${velho} → ${v} (${motivo})`, created_at: ts }));
  });
  return true;
}

/** Códigos com situação atual (derivada do livro). */
export async function listStock({ tipo = null } = {}) {
  const db = await readyDb();
  const rows = (tipo ? await db.table('movimentosIdentificadores').where('tipo').equals(tipo).toArray() : await db.table('movimentosIdentificadores').toArray()).filter(active);
  const porCodigo = new Map();
  for (const row of rows) {
    const key = `${row.tipo}|${row.valor_normalizado}`;
    const list = porCodigo.get(key) || [];
    list.push(row);
    porCodigo.set(key, list);
  }
  const animais = new Map((await db.table('animais').toArray()).filter(active).map((a) => [a.id, a]));
  return [...porCodigo.values()].map((historico) => {
    const atual = currentSituation(historico);
    const primeiro = historico[0];
    const animal = atual.animal_id ? animais.get(atual.animal_id) : null;
    return {
      tipo: primeiro.tipo,
      valor_normalizado: primeiro.valor_normalizado,
      situacao: atual.situacao,
      animal_id: atual.animal_id,
      animal_numero: animal?.numero_animal || null,
      faixa_id: historico.find((m) => m.acao === 'RECEBIDO')?.faixa_id || null,
      ultima_data: atual.ultimo?.data || null,
      ultima_acao: atual.ultimo?.acao || null,
      movimentos: historico.length,
    };
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.valor_normalizado.localeCompare(b.valor_normalizado, 'pt-BR', { numeric: true }));
}

export async function identifierHistory(tipo, valor) {
  const db = await readyDb();
  return (await historyOf(db, String(tipo).toUpperCase(), normalizeCode(valor))).map(strip)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.created_at).localeCompare(String(b.created_at)));
}

export { expandRange };

// ---------------------------------------------------------------------------
// Dossiê de rastreabilidade interna (F15)
// ---------------------------------------------------------------------------

export async function loadTraceabilitySources(animalId) {
  const db = await readyDb();
  const animal = (await db.table('animais').where('id').equals(String(animalId)).toArray()).find(active) || null;
  if (!animal) return null;
  const byAnimal = async (store) => (await db.table(store).where('animal_id').equals(animal.id).toArray()).map(strip);
  const [identificadores, movimentos, lotes, pesagens, aplicacoes, denticoes, itens] = await Promise.all([
    byAnimal('animalIdentificadores'), byAnimal('movimentosAnimais'), byAnimal('animalLotes'), byAnimal('pesagens'),
    byAnimal('aplicacoesSanidade'), byAnimal('avaliacoesDenticao'), byAnimal('operacaoItens'),
  ]);
  const opIds = [...new Set(itens.map((i) => i.operacao_id).concat(movimentos.map((m) => m.operacao_id)).filter(Boolean))];
  const operacoes = opIds.length ? (await db.table('operacoes').where('id').anyOf(opIds).toArray()).map(strip) : [];
  const medIds = [...new Set(aplicacoes.map((a) => a.medicamento_id).filter(Boolean))];
  const medicamentos = medIds.length ? (await db.table('medicamentos').where('id').anyOf(medIds).toArray()).map(strip) : [];
  const nomes = async (store, campo = 'nome') => new Map((await db.table(store).toArray()).map((r) => [r.id, r[campo] || r.nome]));
  const [propriedades, parceiros, lotesNomes, marcas] = await Promise.all([nomes('propriedades'), nomes('parceiros'), nomes('loteApartacoes', 'nome_lote'), nomes('marcas')]);
  const mae = animal.mae_animal_id ? (await db.table('animais').where('id').equals(animal.mae_animal_id).toArray()).find(active) || null : null;
  return {
    animal: strip(animal),
    mae: mae ? { id: mae.id, numero_animal: mae.numero_animal } : null,
    identificadores, lotes: lotes.filter(active), pesagens: pesagens.filter(active),
    movimentos: movimentos.filter(active).map((m) => ({ ...m, natureza: naturezaDe(m) })),
    aplicacoes, denticoes: denticoes.filter(active), itens: itens.filter(active), operacoes, medicamentos,
    nomes: { propriedades, parceiros, lotes: lotesNomes, marcas },
  };
}
