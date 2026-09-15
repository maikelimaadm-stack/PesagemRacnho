// Gate auth:crypto:verify — doc 11 rev. 2 §2/§3/§10, ADR-043.
// Hash/verify PBKDF2-SHA256 via Web Crypto, salt aleatório de 16 bytes, iterações ≥ política,
// comparação em tempo constante, password_version com rehash transparente no login, senha
// errada não autentica e oráculo de tempo aproximado (login inexistente custa um verify).
// Inclui testes negativos (o comportamento incorreto faz o gate falhar).
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { performance } from 'node:perf_hooks';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { USERS_STORE } from '../src/storage/indexedDb/schema.js';
import {
  constantTimeEqual, deriveBits, dummyPasswordRecord, fromBase64, hashPassword, toPasswordFields, verifyPassword,
  HASH_BYTES, PASSWORD_ALGORITHM, PASSWORD_VERSION, PBKDF2_ITERATIONS, SALT_BYTES,
} from '../src/modules/auth/domain/passwordHasher.js';
import { getPasswordIterations, needsRehash, setPasswordPolicyForTests, validatePassword } from '../src/modules/auth/domain/passwordPolicy.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';

const summary = {};

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// ---------------------------------------------------------------------------
// 1. Hash e verificação (iterações reduzidas só nos casos que não testam a política).
// ---------------------------------------------------------------------------
assert.equal(PASSWORD_ALGORITHM, 'PBKDF2-SHA256');
assert.equal(PBKDF2_ITERATIONS, 310000, 'política padrão de 310 000 iterações');
assert.equal(PASSWORD_VERSION, 1, 'password_version atual = 1');
assert.equal(getPasswordIterations(), PBKDF2_ITERATIONS, 'sem override o serviço usa a política');

const fast = { iterations: 2000 };
const record = await hashPassword('Segredo#1', fast);
assert.deepEqual(Object.keys(record).sort(), ['algorithm', 'hash', 'iterations', 'salt', 'version'], 'registro do hasher (doc 11 §3)');
assert.equal(record.algorithm, PASSWORD_ALGORITHM);
assert.equal(record.iterations, 2000);
assert.equal(record.version, PASSWORD_VERSION);
assert.equal(Buffer.from(record.salt, 'base64').length, SALT_BYTES, 'salt de 16 bytes');
assert.equal(Buffer.from(record.hash, 'base64').length, HASH_BYTES, 'hash de 32 bytes');
assert.equal(await verifyPassword('Segredo#1', record), true, 'senha correta verifica');
assert.equal(await verifyPassword('segredo#1', record), false, 'senha errada (caixa) não verifica');
assert.equal(await verifyPassword('Segredo#1 ', record), false, 'espaço a mais não verifica');
assert.equal(await verifyPassword('', record), false, 'senha vazia não verifica');
assert.equal(await verifyPassword(null, record), false, 'senha não-string não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, hash: record.hash.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) }), false, 'hash adulterado não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, salt: (await hashPassword('x', fast)).salt }), false, 'salt trocado não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, iterations: 1999 }), false, 'iterações diferentes não verificam');
assert.equal(await verifyPassword('Segredo#1', { ...record, algorithm: 'MD5' }), false, 'algoritmo diferente não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, hash: '***' }), false, 'base64 inválido não lança: devolve false');
assert.equal(await verifyPassword('Segredo#1', null), false, 'registro nulo não verifica');

const other = await hashPassword('Segredo#1', fast);
assert.notEqual(other.salt, record.salt, 'salt aleatório por hash');
assert.notEqual(other.hash, record.hash, 'hashes distintos com salts distintos');
const same = await hashPassword('Segredo#1', { ...fast, salt: record.salt });
assert.equal(same.hash, record.hash, 'mesmo salt + mesma senha → mesmo hash (determinístico)');

const persisted = toPasswordFields(record);
assert.deepEqual(Object.keys(persisted).sort(), ['password_algorithm', 'password_hash', 'password_iterations', 'password_salt', 'password_version'], 'campos persistidos da store usuarios (doc 11 §2)');
assert.equal(await verifyPassword('Segredo#1', persisted), true, 'aceita a forma persistida password_*');
assert.equal(await verifyPassword('Segredo#1', { senha_hash: record.hash, senha_salt: record.salt, senha_iteracoes: 2000 }), false, 'forma da revisão 1 (senha_*) não é aceita');

await assert.rejects(hashPassword(''), TypeError, 'senha vazia não gera hash');
await assert.rejects(hashPassword(123, fast), TypeError, 'senha não-string não gera hash');
await assert.rejects(hashPassword('x', { iterations: 0 }), TypeError, 'zero iterações recusado');
await assert.rejects(hashPassword('x', { iterations: 1.5 }), TypeError, 'iterações fracionárias recusadas');

const full = await hashPassword('padrão-de-iterações');
assert.equal(full.iterations, PBKDF2_ITERATIONS, 'sem parâmetro grava a política (≥ 310 000)');
assert.ok(full.iterations >= PBKDF2_ITERATIONS, 'iterações persistidas nunca abaixo da política');
summary.hasher = true;

// ---------------------------------------------------------------------------
// 2. Comparação em tempo constante.
// ---------------------------------------------------------------------------
assert.equal(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
assert.equal(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false, 'comprimentos diferentes não são iguais');
assert.equal(constantTimeEqual(new Uint8Array([]), new Uint8Array([])), true, 'vazios são iguais');
assert.equal(constantTimeEqual(new Uint8Array([0]), new Uint8Array([])), false, 'prefixo nulo não engana o comprimento');
// Percorre sempre o maior comprimento: a diferença no primeiro byte não encurta o laço
// (medição grosseira — só garante que não há "early return" na primeira diferença).
const big = new Uint8Array(200000).fill(7);
const diffFirst = new Uint8Array(200000).fill(7); diffFirst[0] = 1;
const diffLast = new Uint8Array(200000).fill(7); diffLast[199999] = 1;
const time = (fn) => { const t = performance.now(); for (let i = 0; i < 20; i += 1) fn(); return performance.now() - t; };
time(() => constantTimeEqual(big, diffFirst)); // aquecimento
const tFirst = time(() => constantTimeEqual(big, diffFirst));
const tLast = time(() => constantTimeEqual(big, diffLast));
assert.ok(tFirst > tLast * 0.2, `diferença no 1º byte não retorna cedo (first=${tFirst.toFixed(1)}ms, last=${tLast.toFixed(1)}ms)`);
summary.constantTime = true;

// ---------------------------------------------------------------------------
// 3. needsRehash por iterações e por versão.
// ---------------------------------------------------------------------------
setPasswordPolicyForTests({ iterations: 2000 });
assert.equal(getPasswordIterations(), 2000, 'override de testes ativo');
assert.equal(needsRehash({ password_algorithm: PASSWORD_ALGORITHM, password_iterations: 2000, password_version: PASSWORD_VERSION }), false, 'na política: sem rehash');
assert.equal(needsRehash({ password_algorithm: PASSWORD_ALGORITHM, password_iterations: 1000, password_version: PASSWORD_VERSION }), true, 'abaixo da política: rehash');
assert.equal(needsRehash({ password_algorithm: PASSWORD_ALGORITHM, password_iterations: 5000, password_version: PASSWORD_VERSION }), false, 'acima da política: sem rehash (nunca reduz o custo)');
assert.equal(needsRehash({ password_algorithm: PASSWORD_ALGORITHM, password_iterations: 2000, password_version: 0 }), true, 'versão anterior: rehash');
assert.equal(needsRehash({ password_algorithm: PASSWORD_ALGORITHM, password_iterations: 2000 }), true, 'sem password_version (rev. 1): rehash');
assert.equal(needsRehash({ password_algorithm: 'ARGON2', password_iterations: 2000, password_version: PASSWORD_VERSION }), true, 'algoritmo diferente: rehash');
assert.equal(needsRehash(null), false);
summary.needsRehash = true;

// ---------------------------------------------------------------------------
// 4. Serviço: password_version gravado, rehash transparente só após login correto.
// ---------------------------------------------------------------------------
await deleteDbForTests();
setPasswordPolicyForTests({ iterations: 1000 });
const { user: admin } = await auth.bootstrapFirstAdmin({ nome: 'Ana Souza', login: 'ana', senha: 'Forte#2026' });
const db = await ensureStorageReady();
const table = db.table(USERS_STORE);
let row = await table.where('id').equals(admin.id).first();
assert.equal(row.password_algorithm, PASSWORD_ALGORITHM);
assert.equal(row.password_iterations, 1000, 'grava as iterações da política vigente');
assert.equal(row.password_version, PASSWORD_VERSION, 'password_version persistido');
assert.ok(row.password_hash && row.password_salt, 'hash e salt persistidos');
assert.equal(row.senha, undefined, 'senha em claro nunca é persistida');
assert.ok(!JSON.stringify(row).includes('Forte#2026'), 'senha em claro não aparece na linha');
for (const field of ['password_hash', 'password_salt', 'password_iterations', 'password_algorithm', 'password_version']) {
  assert.equal(admin[field], undefined, `projeção do bootstrap não devolve ${field}`);
}

// Política sobe para 2000: senha ERRADA não faz rehash; senha certa faz (sem mudar a senha).
setPasswordPolicyForTests({ iterations: 2000 });
const oldHash = row.password_hash;
await rejectsWithCode(auth.authenticate('ana', 'Errada#2026'), 'AUTH_INVALID', 'senha errada não autentica');
row = await table.where('id').equals(admin.id).first();
assert.equal(row.password_iterations, 1000, 'senha errada não dispara rehash');
assert.equal(row.password_hash, oldHash, 'senha errada não altera o hash');
const logged = await auth.authenticate('ana', 'Forte#2026');
assert.equal(logged.id, admin.id);
assert.deepEqual(Object.keys(logged).sort(), ['id', 'login', 'must_change_password', 'nome', 'perfil', 'role'], 'authenticate devolve só a projeção (sem password_*)');
row = await table.where('id').equals(admin.id).first();
assert.equal(row.password_iterations, 2000, 'rehash transparente subiu as iterações');
assert.notEqual(row.password_hash, oldHash, 'rehash gerou novo hash');
assert.equal(row.password_version, PASSWORD_VERSION);
assert.equal((await auth.authenticate('ana', 'Forte#2026')).id, admin.id, 'senha continua a mesma após o rehash');
await rejectsWithCode(auth.authenticate('ana', 'Errada#2026'), 'AUTH_INVALID', 'senha errada continua recusada após o rehash');

// Versão anterior no registro (simulando um hash da rev. 1 atualizado por migração) → rehash por versão.
await table.update(row.localId, { password_version: 0 });
await auth.authenticate('ana', 'Forte#2026');
row = await table.where('id').equals(admin.id).first();
assert.equal(row.password_version, PASSWORD_VERSION, 'versão anterior é recalibrada no login');

// Registro sem algoritmo/hash válido: nunca autentica nem "conserta" sozinho.
await table.update(row.localId, { password_hash: 'AAAA' });
await rejectsWithCode(auth.authenticate('ana', 'Forte#2026'), 'AUTH_INVALID', 'hash corrompido não autentica');
await table.update(row.localId, toPasswordFields(await hashPassword('Forte#2026')));
summary.serviceRehash = true;

// ---------------------------------------------------------------------------
// 5. Oráculo de tempo: login inexistente/inativo custa um verifyPassword fictício.
// ---------------------------------------------------------------------------
const dummy = dummyPasswordRecord(2000);
assert.equal(dummy.salt, dummyPasswordRecord(5000).salt, 'registro fictício é fixo');
assert.equal(await verifyPassword('qualquer', dummy), false, 'nenhuma senha corresponde ao registro fictício');
assert.equal(await verifyPassword('', { ...dummy, hash: Buffer.from(await deriveBits('', fromBase64(dummy.salt), 2000)).toString('base64') }), false, 'senha vazia nunca verifica, mesmo com hash coincidente');

setPasswordPolicyForTests({ iterations: 120000 });
await table.update(row.localId, toPasswordFields(await hashPassword('Forte#2026')));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure(fn, runs = 5) {
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const t = performance.now();
    try { await fn(); } catch { /* AUTH_INVALID esperado */ }
    samples.push(performance.now() - t);
  }
  return median(samples);
}
const tWrong = await measure(() => auth.authenticate('ana', 'Errada#2026'));
const tMissing = await measure(() => auth.authenticate('nao-existe', 'Errada#2026'));
const tEmptyLogin = await measure(() => auth.authenticate('', 'Errada#2026'));
assert.ok(tWrong > 5, `senha errada custa um PBKDF2 real (${tWrong.toFixed(1)}ms)`);
assert.ok(tMissing >= tWrong * 0.5, `login inexistente custa aproximadamente o mesmo (inexistente=${tMissing.toFixed(1)}ms, errada=${tWrong.toFixed(1)}ms)`);
assert.ok(tEmptyLogin >= tWrong * 0.5, `login vazio também paga o verify fictício (${tEmptyLogin.toFixed(1)}ms)`);
setPasswordPolicyForTests({ iterations: 2000 });
summary.timingOracle = { wrongMs: Math.round(tWrong), missingMs: Math.round(tMissing) };

// ---------------------------------------------------------------------------
// 6. Política de senha (mínimo 6, triviais, igual ao login).
// ---------------------------------------------------------------------------
for (const weak of ['', '12345', '123456', 'admin', 'senha', 'Senha', 'qwerty', 'ana', 'ANA']) {
  assert.throws(() => validatePassword(weak, 'ana'), (err) => err.code === 'AUTH_WEAK_PASSWORD', `senha trivial "${weak}" recusada`);
}
assert.equal(validatePassword('Forte#2026', 'ana'), true);
assert.equal(validatePassword('abc123', 'ana'), true, '6 caracteres não triviais são aceitos (sem regras artificiais)');
summary.passwordPolicy = true;

await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-auth-crypto');
console.log(JSON.stringify(summary, null, 2));
