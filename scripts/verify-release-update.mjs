import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compareSemver, isNewerSemver } from './lib/semverCompare.mjs';
import { buildReleaseFeed, RELEASE_FEED_VERSION } from './build-release-feed.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

assert(compareSemver('1.5.4', '1.5.3') === 1, '1.5.4 > 1.5.3');
assert(compareSemver('1.5.4', '1.5.4') === 0, '1.5.4 == 1.5.4');
assert(compareSemver('1.4.10', '1.5.0') === -1, '1.4.10 < 1.5.0');
assert(isNewerSemver('2.0.0', '1.9.9'), 'isNewerSemver');

const sampleManifest = {
  productName: 'Pesagens Individuais',
  appVersion: '9.9.9',
  platform: 'win32',
  dbSchemaVersion: 8,
  signed: false,
  installer: {
    file: 'Pesagens Individuais Setup 9.9.9.exe',
    sha256: 'abc',
    sizeBytes: 123,
  },
};

const tmp = mkdtempSync(join(tmpdir(), 'verify-release-update-'));
try {
  writeFileSync(join(tmp, 'release-manifest.json'), JSON.stringify(sampleManifest));
  const feed = buildReleaseFeed({
    releaseDir: tmp,
    downloadUrl: 'https://example.supabase.co/storage/v1/object/public/bucket/win/9.9.9/setup.exe',
  });
  assert(feed.feedVersion === RELEASE_FEED_VERSION, 'feedVersion');
  assert(feed.appVersion === '9.9.9', 'appVersion no feed');
  assert(feed.installer.downloadUrl.startsWith('https://'), 'downloadUrl https');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// Contrato documentado em docs/release/DISTRIBUICAO-ATUALIZACOES.md
const doc = readFileSync(join(root, 'docs/release/DISTRIBUICAO-ATUALIZACOES.md'), 'utf8');
assert(doc.includes('win/latest.json'), 'doc menciona win/latest.json');

console.log('OK verify-release-update');
