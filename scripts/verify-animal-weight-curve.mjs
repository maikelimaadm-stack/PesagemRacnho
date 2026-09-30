// Gate animal:weight-curve:verify (E1G 1.4.2 — docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B): a curva de peso da
// Ficha do Animal (src/modules/animals/domain/animalWeightCurve.js, a MESMA função que src/pages/FichaAnimal.jsx
// usa) desenhada pela geometria e pelo SVG dos gráficos dos relatórios (chartGeometry/renderChartSvg). Massa de
// TESTE montada aqui (um animal fictício); nada do banco. Casos, com os NEGATIVOS (o código antigo reprovaria):
//   a) eixo X = tempo REAL: intervalos de 10 e 90 dias ocupam 1 : 9 do eixo (NEGATIVO: pelo índice, 1 : 1);
//   b) pesagem sem peso (Saída por morte, peso vazio ou 0) fica fora — pontos, marcas do eixo e rótulos alinhados
//      (NEGATIVO: a curva antiga tirava os rótulos de TODOS os eventos e desalinhava);
//   c) GMD do trecho = ganho ÷ dias contra a pesagem com peso anterior (mesmo fora do intervalo escolhido); mesmo
//      dia = "—", nunca divisão por zero; dica com data, peso, dias, ganho e GMD;
//   d) com 1 pesagem a legenda diz "—" (NEGATIVO: `null >= 0` da legenda antiga dava "+0,00 kg");
//   e) eixo Y em kg, sem partir de 0, marcas "bonitas"; intervalos 90 dias / 6 meses / Tudo;
//   f) o SVG sai sem preserveAspectRatio="none" (o defeito antigo), sem script, com uma marca por pesagem; a Ficha
//      usa a curva nova, com as cores por token (tema escuro) e sem as cores fixas antigas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURVE_RANGES, buildAnimalWeightCurve, curveCutoff, curveLegend } from '../src/modules/animals/domain/animalWeightCurve.js';
import { chartGeometry, chartHoverTargets, dayNumber } from '../src/modules/reporting/domain/chartScale.js';
import { chartTargetDrill } from '../src/modules/reporting/domain/reportCharts.js';
import { renderChartSvg } from '../src/modules/reporting/infrastructure/exporters/chartSvg.js';
import { CHART_SCREEN_CSS } from '../src/modules/reporting/infrastructure/exporters/chartStyles.js';

const results = [];
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${message}: esperado ${expected}, veio ${actual}`);
const animal = { animal_id: 'T1', numero_animal: '9001', marca: 'TESTE', empresa_id: 'local' };
// Animal de TESTE: 300 kg → 312 kg em 10 dias (GMD 1,2) → 402 kg em 90 dias (GMD 1,0) → Saída por morte sem peso.
const entries = [
  { ...animal, id: 'c1', tipo_manejo: 'Cadastro', data_pesagem: '2026-01-01', peso: 300, created_date: '2026-01-01T10:00:00Z' },
  { ...animal, id: 'm1', tipo_manejo: 'Manejo', data_pesagem: '2026-01-11', peso: 312, created_date: '2026-01-11T10:00:00Z' },
  { ...animal, id: 'm2', tipo_manejo: 'Manejo', data_pesagem: '2026-04-11', peso: 402, created_date: '2026-04-11T10:00:00Z' },
  { ...animal, id: 's1', tipo_manejo: 'Saída', motivo_saida: 'Morte', data_pesagem: '2026-05-01', peso: null, created_date: '2026-05-01T10:00:00Z' },
];

// a) tempo real
{
  const curve = buildAnimalWeightCurve(entries);
  const points = curve.series[0].points;
  assert.equal(curve.kind, 'linha');
  assert.equal(curve.xType, 'tempo');
  assert.deepEqual(points.map((point) => point.x), ['2026-01-01', '2026-01-11', '2026-04-11'].map(dayNumber), 'X = dia civil de cada pesagem');
  const geometry = chartGeometry(curve, { width: 620, height: 220 });
  const [p0, p1, p2] = geometry.lines[0].points;
  const ratio = (p2.x - p1.x) / (p1.x - p0.x);
  close(ratio, 9, 'intervalos de 90 e 10 dias ocupam 9 : 1 do eixo', 0.05);
  // NEGATIVO: a curva antiga punha o ponto i em 20 + i × 580 ÷ (n − 1) — intervalos iguais.
  const oldX = (index, n) => 20 + (index * 580) / (n - 1);
  assert.equal((oldX(2, 3) - oldX(1, 3)) / (oldX(1, 3) - oldX(0, 3)), 1, 'NEGATIVO: pelo índice a razão seria 1 (a inclinação mentia)');
  results.push({ caso: 'tempo real', razao: Number(ratio.toFixed(3)), antiga: 1 });
}

// b) sem peso fica fora; rótulos alinhados com os pontos
{
  const withZero = [...entries, { ...animal, id: 'z1', tipo_manejo: 'Manejo', data_pesagem: '2026-04-20', peso: 0 }, { ...animal, id: 'v1', tipo_manejo: 'Manejo', data_pesagem: '2026-04-25', peso: '' }];
  const curve = buildAnimalWeightCurve(withZero);
  const points = curve.series[0].points;
  assert.deepEqual(points.map((point) => point.xKey), ['c1', 'm1', 'm2'], 'só pesagens com peso (> 0): Saída sem peso, 0 e vazio ficam fora');
  const geometry = chartGeometry(curve, { width: 620, height: 220 });
  const pointX = new Set(geometry.lines[0].points.map((point) => point.x));
  assert.ok(geometry.xAxis.ticks.length >= 2 && geometry.xAxis.ticks.every((tick) => pointX.has(tick.pos)), 'toda marca do eixo X cai sobre um ponto desenhado');
  assert.deepEqual(chartHoverTargets(geometry).map((target) => target.xKey), ['c1', 'm1', 'm2'], 'a dica anda pelos mesmos pontos');
  // NEGATIVO: a curva antiga tirava os rótulos de todos os eventos do intervalo (inclusive sem peso).
  const oldLabels = withZero.length;
  assert.notEqual(oldLabels, points.length, 'NEGATIVO: rótulos de todos os eventos ≠ pontos com peso (desalinhava)');
  results.push({ caso: 'sem peso fora', pontos: points.length, eventos: withZero.length });
}

// c) GMD do trecho
{
  const curve = buildAnimalWeightCurve(entries);
  const [first, second, third] = curve.series[0].points;
  assert.equal(first.gmd, null, 'primeira pesagem sem trecho');
  assert.equal(second.dias, 10);
  assert.equal(second.ganho, 12);
  close(second.gmd, 1.2, 'GMD 12 ÷ 10');
  assert.equal(third.dias, 90);
  close(third.gmd, 1, 'GMD 90 ÷ 90');
  assert.deepEqual(second.detalhe, ['Peso: 312,00 kg', 'Desde 01/01/2026: 10 dias', 'Ganho: +12,00 kg', 'GMD do trecho: 1,200 kg/dia'], 'dica: data (título), peso, dias, ganho e GMD');
  assert.equal(second.evento, 'Pesagem');
  // O intervalo de 90 dias começa depois da 2ª pesagem, mas o trecho compara com a anterior REAL (fora do intervalo).
  const recent = buildAnimalWeightCurve(entries, { range: '90' });
  assert.equal(curveCutoff(entries, '90'), '2026-01-31', '90 dias antes do último evento (01/05)');
  assert.deepEqual(recent.series[0].points.map((point) => point.xKey), ['m2'], '90 dias: só a pesagem de abril');
  close(recent.series[0].points[0].gmd, 1, 'o trecho da 1ª pesagem do intervalo vem da pesagem anterior real');
  // Mesmo dia: sem GMD, nunca Infinity/NaN.
  const sameDay = buildAnimalWeightCurve([...entries, { ...animal, id: 'm3', tipo_manejo: 'Manejo', data_pesagem: '2026-04-11', peso: 405, created_date: '2026-04-11T15:00:00Z' }]);
  const repeated = sameDay.series[0].points.find((point) => point.xKey === 'm3');
  assert.equal(repeated.dias, 0);
  assert.equal(repeated.gmd, null, 'mesmo dia: GMD vazio');
  assert.match(repeated.detalhe.at(-1), /GMD do trecho: — \(mesmo dia/, 'dica diz o motivo');
  assert.ok(sameDay.series[0].points.every((point) => point.gmd === null || Number.isFinite(point.gmd)), 'nenhum GMD infinito');
  results.push({ caso: 'GMD do trecho', trechos: [1.2, 1] });
}

// d) legenda com uma pesagem
{
  const one = buildAnimalWeightCurve([entries[0]]);
  assert.equal(one.series[0].points.length, 1);
  assert.deepEqual(one.resumo, { pesagens: 1, dias: 0, ganho: null, gmd: null });
  const legend = curveLegend(one.resumo);
  assert.equal(legend.ganho, '—', 'uma pesagem: ganho "—"');
  assert.equal(legend.pesagens, '1 pesagem com peso');
  assert.equal(legend.tone, null);
  // NEGATIVO: a legenda antiga fazia `${totalGain >= 0 ? '+' : ''}${nf.format(totalGain)} kg` com totalGain null.
  const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalGain = null;
  assert.equal(`${totalGain >= 0 ? '+' : ''}${nf.format(totalGain)} kg`, '+0,00 kg', 'NEGATIVO: a legenda antiga dizia "+0,00 kg"');
  const all = curveLegend(buildAnimalWeightCurve(entries).resumo);
  assert.deepEqual([all.pesagens, all.dias, all.ganho, all.tone], ['3 pesagens com peso', '100 dias', '+102,00 kg', 'pos']);
  const loss = curveLegend(buildAnimalWeightCurve([entries[0], { ...animal, id: 'p', tipo_manejo: 'Manejo', data_pesagem: '2026-02-01', peso: 290 }]).resumo);
  assert.deepEqual([loss.ganho, loss.tone], ['-10,00 kg', 'neg'], 'perda de peso em vermelho (tom neg)');
  const empty = buildAnimalWeightCurve([entries[3]]);
  assert.equal(empty.vazio, true, 'sem pesagem com peso: vazio');
  assert.match(empty.textoVazio, /Nenhuma pesagem com peso/);
  assert.equal(chartGeometry(empty).empty, true, 'e nada desenhado (nunca um ponto 0 kg)');
  results.push({ caso: 'legenda', umaPesagem: legend.ganho, antiga: '+0,00 kg' });
}

// e) eixo Y em kg e intervalos
{
  const curve = buildAnimalWeightCurve(entries);
  const geometry = chartGeometry(curve, { width: 620, height: 220 });
  const ticks = geometry.yAxis.ticks.map((tick) => tick.value);
  assert.equal(geometry.yAxis.title, 'kg', 'unidade do eixo Y');
  assert.ok(ticks[0] > 0 && ticks[0] <= 300 && ticks.at(-1) >= 402, `eixo Y cobre 300–402 sem partir de 0 (${ticks.join(', ')})`);
  assert.ok(ticks.every((value) => value % 5 === 0), 'marcas redondas');
  assert.deepEqual(Object.keys(CURVE_RANGES), ['90', '183', 'all'], 'botões 90 dias / 6 meses / Tudo');
  assert.equal(buildAnimalWeightCurve(entries, { range: '183' }).series[0].points.length, 3, '6 meses: as três pesagens (desde 30/10/2025)');
  assert.equal(geometry.directLabels.at(-1).text, '402,00 kg', 'o último ponto leva o valor');
  results.push({ caso: 'eixo Y', ticks });
}

// f) SVG e a tela
{
  const curve = buildAnimalWeightCurve(entries);
  const svg = renderChartSvg(curve, chartGeometry(curve, { width: 620, height: 220 }), { uid: 'curva-peso' });
  assert.ok(!svg.includes('preserveAspectRatio="none"'), 'NEGATIVO do defeito antigo: sem preserveAspectRatio="none" (círculos deformados)');
  assert.ok(!/<script|foreignObject/i.test(svg), 'sem script');
  assert.equal((svg.match(/class="rc-mark rc-dot/g) || []).length, 3, 'uma marca por pesagem com peso');
  assert.equal(chartTargetDrill(curve, chartHoverTargets(chartGeometry(curve))[0]), null, 'a curva não abre detalhe (só a dica)');
  assert.match(CHART_SCREEN_CSS, /html\.dark \.rpt-charts-host/, 'tokens do tema escuro');
  const ficha = readFileSync(new URL('../src/pages/FichaAnimal.jsx', import.meta.url), 'utf8');
  assert.match(ficha, /buildAnimalWeightCurve\(selected\?\.entries \?\? \[\], \{ range \}\)/, 'Ficha: curva pela função do domínio');
  assert.match(ficha, /<ChartPlot chart=\{curve\}/, 'Ficha: o mesmo ChartPlot dos relatórios (SVG + dica)');
  assert.match(ficha, /rpt-charts-host/, 'Ficha: tokens --rc-* com tema escuro');
  assert.match(ficha, /curveLegend\(curve\.resumo\)/, 'Ficha: legenda do mesmo intervalo');
  for (const button of ["['90', '90 dias']", "['183', '6 meses']", "['all', 'Tudo']"]) assert.ok(ficha.includes(button), `Ficha: botão ${button}`);
  assert.ok(!ficha.includes('preserveAspectRatio="none"') && !ficha.includes('stroke="#40de63"'), 'NEGATIVO: sem o SVG antigo (índice, cor fixa)');
  results.push({ caso: 'svg e tela', marcas: 3 });
}

console.log(JSON.stringify({ gate: 'animal:weight-curve:verify', ok: true, cases: results }, null, 2));
