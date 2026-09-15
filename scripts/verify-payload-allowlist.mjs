// Gate payload:allowlist:verify (ADR-027; docs 12 §6).
// Prova que criar, editar, editar em massa e recalcular pela cadeia oficial
// (weighingService → mapper → adapter → Dexie) nunca introduzem chaves proibidas
// nem desconhecidas em legacy_payload; que o view model continua projetando
// status_animal/created_date; que a auditoria carrega o ator e que ATUALIZAR em
// massa grava resumo + campos_alterados. Testes negativos: o verificador detecta
// um payload sujo gravado por fora; o caminho systemDerived descarta chaves.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { getActor, setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as weighingDataAdapter from '../src/modules/weighing/infrastructure/weighingDataAdapter.js';
import {
  LEGACY_PAYLOAD_ALLOWLIST,
  LEGACY_PAYLOAD_FORBIDDEN,
  filterLegacyPayload,
  findDisallowedLegacyKeys,
  uiToStorageRecord,
} from '../src/modules/weighing/domain/weighingMapper.js';

// `peso_kg` fica fora daqui porque o mapper o aceita como alias do peso; é testado à parte.
const DIRTY = { status_animal: 'Ativo', created_date: '2026-01-01T00:00:00.000Z', updated_date: '2026-01-01T00:00:00.000Z', _localId: 99, sanidade_ids: ['x'], sanidades: [{ id: 'x' }], chave_desconhecida: 'zzz' };

// Lista permitida e proibida são disjuntas; a proibida cobre as chaves da ADR-027.
assert.ok(LEGACY_PAYLOAD_ALLOWLIST.every((key) => !LEGACY_PAYLOAD_FORBIDDEN.includes(key)), 'listas disjuntas');
for (const key of ['_localId', 'peso_kg', 'created_date', 'updated_date', 'status_animal', 'sanidade_ids', 'sanidades']) {
  assert.ok(LEGACY_PAYLOAD_FORBIDDEN.includes(key), `proibida: ${key}`);
}
for (const key of ['numero_animal', 'marca', 'raca', 'era', 'peso', 'motivo_saida', 'apartacao_id', 'nome_lote', 'comprador', 'frigorifico', 'placa_carreta', 'alertas_confirmados']) {
  assert.ok(LEGACY_PAYLOAD_ALLOWLIST.includes(key), `permitida: ${key}`);
}
assert.deepEqual(filterLegacyPayload({ numero_animal: '1', ...DIRTY }), { numero_animal: '1' }, 'filtro descarta proibidas e desconhecidas');
assert.deepEqual(findDisallowedLegacyKeys({ numero_animal: '1', ...DIRTY }).sort(), Object.keys(DIRTY).sort(), 'verificador aponta cada chave fora da lista');
const mapped = uiToStorageRecord({ tipo_manejo: 'Manejo', data_pesagem: '2026-01-05', peso_kg: 210, numero_animal: '1', marca: 'A', ...DIRTY });
assert.deepEqual(findDisallowedLegacyKeys(mapped.legacy_payload), [], 'mapper grava só a lista permitida');
assert.equal(mapped.peso_kg, 210, 'peso_kg continua coluna do registro');
assert.ok(!('peso_kg' in mapped.legacy_payload), 'peso_kg não entra no payload');
assert.equal(mapped.legacy_payload.peso, 210, 'peso (permitido) é preenchido a partir do peso mapeado');

await deleteDbForTests();
const auditRows = async () => (await (await storage.ensureReady()).table('auditoria').toArray());

// Criar (Cadastro) com chaves proibidas e desconhecida vindas da UI.
const cadastro = await weighingService.createEntry({ id: 'cad', tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'A', sexo: 'M', raca: 'Nelore', era: '12', data_pesagem: '2026-01-01', peso: 200, ...DIRTY });
const animalId = cadastro.animal_id;
assert.ok(animalId);
await weighingService.createEntry({ id: 'man1', animal_id: animalId, tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-03-01', peso: 260, ...DIRTY });
// Editar com view model completo (o que a UI devolve, inclusive _localId/status_animal/created_date).
const beforeEdit = await weighingService.getEntryById('man1');
assert.equal(beforeEdit.status_animal, 'Ativo', 'view model projeta status_animal sem persistir a chave');
assert.ok(beforeEdit._localId != null, 'view model expõe _localId só para os adapters');
// A UI envia um payload novo (peso, não peso_kg) mais o que restaurou do registro.
await weighingService.updateEntry('man1', { ...DIRTY, _localId: beforeEdit._localId, peso: 265, observacao: 'editado' });
// Inserção retroativa → recálculo da série (caminho systemDerived do adapter).
await weighingService.createEntry({ id: 'man0', animal_id: animalId, tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-02-01', peso: 230, ...DIRTY });
// Edição coletiva (auditoria resumida) e recálculo integral explícito.
await weighingService.bulkUpdateEntries([{ id: 'man1', patch: { observacao: 'coletiva', chave_desconhecida: 'zzz', status_animal: 'Ativo' } }]);
await weighingService.recalculateAllWeightSeries();

const db = await storage.ensureReady();
const rows = await db.table('pesagens').toArray();
assert.equal(rows.length, 3);
for (const row of rows) {
  assert.equal(typeof row.legacy_payload, 'object', `${row.id}: payload é objeto`);
  assert.deepEqual(findDisallowedLegacyKeys(row.legacy_payload), [], `${row.id}: payload só com chaves permitidas`);
  for (const key of LEGACY_PAYLOAD_FORBIDDEN) assert.ok(!(key in row.legacy_payload), `${row.id}: sem ${key}`);
  assert.equal(row.legacy_payload.numero_animal, '1', 'dados operacionais preservados');
  assert.equal(row.legacy_payload.marca, 'A');
}
const man1 = await weighingService.getEntryById('man1');
assert.equal(man1.peso, 265);
assert.equal(man1.observacao, 'coletiva');
assert.equal(man1.peso_anterior, 230, 'recálculo aplicou a inserção retroativa');
assert.equal(man1.ganho, 35);
assert.equal(man1.status_animal, 'Ativo', 'projeção continua disponível para a UI');
assert.equal(man1.created_date, rows.find((r) => r.id === 'man1').created_at, 'created_date cai para created_at');
assert.equal((await weighingService.getEntryById('cad')).created_date, rows.find((r) => r.id === 'cad').created_at);

// v7: cadastro criou marca/raça por id, identificador VISUAL e sessões ABERTA.
const animal = await db.table('animais').where('id').equals(animalId).first();
assert.equal(animal.situacao, 'ATIVO');
assert.ok(animal.marca_id && animal.raca_id, 'animal novo nasce com marca_id e raca_id');
assert.equal((await db.table('marcas').where('id').equals(animal.marca_id).first()).nome_normalizado, 'A');
const identifier = await db.table('animalIdentificadores').where('animal_id').equals(animalId).first();
assert.equal(identifier.tipo, 'VISUAL');
assert.equal(identifier.valor_normalizado, '1');
assert.equal(identifier.marca_id, animal.marca_id);
assert.ok((await db.table('sessoesPesagem').toArray()).every((s) => s.status === 'ABERTA'));

// Auditoria: ator anexado (nulo sem provedor), resumo em massa, antes/depois nas unitárias.
let audits = await auditRows();
const actorKeys = Object.keys(getActor());
assert.ok(actorKeys.length >= 1, 'auditActor expõe campos do ator');
assert.ok(audits.every((a) => actorKeys.every((key) => key in a)), `toda auditoria carrega os campos do ator (${actorKeys.join(',')})`);
assert.ok(audits.every((a) => actorKeys.every((key) => a[key] === null)), 'sem provedor de ator, campos nulos');
const coletiva = audits.find((a) => a.origem === 'edicao-coletiva');
assert.ok(coletiva, 'edição coletiva auditada');
assert.equal(coletiva.acao, 'ATUALIZAR');
assert.ok(!('antes' in coletiva) && !('depois' in coletiva), 'ATUALIZAR em massa não grava antes/depois completos');
assert.match(coletiva.resumo, /Edição coletiva: \d+ campo\(s\) alterado\(s\)/);
assert.ok(coletiva.campos_alterados.includes('legacy_payload.observacao'), `campos_alterados: ${coletiva.campos_alterados.join(',')}`);
assert.ok(!coletiva.campos_alterados.some((c) => c.includes('chave_desconhecida')), 'chave descartada não aparece como alterada');
const unitaria = audits.find((a) => a.acao === 'ATUALIZAR' && a.origem === 'manual');
assert.ok(unitaria?.antes && unitaria?.depois, 'ATUALIZAR unitário mantém antes/depois');
assert.ok(audits.filter((a) => a.acao === 'CRIAR').every((a) => a.depois), 'CRIAR mantém depois');
assert.ok(!audits.some((a) => a.origem === 'recalculo-automatico'), 'recálculo automático não gera auditoria');

// Com provedor de ator, as próximas gravações carregam o usuário.
setActorProvider(() => ({ actor_user_id: 'u1', actor_user_name: 'Ana', actor_user_profile: 'ADMIN' }));
await weighingService.deleteEntry('man0');
audits = await auditRows();
const cancel = audits.find((a) => a.acao === 'CANCELAR');
assert.equal(cancel[actorKeys[0]], 'u1', 'auditoria carrega o id do usuário do provedor');
assert.ok(actorKeys.every((key) => cancel[key] !== null), 'campos do ator preenchidos com provedor');
assert.ok(cancel.antes, 'CANCELAR mantém antes');
setActorProvider(null);

// Negativo 1: o caminho systemDerived descarta chaves proibidas/desconhecidas do legacyPayload.
const vm = await weighingService.getEntryById('man1');
await weighingDataAdapter.bulkUpdateEntries([{ id: 'man1', localId: vm._localId, legacyPayload: { ...vm, _localId: 1, status_animal: 'Ativo', chave_x: 1 }, patch: { ganho: 36 } }], { audit: false, origin: 'recalculo-automatico', systemDerived: true });
const afterDerived = await db.table('pesagens').where('id').equals('man1').first();
assert.deepEqual(findDisallowedLegacyKeys(afterDerived.legacy_payload), [], 'systemDerived filtra o payload');
assert.equal(afterDerived.ganho, 36);

// Negativo 2: um payload sujo gravado por fora da cadeia é detectado pelo verificador.
await db.table('pesagens').add({ id: 'raw-bad', data_pesagem: '2026-01-05', peso_kg: 100, legacy_payload: { status_animal: 'Ativo', _localId: 3, ok: 'x' } });
const bad = await db.table('pesagens').where('id').equals('raw-bad').first();
assert.deepEqual(findDisallowedLegacyKeys(bad.legacy_payload).sort(), ['_localId', 'ok', 'status_animal'], 'teste negativo: sujeira detectada');
// E o mesmo registro, lido pela cadeia oficial e regravado, sai limpo.
await weighingService.updateEntry('raw-bad', { observacao: 'saneado' });
assert.deepEqual(findDisallowedLegacyKeys((await db.table('pesagens').where('id').equals('raw-bad').first()).legacy_payload), [], 'regravar pela cadeia limpa o payload');

await deleteDbForTests();
console.log('OK verify-payload-allowlist');
console.log(JSON.stringify({
  allowlist: LEGACY_PAYLOAD_ALLOWLIST.length,
  forbidden: LEGACY_PAYLOAD_FORBIDDEN,
  flows: ['criar', 'editar', 'edicao-coletiva', 'recalculo-retroativo', 'recalculo-integral', 'systemDerived'],
  audit: { actorFields: true, bulkSummary: true, unitaryBeforeAfter: true },
  negativeTests: ['systemDerived descarta chaves', 'payload sujo detectado'],
}, null, 2));
