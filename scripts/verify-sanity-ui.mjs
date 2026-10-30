// Gate sanity:ui:verify — telas de Sanidade (stores próprias da v8: programasSanidade,
// medicamentos, aplicacoesSanidade; nunca appSettings). Por inspeção de fonte:
//   1. rota única "Sanidade" em pages.config e UM item de menu com weighing.read;
//   2. a tela e seus componentes usam o sanityService (sem appSettings/registry legado/banco
//      direto) e só importam nomes que o serviço exporta;
//   3. gravação de programas/medicamentos condicionada a registry.write; registrar aplicação a
//      weighing.write; cancelar a weighing.edit (e decisões de UI pela matriz real de papéis);
//   4. Ficha do Animal lista as aplicações do animal (inclusive canceladas, marcadas), sem editar;
//   5. nenhuma referência às stores/campos de sanidade da v5;
//   6. modelo puro (colunas, formulários, filtros, busca de animal) coerente com a validação do
//      serviço; guia do usuário presente.
// Cada verificador de fonte tem caso negativo (fonte adulterada precisa falhar).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLES, can } from '../src/modules/auth/domain/permissionService.js';
import * as model from '../src/components/sanidade/sanidadeModel.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const listFiles = (dir) => readdirSync(join(root, dir), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? listFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
// Comentários citam decisões ("nunca appSettings"); as regras textuais olham só o código.
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
const checks = [];
const ok = (name) => checks.push(name);
const mustFail = (fn, what) => assert.throws(fn, assert.AssertionError, `NEGATIVO não detectado: ${what}`);
// Trecho ausente lança Error comum (não AssertionError): um negativo que não muta nada
// derruba o gate em vez de passar como "detectado".
const mutate = (source, from, to) => {
  if (!source.includes(from)) throw new Error(`mutação de teste: trecho não encontrado (${from})`);
  return source.replace(from, to);
};

const SERVICE_PATH = 'src/modules/sanity/application/sanityService.js';
const SERVICE_IMPORT = '@/modules/sanity/application/sanityService';
const PAGE = 'src/pages/Sanidade.jsx';
const FICHA = 'src/pages/FichaAnimal.jsx';
const COMPONENT_DIR = 'src/components/sanidade';
assert.ok(existsSync(join(root, PAGE)), 'src/pages/Sanidade.jsx existe');
assert.ok(existsSync(join(root, COMPONENT_DIR)), 'src/components/sanidade existe');
const uiFiles = [PAGE, ...listFiles(COMPONENT_DIR).filter((file) => /\.(jsx?|mjs)$/.test(file))];
const sources = Object.fromEntries([...uiFiles, FICHA, 'src/Layout.jsx', 'src/pages.config.js'].map((file) => [file, read(file)]));

// ---------------------------------------------------------------------------
// 1. Rota e menu únicos, com weighing.read.
// ---------------------------------------------------------------------------
function checkRoute(pagesConfig) {
  assert.equal((pagesConfig.match(/lazy\(\(\) => import\('\.\/pages\/Sanidade'\)\)/g) || []).length, 1, 'pages.config: um único import preguiçoso de ./pages/Sanidade');
  const routes = [...pagesConfig.matchAll(/"(\w*Sanidade\w*)":\s*(\w+),/g)].map((match) => `${match[1]}=${match[2]}`);
  assert.deepEqual(routes, ['Sanidade=Sanidade'], 'pages.config: uma única rota de sanidade ("Sanidade")');
  assert.ok(!/ConfiguracoesSanidade/.test(pagesConfig), 'pages.config: a tela legada em appSettings não volta');
}

function parseNavItems(layout) {
  const block = layout.match(/const NAV_ITEMS = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(block, 'Layout: NAV_ITEMS encontrado');
  const field = (src, key) => src.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1] ?? null;
  return (block.match(/\{[^{}]*\}/g) || []).map((src) => ({
    id: field(src, 'id'), title: field(src, 'title'), longTitle: field(src, 'longTitle'), url: field(src, 'url'), group: field(src, 'group'), permission: field(src, 'permission'),
  }));
}

function checkMenu(layout) {
  const items = parseNavItems(layout);
  assert.ok(items.length >= 10, 'Layout: itens de menu lidos');
  const sanity = items.filter((item) => /sanidade|sanit[aá]ri|health/i.test([item.id, item.title, item.longTitle, item.url].join(' ')));
  assert.equal(sanity.length, 1, 'Layout: exatamente um item de menu de Sanidade');
  const [item] = sanity;
  assert.equal(item.url, 'Sanidade', 'menu aponta para a rota Sanidade');
  assert.equal(item.title, 'Sanidade', 'rótulo do menu é "Sanidade"');
  assert.equal(item.permission, 'weighing.read', 'item de Sanidade exige weighing.read');
  assert.ok(['operacao', 'cadastros'].includes(item.group), `item de Sanidade no grupo Operação ou Cadastros (atual: ${item.group})`);
  const groups = [...(layout.match(/const NAV_GROUPS = \[([\s\S]*?)\];/)?.[1] || '').matchAll(/id:\s*"(\w+)"/g)].map((match) => match[1]);
  assert.ok(groups.includes(item.group), 'grupo do item declarado em NAV_GROUPS');
}

checkRoute(sources['src/pages.config.js']);
checkMenu(sources['src/Layout.jsx']);
{
  const cfg = sources['src/pages.config.js'];
  const layout = sources['src/Layout.jsx'];
  mustFail(() => checkRoute(cfg.replace('"Sanidade": Sanidade,', '"Sanidade": Sanidade,\n    "SanidadeAplicacoes": Sanidade,')), 'rota de sanidade duplicada');
  mustFail(() => checkRoute(cfg.replace(/const Sanidade = lazy\(\(\) => import\('\.\/pages\/Sanidade'\)\);\n/, '')), 'rota de sanidade ausente');
  mustFail(() => checkMenu(mutate(layout, 'permission: "weighing.read",\n  },\n  {\n    id: "pec-fechamento-dia"', 'permission: "registry.read",\n  },\n  {\n    id: "pec-fechamento-dia"')), 'item de Sanidade com permissão errada');
  mustFail(() => checkMenu(mutate(layout, '  {\n    id: "pec-fechamento-dia"', '  {\n    id: "pec-sanidade-medicamentos",\n    title: "Medicamentos",\n    longTitle: "Sanidade · Medicamentos",\n    url: "Sanidade",\n    group: "cadastros",\n    permission: "registry.read",\n  },\n  {\n    id: "pec-fechamento-dia"')), 'vários itens de menu de Sanidade');
  mustFail(() => checkMenu(mutate(layout, 'group: "operacao",\n    mobile: false,\n    permission: "weighing.read"', 'group: "sistema",\n    mobile: false,\n    permission: "weighing.read"')), 'item de Sanidade fora de Operação/Cadastros');
}
ok('rota-e-menu-unicos');

// ---------------------------------------------------------------------------
// 2. sanityService (e só ele) como porta de dados; nomes importados existem no serviço.
// ---------------------------------------------------------------------------
const FORBIDDEN_DATA_ACCESS = /appSettings|settingsService|getSetting|setSetting|registryService|loadRegistryGroup|saveRegistryGroup|cadastros-auxiliares|ConfiguracoesSanidade|storageAdapter|indexedDb|from 'dexie'|healthDataAdapter/;

function importedServiceNames(source) {
  return [...source.matchAll(/import \{([^}]*)\} from '@\/modules\/sanity\/application\/sanityService'/g)]
    .flatMap((match) => match[1].split(',').map((name) => name.trim().split(/\s+as\s+/)[0]).filter(Boolean));
}

function checkServiceUsage(files) {
  const page = files[PAGE];
  assert.ok(page.includes(`from '${SERVICE_IMPORT}'`), 'Sanidade.jsx importa o sanityService');
  for (const fn of ['listProgramas', 'saveProgram', 'setProgramActive', 'listMedicamentos', 'saveMedicamento', 'setMedicamentoActive']) {
    assert.ok(importedServiceNames(page).includes(fn), `Sanidade.jsx usa ${fn} do sanityService`);
  }
  const panel = files[`${COMPONENT_DIR}/AplicacoesPanel.jsx`];
  for (const fn of ['listApplications', 'registerApplication', 'cancelApplication']) {
    assert.ok(importedServiceNames(panel).includes(fn), `AplicacoesPanel usa ${fn} do sanityService`);
  }
  for (const [file, source] of Object.entries(files)) {
    if (!uiFiles.includes(file)) continue;
    assert.ok(!FORBIDDEN_DATA_ACCESS.test(stripComments(source)), `${file}: sem appSettings, registry legado ou acesso direto ao banco`);
  }
}

function serviceExports() {
  assert.ok(existsSync(join(root, SERVICE_PATH)), `${SERVICE_PATH} existe (sanityService da fatia A)`);
  const service = read(SERVICE_PATH);
  const names = new Set([
    ...[...service.matchAll(/export (?:async )?function (\w+)/g)].map((match) => match[1]),
    ...[...service.matchAll(/export (?:const|let|class) (\w+)/g)].map((match) => match[1]),
    ...[...service.matchAll(/export \{([^}]*)\}/g)].flatMap((match) => match[1].split(',').map((name) => name.trim().split(/\s+as\s+/).pop()).filter(Boolean)),
  ]);
  return names;
}

function checkImportsExist(files, exported) {
  for (const [file, source] of Object.entries(files)) {
    for (const name of importedServiceNames(source)) assert.ok(exported.has(name), `${file}: sanityService não exporta ${name}`);
  }
}

checkServiceUsage(sources);
const exported = serviceExports();
checkImportsExist(sources, exported);
mustFail(() => checkServiceUsage({ ...sources, [PAGE]: `${sources[PAGE]}\nconst legado = () => getSetting('cadastros-auxiliares:sanidade:local');` }), 'tela lendo appSettings');
mustFail(() => checkServiceUsage({ ...sources, [`${COMPONENT_DIR}/AplicacoesPanel.jsx`]: `import storage from '@/storage/storageAdapter';\n${sources[`${COMPONENT_DIR}/AplicacoesPanel.jsx`]}` }), 'componente acessando o banco direto');
mustFail(() => checkServiceUsage({ ...sources, [PAGE]: sources[PAGE].replace(/\s+saveProgram,\n/, '\n') }), 'tela sem saveProgram do serviço');
mustFail(() => checkImportsExist({ x: "import { deleteApplication } from '@/modules/sanity/application/sanityService';" }, exported), 'import de função inexistente no serviço');
ok('usa-sanity-service');

// ---------------------------------------------------------------------------
// 3. Permissões: constantes, decisões pela matriz real e condições no código.
// ---------------------------------------------------------------------------
assert.equal(model.SANITY_READ_PERMISSION, 'weighing.read');
assert.equal(model.SANITY_REGISTRY_WRITE_PERMISSION, 'registry.write');
assert.equal(model.SANITY_APPLY_PERMISSION, 'weighing.write');
assert.equal(model.SANITY_CANCEL_PERMISSION, 'weighing.edit');
const authFor = (role) => ({ user: { role }, can: (action) => can(role, action) });
const EXPECTED_UI = {
  ADMIN: { canRead: true, canWriteRegistry: true, canApply: true, canCancel: true },
  GESTOR: { canRead: true, canWriteRegistry: true, canApply: true, canCancel: true },
  OPERADOR: { canRead: true, canWriteRegistry: false, canApply: true, canCancel: true },
  CONSULTA: { canRead: true, canWriteRegistry: false, canApply: false, canCancel: false },
};
for (const role of ROLES) assert.deepEqual(model.sanityPermissions(authFor(role)), EXPECTED_UI[role], `decisões de UI para ${role}`);
assert.deepEqual(model.sanityPermissions(authFor('ROOT')), { canRead: false, canWriteRegistry: false, canApply: false, canCancel: false }, 'papel desconhecido: nada permitido');
assert.deepEqual(model.sanityPermissions({ user: { role: 'ADMIN' } }), { canRead: false, canWriteRegistry: false, canApply: false, canCancel: false }, 'contexto sem can(): nada permitido');
assert.deepEqual(model.sanityPermissions(null), { canRead: true, canWriteRegistry: true, canApply: true, canCancel: true }, 'sem AuthGate (desenvolvimento): o serviço decide');

function checkPermissionWiring(files) {
  const page = stripComments(files[PAGE]);
  assert.match(page, /sanityPermissions\(auth\)/, 'tela decide pelas permissões do modelo');
  assert.match(page, /if \(!canRead\) return <AccessDenied[^>]*permission=\{SANITY_READ_PERMISSION\}/, 'sem weighing.read a tela mostra Acesso não permitido');
  // Missão pesagens-integrada F08: a aba Posologias também grava com registry.write (3 = programas, medicamentos, posologias).
  assert.equal((page.match(/canWrite=\{canWriteRegistry\}/g) || []).length, 3, 'programas, medicamentos e posologias: escrita só com registry.write');
  assert.equal((page.match(/readOnly=\{!canWriteRegistry\}/g) || []).length, 2, 'diálogos de cadastro somente leitura sem registry.write');
  assert.match(page, /const runSave = async[^\n]*\n\s*if \(!canWriteRegistry \|\| busy\) return;/, 'salvar cadastro recusa sem registry.write');
  assert.match(page, /const runSetActive = async[^\n]*\n\s*if \(!canWriteRegistry \|\| busy/, 'inativar/reativar recusa sem registry.write');
  assert.match(page, /canApply=\{canApply\}/, 'aba Aplicações recebe canApply (weighing.write)');
  assert.match(page, /canCancel=\{canCancel\}/, 'aba Aplicações recebe canCancel (weighing.edit)');

  const catalog = stripComments(files[`${COMPONENT_DIR}/SanidadeCatalogPanel.jsx`]);
  assert.match(catalog, /mg-action-slot\$\{canWrite \? ' is-visible' : ''\}[\s\S]{0,260}aux-new-button[^>]*disabled=\{!canWrite\}[\s\S]{0,200}<Plus/, 'Novo só com registry.write (ícone)');
  assert.match(catalog, /const canInactivate = canWrite && selectedAllActive;/, 'Inativar só com registry.write');
  assert.match(catalog, /const canReactivate = canWrite && selectedAllInactive;/, 'Reativar só com registry.write');
  assert.match(catalog, /const openLabel = canWrite \? 'Editar' : 'Consultar';/, 'sem registry.write o registro abre em Consultar');
  for (const dialog of ['ProgramaFormDialog.jsx', 'MedicamentoFormDialog.jsx']) {
    const source = stripComments(files[`${COMPONENT_DIR}/${dialog}`]);
    assert.match(source, /if \(readOnly \|\| busy\) return;/, `${dialog}: gravação recusada em somente leitura`);
    assert.match(source, /\{!readOnly \? <Button[^>]*>\{busy \? 'Salvando…' : 'Salvar'\}<\/Button> : null\}/, `${dialog}: Salvar oculto em somente leitura`);
  }

  const panel = stripComments(files[`${COMPONENT_DIR}/AplicacoesPanel.jsx`]);
  assert.match(panel, /mg-action-slot\$\{canApply \? ' is-visible' : ''\}[\s\S]{0,400}aria-label="Registrar aplicação avulsa"[\s\S]{0,120}disabled=\{!canApply\}/, 'Registrar aplicação só com weighing.write');
  assert.match(panel, /if \(!canApply \|\| busy\) return;[\s\S]{0,80}registerApplication\(/, 'registro recusado sem weighing.write');
  assert.match(panel, /open=\{registerOpen && canApply\}/, 'diálogo de registro só abre com weighing.write');
  assert.match(panel, /const canCancelSelected = canCancel && Boolean\(selectedApplication\) && !isApplicationCancelled\(selectedApplication\);/, 'Cancelar aplicação só com weighing.edit e aplicação ativa selecionada');
  assert.match(panel, /mg-action-slot\$\{canCancelSelected \? ' is-visible' : ''\}[\s\S]{0,500}aria-label="Cancelar a aplicação selecionada"[\s\S]{0,160}disabled=\{busy \|\| !canCancelSelected\}/, 'botão Cancelar aplicação condicionado');
  assert.match(panel, /if \(!canCancel \|\| !cancelTarget \|\| busy\) return;[\s\S]{0,120}cancelApplication\(cancelTarget\.id, \{ motivo \}\)/, 'cancelamento recusado sem weighing.edit e com motivo');
  assert.match(panel, /application=\{canCancel \? cancelTarget : null\}/, 'diálogo de cancelamento só abre com weighing.edit');
  const cancelDialog = stripComments(files[`${COMPONENT_DIR}/CancelarAplicacaoDialog.jsx`]);
  assert.match(cancelDialog, /if \(!motivo\.trim\(\)\) \{\s*toast\.error\('Informe o motivo do cancelamento\.'\)/, 'motivo do cancelamento obrigatório');

  for (const [file, source] of Object.entries(files)) {
    if (!uiFiles.includes(file)) continue;
    assert.ok(!/\b(role|perfil|papel)\s*[!=]==?\s*['"]/.test(stripComments(source)), `${file}: sem if (role === …) — decisões por can()`);
  }
}

checkPermissionWiring(sources);
{
  const catalogFile = `${COMPONENT_DIR}/SanidadeCatalogPanel.jsx`;
  const panelFile = `${COMPONENT_DIR}/AplicacoesPanel.jsx`;
  mustFail(() => checkPermissionWiring({ ...sources, [catalogFile]: mutate(sources[catalogFile], 'const canInactivate = canWrite && selectedAllActive;', 'const canInactivate = selectedAllActive;') }), 'Inativar sem registry.write');
  mustFail(() => checkPermissionWiring({ ...sources, [PAGE]: mutate(sources[PAGE], 'canWrite={canWriteRegistry}', 'canWrite={canApply}') }), 'cadastro gravável com weighing.write');
  mustFail(() => checkPermissionWiring({ ...sources, [panelFile]: mutate(sources[panelFile], 'const canCancelSelected = canCancel && Boolean(selectedApplication)', 'const canCancelSelected = Boolean(selectedApplication)') }), 'cancelar sem weighing.edit');
  mustFail(() => checkPermissionWiring({ ...sources, [panelFile]: mutate(sources[panelFile], 'if (!canApply || busy) return;', 'if (busy) return;') }), 'registrar sem weighing.write');
  mustFail(() => checkPermissionWiring({ ...sources, [PAGE]: `${sources[PAGE]}\nconst gestor = auth?.user?.role === 'GESTOR';` }), 'decisão por papel na tela');
}
ok('permissoes-na-ui');

// ---------------------------------------------------------------------------
// 4. Ficha do Animal: seção Sanidade com as aplicações do animal (somente leitura).
// ---------------------------------------------------------------------------
function checkFicha(files) {
  const ficha = stripComments(files[FICHA]);
  assert.ok(importedServiceNames(files[FICHA]).includes('listApplications'), 'Ficha importa listApplications do sanityService');
  assert.match(ficha, /import SanidadeAnimalCard from '@\/components\/sanidade\/SanidadeAnimalCard'/, 'Ficha usa a seção SanidadeAnimalCard');
  assert.match(ficha, /const canReadSanity = pode\('weighing\.read'\);/, 'Ficha lê sanidade só com weighing.read');
  assert.match(ficha, /listApplications\(\{ animalId: selectedAnimalId, includeCancelled: true \}\)/, 'Ficha lista as aplicações do animal, inclusive canceladas');
  assert.match(ficha, /\{canReadSanity \? <SanidadeAnimalCard applications=\{sanity\.rows\}/, 'Ficha renderiza a seção Sanidade');
  assert.ok(!/registerApplication|cancelApplication|saveProgram|saveMedicamento/.test(ficha), 'Ficha não edita sanidade');
  const card = stripComments(files[`${COMPONENT_DIR}/SanidadeAnimalCard.jsx`]);
  assert.match(card, /<h2>Sanidade<\/h2>/, 'seção com título Sanidade');
  assert.match(card, /const rows = sortApplicationsNewestFirst\(applications\);/, 'aplicações mais recentes primeiro');
  assert.match(card, /className=\{isCancelled \? 'is-cancelled' : undefined\}/, 'canceladas marcadas na linha');
  assert.match(card, /situacaoAplicacao\(row\)/, 'situação Aplicada/Cancelada exibida');
  assert.match(card, /Nenhuma aplicação de sanidade registrada para este animal\./, 'estado vazio claro');
  assert.ok(!/registerApplication|cancelApplication|onClick/.test(card), 'seção da ficha é somente leitura');
}
checkFicha(sources);
mustFail(() => checkFicha({ ...sources, [FICHA]: mutate(sources[FICHA], 'includeCancelled: true })', 'includeCancelled: false })') }), 'Ficha sem canceladas');
mustFail(() => checkFicha({ ...sources, [`${COMPONENT_DIR}/SanidadeAnimalCard.jsx`]: `${sources[`${COMPONENT_DIR}/SanidadeAnimalCard.jsx`]}\nconst x = () => cancelApplication('1');` }), 'Ficha editando sanidade');
ok('ficha-lista-aplicacoes');

// ---------------------------------------------------------------------------
// 5. Nenhuma referência às stores/campos de sanidade da v5 (removidas na v6).
// ---------------------------------------------------------------------------
const V5_REFERENCES = /configuracoesSanidade|itensSanidade|sanidadesAnimal|sanidade_ids|\bsanidades\b|configuracao_id|data_aplicacao|healthDataAdapter/;
function checkNoV5(files) {
  for (const [file, source] of Object.entries(files)) assert.ok(!V5_REFERENCES.test(source), `${file}: sem referência às stores/campos de sanidade da v5`);
}
const v5Scope = { ...sources, 'src/styles/sanidade.css': read('src/styles/sanidade.css'), 'docs/user/SANIDADE.md': read('docs/user/SANIDADE.md') };
checkNoV5(v5Scope);
mustFail(() => checkNoV5({ ...v5Scope, [PAGE]: `${sources[PAGE]}\n// db.table('sanidadesAnimal')` }), 'referência à store sanidadesAnimal');
mustFail(() => checkNoV5({ ...v5Scope, [FICHA]: `${sources[FICHA]}\nconst ids = row.sanidade_ids;` }), 'referência a sanidade_ids');
ok('sem-stores-v5');

// ---------------------------------------------------------------------------
// 6. Estrutura ModeloBase1, abas, estados vazios e tema escuro.
// ---------------------------------------------------------------------------
{
  assert.deepEqual(model.SANIDADE_TABS.map((tab) => [tab.id, tab.label]), [['programas', 'Programas/Procedimentos'], ['medicamentos', 'Medicamentos/Produtos'], ['posologias', 'Posologias'], ['aplicacoes', 'Aplicações']], 'quatro abas na ordem (F08: Posologias)');
  const page = sources[PAGE];
  assert.match(page, /className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope aux-registry-page/, 'Tela Mãe do ModeloBase1 com o escopo dos cadastros');
  for (const tab of ['programas', 'medicamentos', 'aplicacoes']) assert.ok(page.includes(`activeTab === '${tab}'`), `aba ${tab} renderizada`);
  assert.match(page, /Nenhum programa cadastrado\./, 'estado vazio de programas');
  assert.match(page, /Nenhum medicamento cadastrado\./, 'estado vazio de medicamentos');
  const tabs = sources[`${COMPONENT_DIR}/SanidadeTabs.jsx`];
  assert.match(tabs, /className="mg-panel-tabs-rail"[\s\S]{0,200}className="seg-control" role="tablist"[\s\S]{0,200}className="seg-tab-slider"/, 'abas na estrutura oficial do ModeloBase1');
  const catalog = sources[`${COMPONENT_DIR}/SanidadeCatalogPanel.jsx`];
  assert.match(catalog, /data-mak-region="toolbar"[\s\S]{0,200}className="mg-action-bar /, 'barra de ações mg-action-bar');
  assert.doesNotMatch(catalog, /<MgDesktopSearch/, 'catálogo de sanidade não mostra o campo de pesquisa da barra');
  assert.match(catalog, /aria-label="Configurar colunas da tabela"[\s\S]{0,700}<MgSpeedDialMenu/, 'Configurar colunas fica ao lado de Mais opções');
  assert.match(catalog, /<MgSpeedDialMenu[\s\S]{0,500}Atualizar[\s\S]{0,200}Limpar filtros/, '"Mais opções" com Atualizar e Limpar filtros');
  assert.doesNotMatch(catalog, /<MakFilterRail|<MakFilterPill|<MgTablePanelStrip/, 'catálogo não mostra a faixa de filtros personalizados');
  const table = sources[`${COMPONENT_DIR}/SanidadeDataTable.jsx`];
  assert.match(table, /className="emp-table-pro d17c-data-table aux-data-table/, 'tabela com as classes da Tela Mãe');
  assert.match(table, /<MakTh[\s\S]{0,900}onFiltrar: /, 'cabeçalhos MakTh com filtro');
  assert.match(table, /<MakColumnConfigDialog/, 'configuração de colunas');
  const panel = sources[`${COMPONENT_DIR}/AplicacoesPanel.jsx`];
  for (const label of ['Animal (número ou marca)', 'Período', 'Todos os programas', 'Todos os medicamentos', 'Incluir canceladas', 'Nenhuma aplicação registrada.', 'Nenhuma aplicação encontrada para os filtros escolhidos.']) {
    assert.ok(panel.includes(label), `aba Aplicações: ${label}`);
  }
  for (const dialog of ['ProgramaFormDialog.jsx', 'MedicamentoFormDialog.jsx', 'AplicacaoFormDialog.jsx', 'CancelarAplicacaoDialog.jsx']) {
    assert.match(sources[`${COMPONENT_DIR}/${dialog}`], /className="d17b-standard-dialog /, `${dialog}: diálogo padronizado`);
  }
  const css = read('src/styles/sanidade.css');
  assert.match(css, /html:is\(\.dark, \.tema-escuro, \.escuro\)[^{]*\.sanidade-status--active/, 'distintivos com variante escura');
  assert.match(css, /html:is\(\.dark, \.tema-escuro, \.escuro\)[^{]*\.sanidade-filter-period/, 'faixa de filtros com variante escura');
  assert.match(css, /html:is\(\.dark, \.tema-escuro, \.escuro\)[^{]*\.sanidade-animal-search__results/, 'busca de animal com variante escura');
}
ok('modelobase1-abas-estados-vazios');

// ---------------------------------------------------------------------------
// 7. Modelo puro: textos, busca de animal, formulários e filtros (com negativos),
//    conferido contra a validação do serviço (sanityRules).
// ---------------------------------------------------------------------------
const rules = await import('../src/modules/sanity/domain/sanityRules.js');
{
  const ctx = { tipoLabels: rules.PROGRAMA_TIPO_LABELS, viaLabels: rules.VIA_LABELS };
  assert.equal(model.formatDose(10, 'ml'), '10 ml');
  assert.equal(model.formatDose(2.5, 'ml'), '2,5 ml');
  assert.equal(model.formatDose(null, 'ml'), '—', 'sem dose: traço, não "0"');
  assert.equal(model.formatDose('abc', 'ml'), '—');
  assert.equal(model.formatCarencia(0), 'Sem carência');
  assert.equal(model.formatCarencia(1), '1 dia');
  assert.equal(model.formatCarencia(30), '30 dias');
  assert.equal(model.formatCarencia(-2), '—');
  assert.equal(model.formatDateBR('2026-09-17'), '17/09/2026');
  assert.equal(model.formatDateBR('2026-02-30'), '—', 'data inexistente');
  assert.equal(model.origemAplicacao({ pesagem_id: 'p1' }), 'Lançamento');
  assert.equal(model.origemAplicacao({ pesagem_id: null }), 'Avulsa');
  assert.equal(model.situacaoAplicacao({ cancelled_at: '2026-09-17T10:00:00Z' }), 'Cancelada');
  assert.equal(model.situacaoAplicacao({ cancelled_at: null }), 'Aplicada');
  assert.equal(model.programaNomeDe({ programa_nome: null, programa_nome_snapshot: 'Vermifugação' }), 'Vermifugação', 'cadastro inexistente: snapshot');
  assert.equal(model.programaNomeDe({ programa_nome: 'Vermifugação 2026', programa_nome_snapshot: 'Vermifugação' }), 'Vermifugação 2026', 'nome atual por join prevalece');
  assert.equal(model.MEDICAMENTO_COLUMNS.find((column) => column.id === 'via_aplicacao').text({ via_aplicacao: 'SC' }, ctx), 'Subcutânea (SC)');
  assert.equal(model.PROGRAMA_COLUMNS.find((column) => column.id === 'tipo').text({ tipo: 'VERMIFUGACAO' }, ctx), 'Vermifugação');
  assert.equal(model.PROGRAMA_COLUMNS.find((column) => column.id === 'ordem').text({ ordem: 0 }), '0', 'ordem zero é exibida');
  assert.deepEqual(model.APLICACAO_COLUMNS.map((column) => column.id), ['data', 'animal', 'marca', 'programa', 'medicamento', 'dose', 'via', 'observacao', 'responsavel', 'origem', 'situacao'], 'colunas do histórico');
  assert.deepEqual(model.MEDICAMENTO_COLUMNS.map((column) => column.id), ['nome', 'principio_ativo', 'fabricante', 'unidade_padrao', 'dose_padrao', 'via_aplicacao', 'carencia_dias', 'observacao', 'situacao'], 'colunas de medicamentos');
  assert.deepEqual(model.PROGRAMA_COLUMNS.map((column) => column.id), ['nome', 'tipo', 'descricao', 'ordem', 'situacao'], 'colunas de programas');

  // Busca de animal: número/marca → animal_id; excluídos fora; número exato primeiro.
  const index = model.buildAnimalIndex([
    { id: 'a1', numero_animal: '1234', marca: 'ABC', situacao: 'ATIVO' },
    { id: 'a2', numero_animal: '12345', marca: 'XYZ', situacao: 'VENDIDO' },
    { id: 'a3', numero_animal: '1234', marca: 'Açaí', situacao: 'ATIVO' },
    { id: 'a4', numero_animal: '999', marca: 'ABC', deleted_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal(index.list.length, 3, 'animal excluído não entra no índice');
  assert.deepEqual(model.searchAnimals(index, '1234 abc').map((item) => item.id), ['a1'], 'número + marca');
  assert.deepEqual(model.searchAnimals(index, 'acai').map((item) => item.id), ['a3'], 'marca sem acento');
  assert.deepEqual(model.searchAnimals(index, '1234').slice(0, 2).map((item) => item.id).sort(), ['a1', 'a3'], 'número exato antes do prefixo');
  assert.equal(model.searchAnimals(index, '1234').at(-1).id, 'a2');
  assert.deepEqual(model.searchAnimals(index, '999'), [], 'NEGATIVO: excluído não aparece');
  assert.deepEqual(model.searchAnimals(model.buildAnimalIndex([]), '1'), [], 'índice vazio');
  assert.deepEqual(model.applicationAnimal({ animal_id: 'a1' }, index.byId), { numero: '1234', marca: 'ABC' });
  assert.deepEqual(model.applicationAnimal({ animal_id: 'zz' }, index.byId), { numero: 'Animal não encontrado', marca: '—' });
  assert.deepEqual(model.applicationAnimal({ animal_id: 'zz' }, index.byId, true), { numero: '…', marca: '…' }, 'carregando animais');

  const ordered = model.sortApplicationsNewestFirst([
    { id: '1', data: '2026-09-01', created_at: '2026-09-01T10:00:00Z' },
    { id: '2', data: '2026-09-10', created_at: '2026-09-10T08:00:00Z' },
    { id: '3', data: '2026-09-10', created_at: '2026-09-10T09:00:00Z' },
  ]);
  assert.deepEqual(ordered.map((row) => row.id), ['3', '2', '1'], 'mais recentes primeiro (data, depois criação)');

  // Programa: formulário → entrada aceita pelo serviço; negativos recusados na tela e no serviço.
  const programaForm = { nome: '  Vermifugação ', tipo: 'VERMIFUGACAO', descricao: 'Rotina', ordem: '1' };
  assert.deepEqual(model.validateProgramaForm(programaForm, rules.PROGRAMA_TIPOS), []);
  const programaInput = model.programaInputFromForm(programaForm, { empresaId: 'local' });
  assert.deepEqual(programaInput, { empresa_id: 'local', nome: 'Vermifugação', tipo: 'VERMIFUGACAO', descricao: 'Rotina', ordem: 1 });
  assert.deepEqual(rules.validateProgramInput(programaInput), { nome: 'Vermifugação', tipo: 'VERMIFUGACAO', descricao: 'Rotina', ordem: 1 }, 'serviço aceita a entrada da tela');
  assert.equal(model.programaInputFromForm(programaForm, { id: 'p1', empresaId: 'local' }).id, 'p1', 'edição envia id');
  assert.equal(model.programaInputFromForm(programaForm, { id: 'p1', empresaId: 'local' }).empresa_id, undefined, 'edição não troca a empresa');
  assert.equal(model.validateProgramaForm({ ...programaForm, nome: ' ' }, rules.PROGRAMA_TIPOS).length, 1, 'NEGATIVO: nome obrigatório');
  assert.equal(model.validateProgramaForm({ ...programaForm, tipo: 'CIRURGIA' }, rules.PROGRAMA_TIPOS).length, 1, 'NEGATIVO: tipo inválido');
  assert.equal(model.validateProgramaForm({ ...programaForm, ordem: '-1' }, rules.PROGRAMA_TIPOS).length, 1, 'NEGATIVO: ordem negativa');
  assert.equal(model.validateProgramaForm({ ...programaForm, ordem: '1,5' }, rules.PROGRAMA_TIPOS).length, 1, 'NEGATIVO: ordem fracionária');
  assert.deepEqual(model.programaFormFromRecord({ nome: 'X', tipo: 'OUTRO', descricao: null, ordem: 0 }), { nome: 'X', tipo: 'OUTRO', descricao: '', ordem: '0' });

  // Medicamento "Produto X" (10 ml SC).
  const medForm = { ...model.emptyMedicamentoForm(), nome: 'Produto X', unidade_padrao: 'ml', dose_padrao: '10', via_aplicacao: 'SC', carencia_dias: '28' };
  assert.deepEqual(model.validateMedicamentoForm(medForm, { unidades: rules.UNIDADES_DOSE, vias: rules.VIAS_APLICACAO }), []);
  const medInput = model.medicamentoInputFromForm(medForm, { empresaId: 'local' });
  const medValidado = rules.validateMedicamentoInput(medInput);
  assert.equal(medValidado.dose_padrao, '10', 'dose padrão continua texto de referência');
  assert.equal(medValidado.carencia_dias, 28);
  assert.equal(medValidado.via_aplicacao, 'SC');
  assert.equal(model.validateMedicamentoForm({ ...medForm, carencia_dias: '2.5' }, { unidades: rules.UNIDADES_DOSE, vias: rules.VIAS_APLICACAO }).length, 1, 'NEGATIVO: carência fracionária');
  assert.equal(model.validateMedicamentoForm({ ...medForm, unidade_padrao: 'litro' }, { unidades: rules.UNIDADES_DOSE, vias: rules.VIAS_APLICACAO }).length, 1, 'NEGATIVO: unidade fora da lista');
  assert.equal(model.validateMedicamentoForm({ ...medForm, nome: '' }, { unidades: rules.UNIDADES_DOSE, vias: rules.VIAS_APLICACAO }).length, 1, 'NEGATIVO: nome obrigatório');
  assert.equal(model.medicamentoInputFromForm({ ...medForm, carencia_dias: '' }, {}).carencia_dias, null, 'carência vazia → null');

  // Aplicação avulsa: sugestões do medicamento só em campos vazios; validação ≡ serviço.
  const today = new Date(2026, 8, 17, 12);
  const base = { ...model.emptyAplicacaoForm(today), animal: index.list[0] };
  assert.equal(base.data, '2026-09-17', 'data padrão = hoje');
  const produtoX = { id: 'm1', nome: 'Produto X', unidade_padrao: 'ml', dose_padrao: '10', via_aplicacao: 'SC' };
  const sugerido = model.applyMedicamentoDefaults({ ...base, medicamento_id: 'm1' }, produtoX, rules.suggestedDose);
  assert.deepEqual([sugerido.dose, sugerido.unidade, sugerido.via_aplicacao], ['10', 'ml', 'SC'], 'dose/unidade/via sugeridas');
  const digitado = model.applyMedicamentoDefaults({ ...base, medicamento_id: 'm1', dose: '12', via_aplicacao: 'IM' }, produtoX, rules.suggestedDose);
  assert.deepEqual([digitado.dose, digitado.unidade, digitado.via_aplicacao], ['12', 'ml', 'IM'], 'NEGATIVO: o que o operador digitou não é sobrescrito');
  const textoRef = model.applyMedicamentoDefaults({ ...base, medicamento_id: 'm2' }, { ...produtoX, id: 'm2', dose_padrao: '1 ml / 50 kg' }, rules.suggestedDose);
  assert.equal(textoRef.dose, '', 'dose padrão em texto não vira número (sem cálculo por peso)');
  assert.equal(model.applyMedicamentoDefaults({ ...base, medicamento_id: 'm3' }, { ...produtoX, dose_padrao: '2,5' }, rules.suggestedDose).dose, '2,5', 'decimal pt-BR');
  assert.deepEqual(model.validateAplicacaoForm(sugerido, today), []);
  const aplicacaoInput = model.aplicacaoInputFromForm(sugerido);
  assert.deepEqual(aplicacaoInput, { animal_id: 'a1', data: '2026-09-17', programa_sanidade_id: null, medicamento_id: 'm1', dose: 10, unidade: 'ml', via_aplicacao: 'SC', observacao: null });
  assert.equal(rules.validateApplicationInput(aplicacaoInput, { today }).dose, 10, 'serviço aceita a entrada da tela');
  const negativos = [
    [{ ...sugerido, animal: null }, 'animal obrigatório'],
    [{ ...sugerido, programa_sanidade_id: '', medicamento_id: '' }, 'programa ou medicamento'],
    [{ ...sugerido, data: '2026-09-18' }, 'data futura'],
    [{ ...sugerido, data: '' }, 'data obrigatória'],
    [{ ...sugerido, dose: '0' }, 'dose zero'],
    [{ ...sugerido, dose: 'dez' }, 'dose não numérica'],
  ];
  for (const [form, what] of negativos) {
    assert.ok(model.validateAplicacaoForm(form, today).length >= 1, `NEGATIVO na tela: ${what}`);
    assert.throws(() => rules.validateApplicationInput({ ...model.aplicacaoInputFromForm(form), dose: form.dose === 'dez' ? 'dez' : model.aplicacaoInputFromForm(form).dose }, { today }), (error) => error.code === 'SANITY_INVALID', `NEGATIVO no serviço: ${what}`);
  }
  assert.equal(model.aplicacaoInputFromForm({ ...sugerido, dose: '' }).dose, null, 'dose vazia → null');

  // Filtros do histórico → consulta do serviço.
  const filtros = { ...model.emptyAplicacaoFilters(), animal: index.list[0], from: '2026-09-01', to: '2026-09-30', programaId: 'p1', includeCancelled: true };
  assert.deepEqual(model.applicationQueryFromFilters(filtros, 'local'), { query: { animalId: 'a1', from: '2026-09-01', to: '2026-09-30', programaId: 'p1', includeCancelled: true, empresaId: 'local' } });
  assert.deepEqual(model.applicationQueryFromFilters(model.emptyAplicacaoFilters()), { query: { includeCancelled: false } }, 'sem filtros: só ativas');
  assert.match(model.applicationQueryFromFilters({ ...filtros, from: '2026-10-01' }).error, /data inicial/, 'NEGATIVO: período invertido');
  assert.equal(model.hasActiveAplicacaoFilters(model.emptyAplicacaoFilters()), false);
  assert.equal(model.hasActiveAplicacaoFilters({ ...model.emptyAplicacaoFilters(), includeCancelled: true }), true);

  // Opções: ativos + o já escolhido (inativo marcado).
  const opcoes = model.catalogOptions([{ id: 'p1', nome: 'Vermifugação', ativo: true }, { id: 'p2', nome: 'Aftosa', ativo: false }], 'p2');
  assert.deepEqual(opcoes, [{ value: 'p1', label: 'Vermifugação' }, { value: 'p2', label: 'Aftosa (inativo)' }]);
  assert.deepEqual(model.catalogOptions([{ id: 'p2', nome: 'Aftosa', ativo: false }], ''), [], 'NEGATIVO: inativo não é oferecido para aplicação nova');

  // Pesquisa sem acento/caixa sobre o texto das colunas.
  assert.equal(model.matchesSanitySearch({ nome: 'Vermifugação', tipo: 'VERMIFUGACAO', ativo: true }, model.PROGRAMA_COLUMNS, 'vermifugacao', ctx), true);
  assert.equal(model.matchesSanitySearch({ nome: 'Aftosa', tipo: 'VACINACAO', ativo: true }, model.PROGRAMA_COLUMNS, 'vermi', ctx), false, 'NEGATIVO: pesquisa sem correspondência');
}
ok('modelo-puro-coerente-com-servico');

// ---------------------------------------------------------------------------
// 8. Guia do usuário.
// ---------------------------------------------------------------------------
{
  const guide = read('docs/user/SANIDADE.md');
  for (const text of ['Vermifugação', 'Produto X', 'ml', 'Subcutânea (SC)', 'Lançamento', 'Aplicar esta configuração aos próximos animais', 'Incluir canceladas', 'Cancelar aplicação', 'NÃO faz', 'Estoque', 'Prescrição', 'Calendário']) {
    assert.ok(guide.includes(text), `docs/user/SANIDADE.md menciona "${text}"`);
  }
  assert.ok(!/appSettings/.test(guide), 'guia não descreve a tela legada em appSettings');
}
ok('guia-do-usuario');

console.log(JSON.stringify({
  gate: 'sanity:ui:verify',
  ok: true,
  checks,
  uiFiles: uiFiles.length,
  serviceExportsChecked: [...new Set(Object.values(sources).flatMap(importedServiceNames))].sort(),
}, null, 2));
