// Gate animal:profile:verify — missão pesagens-integrada, checkpoint B1b (F04, F05, F06, F15).
// Comportamento real (fake-indexeddb + serviços reais):
//   F04 nascimento com precisão e fonte; idade muda com o calendário sem nova pesagem; mês estimado dá faixa;
//       idade declarada conta a partir da data de referência; desconhecida não inventa data; correção auditada.
//   F05 era pela faixa de idade (parametrizável); `era` legada (peso) intacta; categoria produtiva informada ×
//       sugerida só com a política ligada; dentição observada 0/2/4/6/8 com data e cancelamento auditado.
//   F06 estoque de identificadores: recebimento por faixa atômico, aplicação muda o saldo uma vez (inclusive
//       concorrente), código oficial não é reaproveitado, troca conserva o animal, conferência física, backup.
//   F15 dossiê: origem, documentos, lotes, sanidade com carência, destino, desconhecidos e aviso de não-certificação.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as sanityService from '../src/modules/sanity/application/sanityService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import * as profile from '../src/modules/livestock/application/animalProfileService.js';

await deleteDbForTests();
const db = await storage.ensureReady();
const resumo = [];
const ok = (r) => resumo.push(r);
const TS = '2026-01-01T00:00:00.000Z';
const base = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
await db.table('marcas').add({ ...base, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
await db.table('propriedades').add({ ...base, id: 'P1', nome: 'Fazenda Um', nome_normalizado: 'FAZENDA UM', ativo: true, padrao: true });
await db.table('parceiros').add({ ...base, id: 'PARC', nome: 'Vendedor Norte', nome_normalizado: 'VENDEDOR NORTE', ativo: true });
await db.table('apartacoes').add({ ...base, id: 'AP', nome: 'AP', data: '2026-01-01' });
await db.table('loteApartacoes').add({ ...base, id: 'L1', apartacao_id: 'AP', nome_lote: 'Recria', situacao: 'ABERTO' });

const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-01-10', parceiro_id: 'PARC', gta_numero: 'GTA-77', lote_destino_id: 'L1', itens: [
  { numero_animal: '10', marca_id: 'MK', sexo: 'M', peso: 210 },
  { numero_animal: '11', marca_id: 'MK', sexo: 'F', peso: 190 },
] });
await ops.confirmOperation(compra.operacao.id);
const animal = async (n) => (await db.table('animais').toArray()).find((a) => a.numero_animal === n && !a.deleted_at);
const a10 = await animal('10');
const a11 = await animal('11');
const eraLegada = a10.era ?? null;

// ---------------------------------------------------------------------------
// F04 — idade.
let d = await profile.describeAge(a10, { em: '2026-03-01' });
assert.equal(d.idade.desconhecida, true, 'sem dado = desconhecida');
assert.equal(d.era, null);
await assert.rejects(profile.updateBirth(a10.id, { nascimento_precisao: 'DIA', nascimento_data: '2025-01-31' }), /fonte/);
await assert.rejects(profile.updateBirth(a10.id, { nascimento_precisao: 'DIA', nascimento_data: `${new Date().getFullYear() + 1}-01-01`, nascimento_fonte: 'REGISTRO_PROPRIO' }), /futuro/);
const pesagensAntes = await db.table('pesagens').count();
await profile.updateBirth(a10.id, { nascimento_precisao: 'DIA', nascimento_data: '2025-01-31', nascimento_fonte: 'DOCUMENTO_COMPRA' });
let a = await animal('10');
assert.equal(a.nascimento_data, '2025-01-31');
assert.equal(a.nascimento_precisao, 'DIA');
assert.equal((await profile.describeAge(a, { em: '2026-02-27' })).idade.meses, 12);
assert.equal((await profile.describeAge(a, { em: '2026-02-28' })).idade.meses, 13, 'aniversário no último dia do mês curto');
assert.equal((await profile.describeAge(a, { em: '2026-06-30' })).idade.meses, 17);
assert.equal(await db.table('pesagens').count(), pesagensAntes, 'idade muda com o calendário, sem nova pesagem');
assert.equal(a.era ?? null, eraLegada, 'era legada (por peso) não é sobrescrita');
const auditoria = (await db.table('auditoria').toArray()).filter((r) => r.entidade === 'animais' && r.entidade_id === a10.id && r.acao === 'CORRIGIR');
assert.equal(auditoria.length, 1, 'correção auditada');
ok('F04 data exata: idade por aniversário, muda com o calendário, correção auditada');

await profile.updateBirth(a11.id, { nascimento_precisao: 'MES', nascimento_mes: '2025-03', nascimento_fonte: 'DECLARACAO_VENDEDOR' });
let b = await animal('11');
assert.equal(b.nascimento_data, '2025-03-01');
let idadeB = (await profile.describeAge(b, { em: '2026-03-15' })).idade;
assert.deepEqual([idadeB.min, idadeB.max, idadeB.estimada], [11, 12, true], 'mês estimado = faixa, nunca dia inventado');
await profile.updateBirth(a11.id, { nascimento_precisao: 'IDADE_DECLARADA', idade_declarada_meses: 18, idade_referencia_data: '2026-01-10', nascimento_fonte: 'DECLARACAO_VENDEDOR' });
b = await animal('11');
assert.equal(b.nascimento_data, null);
idadeB = (await profile.describeAge(b, { em: '2026-04-10' })).idade;
assert.deepEqual([idadeB.meses, idadeB.estimada], [21, true]);
ok('F04 mês estimado (faixa) e idade declarada na data de referência');

// ---------------------------------------------------------------------------
// F05 — era, categoria produtiva, dentição.
d = await profile.describeAge(a, { em: '2026-03-01' });
assert.equal(d.era.rotulo, '13 a 24 meses');
assert.equal(d.categoria.valor, null, 'sem política ligada não sugere categoria');
await assert.rejects(profile.saveAgePolicy({ faixas_meses: [24, 12] }), /crescentes/);
await profile.saveAgePolicy({ faixas_meses: [8, 20, 30], eras: ['Bezerro', 'Sobreano', 'Dois anos', 'Adulto'], sugerir_categoria_produtiva: true, categorias_produtivas: { M: ['Bezerro', 'Garrote', 'Boi magro', 'Boi'], F: ['Bezerra', 'Novilha', 'Novilha', 'Vaca'] } });
d = await profile.describeAge(a, { em: '2026-03-01' });
assert.equal(d.era.rotulo, 'Sobreano');
assert.deepEqual(d.categoria, { valor: 'Garrote', origem: 'SUGERIDA' });
await profile.setProductiveCategory(a10.id, 'Reprodutor');
a = await animal('10');
assert.deepEqual((await profile.describeAge(a, { em: '2026-03-01' })).categoria, { valor: 'Reprodutor', origem: 'INFORMADA' });
await assert.rejects(profile.addDentition(a10.id, { dentes: 3, data: '2026-02-01' }), /0, 2, 4, 6 ou 8/);
await assert.rejects(profile.addDentition(a10.id, { dentes: 0, data: '2024-12-01' }), /anterior ao nascimento/);
const dent = await profile.addDentition(a10.id, { dentes: 2, data: '2026-02-01', avaliador: 'Vet' });
assert.equal(dent.origem, 'OBSERVADA');
assert.equal((await profile.listDentitions(a10.id)).length, 1);
await profile.cancelDentition(dent.id, { motivo: 'Lançada no animal errado' });
assert.equal((await profile.listDentitions(a10.id)).length, 0);
await profile.addDentition(a10.id, { dentes: 2, data: '2026-02-02' });
ok('F05 era parametrizável, categoria informada × sugerida, dentição observada');

// ---------------------------------------------------------------------------
// F06 — estoque de identificadores.
const S1 = '105000000000001';
const S2 = '105000000000002';
await profile.receiveIdentifiers({ tipo: 'BRINCO', faixa: { prefixo: 'A', inicio: '001', fim: '005' }, data: '2026-01-05', fornecedor: 'Fornecedor X' });
await profile.receiveIdentifiers({ tipo: 'SISBOV', codigos: [S1, S2], data: '2026-01-05' });
let estoque = await profile.listStock();
assert.equal(estoque.resumo.DISPONIVEL, 7);
assert.deepEqual(estoque.codigos.filter((c) => c.tipo === 'BRINCO').map((c) => c.valor_normalizado), ['A001', 'A002', 'A003', 'A004', 'A005']);
const movs = await db.table('movimentosIdentificadores').count();
await assert.rejects(profile.receiveIdentifiers({ tipo: 'BRINCO', faixa: { prefixo: 'A', inicio: '005', fim: '006' }, data: '2026-01-06' }), /já está no estoque/);
assert.equal(await db.table('movimentosIdentificadores').count(), movs, 'recebimento com repetido não grava nada');
await assert.rejects(profile.receiveIdentifiers({ tipo: 'BRINCO', codigos: ['SN'], data: '2026-01-06' }), /não é um código de estoque/);
await assert.rejects(profile.receiveIdentifiers({ tipo: 'SISBOV', codigos: ['123'], data: '2026-01-06' }), /15 dígitos/);

// Aplicação: saldo muda uma vez; concorrente no mesmo código: só uma.
await profile.applyIdentifier({ animalId: a10.id, tipo: 'BRINCO', valor: 'a001', data: '2026-01-12' });
const r = await Promise.allSettled([
  profile.applyIdentifier({ animalId: a10.id, tipo: 'BRINCO', valor: 'A002', data: '2026-01-12' }),
  profile.applyIdentifier({ animalId: a11.id, tipo: 'BRINCO', valor: 'A002', data: '2026-01-12' }),
]);
assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1, 'concorrência: um código, uma aplicação');
await assert.rejects(profile.applyIdentifier({ animalId: a11.id, tipo: 'BRINCO', valor: 'A001', data: '2026-01-13' }), /Aplicado|outro animal/);
estoque = await profile.listStock();
assert.equal(estoque.resumo.APLICADO, 2);
assert.equal(estoque.resumo.DISPONIVEL, 5);

// SISBOV: um por animal; troca conserva o animal; oficial não volta.
await assert.rejects(profile.applyIdentifier({ animalId: a10.id, tipo: 'SISBOV', valor: '105000000000099', data: '2026-01-12' }), /não foi recebido/);
await profile.applyIdentifier({ animalId: a10.id, tipo: 'SISBOV', valor: S1, data: '2026-01-12' });
await assert.rejects(profile.applyIdentifier({ animalId: a10.id, tipo: 'SISBOV', valor: S2, data: '2026-01-12' }), /Substituir/);
await profile.substituteIdentifier({ animalId: a10.id, tipo: 'SISBOV', antigo: S1, novo: S2, motivo: 'PERDIDO', data: '2026-02-01' });
const ids10 = (await db.table('animalIdentificadores').where('animal_id').equals(a10.id).toArray()).filter((x) => x.tipo === 'SISBOV');
assert.deepEqual(ids10.map((x) => [x.valor_normalizado, x.ativo, x.fim, x.motivo_troca]).sort(), [[S1, false, '2026-02-01', 'PERDIDO'], [S2, true, null, null]]);
const situ = Object.fromEntries((await profile.listStock({ tipo: 'SISBOV' })).codigos.map((c) => [c.valor_normalizado, c.situacao]));
assert.deepEqual(situ, { [S1]: 'PERDIDO', [S2]: 'APLICADO' });
await assert.rejects(profile.applyIdentifier({ animalId: a11.id, tipo: 'SISBOV', valor: S1, data: '2026-02-02' }), /não é possível|reaproveitado/);
ok('F06 recebimento atômico, aplicação única (concorrente), oficial não reaproveitado, troca no mesmo animal');

// Reserva/liberação/devolução e conferência física.
await profile.stockAction({ tipo: 'BRINCO', valor: 'A003', acao: 'RESERVADO', data: '2026-01-14' });
await profile.stockAction({ tipo: 'BRINCO', valor: 'A003', acao: 'LIBERADO', data: '2026-01-15' });
await profile.stockAction({ tipo: 'BRINCO', valor: 'A005', acao: 'DEVOLVIDO', data: '2026-01-15', observacao: 'Defeito de fábrica' });
await assert.rejects(profile.stockAction({ tipo: 'BRINCO', valor: 'A001', acao: 'DEVOLVIDO', data: '2026-01-15' }), /não é possível/);
const conf = await profile.physicalStockCount({ tipo: 'BRINCO', contados: ['A003', 'a004', 'Z999'] });
assert.deepEqual(conf.faltando, []);
assert.deepEqual(conf.sobrando, [{ valor: 'Z999', situacao_no_sistema: 'NAO_RECEBIDO' }]);
assert.equal(conf.fecha, false);
ok('F06 reserva/liberação/devolução e conferência física sem ajuste automático');

// Backup completo leva as stores novas.
const { backup } = await storage.createFullBackup({ reason: 'gate' });
for (const store of ['movimentosIdentificadores', 'avaliacoesDenticao', 'operacoes', 'operacaoItens']) {
  assert.ok(backup.stores[store].length > 0, `backup inclui ${store}`);
}
ok('backup completo inclui livro de identificadores, dentição e operações');

// ---------------------------------------------------------------------------
// F15 — dossiê.
await db.table('medicamentos').add({ ...base, id: 'MED', nome: 'Vermífugo X', nome_normalizado: 'VERMIFUGO X', ativo: true, carencia_dias: 35 });
await db.table('medicamentos').add({ ...base, id: 'MED2', nome: 'Suplemento', nome_normalizado: 'SUPLEMENTO', ativo: true, carencia_dias: null });
await sanityService.registerApplication({ animal_id: a10.id, data: '2026-02-10', medicamento_id: 'MED', dose: '5', unidade: 'mL' });
await sanityService.registerApplication({ animal_id: a10.id, data: '2026-02-11', medicamento_id: 'MED2' });
const venda = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-04-01', parceiro_id: 'PARC', nf_numero: 'NF-9', itens: [{ animal_id: a10.id, peso: 330, peso_origem: 'BALANCA' }] });
await ops.confirmOperation(venda.operacao.id);
const dossie = await profile.getTraceabilityDossier(a10.id, { hoje: '2026-02-20' });
assert.match(dossie.aviso, /Não é certificado/);
assert.equal(dossie.origem.operacao.gta, 'GTA-77');
assert.equal(dossie.origem.operacao.parceiro, 'Vendedor Norte');
assert.deepEqual(dossie.lotes.map((l) => l.lote), ['Recria']);
assert.equal(dossie.sanidade.find((s) => s.medicamento === 'Vermífugo X').carencia_carne_ate, '2026-03-17');
assert.equal(dossie.carencia_carne_aberta_ate, '2026-03-17');
assert.ok(dossie.desconhecidos.includes('Mãe'));
assert.ok(dossie.desconhecidos.some((u) => /Carência/.test(u)), 'carência desconhecida ≠ zero');
assert.ok(!dossie.desconhecidos.includes('Data de nascimento / idade'));
assert.equal(dossie.destino.operacao.nf, 'NF-9');
assert.equal(dossie.destino.peso_kg, 330);
assert.ok(dossie.identidade.identificadores.some((i) => i.tipo === 'SISBOV' && i.motivo_troca === 'PERDIDO'));
const linhas = profile.traceabilityRows(dossie);
assert.ok(linhas.some(([sec]) => sec === 'Desconhecido'));
assert.ok(!JSON.stringify(dossie).match(/certificado SISBOV|EUDR compliant|conforme EUDR/i), 'sem alegação de certificação');
ok('F15 dossiê com origem/documentos/lotes/sanidade+carência/destino, desconhecidos e aviso');

await deleteDbForTests();
console.log('OK verify-animal-profile');
console.log(JSON.stringify(resumo, null, 2));
