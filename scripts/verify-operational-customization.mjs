import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady, resetDbForTests } from '../src/storage/indexedDb/db.js';
import { getSetting, setSetting } from '../src/modules/settings/application/settingsService.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await deleteDbForTests();
await ensureStorageReady();

const perfis = {
  venda: [{ id: 'v1', nome: 'VENDA TESTE', comprador: 'COMPRADOR', valorArroba: '300' }],
  abate: [{ id: 'a1', nome: 'ABATE TESTE', frigorifico: 'FRIGORIFICO' }],
};
const resumos = [
  { id: 'r1', label: 'Peso total', field: 'peso', operation: 'sum', scope: 'dia' },
  { id: 'r2', label: 'Peso por arroba', field: 'peso', operation: 'ratio', divisorField: 'quantidade_arrobas', scope: 'venda' },
];
await setSetting('perfis-saida:empresa-teste', perfis);
await setSetting('resumo-personalizado:empresa-teste', resumos);
resetDbForTests();
await ensureStorageReady();
assert.deepEqual(await getSetting('perfis-saida:empresa-teste'), perfis, 'cadastros de venda/abate devem persistir');
assert.deepEqual(await getSetting('resumo-personalizado:empresa-teste'), resumos, 'configuração de resumo deve persistir');

const launch = readFileSync(join(root, 'src/pages/LancamentoPesagensIndividuais.jsx'), 'utf8');
assert.match(launch, /GerenciarSaidasDialog/, 'venda e abate devem abrir cadastro em diálogo');
assert.match(launch, /ConfigurarResumosDialog/, 'resumos devem ser configuráveis');
assert.doesNotMatch(launch, /title=\{mostrarDadosVenda \? 'Ocultar Dados de Venda'/, 'venda não deve depender do botão de olho');

const summaryDialog = readFileSync(join(root, 'src/components/pesagens/ConfigurarResumosDialog.jsx'), 'utf8');
for (const operation of ['count', 'sum', 'average', 'min', 'max', 'ratio']) {
  assert.ok(summaryDialog.includes(`id: '${operation}'`), `operação ${operation} deve existir`);
}

const css = readFileSync(join(root, 'src/styles/d17b-modelobase1.css'), 'utf8');
assert.match(css, /box-shadow:\s*0 0 0 2px rgba\(39, 196, 91, \.10\)/, 'foco deve usar brilho suave de 2 px');
assert.ok(css.includes('.d17d-management-table'), 'listas dos popups devem usar tabela gerencial padronizada');

console.log('OK verify-operational-customization');
console.log(JSON.stringify({
  reusableExitProfiles: ['venda', 'abate'],
  customSummaryOperations: ['count', 'sum', 'average', 'min', 'max', 'ratio'],
  settingsPersistAfterReopen: true,
  softFocus: true,
}, null, 2));
