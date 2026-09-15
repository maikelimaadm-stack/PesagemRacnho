// Gate auth:local:verify — contrato docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md §6.
// Cobre hash/verify, lockout com relógio injetável, primeira execução, senhas triviais,
// login duplicado, último ADMIN, listUsers sem hash, troca/redefinição, sessão, ator de
// auditoria e configuração. Inclui testes negativos (o comportamento incorreto falha).
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { getActor as getStorageActor } from '../src/storage/indexedDb/auditActor.js';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, PASSWORD_ALGORITHM, constantTimeEqual } from '../src/modules/auth/domain/passwordHasher.js';
import { createLoginLockout } from '../src/modules/auth/domain/loginLockout.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as session from '../src/modules/auth/application/authSession.js';
import { getActor, getCurrentActor } from '../src/modules/auth/application/auditContext.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const summary = {};

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// ---------------------------------------------------------------------------
// 1. Hash e verificação (iterações reduzidas só aqui, para velocidade).
// ---------------------------------------------------------------------------
const fast = { iteracoes: 2000 };
const record = await hashPassword('Segredo#1', fast);
assert.equal(record.algoritmo, PASSWORD_ALGORITHM);
assert.equal(record.iteracoes, 2000);
assert.equal(Buffer.from(record.salt, 'base64').length, 16, 'salt de 16 bytes');
assert.equal(Buffer.from(record.hash, 'base64').length, 32, 'hash de 32 bytes');
assert.equal(await verifyPassword('Segredo#1', record), true, 'senha correta verifica');
assert.equal(await verifyPassword('segredo#1', record), false, 'senha errada (caixa) não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, hash: record.hash.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) }), false, 'hash adulterado não verifica');
assert.equal(await verifyPassword('Segredo#1', { ...record, algoritmo: 'MD5' }), false, 'algoritmo diferente não verifica');
assert.equal(await verifyPassword('Segredo#1', null), false, 'registro nulo não verifica');
const other = await hashPassword('Segredo#1', fast);
assert.notEqual(other.salt, record.salt, 'salt aleatório por hash');
assert.notEqual(other.hash, record.hash, 'hashes distintos com salts distintos');
assert.equal(await verifyPassword('Segredo#1', { senha_hash: record.hash, senha_salt: record.salt, senha_iteracoes: 2000, senha_algoritmo: PASSWORD_ALGORITHM }), true, 'aceita a forma persistida senha_*');
assert.equal((await hashPassword('x', fast)).iteracoes, 2000);
assert.equal(PBKDF2_ITERATIONS, 310000, 'padrão de 310 000 iterações');
assert.equal((await hashPassword('padrão-de-iterações')).iteracoes, 310000, 'sem parâmetro usa 310 000');
assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false, 'comprimentos diferentes não são iguais');
await assert.rejects(hashPassword(''), TypeError, 'senha vazia não gera hash');
summary.hasher = true;

// ---------------------------------------------------------------------------
// 2. Lockout com relógio injetável: 5 falhas → 30 s; libera ao avançar o relógio.
// ---------------------------------------------------------------------------
let clockMs = 1_000_000;
const lockout = createLoginLockout({ now: () => clockMs });
for (let i = 1; i <= 4; i += 1) assert.equal(lockout.registerFailure('  Maria ').locked, false, `falha ${i} ainda não bloqueia`);
assert.equal(lockout.isLocked('maria').locked, false, 'quatro falhas não bloqueiam');
const fifth = lockout.registerFailure('maria');
assert.equal(fifth.locked, true, 'quinta falha bloqueia');
assert.equal(fifth.until, clockMs + 30000, 'bloqueio de 30 s');
clockMs += 29999;
assert.equal(lockout.isLocked('MARIA').locked, true, 'ainda bloqueado antes dos 30 s (login normalizado)');
clockMs += 1;
assert.equal(lockout.isLocked('maria').locked, false, 'liberado ao completar 30 s');
assert.equal(lockout.registerFailure('maria').failures, 1, 'contador recomeça após liberar');
lockout.clear('maria');
assert.equal(lockout.isLocked('maria').failures, 0, 'clear zera o contador');
summary.lockout = true;

// ---------------------------------------------------------------------------
// 3. Serviço: primeira execução, senhas triviais, autenticação, bloqueio.
// ---------------------------------------------------------------------------
await deleteDbForTests();
session.resetSessionForTests();
clockMs = 2_000_000;
const serviceLockout = createLoginLockout({ now: () => clockMs });
auth.setLoginLockout(serviceLockout);

assert.equal(await auth.countActiveUsers(), 0, 'banco novo sem usuários');
for (const weak of ['123', '12345', '123456', 'admin', 'senha', 'Admin ', 'ana.admin', 'abc']) {
  await rejectsWithCode(auth.createInitialAdmin({ nome: 'Ana', login: 'ana.admin', senha: weak }), 'AUTH_WEAK_PASSWORD', `senha trivial "${weak}" recusada`);
}
assert.equal(await auth.countActiveUsers(), 0, 'senha recusada não cria usuário');
await rejectsWithCode(auth.createInitialAdmin({ nome: '', login: 'ana.admin', senha: 'Forte#2026' }), 'AUTH_INVALID_DATA', 'nome vazio recusado');
await rejectsWithCode(auth.createInitialAdmin({ nome: 'Ana', login: 'ana admin', senha: 'Forte#2026' }), 'AUTH_INVALID_DATA', 'login com espaço recusado');

const admin = await auth.createInitialAdmin({ nome: '  Ana   Souza ', login: ' Ana.Admin ', senha: 'Forte#2026' });
assert.equal(admin.perfil, 'ADMIN');
assert.equal(admin.nome, 'Ana Souza', 'nome com espaços únicos');
assert.equal(admin.login_normalizado, 'ana.admin', 'login normalizado = trim + minúsculas');
assert.equal(admin.deve_trocar_senha, false, 'ADMIN inicial não precisa trocar a senha');
assert.equal(admin.ativo, true);
assert.equal(admin.empresa_id, 'local');
assert.equal(admin.senha_hash, undefined, 'createInitialAdmin não devolve hash');
assert.equal(await auth.countActiveUsers(), 1);
await rejectsWithCode(auth.createInitialAdmin({ nome: 'Outro', login: 'outro', senha: 'Forte#2026' }), 'AUTH_SETUP_DONE', 'segunda configuração inicial recusada');

const db = await ensureStorageReady();
const adminRow = await db.table('usuariosLocais').where('login_normalizado').equals('ana.admin').first();
assert.equal(adminRow.senha_iteracoes, 310000, 'serviço fixa 310 000 iterações');
assert.equal(adminRow.senha_algoritmo, PASSWORD_ALGORITHM);
assert.ok(adminRow.senha_hash && adminRow.senha_salt, 'hash e salt persistidos');
assert.equal(adminRow.senha, undefined, 'senha em claro nunca é persistida');
assert.ok(!JSON.stringify(adminRow).includes('Forte#2026'), 'senha em claro não aparece na linha');

await rejectsWithCode(auth.authenticate('ana.admin', 'errada#2026'), 'AUTH_INVALID', 'senha errada não autentica');
await rejectsWithCode(auth.authenticate('inexistente', 'Forte#2026'), 'AUTH_INVALID', 'usuário inexistente devolve o mesmo erro');
const logged = await auth.authenticate(' ANA.ADMIN ', 'Forte#2026');
assert.deepEqual(Object.keys(logged).sort(), ['deve_trocar_senha', 'id', 'login', 'nome', 'perfil'], 'authenticate devolve só a projeção');
assert.equal(logged.id, admin.id);
const afterLogin = await db.table('usuariosLocais').where('id').equals(admin.id).first();
assert.ok(afterLogin.ultimo_login_at, 'ultimo_login_at gravado');

// 5 falhas → 6ª tentativa AUTH_LOCKED mesmo com a senha certa; libera após 30 s.
serviceLockout.reset();
for (let i = 1; i <= 4; i += 1) {
  const err = await rejectsWithCode(auth.authenticate('ana.admin', `errada${i}`), 'AUTH_INVALID', `falha ${i}`);
  assert.equal(err.until, undefined, `falha ${i} ainda sem bloqueio`);
}
const fifthErr = await rejectsWithCode(auth.authenticate('ana.admin', 'errada5'), 'AUTH_INVALID', 'quinta falha');
assert.ok(fifthErr.until > clockMs, 'quinta falha informa until');
const lockedErr = await rejectsWithCode(auth.authenticate('ana.admin', 'Forte#2026'), 'AUTH_LOCKED', 'sexta tentativa bloqueada mesmo com senha correta');
assert.equal(lockedErr.until, clockMs + 30000);
assert.equal(auth.getLockState('Ana.Admin').locked, true, 'getLockState reflete o bloqueio');
clockMs += 30000;
assert.equal((await auth.authenticate('ana.admin', 'Forte#2026')).id, admin.id, 'liberado ao avançar o relógio');
assert.equal(auth.getLockState('ana.admin').locked, false);
summary.firstRunAndLogin = true;

// ---------------------------------------------------------------------------
// 4. Gestão de usuários: duplicado, último ADMIN, listUsers sem hash, senhas.
// ---------------------------------------------------------------------------
const actorAdmin = { id: admin.id, nome: admin.nome, perfil: 'ADMIN' };
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Dup', login: ' ANA.admin ', senha: 'Outra#2026', perfil: 'GESTOR' }), 'AUTH_LOGIN_EXISTS', 'login duplicado (normalizado) recusado');
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Fraca', login: 'fraca', senha: '123456', perfil: 'OPERADOR' }), 'AUTH_WEAK_PASSWORD', 'createUser recusa senha trivial');
await rejectsWithCode(auth.createUser(actorAdmin, { nome: 'Perfil', login: 'perfil', senha: 'Outra#2026', perfil: 'ROOT' }), 'AUTH_INVALID_DATA', 'perfil desconhecido recusado');
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno Lima', login: 'bruno', senha: 'Inicial#2026', perfil: 'GESTOR' });
assert.equal(gestor.deve_trocar_senha, true, 'usuário criado deve trocar a senha');
assert.equal(gestor.senha_hash, undefined, 'createUser não devolve hash');
const operador = await auth.createUser(actorAdmin, { nome: 'Carla Dias', login: 'carla', senha: 'Inicial#2026', perfil: 'OPERADOR' });
assert.equal(await auth.countActiveUsers(), 3);

const listed = await auth.listUsers(actorAdmin);
assert.equal(listed.length, 3);
for (const user of listed) {
  for (const field of ['senha_hash', 'senha_salt', 'senha_iteracoes', 'senha_algoritmo', 'senha', 'localId']) {
    assert.equal(user[field], undefined, `listUsers não expõe ${field}`);
  }
  assert.ok(user.id && user.login && user.perfil, 'listUsers devolve identificação');
}
assert.ok(!JSON.stringify(listed).includes(adminRow.senha_hash), 'hash não aparece na listagem serializada');

await rejectsWithCode(auth.setActive(actorAdmin, admin.id, false), 'AUTH_LAST_ADMIN', 'último ADMIN ativo não pode ser inativado');
await rejectsWithCode(auth.updateUser(actorAdmin, admin.id, { perfil: 'GESTOR' }), 'AUTH_LAST_ADMIN', 'último ADMIN ativo não pode ser rebaixado');
assert.equal((await auth.findActiveUser(admin.id)).perfil, 'ADMIN', 'ADMIN permanece ativo após as recusas');
const admin2 = await auth.createUser(actorAdmin, { nome: 'Diego Reis', login: 'diego', senha: 'Inicial#2026', perfil: 'ADMIN' });
const inactivated = await auth.setActive(actorAdmin, admin.id, false);
assert.equal(inactivated.ativo, false, 'com outro ADMIN ativo, o primeiro pode ser inativado');
await rejectsWithCode(auth.authenticate('ana.admin', 'Forte#2026'), 'AUTH_INVALID', 'usuário inativo não autentica');
await rejectsWithCode(auth.setActive(actorAdmin, admin2.id, false), 'AUTH_LAST_ADMIN', 'agora Diego é o último ADMIN');
assert.equal((await auth.setActive(actorAdmin, admin.id, true)).ativo, true, 'reativação');
assert.equal((await db.table('usuariosLocais').where('id').equals(admin.id).first()).deleted_at, null, 'inativar nunca apaga fisicamente');
assert.equal(await db.table('usuariosLocais').count(), 4, 'nenhuma linha foi removida');

await rejectsWithCode(auth.updateUser(actorAdmin, gestor.id, { login: 'CARLA' }), 'AUTH_LOGIN_EXISTS', 'updateUser recusa login já usado por outro');
const renamed = await auth.updateUser(actorAdmin, gestor.id, { nome: 'Bruno  Lima Filho', login: 'Bruno.Lima', perfil: 'OPERADOR', senha: 'ignorada#2026' });
assert.equal(renamed.nome, 'Bruno Lima Filho');
assert.equal(renamed.login_normalizado, 'bruno.lima');
assert.equal(renamed.perfil, 'OPERADOR');
assert.equal((await auth.authenticate('bruno.lima', 'Inicial#2026')).id, gestor.id, 'updateUser nunca altera a senha');
await rejectsWithCode(auth.updateUser(actorAdmin, 'nao-existe', { nome: 'X' }), 'AUTH_NOT_FOUND', 'id inexistente');

const reset = await auth.resetPassword(actorAdmin, operador.id, 'Redefinida#2026');
assert.equal(reset.deve_trocar_senha, true, 'resetPassword exige troca');
await rejectsWithCode(auth.authenticate('carla', 'Inicial#2026'), 'AUTH_INVALID', 'senha antiga deixa de valer');
assert.equal((await auth.authenticate('carla', 'Redefinida#2026')).deve_trocar_senha, true);
await rejectsWithCode(auth.resetPassword(actorAdmin, operador.id, 'carla'), 'AUTH_WEAK_PASSWORD', 'reset recusa senha igual ao login');

await rejectsWithCode(auth.changeOwnPassword(operador.id, 'errada', 'Propria#2026'), 'AUTH_INVALID', 'troca exige a senha atual correta');
await rejectsWithCode(auth.changeOwnPassword(operador.id, 'Redefinida#2026', '123456'), 'AUTH_WEAK_PASSWORD', 'troca recusa senha trivial');
const changed = await auth.changeOwnPassword(operador.id, 'Redefinida#2026', 'Propria#2026');
assert.equal(changed.deve_trocar_senha, false, 'troca própria libera a obrigatoriedade');
assert.deepEqual(Object.keys(changed).sort(), ['deve_trocar_senha', 'id', 'login', 'nome', 'perfil']);
assert.equal((await auth.authenticate('carla', 'Propria#2026')).deve_trocar_senha, false);

const forced = await auth.forcePasswordChange(actorAdmin, operador.id);
assert.equal(forced.deve_trocar_senha, true, 'forçar troca marca a obrigatoriedade sem trocar a senha');
assert.equal((await auth.authenticate('carla', 'Propria#2026')).deve_trocar_senha, true, 'senha atual continua válida');
summary.userManagement = true;

// Auditoria por usuário: ator gravado, sem hash/senha.
const audits = await db.table('auditoria').where('entidade').equals('usuariosLocais').toArray();
assert.ok(audits.length >= 8, `auditoria de usuários gravada (${audits.length})`);
const auditCreate = audits.find((row) => row.acao === 'CRIAR' && row.entidade_id === gestor.id);
assert.equal(auditCreate.actor_user_id, admin.id, 'ator da criação é o ADMIN');
assert.equal(auditCreate.actor_user_profile, 'ADMIN');
const auditInitial = audits.find((row) => row.acao === 'CRIAR' && row.entidade_id === admin.id);
assert.equal(auditInitial.actor_user_id, null, 'configuração inicial sem ator (ninguém logado)');
const auditText = JSON.stringify(audits);
for (const secret of ['Forte#2026', 'Inicial#2026', 'Redefinida#2026', 'Propria#2026', adminRow.senha_hash, adminRow.senha_salt]) {
  assert.ok(!auditText.includes(secret), 'auditoria não contém senha, hash ou salt');
}
assert.ok(!/senha_hash|senha_salt/.test(auditText), 'sem chave de hash/salt na auditoria');
summary.auditTrail = true;

// ---------------------------------------------------------------------------
// 5. Sessão (memória; sem sessionStorage no Node), inatividade e ator de auditoria.
// ---------------------------------------------------------------------------
assert.equal(session.getSession(), null);
assert.deepEqual(getActor(), { actor_user_id: null, actor_user_name: null, actor_user_profile: null }, 'sem sessão → ator nulo');
assert.deepEqual(getStorageActor(), { actor_user_id: null, actor_user_name: null, actor_user_profile: null }, 'auditActor sem sessão → nulos');
assert.equal(getCurrentActor(), null);
let sessionClock = Date.parse('2026-09-14T10:00:00.000Z');
session.setSessionClockForTests(() => sessionClock);
const events = [];
const unsubscribe = session.subscribe((snapshot) => events.push(snapshot ? snapshot.locked : null));
const started = session.startSession({ id: admin.id, nome: admin.nome, perfil: 'ADMIN' });
assert.equal(started.userId, admin.id);
assert.equal(started.loginAt, '2026-09-14T10:00:00.000Z');
assert.deepEqual(getActor(), { actor_user_id: admin.id, actor_user_name: 'Ana Souza', actor_user_profile: 'ADMIN' }, 'ator a partir da sessão');
assert.deepEqual(getStorageActor(), { actor_user_id: admin.id, actor_user_name: 'Ana Souza', actor_user_profile: 'ADMIN' }, 'setActorProvider registrado para o storage');
assert.deepEqual(getCurrentActor(), { id: admin.id, nome: 'Ana Souza', perfil: 'ADMIN' });
sessionClock += 10000;
assert.equal(session.touch(), false, 'touch com menos de 30 s é ignorado (throttle)');
sessionClock += 25000;
assert.equal(session.touch(), true, 'touch após 30 s atualiza');
assert.equal(session.getSession().lastActivityAt, new Date(sessionClock).toISOString());
session.setInactivityMinutes(60);
sessionClock += 59 * 60000;
assert.equal(session.checkInactivity(), false, '59 min não bloqueia');
sessionClock += 60000;
assert.equal(session.checkInactivity(), true, '60 min bloqueia');
assert.equal(session.isLocked(), true);
assert.equal(session.touch({ force: true }), false, 'bloqueado não registra atividade');
session.unlock();
assert.equal(session.isLocked(), false);
session.setInactivityMinutes(0);
sessionClock += 24 * 3600000;
assert.equal(session.checkInactivity(), false, 'inatividade 0 desliga o bloqueio');
session.lock();
assert.equal(session.isLocked(), true, 'bloqueio manual');
session.logout();
assert.equal(session.getSession(), null, 'logout limpa a sessão');
assert.deepEqual(getActor(), { actor_user_id: null, actor_user_name: null, actor_user_profile: null });
assert.deepEqual(events, [false, true, false, true, null], 'assinantes recebem login, bloqueio, desbloqueio, bloqueio e saída');
unsubscribe();
assert.throws(() => session.startSession({}), /id do usuário/, 'sessão sem id é recusada');
session.resetSessionForTests();
summary.session = true;

// ---------------------------------------------------------------------------
// 6. Configurações da empresa (appSettings 'config:<empresa>', versao 1).
// ---------------------------------------------------------------------------
const defaults = await appConfig.getAppConfig('local');
assert.deepEqual(defaults, {
  versao: 1,
  marca_padrao_id: null,
  raca_padrao_id: null,
  propriedade_padrao_id: null,
  apartacao_padrao_id: null,
  intervalo_pesagem_dias: 30,
  faixa_peso_min: 20,
  faixa_peso_max: 1500,
  limite_gmd_alerta: 5,
  exigir_documento_venda: false,
  rendimento_padrao: 50,
  rendimento_padrao_origem: 'PADRAO_EMPRESA',
  bloqueio_inatividade_minutos: 60,
}, 'defaults da configuração');
await rejectsWithCode(appConfig.updateAppConfig({ id: operador.id, perfil: 'OPERADOR' }, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'OPERADOR não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig({ id: gestor.id, perfil: 'GESTOR' }, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'GESTOR não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(null, { intervalo_pesagem_dias: 15 }), 'AUTH_FORBIDDEN', 'sem ator não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { faixa_peso_min: 2000 }), 'CONFIG_INVALID', 'faixa mínima acima da máxima recusada');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { rendimento_padrao_origem: 'CHUTE' }), 'CONFIG_INVALID', 'origem de rendimento inválida');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { bloqueio_inatividade_minutos: -1 }), 'CONFIG_INVALID', 'inatividade negativa');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { exigir_documento_venda: 'sim' }), 'CONFIG_INVALID', 'booleano exigido');
await rejectsWithCode(appConfig.updateAppConfig(actorAdmin, { chave_desconhecida: 1 }), 'CONFIG_INVALID', 'chave desconhecida recusada');
assert.deepEqual(await appConfig.getAppConfig('local'), defaults, 'patches recusados não alteram nada');
const updated = await appConfig.updateAppConfig(actorAdmin, { intervalo_pesagem_dias: 15, bloqueio_inatividade_minutos: 0, exigir_documento_venda: true, rendimento_padrao: 52.5, rendimento_padrao_origem: 'INFORMADO' });
assert.equal(updated.versao, 1);
assert.equal(updated.intervalo_pesagem_dias, 15);
assert.equal(updated.bloqueio_inatividade_minutos, 0);
assert.equal(updated.exigir_documento_venda, true);
assert.equal(updated.rendimento_padrao, 52.5);
assert.equal(updated.rendimento_padrao_origem, 'INFORMADO');
const storedConfig = await db.table('appSettings').get('config:local');
assert.equal(storedConfig.value.versao, 1, 'persistido com versao 1');
assert.equal(storedConfig.value.intervalo_pesagem_dias, 15);
assert.equal(await appConfig.getInactivityMinutes('local'), 0);
assert.equal((await appConfig.getAppConfig('local')).faixa_peso_max, 1500, 'campos não informados mantêm o padrão');
const configAudit = await db.table('auditoria').where('entidade').equals('appSettings').toArray();
assert.equal(configAudit.length, 1, 'alteração de configuração auditada');
assert.equal(configAudit[0].actor_user_id, admin.id);
assert.ok(configAudit[0].campos_alterados.includes('intervalo_pesagem_dias'));
summary.appConfig = true;

// ---------------------------------------------------------------------------
// 7. Verificação textual: componentes existem; nenhum log de senha; hash fora da UI.
// ---------------------------------------------------------------------------
for (const file of [
  'src/components/auth/AuthGate.jsx',
  'src/components/auth/ConfiguracaoInicialScreen.jsx',
  'src/components/auth/LoginScreen.jsx',
  'src/components/auth/LockScreen.jsx',
  'src/components/auth/TrocarSenhaScreen.jsx',
  'src/components/auth/RequirePermission.jsx',
  'src/components/auth/UserMenu.jsx',
  'src/components/auth/useAuth.js',
  'src/pages/Usuarios.jsx',
  'src/modules/auth/domain/passwordHasher.js',
  'src/modules/auth/domain/accessPolicy.js',
  'src/modules/auth/domain/loginLockout.js',
  'src/modules/auth/application/localAuthService.js',
  'src/modules/auth/application/authSession.js',
  'src/modules/auth/application/auditContext.js',
  'src/modules/settings/application/appConfigService.js',
]) {
  assert.ok(existsSync(join(root, file)), `arquivo do contrato existe: ${file}`);
}

function listFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? listFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  ));
}
const authSources = [...listFiles('src/modules/auth'), ...listFiles('src/components/auth'), 'src/pages/Usuarios.jsx', 'src/modules/settings/application/appConfigService.js'];
for (const file of authSources) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.ok(!/console\.(log|info|warn|error|debug)\s*\([^)]*(senha|password|hash|salt)/i.test(source), `${file}: nenhum console.* com senha/hash`);
  assert.ok(!/console\.(log|info|debug)\s*\(/.test(source), `${file}: sem console.log/info/debug no módulo de autenticação`);
}
for (const file of [...listFiles('src/components/auth'), 'src/pages/Usuarios.jsx']) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.ok(!/senha_hash|senha_salt/.test(source), `${file}: UI nunca referencia hash/salt`);
}
const loginSource = readFileSync(join(root, 'src/components/auth/LoginScreen.jsx'), 'utf8');
assert.match(loginSource, /Login ou senha inválidos/, 'LoginScreen usa a mensagem genérica');
assert.match(loginSource, /APP_VERSION|AuthScreenShell/, 'LoginScreen exibe a versão (via moldura)');
assert.match(readFileSync(join(root, 'src/components/auth/AuthScreenShell.jsx'), 'utf8'), /APP_VERSION/, 'moldura exibe APP_VERSION');
const gateSource = readFileSync(join(root, 'src/components/auth/AuthGate.jsx'), 'utf8');
assert.match(gateSource, /countActiveUsers/, 'AuthGate decide pela contagem de usuários');
assert.match(gateSource, /ConfiguracaoInicialScreen[\s\S]*LoginScreen[\s\S]*LockScreen/, 'AuthGate encadeia as telas');
assert.match(gateSource, /AuthContext\.Provider/, 'AuthGate expõe o contexto');
const usersPage = readFileSync(join(root, 'src/pages/Usuarios.jsx'), 'utf8');
assert.match(usersPage, /RequirePermission permission="users\.manage"/, 'Usuarios exige users.manage');
assert.match(usersPage, /className="mg-action-bar /, 'Usuarios usa a barra de ações mg-action-bar');
for (const label of ['Novo usuário', 'Editar', 'Redefinir senha', 'Forçar troca', 'Inativar', 'Último acesso']) {
  assert.ok(usersPage.includes(label), `Usuarios contém a ação/coluna "${label}"`);
}
summary.textual = true;

await deleteDbForTests();
console.log('OK verify-local-auth');
console.log(JSON.stringify(summary, null, 2));
