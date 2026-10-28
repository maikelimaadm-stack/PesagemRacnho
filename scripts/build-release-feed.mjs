// Monta o JSON público de "última versão Windows" a partir do release-manifest.json local.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const RELEASE_FEED_VERSION = 1;

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {object} opts
 * @param {string} [opts.root]
 * @param {string} opts.releaseDir — pasta release/ ou release-unsigned/
 * @param {string} opts.downloadUrl — URL HTTPS pública do Setup.exe no Supabase (ou CDN)
 * @param {string} [opts.releaseNotesUrl]
 */
export function buildReleaseFeed({
  root = defaultRoot,
  releaseDir,
  downloadUrl,
  releaseNotesUrl = null,
  now = new Date(),
} = {}) {
  if (!releaseDir) throw new Error('releaseDir é obrigatório');
  if (!downloadUrl || !/^https:\/\//i.test(String(downloadUrl))) {
    throw new Error('downloadUrl deve ser HTTPS público');
  }

  const manifestPath = join(releaseDir, 'release-manifest.json');
  if (!existsSync(manifestPath)) {
    const err = new Error(`release-manifest.json não encontrado em ${releaseDir}`);
    err.code = 'MANIFEST_NOT_FOUND';
    throw err;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const appVersion = manifest.appVersion || manifest.version;
  const installer = manifest.installer || {};

  return {
    feedVersion: RELEASE_FEED_VERSION,
    platform: manifest.platform || 'win32',
    productName: manifest.productName || 'Pesagens Individuais',
    appVersion,
    publishedAt: now.toISOString(),
    releaseNotesUrl: releaseNotesUrl || null,
    dbSchemaVersion: manifest.dbSchemaVersion ?? null,
    installer: {
      fileName: installer.file || `Pesagens Individuais Setup ${appVersion}.exe`,
      downloadUrl: String(downloadUrl),
      sha256: String(installer.sha256 || '').toLowerCase(),
      sizeBytes: installer.sizeBytes ?? null,
      signed: Boolean(manifest.signed),
    },
  };
}

function cli() {
  const root = defaultRoot;
  const releaseDirName = process.env.RELEASE_DIR || 'release-unsigned';
  const releaseDir = join(root, releaseDirName);
  const downloadUrl = String(process.env.RELEASE_DOWNLOAD_URL || '').trim();
  const releaseNotesUrl = String(process.env.RELEASE_NOTES_URL || '').trim() || null;
  const outPath = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : join(releaseDir, 'latest-win.json');

  if (!downloadUrl) {
    console.error('FAIL build-release-feed: defina RELEASE_DOWNLOAD_URL (HTTPS público do Setup.exe).');
    process.exit(1);
  }

  const feed = buildReleaseFeed({ root, releaseDir, downloadUrl, releaseNotesUrl });
  writeFileSync(outPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  console.log('OK build-release-feed');
  console.log(JSON.stringify({ outPath, appVersion: feed.appVersion }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  cli();
}
