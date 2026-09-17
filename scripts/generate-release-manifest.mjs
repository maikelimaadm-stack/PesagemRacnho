// Gerador do release-manifest.json (ADR-039, ADR-047; contrato: docs/arquitetura-produto/13 §2).
// Dono da constante RELEASE_MANIFEST_VERSION: este arquivo. src/versioning/versionInfo.js
// reexporta o mesmo valor para a UI, e scripts/verify-version-contract.mjs prova a igualdade.
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { UI_BUILD_ID } from '../src/components/modelobase1/uiBuildInfo.js';
import {
  DB_SCHEMA_VERSION,
  BACKUP_FORMAT_VERSION,
  UI_CONTRACT_VERSION,
  DATA_CONTRACT_VERSION,
  DATA_BUILD_ID,
} from '../src/versioning/versionInfo.js';

// Versão 2 (1.1.18): + releaseManifestVersion, appVersion, dbSchemaVersion, backupFormatVersion,
// uiBuildId, dataBuildId, uiContract, dataContract, gitCommit, buildTimestamp, arch, installer.builtAt, signed.
export const RELEASE_MANIFEST_VERSION = 2;

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Commit curto do HEAD, com sufixo "-dirty" quando há alterações não commitadas —
 * a mesma regra do bundle (vite.config.js), para o manifesto e a tela de Manutenção
 * mostrarem o mesmo valor. Null quando git não está disponível (nunca interrompe a release).
 */
export function resolveGitCommit(cwd = defaultRoot) {
  try {
    const out = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    if (!out) return null;
    const dirty = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim().length > 0;
    return dirty ? `${out}-dirty` : out;
  } catch {
    return null;
  }
}

/**
 * Monta o manifesto a partir do package.json e do instalador presente em releaseDir.
 * Puro exceto pela leitura do instalador; usado pelo CLI e pelo self-test do gate.
 */
export function buildReleaseManifest({
  root = defaultRoot,
  releaseDir,
  releaseKind = String(process.env.RELEASE_KIND || 'official-signed'),
  now = new Date(),
  gitCommit = resolveGitCommit(root),
} = {}) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const appVersion = pkg.version;
  const productName = pkg.build?.productName || pkg.productName;
  const installerName = `${productName} Setup ${appVersion}.exe`;
  const installerPath = join(releaseDir, installerName);

  if (!existsSync(installerPath)) {
    const error = new Error(`instalador não encontrado: ${installerPath}`);
    error.code = 'INSTALLER_NOT_FOUND';
    throw error;
  }

  const buffer = readFileSync(installerPath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const installerStat = statSync(installerPath);
  const deleteAppDataOnUninstall = pkg.build?.nsis?.deleteAppDataOnUninstall;
  const arch = pkg.build?.win?.target?.[0]?.arch?.[0] || process.arch;

  return {
    releaseManifestVersion: RELEASE_MANIFEST_VERSION,
    productName,
    appVersion,
    // Compatibilidade: scripts/verify-packaged-ui-build.mjs e manifestos anteriores leem "version".
    version: appVersion,
    dbSchemaVersion: DB_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    gitCommit,
    buildTimestamp: now.toISOString(),
    platform: 'win32',
    arch,
    installer: {
      file: installerName,
      sha256,
      sizeBytes: installerStat.size,
      builtAt: installerStat.mtime.toISOString(),
    },
    // Sempre false até existir assinatura Authenticode válida (ADR-039). Nenhum pacote
    // sem assinatura é release oficial; release-unsigned/ é diagnóstico local.
    signed: false,
    distribution: releaseKind,
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
      login: true,
      permissions: true,
      cloud: false,
    },
  };
}

/** Gera e grava <releaseDir>/release-manifest.json; devolve { manifestPath, manifest }. */
export function writeReleaseManifest({
  root = defaultRoot,
  releaseDirectoryName = String(process.env.RELEASE_DIR || 'release').trim(),
  releaseKind,
  now,
} = {}) {
  const releaseDir = join(root, releaseDirectoryName);
  const manifest = buildReleaseManifest({ root, releaseDir, releaseKind, now });
  const manifestPath = join(releaseDir, 'release-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { manifestPath, manifestFile: `${releaseDirectoryName}/release-manifest.json`, manifest };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const { manifestFile, manifest } = writeReleaseManifest();
    console.log('OK generate-release-manifest');
    console.log(JSON.stringify({ manifestFile, ...manifest }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    if (error.code === 'INSTALLER_NOT_FOUND') {
      console.error('Gere o instalador com "npm run dist" (ou dist:unsigned) antes do manifesto.');
    }
    process.exit(1);
  }
}
