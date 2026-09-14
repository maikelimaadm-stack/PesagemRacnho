// F0 — gera a massa de teste anônima em arquivo JSON (formato das stores Dexie).
// Uso: node scripts/generate-test-mass.mjs --mass=36k [--out=<dir>] [--seed=20260908] [--stats]
// Sem --out, apenas imprime o resumo (a massa é sempre regenerável pela semente).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateTestMass, MASS_KEYS } from '../src/modules/perf/testMass.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));

const massKey = args.mass || 'pequena';
if (!MASS_KEYS.includes(massKey)) {
  console.error(`Massa inválida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
  process.exit(1);
}
const seed = Number(args.seed) || 20260908;
const started = performance.now();
const mass = generateTestMass(massKey, { seed });
const generationMs = Number((performance.now() - started).toFixed(1));

console.log(JSON.stringify({ massKey, label: mass.label, seed, generationMs, summary: mass.summary }, null, 2));

if (args.out) {
  mkdirSync(args.out, { recursive: true });
  const file = join(args.out, `massa-${massKey}.json`);
  writeFileSync(file, JSON.stringify({ massKey, seed, summary: mass.summary, stores: mass.stores }), 'utf8');
  console.log(`→ ${file}`);
}
