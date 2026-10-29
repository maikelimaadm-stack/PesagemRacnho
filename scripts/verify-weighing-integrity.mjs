// Gate weighing:integrity:verify — missão pesagens-integrada, checkpoint A2 (P04–P13).
// Comportamento no banco (fake-indexeddb + adapter/serviço reais), não texto do fonte:
//   P05 cronologia da série inteira; P07 um Manejo oficial por animal/dia, inclusive concorrente;
//   P04/P09 movimentos reconciliados (cancelamento e edição de lote; movimento sem pesagem intocado);
//   P13 reconstrução de lotes idempotente; P08 falha no meio da transação não grava nada;
//   P06 correção de identificação com colisão; P10 banco indisponível é erro; P12 data impossível.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as adapter from '../src/modules/weighing/infrastructure/weighingDataAdapter.js';

await deleteDbForTests();
const db = await storage.ensureReady();
const resumo = [];
const ok = (regra) => resumo.push(regra);
const counts = async () => Object.fromEntries(await Promise.all(['pesagens', 'auditoria', 'movimentosAnimais', 'animalLotes', 'animais', 'animalIdentificadores'].map(async (t) => [t, await db.table(t).count()])));
const ativos = async (table, animalId) => (await db.table(table).where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at);
const rejects = async (promise, re, msg) => { await assert.rejects(promise, re, msg); };

const cadastro = (id, animalId, data, extra = {}) => ({ id, animal_id: animalId, tipo_manejo: 'Cadastro', numero_animal: extra.numero || animalId, marca: extra.marca || 'M1', sexo: 'M', raca: 'Nelore', data_pesagem: data, peso: extra.peso ?? 200, lote_id: extra.lote_id ?? null });
const manejo = (id, animalId, data, peso, extra = {}) => ({ id, animal_id: animalId, tipo_manejo: 'Manejo', numero_animal: extra.numero || animalId, marca: extra.marca || 'M1', data_pesagem: data, peso, lote_id: extra.lote_id ?? null });

// ---------------------------------------------------------------------------
// P05 — mover o Cadastro para depois de um Manejo é recusado, sem mudança parcial.
await weighingService.createEntry(cadastro('a-cad', 'A', '2026-01-10'));
await weighingService.createEntry(manejo('a-m1', 'A', '2026-03-01', 260));
let antes = await counts();
await rejects(weighingService.updateEntry('a-cad', { data_pesagem: '2026-04-01' }), /cadastro/i, 'Cadastro depois do Manejo');
assert.deepEqual(await counts(), antes, 'P05: recusa sem gravar nada');
assert.equal((await weighingService.getEntryById('a-cad')).data_pesagem, '2026-01-10');
// Cadastro retroativo correto passa.
await weighingService.updateEntry('a-cad', { data_pesagem: '2026-01-05' });
assert.equal((await weighingService.getEntryById('a-cad')).data_pesagem, '2026-01-05');
// Saída retroativa antes de Manejo existente é recusada.
await rejects(weighingService.createEntry({ id: 'a-s', animal_id: 'A', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'X', numero_animal: 'A', marca: 'M1', data_pesagem: '2026-02-01' }), /posteriores/i);
ok('P05 cronologia da série inteira (cadastro movido, saída retroativa)');

// P12 — data impossível não grava.
await rejects(weighingService.createEntry(manejo('a-bad', 'A', '2026-02-30', 250)), /data/i);
ok('P12 data impossível recusada');

// ---------------------------------------------------------------------------
// P07 — duas gravações concorrentes do mesmo Manejo/dia: no máximo uma.
const r = await Promise.allSettled([
  weighingService.createEntry(manejo('a-c1', 'A', '2026-04-01', 270)),
  weighingService.createEntry(manejo('a-c2', 'A', '2026-04-01', 271)),
]);
assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1, 'P07: só uma das concorrentes grava');
assert.match(r.find((x) => x.status === 'rejected').reason.message, /Manejo em 01\/04\/2026/);
assert.equal((await ativos('pesagens', 'A')).filter((row) => row.data_pesagem === '2026-04-01').length, 1);
// Mesmo dia, outro animal: permitido.
await weighingService.createEntry(cadastro('b-cad', 'B', '2026-01-10'));
await weighingService.createEntry(manejo('b-m1', 'B', '2026-04-01', 300));
// Envio repetido com o MESMO id (Enter duplo): recusado.
await rejects(weighingService.createEntry(manejo('b-m1', 'B', '2026-05-01', 301)), /duplicada|Manejo/i);
ok('P07 um Manejo oficial por animal/dia, concorrente e por id repetido');

// ---------------------------------------------------------------------------
// P04 — cancelar a pesagem que mudou de lote não deixa movimento ativo órfão.
await weighingService.createEntry(cadastro('c-cad', 'C', '2026-01-10', { lote_id: 'L1' }));
await weighingService.createEntry(manejo('c-m1', 'C', '2026-02-01', 230, { lote_id: 'L2' }));
let movC = (await ativos('movimentosAnimais', 'C')).map((m) => [m.pesagem_id, m.tipo, m.lote_origem_id, m.lote_destino_id]);
assert.deepEqual(movC.sort(), [['c-cad', 'Entrada', null, 'L1'], ['c-m1', 'Mudança de lote', 'L1', 'L2']].sort());
// movimento independente (sem pesagem) — fase B: a reconciliação não toca.
await db.table('movimentosAnimais').add({ id: 'mov-livre', animal_id: 'C', pesagem_id: null, tipo: 'Transferência interna', data_evento: '2026-02-15', lote_origem_id: 'L2', lote_destino_id: 'L9', created_at: 'x', updated_at: 'x', deleted_at: null });
await weighingService.deleteEntry('c-m1');
movC = (await ativos('movimentosAnimais', 'C')).map((m) => [m.id === 'mov-livre' ? 'livre' : m.pesagem_id, m.tipo]);
assert.deepEqual(movC.sort(), [['c-cad', 'Entrada'], ['livre', 'Transferência interna']].sort(), 'P04: movimento da cancelada sai; o livre fica');
const auditMov = (await db.table('auditoria').toArray()).filter((a) => a.entidade === 'movimentosAnimais' && a.acao === 'CANCELAR');
assert.ok(auditMov.length >= 1, 'P04: cancelamento do movimento auditado');
assert.deepEqual((await ativos('animalLotes', 'C')).map((l) => [l.lote_id, l.fim]), [['L1', null]], 'lote volta para L1');
ok('P04 cancelamento reconcilia movimentos (auditado) sem tocar movimento independente');

// P09 — editar o lote de uma pesagem passada reconcilia movimentos e permanências.
await weighingService.createEntry(manejo('c-m2', 'C', '2026-03-01', 250, { lote_id: 'L2' }));
await weighingService.createEntry(manejo('c-m3', 'C', '2026-04-01', 270, { lote_id: 'L2' }));
await weighingService.updateEntry('c-m2', { lote_id: 'L3' });
const movC2 = (await ativos('movimentosAnimais', 'C')).filter((m) => m.pesagem_id).map((m) => [m.pesagem_id, m.lote_origem_id, m.lote_destino_id]);
assert.deepEqual(movC2.sort(), [['c-cad', null, 'L1'], ['c-m2', 'L1', 'L3'], ['c-m3', 'L3', 'L2']].sort(), 'P09: movimentos seguem a série editada');
assert.deepEqual((await ativos('animalLotes', 'C')).map((l) => [l.lote_id, l.inicio, l.fim]).sort(), [['L1', '2026-01-10', '2026-03-01'], ['L2', '2026-04-01', null], ['L3', '2026-03-01', '2026-04-01']].sort());
ok('P09 edição de lote reconcilia movimentos e permanências');

// ---------------------------------------------------------------------------
// P13 — reconstrução de lotes idempotente (sem soft-delete + insert a cada chamada).
const totalLotes = await db.table('animalLotes').count();
for (let i = 0; i < 5; i += 1) await db.transaction('rw', db.table('pesagens'), db.table('animalLotes'), () => adapter.rebuildAnimalLotProjection(db, 'C'));
assert.equal(await db.table('animalLotes').count(), totalLotes, 'P13: reaplicar não cria nem apaga linhas');
const totalMov = await db.table('movimentosAnimais').count();
for (let i = 0; i < 3; i += 1) await db.transaction('rw', db.table('pesagens'), db.table('movimentosAnimais'), db.table('auditoria'), () => adapter.reconcileWeighingMovements(db, 'C'));
assert.equal(await db.table('movimentosAnimais').count(), totalMov, 'reconciliação de movimentos idempotente');
ok('P13 reconstrução de lotes e movimentos idempotente');

// ---------------------------------------------------------------------------
// P08 — falha no meio da transação (recálculo) não grava a pesagem nem deixa GMD velho.
const antesFalha = await counts();
const finalAntes = await weighingService.getEntryById('c-m3');
const hook = (mods) => { if (Object.keys(mods || {}).some((k) => k.startsWith('legacy_payload'))) throw new Error('falha injetada no recálculo'); };
db.table('pesagens').hook('updating', hook);
await rejects(weighingService.createEntry(manejo('c-retro', 'C', '2026-03-15', 260, { lote_id: 'L3' })), /falha injetada/);
db.table('pesagens').hook('updating').unsubscribe(hook);
assert.deepEqual(await counts(), antesFalha, 'P08: nada gravado');
assert.deepEqual(await weighingService.getEntryById('c-m3'), finalAntes, 'P08: derivados da série intactos');
// Sem falha, a retroativa grava e a série seguinte já sai recalculada na mesma transação.
await weighingService.createEntry(manejo('c-retro', 'C', '2026-03-15', 260, { lote_id: 'L3' }));
const depois = await weighingService.getEntryById('c-m3');
assert.equal(depois.data_anterior, '2026-03-15');
assert.equal(depois.peso_anterior, 260);
assert.equal(depois.gmd, 0.588);
ok('P08 recálculo na mesma transação (falha injetada não grava nada)');

// ---------------------------------------------------------------------------
// P06 — correção de identificação no Cadastro: identificador acompanha; colisão recusada.
await weighingService.createEntry(cadastro('d-cad', 'D', '2026-01-10', { numero: '500', marca: 'M1' }));
await weighingService.createEntry(cadastro('e-cad', 'E', '2026-01-10', { numero: '600', marca: 'M1' }));
await weighingService.updateEntry('d-cad', { numero_animal: '501' });
const visD = (await ativos('animalIdentificadores', 'D')).filter((i) => i.tipo === 'VISUAL');
assert.deepEqual(visD.map((i) => i.valor_normalizado), ['501'], 'P06: identificador visual acompanha a correção');
assert.equal((await db.table('animais').where('id').equals('D').first()).identificacao_normalizada, '501');
antes = await counts();
await rejects(weighingService.updateEntry('d-cad', { numero_animal: '600' }), /outro animal/i, 'P06: colisão');
assert.deepEqual(await counts(), antes, 'P06: colisão não grava nada');
ok('P06 correção de identificação sincroniza identificador e recusa colisão');

// ---------------------------------------------------------------------------
// P10 — banco indisponível é erro, nunca lista vazia.
const original = storage.ensureReady;
storage.ensureReady = async () => { throw new Error('IndexedDB bloqueado'); };
await rejects(weighingService.listEntries(), (err) => err.code === 'WEIGHING_STORAGE_001' && /Nada foi apagado/.test(err.message), 'P10');
storage.ensureReady = original;
assert.ok((await weighingService.listEntries()).length > 0);
ok('P10 falha de armazenamento propaga erro');

// ---------------------------------------------------------------------------
// P17 — fechar o dia, lançar de novo (nova sessão) e fechar outra vez: nenhuma sessão da data fica aberta.
const { closeWeighingDay } = await import('../src/modules/operations/application/operationalInsightsService.js');
await weighingService.createEntry(cadastro('f-cad', 'F', '2026-06-10'));
await closeWeighingDay('2026-06-10');
await weighingService.createEntry(cadastro('g-cad', 'G', '2026-06-10'));
const sessoesDia = async () => (await db.table('sessoesPesagem').where('data').equals('2026-06-10').toArray()).filter((r) => !r.deleted_at);
assert.equal((await sessoesDia()).filter((r) => r.status === 'ABERTA').length, 1, 'lançar após fechar abre outra sessão (comportamento preservado)');
await closeWeighingDay('2026-06-10');
assert.deepEqual((await sessoesDia()).map((r) => r.status), ['FECHADA', 'FECHADA'], 'P17: fechar de novo fecha todas as sessões da data');
ok('P17 fechamento do dia fecha todas as sessões abertas da data');

console.log('OK verify-weighing-integrity');
console.log(JSON.stringify(resumo, null, 2));

// Reparo geral: banco com resíduo antigo (movimento ativo de pesagem cancelada, permanência duplicada) →
// reconcileAllAnimalDerivations limpa; segunda execução não muda nada.
const { logicalIntegrity } = await import('../src/storage/indexedDb/health/health.js');
await db.table('apartacoes').add({ id: 'AP', nome: 'AP', ativo: true, created_at: 'x', updated_at: 'x', deleted_at: null });
for (const id of ['L1', 'L2', 'L3', 'L9']) await db.table('loteApartacoes').add({ id, apartacao_id: 'AP', nome_lote: id, situacao: 'ABERTO', created_at: 'x', updated_at: 'x', deleted_at: null });
assert.equal((await logicalIntegrity()).ok, true, `antes do resíduo: ${(await logicalIntegrity()).issues.join('; ')}`);
await db.table('movimentosAnimais').add({ id: 'residuo-mov', animal_id: 'C', pesagem_id: 'c-m1', tipo: 'Mudança de lote', data_evento: '2026-02-01', lote_origem_id: 'L1', lote_destino_id: 'L2', created_at: 'x', updated_at: 'x', deleted_at: null });
const lote0 = (await ativos('animalLotes', 'C'))[0];
await db.table('animalLotes').add({ ...lote0, localId: undefined, id: 'residuo-lote' });
assert.equal((await logicalIntegrity()).ok, false, 'resíduo antigo aparece na integridade');
await adapter.reconcileAllAnimalDerivations();
const integ = await logicalIntegrity();
assert.equal(integ.ok, true, `reparo deixa a integridade ok: ${integ.issues.join('; ')}`);
const snap = await counts();
await adapter.reconcileAllAnimalDerivations();
assert.deepEqual(await counts(), snap, 'reparo idempotente');
console.log('OK reparo geral (reconcileAllAnimalDerivations)');
