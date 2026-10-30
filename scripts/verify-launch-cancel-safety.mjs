// Gate launch:cancel-safety:verify — PR #5 R1: cancelamento seguro de pesagem que é efeito de operação confirmada.
// fake-indexeddb, dados SINTÉTICOS. A guarda é do SERVIÇO (weighingDataAdapter.bulkDeleteEntries, na transação):
//   T02 exclusão direta (bulkDeleteEntries / deleteEntry) de Entrada e Saída vinculadas → PESAGEM_VINCULADA_OPERACAO,
//       nada muda;
//   T03 lista mista [manejo, vinculada] → recusada inteira (as duas intactas);
//   T04 cancelOperation de Entrada e de Saída → livro, pesagem, movimento, aplicações, inventário e auditoria coerentes;
//   T05 operação de vários animais (Rebanho): nenhuma pesagem sai sozinha (Relação); cancelamento canônico funciona;
//   T06 Entrada sem peso → 1ª pesagem adotada: exclusão isolada recusada; cancelar respeita a cronologia;
//   T07 Manejo sem operação: exclusão e repesagem continuam funcionando;
//   T08 erro injetado no meio do cancelamento canônico → rollback integral (impressão do banco igual) e nova
//       tentativa segura;
//   T09 permissões: CONSULTA não cancela nem exclui; com o módulo de autenticação ativo e sem sessão, nada.
// T01 (tela fail-closed) fica em useVinculoOperacao.test.js e ConfirmarExclusaoLancamentoDialog.test.jsx;
// T10 no E2E e2e:launch-integration:verify (Electron real).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import * as weighing from '../src/modules/weighing/application/weighingService.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import { deleteEntriesRespectingHistory } from '../src/modules/animals/application/animalHistoryService.js';

let papel = 'ADMIN';
setActorProvider(() => (papel ? { id: `u-${papel}`, nome: `Usuário ${papel}`, role: papel } : null));
const como = async (role, fn) => { const antes = papel; papel = role; try { return await fn(); } finally { papel = antes; } };
const erroDe = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

const db = await storage.ensureReady();
const TS = '2026-01-01T00:00:00.000Z';
await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
const ativos = async (t, f = () => true) => (await db.table(t).toArray()).filter((r) => !r.deleted_at).filter(f);
// Impressão do banco inteiro (stores de dados): prova que uma recusa/rollback não mudou NADA.
const impressao = async () => {
  const partes = [];
  for (const nome of ['animais', 'operacoes', 'operacaoItens', 'pesagens', 'movimentosAnimais', 'animalLotes', 'aplicacoesSanidade', 'auditoria']) {
    const rows = (await db.table(nome).toArray()).map(({ localId: _l, ...r }) => r).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    partes.push(`${nome}:${createHash('sha256').update(JSON.stringify(rows)).digest('hex')}`);
  }
  return partes.join('|');
};
const saldo = async () => (await ops.getInventory({ from: '2026-01-01', to: '2026-12-31' })).saldo_final;

const entrada = (id, numero, peso, { data = '2026-03-01', aplicacoes = [] } = {}) => ops.registerLaunchOperation({
  id, tipo: 'ENTRADA', subtipo: 'COMPRA', data, aceitarAvisos: peso == null,
  item: { numero_animal: numero, marca_id: 'MK', sexo: 'M', peso_kg: peso, peso_origem: peso ? 'MANUAL' : null },
  pesagem: { empresa_id: 'local', marca: 'ALFA', marca_id: 'MK', sexo: 'M', numero_animal: numero, peso, peso_origem: 'MANUAL', aplicacoes_sanidade: aplicacoes },
});
const venda = (id, animalId, numero, peso, data = '2026-04-01') => ops.registerLaunchOperation({
  id, tipo: 'SAIDA', subtipo: 'VENDA', data, item: { animal_id: animalId, peso_kg: peso, peso_origem: 'MANUAL' },
  pesagem: { empresa_id: 'local', animal_id: animalId, numero_animal: numero, peso, peso_origem: 'MANUAL' },
});
const resumo = [];

// T02 — exclusão direta recusada (Entrada e Saída vinculadas)
const e1 = await entrada('op-e1', '101', 300);
const s1 = await venda('op-s1', e1.itens[0].animal_id, '101', 360);
let antes = await impressao();
for (const [rotulo, fn] of [
  ['bulkDeleteEntries(Entrada)', () => weighing.bulkDeleteEntries([e1.itens[0].pesagem_id])],
  ['deleteEntry(Saída)', () => weighing.deleteEntry(s1.itens[0].pesagem_id)],
  ['deleteEntriesRespectingHistory(Saída)', async () => deleteEntriesRespectingHistory({ entries: await weighing.listEntries({}), ids: [s1.itens[0].pesagem_id] })],
]) {
  const e = await erroDe(fn);
  assert.equal(e?.code, 'PESAGEM_VINCULADA_OPERACAO', `${rotulo}: recusado com código estável`);
  assert.match(e.message, /operação confirmada/);
}
assert.equal(await impressao(), antes, 'T02: nada mudou no banco');
resumo.push('T02 exclusão direta de Entrada/Saída vinculada (bulkDeleteEntries, deleteEntry, Relação) recusada com PESAGEM_VINCULADA_OPERACAO; banco idêntico');

// T03 — lista mista: tudo ou nada
const e2 = await entrada('op-e2', '102', 280);
const manejo = await weighing.createEntry({ empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-03-10', animal_id: e2.itens[0].animal_id, numero_animal: '102', marca: 'ALFA', peso: 300 });
const e3 = await entrada('op-e3', '103', 290);
antes = await impressao();
const mista = await erroDe(() => weighing.bulkDeleteEntries([manejo.id, e3.itens[0].pesagem_id]));
assert.equal(mista?.code, 'PESAGEM_VINCULADA_OPERACAO');
assert.equal(await impressao(), antes, 'T03: as duas pesagens intactas');
resumo.push('T03 lista mista [Manejo, vinculada] recusada inteira; as duas intactas');

// T04 — cancelamento canônico de Saída e de Entrada (com aplicação de sanidade)
const saldoAntes = await saldo();
let c = await ops.cancelOperation('op-s1', { motivo: 'Venda lançada errada (teste)' });
assert.equal(c.operacao.status, 'CANCELADA');
assert.equal(c.itens[0].status, 'CANCELADO');
assert.ok(c.itens[0].pesagem_cancelada, 'pesagem da saída cancelada');
assert.equal((await ativos('movimentosAnimais', (m) => m.animal_id === e1.itens[0].animal_id && m.natureza === 'SAIDA')).length, 0, 'movimento de saída fora do livro');
assert.equal((await db.table('animais').where('id').equals(e1.itens[0].animal_id).first()).situacao, 'ATIVO', 'animal volta ao rebanho');
assert.equal(await saldo(), saldoAntes + 1, 'inventário: saldo volta');
const med = await sanity.saveMedicamento({ nome: 'PRODUTO SINTETICO CANCELAMENTO (TESTE)', unidade_padrao: 'ml' });
const e4 = await entrada('op-e4', '104', 270, { aplicacoes: [{ medicamento_id: med.id, dose: 3, unidade: 'ml' }] });
const animal4 = e4.itens[0].animal_id;
c = await ops.cancelOperation('op-e4', { motivo: 'Entrada lançada errada (teste)' });
assert.equal(c.operacao.status, 'CANCELADA');
assert.equal((await ativos('pesagens', (p) => p.animal_id === animal4)).length, 0, 'pesagem da entrada cancelada');
assert.equal((await ativos('movimentosAnimais', (m) => m.animal_id === animal4)).length, 0, 'movimento da entrada fora do livro');
assert.equal((await ativos('aplicacoesSanidade', (a) => a.animal_id === animal4 && !a.cancelled_at)).length, 0, 'aplicação da pesagem cancelada');
assert.ok((await db.table('animais').where('id').equals(animal4).first()).deleted_at, 'animal sem nenhum fato sai junto');
const auditCancel = await ativos('auditoria', (a) => a.entidade_id === 'op-e4' && a.acao === 'CANCELAR');
// No Lançamento a operação e a pesagem têm o mesmo id (o ciclo): uma linha de auditoria CANCELAR para cada uma.
assert.deepEqual(auditCancel.map((a) => a.entidade).sort(), ['operacoes', 'pesagens'], 'auditoria do cancelamento (operação e pesagem)');
assert.ok(auditCancel.every((a) => /Entrada lançada errada/.test(a.motivo)), 'motivo na auditoria');
// Sem órfãos: nenhum movimento/aplicação ativo aponta para pesagem cancelada; nenhum item confirmado sem pesagem viva.
const pesagensVivas = new Set((await ativos('pesagens')).map((p) => p.id));
assert.ok((await ativos('movimentosAnimais', (m) => m.pesagem_id)).every((m) => pesagensVivas.has(m.pesagem_id)), 'nenhum movimento órfão');
assert.ok((await ativos('aplicacoesSanidade', (a) => !a.cancelled_at && a.pesagem_id)).every((a) => pesagensVivas.has(a.pesagem_id)), 'nenhuma aplicação órfã');
const opsConfirmadas = new Set((await ativos('operacoes', (o) => o.status === 'CONFIRMADA')).map((o) => o.id));
assert.ok((await ativos('operacaoItens', (i) => opsConfirmadas.has(i.operacao_id) && i.status === 'CONFIRMADO' && i.pesagem_id)).every((i) => pesagensVivas.has(i.pesagem_id)), 'nenhum item confirmado sem a pesagem');
resumo.push('T04 cancelOperation de Saída e de Entrada (com aplicação): operação/item cancelados, pesagem, movimento e aplicação fora, saldo de volta, auditoria; sem órfãos');

// T05 — operação de vários animais (Rebanho › Entradas)
const multi = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-03-02', itens: [1, 2].map((n) => ({ numero_animal: `20${n}`, marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
const multiConf = await ops.confirmOperation(multi.operacao.id);
const pesMulti = multiConf.itens.map((i) => i.pesagem_id);
const vinculoMulti = await ops.findOperationOfEntry(pesMulti[0]);
assert.equal(vinculoMulti.quantidade, 2, 'a tela sabe que a operação tem 2 animais (bloqueia o cancelamento por ali)');
antes = await impressao();
assert.equal((await erroDe(async () => deleteEntriesRespectingHistory({ entries: await weighing.listEntries({}), ids: [pesMulti[0]] })))?.code, 'PESAGEM_VINCULADA_OPERACAO', 'Relação não exclui um animal só');
assert.equal(await impressao(), antes);
c = await ops.cancelOperation(multi.operacao.id, { motivo: 'Compra duplicada (teste)' });
assert.equal(c.operacao.status, 'CANCELADA');
assert.equal((await ativos('pesagens', (p) => pesMulti.includes(p.id))).length, 0, 'as duas pesagens saem pelo cancelamento canônico');
resumo.push('T05 operação de 2 animais: exclusão de um só recusada (Relação/Lançamento); cancelamento canônico da operação inteira funciona');

// T06 — Entrada sem peso → 1ª pesagem adotada
const e6 = await entrada('op-e6', '106', null);
const primeira = await weighing.createEntry({ empresa_id: 'local', tipo_manejo: 'Cadastro', data_pesagem: '2026-03-05', numero_animal: '106', marca: 'ALFA', marca_id: 'MK', sexo: 'M', peso: 240, animal_id: crypto.randomUUID() });
assert.equal((await ops.getOperation('op-e6')).itens[0].pesagem_id, primeira.id, 'item aponta para a 1ª pesagem');
antes = await impressao();
assert.equal((await erroDe(() => weighing.deleteEntry(primeira.id)))?.code, 'PESAGEM_VINCULADA_OPERACAO', 'a 1ª pesagem não sai sozinha');
assert.equal(await impressao(), antes);
const depois = await weighing.createEntry({ empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-03-20', animal_id: e6.itens[0].animal_id, numero_animal: '106', marca: 'ALFA', peso: 260 });
assert.equal((await erroDe(() => ops.cancelOperation('op-e6', { motivo: 'teste de cronologia' })))?.code, 'OPERACAO_CRONOLOGIA', 'com Manejo depois, a entrada não se cancela');
assert.equal(await weighing.deleteEntry(depois.id), 1, 'o Manejo (sem operação) sai normalmente');
c = await ops.cancelOperation('op-e6', { motivo: 'Entrada lançada errada (teste)' });
assert.equal(c.operacao.status, 'CANCELADA');
assert.ok((await db.table('pesagens').where('id').equals(primeira.id).first()).deleted_at, 'a 1ª pesagem sai junto com a operação');
resumo.push('T06 Entrada sem peso + 1ª pesagem adotada: exclusão isolada recusada; com Manejo depois o cancelamento respeita a cronologia; sem ele, cancela tudo');

// T07 — Manejo sem operação: exclusão e repesagem
const e7 = await entrada('op-e7', '107', 300);
const m1 = await weighing.createEntry({ empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-05-01', animal_id: e7.itens[0].animal_id, numero_animal: '107', marca: 'ALFA', peso: 320 });
const repesada = await weighing.replaceSameDayEntry([m1.id], { empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-05-01', animal_id: e7.itens[0].animal_id, numero_animal: '107', marca: 'ALFA', peso: 325 });
assert.ok(repesada?.id && repesada.id !== m1.id, 'repesagem do Manejo funciona');
assert.equal(await weighing.deleteEntry(repesada.id), 1, 'exclusão de Manejo sem operação funciona');
resumo.push('T07 Manejo sem operação: repesagem e exclusão continuam funcionando');

// T08 — erro injetado no meio do cancelamento canônico → rollback integral; nova tentativa segura
const e8 = await entrada('op-e8', '108', 310);
antes = await impressao();
const falhar = function falharNoMovimento() { throw new Error('falha injetada no cancelamento (teste)'); };
db.table('movimentosAnimais').hook('updating', falhar);
const falhou = await erroDe(() => ops.cancelOperation('op-e8', { motivo: 'teste de rollback' }));
db.table('movimentosAnimais').hook('updating').unsubscribe(falhar);
assert.match(String(falhou?.message), /falha injetada/);
assert.equal(await impressao(), antes, 'T08: banco idêntico ao de antes (rollback integral)');
const op8 = await ops.getOperation('op-e8');
assert.deepEqual([op8.operacao.status, op8.itens[0].status], ['CONFIRMADA', 'CONFIRMADO'], 'sem item cancelado com operação confirmada');
c = await ops.cancelOperation('op-e8', { motivo: 'nova tentativa (teste)' });
assert.equal(c.operacao.status, 'CANCELADA', 'nova tentativa cancela normalmente');
resumo.push('T08 erro injetado no meio do cancelamento: rollback integral (impressão igual), item e operação seguem confirmados; nova tentativa cancela');

// T09 — permissões
const e9 = await entrada('op-e9', '109', 300);
antes = await impressao();
await como('CONSULTA', async () => {
  assert.equal((await erroDe(() => ops.cancelOperation('op-e9', { motivo: 'sem permissão' })))?.code, 'AUTH_FORBIDDEN', 'CONSULTA não cancela');
  assert.equal((await erroDe(() => weighing.deleteEntry(manejo.id)))?.code, 'AUTH_FORBIDDEN', 'CONSULTA não exclui');
});
await como(null, async () => {
  assert.ok(await erroDe(() => ops.cancelOperation('op-e9', { motivo: 'sem sessão' })), 'sem sessão: nada');
});
assert.equal(await impressao(), antes, 'T09: nada mudou');
await como('OPERADOR', async () => {
  assert.equal((await ops.cancelOperation('op-e9', { motivo: 'operador com weighing.edit' })).operacao.status, 'CANCELADA', 'OPERADOR (weighing.edit) cancela pelo caminho canônico');
});
resumo.push('T09 permissões: CONSULTA e sem sessão não cancelam nem excluem (banco igual); OPERADOR cancela pelo caminho canônico');

console.log('OK verify-launch-cancel-safety');
console.log(JSON.stringify(resumo, null, 2));
