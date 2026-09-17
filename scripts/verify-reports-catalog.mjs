// Gate reports:catalog:verify (R5) — catálogo completo das famílias suportadas pelos dados atuais,
// bloqueados com motivo (nada simulado), catálogo por perfil, e resultados conferidos à mão em cada
// família na massa de referência.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { DATA_CLASSIFICATION, REPORT_FAMILIES } from '../src/modules/reporting/domain/reportDefinition.js';
import { listReports, runReport } from '../src/modules/reporting/application/reportService.js';

const definitions = listReportDefinitions();
const available = definitions.filter((d) => d.status !== 'blocked');
const blocked = definitions.filter((d) => d.status === 'blocked');
const ids = new Set(definitions.map((d) => d.id));

// Todas as famílias têm relatório disponível
for (const family of Object.keys(REPORT_FAMILIES)) assert.ok(available.some((d) => d.family === family), `família ${family} com relatório disponível`);

// Itens "PRONTO" da auditoria (doc 10) implementados
for (const id of [
  'rebanho.inventario', 'rebanho.dimensao.marca', 'rebanho.dimensao.raca', 'rebanho.dimensao.categoria', 'rebanho.dimensao.sexo', 'rebanho.dimensao.situacao', 'rebanho.dimensao.faixa_peso', 'rebanho.sem-pesagem-recente', 'rebanho.ocupacao-lotes',
  'pesagens.periodo', 'pesagens.sessao', 'pesagens.lote', 'pesagens.operador', 'pesagens.pendencias', 'pesagens.origem',
  'desempenho.individual', 'desempenho.lote', 'desempenho.dimensao.marca', 'desempenho.perdendo-peso', 'desempenho.faixa-peso',
  'movimentacao.entradas-saidas', 'movimentacao.mudancas-lote', 'saidas.motivo', 'saidas.mortes', 'saidas.mortes.causa', 'saidas.mortes.categoria', 'saidas.mortes.lote',
  'comercial.vendas', 'comercial.abates', 'comercial.compras', 'embarques.romaneio', 'embarques.previsto-realizado',
  'controle.fechamento-dia', 'controle.auditoria', 'controle.qualidade-dados', 'controle.backups',
  'cadastros.marcas', 'cadastros.racas', 'cadastros.categoriasAnimal', 'cadastros.parceiros', 'cadastros.propriedades', 'cadastros.causasMorte', 'cadastros.usuarios',
]) assert.ok(ids.has(id) && definitions.find((d) => d.id === id).status !== 'blocked', `implementado: ${id}`);

// Bloqueados (auditoria: nova modelagem / não fazer agora) — com motivo, sem fonte, nunca executam
for (const id of ['rebanho.historico-data', 'movimentacao.balanco', 'saidas.taxa-mortalidade', 'comercial.por-parceiro', 'comercial.operacao', 'comercial.resultado', 'desempenho.projecao', 'embarques.por-parceiro', 'cadastros.faixas-identificadores']) {
  const definition = definitions.find((d) => d.id === id);
  assert.ok(definition?.status === 'blocked' && definition.blockedReason, `bloqueado com motivo: ${id}`);
}
await assert.rejects(() => runReport('saidas.taxa-mortalidade', { today: TODAY }, ADMIN), (error) => error.code === 'REPORT_BLOCKED', 'NEGATIVO: taxa de mortalidade não executa');
assert.ok(!definitions.some((d) => d.status !== 'blocked' && d.columns.some((c) => /taxa|mortalidade_pct/.test(c.id))), 'nenhuma coluna de taxa de mortalidade');

// Comercial: classificação legada + commercial.values
for (const definition of available.filter((d) => d.family === 'comercial')) {
  assert.equal(definition.classification, DATA_CLASSIFICATION.LEGACY_EVENT, `${definition.id}: DADOS LEGADOS/POR EVENTO`);
  assert.ok(definition.requires.includes('commercial.values'), `${definition.id}: exige commercial.values`);
}

// Catálogo por perfil
const visible = (actor) => new Set(listReports(actor).filter((r) => r.available).map((r) => r.id));
const admin = visible(ADMIN); const gestor = visible(GESTOR); const operador = visible(OPERADOR); const consulta = visible(CONSULTA);
assert.equal(admin.size, available.length, 'ADMIN vê todos');
for (const id of ['comercial.vendas', 'controle.auditoria']) { assert.ok(gestor.has(id)); assert.ok(!operador.has(id)); assert.ok(!consulta.has(id)); }
assert.ok(!gestor.has('cadastros.usuarios') && admin.has('cadastros.usuarios'), 'usuários só ADMIN');
assert.ok(operador.has('pesagens.periodo') && operador.has('rebanho.inventario') && operador.has('desempenho.lote'), 'OPERADOR: operacionais');
assert.ok(!operador.has('controle.fechamento-dia') && gestor.has('controle.fechamento-dia'), 'fechamento segue session.close');
assert.ok(!operador.has('controle.backups') && !consulta.has('controle.backups') && gestor.has('controle.backups'), 'backups: maintenance.backup');
assert.ok(listReports(OPERADOR).some((r) => r.status === 'blocked'), 'bloqueados aparecem como indisponíveis');

// ---- Resultados conferidos à mão ----
await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const run = (id, request = {}) => runReport(id, { today: TODAY, params: P, ...request }, ADMIN);
const labels = (vm, agg) => Object.fromEntries(vm.tree.map((n) => [n.label, n.aggregates[agg].value]));

const motivo = await run('saidas.motivo');
assert.deepEqual(labels(motivo, 'saidas'), { Morte: 1, Venda: 1 });
assert.equal(motivo.grain, 'EXIT');
const causa = await run('saidas.mortes.causa');
assert.deepEqual(labels(causa, 'mortes'), { Raio: 1 });
assert.ok(causa.notes.some((n) => /Taxa de mortalidade não é calculada/.test(n)));

const vendas = await run('comercial.vendas');
assert.equal(vendas.rowCount, 1);
assert.equal(vendas.totals.valor.value, 3000);
assert.ok(Math.abs(vendas.totals.arrobas.value - 140 / 15) < 1e-9);
assert.equal(vendas.totals.preco_arroba.value, 300, 'preço/@ ponderado pelas arrobas');
const compras = await run('comercial.compras');
assert.equal(compras.rowCount, 0, 'nenhum cadastro com valor de compra na massa');
assert.equal(compras.totals.valor.value, null, 'sem compras → valor ausente, não 0');

const romaneio = await run('embarques.romaneio');
assert.equal(romaneio.rowCount, 1);
assert.deepEqual(romaneio.tree.map((n) => n.label), ['Embarque Sul']);
const previsto = await runReport('embarques.previsto-realizado', { today: TODAY, params: P }, ADMIN);
const d1 = previsto.rows.find((r) => r.id === 'D1');
assert.deepEqual({ prev: d1.prev_total, real: d1.real_total, femeas: d1.real_femeas, diff: d1.diferenca_total, peso: d1.peso_total_real }, { prev: 2, real: 1, femeas: 1, diff: -1, peso: 280 });

const pendencias = await run('pesagens.pendencias');
assert.deepEqual(pendencias.rows.map((r) => r.id), ['e9'], 'A4 sem lote é a única pendência (morte e venda não exigem documento por padrão)');
assert.deepEqual(labels(pendencias, 'registros'), { Lote: 1 });

const entradasSaidas = await run('movimentacao.entradas-saidas');
assert.deepEqual(labels(entradasSaidas, 'registros'), { Cadastro: 4, 'Saída': 2 });

const ocupacao = await runReport('rebanho.ocupacao-lotes', { today: TODAY }, ADMIN);
const l1 = ocupacao.rows.find((r) => r.lote_id === 'L1'); const l2 = ocupacao.rows.find((r) => r.lote_id === 'L2');
assert.deepEqual([l1.animais, l1.ocupacao, l2.animais, l2.ocupacao], [1, 10, 0, 0], 'A1 ativo em L1; A2 vendido e A3 morto não ocupam');
assert.equal(ocupacao.totals.ocupacao.value, 5, 'ocupação total = 1 animal ÷ 20 vagas');

const semPesagem = await runReport('rebanho.sem-pesagem-recente', { today: TODAY, params: { dias_sem_pesagem: 4 } }, ADMIN);
assert.deepEqual(semPesagem.rows.map((r) => r.animal_id), ['A1'], 'A1 (10/09) > 4 dias; A4 (12/09) = 3 dias');
assert.equal(semPesagem.rows[0].dias_sem_pesagem, 5);

const fechamento = await runReport('controle.fechamento-dia', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-09-12', to: '2026-09-12' } } }, ADMIN);
assert.equal(fechamento.rowCount, 1);
assert.equal(fechamento.rows[0].pendencias, 'Lote');

const auditoria = await runReport('controle.auditoria', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2000-01-01', to: '2099-12-31' } } }, ADMIN);
assert.ok(auditoria.rowCount >= 9, 'CRIAR das 9 pesagens');
assert.ok(auditoria.rows.every((r) => !('antes' in r) && !('depois' in r)), 'sem antes/depois');

const qualidade = await runReport('controle.qualidade-dados', { today: TODAY }, ADMIN);
assert.ok(qualidade.rows.some((r) => r.registro === 'e9' && /marca "Álfa"/.test(r.descricao)), 'marca só em texto detectada');

const usuarios = await runReport('cadastros.usuarios', { today: TODAY }, ADMIN);
assert.ok(usuarios.columns.every((c) => !/password|salt|recovery|hash/i.test(c.id)));
const marcas = await runReport('cadastros.marcas', { today: TODAY }, ADMIN);
assert.ok(marcas.rows.some((r) => r.nome === 'ALFA'));

// Fechamento do Dia (tela) usa as mesmas regras de pendência
const page = readFileSync(new URL('../src/pages/FechamentoDia.jsx', import.meta.url), 'utf8');
assert.match(page, /pendenciesOf\(row, salesPolicy\)/, 'tela usa closingPendencies');
assert.doesNotMatch(page, /Number\(row\.peso\) \|\| 0\), 0\)/, 'NEGATIVO: sem soma com ausente = 0');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:catalog:verify', ok: true, available: available.length, blocked: blocked.length }, null, 2));
