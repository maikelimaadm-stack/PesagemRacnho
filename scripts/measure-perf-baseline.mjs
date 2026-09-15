// Baseline de desempenho em Node (fake-indexeddb) — F0 e Programa 2.0.
// Uso: node scripts/measure-perf-baseline.mjs [--mass=vazia,pequena,36k,250k] [--schema=v7|v6] [--samples=200] [--saves=30] [--out=docs/evidence/program-2.0/phase-01/perf]
// O esquema padrão é "v7" (cadastros mestres e ids); "v6" reproduz a massa da F0/F1.
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MASS_SCHEMA, MASS_KEYS, MASS_SCHEMAS } from '../src/modules/perf/testMass.js';
import { BUDGETS_MS, clearMass, formatReportTable, runBaseline } from '../src/modules/perf/baselineBench.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
globalThis.__MAK_PERF_TRACE__ = args.trace === 'true';

const masses = (args.mass || 'vazia,pequena,36k').split(',').map((value) => value.trim()).filter(Boolean);
const schema = args.schema || DEFAULT_MASS_SCHEMA;
const samples = Number(args.samples) || 200;
const saves = Number(args.saves) || 30;
// Padrão fora de docs/evidence/f0-baseline: a evidência da F0 é histórica e não deve ser sobrescrita.
const outDir = join(root, args.out || 'docs/evidence/program-2.0/phase-01/perf');
mkdirSync(outDir, { recursive: true });

for (const massKey of masses) {
  if (!MASS_KEYS.includes(massKey)) {
    console.error(`Massa inválida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
    process.exit(1);
  }
}
if (!MASS_SCHEMAS.includes(schema)) {
  console.error(`Esquema inválido: ${schema}. Use: ${MASS_SCHEMAS.join(', ')}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const massKey of masses) {
  const startedAt = Date.now();
  const report = await runBaseline({ massKey, samples, saves, schema, log: (message) => process.stderr.write(`${message}\n`) });
  report.appVersion = pkg.version;
  report.wallMs = Date.now() - startedAt;
  // O esquema padrão mantém o nome histórico do arquivo; o alternativo ganha sufixo.
  const file = join(outDir, `baseline-node-${massKey}${schema === DEFAULT_MASS_SCHEMA ? '' : `-${schema}`}.json`);
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
  // Relatórios da versão 1 (F0/fase 0) não gravavam `schema`: eram sempre massa v6.
  const reportSchema = report.schema || 'v6';
  for (const [metric, value] of Object.entries(report.metrics)) {
    rows.push(`| ${report.runtime.kind} | ${report.label} | ${reportSchema} | ${metric} | ${value.n} | ${value.p50} | ${value.p95} | ${value.p99} | ${value.max} |`);
  }
}
const budgetsText = Object.entries(BUDGETS_MS).map(([metric, budget]) => `${metric} p95 < ${budget.p95} ms`).join('; ');
const summary = [
  '# Baseline de desempenho',
  '',
  `Gerado em ${new Date().toISOString()} — aplicação ${pkg.version}. Valores em milissegundos.`,
  `Orçamentos (07-ROADMAP §4, TARGET-PERFORMANCE-RISKS §4): ${budgetsText}.`,
  '',
  '| runtime | massa | esquema | métrica | n | p50 | p95 | p99 | max |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  'Arquivos de origem: ' + files.map((name) => `\`${name}\``).join(', '),
  '',
].join('\n');
if (existsSync(outDir)) writeFileSync(join(outDir, 'BASELINE.md'), summary, 'utf8');
console.log(`Resumo consolidado em ${join(outDir, 'BASELINE.md')}`);
