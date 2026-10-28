/** Compara semver simples (major.minor.patch). Devolve 1 se a > b, -1 se a < b, 0 se iguais. */
export function parseSemver(value) {
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

export function isNewerSemver(candidate, installed) {
  const cmp = compareSemver(candidate, installed);
  return cmp === 1;
}
