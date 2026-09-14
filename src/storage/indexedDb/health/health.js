// Integridade lógica do modelo Dexie: IDs, duplicidades, datas e referências.
import { ensureStorageReady, getDbVersion } from '../db.js';
import { DOMAIN_STORES, STORE_NAMES } from '../schema.js';
import { parseCivilDate } from '../../../modules/weighing/domain/brazilianValues.js';

function payload(row) {
  if (!row?.legacy_payload) return row || {};
  if (typeof row.legacy_payload === 'object') return { ...row, ...row.legacy_payload };
  try { return { ...row, ...JSON.parse(row.legacy_payload) }; } catch { return row; }
}

export async function logicalIntegrity() {
  const db = await ensureStorageReady();
  const issues = [];

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
  const animalIds = new Set((await active('animais')).map((row) => row.id));
  // v7 (ADR-023): `loteApartacoes` é a única store de lote.
  const lotIds = new Set((await active('loteApartacoes')).map((row) => row.id));
  const shipmentIds = new Set((await active('embarques')).map((row) => row.id));
  const documentIds = new Set((await active('documentosEmbarque')).map((row) => row.id));
  const weighingIds = new Set((await active('pesagens')).map((row) => row.id));
  const sessionIds = new Set((await active('sessoesPesagem')).map((row) => row.id));

  for (const raw of await active('pesagens')) {
    const row = payload(raw);
    if (!parseCivilDate(row.data_pesagem)) issues.push(`pesagens ${row.id}: data_pesagem inválida`);
    const weight = Number(row.peso_kg ?? row.peso);
    const weightOptional = row.tipo_manejo === 'Saída' && ['Morte', 'Doação', 'Transferência'].includes(row.motivo_saida);
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

  for (const identifier of await active('animalIdentificadores')) {
    if (identifier.animal_id && !animalIds.has(identifier.animal_id)) issues.push(`animalIdentificadores ${identifier.id}: animal_id órfão ${identifier.animal_id}`);
  }

  const identifierOwners = new Map();
  for (const identifier of await active('animalIdentificadores')) {
    if (identifier.ativo === false || !identifier.valor_normalizado) continue;
    const key = `${identifier.tipo || ''}::${identifier.valor_normalizado}`;
    const owner = identifierOwners.get(key);
    if (owner && owner !== identifier.animal_id) issues.push(`animalIdentificadores ${identifier.id}: identificação ativa duplicada entre animais`);
    else identifierOwners.set(key, identifier.animal_id);
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

  for (const session of await active('sessoesPesagem')) {
    if (!parseCivilDate(session.data)) issues.push(`sessoesPesagem ${session.id}: data inválida`);
  }

  return { ok: issues.length === 0, result: issues.length === 0 ? 'ok' : 'issues', issues };
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
