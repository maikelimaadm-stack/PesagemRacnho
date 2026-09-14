// Programa 2.0 — Fase 0: medição do tamanho de legacy_payload e da auditoria.
// Uso: node scripts/measure-payload-size.mjs [--mass=36k] [--out=docs/evidence/program-2.0/phase-00]
// Roda em Node com fake-indexeddb. Não altera código de produto.
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedMass, clearMass } from '../src/modules/perf/baselineBench.js';
import { ensureStorageReady } from '../src/storage/indexedDb/db.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const massKey = args.mass || '36k';
const outDir = join(root, args.out || 'docs/evidence/program-2.0/phase-00');
mkdirSync(outDir, { recursive: true });

const bytes = (value) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { n: sorted.length, min: sorted[0] ?? 0, mean: sorted.length ? Math.round(sum / sorted.length) : 0, p50: pick(0.5), p95: pick(0.95), max: sorted.at(-1) ?? 0, total: sum };
};

await seedMass(massKey, { onProgress: () => {} });
const db = await ensureStorageReady();
const rows = await db.table('pesagens').toArray();
const rowBytes = rows.map((row) => bytes(row));
const payloadBytes = rows.map((row) => bytes(row.legacy_payload));
const payloadKeys = rows.map((row) => Object.keys(row.legacy_payload || {}).length);
const keyFrequency = new Map();
for (const row of rows) for (const key of Object.keys(row.legacy_payload || {})) keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1);

// Uma edição real via serviço: quantas chaves o payload ganha depois de updateEntry?
const sample = rows.find((row) => row.legacy_payload?.tipo_manejo === 'Manejo') || rows[0];
const beforeKeys = Object.keys(sample.legacy_payload || {});
await weighingService.updateEntry(sample.id, { observacao: 'medição fase 0' });
const afterRow = (await db.table('pesagens').where('id').equals(sample.id).toArray()).at(-1);
const afterKeys = Object.keys(afterRow.legacy_payload || {});
const addedKeys = afterKeys.filter((key) => !beforeKeys.includes(key));

// Auditoria gerada por essa única edição (antes/depois completos).
const audits = await db.table('auditoria').toArray();
const auditBytes = audits.map((row) => bytes(row));

const report = {
  massKey,
  measuredAt: new Date().toISOString(),
  pesagens: {
    rows: rows.length,
    rowBytes: stats(rowBytes),
    payloadBytes: stats(payloadBytes),
    payloadShareOfRow: rows.length ? Number((stats(payloadBytes).total / stats(rowBytes).total).toFixed(3)) : 0,
    payloadKeys: stats(payloadKeys),
    keyFrequency: Object.fromEntries([...keyFrequency.entries()].sort((a, b) => b[1] - a[1])),
  },
  editGrowth: {
    sampleId: sample.id,
    keysBefore: beforeKeys.length,
    keysAfter: afterKeys.length,
    addedKeys,
    payloadBytesBefore: bytes(sample.legacy_payload),
    payloadBytesAfter: bytes(afterRow.legacy_payload),
  },
  auditoria: {
    rowsAfterOneEdit: audits.length,
    rowBytes: stats(auditBytes),
    estimatedBytesPerEdit: auditBytes.length ? Math.round(auditBytes.reduce((a, b) => a + b, 0) / auditBytes.length) : 0,
  },
};

const file = join(outDir, `payload-size-${massKey}.json`);
writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
console.log(`→ ${file}`);
await clearMass();
