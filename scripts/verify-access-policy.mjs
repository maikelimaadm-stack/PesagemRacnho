// Gate auth:access:verify — fachada accessPolicy (rev. 1) sobre o permissionService (rev. 2,
// doc 11 §4, ADR-042): PROFILES/PERMISSIONS/can/assertCan/profileLabel delegam à MATRIX;
// importadores antigos (catalog/registryAccess) continuam funcionando; AuthGate,
// RequirePermission, UserMenu, Layout e App usam can()/RequirePermission. A matriz completa
// e os serviços são cobertos por verify-auth-permissions.mjs (delegado aqui).
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFILES, PERMISSIONS, ALL_PERMISSIONS, PROFILE_LABELS, can, assertCan, listPermissions, isProfile, profileLabel, forbiddenError,
} from '../src/modules/auth/domain/accessPolicy.js';
import { ACTIONS, MATRIX, ROLES, authorize, listActions, roleLabel } from '../src/modules/auth/domain/permissionService.js';
import { assertRegistryWrite, resolveWriterRole } from '../src/modules/catalog/application/registryAccess.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// 1. Fachada = permissionService (mesmos objetos, mesmas decisões).
assert.equal(PROFILES, ROLES, 'PROFILES é ROLES');
assert.deepEqual([...PROFILES], ['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA'], 'quatro papéis');
assert.equal(ALL_PERMISSIONS, ACTIONS);
assert.equal(ALL_PERMISSIONS.length, 28);
assert.deepEqual(PROFILE_LABELS, { ADMIN: 'Administrador', GESTOR: 'Gestor', OPERADOR: 'Operador', CONSULTA: 'Consulta' });
let checks = 0;
for (const action of ACTIONS) {
  for (const role of ROLES) {
    const expected = MATRIX[action][role];
    assert.equal(can(role, action), expected, `can(${role}, ${action})`);
    assert.equal(PERMISSIONS[role].includes(action), expected, `PERMISSIONS.${role} × ${action}`);
    assert.equal(listPermissions(role).includes(action), expected);
    checks += 1;
  }
}
assert.equal(checks, 112);
for (const role of ROLES) {
  assert.deepEqual([...PERMISSIONS[role]], listActions(role));
  assert.equal(profileLabel(role), roleLabel(role));
  assert.equal(isProfile(role), true);
}
assert.ok(Object.isFrozen(PERMISSIONS) && Object.isFrozen(PERMISSIONS.ADMIN), 'mapa estático imutável');
assert.equal(PERMISSIONS.ADMIN.length, 28);
assert.equal(PERMISSIONS.GESTOR.length, 21);
assert.equal(PERMISSIONS.OPERADOR.length, 9);
assert.equal(PERMISSIONS.CONSULTA.length, 7);

// 2. Negações: desconhecidos, maiúsculas, nulos.
assert.equal(can('OPERADOR', 'users.manage'), false);
assert.equal(can('GESTOR', 'users.manage'), false);
assert.equal(can('CONSULTA', 'launch.use'), false);
assert.equal(can('ADMIN', 'permissao.inexistente'), false, 'permissão desconhecida negada mesmo para ADMIN');
assert.equal(can('ROOT', 'launch.use'), false);
assert.equal(can(null, 'launch.use'), false);
assert.equal(can(undefined, undefined), false);
assert.equal(isProfile('admin'), false, 'papel é sensível a maiúsculas');
assert.deepEqual(listPermissions('ROOT'), []);
assert.equal(profileLabel('ROOT'), 'ROOT');
assert.equal(profileLabel(null), 'Sem papel');

// 3. assertCan lança AUTH_FORBIDDEN (com aliases permission/action) e é o mesmo erro de authorize.
assert.equal(assertCan('ADMIN', 'users.manage'), true);
let thrown = null;
try { assertCan('OPERADOR', 'users.manage'); } catch (err) { thrown = err; }
assert.ok(thrown, 'assertCan deve lançar');
assert.equal(thrown.code, 'AUTH_FORBIDDEN');
assert.equal(thrown.permission, 'users.manage');
assert.equal(thrown.action, 'users.manage');
assert.equal(thrown.profile, 'OPERADOR');
assert.equal(thrown.role, 'OPERADOR');
assert.match(thrown.message, /Acesso não permitido/);
assert.throws(() => assertCan(null, 'launch.use'), (err) => err.code === 'AUTH_FORBIDDEN');
assert.throws(() => assertCan('ADMIN', 'nao.existe'), (err) => err.code === 'AUTH_FORBIDDEN');
let fromAuthorize = null;
try { authorize('CONSULTA', 'registry.write'); } catch (err) { fromAuthorize = err; }
assert.equal(forbiddenError('CONSULTA', 'registry.write').message, fromAuthorize.message, 'mesma mensagem que authorize');

// 4. Importador antigo (catalog/registryAccess) continua decidindo pela fachada.
assert.equal(assertRegistryWrite({ id: 'u', role: 'GESTOR' }), true);
assert.equal(assertRegistryWrite({ id: 'u', perfil: 'ADMIN' }), true, 'ator rev. 1 (perfil) aceito');
assert.throws(() => assertRegistryWrite({ id: 'u', role: 'OPERADOR' }), (err) => err.code === 'AUTH_FORBIDDEN', 'OPERADOR não escreve cadastros');
assert.throws(() => assertRegistryWrite({ id: 'u', role: 'CONSULTA' }), (err) => err.code === 'AUTH_FORBIDDEN', 'CONSULTA não escreve cadastros');
assert.equal(resolveWriterRole({ role: 'gestor' }), 'GESTOR');

// 5. Textual: AuthGate/RequirePermission/UserMenu/Layout/App usam can()/RequirePermission.
for (const file of ['src/components/auth/AuthGate.jsx', 'src/components/auth/RequirePermission.jsx', 'src/components/auth/UserMenu.jsx', 'src/components/auth/useAuth.js', 'src/Layout.jsx', 'src/App.jsx']) {
  assert.ok(existsSync(join(root, file)), `${file} existe`);
}
const gate = read('src/components/auth/AuthGate.jsx');
assert.match(gate, /import \{ can \} from '@\/modules\/auth\/domain\/permissionService'/, 'AuthGate importa can do permissionService');
assert.match(gate, /can: \(action\) => can\(user\?\.role, action\)/, 'AuthGate expõe can(action) no contexto pelo papel');
const guard = read('src/components/auth/RequirePermission.jsx');
assert.match(guard, /auth\?\.can\?\.\(permission\)/, 'RequirePermission decide por can');
assert.match(guard, /Acesso não permitido/, 'RequirePermission mostra a tela de acesso negado');
assert.match(guard, /roleLabel\(role \?\? profile\)/, 'tela de acesso negado exibe o nome do papel (aceita profile da rev. 1)');
const usersPage = read('src/pages/Usuarios.jsx');
assert.match(usersPage, /<RequirePermission permission="users\.manage">/, 'Usuarios protegida por users.manage');
const settingsPage = read('src/pages/Configuracoes.jsx');
assert.match(settingsPage, /<RequirePermission permission="settings\.operational">/, 'Configurações protegida por settings.operational');
const menu = read('src/components/auth/UserMenu.jsx');
for (const label of ['Bloquear', 'Trocar senha', 'Trocar usuário', 'Sair', 'APP_VERSION', 'roleLabel']) {
  assert.ok(menu.includes(label), `UserMenu contém ${label}`);
}
const layout = read('src/Layout.jsx');
const app = read('src/App.jsx');
const layoutIntegrated = /permission:/.test(layout) && /RequirePermission|can\(/.test(layout);
const appIntegrated = /AuthGate/.test(app);
assert.ok(layoutIntegrated, 'Layout.jsx declara permission por item de menu e usa RequirePermission/can');
assert.ok(appIntegrated, 'App.jsx monta AuthGate');
assert.ok(!/(role|perfil)\s*===\s*['"]/.test(layout), 'Layout sem if (role === …)');

console.log('OK verify-access-policy');
console.log(JSON.stringify({
  profiles: PROFILES.length,
  permissions: ALL_PERMISSIONS.length,
  combinationsChecked: checks,
  facadeDelegatesToPermissionService: true,
  assertCanThrowsForbidden: true,
  registryAccessStillWorks: true,
  layoutIntegrated,
  appIntegrated,
  delegatedGates: ['verify-auth-permissions.mjs'],
}, null, 2));
