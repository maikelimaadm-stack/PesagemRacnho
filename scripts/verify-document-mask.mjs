// Gate da máscara de CPF/CNPJ na ficha (PROMPT-01C item 8, 1.4.0): Propriedades e Parceiros mostram o
// documento como 000.000.000-00 (até 11 dígitos) ou 00.000.000/0000-00 (12–14 posições ou com letra — CNPJ
// alfanumérico), ao digitar e ao abrir a ficha; colar texto formatado ou cru funciona; no máximo 14
// posições; o cursor fica onde a pessoa edita; Backspace/Delete sobre separador apaga o caractere vizinho;
// rótulo digitado ("CPF ", "CNPJ:") sai do campo.
// O que é GRAVADO não muda: normalizeDocument(texto mascarado) = normalizeDocument(texto digitado antes),
// e reabrir e salvar a ficha não regrava o documento. Cada regra tem o caso negativo (ou controle que
// mostra que o teste pegaria o erro).
// E1D (resposta 2 ao REPORT da E1C): a GRADE de Parceiros e Propriedades mostra o CPF/CNPJ mascarado, e a
// pesquisa e o filtro da coluna aceitam o documento com ou sem pontuação.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { MARCAS, PARCEIROS, PROPRIEDADES, REGISTRY_DEFINITIONS, coerceRecord } from '../src/modules/catalog/domain/registryDefinitions.js';
import { matchesFilter } from '../src/modules/reporting/domain/filterEngine.js';
import { partnerService, propertyService } from '../src/modules/catalog/application/index.js';
import { normalizeDocument } from '../src/modules/catalog/domain/normalize.js';
import { formatDocumento } from '../src/modules/catalog/domain/propertyHeader.js';
import {
  DOCUMENT_MAX_LENGTH,
  DOCUMENT_PLACEHOLDER,
  applyDocumentInput,
  caretAfterSignificant,
  documentProblem,
  documentSignificant,
  documentToForm,
  formatDocumentMask,
  maskDocument,
} from '../src/modules/catalog/domain/documentMask.js';
import {
  emptyFor, formFromRecord, formProblems, formatCellValue, headerPreviewFromForm, isDocumentField, matchesDocumentColumnFilter, matchesDocumentSearch, payloadFromForm,
} from '../src/components/cadastros/registryFormModel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const GESTOR = { id: 'u-gestor', nome: 'Gestor Teste', perfil: 'GESTOR' };
const resumo = { regras: [] };
const ok = (regra) => resumo.regras.push(regra);
const rejects = (promise, code, message) => assert.rejects(promise, (err) => {
  assert.equal(err?.code, code, `${message}: code ${err?.code} (${err?.message})`);
  return true;
}, message);

// ---------------------------------------------------------------------------
// Campo simulado: texto + seleção. Cada ação monta o texto que o navegador deixaria no campo e passa por
// applyDocumentInput, exatamente como o onChange do DocumentInput (valor anterior, valor novo,
// selectionEnd e inputType do evento nativo, e o início da seleção lido no beforeinput).
// ---------------------------------------------------------------------------
const field = (value = '', start = value.length, end = start) => ({ value, start, end });
const commit = (state, raw, caret, inputType, { hint = true } = {}) => {
  const result = applyDocumentInput({ previous: state.value, value: raw, caret, inputType, start: hint ? state.start : null });
  return field(result.value, result.caret);
};
const typeText = (state, text) => [...text].reduce((current, char) => (
  commit(current, `${current.value.slice(0, current.start)}${char}${current.value.slice(current.end)}`, current.start + 1, 'insertText')
), state);
const paste = (state, text, options) => commit(state, `${state.value.slice(0, state.start)}${text}${state.value.slice(state.end)}`, state.start + text.length, 'insertFromPaste', options);
const backspace = (state) => {
  if (state.start !== state.end) return commit(state, `${state.value.slice(0, state.start)}${state.value.slice(state.end)}`, state.start, 'deleteContentBackward');
  if (state.start === 0) return state; // o navegador nem dispara o evento
  return commit(state, `${state.value.slice(0, state.start - 1)}${state.value.slice(state.start)}`, state.start - 1, 'deleteContentBackward');
};
const deleteForward = (state) => {
  if (state.start !== state.end) return commit(state, `${state.value.slice(0, state.start)}${state.value.slice(state.end)}`, state.start, 'deleteContentForward');
  if (state.start === state.value.length) return state;
  return commit(state, `${state.value.slice(0, state.start)}${state.value.slice(state.start + 1)}`, state.start, 'deleteContentForward');
};
const at = (state, position) => field(state.value, position);
const select = (state, start, end) => field(state.value, start, end);
const view = (state) => ({ value: state.value, caret: state.start });

// ---------------------------------------------------------------------------
// Contrato: limite, dica do campo, máscara progressiva e mesma posição dos separadores da folha.
// ---------------------------------------------------------------------------
assert.equal(DOCUMENT_MAX_LENGTH, 14, 'CNPJ tem 14 posições');
assert.equal(DOCUMENT_PLACEHOLDER, '000.000.000-00 ou 00.000.000/0000-00', 'dica do formato no campo');
assert.equal(formatDocumentMask(''), '');
assert.equal(formatDocumentMask('1234'), '123.4', 'CPF progressivo');
assert.equal(formatDocumentMask('12345678901'), '123.456.789-01', 'CPF completo');
assert.equal(formatDocumentMask('123456789012'), '12.345.678/9012', '12 dígitos já é CNPJ');
assert.equal(formatDocumentMask('12ABC'), '12.ABC', 'NEGATIVO: com letra nunca é CPF (CNPJ alfanumérico)');
for (const stored of ['12345678901', '12345678000190', '11222333000181', '12ABC34501DE35']) {
  assert.equal(maskDocument(stored), formatDocumento(stored).texto, `ficha mostra ${stored} como a folha imprime`);
}
ok('contrato');

// ---------------------------------------------------------------------------
// Texto inteiro (colar em campo vazio / abrir um valor): saída e PARIDADE DE PERSISTÊNCIA — o texto
// mascarado grava o mesmo que o texto cru gravava antes (até 14 posições significativas).
// ---------------------------------------------------------------------------
const TEXTOS = [
  ['123.456.789-01', '123.456.789-01'],
  ['12345678901', '123.456.789-01'],
  ['12.345.678/0001-90', '12.345.678/0001-90'],
  ['12345678000190', '12.345.678/0001-90'],
  ['12.ABC.345/01DE-35', '12.ABC.345/01DE-35'],
  ['12abc34501de35', '12.ABC.345/01DE-35'],
  ['12ABC34501DE35', '12.ABC.345/01DE-35'],
  ['CPF 699.577.406-01', '699.577.406-01'],
  ['CPF699.577.406-01', '699.577.406-01'],
  ['CPF 123.456.789-01', '123.456.789-01'],
  ['CNPJ: 12.345.678/0001-90', '12.345.678/0001-90'],
  ['CNPJ12345678000190', '12.345.678/0001-90'],
  ['12.ABC.345/01DE-36', '12.ABC.345/01DE-36'],
  ['12ABC34501DE3', '12.ABC.345/01DE-3'],
  [' 12.345.678/0001-90 \n', '12.345.678/0001-90'],
  ['12 345 678 0001 90', '12.345.678/0001-90'],
  ['123.4', '123.4'],
  ['(65) 99999-0000', '659.999.900-00'],
  ['sem dígitos', ''],
  ['ABCDEFGHIJKLM', ''],
  ['', ''],
];
for (const [texto, esperado] of TEXTOS) {
  assert.equal(maskDocument(texto), esperado, `máscara de ${JSON.stringify(texto)}`);
  assert.equal(normalizeDocument(maskDocument(texto)), normalizeDocument(texto), `paridade de persistência: ${JSON.stringify(texto)}`);
  assert.equal(maskDocument(maskDocument(texto)), maskDocument(texto), `máscara estável: ${JSON.stringify(texto)}`);
  assert.equal(coerceRecord(PARCEIROS, { nome: 'X', documento: maskDocument(texto) }).documento, coerceRecord(PARCEIROS, { nome: 'X', documento: texto }).documento, `serviço grava o mesmo: ${JSON.stringify(texto)}`);
}
// O "CPF 699.577.406-01" do gate do cabeçalho (CPF + 11 dígitos = 14 posições que passam nos dígitos
// verificadores do CNPJ alfanumérico) continua CPF — colado e como texto inteiro.
assert.equal(normalizeDocument(maskDocument('CPF 699.577.406-01')), '69957740601');
assert.deepEqual(view(paste(field(), 'CPF 699.577.406-01')), { value: '699.577.406-01', caret: 14 }, 'colar "CPF 699.577.406-01" vira CPF');
// Controle: uma máscara ingênua (mantém toda letra) gravaria outro documento — o teste de paridade pega.
const naive = (texto) => formatDocumentMask(String(texto).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14));
assert.equal(normalizeDocument(naive('CPF 699.577.406-01')), 'CPF69957740601', 'controle: sem a regra, o rótulo "CPF" viraria CNPJ alfanumérico');
assert.notEqual(normalizeDocument(naive('CPF 699.577.406-01')), normalizeDocument('CPF 699.577.406-01'), 'controle: a paridade reprovaria a máscara ingênua');
// Limite de 14: além disso, só as 14 primeiras posições (antes gravava tudo — é a regra nova do limite).
assert.equal(maskDocument('123456789012345'), '12.345.678/9012-34', 'NEGATIVO: 15 dígitos colados param em 14');
assert.equal(documentSignificant('123456789012345678').length, DOCUMENT_MAX_LENGTH, 'NEGATIVO: nunca mais de 14 posições');
assert.equal(documentSignificant('12ABC34501DE35XYZ'), '123450135', 'NEGATIVO: letra depois dos 14 não é CNPJ alfanumérico (fica só com os dígitos, como antes)');
// Integração E1C: rótulo "CPF"/"CNPJ" no começo é descartado antes de ler o documento. Com CNPJ
// alfanumérico isso MUDA (para melhor) o que se gravava ao colar com rótulo: antes, "CNPJ 12.ABC..."
// virava só os dígitos ("123450135", um número que não existe); agora grava o CNPJ.
for (const [texto, esperado, gravado] of [
  ['CNPJ 12.ABC.345/01DE-35', '12.ABC.345/01DE-35', '12ABC34501DE35'],
  ['cnpj: 12abc34501de35', '12.ABC.345/01DE-35', '12ABC34501DE35'],
  ['CNPJ-12.345.678/0001-90', '12.345.678/0001-90', '12345678000190'],
  ['cpf: 699.577.406-01', '699.577.406-01', '69957740601'],
]) {
  assert.equal(maskDocument(texto), esperado, `rótulo descartado: ${JSON.stringify(texto)}`);
  assert.equal(normalizeDocument(maskDocument(texto)), gravado, `grava o documento, não o rótulo: ${JSON.stringify(texto)}`);
  assert.deepEqual(view(paste(field(), texto)), { value: esperado, caret: esperado.length }, `colar ${JSON.stringify(texto)}`);
}
assert.equal(normalizeDocument('CNPJ 12.ABC.345/01DE-35'), '123450135', 'controle: a regra de gravação (normalizeDocument) não mudou — é a máscara que tira o rótulo');
assert.equal(maskDocument('CPF '), '', 'só o rótulo colado → campo vazio (como ao digitar)');
assert.equal(maskDocument('CNPJ:'), '', 'só o rótulo "CNPJ:" → vazio');
ok('texto-inteiro-e-paridade');

// ---------------------------------------------------------------------------
// Digitação progressiva, tecla a tecla, com o cursor no fim.
// ---------------------------------------------------------------------------
const passos = [];
[...'12345678901234'].reduce((state, char) => { const next = typeText(state, char); passos.push(view(next)); return next; }, field());
assert.deepEqual(passos.map((p) => p.value), [
  '1', '12', '123', '123.4', '123.45', '123.456', '123.456.7', '123.456.78', '123.456.789', '123.456.789-0', '123.456.789-01',
  '12.345.678/9012', '12.345.678/9012-3', '12.345.678/9012-34',
], 'CPF progressivo até 11 dígitos, CNPJ a partir de 12');
assert.ok(passos.every((p) => p.caret === p.value.length), 'digitando no fim, o cursor acompanha o fim (inclusive quando entra separador)');
// Digitar com a pontuação dá o mesmo resultado (o separador digitado é ignorado, o da máscara entra sozinho).
assert.equal(typeText(field(), '123.456.789-01').value, '123.456.789-01');
assert.equal(typeText(field(), '12.345.678/0001-90').value, '12.345.678/0001-90');
// CNPJ alfanumérico digitado em minúsculas.
const alfa = typeText(field(), '12abc34501de35');
assert.deepEqual(view(alfa), { value: '12.ABC.345/01DE-35', caret: 18 }, 'CNPJ alfanumérico digitado vira maiúsculas com a máscara');
assert.equal(normalizeDocument(alfa.value), '12ABC34501DE35', 'e grava o CNPJ alfanumérico');
// Limite de 14: a 15ª tecla é ignorada e o cursor fica onde estava.
const cheio = typeText(field(), '12345678000190');
assert.deepEqual(view(typeText(cheio, '7')), { value: '12.345.678/0001-90', caret: 18 }, 'NEGATIVO: não deixa digitar além de 14');
assert.deepEqual(view(typeText(at(cheio, 3), '7')), { value: '12.345.678/0001-90', caret: 3 }, 'NEGATIVO: nem no meio (cursor não pula)');
// Letra nos 2 dígitos verificadores é recusada.
assert.deepEqual(view(typeText(typeText(field(), '123456789012'), 'A')), { value: '12.345.678/9012', caret: 15 }, 'NEGATIVO: letra na 13ª posição recusada');
assert.deepEqual(view(typeText(field(), '12ABC34501DE3X')), { value: '12.ABC.345/01DE-3', caret: 17 }, 'NEGATIVO: letra na 14ª posição recusada');
// Inserir no início empurraria uma letra para os dígitos verificadores: recusado.
const letraNo11 = typeText(field(), '12ABC34501D');
const empurrou = typeText(typeText(at(letraNo11, 0), '9'), '9');
assert.equal(empurrou.value, '91.2AB.C34/501D', 'NEGATIVO: a segunda inserção levaria o D para a 13ª posição e é recusada');
// Caractere que não vale (espaço, símbolo) não entra e não mexe no cursor.
assert.deepEqual(view(typeText(at(field('123.456'), 3), ' ')), { value: '123.456', caret: 3 }, 'NEGATIVO: espaço ignorado');
assert.deepEqual(view(typeText(field('123.456'), '#')), { value: '123.456', caret: 7 }, 'NEGATIVO: símbolo ignorado');
ok('digitacao-progressiva');

// ---------------------------------------------------------------------------
// Rótulo digitado ("CPF ", "CNPJ:"): espaço/dois-pontos logo depois de só letras tira as letras, e digitar
// tecla a tecla grava o mesmo que o texto inteiro gravava antes (paridade de persistência da digitação).
// ---------------------------------------------------------------------------
const DIGITADOS = [
  ['123.456.789-01', '123.456.789-01'],
  ['12345678901', '123.456.789-01'],
  ['12.345.678/0001-90', '12.345.678/0001-90'],
  ['12345678000190', '12.345.678/0001-90'],
  ['12.ABC.345/01DE-35', '12.ABC.345/01DE-35'],
  ['12abc34501de35', '12.ABC.345/01DE-35'],
  ['CPF 699.577.406-01', '699.577.406-01'],
  ['CPF: 699.577.406-01', '699.577.406-01'],
  ['cpf 699.577.406-01', '699.577.406-01'],
  ['CPF 123.456.789-01', '123.456.789-01'],
  ['CNPJ: 12.345.678/0001-90', '12.345.678/0001-90'],
  // Revisão final E1C: rótulo com hífen digitado ("CNPJ-…", "CPF-…") = o mesmo que colar.
  ['CNPJ-12.345.678/0001-90', '12.345.678/0001-90'],
  ['CPF-699.577.406-01', '699.577.406-01'],
  ['cnpj-12abc34501de35', '12.ABC.345/01DE-35'],
  ['12.ABC.345/01DE-36', '12.ABC.345/01DE-36'],
  ['12ABC34501DE3', '12.ABC.345/01DE-3'],
  [' 12.345.678/0001-90 ', '12.345.678/0001-90'],
  ['12 345 678 0001 90', '12.345.678/0001-90'],
  ['(65) 99999-0000', '659.999.900-00'],
  ['123.4', '123.4'],
];
// Com rótulo e CNPJ alfanumérico, a máscara grava o CNPJ (melhor que antes, quando o texto cru virava só
// dígitos) — a paridade de persistência vale contra o texto SEM o rótulo.
const semRotulo = (texto) => texto.replace(/^\s*(?:CPF|CNPJ)\s*[:\s-]\s*/i, '');
for (const [texto, esperado] of DIGITADOS) {
  const digitado = typeText(field(), texto);
  assert.deepEqual(view(digitado), { value: esperado, caret: esperado.length }, `digitar ${JSON.stringify(texto)}`);
  assert.equal(digitado.value, maskDocument(texto), `digitar dá o mesmo que colar: ${JSON.stringify(texto)}`);
  assert.equal(normalizeDocument(digitado.value), normalizeDocument(semRotulo(texto)), `paridade de persistência digitando: ${JSON.stringify(texto)}`);
}
assert.deepEqual(view(typeText(field(), 'ABCD-')), { value: 'AB.CD', caret: 5 }, 'NEGATIVO: hífen depois de outras letras (não CPF/CNPJ) é só ignorado');
assert.equal(normalizeDocument(typeText(field(), 'CPF 699.577.406-01').value), '69957740601', 'digitado com rótulo e espaço continua CPF');
assert.equal(normalizeDocument(typeText(field(), 'sem dígitos').value), null, 'texto sem número digitado: nada a gravar (como antes)');
// Negativos: a regra só vale para espaço/dois-pontos depois de SÓ letras, com o cursor no fim delas.
assert.deepEqual(view(typeText(field(), '12AB ')), { value: '12.AB', caret: 5 }, 'NEGATIVO: espaço depois de números e letras é só ignorado');
assert.deepEqual(view(typeText(at(typeText(field(), 'ABC'), 2), ' ')), { value: 'AB.C', caret: 2 }, 'NEGATIVO: espaço no meio das letras é só ignorado');
assert.deepEqual(view(typeText(field(), 'CPF.')), { value: 'CP.F', caret: 4 }, 'NEGATIVO: separador da máscara depois de letras não é rótulo');
assert.deepEqual(view(typeText(field(), ' ')), { value: '', caret: 0 }, 'NEGATIVO: espaço no campo vazio não muda nada');
// Rótulo digitado e o número colado de uma vez (ou tudo colado em partes): mesmo CPF/CNPJ.
assert.deepEqual(view(paste(typeText(field(), 'CPF'), ' 699.577.406-01')), { value: '699.577.406-01', caret: 14 }, '"CPF" digitado + " 699.577.406-01" colado');
assert.deepEqual(view(paste(paste(field(), 'CNPJ'), ': 12.345.678/0001-90')), { value: '12.345.678/0001-90', caret: 18 }, '"CNPJ" + ": 12.345.678/0001-90" colados');
assert.deepEqual(view(paste(typeText(field(), 'AB'), 'C34501DE35 ')), { value: 'AB.C34.501/DE35', caret: 15 }, 'letras + trecho alfanumérico com espaço no fim: lido inteiro (como colar "ABC34501DE35 ")');
assert.equal(maskDocument('ABC34501DE35 '), 'AB.C34.501/DE35', 'e é o mesmo que colar o texto inteiro');
assert.deepEqual(view(paste(typeText(field(), '12AB'), ' 345')), { value: '12.AB3.45', caret: 9 }, 'NEGATIVO: com número antes, espaço no trecho colado não tira as letras');
// Controle / limite conhecido: rótulo COLADO nos números ("CPF699...") não se distingue de um CNPJ
// alfanumérico enquanto se digita — a ficha mostra as letras na máscara de CNPJ, e a pessoa vê na hora.
const colado = typeText(field(), 'CPF699.577.406-01');
assert.equal(colado.value, 'CP.F69.957/7406-01', 'controle: sem espaço/dois-pontos, as letras ficam (e aparecem como CNPJ)');
assert.equal(normalizeDocument(colado.value), 'CPF69957740601', 'controle: é o CNPJ alfanumérico que a ficha mostra');
ok('rotulo-digitado');

// ---------------------------------------------------------------------------
// Colar: formatado, cru, alfanumérico, com rótulo, sobre seleção e no meio (cortando no limite).
// ---------------------------------------------------------------------------
assert.deepEqual(view(paste(field(), '123.456.789-01')), { value: '123.456.789-01', caret: 14 }, 'colar CPF formatado');
assert.deepEqual(view(paste(field(), '12345678901')), { value: '123.456.789-01', caret: 14 }, 'colar CPF cru');
assert.deepEqual(view(paste(field(), '12.ABC.345/01DE-35')), { value: '12.ABC.345/01DE-35', caret: 18 }, 'colar CNPJ alfanumérico formatado');
assert.deepEqual(view(paste(field(), '12abc34501de35')), { value: '12.ABC.345/01DE-35', caret: 18 }, 'colar CNPJ alfanumérico cru em minúsculas');
assert.deepEqual(view(paste(field(), 'CNPJ: 12.345.678/0001-90')), { value: '12.345.678/0001-90', caret: 18 }, 'colar com rótulo "CNPJ:"');
assert.deepEqual(view(paste(select(field('123.456.789-01'), 0, 14), '12abc34501de35')), { value: '12.ABC.345/01DE-35', caret: 18 }, 'colar sobre o texto todo selecionado');
assert.deepEqual(view(paste(field('123.456.789-01'), '999')), { value: '12.345.678/9019-99', caret: 18 }, 'colar no fim completa até 14');
assert.deepEqual(view(paste(field('123.456.789-01'), '9999')), { value: '12.345.678/9019-99', caret: 18 }, 'NEGATIVO: colar além do limite corta em 14');
assert.deepEqual(view(paste(field('12'), 'CPF 3')), { value: '123', caret: 3 }, 'colar trecho com rótulo no meio: só os dígitos');
assert.deepEqual(view(paste(at(field('123.456.789'), 3), '00')), { value: '123.004.567-89', caret: 6 }, 'colar no meio: cursor logo depois do colado');
// Colar sobre a seleção quando o colado começa igual ao selecionado: o início da seleção (beforeinput)
// faz o trecho colado ser lido inteiro.
const comLetras = typeText(field(), 'CPF699.577.406-01');
assert.deepEqual(view(paste(select(comLetras, 0, comLetras.value.length), 'CNPJ: 11.222.333/0001-81')), { value: '11.222.333/0001-81', caret: 18 }, 'colar "CNPJ: ..." sobre "CP.F69..." selecionado');
assert.deepEqual(view(paste(select(field('1'), 0, 1), '1 2abc')), { value: '12', caret: 2 }, 'colar "1 2abc" sobre "1" selecionado = colar no campo vazio');
assert.equal(maskDocument('1 2abc'), '12', 'texto com espaço: só os dígitos');
assert.equal(paste(select(field('1'), 0, 1), '1 2abc', { hint: false }).value, '12.ABC', 'controle: sem o início da seleção, o "1" em comum partiria o colado e as letras ficariam');
assert.deepEqual(view(paste(select(field('12.345.678/0001-90'), 0, 18), '12.345.678/0001-95')), { value: '12.345.678/0001-95', caret: 18 }, 'colar outro CNPJ sobre o selecionado');
assert.deepEqual(view(paste(select(field('12.345.678/0001-90'), 3, 10), '999.999')), { value: '12.999.999/0001-90', caret: 10 }, 'colar sobre parte selecionada');
// Início informado que não casa com a edição (Backspace começa um antes do cursor; valor desatualizado) é ignorado.
assert.deepEqual(applyDocumentInput({ previous: '123.456', value: '12.456', caret: 2, inputType: 'deleteContentBackward', start: 3 }), { value: '124.56', caret: 2 }, 'NEGATIVO: início depois do cursor (Backspace) cai no prefixo comum');
assert.deepEqual(applyDocumentInput({ previous: '123.456', value: '1239.456', caret: 4, inputType: 'insertText', start: 5 }), { value: '123.945.6', caret: 5 }, 'NEGATIVO: início fora da edição é ignorado');
ok('colar');

// ---------------------------------------------------------------------------
// Cursor editando no meio (não pula para o fim).
// ---------------------------------------------------------------------------
const cpf = field('123.456.789-01');
assert.deepEqual(view(typeText(at(cpf, 5), '0')), { value: '12.340.567/8901', caret: 6 }, 'inserir no meio: cursor depois do dígito inserido (virou CNPJ)');
assert.deepEqual(view(typeText(at(field('123.456'), 1), '9')), { value: '192.345.6', caret: 2 }, 'inserir no começo');
assert.deepEqual(view(backspace(at(cpf, 6))), { value: '123.467.890-1', caret: 5 }, 'Backspace no meio: cursor fica no lugar');
assert.deepEqual(view(deleteForward(at(cpf, 5))), { value: '123.467.890-1', caret: 5 }, 'Delete no meio');
assert.deepEqual(view(backspace(select(cpf, 2, 9))), { value: '128.901', caret: 2 }, 'apagar seleção que atravessa separadores');
assert.deepEqual(view(typeText(select(cpf, 4, 7), '9')), { value: '123.978.901', caret: 5 }, 'digitar sobre seleção');
// Controle: remascarar o texto inteiro e mandar o cursor para o fim erraria a posição.
assert.notEqual(typeText(at(cpf, 5), '0').start, '12.340.567/8901'.length, 'controle: cursor não vai para o fim');
assert.equal(caretAfterSignificant('123.456', 3), 3, 'depois do 3º caractere significativo (antes do separador)');
assert.equal(caretAfterSignificant('123.456', 4), 5, 'depois do 4º (pula o separador)');
assert.equal(caretAfterSignificant('123.456', 0), 0);
assert.equal(caretAfterSignificant('123.456', 99), 7, 'NEGATIVO: contagem além do texto fica no fim');
ok('cursor');

// ---------------------------------------------------------------------------
// Backspace/Delete sobre separador apaga o caractere significativo vizinho (não trava).
// ---------------------------------------------------------------------------
assert.deepEqual(view(backspace(at(cpf, 4))), { value: '124.567.890-1', caret: 2 }, 'Backspace depois do ponto apaga o 3');
assert.deepEqual(view(backspace(at(cpf, 12))), { value: '123.456.780-1', caret: 10 }, 'Backspace depois do hífen apaga o 9');
assert.deepEqual(view(backspace(at(field('12.345.678/0001-90'), 11))), { value: '12.345.670/0019-0', caret: 9 }, 'Backspace depois da barra apaga o 8');
assert.deepEqual(view(backspace(at(field('12.345.678/9012'), 11))), { value: '123.456.790-12', caret: 9 }, 'Backspace depois da barra com 12 dígitos: apaga o 8 e volta a CPF');
assert.deepEqual(view(deleteForward(at(cpf, 3))), { value: '123.567.890-1', caret: 3 }, 'Delete antes do ponto apaga o 4');
// Controle: sem a regra, remascarar o que o navegador deixou devolveria o separador (campo "travado").
assert.equal(maskDocument('123456.789-01'), cpf.value, 'controle: remascarar sem a regra traria o ponto de volta');
// Backspace seguido até esvaziar: nunca trava.
let esvaziando = field('12.ABC.345/01DE-35');
for (let i = 0; i < 40 && esvaziando.value; i += 1) esvaziando = backspace(esvaziando);
assert.equal(esvaziando.value, '', 'Backspace repetido esvazia o campo');
// Recortar só o separador (não é Backspace/Delete): não apaga dígito.
assert.equal(commit(cpf, '123456.789-01', 3, 'deleteByCut').value, cpf.value, 'NEGATIVO: recortar só o ponto não apaga dígito');
ok('backspace-separador');

// ---------------------------------------------------------------------------
// Valor que não veio de uma edição sobre o texto mascarado (anterior fora da máscara): remascara tudo.
// ---------------------------------------------------------------------------
assert.deepEqual(applyDocumentInput({ previous: '123456789012345', value: '1234567890123456', caret: 16 }), { value: '12.345.678/9012-34', caret: 18 }, 'documento antigo fora do padrão: ao editar, a máscara corta em 14');
assert.deepEqual(applyDocumentInput({ previous: '', value: '12345678901' }), { value: '123.456.789-01', caret: 14 }, 'sem cursor informado: fim');
assert.deepEqual(applyDocumentInput({ previous: '123.456.789-01', value: '123.456.789-01', caret: 4 }), { value: '123.456.789-01', caret: 4 }, 'sem mudança: nada muda');
ok('remascara');

// ---------------------------------------------------------------------------
// Ficha: o campo documento das DUAS fichas usa a máscara; valor guardado aparece formatado; a ida e
// volta formulário → serviço grava o mesmo.
// ---------------------------------------------------------------------------
const camposDocumento = REGISTRY_DEFINITIONS.flatMap((def) => def.campos.filter(isDocumentField).map((campo) => `${def.store}.${campo.id}`));
assert.deepEqual(camposDocumento.sort(), ['parceiros.documento', 'propriedades.documento'], 'máscara nas fichas de Parceiros e Propriedades (mesmo campo)');
assert.ok(!PROPRIEDADES.campos.filter((campo) => ['telefone', 'inscricao_estadual', 'codigo_oficial'].includes(campo.id)).some(isDocumentField), 'NEGATIVO: telefone, IE e código oficial não ganham máscara');
assert.equal(formFromRecord(PARCEIROS, { nome: 'X', documento: '12345678000190' }).documento, '12.345.678/0001-90', 'parceiro aberto: CNPJ formatado');
assert.equal(formFromRecord(PARCEIROS, { nome: 'X', documento: '12345678901' }).documento, '123.456.789-01', 'parceiro aberto: CPF formatado');
assert.equal(formFromRecord(PROPRIEDADES, { nome: 'X', documento: '12ABC34501DE35' }).documento, '12.ABC.345/01DE-35', 'propriedade aberta: CNPJ alfanumérico formatado');
assert.equal(formFromRecord(PARCEIROS, { nome: 'X', documento: null }).documento, '', 'sem documento: campo vazio');
assert.equal(emptyFor(PARCEIROS).documento, '', 'ficha nova: campo vazio');
assert.equal(formFromRecord(PARCEIROS, { nome: 'X', telefone: '65999990000' }).telefone, '65999990000', 'NEGATIVO: outro campo de texto não é mascarado');
// Documento antigo fora do padrão (15 dígitos): aparece como está e salvar sem mexer grava o mesmo.
assert.equal(documentToForm('123456789012345'), '123456789012345', 'documento antigo de 15 dígitos aparece como está');
assert.notEqual(normalizeDocument(maskDocument('123456789012345')), '123456789012345', 'controle: mascarar cortaria o documento antigo');
for (const guardado of ['12345678901', '12345678000190', '12ABC34501DE35', '123', '123456789012345']) {
  assert.equal(normalizeDocument(documentToForm(guardado)), guardado, `abrir e salvar grava o mesmo: ${guardado}`);
}
for (const texto of ['123.456.789-01', '12abc34501de35', 'CPF 699.577.406-01']) {
  const form = { ...formFromRecord(PROPRIEDADES, { nome: 'Fazenda X', mostrar_documento_no_cabecalho: true }), documento: paste(field(), texto).value };
  assert.equal(payloadFromForm(PROPRIEDADES, form).documento, form.documento, 'o formulário manda o texto mascarado (o serviço normaliza)');
  assert.equal(coerceRecord(PROPRIEDADES, payloadFromForm(PROPRIEDADES, form)).documento, normalizeDocument(texto), `ficha grava o mesmo de antes: ${texto}`);
  assert.equal(headerPreviewFromForm(PROPRIEDADES, form).documentos, `${formatDocumento(texto).tipo} ${formatDocumento(texto).texto}`, `pré-visualização do cabeçalho: ${texto}`);
}
ok('ficha');

// ---------------------------------------------------------------------------
// Serviço real: gravado igual, unicidade de documento dos Parceiros intacta, reabrir e salvar não regrava.
// ---------------------------------------------------------------------------
await deleteDbForTests();
await ensureStorageReady();
const digitado = typeText(field(), '12.345.678/0001-90').value;
const frig = await partnerService.create(GESTOR, payloadFromForm(PARCEIROS, { ...emptyFor(PARCEIROS), nome: 'Frigorífico Máscara', papeis: ['FRIGORIFICO'], documento: digitado }));
assert.equal(frig.documento, '12345678000190', 'parceiro gravado só com dígitos');
await rejects(partnerService.create(GESTOR, payloadFromForm(PARCEIROS, { ...emptyFor(PARCEIROS), nome: 'Outro Frigorífico', papeis: ['COMPRADOR'], documento: paste(field(), '12345678000190').value })), 'REGISTRY_DUPLICATE', 'NEGATIVO: mesmo CNPJ colado cru continua duplicado');
await rejects(partnerService.create(GESTOR, { nome: 'Outro Frigorífico 2', papeis: ['COMPRADOR'], documento: '12345678000190' }), 'REGISTRY_DUPLICATE', 'NEGATIVO: pelo serviço direto também');
const reaberto = formFromRecord(PARCEIROS, await partnerService.get(frig.id));
assert.equal(reaberto.documento, '12.345.678/0001-90', 'reaberto formatado');
const semMudanca = await partnerService.update(GESTOR, frig.id, payloadFromForm(PARCEIROS, reaberto));
assert.equal(semMudanca.updated_at, frig.updated_at, 'reabrir e salvar sem mexer não regrava');
const antigo = await partnerService.create(GESTOR, { nome: 'Parceiro Antigo', papeis: ['COMPRADOR'], documento: '123456789012345' });
assert.equal(antigo.documento, '123456789012345', 'serviço guarda o documento antigo como sempre');
const antigoReaberto = formFromRecord(PARCEIROS, antigo);
assert.equal((await partnerService.update(GESTOR, antigo.id, payloadFromForm(PARCEIROS, antigoReaberto))).updated_at, antigo.updated_at, 'NEGATIVO: documento antigo não é cortado ao salvar sem mexer');
const fazenda = await propertyService.create(GESTOR, payloadFromForm(PROPRIEDADES, { ...emptyFor(PROPRIEDADES), nome: 'Fazenda Máscara', documento: typeText(field(), '12abc34501de35').value }));
assert.equal(fazenda.documento, '12ABC34501DE35', 'propriedade grava o CNPJ alfanumérico');
const cpfRotulo = await propertyService.create(GESTOR, payloadFromForm(PROPRIEDADES, { ...emptyFor(PROPRIEDADES), nome: 'Retiro Máscara', documento: paste(field(), 'CPF 699.577.406-01').value }));
assert.equal(cpfRotulo.documento, '69957740601', 'NEGATIVO: colado com rótulo continua CPF');
await deleteDbForTests();
ok('servico');

// ---------------------------------------------------------------------------
// Estrutura: a ficha usa a máscara no campo documento.
// ---------------------------------------------------------------------------
const page = read('src/components/cadastros/CadastroAuxiliarPage.jsx');
const input = read('src/components/cadastros/DocumentInput.jsx');
const model = read('src/components/cadastros/registryFormModel.js');
assert.match(page, /import DocumentInput from '\.\/DocumentInput\.jsx';/, 'página importa o campo com máscara');
assert.match(page, /\{isDocumentField\(campo\) \? \(\s*<DocumentInput id=\{`aux-\$\{campo\.id\}`\} value=\{value\} onChange=\{onChange\} disabled=\{disabled\} \/>/, 'campo documento renderiza DocumentInput com o mesmo id (mesmo estilo e rótulo)');
assert.match(page, /inputMode=\{isNumber \? 'decimal' : undefined\}/, 'NEGATIVO: os outros campos continuam o input comum');
assert.match(input, /applyDocumentInput\(\{ previous: current, value: input\.value, caret: input\.selectionEnd, inputType: event\.nativeEvent\?\.inputType, start \}\)/, 'onChange usa a função pura com cursor, tipo da edição e início da seleção');
assert.match(input, /input\.addEventListener\('beforeinput', remember\)/, 'início da seleção lido no beforeinput (antes de o navegador trocar o texto)');
assert.match(input, /const start = edit && edit\.value === current \? edit\.start : null;/, 'NEGATIVO: início de outra edição (valor diferente) não é usado');
assert.match(input, /input\.setSelectionRange\(next\.caret, next\.caret\)/, 'cursor reposicionado');
// Ordem do onChange: texto mascarado escrito no campo, cursor posto, e SÓ ENTÃO o formulário recebe o
// texto mascarado. Sem escrever antes, o React encontra o texto cru no campo e o reescreve — escrever o
// valor por código leva o cursor para o fim (medido no Chromium: cursor 2 → 9 em "1923456" → "192.345.6")
// e editar no meio voltaria a pular. Mandar o texto cru ao formulário faria a máscara sumir na
// renderização seguinte. As duas mutações deixavam este gate verde.
assert.match(input, /if \(input\.value !== next\.value\) input\.value = next\.value;\s*\n\s*if \(input\.ownerDocument\?\.activeElement === input\) input\.setSelectionRange\(next\.caret, next\.caret\);\s*\n\s*onChange\(next\.value\);/, 'texto mascarado e cursor escritos no campo antes de o formulário (React) receber o texto mascarado');
assert.match(input, /value=\{current\}\s*\n\s*onChange=\{handleChange\}/, 'campo controlado pelo formulário (abrir outro registro troca o texto)');
assert.ok(!/defaultValue/.test(input), 'NEGATIVO: campo não controlado não serve (o texto do formulário não chegaria ao campo)');
assert.match(input, /const edit = editRef\.current;\s*\n\s*editRef\.current = null;/, 'início da seleção vale para uma edição só');
assert.match(input, /autoComplete="off"/, 'sem sugestões do navegador por cima da máscara');
assert.match(input, /inputMode="text"/, 'inputMode texto (CNPJ alfanumérico tem letras)');
assert.match(input, /placeholder=\{focused \? DOCUMENT_PLACEHOLDER : ' '\}/, 'dica do formato com o campo em foco (rótulo flutuante sem sobreposição)');
assert.ok(!/maxLength/i.test(input), 'NEGATIVO: sem maxLength (colar "CNPJ: 12.345.678/0001-90" precisa chegar inteiro à máscara)');
assert.match(model, /return isDocumentField\(campo\) \? documentToForm\(value\) : String\(value\);/, 'valor guardado aparece formatado ao abrir a ficha');
assert.match(read('src/modules/catalog/domain/propertyHeader.js'), /formatDocumentMask/, 'folha e ficha usam a mesma posição dos separadores');
// Revisão final E1C: o Salvar da ficha recusa CNPJ alfanumérico inválido (antes da validação da definição).
assert.match(page, /const erros = \[\.\.\.formProblems\(definition, form\), \.\.\.definition\.validar\(payload\)\];/, 'Salvar da ficha checa o documento antes de gravar');
ok('estrutura');

// ---------------------------------------------------------------------------
// Documento com letras só é salvo se for CNPJ alfanumérico VÁLIDO (senão as letras sumiriam caladas).
// ---------------------------------------------------------------------------
for (const valido of ['', '123.456.789-01', '12.345.678/0001-90', '12.ABC.345/01DE-35', '123.4', '1234567890', null, undefined]) {
  assert.equal(documentProblem(valido), null, `sem problema: ${JSON.stringify(valido)}`);
}
for (const invalido of ['12.ABC.345/01DE-36', '12.ABC.345', '12.ABC.345/01DE-3', 'AB']) {
  assert.match(documentProblem(invalido) ?? '', /CNPJ alfanumérico está incompleto ou com os dígitos verificadores errados/, `NEGATIVO: ${invalido} recusado na ficha`);
  // Controle: sem a checagem, o serviço gravaria só os números (a regra antiga, que não muda).
  assert.ok(!/[A-Z]/.test(coerceRecord(PARCEIROS, { nome: 'X', documento: invalido }).documento ?? ''), `controle: ${invalido} viraria só números`);
}
const fichaInvalida = { ...emptyFor(PARCEIROS), nome: 'Frigorífico X', documento: maskDocument('12abc34501de36') };
assert.equal(formProblems(PARCEIROS, fichaInvalida).length, 1, 'ficha de Parceiro com CNPJ alfanumérico errado: 1 problema');
assert.equal(formProblems(PARCEIROS, { ...fichaInvalida, documento: maskDocument('12abc34501de35') }).length, 0, 'com o CNPJ certo, nenhum');
assert.equal(formProblems(PROPRIEDADES, { ...emptyFor(PROPRIEDADES), nome: 'Faz', documento: '12.ABC' }).length, 1, 'ficha de Propriedade também');
ok('documento-invalido-na-ficha');

// ---------------------------------------------------------------------------
// E1D — resposta 2 ao REPORT da E1C: na GRADE de Parceiros e de Propriedades o CPF/CNPJ aparece com a
// máscara; a pesquisa e o filtro da coluna aceitam o documento com ou sem pontuação. O valor guardado não muda.
// ---------------------------------------------------------------------------
const colunaDoc = (def) => def.colunas.find((coluna) => coluna.id === 'documento');
for (const def of [PARCEIROS, PROPRIEDADES]) {
  const coluna = colunaDoc(def);
  assert.ok(coluna && coluna.label === 'CPF/CNPJ', `${def.store}: coluna CPF/CNPJ na grade`);
  const campo = def.campos.find((item) => item.id === 'documento');
  const cell = (documento) => formatCellValue(coluna, { id: 'x', nome: 'X', documento }, { campo });
  assert.equal(cell('11222333000181'), '11.222.333/0001-81', `${def.store}: CNPJ mascarado na grade`);
  assert.equal(cell('12345678901'), '123.456.789-01', `${def.store}: CPF mascarado na grade`);
  assert.equal(cell('12ABC34501DE35'), '12.ABC.345/01DE-35', `${def.store}: CNPJ alfanumérico mascarado na grade`);
  assert.equal(cell('123456789012345'), '123456789012345', `NEGATIVO ${def.store}: documento antigo fora do padrão aparece como está`);
  assert.equal(cell(null), '', `${def.store}: sem documento, célula vazia`);
}
assert.ok(!PROPRIEDADES.colunas.some((coluna) => ['inscricao_estadual', 'telefone', 'logo'].includes(coluna.id)), 'NEGATIVO: só o CPF/CNPJ entra na grade de Propriedades (IE, telefone e logo não)');
assert.equal(colunaDoc(MARCAS), undefined, 'NEGATIVO: Marcas não ganha coluna de documento');
// Guardado continua sem pontuação (a máscara é só da tela).
assert.equal(coerceRecord(PARCEIROS, { nome: 'X', papeis: ['COMPRADOR'], documento: '11.222.333/0001-81' }).documento, '11222333000181', 'guardado sem pontuação (não muda)');
// Pesquisa geral: com ou sem pontuação, trecho também; termo sem dígito não casa pelo documento.
for (const termo of ['11.222.333/0001-81', '11222333000181', '222.333', '222333', '0001-81', '12.ABC.345/01DE-35', '12abc34501de35']) {
  const guardado = /abc/i.test(termo) ? '12ABC34501DE35' : '11222333000181';
  assert.ok(matchesDocumentSearch(guardado, termo), `pesquisa "${termo}" acha ${guardado}`);
}
assert.ok(!matchesDocumentSearch('11222333000181', '11.222.333/0001-82'), 'NEGATIVO: outro CNPJ não casa');
assert.ok(!matchesDocumentSearch('12ABC34501DE35', 'abc'), 'NEGATIVO: termo sem dígito (um nome) não casa pelo documento');
assert.ok(!matchesDocumentSearch(null, '123'), 'NEGATIVO: sem documento não casa');
assert.ok(!matchesDocumentSearch('11222333000181', '...'), 'NEGATIVO: só pontuação não casa');
// Filtro da coluna (pílula/menu): "contém", "igual a" e a lista de valores, com ou sem pontuação.
const celulaCnpj = '11.222.333/0001-81';
for (const valor of ['11.222.333/0001-81', '11222333000181']) {
  assert.ok(matchesDocumentColumnFilter(celulaCnpj, { operator: 'equals', value: valor }), `filtro "igual a" ${valor}`);
  assert.ok(matchesDocumentColumnFilter(celulaCnpj, { operator: 'contains', value: valor.slice(3, 10) }), `filtro "contém" trecho de ${valor}`);
}
assert.ok(matchesDocumentColumnFilter('12.ABC.345/01DE-35', { operator: 'equals', value: '12abc34501de35' }), 'filtro no CNPJ alfanumérico sem pontuação e em minúsculas');
assert.ok(matchesDocumentColumnFilter(celulaCnpj, { operator: 'in', values: ['11.222.333/0001-81'] }), 'lista de valores (o que a pílula oferece: o texto mascarado)');
assert.ok(matchesDocumentColumnFilter(celulaCnpj, { operator: 'in', values: ['11222333000181'] }), 'lista com o valor sem pontuação');
assert.ok(!matchesDocumentColumnFilter(celulaCnpj, { operator: 'equals', value: '11222333000182' }), 'NEGATIVO: outro CNPJ fica fora');
assert.ok(!matchesDocumentColumnFilter(celulaCnpj, { operator: 'not_contains', value: '222333' }), 'NEGATIVO: "não contém" também compara sem pontuação');
assert.ok(matchesDocumentColumnFilter('', { operator: 'empty' }) && !matchesDocumentColumnFilter(celulaCnpj, { operator: 'empty' }), '"vazio" continua valendo');
assert.ok(matchesDocumentColumnFilter(celulaCnpj, null), 'sem filtro, passa');
// Controle: o filtro comum de texto (sem a regra) não acharia o CNPJ digitado sem pontuação.
assert.ok(!matchesFilter(celulaCnpj, { operator: 'equals', value: '11222333000181' }, 'text'), 'controle: sem a regra, "igual a" sem pontuação não acharia');
// A grade usa as duas funções na coluna/campo de documento (e só nele).
assert.match(page, /if \(isDocumentField\(campo\)\) return matchesDocumentColumnFilter\(cellText\(column, record\), filter\);/, 'filtro da coluna CPF/CNPJ sem pontuação na grade');
assert.match(page, /definition\.campos\.filter\(isDocumentField\)\.some\(\(campo\) => matchesDocumentSearch\(record\[campo\.id\], term\)\)/, 'pesquisa da grade acha o documento com ou sem pontuação');
assert.match(read('src/modules/catalog/domain/registryDefinitions.js'), /export const renderDocumento = \(value\) => documentToForm\(value\);/, 'célula da grade = a mesma máscara da ficha (documentToForm → formatDocumentMask)');
ok('grade-documento-e1d');

console.log('OK verify-document-mask');
console.log(JSON.stringify(resumo, null, 2));
