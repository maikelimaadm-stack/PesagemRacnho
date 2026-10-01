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
//      usa a curva nova, com as cores por token (tema escuro) e sem as cores fixas antigas;
//   g) revisão: duas pesagens no MESMO dia caem no mesmo x (o mouse só alcança a primeira) — a dica mostra as duas
//      (NEGATIVO: a dica antiga, só do ponto, escondia a segunda);
//   h) M1 (1.5.0): qualidade do GMD do trecho (contrato gmdQuality, mínimo de Configurações › Relatórios, padrão 21):
//      intervalo curto com o número, CINZA e o aviso (dica, tabela da curva e tabela/linha do tempo/KPI da Ficha);
//      28 → o de 21 dias passa a cinza; GMD (regressão) do animal entre o menor e o maior GMD dos intervalos, com a
//      janela de 120 dias até hoje (NEGATIVO: a curva antiga mostrava o GMD de 10 dias como qualquer outro).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURVE_RANGES, buildAnimalWeightCurve, curveCutoff, curveGmdText, curveLegend, curvePointTip } from '../src/modules/animals/domain/animalWeightCurve.js';
import { GMD_QUALIDADE } from '../src/modules/weighing/domain/gmdQuality.js';
import { computeWeightedGmd } from '../src/modules/weighing/domain/weightRegression.js';
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

// c) GMD do trecho (mínimo 7: os dois trechos confiáveis — o texto da dica de antes; o padrão 21 está no caso h)
{
  const curve = buildAnimalWeightCurve(entries, { gmdDiasMinimos: 7 });
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
  // M1: o resumo leva também a qualidade do GMD do intervalo e o GMD (regressão) — uma pesagem: SEM_GMD e sem regressão.
  assert.deepEqual({ ...one.resumo, regressao: one.resumo.regressao?.gmd ?? null }, { pesagens: 1, dias: 0, ganho: null, gmd: null, gmdQualidade: GMD_QUALIDADE.SEM_GMD, gmdMotivo: 'sem pesagem anterior', regressao: null });
  assert.equal(one.resumo.regressao.qualidade, GMD_QUALIDADE.SEM_GMD, 'uma pesagem: regressão SEM_GMD');
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
  assert.match(ficha, /buildAnimalWeightCurve\(selected\?\.entries \?\? \[\], \{ range, gmdDiasMinimos, hoje: localToday\(\) \}\)/, 'Ficha: curva pela função do domínio (M1: com o mínimo do GMD e hoje)');
  assert.match(ficha, /<ChartPlot chart=\{curve\}/, 'Ficha: o mesmo ChartPlot dos relatórios (SVG + dica)');
  assert.match(ficha, /rpt-charts-host/, 'Ficha: tokens --rc-* com tema escuro');
  assert.match(ficha, /curveLegend\(curve\.resumo\)/, 'Ficha: legenda do mesmo intervalo');
  for (const button of ["['90', '90 dias']", "['183', '6 meses']", "['all', 'Tudo']"]) assert.ok(ficha.includes(button), `Ficha: botão ${button}`);
  assert.ok(!ficha.includes('preserveAspectRatio="none"') && !ficha.includes('stroke="#40de63"'), 'NEGATIVO: sem o SVG antigo (índice, cor fixa)');
  results.push({ caso: 'svg e tela', marcas: 3 });
}

// g) mesmo dia: a dica mostra as duas pesagens
{
  const sameDay = [...entries.slice(0, 3), { ...animal, id: 'v2', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-04-11', peso: 404, created_date: '2026-04-11T15:00:00Z' }];
  const curve = buildAnimalWeightCurve(sameDay);
  const geometry = chartGeometry(curve, { width: 620, height: 220 });
  const targets = chartHoverTargets(geometry);
  const [m2, v2] = targets.slice(-2);
  assert.equal(m2.anchor.x, v2.anchor.x, 'as duas pesagens do dia caem no mesmo x');
  const tip = curvePointTip(curve, m2);
  assert.equal(tip.title, '11/04/2026 · 2 pesagens no dia');
  assert.ok(tip.lines.includes('Pesagem: 402,00 kg') && tip.lines.includes('Saída (Venda): 404,00 kg'), 'a dica traz as duas');
  assert.ok(tip.lines.some((line) => line.includes('mesmo dia')), 'a 2ª do dia: GMD do trecho "—" (mesmo dia)');
  assert.deepEqual(curvePointTip(curve, targets[0]), { title: '01/01/2026 · Cadastro', lines: ['Peso: 300,00 kg', 'Primeira pesagem com peso'] }, 'um ponto no dia: a dica dele');
  // NEGATIVO: a dica antiga (só o ponto do alvo) não mostrava a venda de 404 kg ao passar o mouse no dia.
  const oldTip = curve.series[0].points.find((point) => point.xKey === m2.xKey).detalhe;
  assert.ok(!oldTip.some((line) => line.includes('404')), 'NEGATIVO: a dica de um ponto só escondia a 2ª pesagem do dia');
  const ficha = readFileSync(new URL('../src/pages/FichaAnimal.jsx', import.meta.url), 'utf8');
  assert.match(ficha, /describe={curvePointTip}/, 'a Ficha usa a dica do domínio');
  results.push({ caso: 'mesmo dia', dica: tip.title });
}

// h) M1 — qualidade do GMD do trecho e GMD (regressão)
{
  // Padrão 21: o trecho de 10 dias (1,200) é intervalo curto — o número aparece, cinza, com o aviso; o de 90 dias não.
  const curve = buildAnimalWeightCurve(entries, { hoje: '2026-05-01' });
  const [, second, third] = curve.series[0].points;
  assert.deepEqual([second.gmdQualidade, second.gmdMotivo, second.gmdCinza], [GMD_QUALIDADE.NAO_CONFIAVEL, 'intervalo curto (10 dias)', true], '10 dias < 21: NAO_CONFIAVEL, cinza');
  close(second.gmd, 1.2, 'o número continua o mesmo (o fato gravado não muda)');
  assert.equal(second.detalhe.at(-1), 'GMD do trecho: 1,200 kg/dia — intervalo curto (10 dias), fora da média', 'dica com o aviso');
  assert.deepEqual([third.gmdQualidade, third.gmdCinza], [GMD_QUALIDADE.CONFIAVEL, false], '90 dias: confiável');
  assert.deepEqual(curve.tabela.cinza, [false, true, false], 'tabela da curva: só o trecho curto em cinza');
  assert.deepEqual(curve.tabela.avisos, [null, 'intervalo curto (10 dias)', null], 'tabela da curva: o aviso ao lado');
  assert.deepEqual(curve.tabela.linhas.map((line) => line.at(-1)), ['—', '1,200', '1,000'], 'tabela: o MESMO número (SEM_GMD "—", nunca 0)');
  // NEGATIVO: a curva da 1.4.2 (sem qualidade) dava o trecho de 10 dias como qualquer outro — sem cinza nem aviso.
  assert.notEqual(second.detalhe.at(-1), 'GMD do trecho: 1,200 kg/dia', 'NEGATIVO: o texto antigo não avisava o intervalo curto');
  // Mínimo 28 (Configurações › Relatórios): nada muda aqui (10 e 90); 7: o de 10 dias volta ao normal.
  assert.deepEqual(buildAnimalWeightCurve(entries, { gmdDiasMinimos: 7 }).tabela.cinza, [false, false, false], 'mínimo 7: nenhum cinza');
  const twentyOne = [entries[0], { ...animal, id: 'm21', tipo_manejo: 'Manejo', data_pesagem: '2026-01-22', peso: 321 }];
  assert.deepEqual(buildAnimalWeightCurve(twentyOne).tabela.cinza, [false, false], '21 dias com o mínimo 21: confiável');
  assert.deepEqual(buildAnimalWeightCurve(twentyOne, { gmdDiasMinimos: 28 }).tabela.cinza, [false, true], 'mínimo 28: o de 21 dias passa a cinza');
  assert.equal(buildAnimalWeightCurve(twentyOne, { gmdDiasMinimos: 99 }).tabela.cinza[1], false, 'mínimo inválido → 21');
  // Formatador compartilhado: SEM_GMD "—" (nunca 0), número com 3 casas, cinza só no NAO_CONFIAVEL.
  assert.deepEqual(curveGmdText({ gmd: null, gmdQualidade: GMD_QUALIDADE.SEM_GMD }), { texto: '—', cinza: false, aviso: null, entraNaMedia: false });
  assert.deepEqual(curveGmdText({ gmd: 1.2, gmdQualidade: GMD_QUALIDADE.NAO_CONFIAVEL, gmdMotivo: 'intervalo curto (10 dias)' }), { texto: '1,200 kg/dia', cinza: true, aviso: 'intervalo curto (10 dias)', entraNaMedia: false });
  // GMD (regressão) do animal: janela de 120 dias até hoje — 3 pesagens, entre o menor e o maior GMD dos intervalos.
  const regressao = curve.resumo.regressao;
  assert.deepEqual([regressao.n, regressao.diasCobertos, regressao.qualidade], [3, 100, GMD_QUALIDADE.CONFIAVEL], 'regressão: 3 pesagens em 100 dias');
  assert.ok(regressao.gmd >= 1 && regressao.gmd <= 1.2, `regressão entre o menor (1,000) e o maior (1,200) GMD dos intervalos: ${regressao.gmd}`);
  assert.equal(regressao.gmd, computeWeightedGmd([{ data: '2026-01-01', peso: 300 }, { data: '2026-01-11', peso: 312 }, { data: '2026-04-11', peso: 402 }], { hoje: '2026-05-01' }).gmd, 'regressão = computeWeightedGmd (interface congelada)');
  const legend = curveLegend(curve.resumo);
  assert.match(legend.regressao, /^GMD \(regressão\): \d,\d{3} kg\/dia$/, 'legenda com o GMD (regressão)');
  // Hoje bem depois (mais de 120 dias da última pesagem): fora da janela, sem regressão ("—").
  assert.equal(curveLegend(buildAnimalWeightCurve(entries, { hoje: '2026-12-31' }).resumo).regressao, 'GMD (regressão): —', 'fora da janela de 120 dias: "—"');
  // A Ficha: mínimo de Configurações › Relatórios, cinza do tema e o aviso na tabela, na linha do tempo e no KPI.
  const ficha = readFileSync(new URL('../src/pages/FichaAnimal.jsx', import.meta.url), 'utf8');
  assert.match(ficha, /getReportSettings\(\)\.then\(\(settings\) => \{ if \(active\) setGmdDiasMinimos\(normalizeGmdDiasMinimos\(settings\?\.gmd_dias_minimos\)\)/, 'Ficha: mínimo de Configurações › Relatórios');
  assert.match(ficha, /data-gmd=\{shownGmd\.cinza \? 'NAO_CONFIAVEL' : undefined\}/, 'Ficha: célula do GMD marcada no intervalo curto');
  assert.match(ficha, /title=\{shownGmd\.cinza \? `GMD não entra na média: \$\{shownGmd\.aviso\}` : undefined\}/, 'Ficha: o motivo no title');
  assert.match(ficha, /GMD_GRAY_STYLE = Object\.freeze\(\{ color: 'var\(--mb1-text-2, #6b7280\)' \}\)/, 'Ficha: o cinza que o tema já tem');
  assert.match(ficha, /\.\.\.\(withWarning \? \['Aviso do GMD'\] : \[\]\)/, 'Ficha: CSV com "Aviso do GMD" logo após o GMD quando há intervalo curto');
  assert.match(ficha, /curveText\.regressao/, 'Ficha: GMD (regressão) na legenda da curva');
  assert.ok(!/hasNumber\(row\.gmd\) \? n3\.format/.test(ficha), 'NEGATIVO: a tabela não formata mais o GMD sem a qualidade');
  results.push({ caso: 'M1 qualidade e regressão', cinza: curve.tabela.cinza, regressao: regressao.gmd });
}

console.log(JSON.stringify({ gate: 'animal:weight-curve:verify', ok: true, cases: results }, null, 2));
