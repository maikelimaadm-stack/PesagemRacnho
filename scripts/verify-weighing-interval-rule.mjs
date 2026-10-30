// Gate weighing:interval-rule:verify (M1 1.5.0, docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.1 e §6) — regra do
// intervalo mínimo do GMD no domínio (calculateWeightGain + contrato gmdQuality):
//   1. os 3 estados (SEM_GMD / NAO_CONFIAVEL / CONFIAVEL) e a exibição pelo formatador compartilhado;
//   2. os limites 7/14/21/28 (mínimo − 1 → cinza; mínimo → normal) e a troca de 28 para 21 (aceite §7.2);
//   3. dias = 0 / mesmo dia: nunca há GMD entre duas pesagens do mesmo dia;
//   4. sem pesagem anterior com peso → SEM_GMD;
//   5. gmd null (nunca 0) quando não há conta;
//   6. gmd_dias_minimos ausente ou inválido → 21 — na função e pelo getReportSettings (IndexedDB em memória);
//   7. o que é GRAVADO continua sendo só os 5 campos (serviço real em fake-indexeddb): a qualidade é derivada na leitura;
//   8. repesagem no dia seguinte não mexe no GMD médio do lote (aceite §7.1).
// Cada regra tem caso NEGATIVO: a conta da 1.4.2 (cópia literal abaixo) reprovaria. Massa de TESTE; nunca o banco real.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests, ensureStorageReady, getDbVersion } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { LEGACY_PAYLOAD_ALLOWLIST } from '../src/modules/weighing/domain/weighingMapper.js';
import { calculateWeightGain } from '../src/modules/weighing/domain/weighingCalculations.js';
import {
  GMD_DIAS_MINIMOS_OPCOES, GMD_DIAS_MINIMOS_PADRAO, GMD_QUALIDADE, classifyGmd, gmdExibicao, isGmdConfiavel, normalizeGmdDiasMinimos,
} from '../src/modules/weighing/domain/gmdQuality.js';

const { CONFIAVEL, NAO_CONFIAVEL, SEM_GMD } = GMD_QUALIDADE;
const regras = [];
const ok = (name) => regras.push(name);
const DAY_MS = 86_400_000;
const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const QUALITY_FIELDS = ['gmdQualidade', 'gmdMotivo', 'gmd_qualidade', 'gmd_motivo'];

// 1.4.2 — cópia LITERAL de calculateWeightGain antes da M1 (só para os casos negativos).
function calculateWeightGain142({ history = [], date, weight }) {
  const asIsoDate = (value) => String(value || '').slice(0, 10);
  const toUtcDay = (value) => {
    const [year, month, day] = asIsoDate(value).split('-').map(Number);
    if (!year || !month || !day) return Number.NaN;
    return Date.UTC(year, month - 1, day);
  };
  const weightValue = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  const currentDate = asIsoDate(date);
  const currentWeight = weightValue(weight);
  if (!currentDate || currentWeight === null) return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  let previous = null;
  for (const entry of history) {
    const entryDate = asIsoDate(entry.data_pesagem);
    if (!(entryDate < currentDate) || weightValue(entry.peso ?? entry.peso_kg) === null) continue;
    if (!previous || entryDate >= asIsoDate(previous.data_pesagem)) previous = entry;
  }
  if (!previous) return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  const dataAnterior = asIsoDate(previous.data_pesagem);
  const pesoAnterior = weightValue(previous.peso ?? previous.peso_kg);
  const dias = Math.round((toUtcDay(currentDate) - toUtcDay(dataAnterior)) / 86_400_000);
  const ganho = Number((currentWeight - pesoAnterior).toFixed(2));
  const gmd = dias > 0 ? Number((ganho / dias).toFixed(3)) : 0;
  return { dataAnterior, pesoAnterior, dias, ganho, gmd };
}

// Pesagem `dias` depois de uma anterior de 300 kg em 01/06/2026, com `ganho` kg.
const BASE = '2026-06-01';
const pesar = (dias, ganho, diasMinimos, calc = calculateWeightGain) => calc({
  history: [{ id: 'ant', data_pesagem: BASE, peso: 300 }],
  date: addDays(BASE, dias),
  weight: 300 + ganho,
  ...(diasMinimos === undefined ? {} : { diasMinimos }),
});

// ---------------------------------------------------------------------------------------------------------------
// 1. Três estados (padrão 21) e a exibição
// ---------------------------------------------------------------------------------------------------------------
const curto = pesar(20, 20);
assert.equal(curto.gmd, 1, '20 dias: o GMD continua CALCULADO (o fato não muda)');
assert.equal(curto.gmdQualidade, NAO_CONFIAVEL, '20 dias < 21 → NAO_CONFIAVEL');
assert.equal(curto.gmdMotivo, 'intervalo curto (20 dias)');
assert.deepEqual(gmdExibicao(curto), { texto: '1,000', cinza: true, aviso: 'intervalo curto (20 dias)', entraNaMedia: false }, 'cinza + aviso, fora da média');
const bom = pesar(21, 21);
assert.deepEqual([bom.gmd, bom.gmdQualidade, bom.gmdMotivo], [1, CONFIAVEL, null], '21 dias = mínimo → CONFIAVEL, sem motivo');
assert.deepEqual(gmdExibicao(bom), { texto: '1,000', cinza: false, aviso: null, entraNaMedia: true }, 'normal, entra na média');
const primeira = calculateWeightGain({ history: [], date: BASE, weight: 300 });
assert.deepEqual([primeira.gmd, primeira.gmdQualidade, primeira.gmdMotivo], [null, SEM_GMD, 'sem pesagem anterior'], 'sem anterior → SEM_GMD');
assert.deepEqual(gmdExibicao(primeira), { texto: '-', cinza: false, aviso: null, entraNaMedia: false }, '"-", fora da média');
// A qualidade do domínio é a do contrato (uma regra só): mesma resposta de classifyGmd para os mesmos dias/GMD.
for (const result of [curto, bom, primeira]) {
  assert.deepEqual(classifyGmd(result), { gmdQualidade: result.gmdQualidade, gmdMotivo: result.gmdMotivo }, 'domínio = classifyGmd do contrato');
}
// NEGATIVO: a 1.4.2 não dizia a qualidade — o GMD de 20 dias entrava em média igual ao de 21.
assert.equal(pesar(20, 20, undefined, calculateWeightGain142).gmdQualidade, undefined, 'NEGATIVO: 1.4.2 sem gmdQualidade');
assert.equal(isGmdConfiavel(pesar(20, 20, undefined, calculateWeightGain142).gmdQualidade), false, 'NEGATIVO: sem qualidade nada seria confiável');
ok('tres-estados');

// ---------------------------------------------------------------------------------------------------------------
// 2. Limites 7 / 14 / 21 / 28 (e o singular "1 dia")
// ---------------------------------------------------------------------------------------------------------------
assert.deepEqual([...GMD_DIAS_MINIMOS_OPCOES], [7, 14, 21, 28]);
assert.equal(GMD_DIAS_MINIMOS_PADRAO, 21);
for (const minimo of GMD_DIAS_MINIMOS_OPCOES) {
  const antes = pesar(minimo - 1, minimo - 1, minimo);
  assert.deepEqual([antes.gmdQualidade, antes.gmdMotivo, antes.gmd], [NAO_CONFIAVEL, `intervalo curto (${minimo - 1} dias)`, 1], `mínimo ${minimo}: ${minimo - 1} dias → cinza`);
  for (const dias of [minimo, minimo + 1, 120]) {
    const depois = pesar(dias, dias, minimo);
    assert.deepEqual([depois.gmdQualidade, depois.gmdMotivo, depois.gmd], [CONFIAVEL, null, 1], `mínimo ${minimo}: ${dias} dias → normal`);
  }
  const umDia = pesar(1, 12, minimo);
  assert.deepEqual([umDia.gmdQualidade, umDia.gmdMotivo, umDia.gmd], [NAO_CONFIAVEL, 'intervalo curto (1 dia)', 12], `mínimo ${minimo}: 1 dia → "intervalo curto (1 dia)"`);
}
// Aceite §7.2: o mesmo intervalo de 21 dias vira cinza com 28 e volta ao normal com 21 (a conta não muda).
assert.equal(pesar(21, 21, 28).gmdQualidade, NAO_CONFIAVEL, '21 dias com mínimo 28 → cinza');
assert.equal(pesar(21, 21, 28).gmdMotivo, 'intervalo curto (21 dias)');
assert.equal(pesar(21, 21, 21).gmdQualidade, CONFIAVEL, 'voltar a 21 → normal');
assert.equal(pesar(21, 21, 28).gmd, pesar(21, 21, 21).gmd, 'o número é o mesmo; só a qualidade muda');
// NEGATIVO: com a regra antiga o mínimo não existia — 6 dias e 120 dias saíam iguais (sem qualidade alguma).
assert.deepEqual(Object.keys(pesar(6, 6, 7, calculateWeightGain142)), Object.keys(pesar(120, 120, 7, calculateWeightGain142)), 'NEGATIVO: 1.4.2 não distinguia');
ok('limites-7-14-21-28');

// ---------------------------------------------------------------------------------------------------------------
// 3. dias = 0 / mesmo dia
// ---------------------------------------------------------------------------------------------------------------
const mesmoDia = calculateWeightGain({ history: [{ data_pesagem: BASE, peso: 300 }], date: BASE, weight: 312 });
assert.deepEqual(mesmoDia, { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null, gmdQualidade: SEM_GMD, gmdMotivo: 'sem pesagem anterior' },
  'repesagem no MESMO dia: nunca há GMD entre as duas (a busca do anterior é estritamente anterior)');
const mesmoDiaComAnterior = calculateWeightGain({
  history: [{ data_pesagem: addDays(BASE, -30), peso: 280 }, { data_pesagem: BASE, peso: 300 }], date: BASE, weight: 312,
});
assert.deepEqual([mesmoDiaComAnterior.dataAnterior, mesmoDiaComAnterior.dias, mesmoDiaComAnterior.gmdQualidade], [addDays(BASE, -30), 30, CONFIAVEL],
  'com uma anterior de verdade, a do mesmo dia é ignorada');
assert.deepEqual(classifyGmd({ dias: 0, gmd: 5 }), { gmdQualidade: SEM_GMD, gmdMotivo: 'sem pesagem anterior' }, 'contrato: dias 0 → SEM_GMD');
assert.deepEqual(classifyGmd({ dias: -3, gmd: 5 }), { gmdQualidade: SEM_GMD, gmdMotivo: 'sem pesagem anterior' }, 'contrato: dias negativos → SEM_GMD');
ok('dias-zero-mesmo-dia');

// ---------------------------------------------------------------------------------------------------------------
// 4. Sem pesagem anterior com peso
// ---------------------------------------------------------------------------------------------------------------
const semAnterior = [
  ['histórico vazio', []],
  ['só pesagem futura', [{ data_pesagem: addDays(BASE, 10), peso: 320 }]],
  ['anterior sem peso (Saída sem peso)', [{ data_pesagem: addDays(BASE, -10), peso: null }]],
  ['anterior com peso 0', [{ data_pesagem: addDays(BASE, -10), peso: 0 }]],
  ['anterior com peso vazio', [{ data_pesagem: addDays(BASE, -10), peso: '' }]],
];
for (const [rotulo, history] of semAnterior) {
  const result = calculateWeightGain({ history, date: BASE, weight: 300 });
  assert.deepEqual([result.dataAnterior, result.dias, result.gmd, result.gmdQualidade, result.gmdMotivo], [null, null, null, SEM_GMD, 'sem pesagem anterior'], rotulo);
}
// A anterior SEM peso não é referência: vale a anterior com peso de antes dela.
const pulaSemPeso = calculateWeightGain({ history: [{ data_pesagem: addDays(BASE, -40), peso: 270 }, { data_pesagem: addDays(BASE, -5), peso: null }], date: BASE, weight: 300 });
assert.deepEqual([pulaSemPeso.dias, pulaSemPeso.gmd, pulaSemPeso.gmdQualidade], [40, 0.75, CONFIAVEL], 'anterior sem peso é pulada');
ok('sem-anterior');

// ---------------------------------------------------------------------------------------------------------------
// 5. gmd null (nunca 0) sem conta
// ---------------------------------------------------------------------------------------------------------------
const semConta = [
  calculateWeightGain({ history: [], date: BASE, weight: 300 }),
  calculateWeightGain({ history: [{ data_pesagem: addDays(BASE, -10), peso: 290 }], date: BASE, weight: null }),
  calculateWeightGain({ history: [{ data_pesagem: addDays(BASE, -10), peso: 290 }], date: '', weight: 300 }),
  calculateWeightGain({ history: [{ data_pesagem: '2026-07-31', peso: 300 }], date: '2026-08-00', weight: 330 }),
  mesmoDia,
];
for (const result of semConta) {
  assert.ok(Object.is(result.gmd, null), `gmd null (não 0): ${JSON.stringify(result)}`);
  assert.equal(result.gmdQualidade, SEM_GMD);
  assert.equal(gmdExibicao(result).texto, '-', 'aparece "-", nunca "0,000"');
}
// NEGATIVO: a 1.4.2 devolvia GMD 0 (um número que mente) quando os dias não davam conta (data com dia 00).
const antigoZero = calculateWeightGain142({ history: [{ data_pesagem: '2026-07-31', peso: 300 }], date: '2026-08-00', weight: 330 });
assert.ok(Object.is(antigoZero.gmd, 0), 'NEGATIVO: 1.4.2 devolvia gmd 0');
assert.ok(Number.isNaN(antigoZero.dias), 'NEGATIVO: 1.4.2 devolvia dias NaN');
assert.equal(gmdExibicao({ gmd: antigoZero.gmd, gmdQualidade: CONFIAVEL }).texto, '0,000', 'NEGATIVO: o 0 da 1.4.2 apareceria como "0,000"');
ok('gmd-null-nunca-zero');

// ---------------------------------------------------------------------------------------------------------------
// 6. gmd_dias_minimos ausente ou inválido → 21 (na função e pelo getReportSettings)
// ---------------------------------------------------------------------------------------------------------------
const invalidos = [undefined, null, '', 0, -21, 1, 10, 20, 22, 30, 21.5, '21x', 'abc', Number.NaN, Number.POSITIVE_INFINITY, true, {}];
for (const valor of invalidos) {
  assert.equal(normalizeGmdDiasMinimos(valor), 21, `normalize(${String(valor)}) → 21`);
  // Com 10 valendo, 20 dias seria confiável; com 21 (o padrão) é cinza — prova que o inválido caiu em 21.
  assert.equal(pesar(20, 20, valor).gmdQualidade, NAO_CONFIAVEL, `diasMinimos ${String(valor)} → 21 (20 dias cinza)`);
  assert.equal(pesar(21, 21, valor).gmdQualidade, CONFIAVEL, `diasMinimos ${String(valor)} → 21 (21 dias normal)`);
}
for (const valor of [7, 14, 21, 28, '7', '28']) assert.equal(normalizeGmdDiasMinimos(valor), Number(valor), `normalize(${valor}) aceito`);
// Sem passar diasMinimos (chamadores de hoje: serviço, série, prévia, avisos, Lançamento) → 21.
assert.equal(pesar(20, 20).gmdQualidade, NAO_CONFIAVEL, 'sem diasMinimos → 21');

setActorProvider(null);
await deleteDbForTests();
const db = await ensureStorageReady();
assert.equal(getDbVersion(), 9, 'esquema vigente: Dexie v9 (a regra do intervalo não depende do esquema)');
assert.equal((await appConfig.getReportSettings()).gmd_dias_minimos, 21, 'banco novo (sem chave) → 21');
const gravar = (value) => db.table('appSettings').put({ key: 'report-settings:local', value });
// Base da 1.4.x: a chave existe, mas sem o campo novo → 21, divisor mantido.
await gravar({ versao: 1, arroba_divisor: 15 });
assert.deepEqual(await appConfig.getReportSettings(), { versao: 1, arroba_divisor: 15, gmd_dias_minimos: 21 }, 'chave da 1.4.x sem o campo → 21');
for (const valido of [7, 14, 21, 28]) {
  await gravar({ versao: 1, arroba_divisor: 15, gmd_dias_minimos: valido });
  assert.deepEqual(await appConfig.getReportSettings(), { versao: 1, arroba_divisor: 15, gmd_dias_minimos: valido }, `gravado ${valido} → ${valido}`);
}
for (const invalido of [10, 0, -7, null, '', 'abc', '21x', 35, 21.5]) {
  await gravar({ versao: 1, arroba_divisor: 15, gmd_dias_minimos: invalido });
  assert.deepEqual(await appConfig.getReportSettings(), { versao: 1, arroba_divisor: 15, gmd_dias_minimos: 21 }, `gravado ${JSON.stringify(invalido)} → 21, divisor mantido`);
}
const gestor = { id: 'g1', nome: 'Gestor', role: 'GESTOR' };
assert.equal((await appConfig.updateAppConfig(gestor, { gmd_dias_minimos: 'x' })).gmd_dias_minimos, 21, 'enviado inválido → 21');
assert.equal((await appConfig.updateAppConfig(gestor, { gmd_dias_minimos: 28 })).gmd_dias_minimos, 28, 'GESTOR escolhe 28');
// Ponta a ponta (aceite §7.2): a configuração gravada decide a qualidade do mesmo intervalo de 21 dias.
const comConfig = async () => pesar(21, 21, (await appConfig.getReportSettings()).gmd_dias_minimos);
assert.equal((await comConfig()).gmdQualidade, NAO_CONFIAVEL, 'Configurações em 28: 21 dias cinza');
await appConfig.updateAppConfig(gestor, { gmd_dias_minimos: 21 });
assert.equal((await comConfig()).gmdQualidade, CONFIAVEL, 'Configurações de volta a 21: 21 dias normal');
// NEGATIVO: uma regra que usasse o valor gravado cru (10) marcaria 20 dias como confiável.
const regraCrua = (dias, minimo) => (dias >= Number(minimo) ? CONFIAVEL : NAO_CONFIAVEL);
assert.equal(regraCrua(20, 10), CONFIAVEL, 'NEGATIVO: sem normalizar, 20 dias passaria como confiável');
assert.equal(classifyGmd({ dias: 20, gmd: 1 }, 10).gmdQualidade, NAO_CONFIAVEL, 'contrato normaliza o 10 para 21');
ok('dias-minimos-invalido-21');

// ---------------------------------------------------------------------------------------------------------------
// 7. O que é GRAVADO continua sendo só os 5 campos (serviço real)
// ---------------------------------------------------------------------------------------------------------------
for (const field of QUALITY_FIELDS) assert.ok(!LEGACY_PAYLOAD_ALLOWLIST.includes(field), `${field} fora da allowlist do legacy_payload`);
const TS = '2026-01-01T00:00:00.000Z';
await db.table('marcas').bulkAdd([{ id: 'm-abc', empresa_id: 'local', nome: 'ABC', nome_normalizado: 'ABC', ativo: true, created_at: TS, updated_at: TS, deleted_at: null }]);
const boi = (id, numero) => ({ empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, marca: 'ABC', marca_id: 'm-abc', sexo: 'M' });
// Lote: R1 30 dias (confiável) e repesado no dia seguinte (+12 kg em 1 dia = 12 kg/dia, cinza); R3 28 dias (confiável);
// R2 30 dias que a pesagem retroativa abaixo parte em 15 + 15 (cinza).
await weighingService.createEntry({ ...boi('R1', '1'), id: 'R1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-01', peso: 300 });
await weighingService.createEntry({ ...boi('R1', '1'), id: 'R1-m', tipo_manejo: 'Manejo', data_pesagem: '2026-07-01', peso: 330 });
await weighingService.createEntry({ ...boi('R1', '1'), id: 'R1-r', tipo_manejo: 'Manejo', data_pesagem: '2026-07-02', peso: 342 });
await weighingService.createEntry({ ...boi('R2', '2'), id: 'R2-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-01', peso: 310 });
await weighingService.createEntry({ ...boi('R2', '2'), id: 'R2-m', tipo_manejo: 'Manejo', data_pesagem: '2026-07-01', peso: 334 });
await weighingService.createEntry({ ...boi('R3', '3'), id: 'R3-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-03', peso: 320 });
await weighingService.createEntry({ ...boi('R3', '3'), id: 'R3-m', tipo_manejo: 'Manejo', data_pesagem: '2026-07-01', peso: 348 });
// Inserção RETROATIVA (dispara o recálculo da série): R2 ganha uma pesagem no meio.
await weighingService.createEntry({ ...boi('R2', '2'), id: 'R2-x', tipo_manejo: 'Manejo', data_pesagem: '2026-06-16', peso: 322 });

const linhas = await db.table('pesagens').toArray();
assert.equal(linhas.length, 8);
for (const linha of linhas) {
  for (const field of QUALITY_FIELDS) {
    assert.ok(!(field in linha), `${linha.id}: ${field} não é coluna gravada`);
    assert.ok(!(field in (linha.legacy_payload || {})), `${linha.id}: ${field} não vai para o legacy_payload`);
  }
}
const lida = (id) => weighingService.getEntryById(id);
const derivados = (row) => ({ data_anterior: row.data_anterior ?? null, peso_anterior: row.peso_anterior ?? null, dias: row.dias ?? null, ganho: row.ganho ?? null, gmd: row.gmd ?? null });
const r1r = await lida('R1-r');
assert.deepEqual(derivados(r1r), { data_anterior: '2026-07-01', peso_anterior: 330, dias: 1, ganho: 12, gmd: 12 }, 'o GMD do intervalo curto continua GRAVADO (o fato não muda)');
for (const field of QUALITY_FIELDS) assert.equal(r1r[field], undefined, `leitura do serviço sem ${field}`);
assert.deepEqual(derivados(await lida('R2-m')), { data_anterior: '2026-06-16', peso_anterior: 322, dias: 15, ganho: 12, gmd: 0.8 }, 'recálculo da série após a retroativa');
assert.deepEqual(derivados(await lida('R2-x')), { data_anterior: '2026-06-01', peso_anterior: 310, dias: 15, ganho: 12, gmd: 0.8 }, 'retroativa recebe os derivados');
assert.equal((await lida('R1-c')).gmd ?? null, null, 'Cadastro continua sem GMD gravado');
ok('gravado-so-5-campos');

// ---------------------------------------------------------------------------------------------------------------
// 8. Repesagem no dia seguinte não mexe no GMD médio do lote (aceite §7.1) — qualidade derivada NA LEITURA
// ---------------------------------------------------------------------------------------------------------------
const ultimas = [await lida('R1-m'), r1r, await lida('R2-m'), await lida('R3-m')];
const comQualidade = ultimas.map((row) => ({ ...row, ...classifyGmd({ dias: row.dias, gmd: row.gmd }) }));
assert.deepEqual(comQualidade.map((row) => [row.id, row.gmdQualidade, row.gmdMotivo]), [
  ['R1-m', CONFIAVEL, null],
  ['R1-r', NAO_CONFIAVEL, 'intervalo curto (1 dia)'],
  ['R2-m', NAO_CONFIAVEL, 'intervalo curto (15 dias)'],
  ['R3-m', CONFIAVEL, null],
]);
const media = (rows) => rows.reduce((sum, row) => sum + row.gmd, 0) / rows.length;
const mediaNova = media(comQualidade.filter((row) => gmdExibicao(row).entraNaMedia));
const mediaAntesDaRepesagem = media(comQualidade.filter((row) => row.id !== 'R1-r' && isGmdConfiavel(row.gmdQualidade)));
assert.equal(mediaNova, (1 + 1) / 2, 'média só dos confiáveis: (1,000 + 1,000) / 2');
assert.equal(mediaNova, mediaAntesDaRepesagem, 'a repesagem de 1 dia NÃO muda o GMD médio');
// NEGATIVO: na 1.4.2 tudo entrava na média — a repesagem de 1 dia puxava o lote para 3,7 kg/dia.
const mediaAntiga = media(ultimas);
assert.equal(Number(mediaAntiga.toFixed(3)), Number(((1 + 12 + 0.8 + 1) / 4).toFixed(3)));
assert.notEqual(mediaAntiga, mediaNova, 'NEGATIVO: a média da 1.4.2 mudava por causa da repesagem');
ok('repesagem-nao-mexe-na-media');

await deleteDbForTests();
console.log('OK verify-weighing-interval-rule');
console.log(JSON.stringify({ gate: 'weighing:interval-rule:verify', regras, total: regras.length }, null, 2));
