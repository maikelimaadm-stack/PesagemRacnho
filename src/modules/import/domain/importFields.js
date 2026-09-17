// Campos da importação conciliada e sugestão automática de mapeamento.
// Os ids dos campos SÃO os cabeçalhos do CSV técnico de reimportação
// (id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;
// sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao), então esse
// arquivo mapeia 1:1 sem intervenção. Derivados (peso_anterior…gmd) entram só para
// comparação: a série é sempre recalculada pelas funções canônicas do Lançamento.
import { normalizeText } from '../../reporting/domain/filterEngine.js';
import { IMPORT_TYPES } from './importConstants.js';

// BOM (U+FEFF) montado por código: o caractere literal é invisível no editor.
const BOM = String.fromCharCode(0xfeff);
const stripBom = (text) => (text.startsWith(BOM) ? text.slice(1) : text);

const field = (id, label, aliases = [], extra = {}) => Object.freeze({ id, label, aliases: Object.freeze(aliases), required: false, derived: false, technical: false, ...extra });

// Catálogo de campos de evento (Histórico, Cadastros, Manejos, Saídas).
const EVENT_FIELDS = Object.freeze({
  // Campos técnicos: aceitos quando o arquivo é um CSV técnico do próprio sistema, mas NUNCA
  // oferecidos no mapeamento da tela — ninguém digita id na planilha (decisão de 17/09/2026).
  id: field('id', 'ID do evento', ['id', 'idpesagem', 'idevento', 'idsistema'], { technical: true }),
  animal_id: field('animal_id', 'ID do animal', ['animalid', 'idanimal', 'idsistemaanimal'], { technical: true }),
  id_externo: field('id_externo', 'ID externo', ['idexterno', 'codigoexterno', 'externo', 'idorigem'], { technical: true }),
  data: field('data', 'Data', ['data', 'datapesagem', 'datadapesagem', 'dataevento', 'datamanejo', 'dt']),
  tipo: field('tipo', 'Tipo', ['tipo', 'tipomanejo', 'tipoevento', 'tipomovimentacao', 'tipopesagem', 'evento']),
  motivo_saida: field('motivo_saida', 'Motivo da saída', ['motivosaida', 'motivodasaida', 'motivo']),
  causa_morte: field('causa_morte', 'Causa da morte', ['causamorte', 'causadamorte', 'causa']),
  numero: field('numero', 'Nº / Identificação', ['numero', 'numeroanimal', 'numerodoanimal', 'animal', 'brinco', 'identificador', 'identificacao', 'n', 'no', 'nro', 'num']),
  marca: field('marca', 'Marca', ['marca', 'marcaanimal', 'ferro']),
  marca_id: field('marca_id', 'ID da marca', ['marcaid', 'idmarca'], { technical: true }),
  sexo: field('sexo', 'Sexo', ['sexo']),
  raca: field('raca', 'Raça', ['raca']),
  raca_id: field('raca_id', 'ID da raça', ['racaid', 'idraca'], { technical: true }),
  categoria: field('categoria', 'Categoria', ['categoria', 'categoriaanimal']),
  categoria_id: field('categoria_id', 'ID da categoria', ['categoriaid', 'idcategoria'], { technical: true }),
  peso: field('peso', 'Peso (kg)', ['peso', 'pesokg', 'pesoatual', 'pesovivo', 'kg']),
  apartacao: field('apartacao', 'Apartação', ['apartacao', 'nomeapartacao']),
  lote: field('lote', 'Lote', ['lote', 'nomelote']),
  observacao: field('observacao', 'Observação', ['observacao', 'observacoes', 'obs']),
  peso_anterior: field('peso_anterior', 'Peso anterior (comparação)', ['pesoanterior'], { derived: true }),
  data_anterior: field('data_anterior', 'Data anterior (comparação)', ['dataanterior'], { derived: true }),
  dias: field('dias', 'Dias (comparação)', ['dias', 'intervalo', 'diasintervalo'], { derived: true }),
  ganho: field('ganho', 'Ganho (comparação)', ['ganho', 'ganhokg', 'ganhopeso'], { derived: true }),
  gmd: field('gmd', 'GMD (comparação)', ['gmd', 'gmdkg', 'ganhomediodiario'], { derived: true }),
});

// Cabeçalhos exatos do CSV técnico de reimportação (contrato consumido pela exportação).
export const TECHNICAL_IMPORT_HEADERS = Object.freeze([
  'id', 'animal_id', 'id_externo', 'data', 'tipo', 'motivo_saida', 'causa_morte', 'numero', 'marca', 'marca_id',
  'sexo', 'raca', 'raca_id', 'categoria', 'categoria_id', 'peso', 'apartacao', 'lote', 'observacao',
]);

const EVENT_FIELD_ORDER = [...TECHNICAL_IMPORT_HEADERS, 'peso_anterior', 'data_anterior', 'dias', 'ganho', 'gmd'];

// Obrigatórios por tipo. `numero` pode ser suprido por `animal_id` válido (checado na análise).
const REQUIRED_BY_TYPE = Object.freeze({
  HISTORICO: ['data', 'numero', 'peso'],
  CADASTROS: ['data', 'numero', 'peso'],
  MANEJOS: ['data', 'numero', 'peso'],
  // Peso é opcional em Saída por Morte/Doação/Transferência; motivo pode vir de valor fixo.
  SAIDAS: ['data', 'numero'],
});

// Cadastros mestres: cada célula preenchida de marca/raça/causa/categoria vira um cadastro.
const MASTER_FIELDS = Object.freeze([
  field('marca', 'Marca', ['marca', 'marcas', 'ferro']),
  field('raca', 'Raça', ['raca', 'racas']),
  field('causa_morte', 'Causa da morte', ['causamorte', 'causadamorte', 'causa', 'causasdemorte']),
  field('categoria', 'Categoria', ['categoria', 'categorias', 'categoriaanimal']),
  field('sexo', 'Sexo da categoria', ['sexo', 'sexoaplicavel']),
  field('peso_min_kg', 'Peso mínimo (kg)', ['pesominkg', 'pesomin', 'pesominimo', 'pesominimokg']),
  field('peso_max_kg', 'Peso máximo (kg)', ['pesomaxkg', 'pesomax', 'pesomaximo', 'pesomaximokg']),
  field('era', 'Era', ['era']),
  field('ordem', 'Ordem', ['ordem']),
]);

// Aplicações de sanidade (tipo SANIDADE): uma linha por aplicação já feita. O animal é
// resolvido pela identidade canônica (número + marca) e programa/medicamento pelo NOME
// normalizado nos cadastros de sanidade. Nenhum campo técnico: ninguém digita id.
const SANITY_FIELDS = Object.freeze([
  field('data', 'Data da aplicação', ['data', 'dataaplicacao', 'datadaaplicacao', 'dataevento', 'dt']),
  field('numero', 'Nº / Identificação', ['numero', 'numeroanimal', 'numerodoanimal', 'animal', 'brinco', 'identificador', 'identificacao', 'n', 'no', 'nro', 'num']),
  field('marca', 'Marca', ['marca', 'marcaanimal', 'ferro']),
  field('programa', 'Programa / Procedimento', ['programa', 'programasanidade', 'programadesanidade', 'procedimento', 'programaprocedimento']),
  field('medicamento', 'Medicamento / Produto', ['medicamento', 'produto', 'medicamentoproduto', 'vacina', 'vermifugo']),
  field('dose', 'Dose', ['dose', 'dosagem', 'quantidade', 'qtd']),
  field('unidade', 'Unidade da dose', ['unidade', 'unidadedose', 'unidadedadose', 'un']),
  field('via_aplicacao', 'Via de aplicação', ['via', 'viaaplicacao', 'viadeaplicacao']),
  field('observacao', 'Observação', ['observacao', 'observacoes', 'obs']),
]);

// Obrigatórios do tipo SANIDADE. Programa/medicamento não entram aqui porque basta UM dos
// dois: a exigência é por linha (validateApplicationInput do sanityService).
const SANITY_REQUIRED = Object.freeze(['data', 'numero']);

/** Cabeçalho comparável: sem BOM, acentos, caixa, espaços e pontuação ("Nº" → "n", "Peso (kg)" → "pesokg"). */
export function normalizeHeader(header) {
  return normalizeText(stripBom(String(header ?? ''))).replace(/[^a-z0-9]/g, '');
}

/** listImportFields(type) → [{ id, label, required, aliases, derived, technical }] na ordem do CSV técnico. */
export function listImportFields(type) {
  if (type === IMPORT_TYPES.MESTRES) return MASTER_FIELDS.map((item) => ({ ...item, aliases: [...item.aliases] }));
  if (type === IMPORT_TYPES.SANIDADE) {
    return SANITY_FIELDS.map((item) => ({ ...item, aliases: [...item.aliases], required: SANITY_REQUIRED.includes(item.id) }));
  }
  if (!Object.prototype.hasOwnProperty.call(REQUIRED_BY_TYPE, type)) {
    throw new Error(`Tipo de importação desconhecido: ${type}`);
  }
  const required = new Set(REQUIRED_BY_TYPE[type]);
  return EVENT_FIELD_ORDER.map((id) => ({ ...EVENT_FIELDS[id], aliases: [...EVENT_FIELDS[id].aliases], required: required.has(id) }));
}

/**
 * suggestMapping(headers, type) → { [header]: fieldId | null }.
 * 1º cabeçalho idêntico ao id do campo (CSV técnico); 2º alias normalizado. Cada campo é
 * atribuído uma única vez (vale o primeiro cabeçalho); repetições e desconhecidos → null.
 */
/**
 * Campos oferecidos no mapeamento da tela: só o que a pessoa digita na planilha.
 * Fora: id, id do animal, id externo e ids de cadastro (técnicos) e peso anterior, data
 * anterior, dias, ganho e GMD (derivados) — o sistema calcula a série sozinho.
 */
export function listMappableFields(type) {
  return listImportFields(type).filter((item) => !item.derived && !item.technical);
}

export function suggestMapping(headers = [], type) {
  const fields = listImportFields(type);
  const byId = new Map(fields.map((item) => [item.id, item]));
  const byAlias = new Map();
  for (const item of fields) {
    for (const alias of [normalizeHeader(item.id), ...item.aliases]) if (!byAlias.has(alias)) byAlias.set(alias, item.id);
  }
  const used = new Set();
  const mapping = {};
  // Primeira passada: ids exatos têm precedência sobre aliases (ex.: "animal_id" nunca vira "numero").
  for (const header of headers) {
    const exact = String(header ?? '').trim();
    if (byId.has(exact) && !used.has(exact)) {
      mapping[header] = exact;
      used.add(exact);
    }
  }
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(mapping, header)) continue;
    const candidate = byAlias.get(normalizeHeader(header)) ?? null;
    if (candidate && !used.has(candidate)) {
      mapping[header] = candidate;
      used.add(candidate);
    } else {
      mapping[header] = null;
    }
  }
  return mapping;
}

/** true quando todos os cabeçalhos são ids técnicos (CSV de reimportação: ISO e decimal com ponto). */
export function isTechnicalLayout(headers = []) {
  const technical = new Set(TECHNICAL_IMPORT_HEADERS);
  const clean = headers.map((header) => String(header ?? '').trim()).filter(Boolean);
  return clean.length > 0 && clean.includes('numero') && clean.includes('data') && clean.every((header) => technical.has(header));
}

/** Campo → primeiro cabeçalho mapeado (inverso do mapeamento; ignora ids desconhecidos para o tipo). */
export function invertMapping(mapping = {}, type) {
  const valid = new Set(listImportFields(type).map((item) => item.id));
  const headerByField = new Map();
  for (const [header, fieldId] of Object.entries(mapping || {})) {
    if (!fieldId || !valid.has(fieldId) || headerByField.has(fieldId)) continue;
    headerByField.set(fieldId, header);
  }
  return headerByField;
}
