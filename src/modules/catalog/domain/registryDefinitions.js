// Fonte única dos cadastros mestres (docs 12 §3.1; Auditoria Master BRAND/BREED/
// ANIMAL-CLASSIFICATION/COMMERCIAL-REGISTRY/PROPERTY-FARM/MORTALITY). A UI monta
// lista e formulário a partir de `campos`/`colunas`; o serviço usa `coerceRecord`,
// `validar` e `unicidade`. Enumerações compartilhadas vêm de schema.js.
import { PARCEIRO_PAPEIS } from '../../../storage/indexedDb/schema.js';
import { cleanText, normalizeDocument, normalizeName } from './normalize.js';

export const RACA_GRUPOS = ['ZEBUINO', 'TAURINO', 'CRUZADO', 'OUTRO'];
export const CATEGORIA_SEXOS = ['M', 'F'];
export const PARCEIRO_TIPOS_PESSOA = ['FISICA', 'JURIDICA'];
export const PROPRIEDADE_TIPOS = ['PROPRIA', 'TERCEIRO'];
export const CAUSA_MORTE_CATEGORIAS = ['Doença', 'Acidente', 'Predação', 'Parto', 'Desconhecida', 'Outra'];
export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

export const PARCEIRO_PAPEL_LABELS = {
  COMPRADOR: 'Comprador',
  VENDEDOR: 'Vendedor',
  FRIGORIFICO: 'Frigorífico',
  TRANSPORTADOR: 'Transportador',
  PROPRIETARIO: 'Proprietário de marca',
};
const RACA_GRUPO_LABELS = { ZEBUINO: 'Zebuíno', TAURINO: 'Taurino', CRUZADO: 'Cruzado', OUTRO: 'Outro' };
const SEXO_LABELS = { M: 'Macho', F: 'Fêmea' };
const TIPO_PESSOA_LABELS = { FISICA: 'Pessoa física', JURIDICA: 'Pessoa jurídica' };
const PROPRIEDADE_TIPO_LABELS = { PROPRIA: 'Própria', TERCEIRO: 'De terceiro' };

const opcoes = (values, labels = {}) => values.map((value) => ({ value, label: labels[value] ?? value }));
const labelDe = (labels) => (value) => (value == null || value === '' ? '' : labels[value] ?? String(value));

export const renderSimNao = (value) => (value ? 'Sim' : 'Não');
export const renderSituacao = (value) => (value === false ? 'Inativo' : 'Ativo');
export const renderPapeis = (value) => (Array.isArray(value) ? value.map((p) => PARCEIRO_PAPEL_LABELS[p] ?? p).join(', ') : '');

// Campo do formulário. tipo: texto | numero | booleano | select | multiselect.
// `referencia` (opcional) indica que o select é preenchido com outro cadastro:
// { store, papel? } — a UI carrega as opções pelo serviço daquele store.
function campo(id, label, extra = {}) {
  return {
    id,
    label,
    tipo: 'texto',
    obrigatorio: false,
    opcoes: null,
    largo: false,
    compacto: false,
    defaultValue: null,
    ajuda: null,
    ...extra,
  };
}

const NOME = (label = 'Nome', ajuda = null) => campo('nome', label, { obrigatorio: true, largo: true, ajuda });
const ATIVO = campo('ativo', 'Situação', { tipo: 'booleano', defaultValue: true, compacto: true });
const PADRAO = campo('padrao', 'Padrão', { tipo: 'booleano', defaultValue: false, compacto: true, ajuda: 'Pré-selecionado no cadastro rápido. Apenas um por empresa.' });
const ORDEM = campo('ordem', 'Ordem', { tipo: 'numero', compacto: true, ajuda: 'Ordem de exibição nas seleções.' });
const UF = campo('uf', 'UF', { tipo: 'select', opcoes: opcoes(UFS), compacto: true });

const isInt = (value) => Number.isInteger(value);

// ---------------------------------------------------------------------------
// Coerção de valores vindos do formulário/importação (strings) para o tipo do
// campo. Nunca inventa valor: undefined → defaultValue do campo (visível na UI).
// ---------------------------------------------------------------------------
function coerceField(field, raw) {
  const missing = raw === undefined || raw === null || raw === '';
  switch (field.tipo) {
    case 'booleano': {
      if (missing) return field.defaultValue ?? false;
      if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true';
      return Boolean(raw);
    }
    case 'numero': {
      if (missing) return field.defaultValue ?? null;
      if (typeof raw === 'number') return raw;
      const parsed = Number(String(raw).trim().replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    case 'select': {
      if (missing) return field.defaultValue ?? null;
      const value = String(raw).trim();
      return field.id === 'uf' ? value.toLocaleUpperCase('pt-BR') : value;
    }
    case 'multiselect': {
      if (missing) return Array.isArray(field.defaultValue) ? [...field.defaultValue] : [];
      const list = Array.isArray(raw) ? raw : String(raw).split(/[;,]/);
      return [...new Set(list.map((item) => String(item ?? '').trim().toLocaleUpperCase('pt-BR')).filter(Boolean))];
    }
    default: {
      if (missing) return field.defaultValue ?? null;
      return cleanText(raw);
    }
  }
}

// Converte um registro cru (formulário, importação, migração) no registro
// persistido: só os campos da definição + nome_normalizado (+ documento só dígitos).
export function coerceRecord(definition, data = {}) {
  const record = {};
  for (const field of definition.campos) {
    record[field.id] = coerceField(field, data[field.id]);
  }
  record.nome = cleanText(data.nome) ?? '';
  record.nome_normalizado = normalizeName(record.nome);
  if (definition.campos.some((field) => field.id === 'documento')) {
    record.documento = normalizeDocument(data.documento);
  }
  return record;
}

function errosComuns(definition, record) {
  const erros = [];
  if (!record.nome_normalizado) erros.push('Informe o nome.');
  for (const field of definition.campos) {
    const value = record[field.id];
    if (field.tipo === 'numero' && Number.isNaN(value)) erros.push(`${field.label}: informe um número válido.`);
    if (field.tipo === 'select' && value != null && field.opcoes && !field.referencia && !field.opcoes.some((o) => o.value === value)) {
      erros.push(`${field.label}: valor "${value}" não é permitido.`);
    }
    if (field.obrigatorio && field.id !== 'nome') {
      const vazio = value == null || value === '' || (Array.isArray(value) && value.length === 0);
      if (vazio) erros.push(`${field.label}: campo obrigatório.`);
    }
  }
  if ('ordem' in record && record.ordem != null && !Number.isNaN(record.ordem) && (!isInt(record.ordem) || record.ordem < 0)) {
    erros.push('Ordem deve ser um inteiro maior ou igual a zero.');
  }
  return erros;
}

function definicao(base) {
  const def = { temPadrao: false, unicidade: ['nome_normalizado'], ...base };
  const regras = base.regras || (() => []);
  // validar aceita registro cru ou já coagido; devolve lista de mensagens pt-BR.
  def.validar = (record) => {
    const coerced = coerceRecord(def, record || {});
    return [...errosComuns(def, coerced), ...regras(coerced)];
  };
  delete def.regras;
  return Object.freeze(def);
}

// ---------------------------------------------------------------------------
// Definições
// ---------------------------------------------------------------------------
export const MARCAS = definicao({
  store: 'marcas',
  singular: 'marca',
  plural: 'marcas',
  rotulo: 'Marcas',
  descricao: 'Marcas a ferro que compõem a identidade visual dos animais.',
  temPadrao: true,
  campos: [
    NOME('Marca'),
    campo('abreviacao', 'Abreviação', { compacto: true, ajuda: 'Até 6 caracteres; aparece nas grades.' }),
    campo('proprietario_parceiro_id', 'Proprietário', { tipo: 'select', opcoes: [], referencia: { store: 'parceiros', papel: 'PROPRIETARIO' } }),
    campo('propriedade_id', 'Propriedade', { tipo: 'select', opcoes: [], referencia: { store: 'propriedades' } }),
    PADRAO,
    campo('observacao', 'Observação', { largo: true }),
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Marca' },
    { id: 'abreviacao', label: 'Abreviação' },
    { id: 'proprietario_parceiro_id', label: 'Proprietário', referencia: { store: 'parceiros' } },
    { id: 'padrao', label: 'Padrão', render: renderSimNao },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
  regras: (r) => {
    const erros = [];
    if (r.abreviacao && r.abreviacao.length > 6) erros.push('Abreviação deve ter no máximo 6 caracteres.');
    return erros;
  },
});

export const RACAS = definicao({
  store: 'racas',
  singular: 'raça',
  plural: 'raças',
  rotulo: 'Raças',
  descricao: 'Raças usadas no cadastro dos animais. A raça padrão é pré-selecionada no curral.',
  temPadrao: true,
  campos: [
    NOME('Raça'),
    campo('abreviacao', 'Abreviação', { compacto: true }),
    campo('grupo', 'Grupo', { tipo: 'select', opcoes: opcoes(RACA_GRUPOS, RACA_GRUPO_LABELS), ajuda: 'Só para agrupar relatórios.' }),
    PADRAO,
    ORDEM,
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Raça' },
    { id: 'abreviacao', label: 'Abreviação' },
    { id: 'grupo', label: 'Grupo', render: labelDe(RACA_GRUPO_LABELS) },
    { id: 'padrao', label: 'Padrão', render: renderSimNao },
    { id: 'ordem', label: 'Ordem' },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
});

export const CATEGORIAS_ANIMAL = definicao({
  store: 'categoriasAnimal',
  singular: 'categoria',
  plural: 'categorias',
  rotulo: 'Categorias',
  descricao: 'Categorias do animal (bezerro, garrote, novilha, boi, vaca, touro…) por sexo, com faixa de peso para a escolha automática e a era gravada nas pesagens.',
  campos: [
    NOME('Categoria'),
    campo('sexo_aplicavel', 'Sexo', { tipo: 'select', obrigatorio: true, opcoes: opcoes(CATEGORIA_SEXOS, SEXO_LABELS), compacto: true, ajuda: 'No lançamento só aparecem as categorias do sexo escolhido.' }),
    campo('peso_min_kg', 'Peso mínimo (kg)', { tipo: 'numero', compacto: true, ajuda: 'Faixa da categoria automática; vazio = sem mínimo.' }),
    campo('peso_max_kg', 'Peso máximo (kg)', { tipo: 'numero', compacto: true, ajuda: 'Vazio = sem limite. Faixas que se cruzam: vale a menor ordem.' }),
    campo('era', 'Era', { tipo: 'numero', compacto: true, ajuda: 'Gravada na pesagem quando o animal está nesta categoria.' }),
    ORDEM,
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Categoria' },
    { id: 'sexo_aplicavel', label: 'Sexo', render: labelDe(SEXO_LABELS) },
    { id: 'peso_min_kg', label: 'Peso mín. (kg)' },
    { id: 'peso_max_kg', label: 'Peso máx. (kg)' },
    { id: 'era', label: 'Era' },
    { id: 'ordem', label: 'Ordem' },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
  regras: (r) => {
    const erros = [];
    for (const id of ['peso_min_kg', 'peso_max_kg']) {
      const v = r[id];
      if (v != null && (Number.isNaN(v) || v < 0)) erros.push('Peso deve ser um número maior ou igual a zero.');
    }
    if (r.peso_min_kg != null && r.peso_max_kg != null && r.peso_min_kg > r.peso_max_kg) {
      erros.push('Peso mínimo não pode ser maior que o peso máximo.');
    }
    if (r.era != null && (Number.isNaN(r.era) || !isInt(r.era) || r.era < 0)) {
      erros.push('Era deve ser um número inteiro maior ou igual a zero.');
    }
    return erros;
  },
});

export const PARCEIROS = definicao({
  store: 'parceiros',
  singular: 'parceiro',
  plural: 'parceiros',
  rotulo: 'Parceiros',
  descricao: 'Compradores, vendedores, frigoríficos, transportadores e proprietários de marca em um único cadastro com papéis.',
  unicidade: ['nome_normalizado', 'documento'],
  campos: [
    NOME('Nome/Razão social'),
    campo('tipo_pessoa', 'Tipo de pessoa', { tipo: 'select', opcoes: opcoes(PARCEIRO_TIPOS_PESSOA, TIPO_PESSOA_LABELS), compacto: true }),
    campo('documento', 'CPF/CNPJ', { compacto: true, ajuda: 'Somente os dígitos são guardados; único por empresa quando informado.' }),
    campo('papeis', 'Papéis', { tipo: 'multiselect', obrigatorio: true, opcoes: opcoes(PARCEIRO_PAPEIS, PARCEIRO_PAPEL_LABELS), largo: true }),
    campo('telefone', 'Telefone', { compacto: true }),
    campo('email', 'E-mail', { largo: true }),
    campo('cidade', 'Cidade'),
    UF,
    campo('registro_sif', 'Registro SIF/SIM/SIE', { compacto: true, ajuda: 'Somente para frigoríficos.' }),
    campo('rendimento_padrao', 'Rendimento padrão (%)', { tipo: 'numero', compacto: true, ajuda: 'Sugestão de rendimento de carcaça do parceiro; sem valor, nenhum rendimento é assumido.' }),
    campo('observacao', 'Observação', { largo: true }),
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Nome/Razão social' },
    { id: 'documento', label: 'CPF/CNPJ' },
    { id: 'papeis', label: 'Papéis', render: renderPapeis },
    { id: 'telefone', label: 'Telefone' },
    { id: 'cidade', label: 'Cidade' },
    { id: 'uf', label: 'UF' },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
  regras: (r) => {
    const erros = [];
    const invalidos = (r.papeis || []).filter((p) => !PARCEIRO_PAPEIS.includes(p));
    if (invalidos.length) erros.push(`Papéis inválidos: ${invalidos.join(', ')}.`);
    if (r.rendimento_padrao != null && !Number.isNaN(r.rendimento_padrao) && (r.rendimento_padrao <= 0 || r.rendimento_padrao > 100)) {
      erros.push('Rendimento padrão deve estar entre 0 e 100.');
    }
    return erros;
  },
});

export const PROPRIEDADES = definicao({
  store: 'propriedades',
  singular: 'propriedade',
  plural: 'propriedades',
  rotulo: 'Propriedades',
  descricao: 'Propriedades próprias e de terceiros usadas como origem, destino e vínculo de marca.',
  temPadrao: true,
  campos: [
    NOME('Propriedade'),
    campo('tipo', 'Tipo', { tipo: 'select', obrigatorio: true, opcoes: opcoes(PROPRIEDADE_TIPOS, PROPRIEDADE_TIPO_LABELS), defaultValue: 'PROPRIA', compacto: true }),
    campo('parceiro_id', 'Parceiro (dono)', { tipo: 'select', opcoes: [], referencia: { store: 'parceiros' }, ajuda: 'Dono da propriedade quando for de terceiro.' }),
    campo('municipio', 'Município'),
    UF,
    campo('codigo_oficial', 'Código oficial', { compacto: true, ajuda: 'Código usado na GTA; texto livre.' }),
    PADRAO,
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Propriedade' },
    { id: 'tipo', label: 'Tipo', render: labelDe(PROPRIEDADE_TIPO_LABELS) },
    { id: 'municipio', label: 'Município' },
    { id: 'uf', label: 'UF' },
    { id: 'padrao', label: 'Padrão', render: renderSimNao },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
});

export const CAUSAS_MORTE = definicao({
  store: 'causasMorte',
  singular: 'causa de morte',
  plural: 'causas de morte',
  rotulo: 'Causas de Morte',
  descricao: 'Catálogo padronizado para as saídas por mortalidade.',
  campos: [
    NOME('Causa da morte'),
    campo('categoria', 'Categoria', { tipo: 'select', obrigatorio: true, opcoes: opcoes(CAUSA_MORTE_CATEGORIAS), defaultValue: 'Outra', compacto: true }),
    campo('descricao', 'Descrição/Orientação', { largo: true }),
    campo('exige_observacao', 'Exigir observação', { tipo: 'booleano', defaultValue: false, compacto: true, ajuda: 'A saída por esta causa só é aceita com observação preenchida.' }),
    ORDEM,
    ATIVO,
  ],
  colunas: [
    { id: 'nome', label: 'Causa da morte' },
    { id: 'categoria', label: 'Categoria' },
    { id: 'descricao', label: 'Descrição/Orientação' },
    { id: 'exige_observacao', label: 'Exigir observação', render: renderSimNao },
    { id: 'ativo', label: 'Situação', render: renderSituacao },
  ],
});

export const REGISTRY_DEFINITIONS = Object.freeze([MARCAS, RACAS, CATEGORIAS_ANIMAL, PARCEIROS, PROPRIEDADES, CAUSAS_MORTE]);
export const REGISTRY_DEFINITIONS_BY_STORE = Object.freeze(Object.fromEntries(REGISTRY_DEFINITIONS.map((def) => [def.store, def])));

export function getRegistryDefinition(store) {
  const def = REGISTRY_DEFINITIONS_BY_STORE[store];
  if (!def) throw new Error(`Cadastro mestre desconhecido: ${store}`);
  return def;
}
