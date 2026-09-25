// Gate reports:json-manifest:verify (R3) — JSON profissional com manifest, definition,
// parameters, filters, groups, columns, aggregates e data; SHA-256 recalculável; campos mínimos
// do manifesto; mesma população e totais do view model.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { APP_VERSION, DB_SCHEMA_VERSION } from '../src/versioning/versionInfo.js';

await seedReportFixture();
// E1: `desempenho.lote` é alias de `desempenho` (Apartação › Lote); aqui o contrato do DETALHADO.
const vm = await runReport('desempenho.lote', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, selection: { mode: 'DETALHADO', filters: { sexo: { operator: 'in', values: ['M', 'F'] } } } }, ADMIN);
const { content, manifest, fileName } = await prepareEmission(vm, 'json', ADMIN);
const parsed = JSON.parse(content);

for (const key of ['manifest', 'definition', 'parameters', 'filters', 'groups', 'columns', 'aggregates', 'data', 'tree', 'totals']) assert.ok(key in parsed, `JSON contém ${key}`);
const required = ['reportId', 'reportName', 'reportDefinitionVersion', 'emissionId', 'emittedAt', 'emittedBy', 'appVersion', 'schemaVersion', 'filters', 'period', 'groups', 'columns', 'recordCount', 'uniqueAnimalCount', 'contentSha256', 'fileName'];
for (const key of required) assert.ok(parsed.manifest[key] !== undefined, `manifesto contém ${key}`);
assert.equal(parsed.manifest.reportId, 'desempenho');
assert.equal(parsed.manifest.presetId, 'desempenho.lote', 'manifesto registra o id antigo usado para abrir');
assert.equal(parsed.manifest.mode, 'DETALHADO');
assert.equal(parsed.mode, 'DETALHADO');
assert.equal(parsed.manifest.appVersion, APP_VERSION);
assert.equal(parsed.manifest.schemaVersion, DB_SCHEMA_VERSION);
assert.equal(parsed.manifest.schemaVersion, 8, 'esquema Dexie 8 (sanidade, ADR-049)');
assert.deepEqual(parsed.manifest.emittedBy, { id: ADMIN.id, nome: ADMIN.nome, role: 'ADMIN' });
assert.equal(parsed.manifest.fileName, fileName);
assert.equal(parsed.manifest.period.from, '2026-08-01');
assert.equal(parsed.manifest.periodDescription, '01/08/2026 a 15/09/2026');
assert.match(parsed.manifest.emissionId, /^[0-9a-f-]{36}$/);

// Integridade: contentSha256 = SHA-256 do corpo (tudo menos o manifesto); sha256 = arquivo inteiro
const { manifest: embedded, ...body } = parsed;
assert.equal(embedded.contentSha256, createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex'), 'corpo recalculável');
assert.equal(manifest.sha256, createHash('sha256').update(content, 'utf8').digest('hex'), 'arquivo');
const tampered = { ...body, totals: { ...body.totals, animais: { ...body.totals.animais, value: 99 } } };
assert.notEqual(createHash('sha256').update(JSON.stringify(tampered), 'utf8').digest('hex'), embedded.contentSha256, 'NEGATIVO: adulteração detectada');

// Mesma população e totais
assert.equal(parsed.data.length, vm.rowCount);
assert.equal(parsed.recordCount, vm.rowCount);
assert.deepEqual(parsed.data.map((row) => row._id), vm.rows.map((row) => row.id));
assert.deepEqual(parsed.totals, JSON.parse(JSON.stringify(vm.totals)));
assert.equal(parsed.tree.length, vm.tree.length);
assert.equal(parsed.tree[0].children.reduce((acc, child) => acc + child.rowCount, 0), vm.tree[0].rowCount);
const a1 = parsed.data.find((row) => row._id === 'A1');
assert.equal(a1.gmd, 45 / 40, 'JSON leva o valor canônico, sem arredondar');
assert.equal(typeof a1.peso_final, 'number');

// E1: no RESUMIDO o JSON leva `summary` (uma linha por grupo + Total geral) e nenhuma linha de animal.
const vmResumo = await runReport('desempenho.lote', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } } }, ADMIN);
assert.equal(vmResumo.mode, 'RESUMIDO', 'alias agrupado abre no Resumido');
const resumo = JSON.parse((await prepareEmission(vmResumo, 'json', ADMIN)).content);
assert.equal(resumo.manifest.mode, 'RESUMIDO');
assert.deepEqual(resumo.data, [], 'Resumido não exporta linha de animal');
assert.equal(resumo.summary.rows.length, vmResumo.summaryRows.length + 1, 'uma linha por nó + Total geral');
assert.equal(resumo.summary.rows.at(-1).type, 'GRAND_TOTAL');
assert.deepEqual(resumo.summary.rows.at(-1).values, Object.fromEntries(vmResumo.aggregates.map((spec) => [spec.id, vmResumo.totals[spec.id].value])), 'total geral = totais do view model');
assert.ok(resumo.tree.every((node) => node.rowIds.length === 0), 'Resumido sem ids de linha');

// Nada interno ou secreto vaza
const text = content.toLowerCase();
for (const forbidden of ['password', 'senha', 'salt', 'recovery', '"resolve"', '"population"', 'legacy_payload']) assert.ok(!text.includes(forbidden), `JSON sem ${forbidden}`);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:json-manifest:verify', ok: true, bytes: content.length }, null, 2));
