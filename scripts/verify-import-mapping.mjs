// Gate import:mapping:verify — leitura do arquivo e mapeamento da importação conciliada.
// Cobre: aliases de cabeçalho (Nº, Identificação, Brinco, DataPesagem, PesoKg…), cabeçalhos
// técnicos 1:1, BOM/CRLF/aspas/";"/","/TAB, apóstrofo de proteção contra fórmula, LINHA FÍSICA
// (linhas em branco e campo com quebra de linha), hash estável, datas BR e ISO, decimais com
// vírgula e ponto e o decimal do layout técnico. Negativos: aspas não fechadas, data inválida,
// futura ou fora do formato, número inválido, cabeçalho repetido, coluna obrigatória ausente.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { brandService } from '../src/modules/catalog/application/registryServices.js';
import {
  IMPORT_TYPES,
  IMPORT_TYPE_LABELS,
  ROW_STATUS,
  analyzeImport,
  listImportFields,
  readImportFile,
  suggestMapping,
} from '../src/modules/import/application/importService.js';
import { TECHNICAL_IMPORT_HEADERS, isTechnicalLayout, normalizeHeader } from '../src/modules/import/domain/importFields.js';
import { normalizeImportText } from '../src/modules/import/domain/importFile.js';
import { parseImportDate, parseImportDecimal, parseMotivoSaida, parseSexo, parseTipo } from '../src/modules/import/domain/importValues.js';
import { sha256HexSync } from '../src/modules/import/domain/sha256Sync.js';

const BOM = String.fromCharCode(0xfeff);

// 1. Contrato público.
assert.deepEqual(Object.keys(IMPORT_TYPES), ['HISTORICO', 'CADASTROS', 'MANEJOS', 'SAIDAS', 'MESTRES', 'SANIDADE']);
assert.equal(IMPORT_TYPE_LABELS.HISTORICO, 'Histórico conciliado — Cadastro + Manejos');
assert.deepEqual(Object.values(ROW_STATUS), ['NOVO', 'JÁ EXISTE', 'POSSÍVEL DUPLICIDADE', 'CONFLITO', 'ERRO', 'AMBÍGUO', 'IGNORADA']);
const technical = 'id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao'.split(';');
assert.deepEqual([...TECHNICAL_IMPORT_HEADERS], technical, 'cabeçalhos técnicos exatos');
for (const type of ['HISTORICO', 'CADASTROS', 'MANEJOS', 'SAIDAS']) {
  const fields = listImportFields(type);
  assert.deepEqual(fields.slice(0, technical.length).map((item) => item.id), technical, `${type}: campos na ordem técnica`);
  assert.deepEqual(fields.slice(technical.length).map((item) => item.id), ['peso_anterior', 'data_anterior', 'dias', 'ganho', 'gmd'], `${type}: derivados só para comparação`);
  assert.ok(fields.filter((item) => item.derived).length === 5);
  assert.ok(fields.every((item) => typeof item.label === 'string' && Array.isArray(item.aliases)));
  assert.equal(fields.find((item) => item.id === 'data').required, true);
  assert.equal(fields.find((item) => item.id === 'numero').required, true);
}
assert.equal(listImportFields('SAIDAS').find((item) => item.id === 'peso').required, false, 'Saída aceita peso ausente');
assert.equal(listImportFields('MANEJOS').find((item) => item.id === 'peso').required, true);
assert.deepEqual(listImportFields('MESTRES').map((item) => item.id), ['marca', 'raca', 'causa_morte', 'categoria', 'sexo', 'peso_min_kg', 'peso_max_kg', 'era', 'ordem']);
// Aplicações de sanidade (17/09/2026): campos próprios, nenhum técnico e nenhum derivado —
// a cobertura de ponta a ponta do tipo está em scripts/verify-import-sanity.mjs.
assert.equal(IMPORT_TYPE_LABELS.SANIDADE, 'Aplicações de sanidade');
assert.deepEqual(listImportFields('SANIDADE').map((item) => item.id), ['data', 'numero', 'marca', 'programa', 'medicamento', 'dose', 'unidade', 'via_aplicacao', 'observacao']);
assert.deepEqual(listImportFields('SANIDADE').filter((item) => item.required).map((item) => item.id), ['data', 'numero']);
assert.ok(listImportFields('SANIDADE').every((item) => !item.derived && !item.technical), 'SANIDADE: nenhum campo técnico ou derivado');
assert.throws(() => listImportFields('X'), /Tipo de importação desconhecido/, 'NEGATIVO: tipo desconhecido');

// 2. Cabeçalhos técnicos mapeiam 1:1; aliases conhecidos.
for (const type of ['HISTORICO', 'CADASTROS', 'MANEJOS', 'SAIDAS']) {
  const mapping = suggestMapping(technical, type);
  for (const header of technical) assert.equal(mapping[header], header, `${type}: ${header} → ${header}`);
}
assert.equal(isTechnicalLayout(technical), true);
assert.equal(isTechnicalLayout(['Numero', 'Data', 'Peso']), false);
const aliasCases = {
  NumeroAnimal: 'numero', Animal: 'numero', Numero: 'numero', 'Número': 'numero', Brinco: 'numero', Identificador: 'numero',
  'Identificação': 'numero', 'Nº': 'numero', 'N°': 'numero', Data: 'data', DataPesagem: 'data', 'Data Pesagem': 'data', data_pesagem: 'data',
  Peso: 'peso', PesoKg: 'peso', 'Peso (kg)': 'peso', 'Raça': 'raca', 'Apartação': 'apartacao', 'Observação': 'observacao', Obs: 'observacao',
  ID_Externo: 'id_externo', 'Motivo Saída': 'motivo_saida', 'Causa da morte': 'causa_morte', Tipo: 'tipo', DataAnterior: 'data_anterior',
  PesoAnterior: 'peso_anterior', Dias: 'dias', Ganho: 'ganho', GMD: 'gmd', Marca: 'marca', Sexo: 'sexo', Lote: 'lote', NomeLote: 'lote',
  Categoria: 'categoria', 'ID Animal': 'animal_id', ID: 'id',
};
for (const [header, expected] of Object.entries(aliasCases)) {
  assert.equal(suggestMapping([header], 'HISTORICO')[header], expected, `alias "${header}" → ${expected}`);
}
assert.equal(normalizeHeader(`${BOM}Nº`), 'n', 'BOM e ordinal saem do cabeçalho');
const relationHeaders = ['ID', 'ID_Externo', 'Data', 'NumeroAnimal', 'Sexo', 'Raça', 'Era', 'Marca', 'Peso', 'Lote', 'Apartação', 'Observação', 'DataAnterior', 'PesoAnterior', 'Dias', 'Ganho', 'GMD'];
const relationMapping = suggestMapping(relationHeaders, 'HISTORICO');
assert.equal(relationMapping.Era, null, 'NEGATIVO: Era não é campo da importação');
assert.equal(relationMapping.NumeroAnimal, 'numero');
assert.equal(relationMapping.GMD, 'gmd');
const repeated = suggestMapping(['Animal', 'Brinco', 'animal_id'], 'HISTORICO');
assert.deepEqual(repeated, { Animal: 'numero', Brinco: null, animal_id: 'animal_id' }, 'NEGATIVO: cada campo uma vez; id exato vence alias');
const masters = suggestMapping(['Marca', 'Raça', 'Causa da morte', 'Categoria', 'Sexo', 'Peso mínimo', 'Peso máximo', 'Era', 'Ordem'], 'MESTRES');
assert.deepEqual(Object.values(masters), ['marca', 'raca', 'causa_morte', 'categoria', 'sexo', 'peso_min_kg', 'peso_max_kg', 'era', 'ordem']);

// 3. Leitura: BOM, CRLF, aspas, linha física, delimitadores e hash.
const text = `${BOM}Brinco;Data;Peso;Observação\r\n10;01/02/2026;210,5;"linha com ; e ""aspas"""\r\n\r\n11;02/02/2026;220;"quebra\r\nde linha"\r\n12;03/02/2026;230;'=SOMA(1)\r\n`;
const read = readImportFile(text);
assert.equal(read.delimiter, ';');
assert.deepEqual(read.headers, ['Brinco', 'Data', 'Peso', 'Observação'], 'BOM removido do primeiro cabeçalho');
assert.deepEqual(read.rows.map((row) => row.line), [2, 4, 6], 'linha física: em branco e quebra dentro de aspas contam');
assert.equal(read.rows[0].values['Observação'], 'linha com ; e "aspas"');
assert.equal(read.rows[1].values['Observação'], 'quebra\nde linha');
assert.equal(read.rows[2].values['Observação'], '=SOMA(1)', 'apóstrofo de proteção contra fórmula removido');
assert.equal(read.hash, createHash('sha256').update(normalizeImportText(text), 'utf8').digest('hex'), 'SHA-256 do texto normalizado');
assert.equal(readImportFile(text.replace(BOM, '').replace(/\r\n/g, '\n')).hash, read.hash, 'mesmo conteúdo com LF e sem BOM → mesmo hash');
assert.notEqual(readImportFile(text.replace('210,5', '210,6')).hash, read.hash, 'NEGATIVO: conteúdo diferente → hash diferente');
assert.equal(sha256HexSync(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
const tabbed = readImportFile('Numero\tData\tPeso\n1\t2026-01-01\t200\n');
assert.equal(tabbed.delimiter, '\t');
assert.deepEqual(tabbed.rows[0].values, { Numero: '1', Data: '2026-01-01', Peso: '200' });
const comma = readImportFile('Numero,Data,Peso\n1,2026-01-01,"200,5"\n');
assert.equal(comma.delimiter, ',');
assert.equal(comma.rows[0].values.Peso, '200,5');
assert.equal(readImportFile('a;b\n1;2', { delimiter: 'tab' }).delimiter, '\t', 'separador explícito');
assert.throws(() => readImportFile('a;b\n1;2', { delimiter: '|' }), /Separador não suportado/, 'NEGATIVO: separador desconhecido');
assert.throws(() => readImportFile('a;b\n1;"abc\n2;3\n'), /aspas iniciado na linha 2/, 'NEGATIVO: aspas não fechadas citam a linha física');
const dup = readImportFile('Peso;Peso;\n1;2;3');
assert.deepEqual(dup.headers, ['Peso', 'Peso (2)', 'Coluna 3'], 'cabeçalho repetido ou vazio não some');
assert.deepEqual(readImportFile('').rows, []);

// 4. Datas e decimais.
const today = new Date(2026, 8, 17);
assert.equal(parseImportDate('05/03/2026', 'auto', { today }).value, '2026-03-05');
assert.equal(parseImportDate('2026-03-05', 'auto', { today }).value, '2026-03-05');
assert.equal(parseImportDate('5/3/2026', 'DD/MM/AAAA', { today }).value, '2026-03-05');
assert.equal(parseImportDate('2026-03-05', 'AAAA-MM-DD', { today }).value, '2026-03-05');
assert.match(parseImportDate('2026-03-05', 'DD/MM/AAAA', { today }).error, /fora do formato DD\/MM\/AAAA/, 'NEGATIVO: formato estrito');
assert.match(parseImportDate('05/03/2026', 'AAAA-MM-DD', { today }).error, /fora do formato AAAA-MM-DD/);
assert.match(parseImportDate('31/02/2026', 'auto', { today }).error, /Data inválida/, 'NEGATIVO: dia inexistente');
assert.match(parseImportDate('18/09/2026', 'auto', { today }).error, /futuro/, 'NEGATIVO: data futura');
assert.match(parseImportDate('05/03/26', 'auto', { today }).error, /Data inválida/, 'NEGATIVO: ano com dois dígitos');
assert.equal(parseImportDate('', 'auto', { today }).value, null);
assert.equal(parseImportDecimal('1.234,56').value, 1234.56);
assert.equal(parseImportDecimal('206,5').value, 206.5);
assert.equal(parseImportDecimal('206.5').value, 206.5);
assert.equal(parseImportDecimal('1.625', 'virgula').value, 1625, 'vírgula: ponto é milhar');
assert.equal(parseImportDecimal('1.625', 'ponto').value, 1.625, 'ponto: ponto é decimal');
assert.equal(parseImportDecimal('1,234.5', 'ponto').value, 1234.5);
assert.match(parseImportDecimal('206.5', 'virgula').error, /Número inválido/, 'NEGATIVO: ponto decimal em modo vírgula');
assert.match(parseImportDecimal('206,5', 'ponto').error, /Número inválido/, 'NEGATIVO: vírgula decimal em modo ponto');
assert.match(parseImportDecimal('206 kg').error, /Número inválido/, 'NEGATIVO: unidade no número');
assert.equal(parseSexo('Fêmea').value, 'F');
assert.equal(parseSexo('macho').value, 'M');
assert.match(parseSexo('X').error, /Sexo inválido/);
assert.equal(parseTipo('SAIDA').value, 'Saída');
assert.equal(parseTipo('Pesagem').value, 'Manejo');
assert.match(parseTipo('Venda').error, /Tipo desconhecido/);
assert.equal(parseMotivoSaida('doacao').value, 'Doação');
assert.equal(parseMotivoSaida('Outro').value, 'Outros');
assert.match(parseMotivoSaida('Roubo').error, /Motivo da saída inválido/);

// 5. Análise (dry-run): linha física nas mensagens, BR × ISO × técnico, coluna obrigatória.
await deleteDbForTests();
const db = await storage.ensureReady();
await brandService.create(null, { nome: 'ABC' });
const countAll = async () => Object.fromEntries(await Promise.all(['pesagens', 'animais', 'importacoes', 'auditoria', 'marcas'].map(async (name) => [name, await db.table(name).count()])));
const before = await countAll();
const brFile = ['Brinco;Marca;Sexo;Data;Peso;Observação', '10;ABC;M;01/02/2026;"1.625";"obs com', 'quebra"', '', '11;ABC;M;99/99/2026;200;', '12;ABC;M;2026-02-03;210,5;'].join('\r\n');
const brPlan = await analyzeImport({ text: brFile, type: 'CADASTROS', rules: { categoryMode: 'PLANILHA' } });
assert.deepEqual(brPlan.rows.map((row) => row.line), [2, 5, 6], 'plano usa a linha física');
assert.equal(brPlan.rows[0].peso, 1625, 'layout amigável + auto: 1.625 é milhar');
assert.equal(brPlan.rows[0].status, ROW_STATUS.NOVO);
assert.equal(brPlan.rows[1].status, ROW_STATUS.ERRO);
assert.match(brPlan.rows[1].messages.join(' '), /Data inválida: "99\/99\/2026"/);
assert.equal(brPlan.rows[2].data, '2026-02-03', 'ISO aceito no modo automático');
assert.equal(brPlan.rows[2].peso, 210.5);
assert.equal(brPlan.rules.effectiveDecimal, 'auto');
assert.equal(brPlan.blocking, true, 'linha com erro bloqueia');
const techFile = [technical.join(';'), ';;;2026-02-01;Cadastro;;;20;ABC;;M;;;;;1.625;;;'].join('\r\n');
const techPlan = await analyzeImport({ text: techFile, type: 'CADASTROS', rules: { categoryMode: 'PLANILHA' } });
assert.equal(techPlan.rules.effectiveDecimal, 'ponto', 'CSV técnico usa ponto decimal');
assert.equal(techPlan.rows[0].peso, 1.625, 'técnico: 1.625 é decimal');
assert.deepEqual(Object.entries(techPlan.mapping).filter(([header, field]) => header !== field), [], 'mapeamento técnico 1:1 sem intervenção');
const strictPlan = await analyzeImport({ text: brFile, type: 'CADASTROS', rules: { dateFormat: 'DD/MM/AAAA', decimal: 'virgula' } });
assert.match(strictPlan.rows[2].messages.join(' '), /fora do formato DD\/MM\/AAAA/, 'formato de data escolhido é respeitado');
const missing = await analyzeImport({ text: 'Brinco;Peso\n10;200', type: 'MANEJOS' });
assert.equal(missing.blocking, true);
assert.deepEqual(missing.fileErrors, ['A coluna obrigatória "Data" não foi mapeada.'], 'NEGATIVO: coluna obrigatória ausente');
const staleTemplate = await analyzeImport({ text: 'Brinco;Data;Peso\n10;01/02/2026;200', type: 'MANEJOS', mapping: { Brinco: 'numero', Data: 'data', Peso: 'peso', 'Peso (kg)': 'peso', Lote: 'nao_existe' } });
assert.deepEqual(staleTemplate.fileErrors, ['A coluna "Peso (kg)" do mapeamento não existe no arquivo.', 'O campo "nao_existe" não existe na importação deste tipo.'], 'NEGATIVO: modelo aplicado a outro arquivo');
assert.equal(staleTemplate.blocking, true);
const empty = await analyzeImport({ text: 'Brinco;Data;Peso\n', type: 'HISTORICO' });
assert.deepEqual(empty.fileErrors, ['O arquivo não tem linhas de dados.']);
assert.deepEqual(await countAll(), before, 'dry-run não grava nada');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:mapping:verify',
  ok: true,
  technicalHeaders: technical.length,
  aliasesVerified: Object.keys(aliasCases).length,
  physicalLines: read.rows.map((row) => row.line),
  negativeTests: ['aspas não fechadas', 'separador desconhecido', 'data inválida/futura/formato', 'número inválido', 'campo repetido', 'coluna obrigatória ausente', 'arquivo vazio'],
}, null, 2));
