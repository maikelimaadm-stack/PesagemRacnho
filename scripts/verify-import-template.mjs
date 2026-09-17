// Gate import:template:verify — modelo de planilha só com colunas digitadas pela pessoa.
// ID, ID externo e derivados (peso/data anterior, dias, ganho, GMD) nunca entram: são
// calculados na importação. O modelo é importável (cabeçalhos reconhecidos) e usa BOM + ';'.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLUMNS_NOT_IN_TEMPLATE, TEMPLATE_KINDS, buildImportTemplateCsv, importTemplateHeaders } from '../src/modules/import/domain/spreadsheetTemplate.js';
import { IMPORT_TYPES } from '../src/modules/import/domain/importConstants.js';
import { listMappableFields, suggestMapping } from '../src/modules/import/domain/importFields.js';

const mapeaveis = (type) => listMappableFields(type).map((campo) => campo.id);

const normalizar = (text) => String(text).toLowerCase().replace(/[_\s]/g, '').normalize('NFD').replace(/\p{M}/gu, '');
const proibidas = COLUMNS_NOT_IN_TEMPLATE.map(normalizar);

for (const kind of Object.values(TEMPLATE_KINDS)) {
  const { content, fileName, headers } = buildImportTemplateCsv(kind);
  assert.equal(content.charCodeAt(0), 0xfeff, `${kind}: BOM`);
  const lines = content.slice(1).split('\r\n').filter(Boolean);
  assert.deepEqual(lines[0].split(';'), headers, `${kind}: cabeçalho com ';'`);
  assert.ok(lines.length >= 3, `${kind}: exemplos`);
  for (const line of lines.slice(1)) assert.equal(line.split(';').length, headers.length, `${kind}: exemplo com todas as colunas`);
  for (const header of headers) assert.ok(!proibidas.includes(normalizar(header)), `${kind}: sem coluna calculada/técnica (${header})`);
  for (const extra of ['anterior', 'gmd', 'ganho', 'dias', 'idexterno']) assert.ok(!headers.some((header) => normalizar(header).includes(extra)), `${kind}: sem ${extra}`);
  assert.ok(headers.includes('Data') && headers.includes('NumeroAnimal') && headers.includes('Marca'), `${kind}: identifica animal e data`);
  assert.match(fileName, /^modelo_importacao_.+\.csv$/);
}
assert.deepEqual(importTemplateHeaders(TEMPLATE_KINDS.PESAGENS), ['Data', 'NumeroAnimal', 'Marca', 'Sexo', 'Raça', 'Categoria', 'Peso', 'Apartação', 'Lote', 'Observação']);
assert.deepEqual(importTemplateHeaders(TEMPLATE_KINDS.SAIDAS), ['Data', 'NumeroAnimal', 'Marca', 'MotivoSaida', 'CausaMorte', 'Peso', 'Observação']);

// 17/09/2026: a Relação não interpreta mais cabeçalho nenhum — quem reconhece as colunas do
// modelo é o motor da importação (suggestMapping), usado pelo assistente. Em vez de procurar
// os apelidos no código da tela, o gate prova o reconhecimento de verdade.
for (const [kind, type, esperados] of [
  [TEMPLATE_KINDS.PESAGENS, IMPORT_TYPES.HISTORICO, ['data', 'numero', 'marca', 'sexo', 'raca', 'categoria', 'peso', 'apartacao', 'lote', 'observacao']],
  [TEMPLATE_KINDS.SAIDAS, IMPORT_TYPES.SAIDAS, ['data', 'numero', 'marca', 'motivo_saida', 'causa_morte', 'peso', 'observacao']],
]) {
  const mapeamento = suggestMapping(importTemplateHeaders(kind), type);
  assert.deepEqual(Object.values(mapeamento), esperados, `${kind}: o motor reconhece cada coluna do modelo`);
  assert.ok(Object.values(mapeamento).every((campo) => mapeaveis(type).includes(campo)), `${kind}: só campos digitáveis`);
}
const relacao = readFileSync(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
assert.match(relacao, /buildImportTemplateCsv\(TEMPLATE_KINDS\.PESAGENS\)/, 'Relação baixa o modelo compartilhado');
const assistente = readFileSync(new URL('../src/pages/Importacao.jsx', import.meta.url), 'utf8');
assert.match(assistente, /buildImportTemplateCsv\(TEMPLATE_KINDS\[kind\]\)/, 'o assistente oferece o mesmo modelo (pesagens e saídas)');
assert.doesNotMatch(relacao, /'ID_Externo'|'PesoAnterior'|'DataAnterior'/, 'NEGATIVO: modelo antigo com derivados saiu da tela');

console.log(JSON.stringify({ gate: 'import:template:verify', ok: true, pesagens: importTemplateHeaders(TEMPLATE_KINDS.PESAGENS), saidas: importTemplateHeaders(TEMPLATE_KINDS.SAIDAS) }, null, 2));
