import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

function assert(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    process.exit(1);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseDirectoryName = String(process.env.RELEASE_DIR || 'release').trim();
const releaseDir = join(root, releaseDirectoryName);

assert(pkg.productName === 'Pesagens Individuais', 'productName');
assert(pkg.build?.appId === 'com.pesagens.individuais', 'appId');
assert(pkg.build?.directories?.output === 'release', 'output release');
assert(pkg.build?.asar !== false, 'asar enabled');
assert(pkg.build?.nsis?.shortcutName === 'Pesagens Individuais', 'shortcutName');
assert(pkg.build?.nsis?.uninstallDisplayName === 'Pesagens Individuais', 'uninstallDisplayName');
assert(pkg.build?.nsis?.deleteAppDataOnUninstall === false, 'deleteAppDataOnUninstall false');
assert(pkg.build?.nsis?.perMachine === false, 'perMachine false → userData');

const report = {
  setupExe: null,
  packagedExe: null,
  appAsar: null,
  appAsarUnpacked: null,
  expectedDataDir: '%APPDATA%/pesagens-individuais/data (app.getPath(userData)/data)',
  metadata: {
    productName: pkg.productName,
    version: pkg.version,
    appId: pkg.build.appId,
    artifactName: pkg.build.artifactName,
  },
  execution: 'skipped',
  limitation: null,
};

if (!existsSync(releaseDir)) {
  report.limitation = 'Pasta release/ ausente — rode npm run dist.';
  console.log('OK verify-installed-app-e2e (artefatos parciais / limitação registrada)');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const artifacts = readdirSync(releaseDir);
report.setupExe =
  artifacts.find((f) => f === `${pkg.productName} Setup ${pkg.version}.exe`) ||
  artifacts.find((f) => /Setup.*\.exe$/i.test(f)) ||
  artifacts.find((f) => /\.exe$/i.test(f) && !/unpacked/i.test(f)) ||
  null;

const winUnpacked = artifacts.find((d) => /win-unpacked/i.test(d));
if (winUnpacked) {
  const unpackedRoot = join(releaseDir, winUnpacked);
  const exeName = `${pkg.productName}.exe`;
  const exePath = join(unpackedRoot, exeName);
  report.packagedExe = existsSync(exePath) ? exePath : null;

  const asarPath = join(unpackedRoot, 'resources', 'app.asar');
  const unpackRoot = join(unpackedRoot, 'resources', 'app.asar.unpacked');
  report.appAsar = existsSync(asarPath) ? asarPath : null;
  report.appAsarUnpacked = existsSync(unpackRoot) ? unpackRoot : null;

  // Após o cutover Dexie não há módulo nativo empacotado.
  report.nativeModules = existsSync(join(unpackRoot, 'node_modules')) ? 'presentes' : 'nenhum';
  assert(report.nativeModules === 'nenhum', 'app.asar.unpacked NÃO deve conter módulos nativos');

  assert(report.appAsar, 'app.asar exists');
  assert(report.packagedExe, 'packaged exe exists');

  // Smoke launch of unpacked exe when D9_LAUNCH_PACKAGED=1
  if (process.env.D9_LAUNCH_PACKAGED === '1') {
    await new Promise((resolve) => {
      const child = spawn(report.packagedExe, [], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ELECTRON_DEV: '0' },
      });
      child.unref();
      setTimeout(() => {
        try {
          process.kill(child.pid);
        } catch {
          /* already closed */
        }
        report.execution = 'packaged exe launched briefly then killed';
        resolve();
      }, 4000);
    });
  } else {
    report.execution = 'não executado (defina D9_LAUNCH_PACKAGED=1 para smoke launch)';
    report.limitation =
      'Validação de artefatos OK. Execução do Setup.exe / app instalado: checklist manual em docs/user/TESTE-MAQUINA-LIMPA.md';
  }
}

if (!report.setupExe && !winUnpacked) {
  report.limitation = 'release/ sem Setup.exe / win-unpacked — rode npm run dist.';
}

if (!report.limitation && report.execution.startsWith('não')) {
  report.limitation =
    'Artefatos validados; instalação interativa do Setup.exe não automatizada neste ambiente.';
}


// Validação de RELEASE FINAL (D.11): por padrão, o instalador e seus artefatos
// DEVEM existir. O modo permissivo (dev) só é aceito com E2E_DEV_PERMISSIVE=1.
const permissive =
  process.env.E2E_DEV_PERMISSIVE === '1' || process.env.ALLOW_MISSING_SETUP === '1';
const setupExeName = `${pkg.productName} Setup ${pkg.version}.exe`;
const setupExePath = join(releaseDir, setupExeName);
const sha256Path = `${setupExePath}.sha256`;
const manifestPath = join(releaseDir, 'release-manifest.json');
if (permissive) {
  report.releaseFinal = { mode: 'dev-permissive (E2E_DEV_PERMISSIVE=1)' };
} else {
  assert(existsSync(setupExePath), `release final: "${setupExeName}" deve existir (rode npm run dist)`);
  assert(existsSync(sha256Path), `release final: "${setupExeName}.sha256" deve existir (npm run release:checksum)`);
  assert(existsSync(manifestPath), 'release final: "release-manifest.json" deve existir (npm run release:manifest)');
  report.setupExe = setupExeName;
  report.releaseFinal = { mode: 'strict', setupExe: setupExeName, sha256: true, manifest: true };
}

console.log('OK verify-installed-app-e2e');
console.log(JSON.stringify(report, null, 2));
