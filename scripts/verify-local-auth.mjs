// Gate auth:local:verify — contrato docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md (rev. 2),
// ADR-041…046. Cobre: store `usuarios` e campos rev. 2, bootstrap, autenticação, bloqueio
// PERSISTIDO (failed_login_count/locked_until com limite/duração de auth-policy e relógio
// injetável), gestão de usuários (duplicado, último ADMIN, projeções sem segredos, reset com
// senha temporária, troca própria, forçar troca), sessão (memória, inatividade padrão 30,
// ressincronização, lock/switchUser/logout, provedor de ator) e configurações em quatro
// chaves versionadas com migração da chave antiga. Inclui testes negativos e verificação
// textual das telas. Os detalhes de cripto, bootstrap, permissões, recuperação e auditoria
// ficam nos gates auth:crypto / auth:bootstrap / auth:permissions / auth:recovery / audit:actor.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { USERS_STORE, STORES } from '../src/storage/indexedDb/schema.js';
import { getActor as getStorageActor, getCurrentActor as getStorageCurrentActor } from '../src/storage/indexedDb/auditActor.js';
import { PASSWORD_ALGORITHM, PASSWORD_VERSION } from '../src/modules/auth/domain/passwordHasher.js';
import { setPasswordPolicyForTests } from '../src/modules/auth/domain/passwordPolicy.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as authServiceAlias from '../src/modules/auth/application/authService.js';
import * as session from '../src/modules/auth/application/authSession.js';
import * as sessionServiceAlias from '../src/modules/auth/application/sessionService.js';
import { getActor, getCurrentActor } from '../src/modules/auth/application/auditContext.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const summary = {};
setPasswordPolicyForTests({ iterations: 2000 });

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}
const SECRET_FIELDS = ['password_hash', 'password_salt', 'password_iterations', 'password_algorithm', 'password_version', 'recovery_hash', 'recovery_salt', 'recovery_iterations', 'senha', 'localId'];
function assertNoSecrets(obj, label) {
  for (const field of SECRET_FIELDS) assert.equal(obj[field], undefined, `${label} não expõe ${field}`);
}

// ---------------------------------------------------------------------------
// 1. Store e aliases do módulo (doc 11 §2/§3).
// ---------------------------------------------------------------------------
assert.equal(USERS_STORE, 'usuarios');
assert.match(STORES.usuarios, /&login_normalizado/, 'login_normalizado único');
assert.match(STORES.usuarios, /\brole\b/, 'índice role');
assert.ok(!/password|recovery|senha/.test(STORES.usuarios), 'hash/salt nunca indexados');
assert.equal(STORES.usuariosLocais, undefined, 'store da rev. 1 não existe');
for (const name of ['authenticate', 'countActiveUsers', 'bootstrapFirstAdmin', 'findActiveUser', 'createUser', 'updateUser', 'setActive', 'resetPassword', 'forcePasswordChange', 'changeOwnPassword', 'recoverAdminPassword', 'listUsers', 'getLockState', 'registerLogout']) {
  assert.equal(typeof auth[name], 'function', `localAuthService.${name}`);
  assert.equal(authServiceAlias[name], auth[name], `authService.js reexporta ${name}`);
}
for (const name of ['startSession', 'getSession', 'hasSession', 'isLocked', 'getSessionActor', 'touch', 'lock', 'unlock', 'logout', 'switchUser', 'restoreSession', 'subscribe', 'setInactivityMinutes', 'checkInactivity', 'updateSessionUser']) {
  assert.equal(typeof session[name], 'function', `authSession.${name}`);
  assert.equal(sessionServiceAlias[name], session[name], `sessionService.js reexporta ${name}`);
}
summary.storeAndAliases = true;

// ---------------------------------------------------------------------------
// 2. Bootstrap, autenticação e campos rev. 2 persistidos.
// ---------------------------------------------------------------------------
await deleteDbForTests();
session.resetSessionForTests();
let clockMs = Date.parse('2026-09-15T08:00:00.000Z');
auth.setAuthClockForTests(() => clockMs);

assert.equal(await auth.countActiveUsers(), 0, 'banco novo sem usuários');
const { user: admin, recoveryKey } = await auth.bootstrapFirstAdmin({ nome: '  Ana   Souza ', login: ' Ana.Admin ', senha: 'Forte#2026' });
assert.ok(recoveryKey, 'bootstrap devolve a recovery key uma única vez');
assert.equal(admin.role, 'ADMIN');
assert.equal(admin.perfil, 'ADMIN', 'alias somente-leitura `perfil` para módulos da rev. 1');
assert.equal(admin.nome, 'Ana Souza');
assert.equal(admin.login_normalizado, 'ana.admin');
assert.equal(admin.must_change_password, false);
assertNoSecrets(admin, 'bootstrapFirstAdmin');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Outro', login: 'outro', senha: 'Forte#2026' }), 'AUTH_SETUP_DONE', 'segunda configuração inicial recusada');

const db = await ensureStorageReady();
const rowOf = async (id) => db.table(USERS_STORE).where('id').equals(id).first();
const adminRow = await rowOf(admin.id);
for (const field of ['password_hash', 'password_salt', 'password_algorithm', 'password_iterations', 'password_version', 'must_change_password', 'recovery_hash', 'recovery_salt', 'failed_login_count', 'locked_until', 'last_login_at', 'role', 'ativo', 'login_normalizado', 'empresa_id']) {
  assert.ok(field in adminRow, `campo rev. 2 persistido: ${field}`);
}
for (const legacy of ['perfil', 'senha_hash', 'senha_salt', 'deve_trocar_senha', 'ultimo_login_at']) assert.equal(adminRow[legacy], undefined, `campo da rev. 1 não é persistido: ${legacy}`);
assert.equal(adminRow.password_algorithm, PASSWORD_ALGORITHM);
assert.equal(adminRow.password_version, PASSWORD_VERSION);
assert.equal(adminRow.last_login_at, null, 'sem login ainda');

await rejectsWithCode(auth.authenticate('ana.admin', 'errada#2026'), 'AUTH_INVALID', 'senha errada não autentica');
await rejectsWithCode(auth.authenticate('inexistente', 'Forte#2026'), 'AUTH_INVALID', 'usuário inexistente devolve o mesmo erro');
await rejectsWithCode(auth.authenticate('ana.admin', null), 'AUTH_INVALID', 'senha nula não autentica');
const logged = await auth.authenticate(' ANA.ADMIN ', 'Forte#2026');
assert.deepEqual(Object.keys(logged).sort(), ['id', 'login', 'must_change_password', 'nome', 'perfil', 'role'], 'authenticate devolve só a projeção');
assert.equal(logged.id, admin.id);
assert.equal((await rowOf(admin.id)).last_login_at, new Date(clockMs).toISOString(), 'last_login_at gravado com o relógio do serviço');
assert.equal((await rowOf(admin.id)).failed_login_count, 0, 'sucesso zera o contador');
summary.bootstrapAndLogin = true;

// ---------------------------------------------------------------------------
// 3. Bloqueio PERSISTIDO: limite/duração de auth-policy; 5 falhas → 30 s por padrão.
// ---------------------------------------------------------------------------
const actorAdmin = { id: admin.id, nome: admin.nome, role: 'ADMIN' };
const policy = await appConfig.getAuthPolicy();
assert.deepEqual(policy, { versao: 1, inactivity_lock_minutes: 30, failed_attempt_limit: 5, lock_minutes: 0.5 }, 'auth-policy padrão');
for (let i = 1; i <= 4; i += 1) {
  const err = await rejectsWithCode(auth.authenticate('ana.admin', `errada${i}`), 'AUTH_INVALID', `falha ${i}`);
  assert.equal(err.until, undefined, `falha ${i} ainda sem bloqueio`);
  assert.equal((await rowOf(admin.id)).failed_login_count, i, `failed_login_count persistido = ${i}`);
}
const fifthErr = await rejectsWithCode(auth.authenticate('ana.admin', 'errada5'), 'AUTH_INVALID', 'quinta falha');
assert.equal(fifthErr.until, clockMs + 30000, 'quinta falha informa until (lock_minutes 0.5 = 30 s)');
assert.equal((await rowOf(admin.id)).locked_until, new Date(clockMs + 30000).toISOString(), 'locked_until persistido');
const lockedErr = await rejectsWithCode(auth.authenticate('ana.admin', 'Forte#2026'), 'AUTH_LOCKED', 'sexta tentativa bloqueada mesmo com senha correta');
assert.equal(lockedErr.until, clockMs + 30000);
assert.equal(lockedErr.remainingMs, 30000);
assert.deepEqual(await auth.getLockState('Ana.Admin'), { locked: true, until: clockMs + 30000, remainingMs: 30000, failures: 5 }, 'getLockState lê o registro');
clockMs += 29999;
assert.equal((await auth.getLockState('ana.admin')).locked, true, 'ainda bloqueado antes dos 30 s');
clockMs += 1;
assert.equal((await auth.getLockState('ana.admin')).locked, false, 'liberado ao completar 30 s');
assert.equal((await auth.authenticate('ana.admin', 'Forte#2026')).id, admin.id, 'liberado ao avançar o relógio');
assert.equal((await rowOf(admin.id)).locked_until, null, 'sucesso limpa locked_until');
assert.deepEqual(await auth.getLockState('inexistente'), { locked: false, until: null, remainingMs: 0, failures: 0 }, 'login inexistente nunca aparece bloqueado');

// Política alterada (ADMIN): limite 2, 2 minutos — vale na próxima tentativa, sem reiniciar o app.
await appConfig.updateAppConfig(actorAdmin, { failed_attempt_limit: 2, lock_minutes: 2 });
await rejectsWithCode(auth.authenticate('ana.admin', 'errada'), 'AUTH_INVALID', 'falha 1 (limite 2)');
const secondErr = await rejectsWithCode(auth.authenticate('ana.admin', 'errada'), 'AUTH_INVALID', 'falha 2 bloqueia');
assert.equal(secondErr.until, clockMs + 120000, 'duração de 2 minutos (auth-policy)');
clockMs += 120000;
assert.equal((await auth.authenticate('ana.admin', 'Forte#2026')).id, admin.id);
await appConfig.updateAppConfig(actorAdmin, { failed_attempt_limit: 5, lock_minutes: 0.5 });
// Contador expira junto com o bloqueio: após liberar, uma nova falha recomeça em 1.
await rejectsWithCode(auth.authenticate('ana.admin', 'errada'), 'AUTH_INVALID');
assert.equal((await rowOf(admin.id)).failed_login_count, 1, 'contador recomeça após sucesso');
await auth.authenticate('ana.admin', 'Forte#2026');
summary.persistedLockout = true;

// ---------------------------------------------------------------------------
// 4. Gestão de usuários: duplicado, papéis, último ADMIN, projeções, senhas.
// ---------------------------------------------------------------------------
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Dup', login: ' ANA.admin ', senha: 'Outra#2026', role: 'GESTOR' }), 'AUTH_LOGIN_EXISTS', 'login duplicado (normalizado) recusado');
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Fraca', login: 'fraca', senha: '123456', role: 'OPERADOR' }), 'AUTH_WEAK_PASSWORD', 'createUser recusa senha trivial');
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Papel', login: 'papel', senha: 'Outra#2026', role: 'ROOT' }), 'AUTH_INVALID_DATA', 'papel desconhecido recusado');
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Papel', login: 'papel', senha: 'Outra#2026' }), 'AUTH_INVALID_DATA', 'papel ausente recusado');
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno Lima', login: 'bruno', senha: 'Inicial#2026', role: 'GESTOR' });
assert.equal(gestor.must_change_password, true, 'usuário criado deve trocar a senha');
assertNoSecrets(gestor, 'createUser');
const operador = await auth.createUser(actorAdmin, { nome: 'Carla Dias', login: 'carla', senha: 'Inicial#2026', perfil: 'OPERADOR' });
assert.equal(operador.role, 'OPERADOR', 'createUser aceita `perfil` como alias de entrada (rev. 1)');
const consulta = await auth.createUser(actorAdmin, { nome: 'Dora Reis', login: 'dora', senha: 'Inicial#2026', role: 'CONSULTA' });
assert.equal(consulta.role, 'CONSULTA');
assert.equal(await auth.countActiveUsers(), 4);

const listed = await auth.listUsers(actorAdmin);
assert.equal(listed.length, 4);
assert.deepEqual(listed.map((u) => u.nome), ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Dora Reis'], 'ordenado por nome');
for (const user of listed) {
  assertNoSecrets(user, 'listUsers');
  assert.ok(user.id && user.login && user.role, 'listUsers devolve identificação e papel');
  assert.ok('last_login_at' in user && 'must_change_password' in user && 'ativo' in user, 'listUsers devolve os campos da tela');
}
const listedText = JSON.stringify(listed);
assert.ok(!listedText.includes(adminRow.password_hash) && !listedText.includes(adminRow.recovery_hash), 'hash/verificador não aparecem na listagem serializada');
assert.ok(!/password_|recovery_/.test(listedText), 'nenhuma chave password_/recovery_ na listagem');

await rejectsWithCode(auth.setActive(actorAdmin, admin.id, false), 'AUTH_LAST_ADMIN', 'último ADMIN ativo não pode ser inativado');
await rejectsWithCode(auth.updateUser(actorAdmin, admin.id, { role: 'GESTOR' }), 'AUTH_LAST_ADMIN', 'último ADMIN ativo não pode ser rebaixado');
assert.equal((await auth.findActiveUser(admin.id)).role, 'ADMIN', 'ADMIN permanece ativo após as recusas');
const admin2 = await auth.createUser(actorAdmin, { nome: 'Diego Reis', login: 'diego', senha: 'Inicial#2026', role: 'ADMIN' });
const inactivated = await auth.setActive(actorAdmin, admin.id, false);
assert.equal(inactivated.ativo, false, 'com outro ADMIN ativo, o primeiro pode ser inativado');
await rejectsWithCode(auth.authenticate('ana.admin', 'Forte#2026'), 'AUTH_INVALID', 'usuário inativo não autentica');
assert.equal(await auth.findActiveUser(admin.id), null, 'findActiveUser devolve null para inativo');
await rejectsWithCode(auth.setActive(actorAdmin, admin2.id, false), 'AUTH_LAST_ADMIN', 'agora Diego é o último ADMIN');
assert.equal((await auth.setActive(actorAdmin, admin.id, true)).ativo, true, 'reativação');
assert.equal((await rowOf(admin.id)).deleted_at, null, 'inativar nunca apaga fisicamente');
assert.equal(await db.table(USERS_STORE).count(), 5, 'nenhuma linha foi removida');

await rejectsWithCode(auth.updateUser(actorAdmin, gestor.id, { login: 'CARLA' }), 'AUTH_LOGIN_EXISTS', 'updateUser recusa login já usado por outro');
const renamed = await auth.updateUser(actorAdmin, gestor.id, { nome: 'Bruno  Lima Filho', login: 'Bruno.Lima', role: 'OPERADOR', senha: 'ignorada#2026' });
assert.equal(renamed.nome, 'Bruno Lima Filho');
assert.equal(renamed.login_normalizado, 'bruno.lima');
assert.equal(renamed.role, 'OPERADOR');
assert.equal((await auth.authenticate('bruno.lima', 'Inicial#2026')).id, gestor.id, 'updateUser nunca altera a senha');
await rejectsWithCode(auth.updateUser(actorAdmin, 'nao-existe', { nome: 'X' }), 'AUTH_NOT_FOUND', 'id inexistente');
await rejectsWithCode(auth.updateUser(actorAdmin, gestor.id, { nome: '' }), 'AUTH_INVALID_DATA', 'nome vazio recusado');

// Reset: senha definida pelo ADMIN ou temporária gerada (devolvida uma única vez); zera bloqueio.
for (let i = 0; i < 5; i += 1) await auth.authenticate('carla', 'errada').catch(() => {});
assert.equal((await auth.getLockState('carla')).locked, true, 'Carla bloqueada');
const reset = await auth.resetPassword(actorAdmin, operador.id, 'Redefinida#2026');
assert.deepEqual(Object.keys(reset).sort(), ['temporaryPassword', 'user'], 'resetPassword devolve { user, temporaryPassword }');
assert.equal(reset.temporaryPassword, null, 'senha definida pelo ADMIN não gera temporária');
assert.equal(reset.user.must_change_password, true, 'resetPassword exige troca');
assertNoSecrets(reset.user, 'resetPassword');
assert.equal((await auth.getLockState('carla')).locked, false, 'reset zera o bloqueio');
await rejectsWithCode(auth.authenticate('carla', 'Inicial#2026'), 'AUTH_INVALID', 'senha antiga deixa de valer');
assert.equal((await auth.authenticate('carla', 'Redefinida#2026')).must_change_password, true);
await rejectsWithCode(auth.resetPassword(actorAdmin, operador.id, 'carla'), 'AUTH_WEAK_PASSWORD', 'reset recusa senha igual ao login');
const generated = await auth.resetPassword(actorAdmin, operador.id);
assert.match(generated.temporaryPassword, /^[A-HJ-NP-Za-km-z2-9]{8}$/, 'senha temporária legível de 8 caracteres');
assert.equal((await auth.authenticate('carla', generated.temporaryPassword)).must_change_password, true, 'temporária entra e exige troca');
assert.ok(!JSON.stringify(await rowOf(operador.id)).includes(generated.temporaryPassword), 'temporária não é persistida em claro');

await rejectsWithCode(auth.changeOwnPassword(operador.id, 'errada', 'Propria#2026'), 'AUTH_INVALID', 'troca exige a senha atual correta');
await rejectsWithCode(auth.changeOwnPassword(operador.id, generated.temporaryPassword, '123456'), 'AUTH_WEAK_PASSWORD', 'troca recusa senha trivial');
const changed = await auth.changeOwnPassword(operador.id, generated.temporaryPassword, 'Propria#2026');
assert.equal(changed.must_change_password, false, 'troca própria libera a obrigatoriedade');
assert.deepEqual(Object.keys(changed).sort(), ['id', 'login', 'must_change_password', 'nome', 'perfil', 'role']);
assert.equal((await auth.authenticate('carla', 'Propria#2026')).must_change_password, false);
await auth.setActive(actorAdmin, consulta.id, false);
await rejectsWithCode(auth.changeOwnPassword(consulta.id, 'Inicial#2026', 'Propria#2026'), 'AUTH_INVALID', 'inativo não troca a própria senha');

const forced = await auth.forcePasswordChange(actorAdmin, operador.id);
assert.equal(forced.must_change_password, true, 'forçar troca marca a obrigatoriedade sem trocar a senha');
assert.equal((await auth.authenticate('carla', 'Propria#2026')).must_change_password, true, 'senha atual continua válida');
summary.userManagement = true;

// ---------------------------------------------------------------------------
// 5. Sessão (memória; sem sessionStorage no Node), inatividade padrão 30, ator de auditoria.
// ---------------------------------------------------------------------------
const NULL_ACTOR = { usuario_id: null, usuario_nome_snapshot: null };
assert.equal(session.getSession(), null);
assert.equal(session.DEFAULT_INACTIVITY_MINUTES, 30, 'inatividade padrão 30 min (ADR-045)');
assert.deepEqual(getActor(), NULL_ACTOR, 'sem sessão → ator nulo');
assert.deepEqual(getStorageActor(), NULL_ACTOR, 'auditActor sem sessão → nulos');
assert.equal(getCurrentActor(), null);
let sessionClock = Date.parse('2026-09-14T10:00:00.000Z');
session.setSessionClockForTests(() => sessionClock);
const events = [];
const unsubscribe = session.subscribe((snapshot, reason) => events.push(reason));
const started = session.startSession({ id: admin.id, nome: admin.nome, login: admin.login, role: 'ADMIN' });
assert.equal(started.userId, admin.id);
assert.equal(started.role, 'ADMIN');
assert.equal(started.loginAt, '2026-09-14T10:00:00.000Z');
assert.equal(session.hasSession(), true);
assert.deepEqual(getActor(), { usuario_id: admin.id, usuario_nome_snapshot: 'Ana Souza' }, 'ator a partir da sessão');
assert.deepEqual(getStorageActor(), { usuario_id: admin.id, usuario_nome_snapshot: 'Ana Souza' }, 'setActorProvider registrado para o storage');
assert.deepEqual(getCurrentActor(), { id: admin.id, nome: 'Ana Souza', role: 'ADMIN' }, 'getActor da sessão devolve { id, nome, role }');
assert.deepEqual(getStorageCurrentActor(), { id: admin.id, nome: 'Ana Souza', role: 'ADMIN' });
sessionClock += 10000;
assert.equal(session.touch(), false, 'touch com menos de 30 s é ignorado (throttle)');
sessionClock += 25000;
assert.equal(session.touch(), true, 'touch após 30 s atualiza');
assert.equal(session.getSession().lastActivityAt, new Date(sessionClock).toISOString());
assert.equal(session.getInactivityMinutes(), 30);
sessionClock += 29 * 60000;
assert.equal(session.checkInactivity(), false, '29 min não bloqueia');
sessionClock += 60000;
assert.equal(session.checkInactivity(), true, '30 min bloqueia (padrão)');
assert.equal(session.isLocked(), true);
assert.equal(session.touch({ force: true }), false, 'bloqueado não registra atividade');
assert.deepEqual(getActor(), { usuario_id: admin.id, usuario_nome_snapshot: 'Ana Souza' }, 'sessão bloqueada continua identificando o usuário');
session.unlock();
assert.equal(session.isLocked(), false);
assert.equal(session.setInactivityMinutes(0), 0);
sessionClock += 24 * 3600000;
assert.equal(session.checkInactivity(), false, 'inatividade 0 desliga o bloqueio');
assert.equal(session.setInactivityMinutes(-5), 30, 'valor inválido volta ao padrão');
assert.equal(session.setInactivityMinutes('abc'), 30);
session.setInactivityMinutes(15);
session.updateSessionUser({ nome: 'Ana S. Lima', role: 'GESTOR' });
assert.deepEqual(getCurrentActor(), { id: admin.id, nome: 'Ana S. Lima', role: 'GESTOR' }, 'ressincronização com o banco reflete no ator');
session.lock();
assert.equal(session.isLocked(), true, 'bloqueio manual');
session.switchUser();
assert.equal(session.getSession(), null, 'trocar usuário encerra a sessão');
session.startSession({ id: admin.id, nome: admin.nome, perfil: 'ADMIN' });
assert.equal(session.getSession().role, 'ADMIN', 'startSession aceita `perfil` (rev. 1)');
session.logout();
assert.equal(session.getSession(), null, 'logout limpa a sessão');
assert.deepEqual(getActor(), NULL_ACTOR);
assert.deepEqual(events, ['login', 'lock', 'unlock', 'update', 'lock', 'switch-user', 'login', 'logout'], 'assinantes recebem o motivo de cada mudança');
unsubscribe();
assert.throws(() => session.startSession({}), /id do usuário/, 'sessão sem id é recusada');
assert.equal(session.restoreSession(), null, 'sem sessionStorage (Node) não há o que restaurar');
session.resetSessionForTests();
summary.session = true;

// ---------------------------------------------------------------------------
// 6. Configurações em quatro chaves versionadas + migração da chave antiga (rev. 1).
// ---------------------------------------------------------------------------
await deleteDbForTests();
const db2 = await ensureStorageReady();
const defaults = await appConfig.getAppConfig('local');
assert.deepEqual(defaults, {
  versao: 1,
  inactivity_lock_minutes: 30,
  failed_attempt_limit: 5,
  lock_minutes: 0.5,
  marca_padrao_id: null,
  raca_padrao_id: null,
  propriedade_padrao_id: null,
  apartacao_padrao_id: null,
  intervalo_pesagem_dias: 30,
  rendimento_padrao: 50,
  rendimento_padrao_origem: 'PADRAO_EMPRESA',
  exigir_documento_venda: false,
  faixa_peso_min: 20,
  faixa_peso_max: 1500,
  limite_gmd_alerta: 5,
  variacao_max_percent: 35,
}, 'visão mesclada com os defaults dos quatro grupos');
assert.equal(defaults.bloqueio_inatividade_minutos, undefined, 'campo da rev. 1 não existe mais');
assert.deepEqual(await appConfig.getOperationalDefaults(), { versao: 1, marca_padrao_id: null, raca_padrao_id: null, propriedade_padrao_id: null, apartacao_padrao_id: null, intervalo_pesagem_dias: 30, rendimento_padrao: 50, rendimento_padrao_origem: 'PADRAO_EMPRESA' });
assert.deepEqual(await appConfig.getSalesPolicy(), { versao: 1, exigir_documento_venda: false });
assert.deepEqual(await appConfig.getWeightWarningPolicy(), { versao: 1, faixa_peso_min: 20, faixa_peso_max: 1500, limite_gmd_alerta: 5, variacao_max_percent: 35 });
assert.deepEqual(await appConfig.getAuthPolicy(), { versao: 1, inactivity_lock_minutes: 30, failed_attempt_limit: 5, lock_minutes: 0.5 });
assert.equal(await appConfig.getInactivityMinutes(), 30);
assert.equal(await db2.table('appSettings').count(), 0, 'defaults não gravam nada');

const actorGestor = { id: 'g1', nome: 'Gestor', role: 'GESTOR' };
await rejectsWithCode(appConfig.updateAppConfig({ id: 'o1', role: 'OPERADOR' }, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'OPERADOR não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig({ id: 'c1', role: 'CONSULTA' }, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'CONSULTA não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(null, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'sem ator não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(actorGestor, { inactivity_lock_minutes: 10 }), 'AUTH_FORBIDDEN', 'GESTOR não altera auth-policy');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { faixa_peso_min: 2000 }), 'CONFIG_INVALID', 'faixa mínima acima da máxima recusada');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { rendimento_padrao_origem: 'CHUTE' }), 'CONFIG_INVALID', 'origem de rendimento inválida');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { rendimento_padrao: 120 }), 'CONFIG_INVALID', 'rendimento acima de 100');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { inactivity_lock_minutes: -1 }), 'CONFIG_INVALID', 'inatividade negativa');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { failed_attempt_limit: 0 }), 'CONFIG_INVALID', 'limite de tentativas zero');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { lock_minutes: 0 }), 'CONFIG_INVALID', 'duração de bloqueio zero');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { variacao_max_percent: -5 }), 'CONFIG_INVALID', 'variação negativa');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { exigir_documento_venda: 'sim' }), 'CONFIG_INVALID', 'booleano exigido');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { chave_desconhecida: 1 }), 'CONFIG_INVALID', 'chave desconhecida recusada');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { bloqueio_inatividade_minutos: 10 }), 'CONFIG_INVALID', 'chave da rev. 1 recusada no patch');
assert.deepEqual(await appConfig.getAppConfig('local'), defaults, 'patches recusados não alteram nada');

const updated = await appConfig.updateAppConfig(actorAdmin, { intervalo_pesagem_dias: 15, inactivity_lock_minutes: 0, exigir_documento_venda: true, rendimento_padrao: 52.5, rendimento_padrao_origem: 'INFORMADO', variacao_max_percent: 40 });
assert.equal(updated.versao, 1);
assert.equal(updated.intervalo_pesagem_dias, 15);
assert.equal(updated.inactivity_lock_minutes, 0);
assert.equal(updated.exigir_documento_venda, true);
assert.equal(updated.rendimento_padrao, 52.5);
assert.equal(updated.rendimento_padrao_origem, 'INFORMADO');
assert.equal(updated.variacao_max_percent, 40);
const storedKeys = (await db2.table('appSettings').toArray()).map((row) => row.key).sort();
assert.deepEqual(storedKeys, ['auth-policy:local', 'operational-defaults:local', 'sales-policy:local', 'weight-warning-policy:local'], 'quatro chaves versionadas gravadas');
assert.deepEqual((await db2.table('appSettings').get('auth-policy:local')).value, { versao: 1, inactivity_lock_minutes: 0, failed_attempt_limit: 5, lock_minutes: 0.5 });
assert.deepEqual((await db2.table('appSettings').get('sales-policy:local')).value, { versao: 1, exigir_documento_venda: true });
assert.equal((await db2.table('appSettings').get('operational-defaults:local')).value.intervalo_pesagem_dias, 15);
assert.equal((await db2.table('appSettings').get('weight-warning-policy:local')).value.variacao_max_percent, 40);
assert.equal(await appConfig.getInactivityMinutes('local'), 0);
assert.equal((await appConfig.getAppConfig('local')).faixa_peso_max, 1500, 'campos não informados mantêm o padrão');
const gestorSaved = await appConfig.updateAppConfig(actorGestor, { faixa_peso_min: 25 });
assert.equal(gestorSaved.faixa_peso_min, 25, 'GESTOR altera weight-warning-policy');
const configAudit = await db2.table('auditoria').where('entidade').equals('appSettings').toArray();
assert.equal(configAudit.length, 5, 'uma linha de auditoria por grupo alterado (4 do ADMIN + 1 do GESTOR)');
assert.ok(configAudit.every((row) => row.acao === 'ATUALIZAR'));
assert.equal(configAudit.find((row) => row.entidade_id === 'auth-policy:local').usuario_id, admin.id);
assert.equal(configAudit.find((row) => row.entidade_id === 'weight-warning-policy:local' && row.campos_alterados.includes('faixa_peso_min')).usuario_id, 'g1');
assert.equal(await appConfig.updateAppConfig(actorAdmin, { intervalo_pesagem_dias: 15 }).then(() => db2.table('auditoria').where('entidade').equals('appSettings').count()), 5, 'patch sem mudança não audita');

// Migração da chave antiga 'config:<empresa>' (rev. 1): uma vez, sem sobrescrever grupos novos, e removida.
await deleteDbForTests();
const db3 = await ensureStorageReady();
await db3.table('appSettings').put({ key: 'config:local', value: { versao: 1, intervalo_pesagem_dias: 45, faixa_peso_min: 30, exigir_documento_venda: true, bloqueio_inatividade_minutos: 45, rendimento_padrao: 55, rendimento_padrao_origem: 'PADRAO_EMPRESA' } });
await db3.table('appSettings').put({ key: 'sales-policy:local', value: { versao: 1, exigir_documento_venda: false } });
const migrated = await appConfig.getAppConfig('local');
assert.equal(migrated.intervalo_pesagem_dias, 45, 'operational migrado');
assert.equal(migrated.faixa_peso_min, 30, 'weight-warning migrado');
assert.equal(migrated.inactivity_lock_minutes, 45, 'bloqueio_inatividade_minutos → inactivity_lock_minutes');
assert.equal(migrated.exigir_documento_venda, false, 'grupo já gravado na rev. 2 prevalece sobre o legado');
assert.equal(migrated.failed_attempt_limit, 5, 'campos novos recebem o padrão');
assert.equal(await db3.table('appSettings').get('config:local'), undefined, 'chave antiga removida');
assert.deepEqual((await db3.table('appSettings').get('auth-policy:local')).value, { versao: 1, inactivity_lock_minutes: 45 });
assert.equal((await db3.table('appSettings').get('operational-defaults:local')).value.intervalo_pesagem_dias, 45);
assert.deepEqual(await appConfig.getAppConfig('local'), migrated, 'segunda leitura estável (migração única)');
summary.appConfig = true;

// ---------------------------------------------------------------------------
// 7. Verificação textual: componentes rev. 2 existem; nenhum log de senha; hash fora da UI;
//    bloqueio e troca voluntária como camada; menu com os quatro itens.
// ---------------------------------------------------------------------------
for (const file of [
  'src/components/auth/AuthGate.jsx',
  'src/components/auth/FirstRunAdminSetupScreen.jsx',
  'src/components/auth/RecoveryKeyReveal.jsx',
  'src/components/auth/RecuperarSenhaScreen.jsx',
  'src/components/auth/LoginScreen.jsx',
  'src/components/auth/LockScreen.jsx',
  'src/components/auth/TrocarSenhaScreen.jsx',
  'src/components/auth/RequirePermission.jsx',
  'src/components/auth/UserMenu.jsx',
  'src/components/auth/useAuth.js',
  'src/pages/Usuarios.jsx',
  'src/modules/auth/domain/passwordHasher.js',
  'src/modules/auth/domain/passwordPolicy.js',
  'src/modules/auth/domain/recoveryKey.js',
  'src/modules/auth/domain/permissionService.js',
  'src/modules/auth/domain/accessPolicy.js',
  'src/modules/auth/domain/authErrors.js',
  'src/modules/auth/application/localAuthService.js',
  'src/modules/auth/application/authService.js',
  'src/modules/auth/application/authSession.js',
  'src/modules/auth/application/sessionService.js',
  'src/modules/auth/application/auditContext.js',
  'src/modules/auth/application/authAudit.js',
  'src/modules/settings/application/appConfigService.js',
]) {
  assert.ok(existsSync(join(root, file)), `arquivo do contrato existe: ${file}`);
}
for (const gone of ['src/modules/auth/domain/loginLockout.js', 'src/components/auth/ConfiguracaoInicialScreen.jsx']) {
  assert.ok(!existsSync(join(root, gone)), `arquivo da rev. 1 removido: ${gone}`);
}

function listFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? listFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  ));
}
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const authSources = [...listFiles('src/modules/auth'), ...listFiles('src/components/auth'), 'src/pages/Usuarios.jsx', 'src/pages/Configuracoes.jsx', 'src/modules/settings/application/appConfigService.js'];
for (const file of authSources) {
  const source = read(file);
  assert.ok(!/console\.(log|info|warn|error|debug)\s*\([^)]*(senha|password|hash|salt|recovery)/i.test(source), `${file}: nenhum console.* com senha/hash/key`);
  assert.ok(!/console\.(log|info|debug)\s*\(/.test(source), `${file}: sem console.log/info/debug no módulo de autenticação`);
  assert.ok(!/localStorage\.setItem\([^)]*(senha|password|token|recovery)/i.test(source), `${file}: nada sigiloso em localStorage`);
}
for (const file of [...listFiles('src/components/auth'), 'src/pages/Usuarios.jsx']) {
  const source = read(file);
  assert.ok(!/password_hash|password_salt|recovery_hash|recovery_salt|senha_hash/.test(source), `${file}: UI nunca referencia hash/salt`);
}
for (const file of listFiles('src/modules/auth')) {
  assert.ok(!/from '@\//.test(read(file)), `${file}: só imports relativos em src/modules`);
}
const gateSource = read('src/components/auth/AuthGate.jsx');
assert.match(gateSource, /countActiveUsers/, 'AuthGate decide pela contagem de usuários');
assert.match(gateSource, /FirstRunAdminSetupScreen[\s\S]*LoginScreen[\s\S]*RecuperarSenhaScreen/, 'AuthGate encadeia as telas de entrada');
assert.match(gateSource, /AuthContext\.Provider/, 'AuthGate expõe o contexto');
assert.match(gateSource, /getAuthPolicy/, 'inatividade lida de auth-policy');
assert.match(gateSource, /findActiveUser\(restored\.userId\)/, 'sessão restaurada é ressincronizada com o banco');
assert.match(gateSource, /authSession\.updateSessionUser\(found\)/, 'ressincronização atualiza a sessão');
assert.match(gateSource, /className=\{`auth-app\$\{overlay \? ' auth-app--under-overlay' : ''\}`\} inert=\{inert\}/, 'app continua montado e inerte sob a camada');
assert.match(gateSource, /overlay === 'locked' \?[\s\S]*<LockScreen/, 'LockScreen renderizada como camada');
assert.match(gateSource, /overlay === 'change-password' \?[\s\S]*<TrocarSenhaScreen/, 'troca voluntária renderizada como camada');
assert.match(gateSource, /registerLogout\(current, \{ motivo \}\)/, 'Sair/Trocar usuário registram LOGOUT');
const menu = read('src/components/auth/UserMenu.jsx');
for (const label of ['>Bloquear<', '>Trocar senha<', '>Trocar usuário<', '>Sair<']) assert.ok(menu.includes(label), `UserMenu contém ${label}`);
assert.ok(!menu.includes('Alterar minha senha'), 'rótulo da rev. 1 removido');
const usersPage = read('src/pages/Usuarios.jsx');
assert.match(usersPage, /RequirePermission permission="users\.manage"/, 'Usuarios exige users.manage');
assert.match(usersPage, /className="mg-action-bar /, 'Usuarios usa a barra de ações mg-action-bar');
for (const label of ['Novo usuário', 'Editar', 'Redefinir senha', 'Forçar troca', 'Inativar', 'Último acesso', 'Papel', 'Senha temporária', 'last_login_at', 'must_change_password']) {
  assert.ok(usersPage.includes(label), `Usuarios contém "${label}"`);
}
assert.ok(!/deve_trocar_senha|ultimo_login_at|\.perfil\b/.test(usersPage), 'Usuarios não usa campos da rev. 1');
summary.textual = true;

auth.setAuthClockForTests(null);
await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-local-auth');
console.log(JSON.stringify(summary, null, 2));
