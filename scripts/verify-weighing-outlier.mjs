// Gate weighing:outlier:verify (M1 1.5.0, docs/plano-mestre/M1-FUNDACAO-NUMERO.md §3 e §1.2 item 7).
// Massa de TESTE em IndexedDB em memória (fake-indexeddb), conferível à mão; nunca o banco real.
//   1. Regras puras (weighing/domain/weightOutliers.js): 25 %; perda de 10 % em menos de 14 dias; MAD do lote com e
//      sem os 8 animais mínimos; perda possível (até 5 % em até 28 dias, animal presente); ORDEM das regras.
//   2. Lote no período: só GMD CONFIÁVEL entra na mediana/MAD e na comparação; o mínimo vem de gmd_dias_minimos.
//   3. Relatório "Pesagens para conferir" (aba Controle da Manutenção): 480 digitado 4800 aparece como provável
//      erro, a seguinte também; fora da curva do lote; perda possível; lote pequeno e animal vendido não entram;
//      ordenável e exportável (CSV/XLSX), colunas da especificação; só leitura.
//   4. Nada some das médias: a pesagem suspeita continua no relatório Pesagens (contagem, peso médio e GMD).
//   5. Ações por linha com o que já existe: Corrigir = Lançamento ?editar=<id> (correção auditada some da lista;
//      exclusão lógica com auditoria CANCELAR também); Ver ficha do animal.
//   6. Qualidade dos dados: "Manejo sem GMD" mostra também "intervalo curto (N dias)" (7/14/21; inválido → 21).
// Cada regra tem caso NEGATIVO: a regra antiga (ou uma regra trocada) reprovaria.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { deleteEntriesRespectingHistory } from '../src/modules/animals/application/animalHistoryService.js';
import {
  CLASSE_PESAGEM, MOTIVO_PESAGEM, OUTLIER_LIMITES, classifyWeighing, isPesagemParaConferir, medianAbsoluteDeviation,
} from '../src/modules/weighing/domain/weightOutliers.js';
import { GMD_QUALIDADE, classifyGmd } from '../src/modules/weighing/domain/gmdQuality.js';
import { listReports, runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { CSV_BOM, parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { getReportDefinition, listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { PESAGENS_CONFERIR_ACOES, PESAGENS_CONFERIR_COLUMN_IDS, PESAGENS_CONFERIR_ID } from '../src/modules/reporting/definitions/controle.js';
import { gmdDataIssues, loadWeighingCheckRows, weighingCheckRows } from '../src/modules/reporting/infrastructure/reportSources/controlSources.js';
import { can } from '../src/modules/auth/domain/permissionService.js';

const { OK, SUSPEITA_ERRO: ERRO, SUSPEITA_LOTE: LOTE, PERDA_POSSIVEL: PERDA } = CLASSE_PESAGEM;
const ADMIN = Object.freeze({ id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' });
const CONSULTA = Object.freeze({ id: 'u-consulta', nome: 'Cida Consulta', role: 'CONSULTA' });
const OPERADOR = Object.freeze({ id: 'u-op', nome: 'Otto Operador', role: 'OPERADOR' });
const TODAY = '2026-09-30';
const TS = '2026-01-01T00:00:00.000Z';
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-30' } };
const regras = [];
const ok = (name) => regras.push(name);
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `${message}: ${actual} ≠ ${expected}`);
const repoFile = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------------------------------------------------------
// 1. Regras puras
// ---------------------------------------------------------------------------------------------------------------
// Pesagem contra a anterior; GMD = variação ÷ dias; animal presente; sem lote (salvo quando passado).
const K = (pesoAnterior, pesoAtual, dias, extra = {}) => classifyWeighing({
  pesoAnterior, pesoAtual, dias, gmd: dias ? (pesoAtual - pesoAnterior) / dias : null, presente: true, ...extra,
});

// Mediana e MAD (robustos): 100 não puxa o centro.
assert.deepEqual(medianAbsoluteDeviation([1, 2, 3, 4, 100]), { mediana: 3, mad: 1 }, 'MAD: ímpar');
assert.deepEqual(medianAbsoluteDeviation([4, 1, 3, 2]), { mediana: 2.5, mad: 1 }, 'MAD: par (média dos dois do meio)');
assert.deepEqual(medianAbsoluteDeviation([null, '', 'x', undefined, 5]), { mediana: 5, mad: 0 }, 'MAD: vazio e texto ignorados');
assert.deepEqual(medianAbsoluteDeviation([]), { mediana: null, mad: null }, 'MAD: sem valores → null (nunca 0)');
assert.deepEqual(medianAbsoluteDeviation(null), { mediana: null, mad: null }, 'MAD: entrada ausente');
const loteCom4800 = [0.7, 0.725, 0.725, 0.75, 0.75, 0.775, 0.775, 0.8, 108.75];
const robusto = medianAbsoluteDeviation(loteCom4800);
close(robusto.mediana, 0.75, 'MAD: a mediana do lote não sente o 4800');
close(robusto.mad, 0.025, 'MAD: o MAD do lote não sente o 4800');
const media = loteCom4800.reduce((sum, value) => sum + value, 0) / loteCom4800.length;
assert.ok(media > 10, `NEGATIVO: a média (${media.toFixed(2)}) seria puxada pelo 4800 — por isso mediana e MAD`);
ok('mediana-mad');

// Regra 1a — variação absoluta acima de 25 % do peso anterior.
assert.equal(K(480, 600, 60).classe, OK, '+25 % exatos em 60 dias: não passa do limite');
assert.equal(K(480, 601, 60).classe, ERRO, '+25,2 %: provável erro');
assert.equal(K(480, 360, 60).classe, OK, '−25 % exatos em 60 dias: não passa do limite (e 60 dias não é perda rápida)');
assert.equal(K(480, 359, 60).classe, ERRO, '−25,2 %: provável erro');
assert.deepEqual(K(480, 4800, 40), { classe: ERRO, motivo: 'provável erro de balança ou digitação' }, '480 digitado 4800');
assert.equal(MOTIVO_PESAGEM.SUSPEITA_ERRO, 'provável erro de balança ou digitação');
assert.equal(OUTLIER_LIMITES.variacaoMaxima, 0.25);
// NEGATIVO: a regra com limite fechado ("≥ 25 %") apontaria o +25 % exato — difere da regra da especificação.
const limiteFechado = (anterior, atual) => (Math.abs(atual - anterior) / anterior >= 0.25 ? ERRO : OK);
assert.equal(limiteFechado(480, 600), ERRO, 'NEGATIVO: com "≥" o +25 % exato viraria erro');
assert.notEqual(limiteFechado(480, 600), K(480, 600, 60).classe, 'NEGATIVO: a regra é "maior que 25 %"');
ok('variacao-25');

// Regra 1b — perda acima de 10 % em MENOS de 14 dias.
assert.equal(K(400, 359, 13).classe, ERRO, 'perda de 10,25 % em 13 dias: provável erro');
assert.equal(K(400, 359, 14).classe, OK, 'a mesma perda em 14 dias: não é "menos de 14" (e passa de 5 %: não é perda possível)');
assert.equal(K(400, 360, 13).classe, OK, 'perda de 10 % exatos em 13 dias: não passa do limite');
assert.equal(K(400, 359, null).classe, OK, 'sem dias: a perda rápida não é avaliada');
assert.equal(K(400, 440, 5).classe, OK, 'GANHO de 10 % em 5 dias não é perda');
assert.equal(K(400, 359, 13, { presente: false }).classe, ERRO, 'erro vale com ou sem o animal presente');
// NEGATIVO: só a regra de 25 % deixaria passar a perda de 10,25 % em 13 dias.
const so25 = (anterior, atual) => (Math.abs(atual - anterior) / anterior > 0.25 ? ERRO : OK);
assert.equal(so25(400, 359), OK, 'NEGATIVO: sem a regra dos 10 % em 14 dias a perda rápida passaria');
assert.notEqual(so25(400, 359), K(400, 359, 13).classe, 'NEGATIVO: a perda rápida é a segunda metade da regra 1');
ok('perda-10-em-14');

// Regra 2 — fora da curva do lote (MAD), só com 8 animais ou mais.
const lote8 = { gmdMedianaLote: 0.75, madLote: 0.025, nLote: 8 };
const limiar = OUTLIER_LIMITES.madFator * OUTLIER_LIMITES.madEscala * lote8.madLote;
close(limiar, 3.5 * 1.4826 * 0.025, 'limiar = 3,5 × 1,4826 × MAD');
assert.deepEqual(K(400, 480, 40, { ...lote8, gmd: 2 }), { classe: LOTE, motivo: 'fora da curva do lote' }, 'GMD 2,0 com o lote em 0,75: fora da curva');
assert.equal(K(400, 480, 40, { ...lote8, gmd: 2, nLote: 7 }).classe, OK, 'lote com 7 animais: não classifica');
assert.equal(K(400, 480, 40, { ...lote8, gmd: 2, nLote: null }).classe, OK, 'sem lote: não classifica');
assert.equal(K(400, 430, 40, { ...lote8, gmd: 0.75 + 0.129 }).classe, OK, 'logo abaixo do limiar: dentro da curva');
assert.equal(K(400, 430, 40, { ...lote8, gmd: 0.75 + 0.13 }).classe, LOTE, 'logo acima do limiar: fora da curva');
assert.equal(K(400, 430, 40, { ...lote8, gmd: 0.75 - 0.13 }).classe, LOTE, 'abaixo da curva também (|gmd − mediana|)');
assert.equal(K(400, 480, 40, { ...lote8, gmd: null }).classe, OK, 'GMD não confiável (null) não é comparado com o lote');
// NEGATIVO: ignorando o mínimo de 8 animais, o lote de 7 classificaria.
const semMinimo = (gmd, { gmdMedianaLote, madLote }) => (Math.abs(gmd - gmdMedianaLote) > limiar && madLote !== null ? LOTE : OK);
assert.equal(semMinimo(2, { ...lote8, nLote: 7 }), LOTE, 'NEGATIVO: sem o mínimo de 8 animais o lote de 7 apontaria o GMD 2,0');
assert.notEqual(semMinimo(2, { ...lote8, nLote: 7 }), K(400, 480, 40, { ...lote8, gmd: 2, nLote: 7 }).classe, 'NEGATIVO: o mínimo de 8 animais é parte da regra');
ok('lote-mad-8-animais');

// Regra 3 — perda possível (alerta de manejo).
assert.deepEqual(K(400, 390, 20), { classe: PERDA, motivo: 'perda possível — verificar sanidade' }, 'perda de 2,5 % em 20 dias, presente');
assert.equal(K(400, 390, 20, { presente: false }).classe, OK, 'animal fora do rebanho (saída): sem alerta');
assert.equal(K(400, 390, 20, { presente: undefined }).classe, OK, 'presença não confirmada: sem alerta');
assert.equal(K(400, 380, 28).classe, PERDA, 'perda de 5 % exatos em 28 dias: perda possível');
assert.equal(K(400, 379, 28).classe, OK, 'perda de 5,25 %: não é "até 5 %"');
assert.equal(K(400, 390, 29).classe, OK, '29 dias: não é "até 28 dias"');
assert.equal(K(400, 400, 20).classe, OK, 'sem perda');
ok('perda-possivel');

// Ordem das regras: a primeira que vale decide.
assert.equal(K(480, 4800, 40, { ...lote8, gmd: 108.75 }).classe, ERRO, 'ordem: erro (1) antes do lote (2)');
assert.equal(K(400, 359, 13, { ...lote8, gmd: -3.15 }).classe, ERRO, 'ordem: perda rápida (1) antes do lote (2)');
assert.equal(K(400, 388, 20, { ...lote8, gmd: -0.6 }).classe, LOTE, 'ordem: lote (2) antes da perda possível (3)');
assert.equal(K(400, 388, 20, { ...lote8, gmd: -0.6, nLote: 7 }).classe, PERDA, 'sem lote que classifique, a mesma pesagem é perda possível');
// NEGATIVO: com a ordem trocada (perda possível antes do lote) a pesagem fora da curva viraria só "perda possível".
const entradaForaDaCurva = { pesoAnterior: 400, pesoAtual: 388, dias: 20, gmd: -0.6, ...lote8, presente: true };
const perdaAntesDoLote = (input) => {
  const semLote = classifyWeighing({ ...input, nLote: 0 });
  return semLote.classe === PERDA ? PERDA : classifyWeighing(input).classe;
};
assert.equal(perdaAntesDoLote(entradaForaDaCurva), PERDA, 'NEGATIVO: com a ordem trocada daria perda possível');
assert.notEqual(perdaAntesDoLote(entradaForaDaCurva), classifyWeighing(entradaForaDaCurva).classe, 'NEGATIVO: a ordem da especificação dá fora da curva');
ok('ordem-das-regras');

// Sem anterior / entradas vazias.
assert.deepEqual(classifyWeighing({ pesoAtual: 400, pesoAnterior: null, dias: null, gmd: null }), { classe: OK, motivo: null }, 'sem pesagem anterior: OK');
assert.deepEqual(classifyWeighing(), { classe: OK, motivo: null }, 'sem nada: OK');
assert.deepEqual(classifyWeighing({ pesoAtual: 0, pesoAnterior: 400, dias: 10 }), { classe: OK, motivo: null }, 'peso 0 não é pesagem');
assert.deepEqual([OK, ERRO, LOTE, PERDA, null].map(isPesagemParaConferir), [false, true, true, true, false], 'só classe ≠ OK vai para a lista');
ok('sem-anterior');

// ---------------------------------------------------------------------------------------------------------------
// 2. Lote no período (função pura da fonte): só GMD CONFIÁVEL entra na mediana/MAD e na comparação.
// ---------------------------------------------------------------------------------------------------------------
const linha = (id, animal, peso, pesoAnterior, dias, extra = {}) => ({
  id, animal_id: animal, animal_key: animal, animal_id_resolvido: animal, numero_animal: animal, tipo_manejo: 'Manejo', situacao_atual: 'ATIVO',
  lote_id: 'L', nome_lote: 'Lote', peso, peso_anterior: pesoAnterior, dias, ganho: peso - pesoAnterior, gmd: Number(((peso - pesoAnterior) / dias).toFixed(3)), ...extra,
});
const ganhos = [28, 29, 29, 30, 30, 31, 31, 32];
const lotePuro = [
  ...ganhos.map((ganho, index) => linha(`n${index}`, `N${index}`, 400 + ganho, 400, 40)),
  linha('curta', 'X', 445, 430, 10), // 1,5 kg/dia em 10 dias: NÃO confiável com 21
];
assert.deepEqual(weighingCheckRows(lotePuro, { diasMinimos: 21 }).map((row) => row.id), [], 'intervalo curto (10 dias) fica fora da comparação com o lote (mínimo 21)');
const com7 = weighingCheckRows(lotePuro, { diasMinimos: 7 });
assert.deepEqual(com7.map((row) => [row.id, row.classe_conferencia, row.gmdQualidade]), [['curta', LOTE, GMD_QUALIDADE.CONFIAVEL]], 'mínimo 7: os 10 dias viram confiáveis e o 1,5 sai da curva');
assert.equal(com7[0].animais_lote_gmd, 9, 'mínimo 7: 9 animais na mediana do lote');
assert.equal(weighingCheckRows(lotePuro, { diasMinimos: 'x' }).length, 0, 'mínimo inválido → 21');
// NEGATIVO: comparar o GMD não confiável com o lote apontaria a pesagem de conferência.
assert.equal(classifyWeighing({ pesoAtual: 445, pesoAnterior: 430, dias: 10, gmd: 1.5, gmdMedianaLote: 0.75, madLote: 0.025, nLote: 8, presente: true }).classe, LOTE, 'NEGATIVO: sem respeitar a qualidade, a conferência de 10 dias seria "fora da curva"');
// Presença: vendido (saída) ou a própria Saída não dão "perda possível".
const perda = linha('p', 'P', 420, 430, 18);
assert.deepEqual(weighingCheckRows([perda]).map((row) => row.classe_conferencia), [PERDA], 'perda de 2,3 % em 18 dias: perda possível');
assert.deepEqual(weighingCheckRows([perda], { animalsWithExit: new Set(['P']) }), [], 'animal com saída: sem alerta');
assert.deepEqual(weighingCheckRows([{ ...perda, tipo_manejo: 'Saída' }]), [], 'a própria Saída: sem alerta');
assert.deepEqual(weighingCheckRows([{ ...perda, situacao_atual: 'VENDIDO' }]), [], 'projeção fora do rebanho: sem alerta');
assert.deepEqual(weighingCheckRows([linha('sem-ant', 'Z', 400, null, null, { ganho: null, gmd: null })]), [], 'sem pesagem anterior: fora da lista');
ok('lote-so-confiavel');

// ---------------------------------------------------------------------------------------------------------------
// 3. Massa de teste (cadastros, Lote 01 com 14 animais, Lote 02 com 7, um sem lote e um registro antigo)
// ---------------------------------------------------------------------------------------------------------------
setActorProvider(null);
await deleteDbForTests();
const db = await storage.ensureReady();
const registry = (id, nome) => ({ id, empresa_id: 'local', nome, nome_normalizado: nome.toUpperCase(), ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
await db.table('marcas').bulkAdd([registry('m-alfa', 'ALFA')]);
await db.table('racas').bulkAdd([registry('r-nelore', 'Nelore')]);
await db.table('usuarios').bulkAdd([{ id: OPERADOR.id, nome: OPERADOR.nome, login: 'otto', role: 'OPERADOR', ativo: true, created_at: TS, updated_at: TS, deleted_at: null }]);
await db.table('apartacoes').bulkAdd([{ id: 'ap1', empresa_id: 'local', nome_apartacao: 'Engorda', ativo: true, created_at: TS, updated_at: TS, deleted_at: null }]);
await db.table('loteApartacoes').bulkAdd([
  { id: 'L1', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: 'Lote 01', quantidade_maxima: 50, created_at: TS, updated_at: TS, deleted_at: null },
  { id: 'L2', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'Engorda', nome_lote: 'Lote 02', quantidade_maxima: 50, created_at: TS, updated_at: TS, deleted_at: null },
]);
const lote = (id) => (id ? { lote_id: id, nome_lote: id === 'L1' ? 'Lote 01' : 'Lote 02', apartacao_id: 'ap1', nome_apartacao: 'Engorda' } : {});
const animal = (id, numero, loteId = 'L1') => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore', ...lote(loteId),
});
// Lançado pelo operador (coluna Operador da lista).
setActorProvider(() => OPERADOR);
const pesar = (base, id, tipo, data, peso, extra = {}) => weighingService.createEntry({ ...base, id, tipo_manejo: tipo, data_pesagem: data, peso, ...extra });
// Lote 01: 8 animais normais (GMD 0,700 a 0,800 em 40 dias)...
for (const [index, ganho] of ganhos.entries()) {
  const base = animal(`N${index + 1}`, String(101 + index));
  await pesar(base, `N${index + 1}-c`, 'Cadastro', '2026-08-01', 400);
  await pesar(base, `N${index + 1}-m`, 'Manejo', '2026-09-10', 400 + ganho);
}
// ... H fora da curva (+20 % em 40 dias, GMD 2,0) ...
await pesar(animal('H', '201'), 'H-c', 'Cadastro', '2026-08-01', 400);
await pesar(animal('H', '201'), 'H-m', 'Manejo', '2026-09-10', 480);
// ... E: 480 digitado 4800 (anterior 450) e a pesagem seguinte (495, contra os 4800) ...
await pesar(animal('E', '202'), 'E-c', 'Cadastro', '2026-08-01', 450);
await pesar(animal('E', '202'), 'E-m', 'Manejo', '2026-09-10', 4800);
await pesar(animal('E', '202'), 'E-m2', 'Manejo', '2026-09-25', 495);
// ... X conferência 10 dias depois (GMD 1,5 de intervalo curto), P perda pequena (18 dias), Q a mesma perda mas
// vendido depois, R perda de 10,5 % em 10 dias.
for (const [id, numero] of [['X', '203'], ['P', '204'], ['Q', '205'], ['R', '206']]) {
  await pesar(animal(id, numero), `${id}-c`, 'Cadastro', '2026-08-01', 400);
  await pesar(animal(id, numero), `${id}-m`, 'Manejo', '2026-09-10', 430);
}
await pesar(animal('X', '203'), 'X-m2', 'Manejo', '2026-09-20', 445);
await pesar(animal('P', '204'), 'P-m2', 'Manejo', '2026-09-28', 420);
await pesar(animal('Q', '205'), 'Q-m2', 'Manejo', '2026-09-25', 420);
await pesar(animal('Q', '205'), 'Q-s', 'Saída', '2026-09-28', 425, { motivo_saida: 'Venda', comprador: 'Frigo Sul' });
await pesar(animal('R', '206'), 'R-m2', 'Manejo', '2026-09-20', 385);
// Lote 02: só 7 animais (6 normais + O com GMD 1,5): o lote não classifica.
for (const [index, ganho] of [28, 29, 30, 30, 31, 32].entries()) {
  const base = animal(`M${index + 1}`, String(301 + index), 'L2');
  await pesar(base, `M${index + 1}-c`, 'Cadastro', '2026-08-01', 300);
  await pesar(base, `M${index + 1}-m`, 'Manejo', '2026-09-10', 300 + ganho);
}
await pesar(animal('O', '307', 'L2'), 'O-c', 'Cadastro', '2026-08-01', 300);
await pesar(animal('O', '307', 'L2'), 'O-m', 'Manejo', '2026-09-10', 360);
// Sem lote: S com +50 % (erro vale sem lote).
await pesar(animal('S', '401', null), 'S-c', 'Cadastro', '2026-08-01', 400);
await pesar(animal('S', '401', null), 'S-m', 'Manejo', '2026-09-10', 600);
setActorProvider(null);
// Registro antigo sem ligação com o cadastro (sem animal): 400 → 2000.
await db.table('pesagens').add({
  id: 'LEG-m', data_pesagem: '2026-09-10', peso_kg: 2000, animal_id: null, tipo_pesagem: 'Manejo', created_at: TS, updated_at: TS, deleted_at: null,
  legacy_payload: { id: 'LEG-m', empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-09-10', numero_animal: '999', marca: 'SEM CADASTRO', peso: 2000, data_anterior: '2026-08-01', peso_anterior: 400, dias: 40, ganho: 1600, gmd: 40 },
});
const settings = async (value) => db.table('appSettings').put({ key: 'report-settings:local', value: { versao: 1, arroba_divisor: 30, ...value } });
await settings({ gmd_dias_minimos: 21 });

const conferir = (selection = {}, actor = ADMIN) => runReport(PESAGENS_CONFERIR_ID, { today: TODAY, params: P, selection }, actor);
const byId = (vm) => Object.fromEntries(vm.rows.map((row) => [row.id, row]));
const contagem = async () => Object.fromEntries(await Promise.all(['pesagens', 'animais', 'auditoria', 'appSettings'].map(async (name) => [name, await db.table(name).count()])));
const retrato = async () => JSON.stringify((await db.table('pesagens').toArray()).map((row) => [row.id, row.updated_at, row.peso_kg, row.deleted_at]));

const antes = await contagem();
const retratoAntes = await retrato();
const lista = await conferir();
assert.deepEqual(await contagem(), antes, 'a lista só lê (nada gravado)');
assert.equal(await retrato(), retratoAntes, 'nenhuma pesagem alterada pela lista');

const definition = getReportDefinition(PESAGENS_CONFERIR_ID);
assert.equal(definition.title, 'Pesagens para conferir');
assert.equal(definition.visibility, 'maintenance', 'na aba Controle da Manutenção');
assert.ok(listReportDefinitions({ visibility: 'maintenance' }).some((item) => item.id === PESAGENS_CONFERIR_ID), 'listado na aba Controle');
assert.ok(listReports(ADMIN, { visibility: 'maintenance' }).some((item) => item.id === PESAGENS_CONFERIR_ID && item.available), 'ADMIN abre na aba Controle');
assert.deepEqual(lista.columns.map((column) => column.id), PESAGENS_CONFERIR_COLUMN_IDS, 'colunas: animal, data, peso, peso anterior, dias, ganho, GMD, classe, motivo, lote, operador, origem');
assert.deepEqual(PESAGENS_CONFERIR_COLUMN_IDS, ['numero_animal', 'data_pesagem', 'peso', 'peso_anterior', 'dias', 'ganho', 'gmd', 'classe_conferencia', 'motivo_conferencia', 'nome_lote', 'operador', 'origem_registro']);
assert.equal(lista.mode, 'DETALHADO', 'lista linha a linha');

const linhas = byId(lista);
const esperado = {
  'E-m': [ERRO, 'provável erro de balança ou digitação'],
  'E-m2': [ERRO, 'provável erro de balança ou digitação'],
  'R-m2': [ERRO, 'provável erro de balança ou digitação'],
  'S-m': [ERRO, 'provável erro de balança ou digitação'],
  'LEG-m': [ERRO, 'provável erro de balança ou digitação'],
  'H-m': [LOTE, 'fora da curva do lote'],
  'P-m2': [PERDA, 'perda possível — verificar sanidade'],
};
assert.deepEqual(Object.fromEntries(Object.entries(linhas).map(([id, row]) => [id, [row.classe_conferencia, row.motivo_conferencia]])), esperado, 'a lista: erros, fora da curva e perda possível — só classe ≠ OK');
// O caso da responsável: 480 digitado 4800.
assert.equal(linhas['E-m'].peso, 4800);
assert.equal(linhas['E-m'].peso_anterior, 450);
assert.equal(linhas['E-m'].dias, 40);
assert.equal(linhas['E-m'].operador_nome, OPERADOR.nome, 'operador de quem lançou');
assert.equal(linhas['E-m'].nome_lote, 'Lote 01');
assert.equal(linhas['E-m2'].peso_anterior, 4800, 'a pesagem seguinte mede contra os 4800 e também é apontada');
// Fora da lista, cada um pelo seu motivo.
assert.ok(!linhas['X-m2'], 'conferência 10 dias depois (GMD 1,5 de intervalo curto) não é comparada com o lote');
close(linhas['H-m'].gmd_mediana_lote, 0.75, 'mediana do Lote 01 só com GMD confiável');
close(linhas['H-m'].gmd_mad_lote, 0.025, 'MAD do Lote 01 (o 4800 não puxa)');
assert.equal(linhas['H-m'].animais_lote_gmd, 14, 'animais do Lote 01 com GMD confiável no período');
assert.ok(!linhas['O-m'], 'Lote 02 com 7 animais: o GMD 1,5 do O não é classificado');
assert.ok(!linhas['Q-m2'], 'Q perdeu 2,3 % mas foi vendido: sem alerta de sanidade');
assert.ok(!linhas['Q-s'], 'a venda (ganho contra a anterior) não é apontada');
assert.ok(['N1-m', 'N8-m', 'X-m', 'P-m', 'M1-m', 'E-c'].every((id) => !linhas[id]), 'normais e cadastros fora da lista');
assert.equal(linhas['P-m2'].gmdQualidade, GMD_QUALIDADE.NAO_CONFIAVEL, 'GMD de 18 dias: não confiável (fica cinza na folha)');
assert.equal(linhas['P-m2'].gmdMotivo, 'intervalo curto (18 dias)');
assert.equal(lista.uniqueAnimalCount, 6, 'animais únicos (E, R, S, H, P e o registro antigo)');
// NEGATIVO: o lote de 7 classificaria com o mínimo ignorado; e as regras antigas (Pendências de pesagem) não viam o 4800.
assert.equal(classifyWeighing({ pesoAtual: 360, pesoAnterior: 300, dias: 40, gmd: 1.5, gmdMedianaLote: 0.75, madLote: 0.025, nLote: 8, presente: true }).classe, LOTE, 'NEGATIVO: com 8 animais o O seria fora da curva');
const pendencias = await runReport('pesagens.pendencias', { today: TODAY, params: P }, ADMIN);
assert.ok(!pendencias.rows.some((row) => row.id === 'E-m'), 'NEGATIVO: as pendências do Fechamento do Dia (regra antiga) não apontam o 4800');
ok('lista-pesagens-para-conferir');

// Mínimo do GMD (Configurações › Relatórios): 7 → a conferência de 10 dias passa a confiável e sai da curva.
await settings({ gmd_dias_minimos: 7 });
const lista7 = byId(await conferir());
assert.equal(lista7['X-m2']?.classe_conferencia, LOTE, 'mínimo 7: X (10 dias, GMD 1,5) fora da curva do lote');
assert.equal(lista7['P-m2']?.classe_conferencia, LOTE, 'mínimo 7: P (18 dias) confiável, comparada com o lote antes da perda possível (ordem)');
await settings({ gmd_dias_minimos: 10 });
assert.ok(!byId(await conferir())['X-m2'], 'mínimo inválido gravado (10) → 21');
await settings({ gmd_dias_minimos: 21 });
// O argumento do serviço (gmdDiasMinimos) vale sobre a configuração.
const direto = await loadWeighingCheckRows({ period: P.periodo, empresaId: 'local', arrobaDivisor: 30, gmdDiasMinimos: 7 });
assert.equal(direto.rows.find((row) => row.id === 'X-m2')?.classe_conferencia, LOTE, 'gmdDiasMinimos da fonte vale sobre Configurações');
assert.match(direto.strategy, /index:data_pesagem\+index:pesagens\.tipo_pesagem/, 'leitura indexada (período e saídas)');
ok('minimo-do-gmd');

// Ordenável e exportável.
const porPeso = await conferir({ sort: [{ columnId: 'peso', direction: 'desc' }] });
assert.deepEqual(porPeso.rows.slice(0, 2).map((row) => row.id), ['E-m', 'LEG-m'], 'ordenada por peso (maior primeiro): o 4800 no topo');
const porClasse = await conferir({ groups: [{ columnId: 'classe_conferencia' }], mode: 'DETALHADO' });
assert.deepEqual(porClasse.tree.map((node) => node.label), ['Suspeita de erro', 'Fora da curva do lote', 'Perda possível'], 'agrupar por classe segue a ordem das regras');
const csv = await prepareEmission(lista, 'csv', ADMIN);
const [cabecalho, ...corpo] = parseCsv(csv.content.startsWith(CSV_BOM) ? csv.content.slice(CSV_BOM.length) : csv.content);
for (const titulo of ['Animal', 'Data', 'Peso', 'Peso anterior', 'Dias', 'Ganho', 'GMD', 'Classe', 'Motivo', 'Lote', 'Operador', 'Origem do registro']) {
  assert.ok(cabecalho.some((cell) => cell.startsWith(titulo)), `CSV: coluna ${titulo}`);
}
const linhaCsv = corpo.find((cells) => cells.includes('Suspeita de erro') && cells.some((cell) => /4\.?800/.test(cell)));
assert.ok(linhaCsv, 'CSV: a linha do 4800 com a classe');
assert.ok(linhaCsv.includes('provável erro de balança ou digitação'), 'CSV: com o motivo');
assert.equal(corpo.filter((cells) => cells.includes('Perda possível')).length, 1, 'CSV: a perda possível');
const xlsx = await prepareEmission(lista, 'xlsx', ADMIN);
assert.ok(xlsx.content && xlsx.content.length > 0 && xlsx.manifest.recordCount === lista.rowCount, 'XLSX gerado com as mesmas linhas');
// CONSULTA abre (só leitura); as ações por linha pedem as permissões de quem corrige/consulta.
assert.equal((await conferir({}, CONSULTA)).rowCount, lista.rowCount, 'CONSULTA vê a mesma lista');
ok('ordenavel-exportavel');

// ---------------------------------------------------------------------------------------------------------------
// 4. Nada some das médias: a pesagem apontada continua no relatório Pesagens.
// ---------------------------------------------------------------------------------------------------------------
const pesagens = await runReport('pesagens', {
  today: TODAY, arrobaDivisor: 30, params: P,
  selection: { mode: 'DETALHADO', groups: [], aggregates: [{ id: 'registros', op: 'count' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }, { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' }] },
}, ADMIN);
const ativasNoPeriodo = (await db.table('pesagens').toArray()).filter((row) => !row.deleted_at && row.data_pesagem >= '2026-08-01' && row.data_pesagem <= '2026-09-30');
assert.equal(pesagens.totals.registros.value, ativasNoPeriodo.length, 'Pesagens: todas as pesagens do período, apontadas ou não');
assert.ok(pesagens.rows.some((row) => row.id === 'E-m') && pesagens.rows.some((row) => row.id === 'H-m') && pesagens.rows.some((row) => row.id === 'P-m2'), 'Pesagens: as apontadas continuam na folha');
const suspeitas = new Set(lista.rows.map((row) => row.id));
const mediaDe = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const pesos = (rows) => rows.map((row) => Number(row.peso)).filter((value) => value > 0);
close(pesagens.totals.peso_medio.value, mediaDe(pesos(pesagens.rows)), 'peso médio com as apontadas dentro', 1e-6);
assert.ok(Math.abs(pesagens.totals.peso_medio.value - mediaDe(pesos(pesagens.rows.filter((row) => !suspeitas.has(row.id))))) > 1, 'NEGATIVO: excluindo as apontadas o peso médio seria outro');
// GMD ponderado = Σ ganho ÷ Σ dias dos intervalos que entram (todos com dias > 0 na 1.4.2; só os CONFIÁVEIS na M1 —
// regra do agente dos relatórios). Qualquer que seja a regra em vigor, as pesagens apontadas estão DENTRO da conta.
const comAnterior = pesagens.rows.filter((row) => Number(row.dias) > 0 && row.ganho !== null && row.ganho !== undefined && row.ganho !== '' && Number.isFinite(Number(row.ganho)));
const ponderado = (rows) => rows.reduce((sum, row) => sum + Number(row.ganho), 0) / rows.reduce((sum, row) => sum + Number(row.dias), 0);
const regrasGmd = { 'todos os intervalos': () => true, 'só os confiáveis (21 dias)': (row) => Number(row.dias) >= 21 };
const gmdTela = pesagens.totals.gmd_ponderado.value;
const regraGmd = Object.entries(regrasGmd).find(([, entra]) => Math.abs(ponderado(comAnterior.filter(entra)) - gmdTela) < 1e-6);
assert.ok(regraGmd, `GMD ponderado (${gmdTela}) = Σ ganho ÷ Σ dias com as apontadas dentro`);
assert.ok(Math.abs(ponderado(comAnterior.filter(regraGmd[1]).filter((row) => !suspeitas.has(row.id))) - gmdTela) > 0.01, `NEGATIVO: excluindo as apontadas o GMD ponderado seria outro (regra: ${regraGmd[0]}) — apontar não exclui (exclusão é da M2)`);
ok('nada-some-das-medias');

// ---------------------------------------------------------------------------------------------------------------
// 5. Ações por linha: Corrigir (Lançamento ?editar=) e Ver ficha do animal — o que JÁ existe, sem esquema novo.
// ---------------------------------------------------------------------------------------------------------------
const acao = (id) => PESAGENS_CONFERIR_ACOES.find((item) => item.id === id);
assert.deepEqual(PESAGENS_CONFERIR_ACOES.map((item) => [item.id, item.label, item.permission]), [['corrigir', 'Corrigir', 'weighing.edit'], ['ficha', 'Ver ficha do animal', 'animal.read']]);
assert.equal(acao('corrigir').page(linhas['E-m']), 'LancamentoPesagensIndividuais?editar=E-m', 'Corrigir abre a pesagem no Lançamento (o mesmo link do Editar da Relação)');
assert.equal(acao('ficha').page(linhas['E-m']), 'FichaAnimal?animal=E', 'Ver ficha do animal');
assert.equal(acao('ficha').page(linhas['LEG-m']), null, 'registro antigo sem animal: sem ficha');
assert.equal(acao('corrigir').page(linhas['LEG-m']), 'LancamentoPesagensIndividuais?editar=LEG-m');
assert.deepEqual(['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA'].map((role) => can(role, 'weighing.edit')), [true, true, true, false], 'Corrigir só para quem edita pesagem (CONSULTA não vê a ação)');
// O link cai no fluxo existente: o Lançamento lê ?editar= e abre a pesagem pelo mesmo handleEditar da grade.
const lancamento = repoFile('src/pages/LancamentoPesagensIndividuais.jsx');
assert.match(lancamento, /urlParams\.get\('editar'\)/, 'Lançamento lê ?editar=');
assert.match(lancamento, /handleEditar\(pesagem\)/, 'e abre a pesagem para edição');
assert.match(repoFile('src/pages/PesagensIndividuais.jsx'), /LancamentoPesagensIndividuais\?editar=\$\{p\.id\}/, 'o mesmo link do "Editar" da Relação de Pesagens');
// A tela: ações só na lista de conferência, repassadas à grade.
const manutencao = repoFile('src/pages/ManutencaoSistema.jsx');
assert.match(manutencao, /openReportId !== PESAGENS_CONFERIR_ID\) return null/, 'ações só em "Pesagens para conferir"');
assert.match(manutencao, /rowActions=\{rowActions\}/, 'a Manutenção passa as ações ao ReportView');
assert.match(repoFile('src/components/reports/ReportView.jsx'), /rowActions=\{tableRowActions\}/, 'o ReportView repassa o menu por linha à grade');

// Corrigir no Lançamento = updateEntry (Atualizar): 4800 → 480, auditado; a série recalcula e as duas somem da lista.
setActorProvider(() => ADMIN);
await weighingService.updateEntry('E-m', { peso: 480 });
setActorProvider(null);
const atualizacao = (await db.table('auditoria').toArray()).filter((row) => row.entidade_id === 'E-m' && row.acao === 'ATUALIZAR');
assert.equal(atualizacao.length, 1, 'correção auditada (ATUALIZAR, com antes e depois)');
const corrigida = byId(await conferir());
assert.ok(!corrigida['E-m'] && !corrigida['E-m2'], 'corrigido o 4800: a pesagem e a seguinte saem da lista');
// Cancelar (Excluir da grade do Lançamento): exclusão lógica com auditoria CANCELAR.
setActorProvider(() => ADMIN);
await deleteEntriesRespectingHistory({ entries: await weighingService.listEntries({ empresaId: 'local' }), ids: ['R-m2'] });
setActorProvider(null);
const cancelada = (await db.table('pesagens').where('id').equals('R-m2').toArray())[0];
assert.ok(cancelada.deleted_at, 'exclusão lógica (deleted_at), o registro fica');
assert.ok((await db.table('auditoria').toArray()).some((row) => row.entidade_id === 'R-m2' && row.acao === 'CANCELAR'), 'auditoria CANCELAR');
assert.ok(!byId(await conferir())['R-m2'], 'cancelada: sai da lista');
ok('acoes-corrigir-ficha');

// ---------------------------------------------------------------------------------------------------------------
// 6. Qualidade dos dados: "Manejo sem GMD" com o motivo "intervalo curto (N dias)".
// ---------------------------------------------------------------------------------------------------------------
const curtos = async () => Object.fromEntries((await runReport('controle.qualidade-dados', { today: TODAY }, ADMIN)).rows
  .filter((row) => row.categoria_problema === 'Manejo sem GMD' && /intervalo curto/.test(row.descricao)).map((row) => [row.registro, row.descricao]));
const curtos21 = await curtos();
assert.deepEqual(Object.keys(curtos21).sort(), ['E-m2', 'P-m2', 'Q-m2', 'X-m2'], 'mínimo 21: as pesagens de 10, 15 e 18 dias');
assert.equal(curtos21['X-m2'], 'manejo do animal 203 em 20/09/2026 sem GMD: intervalo curto (10 dias) — o GMD aparece em cinza e não entra na média', 'descrição em linguagem de curral');
assert.match(curtos21['P-m2'], /intervalo curto \(18 dias\)/);
await settings({ gmd_dias_minimos: 14 });
assert.deepEqual(Object.keys(await curtos()).sort(), ['X-m2'], 'mínimo 14: só os 10 dias');
await settings({ gmd_dias_minimos: 7 });
assert.deepEqual(Object.keys(await curtos()), [], 'mínimo 7: nenhum');
await settings({ gmd_dias_minimos: 'abc' });
assert.deepEqual(Object.keys(await curtos()).sort(), ['E-m2', 'P-m2', 'Q-m2', 'X-m2'], 'mínimo inválido → 21');
await settings({ gmd_dias_minimos: 21 });
// Função pura: o GMD de intervalo longo e o Cadastro não entram; o motivo é o do contrato (gmdQuality).
const pura = gmdDataIssues({ pesagens: [
  { id: 'a', animal_id: 'A', tipo_manejo: 'Manejo', numero_animal: '1', data_pesagem: '2026-09-10', peso: 430, dias: 3, gmd: 2 },
  { id: 'b', animal_id: 'B', tipo_manejo: 'Manejo', numero_animal: '2', data_pesagem: '2026-09-10', peso: 430, dias: 40, gmd: 0.75 },
  { id: 'c', animal_id: 'C', tipo_manejo: 'Cadastro', numero_animal: '3', data_pesagem: '2026-09-10', peso: 430, dias: 3, gmd: 2 },
] });
assert.deepEqual(pura.map((row) => row.registro), ['a'], 'só o Manejo de intervalo curto');
assert.match(pura[0].descricao, /intervalo curto \(3 dias\)/);
assert.equal(pura[0].gravidade, 'MEDIA');
assert.equal(classifyGmd({ dias: 3, gmd: 2 }, 21).gmdMotivo, 'intervalo curto (3 dias)', 'mesmo motivo do contrato');
// NEGATIVO: a regra antiga ("Manejo sem GMD" = GMD vazio) não apontava o GMD gravado de 10 dias.
const xm2 = (await db.table('pesagens').where('id').equals('X-m2').toArray())[0];
assert.equal(Number(xm2.gmd ?? xm2.legacy_payload?.gmd), 1.5, 'NEGATIVO: o GMD de 10 dias está gravado (a regra antiga, só GMD vazio, não o via)');
ok('qualidade-dos-dados-intervalo-curto');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'weighing:outlier:verify', ok: true, regras,
  limites: OUTLIER_LIMITES,
  lista: { linhas: lista.rowCount, classes: Object.fromEntries(Object.entries(esperado).map(([id, [classe]]) => [id, classe])), estrategia: lista.stats.strategy },
}, null, 2));
