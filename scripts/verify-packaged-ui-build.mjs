import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, sep } from 'path';
import { fileURLToPath } from 'url';
import { extractFile, listPackage } from '@electron/asar';
import { UI_BUILD_ID, UI_MODEL } from '../src/components/modelobase1/uiBuildInfo.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const productPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const EXPECTED_VERSION = productPackage.version;
const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const productName = productPackage.build?.productName || productPackage.productName;
const releaseDirectoryName = String(process.env.RELEASE_DIR || 'release').trim();
const releaseDir = join(root, releaseDirectoryName);
const expectedInstallerName = `${productName} Setup ${EXPECTED_VERSION}.exe`;
const installerPath = join(releaseDir, expectedInstallerName);
const manifestPath = join(releaseDir, 'release-manifest.json');
const asarPath = join(releaseDir, 'win-unpacked', 'resources', 'app.asar');
const distAssetsPath = join(root, 'dist', 'assets');

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readAsar(logicalPath) {
  return extractFile(asarPath, logicalPath.split('/').join(sep)).toString('utf8');
}

assert(productPackage.version === EXPECTED_VERSION,
  `package.json deve estar em ${EXPECTED_VERSION} (obtido ${productPackage.version})`);
assert(packageLock.version === EXPECTED_VERSION,
  `package-lock.json deve estar em ${EXPECTED_VERSION} (obtido ${packageLock.version})`);
assert(packageLock.packages?.['']?.version === EXPECTED_VERSION,
  `package-lock packages[""] deve estar em ${EXPECTED_VERSION}`);
assert(existsSync(distAssetsPath), 'dist/assets não encontrado — execute o build limpo');
assert(existsSync(asarPath), `${releaseDirectoryName}/win-unpacked/resources/app.asar não encontrado`);
assert(existsSync(installerPath), `Setup esperado não encontrado: ${expectedInstallerName}`);
assert(existsSync(manifestPath), 'release/release-manifest.json não encontrado');

const distAssets = readdirSync(distAssetsPath)
  .filter((name) => /\.(js|css)$/.test(name))
  .map((name) => join(distAssetsPath, name));
assert(distAssets.length > 0, 'nenhum bundle JS/CSS encontrado em dist/assets');
const distText = distAssets.map((file) => readFileSync(file, 'utf8')).join('\n');
for (const marker of [UI_BUILD_ID, UI_MODEL, 'mb1-scope', 'mb1-app-shell']) {
  assert(distText.includes(marker), `dist deve conter o marcador "${marker}"`);
}

const packedPackage = JSON.parse(readAsar('package.json'));
assert(packedPackage.version === EXPECTED_VERSION,
  `package.json no app.asar deve estar em ${EXPECTED_VERSION} (obtido ${packedPackage.version})`);

const packedEntries = listPackage(asarPath);
const packedAssets = packedEntries
  .filter((entry) => /[\\/]dist[\\/]assets[\\/].+\.(js|css)$/.test(entry))
  .map((entry) => entry.replace(/^[/\\]/, ''));
assert(packedAssets.length > 0, 'app.asar não contém bundles em dist/assets');
const packedText = packedAssets.map((entry) => extractFile(asarPath, entry).toString('utf8')).join('\n');
for (const marker of [UI_BUILD_ID, UI_MODEL, 'mb1-scope', 'mb1-app-shell']) {
  assert(packedText.includes(marker), `app.asar deve conter o marcador "${marker}"`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert(manifest.version === EXPECTED_VERSION,
  `manifesto deve estar em ${EXPECTED_VERSION} (obtido ${manifest.version})`);
assert(manifest.installer?.file === expectedInstallerName,
  `manifesto deve apontar para ${expectedInstallerName}`);
assert(manifest.installer?.sha256?.toLowerCase() === sha256(installerPath),
  'SHA256 do manifesto não confere com o Setup');
assert(manifest.installer?.sizeBytes === statSync(installerPath).size,
  'tamanho do manifesto não confere com o Setup');

const newestBundleTime = Math.max(...distAssets.map((file) => statSync(file).mtimeMs));
assert(statSync(installerPath).mtimeMs >= newestBundleTime,
  'Setup é mais antigo que os bundles atuais — possível instalador desatualizado');

console.log('OK verify-packaged-ui-build');
console.log(JSON.stringify({
  version: EXPECTED_VERSION,
  installer: expectedInstallerName,
  installerSha256: sha256(installerPath),
  appAsar: `${releaseDirectoryName}/win-unpacked/resources/app.asar`,
  uiBuildId: UI_BUILD_ID,
  uiModel: UI_MODEL,
  distMarkers: true,
  packagedMarkers: true,
  manifestMatches: true,
  installerNewerThanBundles: true,
}, null, 2));
