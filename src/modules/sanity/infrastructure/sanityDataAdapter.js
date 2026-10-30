// Persistência da sanidade mínima operacional (ADR-049) nas stores próprias da v8:
// `programasSanidade`, `medicamentos` (cadastros) e `aplicacoesSanidade` (fatos).
// Nunca em appSettings. Toda gravação respeita o bloqueio de migração (ADR-038),
// roda numa transação Dexie junto da linha de `auditoria` (ator da sessão, sem
// segredos) e nunca apaga fato histórico: aplicação só é cancelada.
// As funções *InTransaction são chamadas de dentro da transação do Lançamento
// (weighingDataAdapter.createEntry/bulkDeleteEntries), que inclui as stores de
// LAUNCH_SANITY_TABLES no seu escopo.
import storage from '../../../storage/storageAdapter.js';
import { withdrawalEnd } from '../domain/posology.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { normalizeName } from '../../../storage/indexedDb/normalize.js';
import { SANITY_APPLICATIONS_STORE } from '../../../storage/indexedDb/schema.js';
import {
  MOTIVO_PESAGEM_CANCELADA,
  PROGRAMA_TIPO_LABELS,
  SANITY_AUDIT_ACTIONS as ACOES,
  SanityError,
  buildApplicationRecord,
} from '../domain/sanityRules.js';

export const DEFAULT_EMPRESA_ID = 'local';
export const PROGRAMAS_STORE = 'programasSanidade';
export const MEDICAMENTOS_STORE = 'medicamentos';
export const APLICACOES_STORE = SANITY_APPLICATIONS_STORE;

// Stores que a transação da pesagem acrescenta quando o lançamento traz aplicações.
export const POSOLOGIAS_STORE = 'posologias';
export const LAUNCH_SANITY_TABLES = Object.freeze([APLICACOES_STORE, PROGRAMAS_STORE, MEDICAMENTOS_STORE, POSOLOGIAS_STORE]);

const REGISTRY = {
  [PROGRAMAS_STORE]: {
    singular: 'programa de sanidade', rotulo: 'Programa de sanidade', escrita: 'Gravação de programa de sanidade',
    criar: ACOES.CRIAR_PROGRAMA, editar: ACOES.EDITAR_PROGRAMA, inativar: ACOES.INATIVAR_PROGRAMA, reativar: ACOES.REATIVAR_PROGRAMA,
  },
  [MEDICAMENTOS_STORE]: {
    singular: 'medicamento', rotulo: 'Medicamento', escrita: 'Gravação de medicamento',
    criar: ACOES.CRIAR_MEDICAMENTO, editar: ACOES.EDITAR_MEDICAMENTO, inativar: ACOES.INATIVAR_MEDICAMENTO, reativar: ACOES.REATIVAR_MEDICAMENTO,
  },
};

const nowIso = () => new Date().toISOString();
const empresaDe = (row) => row?.empresa_id ?? row?.empresaId ?? DEFAULT_EMPRESA_ID;

/** Linha exposta ao serviço/UI: sem a chave técnica local do Dexie. */
function publicRow(row) {
  if (!row) return null;
  const { localId: _localId, ...rest } = row;
  return rest;
}

// Mesmo formato de weighingDataAdapter.auditRow: id + campos + ator da sessão
// (usuario_id/usuario_nome_snapshot; nulos em gates/migração).
function auditRecord(fields) {
  return { id: crypto.randomUUID(), ...fields, ...getActor() };
}

// Linha não excluída mais recente pelo id de domínio (o índice é único, mas um
// `.first()` cru não distingue linha excluída).
async function findRow(table, id) {
  if (!id) return null;
  const rows = (await table.where('id').equals(id).toArray()).filter((row) => !row.deleted_at);
  return rows.at(-1) || null;
}

function notFound(rotulo, id) {
  return new SanityError('SANITY_NOT_FOUND', `${rotulo} não encontrado(a).`, { id });
}

function invalid(message) {
  return new SanityError('SANITY_INVALID', message, { erros: [message] });
}

// Nome único entre os registros ATIVOS da empresa (comparação por nome_normalizado).
async function assertUniqueActiveName(table, { nomeNormalizado, empresaId, selfId, nome, singular }) {
  const same = await table.where('nome_normalizado').equals(nomeNormalizado).toArray();
  const conflict = same.find((row) => !row.deleted_at && row.ativo !== false && row.id !== selfId && empresaDe(row) === empresaId);
  if (conflict) {
    throw new SanityError('SANITY_DUPLICATE', `Já existe ${singular} ativo com o nome "${nome}".`, { campo: 'nome', valor: nome, id: conflict.id });
  }
}

// ---------------------------------------------------------------------------
// Cadastros (programas e medicamentos)
// ---------------------------------------------------------------------------

const byNome = (left, right) => String(left.nome_normalizado ?? '').localeCompare(String(right.nome_normalizado ?? ''), 'pt-BR');
const byOrdemNome = (left, right) => {
  const oa = Number.isFinite(left.ordem) ? left.ordem : Number.MAX_SAFE_INTEGER;
  const ob = Number.isFinite(right.ordem) ? right.ordem : Number.MAX_SAFE_INTEGER;
  return oa - ob || byNome(left, right);
};

export async function listRegistry(store, { includeInactive = false, empresaId = DEFAULT_EMPRESA_ID } = {}) {
  const db = await storage.ensureReady();
  const rows = (await db.table(store).where('empresa_id').equals(empresaId).toArray())
    .filter((row) => !row.deleted_at && (includeInactive || row.ativo !== false))
    .map(publicRow);
  return rows.sort(store === PROGRAMAS_STORE ? byOrdemNome : byNome);
}

function resumoCampos(store, record) {
  if (store === PROGRAMAS_STORE) return `${record.nome} (${PROGRAMA_TIPO_LABELS[record.tipo] || record.tipo})`;
  return record.nome;
}

/** Cria (sem id) ou edita (com id). `fields` já validados pelo domínio. */
export async function saveRegistry(store, { id = null, fields, empresaId = DEFAULT_EMPRESA_ID }) {
  const meta = REGISTRY[store];
  storage.assertWritable(meta.escrita);
  const db = await storage.ensureReady();
  const table = db.table(store);
  return db.transaction('rw', table, db.table('auditoria'), async () => {
    const ts = nowIso();
    const nomeNormalizado = normalizeName(fields.nome);
    if (!id) {
      await assertUniqueActiveName(table, { nomeNormalizado, empresaId, selfId: null, nome: fields.nome, singular: meta.singular });
      const record = { id: crypto.randomUUID(), empresa_id: empresaId, ...fields, nome_normalizado: nomeNormalizado, ativo: true, created_at: ts, updated_at: ts, deleted_at: null };
      // `add` escreve o localId gerado no próprio objeto: a cópia pública não o expõe.
      await table.add({ ...record });
      const campos = Object.keys(fields).filter((key) => fields[key] !== null && fields[key] !== undefined);
      await db.table('auditoria').add(auditRecord({
        entidade: store, entidade_id: record.id, acao: meta.criar,
        resumo: `Criou ${meta.singular} "${resumoCampos(store, record)}".`, campos_alterados: campos,
        depois: { ...record }, origem: 'cadastro', created_at: ts,
      }));
      return record;
    }
    const existing = await findRow(table, id);
    if (!existing) throw notFound(meta.rotulo, id);
    const empresa = empresaDe(existing);
    if (existing.ativo !== false) {
      await assertUniqueActiveName(table, { nomeNormalizado, empresaId: empresa, selfId: existing.id, nome: fields.nome, singular: meta.singular });
    }
    const changes = { ...fields, nome_normalizado: nomeNormalizado };
    const alterados = Object.keys(changes).filter((key) => JSON.stringify(changes[key] ?? null) !== JSON.stringify(existing[key] ?? null));
    if (!alterados.length) return publicRow(existing);
    const updated = { ...existing, ...changes, updated_at: ts };
    await table.update(existing.localId, { ...changes, updated_at: ts });
    const campos = alterados.filter((key) => key !== 'nome_normalizado');
    await db.table('auditoria').add(auditRecord({
      entidade: store, entidade_id: existing.id, acao: meta.editar,
      resumo: `Alterou ${meta.singular} "${updated.nome}": ${campos.join(', ')}.`, campos_alterados: campos,
      antes: publicRow(existing), depois: publicRow(updated), origem: 'cadastro', created_at: ts,
    }));
    return publicRow(updated);
  });
}

/** Inativa/reativa. Inativo continua válido nas aplicações já gravadas. */
export async function setRegistryActive(store, id, ativo) {
  const meta = REGISTRY[store];
  storage.assertWritable(meta.escrita);
  const db = await storage.ensureReady();
  const table = db.table(store);
  return db.transaction('rw', table, db.table('auditoria'), async () => {
    const existing = await findRow(table, id);
    if (!existing) throw notFound(meta.rotulo, id);
    if ((existing.ativo !== false) === ativo) return publicRow(existing);
    if (ativo) {
      await assertUniqueActiveName(table, { nomeNormalizado: existing.nome_normalizado, empresaId: empresaDe(existing), selfId: existing.id, nome: existing.nome, singular: meta.singular });
    }
    const ts = nowIso();
    await table.update(existing.localId, { ativo, updated_at: ts });
    await db.table('auditoria').add(auditRecord({
      entidade: store, entidade_id: existing.id, acao: ativo ? meta.reativar : meta.inativar,
      resumo: `${ativo ? 'Reativou' : 'Inativou'} ${meta.singular} "${existing.nome}".`, campos_alterados: ['ativo'],
      origem: 'cadastro', created_at: ts,
    }));
    return publicRow({ ...existing, ativo, updated_at: ts });
  });
}

// ---------------------------------------------------------------------------
// Aplicações
// ---------------------------------------------------------------------------

// Programa/medicamento precisam existir na empresa; INATIVO é recusado em aplicação
// nova (continua válido nas já gravadas). Lê dentro da transação corrente.
async function resolveReferences(db, input, empresaId) {
  const erros = [];
  let programa = null;
  let medicamento = null;
  if (input.programa_sanidade_id) {
    programa = await findRow(db.table(PROGRAMAS_STORE), input.programa_sanidade_id);
    if (!programa || empresaDe(programa) !== empresaId) erros.push('Programa de sanidade não encontrado.');
    else if (programa.ativo === false) erros.push(`Programa de sanidade "${programa.nome}" está inativo.`);
  }
  if (input.medicamento_id) {
    medicamento = await findRow(db.table(MEDICAMENTOS_STORE), input.medicamento_id);
    if (!medicamento || empresaDe(medicamento) !== empresaId) erros.push('Medicamento não encontrado.');
    else if (medicamento.ativo === false) erros.push(`Medicamento "${medicamento.nome}" está inativo.`);
  }
  let posologia = null;
  if (input.posologia_id) {
    posologia = await findRow(db.table(POSOLOGIAS_STORE), input.posologia_id);
    if (!posologia || posologia.medicamento_id !== input.medicamento_id) erros.push('Posologia não encontrada para este medicamento.');
    else if (posologia.status !== 'APROVADA') erros.push('A posologia não está aprovada: a dose não pode vir dela.');
  }
  if (erros.length) throw new SanityError('SANITY_INVALID', erros.join(' '), { erros });
  return { programa, medicamento, posologia, carencia: medicamento ? withdrawalEnd(input.data, { posologia, medicamento }) : null };
}

function applicationSummary(row) {
  const nomes = [row.programa_nome_snapshot, row.medicamento_nome_snapshot].filter(Boolean).join(' / ');
  return `${nomes || 'Aplicação de sanidade'} em ${row.data}`;
}

/**
 * Monta (sem gravar) as linhas de aplicação e de auditoria de um lançamento. Deve
 * rodar DENTRO da transação da pesagem: referências inválidas lançam e abortam a
 * transação inteira (pesagem incluída).
 */
export async function prepareApplicationRowsInTransaction(db, items, { animalId, data, sessaoId = null, pesagemId = null, empresaId = DEFAULT_EMPRESA_ID, ts = nowIso(), origem = 'lancamento' }) {
  if (!items?.length) return { rows: [], audits: [] };
  if (!animalId) throw invalid('A aplicação de sanidade exige um animal identificado na pesagem.');
  const actor = getActor();
  const rows = [];
  const audits = [];
  for (const item of items) {
    const input = { ...item, animal_id: animalId, data };
    const { programa, medicamento, posologia, carencia } = await resolveReferences(db, input, empresaId);
    const row = buildApplicationRecord({ id: crypto.randomUUID(), input, programa, medicamento, posologia, carencia, empresaId, actor, ts, pesagemId, sessaoId });
    rows.push(row);
    audits.push(auditRecord({
      entidade: APLICACOES_STORE, entidade_id: row.id, acao: ACOES.CRIAR_APLICACAO,
      resumo: `Registrou ${applicationSummary(row)}.`, depois: { ...row }, origem, created_at: ts,
    }));
  }
  return { rows, audits };
}

/** Aplicação avulsa (sem pesagem). `input` já validado pelo domínio. */
export async function insertApplication(input, { empresaId = DEFAULT_EMPRESA_ID } = {}) {
  storage.assertWritable('Registro de aplicação de sanidade');
  const db = await storage.ensureReady();
  const tables = [APLICACOES_STORE, PROGRAMAS_STORE, MEDICAMENTOS_STORE, POSOLOGIAS_STORE, 'animais', 'pesagens', 'sessoesPesagem', 'auditoria'].map((name) => db.table(name));
  return db.transaction('rw', tables, async () => {
    const animal = await findRow(db.table('animais'), input.animal_id);
    if (!animal) throw invalid('Animal não encontrado.');
    // Cronologia do animal (mesma régua da pesagem): não antes do Cadastro nem depois da
    // saída definitiva; no próprio dia da saída é aceita (manejo antes do embarque).
    const eventos = (await db.table('pesagens').where('animal_id').equals(animal.id).toArray()).filter((row) => !row.deleted_at);
    const tipoDe = (row) => (row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload.tipo_manejo : null) ?? row.tipo_pesagem;
    const cadastro = eventos.filter((row) => tipoDe(row) === 'Cadastro').map((row) => row.data_pesagem).sort()[0];
    if (cadastro && input.data < cadastro) throw invalid(`A data ${input.data} é anterior ao cadastro do animal (${cadastro}).`);
    const saida = eventos.filter((row) => tipoDe(row) === 'Saída').map((row) => row.data_pesagem).sort()[0] || animal.data_saida || null;
    if (saida && input.data > saida) throw invalid(`A data ${input.data} é posterior à saída do animal (${saida}).`);
    if (input.sessao_id && !(await findRow(db.table('sessoesPesagem'), input.sessao_id))) {
      throw invalid('Sessão de pesagem não encontrada.');
    }
    const ts = nowIso();
    const { rows, audits } = await prepareApplicationRowsInTransaction(db, [input], {
      animalId: animal.id, data: input.data, sessaoId: input.sessao_id, pesagemId: null, empresaId, ts, origem: 'avulsa',
    });
    await db.table(APLICACOES_STORE).bulkAdd(rows.map((row) => ({ ...row })));
    await db.table('auditoria').bulkAdd(audits);
    return rows[0];
  });
}

/** Cancela (fato histórico nunca é apagado). Já cancelada → devolve como está. */
export async function cancelApplication(id, { motivo = null } = {}) {
  storage.assertWritable('Cancelamento de aplicação de sanidade');
  const db = await storage.ensureReady();
  const table = db.table(APLICACOES_STORE);
  return db.transaction('rw', table, db.table('auditoria'), async () => {
    const existing = await findRow(table, id);
    if (!existing) throw notFound('Aplicação de sanidade', id);
    if (existing.cancelled_at) return publicRow(existing);
    const ts = nowIso();
    const changes = { cancelled_at: ts, motivo_cancelamento: motivo, updated_at: ts };
    await table.update(existing.localId, changes);
    await db.table('auditoria').add(auditRecord({
      entidade: APLICACOES_STORE, entidade_id: existing.id, acao: ACOES.CANCELAR_APLICACAO,
      resumo: `Cancelou ${applicationSummary(existing)}.`, campos_alterados: Object.keys(changes).filter((key) => key !== 'updated_at'),
      antes: publicRow(existing), motivo, origem: 'manual', created_at: ts,
    }));
    return publicRow({ ...existing, ...changes });
  });
}

/**
 * R2-03: esclarece a carência de uma aplicação que ficou DESCONHECIDA (medicamento sem carência na época): grava o
 * prazo, a fonte e o responsável, recalcula o fim da carência pela data da aplicação e audita (antes/depois). Só
 * para aplicação ativa com carência desconhecida; carência já conhecida não é reescrita.
 */
export async function clarifyWithdrawal(id, { carencia_carne_dias, fonte, responsavel }) {
  storage.assertWritable('Esclarecimento de carência');
  const db = await storage.ensureReady();
  const table = db.table(APLICACOES_STORE);
  return db.transaction('rw', table, db.table('auditoria'), async () => {
    const existing = await findRow(table, id);
    if (!existing) throw notFound('Aplicação de sanidade', id);
    if (existing.cancelled_at || existing.deleted_at) throw Object.assign(new Error('Aplicação cancelada: não há carência a esclarecer.'), { code: 'ESCLARECIMENTO_INVALIDO' });
    if (existing.carencia_carne_ate || !existing.medicamento_id) throw Object.assign(new Error('Esta aplicação não tem carência desconhecida.'), { code: 'ESCLARECIMENTO_INVALIDO' });
    const ts = nowIso();
    const actor = getActor();
    const fim = withdrawalEnd(existing.data, { posologia: { carencia_carne_dias } });
    const changes = {
      carencia_carne_ate: fim.carencia_carne_ate,
      carencia_conhecida: true,
      carencia_esclarecimento: { carencia_carne_dias, fonte, responsavel, em: ts, por: actor?.usuario_nome_snapshot ?? null },
      updated_at: ts,
    };
    await table.update(existing.localId, changes);
    await db.table('auditoria').add(auditRecord({
      entidade: APLICACOES_STORE, entidade_id: existing.id, acao: ACOES.ESCLARECER_CARENCIA,
      resumo: `Carência esclarecida: ${carencia_carne_dias} dia(s) (${fonte}) por ${responsavel} — ${applicationSummary(existing)}.`,
      campos_alterados: ['carencia_carne_ate', 'carencia_conhecida', 'carencia_esclarecimento'],
      antes: publicRow(existing), motivo: fonte, origem: 'manual', created_at: ts,
    }));
    return publicRow({ ...existing, ...changes });
  });
}

/**
 * Cancelar/excluir pesagem cancela as aplicações vinculadas (pesagem_id) na MESMA
 * transação da pesagem. Devolve a quantidade cancelada.
 */
export async function cancelApplicationsForWeighingsInTransaction(db, pesagemIds, { ts = nowIso(), motivo = MOTIVO_PESAGEM_CANCELADA } = {}) {
  const ids = [...new Set((pesagemIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const table = db.table(APLICACOES_STORE);
  const rows = (await table.where('pesagem_id').anyOf(ids).toArray()).filter((row) => !row.deleted_at && !row.cancelled_at);
  for (const row of rows) {
    await table.update(row.localId, { cancelled_at: ts, motivo_cancelamento: motivo, updated_at: ts });
    await db.table('auditoria').add(auditRecord({
      entidade: APLICACOES_STORE, entidade_id: row.id, acao: ACOES.CANCELAR_APLICACAO,
      resumo: `Cancelou ${applicationSummary(row)} (pesagem cancelada).`, campos_alterados: ['cancelled_at', 'motivo_cancelamento'],
      antes: publicRow(row), motivo, origem: 'cancelamento-pesagem', created_at: ts,
    }));
  }
  return rows.length;
}

const MIN_DATE = '0000-01-01';
const MAX_DATE = '9999-12-31';

/** Leitura com filtros; nomes atuais por join (snapshot quando o cadastro não existe). */
export async function listApplications({ animalId = null, from = null, to = null, programaId = null, medicamentoId = null, includeCancelled = false, empresaId = DEFAULT_EMPRESA_ID } = {}) {
  const db = await storage.ensureReady();
  const table = db.table(APLICACOES_STORE);
  let rows;
  if (animalId) {
    rows = await table.where('[animal_id+data]').between([animalId, from || MIN_DATE], [animalId, to || MAX_DATE], true, true).toArray();
  } else if (from || to) {
    rows = await table.where('data').between(from || MIN_DATE, to || MAX_DATE, true, true).toArray();
  } else if (programaId) {
    rows = await table.where('programa_sanidade_id').equals(programaId).toArray();
  } else if (medicamentoId) {
    rows = await table.where('medicamento_id').equals(medicamentoId).toArray();
  } else {
    rows = await table.toArray();
  }
  rows = rows.filter((row) => !row.deleted_at
    && empresaDe(row) === empresaId
    && (includeCancelled || !row.cancelled_at)
    && (!animalId || row.animal_id === animalId)
    && (!from || row.data >= from)
    && (!to || row.data <= to)
    && (!programaId || row.programa_sanidade_id === programaId)
    && (!medicamentoId || row.medicamento_id === medicamentoId));
  const nomes = async (store) => new Map((await db.table(store).toArray()).filter((row) => !row.deleted_at).map((row) => [row.id, row.nome]));
  const [programas, medicamentos] = await Promise.all([nomes(PROGRAMAS_STORE), nomes(MEDICAMENTOS_STORE)]);
  return rows
    .map((row) => ({
      ...publicRow(row),
      programa_nome: row.programa_sanidade_id ? programas.get(row.programa_sanidade_id) ?? row.programa_nome_snapshot ?? null : null,
      medicamento_nome: row.medicamento_id ? medicamentos.get(row.medicamento_id) ?? row.medicamento_nome_snapshot ?? null : null,
    }))
    .sort((left, right) => String(left.data).localeCompare(String(right.data))
      || String(left.created_at || '').localeCompare(String(right.created_at || ''))
      || String(left.id).localeCompare(String(right.id)));
}
