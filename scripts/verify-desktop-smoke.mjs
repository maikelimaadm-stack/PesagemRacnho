import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function assert(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    process.exit(1);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

assert(pkg.productName === 'Pesagens Individuais', 'productName');
assert(pkg.main === 'electron/main.cjs', 'main entry');
assert(existsSync(join(root, 'electron', 'main.cjs')), 'main.cjs');
assert(existsSync(join(root, 'electron', 'preload.cjs')), 'preload.cjs');
assert(existsSync(join(root, 'build', 'icon.ico')), 'ícone ICO do executável');
assert(existsSync(join(root, 'build', 'icon.png')), 'ícone PNG mestre');
assert(existsSync(join(root, 'public', 'app-icon.png')), 'favicon do aplicativo');
assert(existsSync(join(root, 'src', 'App.jsx')), 'App.jsx');
assert(existsSync(join(root, 'src', 'pages', 'PesagensIndividuais.jsx')), 'PesagensIndividuais');
assert(
  existsSync(join(root, 'src', 'pages', 'LancamentoPesagensIndividuais.jsx')),
  'LancamentoPesagensIndividuais'
);
assert(existsSync(join(root, 'src', 'pages', 'ManutencaoSistema.jsx')), 'ManutencaoSistema');
assert(existsSync(join(root, 'src', 'Layout.jsx')), 'Layout');
assert(existsSync(join(root, 'docs', 'user', 'GUIA-RAPIDO.md')), 'GUIA-RAPIDO');
assert(existsSync(join(root, 'docs', 'user', 'BACKUP-E-RESTAURACAO.md')), 'BACKUP doc');
assert(existsSync(join(root, 'docs', 'user', 'INSTALACAO-WINDOWS.md')), 'INSTALACAO doc');

const pagesConfig = readFileSync(join(root, 'src', 'pages.config.js'), 'utf8');
assert(pagesConfig.includes('PesagensIndividuais'), 'route PesagensIndividuais');
assert(pagesConfig.includes('LancamentoPesagensIndividuais'), 'route Lancamento');
assert(pagesConfig.includes('ManutencaoSistema'), 'route Manutencao');

const layout = readFileSync(join(root, 'src', 'Layout.jsx'), 'utf8');
assert(layout.includes('Manutenção'), 'nav Manutenção');

const manutencao = readFileSync(join(root, 'src', 'pages', 'ManutencaoSistema.jsx'), 'utf8');
assert(manutencao.includes('maintenanceService'), 'maintenance uses service');
assert(!/login|senha|RBAC|autentic/i.test(manutencao), 'no auth in maintenance');

const operational = [
  'src/pages/PesagensIndividuais.jsx',
  'src/pages/LancamentoPesagensIndividuais.jsx',
  'src/pages/ManutencaoSistema.jsx',
  'src/components/embarque/GerenciarEmbarquesDialog.jsx',
];

const forbidden = [
  'db.entities.PesagemIndividual',
  'db.entities.Apartacao',
  'db.entities.LoteApartacao',
  'db.entities.Embarque',
  'db.entities.DocumentoEmbarque',
  'legacyWeighingBridge',
];

for (const rel of operational) {
  const full = join(root, rel);
  assert(existsSync(full), `exists ${rel}`);
  const src = readFileSync(full, 'utf8');
  for (const f of forbidden) {
    assert(!src.includes(f), `${rel} must not contain ${f}`);
  }
}

assert(
  !existsSync(join(root, 'src/modules/weighing/infrastructure/legacyWeighingBridge.js')),
  'legacyWeighingBridge.js removed'
);

const main = readFileSync(join(root, 'electron/main.cjs'), 'utf8');
assert(main.includes("app.getPath('userData')"), 'data in userData');
assert(main.includes("title: 'Pesagens Individuais'"), 'window title');
assert(main.includes("path.join(process.resourcesPath, 'icon.ico')"), 'janela empacotada usa o ícone distribuído');

console.log('OK verify-desktop-smoke');
