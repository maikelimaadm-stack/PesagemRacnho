// Gate weighing:calculations:verify — ganho/dias/GMD contra a pesagem anterior do mesmo animal (calculateWeightGain),
// prévia do Lançamento e, desde a M1 (1.5.0, docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.1), a QUALIDADE do GMD
// (gmdQualidade/gmdMotivo) que sai junto, sem mudar os 5 campos de antes nem o que é gravado.
import assert from 'node:assert/strict';
import { calculateWeightGain, simpleGmd, weightGainKg } from '../src/modules/weighing/domain/weighingCalculations.js';
import { GMD_QUALIDADE, gmdExibicao } from '../src/modules/weighing/domain/gmdQuality.js';
import { recalculateWeightSeries } from '../src/modules/weighing/domain/weighingSeries.js';
import { evaluateWeighingWarnings } from '../src/modules/weighing/domain/weighingWarnings.js';
import { buildWeightPreview } from '../src/components/pesagens/weightPreview.js';

const { CONFIAVEL, NAO_CONFIAVEL, SEM_GMD } = GMD_QUALIDADE;
const marcaA = [
  { id: 'a-1', animal_id: 'a', data_pesagem: '2026-08-01', peso: 200 },
  { id: 'a-2', animal_id: 'a', data_pesagem: '2026-08-11', peso: 230 },
  { id: 'a-future', animal_id: 'a', data_pesagem: '2026-09-20', peso: 999 },
];
const marcaB = [{ id: 'b-1', animal_id: 'b', data_pesagem: '2026-08-04', peso: 500 }];
const curto = (dias) => ({ gmdQualidade: NAO_CONFIAVEL, gmdMotivo: `intervalo curto (${dias} ${dias === 1 ? 'dia' : 'dias'})` });
const semGmd = { gmdQualidade: SEM_GMD, gmdMotivo: 'sem pesagem anterior' };
const confiavel = { gmdQualidade: CONFIAVEL, gmdMotivo: null };

// M1: os 5 campos de antes continuam iguais; os 2 novos vêm no fim (10 dias < 21 → não confiável).
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: 250 }),
  { dataAnterior: '2026-08-11', pesoAnterior: 230, dias: 10, ganho: 20, gmd: 2, ...curto(10) },
  'usa a última pesagem anterior da mesma marca/animal e ignora data futura'
);
assert.deepEqual(
  Object.keys(calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: 250 })),
  ['dataAnterior', 'pesoAnterior', 'dias', 'ganho', 'gmd', 'gmdQualidade', 'gmdMotivo'],
  'M1: nenhum campo removido nem renomeado; só gmdQualidade e gmdMotivo a mais'
);

const preview = buildWeightPreview({ history: marcaA, date: '21/08/2026', weight: '250,50' });
assert.deepEqual(preview.gain,
  { dataAnterior: '2026-08-11', pesoAnterior: 230, dias: 10, ganho: 20.5, gmd: 2.05, ...curto(10) },
  'prévia visual aceita data e decimal brasileiros (e já recebe a qualidade, sem passar diasMinimos)');
assert.deepEqual(gmdExibicao(preview.gain), { texto: '2,050', cinza: true, aviso: 'intervalo curto (10 dias)', entraNaMedia: false },
  'M1: a prévia de 10 dias sai em cinza pelo formatador compartilhado');
assert.equal(preview.trend.count, 2, 'tendência conta somente pesagens salvas anteriores');
assert(!preview.trend.points.includes('999'), 'tendência ignora histórico futuro');

const blankPreview = buildWeightPreview({ history: marcaA, date: '2026-08-21', weight: '' });
assert.equal(blankPreview.gain.pesoAnterior, 230, 'última pesagem continua visível antes de preencher o peso');
assert.equal(blankPreview.gain.ganho, null, 'peso vazio não inventa ganho negativo');
assert.equal(blankPreview.gain.gmd, null, 'peso vazio não inventa GMD');
assert.deepEqual(gmdExibicao(blankPreview.gain), { texto: '-', cinza: false, aviso: null, entraNaMedia: false }, 'M1: sem peso digitado o GMD aparece "-" e não entra em média');

assert.deepEqual(
  calculateWeightGain({ history: marcaB, date: '2026-08-14', weight: 500 }),
  { dataAnterior: '2026-08-04', pesoAnterior: 500, dias: 10, ganho: 0, gmd: 0, ...curto(10) },
  'ganho zero deve ser um valor válido, não nulo'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaB, date: '2026-09-03', weight: 500 }),
  { dataAnterior: '2026-08-04', pesoAnterior: 500, dias: 30, ganho: 0, gmd: 0, ...confiavel },
  'M1: GMD 0 de verdade (30 dias sem engordar) continua 0 e é confiável'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-11', weight: 235 }),
  { dataAnterior: '2026-08-01', pesoAnterior: 200, dias: 10, ganho: 35, gmd: 3.5, ...curto(10) },
  'não usa registro do mesmo dia como referência'
);
assert.deepEqual(
  calculateWeightGain({ history: [], date: '2026-08-10', weight: 300 }),
  { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null, ...semGmd },
  'primeira pesagem não inventa ganho'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: null }),
  { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null, ...semGmd },
  'M1: sem peso atual (Saída sem peso) → SEM_GMD, gmd null'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: 250, diasMinimos: 7 }),
  { dataAnterior: '2026-08-11', pesoAnterior: 230, dias: 10, ganho: 20, gmd: 2, ...confiavel },
  'M1: com gmd_dias_minimos 7 os mesmos 10 dias são confiáveis (a conta não muda, só a qualidade)'
);
// Robustez: entrada sem objeto, histórico nulo, item inválido e data de referência impossível.
assert.deepEqual(calculateWeightGain(), { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null, ...semGmd }, 'sem argumento não quebra');
assert.equal(calculateWeightGain({ history: null, date: '2026-08-21', weight: 250 }).gmdQualidade, SEM_GMD, 'histórico nulo não quebra');
assert.equal(calculateWeightGain({ history: [null, ...marcaA], date: '2026-08-21', weight: 250 }).gmd, 2, 'item nulo no histórico é ignorado');
assert.equal(
  calculateWeightGain({ history: [{ data_pesagem: '2026-08-00', peso: 100 }, ...marcaA.slice(0, 1)], date: '2026-08-21', weight: 250 }).dataAnterior,
  '2026-08-01',
  'M1: anterior com data que não vira dia (dia 00) não é referência (daria dias NaN)'
);
assert.deepEqual(
  calculateWeightGain({ history: marcaA, date: '21/08/2026', weight: 250 }),
  calculateWeightGain({ history: marcaA, date: '2026-08-21', weight: 250 }),
  'data da pesagem em DD/MM/AAAA dá a mesma conta (antes: dias NaN e GMD 0)'
);
for (const impossivel of ['2026-08-00', '2026-02-30', '31/02/2026', 'ontem']) {
  const result = calculateWeightGain({ history: marcaA, date: impossivel, weight: 250 });
  assert.deepEqual([result.dias, result.gmd, result.gmdQualidade], [null, null, SEM_GMD], `data impossível (${impossivel}) → sem conta`);
}

// Ganho e GMD simples (compartilhados com a regressão de 2 pontos).
assert.equal(weightGainKg(250.5, 230), 20.5);
assert.ok(Object.is(weightGainKg(300, 300.004), 0), 'M1: ganho arredondado nunca sai "-0"');
assert.equal(simpleGmd(20, 10), 2);
assert.equal(simpleGmd(0, 10), 0, 'ganho 0 em intervalo válido → 0');
assert.equal(simpleGmd(20, 0), null, 'M1: dias 0 → null (antes: 0)');
assert.equal(simpleGmd(20, -3), null, 'dias negativos → null');
assert.equal(simpleGmd(null, 10), null, 'sem ganho → null (Number(null) seria 0)');
assert.equal(simpleGmd(20, null), null, 'sem dias → null');
assert.equal(simpleGmd(Number.NaN, 10), null, 'ganho NaN → null');
assert.ok(Object.is(simpleGmd(-0.01, 30), 0), 'M1: GMD arredondado nunca sai "-0"');

// O que é GRAVADO continua sendo só os 5 campos: a série (edição, importação, recálculo) não leva a qualidade.
const serie = [
  { id: 's1', animal_id: 'X', tipo_manejo: 'Cadastro', data_pesagem: '2026-01-01', peso: 200 },
  { id: 's2', animal_id: 'X', tipo_manejo: 'Manejo', data_pesagem: '2026-01-04', peso: 210 },
  { id: 's3', animal_id: 'X', tipo_manejo: 'Manejo', data_pesagem: '2026-02-03', peso: 240 },
];
const updates = recalculateWeightSeries(serie);
for (const update of updates) {
  assert.deepEqual(Object.keys(update.patch), ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'], `série ${update.id}: só os 5 campos`);
  for (const field of ['gmdQualidade', 'gmdMotivo', 'gmd_qualidade', 'gmd_motivo']) {
    assert.ok(!(field in update.legacyPayload), `série ${update.id}: ${field} não vai para o legacy_payload`);
  }
}
assert.deepEqual(updates.find((update) => update.id === 's2').patch, { data_anterior: '2026-01-01', peso_anterior: 200, dias: 3, ganho: 10, gmd: 3.333 },
  'M1: o GMD de intervalo curto continua GRAVADO (a qualidade é derivada na leitura)');

// weighingWarnings: gmd null (sem anterior) não quebra nem gera aviso de GMD.
assert.deepEqual(evaluateWeighingWarnings({ weight: 400, date: '2026-08-10', history: [] }), [], 'primeira pesagem: nenhum aviso, gmd null não quebra');
assert.ok(
  evaluateWeighingWarnings({ weight: 4800, date: '2026-08-12', history: [{ data_pesagem: '2026-08-11', peso: 480 }] }).some((warning) => warning.code === 'WEIGHT_CHANGE'),
  '480 → 4800 no dia seguinte continua avisado pela variação'
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
  gmdQualityFields: true,
  gmdNullNeverZero: true,
  storedFieldsUnchanged: true,
  warningsWithNullGmd: true,
}, null, 2));
