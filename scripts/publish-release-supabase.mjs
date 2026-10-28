// Publica Setup + latest-win.json no Supabase Storage (bucket público de leitura).
// Segredos (CI ou sessão local): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_RELEASE_BUCKET.
// Opcional: RELEASE_DIR (default release-unsigned), RELEASE_NOTES_URL.
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildReleaseFeed } from './build-release-feed.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    console.error(`FAIL publish-release-supabase: ${name} não definido.`);
    process.exit(1);
  }
  return value;
}

function publicObjectUrl(supabaseUrl, bucket, objectPath) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}

async function uploadObject({ supabaseUrl, serviceKey, bucket, objectPath, body, contentType }) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload falhou (${objectPath}): HTTP ${res.status} ${text}`);
  }
}

async function main() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = process.env.SUPABASE_RELEASE_BUCKET || 'pesagens-releases';
  const releaseDirName = process.env.RELEASE_DIR || 'release-unsigned';
  const releaseDir = join(root, releaseDirName);
  const manifestPath = join(releaseDir, 'release-manifest.json');

  if (!existsSync(manifestPath)) {
    console.error(`FAIL publish-release-supabase: ${manifestPath} ausente — gere o pacote antes (npm run dist:unsigned).`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const appVersion = manifest.appVersion || manifest.version;
  const installerName = manifest.installer?.file;
  const installerPath = join(releaseDir, installerName);

  if (!installerName || !existsSync(installerPath)) {
    console.error(`FAIL publish-release-supabase: instalador não encontrado (${installerPath}).`);
    process.exit(1);
  }

  const installerKey = `win/${appVersion}/${installerName}`;
  const installerBuffer = readFileSync(installerPath);

  await uploadObject({
    supabaseUrl,
    serviceKey,
    bucket,
    objectPath: installerKey,
    body: installerBuffer,
    contentType: 'application/octet-stream',
  });

  const downloadUrl = publicObjectUrl(supabaseUrl, bucket, installerKey);
  const releaseNotesUrl = String(process.env.RELEASE_NOTES_URL || '').trim() || null;
  const feed = buildReleaseFeed({ root, releaseDir, downloadUrl, releaseNotesUrl });

  const feedKey = 'win/latest.json';
  await uploadObject({
    supabaseUrl,
    serviceKey,
    bucket,
    objectPath: feedKey,
    body: Buffer.from(`${JSON.stringify(feed, null, 2)}\n`, 'utf8'),
    contentType: 'application/json',
  });

  const feedPublicUrl = publicObjectUrl(supabaseUrl, bucket, feedKey);
  console.log('OK publish-release-supabase');
  console.log(JSON.stringify({
    bucket,
    appVersion,
    installerKey,
    downloadUrl,
    feedPublicUrl,
  }, null, 2));
}

main().catch((err) => {
  console.error('FAIL publish-release-supabase:', err.message);
  process.exit(1);
});
