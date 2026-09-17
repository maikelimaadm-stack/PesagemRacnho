// Contrato de colunas e exportação de pesagens (docs/evidence/sanity-launch-import-reconciliation/EXPORT-CONTRACT.md).
// Uma única definição por coluna do domínio de pesagens decide rótulo, tipo, sensibilidade e como
// ler o valor a partir do view model de pesagem (weighingMapper) ou da linha da Relação (eventRows).
// Dois perfis, nunca misturados:
// - FRIENDLY (relatório amigável): rótulos em português, datas dd/mm/aaaa, decimal com vírgula,
//   sem milhar, ausente = célula vazia (nunca "0", "--/--/----" nem "[object Object]");
// - REIMPORT (técnico, para reimportação): cabeçalhos fixos em snake_case, datas ISO, decimal com
//   ponto e SEM derivados (data/peso anterior, dias, ganho, GMD): a importação sempre recalcula.
// O CSV é o canônico do reporting (BOM, ";", CRLF, escape e proteção contra fórmula em csvCell).
import { CSV_BOM, CSV_NEWLINE, CSV_SEPARATOR, csvCell } from '../../reporting/infrastructure/exporters/csvExporter.js';
import { formatCell } from '../../reporting/domain/reportFormatting.js';
import { SENSITIVITY } from '../../reporting/domain/columnDefinition.js';
import { normalizeText } from '../../reporting/domain/filterEngine.js';
import { EVENT_COLUMNS, RELATION_COLUMN_IDS } from '../../reporting/definitions/columns/eventColumns.js';
import { dedupeById, storageRowToEventViewModel } from '../../reporting/infrastructure/reportSources/eventRows.js';
import { compareWeighingEvents, measuredWeightOf } from '../domain/weighingSeries.js';
import { parseBrazilianNumber, parseCivilDate } from '../domain/brazilianValues.js';

export const WEIGHING_EXPORT_CONTRACT_VERSION = 1;

export const EXPORT_PROFILES = Object.freeze({ FRIENDLY: 'FRIENDLY', REIMPORT: 'REIMPORT' });

// Cabeçalhos EXATOS do perfil técnico, nesta ordem. Mudar qualquer um quebra a reimportação.
export const REIMPORT_HEADERS = Object.freeze([
  'id', 'animal_id', 'id_externo', 'data', 'tipo', 'motivo_saida', 'causa_morte', 'numero', 'marca', 'marca_id',
  'sexo', 'raca', 'raca_id', 'categoria', 'categoria_id', 'peso', 'apartacao', 'lote', 'observacao',
]);

// Derivados da série: nunca saem no perfil técnico (a importação recalcula com as funções canônicas).
export const DERIVED_COLUMN_IDS = Object.freeze(['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd']);

const EVENT_BY_ID = new Map(EVENT_COLUMNS.map((column) => [column.id, column]));
const FRIENDLY = EXPORT_PROFILES.FRIENDLY;
const REIMPORT = EXPORT_PROFILES.REIMPORT;

const first = (...values) => values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
const nameFrom = (lookup, id) => (id && lookup ? lookup.get(id) ?? null : null);

/** Coluna do contrato. `canonical` reaproveita tipo/opções/sensibilidade da ColumnDefinition do grão EVENT. */
function column({ id, label, technical = null, canonical = null, type, accessor, friendlyDefault = false, options, sensitive }) {
  const base = canonical ? EVENT_BY_ID.get(canonical) : null;
  if (canonical && !base) throw new Error(`contrato de exportação: coluna canônica desconhecida (${canonical})`);
  return Object.freeze({
    id,
    label: label ?? base.label,
    technicalHeader: technical,
    profiles: Object.freeze(technical ? [FRIENDLY, REIMPORT] : [FRIENDLY]),
    type: type ?? base?.type ?? 'text',
    options: options ?? base?.options ?? null,
    decimals: base?.decimals ?? null,
    sensitive: sensitive ?? base?.sensitive ?? null,
    friendlyDefault,
    accessor: accessor ?? ((row) => row?.[id]),
  });
}

// Colunas do domínio de pesagens. Ids = ids da Relação/Lançamento quando a coluna existe na tela
// (data_pesagem, numero_animal, nome_lote...), para a tela passar as colunas visíveis sem tradução.
const DOMAIN_COLUMNS = [
  column({ id: 'id', label: 'ID', technical: 'id', type: 'identifier', accessor: (row) => row?.id }),
  column({ id: 'animal_id', label: 'Animal ID', technical: 'animal_id', type: 'identifier', accessor: (row) => first(row?.animal_id, row?.animal_id_resolvido) }),
  column({ id: 'id_externo', label: 'ID externo', technical: 'id_externo', type: 'identifier' }),
  column({ id: 'numero_registro', label: 'Nº', type: 'integer', accessor: (row) => first(row?._numero_registro, row?.numero_registro) }),
  column({ id: 'data_pesagem', canonical: 'data_pesagem', technical: 'data', friendlyDefault: true }),
  column({ id: 'tipo_manejo', canonical: 'tipo_manejo', technical: 'tipo', friendlyDefault: true }),
  column({ id: 'motivo_saida', canonical: 'motivo_saida', technical: 'motivo_saida', friendlyDefault: true }),
  column({ id: 'causa_morte', canonical: 'causa_morte', technical: 'causa_morte', friendlyDefault: true }),
  // "Identificação" (e não "Animal") para não se confundir com "Animal ID".
  column({ id: 'numero_animal', canonical: 'numero_animal', label: 'Identificação', technical: 'numero', friendlyDefault: true }),
  column({ id: 'marca', canonical: 'marca', technical: 'marca', friendlyDefault: true, accessor: (row) => first(row?.marca, row?.marca_nome) }),
  column({ id: 'marca_id', label: 'Marca ID', technical: 'marca_id', type: 'identifier', accessor: (row) => first(row?.marca_id, row?.marca_grupo_id) }),
  column({ id: 'sexo', canonical: 'sexo', technical: 'sexo', friendlyDefault: true }),
  column({ id: 'raca', canonical: 'raca', technical: 'raca', friendlyDefault: true, accessor: (row) => first(row?.raca, row?.raca_nome) }),
  column({ id: 'raca_id', label: 'Raça ID', technical: 'raca_id', type: 'identifier', accessor: (row) => first(row?.raca_id, row?.raca_grupo_id) }),
  // Categoria gravada na pesagem (histórico): nome resolvido pela linha da Relação ou pelos cadastros.
  column({ id: 'categoria', canonical: 'categoria', technical: 'categoria', type: 'text', friendlyDefault: true, accessor: (row) => row?.categoria_nome ?? null }),
  column({ id: 'categoria_id', label: 'Categoria ID', technical: 'categoria_id', type: 'identifier', accessor: (row) => row?.categoria_id ?? null }),
  column({ id: 'era', canonical: 'era', friendlyDefault: true }),
  // Peso medido: null, vazio e 0 não são pesagem (Saída sem peso sai vazia, nunca 0).
  column({ id: 'peso', canonical: 'peso', technical: 'peso', friendlyDefault: true, accessor: measuredWeightOf }),
  column({ id: 'data_anterior', canonical: 'data_anterior', friendlyDefault: true }),
  column({ id: 'peso_anterior', canonical: 'peso_anterior', friendlyDefault: true, accessor: (row) => measuredWeightOf({ peso: row?.peso_anterior }) }),
  column({ id: 'dias', canonical: 'dias', friendlyDefault: true }),
  column({ id: 'ganho', canonical: 'ganho', friendlyDefault: true }),
  column({ id: 'gmd', canonical: 'gmd', friendlyDefault: true }),
  column({ id: 'nome_apartacao', canonical: 'nome_apartacao', technical: 'apartacao', friendlyDefault: true }),
  column({ id: 'nome_lote', canonical: 'nome_lote', technical: 'lote', friendlyDefault: true }),
  column({ id: 'sessao', canonical: 'sessao', type: 'text', friendlyDefault: true, accessor: (row) => row?.sessao_label ?? null }),
  column({ id: 'observacao', canonical: 'observacao', technical: 'observacao', friendlyDefault: true }),
];

// Demais colunas que a Relação oferece (texto operacional e valores comerciais): mesma definição
// canônica, só no perfil amigável. Valores comerciais continuam marcados como sensíveis.
const DOMAIN_IDS = new Set(DOMAIN_COLUMNS.map((item) => item.id));
const EXTRA_IDS = [
  ...RELATION_COLUMN_IDS,
  // Sensíveis que a Relação não oferece, mas existem no evento (Lançamento/abate).
  ...EVENT_COLUMNS.filter((item) => item.sensitive === SENSITIVITY.COMMERCIAL).map((item) => item.id),
].filter((id, index, list) => !DOMAIN_IDS.has(id) && list.indexOf(id) === index);
const EXTRA_COLUMNS = EXTRA_IDS.map((id) => column({
  id,
  canonical: id,
  // Arrobas/carcaça só valem com rendimento válido (eventRows zera o legado); a entidade usa o nome.
  accessor: EVENT_BY_ID.get(id).type === 'entity' ? EVENT_BY_ID.get(id).display : (row) => row?.[id],
}));

export const WEIGHING_EXPORT_COLUMNS = Object.freeze([...DOMAIN_COLUMNS, ...EXTRA_COLUMNS]);

const BY_ID = new Map(WEIGHING_EXPORT_COLUMNS.map((item) => [item.id, item]));
const BY_TECHNICAL = new Map(WEIGHING_EXPORT_COLUMNS.filter((item) => item.technicalHeader).map((item) => [item.technicalHeader, item]));

// Tipo e Motivo da saída sempre saem no relatório amigável (sem eles o CSV não diz o que é cada linha).
export const FRIENDLY_REQUIRED_COLUMN_IDS = Object.freeze(['tipo_manejo', 'motivo_saida']);
export const FRIENDLY_DEFAULT_COLUMN_IDS = Object.freeze(DOMAIN_COLUMNS.filter((item) => item.friendlyDefault).map((item) => item.id));
export const COMMERCIAL_EXPORT_COLUMN_IDS = Object.freeze(WEIGHING_EXPORT_COLUMNS.filter((item) => item.sensitive === SENSITIVITY.COMMERCIAL).map((item) => item.id));

function assertProfile(profile) {
  if (!Object.values(EXPORT_PROFILES).includes(profile)) throw new Error(`Perfil de exportação inválido: ${profile}`);
}

/**
 * Colunas efetivas do perfil.
 * - REIMPORT: sempre REIMPORT_HEADERS, nesta ordem (as colunas da tela não mudam o contrato técnico).
 * - FRIENDLY: `columns` (ids na ordem da tela; ids desconhecidos, como "selecao"/"acoes", são ignorados)
 *   ou o conjunto padrão; Tipo e Motivo da saída entram se faltarem (logo após a Data); colunas
 *   comerciais só com `canSeeCommercial`.
 */
export function columnsForProfile(profile = FRIENDLY, { columns = null, canSeeCommercial = false } = {}) {
  assertProfile(profile);
  if (profile === REIMPORT) return REIMPORT_HEADERS.map((header) => BY_TECHNICAL.get(header));
  const requested = Array.isArray(columns)
    ? columns.map((item) => (typeof item === 'string' ? item : item?.id))
    : [...FRIENDLY_DEFAULT_COLUMN_IDS, ...(canSeeCommercial ? COMMERCIAL_EXPORT_COLUMN_IDS : [])];
  const ids = [];
  for (const id of requested) {
    const definition = BY_ID.get(id);
    if (!definition || ids.includes(id)) continue;
    if (definition.sensitive === SENSITIVITY.COMMERCIAL && !canSeeCommercial) continue;
    ids.push(id);
  }
  const missing = FRIENDLY_REQUIRED_COLUMN_IDS.filter((id) => !ids.includes(id));
  if (missing.length) {
    const dateIndex = ids.indexOf('data_pesagem');
    ids.splice(dateIndex >= 0 ? dateIndex + 1 : 0, 0, ...missing);
  }
  return ids.map((id) => BY_ID.get(id));
}

/** Valor primitivo ou null: objetos nunca viram "[object Object]". */
function plainValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (Array.isArray(value)) {
    const parts = value.map(plainValue).filter((item) => item !== null);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'object') return plainValue(value.nome ?? value.label ?? value.name ?? null);
  return String(value);
}

const NUMERIC_TYPES = new Set(['integer', 'number', 'weight', 'gmd', 'money', 'percentage']);

/** Número canônico com ponto, sem milhar e sem ruído binário (320.40000000000003 → 320.4). */
function technicalNumber(value) {
  const number = typeof value === 'number' ? value : parseBrazilianNumber(value);
  if (number === null || !Number.isFinite(number)) return null;
  return String(Number(number.toFixed(6)) + 0);
}

/** Sexo técnico: código M/F (legado "Macho"/"Fêmea" é normalizado; outro texto segue como está). */
function technicalSex(value) {
  const text = normalizeText(value);
  if (text === 'm' || text === 'macho') return 'M';
  if (text === 'f' || text === 'femea') return 'F';
  return String(value);
}

function cellValue(definition, row, profile) {
  const value = plainValue(definition.accessor(row));
  if (value === null) return null;
  if (profile === FRIENDLY) {
    const text = formatCell(definition, value, 'csv');
    return text === '' ? null : text;
  }
  if (definition.type === 'date') return parseCivilDate(value) ?? String(value);
  if (NUMERIC_TYPES.has(definition.type)) return technicalNumber(value);
  if (definition.id === 'sexo') return technicalSex(value);
  return String(value);
}

function timestamp(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function safeFileBase(fileBase) {
  const text = String(fileBase ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return text || 'pesagens';
}

/**
 * Monta o CSV de pesagens no perfil pedido. Função pura (permissões: weighingExportService).
 * @param {object[]} rows view models de pesagem ou linhas da Relação, na ordem desejada
 * @returns {{ content: string, headers: string[], columnIds: string[], fileName: string, rowCount: number, profile: string }}
 */
export function buildWeighingCsv(rows, { profile = FRIENDLY, columns = null, canSeeCommercial = false, fileBase = 'pesagens', now = new Date() } = {}) {
  assertProfile(profile);
  const selected = columnsForProfile(profile, { columns, canSeeCommercial });
  const headers = selected.map((definition) => (profile === REIMPORT ? definition.technicalHeader : definition.label));
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  const lines = [headers.map(csvCell).join(CSV_SEPARATOR)];
  for (const row of list) {
    lines.push(selected.map((definition) => csvCell(cellValue(definition, row, profile))).join(CSV_SEPARATOR));
  }
  const suffix = profile === REIMPORT ? '-reimportacao' : '';
  return {
    content: CSV_BOM + lines.join(CSV_NEWLINE) + CSV_NEWLINE,
    headers,
    columnIds: selected.map((definition) => definition.id),
    fileName: `${safeFileBase(fileBase)}${suffix}-${timestamp(now)}.csv`,
    rowCount: list.length,
    profile,
  };
}

const toNameMap = (source) => {
  if (source instanceof Map) return source;
  return new Map((Array.isArray(source) ? source : []).filter((row) => row && !row.deleted_at).map((row) => [row.id, row.nome ?? null]));
};

/**
 * CSV técnico (perfil REIMPORT) para a Manutenção: aceita registros Dexie crus (com legacy_payload)
 * ou view models. Ignora excluídos, deduplica por id (mantém o localId mais recente) e ordena pela
 * cronologia canônica. `lookups` ({ marcas, racas, categorias } como Map id→nome ou lista de cadastros)
 * preenche nomes que o evento não traz (ex.: categoria).
 */
export function buildWeighingTechnicalCsv(storageRowsOrViewModels, { lookups = {}, fileBase = 'pesagens', now = new Date() } = {}) {
  const marcas = toNameMap(lookups.marcas);
  const racas = toNameMap(lookups.racas);
  const categorias = toNameMap(lookups.categorias);
  const viewModels = [];
  for (const row of Array.isArray(storageRowsOrViewModels) ? storageRowsOrViewModels : []) {
    if (!row || typeof row !== 'object' || row.deleted_at) continue;
    const viewModel = Object.hasOwn(row, 'legacy_payload') ? storageRowToEventViewModel(row) : row;
    if (!viewModel) continue;
    viewModels.push({
      ...viewModel,
      marca_nome: viewModel.marca_nome ?? nameFrom(marcas, viewModel.marca_id),
      raca_nome: viewModel.raca_nome ?? nameFrom(racas, viewModel.raca_id),
      categoria_nome: viewModel.categoria_nome ?? nameFrom(categorias, viewModel.categoria_id),
    });
  }
  const ordered = dedupeById(viewModels).sort(compareWeighingEvents);
  return buildWeighingCsv(ordered, { profile: REIMPORT, fileBase, now });
}
