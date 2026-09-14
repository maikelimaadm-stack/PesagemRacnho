import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const releaseDirs = [join(root, 'release'), join(root, 'release-unsigned')];
const pkg = JSON.parse(await import('node:fs/promises').then(({ readFile }) =>
  readFile(join(root, 'package.json'), 'utf8')));

const productName = String(pkg.productName || pkg.name || '').trim();
const currentVersion = String(pkg.version || '').trim();
const checkOnly = process.argv.includes('--check');

if (!productName || !currentVersion) {
  throw new Error('package.json precisa declarar productName/name e version.');
}

const existingReleaseDirs = releaseDirs.filter(existsSync);
if (existingReleaseDirs.length === 0) {
  console.log('OK release: pastas de artefatos ainda não existem.');
  process.exit(0);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const setupPattern = new RegExp(
  `^${escapeRegExp(productName)} Setup (.+?)\\.(exe|msi|msix|appx)(?:\\.(blockmap|sha256))?$`,
  'i',
);

const staleArtifacts = existingReleaseDirs
  .flatMap((directory) => readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(setupPattern);
      return match && match[1] !== currentVersion ? { directory, name: entry.name } : null;
    }))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

const staleUnpackedDirectories = existingReleaseDirs
  .map((directory) => {
    const unpackedDirectory = join(directory, 'win-unpacked');
    const asarPath = join(unpackedDirectory, 'resources', 'app.asar');
    if (!existsSync(asarPath)) return null;
    let packagedVersion = null;
    try {
      packagedVersion = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8')).version;
    } catch {
      packagedVersion = 'ilegível';
    }
    return packagedVersion !== currentVersion
      ? { directory, target: unpackedDirectory, packagedVersion }
      : null;
  })
  .filter(Boolean);

if (checkOnly && (staleArtifacts.length > 0 || staleUnpackedDirectories.length > 0)) {
  throw new Error(
    `Artefatos antigos encontrados: ${[
      ...staleArtifacts.map((item) => item.name),
      ...staleUnpackedDirectories.map((item) => `win-unpacked (${item.packagedVersion})`),
    ].join(', ')}`,
  );
}

if (!checkOnly) {
  for (const artifact of staleArtifacts) {
    rmSync(join(artifact.directory, artifact.name), { force: true });
  }
  for (const artifact of staleUnpackedDirectories) {
    const resolvedParent = `${resolve(artifact.directory)}${sep}`.toLowerCase();
    const resolvedTarget = resolve(artifact.target).toLowerCase();
    if (!resolvedTarget.startsWith(resolvedParent) || !resolvedTarget.endsWith(`${sep}win-unpacked`)) {
      throw new Error(`Recusa de segurança ao limpar diretório fora da saída esperada: ${artifact.target}`);
    }
    rmSync(artifact.target, { recursive: true, force: true });
  }
}

console.log(
  checkOnly
    ? `OK release: somente a versão atual ${currentVersion} está presente.`
    : `OK release: ${staleArtifacts.length + staleUnpackedDirectories.length} artefato(s) antigo(s) removido(s); versão atual ${currentVersion} preservada.`,
);
