// Evidência R4: gera o HTML de impressão de um relatório agrupado com massa suficiente para
// várias páginas A4 (usado por render-report-pdf.cjs no Electron real). Não é gate.
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteDbForTests } from '../../src/storage/indexedDb/db.js';
import storage from '../../src/storage/storageAdapter.js';
import * as weighingService from '../../src/modules/weighing/application/weighingService.js';
import { runReport } from '../../src/modules/reporting/application/reportService.js';
import { buildPrintDocument, footerText } from '../../src/modules/reporting/infrastructure/exporters/printDocument.js';

const outDir = process.argv[2] || '.tmp/print-sample';
mkdirSync(outDir, { recursive: true });
await deleteDbForTests();
const db = await storage.ensureReady();
const TS = '2026-08-01T00:00:00.000Z';
await db.table('apartacoes').bulkAdd([{ id: 'ap1', empresa_id: 'local', nome_apartacao: 'Engorda', ativo: true, created_at: TS, updated_at: TS, deleted_at: null }]);
await db.table('loteApartacoes').bulkAdd(['01', '02', '03'].map((n) => ({ id: `L${n}`, empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: `Lote ${n}`, quantidade_maxima: 80, created_at: TS, updated_at: TS, deleted_at: null })));
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 90; i += 1) {
  const lote = `L0${1 + (i % 3)}`;
  const base = { empresa_id: 'local', status_animal: 'Ativo', animal_id: `S${i}`, numero_animal: String(1000 + i), marca: i % 2 ? 'ALFA' : 'BETA', sexo: i % 3 ? 'M' : 'F', raca: i % 4 ? 'Nelore' : 'Angus', lote_id: lote, nome_lote: `Lote ${lote.slice(1)}`, apartacao_id: 'ap1', nome_apartacao: 'Engorda' };
  const p0 = 240 + Math.round(rnd() * 120);
  await weighingService.createEntry({ ...base, id: `s${i}-c`, tipo_manejo: 'Cadastro', data_pesagem: '2026-07-01', peso: p0 });
  await weighingService.createEntry({ ...base, id: `s${i}-m1`, tipo_manejo: 'Manejo', data_pesagem: '2026-08-01', peso: p0 + Math.round(15 + rnd() * 25) });
  await weighingService.createEntry({ ...base, id: `s${i}-m2`, tipo_manejo: 'Manejo', data_pesagem: '2026-09-01', peso: p0 + Math.round(35 + rnd() * 40) });
}
const actor = { id: 'evidencia', nome: 'Emissor de evidência', role: 'ADMIN' };
const vm = await runReport('pesagens.periodo', {
  today: '2026-09-15',
  params: { periodo: { preset: 'personalizado', from: '2026-07-01', to: '2026-09-15' } },
  selection: { columns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'peso', 'gmd'], groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], sort: [{ columnId: 'numero_animal', direction: 'asc' }, { columnId: 'data_pesagem', direction: 'asc' }] },
}, actor);
const portrait = buildPrintDocument(vm, { organization: 'Fazenda de demonstração', pageNumbersInCss: false });
const wideVm = await runReport('desempenho.individual', { today: '2026-09-15', params: { periodo: { preset: 'personalizado', from: '2026-07-01', to: '2026-09-15' } }, selection: { columns: ['animal', 'marca', 'sexo', 'raca', 'categoria', 'lote', 'pesagens', 'data_inicial', 'peso_inicial', 'data_final', 'peso_final', 'dias', 'ganho', 'gmd'], groups: [{ columnId: 'lote' }] } }, actor);
const landscape = buildPrintDocument(wideVm, { organization: 'Fazenda de demonstração', pageNumbersInCss: false });
writeFileSync(join(outDir, 'pesagens-periodo.html'), portrait.html);
writeFileSync(join(outDir, 'desempenho-individual.html'), landscape.html);
writeFileSync(join(outDir, 'jobs.json'), JSON.stringify([
  { html: 'pesagens-periodo.html', pdf: 'pesagens-periodo.pdf', landscape: portrait.layout.orientation === 'landscape', footerText: footerText(vm), rows: vm.rowCount },
  { html: 'desempenho-individual.html', pdf: 'desempenho-individual.pdf', landscape: landscape.layout.orientation === 'landscape', footerText: footerText(wideVm), rows: wideVm.rowCount },
], null, 2));
await deleteDbForTests();
console.log(JSON.stringify({ outDir, portrait: portrait.stats, landscape: landscape.layout }, null, 2));
