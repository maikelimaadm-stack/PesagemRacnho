import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseDirectoryName = String(process.env.RELEASE_DIR || 'release').trim();
const releaseDir = join(root, releaseDirectoryName);

const version = pkg.version;
const productName = pkg.build?.productName || pkg.productName;
const installerName = `${productName} Setup ${version}.exe`;
const installerPath = join(releaseDir, installerName);

if (!existsSync(installerPath)) {
  console.error('FAIL: instalador não encontrado:', installerPath);
  console.error('Gere o instalador com "npm run dist" antes do manifesto.');
  process.exit(1);
}

const buffer = readFileSync(installerPath);
const sha256 = createHash('sha256').update(buffer).digest('hex');
const sizeBytes = statSync(installerPath).size;

const deleteAppDataOnUninstall = pkg.build?.nsis?.deleteAppDataOnUninstall;

const manifest = {
  productName,
  version,
  platform: 'win32',
  distribution: String(process.env.RELEASE_KIND || 'official-signed'),
  installer: {
    file: installerName,
    sha256,
    sizeBytes,
  },
  database: {
    engine: 'IndexedDB/Dexie',
    storage: 'renderer/IndexedDB',
    preservesDataOnUninstall: deleteAppDataOnUninstall === false,
  },
  features: {
    offline: true,
    backup: true,
    restore: true,
    exportCsv: true,
    exportJson: true,
    importJson: true,
    login: false,
    permissions: false,
    cloud: false,
  },
};

const manifestPath = join(releaseDir, 'release-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('OK generate-release-manifest');
console.log(JSON.stringify({ manifestFile: `${releaseDirectoryName}/release-manifest.json`, ...manifest }, null, 2));
