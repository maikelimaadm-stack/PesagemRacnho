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

// Contrato atual (14/09/2026): compradores, vendedores e frigoríficos vivem no
// registry de cadastros auxiliares e são SELECIONADOS no lançamento; o popup
// legado de perfis de venda/abate (GerenciarSaidasDialog) não faz mais parte
// da tela. Este gate valida o contrato vigente até a migração para stores
// (Programa 2.0, ADR-018/ADR-031), quando será substituído por launch:contract:verify.
const comerciais = {
  compradores: [{ id: 'c1', nome: 'COMPRADOR TESTE', documento: '', telefone: '', cidade: '', ativo: true }],
  vendedores: [{ id: 'v1', nome: 'VENDEDOR TESTE', propriedade: 'FAZENDA', ativo: true }],
  frigorificos: [{ id: 'f1', nome: 'FRIGORIFICO TESTE', sif: '123', ativo: true }],
};
const resumos = [
  { id: 'r1', label: 'Peso total', field: 'peso', operation: 'sum', scope: 'dia' },
  { id: 'r2', label: 'Peso por arroba', field: 'peso', operation: 'ratio', divisorField: 'quantidade_arrobas', scope: 'venda' },
];
// Mesma chave/shape que registryService.saveRegistryGroup grava (o módulo usa o alias '@' e não roda em Node).
await setSetting('cadastros-auxiliares:comerciais:empresa-teste', comerciais);
await setSetting('resumo-personalizado:empresa-teste', resumos);
resetDbForTests();
await ensureStorageReady();
const reloaded = await getSetting('cadastros-auxiliares:comerciais:empresa-teste', { compradores: [], vendedores: [], frigorificos: [] });
assert.deepEqual(reloaded.compradores.map((item) => item.nome), ['COMPRADOR TESTE'], 'compradores do registry devem persistir após reabrir');
assert.deepEqual(reloaded.vendedores.map((item) => item.nome), ['VENDEDOR TESTE'], 'vendedores do registry devem persistir após reabrir');
assert.deepEqual(reloaded.frigorificos.map((item) => item.nome), ['FRIGORIFICO TESTE'], 'frigoríficos do registry devem persistir após reabrir');
assert.deepEqual(await getSetting('resumo-personalizado:empresa-teste'), resumos, 'configuração de resumo deve persistir');

const launch = readFileSync(join(root, 'src/pages/LancamentoPesagensIndividuais.jsx'), 'utf8');
assert.doesNotMatch(launch, /GerenciarSaidasDialog/, 'o popup legado de perfis de venda/abate não deve voltar ao lançamento');
assert.match(launch, /loadRegistryGroup\('comerciais'/, 'lançamento carrega compradores/vendedores/frigoríficos do registry');
assert.match(launch, /auxiliaryCatalogs\.compradores[\s\S]{0,200}<SelectItem/, 'comprador da venda é selecionado do cadastro, não digitado');
assert.match(launch, /auxiliaryCatalogs\.frigorificos[\s\S]{0,200}<SelectItem/, 'frigorífico do abate é selecionado do cadastro, não digitado');
assert.match(launch, /auxiliaryCatalogs\.vendedores[\s\S]{0,200}<SelectItem/, 'vendedor da compra é selecionado do cadastro, não digitado');
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
  registrySelectedInLaunch: ['compradores', 'vendedores', 'frigorificos'],
  legacyExitProfilesDialog: false,
  customSummaryOperations: ['count', 'sum', 'average', 'min', 'max', 'ratio'],
  settingsPersistAfterReopen: true,
  softFocus: true,
}, null, 2));
