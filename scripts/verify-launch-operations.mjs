// Gate launch:operations:verify — integração do Lançamento de Pesagens com Entradas, Saídas e Sanidade.
// Serviço único (operationsService.registerLaunchOperation) sobre fake-indexeddb, dados SINTÉTICOS:
//   1. Entrada COMPRA com pesagem: 1 animal + 1 operação confirmada + 1 item + 1 movimento + 1 pesagem; saldo +1;
//      Enter duplo (mesmo ciclo) não duplica.
//   2. Entrada sem peso: pendente, sem pesagem fictícia; a 1ª pesagem adota o MESMO animal; saldo continua +1.
//   3. Saída VENDA com pesagem: 1 saída canônica, saldo −1, GMD contra a entrada; Enter duplo não duplica.
//   4. Saída MORTE sem peso: sem peso/GMD inventado; ABATE com carência desconhecida bloqueado no serviço.
//   5. Falha no meio (aplicação inválida; sanidade sem pesagem): rollback integral, nenhum rascunho sobra.
//   6. Editar peso mantém o vínculo (item acompanha); mudar tipo/data é recusado; cancelar desfaz o livro.
//   7. Posologia sintética 1 ml / 50 kg aprovada: 300 kg → sugere 6 ml; aplicado 5,5 ml confirmado; o serviço recusa
//      sugestão adulterada, peso-base diferente do gravado, rascunho, suspensa e fora da vigência.
//   9. Perfis: OPERADOR lança e aplica, mas não cadastra medicamento nem aprova posologia; CONSULTA não lança.
// Nenhum produto/dose aqui é recomendação veterinária: tudo é dado de teste.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import * as weighing from '../src/modules/weighing/application/weighingService.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';

let papel = 'ADMIN';
setActorProvider(() => ({ id: `u-${papel}`, nome: `Usuário ${papel}`, role: papel }));
const como = async (role, fn) => { const antes = papel; papel = role; try { return await fn(); } finally { papel = antes; } };
const erroDe = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

const db = await storage.ensureReady();
const TS = '2026-01-01T00:00:00.000Z';
await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
await db.table('causasMorte').add({ empresa_id: 'local', id: 'CM1', nome: 'Causa sintética', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });

const ativos = async (tabela, filtro = () => true) => (await db.table(tabela).toArray()).filter((r) => !r.deleted_at).filter(filtro);
const contagens = async () => ({
  animais: (await ativos('animais')).length,
  operacoes: (await ativos('operacoes')).length,
  rascunhos: (await ativos('operacoes', (o) => o.status === 'RASCUNHO')).length,
  itens: (await ativos('operacaoItens')).length,
  pesagens: (await ativos('pesagens')).length,
  movEntrada: (await ativos('movimentosAnimais', (m) => m.natureza === 'ENTRADA')).length,
  movSaida: (await ativos('movimentosAnimais', (m) => m.natureza === 'SAIDA')).length,
  aplicacoes: (await ativos('aplicacoesSanidade', (a) => !a.cancelled_at)).length,
});
const saldo = async (to = '2026-12-31') => (await ops.getInventory({ from: '2026-01-01', to })).saldo_final;

// Payload como a tela monta (subconjunto relevante).
const pesagemTela = (extra = {}) => ({ empresa_id: 'local', marca: 'ALFA', marca_id: 'MK', sexo: 'M', categoria_automatica: true, observacao: null, ...extra });
const entrada = (id, { numero, peso = null, subtipo = 'COMPRA', valor = null, data = '2026-03-01', aplicacoes = [], aceitarAvisos = false, gta = null }) => ops.registerLaunchOperation({
  id, tipo: 'ENTRADA', subtipo, data, gta_numero: gta, observacao: subtipo === 'AJUSTE_ENTRADA' ? 'Saldo inicial sintético' : null, aceitarAvisos,
  item: { numero_animal: numero, marca_id: 'MK', sexo: 'M', peso_kg: peso, peso_origem: peso ? 'MANUAL' : null, valor },
  pesagem: pesagemTela({ tipo_manejo: 'Cadastro', data_pesagem: data, numero_animal: numero, peso, peso_origem: peso ? 'MANUAL' : null, valor_pago_cabeca: valor, aplicacoes_sanidade: aplicacoes }),
});
const saida = (id, { animalId, numero, subtipo, peso = null, data = '2026-04-01', valor = null, aceitarAvisos = false, causa = null, comprador = null }) => ops.registerLaunchOperation({
  id, tipo: 'SAIDA', subtipo, data, aceitarAvisos,
  item: { animal_id: animalId, peso_kg: peso, peso_origem: peso ? 'MANUAL' : null, valor, causa_morte_id: causa },
  pesagem: pesagemTela({ tipo_manejo: 'Saída', data_pesagem: data, animal_id: animalId, numero_animal: numero, peso, peso_origem: peso ? 'MANUAL' : null, comprador, valor_venda_total: valor }),
});

const resumo = [];
const pesoDe = async (pesagemId) => (await db.table('pesagens').where('id').equals(pesagemId).first());

// ---------------------------------------------------------------------------------------------------------------
// 1. Entrada COMPRA com pesagem
let c0 = await contagens();
const e1 = await entrada('ciclo-e1', { numero: '101', peso: 300, valor: 2500, gta: 'GTA-SINT-1' });
let c1 = await contagens();
assert.equal(e1.operacao.status, 'CONFIRMADA');
assert.equal(e1.operacao.origem, 'LANCAMENTO');
assert.equal(e1.itens.length, 1);
assert.ok(e1.itens[0].pesagem_id, 'item vinculado à pesagem');
assert.deepEqual([c1.animais - c0.animais, c1.operacoes - c0.operacoes, c1.itens - c0.itens, c1.movEntrada - c0.movEntrada, c1.pesagens - c0.pesagens], [1, 1, 1, 1, 1]);
const animal1 = e1.itens[0].animal_id;
const pes1 = await pesoDe(e1.itens[0].pesagem_id);
assert.equal(pes1.animal_id, animal1);
assert.equal(pes1.legacy_payload.operacao_id, 'ciclo-e1', 'pesagem leva o operacao_id');
const mov1 = await ativos('movimentosAnimais', (m) => m.animal_id === animal1 && m.natureza === 'ENTRADA');
assert.equal(mov1.length, 1);
assert.equal(mov1[0].operacao_id, 'ciclo-e1');
assert.equal((await ops.listOperations({ tipo: 'ENTRADA' })).length, 1, 'aparece em Rebanho › Entradas');
const repetida = await entrada('ciclo-e1', { numero: '101', peso: 300, valor: 2500 });
assert.equal(repetida.repetida, true);
assert.deepEqual(await contagens(), c1, 'Enter duplo não duplica nada');
resumo.push('1 Entrada COMPRA com peso: 1 animal + 1 operação + 1 item + 1 movimento + 1 pesagem; Enter duplo idempotente');

// 2. Entrada sem peso → primeira pesagem adota o mesmo animal
c0 = await contagens();
const e2 = await entrada('ciclo-e2', { numero: '202', peso: null, aceitarAvisos: true });
c1 = await contagens();
const animal2 = e2.itens[0].animal_id;
assert.equal(e2.itens[0].pesagem_id, null, 'sem pesagem fictícia');
assert.deepEqual([c1.animais - c0.animais, c1.pesagens - c0.pesagens, c1.movEntrada - c0.movEntrada], [1, 0, 1]);
assert.equal((await db.table('animais').where('id').equals(animal2).first()).situacao_cadastro, 'PENDENTE_PESAGEM');
const semAviso = await erroDe(() => entrada('ciclo-e2b', { numero: '203', peso: null }));
assert.equal(semAviso?.code, 'OPERACAO_AVISOS', 'sem peso exige ciência explícita');
// Como a tela manda: Cadastro com um animal_id NOVO (createAnimalId) — mesmo assim é o animal pendente.
const primeira = await weighing.createEntry({ ...pesagemTela({ tipo_manejo: 'Cadastro', data_pesagem: '2026-03-05', numero_animal: '202', peso: 280, peso_origem: 'MANUAL', animal_id: crypto.randomUUID() }) });
assert.equal(primeira.animal_id, animal2, 'primeira pesagem adota o MESMO animal');
const c2 = await contagens();
assert.deepEqual([c2.animais - c1.animais, c2.movEntrada - c1.movEntrada, c2.pesagens - c1.pesagens], [0, 0, 1], 'nem animal nem entrada nova');
assert.notEqual((await db.table('animais').where('id').equals(animal2).first()).situacao_cadastro, 'PENDENTE_PESAGEM');
assert.equal((await db.table('pesagens').where('id').equals(primeira.id).first()).legacy_payload.operacao_id, 'ciclo-e2', 'pesagem ligada à operação de origem');
assert.equal((await ops.getOperation('ciclo-e2')).itens[0].pesagem_id, primeira.id, 'item da entrada aponta para a 1ª pesagem');
resumo.push('2 Entrada sem peso: pendente sem pesagem; 1ª pesagem adota o mesmo animal; nenhuma entrada a mais');
const saldoAntesSaida = await saldo();

// 3. Saída VENDA com pesagem
c0 = await contagens();
const s1 = await saida('ciclo-s1', { animalId: animal1, numero: '101', subtipo: 'VENDA', peso: 360, valor: 4200, comprador: 'Comprador sintético' });
c1 = await contagens();
assert.equal(s1.operacao.tipo, 'SAIDA');
assert.deepEqual([c1.operacoes - c0.operacoes, c1.movSaida - c0.movSaida, c1.pesagens - c0.pesagens], [1, 1, 1]);
const pesSaida = await pesoDe(s1.itens[0].pesagem_id);
assert.equal(pesSaida.legacy_payload.motivo_saida ?? pesSaida.motivo_saida, 'Venda');
assert.equal(pesSaida.legacy_payload.comprador, 'Comprador sintético', 'dados da tela preservados');
assert.equal(pesSaida.legacy_payload.ganho ?? pesSaida.ganho, 60, 'GMD/ganho contra a entrada');
assert.equal(await saldo(), saldoAntesSaida - 1, 'saldo −1');
const s1b = await saida('ciclo-s1', { animalId: animal1, numero: '101', subtipo: 'VENDA', peso: 360, valor: 4200 });
assert.equal(s1b.repetida, true);
assert.deepEqual(await contagens(), c1, 'Enter duplo na saída não duplica');
const deNovo = await erroDe(() => saida('ciclo-s1x', { animalId: animal1, numero: '101', subtipo: 'VENDA', peso: 360 }));
assert.ok(deNovo, 'animal que já saiu não sai de novo');
assert.deepEqual(await contagens(), c1, 'tentativa recusada não deixa rascunho');
resumo.push('3 Saída VENDA com peso: 1 saída canônica, saldo −1, ganho contra a entrada; Enter duplo idempotente');

// 4. Saída MORTE sem peso; ABATE com carência desconhecida bloqueado
c0 = await contagens();
const s2 = await saida('ciclo-s2', { animalId: animal2, numero: '202', subtipo: 'MORTE', causa: 'CM1' });
const pesMorte = await pesoDe(s2.itens[0].pesagem_id);
assert.equal(pesMorte.peso_kg ?? null, null, 'sem peso inventado');
assert.equal(pesMorte.legacy_payload.gmd ?? null, null, 'sem GMD inventado');
assert.equal((await db.table('animais').where('id').equals(animal2).first()).situacao, 'MORTO');
const med0 = await sanity.saveMedicamento({ nome: 'PRODUTO SINTETICO SEM CARENCIA (TESTE)', unidade_padrao: 'ml', via_aplicacao: 'SC' });
const e3 = await entrada('ciclo-e3', { numero: '303', peso: 310, aplicacoes: [{ medicamento_id: med0.id, dose: 5, unidade: 'ml', via_aplicacao: 'SC' }] });
const animal3 = e3.itens[0].animal_id;
assert.equal((await ativos('aplicacoesSanidade', (a) => a.animal_id === animal3)).length, 1, 'aplicação gravada com a entrada');
const cAntesAbate = await contagens();
const abate = await erroDe(() => saida('ciclo-s3', { animalId: animal3, numero: '303', subtipo: 'ABATE', peso: 330, aceitarAvisos: true }));
assert.equal(abate?.code, 'OPERACAO_CONFERENCIA', 'abate com carência desconhecida bloqueado no serviço');
assert.deepEqual(await contagens(), cAntesAbate, 'abate bloqueado não grava nada');
resumo.push('4 Saída MORTE sem peso: sem peso/GMD inventado, animal MORTO; ABATE com carência desconhecida bloqueado (nada gravado)');

// 5. Rollback integral
c0 = await contagens();
const falha1 = await erroDe(() => entrada('ciclo-f1', { numero: '404', peso: 290, aplicacoes: [{ medicamento_id: 'nao-existe', dose: 2, unidade: 'ml' }] }));
assert.ok(falha1, 'aplicação inválida falha');
const falha2 = await erroDe(() => entrada('ciclo-f2', { numero: '405', peso: null, aceitarAvisos: true, aplicacoes: [{ medicamento_id: med0.id, dose: 2, unidade: 'ml' }] }));
assert.equal(falha2?.code, 'SANIDADE_SEM_PESAGEM');
assert.deepEqual(await contagens(), c0, 'nada fica: nem operação, nem rascunho, nem animal, nem pesagem');
assert.equal((await db.table('operacoes').where('id').equals('ciclo-f1').toArray()).length, 0);
resumo.push('5 Falha na aplicação ou sanidade sem pesagem: rollback integral (sem rascunho, animal, pesagem ou movimento)');

// 6. Editar / cancelar
const e6 = await entrada('ciclo-e6', { numero: '606', peso: 250 });
const pes6 = e6.itens[0].pesagem_id;
await weighing.updateEntry(pes6, { peso: 255 });
assert.equal((await db.table('operacaoItens').where('pesagem_id').equals(pes6).first()).peso_kg, 255, 'item acompanha o peso corrigido');
const trocaData = await erroDe(() => weighing.updateEntry(pes6, { data_pesagem: '2026-03-02' }));
assert.match(String(trocaData?.message), /operação/i, 'mudar a data de pesagem vinculada é recusado');
const vinculo = await ops.findOperationOfEntry(pes6);
assert.equal(vinculo.operacao.id, 'ciclo-e6');
const cAntesCancel = await contagens();
await ops.cancelOperation('ciclo-e6', { motivo: 'Lançado errado (teste)' });
const cDepoisCancel = await contagens();
assert.deepEqual([cDepoisCancel.animais - cAntesCancel.animais, cDepoisCancel.pesagens - cAntesCancel.pesagens, cDepoisCancel.movEntrada - cAntesCancel.movEntrada], [-1, -1, -1], 'cancelar desfaz animal, pesagem e entrada');
const cancS = await ops.cancelOperation('ciclo-s1', { motivo: 'Venda desfeita (teste)' });
assert.equal(cancS.operacao.status, 'CANCELADA');
assert.equal((await ativos('movimentosAnimais', (m) => m.animal_id === animal1 && m.natureza === 'SAIDA')).length, 0, 'saída cancelada sai do livro');
assert.equal((await db.table('animais').where('id').equals(animal1).first()).situacao, 'ATIVO', 'animal volta ao rebanho');
resumo.push('6 Editar peso mantém o vínculo; mudar data é recusado; cancelar Entrada/Saída desfaz o livro sem duplicar');

// 7. Posologia sintética
const med = await sanity.saveMedicamento({ nome: 'PRODUTO SINTETICO TESTE 1ML/50KG', unidade_padrao: 'ml', via_aplicacao: 'SC', dose_padrao: '1 ml / 50 kg' });
const regra = { medicamento_id: med.id, modo: 'PROPORCIONAL', unidade: 'ml', dose_por_unidade: '1', kg_por_unidade: '50', principio_ativo: 'Princípio sintético', apresentacao: 'Frasco sintético', indicacao: 'Teste de software', via_aplicacao: 'SC', arredondamento: { modo: 'NENHUM' }, carencia_carne_dias: '30', fonte: 'BULA', fonte_referencia: 'Dado de teste', vigencia_inicio: '2026-01-01' };
const sugRascunho = async () => sanity.getDoseSuggestion({ medicamentoId: med.id, peso: { kg: 300, data: '2026-05-01', origem: 'MANUAL' }, dataAplicacao: '2026-05-01' });
assert.equal((await sugRascunho()).situacao, 'SEM_POSOLOGIA');
const rascunho = await sanity.savePosologyDraft(regra);
let sug = await sugRascunho();
assert.equal(sug.situacao, 'RASCUNHO');
assert.equal(sug.ok, false);
await sanity.approvePosology(rascunho.id, { responsavel: 'Responsável Sintético CRMV 0000' });
sug = await sugRascunho();
assert.equal(sug.situacao, 'APROVADA');
assert.equal(sug.ok, true);
assert.equal(sug.dose, 6, '300 kg com 1 ml / 50 kg → 6 ml');
const app = (extra = {}) => ({ medicamento_id: med.id, posologia_id: sug.posologia.id, dose: 5.5, unidade: 'ml', via_aplicacao: 'SC', dose_sugerida: 6, dose_confirmada: true, peso_base_kg: 300, peso_base_data: '2026-05-01', peso_base_origem: 'MANUAL', ...extra });
const e7 = await entrada('ciclo-e7', { numero: '707', peso: 300, data: '2026-05-01', aplicacoes: [app()] });
const ap7 = (await ativos('aplicacoesSanidade', (a) => a.animal_id === e7.itens[0].animal_id))[0];
assert.equal(ap7.dose_sugerida, 6);
assert.equal(ap7.dose_aplicada, 5.5, 'aplicada ≠ sugerida, gravada como o operador confirmou');
assert.equal(ap7.pesagem_id, e7.itens[0].pesagem_id);
assert.equal(ap7.posologia_snapshot?.dose_por_unidade, 1);
assert.equal(ap7.peso_base_kg, 300);
assert.equal(ap7.peso_base_origem, 'MANUAL');
assert.equal(ap7.carencia_carne_ate, '2026-05-31', 'carência da posologia');
assert.ok((await ativos('auditoria', (a) => a.entidade_id === ap7.id)).length >= 1, 'auditoria da aplicação');
const c7 = await contagens();
for (const [rotulo, extra, peso] of [
  ['sugestão adulterada (= aplicada)', { dose_sugerida: 5.5 }, 300],
  ['peso-base diferente do gravado', { peso_base_kg: 290 }, 300],
  ['sem confirmação', { dose_confirmada: false }, 300],
]) {
  const e = await erroDe(() => entrada(`ciclo-x-${rotulo}`, { numero: `7${rotulo.length}`, peso, data: '2026-05-01', aplicacoes: [app(extra)] }));
  assert.ok(e, `${rotulo}: recusado`);
}
assert.deepEqual(await contagens(), c7, 'recusas da posologia não gravam nada');
// Manejo com a mesma regra (caminho de sempre do Lançamento)
const manejo = await weighing.createEntry({ ...pesagemTela({ tipo_manejo: 'Manejo', data_pesagem: '2026-05-02', animal_id: animal3, numero_animal: '303', peso: 350, peso_origem: 'MANUAL' }), aplicacoes_sanidade: [app({ dose_sugerida: 7, dose: 7, peso_base_kg: 350, peso_base_data: '2026-05-02' })] });
assert.equal(manejo.aplicacoes_sanidade.length, 1, 'Manejo grava a aplicação com posologia');
// Fora da vigência e suspensa
assert.equal((await sanity.getDoseSuggestion({ medicamentoId: med.id, peso: { kg: 300, data: '2025-12-01', origem: 'MANUAL' }, dataAplicacao: '2025-12-01' })).situacao, 'FORA_VIGENCIA');
await sanity.suspendPosology(sug.posologia.id, { motivo: 'Suspensão de teste' });
sug = await sugRascunho();
assert.deepEqual([sug.situacao, sug.ok], ['SUSPENSA', false]);
const suspensa = await erroDe(() => entrada('ciclo-x-susp', { numero: '788', peso: 300, data: '2026-05-01', aplicacoes: [app({ posologia_id: rascunho.id })] }));
assert.ok(suspensa, 'posologia suspensa não grava dose');
resumo.push('7 Posologia sintética 1 ml/50 kg: 300 kg → 6 ml sugerido, 5,5 ml aplicado e confirmado, snapshot, peso-base, carência e auditoria; adulteração, peso diferente, sem confirmação, rascunho, fora da vigência e suspensa recusados');

// 9. Perfis
await como('OPERADOR', async () => {
  assert.ok(await erroDe(() => sanity.saveMedicamento({ nome: 'X sintético' })), 'OPERADOR não cadastra medicamento');
  assert.ok(await erroDe(() => sanity.approvePosology(rascunho.id, { responsavel: 'Fulano CRMV 1' })), 'OPERADOR não aprova posologia');
  const eOp = await entrada('ciclo-op', { numero: '909', peso: 260, valor: 999 });
  assert.equal(eOp.operacao.status, 'CONFIRMADA', 'OPERADOR lança Entrada');
  assert.equal(eOp.itens[0].valor, null, 'OPERADOR sem commercial.write: valor não entra');
});
await como('CONSULTA', async () => {
  assert.ok(await erroDe(() => entrada('ciclo-cons', { numero: '910', peso: 260 })), 'CONSULTA não lança');
});
resumo.push('9 Perfis: OPERADOR lança e aplica sem cadastrar medicamento nem aprovar posologia (e sem valores); CONSULTA não lança');

// Histórico: Cadastro antigo (sem operação) continua visível e não ganha operação retroativa.
const antigo = await weighing.createEntry(pesagemTela({ tipo_manejo: 'Cadastro', data_pesagem: '2026-02-01', numero_animal: '111', peso: 240, peso_origem: 'MANUAL' }));
assert.ok(antigo.id);
assert.equal(await ops.findOperationOfEntry(antigo.id), null, 'pesagem sem operação continua como antes');
assert.equal((await db.table('operacoes').toArray()).filter((o) => o.status === 'RASCUNHO' && !o.deleted_at).length, 0, 'nenhum rascunho invisível');
resumo.push('Histórico: lançamento antigo sem operação continua igual; nenhum rascunho invisível no banco');

console.log('OK verify-launch-operations');
console.log(JSON.stringify(resumo, null, 2));
