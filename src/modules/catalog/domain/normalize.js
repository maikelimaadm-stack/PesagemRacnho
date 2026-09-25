// Normalização dos cadastros mestres (docs 12 §1): trim → maiúsculas pt-BR →
// espaços internos únicos. A mesma regra vale para a importação e a migração.

export function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ');
}

// CNPJ alfanumérico (Receita Federal, emitido desde julho de 2026: 12 posições com letras e números + 2
// dígitos verificadores). Valor de cada caractere = código ASCII − 48; mesmo cálculo módulo 11 do CNPJ.
function cnpjCheckDigit(base, weights) {
  const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isAlphanumericCnpj(value) {
  const text = String(value ?? '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(text) || !/[A-Z]/.test(text)) return false;
  const first = cnpjCheckDigit(text.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjCheckDigit(`${text.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return text.slice(12) === `${first}${second}`;
}

// Documento (CPF/CNPJ) é guardado só com dígitos; vazio ou sem dígitos → null. Exceção: CNPJ
// alfanumérico VÁLIDO (dígitos verificadores conferidos) é guardado com as letras, em maiúsculas —
// senão "12.ABC.345/01DE-35" viraria "123450135", um documento que não existe. Letra solta em outro
// texto ("CPF 123.456.789-01") continua sendo descartada: só vale como CNPJ alfanumérico o texto com a
// forma de CNPJ (14 posições, com ou sem os pontos, a barra e o hífen nos lugares certos) — senão
// "CPF 699.577.406-01" (CPF + 11 dígitos = 14 posições) podia passar pelos dígitos verificadores.
const CNPJ_SHAPE = /^[0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?\d{2}$/;
export function normalizeDocument(value) {
  const shaped = String(value ?? '').trim().toLocaleUpperCase('pt-BR');
  const compact = shaped.replace(/[./-]+/g, '');
  if (CNPJ_SHAPE.test(shaped) && isAlphanumericCnpj(compact)) return compact;
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits || null;
}

// Texto livre exibido ao usuário: mantém a grafia digitada, mas sem espaços
// sobrando. Vazio → null.
export function cleanText(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text || null;
}
