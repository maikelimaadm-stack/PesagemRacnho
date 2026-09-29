// Cabeçalho dos relatórios a partir do cadastro da Propriedade (E1B 1.4.0). Funções puras (testáveis em
// Node): validação do logo (data URL PNG/JPEG, ≤ 300 KB), cálculo do redimensionamento (≤ 400 px de
// largura), CPF/CNPJ formatado e o modelo do cabeçalho que a folha (tela, impressão e PDF) desenha.
// Qual propriedade vai no cabeçalho: a do filtro do relatório (quando houver exatamente uma), senão a
// marcada como Padrão; sem nenhuma, só o nome do sistema — nunca quebra a impressão.
import { cleanText, isAlphanumericCnpj, normalizeDocument, normalizeName } from './normalize.js';
import { formatDocumentMask } from './documentMask.js';

export const LOGO_MAX_WIDTH_PX = 400;
export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg']);
export const SYSTEM_NAME = 'Pesagens Individuais';

const LOGO_PATTERN = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
// Assinatura do arquivo no início do base64: PNG = 89 50 4E 47 0D 0A 1A 0A; JPEG = FF D8 FF.
const SIGNATURE = Object.freeze({ png: 'iVBORw0KGgo', jpeg: '/9j/' });

/**
 * Bytes que o data URL representa (tamanho do arquivo de imagem, não do texto base64). null quando não é
 * PNG/JPEG em base64 bem formado (comprimento múltiplo de 4) com a assinatura do tipo declarado — um
 * backup adulterado não desenha imagem quebrada na folha.
 */
export function dataUrlBytes(dataUrl) {
  const match = LOGO_PATTERN.exec(String(dataUrl ?? ''));
  if (!match) return null;
  const [, type, base64] = match;
  if (base64.length % 4 !== 0 || !base64.startsWith(SIGNATURE[type])) return null;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Logo aceito: data URL PNG/JPEG em base64, até 300 KB. Qualquer outra coisa (svg, http:, file:) é recusada. */
export function isAcceptedLogo(dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  return bytes !== null && bytes > 0 && bytes <= LOGO_MAX_BYTES;
}

/** Motivo da recusa em linguagem simples (ou null se o logo é aceito). */
export function logoProblem(dataUrl) {
  if (dataUrl === null || dataUrl === undefined || dataUrl === '') return null;
  const bytes = dataUrlBytes(dataUrl);
  // Mesma régua do isAcceptedLogo: data URL "vazio" (0 byte) também não é imagem.
  if (bytes === null || bytes <= 0) return 'O logo precisa ser uma imagem PNG ou JPG.';
  if (bytes > LOGO_MAX_BYTES) return `O logo ficou com ${Math.ceil(bytes / 1024)} KB depois de ajustado; o limite é ${LOGO_MAX_BYTES / 1024} KB.`;
  return null;
}

/** Tamanho final mantendo a proporção: largura no máximo `maxWidth` (nunca amplia). */
export function fitWithin(width, height, maxWidth = LOGO_MAX_WIDTH_PX) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  if (w <= maxWidth) return { width: w, height: h };
  return { width: maxWidth, height: Math.max(1, Math.round((h * maxWidth) / w)) };
}

/**
 * 11 dígitos → CPF 000.000.000-00; 14 posições (numérico ou alfanumérico válido) → CNPJ
 * 00.000.000/0000-00; outro tamanho → como está. A posição dos separadores é a mesma da máscara da
 * ficha (formatDocumentMask): a ficha mostra o documento como a folha imprime.
 */
export function formatDocumento(value) {
  const normalized = normalizeDocument(value) ?? '';
  if (isAlphanumericCnpj(normalized)) return { tipo: 'CNPJ', texto: formatDocumentMask(normalized) };
  const digits = normalized.replace(/\D+/g, '');
  if (digits.length === 11) return { tipo: 'CPF', texto: formatDocumentMask(digits) };
  if (digits.length === 14) return { tipo: 'CNPJ', texto: formatDocumentMask(digits) };
  return digits ? { tipo: 'CPF/CNPJ', texto: digits } : null;
}

/** "Município-UF" (qualquer parte pode faltar). */
function localidade(propriedade) {
  const municipio = cleanText(propriedade.municipio);
  const uf = cleanText(propriedade.uf);
  if (municipio && uf) return `${municipio}-${uf}`;
  return municipio || uf || null;
}

/**
 * Modelo do cabeçalho (o que a folha desenha). Sem propriedade → só o nome do sistema.
 * @returns {{ empty: boolean, propriedadeId: string|null, logo: string|null, titular: string,
 *   fazenda: string|null, endereco: string|null, documentos: string|null, telefone: string|null }}
 */
export function buildPropertyHeader(propriedade) {
  if (!propriedade) {
    return { empty: true, propriedadeId: null, logo: null, titular: SYSTEM_NAME, fazenda: null, endereco: null, documentos: null, telefone: null };
  }
  const nome = cleanText(propriedade.nome);
  const titularNome = cleanText(propriedade.titular_nome);
  const titular = titularNome || nome || SYSTEM_NAME;
  const fazenda = titularNome && nome && normalizeName(nome) !== normalizeName(titularNome) ? nome : null;
  const endereco = [cleanText(propriedade.endereco), localidade(propriedade)].filter(Boolean).join(', ') || null;
  // E1D item 8: CPF/CNPJ, IE e telefone só com "Mostrar no cabeçalho" ligado (nasce desligado); o
  // cabeçalho padrão é o do MAKGESTAO: logo, produtor, fazenda e endereço, município-UF.
  const mostrar = propriedade.mostrar_documento_no_cabecalho === true;
  let documentos = null;
  if (mostrar) {
    const documento = formatDocumento(propriedade.documento);
    const inscricao = cleanText(propriedade.inscricao_estadual);
    documentos = [documento ? `${documento.tipo} ${documento.texto}` : null, inscricao ? `IE ${inscricao}` : null].filter(Boolean).join(' · ') || null;
  }
  const telefone = mostrar ? cleanText(propriedade.telefone) : null;
  return {
    empty: false,
    propriedadeId: propriedade.id ?? null,
    logo: isAcceptedLogo(propriedade.logo) ? propriedade.logo : null,
    titular,
    fazenda,
    endereco,
    documentos,
    telefone: telefone ? `Tel. ${telefone}` : null,
  };
}

/**
 * Valores EXATOS de um filtro serializável: a lista marcada (o motor de filtros a compara valor a valor,
 * qualquer que seja o operador positivo) ou um texto em "igual a". Texto digitado em "contém", "começa
 * com" ou "termina com", negativos e vazios não escolhem propriedade: "Boa" em "contém" pode pegar outra
 * fazenda, e o cabeçalho não pode mostrar uma propriedade que não é a do relatório.
 */
function positiveValues(filter) {
  if (!filter || typeof filter !== 'object') return [];
  if (['not_in', 'not_equals', 'not_contains', 'empty', 'not_empty'].includes(filter.operator)) return [];
  if (Array.isArray(filter.values) && filter.values.length) return filter.values.filter((value) => value !== null && value !== undefined && value !== '').map(String);
  if ((filter.operator ?? 'equals') !== 'equals') return [];
  return filter.value === null || filter.value === undefined || filter.value === '' ? [] : [String(filter.value)];
}

// Nome comparado como no motor de filtros: sem acento, sem diferença de maiúsculas e de espaços.
const foldName = (value) => normalizeName(value).normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Propriedade do cabeçalho: filtro/condição/detalhe do relatório em UMA propriedade (coluna
 * `propriedade`, por id ou pelo nome quando o filtro é por rótulo) → essa; senão a ativa marcada como
 * Padrão; senão null.
 * @param propriedades lista do cadastro (pode incluir inativas)
 * @param {{ filters?: object, lockedFilters?: object, drill?: Array<{columnId, key, label}> }} context
 */
export function resolveHeaderProperty(propriedades = [], { filters = {}, lockedFilters = {}, drill = [] } = {}) {
  const rows = (propriedades || []).filter((row) => row && !row.deleted_at);
  // Por id; senão pelo nome — só se UMA propriedade tiver esse nome (duas homônimas → cai na Padrão).
  const byValue = (value) => {
    const byId = rows.find((row) => row.id === value);
    if (byId) return byId;
    const named = rows.filter((row) => foldName(row.nome) === foldName(value));
    return named.length === 1 ? named[0] : null;
  };
  const candidates = [
    ...(drill || []).filter((part) => part?.columnId === 'propriedade').map((part) => [String(part.key)]),
    positiveValues(lockedFilters?.propriedade),
    positiveValues(filters?.propriedade),
  ];
  for (const values of candidates) {
    if (values.length === 1) {
      const found = byValue(values[0]);
      if (found) return found;
    }
  }
  return rows.find((row) => row.ativo !== false && row.padrao === true) ?? null;
}
