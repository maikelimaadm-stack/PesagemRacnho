// Gate analytics:forecast:verify — missão pesagens-integrada, checkpoint B3 (F11, F12, F13, F14, F18).
//   F13 oráculo: 300 kg em 01/01 (ano comum), jan 0,200 × 31 + fev 0,300 × 28 → 314,6 kg em 01/03; bissexto;
//       troca de regime no meio do mês; sem cenário para um dia = recusa; base estimada recusada; nada é gravado.
//   F14 dois pesos (01/01 e 01/03) não viram "GMD de janeiro/fevereiro".
//   F12 calendário por propriedade e ano com fonte, sem sobreposição; específico prevalece; dias expostos.
//   F11 desempenho por grupo com n, dias, GMD ponderado, IC, amostra insuficiente ≠ zero, intervalo curto fora,
//       atribuição pelo início do intervalo, quem perde peso.
//   F13/F14 metas com precedência (animal > lote > coorte > propriedade > geral), conflito explícito, peso na data
//       contra projeção; F18 painel e exportações CSV/XLSX/HTML com as mesmas tabelas.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import * as analytics from '../src/modules/analytics/application/analyticsService.js';
import { monthlyObserved, projectWeight, scenarioResolver } from '../src/modules/analytics/domain/projection.js';
import { exposure, seasonAt } from '../src/modules/analytics/domain/seasonCalendar.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';

// O serviço importa appConfigService (que registra o provedor da sessão): sem sessão ele recusa (falha fechada).
// O gate roda como ADMIN; a recusa sem papel é conferida abaixo.
let atorAtual = null;
setActorProvider(() => atorAtual);

const resumo = [];
const ok = (r) => resumo.push(r);

// ---------------------------------------------------------------------------
// F13 — oráculo e variações (puro).
const base = { peso_kg: 300, data: '2026-01-01', origem: 'BALANCA' };
const porMes = scenarioResolver({ gmd_por_mes: { 1: 0.2, 2: 0.3 } });
let p = projectWeight(base, '2026-03-01', porMes);
assert.equal(p.ok, true);
assert.equal(p.peso_kg, 314.6, 'oráculo: 300 + 31×0,2 + 28×0,3 = 314,6');
assert.deepEqual(p.trechos.map((t) => [t.de, t.ate, t.dias, t.gmd, t.ganho]), [['2026-01-01', '2026-02-01', 31, 0.2, 6.2], ['2026-02-01', '2026-03-01', 28, 0.3, 8.4]]);
assert.equal(p.projetado, true);
p = projectWeight({ ...base, data: '2024-01-01' }, '2024-03-01', porMes);
assert.equal(p.peso_kg, 314.9, 'bissexto: fevereiro com 29 dias');
const calendario = [
  { id: 's1', propriedade_id: null, periodo: 'SECA', inicio: '2025-06-01', fim: '2026-01-15', fonte: 'CONFIGURADO' },
  { id: 's2', propriedade_id: null, periodo: 'AGUAS', inicio: '2026-01-16', fim: '2026-04-30', fonte: 'OBSERVADO' },
];
p = projectWeight(base, '2026-02-01', scenarioResolver({ gmd_por_periodo: { SECA: 0.2, AGUAS: 0.6 } }, { calendario }));
assert.equal(p.peso_kg, 312.6, 'troca seca → águas em 16/01: 15×0,2 + 16×0,6');
p = projectWeight(base, '2026-02-01', scenarioResolver({ gmd_por_periodo: { SECA: 0.2, AGUAS: 0.6 } }, { calendario, regimes: [{ de: '2026-01-20', gmd: 1.2, rotulo: 'confinamento' }] }));
assert.equal(p.peso_kg, 319.8, 'regime planejado no meio do mês: 15×0,2 + 4×0,6 + 12×1,2');
p = projectWeight(base, '2026-03-01', scenarioResolver({ gmd_por_mes: { 1: 0.2 } }));
assert.equal(p.ok, false);
assert.match(p.motivo, /01\/02\/2026/);
assert.equal(projectWeight({ ...base, origem: 'ESTIMADO' }, '2026-03-01', porMes).ok, false, 'base estimada não projeta');
ok('F13 oráculo 314,6 kg; bissexto 314,9; troca de estação e regime no meio do mês; lacuna e base estimada recusadas');

// F14 — dois pontos não fazem GMD mensal.
const obs = monthlyObserved([{ de: '2026-01-01', ate: '2026-03-01', dias: 59, ganho: 14.6, gmd: 14.6 / 59 }, { de: '2026-03-05', ate: '2026-03-25', dias: 20, ganho: 10, gmd: 0.5 }]);
assert.deepEqual(Object.keys(obs.meses), ['2026-03']);
assert.equal(obs.atravessam.length, 1);
assert.match(obs.atravessam[0].nota, /não de cada mês/);
ok('F14 dois pesos (01/01 e 01/03) não viram GMD de janeiro/fevereiro');

// F12 — calendário (puro).
const cal2 = [...calendario, { id: 's3', propriedade_id: 'P2', periodo: 'TRANSICAO', inicio: '2026-01-10', fim: '2026-01-31', fonte: 'OBSERVADO' }];
assert.equal(seasonAt(cal2, 'P2', '2026-01-20').periodo, 'TRANSICAO', 'específico da propriedade prevalece');
assert.equal(seasonAt(cal2, 'P1', '2026-01-20').periodo, 'AGUAS');
assert.equal(seasonAt(cal2, 'P1', '2026-06-01'), null, 'sem calendário = null, nada inventado');
assert.deepEqual(exposure(cal2, 'P1', '2026-01-10', '2026-01-20'), { AGUAS: 4, TRANSICAO: 0, SECA: 6, SEM_CALENDARIO: 0, total: 10 });

// ---------------------------------------------------------------------------
// Banco: calendário, metas, animais e pesagens.
await deleteDbForTests();
const db = await storage.ensureReady();
const TS = '2026-01-01T00:00:00.000Z';
const row = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
await db.table('marcas').add({ ...row, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
await db.table('racas').bulkAdd([{ ...row, id: 'NEL', nome: 'Nelore', nome_normalizado: 'NELORE', ativo: true }, { ...row, id: 'ANG', nome: 'Angus', nome_normalizado: 'ANGUS', ativo: true }]);
await db.table('propriedades').add({ ...row, id: 'P1', nome: 'Fazenda Um', nome_normalizado: 'FAZENDA UM', ativo: true, padrao: true });
await db.table('apartacoes').add({ ...row, id: 'AP', nome: 'AP', data: '2025-12-01' });
for (const id of ['L1', 'L2']) await db.table('loteApartacoes').add({ ...row, id, apartacao_id: 'AP', nome_lote: `Lote ${id}`, situacao: 'ABERTO' });

await assert.rejects(analytics.saveSeason({ periodo: 'SECA', inicio: '2025-06-01', fim: '2026-01-15' }), (err) => err.code === 'AUTH_FORBIDDEN', 'sem sessão: recusa');
atorAtual = { id: 'u-consulta', nome: 'Consulta', role: 'CONSULTA' };
await assert.rejects(analytics.saveSeason({ periodo: 'SECA', inicio: '2025-06-01', fim: '2026-01-15' }), (err) => err.code === 'AUTH_FORBIDDEN', 'CONSULTA não grava calendário');
atorAtual = { id: 'u-admin', nome: 'Admin', role: 'ADMIN' };
await analytics.saveSeason({ periodo: 'SECA', inicio: '2025-06-01', fim: '2026-01-15', fonte: 'CONFIGURADO' });
await analytics.saveSeason({ periodo: 'AGUAS', inicio: '2026-01-16', fim: '2026-04-30', fonte: 'OBSERVADO' });
await assert.rejects(analytics.saveSeason({ periodo: 'TRANSICAO', inicio: '2026-04-01', fim: '2026-05-15' }), /Sobrepõe/);
await analytics.saveSeason({ propriedade_id: 'P1', periodo: 'TRANSICAO', inicio: '2026-04-01', fim: '2026-05-15', fonte: 'OBSERVADO' });
assert.equal((await analytics.listSeasons()).length, 3);
ok('F12 calendário com fonte; sobreposição no mesmo escopo recusada; escopo da propriedade aceito');

// Compra de 8 animais: 4 Nelore (L1) e 4 Angus (L2), pesados em 01/01.
const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-01-01', propriedade_destino_id: 'P1', itens: [
  ...[1, 2, 3, 4].map((n) => ({ numero_animal: `N${n}`, marca_id: 'MK', sexo: 'M', raca_id: 'NEL', peso: 300, lote_id: 'L1' })),
  ...[1, 2, 3, 4].map((n) => ({ numero_animal: `A${n}`, marca_id: 'MK', sexo: 'F', raca_id: 'ANG', peso: 280, lote_id: 'L2' })),
] });
await ops.confirmOperation(compra.operacao.id);
const animais = Object.fromEntries((await db.table('animais').toArray()).map((a) => [a.numero_animal, a]));
const manejo = (n, data, peso, lote) => weighingService.createEntry({ tipo_manejo: 'Manejo', animal_id: animais[n].id, numero_animal: n, marca: 'ALFA', data_pesagem: data, peso, lote_id: lote });
// Nelore: +0,5 kg/dia em 60 dias (01/01 → 02/03); N4 perde peso.
for (const n of ['N1', 'N2', 'N3']) await manejo(n, '2026-03-02', 330, 'L1');
await manejo('N4', '2026-03-02', 294, 'L1');
// Angus: só 2 animais com intervalo confiável; A3 pesado com 10 dias (curto, fora da média).
await manejo('A1', '2026-03-02', 310, 'L2');
await manejo('A2', '2026-03-02', 316, 'L2');
await manejo('A3', '2026-01-11', 283, 'L2');
const pesagensAntes = await db.table('pesagens').count();

// ---------------------------------------------------------------------------
// F11 — desempenho por raça.
let painel = await analytics.getDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10' });
const nel = painel.desempenho.find((l) => l.grupo.raca === 'NEL');
const ang = painel.desempenho.find((l) => l.grupo.raca === 'ANG');
assert.equal(nel.n_animais, 4);
assert.equal(nel.dias_observados, 240);
assert.equal(nel.gmd_ponderado, Math.round(((30 * 3 - 6) / 240) * 1000) / 1000, 'GMD ponderado = Σganho/Σdias');
assert.equal(nel.perderam, 1);
assert.equal(nel.amostra, 'SUFICIENTE');
assert.ok(nel.ic95 && nel.ic95[0] < nel.gmd_medio_individual && nel.gmd_medio_individual < nel.ic95[1]);
assert.equal(ang.amostra, 'INSUFICIENTE', 'só 2 Angus com GMD confiável');
assert.equal(ang.gmd_ponderado, null, 'insuficiente não vira zero');
assert.equal(ang.n_intervalos, 3);
assert.equal(ang.n_intervalos_confiaveis, 2, 'intervalo de 10 dias fora da média');
assert.equal(nel.posicao, 1);
assert.equal(ang.posicao, null);
const tabDesempenho = painel.tabelas.find((t) => t.id === 'desempenho');
assert.ok(tabDesempenho.linhas.some((l) => l.includes('sem dados suficientes')));
assert.deepEqual(painel.perdendo.map((x) => x.numero_animal), ['N4']);
ok('F11 n/dias/GMD ponderado/IC por grupo; amostra insuficiente ≠ zero; intervalo curto fora; quem perde peso');

// Atribuição pelo início do intervalo: troca de lote no meio do intervalo não vai para o lote novo.
painel = await analytics.getDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['lote'], hoje: '2026-03-10' });
assert.deepEqual(painel.desempenho.map((l) => l.grupo.lote).sort(), ['L1', 'L2']);
// Estação: intervalos 01/01→02/03 tocam seca (14 dias) e águas (45): predominância < 80% = MISTA.
painel = await analytics.getDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['estacao'], hoje: '2026-03-10' });
assert.ok(painel.desempenho.some((l) => l.grupo.estacao === 'MISTO'));
assert.ok(painel.exposicao.find((e) => e.lote === 'Lote L1').dias_seca > 0);
ok('F11/F12 atribuição pelo início do intervalo; intervalo que atravessa estações = misto; dias de seca por lote');

// ---------------------------------------------------------------------------
// F13/F14 — metas.
await analytics.saveTarget({ escopo: 'GERAL', tipo: 'GMD', gmd_kg_dia: '0,4', vigencia_inicio: '2026-01-01' });
await analytics.saveTarget({ escopo: 'LOTE', alvo_id: 'L1', tipo: 'GMD', gmd_kg_dia: 0.42, vigencia_inicio: '2026-01-01' });
await assert.rejects(analytics.saveTarget({ escopo: 'LOTE', alvo_id: 'L1', tipo: 'GMD', gmd_kg_dia: 0.6, vigencia_inicio: '2026-02-01' }), /sobreposta/);
await analytics.saveTarget({ escopo: 'COORTE', coorte: { raca_id: 'ANG' }, tipo: 'PESO_DATA', peso_kg: 325, data_alvo: '2026-04-30', vigencia_inicio: '2026-01-01' });
await analytics.saveTarget({ escopo: 'COORTE', coorte: { sexo: 'F' }, tipo: 'GMD', gmd_kg_dia: 0.3, vigencia_inicio: '2026-01-01' });
await analytics.saveTarget({ escopo: 'GERAL', tipo: 'CENARIO', cenario: 'BASE', gmd_por_periodo: { AGUAS: 0.5, SECA: 0.1, TRANSICAO: 0.3 }, vigencia_inicio: '2026-01-01' });
painel = await analytics.getDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10', cenario: 'BASE' });
const meta = (n) => painel.metas.linhas.find((l) => l.numero_animal === n);
assert.equal(meta('N1').nivel, 'LOTE', 'lote prevalece sobre geral');
assert.equal(meta('N1').situacao, 'ACIMA', '0,5 observado > 0,42 (tolerância 0,05)');
assert.equal(meta('N4').situacao, 'ABAIXO');
assert.equal(meta('A1').situacao, 'CONFLITO', 'duas metas de coorte (raça e sexo) no mesmo nível: nenhuma aplicada em silêncio');
assert.equal(painel.metas.contagem.CONFLITO, 4);
ok('F13 precedência explícita; conflito no mesmo nível exposto; sobreposição recusada na gravação');

// Resolve o conflito encerrando a meta por sexo: Angus passa a meta de peso projetado em 30/04.
const porSexo = (await analytics.listTargets()).find((m) => m.coorte?.sexo === 'F');
await analytics.removeTarget(porSexo.id, { motivo: 'Substituída pela meta por raça' });
painel = await analytics.getDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10', cenario: 'BASE' });
const a1 = painel.metas.linhas.find((l) => l.numero_animal === 'A1');
assert.equal(a1.base, 'projetado');
// 310 kg em 02/03 + 30 dias de águas (0,5) até 31/03 + 29 dias de TRANSIÇÃO da Fazenda Um (0,3, calendário
// da propriedade prevalece sobre o geral a partir de 01/04) = 310 + 15 + 8,7 = 333,7 → acima de 325 (tolerância 5 kg).
assert.equal(a1.realizado, 333.7);
assert.equal(a1.situacao, 'ACIMA');
const proj = await analytics.projectAnimal(animais.A1.id, '2026-04-30');
assert.equal(proj.cenarios.BASE.peso_kg, 333.7);
assert.deepEqual(proj.cenarios.BASE.trechos.map((t) => [t.fonte, t.dias]), [['Águas', 30], ['Transição', 29]]);
assert.equal(await db.table('pesagens').count(), pesagensAntes, 'projeção nunca é gravada como pesagem');
ok('F14 meta de peso na data contra projeção diária do cenário; nada gravado');

// ---------------------------------------------------------------------------
// F18 — exportações com paridade.
const csv = await analytics.exportDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10' }, 'csv');
const xlsx = await analytics.exportDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10' }, 'xlsx');
const html = await analytics.exportDashboard({ from: '2026-01-01', to: '2026-03-31', dimensoes: ['raca'], hoje: '2026-03-10' }, 'html');
const linhasCsv = parseCsv(csv.text);
const arquivos = unzipStored(xlsx.bytes);
const sheets = Object.keys(arquivos).filter((k) => k.startsWith('xl/worksheets/'));
assert.equal(sheets.length, csv.painel.tabelas.length, 'uma aba por tabela');
for (const t of csv.painel.tabelas) {
  for (const l of t.linhas) {
    for (const v of l.filter((x) => x !== null && x !== '')) {
      const s = String(v);
      assert.ok(linhasCsv.some((r) => r.includes(s)), `CSV contém "${s}" (${t.id})`);
      assert.ok(Object.values(arquivos).some((x) => x.includes(typeof v === 'number' ? `<v>${v}</v>` : s.replace(/&/g, '&amp;'))), `XLSX contém "${s}" (${t.id})`);
      assert.ok(html.html.includes(s.replace(/&/g, '&amp;')), `HTML/PDF contém "${s}" (${t.id})`);
    }
  }
}
assert.match(html.html, /não são pesagens/);
ok('F18 painel e exportações CSV/XLSX/PDF(HTML) com as mesmas tabelas');

await deleteDbForTests();
console.log('OK verify-analytics-forecast');
console.log(JSON.stringify(resumo, null, 2));
