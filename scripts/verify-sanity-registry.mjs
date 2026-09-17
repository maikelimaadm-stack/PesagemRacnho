// Gate sanity:registry:verify (ADR-049) — cadastros de sanidade em stores próprias da v8.
// Prova: contrato de enumerações; CRUD de programas e medicamentos (normalização, nome único
// entre os ATIVOS da empresa, edição com auditoria só quando algo muda, inativar/reativar);
// suggestedDose sem cálculo por peso; cadastro inativo continua válido nas aplicações já
// gravadas (nome atual por join, snapshot preservado, integridade ok) e recusa aplicação nova;
// permissões pela matriz existente (ADMIN/GESTOR gravam; OPERADOR/CONSULTA não; falha fechada
// sem sessão); auditoria com o ator e sem segredos; bloqueio de migração; nada em appSettings.
// Testes negativos em cada bloco.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { clearWriteBlock, setWriteBlocked } from '../src/storage/migrations/migrationState.js';
import * as coordinator from '../src/storage/migrations/migrationCoordinator.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { ACTIONS } from '../src/modules/auth/domain/permissionService.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const resumo = { regras: [] };
const ok = (regra) => resumo.regras.push(regra);
const as = (role, nome = `Usuário ${role}`) => setActorProvider(() => ({ id: `u-${role}`, nome, role }));

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
const opened = await coordinator.openWithMigration({ files: null });
assert.equal(opened.state.status, 'CONCLUIDA', 'banco novo abre com a cadeia v7 → v8 concluída');
const db = await ensureStorageReady();
const count = (store) => db.table(store).count();
const audits = (acao) => db.table('auditoria').where('acao').equals(acao).toArray();

// ---------------------------------------------------------------------------
// Contrato: enumerações e nenhuma ação nova na matriz de permissões.
// ---------------------------------------------------------------------------
assert.deepEqual([...sanity.PROGRAMA_TIPOS], ['VACINACAO', 'VERMIFUGACAO', 'TRATAMENTO', 'PREVENTIVO', 'OUTRO']);
assert.deepEqual({ ...sanity.PROGRAMA_TIPO_LABELS }, { VACINACAO: 'Vacinação', VERMIFUGACAO: 'Vermifugação', TRATAMENTO: 'Tratamento', PREVENTIVO: 'Preventivo', OUTRO: 'Outro' });
assert.deepEqual([...sanity.VIAS_APLICACAO], ['SC', 'IM', 'IV', 'ORAL', 'POUR_ON', 'TOPICA', 'INTRANASAL', 'OUTRA']);
assert.deepEqual({ ...sanity.VIA_LABELS }, { SC: 'Subcutânea (SC)', IM: 'Intramuscular (IM)', IV: 'Intravenosa (IV)', ORAL: 'Oral', POUR_ON: 'Pour-on', TOPICA: 'Tópica', INTRANASAL: 'Intranasal', OUTRA: 'Outra' });
assert.deepEqual([...sanity.UNIDADES_DOSE], ['ml', 'mg', 'g', 'dose', 'comprimido', 'UI']);
assert.ok(!ACTIONS.some((action) => /sanid|sanity|medic/i.test(action)), 'nenhuma ação de sanidade criada na matriz (permissões reutilizadas)');
ok('contrato');

// ---------------------------------------------------------------------------
// Programas: criação, normalização, unicidade entre ativos, edição, inativação.
// ---------------------------------------------------------------------------
const aftosa = await sanity.saveProgram({ nome: '  Vacina   aftosa ', tipo: 'Vacinação', descricao: ' Campanha de maio ', ordem: '2' });
assert.ok(aftosa.id && !('localId' in aftosa), 'programa criado com id de domínio e sem localId exposto');
assert.equal(aftosa.nome, 'Vacina aftosa');
assert.equal(aftosa.nome_normalizado, 'VACINA AFTOSA', 'nome_normalizado pela regra dos cadastros');
assert.equal(aftosa.tipo, 'VACINACAO', 'rótulo "Vacinação" aceito como VACINACAO');
assert.equal(aftosa.descricao, 'Campanha de maio');
assert.equal(aftosa.ordem, 2);
assert.equal(aftosa.ativo, true);
assert.equal(aftosa.empresa_id, 'local');
const verm = await sanity.saveProgram({ nome: 'Vermifugação estratégica', tipo: 'VERMIFUGACAO', ordem: 1 });
const outro = await sanity.saveProgram({ nome: 'Avaliação', tipo: 'outro' });
assert.deepEqual((await sanity.listProgramas()).map((p) => p.id), [verm.id, aftosa.id, outro.id], 'lista ordenada por ordem e nome (sem ordem por último)');
assert.ok((await sanity.listProgramas()).every((p) => !('localId' in p)), 'lista sem localId');

await rejectsCode(() => sanity.saveProgram({ nome: '   ', tipo: 'VACINACAO' }), 'SANITY_INVALID', 'nome obrigatório');
await rejectsCode(() => sanity.saveProgram({ nome: 'X', tipo: 'CIRURGIA' }), 'SANITY_INVALID', 'tipo inválido');
await rejectsCode(() => sanity.saveProgram({ nome: 'X' }), 'SANITY_INVALID', 'tipo ausente');
await rejectsCode(() => sanity.saveProgram({ nome: 'X', tipo: 'OUTRO', ordem: '-1' }), 'SANITY_INVALID', 'ordem negativa');
const invalido = await rejectsCode(() => sanity.saveProgram({ nome: '', tipo: 'NADA' }), 'SANITY_INVALID', 'erros acumulados');
assert.match(invalido.message, /Nome do programa é obrigatório\.[\s\S]*Tipo do programa inválido/, 'mensagens em pt-BR acumuladas');
const dup = await rejectsCode(() => sanity.saveProgram({ nome: 'VACINA  AFTOSA', tipo: 'TRATAMENTO' }), 'SANITY_DUPLICATE', 'nome duplicado (normalizado) entre ativos');
assert.match(dup.message, /Já existe programa de sanidade ativo/);
assert.equal(await count('programasSanidade'), 3, 'recusas não gravam nada');

const auditsAntes = (await audits('EDITAR_PROGRAMA_SANIDADE')).length;
const editado = await sanity.saveProgram({ id: aftosa.id, nome: 'Vacina aftosa', tipo: 'VACINACAO', descricao: 'Campanha de novembro', ordem: 2 });
assert.equal(editado.descricao, 'Campanha de novembro');
assert.equal(editado.created_at, aftosa.created_at, 'edição preserva created_at');
const edicoes = await audits('EDITAR_PROGRAMA_SANIDADE');
assert.equal(edicoes.length, auditsAntes + 1, 'edição audita');
assert.deepEqual(edicoes.at(-1).campos_alterados, ['descricao'], 'auditoria nomeia só o campo alterado');
await sanity.saveProgram({ id: aftosa.id, nome: 'vacina aftosa', tipo: 'VACINACAO', descricao: 'Campanha de novembro', ordem: 2 });
assert.equal((await db.table('programasSanidade').where('id').equals(aftosa.id).first()).nome, 'vacina aftosa', 'grafia do nome pode mudar');
await sanity.saveProgram({ id: aftosa.id, nome: 'vacina aftosa', tipo: 'VACINACAO', descricao: 'Campanha de novembro', ordem: 2 });
assert.equal((await audits('EDITAR_PROGRAMA_SANIDADE')).length, auditsAntes + 2, 'edição sem mudança não gera auditoria');
await rejectsCode(() => sanity.saveProgram({ id: 'nao-existe', nome: 'Y', tipo: 'OUTRO' }), 'SANITY_NOT_FOUND', 'edição de id inexistente');
await rejectsCode(() => sanity.saveProgram({ id: verm.id, nome: 'Vacina Aftosa', tipo: 'OUTRO' }), 'SANITY_DUPLICATE', 'edição para nome de outro ativo');
ok('programas-crud');

// Inativar/reativar: inativo sai da lista padrão; o nome fica livre só entre ativos.
const inativo = await sanity.setProgramActive(outro.id, false);
assert.equal(inativo.ativo, false);
assert.equal((await audits('INATIVAR_PROGRAMA_SANIDADE')).length, 1);
assert.ok(!(await sanity.listProgramas()).some((p) => p.id === outro.id), 'inativo fora da lista padrão');
assert.ok((await sanity.listProgramas({ includeInactive: true })).some((p) => p.id === outro.id), 'includeInactive lista o inativo');
await sanity.setProgramActive(outro.id, false);
assert.equal((await audits('INATIVAR_PROGRAMA_SANIDADE')).length, 1, 'inativar de novo não audita');
const homonimo = await sanity.saveProgram({ nome: 'avaliação', tipo: 'PREVENTIVO' });
assert.ok(homonimo.id, 'nome de programa inativo pode ser reutilizado por um ativo');
await rejectsCode(() => sanity.setProgramActive(outro.id, true), 'SANITY_DUPLICATE', 'reativar conflita com ativo de mesmo nome');
await sanity.setProgramActive(homonimo.id, false);
assert.equal((await sanity.setProgramActive(outro.id, true)).ativo, true, 'reativa quando o conflito deixa de existir');
assert.equal((await audits('REATIVAR_PROGRAMA_SANIDADE')).length, 1);
await rejectsCode(() => sanity.setProgramActive('nao-existe', false), 'SANITY_NOT_FOUND', 'inativar id inexistente');
await rejectsCode(() => sanity.setProgramActive('', false), 'SANITY_INVALID', 'id obrigatório');
ok('programas-ativo');

// ---------------------------------------------------------------------------
// Medicamentos: campos, dose padrão como texto, carência inteira, enums.
// ---------------------------------------------------------------------------
const iver = await sanity.saveMedicamento({
  nome: 'Ivermectina 1%', principio_ativo: ' Ivermectina ', fabricante: 'Lab X', unidade_padrao: 'ML',
  dose_padrao: '1 ml / 50 kg', via_aplicacao: 'Subcutânea (SC)', carencia_dias: '35', observacao: 'Agitar antes de usar',
});
assert.deepEqual(
  { nome: iver.nome, nome_normalizado: iver.nome_normalizado, principio_ativo: iver.principio_ativo, fabricante: iver.fabricante, unidade_padrao: iver.unidade_padrao, dose_padrao: iver.dose_padrao, via_aplicacao: iver.via_aplicacao, carencia_dias: iver.carencia_dias, observacao: iver.observacao, ativo: iver.ativo },
  { nome: 'Ivermectina 1%', nome_normalizado: 'IVERMECTINA 1%', principio_ativo: 'Ivermectina', fabricante: 'Lab X', unidade_padrao: 'ml', dose_padrao: '1 ml / 50 kg', via_aplicacao: 'SC', carencia_dias: 35, observacao: 'Agitar antes de usar', ativo: true },
  'medicamento gravado com campos normalizados',
);
const vacina = await sanity.saveMedicamento({ nome: 'Vacina aftosa bivalente', dose_padrao: 2, unidade_padrao: 'dose', via_aplicacao: 'pour-on', carencia_dias: 0 });
assert.equal(vacina.dose_padrao, '2', 'dose padrão numérica vira texto de referência');
assert.equal(vacina.via_aplicacao, 'POUR_ON');
assert.equal(vacina.carencia_dias, 0, 'carência zero é válida');
const semOpcionais = await sanity.saveMedicamento({ nome: 'Antibiótico' });
assert.equal(semOpcionais.carencia_dias, null);
assert.equal(semOpcionais.unidade_padrao, null);
for (const [input, rotulo] of [
  [{ nome: 'A', carencia_dias: -1 }, 'carência negativa'],
  [{ nome: 'A', carencia_dias: '1.5' }, 'carência fracionária'],
  [{ nome: 'A', carencia_dias: 'trinta' }, 'carência não numérica'],
  [{ nome: 'A', unidade_padrao: 'litro' }, 'unidade fora do enum'],
  [{ nome: 'A', via_aplicacao: 'Retal' }, 'via fora do enum'],
  [{ nome: '' }, 'nome obrigatório'],
]) {
  await rejectsCode(() => sanity.saveMedicamento(input), 'SANITY_INVALID', `medicamento: ${rotulo}`);
}
await rejectsCode(() => sanity.saveMedicamento({ nome: 'ivermectina 1%' }), 'SANITY_DUPLICATE', 'medicamento: nome duplicado entre ativos');
assert.equal(await count('medicamentos'), 3, 'recusas de medicamento não gravam');
assert.deepEqual((await sanity.listMedicamentos()).map((m) => m.nome), ['Antibiótico', 'Ivermectina 1%', 'Vacina aftosa bivalente'], 'medicamentos por nome');
const editMed = await sanity.saveMedicamento({ id: iver.id, nome: 'Ivermectina 1%', principio_ativo: 'Ivermectina', fabricante: 'Lab X', unidade_padrao: 'ml', dose_padrao: '1 ml / 50 kg', via_aplicacao: 'SC', carencia_dias: 40, observacao: 'Agitar antes de usar' });
assert.equal(editMed.carencia_dias, 40);
assert.deepEqual((await audits('EDITAR_MEDICAMENTO')).at(-1).campos_alterados, ['carencia_dias']);
await sanity.setMedicamentoActive(semOpcionais.id, false);
assert.equal((await audits('INATIVAR_MEDICAMENTO')).length, 1);
await sanity.setMedicamentoActive(semOpcionais.id, true);
assert.equal((await audits('REATIVAR_MEDICAMENTO')).length, 1);
assert.equal((await audits('CRIAR_MEDICAMENTO')).length, 3);

// suggestedDose: só número puro vira sugestão numérica; nunca calcula por peso.
assert.equal(sanity.suggestedDose({ dose_padrao: '10' }), 10);
assert.equal(sanity.suggestedDose({ dose_padrao: '10,5' }), 10.5);
assert.equal(sanity.suggestedDose({ dose_padrao: ' 2.5 ' }), 2.5);
assert.equal(sanity.suggestedDose({ dose_padrao: 4 }), 4);
assert.equal(sanity.suggestedDose(iver), null, 'texto de referência "1 ml / 50 kg" não vira número');
for (const vazio of ['', '0', '-3', 'abc', null, undefined]) assert.equal(sanity.suggestedDose({ dose_padrao: vazio }), null, `sem sugestão para ${vazio}`);
assert.equal(sanity.suggestedDose(null), null);
ok('medicamentos');

// ---------------------------------------------------------------------------
// Inativo continua válido historicamente.
// ---------------------------------------------------------------------------
const lancado = await weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: 'Cadastro', numero_animal: '501', marca: 'ALFA', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-09-02', peso: 250,
  aplicacoes_sanidade: [{ programa_sanidade_id: aftosa.id, medicamento_id: vacina.id, dose: 2, unidade: 'dose' }],
});
assert.equal(lancado.aplicacoes_sanidade.length, 1);
await sanity.setProgramActive(aftosa.id, false);
await sanity.setMedicamentoActive(vacina.id, false);
await sanity.saveProgram({ id: aftosa.id, nome: 'Aftosa (campanha)', tipo: 'VACINACAO', descricao: 'Campanha de novembro', ordem: 2 });
const historico = await sanity.listApplications({ animalId: lancado.animal_id });
assert.equal(historico.length, 1, 'aplicação com cadastros inativos continua listada');
assert.equal(historico[0].programa_nome, 'Aftosa (campanha)', 'nome atual do programa por join (mesmo inativo)');
assert.equal(historico[0].programa_nome_snapshot, 'vacina aftosa', 'snapshot do momento da aplicação preservado');
assert.equal(historico[0].medicamento_nome, 'Vacina aftosa bivalente');
const integridade = await logicalIntegrity();
assert.deepEqual(integridade.issues.filter((issue) => /Sanidade|medicamentos/.test(issue)), [], 'referência a cadastro inativo não é problema de integridade');
await rejectsCode(() => sanity.registerApplication({ animal_id: lancado.animal_id, data: '2026-09-03', programa_sanidade_id: aftosa.id }), 'SANITY_INVALID', 'programa inativo recusa aplicação nova');
await rejectsCode(() => sanity.registerApplication({ animal_id: lancado.animal_id, data: '2026-09-03', medicamento_id: vacina.id }), 'SANITY_INVALID', 'medicamento inativo recusa aplicação nova');
ok('inativo-historico');

// ---------------------------------------------------------------------------
// Permissões (matriz existente): ADMIN/GESTOR gravam; OPERADOR/CONSULTA não; falha fechada.
// ---------------------------------------------------------------------------
as('ADMIN', 'Ana Admin');
const pAdmin = await sanity.saveProgram({ nome: 'Carrapaticida', tipo: 'PREVENTIVO' });
const criarAdmin = (await audits('CRIAR_PROGRAMA_SANIDADE')).find((row) => row.entidade_id === pAdmin.id);
assert.equal(criarAdmin.usuario_id, 'u-ADMIN', 'auditoria com o id do ator');
assert.equal(criarAdmin.usuario_nome_snapshot, 'Ana Admin', 'auditoria com o nome do ator no momento');
assert.equal(criarAdmin.entidade, 'programasSanidade');
as('GESTOR', 'Gil Gestor');
const mGestor = await sanity.saveMedicamento({ nome: 'Doramectina', unidade_padrao: 'ml' });
await sanity.setProgramActive(pAdmin.id, false);
const inatGestor = (await audits('INATIVAR_PROGRAMA_SANIDADE')).find((row) => row.entidade_id === pAdmin.id);
assert.equal(inatGestor.usuario_id, 'u-GESTOR');
assert.equal((await audits('CRIAR_MEDICAMENTO')).find((row) => row.entidade_id === mGestor.id).usuario_nome_snapshot, 'Gil Gestor');

const totalAntes = { programas: await count('programasSanidade'), medicamentos: await count('medicamentos'), auditoria: await count('auditoria') };
for (const role of ['OPERADOR', 'CONSULTA']) {
  as(role);
  await rejectsCode(() => sanity.saveProgram({ nome: `Programa ${role}`, tipo: 'OUTRO' }), 'AUTH_FORBIDDEN', `${role} não cria programa`);
  await rejectsCode(() => sanity.saveProgram({ id: verm.id, nome: 'Alterado', tipo: 'OUTRO' }), 'AUTH_FORBIDDEN', `${role} não edita programa`);
  await rejectsCode(() => sanity.setProgramActive(verm.id, false), 'AUTH_FORBIDDEN', `${role} não inativa programa`);
  await rejectsCode(() => sanity.saveMedicamento({ nome: `Med ${role}` }), 'AUTH_FORBIDDEN', `${role} não cria medicamento`);
  await rejectsCode(() => sanity.setMedicamentoActive(iver.id, false), 'AUTH_FORBIDDEN', `${role} não inativa medicamento`);
  assert.ok((await sanity.listProgramas()).length > 0, `${role} lê programas (registry.read)`);
  assert.ok((await sanity.listMedicamentos()).length > 0, `${role} lê medicamentos (registry.read)`);
}
setActorProvider(() => null);
await rejectsCode(() => sanity.saveProgram({ nome: 'Sem sessão', tipo: 'OUTRO' }), 'AUTH_FORBIDDEN', 'app sem sessão: gravação recusada (falha fechada)');
await rejectsCode(() => sanity.listProgramas(), 'AUTH_FORBIDDEN', 'app sem sessão: leitura recusada (falha fechada)');
assert.deepEqual(
  { programas: await count('programasSanidade'), medicamentos: await count('medicamentos'), auditoria: await count('auditoria') },
  totalAntes,
  'recusas por permissão não gravam cadastro nem auditoria',
);
setActorProvider(null);
ok('permissoes');

// ---------------------------------------------------------------------------
// Auditoria sem segredos; bloqueio de migração; nada em appSettings.
// ---------------------------------------------------------------------------
const auditoriaSanidade = (await db.table('auditoria').toArray()).filter((row) => ['programasSanidade', 'medicamentos'].includes(row.entidade));
assert.ok(auditoriaSanidade.length >= 10, 'cadastros de sanidade auditados');
assert.ok(!/password_|recovery_|senha/i.test(JSON.stringify(auditoriaSanidade)), 'auditoria sem campos sigilosos');
assert.ok(auditoriaSanidade.every((row) => row.id && row.entidade_id && row.acao && row.created_at && 'usuario_id' in row && 'usuario_nome_snapshot' in row), 'formato de auditRow (id, entidade, acao, ator)');

setWriteBlocked({ code: 'MIGRATION_FAILED', message: 'teste' });
try {
  await rejectsCode(() => sanity.saveProgram({ nome: 'Bloqueado', tipo: 'OUTRO' }), 'MIGRATION_BLOCKED', 'gravação de programa bloqueada sob migração');
  await rejectsCode(() => sanity.setMedicamentoActive(iver.id, false), 'MIGRATION_BLOCKED', 'inativação bloqueada sob migração');
  assert.ok((await sanity.listProgramas()).length > 0, 'leitura liberada sob bloqueio');
} finally {
  clearWriteBlock();
}
assert.ok(!(await sanity.listProgramas({ includeInactive: true })).some((p) => p.nome === 'Bloqueado'), 'nada gravado sob bloqueio');

const chaves = (await db.table('appSettings').toArray()).map((row) => String(row.key));
assert.ok(!chaves.some((key) => /sanidade|programasSanidade|medicamentos/i.test(key)), `nenhuma chave de sanidade em appSettings (${chaves.join(', ')})`);
ok('auditoria-bloqueio-appsettings');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'sanity:registry:verify',
  ok: true,
  regras: resumo.regras,
  negativeTests: ['nome vazio/tipo inválido/ordem negativa', 'nome duplicado entre ativos (criar, editar, reativar)', 'id inexistente', 'carência/unidade/via inválidas', 'programa/medicamento inativo em aplicação nova', 'OPERADOR e CONSULTA não gravam', 'sem sessão falha fechada', 'bloqueio de migração'],
}, null, 2));
