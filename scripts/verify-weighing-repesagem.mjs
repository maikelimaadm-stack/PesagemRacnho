// Gate weighing:repesagem:verify — M1 (1.5.0) §4: repesagem no mesmo dia, e a faixa de desempenho do Lançamento pelo
// contrato da qualidade do GMD (§1.2 item 5). Massa de TESTE em fake-indexeddb (nunca o banco real).
//
// Prova:
//  1. regra pura (planSameDayReweigh): só Manejo com peso substitui Manejo com peso do mesmo animal na mesma data;
//     Cadastro, Saída, pesagem sem peso, outro dia e outro animal não abrem a repesagem; textos do diálogo;
//  2. GMD nunca entre duas pesagens do mesmo dia (domínio, prévia do Lançamento e serviço);
//  3. faixa de desempenho: intervalo curto em cinza com "intervalo curto (N dias)", sem anterior "-", mínimo vindo de
//     Configurações (7/14/21/28; inválido → 21);
//  4. serviço + Dexie: a de hoje é cancelada com o motivo "repesagem" na auditoria (deleteEntry sem motivo continua
//     com o texto antigo), a nova vira a oficial (lista, projeção do animal, lote, movimento), a série seguinte é
//     recalculada, sanidade da pesagem cancelada vai junto e a integridade continua verde;
//  5. ordem segura: qualquer falha (anterior já cancelada, gravação da nova recusada, aplicação de sanidade inválida,
//     animal só com a pesagem de hoje) não grava nada e a de hoje continua valendo — com mensagem clara;
//  6. recusas do serviço (outro animal, outra data, Cadastro, Saída, sem peso, sem permissão) sem gravar nada;
//  7. fonte do Lançamento: diálogo ModeloBase1 com os textos, Cancelar não grava, Repesar segue o salvamento pela
//     repesagem; GMD da faixa e da grade pelo formatador compartilhado; mínimo de Configurações. Mutações negativas.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as weighingDataAdapter from '../src/modules/weighing/infrastructure/weighingDataAdapter.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import { uiToStorageRecord } from '../src/modules/weighing/domain/weighingMapper.js';
import { MOTIVO_REPESAGEM, TEXTOS_REPESAGEM, TIPOS_REPESAVEIS, planSameDayReweigh, repesagemAvisoSanidade, repesagemResumo } from '../src/modules/weighing/domain/repesagem.js';
import { calculateWeightGain } from '../src/modules/weighing/domain/weighingCalculations.js';
import { GMD_QUALIDADE } from '../src/modules/weighing/domain/gmdQuality.js';
import { buildWeightPreview } from '../src/components/pesagens/weightPreview.js';
import { fmtNum } from '../src/components/common/formatNumber.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const resumo = { regras: [] };
const ok = (regra) => resumo.regras.push(regra);

// ---------------------------------------------------------------------------------------------------------------
// 1. Regra pura e textos.
// ---------------------------------------------------------------------------------------------------------------
assert.equal(MOTIVO_REPESAGEM, 'repesagem');
assert.deepEqual(TIPOS_REPESAVEIS, ['Manejo'], 'só o Manejo se repesa');
assert.equal(TEXTOS_REPESAGEM.pergunta, 'Esse animal já foi pesado hoje. Repesar?');
assert.equal(TEXTOS_REPESAGEM.confirmar, 'Repesar (substitui)');
assert.equal(TEXTOS_REPESAGEM.cancelar, 'Cancelar');
assert.equal(repesagemResumo({ pesoAnterior: '330', pesoNovo: '335,5' }), 'Peso de hoje: 330 kg. Novo peso: 335,5 kg. A pesagem de hoje é cancelada (motivo: repesagem) e a nova passa a valer.');
assert.equal(repesagemAvisoSanidade(0), null, 'sem aplicação, sem aviso');
assert.match(repesagemAvisoSanidade(1), /^A pesagem de hoje tem 1 aplicação de sanidade, que é cancelada junto\./);
assert.match(repesagemAvisoSanidade(2), /^A pesagem de hoje tem 2 aplicações de sanidade, que são canceladas junto\./);

const animalA = { animal_id: 'A', numero_animal: '101', marca: 'ALFA' };
const manejoHoje = { id: 'h1', animal_id: 'A', numero_animal: '101', marca: 'ALFA', tipo_manejo: 'Manejo', data_pesagem: '2026-08-31', peso: 330 };
const plan = (entries, extra = {}) => planSameDayReweigh({ entries, animal: animalA, date: '2026-08-31', tipoManejo: 'Manejo', peso: 335, ...extra });
assert.deepEqual(plan([]), { conflito: false, repesar: false, anteriores: [] }, 'sem lançamento hoje: grava normal');
assert.deepEqual(plan([manejoHoje]), { conflito: true, repesar: true, anteriores: [manejoHoje] }, 'Manejo com peso hoje + Manejo com peso: repesagem');
assert.equal(plan([{ ...manejoHoje, data_pesagem: '2026-08-31T00:00:00.000Z' }]).repesar, true, 'data com hora conta como o mesmo dia');
assert.equal(plan([{ ...manejoHoje, animal_id: null }]).repesar, true, 'registro antigo sem animal_id: mesmo número + marca é o mesmo animal');
for (const [rotulo, entries] of [
  ['outro dia', [{ ...manejoHoje, data_pesagem: '2026-08-30' }]],
  ['outro animal', [{ ...manejoHoje, animal_id: 'B', numero_animal: '202' }]],
  ['pesagem já cancelada', [{ ...manejoHoje, deleted_at: '2026-08-31T10:00:00.000Z' }]],
]) assert.equal(plan(entries).conflito, false, `${rotulo}: não é repesagem`);
for (const [rotulo, entries, extra] of [
  ['Cadastro hoje (corrige-se editando)', [{ ...manejoHoje, tipo_manejo: 'Cadastro' }], {}],
  ['Saída hoje', [{ ...manejoHoje, tipo_manejo: 'Saída', motivo_saida: 'Venda' }], {}],
  ['lançamento de hoje sem peso', [{ ...manejoHoje, peso: null }], {}],
  ['Cadastro e Manejo hoje', [{ ...manejoHoje, id: 'c', tipo_manejo: 'Cadastro' }, manejoHoje], {}],
  ['novo sem peso', [manejoHoje], { peso: null }],
  ['novo com peso zero', [manejoHoje], { peso: 0 }],
  ['novo é Saída', [manejoHoje], { tipoManejo: 'Saída' }],
  ['novo é Cadastro', [manejoHoje], { tipoManejo: 'Cadastro' }],
]) {
  const resultado = plan(entries, extra);
  assert.equal(resultado.conflito, true, `${rotulo}: há lançamento hoje`);
  assert.equal(resultado.repesar, false, `NEGATIVO ${rotulo}: continua recusado (sem diálogo de repesagem)`);
}
ok('regra-pura');

// ---------------------------------------------------------------------------------------------------------------
// 2. GMD nunca entre duas pesagens do mesmo dia.
// ---------------------------------------------------------------------------------------------------------------
const historico = [
  { id: 'c', data_pesagem: '2026-08-01', peso: 300 },
  { id: 'h', data_pesagem: '2026-08-31', peso: 330 },
];
const ganhoMesmoDia = calculateWeightGain({ history: historico, date: '2026-08-31', weight: 335 });
assert.equal(ganhoMesmoDia.dataAnterior, '2026-08-01', 'a anterior é a de data estritamente menor, não a de hoje');
assert.equal(ganhoMesmoDia.dias, 30);
assert.equal(ganhoMesmoDia.ganho, 35);
assert.equal(ganhoMesmoDia.gmd, Number((35 / 30).toFixed(3)));
// NEGATIVO: a regra errada (anterior com data <= hoje) pegaria a pesagem de hoje e faria GMD com 0 dia.
const regraMesmoDia = historico.filter((entry) => entry.data_pesagem <= '2026-08-31').at(-1);
assert.equal(regraMesmoDia.data_pesagem, '2026-08-31', 'NEGATIVO: com <= a anterior seria a de hoje');
assert.notEqual(ganhoMesmoDia.dataAnterior, regraMesmoDia.data_pesagem, 'NEGATIVO: a regra de verdade difere da errada');
const previaMesmoDia = buildWeightPreview({ history: historico, date: '31/08/2026', weight: '335' });
assert.equal(previaMesmoDia.gain.dataAnterior, '2026-08-01', 'prévia do Lançamento também ignora a pesagem de hoje');
assert.equal(previaMesmoDia.trend.count, 1, 'tendência da prévia não conta a pesagem de hoje');
ok('gmd-nao-usa-mesmo-dia');

// ---------------------------------------------------------------------------------------------------------------
// 3. Faixa de desempenho do Lançamento (buildWeightPreview → gmd pelo contrato gmdExibicao).
// ---------------------------------------------------------------------------------------------------------------
const h = (data, peso) => [{ id: 'p', data_pesagem: data, peso }];
const p10 = buildWeightPreview({ history: h('2026-08-21', 300), date: '2026-08-31', weight: '310' });
assert.deepEqual(p10.gmd, { gmdQualidade: GMD_QUALIDADE.NAO_CONFIAVEL, gmdMotivo: 'intervalo curto (10 dias)', texto: '1,000', cinza: true, aviso: 'intervalo curto (10 dias)', entraNaMedia: false }, '10 dias com o padrão 21: cinza com o aviso');
assert.equal(p10.gain.gmd, 1, 'o número continua calculado (o fato não muda)');
assert.deepEqual(buildWeightPreview({ history: h('2026-08-30', 300), date: '2026-08-31', weight: '302' }).gmd.aviso, 'intervalo curto (1 dia)', '1 dia no singular');
assert.equal(buildWeightPreview({ history: h('2026-08-21', 300), date: '2026-08-31', weight: '310', diasMinimos: 7 }).gmd.cinza, false, 'mínimo 7: 10 dias é confiável');
const p21 = (diasMinimos) => buildWeightPreview({ history: h('2026-08-10', 300), date: '2026-08-31', weight: '321', diasMinimos }).gmd;
assert.deepEqual(p21(21), { gmdQualidade: GMD_QUALIDADE.CONFIAVEL, gmdMotivo: null, texto: '1,000', cinza: false, aviso: null, entraNaMedia: true }, '21 dias com mínimo 21: normal');
assert.deepEqual([p21(28).cinza, p21(28).aviso], [true, 'intervalo curto (21 dias)'], 'mínimo 28: 21 dias passa a cinza');
assert.equal(p21(14).cinza, false, 'mínimo 14: normal');
assert.equal(p21(10).cinza, false, 'mínimo inválido (10) cai em 21: normal');
assert.equal(p21(undefined).cinza, false, 'sem mínimo: 21');
assert.deepEqual(buildWeightPreview({ history: [], date: '2026-08-31', weight: '310' }).gmd, { gmdQualidade: GMD_QUALIDADE.SEM_GMD, gmdMotivo: 'sem pesagem anterior', texto: '-', cinza: false, aviso: null, entraNaMedia: false }, 'sem anterior: "-"');
const semPeso = buildWeightPreview({ history: h('2026-08-21', 300), date: '2026-08-31', weight: '' });
assert.deepEqual([semPeso.gmd.texto, semPeso.gmd.cinza, semPeso.gmd.gmdQualidade, semPeso.gain.gmd], ['-', false, GMD_QUALIDADE.SEM_GMD, null], 'sem peso digitado: "-" (nada de qualidade do peso-marcador)');
assert.equal(semPeso.gain.pesoAnterior, 300, 'sem peso digitado: a última pesagem continua visível');
// NEGATIVO: a exibição da 1.4.2 mostrava o número de 10 dias como qualquer outro (sem cinza nem aviso).
const exibicaoAntiga = (gain) => ({ texto: gain.gmd !== null ? fmtNum(gain.gmd, 3) : '-', cinza: false, aviso: null });
assert.equal(exibicaoAntiga(p10.gain).texto, p10.gmd.texto, 'mesmo número');
assert.notDeepEqual(exibicaoAntiga(p10.gain), { texto: p10.gmd.texto, cinza: p10.gmd.cinza, aviso: p10.gmd.aviso }, 'NEGATIVO: a exibição antiga não apagava nem avisava o intervalo curto');
ok('faixa-desempenho');

// ---------------------------------------------------------------------------------------------------------------
// 4. Serviço + Dexie (fake-indexeddb).
// ---------------------------------------------------------------------------------------------------------------
const TS = '2026-08-01T00:00:00.000Z';
setActorProvider(null);
await deleteDbForTests();
const db = await storage.ensureReady();
await db.table('usuarios').add({ id: 'u-ADMIN', empresa_id: 'local', nome: 'Ana Admin', login: 'ana', login_normalizado: 'ana', role: 'ADMIN', ativo: true, password_hash: 'aGFzaA==', password_salt: 'c2FsdA==', created_at: TS, updated_at: TS, deleted_at: null });
await db.table('marcas').add({ id: 'm-alfa', empresa_id: 'local', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
await db.table('racas').add({ id: 'r-nelore', empresa_id: 'local', nome: 'Nelore', nome_normalizado: 'NELORE', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
await db.table('apartacoes').add({ id: 'ap1', empresa_id: 'local', nome_apartacao: 'Recria', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
for (const [id, nome] of [['L1', 'Lote 1'], ['L2', 'Lote 2'], ['L3', 'Lote 3']]) {
  await db.table('loteApartacoes').add({ id, empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Recria', nome_lote: nome, quantidade_maxima: 50, peso_minimo: 0, peso_maximo: 999, created_at: TS, updated_at: TS, deleted_at: null });
}
setActorProvider(() => ({ id: 'u-ADMIN', nome: 'Ana Admin', role: 'ADMIN' }));
const aftosa = await sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' });

const base = { empresa_id: 'local', marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore', sexo: 'M', status_animal: 'Ativo', apartacao_id: 'ap1' };
const evento = (id, animalId, numero, tipo, data, peso, extra = {}) => ({ ...base, id, animal_id: animalId, numero_animal: numero, tipo_manejo: tipo, data_pesagem: data, peso, ...extra });
const criar = (...args) => weighingService.createEntry(evento(...args));
const raw = async (id) => db.table('pesagens').where('id').equals(id).first();
const audits = async (id) => (await db.table('auditoria').toArray()).filter((row) => row.entidade === 'pesagens' && row.entidade_id === id);
const derived = (entry) => ({ data_anterior: entry.data_anterior, peso_anterior: entry.peso_anterior, dias: entry.dias, ganho: entry.ganho, gmd: entry.gmd });
const counts = async () => Object.fromEntries(await Promise.all(['pesagens', 'auditoria', 'aplicacoesSanidade', 'movimentosAnimais', 'animalLotes'].map(async (name) => [name, await db.table(name).count()])));
const activeMovements = async (animalId) => (await db.table('movimentosAnimais').where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at);
const activeLots = async (animalId) => (await db.table('animalLotes').where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at).map((row) => [row.lote_id, row.inicio, row.fim]).sort((l, r) => l[1].localeCompare(r[1]));
const integridadeVerde = async (rotulo) => {
  const result = await logicalIntegrity({ enforceV7: true });
  assert.deepEqual(result.issues, [], `${rotulo}: integridade sem problemas`);
};

// Animal A: Cadastro (L1) → Manejo de hoje 31/08 (L2, mudou de lote) → Manejo 30/09 (posterior).
await criar('c-a', 'A', '101', 'Cadastro', '2026-08-01', 300, { lote_id: 'L1' });
await criar('m-a', 'A', '101', 'Manejo', '2026-08-31', 330, { lote_id: 'L2' });
await criar('m-a2', 'A', '101', 'Manejo', '2026-09-30', 360, { lote_id: 'L2' });
assert.equal((await raw('m-a2')).legacy_payload.peso_anterior, 330, 'antes: a pesagem seguinte usa 330 como anterior');
await integridadeVerde('antes da repesagem');

// 4a. deleteEntry/bulkDeleteEntries sem motivo: o texto de sempre (nada muda para quem não passa motivo).
assert.equal(weighingDataAdapter.MOTIVO_CANCELAMENTO_PADRAO, 'Exclusão lógica pela interface');
await criar('x1', 'X', '900', 'Cadastro', '2026-08-01', 250);
await criar('x2', 'X', '900', 'Manejo', '2026-08-20', 260);
await criar('x3', 'X', '900', 'Manejo', '2026-08-25', 262);
await criar('x4', 'X', '900', 'Manejo', '2026-08-28', 264);
await weighingService.deleteEntry('x2');
await weighingService.bulkDeleteEntries(['x3']);
await weighingService.deleteEntry('x4', { motivo: '   ' });
for (const id of ['x2', 'x3', 'x4']) {
  const cancelamentos = (await audits(id)).filter((row) => row.acao === 'CANCELAR');
  assert.deepEqual(cancelamentos.map((row) => row.motivo), ['Exclusão lógica pela interface'], `${id}: cancelamento sem motivo continua com o texto antigo`);
}
await criar('x5', 'X', '900', 'Manejo', '2026-08-29', 265);
await weighingService.deleteEntry('x5', { motivo: 'peso errado' });
assert.deepEqual((await audits('x5')).filter((row) => row.acao === 'CANCELAR').map((row) => row.motivo), ['peso errado'], 'motivo informado vai para a auditoria');
ok('motivo-opcional');

// 4b. Repesagem de A em 31/08: 335 kg, mesmo lote.
const antesA = await counts();
const repesadaA = await weighingService.replaceSameDayEntry(['m-a'], evento('r-a', 'A', '101', 'Manejo', '2026-08-31', 335, { lote_id: 'L2' }));
assert.equal(repesadaA.id, 'r-a');
assert.equal(repesadaA.peso, 335);
assert.deepEqual(repesadaA.substituidas, ['m-a']);
assert.ok((await raw('m-a')).deleted_at, 'a de hoje foi cancelada (exclusão lógica)');
assert.equal((await raw('m-a')).peso_kg, 330, 'nada apagado fisicamente: a de hoje continua no banco');
assert.equal((await raw('r-a')).deleted_at, null, 'a nova está ativa');
const cancelamentoA = (await audits('m-a')).filter((row) => row.acao === 'CANCELAR');
assert.equal(cancelamentoA.length, 1);
assert.equal(cancelamentoA[0].motivo, 'repesagem', 'auditoria: CANCELAR com o motivo "repesagem"');
assert.equal(cancelamentoA[0].usuario_id, 'u-ADMIN', 'auditoria com o usuário real');
assert.equal(cancelamentoA[0].antes.peso_kg, 330, 'auditoria guarda a pesagem cancelada');
assert.equal((await audits('r-a')).filter((row) => row.acao === 'CRIAR').length, 1, 'auditoria: CRIAR da nova');
assert.deepEqual(derived(repesadaA), { data_anterior: '2026-08-01', peso_anterior: 300, dias: 30, ganho: 35, gmd: Number((35 / 30).toFixed(3)) }, 'GMD da nova contra a pesagem de 01/08 — nunca contra a de hoje');
// A série seguinte é recalculada: a pesagem de 30/09 passa a usar 335 como anterior.
const seguinte = await weighingService.getEntryById('m-a2');
assert.deepEqual(derived(seguinte), { data_anterior: '2026-08-31', peso_anterior: 335, dias: 30, ganho: 25, gmd: Number((25 / 30).toFixed(3)) }, 'repesar recalcula a série (pesagem seguinte)');
assert.notEqual(seguinte.peso_anterior, 330, 'NEGATIVO: sem o recálculo, a seguinte continuaria com 330');
// A nova vira a oficial.
assert.deepEqual((await weighingService.listEntries({ animalId: 'A' })).map((entry) => entry.id).sort(), ['c-a', 'm-a2', 'r-a'], 'a lista do animal tem a nova e não a cancelada');
// Lote e movimento: um único "Mudança de lote" (L1 → L2) ativo, agora da nova.
assert.deepEqual(await activeLots('A'), [['L1', '2026-08-01', '2026-08-31'], ['L2', '2026-08-31', null]], 'permanência em lote igual');
const movA = (await activeMovements('A')).filter((row) => row.tipo === 'Mudança de lote');
assert.deepEqual(movA.map((row) => [row.pesagem_id, row.lote_origem_id, row.lote_destino_id]), [['r-a', 'L1', 'L2']], 'movimento de mudança de lote passa a ser da nova (o da cancelada sai junto)');
const depoisA = await counts();
assert.equal(depoisA.pesagens - antesA.pesagens, 1, 'uma pesagem nova; a de hoje continua no banco, cancelada');
await integridadeVerde('depois da repesagem de A');
ok('repesagem-mesmo-lote');

// 4c. Repesagem de B (última pesagem do animal) com aplicação de sanidade e troca de lote (lote pelo peso novo).
await criar('c-b', 'B', '202', 'Cadastro', '2026-08-01', 280, { lote_id: 'L1' });
const manejoB = await weighingService.createEntry(evento('m-b', 'B', '202', 'Manejo', '2026-09-10', 310, { lote_id: 'L2', aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id }] }));
assert.equal(manejoB.aplicacoes_sanidade.length, 1);
const appAntiga = manejoB.aplicacoes_sanidade[0].id;
const repesadaB = await weighingService.replaceSameDayEntry(['m-b'], evento('r-b', 'B', '202', 'Manejo', '2026-09-10', 305, { lote_id: 'L3', aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id }] }));
assert.equal(repesadaB.aplicacoes_sanidade.length, 1, 'aplicações do painel vão com a nova');
const animalB = await db.table('animais').where('id').equals('B').first();
assert.deepEqual([animalB.ultimo_peso_kg, animalB.ultima_pesagem_data, animalB.lote_atual_id], [305, '2026-09-10', 'L3'], 'projeção do animal: peso, data e lote da nova');
const antiga = await db.table('aplicacoesSanidade').where('id').equals(appAntiga).first();
assert.ok(antiga.cancelled_at && antiga.motivo_cancelamento === 'pesagem cancelada', 'aplicação da pesagem cancelada vai junto (ADR-049)');
const nova = await db.table('aplicacoesSanidade').where('pesagem_id').equals('r-b').toArray();
assert.deepEqual(nova.map((row) => [row.cancelled_at, row.animal_id, row.data]), [[null, 'B', '2026-09-10']], 'aplicação nova ligada à nova pesagem');
assert.deepEqual(await activeLots('B'), [['L1', '2026-08-01', '2026-09-10'], ['L3', '2026-09-10', null]], 'lote reconstruído sem o L2 da cancelada');
assert.deepEqual((await activeMovements('B')).filter((row) => row.tipo === 'Mudança de lote').map((row) => [row.pesagem_id, row.lote_origem_id, row.lote_destino_id]), [['r-b', 'L1', 'L3']], 'um só movimento L1 → L3, da nova');
assert.equal((await sanity.listApplications({ animalId: 'B' })).length, 1, 'uma aplicação ativa no animal');
await integridadeVerde('depois da repesagem de B');
ok('repesagem-troca-lote-e-sanidade');

// ---------------------------------------------------------------------------------------------------------------
// 5. Ordem segura: qualquer falha não grava nada e a de hoje continua valendo.
// ---------------------------------------------------------------------------------------------------------------
async function semEfeito(rotulo, run, mensagem) {
  const antes = await counts();
  const ativas = (await db.table('pesagens').toArray()).filter((row) => !row.deleted_at).map((row) => row.id).sort();
  let erro = null;
  try { await run(); } catch (err) { erro = err; }
  assert.ok(erro, `${rotulo}: deveria falhar`);
  if (mensagem) assert.match(erro.message, mensagem, `${rotulo}: mensagem clara`);
  assert.deepEqual(await counts(), antes, `${rotulo}: nenhum registro novo (pesagem, auditoria, sanidade, movimento, lote)`);
  assert.deepEqual((await db.table('pesagens').toArray()).filter((row) => !row.deleted_at).map((row) => row.id).sort(), ativas, `${rotulo}: as mesmas pesagens ativas`);
  return erro;
}
await criar('m-b2', 'B', '202', 'Manejo', '2026-09-20', 315);
const NAO_GRAVADA = /^A repesagem não foi gravada; a pesagem de hoje continua valendo\./;
// Anterior já cancelada (serviço): a transação desfaz a nova.
await semEfeito('anterior já cancelada', () => weighingService.replaceSameDayEntry(['m-a'], evento('r-a2', 'A', '101', 'Manejo', '2026-08-31', 336)), NAO_GRAVADA);
// Gravação da nova recusada DEPOIS do cancelamento (id repetido): o cancelamento é desfeito.
const registroRepetido = uiToStorageRecord({ ...evento('m-a2', 'A', '101', 'Manejo', '2026-09-20', 340), data_anterior: null });
await semEfeito('nova recusada depois do cancelamento (adapter)', () => weighingDataAdapter.replaceEntries(['m-b2'], { ...registroRepetido, animal_id: 'B' }, { motivo: 'repesagem' }), /Pesagem duplicada/);
assert.equal((await raw('m-b2')).deleted_at, null, 'NEGATIVO ordem segura: a de hoje continua ativa depois da falha');
assert.equal((await audits('m-b2')).filter((row) => row.acao === 'CANCELAR').length, 0, 'NEGATIVO ordem segura: nenhum CANCELAR ficou na auditoria');
// Aplicação de sanidade com programa inexistente: recusada dentro da transação → nada muda.
await semEfeito('aplicação de sanidade inválida', () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-b2', 'B', '202', 'Manejo', '2026-09-20', 316, { aplicacoes_sanidade: [{ programa_sanidade_id: 'programa-inexistente' }] })), NAO_GRAVADA);
// Animal só com a pesagem de hoje (registro antigo sem Cadastro): o cancelamento o removeria → nada muda.
await db.table('pesagens').add({ ...uiToStorageRecord(evento('legado-1', 'L', '700', 'Manejo', '2026-09-05', 410)), created_at: TS, updated_at: TS, deleted_at: null });
await db.table('animais').add({ id: 'L', empresa_id: 'local', numero_animal: '700', identificacao_normalizada: '700', marca: 'ALFA', marca_id: 'm-alfa', situacao: 'ATIVO', categoria_automatica: true, created_at: TS, updated_at: TS, deleted_at: null });
await semEfeito('animal só com a pesagem de hoje', () => weighingService.replaceSameDayEntry(['legado-1'], evento('r-l', 'L', '700', 'Manejo', '2026-09-05', 412)), /só tem a pesagem de hoje/);
assert.equal((await db.table('animais').where('id').equals('L').first()).deleted_at, null, 'NEGATIVO: o animal não foi removido');
await db.table('pesagens').where('id').equals('legado-1').delete();
await db.table('animais').where('id').equals('L').delete();
ok('ordem-segura');

// ---------------------------------------------------------------------------------------------------------------
// 6. Recusas do serviço: nada gravado.
// ---------------------------------------------------------------------------------------------------------------
await criar('c-c', 'C', '303', 'Cadastro', '2026-09-15', 290);
await semEfeito('outro animal', () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-x', 'A', '101', 'Manejo', '2026-09-20', 341)), /Só se repesa pesagem de Manejo/);
await semEfeito('outra data', () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-x', 'B', '202', 'Manejo', '2026-09-21', 316)), /Só se repesa pesagem de Manejo/);
await semEfeito('Cadastro de hoje', () => weighingService.replaceSameDayEntry(['c-c'], evento('r-x', 'C', '303', 'Manejo', '2026-09-15', 291)), /Só se repesa pesagem de Manejo/);
await semEfeito('novo é Saída', () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-x', 'B', '202', 'Saída', '2026-09-20', 316, { motivo_saida: 'Venda' })), /Só se repesa pesagem de Manejo/);
await semEfeito('sem pesagem de hoje', () => weighingService.replaceSameDayEntry([], evento('r-x', 'B', '202', 'Manejo', '2026-09-20', 316)), /Só se repesa pesagem de Manejo/);
await semEfeito('pesagem inexistente', () => weighingService.replaceSameDayEntry(['nao-existe'], evento('r-x', 'B', '202', 'Manejo', '2026-09-20', 316)), /Só se repesa pesagem de Manejo/);
await semEfeito('sem peso', () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-x', 'B', '202', 'Manejo', '2026-09-20', null)), /Peso deve ser numérico/);
for (const role of ['CONSULTA']) {
  setActorProvider(() => ({ id: `u-${role}`, nome: role, role }));
  const erro = await semEfeito(`${role} sem permissão`, () => weighingService.replaceSameDayEntry(['m-b2'], evento('r-x', 'B', '202', 'Manejo', '2026-09-20', 316)));
  assert.equal(erro.code, 'AUTH_FORBIDDEN', `${role}: recusado pela permissão`);
}
setActorProvider(() => ({ id: 'u-ADMIN', nome: 'Ana Admin', role: 'ADMIN' }));
assert.equal((await raw('m-b2')).deleted_at, null, 'depois de todas as recusas, a de hoje continua valendo');
await integridadeVerde('depois das recusas');
// Peso em texto pt-BR ("317,5"), como o mapper aceita: a regra lê igual e a série recalculada fecha a conta.
const repesadaTexto = await weighingService.replaceSameDayEntry(['m-b2'], evento('r-b2', 'B', '202', 'Manejo', '2026-09-20', '317,5'));
assert.equal(repesadaTexto.peso, 317.5, 'peso "317,5" gravado como 317,5 kg');
assert.deepEqual(derived(repesadaTexto), { data_anterior: '2026-09-10', peso_anterior: 305, dias: 10, ganho: 12.5, gmd: 1.25 }, 'derivados contra a repesada de 10/09');
await integridadeVerde('depois da repesagem com peso em texto');
ok('recusas');

setActorProvider(null);
await deleteDbForTests();

// ---------------------------------------------------------------------------------------------------------------
// 7. Fonte do Lançamento (com mutações negativas).
// ---------------------------------------------------------------------------------------------------------------
const PAGE = read('src/pages/LancamentoPesagensIndividuais.jsx');
const between = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `trecho não encontrado: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `fim do trecho não encontrado: ${end}`);
  return source.slice(from, to);
};
function checkPage(page) {
  assert.match(page, /import \{ TEXTOS_REPESAGEM, planSameDayReweigh, repesagemAvisoSanidade, repesagemResumo \} from "@\/modules\/weighing\/domain\/repesagem";/, 'Lançamento usa a regra e os textos do domínio');
  // Detecção: na série do animal (não na grade filtrada do dia) e só sem edição e sem SN.
  const deteccao = between(page, 'let repesagemAnterioresIds = null;', 'const ultimoRegistro =');
  assert.match(deteccao, /if \(!editingId && !isSN\) \{\s*const planoRepesagem = planSameDayReweigh\(\{\s*entries: registrosMesmaIdentidade,/, 'detecção pela série do animal');
  assert.ok(!/pesagensDia/.test(deteccao), 'NEGATIVO: a detecção não usa a grade do dia (pode estar filtrada por coluna)');
  assert.match(deteccao, /if \(!planoRepesagem\.repesar\) \{[\s\S]{0,200}já possui lançamento hoje[\s\S]{0,120}return;/, 'Cadastro/Saída/sem peso: recusa como antes');
  assert.match(deteccao, /if \(!mesmasPesagens\(options\?\.repesagemConfirmada, anterioresIds\)\) \{[\s\S]*setRepesagemDialog\(\{[\s\S]*options: \{ \.\.\.options, repesagemConfirmada: anterioresIds \},[\s\S]*\}\);\s*return;/, 'sem confirmação: abre o diálogo e não grava');
  assert.match(deteccao, /repesagemAnterioresIds = anterioresIds;/, 'confirmada: segue o salvamento como repesagem');
  // Diálogo ModeloBase1 com os textos.
  const dialogo = between(page, '<Dialog open={Boolean(repesagemDialog)}', '</Dialog>');
  assert.match(dialogo, /<DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">/, 'diálogo padrão do ModeloBase1 (o mesmo de confirmação do Lançamento)');
  assert.match(dialogo, /<DialogTitle>\{TEXTOS_REPESAGEM\.pergunta\}<\/DialogTitle>/, 'pergunta "Esse animal já foi pesado hoje. Repesar?"');
  assert.match(dialogo, /<DialogFooter className="d17b-standard-dialog__footer">/);
  assert.match(dialogo, /<Button size="lg" variant="outline" onClick=\{\(\) => setRepesagemDialog\(null\)\}>\{TEXTOS_REPESAGEM\.cancelar\}<\/Button>/, 'Cancelar só fecha (não grava nada)');
  assert.match(dialogo, /<Button size="lg" onClick=\{\(\) => \{ const pending = repesagemDialog\?\.options \|\| \{\}; setRepesagemDialog\(null\); void handleSalvar\(pending\); \}\}>\{TEXTOS_REPESAGEM\.confirmar\}<\/Button>/, 'Repesar (substitui) segue o salvamento com a confirmação');
  assert.match(dialogo, /repesagemDialog\?\.avisoSanidade/, 'avisa quando a pesagem de hoje tem aplicação de sanidade');
  assert.match(page, /<Dialog open=\{Boolean\(repesagemDialog\)\} onOpenChange=\{\(open\) => \{ if \(!open\) setRepesagemDialog\(null\); \}\}>/, 'fechar o diálogo (Esc, X) também não grava');
  // Salvamento: repesagem pelo serviço (transação única); lançamento normal continua no createEntry.
  assert.match(page, /const savedEntry = repesagemAnterioresIds\s*\? await weighingService\.replaceSameDayEntry\(repesagemAnterioresIds, \{ \.\.\.data, aplicacoes_sanidade: sanidadeValidada\.payload \}\)\s*: await weighingService\.createEntry\(\{ \.\.\.data, (?:id: cicloLancamentoRef\.current, )?aplicacoes_sanidade: sanidadeValidada\.payload \}\);/, 'repesagem confirmada grava pelo replaceSameDayEntry');
  // GMD da faixa e da grade pelo formatador compartilhado; mínimo de Configurações.
  assert.match(page, /import \{ GMD_DIAS_MINIMOS_PADRAO, classifyGmd, gmdExibicao, normalizeGmdDiasMinimos \} from "@\/modules\/weighing\/domain\/gmdQuality";/);
  assert.match(page, /getReportSettings\(empresaSelecionadaId\)\s*\.then\(\(settings\) => \{ if \(ativo\) setGmdDiasMinimos\(normalizeGmdDiasMinimos\(settings\?\.gmd_dias_minimos\)\); \}\)/, 'mínimo do GMD vem de Configurações › Relatórios');
  assert.match(page, /buildWeightPreview\(\{ history: historicoAnimalSelecionado, date: dataPesagem, weight: peso, editingId, diasMinimos: gmdDiasMinimos \}\)/, 'prévia recebe o mínimo');
  const faixa = between(page, '<section className="d17d-animal-performance__group d17d-animal-performance__gain">', '</section>');
  assert.match(faixa, /GMD <strong style=\{gmdVisual\.cinza \? GMD_CINZA_STYLE : undefined\}>\{gmdVisual\.texto\}<\/strong>\{gmdVisual\.aviso \? <span style=\{GMD_CINZA_STYLE\}>\{gmdVisual\.aviso\}<\/span> : null\}/, 'faixa: GMD em cinza com o aviso; sem cálculo, "-"');
  assert.ok(!/n\(ganhoVisual\.gmd, 3\)/.test(faixa), 'NEGATIVO: a faixa não formata o GMD por conta própria');
  const celula = between(page, "if (coluna.id === 'gmd') {", '</TableCell>);');
  assert.match(celula, /gmdExibicao\(\{ gmd: p\.gmd, \.\.\.classifyGmd\(\{ dias: p\.dias, gmd: p\.gmd \}, gmdDiasMinimos\) \}\)/, 'grade: qualidade derivada na leitura com o mínimo de Configurações');
  assert.match(celula, /\{gmdLinha\.texto\}/);
  assert.match(celula, /title=\{gmdLinha\.aviso \|\| undefined\}/, 'grade: aviso no título da célula');
}
checkPage(PAGE);
const mutated = (from, to) => {
  assert.ok(PAGE.includes(from), `mutação aplicável: ${from.slice(0, 60)}`);
  return PAGE.replace(from, to);
};
const negativos = [
  ['sem diálogo de repesagem', mutated('<Dialog open={Boolean(repesagemDialog)}', '<Dialog open={false}')],
  ['pergunta fora do contrato', mutated('<DialogTitle>{TEXTOS_REPESAGEM.pergunta}</DialogTitle>', '<DialogTitle>Repesar?</DialogTitle>')],
  ['Cancelar grava', mutated('onClick={() => setRepesagemDialog(null)}>{TEXTOS_REPESAGEM.cancelar}', 'onClick={() => { setRepesagemDialog(null); void handleSalvar(repesagemDialog?.options); }}>{TEXTOS_REPESAGEM.cancelar}')],
  ['repesagem gravada como lançamento comum (sem cancelar a de hoje)', mutated('await weighingService.replaceSameDayEntry(repesagemAnterioresIds, ', 'await weighingService.createEntry(')],
  ['detecção pela grade filtrada', mutated('entries: registrosMesmaIdentidade,', 'entries: pesagensDia,')],
  ['salva sem confirmar', mutated('if (!mesmasPesagens(options?.repesagemConfirmada, anterioresIds)) {', 'if (false) {')],
  ['faixa sem cinza', mutated('<strong style={gmdVisual.cinza ? GMD_CINZA_STYLE : undefined}>', '<strong>')],
  ['faixa com o GMD antigo', mutated('{gmdVisual.texto}</strong>', "{ganhoVisual.gmd !== null ? n(ganhoVisual.gmd, 3) : '-'}</strong>")],
  ['grade sem o mínimo de Configurações', mutated('classifyGmd({ dias: p.dias, gmd: p.gmd }, gmdDiasMinimos)', 'classifyGmd({ dias: p.dias, gmd: p.gmd })')],
  ['mínimo fixo', mutated('weight: peso, editingId, diasMinimos: gmdDiasMinimos })', 'weight: peso, editingId })')],
];
for (const [rotulo, fonte] of negativos) assert.throws(() => checkPage(fonte), `mutação deveria falhar: ${rotulo}`);
ok('fonte-lancamento');

console.log(JSON.stringify({
  gate: 'weighing:repesagem:verify',
  ok: true,
  regras: resumo.regras,
  dialogo: { pergunta: TEXTOS_REPESAGEM.pergunta, confirmar: TEXTOS_REPESAGEM.confirmar, cancelar: TEXTOS_REPESAGEM.cancelar },
  motivoAuditoria: MOTIVO_REPESAGEM,
  motivoPadrao: weighingDataAdapter.MOTIVO_CANCELAMENTO_PADRAO,
  transacaoUnica: true,
  gmdNaoUsaMesmoDia: true,
  serieRecalculada: true,
  integridadeVerde: true,
  mutacoesNegativas: negativos.length,
}, null, 2));
