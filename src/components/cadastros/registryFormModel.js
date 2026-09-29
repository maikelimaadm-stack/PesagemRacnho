// Modelo de formulário da página genérica de cadastros mestres: conversão
// definição ⇄ formulário ⇄ registro do serviço, texto das células e mensagens de
// erro. Sem React e com imports relativos para o gate (scripts/verify-registry-ui.mjs)
// exercitar as mesmas funções da tela em Node.
import { parseBrazilianNumber } from '../../modules/weighing/domain/brazilianValues.js';
import { coerceRecord } from '../../modules/catalog/domain/registryDefinitions.js';
import { buildPropertyHeader } from '../../modules/catalog/domain/propertyHeader.js';
import { documentProblem, documentToForm } from '../../modules/catalog/domain/documentMask.js';
import { matchesFilter } from '../../modules/reporting/domain/filterEngine.js';

// Campo CPF/CNPJ (Propriedades e Parceiros, id 'documento'): máscara ao digitar (DocumentInput.jsx) e o
// valor guardado aparece formatado ao abrir a ficha. Ao salvar segue o texto mascarado, e o serviço grava
// normalizeDocument como antes.
export const isDocumentField = (campo) => campo?.id === 'documento' && (campo.tipo ?? 'texto') === 'texto';

// Resposta 2 ao REPORT da E1C: na grade o CPF/CNPJ aparece com a máscara, e a pesquisa e o filtro da coluna
// aceitam o documento com ou sem pontuação ("11.222.333/0001-81" acha o mesmo que "11222333000181"; o CNPJ
// alfanumérico também). A comparação usa só letras e números; o valor guardado não muda.
export const documentSearchKey = (text) => String(text ?? '').toLocaleUpperCase('pt-BR').replace(/[^0-9A-Z]/g, '');

/** Pesquisa geral da grade: termo com algum dígito acha o documento com ou sem pontuação (trecho também). */
export function matchesDocumentSearch(value, term) {
  if (!/\d/.test(String(term ?? ''))) return false;
  const key = documentSearchKey(term);
  return key.length > 0 && documentSearchKey(value).includes(key);
}

/** Filtro da coluna CPF/CNPJ (pílula ou menu da coluna): texto da célula e do filtro sem pontuação. */
export function matchesDocumentColumnFilter(cellText, filter) {
  const compact = filter && typeof filter === 'object'
    ? {
      ...filter,
      ...(typeof filter.value === 'string' || typeof filter.value === 'number' ? { value: documentSearchKey(filter.value) } : {}),
      ...(typeof filter.valueTo === 'string' ? { valueTo: documentSearchKey(filter.valueTo) } : {}),
      ...(Array.isArray(filter.values) ? { values: filter.values.map(documentSearchKey) } : {}),
    }
    : documentSearchKey(filter);
  return matchesFilter(documentSearchKey(cellText), compact, 'text');
}

// Valor sentinela do item "Nenhum" (Radix não aceita item com valor vazio).
export const NONE_OPTION = '__nenhum__';
export const OBSERVATION_FIELD_IDS = new Set(['observacao', 'observacoes', 'descricao', 'orientacao']);
export const CONTACT_FIELD_IDS = new Set(['telefone', 'email']);
export const ADDITIONAL_FIELD_IDS = new Set(['cidade', 'uf', 'municipio', 'registro_sif', 'rendimento_padrao', 'codigo_oficial']);
// Seção da definição com os dados do cabeçalho dos relatórios (E1B): cartão próprio na ficha.
export const HEADER_SECTION = 'cabecalho';
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
// booleano como boolean, select como string ('' = nenhum), multiselect como array,
// imagem como o data URL ('' = sem imagem), CPF/CNPJ já com a máscara.
export function fieldToForm(campo, value) {
  switch (campo.tipo) {
    case 'booleano': return value == null ? Boolean(campo.defaultValue ?? false) : Boolean(value);
    case 'numero': return value == null ? formatNumberInput(campo.defaultValue) : formatNumberInput(value);
    case 'multiselect': return Array.isArray(value) ? [...value] : (Array.isArray(campo.defaultValue) ? [...campo.defaultValue] : []);
    case 'select': return value == null ? String(campo.defaultValue ?? '') : String(value);
    case 'imagem': return typeof value === 'string' ? value : '';
    default:
      if (value == null) return String(campo.defaultValue ?? '');
      return isDocumentField(campo) ? documentToForm(value) : String(value);
  }
}
export const emptyFor = (definition) => Object.fromEntries(definition.campos.map((campo) => [campo.id, fieldToForm(campo, undefined)]));
export const formFromRecord = (definition, record) => Object.fromEntries(definition.campos.map((campo) => [campo.id, fieldToForm(campo, record?.[campo.id])]));

// Erros só da ficha, antes da validação da definição (que também vale para importação): CPF/CNPJ com
// letras que não formam um CNPJ alfanumérico válido não é salvo — as letras sumiriam caladas.
export function formProblems(definition, form) {
  return definition.campos.filter(isDocumentField).map((campo) => documentProblem(form?.[campo.id])).filter(Boolean);
}

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
    } else if (campo.tipo === 'imagem') {
      // Sem imagem → null (Remover); o data URL segue inteiro para a definição validar.
      payload[campo.id] = String(value ?? '').trim() === '' ? null : String(value);
    } else {
      payload[campo.id] = String(value ?? '');
    }
  }
  return payload;
}

// Cards do registro: principais / adicionais / contato / observações / cabeçalho dos
// relatórios. Os campos com `secao: 'cabecalho'` saem dos outros cards (o telefone da
// propriedade vai para o cabeçalho; o do parceiro continua em Contato).
export function groupFields(definition) {
  const { campos } = definition;
  const header = campos.filter((campo) => campo.secao === HEADER_SECTION);
  const semSecao = campos.filter((campo) => campo.secao !== HEADER_SECTION);
  const observation = semSecao.filter((campo) => OBSERVATION_FIELD_IDS.has(campo.id));
  const contact = semSecao.filter((campo) => CONTACT_FIELD_IDS.has(campo.id));
  const additional = semSecao.filter((campo) => ADDITIONAL_FIELD_IDS.has(campo.id));
  const classified = new Set([...header, ...observation, ...contact, ...additional].map((campo) => campo.id));
  const primary = campos.filter((campo) => !classified.has(campo.id));
  return { primary, additional, contact, observation, header };
}

// Código do painel de contexto do registro aberto: documento, abreviação ou código
// oficial. Campo do cabeçalho dos relatórios fica fora (o CPF/CNPJ da propriedade só
// aparece no cabeçalho, e só com a opção ligada).
export function recordCodeOf(definition, record) {
  if (!record) return definition.singular;
  const doCabecalho = new Set(definition.campos.filter((campo) => campo.secao === HEADER_SECTION).map((campo) => campo.id));
  const codigo = ['documento', 'abreviacao', 'codigo_oficial'].filter((id) => !doCabecalho.has(id)).map((id) => record[id]).find(Boolean);
  return codigo || definition.singular;
}

// Pré-visualização "Assim vai sair nos relatórios": o formulário passa pela mesma coerção
// do serviço e pelo mesmo modelo de cabeçalho que a folha desenha (buildPropertyHeader).
export function headerPreviewFromForm(definition, form, { id = null } = {}) {
  return buildPropertyHeader({ ...coerceRecord(definition, payloadFromForm(definition, form)), id });
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
