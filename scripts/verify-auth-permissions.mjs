// Gate auth:permissions:verify — doc 11 rev. 2 §4/§6/§10, ADR-042/046.
// Matriz completa (4 papéis × ações) transcrita de forma independente; authorize lança
// AUTH_FORBIDDEN com role/action; fachada accessPolicy equivalente; serviços de usuários e
// de configuração recusam ator sem permissão; OPERADOR/CONSULTA não abrem Usuários
// (textual); nenhum `if (role === …)` nas telas. Inclui testes negativos.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { USUARIO_ROLES } from '../src/storage/indexedDb/schema.js';
import { ACTIONS, MATRIX, ROLES, ROLE_LABELS, authorize, can, isRole, listActions, roleLabel, roleOf } from '../src/modules/auth/domain/permissionService.js';
import { PROFILES, PERMISSIONS, ALL_PERMISSIONS, PROFILE_LABELS, assertCan, listPermissions, profileLabel } from '../src/modules/auth/domain/accessPolicy.js';
import { setPasswordPolicyForTests } from '../src/modules/auth/domain/passwordPolicy.js';
import * as auth from '../src/modules/auth/application/localAuthService.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
setPasswordPolicyForTests({ iterations: 2000 });

// Tabela do documento 11 §4 (revisão 2), transcrita de forma independente do módulo.
const A = 'ADMIN'; const G = 'GESTOR'; const O = 'OPERADOR'; const C = 'CONSULTA';
const EXPECTED = {
  'launch.use': [A, G, O],
  'weighing.read': [A, G, O, C],
  'weighing.write': [A, G, O],
  'weighing.edit': [A, G, O],
  'animal.read': [A, G, O, C],
  'animal.write': [A, G, O],
  'registry.read': [A, G, O, C],
  'registry.write': [A, G],
  'commercial.read': [A, G, C],
  'commercial.write': [A, G],
  'commercial.values': [A, G],
  'shipment.read': [A, G, O, C],
  'shipment.write': [A, G],
  'session.close': [A, G],
  'session.reopen': [A, G],
  'reports.read': [A, G, C],
  'maintenance.backup': [A, G],
  'maintenance.restore': [A],
  'maintenance.clear': [A],
  'maintenance.reset': [A],
  'maintenance.migrate': [A],
  'users.manage': [A],
  'settings.operational': [A, G],
  'settings.auth': [A],
  'settings.manage': [A],
  'audit.read': [A, G, C],
};

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// ---------------------------------------------------------------------------
// 1. Matriz exata (4 papéis × 26 ações) e propriedades estruturais.
// ---------------------------------------------------------------------------
function checkMatrix(matrix, canFn) {
  assert.deepEqual(Object.keys(matrix).sort(), Object.keys(EXPECTED).sort(), 'conjunto de ações igual ao do documento');
  let checks = 0;
  for (const [action, allowed] of Object.entries(EXPECTED)) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      assert.equal(matrix[action][role], expected, `MATRIX ${action} × ${role} deveria ser ${expected}`);
      assert.equal(canFn(role, action), expected, `can(${role}, ${action}) deveria ser ${expected}`);
      checks += 1;
    }
  }
  return checks;
}
assert.deepEqual([...ROLES], [A, G, O, C], 'quatro papéis fixos, nesta ordem');
assert.deepEqual([...ROLES], [...USUARIO_ROLES], 'papéis iguais aos do esquema (schema.js)');
const checks = checkMatrix(MATRIX, can);
assert.equal(checks, 26 * 4, 'todas as 104 combinações verificadas');
assert.equal(ACTIONS.length, 26);
assert.ok(Object.isFrozen(MATRIX) && Object.isFrozen(MATRIX['users.manage']) && Object.isFrozen(ROLES), 'matriz imutável');
assert.equal(listActions(A).length, 26, 'ADMIN tem todas as ações');
assert.equal(listActions(G).length, 19);
assert.equal(listActions(O).length, 8);
assert.equal(listActions(C).length, 7);
assert.deepEqual(listActions('ROOT'), []);
assert.equal(can(A, 'permissao.inexistente'), false, 'ação desconhecida é negada mesmo para ADMIN');
assert.equal(can('ROOT', 'launch.use'), false, 'papel desconhecido é negado');
assert.equal(can('admin', 'launch.use'), false, 'papel é sensível a maiúsculas');
assert.equal(can(null, 'launch.use'), false);
assert.equal(can(undefined, undefined), false);
assert.equal(isRole('CONSULTA'), true);
assert.equal(isRole('consulta'), false);
assert.deepEqual(ROLE_LABELS, { ADMIN: 'Administrador', GESTOR: 'Gestor', OPERADOR: 'Operador', CONSULTA: 'Consulta' });
for (const role of ROLES) assert.equal(roleLabel(role), ROLE_LABELS[role]);
assert.equal(roleOf({ role: 'GESTOR' }), 'GESTOR');
assert.equal(roleOf({ perfil: 'GESTOR' }), 'GESTOR', 'ator da rev. 1 (perfil) ainda é lido');
assert.equal(roleOf(null), null);
// Negativo: uma matriz com uma célula trocada deve falhar a comparação.
const tampered = { ...MATRIX, 'users.manage': { ...MATRIX['users.manage'], GESTOR: true } };
assert.throws(() => checkMatrix(tampered, (role, action) => tampered[action]?.[role] === true), 'matriz adulterada é detectada');
const missing = { ...MATRIX }; delete missing['audit.read'];
assert.throws(() => checkMatrix(missing, can), 'ação ausente é detectada');

// ---------------------------------------------------------------------------
// 2. authorize lança AUTH_FORBIDDEN com role/action; fachada accessPolicy equivale.
// ---------------------------------------------------------------------------
assert.equal(authorize(A, 'users.manage'), true);
let thrown = null;
try { authorize(O, 'users.manage'); } catch (err) { thrown = err; }
assert.ok(thrown, 'authorize deve lançar');
assert.equal(thrown.code, 'AUTH_FORBIDDEN');
assert.equal(thrown.role, O);
assert.equal(thrown.action, 'users.manage');
assert.match(thrown.message, /Acesso não permitido/);
assert.throws(() => authorize(null, 'launch.use'), (err) => err.code === 'AUTH_FORBIDDEN' && err.role === null, 'sem papel → AUTH_FORBIDDEN');
assert.throws(() => authorize(A, 'nao.existe'), (err) => err.code === 'AUTH_FORBIDDEN', 'ação inexistente → AUTH_FORBIDDEN');
assert.throws(() => authorize(C, 'launch.use'), (err) => err.code === 'AUTH_FORBIDDEN', 'CONSULTA não usa o Lançamento');
assert.throws(() => authorize(O, 'commercial.values'), (err) => err.code === 'AUTH_FORBIDDEN', 'OPERADOR não vê valores');

assert.equal(PROFILES, ROLES, 'fachada: PROFILES é o mesmo array de ROLES');
assert.equal(ALL_PERMISSIONS, ACTIONS);
assert.deepEqual(PROFILE_LABELS, ROLE_LABELS);
for (const role of ROLES) {
  assert.deepEqual([...PERMISSIONS[role]], listActions(role), `PERMISSIONS.${role} = listActions`);
  assert.deepEqual(listPermissions(role), listActions(role));
  assert.equal(profileLabel(role), roleLabel(role));
}
assert.ok(Object.isFrozen(PERMISSIONS) && Object.isFrozen(PERMISSIONS.ADMIN));
assert.throws(() => assertCan(G, 'users.manage'), (err) => err.code === 'AUTH_FORBIDDEN' && err.permission === 'users.manage' && err.action === 'users.manage', 'assertCan delega a authorize (aliases permission/action)');
assert.equal(assertCan(G, 'registry.write'), true);

// ---------------------------------------------------------------------------
// 3. Serviços recusam ator sem permissão (nada gravado).
// ---------------------------------------------------------------------------
await deleteDbForTests();
const { user: admin } = await auth.bootstrapFirstAdmin({ nome: 'Ana Souza', login: 'ana', senha: 'Forte#2026' });
const actorAdmin = { id: admin.id, nome: admin.nome, role: A };
const gestor = await auth.createUser(actorAdmin, { nome: 'Bruno Lima', login: 'bruno', senha: 'Inicial#2026', role: G });
const operador = await auth.createUser(actorAdmin, { nome: 'Carla Dias', login: 'carla', senha: 'Inicial#2026', role: O });
const consulta = await auth.createUser(actorAdmin, { nome: 'Dora Reis', login: 'dora', senha: 'Inicial#2026', role: C });
const actors = {
  GESTOR: { id: gestor.id, nome: gestor.nome, role: G },
  OPERADOR: { id: operador.id, nome: operador.nome, role: O },
  CONSULTA: { id: consulta.id, nome: consulta.nome, role: C },
  'sem ator': null,
  'papel inventado': { id: 'fake', role: 'ROOT' },
  'rev. 1 OPERADOR (perfil)': { id: operador.id, perfil: O },
};
const before = await auth.countActiveUsers();
for (const [name, actor] of Object.entries(actors)) {
  await rejectsWithCode(auth.createUser(actor, { nome: 'X', login: 'x', senha: 'Forte#2026', role: O }), 'AUTH_FORBIDDEN', `createUser com ${name}`);
  await rejectsWithCode(auth.listUsers(actor), 'AUTH_FORBIDDEN', `listUsers com ${name}`);
  await rejectsWithCode(auth.updateUser(actor, admin.id, { nome: 'Hack' }), 'AUTH_FORBIDDEN', `updateUser com ${name}`);
  await rejectsWithCode(auth.setActive(actor, admin.id, false), 'AUTH_FORBIDDEN', `setActive com ${name}`);
  await rejectsWithCode(auth.resetPassword(actor, admin.id, 'Outra#2026'), 'AUTH_FORBIDDEN', `resetPassword com ${name}`);
  await rejectsWithCode(auth.forcePasswordChange(actor, admin.id), 'AUTH_FORBIDDEN', `forcePasswordChange com ${name}`);
}
assert.equal(await auth.countActiveUsers(), before, 'recusas não alteram usuários');
assert.equal((await auth.authenticate('ana', 'Forte#2026')).nome, 'Ana Souza', 'ADMIN intacto após tentativas recusadas');
assert.equal((await auth.listUsers(actorAdmin)).length, 4, 'ADMIN continua autorizado');

// Configurações: settings.operational (ADMIN, GESTOR) × settings.auth (ADMIN).
await rejectsWithCode(appConfig.updateAppConfig(actors.OPERADOR, { intervalo_pesagem_dias: 7 }), 'AUTH_FORBIDDEN', 'OPERADOR não altera configurações operacionais');
await rejectsWithCode(appConfig.updateAppConfig(actors.CONSULTA, { exigir_documento_venda: true }), 'AUTH_FORBIDDEN', 'CONSULTA não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(null, { faixa_peso_min: 10 }), 'AUTH_FORBIDDEN', 'sem ator não altera configurações');
await rejectsWithCode(appConfig.updateAppConfig(actors.GESTOR, { inactivity_lock_minutes: 5 }), 'AUTH_FORBIDDEN', 'GESTOR não altera a política de autenticação');
await rejectsWithCode(appConfig.updateAppConfig(actors.GESTOR, { intervalo_pesagem_dias: 7, lock_minutes: 2 }), 'AUTH_FORBIDDEN', 'patch misto com auth-policy é recusado por inteiro para GESTOR');
assert.equal((await appConfig.getAppConfig()).intervalo_pesagem_dias, 30, 'patch misto recusado não gravou nada');
assert.equal((await appConfig.updateAppConfig(actors.GESTOR, { intervalo_pesagem_dias: 7 })).intervalo_pesagem_dias, 7, 'GESTOR altera configurações operacionais');
assert.equal((await appConfig.updateAppConfig(actorAdmin, { inactivity_lock_minutes: 5 })).inactivity_lock_minutes, 5, 'ADMIN altera a política de autenticação');
assert.equal((await appConfig.getAuthPolicy()).inactivity_lock_minutes, 5);

// ---------------------------------------------------------------------------
// 4. Textual: Usuários exige users.manage (OPERADOR/CONSULTA/GESTOR veem acesso negado);
//    Configurações usa settings.operational + settings.auth; nenhum if (role === …) nas telas.
// ---------------------------------------------------------------------------
function listFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? listFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  ));
}
function checkSources(s) {
  assert.match(s.users, /<RequirePermission permission="users\.manage">/, 'Usuarios protegida por users.manage');
  assert.equal(can(O, 'users.manage'), false, 'OPERADOR não abre Usuários');
  assert.equal(can(C, 'users.manage'), false, 'CONSULTA não abre Usuários');
  assert.equal(can(G, 'users.manage'), false, 'GESTOR não abre Usuários');
  assert.match(s.users, /ROLES\.map\(\(role\) => <SelectItem/, 'Usuarios lista os quatro papéis a partir de ROLES');
  assert.match(s.users, /<TableHead>Papel<\/TableHead>/, 'coluna Papel');
  assert.match(s.settings, /<RequirePermission permission="settings\.operational">/, 'Configurações exige settings.operational');
  assert.match(s.settings, /permission: 'settings\.auth'/, 'seção Segurança marcada com settings.auth');
  assert.match(s.settings, /SECTIONS\.filter\(\(section\) => auth\?\.can\?\.\(section\.permission\)\)/, 'seções filtradas por can()');
  assert.match(s.guard, /auth\?\.can\?\.\(permission\)/, 'RequirePermission decide por can');
  assert.match(s.gate, /can: \(action\) => can\(user\?\.role, action\)/, 'AuthGate expõe can(action) pelo papel');
  for (const [file, source] of Object.entries(s.ui)) {
    assert.ok(!/\b(role|perfil|papel)\s*[!=]==?\s*['"]/.test(source), `${file}: nenhum if (role === '…') na tela — usar can()/RequirePermission`);
  }
}
const uiFiles = [...listFiles('src/components/auth'), 'src/pages/Usuarios.jsx', 'src/pages/Configuracoes.jsx'].filter((file) => /\.jsx?$/.test(file));
const sources = {
  users: read('src/pages/Usuarios.jsx'),
  settings: read('src/pages/Configuracoes.jsx'),
  guard: read('src/components/auth/RequirePermission.jsx'),
  gate: read('src/components/auth/AuthGate.jsx'),
  ui: Object.fromEntries(uiFiles.map((file) => [file, read(file)])),
};
checkSources(sources);
const mutated = (key, from, to) => { assert.ok(sources[key].includes(from), `mutação aplicável: ${from.slice(0, 40)}`); return { ...sources, [key]: sources[key].replace(from, to) }; };
for (const [name, bad] of [
  ['Usuários com permissão fraca', mutated('users', 'permission="users.manage"', 'permission="registry.read"')],
  ['Configurações sem filtrar seções', mutated('settings', 'SECTIONS.filter((section) => auth?.can?.(section.permission))', 'SECTIONS')],
  ['if (role === ) na tela', { ...sources, ui: { ...sources.ui, 'src/pages/Usuarios.jsx': sources.users + "\nif (actor.role === 'ADMIN') {}" } }],
  ['AuthGate decidindo por perfil', mutated('gate', 'can: (action) => can(user?.role, action)', "can: (action) => user?.role === 'ADMIN'")],
]) {
  assert.throws(() => checkSources(bad), `mutação deveria falhar: ${name}`);
}

await deleteDbForTests();
setPasswordPolicyForTests({});
console.log('OK verify-auth-permissions');
console.log(JSON.stringify({
  roles: ROLES.length,
  actions: ACTIONS.length,
  combinationsChecked: checks,
  authorizeThrowsForbidden: true,
  facadeEquivalent: true,
  servicesRejectUnauthorizedActor: Object.keys(actors),
  settingsSplitPermissions: { operational: [A, G], auth: [A] },
  usersPageDeniedTo: [G, O, C],
}, null, 2));
