// Máscara do CPF/CNPJ ao digitar na ficha (PROMPT-01C item 8, 1.4.0). Funções puras (testáveis em Node;
// gate scripts/verify-document-mask.mjs): a ficha mostra 000.000.000-00 (até 11 dígitos) ou
// 00.000.000/0000-00 (12 a 14 posições, ou com letra — CNPJ alfanumérico), no máximo 14 posições.
// O que é GRAVADO não muda: a ficha manda o texto mascarado e o serviço guarda normalizeDocument(texto)
// (só dígitos, ou o CNPJ alfanumérico válido em maiúsculas). Validade do CNPJ alfanumérico e a forma de
// CNPJ vêm de normalize.js — aqui só a posição dos separadores e o cursor.
import { isAlphanumericCnpj, normalizeDocument } from './normalize.js';

export const DOCUMENT_MAX_LENGTH = 14;
export const DOCUMENT_PLACEHOLDER = '000.000.000-00 ou 00.000.000/0000-00';
const CPF_LENGTH = 11;
// Separador que entra ANTES do caractere significativo de índice N.
const CPF_SEPARATORS = Object.freeze({ 3: '.', 6: '.', 9: '-' });
const CNPJ_SEPARATORS = Object.freeze({ 2: '.', 5: '.', 8: '/', 12: '-' });
// CNPJ (numérico ou alfanumérico) em andamento: letras só nas 12 primeiras posições, as 2 últimas
// (dígitos verificadores) só números, no máximo 14. Prefixo da forma que isAlphanumericCnpj confere.
const DOCUMENT_IN_PROGRESS = /^[0-9A-Z]{0,12}\d{0,2}$/;
const hasLetter = (text) => /[A-Z]/.test(text);
// Caracteres significativos de um texto JÁ mascarado (só letras maiúsculas, números e separadores).
const stripMask = (text) => text.replace(/[^0-9A-Z]/g, '');
// Rótulo "CPF"/"CNPJ" seguido de espaço, dois-pontos ou hífen no começo de um texto colado/digitado.
const LEADING_LABEL = /^\s*(?:CPF|CNPJ)\s*[:\s-]\s*/i;

/**
 * Caracteres significativos de um texto digitado ou colado ("123.456.789-01", "12abc34501de35",
 * "CPF 699.577.406-01"...), no máximo 14. Letras só ficam num CNPJ alfanumérico: o válido com a forma
 * de CNPJ (como normalizeDocument grava) ou o ainda incompleto, escrito só com letras/números e a
 * pontuação da máscara. Qualquer outra coisa (rótulo "CPF ", espaço, dois-pontos, mais de 14 posições)
 * fica só com os dígitos — igual ao que se gravava antes.
 */
export function documentSignificant(text) {
  const raw = String(text ?? '');
  // Rótulo no começo ("CNPJ 12.ABC.345/01DE-35", "cpf: 123..."): lê só o documento depois dele — senão o
  // CNPJ alfanumérico colado com rótulo perderia as letras e viraria um número que não existe.
  // Só o rótulo ("CPF ") → vazio, como ao digitar.
  const labeled = LEADING_LABEL.exec(raw);
  if (labeled) return documentSignificant(raw.slice(labeled[0].length));
  const stored = normalizeDocument(raw);
  if (stored && hasLetter(stored)) return stored;
  const compact = raw.trim().toLocaleUpperCase('pt-BR').replace(/[./-]+/g, '');
  // Completo e válido mas FORA da forma de CNPJ ("CPF699.577.406-01") não vira CNPJ: normalizeDocument
  // gravaria só os dígitos, e a ficha mostra o que vai ser gravado.
  const letters = hasLetter(compact) && DOCUMENT_IN_PROGRESS.test(compact) && !isAlphanumericCnpj(compact);
  if (letters) return compact;
  return raw.replace(/\D+/g, '').slice(0, DOCUMENT_MAX_LENGTH);
}

/**
 * Problema do documento na ficha, antes de salvar (E1C, revisão final): com letras (CNPJ alfanumérico) o
 * texto só pode ser salvo se for um CNPJ alfanumérico VÁLIDO — senão o serviço guardaria só os números
 * (regra antiga, que continua valendo para importação e dados antigos) e as letras sumiriam caladas.
 * Sem letras (CPF/CNPJ numérico), nada muda. Devolve a mensagem ou null.
 */
export function documentProblem(text) {
  const shown = String(text ?? '').trim().toLocaleUpperCase('pt-BR');
  if (!/[A-Z]/.test(shown)) return null;
  const stored = normalizeDocument(shown);
  if (stored && /[A-Z]/.test(stored)) return null;
  return 'CPF/CNPJ: o CNPJ alfanumérico está incompleto ou com os dígitos verificadores errados. Confira as 14 posições (ex.: 12.ABC.345/01DE-35).';
}

/** Máscara progressiva dos caracteres significativos: CPF até 11 dígitos; CNPJ com 12+ ou com letra. */
export function formatDocumentMask(significant) {
  const text = String(significant ?? '');
  const separators = text.length > CPF_LENGTH || hasLetter(text) ? CNPJ_SEPARATORS : CPF_SEPARATORS;
  return [...text].map((char, index) => `${separators[index] ?? ''}${char}`).join('');
}

/** Texto digitado/colado → texto mascarado da ficha. */
export function maskDocument(text) {
  return formatDocumentMask(documentSignificant(text));
}

/**
 * Valor guardado → texto da ficha. Mascara só quando a máscara grava de volta exatamente o mesmo valor:
 * um documento antigo fora do padrão (ex.: 15 dígitos) aparece como está, e abrir e salvar a ficha nunca
 * altera o documento sem a pessoa mexer nele.
 */
export function documentToForm(value) {
  if (value === null || value === undefined || value === '') return '';
  const masked = maskDocument(value);
  return normalizeDocument(masked) === normalizeDocument(value) ? masked : String(value);
}

/** Posição no texto mascarado logo depois do N-ésimo caractere significativo (0 → início). */
export function caretAfterSignificant(masked, count) {
  const text = String(masked ?? '');
  if (!(count > 0)) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/[0-9A-Z]/.test(text[index])) {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return text.length;
}

// Remascara o texto inteiro (valor que não veio de uma edição sobre o texto mascarado): o cursor fica
// depois do mesmo número de caracteres significativos que havia antes dele.
function remaskWhole(text, caret) {
  const significant = documentSignificant(text);
  const masked = formatDocumentMask(significant);
  const counts = hasLetter(significant) ? /[0-9A-Za-z]/ : /\d/;
  const before = [...text.slice(0, caret)].filter((char) => counts.test(char)).length;
  return { value: masked, caret: caretAfterSignificant(masked, Math.min(before, significant.length)) };
}

const isBackward = (inputType) => !inputType || (/^delete/.test(inputType) && /Backward$/.test(inputType));
const isForward = (inputType) => /^delete/.test(inputType ?? '') && /Forward$/.test(inputType ?? '');
// Fim de rótulo ("CPF ", "CNPJ:"): espaço ou dois-pontos. CNPJ alfanumérico não tem nenhum dos dois.
const LABEL_END = /[\s:]/;
const ONLY_LETTERS = /^[A-Z]+$/;
const LABEL_WORD = /^(?:CPF|CNPJ)$/;

/**
 * Uma edição no campo (tecla, colar, apagar): `previous` é o texto mascarado antes, `value`/`caret` o que o
 * campo ficou depois (caret = selectionEnd), `inputType` o do evento nativo e `start` (opcional) onde a
 * seleção começava antes da edição. Devolve { value, caret }.
 * O trecho trocado é o que fica antes do cursor (o que vem depois dele não mudou); começa em `start` ou,
 * sem ele, no fim do prefixo comum — colar sobre uma seleção que começa igual ao colado seria lido pela
 * metade, por isso o campo informa `start`. Backspace/Delete que só apagou um separador apaga o caractere
 * significativo vizinho (senão o separador voltaria e o campo "travaria"). Além de 14 posições a
 * digitação é ignorada (colar corta no limite); letra que cairia nos 2 dígitos verificadores recusa a
 * edição. Em ambos o campo fica como estava, com o cursor no lugar.
 * Rótulo ("CPF ", "CNPJ:"): com SÓ letras antes do cursor e nada depois, espaço ou dois-pontos mostra que
 * as letras não são CNPJ alfanumérico — o texto é lido inteiro, como colado no campo vazio: digitar ou
 * colar "CPF 699.577.406-01" dá o mesmo CPF que se gravava antes, e só o rótulo esvazia o campo.
 */
export function applyDocumentInput({ previous = '', value = '', caret = null, inputType = '', start: editStart = null } = {}) {
  const prev = String(previous ?? '');
  const next = String(value ?? '');
  const end = Number.isInteger(caret) ? Math.min(Math.max(caret, 0), next.length) : next.length;
  if (next === prev && prev === maskDocument(prev)) return { value: prev, caret: end };
  const prevSuffixStart = prev.length - (next.length - end);
  if (prev !== maskDocument(prev) || prevSuffixStart < 0 || prev.slice(prevSuffixStart) !== next.slice(end)) {
    return remaskWhole(next, end);
  }
  const limit = Math.min(end, prevSuffixStart);
  let start = 0;
  // Início informado só vale se casar com a edição (Backspace começa um antes do cursor: cai no prefixo).
  if (Number.isInteger(editStart) && editStart >= 0 && editStart <= limit && prev.slice(0, editStart) === next.slice(0, editStart)) start = editStart;
  else while (start < limit && prev[start] === next[start]) start += 1;
  const removed = prev.slice(start, prevSuffixStart);
  const inserted = next.slice(start, end);
  let before = stripMask(prev.slice(0, start));
  let after = stripMask(prev.slice(prevSuffixStart));
  const removedSignificant = stripMask(removed);
  if (!inserted && removed && !removedSignificant) {
    if (isForward(inputType)) after = after.slice(1);
    else if (isBackward(inputType)) before = before.slice(0, -1);
  }
  // Hífen também fecha o rótulo, mas só logo depois de exatamente "CPF"/"CNPJ" ("CNPJ-12…"): num CNPJ
  // alfanumérico o hífen só vem depois de 12 posições, então não há como confundir.
  const labelEnd = LABEL_END.test(inserted) || (inserted.startsWith('-') && LABEL_WORD.test(before));
  if (inserted && labelEnd && ONLY_LETTERS.test(before) && !after) {
    const labeled = documentSignificant(inserted) ? documentSignificant(`${before}${inserted}`) : '';
    const masked = formatDocumentMask(labeled);
    return { value: masked, caret: masked.length };
  }
  const room = Math.max(0, DOCUMENT_MAX_LENGTH - before.length - after.length);
  const insertedSignificant = inserted ? documentSignificant(inserted).slice(0, room) : '';
  // Nada entrou nem saiu (tecla além do limite, caractere que não vale): o campo fica como estava.
  const unchanged = { value: prev, caret: prevSuffixStart };
  if (inserted && !insertedSignificant && !removedSignificant) return unchanged;
  const significant = `${before}${insertedSignificant}${after}`;
  if (!DOCUMENT_IN_PROGRESS.test(significant)) return unchanged;
  const masked = formatDocumentMask(significant);
  return { value: masked, caret: caretAfterSignificant(masked, before.length + insertedSignificant.length) };
}
