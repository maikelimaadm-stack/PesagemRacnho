// F0 — baseline de desempenho em Node (fake-indexeddb).
// Uso: node scripts/measure-perf-baseline.mjs [--mass=vazia,pequena,36k,250k] [--samples=200] [--saves=30] [--out=docs/evidence/f0-baseline]
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MASS_KEYS } from '../src/modules/perf/testMass.js';
import { clearMass, formatReportTable, runBaseline } from '../src/modules/perf/baselineBench.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
globalThis.__MAK_PERF_TRACE__ = args.trace === 'true';

const masses = (args.mass || 'vazia,pequena,36k').split(',').map((value) => value.trim()).filter(Boolean);
const samples = Number(args.samples) || 200;
const saves = Number(args.saves) || 30;
const outDir = join(root, args.out || 'docs/evidence/f0-baseline');
mkdirSync(outDir, { recursive: true });

for (const massKey of masses) {
  if (!MASS_KEYS.includes(massKey)) {
    console.error(`Massa inválida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
    process.exit(1);
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const massKey of masses) {
  const startedAt = Date.now();
  const report = await runBaseline({ massKey, samples, saves, log: (message) => process.stderr.write(`${message}\n`) });
  report.appVersion = pkg.version;
  report.wallMs = Date.now() - startedAt;
  const file = join(outDir, `baseline-node-${massKey}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log(formatReportTable(report));
  console.log(`→ ${file} (${(report.wallMs / 1000).toFixed(1)} s)\n`);
  await clearMass();
}

// Consolida todos os JSON existentes (node e browser) em uma tabela Markdown.
const files = readdirSync(outDir).filter((name) => /^baseline-(node|browser)-.+\.json$/.test(name)).sort();
const rows = [];
for (const name of files) {
  const report = JSON.parse(readFileSync(join(outDir, name), 'utf8'));
  for (const [metric, value] of Object.entries(report.metrics)) {
    rows.push(`| ${report.runtime.kind} | ${report.label} | ${metric} | ${value.n} | ${value.p50} | ${value.p95} | ${value.p99} | ${value.max} |`);
  }
}
const summary = [
  '# Baseline de desempenho — F0',
  '',
  `Gerado em ${new Date().toISOString()} — aplicação ${pkg.version}. Valores em milissegundos.`,
  'Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.',
  '',
  '| runtime | massa | métrica | n | p50 | p95 | p99 | max |',
  '|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  'Arquivos de origem: ' + files.map((name) => `\`${name}\``).join(', '),
  '',
].join('\n');
if (existsSync(outDir)) writeFileSync(join(outDir, 'BASELINE.md'), summary, 'utf8');
console.log(`Resumo consolidado em ${join(outDir, 'BASELINE.md')}`);
