// Gate reports:weighted-gmd:verify (R2) — GMD simples × GMD ponderado (Σ ganho ÷ Σ dias,
// só pares válidos) no motor, no grupo e no relatório Desempenho na massa de referência.
import assert from 'node:assert/strict';
import { avg, ratio, weightedGmd } from '../src/modules/reporting/domain/aggregateEngine.js';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

// Caso da missão: iguais
const equal = [{ ganho: 10, dias: 10, gmd: 1 }, { ganho: 20, dias: 20, gmd: 1 }];
close(weightedGmd(equal).value, 1, 'ponderado (10+20)/(10+20)');
close(avg(equal, 'gmd').value, 1, 'simples');

// Caso em que diferem: A +10 em 10 d (1,0); B +40 em 20 d (2,0)
const differ = [{ ganho: 10, dias: 10, gmd: 1 }, { ganho: 40, dias: 20, gmd: 2 }];
close(avg(differ, 'gmd').value, 1.5, 'simples = média das médias');
close(weightedGmd(differ).value, 50 / 30, 'ponderado = 50/30');
assert.notEqual(avg(differ, 'gmd').value, weightedGmd(differ).value, 'NEGATIVO: média das médias ≠ ponderado');

// Pares inválidos não entram (dias 0, ganho ausente, dias ausentes, dias negativos)
const invalid = [{ ganho: 10, dias: 10 }, { ganho: 5, dias: 0 }, { ganho: null, dias: 7 }, { ganho: 3, dias: null }, { ganho: 4, dias: -2 }];
const result = weightedGmd(invalid);
close(result.value, 1, 'só o par válido');
assert.equal(result.n_validos, 1);
assert.equal(result.n_ausentes, 4);
assert.equal(result.numerator, 10);
assert.equal(result.denominator, 10);
assert.equal(weightedGmd([{ ganho: null, dias: null }]).value, null, 'sem par → null');
assert.equal(ratio([{ a: 5, b: 0 }], { numerator: 'a', denominator: 'b', requirePositiveDenominator: false }).value, null, 'divisão por zero → null');

// Perda de peso entra com sinal
close(weightedGmd([{ ganho: -10, dias: 10 }, { ganho: 30, dias: 10 }]).value, 1, '(-10+30)/20');

// Relatório Desempenho individual (ANIMAL_PERIOD) na massa: A1 300→345 em 40 d; A2 250→280 em 31 d;
// A3 e A4 sem par válido.
await seedReportFixture();
const report = await runReport('desempenho.individual', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } } }, ADMIN);
const byAnimal = Object.fromEntries(report.rows.map((row) => [row.animal_id, row]));
assert.equal(report.rowCount, 4, 'uma linha por animal');
assert.equal(byAnimal.A1.peso_inicial, 300); assert.equal(byAnimal.A1.peso_final, 345); assert.equal(byAnimal.A1.dias, 40); assert.equal(byAnimal.A1.ganho, 45); close(byAnimal.A1.gmd, 45 / 40, 'GMD A1');
assert.equal(byAnimal.A1.pesagens, 3);
assert.equal(byAnimal.A2.peso_final, 280, 'saída de venda com peso é a pesagem final'); assert.equal(byAnimal.A2.dias, 31); close(byAnimal.A2.gmd, 30 / 31, 'GMD A2');
assert.equal(byAnimal.A3.ganho, null, 'A3: uma só pesagem com peso (morte sem peso)'); assert.equal(byAnimal.A3.gmd, null);
assert.equal(byAnimal.A3.pesagens, 2, 'a saída sem peso conta como pesagem do período');
assert.equal(byAnimal.A4.gmd, null);
close(report.totals.gmd_ponderado.value, 75 / 71, 'total geral ponderado = (45+30)/(40+31)');
close(report.totals.gmd_simples.value, (45 / 40 + 30 / 31) / 2, 'simples = média dos GMD válidos');
assert.equal(report.totals.gmd_ponderado.n_validos, 2);
assert.equal(report.totals.ganho_total.value, 75);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:weighted-gmd:verify', ok: true, gmdPonderado: report.totals.gmd_ponderado.value, gmdSimples: report.totals.gmd_simples.value }, null, 2));
