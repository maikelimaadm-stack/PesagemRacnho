// Gate release:version-contract:verify (ADR-047; contrato: docs/arquitetura-produto/13 §4 item 4).
// Prova que a versão do app é uma só em todos os lugares onde ela é declarada ou publicada:
//  (a) package.json.version === package-lock.version === package-lock.packages[""].version
//  (b) fallback de src/lib/appVersion.js === package.json.version
//  (c) docs/release/<versão>/RELEASE-NOTES.md e RELEASE-CHECKLIST.md existem e citam a versão
//  (d) CHANGELOG.md tem "## [<versão>] — AAAA-MM-DD" com data real e nenhum bloco "Não lançado"
//  (e) release/ e release-unsigned/ (quando existem): manifesto com appVersion/version igual à do
//      package.json e nenhum Setup de OUTRA versão (artefato antigo nunca é "current")
//  (f) versionInfo.js e generate-release-manifest.mjs concordam em RELEASE_MANIFEST_VERSION
// --self-test: fixtures positivas e negativas em pasta temporária (nunca toca o repositório).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { DATA_BUILD_ID, DB_SCHEMA_VERSION, RELEASE_MANIFEST_VERSION as VERSION_INFO_MANIFEST_VERSION } from '../src/versioning/versionInfo.js';
import {
  RELEASE_MANIFEST_VERSION as GENERATOR_MANIFEST_VERSION,
  buildReleaseManifest,
} from './generate-release-manifest.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIRS = ['release', 'release-unsigned'];
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const UNRELEASED_HEADING = /^##\s*\[\s*(?:n[aã]o\s+lan[cç]ado|unreleased)\b[^\]]*\]/imu;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isRealIsoDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && year >= 2020;
}

/** Extrai o fallback literal de src/lib/appVersion.js (o ramo Node do ternário). */
export function readAppVersionFallback(source) {
  const match = /typeof\s+__APP_VERSION__[\s\S]*?\?[\s\S]*?:\s*['"]([^'"]+)['"]/.exec(source);
  return match ? match[1] : null;
}

/**
 * Executa as verificações (a)–(f) sobre a árvore em `root`.
 * Devolve { ok, version, checks: { id, ok, detail }[], errors: string[] } — nunca lança por
 * violação de contrato, apenas por ausência de package.json.
 */
export function verifyVersionContract(root, { checkManifestVersionAgreement = true } = {}) {
  const errors = [];
  const checks = [];
  const record = (id, ok, detail) => {
    checks.push({ id, ok, detail });
    if (!ok) errors.push(`${id}: ${detail}`);
  };

  const pkg = readJson(join(root, 'package.json'));
  const version = String(pkg.version || '').trim();
  const productName = String(pkg.build?.productName || pkg.productName || pkg.name || '').trim();
  record('version.semver', SEMVER.test(version), `package.json.version = "${version}"`);

  // (a) lock sincronizado
  const lockPath = join(root, 'package-lock.json');
  if (!existsSync(lockPath)) {
    record('a.lock', false, 'package-lock.json ausente');
  } else {
    const lock = readJson(lockPath);
    const rootPkgVersion = lock.packages?.['']?.version;
    record('a.lock.version', lock.version === version,
      `package-lock.version = "${lock.version}" (esperado "${version}")`);
    record('a.lock.packages', rootPkgVersion === version,
      `package-lock.packages[""].version = "${rootPkgVersion}" (esperado "${version}")`);
  }

  // (b) fallback do renderer/Node
  const appVersionPath = join(root, 'src', 'lib', 'appVersion.js');
  if (!existsSync(appVersionPath)) {
    record('b.appVersion', false, 'src/lib/appVersion.js ausente');
  } else {
    const fallback = readAppVersionFallback(readFileSync(appVersionPath, 'utf8'));
    record('b.appVersion', fallback === version,
      `fallback de appVersion.js = "${fallback}" (esperado "${version}")`);
  }

  // (c) notas e checklist da versão
  for (const name of ['RELEASE-NOTES.md', 'RELEASE-CHECKLIST.md']) {
    const rel = `docs/release/${version}/${name}`;
    const path = join(root, rel);
    if (!existsSync(path)) {
      record(`c.${name}`, false, `${rel} ausente`);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    const cites = text.trim().length > 0 && text.includes(version);
    record(`c.${name}`, cites, cites ? `${rel} cita ${version}` : `${rel} não cita a versão ${version}`);
  }

  // (d) CHANGELOG com bloco datado e sem "Não lançado"
  const changelogPath = join(root, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    record('d.changelog', false, 'CHANGELOG.md ausente');
  } else {
    const changelog = readFileSync(changelogPath, 'utf8');
    const heading = new RegExp(`^##\\s*\\[${escapeRegExp(version)}\\]\\s*[—–-]\\s*(\\S+)\\s*$`, 'mu');
    const match = heading.exec(changelog);
    if (!match) {
      record('d.changelog.block', false, `CHANGELOG.md sem bloco "## [${version}] — AAAA-MM-DD"`);
    } else {
      const realDate = isRealIsoDate(match[1]);
      record('d.changelog.block', realDate,
        `bloco [${version}] datado "${match[1]}"${realDate ? '' : ' (não é data ISO real)'}`);
    }
    const unreleased = UNRELEASED_HEADING.exec(changelog);
    record('d.changelog.unreleased', !unreleased,
      unreleased ? `CHANGELOG.md ainda tem bloco "${unreleased[0].trim()}"` : 'nenhum bloco "Não lançado"');
  }

  // (e) pastas de artefatos: manifesto e Setups só da versão atual
  const setupPattern = new RegExp(
    `^${escapeRegExp(productName)} Setup (.+?)\\.(exe|msi|msix|appx)(?:\\.(blockmap|sha256))?$`,
    'i',
  );
  for (const dirName of RELEASE_DIRS) {
    const dir = join(root, dirName);
    if (!existsSync(dir)) {
      record(`e.${dirName}`, true, `${dirName}/ ausente (aceito)`);
      continue;
    }
    const foreignSetups = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(setupPattern))
      .filter((match) => match && match[1] !== version)
      .map((match) => match[0]);
    record(`e.${dirName}.setups`, foreignSetups.length === 0,
      foreignSetups.length
        ? `Setup de outra versão em ${dirName}/: ${foreignSetups.join(', ')}`
        : `${dirName}/ só tem Setup ${version} (ou nenhum)`);

    const manifestPath = join(dir, 'release-manifest.json');
    if (!existsSync(manifestPath)) {
      record(`e.${dirName}.manifest`, true, `${dirName}/release-manifest.json ausente (aceito)`);
      continue;
    }
    let manifest;
    try {
      manifest = readJson(manifestPath);
    } catch (error) {
      record(`e.${dirName}.manifest`, false, `${dirName}/release-manifest.json ilegível: ${error.message}`);
      continue;
    }
    const manifestVersion = manifest.appVersion ?? manifest.version;
    record(`e.${dirName}.manifest`, manifestVersion === version,
      `${dirName}/release-manifest.json appVersion = "${manifestVersion}" (esperado "${version}")`);
    if (manifest.releaseManifestVersion !== undefined) {
      record(`e.${dirName}.manifestFormat`, manifest.releaseManifestVersion === GENERATOR_MANIFEST_VERSION,
        `${dirName}/release-manifest.json releaseManifestVersion = ${manifest.releaseManifestVersion} (gerador: ${GENERATOR_MANIFEST_VERSION})`);
    }
  }

  // (f) uma só RELEASE_MANIFEST_VERSION (código, independente da árvore verificada)
  if (checkManifestVersionAgreement) {
    record('f.releaseManifestVersion', VERSION_INFO_MANIFEST_VERSION === GENERATOR_MANIFEST_VERSION,
      `versionInfo.js = ${VERSION_INFO_MANIFEST_VERSION}, generate-release-manifest.mjs = ${GENERATOR_MANIFEST_VERSION}`);
    // (g) DATA_BUILD_ID é literal (o gate de pacote o procura no bundle) e segue o esquema vigente.
    record('g.dataBuildId', DATA_BUILD_ID === `schema-v${DB_SCHEMA_VERSION}`,
      `DATA_BUILD_ID = "${DATA_BUILD_ID}" (esperado "schema-v${DB_SCHEMA_VERSION}")`);
  }

  return { ok: errors.length === 0, version, checks, errors };
}

// ----------------------------------------------------------------------------
// Self-test: fixtures em pasta temporária.
// ----------------------------------------------------------------------------
function writeFixture(root, {
  version = '9.9.9',
  lockVersion,
  lockRootVersion,
  fallback,
  notes = true,
  checklist = true,
  checklistCitesVersion = true,
  changelogBlock = true,
  changelogDate = '2026-09-14',
  unreleased = false,
  foreignSetup = false,
  manifest = null,
  currentSetup = false,
} = {}) {
  const productName = 'Pesagens Individuais';
  mkdirSync(join(root, 'src', 'lib'), { recursive: true });
  mkdirSync(join(root, 'docs', 'release', version), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'pesagens-individuais',
    productName,
    version,
    build: {
      productName,
      win: { target: [{ target: 'nsis', arch: ['x64'] }] },
      nsis: { deleteAppDataOnUninstall: false },
    },
  }, null, 2));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
    name: 'pesagens-individuais',
    version: lockVersion ?? version,
    lockfileVersion: 3,
    packages: { '': { name: 'pesagens-individuais', version: lockRootVersion ?? version } },
  }, null, 2));
  writeFileSync(join(root, 'src', 'lib', 'appVersion.js'), [
    "export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined'",
    '  ? __APP_VERSION__',
    `  : '${fallback ?? version}';`,
    '',
  ].join('\n'));
  if (notes) {
    writeFileSync(join(root, 'docs', 'release', version, 'RELEASE-NOTES.md'),
      `# Pesagens Individuais ${version}\n\nNotas.\n`);
  }
  if (checklist) {
    writeFileSync(join(root, 'docs', 'release', version, 'RELEASE-CHECKLIST.md'),
      checklistCitesVersion
        ? `# Checklist da release ${version}\n\n- [x] Lint.\n`
        : '# Checklist da release\n\n- [x] Lint.\n');
  }
  const changelog = ['# Changelog', ''];
  if (unreleased) changelog.push('## [Não lançado] — pendente', '', '- item', '');
  if (changelogBlock) changelog.push(`## [${version}] — ${changelogDate}`, '', '### Added', '- item', '');
  changelog.push('## [1.0.0] — 2026-07-16', '', '- primeira release', '');
  writeFileSync(join(root, 'CHANGELOG.md'), changelog.join('\n'));
  if (foreignSetup || manifest || currentSetup) {
    const dir = join(root, 'release-unsigned');
    mkdirSync(dir, { recursive: true });
    if (foreignSetup) writeFileSync(join(dir, `${productName} Setup 1.0.0.exe`), 'antigo');
    if (currentSetup) writeFileSync(join(dir, `${productName} Setup ${version}.exe`), 'instalador de teste');
    if (manifest) writeFileSync(join(dir, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  }
  return root;
}

function assertGeneratedManifest(root) {
  const manifest = buildReleaseManifest({
    root,
    releaseDir: join(root, 'release-unsigned'),
    releaseKind: 'unsigned-diagnostic',
    now: new Date('2026-09-14T12:00:00.000Z'),
    gitCommit: 'abc1234',
  });
  const required = ['releaseManifestVersion', 'productName', 'appVersion', 'version', 'dbSchemaVersion',
    'backupFormatVersion', 'uiBuildId', 'dataBuildId', 'uiContract', 'dataContract', 'gitCommit',
    'buildTimestamp', 'platform', 'arch', 'installer', 'signed', 'distribution', 'features'];
  for (const field of required) {
    if (!(field in manifest)) throw new Error(`manifesto sem campo "${field}"`);
  }
  if (manifest.releaseManifestVersion !== GENERATOR_MANIFEST_VERSION) throw new Error('releaseManifestVersion divergente');
  if (manifest.appVersion !== '9.9.9' || manifest.version !== '9.9.9') throw new Error('appVersion/version do manifesto divergentes');
  if (manifest.signed !== false) throw new Error('signed deve ser false sem Authenticode');
  if (manifest.gitCommit !== 'abc1234' || manifest.buildTimestamp !== '2026-09-14T12:00:00.000Z') {
    throw new Error('gitCommit/buildTimestamp não propagados');
  }
  for (const field of ['file', 'sha256', 'sizeBytes', 'builtAt']) {
    if (!(field in manifest.installer)) throw new Error(`installer sem campo "${field}"`);
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.installer.sha256)) throw new Error('sha256 inválido');
  writeFileSync(join(root, 'release-unsigned', 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  const again = verifyVersionContract(root);
  if (!again.ok) throw new Error(`manifesto gerado não passa no gate: ${again.errors.join(' | ')}`);
}

function runSelfTest() {
  const base = mkdtempSync(join(tmpdir(), 'verify-version-contract-'));
  const results = [];
  let index = 0;
  const scenario = (name, expectOk, options, extraAssert) => {
    const root = join(base, `case-${String(++index).padStart(2, '0')}`);
    mkdirSync(root, { recursive: true });
    writeFixture(root, options);
    const outcome = verifyVersionContract(root);
    let ok = outcome.ok === expectOk;
    let note = outcome.errors.join(' | ') || 'sem erros';
    if (ok && extraAssert) {
      try {
        extraAssert(root, outcome);
      } catch (error) {
        ok = false;
        note = error.message;
      }
    }
    results.push({ name, expectOk, observedOk: outcome.ok, ok, note });
  };

  try {
    // Positivas
    scenario('positivo: árvore mínima sem pastas de release', true, {});
    scenario('positivo: release-unsigned com Setup atual e manifesto v2 do gerador', true,
      { currentSetup: true }, assertGeneratedManifest);
    // Negativas (>= 6)
    scenario('negativo: package-lock.version divergente', false, { lockVersion: '9.9.8' });
    scenario('negativo: package-lock.packages[""].version divergente', false, { lockRootVersion: '9.9.8' });
    scenario('negativo: fallback de appVersion.js errado', false, { fallback: '9.9.8' });
    scenario('negativo: RELEASE-NOTES.md ausente', false, { notes: false });
    scenario('negativo: RELEASE-CHECKLIST.md não cita a versão', false, { checklistCitesVersion: false });
    scenario('negativo: CHANGELOG sem bloco da versão', false, { changelogBlock: false });
    scenario('negativo: CHANGELOG com data placeholder', false, { changelogDate: 'AAAA-MM-DD' });
    scenario('negativo: CHANGELOG com data inexistente', false, { changelogDate: '2026-02-30' });
    scenario('negativo: bloco "Não lançado" presente', false, { unreleased: true });
    scenario('negativo: Setup de outra versão em release-unsigned/', false, { foreignSetup: true });
    scenario('negativo: manifesto com appVersion divergente', false, {
      manifest: { releaseManifestVersion: GENERATOR_MANIFEST_VERSION, appVersion: '9.9.8', version: '9.9.8' },
    });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  const failed = results.filter((item) => !item.ok);
  for (const item of results) {
    const expected = item.expectOk ? 'verde' : 'vermelho';
    const observed = item.observedOk ? 'verde' : 'vermelho';
    console.log(`${item.ok ? 'OK  ' : 'FAIL'} ${item.name} → esperado ${expected}, observado ${observed}${item.ok ? '' : ` — ${item.note}`}`);
  }
  if (failed.length > 0) {
    console.error(`FAIL: self-test com ${failed.length} cenário(s) incorreto(s)`);
    process.exit(1);
  }
  console.log('OK verify-version-contract --self-test');
  console.log(JSON.stringify({
    scenarios: results.length,
    positive: results.filter((item) => item.expectOk).length,
    negative: results.filter((item) => !item.expectOk).length,
    releaseManifestVersion: GENERATOR_MANIFEST_VERSION,
  }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    const outcome = verifyVersionContract(repoRoot);
    if (!outcome.ok) {
      for (const error of outcome.errors) console.error('FAIL:', error);
      process.exit(1);
    }
    console.log('OK verify-version-contract');
    console.log(JSON.stringify({
      version: outcome.version,
      releaseManifestVersion: GENERATOR_MANIFEST_VERSION,
      checks: outcome.checks.map(({ id, detail }) => ({ id, detail })),
    }, null, 2));
  }
}
