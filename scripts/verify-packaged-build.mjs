// Gate de release `packaged:build:verify` (ADR-037, ADR-039; docs 13 §4 item 3).
// Estende verify-packaged-ui-build.mjs: além dos marcadores visuais, prova que
// dist/assets e o app.asar carregam os identificadores de build (UI_BUILD_ID,
// DATA_BUILD_ID, schema-v<N>) e a versão do package.json, que o manifesto
// descreve o Setup real (SHA-256, tamanho, builtAt, cinco eixos de versão) e que
// o Setup não é anterior aos bundles nem ao app.asar.
//
// Uso:
//   node scripts/verify-packaged-build.mjs                       (release/)
//   RELEASE_DIR=release-unsigned node scripts/verify-packaged-build.mjs
//   node scripts/verify-packaged-build.mjs --self-test           (fixtures positivas e negativas)
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPackage, extractFile, listPackage, uncache } from '@electron/asar';
import {
  BACKUP_FORMAT_VERSION,
  DATA_BUILD_ID,
  DATA_CONTRACT_VERSION,
  DB_SCHEMA_VERSION,
  UI_BUILD_ID,
  UI_CONTRACT_VERSION,
  UI_MODEL,
} from '../src/versioning/versionInfo.js';
import { buildReleaseManifest } from './generate-release-manifest.mjs';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP_NAME_PATTERN = /^Pesagens Individuais Setup \d+\.\d+\.\d+\.exe$/;

export class PackagedBuildError extends Error {}

const fail = (message) => { throw new PackagedBuildError(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const sha256 = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Marcadores obrigatórios nos bundles (dist/assets e app.asar). */
export function requiredMarkers(version) {
  return {
    text: [...new Set([UI_BUILD_ID, UI_MODEL, DATA_BUILD_ID, `schema-v${DB_SCHEMA_VERSION}`, 'mb1-scope', 'mb1-app-shell'])],
    // Vite injeta __APP_VERSION__ como string literal: "1.2.0" (ou '1.2.0').
    version: new RegExp(`(["'])${escapeRegExp(version)}\\1`),
  };
}

function readBundles(files, reader) {
  return files.map(reader).join('\n');
}

/**
 * Verifica o pacote. releaseDirName pode ser relativo ao root ou absoluto.
 * Lança PackagedBuildError com mensagem clara na primeira inconsistência.
 */
export function verifyPackagedBuild({ root = PROJECT_ROOT, releaseDirName = process.env.RELEASE_DIR || 'release' } = {}) {
  releaseDirName = String(releaseDirName).trim();
  const pkg = readJson(join(root, 'package.json'));
  const version = pkg.version;
  const productName = pkg.build?.productName || pkg.productName;
  const lock = readJson(join(root, 'package-lock.json'));
  check(lock.version === version, `package-lock.json deve estar em ${version} (obtido ${lock.version})`);
  check(lock.packages?.['']?.version === version, `package-lock packages[""] deve estar em ${version} (obtido ${lock.packages?.['']?.version})`);

  const releaseDir = resolve(root, releaseDirName);
  const expectedInstallerName = `${productName} Setup ${version}.exe`;
  check(SETUP_NAME_PATTERN.test(expectedInstallerName),
    `nome do Setup fora do padrão "Pesagens Individuais Setup X.Y.Z.exe": ${expectedInstallerName}`);
  const installerPath = join(releaseDir, expectedInstallerName);
  const manifestPath = join(releaseDir, 'release-manifest.json');
  const asarPath = join(releaseDir, 'win-unpacked', 'resources', 'app.asar');
  const distAssetsPath = join(root, 'dist', 'assets');

  check(existsSync(distAssetsPath), 'dist/assets não encontrado — execute o build limpo antes do gate');
  check(existsSync(releaseDir), `${releaseDirName}/ não encontrado — gere o pacote antes do gate`);
  check(existsSync(asarPath), `${releaseDirName}/win-unpacked/resources/app.asar não encontrado`);
  if (!existsSync(installerPath)) {
    const otherSetups = readdirSync(releaseDir).filter((name) => /^.+ Setup .+\.exe$/i.test(name));
    fail(otherSetups.length > 0
      ? `Setup encontrado é de outra versão: ${otherSetups.join(', ')} — esperado "${expectedInstallerName}" (package.json ${version}). Nunca reutilize um .exe antigo; gere o pacote da versão atual.`
      : `Setup esperado não encontrado: ${expectedInstallerName}`);
  }
  check(existsSync(manifestPath), `${releaseDirName}/release-manifest.json não encontrado — execute release:manifest`);

  // 1) dist/assets carrega marcadores e versão.
  const markers = requiredMarkers(version);
  const distBundles = readdirSync(distAssetsPath).filter((name) => /\.(js|css)$/.test(name)).map((name) => join(distAssetsPath, name));
  check(distBundles.length > 0, 'nenhum bundle JS/CSS encontrado em dist/assets');
  const distText = readBundles(distBundles, (file) => readFileSync(file, 'utf8'));
  for (const marker of markers.text) check(distText.includes(marker), `dist/assets deve conter o marcador "${marker}"`);
  check(markers.version.test(distText), `dist/assets deve conter a versão "${version}" — bundle desatualizado, refaça o build`);

  // 2) app.asar: versão e marcadores. `uncache` descarta o cabeçalho que a
  // biblioteca guarda por caminho, para um pacote refeito nunca ser lido do cache.
  uncache(asarPath);
  const packedPackage = JSON.parse(extractFile(asarPath, 'package.json').toString('utf8'));
  check(packedPackage.version === version, `package.json no app.asar deve estar em ${version} (obtido ${packedPackage.version})`);
  const packedBundles = listPackage(asarPath)
    .filter((entry) => /[\\/]dist[\\/]assets[\\/].+\.(js|css)$/.test(entry))
    .map((entry) => entry.replace(/^[/\\]/, ''));
  check(packedBundles.length > 0, 'app.asar não contém bundles em dist/assets');
  const packedText = readBundles(packedBundles, (entry) => extractFile(asarPath, entry).toString('utf8'));
  for (const marker of markers.text) check(packedText.includes(marker), `app.asar deve conter o marcador "${marker}"`);
  check(markers.version.test(packedText), `app.asar deve conter a versão "${version}"`);

  // 3) Manifesto descreve este Setup e os cinco eixos de versão.
  const manifest = readJson(manifestPath);
  const installerStat = statSync(installerPath);
  const installerSha256 = sha256(installerPath);
  const expectedFields = {
    version,
    // Nomes do manifesto formato 2 (docs/arquitetura-produto/13 e engineering/VERSIONING).
    dbSchemaVersion: DB_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    check(field in manifest, `manifesto sem o campo "${field}" — regenere com release:manifest`);
    check(manifest[field] === expected,
      `manifesto.${field} deve ser ${JSON.stringify(expected)} (obtido ${JSON.stringify(manifest[field])}) — manifesto de outra versão/esquema`);
  }
  check(manifest.installer?.file === expectedInstallerName,
    `manifesto.installer.file deve ser "${expectedInstallerName}" (obtido "${manifest.installer?.file}")`);
  check(String(manifest.installer?.sha256 || '').toLowerCase() === installerSha256, 'SHA-256 do manifesto não confere com o Setup');
  check(manifest.installer?.sizeBytes === installerStat.size,
    `tamanho do manifesto (${manifest.installer?.sizeBytes}) não confere com o Setup (${installerStat.size})`);
  const builtAt = manifest.installer?.builtAt;
  check(typeof builtAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(builtAt) && Number.isFinite(Date.parse(builtAt)),
    `manifesto.installer.builtAt deve ser um timestamp ISO (obtido ${JSON.stringify(builtAt)})`);
  check(typeof manifest.signed === 'boolean', 'manifesto.signed deve ser booleano');
  check(typeof manifest.distribution === 'string' && manifest.distribution.length > 0, 'manifesto.distribution ausente');
  const diagnostic = manifest.distribution === 'unsigned-diagnostic' || /unsigned/i.test(releaseDirName);
  check(!(diagnostic && manifest.signed === true),
    'manifesto.signed=true em pacote de diagnóstico sem assinatura — proibido (ADR-039)');

  // 4) Setup não é anterior aos bundles nem ao app.asar.
  const newestBundleMs = Math.max(...distBundles.map((file) => statSync(file).mtimeMs));
  check(installerStat.mtimeMs >= newestBundleMs,
    `Setup (${installerStat.mtime.toISOString()}) é mais antigo que os bundles de dist/assets (${new Date(newestBundleMs).toISOString()}) — instalador desatualizado; refaça o pacote`);
  const asarStat = statSync(asarPath);
  check(installerStat.mtimeMs >= asarStat.mtimeMs,
    `Setup (${installerStat.mtime.toISOString()}) é mais antigo que o app.asar (${asarStat.mtime.toISOString()}) — instalador desatualizado`);

  return {
    version,
    releaseDir: releaseDirName,
    installer: expectedInstallerName,
    installerSha256,
    sizeBytes: installerStat.size,
    builtAt,
    signed: manifest.signed,
    distribution: manifest.distribution,
    dbSchema: DB_SCHEMA_VERSION,
    backupFormat: BACKUP_FORMAT_VERSION,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
    markers: markers.text,
    distMarkers: true,
    packagedMarkers: true,
    manifestMatches: true,
    installerNewerThanBundles: true,
  };
}

// ---------------------------------------------------------------------------
// Self-test: fixtures sintéticas (positiva + negativas). Não toca em release/.
// ---------------------------------------------------------------------------
const touchNow = (path) => { const now = new Date(); utimesSync(path, now, now); };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// createPackage do @electron/asar resolve antes do stream de saída terminar
// (out.end() sem aguardar 'finish'); espera o arquivo ficar íntegro antes de usar.
async function waitForAsar(asarPath, expectedBundleText) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      uncache(asarPath);
      JSON.parse(extractFile(asarPath, 'package.json').toString('utf8'));
      if (extractFile(asarPath, join('dist', 'assets', 'index-fixture.js')).toString('utf8') === expectedBundleText) return;
    } catch {
      // arquivo ainda incompleto
    }
    await sleep(20);
  }
  throw new Error(`fixture app.asar não ficou íntegro: ${asarPath}`);
}

async function buildFixture({
  version, releaseDirName = 'release-unsigned', releaseKind = 'unsigned-diagnostic',
  distMarkers, asarMarkers, distVersion = version, asarPackageVersion = version, lockVersion = version,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'verify-packaged-build-'));
  const markers = requiredMarkers(version).text;
  const bundle = (list, bundleVersion) => [...list, `const v="${bundleVersion}";`].join('\n');
  const pkg = {
    name: 'pesagens-individuais',
    productName: 'Pesagens Individuais',
    version,
    build: { productName: 'Pesagens Individuais', nsis: { deleteAppDataOnUninstall: false } },
  };
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: lockVersion, packages: { '': { version: lockVersion } } }));
  mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
  writeFileSync(join(root, 'dist', 'assets', 'index-fixture.js'), bundle(distMarkers ?? markers, distVersion));

  const asarSource = join(root, 'asar-src');
  mkdirSync(join(asarSource, 'dist', 'assets'), { recursive: true });
  writeFileSync(join(asarSource, 'package.json'), JSON.stringify({ ...pkg, version: asarPackageVersion }));
  const asarBundleText = bundle(asarMarkers ?? markers, version);
  writeFileSync(join(asarSource, 'dist', 'assets', 'index-fixture.js'), asarBundleText);
  const releaseDir = join(root, releaseDirName);
  const asarPath = join(releaseDir, 'win-unpacked', 'resources', 'app.asar');
  mkdirSync(dirname(asarPath), { recursive: true });
  await createPackage(asarSource, asarPath);
  await waitForAsar(asarPath, asarBundleText);

  const installerPath = join(releaseDir, `Pesagens Individuais Setup ${version}.exe`);
  writeFileSync(installerPath, randomBytes(4096));
  const manifestPath = join(releaseDir, 'release-manifest.json');
  // buildReleaseManifest recebe o caminho do diretório e devolve o manifesto.
  const manifest = buildReleaseManifest({ root, releaseDir, releaseKind });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { root, releaseDir, releaseDirName, installerPath, manifestPath, asarPath, manifest };
}

const rewriteManifest = (fixture, mutate) => {
  const manifest = readJson(fixture.manifestPath);
  mutate(manifest);
  writeFileSync(fixture.manifestPath, JSON.stringify(manifest, null, 2));
};

async function runSelfTest() {
  const version = readJson(join(PROJECT_ROOT, 'package.json')).version;
  const fixtures = [];
  const track = (fixture) => { fixtures.push(fixture); return fixture; };
  const expectFail = (label, pattern, fixture) => {
    assert.throws(() => verifyPackagedBuild({ root: fixture.root, releaseDirName: fixture.releaseDirName }),
      (error) => error instanceof PackagedBuildError && pattern.test(error.message),
      `${label}: o gate deveria falhar com /${pattern.source}/`);
    return label;
  };
  const passed = [];
  const failedAsExpected = [];

  try {
    // Positiva: pacote de diagnóstico correto passa e reporta signed=false.
    const diagnostic = track(await buildFixture({ version }));
    const diagnosticSummary = verifyPackagedBuild({ root: diagnostic.root, releaseDirName: diagnostic.releaseDirName });
    assert.equal(diagnosticSummary.version, version);
    assert.equal(diagnosticSummary.signed, false);
    assert.equal(diagnosticSummary.distribution, 'unsigned-diagnostic');
    assert.equal(diagnosticSummary.dataBuildId, DATA_BUILD_ID);
    assert.equal(diagnosticSummary.dbSchema, DB_SCHEMA_VERSION);
    assert.equal(diagnosticSummary.backupFormat, BACKUP_FORMAT_VERSION);
    passed.push('diagnóstico correto');

    // Positiva: release/ oficial ainda sem Authenticode (signed=false) passa.
    const official = track(await buildFixture({ version, releaseDirName: 'release', releaseKind: 'official-signed' }));
    assert.equal(verifyPackagedBuild({ root: official.root, releaseDirName: official.releaseDirName }).signed, false);
    passed.push('release oficial sem assinatura (signed=false)');

    // Negativas.
    const [major, minor, patch] = version.split('.').map(Number);
    const otherVersion = `${major}.${minor}.${patch + 1}`;
    const wrongSetup = track(await buildFixture({ version }));
    renameSync(wrongSetup.installerPath, join(wrongSetup.releaseDir, `Pesagens Individuais Setup ${otherVersion}.exe`));
    failedAsExpected.push(expectFail('Setup de outra versão', /outra versão/, wrongSetup));

    const oldSetup = track(await buildFixture({ version }));
    utimesSync(oldSetup.installerPath, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
    failedAsExpected.push(expectFail('Setup mais antigo que os bundles', /mais antigo/, oldSetup));

    const markers = requiredMarkers(version).text;
    const distSemDataBuild = track(await buildFixture({ version, distMarkers: markers.filter((m) => m !== DATA_BUILD_ID) }));
    failedAsExpected.push(expectFail('dist sem DATA_BUILD_ID', /dist\/assets deve conter o marcador/, distSemDataBuild));

    const distSemUiBuild = track(await buildFixture({ version, distMarkers: markers.filter((m) => m !== UI_BUILD_ID) }));
    failedAsExpected.push(expectFail('dist sem UI_BUILD_ID', /dist\/assets deve conter o marcador/, distSemUiBuild));

    const distSemVersao = track(await buildFixture({ version, distVersion: otherVersion }));
    failedAsExpected.push(expectFail('dist com versão antiga', /deve conter a versão/, distSemVersao));

    const asarSemMarcador = track(await buildFixture({ version, asarMarkers: markers.filter((m) => m !== DATA_BUILD_ID) }));
    failedAsExpected.push(expectFail('app.asar sem DATA_BUILD_ID', /app\.asar deve conter o marcador/, asarSemMarcador));

    const asarOutraVersao = track(await buildFixture({ version, asarPackageVersion: otherVersion }));
    failedAsExpected.push(expectFail('app.asar de outra versão', /app\.asar deve estar em/, asarOutraVersao));

    const lockDivergente = track(await buildFixture({ version, lockVersion: otherVersion }));
    failedAsExpected.push(expectFail('package-lock divergente', /package-lock/, lockDivergente));

    const shaErrado = track(await buildFixture({ version }));
    rewriteManifest(shaErrado, (m) => { m.installer.sha256 = 'f'.repeat(64); });
    failedAsExpected.push(expectFail('SHA-256 divergente', /SHA-256/, shaErrado));

    const tamanhoErrado = track(await buildFixture({ version }));
    rewriteManifest(tamanhoErrado, (m) => { m.installer.sizeBytes += 1; });
    failedAsExpected.push(expectFail('tamanho divergente', /tamanho/, tamanhoErrado));

    const semDbSchema = track(await buildFixture({ version }));
    rewriteManifest(semDbSchema, (m) => { delete m.dbSchemaVersion; });
    failedAsExpected.push(expectFail('manifesto sem dbSchemaVersion', /sem o campo "dbSchemaVersion"/, semDbSchema));

    const esquemaErrado = track(await buildFixture({ version }));
    rewriteManifest(esquemaErrado, (m) => { m.dataBuildId = 'schema-v0'; m.dbSchemaVersion = 0; });
    failedAsExpected.push(expectFail('manifesto de outro esquema', /manifesto\.dbSchemaVersion/, esquemaErrado));

    const versaoManifesto = track(await buildFixture({ version }));
    rewriteManifest(versaoManifesto, (m) => { m.version = otherVersion; });
    failedAsExpected.push(expectFail('manifesto de outra versão', /manifesto\.version/, versaoManifesto));

    const builtAtInvalido = track(await buildFixture({ version }));
    rewriteManifest(builtAtInvalido, (m) => { m.installer.builtAt = 'ontem'; });
    failedAsExpected.push(expectFail('builtAt inválido', /builtAt/, builtAtInvalido));

    const assinadoFalso = track(await buildFixture({ version }));
    rewriteManifest(assinadoFalso, (m) => { m.signed = true; });
    failedAsExpected.push(expectFail('signed=true em diagnóstico', /signed=true/, assinadoFalso));

    const semManifesto = track(await buildFixture({ version }));
    rmSync(semManifesto.manifestPath);
    failedAsExpected.push(expectFail('manifesto ausente', /release-manifest\.json não encontrado/, semManifesto));

    // Sanidade do próprio self-test: mutação neutra continua passando.
    const neutro = track(await buildFixture({ version }));
    touchNow(neutro.installerPath);
    verifyPackagedBuild({ root: neutro.root, releaseDirName: neutro.releaseDirName });
    passed.push('mutação neutra (touch do Setup) continua passando');
  } finally {
    for (const fixture of fixtures) rmSync(fixture.root, { recursive: true, force: true });
  }

  console.log('OK verify-packaged-build (self-test)');
  console.log(JSON.stringify({ version, positivas: passed, negativas: failedAsExpected, totalNegativas: failedAsExpected.length }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
  } else {
    try {
      const summary = verifyPackagedBuild();
      console.log('OK verify-packaged-build');
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      if (!(error instanceof PackagedBuildError)) throw error;
      console.error('FAIL:', error.message);
      process.exit(1);
    }
  }
}
