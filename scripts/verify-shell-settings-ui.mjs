// Gate ui:shell-settings:verify — shell com menu do usuário, telas de acesso no
// ModeloBase1 e página Configurações (rev. 2: quatro chaves versionadas, seções por
// permissão, parser pt-BR do Lançamento). Verificação textual dos contratos de UI
// (doc 10 §3, doc 11 §3/§5/§8, doc 13 §2) + contrato do serviço que a página consome
// (CONFIG_INVALID com `field`, settings.operational × settings.reports × settings.auth). E1C:
// o GESTOR vê só a seção Relatórios (settings.reports); Geral/Curral/Comercial/Dados pedem
// settings.manage. Cada regra tem teste negativo: uma cópia mutada do fonte deve fazer a
// verificação falhar.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { APP_CONFIG_DEFAULTS, AUTH_POLICY_DEFAULTS, getAppConfig, getReportSettings, updateAppConfig } from '../src/modules/settings/application/appConfigService.js';
import { GMD_DIAS_MINIMOS_OPCOES, normalizeGmdDiasMinimos } from '../src/modules/weighing/domain/gmdQuality.js';
import { parseBrazilianNumber } from '../src/modules/weighing/domain/brazilianValues.js';

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
  assert.match(s.authCss, /\.auth-button \{[\s\S]{0,500}border-radius: var\(--mb1-radius-pill\)[\s\S]{0,240}background: var\(--mb1-green\); color: #111827/, 'botão primário em pílula verde com texto escuro');
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
  // E1C: GESTOR só com Relatórios; o resto da tela continua do ADMIN (settings.manage).
  for (const [id, title] of [['geral', 'Geral'], ['curral', 'Curral'], ['comercial', 'Comercial']]) {
    assert.match(page, new RegExp(`id: '${id}',\\s*title: '${title}',\\s*permission: 'settings\\.manage'`), `seção ${title} só com settings.manage (ADMIN)`);
  }
  assert.match(page, /id: 'relatorios',\s*title: 'Relatórios',\s*permission: 'settings\.reports'/, 'seção Relatórios com settings.reports (ADMIN e GESTOR)');
  assert.match(page, /const canSeeData = Boolean\(auth\?\.can\?\.\('settings\.manage'\)\);/, 'cartão Dados decide por settings.manage');
  assert.match(page, /\{canSeeData \? \(\s*<div className="emp-form-cards-row">\s*<FormCard title="Dados"/, 'cartão Dados só aparece com settings.manage');
  // F25/F26: Configurações gerais = Geral + Segurança; Curral/Comercial/Relatórios na Parametrização (ConfigSection).
  for (const ids of ["'geral', 'seguranca'"]) {
    assert.ok(page.includes(`{hasSection(${ids}) ? (`), `linha de cartões (${ids}) só existe com seção visível (sem linha vazia para o GESTOR)`);
  }
  assert.match(page, /export function ConfigSection\(\{ id \}\) \{\s*return <ConfiguracoesContent secoes=\{\[id\]\} embedded \/>;/, 'seção isolada reaproveita o mesmo formulário (mesmas chaves)');
  // Revisão E1C: a busca da seção e o teste da linha passam pela lista JÁ filtrada por can();
  // SECTIONS só aparece na declaração, em ALL_FIELDS (rótulos) e no filtro.
  assert.ok(page.includes('const sectionById = (id) => sections.find((section) => section.id === id);'), 'sectionById busca só nas seções permitidas');
  assert.ok(page.includes('const hasSection = (...ids) => ids.some((id) => sectionById(id));'), 'hasSection decide pela seção visível (sem linha vazia)');
  assert.equal(page.match(/\bSECTIONS\b/g).length, 3, 'SECTIONS não é lido fora do filtro por can()');
  assert.match(page, /const withRefs = fields\.some\(\(field\) => field\.kind === 'ref'\);/, 'cadastros de referência só carregados quando há select de cadastro visível');
  assert.equal((page.match(/withRefs \? \w+\.list\(\{ empresaId, incluirInativos: true \}\) : \[\],|withRefs \? listApartacoes\(\{ empresaId \}\) : \[\],/g) || []).length, 4, 'as quatro leituras de cadastro condicionadas a withRefs');
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
  for (const title of ['Geral', 'Curral', 'Comercial', 'Segurança', 'Relatórios', 'Dados']) {
    assert.ok(new RegExp(`title: '${title}'|title="${title}"`).test(page), `seção ${title}`);
  }
  // E1B: divisor da @ de peso vivo como lista fixa (30/15), explicando que não é a @ de carcaça.
  assert.match(page, /id: 'arroba_divisor',\s*label: 'Divisor da arroba \(kg de peso vivo\)',\s*kind: 'choice'/, 'divisor da @ como escolha fixa (não texto livre)');
  assert.match(page, /options: \[\{ value: '30', label: '30 — @ de peso vivo \(padrão\)' \}, \{ value: '15', label: '15' \}\]/, 'opções 30 (padrão) e 15');
  assert.ok(page.includes('Não muda a @ de carcaça do Comercial'), 'ajuda separa @ de peso vivo da @ de carcaça');
  // M1 (1.5.0): "Intervalo mínimo do GMD" (gmd_dias_minimos) na seção Relatórios — mesma permissão settings.reports do
  // divisor da @ (ADMIN e GESTOR), lista fixa 7/14/21/28 do contrato (gmdQuality), padrão 21 — e as duas linhas de
  // ajuda da §5.3 e da §1 (a do GMD com o N escolhido).
  const relatorios = page.slice(page.indexOf("id: 'relatorios',"), page.indexOf('const ALL_FIELDS'));
  assert.match(relatorios, /^id: 'relatorios',\s*title: 'Relatórios',\s*permission: 'settings\.reports'/, 'M1: o campo do GMD fica na seção Relatórios (settings.reports)');
  assert.match(relatorios, /id: 'gmd_dias_minimos',\s*label: 'Intervalo mínimo do GMD',\s*kind: 'choice'/, 'M1: intervalo mínimo do GMD como escolha fixa (não texto livre)');
  assert.match(relatorios, /options: GMD_DIAS_MINIMOS_OPCOES\.map\(/, 'M1: opções vêm do contrato (7, 14, 21, 28)');
  assert.match(relatorios, /defaultValue: String\(GMD_DIAS_MINIMOS_PADRAO\)/, 'M1: sem valor carregado, o select mostra o padrão 21 (não a primeira opção)');
  assert.match(page, /import \{ GMD_DIAS_MINIMOS_OPCOES, GMD_DIAS_MINIMOS_PADRAO, normalizeGmdDiasMinimos \} from '@\/modules\/weighing\/domain\/gmdQuality'/, 'M1: página usa o contrato congelado da qualidade do GMD');
  assert.ok(relatorios.includes("'@ de peso vivo é o peso do boi dividido por 30 (ou 15). @ de carcaça é o que o frigorífico paga: peso × rendimento ÷ 15.'"), 'M1 §5.3: linha de ajuda das duas arrobas');
  assert.ok(relatorios.includes('`GMD de intervalo menor que ${normalizeGmdDiasMinimos(form.gmd_dias_minimos)} dias aparece em cinza e não entra na média, porque o enchimento do boi atrapalha a conta.`'), 'M1: linha de ajuda do mínimo do GMD com o N escolhido');
  assert.match(page, /description=\{typeof section\.description === 'function' \? section\.description\(form\) : section\.description\}/, 'M1: a ajuda acompanha o valor escolhido no formulário');
  assert.ok(page.includes("value={form[field.id] || field.defaultValue || field.options[0].value}"), 'M1: escolha sem valor usa o padrão declarado do campo');
  assert.ok(readFileSync(new URL('../src/pages/Parametrizacao.jsx', import.meta.url), 'utf8').includes('<ConfigSection id="relatorios" />'), 'seção Relatórios (GMD e indicadores) renderizada na Parametrização');
  assert.ok(page.includes("{renderSection('geral')}") && page.includes("{renderSection('seguranca')}"), 'Configurações gerais renderizam Geral e Segurança');
  assert.match(page, /<form className="aux-modelobase1-form" onSubmit=\{save\}/, 'Enter salva (form onSubmit=save)');
  assert.match(page, /emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-form-action" onClick=\{save\}/, 'Salvar na barra de ações');
  assert.match(page, /aux-cancel-button aux-form-action" onClick=\{cancel\}/, 'Cancelar na barra de ações');
  assert.match(page, /function FormCard\(/, 'layout em FormCard (padrão registro do ModeloBase1)');
  assert.match(page, /mg-prototype-cards-layout/, 'cards no layout de cartões do modelo');
  assert.match(page, /cmd-select aux-model-cmd-select/, 'selects na estrutura cmd-select do modelo');
  // F19/F24: o cartão Dados leva à página própria de Backup e Restauração.
  assert.match(page, /createPageUrl\('BackupRestauracao'\)/, 'Dados navega para Backup e Restauração');
  assert.match(page, /onClick=\{goToMaintenance\} title="Abrir Backup e Restauração" aria-label="Abrir Backup e Restauração">\s*<HardDriveDownload[^>]*\/>/, 'botão de ícone "Abrir Backup e Restauração" (título e rótulo acessível)');
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
  ['Configurações sem navegar para Backup e Restauração', mutated('settings', "createPageUrl('BackupRestauracao')", "createPageUrl('Outra')")],
  ['Configurações sem a seção Segurança', mutated('settings', "{renderSection('seguranca')}", '')],
  ['divisor da @ como texto livre', mutated('settings', "kind: 'choice',", "kind: 'integer',")],
  ['Relatórios sem settings.reports (GESTOR sem a seção)', mutated('settings', "permission: 'settings.reports'", "permission: 'settings.manage'")],
  ['Geral visível ao GESTOR', mutated('settings', "title: 'Geral',\n    permission: 'settings.manage'", "title: 'Geral',\n    permission: 'settings.operational'")],
  ['Comercial visível ao GESTOR', mutated('settings', "title: 'Comercial',\n    permission: 'settings.manage'", "title: 'Comercial',\n    permission: 'settings.operational'")],
  ['Dados visível a todos', mutated('settings', "const canSeeData = Boolean(auth?.can?.('settings.manage'));", 'const canSeeData = true;')],
  ['linha vazia para o GESTOR', mutated('settings', "{hasSection('geral', 'seguranca') ? (", '{true ? (')],
  // Revisão E1C: estas duas passavam no gate e mudam a tela do GESTOR (seções de ADMIN à mostra ou
  // linhas vazias), conferido por render SSR.
  ['sectionById sem o filtro (GESTOR vê as seções do ADMIN)', mutated('settings', 'const sectionById = (id) => sections.find(', 'const sectionById = (id) => SECTIONS.find(')],
  ['hasSection sempre verdadeiro (linhas vazias no GESTOR)', mutated('settings', 'const hasSection = (...ids) => ids.some((id) => sectionById(id));', 'const hasSection = () => true;')],
  ['cadastros lidos sem withRefs', mutated('settings', 'withRefs ? brandService.list({ empresaId, incluirInativos: true }) : [],', 'brandService.list({ empresaId, incluirInativos: true }),')],
  // M1: o intervalo mínimo do GMD.
  ['M1: sem o campo do GMD', mutated('settings', "id: 'gmd_dias_minimos',", "id: 'gmd_minimo',")],
  ['M1: GMD como texto livre', mutated('settings', "label: 'Intervalo mínimo do GMD',\n        kind: 'choice',", "label: 'Intervalo mínimo do GMD',\n        kind: 'integer',")],
  ['M1: opções do GMD fora do contrato', mutated('settings', 'options: GMD_DIAS_MINIMOS_OPCOES.map(', 'options: [7, 14].map(')],
  ['M1: select do GMD abre na primeira opção (7)', mutated('settings', 'value={form[field.id] || field.defaultValue || field.options[0].value}', 'value={form[field.id] || field.options[0].value}')],
  ['M1: sem a linha de ajuda das duas arrobas', mutated('settings', "'@ de peso vivo é o peso do boi dividido por 30 (ou 15).", "'@ de peso vivo ÷ 30.")],
  ['M1: ajuda do GMD com o N fixo', mutated('settings', '${normalizeGmdDiasMinimos(form.gmd_dias_minimos)} dias aparece', '21 dias aparece')],
  ['M1: ajuda que não acompanha o formulário', mutated('settings', "section.description(form) : section.description", "'' : section.description")],
];
for (const [name, mutatedSources] of negatives) {
  assert.throws(() => runAll(mutatedSources), `mutação deveria falhar: ${name}`);
}

// ---------------------------------------------------------------------------
// 5b. E1C: toPatch da página executado de verdade (trecho extraído do fonte). Campo opcional
//     em branco (rendimento padrão) vira null e não trava o Salvar; campo obrigatório em branco
//     e texto inválido continuam recusados apontando o campo. Negativo: sem o ramo opcional o
//     rendimento em branco volta a travar.
// ---------------------------------------------------------------------------
function loadToPatch(page) {
  const start = page.indexOf('function invalid(');
  const end = page.indexOf('const labelOf');
  assert.ok(start > 0 && end > start, 'trecho invalid/toPatch encontrado na página');
  return new Function('NONE', 'parseDecimal', `${page.slice(start, end)}\nreturn toPatch;`)('__nenhuma__', parseBrazilianNumber);
}
const RENDIMENTO = { id: 'rendimento_padrao', label: 'Rendimento de carcaça padrão (%)', kind: 'decimal', optional: true };
const FAIXA_MIN = { id: 'faixa_peso_min', label: 'Peso mínimo aceito (kg)', kind: 'decimal' };
assert.match(sources.settings, /\{ id: 'rendimento_padrao', label: 'Rendimento de carcaça padrão \(%\)', kind: 'decimal', optional: true,/, 'rendimento padrão marcado como opcional na página');
function checkToPatch(toPatch) {
  const config = { rendimento_padrao: null, faixa_peso_min: 20 };
  assert.deepEqual(toPatch({ rendimento_padrao: '', faixa_peso_min: '20' }, config, [RENDIMENTO, FAIXA_MIN]), {}, 'rendimento em branco sem mudança: nada a gravar (não trava o Salvar)');
  assert.deepEqual(toPatch({ rendimento_padrao: '  ', faixa_peso_min: '25' }, config, [RENDIMENTO, FAIXA_MIN]), { faixa_peso_min: 25 }, 'outra seção salva com o rendimento em branco');
  assert.deepEqual(toPatch({ rendimento_padrao: '' }, { rendimento_padrao: 52.5 }, [RENDIMENTO]), { rendimento_padrao: null }, 'apagar o rendimento grava null (sem padrão)');
  assert.deepEqual(toPatch({ rendimento_padrao: '52,5' }, config, [RENDIMENTO]), { rendimento_padrao: 52.5 }, 'rendimento 52,5 em pt-BR');
  assert.throws(() => toPatch({ faixa_peso_min: '' }, config, [FAIXA_MIN]), (err) => err.code === 'CONFIG_INVALID' && err.field === 'faixa_peso_min', 'NEGATIVO: campo obrigatório em branco recusado');
  assert.throws(() => toPatch({ rendimento_padrao: 'abc' }, config, [RENDIMENTO]), (err) => err.code === 'CONFIG_INVALID' && err.field === 'rendimento_padrao', 'NEGATIVO: texto inválido no opcional recusado');
}
checkToPatch(loadToPatch(sources.settings));

// ---------------------------------------------------------------------------
// 5c. M1: a linha de ajuda do GMD (função da seção, extraída do fonte) segue o valor escolhido — sem valor ou
//     inválido, 21 (contrato) —, e o toPatch da página grava o número escolhido e recusa valor fora da lista.
//     Negativo: com o N fixo a ajuda não acompanha a escolha de 28.
// ---------------------------------------------------------------------------
function loadRelatoriosDescription(page) {
  const start = page.indexOf('description: (form) => [');
  const end = page.indexOf('\n    ],', start);
  assert.ok(start > 0 && end > start, 'linhas de ajuda da seção Relatórios encontradas');
  return new Function('normalizeGmdDiasMinimos', `return ${page.slice(start + 'description: '.length, end)}\n];`)(normalizeGmdDiasMinimos);
}
function checkGmdHelp(descricao) {
  assert.equal(descricao({ gmd_dias_minimos: '21' })[0], '@ de peso vivo é o peso do boi dividido por 30 (ou 15). @ de carcaça é o que o frigorífico paga: peso × rendimento ÷ 15.', 'M1 §5.3: linha das duas arrobas');
  assert.equal(descricao({ gmd_dias_minimos: '28' })[1], 'GMD de intervalo menor que 28 dias aparece em cinza e não entra na média, porque o enchimento do boi atrapalha a conta.', 'M1: a ajuda mostra o mínimo escolhido (28)');
  assert.match(descricao({ gmd_dias_minimos: '7' })[1], /menor que 7 dias/, 'M1: 7 dias');
  assert.match(descricao({})[1], /menor que 21 dias/, 'M1: sem valor → 21');
  assert.match(descricao({ gmd_dias_minimos: '10' })[1], /menor que 21 dias/, 'M1: valor fora da lista → 21');
}
checkGmdHelp(loadRelatoriosDescription(sources.settings));
assert.throws(() => checkGmdHelp(loadRelatoriosDescription(sources.settings.replace('${normalizeGmdDiasMinimos(form.gmd_dias_minimos)} dias aparece', '21 dias aparece'))), 'mutação deveria falhar: ajuda do GMD com N fixo');
{
  const toPatch = loadToPatch(sources.settings);
  const GMD_FIELD = { id: 'gmd_dias_minimos', label: 'Intervalo mínimo do GMD', kind: 'choice', options: GMD_DIAS_MINIMOS_OPCOES.map((dias) => ({ value: String(dias), label: `${dias} dias` })) };
  assert.deepEqual(toPatch({ gmd_dias_minimos: '28' }, { gmd_dias_minimos: 21 }, [GMD_FIELD]), { gmd_dias_minimos: 28 }, 'M1: 28 escolhido vira o número 28 no patch');
  assert.deepEqual(toPatch({ gmd_dias_minimos: '21' }, { gmd_dias_minimos: 21 }, [GMD_FIELD]), {}, 'M1: sem mudança, nada a gravar');
  assert.throws(() => toPatch({ gmd_dias_minimos: '10' }, { gmd_dias_minimos: 21 }, [GMD_FIELD]), (err) => err.code === 'CONFIG_INVALID' && err.field === 'gmd_dias_minimos', 'NEGATIVO M1: valor fora da lista recusado apontando o campo');
}
const OPTIONAL_BRANCH = "} else if (field.optional && String(raw ?? '').trim() === '') {";
assert.ok(sources.settings.includes(OPTIONAL_BRANCH), 'ramo do campo opcional presente em toPatch');
assert.throws(() => checkToPatch(loadToPatch(sources.settings.replace(OPTIONAL_BRANCH, '} else if (false) {'))), 'mutação deveria falhar: opcional em branco recusado de novo');

// ---------------------------------------------------------------------------
// 6. Contrato do serviço consumido pela página: erro de validação identifica o campo,
//    ator sem settings.operational é recusado, GESTOR não grava auth-policy, e uma
//    gravação válida persiste nas quatro chaves. E1C: o divisor da @ (report-settings) exige
//    settings.reports — GESTOR grava, OPERADOR/CONSULTA/sem ator não.
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
// E1C (resposta 10): "o resto de Configurações continua ADMIN" também no serviço — o GESTOR só grava o
// divisor da @ (report-settings, settings.reports); os grupos operacionais pedem settings.manage.
const gestorOperational = await updateAppConfig({ id: 'g', nome: 'Gestor', role: 'GESTOR' }, { faixa_peso_min: 25 }).then(() => null, (err) => err);
assert.equal(gestorOperational?.code, 'AUTH_FORBIDDEN', 'GESTOR não grava grupos operacionais nem pelo serviço');
assert.equal((await updateAppConfig({ id: 'g', nome: 'Gestor', role: 'GESTOR' }, { arroba_divisor: 15 })).arroba_divisor, 15, 'GESTOR grava o divisor da @');
await updateAppConfig(admin, { arroba_divisor: 30 });
const saved = await updateAppConfig(admin, { intervalo_pesagem_dias: 45, exigir_documento_venda: true, inactivity_lock_minutes: 0, lock_minutes: 0.5 });
assert.equal(saved.intervalo_pesagem_dias, 45);
assert.equal(saved.exigir_documento_venda, true);
assert.equal(saved.inactivity_lock_minutes, 0, '0 desliga o bloqueio (aceito)');
assert.equal(saved.lock_minutes, 0.5, 'fração de minuto aceita (0,5 na tela)');
assert.equal(saved.rendimento_padrao_origem, 'PADRAO_EMPRESA', 'origem do rendimento continua explícita');
assert.equal((await getAppConfig()).intervalo_pesagem_dias, 45, 'gravação persistida');
// E1B: divisor da @ aceita 15, recusa 20 apontando o campo que a página foca.
const divisorInvalido = await updateAppConfig(admin, { arroba_divisor: 20 }).then(() => null, (err) => err);
assert.equal(divisorInvalido?.code, 'CONFIG_INVALID', 'divisor 20 recusado');
assert.equal(divisorInvalido?.field, 'arroba_divisor', 'erro identifica o campo do divisor');
for (const actor of [{ id: 'op', nome: 'Op', role: 'OPERADOR' }, { id: 'c', nome: 'Consulta', role: 'CONSULTA' }, null]) {
  const recusa = await updateAppConfig(actor, { arroba_divisor: 15 }).then(() => null, (err) => err);
  assert.equal(recusa?.code, 'AUTH_FORBIDDEN', `${actor?.role ?? 'sem ator'} não grava o divisor da @`);
  assert.equal(recusa?.action, 'settings.reports', 'recusa aponta settings.reports');
}
assert.equal((await getAppConfig()).arroba_divisor, 30, 'recusas não gravaram o divisor');
assert.equal((await updateAppConfig({ id: 'g', nome: 'Gestor', role: 'GESTOR' }, { arroba_divisor: 15 })).arroba_divisor, 15, 'GESTOR grava o divisor (settings.reports)');
assert.equal((await getAppConfig()).arroba_divisor, 15, 'divisor 15 persistido');
// M1: gmd_dias_minimos no mesmo grupo e com a mesma permissão do divisor (settings.reports): GESTOR grava;
// OPERADOR, CONSULTA e sem ator não. O valor gravado é o que o Lançamento e os relatórios leem (getReportSettings).
const gestor = { id: 'g', nome: 'Gestor', role: 'GESTOR' };
assert.equal((await getReportSettings()).gmd_dias_minimos, 21, 'M1: padrão 21');
assert.equal((await updateAppConfig(gestor, { gmd_dias_minimos: 28 })).gmd_dias_minimos, 28, 'M1: GESTOR grava o intervalo mínimo do GMD');
for (const actor of [{ id: 'op', nome: 'Op', role: 'OPERADOR' }, { id: 'c', nome: 'Consulta', role: 'CONSULTA' }, null]) {
  const recusa = await updateAppConfig(actor, { gmd_dias_minimos: 7 }).then(() => null, (err) => err);
  assert.equal(recusa?.code, 'AUTH_FORBIDDEN', `M1: ${actor?.role ?? 'sem ator'} não grava o intervalo mínimo do GMD`);
  assert.equal(recusa?.action, 'settings.reports', 'M1: recusa aponta settings.reports');
}
assert.equal((await getReportSettings()).gmd_dias_minimos, 28, 'M1: 28 persistido (recusas não gravaram)');
assert.equal((await updateAppConfig(gestor, { arroba_divisor: 30 })).gmd_dias_minimos, 28, 'M1: trocar o divisor não derruba o mínimo do GMD');
assert.equal((await getReportSettings()).arroba_divisor, 30, 'M1: e o divisor trocou');
await deleteDbForTests();

console.log('OK verify-shell-settings-ui');
console.log(JSON.stringify({
  shellUserMenuDesktopAndMobile: true,
  shellDoesNotFilterPermissions: true,
  userMenuActions: ['Bloquear', 'Trocar senha', 'Trocar usuário', 'Sair'],
  authScreensModeloBase1: true,
  authScreensNoDataBeforeLogin: true,
  settingsPermissions: { page: 'settings.operational', reportsSection: 'settings.reports', adminSections: 'settings.manage', securitySection: 'settings.auth' },
  settingsUsesBrazilianParser: true,
  settingsFieldsCovered: Object.keys(APP_CONFIG_DEFAULTS).filter((key) => key !== 'rendimento_padrao_origem').length,
  settingsEnterSaves: true,
  negativeMutations: negatives.length,
  serviceContract: { configInvalidHasField: true, operatorForbidden: true, gestorForbiddenAuthPolicy: true, gestorWritesArrobaDivisor: true, persisted: true },
  gmdDiasMinimos: { field: 'gmd_dias_minimos', section: 'relatorios', permission: 'settings.reports', options: [...GMD_DIAS_MINIMOS_OPCOES], default: 21, helpFollowsChoice: true, gestorWrites: true },
}, null, 2));
