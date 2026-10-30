// Gate sanity:posology:verify — missão pesagens-integrada, checkpoint B2 (F08, F09, F10).
// Comportamento real (fake-indexeddb + serviços reais):
//   F08 posologia versionada: rascunho incompleto não calcula nem aprova; aprovada é imutável; nova versão
//       substitui a anterior (vigência fecha na véspera); dose_padrao em texto continua só referência.
//   F09 dose sugerida × aplicada: regra proporcional com arredondamento DA REGRA e dose máxima; tabela de faixas;
//       peso estimado/futuro bloqueia, peso antigo avisa; aplicação exige confirmação e guarda snapshot.
//   F10 carência: data civil; desconhecida ≠ zero; abate em carência bloqueado sem liberação técnica (auditada);
//       venda em carência avisa.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';

await deleteDbForTests();
const db = await storage.ensureReady();
const resumo = [];
const ok = (r) => resumo.push(r);
const TS = '2026-01-01T00:00:00.000Z';
const base = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
await db.table('marcas').add({ ...base, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
await db.table('parceiros').add({ ...base, id: 'FRIG', nome: 'Frigorífico Sul', nome_normalizado: 'FRIGORIFICO SUL', ativo: true });

const medA = await sanity.saveMedicamento({ nome: 'Produto A', unidade_padrao: 'ml', via_aplicacao: 'SC', dose_padrao: '1 ml / 50 kg', carencia_dias: 35 });
const medB = await sanity.saveMedicamento({ nome: 'Produto B (bula por faixas)', unidade_padrao: 'ml', carencia_dias: 0 });
const medSem = await sanity.saveMedicamento({ nome: 'Produto sem carência cadastrada', unidade_padrao: 'ml' });
assert.equal(sanity.suggestedDose(medA), null, 'dose_padrao em texto não vira número');

const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-01-05', itens: [1, 2, 3].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 300 + n })) });
await ops.confirmOperation(compra.operacao.id);
const animal = async (n) => (await db.table('animais').toArray()).find((a) => a.numero_animal === n && !a.deleted_at);
const [a1, a2, a3] = [await animal('1'), await animal('2'), await animal('3')];

// ---------------------------------------------------------------------------
// F08 — posologia.
let sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-01', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, false);
assert.match(sug.bloqueios[0], /sem posologia/);
const rascunho = await sanity.savePosologyDraft({ medicamento_id: medA.id, modo: 'PROPORCIONAL', unidade: 'ml', dose_por_unidade: '1', kg_por_unidade: '50' });
assert.equal(rascunho.status, 'RASCUNHO');
assert.equal(rascunho.versao, 1);
await assert.rejects(sanity.approvePosology(rascunho.id, { responsavel: 'Dr. Fulano CRMV 123' }), /Falta para aprovar/);
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-01', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, false, 'rascunho não calcula dose');
const completo = {
  id: rascunho.id, medicamento_id: medA.id, modo: 'PROPORCIONAL', unidade: 'ml', dose_por_unidade: '1', kg_por_unidade: '50',
  principio_ativo: 'Princípio X', apresentacao: 'Frasco 500 mL', indicacao: 'Endoparasitas', via_aplicacao: 'SC',
  arredondamento: { modo: 'ACIMA', passo: '0,5' }, dose_maxima: '15', carencia_carne_dias: 35, carencia_leite_dias: '',
  fonte: 'BULA', fonte_referencia: 'Bula rev. 2025', vigencia_inicio: '2026-01-01',
};
await sanity.savePosologyDraft(completo);
await assert.rejects(sanity.approvePosology(rascunho.id, { responsavel: '' }), /responsável técnico/);
const v1 = await sanity.approvePosology(rascunho.id, { responsavel: 'Dr. Fulano CRMV 123' });
assert.equal(v1.status, 'APROVADA');
await assert.rejects(sanity.savePosologyDraft({ ...completo, dose_por_unidade: '2' }), (err) => err.code === 'POSOLOGIA_IMUTAVEL');
ok('F08 rascunho incompleto não aprova nem calcula; aprovada é imutável; texto livre segue só referência');

// ---------------------------------------------------------------------------
// F09 — cálculo.
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-01', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
assert.deepEqual([sug.ok, sug.dose, sug.unidade], [true, 6.5, 'ml'], '312/50 = 6,24 → para cima de 0,5 = 6,5');
assert.match(sug.regra, /1 ml a cada 50 kg/);
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 800, data: '2026-03-01', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.dose, 15);
assert.ok(sug.avisos.some((a) => /máximo da regra/.test(a)));
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-01', origem: 'ESTIMADO' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, false);
assert.match(sug.bloqueios.join(' '), /estimado ou projetado/);
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-02', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, false);
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-01-10', origem: 'PESAGEM_REGISTRADA' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, true);
assert.ok(sug.avisos.some((a) => /50 dias atrás/.test(a)), 'peso antigo avisa');
sug = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2025-12-01', origem: 'BALANCA' }, dataAplicacao: '2025-12-15' });
assert.equal(sug.ok, false, 'fora da vigência');

// Faixas (bula) sem arredondamento universal.
const faixas = await sanity.savePosologyDraft({
  medicamento_id: medB.id, modo: 'FAIXAS', unidade: 'ml', principio_ativo: 'Princípio Y', apresentacao: 'Frasco 50 mL', indicacao: 'Ectoparasitas',
  via_aplicacao: 'SC', faixas: [{ peso_min: 0, peso_max: 100, dose: 2 }, { peso_min: 100.01, peso_max: 200, dose: 4.25 }],
  carencia_carne_dias: 0, fonte: 'BULA', vigencia_inicio: '2026-01-01',
});
await assert.rejects(sanity.savePosologyDraft({ ...faixas, id: undefined, faixas: [{ peso_min: 0, peso_max: 100, dose: 2 }, { peso_min: 90, peso_max: 200, dose: 4 }] }), /sobrepõe/);
await sanity.approvePosology(faixas.id, { responsavel: 'Dra. Beltrana CRMV 456' });
sug = await sanity.getDoseSuggestion({ medicamentoId: medB.id, peso: { kg: 150, data: '2026-03-01', origem: 'MANUAL' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.dose, 4.25, 'faixa da bula, sem arredondar');
sug = await sanity.getDoseSuggestion({ medicamentoId: medB.id, peso: { kg: 250, data: '2026-03-01', origem: 'MANUAL' }, dataAplicacao: '2026-03-01' });
assert.equal(sug.ok, false);
assert.match(sug.bloqueios[0], /fora das faixas/);
ok('F09 proporcional com arredondamento/máximo da regra; faixas; peso estimado/futuro bloqueia; peso antigo avisa');

// Aplicação avulsa com posologia: confirmação e snapshot.
const sugA = await sanity.getDoseSuggestion({ medicamentoId: medA.id, peso: { kg: 312, data: '2026-03-01', origem: 'BALANCA' }, dataAplicacao: '2026-03-01' });
const appBase = { animal_id: a1.id, data: '2026-03-01', medicamento_id: medA.id, posologia_id: sugA.posologia.id, dose_sugerida: sugA.dose, peso_base_kg: 312, peso_base_data: '2026-03-01', peso_base_origem: 'BALANCA', unidade: 'ml' };
await assert.rejects(sanity.registerApplication({ ...appBase, dose: 7 }), /Confirme a dose/);
await assert.rejects(sanity.registerApplication({ ...appBase, dose_confirmada: true }), /dose aplicada/);
const aplicada = await sanity.registerApplication({ ...appBase, dose: 7, dose_confirmada: true });
assert.equal(aplicada.dose_sugerida, 6.5);
assert.equal(aplicada.dose_aplicada, 7, 'operador pode aplicar dose diferente da sugerida');
assert.equal(aplicada.posologia_snapshot.dose_por_unidade, 1);
assert.equal(aplicada.posologia_snapshot.medicamento_nome, 'Produto A');
assert.equal(aplicada.carencia_carne_ate, '2026-04-05', '01/03 + 35 dias');
assert.equal(aplicada.carencia_leite_ate, null, 'leite desconhecida, não zero');

// Nova versão substitui a v1; a aplicação antiga mantém o snapshot.
const v2 = await sanity.savePosologyDraft({ ...completo, id: undefined, dose_por_unidade: '1,2', vigencia_inicio: '2026-06-01' });
assert.equal(v2.versao, 2);
await assert.rejects(sanity.savePosologyDraft({ ...completo, id: undefined, vigencia_inicio: '2025-12-01' }).then((d) => sanity.approvePosology(d.id, { responsavel: 'Dr. Fulano CRMV 123' })), /depois de 2026-01-01/);
await sanity.approvePosology(v2.id, { responsavel: 'Dr. Fulano CRMV 123' });
const versoes = Object.fromEntries((await sanity.listPosologies({ medicamentoId: medA.id })).filter((p) => p.versao <= 2).map((p) => [p.versao, [p.status, p.vigencia_fim ?? null]]));
assert.deepEqual(versoes, { 1: ['SUBSTITUIDA', '2026-05-31'], 2: ['APROVADA', null] });
const reread = (await db.table('aplicacoesSanidade').where('id').equals(aplicada.id).first());
assert.equal(reread.posologia_snapshot.dose_por_unidade, 1, 'regra alterada no futuro não muda o passado');
await assert.rejects(sanity.registerApplication({ ...appBase, dose: 7, dose_confirmada: true }), /não está aprovada/);
ok('F09 aplicação exige confirmação, guarda sugerida × aplicada, peso e snapshot; nova versão não altera o passado');

// Aplicação pelo Lançamento (mesma transação da pesagem) também calcula carência.
await weighingService.createEntry({ tipo_manejo: 'Manejo', animal_id: a2.id, numero_animal: '2', marca: 'ALFA', data_pesagem: '2026-03-01', peso: 330,
  aplicacoes_sanidade: [{ medicamento_id: medB.id, posologia_id: faixas.id, dose: 4.25, dose_sugerida: 4.25, dose_confirmada: true, peso_base_kg: 330, peso_base_data: '2026-03-01', peso_base_origem: 'BALANCA', unidade: 'ml' }] }).catch((err) => {
  // 330 kg está fora das faixas, mas o serviço não recalcula: a dose aplicada é do operador; a regra só registra.
  throw err;
});
const doLancamento = (await db.table('aplicacoesSanidade').where('animal_id').equals(a2.id).toArray())[0];
assert.equal(doLancamento.carencia_carne_ate, '2026-03-01', 'carência zero = libera no mesmo dia');
assert.equal(doLancamento.carencia_conhecida, true);
ok('Lançamento grava posologia, dose e carência na transação da pesagem');

// ---------------------------------------------------------------------------
// F10 — carência no abate e na venda.
await sanity.registerApplication({ animal_id: a3.id, data: '2026-03-02', medicamento_id: medSem.id, dose: 3 });
const status = await sanity.getWithdrawalStatus([a1.id, a2.id, a3.id], '2026-03-20');
assert.deepEqual([status[a1.id].emCarencia, status[a1.id].ate], [true, '2026-04-05']);
assert.equal(status[a2.id].emCarencia, false, 'carência zero não fica em aberto');
assert.equal(status[a3.id].emCarencia, false);
assert.equal(status[a3.id].desconhecidas.length, 1, 'carência desconhecida é sinalizada, não tratada como zero');

const abate = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'ABATE', data: '2026-03-20', parceiro_id: 'FRIG', itens: [{ animal_id: a1.id, peso: 450 }] });
const antes = await db.table('pesagens').count();
await assert.rejects(ops.confirmOperation(abate.operacao.id, { aceitarAvisos: true }), (err) => err.code === 'OPERACAO_CONFERENCIA' && /carência de carne até 2026-04-05/.test(err.message));
assert.equal(await db.table('pesagens').count(), antes, 'abate bloqueado não grava nada');
await assert.rejects(ops.registerWithdrawalRelease(abate.operacao.id, { motivo: 'curto', responsavel: 'X', data: '2026-03-20' }), /motivo/);
await ops.registerWithdrawalRelease(abate.operacao.id, { motivo: 'Laudo de resíduo negativo anexado ao processo', responsavel: 'Dr. Fulano CRMV 123', evidencia: 'Laudo 77/2026', data: '2026-03-19' });
await assert.rejects(ops.confirmOperation(abate.operacao.id), (err) => err.code === 'OPERACAO_AVISOS' && err.conferencia.avisos.some((a) => /Liberação técnica: Dr. Fulano/.test(a)));
await ops.confirmOperation(abate.operacao.id, { aceitarAvisos: true });
assert.equal((await animal('1')).situacao, 'ABATIDO');
const audit = (await db.table('auditoria').toArray()).find((r) => r.acao === 'LIBERAR_CARENCIA');
assert.ok(audit && /Dr. Fulano/.test(audit.resumo), 'liberação auditada');

const venda = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-03-20', itens: [{ animal_id: a3.id, peso: 400 }] });
await assert.rejects(ops.confirmOperation(venda.operacao.id), (err) => err.code === 'OPERACAO_AVISOS' && err.conferencia.avisos.some((a) => /carência desconhecida/.test(a)));
await ops.discardDraft(venda.operacao.id);
ok('F10 abate em carência bloqueado sem liberação técnica (auditada); desconhecida avisa; zero não prende');

// Nenhuma dose/produto fixo no código.
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const hardcoded = walk('src').filter((f) => /\.(js|jsx)$/.test(f) && /dectomax/i.test(readFileSync(f, 'utf8')));
assert.deepEqual(hardcoded, [], 'sem produto/dose fixa no código');
ok('sem produto ou dose fixa no código');

await deleteDbForTests();
console.log('OK verify-sanity-posology');
console.log(JSON.stringify(resumo, null, 2));
