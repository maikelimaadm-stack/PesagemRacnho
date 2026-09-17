// Modelos de importação (mapeamento e regras reaproveitáveis) em appSettings, por empresa:
// chave `import-template:<empresa>`, valor versionado { version: 1, templates: [...] }.
// Um modelo NUNCA guarda dados do arquivo: só a lista fechada de chaves abaixo.
import storage from '../../../storage/storageAdapter.js';
import { CATEGORY_MODES, DATE_FORMATS, DECIMAL_FORMATS, DEFAULT_EMPRESA_ID, IMPORT_TYPES } from '../domain/importConstants.js';
import { listImportFields } from '../domain/importFields.js';
import { FIXED_VALUE_KEYS } from '../domain/importRules.js';

export const IMPORT_TEMPLATE_VERSION = 1;
export const IMPORT_TEMPLATE_KEY_PREFIX = 'import-template:';
const DELIMITERS = ['auto', ';', ',', '\t'];

export const importTemplateKey = (empresaId = DEFAULT_EMPRESA_ID) => `${IMPORT_TEMPLATE_KEY_PREFIX}${empresaId || DEFAULT_EMPRESA_ID}`;

function emptyStore() {
  return { version: IMPORT_TEMPLATE_VERSION, templates: [] };
}

export async function readTemplateStore(empresaId) {
  const value = await storage.settings.get(importTemplateKey(empresaId));
  if (!value || typeof value !== 'object' || value.version !== IMPORT_TEMPLATE_VERSION || !Array.isArray(value.templates)) return emptyStore();
  return { version: IMPORT_TEMPLATE_VERSION, templates: value.templates.filter((item) => item && typeof item === 'object' && item.id) };
}

export async function writeTemplateStore(empresaId, store) {
  await storage.settings.set(importTemplateKey(empresaId), { version: IMPORT_TEMPLATE_VERSION, templates: store.templates });
}

/** Modelo saneado (lista fechada de chaves) ou erro pt-BR. */
export function sanitizeImportTemplate(template = {}) {
  const nome = String(template.nome ?? '').trim().replace(/\s+/g, ' ');
  if (!nome) throw new Error('Informe o nome do modelo de importação.');
  const tipoImportacao = template.tipoImportacao;
  if (!Object.values(IMPORT_TYPES).includes(tipoImportacao)) throw new Error('Tipo de importação do modelo inválido.');
  const validFields = new Set(listImportFields(tipoImportacao).map((item) => item.id));
  const columnMapping = {};
  for (const [header, fieldId] of Object.entries(template.columnMapping || {})) {
    const key = String(header).slice(0, 200);
    if (fieldId === null || fieldId === undefined || fieldId === '') columnMapping[key] = null;
    else if (validFields.has(fieldId)) columnMapping[key] = fieldId;
    else throw new Error(`Campo "${fieldId}" não existe para ${tipoImportacao}.`);
  }
  const fixedValues = {};
  for (const key of FIXED_VALUE_KEYS) {
    const value = template.fixedValues?.[key];
    fixedValues[key] = value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim();
  }
  return {
    id: template.id ? String(template.id) : crypto.randomUUID(),
    nome,
    tipoImportacao,
    delimiter: DELIMITERS.includes(template.delimiter) ? template.delimiter : 'auto',
    columnMapping,
    categoryMode: Object.values(CATEGORY_MODES).includes(template.categoryMode) ? template.categoryMode : CATEGORY_MODES.PLANILHA,
    fixedValues,
    dateFormat: DATE_FORMATS.includes(template.dateFormat) ? template.dateFormat : 'auto',
    decimalFormat: DECIMAL_FORMATS.includes(template.decimalFormat) ? template.decimalFormat : 'auto',
    updatedAt: new Date().toISOString(),
  };
}
