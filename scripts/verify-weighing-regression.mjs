// Gate weighing:regression:verify (M1 1.5.0, docs/plano-mestre/M1-FUNDACAO-NUMERO.md §2 e §6) — GMD por regressão
// (computeWeightedGmd): 2, 3 e 6 pontos; ponderação por recência conferida à mão; janela de 120 dias; erro padrão com
// piso de 0,08; null/SEM_GMD com menos de 2 pontos ou menos de 14 dias cobertos; e, num animal com 4 pesagens, o valor
// fica entre o menor e o maior GMD dos intervalos (aceite §7.3). Função pura: sem banco.
// Os valores esperados vêm de um ORÁCULO independente (forma por pares e equações normais, pesos contados a partir de
// `hoje`), não do código testado. Cada regra tem caso NEGATIVO (a conta errada reprovaria).
import assert from 'node:assert/strict';
import {
  REGRESSAO_DIAS_COBERTOS_MINIMO, REGRESSAO_ERRO_PADRAO_PISO, REGRESSAO_JANELA_DIAS, REGRESSAO_TAU_DIAS, computeWeightedGmd,
} from '../src/modules/weighing/domain/weightRegression.js';
import { calculateWeightGain } from '../src/modules/weighing/domain/weighingCalculations.js';
import { GMD_QUALIDADE } from '../src/modules/weighing/domain/gmdQuality.js';

const { CONFIAVEL, NAO_CONFIAVEL, SEM_GMD } = GMD_QUALIDADE;
const regras = [];
const ok = (name) => regras.push(name);
const DAY_MS = 86_400_000;
const BASE = '2026-01-01';
const iso = (offset) => new Date(Date.parse(`${BASE}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
const pts = (pairs) => pairs.map(([dia, peso]) => ({ data: iso(dia), peso }));
const close = (actual, expected, message, tolerance = 0.0005) => assert.ok(
  actual !== null && Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} ≠ ${expected}`,
);

// ORÁCULO — pesos w = exp(−idade/tau) com idade a partir de `hoje` (dia relativo a BASE).
function oracle(pairs, { hoje, tau = 60 }) {
  const w = pairs.map(([dia]) => Math.exp(-(hoje - dia) / tau));
  // Inclinação pela forma por pares: Σ wᵢwⱼ(xⱼ−xᵢ)(yⱼ−yᵢ) / Σ wᵢwⱼ(xⱼ−xᵢ)².
  let num = 0;
  let den = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const dx = pairs[j][0] - pairs[i][0];
      num += w[i] * w[j] * dx * (pairs[j][1] - pairs[i][1]);
      den += w[i] * w[j] * dx * dx;
    }
  }
  const slope = num / den;
  // Erro padrão pelas equações normais: [S0 S1; S1 S2]·[a b] = [T0 T1]; Var(b) = σ²·S0/det.
  const S0 = w.reduce((s, v) => s + v, 0);
  const S1 = pairs.reduce((s, [x], i) => s + w[i] * x, 0);
  const S2 = pairs.reduce((s, [x], i) => s + w[i] * x * x, 0);
  const T0 = pairs.reduce((s, [, y], i) => s + w[i] * y, 0);
  const T1 = pairs.reduce((s, [x, y], i) => s + w[i] * x * y, 0);
  const det = S0 * S2 - S1 * S1;
  const b = (S0 * T1 - S1 * T0) / det;
  const a = (T0 - b * S1) / S0;
  const sigma2 = pairs.reduce((s, [x, y], i) => s + w[i] * (y - a - b * x) ** 2, 0) / (pairs.length - 2);
  return { slope, b, erroBruto: Math.sqrt(sigma2 * S0 / det) };
}

assert.equal(REGRESSAO_JANELA_DIAS, 120);
assert.equal(REGRESSAO_TAU_DIAS, 60);
assert.equal(REGRESSAO_DIAS_COBERTOS_MINIMO, 14);
assert.equal(REGRESSAO_ERRO_PADRAO_PISO, 0.08);

// ---------------------------------------------------------------------------------------------------------------
// 1. Dois pontos = a conta simples (a mesma de calculateWeightGain), erro padrão no piso
// ---------------------------------------------------------------------------------------------------------------
const simples = (pairs) => calculateWeightGain({
  history: [{ data_pesagem: iso(pairs[0][0]), peso: pairs[0][1] }], date: iso(pairs[1][0]), weight: pairs[1][1],
}).gmd;
const doisPontos = [[0, 300], [30, 330]];
assert.deepEqual(computeWeightedGmd(pts(doisPontos)), { gmd: 1, n: 2, diasCobertos: 30, erroPadrao: 0.08, qualidade: CONFIAVEL }, '2 pontos: (330 − 300) ÷ 30 = 1,000');
assert.deepEqual(computeWeightedGmd(pts([[30, 330], [0, 300]])), computeWeightedGmd(pts(doisPontos)), 'ordem dos pontos não importa');
// Caso de fronteira do arredondamento: 300 → 284,6 kg em 16 dias. A conta simples dá −0,963 (ganho −15,40 ÷ 16).
const fronteira = [[0, 300], [16, 284.6]];
assert.equal(simples(fronteira), -0.963);
assert.equal(computeWeightedGmd(pts(fronteira)).gmd, -0.963, '2 pontos devolvem exatamente a conta simples');
// NEGATIVO: a fórmula ponderada pura (implementação inicial) errava a 3ª casa nesse caso.
assert.equal(Number(oracle(fronteira, { hoje: 16 }).slope.toFixed(3)), -0.962, 'NEGATIVO: a reta ponderada arredondada daria −0,962');
// Varredura: 2 pontos com 14 a 120 dias e ganhos de −30 a +300 kg (décimos) — sempre igual à conta simples.
let varridos = 0;
for (let dias = 14; dias <= 120; dias += 1) {
  for (let decimos = -300; decimos <= 3000; decimos += 7) {
    const par = [[0, 300], [dias, Number((300 + decimos / 10).toFixed(1))]];
    assert.equal(computeWeightedGmd(pts(par)).gmd, simples(par), `2 pontos ${JSON.stringify(par)}`);
    varridos += 1;
  }
}
assert.equal(computeWeightedGmd(pts([[0, 300], [30, 300.01]])).gmd, 0, 'reta quase plana: 0, nunca "-0"');
assert.ok(Object.is(computeWeightedGmd(pts([[0, 300], [30, 299.99]])).gmd, 0), 'perda mínima arredondada: 0, nunca -0');
ok('dois-pontos-conta-simples');

// ---------------------------------------------------------------------------------------------------------------
// 2. Três pontos — ponderação por recência conferida À MÃO
// ---------------------------------------------------------------------------------------------------------------
// 01/01 300 kg, 31/01 330 kg (+1,0/dia), 02/03 345 kg (+0,5/dia); hoje = 02/03 (dia 60).
// Pesos: w0 = e^−1 = 0,367879; w1 = e^−0,5 = 0,606531; w2 = e^0 = 1.
// Por pares: num = w0w1·30·30 + w0w2·60·45 + w1w2·30·15 = 200,817 + 993,274 + 272,939 = 1467,030
//            den = w0w1·30² + w0w2·60² + w1w2·30² = 200,817 + 1324,366 + 545,878 = 2071,061  →  b = 0,70835 → 0,708.
const tres = [[0, 300], [30, 330], [60, 345]];
const w0 = Math.exp(-1);
const w1 = Math.exp(-0.5);
const maoNum = w0 * w1 * 30 * 30 + w0 * 1 * 60 * 45 + w1 * 1 * 30 * 15;
const maoDen = w0 * w1 * 900 + w0 * 1 * 3600 + w1 * 1 * 900;
close(maoNum, 1467.030, 'conta à mão: numerador', 0.001);
close(maoDen, 2071.061, 'conta à mão: denominador', 0.001);
close(maoNum / maoDen, 0.70835, 'conta à mão: inclinação', 0.00001);
const r3 = computeWeightedGmd(pts(tres), { hoje: iso(60) });
assert.equal(r3.gmd, 0.708, '3 pontos: 0,708 kg/dia (conferido à mão)');
assert.deepEqual([r3.n, r3.diasCobertos, r3.qualidade], [3, 60, CONFIAVEL]);
const o3 = oracle(tres, { hoje: 60 });
close(o3.slope, o3.b, 'oráculo: forma por pares = equações normais', 1e-9);
close(r3.erroPadrao, Math.max(0.08, o3.erroBruto), '3 pontos: erro padrão = √(Σw·r²/(n−2)/Sxx)');
assert.ok(o3.erroBruto > 0.08, 'aqui o erro bruto passa do piso');
// A pesagem mais nova pesa mais: a reta fica mais perto do 0,5 recente do que a média sem peso (0,75).
const semPeso = computeWeightedGmd(pts(tres), { hoje: iso(60), tauDias: 1e9 });
assert.equal(semPeso.gmd, 0.75, 'tau enorme = mínimos quadrados comuns: 45 ÷ 60 = 0,750');
assert.ok(r3.gmd < semPeso.gmd, 'recência puxa para o GMD recente (0,5)');
// NEGATIVO: sem a ponderação por recência o número seria 0,750, não 0,708.
assert.notEqual(r3.gmd, semPeso.gmd, 'NEGATIVO: regressão sem peso por recência daria outro número');
// Peso invertido (o mais antigo pesando mais) puxaria para o 1,0 antigo — também reprova.
const invertido = oracle(tres.map(([d, p]) => [60 - d, p]).reverse(), { hoje: 60 });
assert.ok(Math.abs(-invertido.slope - r3.gmd) > 0.05, 'NEGATIVO: ponderar o mais antigo daria outra reta');
// `hoje` depois da última pesagem multiplica todos os pesos pela mesma constante: a reta não muda.
assert.deepEqual(computeWeightedGmd(pts(tres), { hoje: iso(90) }), r3, 'hoje 30 dias depois: mesma reta (pesos proporcionais)');
assert.deepEqual(computeWeightedGmd(pts(tres)), r3, 'sem hoje: referência = pesagem mais nova');
assert.deepEqual(computeWeightedGmd(pts(tres), { hoje: '2026-02-30' }), r3, 'hoje impossível (30/02) → pesagem mais nova');
assert.deepEqual(computeWeightedGmd(pts(tres), { hoje: iso(400) }).qualidade, SEM_GMD, 'hoje longe: tudo fora da janela → SEM_GMD');
// tau e janela inválidos caem nos padrões.
for (const tau of [0, -60, null, '', 'abc', Number.NaN]) assert.deepEqual(computeWeightedGmd(pts(tres), { hoje: iso(60), tauDias: tau }), r3, `tau ${String(tau)} → 60`);
for (const janela of [0, -1, 'x', Number.NaN]) assert.deepEqual(computeWeightedGmd(pts(tres), { hoje: iso(60), janelaDias: janela }), r3, `janela ${String(janela)} → 120`);
ok('tres-pontos-recencia-a-mao');

// ---------------------------------------------------------------------------------------------------------------
// 3. Seis pontos — oráculo independente; erro padrão com e sem piso
// ---------------------------------------------------------------------------------------------------------------
const seisRuidoso = [[0, 300], [20, 330], [40, 334], [60, 370], [80, 368], [100, 400]];
const r6 = computeWeightedGmd(pts(seisRuidoso), { hoje: iso(100) });
const o6 = oracle(seisRuidoso, { hoje: 100 });
close(r6.gmd, o6.slope, '6 pontos: inclinação = oráculo');
assert.equal(r6.gmd, Number(o6.slope.toFixed(3)));
assert.ok(o6.erroBruto > 0.08, '6 pontos com ruído: erro acima do piso');
close(r6.erroPadrao, o6.erroBruto, '6 pontos: erro padrão = oráculo');
assert.deepEqual([r6.n, r6.diasCobertos, r6.qualidade], [6, 100, CONFIAVEL]);
const seisSuave = [[0, 300], [20, 318], [40, 341], [60, 352], [80, 371], [100, 388]];
const r6s = computeWeightedGmd(pts(seisSuave), { hoje: iso(100) });
const o6s = oracle(seisSuave, { hoje: 100 });
close(r6s.gmd, o6s.slope, '6 pontos suaves: inclinação = oráculo');
assert.ok(o6s.erroBruto < 0.08, `6 pontos suaves: erro bruto ${o6s.erroBruto.toFixed(4)} abaixo do piso`);
assert.equal(r6s.erroPadrao, 0.08, 'piso de 0,08 kg/dia');
const reta = computeWeightedGmd(pts([[0, 300], [20, 320], [40, 340], [60, 360], [80, 380], [100, 400]]));
assert.deepEqual([reta.gmd, reta.erroPadrao], [1, 0.08], 'reta perfeita: resíduo 0 → erro no piso');
// NEGATIVO: sem o piso o erro de uma série suave sairia menor que 0,08 (falsa precisão para a previsão da M3).
assert.notEqual(Number(o6s.erroBruto.toFixed(3)), r6s.erroPadrao, 'NEGATIVO: sem piso o erro seria outro');
// Ordem não importa.
assert.deepEqual(computeWeightedGmd(pts([...seisRuidoso].reverse()), { hoje: iso(100) }), r6, 'ordem dos pontos não importa');
ok('seis-pontos-erro-padrao-piso');

// ---------------------------------------------------------------------------------------------------------------
// 4. Janela de 120 dias (a contar de hoje); futuro fora
// ---------------------------------------------------------------------------------------------------------------
const naJanela = [[0, 300], [40, 340], [80, 372], [120, 410]];
const hoje120 = { hoje: iso(120) };
const base4 = computeWeightedGmd(pts(naJanela), hoje120);
assert.equal(base4.n, 4, 'ponto com exatamente 120 dias entra');
assert.equal(base4.diasCobertos, 120);
close(base4.gmd, oracle(naJanela, { hoje: 120 }).slope, 'janela: oráculo');
// Um ponto ABSURDO com 121 dias de idade fica fora: o resultado não muda.
const comVelho = computeWeightedGmd(pts([[-1, 50], ...naJanela]), hoje120);
assert.deepEqual(comVelho, base4, '121 dias de idade: fora da janela');
// NEGATIVO: se o mesmo ponto absurdo estivesse a 120 dias, entraria e mudaria a reta.
const dentroAbsurdo = computeWeightedGmd(pts([[0, 50], [40, 340], [80, 372], [120, 410]]), hoje120);
assert.notEqual(dentroAbsurdo.gmd, base4.gmd, 'NEGATIVO: o mesmo absurdo dentro da janela muda a reta');
// Pesagem depois de hoje não entra.
assert.deepEqual(computeWeightedGmd(pts([...naJanela, [125, 999]]), hoje120), base4, 'pesagem futura (depois de hoje) fora');
// janelaDias menor restringe.
const jan60 = computeWeightedGmd(pts(naJanela), { hoje: iso(120), janelaDias: 60 });
assert.deepEqual([jan60.n, jan60.diasCobertos, jan60.gmd], [2, 40, Number(((410 - 372) / 40).toFixed(3))], 'janela 60: só os 2 últimos (conta simples)');
ok('janela-120');

// ---------------------------------------------------------------------------------------------------------------
// 5. null/SEM_GMD com menos de 2 pontos ou menos de 14 dias cobertos; qualidade pelos dias cobertos
// ---------------------------------------------------------------------------------------------------------------
const sem = (n, diasCobertos) => ({ gmd: null, n, diasCobertos, erroPadrao: null, qualidade: SEM_GMD });
assert.deepEqual(computeWeightedGmd([]), sem(0, 0), 'nenhum ponto');
assert.deepEqual(computeWeightedGmd(undefined), sem(0, 0), 'sem lista não quebra');
assert.deepEqual(computeWeightedGmd(pts([[0, 300]])), sem(1, 0), '1 ponto');
assert.deepEqual(computeWeightedGmd(pts([[0, 300], [13, 313]])), sem(2, 13), '13 dias cobertos');
assert.deepEqual(computeWeightedGmd(pts([[0, 300], [5, 306], [10, 309], [13, 313]])), sem(4, 13), '4 pontos em 13 dias');
assert.deepEqual(computeWeightedGmd(pts([[0, 300], [0, 302]])), sem(2, 0), '2 pesagens no mesmo dia');
assert.deepEqual(computeWeightedGmd(pts([[0, 300], [200, 500]]), { hoje: iso(200) }), sem(1, 0), 'só 1 ponto na janela');
// Pontos inválidos não contam.
const sujos = [
  { data: iso(0), peso: 300 }, { data: iso(30), peso: 330 }, { data: '2026-02-30', peso: 999 }, { data: 'x', peso: 999 },
  { data: iso(10), peso: 0 }, { data: iso(11), peso: null }, { data: iso(12), peso: '' }, { data: iso(13), peso: Number.NaN },
  { data: iso(14), peso: true }, { data: null, peso: 300 }, null, { data: iso(15), peso: '480,5' },
];
assert.deepEqual(computeWeightedGmd(sujos), computeWeightedGmd(pts(doisPontos)), 'pontos inválidos são ignorados');
assert.equal(computeWeightedGmd([{ data: iso(0), peso: '300' }, { data: iso(30), peso: '330' }]).gmd, 1, 'peso em texto numérico aceito');
// 14 dias = mínimo: tem GMD; com o mínimo de GMD padrão (21) ainda é NAO_CONFIAVEL.
assert.deepEqual(computeWeightedGmd(pts([[0, 300], [14, 314]])), { gmd: 1, n: 2, diasCobertos: 14, erroPadrao: 0.08, qualidade: NAO_CONFIAVEL }, '14 dias: GMD cinza');
assert.equal(computeWeightedGmd(pts([[0, 300], [14, 314]]), { diasMinimos: 14 }).qualidade, CONFIAVEL, '14 dias com mínimo 14: confiável');
assert.equal(computeWeightedGmd(pts([[0, 300], [21, 321]])).qualidade, CONFIAVEL, '21 dias: confiável');
assert.equal(computeWeightedGmd(pts([[0, 300], [21, 321]]), { diasMinimos: 28 }).qualidade, NAO_CONFIAVEL, '21 dias com mínimo 28: cinza');
assert.equal(computeWeightedGmd(pts([[0, 300], [20, 320]]), { diasMinimos: 10 }).qualidade, NAO_CONFIAVEL, 'mínimo inválido (10) → 21');
assert.equal(computeWeightedGmd(pts([[0, 300], [10, 310]]), { diasMinimos: 7 }).qualidade, SEM_GMD, 'mínimo 7 não fura os 14 dias cobertos');
// NEGATIVO: uma regra só de "2 pontos" (sem os 14 dias) daria GMD de 13 dias.
assert.equal(simples([[0, 300], [13, 313]]), 1, 'NEGATIVO: a conta simples daria 1,000 com 13 dias');
ok('sem-gmd-menos-de-2-ou-14-dias');

// ---------------------------------------------------------------------------------------------------------------
// 6. Animal com 4 pesagens: a regressão fica entre o menor e o maior GMD dos intervalos (aceite §7.3)
// ---------------------------------------------------------------------------------------------------------------
const intervalos = (pairs) => pairs.slice(1).map((pair, i) => calculateWeightGain({
  history: pairs.slice(0, i + 1).map(([dia, peso]) => ({ data_pesagem: iso(dia), peso })), date: iso(pair[0]), weight: pair[1],
}).gmd);
const exemplo = [[0, 300], [30, 330], [60, 345], [90, 375]];
const gmdsExemplo = intervalos(exemplo);
assert.deepEqual(gmdsExemplo, [1, 0.5, 1]);
const rExemplo = computeWeightedGmd(pts(exemplo));
assert.ok(rExemplo.gmd >= 0.5 && rExemplo.gmd <= 1, `exemplo: ${rExemplo.gmd} entre 0,500 e 1,000`);
assert.deepEqual([rExemplo.n, rExemplo.qualidade], [4, CONFIAVEL]);
// Muitos animais de teste (gerador determinístico): intervalos de 14 a 40 dias e GMD de −0,6 a +1,8 por intervalo.
let seed = 20261001;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let animais = 0;
for (let k = 0; k < 400; k += 1) {
  const pairs = [[0, 250 + Math.round(rand() * 200)]];
  for (let j = 0; j < 3; j += 1) {
    const dias = 14 + Math.floor(rand() * 27);
    const gmd = -0.6 + rand() * 2.4;
    const [dia, peso] = pairs.at(-1);
    pairs.push([dia + dias, Number((peso + gmd * dias).toFixed(1))]);
  }
  const gmds = intervalos(pairs);
  const r = computeWeightedGmd(pts(pairs));
  assert.equal(r.n, 4, `animal ${k}: 4 pesagens na janela`);
  assert.ok(r.gmd >= Math.min(...gmds) - 0.0005 && r.gmd <= Math.max(...gmds) + 0.0005,
    `animal ${k}: regressão ${r.gmd} fora de [${Math.min(...gmds)}, ${Math.max(...gmds)}] — ${JSON.stringify(pairs)}`);
  animais += 1;
}
// NEGATIVO: sem as médias ponderadas (d̄w, p̄w) — Σw·d·p ÷ Σw·d², com o dia contado do início — sairia da faixa.
const semCentro = (pairs) => {
  const w = pairs.map(([dia]) => Math.exp(-(pairs.at(-1)[0] - dia) / 60));
  return pairs.reduce((s, [d, p], i) => s + w[i] * d * p, 0) / pairs.reduce((s, [d], i) => s + w[i] * d * d, 0);
};
assert.ok(semCentro(exemplo) > Math.max(...gmdsExemplo), `NEGATIVO: sem centrar nas médias ponderadas daria ${semCentro(exemplo).toFixed(3)}`);
ok('quatro-pesagens-entre-min-e-max');

console.log('OK verify-weighing-regression');
console.log(JSON.stringify({ gate: 'weighing:regression:verify', regras, total: regras.length, paresVarridos: varridos, animaisQuatroPesagens: animais }, null, 2));
