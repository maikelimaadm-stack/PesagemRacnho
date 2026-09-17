// Gate auth:weighing-access:verify (R0 do programa reporting, G-P0-04 / G-P1-10).
// 1) SERVIÇO: CONSULTA não lança, não edita, não exclui, não importa e não edita em lote
//    (weighing.write / weighing.edit), mesmo chamando o serviço direto; OPERADOR lança e edita.
// 2) TELAS: Relação e Lançamento escondem valores comerciais sem commercial.values e a Relação
//    esconde lançar/editar/excluir/importar/exportar conforme a matriz (inspeção de fonte).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const as = (role) => setActorProvider(() => ({ id: `u-${role}`, nome: role, role }));

async function codeOf(run) {
  try { await run(); return 'OK'; } catch (error) { return error.code ?? error.message; }
}

await deleteDbForTests();
const base = { empresa_id: 'local', numero_animal: '900', marca: 'A', sexo: 'M', raca: 'Nelore', status_animal: 'Ativo' };

as('OPERADOR');
assert.equal(await codeOf(() => weighingService.createEntry({ ...base, id: 'cad', animal_id: 'a900', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 300 })), 'OK', 'OPERADOR lança');
assert.equal(await codeOf(() => weighingService.updateEntry('cad', { observacao: 'op' })), 'OK', 'OPERADOR edita');

as('CONSULTA');
const denied = {
  createEntry: await codeOf(() => weighingService.createEntry({ ...base, id: 'm1', animal_id: 'a900', tipo_manejo: 'Manejo', data_pesagem: '2026-09-05', peso: 320 })),
  updateEntry: await codeOf(() => weighingService.updateEntry('cad', { observacao: 'x' })),
  deleteEntry: await codeOf(() => weighingService.deleteEntry('cad')),
  bulkUpdateEntries: await codeOf(() => weighingService.bulkUpdateEntries([{ id: 'cad', patch: { observacao: 'x' } }])),
  bulkDeleteEntries: await codeOf(() => weighingService.bulkDeleteEntries(['cad'])),
  bulkCreateEntries: await codeOf(() => weighingService.bulkCreateEntries([{ ...base, numero_animal: '901', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 250 }])),
};
for (const [operation, code] of Object.entries(denied)) assert.equal(code, 'AUTH_FORBIDDEN', `CONSULTA: ${operation} recusado no serviço`);
assert.equal((await weighingService.listEntries({ empresaId: 'local' })).length, 1, 'CONSULTA lê; nada foi gravado nem excluído');
assert.equal((await weighingService.getEntryById('cad')).observacao, 'op', 'edição da CONSULTA não aplicada');

// Autenticação ativa (provedor registrado) e SEM sessão: falha fechada.
setActorProvider(() => null);
assert.equal(await codeOf(() => weighingService.updateEntry('cad', { observacao: 'sem sessão' })), 'AUTH_FORBIDDEN', 'sem sessão no app: recusa');
assert.equal(await codeOf(() => weighingService.createEntry({ ...base, id: 'x9', animal_id: 'a900', tipo_manejo: 'Manejo', data_pesagem: '2026-09-06', peso: 330 })), 'AUTH_FORBIDDEN');

// Sem provedor de ator (gates em Node, migração): o serviço não bloqueia.
setActorProvider(null);
assert.equal(await codeOf(() => weighingService.updateEntry('cad', { observacao: 'sistema' })), 'OK');

// Valores comerciais digitados só entram com commercial.write (serviço, não só a tela).
as('GESTOR');
await weighingService.createEntry({ ...base, numero_animal: '950', id: 'v1', animal_id: 'a950', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 300, valor_pago_cabeca: 2500 });
assert.equal((await weighingService.getEntryById('v1')).valor_pago_cabeca, 2500, 'GESTOR grava valor');
as('OPERADOR');
await weighingService.updateEntry('v1', { observacao: 'op', valor_pago_cabeca: 1 });
const aposOperador = await weighingService.getEntryById('v1');
assert.equal(aposOperador.valor_pago_cabeca, 2500, 'OPERADOR não altera valor; o gravado é preservado');
assert.equal(aposOperador.observacao, 'op', 'o restante da edição do OPERADOR vale');
await weighingService.bulkUpdateEntries([{ id: 'v1', patch: { valor_pago_cabeca: 2 } }], { recalculate: false });
assert.equal((await weighingService.getEntryById('v1')).valor_pago_cabeca, 2500, 'edição em lote também');
await weighingService.createEntry({ ...base, numero_animal: '951', id: 'v2', animal_id: 'a951', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 310, valor_pago_cabeca: 999 });
assert.equal((await weighingService.getEntryById('v2')).valor_pago_cabeca ?? null, null, 'OPERADOR não grava valor comercial');
setActorProvider(null);
await deleteDbForTests();

// Inspeção de fonte das telas.
const relacao = read('src/pages/PesagensIndividuais.jsx');
assert.match(relacao, /COMMERCIAL_VALUE_COLUMN_IDS = new Set\(EVENT_COLUMNS\.filter\(\(column\) => column\.sensitive === SENSITIVITY\.COMMERCIAL\)/, 'Relação usa a sensibilidade declarada nas colunas');
{
  const { EVENT_COLUMNS } = await import('../src/modules/reporting/definitions/columns/eventColumns.js');
  const comerciais = EVENT_COLUMNS.filter((column) => column.sensitive === 'commercial').map((column) => column.id);
  for (const id of ['valor_pago_cabeca', 'valor_venda_total', 'valor_arroba', 'quantidade_arrobas', 'valor_arroba_abate', 'valor_total_abate', 'peso_carcaca_estimado', 'rendimento_carcaca']) {
    assert.ok(comerciais.includes(id), `coluna comercial: ${id}`);
  }
}
assert.match(relacao, /const podeVerValores = pode\('commercial\.values'\)/);
assert.match(relacao, /\.map\(id => colunasPermitidas\.find\(c => c\.id === id\)\)/, 'tabela usa só colunas permitidas');
assert.match(relacao, /columns=\{colunasPermitidas\}/, 'configurador de colunas não oferece valores sem permissão');
assert.doesNotMatch(relacao, /\.map\(id => COLUNAS_DISPONIVEIS\.find/, 'NEGATIVO: a tabela não lê a lista completa');
assert.match(relacao, /const podeEditar = pode\('weighing\.edit'\)/);
assert.match(relacao, /\{podeEditar && \(<>/, 'Editar/Excluir da barra só com weighing.edit');
assert.match(relacao, /if \(!podeEditar\) return <TableCell key="acoes"/, 'menu da linha só com weighing.edit');
assert.match(relacao, /\.\.\.\(podeImportar \? \[/, 'Importar só com weighing.write');
assert.match(relacao, /\.\.\.\(podeExportar \? \[/, 'Exportar só com reports.export');

const lancamento = read('src/pages/LancamentoPesagensIndividuais.jsx');
assert.match(lancamento, /const podeVerValores = auth \? Boolean\(auth\.can\?\.\('commercial\.values'\)\) : true/);
assert.match(lancamento, /colunasPermitidas\.find\(\(c\) => c\.id === id\)/, 'grade do Lançamento usa colunas permitidas');
assert.equal((lancamento.match(/\{podeVerValores &&\s/g) || []).length, 3, 'campos de valor (compra, venda, abate) condicionados');
assert.match(lancamento, /painelResumoTipo === 'venda' && podeVerValores/, 'resumo de venda só com commercial.values');
for (const field of ['valor_arroba_abate', 'valor_total_abate', 'peso_carcaca_estimado', 'rendimento_carcaca']) {
  assert.match(lancamento, new RegExp(`const COMMERCIAL_VALUE_FIELDS = new Set\\([^)]*"${field}"`), `Lançamento esconde ${field}`);
}
assert.match(lancamento, /exportarExcel=\{auth && !auth\.can\?\.\('reports\.export'\) \? null : exportarExcel\}/, 'Exportar do rodapé só com reports.export');
assert.match(lancamento, /mostrarArrobas=\{podeVerValores\}/, 'arrobas do resumo de lotes só com commercial.values');
assert.match(read('src/components/pesagens/PesagensResumoRodape.jsx'), /\{exportarExcel \? \(/, 'rodapé sem botão quando não há exportação');
const ficha = read('src/pages/FichaAnimal.jsx');
assert.match(ficha, /\{pode\('reports\.export'\) \? <button[^>]*onClick=\{exportHistory\}/, 'Ficha: Exportar histórico só com reports.export');
assert.match(ficha, /\.\.\.\(pode\('commercial\.values'\) \? \[\['@ carcaça est\.'/, 'Ficha: @ carcaça só com commercial.values');

console.log(JSON.stringify({ gate: 'auth:weighing-access:verify', ok: true, consultaDenied: denied }, null, 2));
