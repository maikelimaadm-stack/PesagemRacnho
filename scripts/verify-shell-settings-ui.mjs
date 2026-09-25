// Gate ui:shell-settings:verify — shell com menu do usuário, telas de acesso no
// ModeloBase1 e página Configurações (rev. 2: quatro chaves versionadas, seções por
// permissão, parser pt-BR do Lançamento). Verificação textual dos contratos de UI
// (doc 10 §3, doc 11 §3/§5/§8, doc 13 §2) + contrato do serviço que a página consome
// (CONFIG_INVALID com `field`, settings.operational × settings.auth). Cada regra tem teste
// negativo: uma cópia mutada do fonte deve fazer a verificação falhar.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { APP_CONFIG_DEFAULTS, AUTH_POLICY_DEFAULTS, getAppConfig, updateAppConfig } from '../src/modules/settings/application/appConfigService.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const FILES = {
  shell: 'src/components/modelobase1/layout/ModeloBase1AppShell.jsx',
  shellCss: 'src/components/modelobase1/layout/modelo-base1-shell.css',
  userMenu: 'src/components/auth/UserMenu.jsx',
  authShell: 'src/components/auth/AuthScreenShell.jsx',
  authCss: 'src/components/auth/auth-screens.css',
  login: 'src/components/auth/LoginScreen.jsx',
  lock: 'src/components/auth/LockScreen.jsx',
  setup: 'src/components/auth/FirstRunAdminSetupScreen.jsx',
  recover: 'src/components/auth/RecuperarSenhaScreen.jsx',
  change: 'src/components/auth/TrocarSenhaScreen.jsx',
  settings: 'src/pages/Configuracoes.jsx',
};
for (const rel of Object.values(FILES)) assert.ok(existsSync(join(root, rel)), `arquivo existe: ${rel}`);
const sources = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]));

// ---------------------------------------------------------------------------
// 1. Shell: UserMenu na topbar do desktop e no menu lateral; sem filtrar permissões.
// ---------------------------------------------------------------------------
function checkShell(s) {
  assert.match(s.shell, /import UserMenu from "@\/components\/auth\/UserMenu"/, 'shell importa o UserMenu');
  assert.match(s.shell, /<div className="mb1-desktop-topbar__status">\s*<UserMenu \/>/, 'UserMenu é o primeiro item do status da topbar (desktop)');
  assert.match(s.shell, /<ShellNav items=\{navItems\}[\s\S]{0,200}\bmobile\b[\s\S]{0,80}\/>\s*<UserMenu variant="panel" \/>/, 'no celular o UserMenu fica dentro do menu lateral, após a navegação');
  assert.ok(!/\.filter\([^\n]*(permission|\bcan\()/.test(s.shell), 'shell não filtra itens por permissão (isso é do Layout)');
  assert.ok(!/accessPolicy|useAuth/.test(s.shell), 'shell não consulta a política de acesso');
  assert.match(s.shell, /navItems={navItems}|items={navItems}/, 'shell renderiza os itens recebidos do Layout');
  assert.match(s.shell, /APP_VERSION/, 'shell expõe a versão do app na topbar (título do selo PI)');
  assert.match(s.shell, /className="mb1-shell-version-badge"[^>]*>v\{APP_VERSION\}<\/span>/, 'desktop mostra a versão instalada como texto permanente');
  assert.match(s.shell, /Local · v\{APP_VERSION\}/, 'celular mostra a versão instalada como texto permanente');
  assert.match(s.shellCss, /\.mb1-shell-version-badge\s*\{/, 'selo de versão visível tem estilo próprio');
  assert.match(s.shellCss, /\.mb1-shell-topbar-button\.mb1-user-menu__trigger/, 'CSS do gatilho do menu do usuário na topbar');
  assert.match(s.shellCss, /html\.dark \[data-radix-menu-content\]\.mb1-user-menu/, 'menu do usuário tem tema escuro (portal fora do .mb1-scope)');
  assert.match(s.shellCss, /\.mb1-user-panel__actions/, 'painel do usuário do menu lateral (celular) estilizado');
  assert.match(s.shellCss, /@media \(max-width: 1100px\)[\s\S]{0,200}\.mb1-user-menu__role \{ display: none; \}/, 'perfil do gatilho some em larguras menores para não poluir a topbar');
}

// ---------------------------------------------------------------------------
// 2. UserMenu: usuário, papel, versão, Bloquear, Trocar senha, Trocar usuário, Sair.
// ---------------------------------------------------------------------------
function checkUserMenu(s) {
  assert.match(s.userMenu, /if \(!auth\?\.user\) return null;/, 'UserMenu devolve null sem sessão');
  for (const label of ['>Bloquear<', '>Trocar senha<', '>Trocar usuário<', '>Sair<', 'APP_VERSION', 'roleLabel(user.role)']) {
    assert.ok(s.userMenu.includes(label), `UserMenu contém ${label}`);
  }
  assert.ok(!s.userMenu.includes('Alterar minha senha'), 'rótulo da rev. 1 removido');
  assert.match(s.userMenu, /<KeyRound aria-hidden="true" \/>Trocar senha<\/button>/, 'painel (celular) também usa "Trocar senha"');
  assert.match(s.userMenu, /variant === 'panel'/, 'UserMenu oferece a variante painel (menu lateral do celular)');
  assert.match(s.userMenu, /onSelect=\{\(\) => logout\(\)\}>[\s\S]{0,80}Sair<\/DropdownMenuItem>/, 'item Sair do menu suspenso chama logout');
  assert.match(s.userMenu, /onClick=\{\(\) => logout\(\)\}>[\s\S]{0,80}Sair<\/button>/, 'botão Sair do painel (celular) chama logout');
  assert.match(s.userMenu, /onClick=\{\(\) => lock\(\)\}>[\s\S]{0,80}Bloquear<\/button>/, 'botão Bloquear do painel (celular) chama lock');
  assert.match(s.userMenu, /className="mb1-shell-topbar-button mb1-user-menu__trigger"/, 'gatilho usa o botão padrão da topbar');
  assert.match(s.userMenu, /onSelect=\{\(\) => lock\(\)\}[\s\S]*onSelect=\{\(\) => changePassword\(\)\}[\s\S]*onSelect=\{\(\) => switchUser\(\)\}[\s\S]*onSelect=\{\(\) => logout\(\)\}/, 'menu chama lock/changePassword/switchUser/logout do contexto');
  assert.ok(!/senha_hash|password_hash|password_salt|console\.(log|info|debug)/.test(s.userMenu), 'UserMenu não referencia hash nem loga');
}

// ---------------------------------------------------------------------------
// 3. Telas de acesso: moldura, foco no primeiro campo, Enter envia, faixa de erro,
//    versão discreta; nada do banco antes de autenticar.
// ---------------------------------------------------------------------------
function checkAuthScreens(s) {
  assert.match(s.authShell, /Versão \{APP_VERSION\}/, 'moldura mostra a versão discreta');
  assert.match(s.authShell, /className="auth-banner auth-banner--error" role="alert"/, 'erro em faixa com role=alert');
  assert.match(s.authShell, /className="auth-banner auth-banner--info" role="status"/, 'informação (bloqueio temporário) em faixa com role=status');
  assert.match(s.authShell, /ModeloBase1Tokens enterpriseScope=\{false\} className="auth-root"/, 'telas de acesso usam os tokens do ModeloBase1');
  assert.match(s.authCss, /\.auth-field input \{[\s\S]{0,400}height: var\(--mb1-field-height\)/, 'campos das telas de acesso têm a altura padrão do modelo');
  assert.match(s.authCss, /\.auth-button \{[\s\S]{0,400}border-radius: var\(--mb1-radius-pill\)[\s\S]{0,200}background: var\(--mb1-green\); color: #fff/, 'botão primário em pílula verde com texto branco (tb-btn-green)');
  assert.match(s.authCss, /\.auth-banner--error \{/, 'faixa de erro estilizada');
  assert.match(s.authCss, /html\.dark \.auth-banner--error/, 'faixa de erro com contraste no tema escuro');
  for (const [key, firstField] of [['login', 'login-usuario'], ['lock', 'lock-senha'], ['setup', 'setup-nome'], ['recover', 'recuperar-login'], ['change', 'troca-atual']]) {
    const source = s[key];
    assert.match(source, new RegExp(`<AuthField id="${firstField}"[^>]*autoFocus`), `${key}: foco no primeiro campo (${firstField})`);
    assert.match(source, /<form className="auth-form" onSubmit=\{submit\}>/, `${key}: Enter envia (form onSubmit) com validação nativa dos campos`);
    assert.match(source, /<AuthError message=\{error\} \/>/, `${key}: erro em faixa`);
    assert.match(source, /<AuthScreenShell/, `${key}: usa a moldura comum`);
    assert.ok(!/storage\/|\/api\/db|weighing|catalog|apartacao|maintenance/.test(source), `${key}: não toca em dados do banco antes de autenticar`);
  }
  assert.match(s.login, /Login ou senha inválidos/, 'login mantém a mensagem genérica');
  assert.match(s.login, /<AuthInfo message=\{lockedUntil \? `Muitas tentativas incorretas/, 'login mostra a contagem regressiva em faixa informativa');
  assert.match(s.login, /autoCapitalize="none"/, 'campo de login não capitaliza automaticamente');
  assert.match(s.login, /Esqueci a senha do administrador/, 'login oferece a recuperação do administrador');
  assert.match(s.setup, /<RecoveryKeyReveal recoveryKey=\{recoveryKey\}/, 'configuração inicial exibe a Recovery Key uma única vez');
  assert.match(s.recover, /<RecoveryKeyReveal recoveryKey=\{newKey\}/, 'recuperação exibe a nova Recovery Key uma única vez');
  assert.match(s.lock, /roleLabel\(user\?\.role\)/, 'bloqueio mostra o papel pelo permissionService');
}

// ---------------------------------------------------------------------------
// 4. Configurações: settings.operational (+ seção Segurança só com settings.auth), serviços
//    corretos, todas as chaves dos quatro grupos, parser pt-BR do Lançamento, Salvar/Cancelar
//    na barra, Enter salva, Dados → Backup e Manutenção.
// ---------------------------------------------------------------------------
function checkSettings(s) {
  const page = s.settings;
  assert.match(page, /<RequirePermission permission="settings\.operational">/, 'Configurações protegida por settings.operational (ADMIN e GESTOR)');
  assert.match(page, /id: 'seguranca',\s*title: 'Segurança',\s*permission: 'settings\.auth'/, 'seção Segurança exige settings.auth (ADMIN)');
  assert.match(page, /SECTIONS\.filter\(\(section\) => auth\?\.can\?\.\(section\.permission\)\)/, 'seções filtradas por can() — sem if (role === …)');
  assert.match(page, /import \{ parseBrazilianNumber \} from '@\/modules\/weighing\/domain\/brazilianValues'/, 'usa o parser pt-BR do Lançamento');
  assert.match(page, /const parseDecimal = \(text\) => parseBrazilianNumber\(text\);/, 'parseDecimal delega ao parser pt-BR');
  assert.match(page, /new Intl\.NumberFormat\('pt-BR'/, 'formata de volta em pt-BR');
  for (const key of Object.keys(AUTH_POLICY_DEFAULTS)) assert.ok(page.includes(`id: '${key}'`), `campo de auth-policy presente: ${key}`);
  assert.ok(!page.includes('bloqueio_inatividade_minutos'), 'chave da rev. 1 não aparece');
  for (const text of ['→ Lançamento', 'Lançamento', 'Fechamento', 'padrão da empresa', 'relatórios de pesagens vencidas']) assert.ok(page.includes(text.replace('→ ', '')), `ajuda descreve o consumo real: ${text}`);
  assert.match(page, /import \{ DEFAULT_EMPRESA_ID, getAppConfig, updateAppConfig \} from '@\/modules\/settings\/application\/appConfigService'/, 'usa getAppConfig/updateAppConfig do appConfigService');
  assert.match(page, /updateAppConfig\(actor, patch, empresaId\)/, 'grava com o ator da sessão (o serviço valida settings.operational/settings.auth por grupo)');
  assert.match(page, /import \{ brandService, breedService, propertyService \} from '@\/modules\/catalog\/application\/index'/, 'selects de Geral vêm dos serviços de cadastro');
  assert.match(page, /brandService\.list\(/, 'marcas via brandService.list');
  assert.match(page, /breedService\.list\(/, 'raças via breedService.list');
  assert.match(page, /propertyService\.list\(/, 'propriedades via propertyService.list');
  assert.match(page, /import \{ listApartacoes \} from '@\/modules\/auxiliary\/application\/apartacaoService'/, 'apartação padrão via apartacaoService.listApartacoes');
  for (const key of Object.keys(APP_CONFIG_DEFAULTS)) {
    if (key === 'rendimento_padrao_origem') continue; // origem é fixa (PADRAO_EMPRESA) na configuração da empresa; explicada no texto de ajuda
    assert.ok(page.includes(`id: '${key}'`), `campo do contrato presente: ${key}`);
  }
  assert.match(page, /origem fica registrada como padrão da empresa/, 'rendimento padrão explicita a origem (ADR-025: nunca 50 % silencioso)');
  for (const title of ['Geral', 'Curral', 'Comercial', 'Segurança', 'Dados']) {
    assert.ok(new RegExp(`title: '${title}'|title="${title}"`).test(page), `seção ${title}`);
  }
  assert.match(page, /<form className="aux-modelobase1-form" onSubmit=\{save\}/, 'Enter salva (form onSubmit=save)');
  assert.match(page, /emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-form-action" onClick=\{save\}/, 'Salvar na barra de ações');
  assert.match(page, /aux-cancel-button aux-form-action" onClick=\{cancel\}/, 'Cancelar na barra de ações');
  assert.match(page, /function FormCard\(/, 'layout em FormCard (padrão registro do ModeloBase1)');
  assert.match(page, /mg-prototype-cards-layout/, 'cards no layout de cartões do modelo');
  assert.match(page, /cmd-select aux-model-cmd-select/, 'selects na estrutura cmd-select do modelo');
  assert.match(page, /createPageUrl\('ManutencaoSistema'\)/, 'Dados navega para Backup e Manutenção (deep link ?secao é da tela de manutenção)');
  assert.match(page, /onClick=\{goToMaintenance\}[^>]*>\s*<HardDriveDownload[^>]*\/>Abrir Backup e Manutenção/, 'botão "Abrir Backup e Manutenção"');
  assert.match(page, /err\?\.code === 'CONFIG_INVALID' && err\.field/, 'erro de validação do serviço aponta o campo');
  assert.match(page, /focusField\(err\.field\)/, 'campo inválido recebe o foco');
  assert.ok(!/console\.(log|info|debug)/.test(page), 'página sem console.log');
  assert.ok(!/rendimento_padrao_origem/.test(page.replace(/\/\/.*$/gm, '')), 'página não permite editar a origem do rendimento (fixa PADRAO_EMPRESA no serviço)');
}

function runAll(s) {
  checkShell(s);
  checkUserMenu(s);
  checkAuthScreens(s);
  checkSettings(s);
}
runAll(sources);

// ---------------------------------------------------------------------------
// 5. Testes negativos: fontes mutados devem falhar.
// ---------------------------------------------------------------------------
function mutated(key, from, to) {
  assert.ok(sources[key].includes(from), `mutação aplicável em ${key}: ${from.slice(0, 40)}`);
  return { ...sources, [key]: sources[key].replace(from, to) };
}
const negatives = [
  ['shell sem UserMenu na topbar', mutated('shell', '<UserMenu />\n', '')],
  ['shell sem UserMenu no menu lateral', mutated('shell', '<UserMenu variant="panel" />', '')],
  ['shell filtrando permissões por conta própria', mutated('shell', 'export default function ModeloBase1AppShell({ children, navItems, navGroups = DEFAULT_NAV_GROUPS }) {', 'export default function ModeloBase1AppShell({ children, navItems: rawItems, navGroups = DEFAULT_NAV_GROUPS }) {\n  const navItems = rawItems.filter((item) => !item.permission || can(item.permission));')],
  ['UserMenu sem Sair', mutated('userMenu', '>Sair</DropdownMenuItem>', '>Encerrar</DropdownMenuItem>')],
  ['UserMenu renderizando sem sessão', mutated('userMenu', 'if (!auth?.user) return null;', 'if (!auth) return null;')],
  ['login sem foco no primeiro campo', mutated('login', 'onChange={setLogin} autoFocus', 'onChange={setLogin}')],
  ['login sem Enter enviar', mutated('login', '<form className="auth-form" onSubmit={submit}>', '<div className="auth-form">')],
  ['login sem mensagem genérica', mutated('login', "'Login ou senha inválidos'", "'Usuário não encontrado'")],
  ['tela de acesso tocando no banco', mutated('lock', "import { useState } from 'react';", "import { useState } from 'react';\nimport storage from '@/storage/storageAdapter';")],
  ['moldura sem faixa de erro', mutated('authShell', 'className="auth-banner auth-banner--error" role="alert"', 'className="auth-error"')],
  ['Configurações com permissão errada', mutated('settings', 'permission="settings.operational"', 'permission="registry.read"')],
  ['Segurança sem settings.auth', mutated('settings', "permission: 'settings.auth'", "permission: 'settings.operational'")],
  ['Configurações com parser próprio', mutated('settings', 'const parseDecimal = (text) => parseBrazilianNumber(text);', 'const parseDecimal = (text) => Number(text);')],
  ['UserMenu com rótulo antigo', mutated('userMenu', '/>Trocar senha</DropdownMenuItem>', '/>Alterar minha senha</DropdownMenuItem>')],
  ['login sem recuperação', mutated('login', 'Esqueci a senha do administrador', 'Ajuda')],
  ['Configurações sem Enter salvar', mutated('settings', 'onSubmit={save}', 'onSubmit={(event) => event.preventDefault()}')],
  ['Configurações sem uma chave do contrato', mutated('settings', "{ id: 'inactivity_lock_minutes',", "{ id: 'bloqueio_inatividade',")],
  ['Configurações gravando sem ator', mutated('settings', 'updateAppConfig(actor, patch, empresaId)', 'updateAppConfig(null, patch, empresaId)')],
  ['Configurações sem seção Dados', mutated('settings', 'title="Dados"', 'title="Outros"')],
  ['Configurações sem navegar para Manutenção', mutated('settings', "createPageUrl('ManutencaoSistema')", "createPageUrl('Outra')")],
];
for (const [name, mutatedSources] of negatives) {
  assert.throws(() => runAll(mutatedSources), `mutação deveria falhar: ${name}`);
}

// ---------------------------------------------------------------------------
// 6. Contrato do serviço consumido pela página: erro de validação identifica o campo,
//    ator sem settings.operational é recusado, GESTOR não grava auth-policy, e uma
//    gravação válida persiste nas quatro chaves.
// ---------------------------------------------------------------------------
await deleteDbForTests();
await ensureStorageReady();
const admin = { id: 'admin-1', nome: 'Ana', role: 'ADMIN' };
const invalidRange = await updateAppConfig(admin, { faixa_peso_min: 900, faixa_peso_max: 800 }).then(() => null, (err) => err);
assert.equal(invalidRange?.code, 'CONFIG_INVALID', 'faixa invertida é recusada');
assert.equal(invalidRange?.field, 'faixa_peso_min', 'erro identifica o campo que a página foca');
const forbidden = await updateAppConfig({ id: 'op', nome: 'Op', role: 'OPERADOR' }, { intervalo_pesagem_dias: 45 }).then(() => null, (err) => err);
assert.equal(forbidden?.code, 'AUTH_FORBIDDEN', 'OPERADOR não grava configurações');
const gestorAuth = await updateAppConfig({ id: 'g', nome: 'Gestor', role: 'GESTOR' }, { inactivity_lock_minutes: 10 }).then(() => null, (err) => err);
assert.equal(gestorAuth?.code, 'AUTH_FORBIDDEN', 'GESTOR não grava a seção Segurança (auth-policy)');
assert.equal((await updateAppConfig({ id: 'g', nome: 'Gestor', role: 'GESTOR' }, { faixa_peso_min: 25 })).faixa_peso_min, 25, 'GESTOR grava seções operacionais');
const saved = await updateAppConfig(admin, { intervalo_pesagem_dias: 45, exigir_documento_venda: true, inactivity_lock_minutes: 0, lock_minutes: 0.5 });
assert.equal(saved.intervalo_pesagem_dias, 45);
assert.equal(saved.exigir_documento_venda, true);
assert.equal(saved.inactivity_lock_minutes, 0, '0 desliga o bloqueio (aceito)');
assert.equal(saved.lock_minutes, 0.5, 'fração de minuto aceita (0,5 na tela)');
assert.equal(saved.rendimento_padrao_origem, 'PADRAO_EMPRESA', 'origem do rendimento continua explícita');
assert.equal((await getAppConfig()).intervalo_pesagem_dias, 45, 'gravação persistida');
await deleteDbForTests();

console.log('OK verify-shell-settings-ui');
console.log(JSON.stringify({
  shellUserMenuDesktopAndMobile: true,
  shellDoesNotFilterPermissions: true,
  userMenuActions: ['Bloquear', 'Trocar senha', 'Trocar usuário', 'Sair'],
  authScreensModeloBase1: true,
  authScreensNoDataBeforeLogin: true,
  settingsPermissions: { page: 'settings.operational', securitySection: 'settings.auth' },
  settingsUsesBrazilianParser: true,
  settingsFieldsCovered: Object.keys(APP_CONFIG_DEFAULTS).filter((key) => key !== 'rendimento_padrao_origem').length,
  settingsEnterSaves: true,
  negativeMutations: negatives.length,
  serviceContract: { configInvalidHasField: true, operatorForbidden: true, gestorForbiddenAuthPolicy: true, persisted: true },
}, null, 2));
