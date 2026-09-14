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
  console.error('Gere o instalador com "npm run dist" antes do checksum.');
  process.exit(1);
}

const buffer = readFileSync(installerPath);
const sha256 = createHash('sha256').update(buffer).digest('hex');
const sizeBytes = statSync(installerPath).size;

// Formato compatível com `sha256sum -c`: "<hash>  <arquivo>"
const checksumFile = `${installerPath}.sha256`;
writeFileSync(checksumFile, `${sha256}  ${installerName}\n`, 'utf8');

console.log('OK generate-release-checksum');
console.log(JSON.stringify({
  installer: installerName,
  sizeBytes,
  sha256,
  checksumFile: `${releaseDirectoryName}/${installerName}.sha256`,
}, null, 2));
