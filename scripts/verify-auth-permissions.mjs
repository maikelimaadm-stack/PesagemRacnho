// Gate auth:permissions:verify — doc 11 rev. 2 §4/§6/§10, ADR-042/046.
// Matriz completa (4 papéis × ações) transcrita de forma independente; authorize lança
// AUTH_FORBIDDEN com role/action; fachada accessPolicy equivalente; serviços de usuários e
// de configuração recusam ator sem permissão; OPERADOR/CONSULTA não abrem Usuários
// (textual); nenhum `if (role === …)` nas telas. E1C: Configurações por papel (menu, rota,
// seções) com as decisões do Layout e da página executadas a partir do fonte e o can() da
// matriz — o GESTOR vê só Relatórios e grava o divisor da @ (settings.reports). Inclui testes
// negativos.
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
  'reports.read': [A, G, O, C],
  'reports.export': [A, G, C],
  'reports.templates.share': [A, G],
  'maintenance.backup': [A, G],
  'maintenance.restore': [A],
  'maintenance.clear': [A],
  'maintenance.reset': [A],
  'maintenance.migrate': [A],
  'users.manage': [A],
  'settings.operational': [A, G],
  'settings.reports': [A, G], // E1C: Configurações › Relatórios (divisor da @)
  'settings.auth': [A],
  'settings.manage': [A],
  'audit.read': [A, G],
};

async function rejectsWithCode(promise, code, message) {
  let error = null;
  try { await promise; } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

// ---------------------------------------------------------------------------
// 1. Matriz exata (4 papéis × 29 ações) e propriedades estruturais.
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
assert.equal(checks, 29 * 4, 'todas as 116 combinações verificadas');
assert.equal(ACTIONS.length, 29);
assert.ok(Object.isFrozen(MATRIX) && Object.isFrozen(MATRIX['users.manage']) && Object.isFrozen(ROLES), 'matriz imutável');
assert.equal(listActions(A).length, 29, 'ADMIN tem todas as ações');
assert.equal(listActions(G).length, 22);
assert.equal(listActions(O).length, 9);
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

// Revisão E1C: a tabela oficial (doc 11 §4) tem de dizer o mesmo que a MATRIX — o
// permissionService declara segui-la "exatamente". Linhas com várias ações ("a / b") aceitam
// célula única (vale para todas) ou uma marca por ação ("✔ / ✘"); "✔ (…)" conta como ✔.
function docMatrix(doc) {
  const section = doc.split('## 4. Matriz de permissões')[1]?.split('\n## ')[0] || '';
  const table = {};
  for (const line of section.split('\n').filter((row) => row.startsWith('| `'))) {
    const [label, ...cells] = line.split('|').slice(1, -1);
    const actions = [...label.matchAll(/`([\w.]+)`/g)].map((m) => m[1]);
    assert.equal(cells.length, ROLES.length, `doc 11 §4: quatro colunas de papel em ${actions.join(', ')}`);
    actions.forEach((action, index) => {
      table[action] = Object.fromEntries(ROLES.map((role, r) => {
        const marks = cells[r].split(' / ');
        const mark = (marks.length === actions.length ? marks[index] : cells[r]).trim();
        assert.ok(/^[✔✘]/.test(mark), `doc 11 §4: marca ✔/✘ em ${action} × ${role}`);
        return [role, mark.startsWith('✔')];
      }));
    });
  }
  return table;
}
const doc11 = read('docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md');
const matrixAsPlain = (matrix) => Object.fromEntries(Object.keys(matrix).sort().map((action) => [action, { ...matrix[action] }]));
assert.deepEqual(matrixAsPlain(docMatrix(doc11)), matrixAsPlain(MATRIX), 'tabela do doc 11 §4 igual à MATRIX');
for (const [name, bad] of [
  ['doc: GESTOR sem settings.reports', doc11.replace('| `settings.reports` (Configurações › Relatórios, divisor da @ — E1C 1.4.0) | ✔ | ✔ |', '| `settings.reports` (Configurações › Relatórios, divisor da @ — E1C 1.4.0) | ✔ | ✘ |')],
  ['doc: sem a linha settings.reports', doc11.replace(/\| `settings\.reports`[^\n]*\n/, '')],
]) {
  assert.notEqual(bad, doc11, `mutação aplicável: ${name}`);
  assert.throws(() => assert.deepEqual(matrixAsPlain(docMatrix(bad)), matrixAsPlain(MATRIX)), `mutação deveria falhar: ${name}`);
}
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
assert.throws(() => authorize(C, 'audit.read'), (err) => err.code === 'AUTH_FORBIDDEN', 'CONSULTA não lê auditoria');
assert.throws(() => authorize(O, 'reports.export'), (err) => err.code === 'AUTH_FORBIDDEN', 'OPERADOR não exporta relatórios');
assert.throws(() => authorize(C, 'reports.templates.share'), (err) => err.code === 'AUTH_FORBIDDEN', 'CONSULTA não compartilha modelos');

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

// E1C: divisor da @ (report-settings) com permissão própria, settings.reports (ADMIN e GESTOR).
// Os grupos operacionais continuam em settings.operational no serviço (decisão E1C: só a tela
// deixa de mostrá-los ao GESTOR; nenhum outro ponto do app grava por eles).
assert.equal(appConfig.CONFIG_GROUPS.reports.permission, 'settings.reports', 'report-settings autorizado por settings.reports');
for (const group of ['operational', 'sales', 'weightWarning']) {
  assert.equal(appConfig.CONFIG_GROUPS[group].permission, 'settings.operational', `${group} continua em settings.operational no serviço`);
}
assert.equal(appConfig.CONFIG_GROUPS.auth.permission, 'settings.auth', 'auth-policy continua só ADMIN');
for (const name of ['OPERADOR', 'CONSULTA', 'sem ator', 'papel inventado', 'rev. 1 OPERADOR (perfil)']) {
  await rejectsWithCode(appConfig.updateAppConfig(actors[name], { arroba_divisor: 15 }), 'AUTH_FORBIDDEN', `${name} não altera o divisor da @`);
}
await rejectsWithCode(appConfig.updateAppConfig(actors.GESTOR, { arroba_divisor: 15, lock_minutes: 2 }), 'AUTH_FORBIDDEN', 'patch misto divisor + auth-policy recusado por inteiro para GESTOR');
assert.equal((await appConfig.getReportSettings()).arroba_divisor, 30, 'recusas não gravaram o divisor');
assert.equal((await appConfig.updateAppConfig(actors.GESTOR, { arroba_divisor: 15 })).arroba_divisor, 15, 'GESTOR grava o divisor da @ (settings.reports)');
assert.equal((await appConfig.getReportSettings()).arroba_divisor, 15, 'divisor 15 persistido');
assert.equal((await appConfig.updateAppConfig(actorAdmin, { arroba_divisor: 30 })).arroba_divisor, 30, 'ADMIN também grava o divisor');

// ---------------------------------------------------------------------------
// 4. Textual: Usuários exige users.manage (OPERADOR/CONSULTA/GESTOR veem acesso negado);
//    Configurações: menu e página com settings.operational, cada seção com a sua permissão
//    (E1C: GESTOR só Relatórios); nenhum if (role === …) nas telas.
// ---------------------------------------------------------------------------
function listFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? listFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  ));
}

// E1C: o que cada papel vê em Configurações. As DECISÕES são executadas a partir do próprio fonte
// (não reescritas aqui): no Layout, NAV_ITEMS + o filtro do menu (visibleItems) + o item da rota
// (current); na página, SECTIONS + sections/canSeeData/sectionById/hasSection + as linhas de
// cartões do JSX. Assim um filtro removido ou uma busca que pule `sections` muda o resultado.
// A rota digitada passa pelo RequirePermission do Layout (permissão do item) E pelo da página.
const SETTINGS_EXPECTED = {
  ADMIN: { menu: true, opens: true, sections: ['geral', 'curral', 'comercial', 'seguranca', 'relatorios', 'dados'] },
  GESTOR: { menu: true, opens: true, sections: ['relatorios'] },
  OPERADOR: { menu: false, opens: false, sections: [] },
  CONSULTA: { menu: false, opens: false, sections: [] },
};
function layoutDecisions(layout) {
  const navItems = layout.match(/const NAV_ITEMS = (\[[\s\S]*?\n\]);/)?.[1];
  const body = layout.match(/export default function Layout\(\{ children, currentPageName \}\) \{\n([\s\S]*?)\n {2}return \(/)?.[1];
  const shellItems = layout.match(/<ModeloBase1AppShell navItems=\{(\w+)\}/)?.[1];
  assert.ok(navItems && body && shellItems, 'Layout: NAV_ITEMS, corpo do Layout e navItems do shell encontrados');
  assert.match(layout, /<RequirePermission permission=\{current\?\.permission\}>\{children\}<\/RequirePermission>/, 'Layout guarda a rota com a permissão do item atual');
  const icons = [...new Set([...navItems.matchAll(/Icon: (\w+)/g)].map((m) => m[1]))];
  const run = new Function('useAuth', 'currentPageName', ...icons, `const NAV_ITEMS = ${navItems};\n${body}\nreturn { shown: ${shellItems}, current };`);
  return (role) => run(() => ({ can: (action) => can(role, action) }), 'Configuracoes', ...icons.map(() => null));
}
function pageDecisions(page) {
  const literal = page.match(/const SECTIONS = (\[[\s\S]*?\n\]);/)?.[1];
  const sectionsExpr = page.match(/const sections = useMemo\(\(\) => (.+), \[auth\]\);/)?.[1];
  const statements = ['canSeeData', 'sectionById', 'hasSection'].map((name) => page.match(new RegExp(`const ${name} = (.+);\\n`))?.[0]);
  assert.ok(literal && sectionsExpr && statements.every(Boolean), 'Configurações: SECTIONS, sections, canSeeData, sectionById e hasSection encontrados');
  // SECTIONS só chega à tela pelo filtro de permissão: declaração, ALL_FIELDS (rótulos) e o filtro.
  assert.equal(page.match(/\bSECTIONS\b/g).length, 3, 'SECTIONS usado só na declaração, em ALL_FIELDS e no filtro por can()');
  assert.match(page, /const renderSection = \(id\) => \{\n\s*const section = sectionById\(id\);\n\s*if \(!section\) return null;/, 'renderSection não desenha seção fora de sectionById');
  assert.equal(page.match(/<FormCard\b/g).length, 2, 'cartões só via renderSection e o cartão Dados');
  // Linhas de cartões do JSX: condição, seções desenhadas e o cartão Dados.
  const rows = [...page.matchAll(/\{(hasSection\([^)]*\)|canSeeData) \? \(\s*<div className="emp-form-cards-row">([\s\S]*?)<\/div>\s*\) : null\}/g)]
    .map((m) => ({ condition: m[1], ids: [...m[2].matchAll(/renderSection\('(\w+)'\)/g)].map((r) => r[1]), data: /<FormCard title="Dados"/.test(m[2]) }));
  assert.equal(rows.reduce((total, row) => total + row.ids.length, 0), (page.match(/\{renderSection\('/g) || []).length, 'toda renderSection está numa linha condicionada');
  assert.equal(rows.filter((row) => row.data).length, 1, 'cartão Dados numa linha condicionada');
  const run = new Function('SECTIONS', 'auth', 'useMemo', `const sections = useMemo(() => ${sectionsExpr}, [auth]);\n${statements.join('')}return { sectionById, on: [${rows.map((row) => row.condition).join(', ')}] };`);
  const all = new Function(`return ${literal};`)();
  assert.deepEqual(all.map((section) => section.id), ['geral', 'curral', 'comercial', 'seguranca', 'relatorios'], 'Configurações: cinco seções');
  return (role) => {
    const { sectionById, on } = run(all, { can: (action) => can(role, action) }, (fn) => fn());
    return { sectionById, rows: rows.map((row, index) => ({ ...row, on: Boolean(on[index]) })) };
  };
}
function settingsAccess(s) {
  const guard = s.settings.match(/export default function Configuracoes\(\) \{\s*return \(\s*<RequirePermission permission="([\w.]+)">/)?.[1];
  assert.ok(guard, 'Configurações: RequirePermission na exportação da página');
  const layoutFor = layoutDecisions(s.layout);
  const pageFor = pageDecisions(s.settings);
  return Object.fromEntries(ROLES.map((role) => {
    const { shown, current } = layoutFor(role);
    const opens = (!current?.permission || can(role, current.permission)) && can(role, guard);
    const page = pageFor(role);
    const visibleRows = opens ? page.rows.filter((row) => row.on) : [];
    const drawn = visibleRows.map((row) => [...row.ids.filter((id) => page.sectionById(id)), ...(row.data ? ['dados'] : [])]);
    assert.ok(drawn.every((cards) => cards.length), `${role}: nenhuma linha de cartões vazia`);
    return [role, {
      menu: shown.some((item) => item.id === 'pec-configuracoes'),
      opens,
      sections: drawn.flat().sort((a, b) => SETTINGS_EXPECTED.ADMIN.sections.indexOf(a) - SETTINGS_EXPECTED.ADMIN.sections.indexOf(b)),
    }];
  }));
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
  assert.match(s.settings, /title: 'Relatórios',\s*permission: 'settings\.reports'/, 'seção Relatórios marcada com settings.reports (E1C)');
  assert.match(s.settings, /SECTIONS\.filter\(\(section\) => auth\?\.can\?\.\(section\.permission\)\)/, 'seções filtradas por can()');
  assert.match(s.layout, /id: "pec-configuracoes",[^}]*?permission: "settings\.operational"/, 'menu Configurações com a mesma permissão da página (ADMIN e GESTOR)');
  assert.deepEqual(settingsAccess(s), SETTINGS_EXPECTED, 'Configurações por papel: menu, rota e seções');
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
  layout: read('src/Layout.jsx'),
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
  // E1C: cada mutação muda o que um papel vê em Configurações e deve ser detectada.
  ['menu Configurações só ADMIN (como antes da E1C)', mutated('layout', 'url: "Configuracoes",\n    Icon: Settings,\n    group: "sistema",\n    mobile: false,\n    permission: "settings.operational"', 'url: "Configuracoes",\n    Icon: Settings,\n    group: "sistema",\n    mobile: false,\n    permission: "settings.manage"')],
  ['menu Configurações para OPERADOR/CONSULTA', mutated('layout', 'url: "Configuracoes",\n    Icon: Settings,\n    group: "sistema",\n    mobile: false,\n    permission: "settings.operational"', 'url: "Configuracoes",\n    Icon: Settings,\n    group: "sistema",\n    mobile: false,\n    permission: "reports.read"')],
  ['Relatórios só ADMIN', mutated('settings', "title: 'Relatórios',\n    permission: 'settings.reports'", "title: 'Relatórios',\n    permission: 'settings.manage'")],
  ['Geral visível ao GESTOR', mutated('settings', "title: 'Geral',\n    permission: 'settings.manage'", "title: 'Geral',\n    permission: 'settings.operational'")],
  ['Curral visível ao GESTOR', mutated('settings', "title: 'Curral',\n    permission: 'settings.manage'", "title: 'Curral',\n    permission: 'settings.reports'")],
  ['Comercial visível ao GESTOR', mutated('settings', "title: 'Comercial',\n    permission: 'settings.manage'", "title: 'Comercial',\n    permission: 'settings.operational'")],
  ['Segurança visível ao GESTOR', mutated('settings', "title: 'Segurança',\n    permission: 'settings.auth'", "title: 'Segurança',\n    permission: 'settings.reports'")],
  ['Dados visível ao GESTOR', mutated('settings', "const canSeeData = Boolean(auth?.can?.('settings.manage'));", "const canSeeData = Boolean(auth?.can?.('settings.operational'));")],
  ['Dados sem condição', mutated('settings', '{canSeeData ? (\n                            <div className="emp-form-cards-row">', '{true ? (\n                            <div className="emp-form-cards-row">')],
  // Revisão E1C: mutações que o gate deixava passar (a simulação só olhava as permissões) — cada
  // uma muda o que um papel vê na tela real (conferido por render SSR na revisão).
  ['sectionById sem o filtro (GESTOR vê Geral/Curral/Comercial/Segurança)', mutated('settings', 'const sectionById = (id) => sections.find(', 'const sectionById = (id) => SECTIONS.find(')],
  ['renderSection cai em SECTIONS', mutated('settings', 'const section = sectionById(id);', 'const section = sectionById(id) || SECTIONS.find((item) => item.id === id);')],
  ['campos de todas as seções no GESTOR', mutated('settings', 'const fields = useMemo(() => sections.flatMap(', 'const fields = useMemo(() => SECTIONS.flatMap(')],
  ['linhas vazias para o GESTOR (hasSection sempre verdadeiro)', mutated('settings', 'const hasSection = (...ids) => ids.some((id) => sectionById(id));', 'const hasSection = () => true;')],
  ['cartão fixo fora das seções', mutated('settings', "{renderSection('relatorios')}", "{renderSection('relatorios')}<FormCard title=\"Geral\" />")],
  ['menu sem filtro de permissão (OPERADOR/CONSULTA veem Configurações)', mutated('layout', 'const visibleItems = NAV_ITEMS.filter((item) => !item.permission || auth?.can(item.permission));', 'const visibleItems = NAV_ITEMS;')],
  ['shell recebe NAV_ITEMS sem filtro', mutated('layout', '<ModeloBase1AppShell navItems={visibleItems}', '<ModeloBase1AppShell navItems={NAV_ITEMS}')],
  ['rota sem a guarda do Layout', mutated('layout', '<RequirePermission permission={current?.permission}>{children}</RequirePermission>', '{children}')],
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
  settingsSplitPermissions: { operational: [A, G], reports: [A, G], auth: [A], manage: [A] },
  settingsByRole: SETTINGS_EXPECTED,
  usersPageDeniedTo: [G, O, C],
}, null, 2));
