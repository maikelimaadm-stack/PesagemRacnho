// Normalização dos cadastros mestres (docs 12 §1): trim → maiúsculas pt-BR →
// espaços internos únicos. A mesma regra vale para a importação e a migração.

export function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ');
}

// Documento (CPF/CNPJ) é guardado só com dígitos; vazio ou sem dígitos → null.
export function normalizeDocument(value) {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits || null;
}

// Texto livre exibido ao usuário: mantém a grafia digitada, mas sem espaços
// sobrando. Vazio → null.
export function cleanText(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text || null;
}
