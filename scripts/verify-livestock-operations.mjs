// Gate livestock:operations:verify — missão pesagens-integrada, checkpoint B1a (F01, F02, F03, F17).
// Comportamento real (fake-indexeddb + serviços reais):
//   F01 Entrada (Compra) com e sem peso: 1 movimento de ENTRADA por animal, sem peso 0, PENDENTE_PESAGEM; o
//       Cadastro posterior do pendente ADOTA a entrada (saldo +1, não +2); identificação em uso recusada sem gravar;
//       Nascimento com mãe; conferência com avisos exige ciência.
//   F02 Saída: Venda exige peso; Morte sem peso não vira 0 kg; uma saída por animal; operação inteira atômica;
//       Ajuste exige justificativa; cancelamento reabre o animal.
//   F03 Movimentação de lote sem pesagem: pesagem seguinte no lote novo não gera 2ª "Mudança de lote";
//       reconciliação idempotente; mudança de propriedade.
//   F17 Inventário: saldo_inicial + entradas − saídas = saldo_final, por período/lote/propriedade, conferência
//       pelo cadastro; cancelados não contam.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as weighingAdapter from '../src/modules/weighing/infrastructure/weighingDataAdapter.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';

await deleteDbForTests();
const db = await storage.ensureReady();
const resumo = [];
const ok = (regra) => resumo.push(regra);
const TS = '2026-01-01T00:00:00.000Z';
const base = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
const ativos = async (table, filtro = () => true) => (await db.table(table).toArray()).filter((row) => !row.deleted_at && filtro(row));
const counts = async () => Object.fromEntries(await Promise.all(['operacoes', 'operacaoItens', 'animais', 'movimentosAnimais', 'pesagens', 'animalIdentificadores', 'animalLotes'].map(async (t) => [t, await db.table(t).count()])));
const animalPorNumero = async (numero) => (await ativos('animais', (row) => row.numero_animal === numero))[0];
const entradasDe = async (animalId) => ativos('movimentosAnimais', (row) => row.animal_id === animalId && row.natureza === 'ENTRADA');

// Cadastros mestres mínimos.
await db.table('marcas').add({ ...base, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
await db.table('racas').add({ ...base, id: 'NEL', nome: 'Nelore', nome_normalizado: 'NELORE', ativo: true });
await db.table('propriedades').bulkAdd([
  { ...base, id: 'P1', nome: 'Fazenda Um', nome_normalizado: 'FAZENDA UM', ativo: true, padrao: true },
  { ...base, id: 'P2', nome: 'Fazenda Dois', nome_normalizado: 'FAZENDA DOIS', ativo: true },
]);
await db.table('parceiros').add({ ...base, id: 'PARC', nome: 'Comprador Sul', nome_normalizado: 'COMPRADOR SUL', ativo: true });
await db.table('apartacoes').add({ ...base, id: 'AP', nome: 'AP', data: '2026-01-01' });
for (const id of ['L1', 'L2']) await db.table('loteApartacoes').add({ ...base, id, apartacao_id: 'AP', nome_lote: id, situacao: 'ABERTO' });

// ---------------------------------------------------------------------------
// F01 — Compra de 3 animais (2 pesados, 1 sem peso), lote L1.
const compra = await ops.saveDraft({
  tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', quantidade_prevista: 3, parceiro_id: 'PARC',
  propriedade_destino_id: 'P1', lote_destino_id: 'L1', gta_numero: '123', valor_total: '9.000,00',
  itens: [
    { numero_animal: '101', marca_id: 'MK', sexo: 'M', raca_id: 'NEL', peso: '210', peso_origem: 'BALANCA', valor: 3000 },
    { numero_animal: '102', marca_id: 'MK', sexo: 'F', raca_id: 'NEL', peso: 195, valor: 3000 },
    { numero_animal: '103', marca_id: 'MK', sexo: 'M', valor: 3000 },
  ],
});
assert.equal(compra.operacao.status, 'RASCUNHO');
assert.equal(compra.resumo.quantidade, 3);
assert.equal(compra.resumo.peso_total_kg, 405);
assert.equal(compra.resumo.sem_peso, 1);
let antes = await counts();
await assert.rejects(ops.confirmOperation(compra.operacao.id), (err) => err.code === 'OPERACAO_AVISOS' && err.conferencia.avisos.some((a) => /sem peso/.test(a)));
assert.deepEqual(await counts(), antes, 'avisos sem ciência: nada gravado');
const confirmada = await ops.confirmOperation(compra.operacao.id, { aceitarAvisos: true });
assert.equal(confirmada.operacao.status, 'CONFIRMADA');
const a101 = await animalPorNumero('101');
const a102 = await animalPorNumero('102');
const a103 = await animalPorNumero('103');
for (const animal of [a101, a102, a103]) {
  const entradas = await entradasDe(animal.id);
  assert.equal(entradas.length, 1, `uma entrada para ${animal.numero_animal}`);
  assert.equal(entradas[0].tipo, 'Compra');
  assert.equal(entradas[0].operacao_id, compra.operacao.id);
  assert.equal(animal.lote_atual_id, 'L1');
  assert.equal(animal.propriedade_id, 'P1');
}
assert.equal(a101.situacao_cadastro, 'OK');
assert.equal(a103.situacao_cadastro, 'PENDENTE_PESAGEM');
assert.equal(a103.ultimo_peso_kg ?? null, null, 'sem peso inventado');
const cadastros = await ativos('pesagens', (row) => row.legacy_payload?.operacao_id === compra.operacao.id);
assert.equal(cadastros.length, 2, 'só os pesados geram Cadastro');
assert.ok(cadastros.every((row) => row.peso_kg > 0));
assert.equal(cadastros.find((row) => row.animal_id === a101.id).legacy_payload.peso_origem, 'BALANCA');
assert.equal((await ativos('animalIdentificadores', (row) => row.animal_id === a103.id)).length, 1, 'identificador visual do pendente');
ok('F01 Compra: 1 entrada por animal, Cadastro só com peso, pendente sem 0 kg');

// O primeiro Cadastro do pendente (Lançamento) adota a entrada da operação.
await weighingService.createEntry({ tipo_manejo: 'Cadastro', numero_animal: '103', marca: 'ALFA', sexo: 'M', data_pesagem: '2026-02-03', peso: 205, lote_id: 'L1' });
assert.equal((await ativos('animais', (row) => row.numero_animal === '103')).length, 1, 'não cria segundo animal');
assert.equal((await entradasDe(a103.id)).length, 1, 'saldo +1, não +2');
assert.equal((await entradasDe(a103.id))[0].tipo, 'Compra');
assert.equal((await animalPorNumero('103')).situacao_cadastro, 'OK');
// Reconciliação seguinte não duplica a entrada adotada.
await weighingAdapter.reconcileAllAnimalDerivations();
assert.equal((await entradasDe(a103.id)).length, 1, 'reconciliação mantém uma entrada');
ok('F01 Cadastro posterior adota a entrada (sem 2º animal nem 2ª entrada)');

// Identificação em uso: recusada sem gravar nada.
const repetida = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-05', itens: [{ numero_animal: '101', marca_id: 'MK', sexo: 'M', peso: 200 }] });
antes = await counts();
await assert.rejects(ops.confirmOperation(repetida.operacao.id, { aceitarAvisos: true }), (err) => err.code === 'IDENTIFICACAO_EM_USO');
assert.deepEqual(await counts(), antes, 'colisão: nada gravado');
await ops.discardDraft(repetida.operacao.id);
// Repetida dentro da própria operação: bloqueio na conferência.
const dupla = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-05', itens: [{ numero_animal: '900', marca_id: 'MK', sexo: 'M' }, { numero_animal: '900', marca_id: 'MK', sexo: 'F' }] });
assert.equal(dupla.conferencia.ok, false);
await assert.rejects(ops.confirmOperation(dupla.operacao.id, { aceitarAvisos: true }), (err) => err.code === 'OPERACAO_CONFERENCIA');
await ops.discardDraft(dupla.operacao.id);
ok('F01 identificação em uso / repetida recusada sem gravar');

// Nascimento com mãe (sem peso).
const nasc = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'NASCIMENTO', data: '2026-02-10', propriedade_destino_id: 'P1', itens: [{ numero_animal: '201', marca_id: 'MK', sexo: 'F', mae_animal_id: a102.id }] });
await ops.confirmOperation(nasc.operacao.id, { aceitarAvisos: true });
const bezerra = await animalPorNumero('201');
assert.equal(bezerra.mae_animal_id, a102.id);
assert.equal(bezerra.nascimento_data, '2026-02-10');
assert.equal(bezerra.nascimento_precisao, 'DIA');
assert.equal((await entradasDe(bezerra.id))[0].tipo, 'Nascimento');
ok('F01 Nascimento com mãe e data de nascimento exata (fonte: operação)');

// ---------------------------------------------------------------------------
// F03 — Movimentação L1 → L2 do 101 em 01/03; Manejo no L2 em 10/03 não gera 2ª mudança de lote.
const mov = await ops.saveDraft({ tipo: 'MOVIMENTACAO', subtipo: 'MUDANCA_LOTE', data: '2026-03-01', lote_destino_id: 'L2', itens: [{ animal_id: a101.id }] });
await ops.confirmOperation(mov.operacao.id);
let internas = await ativos('movimentosAnimais', (row) => row.animal_id === a101.id && row.natureza === 'INTERNA');
assert.equal(internas.length, 1);
assert.deepEqual([internas[0].lote_origem_id, internas[0].lote_destino_id, internas[0].pesagem_id], ['L1', 'L2', null]);
assert.equal((await animalPorNumero('101')).lote_atual_id, 'L2');
await weighingService.createEntry({ tipo_manejo: 'Manejo', animal_id: a101.id, numero_animal: '101', marca: 'ALFA', data_pesagem: '2026-03-10', peso: 240, lote_id: 'L2' });
internas = await ativos('movimentosAnimais', (row) => row.animal_id === a101.id && row.natureza === 'INTERNA');
assert.equal(internas.length, 1, 'pesagem no lote novo não duplica a mudança de lote');
const stays = (await ativos('animalLotes', (row) => row.animal_id === a101.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));
assert.deepEqual(stays.map((s) => [s.lote_id, s.inicio, s.fim]), [['L1', '2026-02-01', '2026-03-01'], ['L2', '2026-03-01', null]]);
antes = await counts();
await weighingAdapter.reconcileAllAnimalDerivations();
assert.deepEqual(await counts(), antes, 'reconciliação idempotente com movimentação');
// Mesmo lote: recusado.
const mesmo = await ops.saveDraft({ tipo: 'MOVIMENTACAO', subtipo: 'MUDANCA_LOTE', data: '2026-03-11', lote_destino_id: 'L2', itens: [{ animal_id: a101.id }] });
await assert.rejects(ops.confirmOperation(mesmo.operacao.id), /já está nesse lote/);
await ops.discardDraft(mesmo.operacao.id);
ok('F03 movimentação de lote sem pesagem; projeção não desfaz; idempotente');

// Mudança de propriedade P1 → P2 do 102.
const prop = await ops.saveDraft({ tipo: 'MOVIMENTACAO', subtipo: 'MUDANCA_PROPRIEDADE', data: '2026-03-05', propriedade_destino_id: 'P2', itens: [{ animal_id: a102.id }] });
await ops.confirmOperation(prop.operacao.id);
assert.equal((await animalPorNumero('102')).propriedade_id, 'P2');
ok('F03 mudança de propriedade');

// ---------------------------------------------------------------------------
// F02 — Venda exige peso; atômica; Morte sem peso; uma saída por animal.
await assert.rejects(ops.saveDraft({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-04-01', itens: [{ animal_id: a101.id }] }), /exige o peso/);
const venda = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-04-01', parceiro_id: 'PARC', itens: [{ animal_id: a101.id, peso: 250, valor: 4000 }] });
await ops.confirmOperation(venda.operacao.id);
const vendido = await animalPorNumero('101');
assert.equal(vendido.situacao, 'VENDIDO');
const saidaVenda = await ativos('pesagens', (row) => row.legacy_payload?.operacao_id === venda.operacao.id);
assert.equal(saidaVenda.length, 1);
assert.equal(saidaVenda[0].legacy_payload.motivo_saida, 'Venda');
assert.equal(saidaVenda[0].legacy_payload.comprador, 'Comprador Sul');
const saidasMov = await ativos('movimentosAnimais', (row) => row.animal_id === a101.id && row.natureza === 'SAIDA');
assert.equal(saidasMov.length, 1);
assert.equal(saidasMov[0].operacao_id, venda.operacao.id);
ok('F02 Venda com peso: 1 pesagem de Saída e 1 movimento SAIDA ligados à operação');

// Atômica: [103 (ativo), 101 (já vendido)] → nada muda.
const atomica = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'MORTE', data: '2026-04-05', itens: [{ animal_id: a103.id }, { animal_id: a101.id }] });
antes = await counts();
await assert.rejects(ops.confirmOperation(atomica.operacao.id), /já saiu do rebanho/);
assert.deepEqual(await counts(), antes, 'falha no 2º animal: nada gravado');
assert.equal((await animalPorNumero('103')).situacao, 'ATIVO');
await ops.discardDraft(atomica.operacao.id);
ok('F02 operação atômica (um animal inválido desfaz tudo)');

// Morte sem peso.
const morte = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'MORTE', data: '2026-04-05', itens: [{ animal_id: a103.id }] });
await ops.confirmOperation(morte.operacao.id);
const saidaMorte = (await ativos('pesagens', (row) => row.legacy_payload?.operacao_id === morte.operacao.id))[0];
assert.equal(saidaMorte.peso_kg, null, 'morte sem peso não vira 0 kg');
assert.equal((await animalPorNumero('103')).situacao, 'MORTO');
ok('F02 Morte sem peso (nulo, não 0)');

// Ajuste de saída exige justificativa.
await assert.rejects(ops.saveDraft({ tipo: 'SAIDA', subtipo: 'AJUSTE_SAIDA', data: '2026-04-06', itens: [{ animal_id: bezerra.id }] }), /justificativa/);
const ajuste = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'AJUSTE_SAIDA', data: '2026-04-06', observacao: 'Animal não encontrado na contagem física', itens: [{ animal_id: bezerra.id }] });
await ops.confirmOperation(ajuste.operacao.id);
assert.equal((await ativos('pesagens', (row) => row.legacy_payload?.operacao_id === ajuste.operacao.id))[0].legacy_payload.motivo_saida, 'Outros');
ok('F02 Ajuste de inventário exige justificativa');

// ---------------------------------------------------------------------------
// F17 — Inventário de fevereiro a abril.
let inv = await ops.getInventory({ from: '2026-02-01', to: '2026-04-30' });
assert.equal(inv.saldo_inicial, 0);
assert.equal(inv.entradas.por_classe.COMPRA, 3);
assert.equal(inv.entradas.por_classe.NASCIMENTO, 1);
assert.equal(inv.saidas.por_classe.VENDA, 1);
assert.equal(inv.saidas.por_classe.MORTE, 1);
assert.equal(inv.saidas.por_classe.AJUSTE_SAIDA, 1);
assert.equal(inv.saldo_final, 1, '0 + 3 + 1 − 1 − 1 − 1');
assert.equal(inv.conferencia.fecha, true, JSON.stringify(inv.conferencia));
assert.deepEqual(inv.animais_no_saldo_final.map((a) => a.numero_animal), ['102']);
// Saldo em 15/03 (antes das saídas): 4 animais.
inv = await ops.getInventory({ from: '2026-03-16', to: '2026-03-31' });
assert.equal(inv.saldo_inicial, 4);
assert.equal(inv.saldo_final, 4);
// Por lote L2 em março: 1 transferência interna recebida (não é compra).
inv = await ops.getInventory({ from: '2026-03-01', to: '2026-03-31', filtros: { lote_id: 'L2' } });
assert.equal(inv.internas.recebidas, 1);
assert.equal(inv.entradas.total, 0);
assert.equal(inv.saldo_final, 1);
// Por propriedade P1 em março: 102 foi para P2 (enviada interna).
inv = await ops.getInventory({ from: '2026-03-01', to: '2026-03-31', filtros: { propriedade_id: 'P1' } });
assert.equal(inv.saldo_inicial, 4);
assert.equal(inv.internas.enviadas, 1);
assert.equal(inv.saldo_final, 3);
// Por sexo: fêmeas em fev–abr: 102 + 201 entraram, 201 ajustada.
inv = await ops.getInventory({ from: '2026-02-01', to: '2026-04-30', filtros: { sexo: 'F' } });
assert.equal(inv.saldo_final, 1);
ok('F17 inventário: saldo inicial + entradas − saídas = final; lote/propriedade com internas; conferência fecha');

// Cancelar a venda reabre o 101 e o inventário volta a contá-lo.
await assert.rejects(ops.cancelOperation(venda.operacao.id, {}), /motivo/);
await ops.cancelOperation(venda.operacao.id, { motivo: 'Venda desfeita pelo comprador' });
assert.equal((await animalPorNumero('101')).situacao, 'ATIVO');
assert.equal((await ativos('movimentosAnimais', (row) => row.animal_id === a101.id && row.natureza === 'SAIDA')).length, 0);
inv = await ops.getInventory({ from: '2026-02-01', to: '2026-04-30' });
assert.equal(inv.saidas.por_classe.VENDA, 0, 'cancelado não conta');
assert.equal(inv.saldo_final, 2);
assert.equal(inv.conferencia.fecha, true);
ok('F02 cancelamento com motivo reabre o animal; inventário não conta cancelado');

// Cancelar Entrada com pesagens posteriores: recusado. Entrada sem nada depois: animal sai junto.
await assert.rejects(ops.cancelOperation(compra.operacao.id, { motivo: 'Erro' }), /pesagens ou movimentações depois/);
const avulsa = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'TRANSFERENCIA_RECEBIDA', data: '2026-04-10', itens: [{ numero_animal: '301', marca_id: 'MK', sexo: 'M' }] });
await ops.confirmOperation(avulsa.operacao.id, { aceitarAvisos: true });
const a301 = await animalPorNumero('301');
await ops.cancelOperation(avulsa.operacao.id, { motivo: 'Lançada por engano' });
assert.equal(await animalPorNumero('301'), undefined, 'animal da entrada cancelada sai do rebanho');
assert.equal((await entradasDe(a301.id)).length, 0);
inv = await ops.getInventory({ from: '2026-04-01', to: '2026-04-30' });
assert.equal(inv.entradas.por_classe.TRANSFERENCIA_RECEBIDA, 0);
ok('F01 cancelamento de entrada: bloqueado com histórico; sem histórico o animal sai junto');

// Operação legada não se cancela por aqui.
await db.table('operacoes').add({ ...base, id: 'LEG', tipo: 'ENTRADA', subtipo: 'LEGADO_CADASTRO', status: 'CONFIRMADA', data: '2026-01-01', origem: 'LEGADO' });
await assert.rejects(ops.cancelOperation('LEG', { motivo: 'teste' }), (err) => err.code === 'OPERACAO_LEGADA');
await db.table('operacoes').where('id').equals('LEG').delete();

assert.deepEqual((await logicalIntegrity()).issues, [], 'integridade do banco');
ok('integridade lógica sem pendências');

await deleteDbForTests();
console.log('OK verify-livestock-operations');
console.log(JSON.stringify(resumo, null, 2));
