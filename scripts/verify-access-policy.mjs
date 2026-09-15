// Gate auth:access:verify — tabela de permissões (doc 11 §2.2, ADR-036), assertCan,
// serviços recusando ator sem permissão e verificação textual de AuthGate/RequirePermission/Layout.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import {
  PROFILES, PERMISSIONS, ALL_PERMISSIONS, PROFILE_LABELS, can, assertCan, listPermissions, isProfile, profileLabel,
} from '../src/modules/auth/domain/accessPolicy.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';

const root = fileURLToPath(new URL('..', import.meta.url));

// Vire para true depois que o coordenador integrar App.jsx/Layout.jsx (item 6 da entrega do Agente C).
const LAYOUT_INTEGRATION_REQUIRED = false;

// Tabela do documento 11 §2.2, transcrita de forma independente do módulo.
const EXPECTED = {
  'launch.use': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'weighing.read': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'weighing.write': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'weighing.edit': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'animal.read': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'animal.write': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'registry.read': ['ADMIN', 'GESTOR', 'OPERADOR'],
  'registry.write': ['ADMIN', 'GESTOR'],
  'commercial.read': ['ADMIN', 'GESTOR'],
  'commercial.write': ['ADMIN', 'GESTOR'],
  'shipment.read': ['ADMIN', 'GESTOR'],
  'shipment.write': ['ADMIN', 'GESTOR'],
  'session.close': ['ADMIN', 'GESTOR'],
  'session.reopen': ['ADMIN', 'GESTOR'],
  'reports.read': ['ADMIN', 'GESTOR'],
  'maintenance.backup': ['ADMIN', 'GESTOR'],
  'maintenance.restore': ['ADMIN'],
  'maintenance.clear': ['ADMIN'],
  'maintenance.migrate': ['ADMIN'],
  'users.manage': ['ADMIN'],
  'settings.manage': ['ADMIN'],
};

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// 1. Tabela exata.
assert.deepEqual([...PROFILES], ['ADMIN', 'GESTOR', 'OPERADOR'], 'três perfis fixos');
assert.deepEqual([...ALL_PERMISSIONS].sort(), Object.keys(EXPECTED).sort(), 'conjunto de permissões igual ao do documento');
let checks = 0;
for (const [permission, allowed] of Object.entries(EXPECTED)) {
  for (const profile of PROFILES) {
    const expected = allowed.includes(profile);
    assert.equal(can(profile, permission), expected, `${profile} × ${permission} deveria ser ${expected}`);
    assert.equal(PERMISSIONS[profile].includes(permission), expected, `PERMISSIONS.${profile} × ${permission}`);
    assert.equal(listPermissions(profile).includes(permission), expected, `listPermissions(${profile}) × ${permission}`);
    checks += 1;
  }
}
assert.equal(checks, 21 * 3, 'todas as 63 combinações verificadas');
assert.equal(PERMISSIONS.ADMIN.length, 21, 'ADMIN tem todas as permissões');
assert.equal(PERMISSIONS.GESTOR.length, 16);
assert.equal(PERMISSIONS.OPERADOR.length, 7);
assert.ok(Object.isFrozen(PERMISSIONS) && Object.isFrozen(PERMISSIONS.ADMIN), 'mapa estático imutável');

// 2. OPERADOR/GESTOR não têm users.manage; perfis e permissões desconhecidos são negados.
assert.equal(can('OPERADOR', 'users.manage'), false, 'OPERADOR sem users.manage');
assert.equal(can('GESTOR', 'users.manage'), false, 'GESTOR sem users.manage');
assert.equal(can('ADMIN', 'users.manage'), true);
assert.equal(can('OPERADOR', 'registry.write'), false);
assert.equal(can('GESTOR', 'maintenance.restore'), false);
assert.equal(can('ADMIN', 'permissao.inexistente'), false, 'permissão desconhecida é negada mesmo para ADMIN');
assert.equal(can('ROOT', 'launch.use'), false, 'perfil desconhecido é negado');
assert.equal(can(null, 'launch.use'), false, 'sem perfil é negado');
assert.equal(can(undefined, undefined), false);
assert.equal(isProfile('admin'), false, 'perfil é sensível a maiúsculas (enum ASCII)');
assert.deepEqual(listPermissions('ROOT'), []);
assert.equal(profileLabel('OPERADOR'), 'Operador');
assert.equal(PROFILE_LABELS.ADMIN, 'Administrador');

// 3. assertCan lança AUTH_FORBIDDEN.
assert.equal(assertCan('ADMIN', 'users.manage'), true);
let thrown = null;
try { assertCan('OPERADOR', 'users.manage'); } catch (err) { thrown = err; }
assert.ok(thrown, 'assertCan deve lançar');
assert.equal(thrown.code, 'AUTH_FORBIDDEN');
assert.equal(thrown.permission, 'users.manage');
assert.match(thrown.message, /Acesso não permitido/);
assert.throws(() => assertCan(null, 'launch.use'), (err) => err.code === 'AUTH_FORBIDDEN', 'sem perfil → AUTH_FORBIDDEN');
assert.throws(() => assertCan('ADMIN', 'nao.existe'), (err) => err.code === 'AUTH_FORBIDDEN', 'permissão inexistente → AUTH_FORBIDDEN');

// 4. Serviços recusam ator sem permissão (e nada é gravado).
await deleteDbForTests();
const admin = await auth.createInitialAdmin({ nome: 'Ana Souza', login: 'ana', senha: 'Forte#2026' });
const actorAdmin = { id: admin.id, nome: admin.nome, perfil: 'ADMIN' };
const operador = await auth.createUser(actorAdmin, { nome: 'Carla Dias', login: 'carla', senha: 'Inicial#2026', perfil: 'OPERADOR' });
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno Lima', login: 'bruno', senha: 'Inicial#2026', perfil: 'GESTOR' });
const actorOperador = { id: operador.id, nome: operador.nome, perfil: 'OPERADOR' };
const actorGestor = { id: gestor.id, nome: gestor.nome, perfil: 'GESTOR' };
const before = await auth.countActiveUsers();

await rejectsWithCode(auth.createUser(actorOperador, { nome: 'X', login: 'x', senha: 'Forte#2026', perfil: 'OPERADOR' }), 'AUTH_FORBIDDEN', 'createUser com ator OPERADOR');
await rejectsWithCode(auth.createUser(actorGestor, { nome: 'X', login: 'x', senha: 'Forte#2026', perfil: 'OPERADOR' }), 'AUTH_FORBIDDEN', 'createUser com ator GESTOR');
await rejectsWithCode(auth.createUser(null, { nome: 'X', login: 'x', senha: 'Forte#2026', perfil: 'OPERADOR' }), 'AUTH_FORBIDDEN', 'createUser sem ator');
await rejectsWithCode(auth.createUser({ id: 'fake', perfil: 'ROOT' }, { nome: 'X', login: 'x', senha: 'Forte#2026', perfil: 'OPERADOR' }), 'AUTH_FORBIDDEN', 'createUser com perfil inventado');
await rejectsWithCode(auth.listUsers(actorOperador), 'AUTH_FORBIDDEN', 'listUsers com OPERADOR');
await rejectsWithCode(auth.listUsers(actorGestor), 'AUTH_FORBIDDEN', 'listUsers com GESTOR');
await rejectsWithCode(auth.updateUser(actorOperador, admin.id, { nome: 'Hack' }), 'AUTH_FORBIDDEN', 'updateUser com OPERADOR');
await rejectsWithCode(auth.setActive(actorOperador, admin.id, false), 'AUTH_FORBIDDEN', 'setActive com OPERADOR');
await rejectsWithCode(auth.resetPassword(actorOperador, admin.id, 'Outra#2026'), 'AUTH_FORBIDDEN', 'resetPassword com OPERADOR');
await rejectsWithCode(auth.forcePasswordChange(actorGestor, admin.id), 'AUTH_FORBIDDEN', 'forcePasswordChange com GESTOR');
await rejectsWithCode(appConfig.updateAppConfig(actorOperador, { intervalo_pesagem_dias: 7 }), 'AUTH_FORBIDDEN', 'updateAppConfig com OPERADOR');
assert.equal(await auth.countActiveUsers(), before, 'recusas não alteram usuários');
assert.equal((await auth.authenticate('ana', 'Forte#2026')).nome, 'Ana Souza', 'ADMIN intacto após tentativas recusadas');
assert.equal((await auth.listUsers(actorAdmin)).length, 3, 'ADMIN continua autorizado');
assert.equal((await appConfig.getAppConfig()).intervalo_pesagem_dias, 30, 'configuração intacta');

// 5. Verificação textual: AuthGate/RequirePermission/UserMenu usam `can`; Layout/App (após integração).
const read = (rel) => readFileSync(join(root, rel), 'utf8');
for (const file of ['src/components/auth/AuthGate.jsx', 'src/components/auth/RequirePermission.jsx', 'src/components/auth/UserMenu.jsx', 'src/components/auth/useAuth.js']) {
  assert.ok(existsSync(join(root, file)), `${file} existe`);
}
const gate = read('src/components/auth/AuthGate.jsx');
assert.match(gate, /import \{ can \} from '@\/modules\/auth\/domain\/accessPolicy'/, 'AuthGate importa can do accessPolicy');
assert.match(gate, /can: \(permission\) => can\(user\?\.perfil, permission\)/, 'AuthGate expõe can(permission) no contexto');
const guard = read('src/components/auth/RequirePermission.jsx');
assert.match(guard, /auth\?\.can\?\.\(permission\)/, 'RequirePermission decide por can');
assert.match(guard, /Acesso não permitido/, 'RequirePermission mostra a tela de acesso negado');
assert.match(guard, /profileLabel\(profile\)/, 'tela de acesso negado exibe o nome do perfil');
const usersPage = read('src/pages/Usuarios.jsx');
assert.match(usersPage, /<RequirePermission permission="users\.manage">/, 'Usuarios protegida por users.manage');
const menu = read('src/components/auth/UserMenu.jsx');
for (const label of ['Bloquear', 'Trocar usuário', 'Sair', 'APP_VERSION', 'profileLabel']) {
  assert.ok(menu.includes(label), `UserMenu contém ${label}`);
}

const layout = read('src/Layout.jsx');
const app = read('src/App.jsx');
const layoutIntegrated = /permission:/.test(layout) && /RequirePermission|can\(/.test(layout);
const appIntegrated = /AuthGate/.test(app);
if (LAYOUT_INTEGRATION_REQUIRED) {
  assert.ok(layoutIntegrated, 'Layout.jsx declara permission por item de menu e usa RequirePermission/can');
  assert.ok(appIntegrated, 'App.jsx monta AuthGate entre DbBootstrap e Router');
}

await deleteDbForTests();
console.log('OK verify-access-policy');
console.log(JSON.stringify({
  profiles: PROFILES.length,
  permissions: ALL_PERMISSIONS.length,
  combinationsChecked: checks,
  operatorLacksUsersManage: true,
  assertCanThrowsForbidden: true,
  servicesRejectUnauthorizedActor: true,
  layoutIntegrated,
  appIntegrated,
  layoutIntegrationRequired: LAYOUT_INTEGRATION_REQUIRED,
}, null, 2));
