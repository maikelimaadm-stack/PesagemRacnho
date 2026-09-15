// Gera a massa de teste anônima em arquivo JSON (formato das stores Dexie).
// Uso: node scripts/generate-test-mass.mjs --mass=36k [--schema=v7|v6] [--out=<dir>] [--seed=20260908]
// Sem --out, apenas imprime o resumo (a massa é sempre regenerável pela semente).
// "v7" (padrão) inclui os cadastros mestres; "v6" é a saída congelada para testes de migração.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_MASS_SCHEMA, generateTestMass, MASS_KEYS, MASS_SCHEMAS } from '../src/modules/perf/testMass.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));

const massKey = args.mass || 'pequena';
if (!MASS_KEYS.includes(massKey)) {
  console.error(`Massa inválida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
  process.exit(1);
}
const schema = args.schema || DEFAULT_MASS_SCHEMA;
if (!MASS_SCHEMAS.includes(schema)) {
  console.error(`Esquema inválido: ${schema}. Use: ${MASS_SCHEMAS.join(', ')}`);
  process.exit(1);
}
const seed = Number(args.seed) || 20260908;
const started = performance.now();
const mass = generateTestMass(massKey, { seed, schema });
const generationMs = Number((performance.now() - started).toFixed(1));

console.log(JSON.stringify({ massKey, label: mass.label, schema, seed, generationMs, summary: mass.summary }, null, 2));

if (args.out) {
  mkdirSync(args.out, { recursive: true });
  const file = join(args.out, `massa-${massKey}-${schema}.json`);
  writeFileSync(file, JSON.stringify({ massKey, schema, seed, summary: mass.summary, stores: mass.stores }), 'utf8');
  console.log(`→ ${file}`);
}
