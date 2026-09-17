// Conversão dos textos da planilha para valores de domínio, conforme as regras
// escolhidas no assistente (formato de data e separador decimal). Sem banco.
// Cada função devolve { value, error }: `error` é a mensagem pt-BR quando o texto
// existe mas não é válido; célula vazia → { value: null, error: null }.
import { normalizeText } from '../../reporting/domain/filterEngine.js';
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from '../../weighing/domain/brazilianValues.js';
import { EVENT_TYPES, EXIT_REASONS } from './importConstants.js';

const ok = (value) => ({ value, error: null });
const fail = (error) => ({ value: null, error });
const isBlank = (text) => text === undefined || text === null || String(text).trim() === '';

const ISO_ONLY = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/;
const BR_ONLY = /^\d{1,2}\/\d{1,2}\/\d{4}(?:\s.*)?$/;

/** Data civil ISO. Formatos: 'auto' (ISO ou dd/mm/aaaa), 'DD/MM/AAAA', 'AAAA-MM-DD'. Data futura é erro. */
export function parseImportDate(text, format = 'auto', { today = new Date() } = {}) {
  if (isBlank(text)) return ok(null);
  const raw = String(text).trim();
  if (format === 'DD/MM/AAAA' && !BR_ONLY.test(raw)) return fail(`Data "${raw}" fora do formato DD/MM/AAAA.`);
  if (format === 'AAAA-MM-DD' && !ISO_ONLY.test(raw)) return fail(`Data "${raw}" fora do formato AAAA-MM-DD.`);
  const iso = parseCivilDate(raw);
  if (!iso) return fail(`Data inválida: "${raw}".`);
  if (isFutureCivilDate(iso, today)) return fail(`A data ${iso} está no futuro.`);
  return ok(iso);
}

const COMMA_DECIMAL = /^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;
const DOT_DECIMAL = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

/** Número. 'auto' usa parseBrazilianNumber (1.234,56 · 206,5 · 206.5); 'virgula' e 'ponto' são estritos. */
export function parseImportDecimal(text, mode = 'auto') {
  if (isBlank(text)) return ok(null);
  const raw = String(text).trim().replace(/\s+/g, '');
  let value = null;
  if (mode === 'virgula') {
    if (COMMA_DECIMAL.test(raw)) value = Number(raw.replace(/\./g, '').replace(',', '.'));
  } else if (mode === 'ponto') {
    if (DOT_DECIMAL.test(raw)) value = Number(raw.replace(/,/g, ''));
  } else {
    value = parseBrazilianNumber(raw);
  }
  return Number.isFinite(value) ? ok(value) : fail(`Número inválido: "${String(text).trim()}".`);
}

// Chave comparável: sem acento, minúscula, sem espaços nas bordas.
const keyOf = (text) => normalizeText(text);

const SEXO = Object.freeze({ m: 'M', macho: 'M', f: 'F', femea: 'F' });

export function parseSexo(text) {
  if (isBlank(text)) return ok(null);
  const value = SEXO[keyOf(text)];
  return value ? ok(value) : fail(`Sexo inválido: "${String(text).trim()}". Use M/Macho ou F/Fêmea.`);
}

const TIPOS = Object.freeze({
  cadastro: EVENT_TYPES.CADASTRO,
  entrada: EVENT_TYPES.CADASTRO,
  manejo: EVENT_TYPES.MANEJO,
  pesagem: EVENT_TYPES.MANEJO,
  saida: EVENT_TYPES.SAIDA,
});

export function parseTipo(text) {
  if (isBlank(text)) return ok(null);
  const value = TIPOS[keyOf(text)];
  return value ? ok(value) : fail(`Tipo desconhecido: "${String(text).trim()}". Use Cadastro, Manejo ou Saída.`);
}

const MOTIVOS = new Map(EXIT_REASONS.map((motivo) => [keyOf(motivo), motivo]));
MOTIVOS.set('outro', 'Outros');

export function parseMotivoSaida(text) {
  if (isBlank(text)) return ok(null);
  const value = MOTIVOS.get(keyOf(text));
  return value ? ok(value) : fail(`Motivo da saída inválido: "${String(text).trim()}". Use ${EXIT_REASONS.join(', ')}.`);
}

/** Texto livre limpo (espaços únicos) ou null. */
export function cleanImportText(text) {
  if (isBlank(text)) return null;
  return String(text).trim().replace(/\s+/g, ' ');
}

/** Peso comparável com 2 casas ('' quando ausente) — base do fingerprint e das colisões. */
export function weightKey(peso) {
  const value = Number(peso);
  return peso === null || peso === undefined || peso === '' || !Number.isFinite(value) ? '' : value.toFixed(2);
}
