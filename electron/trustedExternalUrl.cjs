const { URL } = require('url');

function extraHosts() {
  return String(process.env.PESAGENS_TRUSTED_DOWNLOAD_HOSTS || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** HTTPS público para download de instalador (Supabase Storage ou hosts explícitos). */
function isTrustedExternalUrl(raw) {
  try {
    const parsed = new URL(String(raw || '').trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (extraHosts().includes(host)) return true;
    if (host.endsWith('.supabase.co')) {
      return parsed.pathname.includes('/storage/v1/object/public/');
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = { isTrustedExternalUrl };
