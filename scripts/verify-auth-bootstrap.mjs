// Gate auth:bootstrap:verify — doc 11 rev. 2 §5/§9/§10, ADR-044.
// Banco vazio → bootstrap; cria o ADMIN; Recovery Key devolvida uma única vez e só o
// verificador (hash + salt) gravado; admin/admin impossível; backup restaurado com usuários
// válidos NÃO faz bootstrap. Inclui testes negativos e verificação textual das telas.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { USERS_STORE } from '../src/storage/indexedDb/schema.js';
import { setPasswordPolicyForTests } from '../src/modules/auth/domain/passwordPolicy.js';
import { isRecoveryKeyFormat, normalizeRecoveryKey, verifyRecoveryKey, RECOVERY_KEY_ALPHABET } from '../src/modules/auth/domain/recoveryKey.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';

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
// 1. Banco vazio abre o bootstrap; dados inválidos e admin/admin são recusados.
// ---------------------------------------------------------------------------
await deleteDbForTests();
assert.equal(USERS_STORE, 'usuarios', 'store de usuários da rev. 2');
assert.equal(await auth.countActiveUsers(), 0, 'banco novo sem usuários → FirstRunAdminSetup');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Admin', login: 'admin', senha: 'admin' }), 'AUTH_WEAK_PASSWORD', 'admin/admin impossível');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Admin', login: 'admin', senha: 'ADMIN ' }), 'AUTH_WEAK_PASSWORD', 'admin/ADMIN impossível');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Admin', login: 'admin', senha: 'Admin' }), 'AUTH_WEAK_PASSWORD', 'senha igual ao login impossível');
for (const weak of ['123', '12345', '123456', 'senha', 'abc']) {
  await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Ana', login: 'ana', senha: weak }), 'AUTH_WEAK_PASSWORD', `senha trivial "${weak}" recusada`);
}
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: '', login: 'ana', senha: 'Forte#2026' }), 'AUTH_INVALID_DATA', 'nome vazio recusado');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Ana', login: '', senha: 'Forte#2026' }), 'AUTH_INVALID_DATA', 'login vazio recusado');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Ana', login: 'ana souza', senha: 'Forte#2026' }), 'AUTH_INVALID_DATA', 'login com espaço recusado');
assert.equal(await auth.countActiveUsers(), 0, 'recusas não criam usuário');
await rejectsWithCode(auth.authenticate('admin', 'admin'), 'AUTH_INVALID', 'sem usuários ninguém entra (sem backdoor)');
summary.emptyDbRejectsInvalid = true;

// ---------------------------------------------------------------------------
// 2. Cria o ADMIN; a Recovery Key só existe na resposta; o banco guarda o verificador.
// ---------------------------------------------------------------------------
const result = await auth.bootstrapFirstAdmin({ nome: '  Ana   Souza ', login: ' Ana.Admin ', senha: 'Forte#2026' });
assert.deepEqual(Object.keys(result).sort(), ['recoveryKey', 'user'], 'bootstrap devolve { user, recoveryKey }');
const { user: admin, recoveryKey } = result;
assert.equal(admin.role, 'ADMIN');
assert.equal(admin.nome, 'Ana Souza', 'nome com espaços únicos');
assert.equal(admin.login, 'Ana.Admin');
assert.equal(admin.login_normalizado, 'ana.admin', 'login normalizado = trim + minúsculas');
assert.equal(admin.must_change_password, false, 'ADMIN inicial não precisa trocar a senha');
assert.equal(admin.ativo, true);
assert.equal(admin.empresa_id, 'local');
assert.equal(admin.failed_login_count, 0);
assert.equal(admin.locked_until, null);
for (const key of Object.keys(admin)) assert.ok(!/^(password_|recovery_)/.test(key) && key !== 'localId', `projeção do bootstrap não expõe ${key}`);

assert.match(recoveryKey, /^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/, 'key legível em 5 grupos de 5');
assert.ok(isRecoveryKeyFormat(recoveryKey));
for (const char of recoveryKey.replace(/-/g, '')) assert.ok(RECOVERY_KEY_ALPHABET.includes(char), `caractere sem ambiguidade: ${char}`);
assert.ok(!/[01OIL]/.test(recoveryKey), 'sem 0/O/1/I/L na key');
assert.equal(normalizeRecoveryKey(recoveryKey.toLowerCase().replace(/-/g, ' ')), recoveryKey.replace(/-/g, ''), 'normalização aceita minúsculas e espaços');

const db = await ensureStorageReady();
const row = await db.table(USERS_STORE).where('login_normalizado').equals('ana.admin').first();
assert.ok(row.recovery_hash && row.recovery_salt, 'recovery_hash/recovery_salt gravados');
assert.equal(row.recovery_key, undefined, 'a key em claro não é persistida');
const rowText = JSON.stringify(row);
assert.ok(!rowText.includes(recoveryKey) && !rowText.includes(recoveryKey.replace(/-/g, '')), 'a key não aparece em nenhum campo da linha');
assert.ok(!rowText.includes('Forte#2026'), 'a senha não aparece na linha');
assert.equal(await verifyRecoveryKey(recoveryKey, row), true, 'verificador confere com a key devolvida');
assert.equal(await verifyRecoveryKey('AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', row), false, 'outra key não confere');
assert.notEqual(row.recovery_salt, row.password_salt, 'salt próprio da recovery key');
assert.equal(await auth.countActiveUsers(), 1);
assert.equal((await auth.authenticate('ana.admin', 'Forte#2026')).role, 'ADMIN', 'ADMIN criado entra com a senha escolhida');

// Segunda chamada e "sem usuários" já não se aplicam: AUTH_SETUP_DONE.
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Outro', login: 'outro', senha: 'Forte#2026' }), 'AUTH_SETUP_DONE', 'segundo bootstrap recusado');
assert.equal(await auth.countActiveUsers(), 1, 'nada criado pela recusa');

// A key só existe na resposta: nem auditoria nem a listagem a contêm.
const audits = await db.table('auditoria').where('entidade').equals('usuarios').toArray();
const bootstrapAudit = audits.find((item) => item.acao === 'ALTERACAO_USUARIO' && item.entidade_id === admin.id);
assert.ok(bootstrapAudit, 'bootstrap registra ALTERACAO_USUARIO');
assert.equal(bootstrapAudit.usuario_id, null, 'configuração inicial sem ator (ninguém logado)');
const auditText = JSON.stringify(audits);
assert.ok(!auditText.includes(recoveryKey.replace(/-/g, '').slice(0, 10)) && !auditText.includes('Forte#2026') && !auditText.includes(row.recovery_hash), 'auditoria sem key, senha ou hash');
const listed = await auth.listUsers({ id: admin.id, role: 'ADMIN' });
assert.ok(!JSON.stringify(listed).includes(row.recovery_hash) && !/recovery_|password_/.test(JSON.stringify(listed)), 'listUsers não expõe verificadores');
summary.bootstrapCreatesAdminWithRecoveryKey = true;

// ---------------------------------------------------------------------------
// 3. Backup restaurado com usuários válidos NÃO faz bootstrap; só inativos → faz.
// ---------------------------------------------------------------------------
const backupRows = (await db.table(USERS_STORE).toArray()).map(({ localId: _localId, ...rest }) => rest);
await deleteDbForTests();
const restoredDb = await ensureStorageReady();
await restoredDb.table(USERS_STORE).bulkAdd(backupRows); // simula "restaurar backup" (linhas válidas, ativas)
assert.equal(await auth.countActiveUsers(), 1, 'usuário restaurado conta como ativo');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Novo', login: 'novo', senha: 'Forte#2026' }), 'AUTH_SETUP_DONE', 'backup com usuários válidos não faz bootstrap');
assert.equal((await auth.authenticate('ana.admin', 'Forte#2026')).id, admin.id, 'usuário restaurado entra com a senha original (hash/salt viajam no backup)');
assert.equal(await verifyRecoveryKey(recoveryKey, await restoredDb.table(USERS_STORE).where('id').equals(admin.id).first()), true, 'recovery key continua válida após o restore');

await deleteDbForTests();
const inactiveDb = await ensureStorageReady();
await inactiveDb.table(USERS_STORE).bulkAdd(backupRows.map((item) => ({ ...item, ativo: false })));
assert.equal(await auth.countActiveUsers(), 0, 'backup só com usuários inativos não tem usuário válido');
await rejectsWithCode(auth.bootstrapFirstAdmin({ nome: 'Novo', login: 'ana.admin', senha: 'Forte#2026' }), 'AUTH_LOGIN_EXISTS', 'login já usado por um inativo continua único');
const second = await auth.bootstrapFirstAdmin({ nome: 'Novo Admin', login: 'novo', senha: 'Forte#2026' });
assert.equal(second.user.role, 'ADMIN', 'sem usuário ativo o bootstrap volta a ser permitido');
assert.notEqual(second.recoveryKey, recoveryKey, 'cada bootstrap gera uma key própria');

await deleteDbForTests();
const deletedDb = await ensureStorageReady();
await deletedDb.table(USERS_STORE).bulkAdd(backupRows.map((item) => ({ ...item, deleted_at: new Date().toISOString() })));
assert.equal(await auth.countActiveUsers(), 0, 'linhas soft-deletadas não contam');
summary.restoreWithUsersSkipsBootstrap = true;

// ---------------------------------------------------------------------------
// 4. Textual: AuthGate decide por countActiveUsers; FirstRunAdminSetupScreen exibe a key
//    uma vez com "Copiar" e confirmação "Guardei a chave".
// ---------------------------------------------------------------------------
function checkSources(s) {
  assert.match(s.gate, /countActiveUsers/, 'AuthGate decide pela contagem de usuários ativos');
  assert.match(s.gate, /total === 0 \? 'setup' : 'login'/, 'zero usuários → setup; senão login');
  assert.match(s.gate, /import FirstRunAdminSetupScreen from '\.\/FirstRunAdminSetupScreen'/, 'AuthGate usa FirstRunAdminSetupScreen');
  assert.match(s.setup, /bootstrapFirstAdmin\(\{ nome, login, senha \}\)/, 'tela chama bootstrapFirstAdmin');
  assert.match(s.setup, /setRecoveryKey\(result\.recoveryKey\)/, 'tela guarda a key devolvida para exibição única');
  assert.match(s.setup, /<RecoveryKeyReveal recoveryKey=\{recoveryKey\}/, 'tela exibe a key pelo painel de exibição única');
  assert.match(s.reveal, /Copiar/, 'botão Copiar');
  assert.match(s.reveal, /Guardei a chave/, 'confirmação "Guardei a chave"');
  assert.match(s.reveal, /disabled=\{!confirmed\}/, 'Continuar só após confirmar');
  assert.match(s.reveal, /uma única vez/, 'texto avisa exibição única');
  assert.ok(!/localStorage|sessionStorage|console\./.test(s.reveal + s.setup), 'key nunca vai para storage/log');
  assert.ok(!existsSync(join(root, 'src/components/auth/ConfiguracaoInicialScreen.jsx')), 'tela da rev. 1 (ConfiguracaoInicialScreen) removida');
}
const sources = {
  gate: read('src/components/auth/AuthGate.jsx'),
  setup: read('src/components/auth/FirstRunAdminSetupScreen.jsx'),
  reveal: read('src/components/auth/RecoveryKeyReveal.jsx'),
};
checkSources(sources);
const mutated = (key, from, to) => { assert.ok(sources[key].includes(from), `mutação aplicável: ${from.slice(0, 40)}`); return { ...sources, [key]: sources[key].replace(from, to) }; };
for (const [name, bad] of [
  ['gate sem countActiveUsers', mutated('gate', "total === 0 ? 'setup' : 'login'", "'login'")],
  ['tela sem Copiar', mutated('reveal', "{copied ? 'Copiada' : 'Copiar'}", "'Ok'")],
  ['tela sem confirmação', mutated('reveal', 'disabled={!confirmed}', 'disabled={false}')],
  ['key em localStorage', mutated('reveal', "import { useEffect, useRef, useState } from 'react';", "import { useEffect, useRef, useState } from 'react';\nlocalStorage.setItem('k', '');")],
]) {
  assert.throws(() => checkSources(bad), `mutação deveria falhar: ${name}`);
}
summary.textual = true;

await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-auth-bootstrap');
console.log(JSON.stringify(summary, null, 2));
