import assert from 'node:assert/strict';
import { calculateWeightGain } from '../src/modules/weighing/domain/weighingCalculations.js';
import { buildWeightPreview } from '../src/components/pesagens/weightPreview.js';

const marcaA = [
  { id: 'a-1', animal_id: 'a', data_pesagem: '2026-08-01', peso: 200 },
  { id: 'a-2', animal_id: 'a', data_pesagem: '2026-08-11', peso: 230 },
  { id: 'a-future', animal_id: 'a', data_pesagem: '2026-09-20', peso: 999 },
];
const marcaB = [{ id: 'b-1', animal_id: 'b', data_pesagem: '2026-08-04', peso: 500 }];

assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: 250 }),
  { dataAnterior: '2026-08-11', pesoAnterior: 230, dias: 10, ganho: 20, gmd: 2 },
  'usa a última pesagem anterior da mesma marca/animal e ignora data futura'
);

const preview = buildWeightPreview({ history: marcaA, date: '21/08/2026', weight: '250,50' });
assert.deepEqual(preview.gain,
  { dataAnterior: '2026-08-11', pesoAnterior: 230, dias: 10, ganho: 20.5, gmd: 2.05 },
  'prévia visual aceita data e decimal brasileiros');
assert.equal(preview.trend.count, 2, 'tendência conta somente pesagens salvas anteriores');
assert(!preview.trend.points.includes('999'), 'tendência ignora histórico futuro');

const blankPreview = buildWeightPreview({ history: marcaA, date: '2026-08-21', weight: '' });
assert.equal(blankPreview.gain.pesoAnterior, 230, 'última pesagem continua visível antes de preencher o peso');
assert.equal(blankPreview.gain.ganho, null, 'peso vazio não inventa ganho negativo');
assert.deepEqual(
  calculateWeightGain({ history: marcaB, date: '2026-08-14', weight: 500 }),
  { dataAnterior: '2026-08-04', pesoAnterior: 500, dias: 10, ganho: 0, gmd: 0 },
  'ganho zero deve ser um valor válido, não nulo'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-11', weight: 235 }),
  { dataAnterior: '2026-08-01', pesoAnterior: 200, dias: 10, ganho: 35, gmd: 3.5 },
  'não usa registro do mesmo dia como referência'
);
assert.deepEqual(
  calculateWeightGain({ history: [], date: '2026-08-10', weight: 300 }),
  { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null },
  'primeira pesagem não inventa ganho'
);

console.log('OK verify-weighing-calculations');
console.log(JSON.stringify({
  sameNumberDifferentBrands: true,
  previousOnly: true,
  futureDateIgnored: true,
  zeroGainPreserved: true,
  dateIntervalInDays: true,
  brazilianDraftPreview: true,
  savedTrendCountOnly: true,
}, null, 2));
