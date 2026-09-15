// Gera release-manifest.json (ADR-037/ADR-039; docs/arquitetura-produto/13 §2).
// Campos de versão vêm de src/versioning/versionInfo.js — nunca digitados aqui.
// A versão do app vem do package.json (fonte única; em Node o APP_VERSION do
// versionInfo é apenas o fallback do bundler e não deve ser usado para release).
//
// Uso: node scripts/generate-release-manifest.mjs
//      RELEASE_DIR=release-unsigned RELEASE_KIND=unsigned-diagnostic node scripts/generate-release-manifest.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BACKUP_FORMAT_VERSION,
  DATA_BUILD_ID,
  DATA_CONTRACT_VERSION,
  DB_SCHEMA_VERSION,
  UI_BUILD_ID,
  UI_CONTRACT_VERSION,
} from '../src/versioning/versionInfo.js';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Monta o manifesto da release a partir do Setup presente em releaseDirName.
 * releaseDirName pode ser relativo ao root (release, release-unsigned) ou absoluto.
 * Lança Error se o instalador da versão do package.json não existir.
 */
export function buildReleaseManifest({
  root = PROJECT_ROOT,
  releaseDirName = process.env.RELEASE_DIR || 'release',
  releaseKind = process.env.RELEASE_KIND || 'official-signed',
} = {}) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const releaseDir = resolve(root, String(releaseDirName).trim());
  const version = pkg.version;
  const productName = pkg.build?.productName || pkg.productName;
  const installerName = `${productName} Setup ${version}.exe`;
  const installerPath = join(releaseDir, installerName);

  if (!existsSync(installerPath)) {
    throw new Error(`instalador não encontrado: ${installerPath}. Gere o instalador com "npm run dist" antes do manifesto.`);
  }

  const installerStat = statSync(installerPath);
  const sha256 = createHash('sha256').update(readFileSync(installerPath)).digest('hex');

  // `signed` é SEMPRE false nesta fase: ainda não existe certificado Authenticode
  // (ADR-039). Não pode derivar de RELEASE_KIND — um pacote não assinado jamais
  // vira "assinado" por variável de ambiente. Quando o certificado existir, o
  // valor deve ser produzido por verify-release-signature.mjs (que roda antes
  // do manifesto no `npm run dist`), e só então passar a true.
  const signed = false;

  const manifest = {
    productName,
    version,
    platform: 'win32',
    distribution: String(releaseKind),
    signed,
    // Cinco eixos de versão + identificadores de build (ADR-037).
    dbSchema: DB_SCHEMA_VERSION,
    backupFormat: BACKUP_FORMAT_VERSION,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
    installer: {
      file: installerName,
      sha256,
      sizeBytes: installerStat.size,
      // Momento em que o Setup foi gravado pelo electron-builder.
      builtAt: installerStat.mtime.toISOString(),
    },
    generatedAt: new Date().toISOString(),
    database: {
      engine: 'IndexedDB/Dexie',
      storage: 'renderer/IndexedDB',
      schemaVersion: DB_SCHEMA_VERSION,
      preservesDataOnUninstall: pkg.build?.nsis?.deleteAppDataOnUninstall === false,
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

  return { manifest, manifestPath: join(releaseDir, 'release-manifest.json'), installerPath, releaseDir };
}

export function writeReleaseManifest(options) {
  const result = buildReleaseManifest(options);
  writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2) + '\n', 'utf8');
  return result;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { manifest, manifestPath } = writeReleaseManifest();
    console.log('OK generate-release-manifest');
    console.log(JSON.stringify({ manifestFile: manifestPath, ...manifest }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
}
