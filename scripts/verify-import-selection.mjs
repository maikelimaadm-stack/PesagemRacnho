import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyImportLotSelection, importLotKey } from '../src/modules/weighing/domain/importLotSelection.js';
import { collectRegistryTexts, countUnknownRegistries, splitImportRowsByRegistry } from '../src/modules/operations/domain/importRegistryResolution.js';
import { resolveNamesAgainst } from '../src/modules/catalog/domain/catalogResolver.js';
import { normalizeName } from '../src/modules/catalog/domain/normalize.js';

const candidates = [
  { nome_lote: 'Lote A', nome_apartacao: 'Apartação 1', lote_id: 'lote-a', apartacao_id: 'apartacao-1' },
  { nome_lote: 'Lote B', nome_apartacao: 'Apartação 1', lote_id: 'lote-b', apartacao_id: 'apartacao-1' },
];
const rows = [
  { numero_animal: '1', nome_lote: ' lote a ', nome_apartacao: 'APARTAÇÃO 1' },
  { numero_animal: '2', nome_lote: 'LOTE B', nome_apartacao: 'Apartação 1' },
  { numero_animal: '3', nome_lote: 'Não cadastrado', nome_apartacao: 'Outra' },
];
const selected = { [importLotKey(candidates[0])]: true, [importLotKey(candidates[1])]: false };
const result = applyImportLotSelection(rows, candidates, selected);
assert.equal(result.length, 2, 'lote recusado deve permanecer fora da importação');
assert.deepEqual(result.map((row) => row.numero_animal), ['1', '3']);
assert.equal(result[0].lote_id, 'lote-a');
assert.equal(result[0].apartacao_id, 'apartacao-1');
assert.equal(result[1].lote_id, undefined, 'linha sem lote cadastrado não deve receber vínculo');

// S-01.5 / IMPORT-TARGET-MODEL §2.2: marca e raça resolvidas por nome normalizado
// contra os cadastros; desconhecidos listados e NUNCA criados em silêncio.
const marcas = [
  { id: 'm-abc', nome: 'ABC', nome_normalizado: normalizeName('ABC'), ativo: true },
  { id: 'm-old', nome: 'Antiga', nome_normalizado: normalizeName('Antiga'), ativo: false },
  { id: 'm-del', nome: 'Excluída', nome_normalizado: normalizeName('Excluída'), ativo: true, deleted_at: '2026-01-01T00:00:00Z' },
];
const racas = [{ id: 'r-nelore', nome: 'Nelore', nome_normalizado: normalizeName('Nelore'), ativo: true }];
const linhas = [
  { linha: 2, numero_animal: '1', marca: ' abc ', raca: 'NELORE' },
  { linha: 3, numero_animal: '2', marca: 'Antiga', raca: '' },
  { linha: 4, numero_animal: '3', marca: 'Excluída', raca: 'Angus' },
  { linha: 5, numero_animal: '4', marca: '', raca: '' },
];
const textos = collectRegistryTexts(linhas);
assert.deepEqual(textos, { marcas: ['abc', 'Antiga', 'Excluída'], racas: ['NELORE', 'Angus'] }, 'textos únicos por nome normalizado, vazios ignorados');
const resolved = {
  marcas: resolveNamesAgainst(marcas, textos.marcas).ids,
  racas: resolveNamesAgainst(racas, textos.racas).ids,
};
assert.equal(resolved.marcas.abc, 'm-abc', 'marca resolvida por nome normalizado (espaços e caixa ignorados)');
assert.equal(resolved.marcas.Antiga, 'm-old', 'marca inativa resolve (histórico pode citá-la)');
assert.equal(resolved.marcas['Excluída'], undefined, 'NEGATIVO: marca excluída não resolve');

const semOpcao = splitImportRowsByRegistry(linhas, resolved, { criarDesconhecidos: false });
assert.deepEqual(semOpcao.elegiveis.map((row) => row.numero_animal), ['1', '2', '4'], 'só linhas com cadastros existentes (ou em branco) entram sem a opção');
assert.equal(semOpcao.elegiveis[0].marca_id, 'm-abc');
assert.equal(semOpcao.elegiveis[0].raca_id, 'r-nelore');
assert.equal(semOpcao.elegiveis[2].marca_id, null, 'texto vazio fica sem id (o adapter aplica o padrão da empresa)');
assert.deepEqual(semOpcao.rejeitadas.map((item) => item.linha), [4], 'NEGATIVO: linha com marca/raça desconhecida é rejeitada');
assert.match(semOpcao.rejeitadas[0].erro, /Animal 3: Marca "Excluída" e Raça "Angus" não cadastrada/, 'erro por linha nomeia os cadastros ausentes');
assert.deepEqual(semOpcao.desconhecidos, { marcas: ['Excluída'], racas: ['Angus'] }, 'lista "Cadastros não encontrados"');
assert.equal(countUnknownRegistries(semOpcao.desconhecidos), 2);
assert.equal(semOpcao.pendentes, 1);

const comOpcao = splitImportRowsByRegistry(linhas, resolved, { criarDesconhecidos: true });
assert.equal(comOpcao.elegiveis.length, 4, 'com a opção explícita a linha pendente segue');
assert.deepEqual(comOpcao.rejeitadas, [], 'com a opção não há rejeição por cadastro');
assert.equal(comOpcao.elegiveis[2].marca_id, null, 'NEGATIVO: a opção não inventa id — fica nulo até o cadastro existir');
assert.equal(marcas.length, 3, 'NEGATIVO: a resolução pura não cria registros');

const vazio = splitImportRowsByRegistry([], {}, {});
assert.deepEqual(vazio, { elegiveis: [], rejeitadas: [], desconhecidos: { marcas: [], racas: [] }, pendentes: 0 }, 'sem linhas não há nada a resolver');

const relation = await readFile(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
assert.match(relation, /applyImportLotSelection\(importData, lotesParaVincular, vincularLotesSelecionados\)/);
assert.match(relation, /Selecionar todos os lotes encontrados/);
assert.match(relation, /motivoSaidaImport \|\| undefined/);
assert.doesNotMatch(relation, /SelectItem\s+value=\{null\}/);
assert.match(relation, /resolveMany\(collectRegistryTexts\(dados\), \{ empresaId: empresaSelecionadaId \}\)/, 'dry-run resolve marca/raça pelo resolvedor único dos cadastros');
assert.match(relation, /splitImportRowsByRegistry\(dados, resolucao, \{ criarDesconhecidos: false \}\)/, 'dry-run começa sem criar nada');
assert.match(relation, /Cadastros não encontrados/, 'lista de cadastros não encontrados aparece no diálogo');
assert.match(relation, /aria-label="Criar estes cadastros ao importar"/, 'opção explícita de criação');
assert.match(relation, /auth\?\.can\?\.\(REGISTRY_WRITE_PERMISSION\)/, 'opção exige registry.write via useAuth().can');
assert.match(relation, /criarCadastrosNaImportacao && totalCadastrosDesconhecidos > 0\s*\? await criarCadastrosDesconhecidos\(\)\s*: importData/, 'sem a opção, linhas com valor desconhecido não entram');
assert.ok(relation.indexOf('await criarCadastrosDesconhecidos()') < relation.indexOf('weighingService.bulkCreateEntries(registros'), 'cadastros são criados antes de bulkCreateEntries');
assert.equal((relation.match(/(brandService|breedService)\.create\(/g) || []).length, 2, 'NEGATIVO: nenhuma criação de marca/raça fora da rotina explícita');
assert.doesNotMatch(relation, /linha: _linha, \.\.\.item \}\) => \(\{[\s\S]{0,40}linha/, 'o número da linha do arquivo não vai para o payload');

console.log('OK verify-import-selection');
console.log(JSON.stringify({
  selectionPersists: true,
  rejectedLotsExcluded: true,
  acceptedLotsLinked: true,
  importExitReasonSelectable: true,
  registryResolvedByNormalizedName: true,
  unknownRegistriesListed: true,
  unknownRowsRejectedWithoutOption: true,
  noSilentRegistryCreation: true,
}, null, 2));
