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

// -----------------------------------------------------------------------------
// 17/09/2026 — a Relação de Pesagens NÃO importa mais. A leitura do arquivo, a escolha do
// tipo (Cadastro/Manejo/Saída ou conciliação automática), o vínculo de apartação/lote e a
// gravação passaram para o assistente de Importação (src/pages/Importacao.jsx +
// src/components/importacao/**) sobre o motor de src/modules/import. As asserções acima
// continuam valendo para o domínio puro; as de tela abaixo provam o comportamento NOVO.
// -----------------------------------------------------------------------------
const relation = await readFile(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(relation, /colMap/, 'NEGATIVO: o mapeamento de colunas antigo saiu da Relação');
assert.doesNotMatch(relation, /parseCsv/, 'NEGATIVO: a Relação não faz mais parse de CSV');
assert.doesNotMatch(relation, /FileReader/, 'NEGATIVO: a Relação não lê mais arquivo');
assert.doesNotMatch(relation, /type="file"/, 'NEGATIVO: a Relação não tem mais campo de arquivo');
assert.doesNotMatch(relation, /bulkCreateEntries/, 'NEGATIVO: a Relação não grava mais importação');
assert.doesNotMatch(relation, /applyImportLotSelection|splitImportRowsByRegistry|criarCadastrosNaImportacao/, 'NEGATIVO: a conciliação antiga (lotes e cadastros) saiu da Relação');
assert.match(
  relation,
  /id: "importar", label: "Importar CSV"[\s\S]{0,120}navigate\(createPageUrl\("Importacao"\)\)/,
  '"Importar CSV" leva ao assistente de Importação',
);
assert.match(relation, /id: "modelo", label: "Baixar modelo CSV"[\s\S]{0,80}baixarModelo/, '"Baixar modelo CSV" continua na Relação');
assert.doesNotMatch(relation, /SelectItem\s+value=\{null\}/, 'NEGATIVO: nenhum item de seleção com valor nulo (continua valendo para os diálogos restantes)');
assert.match(relation, /buildImportTemplateCsv\(TEMPLATE_KINDS\.PESAGENS\)/, 'o modelo continua vindo de spreadsheetTemplate');

// A escolha de tipo e o vínculo de apartação/lote agora moram no assistente.
const wizard = await readFile(new URL('../src/pages/Importacao.jsx', import.meta.url), 'utf8');
const regras = await readFile(new URL('../src/components/importacao/StepRegras.jsx', import.meta.url), 'utf8');
const tipo = await readFile(new URL('../src/components/importacao/StepTipo.jsx', import.meta.url), 'utf8');
assert.match(wizard, /analyzeImport/, 'o assistente concilia pelo serviço (dry-run)');
assert.match(wizard, /applyImport/, 'o assistente grava pelo serviço');
assert.match(tipo, /TIPOS_UNICOS/, 'a escolha de Cadastros/Manejos/Saídas vive no assistente');
assert.match(regras, /apartacao_id/, 'a apartação fixa vive no assistente');
assert.match(regras, /lote_id/, 'o lote fixo vive no assistente');
assert.match(regras, /createMissingMasters/, 'criar cadastros ausentes (registry.write) vive no assistente');

console.log('OK verify-import-selection');
console.log(JSON.stringify({
  selectionPersists: true,
  rejectedLotsExcluded: true,
  acceptedLotsLinked: true,
  registryResolvedByNormalizedName: true,
  unknownRegistriesListed: true,
  unknownRowsRejectedWithoutOption: true,
  noSilentRegistryCreation: true,
  legacyRelationImportRemoved: true,
  relationNavigatesToWizard: true,
  lotAndTypeSelectionInWizard: true,
}, null, 2));
