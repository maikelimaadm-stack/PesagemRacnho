import { APP_VERSION } from '@/lib/appVersion.js';

export const RELEASE_FEED_VERSION = 1;

/** URL pública do JSON de versão (vite define __RELEASE_FEED_URL__ no build de distribuição). */
export function getReleaseFeedUrl() {
  if (typeof __RELEASE_FEED_URL__ !== 'undefined' && __RELEASE_FEED_URL__) {
    return String(__RELEASE_FEED_URL__).trim();
  }
  return '';
}

function parseSemver(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function isNewerAppVersion(candidate, installed = APP_VERSION) {
  const cmp = compareSemver(candidate, installed);
  return cmp === 1;
}

export function normalizeReleaseFeed(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const appVersion = payload.appVersion || payload.version;
  const installer = payload.installer || {};
  const downloadUrl = installer.downloadUrl || payload.downloadUrl;
  if (!appVersion || !downloadUrl) return null;
  return {
    feedVersion: payload.feedVersion ?? null,
    platform: payload.platform || 'win32',
    productName: payload.productName || 'Pesagens Individuais',
    appVersion: String(appVersion),
    publishedAt: payload.publishedAt || null,
    releaseNotesUrl: payload.releaseNotesUrl || null,
    installer: {
      fileName: installer.fileName || installer.file || null,
      downloadUrl: String(downloadUrl),
      sha256: installer.sha256 ? String(installer.sha256).toLowerCase() : null,
      sizeBytes: installer.sizeBytes ?? null,
      signed: Boolean(installer.signed),
    },
  };
}

const CHECK_TIMEOUT_MS = 12_000;

/** Consulta o feed; falha silenciosa (null) quando offline, URL vazia ou erro de rede. */
export async function fetchLatestReleaseFeed(feedUrl = getReleaseFeedUrl()) {
  const url = String(feedUrl || '').trim();
  if (!url) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS) : null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeReleaseFeed(json);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function describeUpdateAvailability(feed, installedVersion = APP_VERSION) {
  if (!feed?.appVersion) return { status: 'unknown', feed: null };
  if (!isNewerAppVersion(feed.appVersion, installedVersion)) {
    return { status: 'current', feed };
  }
  return { status: 'update-available', feed };
}
