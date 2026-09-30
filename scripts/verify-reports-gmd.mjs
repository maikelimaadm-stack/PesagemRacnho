// Gate reports:gmd:verify (E1G 1.4.2, docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte A — A1, A2, A3, A4 e A6).
// Massa de TESTE em IndexedDB em memória (fake-indexeddb), conferível à mão; nunca o banco real.
//   A1. Saída com peso ganha data/peso anterior, dias, ganho e GMD (serviço, série e Lançamento); Cadastro e Saída sem
//       peso não; recálculo ÚNICO dos dados já gravados na abertura (marcador em configurações, idempotente, auditoria
//       do sistema, falha não bloqueia e tenta de novo); Dias/Ganho/GMD em "Colunas" de Vendas, Saídas, Comercial e
//       Romaneio; "Saídas › Analítico" com GMD no padrão; o W3 padrão de Vendas não muda;
//   A2. Desempenho: base = pesagem anterior ao período → GMD do período = Σ ganho ÷ Σ dias do Pesagens (Cadastro 02/06,
//       Manejo 25/09, período padrão de 90 dias);
//   A3. Dias, Ganho e GMD (e as métricas de ganho/GMD) nunca somem da folha: "-" e "GMD de N de M cab."; as outras
//       vazias continuam saindo;
//   A4. Rebanho atual: Peso/Data de entrada, Ganho/Dias/GMD desde a entrada, Último GMD; Analítico com Último GMD e GMD
//       desde a entrada no padrão; resumos com "GMD médio" ponderado; leitura pelo índice (nunca a base inteira);
//   A6. Qualidade dos dados: "Animal com uma pesagem só", "Manejo sem GMD" (com o motivo) e "Números parecidos (zeros à
//       esquerda)" — só leitura.
// Cada regra tem caso NEGATIVO: a regra antiga (ou o dado de antes) reprovaria.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { clearWriteBlock, setWriteBlocked } from '../src/storage/migrations/migrationState.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import {
  SAIDA_DERIVED_MARKER_KEY, SAIDA_DERIVED_ORIGIN, SAIDA_DERIVED_STATUS, readSaidaDerivedMarker, runSaidaDerivedBackfill, seriesWithWeighedExit,
} from '../src/modules/weighing/application/weighingDerivedBackfill.js';
import { receivesWeightGain, recalculateWeightSeries } from '../src/modules/weighing/domain/weighingSeries.js';
import { calculateWeightGain } from '../src/modules/weighing/domain/weighingCalculations.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { typedViewSelection } from '../src/modules/reporting/application/reportInitialState.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { getReportView, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { MAK_MISSING, buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { VENDAS_AVAILABLE_COLUMNS, VENDAS_COLUMNS } from '../src/modules/reporting/definitions/pesagens.js';
import { ABATES_AVAILABLE_COLUMNS, ABATES_COLUMNS } from '../src/modules/reporting/definitions/comercial.js';
import { toAnimalPeriodRows, buildAnimalLookups, currentGainOf } from '../src/modules/reporting/infrastructure/reportSources/animalRows.js';
import { gmdDataIssues, similarNumberKey } from '../src/modules/reporting/infrastructure/reportSources/controlSources.js';

const ADMIN = Object.freeze({ id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' });
const TODAY = '2026-09-30';
const TS = '2026-01-01T00:00:00.000Z';
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `${message}: ${actual} ≠ ${expected}`);
const regras = [];
const ok = (name) => regras.push(name);
const P = (from, to) => ({ periodo: { preset: 'personalizado', from, to } });
const run = (id, selection, params = undefined, today = TODAY) => runReport(id, { today, arrobaDivisor: 30, selection, ...(params ? { params } : {}) }, ADMIN);
const DERIVED = ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'];
const derivedOf = (entry) => Object.fromEntries(DERIVED.map((key) => [key, entry?.[key] ?? null]));

// ---------------------------------------------------------------------------------------------------------------
// Massa: cadastros mestres + animais
// ---------------------------------------------------------------------------------------------------------------
setActorProvider(null);
await deleteDbForTests();
const db = await storage.ensureReady();
const registry = (id, nome) => ({ id, empresa_id: 'local', nome, nome_normalizado: nome.toUpperCase(), ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
await db.table('marcas').bulkAdd([registry('m-abc', 'ABC'), registry('m-xyz', 'XYZ')]);
await db.table('racas').bulkAdd([registry('r-nelore', 'Nelore')]);
await db.table('apartacoes').bulkAdd([{ id: 'ap1', empresa_id: 'local', nome_apartacao: 'APARTE', ativo: true, created_at: TS, updated_at: TS, deleted_at: null }]);
await db.table('loteApartacoes').bulkAdd([
  { id: 'L1', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'APARTE', nome_lote: 'BOIADA', quantidade_maxima: 50, peso_minimo: 200, peso_maximo: 500, created_at: TS, updated_at: TS, deleted_at: null },
  { id: 'L2', empresa_id: 'local', apartacao_id: 'ap1', nome_apartacao: 'APARTE', nome_lote: 'VENDA', quantidade_maxima: 50, peso_minimo: 200, peso_maximo: 600, created_at: TS, updated_at: TS, deleted_at: null },
]);
const lote = (id) => (id === 'L1'
  ? { lote_id: 'L1', nome_lote: 'BOIADA', apartacao_id: 'ap1', nome_apartacao: 'APARTE' }
  : { lote_id: 'L2', nome_lote: 'VENDA', apartacao_id: 'ap1', nome_apartacao: 'APARTE' });
const animal = (id, numero, extra = {}) => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, marca: 'ABC', marca_id: 'm-abc', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore', ...lote('L1'), ...extra,
});

// S1 (A2, o caso da responsável: aparte a cada ~4 meses): Cadastro 02/06 e Manejo 25/09 (115 dias).
const S1 = [['B1', '101', 250, 330], ['B2', '102', 260, 344], ['B3', '103', 270, 330]];
for (const [id, numero, entrada, manejo] of S1) {
  await weighingService.createEntry({ ...animal(id, numero), id: `${id}-c`, tipo_manejo: 'Cadastro', data_pesagem: '2026-06-02', peso: entrada });
  await weighingService.createEntry({ ...animal(id, numero), id: `${id}-m`, tipo_manejo: 'Manejo', data_pesagem: '2026-09-25', peso: manejo });
}
// A1: V1 Cadastro 01/06 300 → Manejo 01/08 360 → Saída Venda 31/08 390 (+30 em 30 d); V2 Cadastro 01/06 310 → Abate
// 20/09 400 (+90 em 111 d); M1 Cadastro 01/06 280 → Saída Morte SEM peso 10/09.
await weighingService.createEntry({ ...animal('V1', '201', lote('L2')), id: 'V1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-01', peso: 300 });
await weighingService.createEntry({ ...animal('V1', '201', lote('L2')), id: 'V1-m', tipo_manejo: 'Manejo', data_pesagem: '2026-08-01', peso: 360 });
const vendaCriada = await weighingService.createEntry({ ...animal('V1', '201', lote('L2')), id: 'V1-s', tipo_manejo: 'Saída', motivo_saida: 'Venda', comprador: 'Frigo Sul', data_pesagem: '2026-08-31', peso: 390, valor_arroba: 300 });
await weighingService.createEntry({ ...animal('V2', '202', lote('L2')), id: 'V2-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-01', peso: 310 });
const abateCriado = await weighingService.createEntry({ ...animal('V2', '202', lote('L2')), id: 'V2-s', tipo_manejo: 'Saída', motivo_saida: 'Abate', frigorifico: 'Frigo Sul', data_pesagem: '2026-09-20', peso: 400, rendimento_carcaca: 52, rendimento_origem: 'INFORMADO', peso_carcaca_estimado: 208, quantidade_arrobas: 208 / 15, embarque_id: null });
await weighingService.createEntry({ ...animal('M1', '203', lote('L2')), id: 'M1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-01', peso: 280 });
const morteCriada = await weighingService.createEntry({ ...animal('M1', '203', lote('L2')), id: 'M1-s', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'Raio', data_pesagem: '2026-09-10', peso: null });
// W1 (A2/A4): Cadastro 26/08 250 → Manejo 25/09 280 (+30 em 30 d) — dias diferentes dos do S1 (ponderado ≠ simples).
await weighingService.createEntry({ ...animal('W1', '104'), id: 'W1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-26', peso: 250 });
await weighingService.createEntry({ ...animal('W1', '104'), id: 'W1-m', tipo_manejo: 'Manejo', data_pesagem: '2026-09-25', peso: 280 });
// A3/A4/A6: U1 só o Cadastro (uma pesagem só); Z7 "07" e Z8 "7" (mesma marca — números parecidos); Z9 "7" da marca XYZ.
await weighingService.createEntry({ ...animal('U1', '301', { raca: '', raca_id: null }), id: 'U1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-28', peso: 240 });
await weighingService.createEntry({ ...animal('Z7', '07'), id: 'Z7-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-02', peso: 250 });
await weighingService.createEntry({ ...animal('Z7', '07'), id: 'Z7-m', tipo_manejo: 'Manejo', data_pesagem: '2026-06-02', peso: 252 });
await weighingService.createEntry({ ...animal('Z8', '7'), id: 'Z8-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-02', peso: 255 });
await weighingService.createEntry({ ...animal('Z8', '7'), id: 'Z8-m', tipo_manejo: 'Manejo', data_pesagem: '2026-09-25', peso: 300 });
await weighingService.createEntry({ ...animal('Z9', '7', { marca: 'XYZ', marca_id: 'm-xyz' }), id: 'Z9-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-06-02', peso: 260 });
await weighingService.createEntry({ ...animal('Z9', '7', { marca: 'XYZ', marca_id: 'm-xyz' }), id: 'Z9-m', tipo_manejo: 'Manejo', data_pesagem: '2026-09-25', peso: 290 });

// ---------------------------------------------------------------------------------------------------------------
// A1 — Saída com peso ganha os derivados (serviço)
// ---------------------------------------------------------------------------------------------------------------
assert.deepEqual(derivedOf(vendaCriada), { data_anterior: '2026-08-01', peso_anterior: 360, dias: 30, ganho: 30, gmd: 1 }, 'A1: venda com peso — anterior 01/08 360 kg, 30 dias, +30 kg, GMD 1,000');
assert.deepEqual(derivedOf(abateCriado), { data_anterior: '2026-06-01', peso_anterior: 310, dias: 111, ganho: 90, gmd: Number((90 / 111).toFixed(3)) }, 'A1: abate com peso contra o Cadastro');
assert.deepEqual(derivedOf(morteCriada), { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null }, 'A1: saída SEM peso continua sem derivados (nada para comparar)');
const cadastro = await weighingService.getEntryById('V1-c');
assert.deepEqual(derivedOf(cadastro), { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null }, 'A1: Cadastro continua sem (é a entrada)');
assert.deepEqual(['Cadastro', 'Manejo', 'Saída'].map(receivesWeightGain), [false, true, true], 'A1: tipos que recebem ganho');
// Série (recalculateWeightSeries): a mesma regra na edição, exclusão, importação e no recálculo.
const serie = [
  { id: 's1', animal_id: 'X', tipo_manejo: 'Cadastro', data_pesagem: '2026-01-01', peso: 200 },
  { id: 's2', animal_id: 'X', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-02-01', peso: 262 },
];
const patchSaida = recalculateWeightSeries(serie).find((update) => update.id === 's2').patch;
assert.deepEqual(patchSaida, { data_anterior: '2026-01-01', peso_anterior: 200, dias: 31, ganho: 62, gmd: 2 }, 'A1: série recalcula a Saída com peso');
// NEGATIVO: a regra antiga (só Manejo) deixava a venda sem GMD.
const regraAntiga = (entries) => entries.map((entry, index) => (entry.tipo_manejo === 'Manejo'
  ? calculateWeightGain({ history: entries.slice(0, index), date: entry.data_pesagem, weight: entry.peso })
  : { gmd: null }));
assert.equal(regraAntiga(serie)[1].gmd, null, 'NEGATIVO: com a regra antiga (só Manejo) a venda ficava sem GMD');
assert.notEqual(patchSaida.gmd, regraAntiga(serie)[1].gmd, 'NEGATIVO: a regra nova difere da antiga na Saída');
// Edição retroativa: mudar o Manejo recalcula a venda.
await weighingService.updateEntry('V1-m', { peso: 370 });
assert.deepEqual(derivedOf(await weighingService.getEntryById('V1-s')), { data_anterior: '2026-08-01', peso_anterior: 370, dias: 30, ganho: 20, gmd: Number((20 / 30).toFixed(3)) }, 'A1: editar o Manejo recalcula a venda');
await weighingService.updateEntry('V1-m', { peso: 360 });
// Lançamento (prévia → payload): Manejo e Saída mandam os derivados; Cadastro não. A conta é a do serviço.
const lancamento = fs.readFileSync(new URL('../src/pages/LancamentoPesagensIndividuais.jsx', import.meta.url), 'utf8');
for (const field of ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd']) {
  assert.match(lancamento, new RegExp(`${field}: receivesWeightGain\\(tipoManejo\\)`), `A1: Lançamento manda ${field} para Manejo e Saída`);
}
assert.ok(!/gmd: tipoManejo === 'Manejo' \? gmd : null/.test(lancamento), 'NEGATIVO: o Lançamento não zera mais o GMD da Saída');
ok('A1-saida-com-peso');

// ---------------------------------------------------------------------------------------------------------------
// A1 — recálculo único dos dados gravados (1.4.1 → 1.4.2)
// ---------------------------------------------------------------------------------------------------------------
// Simula a base da 1.4.1: Saída gravada SEM derivados (topo e legacy_payload), como o serviço antigo gravava.
const saidasGravadas = (await db.table('pesagens').toArray()).filter((row) => row.tipo_pesagem === 'Saída');
for (const row of saidasGravadas) {
  await db.table('pesagens').update(row.localId, { ...Object.fromEntries(DERIVED.map((key) => [key, null])), legacy_payload: { ...row.legacy_payload, ...Object.fromEntries(DERIVED.map((key) => [key, null])) } });
}
const antes = await seriesWithWeighedExit(db);
assert.deepEqual([antes.saidas, antes.semGmd, antes.keys.size], [2, 2, 2], 'antes: 2 saídas com peso (venda e abate), as 2 sem GMD; a morte sem peso não entra');
assert.equal((await weighingService.getEntryById('V1-s')).gmd ?? null, null, 'NEGATIVO antes do recálculo: venda sem GMD (dado da 1.4.1)');
const vendasAntes = await run('pesagens', typedViewSelection(getReportDefinition('pesagens'), 'vendas', { vendas: [...VENDAS_COLUMNS, 'gmd'] }), P('2026-08-01', '2026-09-30'));
assert.ok(vendasAntes.rows.every((row) => row.gmd == null), 'NEGATIVO antes do recálculo: Vendas sem GMD');
assert.equal(await readSaidaDerivedMarker(), null, 'antes: sem marcador');

// Escrita bloqueada pela migração: adia (não grava marcador nem mexe nos dados).
setWriteBlocked({ code: 'MIGRATION_FAILED', message: 'teste' });
const bloqueado = await runSaidaDerivedBackfill({ log: null });
assert.deepEqual([bloqueado.ran, bloqueado.completed, bloqueado.skipped], [false, false, 'WRITE_BLOCKED'], 'escrita bloqueada: adia para a próxima abertura');
assert.equal(await readSaidaDerivedMarker(), null, 'escrita bloqueada: sem marcador');
clearWriteBlock();

// Falha no meio (auditoria não grava): não lança, não bloqueia, marcador FALHOU e a próxima abertura tenta de novo.
const cryptoRef = globalThis.crypto;
const originalUuid = cryptoRef.randomUUID;
cryptoRef.randomUUID = () => { throw new Error('falha simulada'); };
let falha;
try {
  falha = await runSaidaDerivedBackfill({ log: null });
} finally {
  cryptoRef.randomUUID = originalUuid;
}
assert.deepEqual([falha.ran, falha.completed, falha.error?.message], [true, false, 'falha simulada'], 'falha: devolve o erro sem lançar (o app abre)');
const marcadorFalha = await readSaidaDerivedMarker();
assert.deepEqual([marcadorFalha.status, marcadorFalha.tentativas], [SAIDA_DERIVED_STATUS.FALHOU, 1], 'falha: marcador FALHOU com a tentativa');
assert.equal(storage.isWriteBlocked(), false, 'falha: a escrita continua liberada (não bloqueia o uso)');

// Próxima abertura: roda de novo e conclui.
const auditoriaAntes = await db.table('auditoria').count();
const primeira = await runSaidaDerivedBackfill({ log: null });
assert.deepEqual([primeira.ran, primeira.completed], [true, true], 'recálculo concluído');
const marcador = await readSaidaDerivedMarker();
// A tentativa que falhou (na auditoria) já tinha regravado os derivados: esta encontra 0 sem GMD — só confere e grava.
assert.deepEqual([marcador.status, marcador.saidas_com_peso, marcador.saidas_sem_gmd_antes, marcador.animais, marcador.tentativas, marcador.origem], [SAIDA_DERIVED_STATUS.CONCLUIDO, 2, 0, 2, 2, SAIDA_DERIVED_ORIGIN], 'marcador em configurações');
assert.equal((await db.table('appSettings').get(SAIDA_DERIVED_MARKER_KEY)).value.status, 'CONCLUIDO', `marcador na chave ${SAIDA_DERIVED_MARKER_KEY}`);
assert.deepEqual(derivedOf(await weighingService.getEntryById('V1-s')), { data_anterior: '2026-08-01', peso_anterior: 360, dias: 30, ganho: 30, gmd: 1 }, 'depois: venda com GMD');
assert.deepEqual(derivedOf(await weighingService.getEntryById('V2-s')), derivedOf(abateCriado), 'depois: abate igual ao que o lançamento grava');
assert.deepEqual(derivedOf(await weighingService.getEntryById('M1-s')), derivedOf(morteCriada), 'depois: morte sem peso continua sem');
const auditorias = (await db.table('auditoria').toArray()).filter((row) => row.origem === SAIDA_DERIVED_ORIGIN);
assert.equal(await db.table('auditoria').count(), auditoriaAntes + 1, 'uma linha de auditoria');
assert.deepEqual([auditorias.length, auditorias[0].usuario_id, auditorias[0].entidade, auditorias[0].acao], [1, null, 'pesagens', 'ATUALIZAR'], 'auditoria como ação do sistema (sem usuário)');
assert.deepEqual(auditorias[0].campos_alterados, DERIVED, 'auditoria: só os campos derivados');
const trilha = await run('controle.auditoria', {}, P('2026-01-01', TODAY));
assert.ok(trilha.rows.some((row) => row.origem === SAIDA_DERIVED_ORIGIN && row.usuario_nome === 'Sistema'), 'Trilha de auditoria: "Sistema"');

// Idempotente: com o marcador não roda de novo; sem o marcador, rodar de novo não muda nada.
const snapshot = async () => (await db.table('pesagens').toArray()).map((row) => [row.id, derivedOf(row), derivedOf(row.legacy_payload)]).sort((a, b) => a[0].localeCompare(b[0]));
const depois1 = await snapshot();
const segunda = await runSaidaDerivedBackfill({ log: null });
assert.deepEqual([segunda.ran, segunda.alreadyDone], [false, true], 'com marcador: não roda de novo');
assert.equal((await db.table('auditoria').toArray()).filter((row) => row.origem === SAIDA_DERIVED_ORIGIN).length, 1, 'com marcador: nenhuma auditoria nova');
await db.table('appSettings').delete(SAIDA_DERIVED_MARKER_KEY);
const terceira = await runSaidaDerivedBackfill({ log: null });
assert.equal(terceira.completed, true);
assert.deepEqual(await snapshot(), depois1, 'rodar 2x não muda nenhum derivado (idempotente)');
// Banco novo (nada a recalcular): marca concluído sem auditoria.
const dbSrc = fs.readFileSync(new URL('../src/api/db.js', import.meta.url), 'utf8');
assert.match(dbSrc, /import \{ runSaidaDerivedBackfill \} from '\.\.\/modules\/weighing\/application\/weighingDerivedBackfill\.js'/, 'abertura: bootstrapLocalDb importa o passo de dados');
assert.match(dbSrc, /if \(result\.blocked\) \{[\s\S]*?\} else \{[\s\S]*?await runSaidaDerivedBackfill\(\)/, 'abertura: roda depois da migração, só sem bloqueio');
assert.ok(!/runPendingBackfills[\s\S]{0,200}runSaidaDerivedBackfill/.test(dbSrc), 'NEGATIVO: não é passo da cadeia de migração (falha não bloqueia a escrita)');
// Restaurar um backup de antes da 1.4.2 (sem o marcador) e "Continuar migração" também rodam o passo (Manutenção).
const manutencaoSrc = fs.readFileSync(new URL('../src/modules/maintenance/infrastructure/maintenanceDataAdapter.js', import.meta.url), 'utf8');
assert.match(manutencaoSrc, /await storage\.applyRestore\([^;]*;[\s\S]{0,300}await runSaidaDerivedBackfill\(\)/, 'restauração: recalcula já, sem esperar a próxima abertura');
assert.match(manutencaoSrc, /runPendingBackfills\([^;]*;[\s\S]{0,200}if \(result\?\.completed\) await runSaidaDerivedBackfill\(\)/, 'Continuar migração: roda o passo adiado');
ok('A1-recalculo-unico');

// ---------------------------------------------------------------------------------------------------------------
// A1 — colunas nos relatórios de saída
// ---------------------------------------------------------------------------------------------------------------
const PESAGENS = getReportDefinition('pesagens');
for (const key of ['dias', 'ganho', 'gmd']) {
  assert.ok(VENDAS_AVAILABLE_COLUMNS.includes(key) && !VENDAS_COLUMNS.includes(key), `Vendas: ${key} em "Colunas", fora do padrão (o W3 não muda)`);
  assert.ok(ABATES_AVAILABLE_COLUMNS.includes(key) && !ABATES_COLUMNS.includes(key), `Comercial › Abates: ${key} em "Colunas"`);
}
const COMERCIAL = getReportDefinition('comercial');
assert.ok(['dias', 'ganho', 'gmd'].every((key) => getReportView(COMERCIAL, 'vendas').columnChoices.available.includes(key)), 'Comercial › Vendas: Dias, Ganho e GMD em "Colunas"');
const vendasPadrao = await run('pesagens', viewSelection('vendas', PESAGENS), P('2026-08-01', '2026-09-30'));
assert.deepEqual(vendasPadrao.columns.map((column) => column.id), [...VENDAS_COLUMNS], 'Vendas: padrão do W3 inalterado');
const docVendasPadrao = buildReportDocument(vendasPadrao);
assert.deepEqual([docVendasPadrao.layout, docVendasPadrao.footer.gmd], ['vendas', null], 'Vendas W3 padrão: sem GMD, sem nota');
const vendasGmd = await run('pesagens', typedViewSelection(PESAGENS, 'vendas', { vendas: [...VENDAS_COLUMNS, 'dias', 'ganho', 'gmd'] }), P('2026-08-01', '2026-09-30'));
assert.deepEqual(vendasGmd.rows.map((row) => [row.id, row.dias, row.ganho, row.gmd]), [['V1-s', 30, 30, 1]], 'Vendas com Dias/Ganho/GMD escolhidos: a venda tem o GMD');
const docVendasGmd = buildReportDocument(vendasGmd, { showDetails: true });
assert.deepEqual(docVendasGmd.vendas.grupos.items[0].rows[0].cells.filter((cell) => ['dias', 'ganho', 'gmd'].includes(cell.key)).map((cell) => cell.text), ['30', '30', '1,000'], 'Vendas "Mostrar Detalhes": Dias, Ganho e GMD na folha');
const SAIDAS = getReportDefinition('saidas');
const saidasAnalitico = await run('saidas', viewSelection('analitico', SAIDAS), P('2026-08-01', '2026-09-30'));
assert.ok(saidasAnalitico.columns.some((column) => column.id === 'gmd'), 'Saídas › Analítico: GMD no padrão');
assert.deepEqual(Object.fromEntries(saidasAnalitico.rows.map((row) => [row.id, row.gmd ?? null])), { 'V1-s': 1, 'V2-s': Number((90 / 111).toFixed(3)), 'M1-s': null }, 'Saídas › Analítico: GMD da venda e do abate; a morte sem peso "-"');
const docSaidas = buildReportDocument(saidasAnalitico);
const morteRow = documentRows(docSaidas).find((row) => row.type === 'DATA' && row.cells.some((cell) => cell.text.includes('203')));
assert.equal(morteRow.cells.find((cell) => cell.key === 'gmd').text, MAK_MISSING, 'Saídas: morte sem peso = "-"');
assert.equal(docSaidas.footer.gmd, 'GMD de 2 de 3 cab.', 'Saídas: "GMD de 2 de 3 cab."');
for (const [id, viewId] of [['saidas', 'por-motivo'], ['embarques.romaneio', 'analitico'], ['embarques.romaneio', 'romaneio-lista']]) {
  const definition = getReportDefinition(id);
  const view = getReportView(definition, viewId);
  if (view.mode === 'DETALHADO') assert.ok(['dias', 'ganho', 'gmd'].every((key) => view.columnChoices.available.includes(key)), `${id} › ${view.label}: Dias, Ganho e GMD em "Colunas"`);
}
assert.ok(!getReportView(SAIDAS, 'mortes').columns.includes('gmd'), 'controle: Mortes (Lista) não ganhou GMD no padrão');
ok('A1-colunas-saida');

// ---------------------------------------------------------------------------------------------------------------
// A2 — Desempenho com a pesagem anterior ao período (o GMD do Pesagens)
// ---------------------------------------------------------------------------------------------------------------
const DESEMPENHO = getReportDefinition('desempenho');
const desLote = await run('desempenho', viewSelection('por-lote', DESEMPENHO));
assert.deepEqual([desLote.period.from, desLote.period.to], ['2026-07-03', '2026-09-30'], 'período padrão: últimos 90 dias');
const desAnalitico = await run('desempenho', viewSelection('analitico', DESEMPENHO));
const porAnimal = Object.fromEntries(desAnalitico.rows.map((row) => [row.animal_id, row]));
for (const [id, , entrada, manejo] of S1) {
  const row = porAnimal[id];
  assert.deepEqual([row.data_inicial, row.peso_inicial, row.data_final, row.peso_final, row.dias, row.ganho, row.inicio_antes_do_periodo], ['2026-06-02', entrada, '2026-09-25', manejo, 115, manejo - entrada, true], `${id}: base = Cadastro 02/06 (antes do período)`);
  close(row.gmd, (manejo - entrada) / 115, `${id}: GMD do período`);
}
// O mesmo número do Pesagens (Σ ganho ÷ Σ dias gravados das pesagens do período).
const pesagensPeriodo = await run('pesagens', viewSelection('analitico', PESAGENS), P('2026-07-03', '2026-09-30'));
const s1Pesagens = pesagensPeriodo.rows.filter((row) => S1.some(([id]) => id === row.animal_id));
const somaGanho = s1Pesagens.reduce((sum, row) => sum + (row.ganho ?? 0), 0);
const somaDias = s1Pesagens.reduce((sum, row) => sum + (row.dias ?? 0), 0);
const desS1 = await run('desempenho', { ...viewSelection('por-lote', DESEMPENHO), filters: { animal: { operator: 'in', values: S1.map(([, numero]) => numero) } } });
close(desS1.totals.gmd_ponderado.value, somaGanho / somaDias, 'A2: GMD do Desempenho (90 dias) = Σ ganho ÷ Σ dias do Pesagens');
close(desS1.totals.gmd_ponderado.value, (80 + 84 + 60) / (115 * 3), 'A2: conferido à mão (224 ÷ 345)');
// Relatório inteiro: total ponderado do Desempenho = o do Pesagens no mesmo período.
close(desLote.totals.gmd_ponderado.value, pesagensPeriodo.totals.gmd_medio.value, 'A2: total do Desempenho = total do Pesagens no período');
// Sem pesagem anterior (a primeira do período é o Cadastro): o comportamento de antes.
assert.deepEqual([porAnimal.U1.peso_inicial, porAnimal.U1.gmd, porAnimal.U1.inicio_antes_do_periodo], [240, null, false], 'U1 (só o Cadastro no período): sem base anterior, sem GMD');
// NEGATIVO: a regra antiga (só pesagens DENTRO do período) deixava todos sem GMD — os mesmos eventos sem a anterior.
const eventos = pesagensPeriodo.rows.filter((row) => S1.some(([id]) => id === row.animal_id));
const lookups = buildAnimalLookups({});
const semAnterior = toAnimalPeriodRows(eventos.map((row) => ({ ...row, data_anterior: null, peso_anterior: null })), new Map(), lookups);
assert.ok(semAnterior.every((row) => row.gmd === null), 'NEGATIVO: sem a pesagem anterior (regra antiga), o Desempenho de 90 dias não tinha GMD');
assert.ok(toAnimalPeriodRows(eventos, new Map(), lookups).every((row) => row.gmd !== null), 'com a anterior gravada, todos têm GMD');
assert.ok(DESEMPENHO.notes.some((note) => note.includes('antes do período')) && DESEMPENHO.notes.some((note) => note.includes('mesmo GMD do relatório Pesagens')), 'notas do Desempenho atualizadas');
assert.ok(!DESEMPENHO.notes.some((note) => note.includes('primeira/última pesagem com peso dentro do período')), 'NEGATIVO: a nota antiga saiu');
ok('A2-desempenho-base-anterior');

// ---------------------------------------------------------------------------------------------------------------
// A3 — Dias, Ganho e GMD nunca somem da folha
// ---------------------------------------------------------------------------------------------------------------
// Pesagens › Analítico só com o U1 (Cadastro 28/09, sem raça): Dias, Ganho e GMD ficam ("-"); Raça some (E1C).
const soU1 = await run('pesagens', viewSelection('analitico', PESAGENS), P('2026-09-28', '2026-09-28'));
const docU1 = buildReportDocument(soU1);
assert.ok(['dias', 'ganho', 'gmd'].every((key) => docU1.columns.some((column) => column.key === key)), 'A3: Dias, Ganho e GMD na folha mesmo vazios');
assert.deepEqual(docU1.hiddenColumns.map((column) => column.key), ['raca'], 'A3: as outras vazias continuam saindo (Raça)');
const linhaU1 = documentRows(docU1).find((row) => row.type === 'DATA');
assert.deepEqual(['dias', 'ganho', 'gmd'].map((key) => linhaU1.cells.find((cell) => cell.key === key).text), [MAK_MISSING, MAK_MISSING, MAK_MISSING], 'A3: sem valor = "-" (nunca 0)');
assert.equal(docU1.footer.gmd, 'GMD de 0 de 1 cab.', 'A3: "GMD de 0 de 1 cab."');
assert.ok(renderSheetBody(docU1, { mode: 'print' }).includes('<span>GMD de 0 de 1 cab.</span>'), 'A3: a nota sai no rodapé da folha (tela, impressão e PDF)');
// Resumos: "GMD Médio" (Pesagens) e GMD/Ganho (Desempenho) ficam; a nota diz a cobertura.
const resumoU1 = buildReportDocument(await run('pesagens', viewSelection('por-apartacao-data', PESAGENS), P('2026-09-28', '2026-09-28')));
assert.ok(resumoU1.columns.some((column) => column.key === 'gmd_medio') && !resumoU1.hiddenColumns.some((column) => column.key === 'gmd_medio'), 'A3: GMD Médio do resumo fica');
assert.ok(resumoU1.hiddenColumns.some((column) => column.key === 'machos') === false, 'controle: Machos (1) aparece');
const desCadastros = buildReportDocument(await run('desempenho', viewSelection('por-lote', DESEMPENHO), P('2026-06-01', '2026-06-30')));
assert.ok(['ganho_total', 'ganho_medio', 'gmd_ponderado'].every((key) => desCadastros.columns.some((column) => column.key === key)), 'A3: Desempenho só com cadastros — Ganho total, Ganho médio e GMD ficam');
assert.match(desCadastros.footer.gmd ?? '', /^GMD de 0 de \d+ cab\.$/, 'A3: Desempenho sem par — "GMD de 0 de N cab."');
// Cobertura parcial e completa.
const s1Resumo = buildReportDocument(await run('pesagens', viewSelection('analitico', PESAGENS), P('2026-09-25', '2026-09-28')));
assert.equal(s1Resumo.footer.gmd, 'GMD de 6 de 7 cab.', 'A3: parcial — 6 manejos de 25/09 com GMD, o U1 sem');
const completo = buildReportDocument(await run('pesagens', viewSelection('analitico', PESAGENS), P('2026-09-25', '2026-09-25')));
assert.deepEqual([completo.footer.gmd, completo.gmdCoverage.validos, completo.gmdCoverage.total], [null, 6, 6], 'A3: todos com GMD = sem nota');
// NEGATIVO: pela regra da E1C (coluna vazia do padrão some) Dias, Ganho e GMD estariam em hiddenColumns, como a Raça.
assert.ok(docU1.hiddenColumns.every((column) => !['dias', 'ganho', 'gmd'].includes(column.key)), 'NEGATIVO: o GMD não está mais entre as ocultas (antes da E1G estava)');
ok('A3-gmd-nunca-some');

// ---------------------------------------------------------------------------------------------------------------
// A4 — Rebanho atual com entrada, ganho desde a entrada e último GMD
// ---------------------------------------------------------------------------------------------------------------
const REBANHO = getReportDefinition('rebanho.atual');
const rebAnalitico = await run('rebanho.atual', viewSelection('analitico', REBANHO));
const analiticoIds = rebAnalitico.columns.map((column) => column.id);
assert.ok(['ultimo_gmd', 'gmd_entrada'].every((id) => analiticoIds.includes(id)), 'A4: Analítico com Último GMD e GMD desde a entrada no padrão');
assert.ok(['peso_entrada', 'data_entrada', 'ganho_entrada', 'dias_entrada'].every((id) => getReportView(REBANHO, 'analitico').columnChoices.available.includes(id)), 'A4: Peso/Data de entrada, Ganho/Dias desde a entrada em "Colunas"');
const reb = Object.fromEntries(rebAnalitico.rows.map((row) => [row.animal_id, row]));
assert.deepEqual([reb.B1.peso_entrada, reb.B1.data_entrada, reb.B1.dias_entrada, reb.B1.ganho_entrada], [250, '2026-06-02', 115, 80], 'A4: B1 entrada 02/06 250 kg, 115 dias, +80 kg');
close(reb.B1.gmd_entrada, 80 / 115, 'A4: B1 GMD desde a entrada');
assert.equal(reb.B1.ultimo_gmd, Number((80 / 115).toFixed(3)), 'A4: B1 último GMD = o gravado no Manejo de 25/09');
assert.deepEqual([reb.U1.peso_entrada, reb.U1.ganho_entrada, reb.U1.gmd_entrada, reb.U1.ultimo_gmd], [240, null, null, null], 'A4: U1 pesado uma vez — sem ganho nem GMD ("-")');
assert.equal(reb.Z7.ultimo_gmd, null, 'A4: Z7 (manejo no mesmo dia do cadastro) sem último GMD');
assert.equal(rebAnalitico.rows.some((row) => row.animal_id === 'V1'), false, 'controle: vendido fora do Analítico (só ativos)');
const docReb = buildReportDocument(rebAnalitico);
assert.ok(['ultimo_gmd', 'gmd_entrada'].every((key) => docReb.columns.some((column) => column.key === key)), 'A4/A3: colunas de GMD na folha');
assert.match(docReb.footer.gmd ?? '', /^GMD de \d+ de \d+ cab\.$/, 'A4/A3: nota de cobertura do Último GMD');
// Resumo por lote: "GMD médio" ponderado = Σ último ganho ÷ Σ últimos dias.
const rebLote = await run('rebanho.atual', viewSelection('por-lote', REBANHO));
assert.ok(rebLote.aggregates.some((spec) => spec.id === 'gmd_medio' && spec.columnId === 'ultimo_gmd' && spec.op === 'weightedGmd'), 'A4: resumo com "GMD médio" ponderado no padrão');
assert.equal(rebLote.metricLabels.gmd_medio, 'GMD médio (kg/dia)', 'A4: rótulo "GMD médio (kg/dia)"');
const ativosLote1 = rebAnalitico.rows.filter((row) => row.lote_atual_id === 'L1');
const somaUltimoGanho = ativosLote1.reduce((sum, row) => sum + (row.ultimo_ganho ?? 0), 0);
const somaUltimosDias = ativosLote1.reduce((sum, row) => sum + (row.ultimo_dias ?? 0), 0);
const boiada = rebLote.tree.find((node) => node.label === 'BOIADA');
close(boiada.aggregates.gmd_medio.value, somaUltimoGanho / somaUltimosDias, 'A4: GMD médio da BOIADA = Σ último ganho ÷ Σ últimos dias');
const mediaSimples = ativosLote1.filter((row) => row.ultimo_gmd !== null).reduce((sum, row, _index, list) => sum + row.ultimo_gmd / list.length, 0);
assert.ok(Math.abs(mediaSimples - boiada.aggregates.gmd_medio.value) > 1e-6, 'NEGATIVO: não é a média simples dos GMD');
assert.ok(getReportView(REBANHO, 'por-lote').columnChoices.available.includes('gmd_entrada_medio'), 'A4: "GMD desde a entrada" no "Colunas Painel"');
// Eficiência: entrada e última pesagem pelo índice — nunca a base inteira nem uma consulta por animal. Um animal com
// 30 pesagens antigas (datas só dele) acrescenta à leitura só o Cadastro e a última pesagem (+ a linha da projeção).
assert.ok(rebAnalitico.stats.strategy.includes('index:pesagens'), `A4: leitura pelo índice (${rebAnalitico.stats.strategy})`);
const pesagensAntesH1 = await db.table('pesagens').count();
await weighingService.createEntry({ ...animal('H1', '401'), id: 'H1-c', tipo_manejo: 'Cadastro', data_pesagem: '2026-01-01', peso: 200 });
for (let dia = 1; dia <= 29; dia += 1) {
  await weighingService.createEntry({ ...animal('H1', '401'), id: `H1-m${dia}`, tipo_manejo: 'Manejo', data_pesagem: `2026-03-${String(dia).padStart(2, '0')}`, peso: 200 + dia });
}
await weighingService.createEntry({ ...animal('H1', '401'), id: 'H1-u', tipo_manejo: 'Manejo', data_pesagem: '2026-04-15', peso: 240 });
const comH1 = await run('rebanho.atual', viewSelection('analitico', REBANHO));
const totalPesagens = await db.table('pesagens').count();
assert.equal(totalPesagens - pesagensAntesH1, 31, 'H1: 31 pesagens a mais na base');
assert.equal(comH1.stats.rowsRead - rebAnalitico.stats.rowsRead, 3, 'A4: o H1 acrescenta 3 linhas lidas (projeção, Cadastro e última pesagem), não 31');
const h1 = comH1.rows.find((row) => row.animal_id === 'H1');
assert.deepEqual([h1.peso_entrada, h1.data_entrada, h1.dias_entrada, h1.ganho_entrada, h1.ultimo_gmd], [200, '2026-01-01', 104, 40, Number((11 / 17).toFixed(3))], 'A4: H1 entrada 01/01, última 15/04 (+11 em 17 d desde 29/03)');
const animaisCount = await db.table('animais').count();
const animalSourceSrc = fs.readFileSync(new URL('../src/modules/reporting/infrastructure/reportSources/animalSource.js', import.meta.url), 'utf8');
assert.ok(!/for \(const animal[^\n]*\) \{[^}]*await db\.table\('pesagens'\)/.test(animalSourceSrc), 'NEGATIVO: nenhuma consulta de pesagens por animal num laço');
// Função pura: sem pesagem posterior à entrada, nada de ganho; com a Saída como última pesagem, desde a entrada até ela.
assert.deepEqual(currentGainOf({ ultima_pesagem_data: '2026-06-02', ultimo_peso_kg: 250 }, { entrada: { data: '2026-06-02', peso: 250 }, ultima: null }).gmd_entrada, null, 'pesado uma vez: sem GMD desde a entrada');
close(currentGainOf({ ultima_pesagem_data: '2026-08-31', ultimo_peso_kg: 390 }, { entrada: { data: '2026-06-01', peso: 300 }, ultima: { gmd: 1, ganho: 30, dias: 30 } }).gmd_entrada, 90 / 91, 'vendido: desde a entrada até a venda');
ok('A4-rebanho-gmd');

// ---------------------------------------------------------------------------------------------------------------
// A6 — Qualidade dos dados (só leitura)
// ---------------------------------------------------------------------------------------------------------------
// Dois problemas a mais para apontar: Manejo com GMD apagado (série não recalculada) e Manejo legado sem animal_id.
const z9m = (await db.table('pesagens').where('id').equals('Z9-m').toArray())[0];
await db.table('pesagens').update(z9m.localId, { gmd: null, legacy_payload: { ...z9m.legacy_payload, gmd: null } });
await db.table('pesagens').add({
  id: 'LEG-m', data_pesagem: '2026-09-25', peso_kg: 280, animal_id: null, lote_id: 'L1', tipo_pesagem: 'Manejo', created_at: TS, updated_at: TS, deleted_at: null,
  legacy_payload: { id: 'LEG-m', empresa_id: 'local', tipo_manejo: 'Manejo', data_pesagem: '2026-09-25', numero_animal: '999', marca: 'ABC', peso: 280, nome_lote: 'BOIADA', lote_id: 'L1' },
});
const contagem = async () => Object.fromEntries(await Promise.all(['pesagens', 'animais', 'auditoria', 'appSettings'].map(async (name) => [name, await db.table(name).count()])));
const pesagensAntesA6 = JSON.stringify((await db.table('pesagens').toArray()).map((row) => [row.id, row.updated_at, row.legacy_payload?.gmd ?? null]));
const contagemAntes = await contagem();
const qualidade = await run('controle.qualidade-dados', {});
assert.deepEqual(await contagem(), contagemAntes, 'A6: só leitura (nada gravado)');
assert.equal(JSON.stringify((await db.table('pesagens').toArray()).map((row) => [row.id, row.updated_at, row.legacy_payload?.gmd ?? null])), pesagensAntesA6, 'A6: nenhuma pesagem alterada');
const porCategoria = (categoria) => qualidade.rows.filter((row) => row.categoria_problema === categoria);
const umaSo = porCategoria('Animal com uma pesagem só');
assert.deepEqual(umaSo.map((row) => row.registro).sort(), ['U1'], 'A6: "Animal com uma pesagem só" = U1 (ativo pesado uma vez)');
assert.match(umaSo[0].descricao, /animal 301 tem uma pesagem só \(28\/09\/2026\): sem pesagem anterior, fica sem GMD/, 'A6: descrição');
const semGmd = Object.fromEntries(porCategoria('Manejo sem GMD').map((row) => [row.registro, row.descricao]));
assert.deepEqual(Object.keys(semGmd).sort(), ['LEG-m', 'Z7-m', 'Z9-m'], 'A6: "Manejo sem GMD" = mesmo dia, GMD apagado e legado sem animal_id');
assert.match(semGmd['Z7-m'], /mesma data da pesagem anterior/, 'A6: motivo — mesma data do Cadastro');
assert.match(semGmd['Z9-m'], /há pesagem anterior, mas o GMD não foi gravado/, 'A6: motivo — série não recalculada');
assert.match(semGmd['LEG-m'], /sem animal_id/, 'A6: motivo — registro legado');
assert.ok(!semGmd['B1-m'] && !semGmd['Z8-m'], 'NEGATIVO: manejo com GMD não é apontado');
const parecidos = porCategoria('Números parecidos (zeros à esquerda)');
assert.deepEqual(parecidos.map((row) => row.registro).sort(), ['Z7', 'Z8'], 'A6: "07" e "7" da marca ABC são parecidos');
assert.ok(parecidos.every((row) => /pode ser o mesmo animal/.test(row.descricao)), 'A6: descrição');
assert.ok(!parecidos.some((row) => row.registro === 'Z9'), 'NEGATIVO: "7" da marca XYZ não entra (outra marca)');
assert.deepEqual(['07', '7', '7,0', '007.00', 'A07', '1016,0'].map(similarNumberKey), ['7', '7', '7', '7', null, '1016'], 'A6: forma numérica do brinco');
// Função pura: números iguais escritos igual não são "parecidos" (isso é duplicidade, outro apontamento).
const iguais = gmdDataIssues({ animais: [{ id: 'a', numero_animal: '7', marca_id: 'm' }, { id: 'b', numero_animal: '7', marca_id: 'm' }], pesagens: [] });
assert.equal(iguais.filter((row) => row.categoria_problema.startsWith('Números parecidos')).length, 0, 'NEGATIVO: mesmo texto não é "parecido"');
assert.ok(['BAIXA', 'MEDIA'].includes(umaSo[0].gravidade) && porCategoria('Manejo sem GMD').every((row) => row.gravidade === 'MEDIA'), 'A6: gravidade');
ok('A6-qualidade-dos-dados');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'reports:gmd:verify', ok: true, regras,
  recalculo: { marcador: SAIDA_DERIVED_MARKER_KEY, saidasComPeso: marcador.saidas_com_peso, animais: marcador.animais },
  desempenhoIgualPesagens: Number(desS1.totals.gmd_ponderado.value.toFixed(6)),
  rebanho: { leitura: comH1.stats.strategy, pesagensLidas: comH1.stats.rowsRead - animaisCount, pesagensNaBase: totalPesagens },
}, null, 2));
