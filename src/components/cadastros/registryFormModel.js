// Modelo de formulário da página genérica de cadastros mestres: conversão
// definição ⇄ formulário ⇄ registro do serviço, texto das células e mensagens de
// erro. Sem React e com imports relativos para o gate (scripts/verify-registry-ui.mjs)
// exercitar as mesmas funções da tela em Node.
import { parseBrazilianNumber } from '../../modules/weighing/domain/brazilianValues.js';

// Valor sentinela do item "Nenhum" (Radix não aceita item com valor vazio).
export const NONE_OPTION = '__nenhum__';
export const OBSERVATION_FIELD_IDS = new Set(['observacao', 'observacoes', 'descricao', 'orientacao']);
export const CONTACT_FIELD_IDS = new Set(['telefone', 'email']);
export const ADDITIONAL_FIELD_IDS = new Set(['cidade', 'uf', 'municipio', 'registro_sif', 'rendimento_padrao', 'codigo_oficial']);
// Contagem de uso por índice (barata): vira coluna da lista. Parceiros e causas
// varrem eventos de saída/cadastro, então só contam sob demanda no registro aberto.
export const USAGE_IN_LIST_STORES = new Set(['marcas', 'racas', 'categoriasAnimal', 'propriedades']);
export const USAGE_IN_LIST_LIMIT = 500;
// Acima do limite a coluna não conta (mostra "—" com explicação) e não vira pílula de filtro.
export const USAGE_UNAVAILABLE_TEXT = '—';
export const USAGE_UNAVAILABLE_TITLE = `Contagem de uso não calculada para listas com mais de ${USAGE_IN_LIST_LIMIT} registros; abra o registro para ver o uso.`;
export const usageAvailableFor = (usageInList, rowCount) => Boolean(usageInList) && rowCount <= USAGE_IN_LIST_LIMIT;

export const capitalize = (text) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
// Número no campo: vírgula decimal, sem separador de milhar (o operador digita assim).
export const formatNumberInput = (value) => (Number.isFinite(value) ? String(value).replace('.', ',') : '');
// Número na grade: formato brasileiro completo.
export const formatNumberCell = (value) => (Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : '');
export const optionLabel = (campo, value) => campo?.opcoes?.find((option) => String(option.value) === String(value))?.label ?? (value == null ? '' : String(value));
export const multiLabels = (campo, value) => (Array.isArray(value) ? value.map((item) => optionLabel(campo, item)) : []);
export const hasFieldValue = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '');

// Estado do formulário: texto/número como string (número em formato brasileiro),
// booleano como boolean, select como string ('' = nenhum), multiselect como array.
export function fieldToForm(campo, value) {
  switch (campo.tipo) {
    case 'booleano': return value == null ? Boolean(campo.defaultValue ?? false) : Boolean(value);
    case 'numero': return value == null ? formatNumberInput(campo.defaultValue) : formatNumberInput(value);
    case 'multiselect': return Array.isArray(value) ? [...value] : (Array.isArray(campo.defaultValue) ? [...campo.defaultValue] : []);
    case 'select': return value == null ? String(campo.defaultValue ?? '') : String(value);
    default: return value == null ? String(campo.defaultValue ?? '') : String(value);
  }
}
export const emptyFor = (definition) => Object.fromEntries(definition.campos.map((campo) => [campo.id, fieldToForm(campo, undefined)]));
export const formFromRecord = (definition, record) => Object.fromEntries(definition.campos.map((campo) => [campo.id, fieldToForm(campo, record?.[campo.id])]));

// Converte o formulário no registro que o serviço coage/valida. Número inválido
// vira NaN de propósito: a definição responde "informe um número válido".
export function payloadFromForm(definition, form) {
  const payload = {};
  for (const campo of definition.campos) {
    const value = form[campo.id];
    if (campo.tipo === 'numero') {
      const text = String(value ?? '').trim();
      payload[campo.id] = text === '' ? null : (parseBrazilianNumber(text) ?? Number.NaN);
    } else if (campo.tipo === 'select') {
      payload[campo.id] = String(value ?? '').trim() === '' ? null : value;
    } else if (campo.tipo === 'multiselect') {
      payload[campo.id] = Array.isArray(value) ? [...value] : [];
    } else if (campo.tipo === 'booleano') {
      payload[campo.id] = Boolean(value);
    } else {
      payload[campo.id] = String(value ?? '');
    }
  }
  return payload;
}

// Cards do registro: principais / adicionais / contato / observações.
export function groupFields(definition) {
  const observation = definition.campos.filter((campo) => OBSERVATION_FIELD_IDS.has(campo.id));
  const contact = definition.campos.filter((campo) => CONTACT_FIELD_IDS.has(campo.id));
  const additional = definition.campos.filter((campo) => ADDITIONAL_FIELD_IDS.has(campo.id));
  const classified = new Set([...observation, ...contact, ...additional].map((campo) => campo.id));
  const primary = definition.campos.filter((campo) => !classified.has(campo.id));
  return { primary, additional, contact, observation };
}

// Texto de célula (tabela, cartões, filtros e pesquisa) a partir da definição.
// `referenceName(store, id)` resolve referências; `usage` é a contagem de uso por id.
export function formatCellValue(column, record, { campo = null, referenceName = () => '', usage = {} } = {}) {
  if (column.id === '_typeLabel') return record._typeLabel || '';
  if (column.id === '_uso') return usage[record.id] == null ? '' : String(usage[record.id]);
  const value = record[column.id];
  if (column.render) return String(column.render(value, record) ?? '');
  if (column.referencia) return referenceName(column.referencia.store, value);
  if (campo?.tipo === 'numero') return formatNumberCell(value);
  if (campo?.tipo === 'booleano' || typeof value === 'boolean') return campo?.id === 'ativo' ? (value === false ? 'Inativo' : 'Ativo') : (value ? 'Sim' : 'Não');
  if (campo?.tipo === 'select') return campo.referencia ? referenceName(campo.referencia.store, value) : optionLabel(campo, value);
  if (campo?.tipo === 'multiselect') return multiLabels(campo, value).join(', ');
  return String(value ?? '');
}

const USAGE_LABELS = { animais: 'animais', identificadores: 'identificadores', faixas: 'faixas', sessoes: 'sessões', lotes: 'lotes', marcas: 'marcas', embarques: 'embarques', operacoes: 'operações', propriedades: 'propriedades', eventos: 'eventos', mortes: 'mortes' };
// Mensagem + detalhe para as notificações (REGISTRY_IN_USE traz o detalhe por origem).
export function describeError(error, fallback) {
  const message = error?.message || fallback;
  const detalhe = error?.details?.detalhe;
  if (error?.code === 'REGISTRY_IN_USE' && detalhe && typeof detalhe === 'object') {
    const partes = Object.entries(detalhe).filter(([, n]) => n > 0).map(([origem, n]) => `${USAGE_LABELS[origem] ?? origem}: ${n}`);
    return { message, description: partes.length ? `Vínculos — ${partes.join(' · ')}.` : undefined };
  }
  return { message, description: undefined };
}

// Opções de um campo com referência: ativos do cadastro referenciado (filtrados
// pelo papel, quando houver) + o valor já gravado, mesmo inativo.
export function referenceOptionsFor(campo, rows, currentValue) {
  const { papel } = campo.referencia || {};
  return (rows || [])
    .filter((row) => (row.ativo !== false || row.id === currentValue) && (!papel || (Array.isArray(row.papeis) && row.papeis.includes(papel))))
    .map((row) => ({ value: row.id, label: row.ativo === false ? `${row.nome} (inativo)` : row.nome }));
}
