// Gate sanity:application:verify (ADR-049) — aplicações de sanidade por animal.
// Prova: validação pura (pt-BR, SANITY_INVALID); aplicação avulsa com auditoria e ator;
// Lançamento (weighingService.createEntry + payload.aplicacoes_sanidade) grava pesagem e
// aplicações na MESMA transação, com rollback total quando uma aplicação é inválida (validação
// pura ou referência inexistente/inativa) e nada no legacy_payload; três animais em sequência →
// três aplicações com animal_id distinto, mesma configuração, datas e ator corretos;
// cancelamento (fato histórico preservado); cancelar a pesagem cancela as aplicações vinculadas;
// listApplications por animal/período/programa/medicamento; integridade detecta referências
// órfãs; permissões (weighing.write/edit/read); bloqueio de migração; backup → restore preserva
// as três stores; limpeza operacional apaga aplicações e preserva cadastros; reset apaga tudo.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { SANITY_STORES } from '../src/storage/indexedDb/schema.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { MIGRATION_STATUS, clearWriteBlock, readMigrationState, setWriteBlocked } from '../src/storage/migrations/migrationState.js';
import * as coordinator from '../src/storage/migrations/migrationCoordinator.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { LEGACY_PAYLOAD_FORBIDDEN } from '../src/modules/weighing/domain/weighingMapper.js';
import storage from '../src/storage/storageAdapter.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const resumo = { regras: [] };
const ok = (regra) => resumo.regras.push(regra);
const as = (role, nome = `Usuário ${role}`) => setActorProvider(() => ({ id: `u-${role}`, nome, role }));
const safetyEvidence = { path: 'C:\\isolated-test\\pre-operation.json', size: 1024, sha256: 'c'.repeat(64) };
const strip = ({ localId: _localId, ...rest }) => rest;

async function rejectsCode(run, code, message) {
  let error = null;
  try { await run(); } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

setActorProvider(null);
clearWriteBlock();
await deleteDbForTests();
await coordinator.openWithMigration({ files: null });
const db = await ensureStorageReady();
const counts = async () => Object.fromEntries(await Promise.all(['pesagens', 'animais', 'sessoesPesagem', 'auditoria', 'aplicacoesSanidade', 'movimentosAnimais', 'animalIdentificadores'].map(async (name) => [name, await db.table(name).count()])));
const base = { empresa_id: 'local', marca: 'ALFA', sexo: 'M', raca: 'Nelore' };
const cadastro = (numero, data, extra = {}) => ({ ...base, tipo_manejo: 'Cadastro', numero_animal: numero, data_pesagem: data, peso: 220, ...extra });
// Atores do gate existem em `usuarios` (a integridade exige o operador das sessões).
await db.table('usuarios').bulkAdd(['ADMIN', 'OPERADOR', 'CONSULTA'].map((role) => ({
  id: `u-${role}`, empresa_id: 'local', nome: role, login: role.toLowerCase(), login_normalizado: role.toLowerCase(), role, ativo: true,
  password_hash: 'aGFzaA==', password_salt: 'c2FsdA==', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null,
})));

as('ADMIN', 'Ana Admin');
const aftosa = await sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' });
const verm = await sanity.saveProgram({ nome: 'Vermifugação', tipo: 'VERMIFUGACAO' });
const iver = await sanity.saveMedicamento({ nome: 'Ivermectina 1%', unidade_padrao: 'ml', via_aplicacao: 'SC', dose_padrao: '1 ml / 50 kg' });
const vacina = await sanity.saveMedicamento({ nome: 'Vacina bivalente', unidade_padrao: 'dose', via_aplicacao: 'IM', dose_padrao: '2' });
const inativo = await sanity.saveProgram({ nome: 'Programa antigo', tipo: 'OUTRO' });
await sanity.setProgramActive(inativo.id, false);

// ---------------------------------------------------------------------------
// Validação pura.
// ---------------------------------------------------------------------------
const valido = sanity.validateApplicationInput({ animal_id: 'a1', data: '2026-09-01', medicamento_id: iver.id, dose: '2,5', unidade: 'ML', via_aplicacao: 'Intramuscular (IM)', observacao: '  lado esquerdo ' });
assert.deepEqual(valido, { animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: null, medicamento_id: iver.id, dose: 2.5, unidade: 'ml', via_aplicacao: 'IM', observacao: 'lado esquerdo', sessao_id: null });
for (const [input, pattern, rotulo] of [
  [{ animal_id: 'a1', data: '2026-09-01' }, /Informe o programa de sanidade ou o medicamento/, 'sem programa nem medicamento'],
  [{ data: '2026-09-01', programa_sanidade_id: 'p' }, /Animal é obrigatório/, 'sem animal'],
  [{ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', dose: 0 }, /Dose deve ser numérica e maior que zero/, 'dose zero'],
  [{ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', dose: -2 }, /Dose deve ser numérica/, 'dose negativa'],
  [{ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', dose: 'duas' }, /Dose deve ser numérica/, 'dose texto'],
  [{ animal_id: 'a1', data: '2100-01-01', programa_sanidade_id: 'p' }, /não pode estar no futuro/, 'data futura'],
  [{ animal_id: 'a1', data: '01/09/2026', programa_sanidade_id: 'p' }, /use AAAA-MM-DD/, 'data fora do formato'],
  [{ animal_id: 'a1', data: '2026-02-30', programa_sanidade_id: 'p' }, /Data da aplicação inválida/, 'data inexistente'],
  [{ animal_id: 'a1', programa_sanidade_id: 'p' }, /Data da aplicação é obrigatória/, 'sem data'],
  [{ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', unidade: 'litro' }, /Unidade da dose inválida/, 'unidade inválida'],
  [{ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', via_aplicacao: 'Retal' }, /Via de aplicação inválida/, 'via inválida'],
]) {
  let error = null;
  try { sanity.validateApplicationInput(input); } catch (err) { error = err; }
  assert.ok(error instanceof sanity.SanityError && error.code === 'SANITY_INVALID', `validação: ${rotulo} lança SANITY_INVALID`);
  assert.match(error.message, pattern, `validação: ${rotulo} com mensagem em pt-BR`);
}
assert.equal(sanity.validateApplicationInput({ animal_id: 'a1', data: '2026-09-01', programa_sanidade_id: 'p', dose: '' }).dose, null, 'dose vazia → null');
ok('validacao-pura');

// ---------------------------------------------------------------------------
// Aplicação avulsa.
// ---------------------------------------------------------------------------
as('OPERADOR', 'Olga Operadora');
const animalBase = await weighingService.createEntry(cadastro('10', '2026-09-01'));
assert.deepEqual(animalBase.aplicacoes_sanidade, [], 'createEntry sem aplicações devolve lista vazia');
const avulsa = await sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: verm.id, medicamento_id: iver.id, dose: '4', observacao: 'curral 2' });
assert.equal(avulsa.animal_id, animalBase.animal_id);
assert.equal(avulsa.data, '2026-09-02');
assert.equal(avulsa.dose, 4);
assert.equal(avulsa.unidade, 'ml', 'unidade omitida herda o padrão do medicamento quando há dose');
assert.equal(avulsa.via_aplicacao, 'SC', 'via omitida herda o padrão do medicamento');
assert.equal(avulsa.programa_nome_snapshot, 'Vermifugação');
assert.equal(avulsa.medicamento_nome_snapshot, 'Ivermectina 1%');
assert.equal(avulsa.pesagem_id, null);
assert.equal(avulsa.sessao_id, null);
assert.equal(avulsa.created_by, 'u-OPERADOR');
assert.equal(avulsa.created_by_nome, 'Olga Operadora');
assert.equal(avulsa.cancelled_at, null);
assert.equal(avulsa.motivo_cancelamento, null);
assert.equal(avulsa.deleted_at, null);
assert.equal(avulsa.empresa_id, 'local');
const auditAvulsa = await db.table('auditoria').where('entidade_id').equals(avulsa.id).first();
assert.equal(auditAvulsa.acao, 'CRIAR_APLICACAO_SANIDADE');
assert.equal(auditAvulsa.entidade, 'aplicacoesSanidade');
assert.equal(auditAvulsa.usuario_id, 'u-OPERADOR');
assert.equal(auditAvulsa.usuario_nome_snapshot, 'Olga Operadora');
// Cronologia do animal: não antes do Cadastro, não depois da saída (no dia da saída é aceita).
const saiu = await weighingService.createEntry(cadastro('11', '2026-09-01'));
await weighingService.createEntry({ ...base, tipo_manejo: 'Saída', motivo_saida: 'Morte', animal_id: saiu.animal_id, numero_animal: '11', data_pesagem: '2026-09-03' });
const noDiaDaSaida = await sanity.registerApplication({ animal_id: saiu.animal_id, data: '2026-09-03', programa_sanidade_id: aftosa.id });
assert.ok(noDiaDaSaida.id, 'aplicação no dia da saída é aceita');
const antesNegativos = await counts();
const antesDoCadastro = await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-08-31', programa_sanidade_id: verm.id }), 'SANITY_INVALID', 'data anterior ao cadastro');
assert.match(antesDoCadastro.message, /anterior ao cadastro do animal \(2026-09-01\)/);
const depoisDaSaida = await rejectsCode(() => sanity.registerApplication({ animal_id: saiu.animal_id, data: '2026-09-04', programa_sanidade_id: aftosa.id }), 'SANITY_INVALID', 'data posterior à saída');
assert.match(depoisDaSaida.message, /posterior à saída do animal \(2026-09-03\)/);
await rejectsCode(() => sanity.registerApplication({ animal_id: 'animal-fantasma', data: '2026-09-02', programa_sanidade_id: verm.id }), 'SANITY_INVALID', 'animal inexistente');
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: 'programa-fantasma' }), 'SANITY_INVALID', 'programa inexistente');
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: inativo.id }), 'SANITY_INVALID', 'programa inativo');
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: verm.id, sessao_id: 'sessao-fantasma' }), 'SANITY_INVALID', 'sessão inexistente');
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2100-01-01', programa_sanidade_id: verm.id }), 'SANITY_INVALID', 'data futura');
as('CONSULTA');
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: verm.id }), 'AUTH_FORBIDDEN', 'CONSULTA não registra aplicação');
assert.ok((await sanity.listApplications({ animalId: animalBase.animal_id })).length === 1, 'CONSULTA lê aplicações (weighing.read)');
setActorProvider(() => null);
await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-02', programa_sanidade_id: verm.id }), 'AUTH_FORBIDDEN', 'sem sessão: registro recusado');
await rejectsCode(() => sanity.listApplications(), 'AUTH_FORBIDDEN', 'sem sessão: leitura recusada');
assert.deepEqual(await counts(), antesNegativos, 'aplicações recusadas não gravam nada');
as('OPERADOR', 'Olga Operadora');
ok('avulsa');

// ---------------------------------------------------------------------------
// Lançamento: mesma transação, rollback, nada no legacy_payload.
// ---------------------------------------------------------------------------
const manejo = await weighingService.createEntry({
  ...base, tipo_manejo: 'Manejo', animal_id: animalBase.animal_id, numero_animal: '10', data_pesagem: '2026-09-05', peso: 240,
  aplicacoes_sanidade: [
    { programa_sanidade_id: aftosa.id, medicamento_id: vacina.id, dose: 2 },
    { medicamento_id: iver.id, dose: '4,5', unidade: 'ml', via_aplicacao: 'SC', observacao: 'reforço' },
  ],
});
assert.equal(manejo.aplicacoes_sanidade.length, 2, 'retorno do createEntry traz as aplicações criadas');
const pesagemGravada = await db.table('pesagens').where('id').equals(manejo.id).first();
for (const row of manejo.aplicacoes_sanidade) {
  assert.equal(row.pesagem_id, manejo.id, 'aplicação vinculada à pesagem');
  assert.ok(row.sessao_id && row.sessao_id === pesagemGravada.sessao_id, 'aplicação na sessão da pesagem (sessao_id gravado na pesagem)');
  assert.equal(row.animal_id, animalBase.animal_id, 'animal da pesagem');
  assert.equal(row.data, '2026-09-05', 'data = data_pesagem');
  assert.equal(row.created_by, 'u-OPERADOR');
}
assert.equal(manejo.aplicacoes_sanidade[0].unidade, 'dose');
assert.equal(manejo.aplicacoes_sanidade[1].dose, 4.5);
assert.ok(!('aplicacoes_sanidade' in pesagemGravada) && !('aplicacoes_sanidade' in pesagemGravada.legacy_payload), 'aplicações fora da pesagem e do legacy_payload');
assert.deepEqual(LEGACY_PAYLOAD_FORBIDDEN.filter((key) => key in pesagemGravada.legacy_payload), [], 'sem chaves proibidas (sanidade_ids/sanidades) no payload');
const auditsLanc = (await db.table('auditoria').where('acao').equals('CRIAR_APLICACAO_SANIDADE').toArray()).filter((row) => row.depois?.pesagem_id === manejo.id);
assert.equal(auditsLanc.length, 2, 'uma auditoria CRIAR_APLICACAO_SANIDADE por aplicação do lançamento');
assert.ok(auditsLanc.every((row) => row.origem === 'lancamento' && row.usuario_id === 'u-OPERADOR'));

const antesRollback = await counts();
const sessoesAntes = await db.table('sessoesPesagem').toArray();
const rollbackRef = await rejectsCode(() => weighingService.createEntry(cadastro('20', '2026-09-06', {
  aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id }, { programa_sanidade_id: 'programa-fantasma' }],
})), 'SANITY_INVALID', 'referência inexistente em uma das aplicações');
assert.match(rollbackRef.message, /Programa de sanidade não encontrado/);
assert.deepEqual(await counts(), antesRollback, 'rollback: nem pesagem, nem animal, nem sessão nova, nem aplicação válida, nem auditoria');
assert.equal((await db.table('sessoesPesagem').toArray()).length, sessoesAntes.length, 'sessão criada dentro da transação foi desfeita');
await rejectsCode(() => weighingService.createEntry(cadastro('21', '2026-09-06', { aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id }, { medicamento_id: vacina.id, dose: -1 }] })), 'SANITY_INVALID', 'dose inválida no lançamento');
await rejectsCode(() => weighingService.createEntry(cadastro('22', '2026-09-06', { aplicacoes_sanidade: [{ programa_sanidade_id: inativo.id }] })), 'SANITY_INVALID', 'programa inativo no lançamento');
await rejectsCode(() => weighingService.createEntry(cadastro('23', '2026-09-06', { aplicacoes_sanidade: [{ dose: 1 }] })), 'SANITY_INVALID', 'aplicação sem programa nem medicamento');
await rejectsCode(() => weighingService.createEntry(cadastro('24', '2026-09-06', { aplicacoes_sanidade: { programa_sanidade_id: aftosa.id } })), 'SANITY_INVALID', 'aplicacoes_sanidade precisa ser lista');
assert.deepEqual(await counts(), antesRollback, 'nenhuma recusa de lançamento gravou algo');
as('CONSULTA');
await rejectsCode(() => weighingService.createEntry(cadastro('25', '2026-09-06', { aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id }] })), 'AUTH_FORBIDDEN', 'CONSULTA não lança com aplicações');
assert.deepEqual(await counts(), antesRollback);
as('OPERADOR', 'Olga Operadora');
ok('lancamento-transacao-rollback');

// ---------------------------------------------------------------------------
// Três animais em sequência com a mesma configuração.
// ---------------------------------------------------------------------------
as('OPERADOR', 'Otávio Operador');
const config = [{ programa_sanidade_id: aftosa.id, medicamento_id: vacina.id, dose: 2, unidade: 'dose', via_aplicacao: 'IM', observacao: 'campanha' }];
const sequencia = [];
for (const numero of ['101', '102', '103']) {
  sequencia.push(await weighingService.createEntry(cadastro(numero, '2026-09-10', { aplicacoes_sanidade: config })));
}
const aplicacoesSeq = sequencia.flatMap((entry) => entry.aplicacoes_sanidade);
assert.equal(aplicacoesSeq.length, 3, 'três lançamentos → três aplicações');
assert.equal(new Set(aplicacoesSeq.map((row) => row.animal_id)).size, 3, 'três animal_id distintos');
assert.deepEqual(aplicacoesSeq.map((row) => row.animal_id), sequencia.map((entry) => entry.animal_id), 'cada aplicação no animal da própria pesagem');
assert.deepEqual(aplicacoesSeq.map((row) => row.pesagem_id), sequencia.map((entry) => entry.id), 'cada aplicação vinculada à própria pesagem');
const configuracao = (row) => ({ programa: row.programa_sanidade_id, medicamento: row.medicamento_id, dose: row.dose, unidade: row.unidade, via: row.via_aplicacao, observacao: row.observacao });
assert.ok(aplicacoesSeq.every((row) => JSON.stringify(configuracao(row)) === JSON.stringify(configuracao(aplicacoesSeq[0]))), 'mesma configuração nas três');
assert.ok(aplicacoesSeq.every((row) => row.data === '2026-09-10'), 'datas corretas');
assert.ok(aplicacoesSeq.every((row) => row.created_by === 'u-OPERADOR' && row.created_by_nome === 'Otávio Operador'), 'ator correto');
const persistidas = await Promise.all(aplicacoesSeq.map((row) => db.table('aplicacoesSanidade').where('id').equals(row.id).first()));
assert.deepEqual(persistidas.map(strip), aplicacoesSeq, 'o que foi devolvido é o que foi gravado');
ok('tres-animais-em-sequencia');

// ---------------------------------------------------------------------------
// Cancelamento manual e cancelamento por pesagem cancelada.
// ---------------------------------------------------------------------------
const totalAplicacoes = await db.table('aplicacoesSanidade').count();
as('CONSULTA');
await rejectsCode(() => sanity.cancelApplication(avulsa.id, { motivo: 'x' }), 'AUTH_FORBIDDEN', 'CONSULTA não cancela');
as('OPERADOR', 'Olga Operadora');
await rejectsCode(() => sanity.cancelApplication('nao-existe'), 'SANITY_NOT_FOUND', 'cancelar id inexistente');
const cancelada = await sanity.cancelApplication(avulsa.id, { motivo: '  Registro em duplicidade ' });
assert.ok(cancelada.cancelled_at, 'cancelled_at gravado');
assert.equal(cancelada.motivo_cancelamento, 'Registro em duplicidade');
assert.equal(await db.table('aplicacoesSanidade').count(), totalAplicacoes, 'fato histórico nunca é apagado');
const auditCancel = (await db.table('auditoria').where('acao').equals('CANCELAR_APLICACAO_SANIDADE').toArray()).filter((row) => row.entidade_id === avulsa.id);
assert.equal(auditCancel.length, 1);
assert.equal(auditCancel[0].usuario_id, 'u-OPERADOR');
await sanity.cancelApplication(avulsa.id, { motivo: 'de novo' });
assert.equal((await db.table('auditoria').where('acao').equals('CANCELAR_APLICACAO_SANIDADE').toArray()).filter((row) => row.entidade_id === avulsa.id).length, 1, 'cancelar de novo não altera nem audita');
assert.equal((await db.table('aplicacoesSanidade').where('id').equals(avulsa.id).first()).motivo_cancelamento, 'Registro em duplicidade');
assert.ok(!(await sanity.listApplications({ animalId: animalBase.animal_id })).some((row) => row.id === avulsa.id), 'cancelada fora da lista padrão');
assert.ok((await sanity.listApplications({ animalId: animalBase.animal_id, includeCancelled: true })).some((row) => row.id === avulsa.id), 'includeCancelled mostra a cancelada');

await weighingService.deleteEntry(manejo.id);
const doManejo = (await db.table('aplicacoesSanidade').where('pesagem_id').equals(manejo.id).toArray());
assert.equal(doManejo.length, 2);
assert.ok(doManejo.every((row) => row.cancelled_at && row.motivo_cancelamento === 'pesagem cancelada'), 'excluir a pesagem cancela as aplicações vinculadas');
assert.equal((await db.table('auditoria').where('acao').equals('CANCELAR_APLICACAO_SANIDADE').toArray()).filter((row) => row.origem === 'cancelamento-pesagem').length, 2, 'cancelamento por pesagem auditado');
// Manejo (sem movimento) para não misturar o órfão conhecido de movimentosAnimais ao cancelar Cadastro.
const manejo103 = await weighingService.createEntry({ ...base, tipo_manejo: 'Manejo', animal_id: sequencia[2].animal_id, numero_animal: '103', data_pesagem: '2026-09-11', peso: 230, aplicacoes_sanidade: config });
await weighingService.bulkDeleteEntries([manejo103.id]);
const terceira = await db.table('aplicacoesSanidade').where('pesagem_id').equals(manejo103.id).first();
assert.equal(terceira.motivo_cancelamento, 'pesagem cancelada', 'bulkDeleteEntries também cancela');
assert.ok((await Promise.all(sequencia.map((entry) => db.table('aplicacoesSanidade').where('pesagem_id').equals(entry.id).first()))).every((row) => row.cancelled_at === null), 'aplicações de outras pesagens intactas');
ok('cancelamento');

// ---------------------------------------------------------------------------
// listApplications: animal, período, programa, medicamento; nomes por join.
// ---------------------------------------------------------------------------
const outraData = await weighingService.createEntry(cadastro('30', '2026-08-20', { aplicacoes_sanidade: [{ programa_sanidade_id: verm.id, medicamento_id: iver.id, dose: 3 }] }));
const idsOf = (rows) => rows.map((row) => row.id).sort();
const ativas = await sanity.listApplications();
assert.ok(ativas.every((row) => !row.cancelled_at), 'padrão lista só ativas');
assert.deepEqual(ativas.map((row) => row.data), [...ativas.map((row) => row.data)].sort(), 'ordenadas por data');
assert.deepEqual(idsOf(await sanity.listApplications({ animalId: sequencia[0].animal_id })), [sequencia[0].aplicacoes_sanidade[0].id], 'por animal');
assert.deepEqual(idsOf(await sanity.listApplications({ from: '2026-08-01', to: '2026-08-31' })), [outraData.aplicacoes_sanidade[0].id], 'por período');
assert.deepEqual(idsOf(await sanity.listApplications({ from: '2026-09-10' })), idsOf(aplicacoesSeq), 'só data inicial');
assert.deepEqual(idsOf(await sanity.listApplications({ to: '2026-08-31' })), [outraData.aplicacoes_sanidade[0].id], 'só data final');
assert.deepEqual(idsOf(await sanity.listApplications({ programaId: verm.id })), [outraData.aplicacoes_sanidade[0].id], 'por programa');
assert.deepEqual(idsOf(await sanity.listApplications({ medicamentoId: vacina.id })), idsOf(aplicacoesSeq), 'por medicamento');
assert.deepEqual(idsOf(await sanity.listApplications({ medicamentoId: iver.id, includeCancelled: true })).length, 3, 'medicamento com canceladas');
assert.deepEqual(await sanity.listApplications({ animalId: sequencia[0].animal_id, from: '2026-09-11' }), [], 'animal + período sem resultado');
assert.deepEqual(idsOf(await sanity.listApplications({ animalId: animalBase.animal_id, includeCancelled: true, medicamentoId: iver.id, from: '2026-09-01', to: '2026-09-30' })), idsOf([avulsa, manejo.aplicacoes_sanidade[1]]), 'filtros combinados');
as('ADMIN', 'Ana Admin');
await sanity.saveMedicamento({ id: vacina.id, nome: 'Vacina bivalente 2026', unidade_padrao: 'dose', via_aplicacao: 'IM', dose_padrao: '2' });
as('OPERADOR', 'Olga Operadora');
const renomeada = (await sanity.listApplications({ animalId: sequencia[0].animal_id }))[0];
assert.equal(renomeada.medicamento_nome, 'Vacina bivalente 2026', 'nome atual por join');
assert.equal(renomeada.medicamento_nome_snapshot, 'Vacina bivalente', 'snapshot preservado');
assert.equal(renomeada.programa_nome, 'Aftosa');
ok('listagem');

// ---------------------------------------------------------------------------
// Integridade: referências órfãs e dados inválidos.
// ---------------------------------------------------------------------------
const limpa = await logicalIntegrity();
assert.deepEqual(limpa.issues, [], `integridade limpa antes das injeções (${limpa.issues.join(' | ')})`);
const ts = new Date().toISOString();
const orfas = [
  { id: 'orf-animal', animal_id: 'animal-x', programa_sanidade_id: aftosa.id, data: '2026-09-01' },
  { id: 'orf-programa', animal_id: animalBase.animal_id, programa_sanidade_id: 'programa-x', data: '2026-09-01' },
  { id: 'orf-medicamento', animal_id: animalBase.animal_id, medicamento_id: 'medicamento-x', data: '2026-09-01' },
  { id: 'orf-dose', animal_id: animalBase.animal_id, programa_sanidade_id: aftosa.id, data: '2026-09-01', dose: 0 },
  { id: 'orf-data', animal_id: animalBase.animal_id, programa_sanidade_id: aftosa.id, data: '2026-13-01' },
  { id: 'orf-sessao', animal_id: animalBase.animal_id, programa_sanidade_id: aftosa.id, data: '2026-09-01', sessao_id: 'sessao-x' },
  { id: 'orf-pesagem', animal_id: animalBase.animal_id, programa_sanidade_id: aftosa.id, data: '2026-09-01', pesagem_id: 'pesagem-x' },
  { id: 'orf-ativa-pesagem-cancelada', animal_id: animalBase.animal_id, programa_sanidade_id: aftosa.id, data: '2026-09-05', pesagem_id: manejo.id },
  { id: 'orf-sem-referencia', animal_id: animalBase.animal_id, data: '2026-09-01' },
].map((row) => ({ empresa_id: 'local', programa_sanidade_id: null, medicamento_id: null, dose: null, sessao_id: null, pesagem_id: null, cancelled_at: null, created_at: ts, updated_at: ts, deleted_at: null, ...row }));
await db.table('aplicacoesSanidade').bulkAdd(orfas);
const sujas = (await logicalIntegrity()).issues;
for (const [id, pattern] of [
  ['orf-animal', /animal_id órfão animal-x/],
  ['orf-programa', /programa_sanidade_id órfão programa-x/],
  ['orf-medicamento', /medicamento_id órfão medicamento-x/],
  ['orf-dose', /dose inválida/],
  ['orf-data', /data inválida/],
  ['orf-sessao', /sessao_id órfão sessao-x/],
  ['orf-pesagem', /pesagem_id órfão pesagem-x/],
  ['orf-ativa-pesagem-cancelada', /aplicação ativa vinculada a pesagem cancelada/],
  ['orf-sem-referencia', /sem programa nem medicamento/],
]) {
  assert.ok(sujas.some((issue) => issue.startsWith(`aplicacoesSanidade ${id}:`) && pattern.test(issue)), `integridade detecta ${id} (${sujas.join(' | ')})`);
}
await db.table('aplicacoesSanidade').bulkDelete((await db.table('aplicacoesSanidade').where('id').anyOf(orfas.map((row) => row.id)).toArray()).map((row) => row.localId));
assert.deepEqual((await logicalIntegrity()).issues, [], 'integridade volta a ficar limpa');
ok('integridade');

// ---------------------------------------------------------------------------
// Bloqueio de migração.
// ---------------------------------------------------------------------------
const antesBloqueio = await counts();
setWriteBlocked({ code: 'MIGRATION_FAILED', message: 'teste' });
try {
  await rejectsCode(() => sanity.registerApplication({ animal_id: animalBase.animal_id, data: '2026-09-12', programa_sanidade_id: aftosa.id }), 'MIGRATION_BLOCKED', 'aplicação avulsa bloqueada');
  await rejectsCode(() => sanity.cancelApplication(sequencia[0].aplicacoes_sanidade[0].id), 'MIGRATION_BLOCKED', 'cancelamento bloqueado');
  await assert.rejects(weighingService.createEntry(cadastro('40', '2026-09-12', { aplicacoes_sanidade: config })), /bloqueada/i, 'lançamento com aplicações bloqueado');
  assert.ok((await sanity.listApplications()).length > 0, 'leitura liberada');
} finally {
  clearWriteBlock();
}
assert.deepEqual(await counts(), antesBloqueio, 'nada gravado sob bloqueio');
ok('bloqueio-migracao');

// ---------------------------------------------------------------------------
// Backup → restore preserva as três stores; limpeza operacional; reset.
// ---------------------------------------------------------------------------
setActorProvider(null);
const snapshotRows = {};
for (const name of SANITY_STORES) snapshotRows[name] = (await db.table(name).toArray()).map(strip);
assert.ok(snapshotRows.aplicacoesSanidade.length >= 8 && snapshotRows.programasSanidade.length === 3 && snapshotRows.medicamentos.length === 2, 'massa de sanidade antes do backup');
const { backup } = await storage.createFullBackup({ reason: 'gate-sanidade' });
for (const name of SANITY_STORES) assert.equal(backup.manifest.counts[name], snapshotRows[name].length, `backup conta ${name}`);

const limpeza = await storage.clearOperationalData({ safetyEvidence });
assert.ok(limpeza.cleared.includes('aplicacoesSanidade'), 'limpeza apaga aplicacoesSanidade');
assert.ok(limpeza.preserved.includes('programasSanidade') && limpeza.preserved.includes('medicamentos'), 'limpeza preserva cadastros de sanidade');
assert.equal(await db.table('aplicacoesSanidade').count(), 0);
assert.equal(await db.table('programasSanidade').count(), 3);
assert.equal(await db.table('medicamentos').count(), 2);
assert.equal(await db.table('pesagens').count(), 0, 'limpeza apaga pesagens');

const dry = await storage.dryRunRestore(backup);
assert.equal(dry.schemaUpgradeRequired, false);
assert.deepEqual(dry.newStores, []);
for (const name of SANITY_STORES) assert.equal(dry.counts[name], snapshotRows[name].length, `dry-run conta ${name}`);
const restored = await storage.applyRestore(backup, { safetyEvidence });
assert.equal(restored.restored, true);
assert.equal(restored.backfill, null, 'backup da versão vigente não roda backfill');
for (const name of SANITY_STORES) {
  assert.deepEqual((await db.table(name).toArray()).map(strip), snapshotRows[name], `restore preserva ${name} integralmente`);
}
as('CONSULTA');
assert.equal((await sanity.listApplications({ animalId: sequencia[0].animal_id }))[0].medicamento_nome, 'Vacina bivalente 2026', 'aplicações legíveis após o restore');
setActorProvider(null);
assert.deepEqual((await logicalIntegrity()).issues, [], 'integridade após restore');
ok('backup-restore-limpeza');

const reset = await storage.resetAllData({ safetyEvidence, confirmedByAdmin: true });
assert.equal(reset.ok, true);
for (const name of SANITY_STORES) assert.equal(await db.table(name).count(), 0, `reset apaga ${name}`);
assert.equal((await readMigrationState(db, 8)).status, MIGRATION_STATUS.CONCLUIDA, 'reset recria o estado da v8');
assert.equal((await readMigrationState(db, 7)).status, MIGRATION_STATUS.CONCLUIDA, 'reset recria o estado da v7 (seeds)');
ok('reset');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'sanity:application:verify',
  ok: true,
  regras: resumo.regras,
  negativeTests: [
    'validação pura (sem referência, sem animal, dose 0/negativa/texto, data futura/formato/inexistente, unidade/via)',
    'animal/programa/sessão inexistentes e programa inativo na avulsa',
    'rollback do lançamento (referência inexistente, dose inválida, programa inativo, lista inválida)',
    'CONSULTA não registra/cancela e sem sessão falha fechada',
    'cancelar id inexistente e cancelar duas vezes',
    'integridade: animal, programa, medicamento, sessão e pesagem órfãos, dose e data inválidas, ativa em pesagem cancelada',
    'bloqueio de migração',
  ],
}, null, 2));
