// Gate audit:actor:verify — doc 11 rev. 2 §7/§10, docs 12 §3.2, ADR-046.
// setActorProvider registrado pela sessão; gravações via weighingService.createEntry e via
// localAuthService geram auditoria com usuario_id/usuario_nome_snapshot; sem sessão ficam
// nulos; eventos de acesso (LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO)
// resumidos; nenhum campo password_/recovery_ nem segredo na auditoria; gravações de
// last_login_at/auditoria de acesso são best-effort sob MIGRATION_BLOCKED. Testes negativos.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { USERS_STORE } from '../src/storage/indexedDb/schema.js';
import { getActor as getStorageActor, getActorRole, getCurrentActor as getStorageCurrentActor, setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { clearWriteBlock, setWriteBlocked } from '../src/storage/migrations/migrationState.js';
import { setPasswordPolicyForTests } from '../src/modules/auth/domain/passwordPolicy.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as session from '../src/modules/auth/application/authSession.js';
import { getActor, getCurrentActor, actorFields } from '../src/modules/auth/application/auditContext.js';
import { ACCESS_EVENTS, AUDIT_ENTITY, recordAccessEvent, tryRecordAccessEvent, sanitizeChangedFields } from '../src/modules/auth/application/authAudit.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const summary = {};
setPasswordPolicyForTests({ iterations: 2000 });

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}
const NULL_ACTOR = { usuario_id: null, usuario_nome_snapshot: null };
const entry = (id, animal, data, peso) => ({ id, empresa_id: 'local', animal_id: animal, tipo_manejo: 'Cadastro', numero_animal: animal, marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: data, peso, status_animal: 'Ativo' });

// ---------------------------------------------------------------------------
// 1. Sem sessão: ator nulo em auditContext, auditActor (storage) e em uma pesagem gravada.
// ---------------------------------------------------------------------------
await deleteDbForTests();
session.resetSessionForTests();
const db = await ensureStorageReady();
assert.deepEqual(getActor(), NULL_ACTOR, 'auditContext sem sessão → nulos');
assert.deepEqual(getStorageActor(), NULL_ACTOR, 'auditActor sem sessão → nulos');
assert.equal(getCurrentActor(), null);
assert.equal(getStorageCurrentActor(), null);
assert.equal(getActorRole(), null);
assert.deepEqual(actorFields(null), NULL_ACTOR);
assert.deepEqual(actorFields({ id: 'u1', nome: 'X' }), { usuario_id: 'u1', usuario_nome_snapshot: 'X' }, 'ator explícito prevalece');

await weighingService.createEntry(entry('p-sem-sessao', '1', '2026-08-01', 200));
const semSessao = await db.table('auditoria').where('entidade_id').equals('p-sem-sessao').first();
assert.ok(semSessao, 'pesagem sem sessão gera auditoria');
assert.equal(semSessao.usuario_id, null, 'usuario_id nulo sem sessão');
assert.equal(semSessao.usuario_nome_snapshot, null);

const { user: admin } = await auth.bootstrapFirstAdmin({ nome: 'Ana Souza', login: 'ana', senha: 'Forte#2026' });
const bootstrapAudit = await db.table('auditoria').where('entidade').equals(AUDIT_ENTITY).first();
assert.equal(bootstrapAudit.acao, ACCESS_EVENTS.ALTERACAO_USUARIO);
assert.equal(bootstrapAudit.usuario_id, null, 'bootstrap (ninguém logado) sem ator');
summary.noSessionNullActor = true;

// ---------------------------------------------------------------------------
// 2. Com sessão: provedor registrado; pesagem e serviços de usuário carregam o ator.
// ---------------------------------------------------------------------------
const logged = await auth.authenticate('ana', 'Forte#2026');
session.startSession(logged);
assert.deepEqual(session.getSessionActor(), { id: admin.id, nome: 'Ana Souza', role: 'ADMIN' }, 'getSessionActor devolve { id, nome, role }');
assert.deepEqual(getStorageCurrentActor(), { id: admin.id, nome: 'Ana Souza', role: 'ADMIN' }, 'setActorProvider registrado pela sessão');
assert.equal(getActorRole(), 'ADMIN');
assert.deepEqual(getActor(), { usuario_id: admin.id, usuario_nome_snapshot: 'Ana Souza' });
assert.deepEqual(getStorageActor(), { usuario_id: admin.id, usuario_nome_snapshot: 'Ana Souza' });

await weighingService.createEntry(entry('p-com-sessao', '2', '2026-08-01', 210));
const comSessao = await db.table('auditoria').where('entidade_id').equals('p-com-sessao').first();
assert.equal(comSessao.usuario_id, admin.id, 'pesagem gravada com usuario_id da sessão');
assert.equal(comSessao.usuario_nome_snapshot, 'Ana Souza', 'snapshot do nome no momento do fato');

const actorAdmin = getCurrentActor();
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno Lima', login: 'bruno', senha: 'Inicial#2026', role: 'GESTOR' });
const usersAudit = () => db.table('auditoria').where('entidade').equals(AUDIT_ENTITY).toArray();
const created = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.ALTERACAO_USUARIO && row.entidade_id === gestor.id);
assert.ok(created, 'createUser registra ALTERACAO_USUARIO');
assert.equal(created.usuario_id, admin.id, 'ator = ADMIN da sessão');
assert.equal(created.usuario_nome_snapshot, 'Ana Souza');
assert.ok(created.resumo.length > 0 && created.resumo.length <= 200, 'resumo curto');
assert.ok(created.campos_alterados.includes('role'), 'campos_alterados nomeia o que mudou');

// Snapshot do nome: renomear o ADMIN não altera eventos antigos; eventos novos usam o nome novo.
await auth.updateUser(actorAdmin, admin.id, { nome: 'Ana S. Lima' });
session.updateSessionUser({ nome: 'Ana S. Lima' });
await auth.updateUser(getCurrentActor(), gestor.id, { nome: 'Bruno L. Silva' });
const forced = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.ALTERACAO_USUARIO && row.entidade_id === gestor.id && row.resumo.includes('atualizado'));
assert.ok(forced, 'updateUser registra ALTERACAO_USUARIO');
assert.equal(forced.usuario_nome_snapshot, 'Ana S. Lima', 'evento novo usa o nome atual');
assert.equal((await usersAudit()).find((row) => row.id === created.id).usuario_nome_snapshot, 'Ana Souza', 'evento antigo preserva o snapshot');

// LOGIN_SUCESSO / RESET_SENHA / LOGOUT / BLOQUEIO.
const loginEvent = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.LOGIN_SUCESSO && row.entidade_id === admin.id);
assert.ok(loginEvent, 'LOGIN_SUCESSO registrado');
assert.equal(loginEvent.usuario_id, admin.id, 'login registra o próprio usuário como ator');
assert.equal((await db.table(USERS_STORE).where('id').equals(admin.id).first()).last_login_at !== null, true, 'last_login_at gravado');
await auth.resetPassword(getCurrentActor(), gestor.id);
const resetEvent = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.RESET_SENHA && row.entidade_id === gestor.id);
assert.equal(resetEvent.usuario_id, admin.id, 'RESET_SENHA com ator');
await auth.registerLogout({ id: admin.id, nome: 'Ana S. Lima', login: 'ana' }, { motivo: 'SAIR' });
const logoutEvent = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.LOGOUT && row.entidade_id === admin.id);
assert.ok(logoutEvent, 'LOGOUT registrado');
session.logout();
assert.deepEqual(getStorageActor(), NULL_ACTOR, 'após logout o storage volta a ver ator nulo');
for (let i = 0; i < 5; i += 1) await auth.authenticate('bruno', 'errada').catch(() => {});
const lockEvent = (await usersAudit()).find((row) => row.acao === ACCESS_EVENTS.BLOQUEIO && row.entidade_id === gestor.id);
assert.ok(lockEvent, 'BLOQUEIO registrado após atingir o limite');
assert.equal(lockEvent.usuario_id, gestor.id, 'bloqueio atribuído ao próprio login');
assert.ok(lockEvent.detalhes?.tentativas >= 5);

// Alias: ator no formato rev. 1 do provedor ainda é lido pelo storage (compatibilidade).
setActorProvider(() => ({ actor_user_id: 'legacy-1', actor_user_name: 'Legado', actor_user_profile: 'GESTOR' }));
assert.deepEqual(getStorageActor(), { usuario_id: 'legacy-1', usuario_nome_snapshot: 'Legado' }, 'provedor rev. 1 aceito');
assert.equal(getActorRole(), 'GESTOR');
setActorProvider(session.getSessionActor);
summary.sessionActorPropagates = true;

// ---------------------------------------------------------------------------
// 3. Nenhum segredo na auditoria (campos e valores); gravador recusa segredos.
// ---------------------------------------------------------------------------
const allAudits = await db.table('auditoria').toArray();
const adminRow = await db.table(USERS_STORE).where('id').equals(admin.id).first();
const gestorRow = await db.table(USERS_STORE).where('id').equals(gestor.id).first();
const text = JSON.stringify(allAudits);
for (const key of Object.keys(adminRow).filter((k) => /^(password_|recovery_)/.test(k))) assert.ok(!text.includes(`"${key}"`), `auditoria sem o campo ${key}`);
for (const secret of ['Forte#2026', 'Inicial#2026', adminRow.password_hash, adminRow.password_salt, adminRow.recovery_hash, adminRow.recovery_salt, gestorRow.password_hash]) {
  assert.ok(secret && !text.includes(secret), 'auditoria sem senha, hash, salt ou verificador');
}
assert.ok(!/senha_hash|temporaryPassword|recoveryKey/.test(text), 'auditoria sem nomes de campos sigilosos');
const reset = await auth.resetPassword({ id: admin.id, role: 'ADMIN' }, gestor.id);
assert.ok(reset.temporaryPassword && reset.temporaryPassword.length >= 8, 'reset gera senha temporária');
assert.ok(!JSON.stringify(await db.table('auditoria').toArray()).includes(reset.temporaryPassword), 'senha temporária não vai para a auditoria');

await assert.rejects(recordAccessEvent({ acao: ACCESS_EVENTS.RESET_SENHA, usuario: gestor, resumo: 'x', detalhes: { password_hash: 'abc' } }), /não pode conter/, 'detalhes com password_hash recusados');
await assert.rejects(recordAccessEvent({ acao: ACCESS_EVENTS.RESET_SENHA, usuario: gestor, resumo: 'x', detalhes: { nested: { recovery_salt: 'abc' } } }), /não pode conter/, 'segredo aninhado recusado');
await assert.rejects(recordAccessEvent({ acao: 'APAGAR_TUDO', usuario: gestor, resumo: 'x' }), /desconhecido/, 'evento fora do enum recusado');
assert.deepEqual(sanitizeChangedFields(['nome', 'password_hash', 'password_salt', 'senha']), ['nome', 'senha'], 'campos_alterados troca campos sigilosos pelo rótulo "senha"');
const countBefore = await db.table('auditoria').count();
await assert.rejects(tryRecordAccessEvent({ acao: 'APAGAR_TUDO', usuario: gestor, resumo: 'x' }), 'tryRecordAccessEvent só engole MIGRATION_BLOCKED');
assert.equal(await tryRecordAccessEvent({ acao: 'APAGAR_TUDO', usuario: gestor, resumo: 'x' }, { swallowAll: true }), null, 'swallowAll tolera qualquer falha (logout)');
assert.equal(await db.table('auditoria').count(), countBefore, 'eventos recusados não gravam');
summary.noSecretsInAudit = true;

// ---------------------------------------------------------------------------
// 4. Best-effort sob MIGRATION_BLOCKED: login prossegue sem auditoria/last_login_at;
//    gestão de usuários continua bloqueada (não é best-effort).
// ---------------------------------------------------------------------------
const beforeBlock = await db.table(USERS_STORE).where('id').equals(admin.id).first();
setWriteBlocked({ message: 'teste' });
try {
  const user = await auth.authenticate('ana', 'Forte#2026');
  assert.equal(user.id, admin.id, 'login PROSSEGUE sob bloqueio de migração');
  const afterBlock = await db.table(USERS_STORE).where('id').equals(admin.id).first();
  assert.equal(afterBlock.last_login_at, beforeBlock.last_login_at, 'last_login_at não gravado (best-effort)');
  assert.equal(await db.table('auditoria').count(), countBefore, 'evento de login descartado sob bloqueio');
  assert.equal(await tryRecordAccessEvent({ acao: ACCESS_EVENTS.LOGOUT, usuario: admin, resumo: 'x' }), null, 'tryRecordAccessEvent devolve null sob bloqueio');
  await rejectsWithCode(recordAccessEvent({ acao: ACCESS_EVENTS.LOGOUT, usuario: admin, resumo: 'x' }), 'MIGRATION_BLOCKED', 'recordAccessEvent direto propaga o bloqueio');
  await rejectsWithCode(auth.createUser({ id: admin.id, role: 'ADMIN' }, { nome: 'X', login: 'x', senha: 'Forte#2026', role: 'OPERADOR' }), 'MIGRATION_BLOCKED', 'criar usuário continua bloqueado');
  await rejectsWithCode(auth.authenticate('ana', 'errada'), 'AUTH_INVALID', 'senha errada sob bloqueio ainda é AUTH_INVALID (contagem best-effort)');
} finally {
  clearWriteBlock();
}
assert.equal((await auth.authenticate('ana', 'Forte#2026')).id, admin.id, 'após liberar, login volta a auditar');
assert.equal(await db.table('auditoria').count(), countBefore + 1, 'LOGIN_SUCESSO gravado após liberar');
summary.bestEffortUnderMigrationBlock = true;

session.resetSessionForTests();
await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-audit-actor');
console.log(JSON.stringify(summary, null, 2));
