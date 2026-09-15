// Gate auth:recovery:verify — doc 11 rev. 2 §5/§10, ADR-044.
// Key válida redefine a senha do ADMIN e gera uma NOVA key; a antiga é invalidada; key
// inválida é recusada, conta como falha e bloqueia (mesmo bloqueio do login, persistido);
// senha fraca não consome a key; não-ADMIN/inativo não recuperam. Inclui testes negativos
// e verificação textual (link "Esqueci a senha do administrador" e RecuperarSenhaScreen).
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { USERS_STORE } from '../src/storage/indexedDb/schema.js';
import { setPasswordPolicyForTests } from '../src/modules/auth/domain/passwordPolicy.js';
import { generateRecoveryKey, hashRecoveryKey, isRecoveryKeyFormat, normalizeRecoveryKey, verifyRecoveryKey } from '../src/modules/auth/domain/recoveryKey.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const summary = {};
setPasswordPolicyForTests({ iterations: 2000 });

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// ---------------------------------------------------------------------------
// 1. Domínio da key: formato, normalização, hash com salt próprio, verificação.
// ---------------------------------------------------------------------------
const keys = new Set(Array.from({ length: 50 }, () => generateRecoveryKey()));
assert.equal(keys.size, 50, 'keys aleatórias não se repetem');
for (const key of keys) {
  assert.match(key, /^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/, `formato 5×5 legível: ${key}`);
  assert.ok(!/[01OIL]/.test(key), 'sem caracteres ambíguos');
}
const [key] = keys;
assert.equal(normalizeRecoveryKey(` ${key.toLowerCase()} `), key.replace(/-/g, ''), 'normaliza minúsculas/espaços');
assert.equal(normalizeRecoveryKey(key.slice(0, -1)), null, 'key curta é inválida');
assert.equal(normalizeRecoveryKey(`${key.slice(0, -1)}0`), null, 'caractere fora do alfabeto (0) é inválido');
assert.equal(isRecoveryKeyFormat(''), false);
const rec = await hashRecoveryKey(key, { iterations: 2000 });
assert.equal(Buffer.from(rec.salt, 'base64').length, 16, 'salt próprio de 16 bytes');
assert.notEqual((await hashRecoveryKey(key, { iterations: 2000 })).salt, rec.salt, 'salt aleatório por hash');
assert.equal(await verifyRecoveryKey(key, rec), true);
assert.equal(await verifyRecoveryKey(key.toLowerCase(), rec), true, 'verificação tolera a forma digitada');
assert.equal(await verifyRecoveryKey(generateRecoveryKey(), rec), false, 'outra key não verifica');
assert.equal(await verifyRecoveryKey('lixo', rec), false, 'formato inválido não verifica nem lança');
assert.equal(await verifyRecoveryKey(key, null), false);
await assert.rejects(hashRecoveryKey('lixo'), TypeError, 'hash de key inválida é recusado');
summary.domain = true;

// ---------------------------------------------------------------------------
// 2. Fluxo: key válida redefine + gera nova; antiga invalidada; senha fraca não consome.
// ---------------------------------------------------------------------------
await deleteDbForTests();
const db = await ensureStorageReady();
const { user: admin, recoveryKey: key1 } = await auth.bootstrapFirstAdmin({ nome: 'Ana Souza', login: 'ana', senha: 'Forte#2026' });
const actorAdmin = { id: admin.id, nome: admin.nome, role: 'ADMIN' };
const rowOf = async (id) => db.table(USERS_STORE).where('id').equals(id).first();
const before = await rowOf(admin.id);

await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: key1, novaSenha: '123456' }), 'AUTH_WEAK_PASSWORD', 'senha fraca recusada');
await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: key1, novaSenha: 'ana' }), 'AUTH_WEAK_PASSWORD', 'senha igual ao login recusada');
let row = await rowOf(admin.id);
assert.equal(row.recovery_hash, before.recovery_hash, 'senha fraca não consome nem rotaciona a key');
assert.equal(row.failed_login_count, 0, 'senha fraca com key válida não conta como falha');

const recovered = await auth.recoverAdminPassword({ login: ' ANA ', recoveryKey: key1.toLowerCase(), novaSenha: 'Nova#2026' });
assert.deepEqual(Object.keys(recovered).sort(), ['recoveryKey', 'user'], 'devolve { user, recoveryKey }');
const key2 = recovered.recoveryKey;
assert.ok(isRecoveryKeyFormat(key2) && key2 !== key1, 'nova key gerada, diferente da anterior');
assert.deepEqual(Object.keys(recovered.user).sort(), ['id', 'login', 'must_change_password', 'nome', 'perfil', 'role'], 'projeção sem segredos');
assert.equal(recovered.user.must_change_password, false, 'senha escolhida pelo próprio ADMIN não exige troca');
row = await rowOf(admin.id);
assert.notEqual(row.recovery_hash, before.recovery_hash, 'verificador rotacionado');
assert.notEqual(row.recovery_salt, before.recovery_salt, 'salt rotacionado');
assert.notEqual(row.password_hash, before.password_hash, 'senha redefinida');
assert.equal(await verifyRecoveryKey(key1, row), false, 'key antiga invalidada');
assert.equal(await verifyRecoveryKey(key2, row), true, 'nova key confere');
assert.ok(!JSON.stringify(row).includes(key2.replace(/-/g, '')), 'nova key não é persistida em claro');
assert.equal((await auth.authenticate('ana', 'Nova#2026')).id, admin.id, 'entra com a nova senha');
await rejectsWithCode(auth.authenticate('ana', 'Forte#2026'), 'AUTH_INVALID', 'senha antiga deixa de valer');
await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: key1, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'key antiga recusada');
assert.equal((await rowOf(admin.id)).failed_login_count, 2, 'key antiga conta como falha (a senha antiga já contava 1)');
const again = await auth.recoverAdminPassword({ login: 'ana', recoveryKey: key2, novaSenha: 'Terceira#2026' });
assert.notEqual(again.recoveryKey, key2, 'cada recuperação gera outra key');
assert.equal((await rowOf(admin.id)).failed_login_count, 0, 'sucesso zera as falhas');
const key3 = again.recoveryKey;

// Auditoria: RESET_SENHA resumido, sem key/senha/hash.
const audits = await db.table('auditoria').where('entidade').equals('usuarios').toArray();
const resets = audits.filter((item) => item.acao === 'RESET_SENHA' && item.entidade_id === admin.id);
assert.equal(resets.length, 2, 'cada recuperação registra RESET_SENHA');
assert.equal(resets[0].usuario_id, admin.id, 'ator do reset é o próprio ADMIN');
const auditText = JSON.stringify(audits);
for (const secret of [key1, key2, key3, key1.replace(/-/g, ''), key2.replace(/-/g, ''), 'Nova#2026', 'Terceira#2026', row.recovery_hash, row.password_hash]) {
  assert.ok(!auditText.includes(secret), 'auditoria sem key, senha ou hash');
}
assert.ok(!/password_|recovery_/.test(auditText), 'auditoria sem campos password_/recovery_');
summary.validKeyRotates = true;

// ---------------------------------------------------------------------------
// 3. Key inválida conta falha e bloqueia (limite de auth-policy, persistido); inexistente,
//    inativo e não-ADMIN recebem o mesmo erro; bloqueio vale para o login também.
// ---------------------------------------------------------------------------
await appConfig.updateAppConfig(actorAdmin, { failed_attempt_limit: 3, lock_minutes: 1 });
let clockMs = Date.parse('2026-09-15T12:00:00.000Z');
auth.setAuthClockForTests(() => clockMs);
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno', login: 'bruno', senha: 'Inicial#2026', role: 'GESTOR' });
await rejectsWithCode(auth.recoverAdminPassword({ login: 'bruno', recoveryKey: key3, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'não-ADMIN não recupera');
assert.equal((await rowOf(gestor.id)).failed_login_count, 0, 'não elegível não recebe contagem (sem oráculo de papel)');
await rejectsWithCode(auth.recoverAdminPassword({ login: 'nao-existe', recoveryKey: key3, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'login inexistente → mesmo erro');
await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: 'lixo', novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'formato inválido → mesmo erro');
assert.equal((await rowOf(admin.id)).failed_login_count, 1, 'formato inválido conta como falha');
const wrong = generateRecoveryKey();
await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: wrong, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'segunda falha');
const third = await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: wrong, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'terceira falha bloqueia');
assert.equal(third.until, clockMs + 60000, 'terceira falha informa until (lock_minutes = 1)');
row = await rowOf(admin.id);
assert.equal(row.failed_login_count, 3);
assert.equal(row.locked_until, new Date(clockMs + 60000).toISOString(), 'locked_until persistido no registro');
const locked = await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: key3, novaSenha: 'Outra#2026' }), 'AUTH_LOCKED', 'bloqueado mesmo com a key certa');
assert.equal(locked.remainingMs, 60000);
await rejectsWithCode(auth.authenticate('ana', 'Terceira#2026'), 'AUTH_LOCKED', 'bloqueio também vale para o login');
assert.equal((await auth.getLockState('ana')).locked, true);
assert.ok(audits.length < (await db.table('auditoria').where('entidade').equals('usuarios').toArray()).length, 'BLOQUEIO auditado');
assert.ok((await db.table('auditoria').where('entidade').equals('usuarios').toArray()).some((item) => item.acao === 'BLOQUEIO' && item.entidade_id === admin.id), 'evento BLOQUEIO registrado');
clockMs += 60000;
assert.equal((await auth.getLockState('ana')).locked, false, 'liberado ao completar o tempo');
const afterLock = await auth.recoverAdminPassword({ login: 'ana', recoveryKey: key3, novaSenha: 'Quarta#2026' });
assert.ok(afterLock.recoveryKey !== key3, 'após o bloqueio expirar, a key certa recupera e rotaciona');
assert.equal((await auth.authenticate('ana', 'Quarta#2026')).id, admin.id);

// ADMIN inativo (com outro ADMIN ativo) não recupera; ADMIN criado por outro ADMIN (sem recovery_hash) também não.
const admin2 = await auth.createUser(actorAdmin, { nome: 'Diego', login: 'diego', senha: 'Inicial#2026', role: 'ADMIN' });
await rejectsWithCode(auth.recoverAdminPassword({ login: 'diego', recoveryKey: afterLock.recoveryKey, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'ADMIN sem recovery key (criado depois) não recupera');
await auth.setActive(actorAdmin, admin.id, false);
await rejectsWithCode(auth.recoverAdminPassword({ login: 'ana', recoveryKey: afterLock.recoveryKey, novaSenha: 'Outra#2026' }), 'AUTH_RECOVERY_INVALID', 'ADMIN inativo não recupera');
await auth.setActive({ id: admin2.id, role: 'ADMIN' }, admin.id, true);
auth.setAuthClockForTests(null);
summary.invalidKeyCountsAndLocks = true;

// ---------------------------------------------------------------------------
// 4. Textual: link na LoginScreen; RecuperarSenhaScreen usa recoverAdminPassword e exibe a nova key.
// ---------------------------------------------------------------------------
function checkSources(s) {
  assert.match(s.login, /Esqueci a senha do administrador/, 'LoginScreen tem o link de recuperação');
  assert.match(s.login, /onClick=\{onForgotPassword\}/, 'link chama onForgotPassword');
  assert.match(s.gate, /onForgotPassword=\{\(\) => setPhase\('recover'\)\}/, 'AuthGate leva à fase recover');
  assert.match(s.gate, /<RecuperarSenhaScreen onDone=/, 'AuthGate monta RecuperarSenhaScreen');
  assert.match(s.recover, /recoverAdminPassword\(\{ login, recoveryKey, novaSenha \}\)/, 'tela chama recoverAdminPassword');
  assert.match(s.recover, /<RecoveryKeyReveal recoveryKey=\{newKey\}/, 'nova key exibida uma única vez');
  assert.match(s.recover, /if \(err\?\.until\) setLockedUntil\(err\.until\)/, 'bloqueio temporário mostrado com contagem');
  assert.match(s.recover, /Login ou chave de recuperação inválidos/, 'mensagem genérica (não revela se o login existe)');
  assert.ok(!/localStorage|sessionStorage|console\./.test(s.recover), 'key nunca vai para storage/log');
}
const sources = {
  login: read('src/components/auth/LoginScreen.jsx'),
  gate: read('src/components/auth/AuthGate.jsx'),
  recover: read('src/components/auth/RecuperarSenhaScreen.jsx'),
};
checkSources(sources);
const mutated = (k, from, to) => { assert.ok(sources[k].includes(from), `mutação aplicável: ${from.slice(0, 40)}`); return { ...sources, [k]: sources[k].replace(from, to) }; };
for (const [name, bad] of [
  ['login sem link', mutated('login', 'Esqueci a senha do administrador', 'Ajuda')],
  ['tela sem exibir a nova key', mutated('recover', '<RecoveryKeyReveal recoveryKey={newKey}', '<p>')],
  ['tela revelando o motivo', mutated('recover', "'Login ou chave de recuperação inválidos'", "'Chave errada para este login'")],
]) {
  assert.throws(() => checkSources(bad), `mutação deveria falhar: ${name}`);
}
summary.textual = true;

await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-auth-recovery');
console.log(JSON.stringify(summary, null, 2));
