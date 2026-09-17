import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { parseCsv } from '../src/modules/weighing/domain/csvParser.js';
import { parseBrazilianNumber, parseCivilDate } from '../src/modules/weighing/domain/brazilianValues.js';
import { calculateCarcassTrade, normalizeCarcassYield } from '../src/modules/weighing/domain/commercialCalculations.js';
import { evaluateWeighingWarnings } from '../src/modules/weighing/domain/weighingWarnings.js';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

assert.equal(parseBrazilianNumber('1.000,00'), 1000);
assert.equal(parseBrazilianNumber('1,000.50'), 1000.5);
assert.equal(parseBrazilianNumber('-10,50'), -10.5);
assert.equal(parseBrazilianNumber('inválido'), null);
assert.equal(parseCivilDate('29/02/2024'), '2024-02-29');
assert.equal(parseCivilDate('29/02/2026'), null);
assert.equal(parseCivilDate('31/02/2026'), null);
assert.equal(normalizeCarcassYield('52,5'), 52.5);
assert.equal(normalizeCarcassYield('150'), null, 'NEGATIVO: rendimento fora de (0,100] não vira 50');
assert.equal(normalizeCarcassYield(''), null, 'sem rendimento não há padrão implícito');
assert.deepEqual(calculateCarcassTrade({ weight: 450, yieldPercent: null, pricePerArroba: 300 }), { liveWeightKg: 450, yieldPercent: null, carcassWeightKg: null, arrobas: null, estimatedValue: null }, 'sem rendimento: carcaça, arrobas e valor ausentes (nunca 0 nem 50 %)');
assert.deepEqual(calculateCarcassTrade({ weight: '450,00', yieldPercent: '50', pricePerArroba: '300,00' }), {
  liveWeightKg: 450,
  yieldPercent: 50,
  carcassWeightKg: 225,
  arrobas: 15,
  estimatedValue: 4500,
});
assert.ok(evaluateWeighingWarnings({ weight: 2000, date: '2026-01-01' }).some((warning) => warning.code === 'WEIGHT_RANGE'));
assert.ok(evaluateWeighingWarnings({ weight: 400, date: '2026-02-01', history: [{ data_pesagem: '2026-01-01', peso: 200 }] }).some((warning) => warning.code === 'WEIGHT_CHANGE'));

const csv = parseCsv('\uFEFFAnimal;Peso;Observação\r\n1;"1.000,00";"texto; com separador"\r\n2;250;"duas\nlinhas"');
assert.equal(csv.rows.length, 3);
assert.deepEqual(csv.rows[1], ['1', '1.000,00', 'texto; com separador']);
assert.equal(csv.rows[2][2], 'duas\nlinhas');

await deleteDbForTests();
const emptyBackup = await storage.createFullBackup({ reason: 'enterprise-test' });
assert.match(emptyBackup.backup.integrity.sha256, /^[a-f0-9]{64}$/);
assert.equal(emptyBackup.backup.manifest.reason, 'enterprise-test');
const tampered = structuredClone(emptyBackup.backup);
tampered.manifest.reason = 'alterado';
await assert.rejects(storage.dryRunRestore(tampered), /SHA-256 divergente/);

await assert.rejects(
  weighingService.bulkCreateEntries([
    { id: 'duplicada', animal_id: 'a-x', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-01-01', peso: 200 },
    { id: 'duplicada', animal_id: 'a-x', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-02-01', peso: 220 },
  ]),
  /id duplicado no lote/,
);
assert.equal(await storage.weighing.count(), 0, 'lote inválido não pode deixar importação parcial');

await weighingService.createEntry({ id: 'cad', animal_id: 'animal-1', tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-01-01', peso: 200 });
await weighingService.createEntry({ id: 'final', animal_id: 'animal-1', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-03-01', peso: 260 });
await weighingService.createEntry({ id: 'retroativa', animal_id: 'animal-1', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-02-01', peso: 230 });
const final = await weighingService.getEntryById('final');
assert.equal(final.peso_anterior, 230);
assert.equal(final.data_anterior, '2026-02-01');
assert.equal(final.ganho, 30);

const db = await storage.ensureReady();
assert.equal(await db.table('animais').count(), 1, 'cadastro novo deve criar Animal canônico');
assert.equal(await db.table('animalIdentificadores').count(), 1, 'cadastro novo deve criar identificador');
assert.equal(await db.table('sessoesPesagem').count(), 3, 'cada data operacional deve possuir sessão automática');
assert.ok(await db.table('auditoria').count() >= 3, 'operações devem possuir trilha local');

await weighingService.createEntry({ id: 'saida-animal', animal_id: 'animal-1', tipo_manejo: 'Saída', motivo_saida: 'Venda', numero_animal: '1', marca: 'A', data_pesagem: '2026-05-01', peso: 280 });
let canonicalAnimal = await db.table('animais').where('id').equals('animal-1').first();
assert.equal(canonicalAnimal.situacao, 'VENDIDO', 'saída definitiva por venda deve atualizar a projeção canônica do animal (enum v7, ADR-028)');
assert.equal(canonicalAnimal.data_saida, '2026-05-01');
await assert.rejects(
  weighingService.createEntry({ id: 'apos-saida', animal_id: 'animal-1', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'A', data_pesagem: '2026-06-01', peso: 290 }),
  /já possui venda/i,
  'evento posterior a uma saída definitiva deve ser bloqueado',
);
await weighingService.deleteEntry('saida-animal');
canonicalAnimal = await db.table('animais').where('id').equals('animal-1').first();
assert.equal(canonicalAnimal.situacao, 'ATIVO', 'cancelar a saída deve reconstruir a situação atual pelo histórico restante (enum v7)');

const indexedPeriod = await storage.weighing.listByPeriodo({ animalId: 'animal-1', dataInicial: '2026-02-01', dataFinal: '2026-04-30' });
assert.deepEqual(indexedPeriod.map((row) => row.id).sort(), ['final', 'retroativa'], 'consulta indexada deve respeitar animal e intervalo inclusivo');

await deleteDbForTests();
const importReport = await weighingService.bulkCreateEntries([
  { id: 'imp-cad', tipo_manejo: 'Cadastro', numero_animal: '10', marca: 'X', sexo: 'F', data_pesagem: '2026-04-01', peso: 180, lote_id: 'lote-a', apartacao_id: 'apt-1' },
  { id: 'imp-man', tipo_manejo: 'Manejo', numero_animal: '10', marca: 'X', sexo: 'F', data_pesagem: '2026-05-01', peso: 210, lote_id: 'lote-b', apartacao_id: 'apt-1' },
], { importMetadata: { id: 'import-1', hash: 'a'.repeat(64), name: 'animais.csv', size: 120, totalRows: 2, operador: 'TESTE' } });
assert.equal(importReport.animais_criados, 1);
assert.equal(importReport.movimentos_criados, 2);
const importDb = await storage.ensureReady();
assert.equal(await importDb.table('pesagens').count(), 2);
assert.equal(await importDb.table('animais').count(), 1);
assert.equal(await importDb.table('animalIdentificadores').count(), 1);
assert.equal(await importDb.table('auditoria').count(), 2);
assert.equal(await importDb.table('importacoes').count(), 1);
const importedLots = await importDb.table('animalLotes').orderBy('inicio').toArray();
assert.equal(importedLots.length, 2);
assert.equal(importedLots[0].fim, '2026-05-01');
assert.equal(importedLots[1].lote_id, 'lote-b');
await assert.rejects(
  weighingService.bulkCreateEntries([
    { id: 'imp-repeat', tipo_manejo: 'Manejo', numero_animal: '10', marca: 'X', data_pesagem: '2026-06-01', peso: 220 },
  ], { importMetadata: { hash: 'a'.repeat(64), name: 'animais.csv' } }),
  /Arquivo já importado/,
);
assert.equal(await importDb.table('pesagens').count(), 2, 'arquivo repetido não pode inserir registros');
await assert.rejects(
  weighingService.bulkCreateEntries([
    { id: 'imp-duplicate-registration', tipo_manejo: 'Cadastro', numero_animal: '10', marca: 'X', data_pesagem: '2026-06-01', peso: 220 },
  ]),
  /já possui cadastro/i,
  'importação não pode criar um segundo cadastro para a mesma identidade canônica',
);
await assert.rejects(
  weighingService.bulkCreateEntries([
    { id: 'imp-retroactive-exit', tipo_manejo: 'Saída', motivo_saida: 'Venda', numero_animal: '10', marca: 'X', data_pesagem: '2026-04-15', peso: 195 },
  ]),
  /lançamentos posteriores/i,
  'importação não pode inserir saída retroativa antes de eventos já existentes',
);
assert.equal(await importDb.table('pesagens').count(), 2, 'erros cronológicos devem reverter o lote de importação inteiro');

await deleteDbForTests();
console.log('OK verify-enterprise-hardening');
console.log(JSON.stringify({ csvQuotedFields: true, brazilianNumber: true, civilDate: true, configurableCarcassYield: true, outlierWarnings: true, backupSha256: true, atomicBulk: true, importIdempotency: true, importCanonicalProjection: true, importChronologyPolicy: true, animalLotProjection: true, animalStateProjection: true, chronologyPolicy: true, indexedPeriodQuery: true, retroactiveRecalculation: true, canonicalAnimal: true, weighingSession: true, auditTrail: true }, null, 2));
