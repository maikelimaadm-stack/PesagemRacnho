// Integridade lógica do modelo Dexie: IDs, duplicidades, datas, referências,
// contrato v7 (enums, ids de cadastro, unicidade VISUAL por marca, usuários) e
// sanidade v8 (aplicações → animal, programa, medicamento, sessão e pesagem).
import { ensureStorageReady, getDbVersion } from '../db.js';
import {
  ANIMAL_SITUACOES, DOMAIN_STORES, IDENTIFICADOR_TIPOS, SANITY_APPLICATIONS_STORE, SANITY_REGISTRY_STORES, SESSAO_STATUS, STORE_NAMES, USERS_STORE,
} from '../schema.js';
import { SESSION_OPERATOR_FIELD } from '../normalize.js';
import { parseCivilDate } from '../../../modules/weighing/domain/brazilianValues.js';
import { MIGRATION_STATUS, readMigrationState } from '../../migrations/migrationState.js';

function payload(row) {
  if (!row?.legacy_payload) return row || {};
  if (typeof row.legacy_payload === 'object') return { ...row, ...row.legacy_payload };
  try { return { ...row, ...JSON.parse(row.legacy_payload) }; } catch { return row; }
}

/**
 * `enforceV7`: força (true) ou desliga (false) as regras do contrato v7 (marca_id
 * obrigatório, enums, tipos de identificador). Por padrão elas valem quando
 * appSettings['migration:v7'] está CONCLUIDA — antes disso os valores legados
 * são esperados e o backfill é quem os converte.
 */
export async function logicalIntegrity({ enforceV7 = null } = {}) {
  const db = await ensureStorageReady();
  const issues = [];
  // Avisos (missão pesagens-integrada, P11): exceções para conciliar à mão que não reprovam o banco
  // (identificação legada ambígua). Movimento de pesagem cancelada já é problema ("pesagem_id órfão").
  const warnings = [];
  const migration = await readMigrationState(db, 7);
  const v7Contract = enforceV7 ?? migration?.status === MIGRATION_STATUS.CONCLUIDA;

  for (const name of DOMAIN_STORES) {
    const rows = await db.table(name).toArray();
    const ids = new Set();
    for (const r of rows) {
      if (r.id == null) issues.push(`${name}: registro sem id (localId=${r.localId})`);
      else if (ids.has(r.id)) issues.push(`${name}: id duplicado ${r.id}`);
      else ids.add(r.id);
    }
  }

  // Referências simples: loteApartacoes.apartacao_id deve existir em apartacoes.
  const apartacaoIds = new Set((await db.table('apartacoes').toArray()).map((r) => r.id));
  for (const la of await db.table('loteApartacoes').toArray()) {
    if (la.apartacao_id && !apartacaoIds.has(la.apartacao_id) && !la.deleted_at) {
      issues.push(`loteApartacoes ${la.id}: apartacao_id órfão ${la.apartacao_id}`);
    }
  }

  const active = async (name) => (await db.table(name).toArray()).filter((row) => !row.deleted_at);
  const animals = await active('animais');
  const animalIds = new Set(animals.map((row) => row.id));
  // v7 (ADR-023): `loteApartacoes` é a única store de lote.
  const lotIds = new Set((await active('loteApartacoes')).map((row) => row.id));
  const shipmentIds = new Set((await active('embarques')).map((row) => row.id));
  const documentIds = new Set((await active('documentosEmbarque')).map((row) => row.id));
  const weighingIds = new Set((await active('pesagens')).map((row) => row.id));
  const sessions = await active('sessoesPesagem');
  const sessionIds = new Set(sessions.map((row) => row.id));

  for (const raw of await active('pesagens')) {
    const row = payload(raw);
    if (!parseCivilDate(row.data_pesagem)) issues.push(`pesagens ${row.id}: data_pesagem inválida`);
    const weight = Number(row.peso_kg ?? row.peso);
    const weightOptional = row.tipo_manejo === 'Saída'
      && (['Morte', 'Doação', 'Transferência'].includes(row.motivo_saida) || (row.motivo_saida === 'Outros' && Boolean(row.operacao_id)));
    if (!weightOptional && (!Number.isFinite(weight) || weight <= 0)) issues.push(`pesagens ${row.id}: peso inválido`);
    if (row.animal_id && animalIds.size && !animalIds.has(row.animal_id)) issues.push(`pesagens ${row.id}: animal_id órfão ${row.animal_id}`);
    if (row.lote_id && !lotIds.has(row.lote_id)) issues.push(`pesagens ${row.id}: lote_id órfão ${row.lote_id}`);
    if (row.embarque_id && !shipmentIds.has(row.embarque_id)) issues.push(`pesagens ${row.id}: embarque_id órfão ${row.embarque_id}`);
    if (row.documento_embarque_id && !documentIds.has(row.documento_embarque_id)) issues.push(`pesagens ${row.id}: documento_embarque_id órfão ${row.documento_embarque_id}`);
    if (row.sessao_id && !sessionIds.has(row.sessao_id)) issues.push(`pesagens ${row.id}: sessao_id órfão ${row.sessao_id}`);
  }

  for (const document of await active('documentosEmbarque')) {
    if (document.embarque_id && !shipmentIds.has(document.embarque_id)) issues.push(`documentosEmbarque ${document.id}: embarque_id órfão ${document.embarque_id}`);
  }

  // Contrato v7 em animais: marca_id obrigatório e situacao dentro do enum.
  if (v7Contract) {
    for (const animal of animals) {
      if (!animal.marca_id) issues.push(`animais ${animal.id}: sem marca_id (contrato v7)`);
      if (!ANIMAL_SITUACOES.includes(animal.situacao)) issues.push(`animais ${animal.id}: situacao fora do enum (${animal.situacao ?? 'vazia'})`);
    }
  }

  const identifiers = await active('animalIdentificadores');
  for (const identifier of identifiers) {
    if (identifier.animal_id && !animalIds.has(identifier.animal_id)) issues.push(`animalIdentificadores ${identifier.id}: animal_id órfão ${identifier.animal_id}`);
    if (v7Contract && !IDENTIFICADOR_TIPOS.includes(identifier.tipo)) issues.push(`animalIdentificadores ${identifier.id}: tipo fora do enum (${identifier.tipo ?? 'vazio'})`);
  }

  // Unicidade de identificador ativo: VISUAL por (marca_id, valor_normalizado)
  // (ADR-020); demais tipos — e VISUAL legado sem marca_id — por (tipo, valor).
  const identifierOwners = new Map();
  for (const identifier of identifiers) {
    if (identifier.ativo === false || !identifier.valor_normalizado) continue;
    const isVisualByBrand = identifier.tipo === 'VISUAL' && identifier.marca_id;
    const key = isVisualByBrand
      ? `VISUAL::${identifier.marca_id}::${identifier.valor_normalizado}`
      : `${identifier.tipo || ''}::${identifier.valor_normalizado}`;
    const owner = identifierOwners.get(key);
    if (owner && owner !== identifier.animal_id) {
      issues.push(isVisualByBrand
        ? `animalIdentificadores ${identifier.id}: identificador VISUAL ativo duplicado na mesma marca (${identifier.valor_normalizado})`
        : `animalIdentificadores ${identifier.id}: identificação ativa duplicada entre animais`);
    } else {
      identifierOwners.set(key, identifier.animal_id);
    }
  }

  for (const movement of await active('movimentosAnimais')) {
    if (movement.animal_id && !animalIds.has(movement.animal_id)) issues.push(`movimentosAnimais ${movement.id}: animal_id órfão ${movement.animal_id}`);
    if (movement.pesagem_id && !weighingIds.has(movement.pesagem_id)) issues.push(`movimentosAnimais ${movement.id}: pesagem_id órfão ${movement.pesagem_id}`);
    if (!parseCivilDate(movement.data_evento)) issues.push(`movimentosAnimais ${movement.id}: data_evento inválida`);
  }

  for (const link of await active('animalLotes')) {
    if (link.animal_id && !animalIds.has(link.animal_id)) issues.push(`animalLotes ${link.id}: animal_id órfão ${link.animal_id}`);
    if (link.lote_id && !lotIds.has(link.lote_id)) issues.push(`animalLotes ${link.id}: lote_id órfão ${link.lote_id}`);
    if (!parseCivilDate(link.inicio)) issues.push(`animalLotes ${link.id}: início inválido`);
    if (link.fim && (!parseCivilDate(link.fim) || link.fim < link.inicio)) issues.push(`animalLotes ${link.id}: fim inválido ou anterior ao início`);
  }

  // Usuários locais (ADR-043, docs 11 §2): todo usuário ativo precisa de
  // password_hash e password_salt. O diagnóstico cita somente id e login — nunca
  // o conteúdo das credenciais. Usuários excluídos também contam como referência
  // válida (nunca se apaga usuário citado em auditoria/sessões).
  const allUsers = await db.table(USERS_STORE).toArray();
  const userIds = new Set(allUsers.map((user) => String(user.id)));
  for (const user of allUsers) {
    if (user.deleted_at || user.ativo === false) continue;
    if (!user.password_hash || !user.password_salt) issues.push(`${USERS_STORE} ${user.id}: usuário ativo sem credencial completa (${user.login || 'sem login'})`);
  }

  for (const session of sessions) {
    if (!parseCivilDate(session.data)) issues.push(`sessoesPesagem ${session.id}: data inválida`);
    if (v7Contract && !SESSAO_STATUS.includes(session.status)) issues.push(`sessoesPesagem ${session.id}: status fora do enum (${session.status ?? 'vazio'})`);
    // Operador autenticado (docs 11 §7): quando informado, precisa existir em `usuarios`.
    const operatorId = session[SESSION_OPERATOR_FIELD];
    if (v7Contract && operatorId != null && !userIds.has(String(operatorId))) {
      issues.push(`sessoesPesagem ${session.id}: ${SESSION_OPERATOR_FIELD} órfão ${operatorId}`);
    }
  }

  await sanityIntegrity(db, { issues, animalIds, weighingIds, active });

  // P11: pesagem antiga sem animal_id cujo número + marca pertence a mais de um animal — não é ligada
  // sozinha a nenhum deles (domain/animalHistory) e fica nesta lista para conciliação manual.
  const activeWeighings = await active('pesagens');
  const legacyKeyOf = (row) => {
    const ui = payload(row);
    return `${String(ui.numero_animal ?? '').trim().toUpperCase()}::${String(ui.marca ?? '').trim().toUpperCase()}`;
  };
  const animalsByLegacyKey = new Map();
  for (const row of activeWeighings) {
    if (!row.animal_id) continue;
    const key = legacyKeyOf(row);
    const set = animalsByLegacyKey.get(key) || new Set();
    set.add(row.animal_id);
    animalsByLegacyKey.set(key, set);
  }
  for (const row of activeWeighings) {
    if (row.animal_id) continue;
    const owners = animalsByLegacyKey.get(legacyKeyOf(row));
    if (owners && owners.size > 1) warnings.push(`pesagens ${row.id}: sem animal_id e a identificação ${legacyKeyOf(row)} pertence a ${owners.size} animais — conciliar à mão`);
  }

  return { ok: issues.length === 0, result: issues.length === 0 ? 'ok' : 'issues', issues, warnings, v7Contract };
}

const ISO_CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Sanidade (ADR-049). Ids nulos/duplicados das três stores já entram no laço de
// DOMAIN_STORES. Aqui: nome ativo duplicado nos cadastros e referências das
// aplicações. Programa/medicamento INATIVO continua referência válida (fato
// histórico); aplicação cancelada pode apontar para pesagem cancelada e animal
// excluído, mas a referência precisa existir. Aplicação ativa exige pesagem ativa.
async function sanityIntegrity(db, { issues, animalIds, weighingIds, active }) {
  const installed = new Set(db.tables.map((table) => table.name));
  if (![...SANITY_REGISTRY_STORES, SANITY_APPLICATIONS_STORE].every((name) => installed.has(name))) return;

  const registryIds = {};
  for (const store of SANITY_REGISTRY_STORES) {
    const rows = await active(store);
    registryIds[store] = new Set(rows.map((row) => row.id));
    const owners = new Map();
    for (const row of rows) {
      if (row.ativo === false || !row.nome_normalizado) continue;
      const key = `${row.empresa_id ?? 'local'}::${row.nome_normalizado}`;
      if (owners.has(key) && owners.get(key) !== row.id) issues.push(`${store} ${row.id}: nome ativo duplicado (${row.nome_normalizado})`);
      else owners.set(key, row.id);
    }
  }

  const applications = await active(SANITY_APPLICATIONS_STORE);
  if (!applications.length) return;
  const everyAnimalId = new Set((await db.table('animais').toArray()).map((row) => row.id));
  const everyWeighingId = new Set((await db.table('pesagens').toArray()).map((row) => row.id));
  const everySessionId = new Set((await db.table('sessoesPesagem').toArray()).map((row) => row.id));
  const label = (row) => `${SANITY_APPLICATIONS_STORE} ${row.id}`;
  for (const row of applications) {
    const cancelled = Boolean(row.cancelled_at);
    if (!row.animal_id) issues.push(`${label(row)}: sem animal_id`);
    else if (!(cancelled ? everyAnimalId : animalIds).has(row.animal_id)) issues.push(`${label(row)}: animal_id órfão ${row.animal_id}`);
    if (!row.programa_sanidade_id && !row.medicamento_id) issues.push(`${label(row)}: sem programa nem medicamento`);
    if (row.programa_sanidade_id && !registryIds.programasSanidade.has(row.programa_sanidade_id)) issues.push(`${label(row)}: programa_sanidade_id órfão ${row.programa_sanidade_id}`);
    if (row.medicamento_id && !registryIds.medicamentos.has(row.medicamento_id)) issues.push(`${label(row)}: medicamento_id órfão ${row.medicamento_id}`);
    if (row.dose != null && !(typeof row.dose === 'number' && Number.isFinite(row.dose) && row.dose > 0)) issues.push(`${label(row)}: dose inválida (${row.dose})`);
    if (!ISO_CIVIL_DATE.test(String(row.data ?? '')) || !parseCivilDate(row.data)) issues.push(`${label(row)}: data inválida`);
    if (row.sessao_id && !everySessionId.has(row.sessao_id)) issues.push(`${label(row)}: sessao_id órfão ${row.sessao_id}`);
    if (row.pesagem_id) {
      if (!everyWeighingId.has(row.pesagem_id)) issues.push(`${label(row)}: pesagem_id órfão ${row.pesagem_id}`);
      else if (!cancelled && !weighingIds.has(row.pesagem_id)) issues.push(`${label(row)}: aplicação ativa vinculada a pesagem cancelada ${row.pesagem_id}`);
    }
  }
}

export async function databaseStats() {
  const db = await ensureStorageReady();
  const counts = {};
  for (const name of STORE_NAMES) {
    const rows = await db.table(name).toArray();
    counts[name] = name === 'appSettings' || name === 'backupHistory'
      ? rows.length
      : rows.filter((r) => !r.deleted_at).length;
  }
  return {
    dbType: 'IndexedDB/Dexie',
    dbVersion: getDbVersion(),
    weighingEntries: counts.pesagens,
    apartacoes: counts.apartacoes,
    shipments: counts.embarques,
    counts,
  };
}
