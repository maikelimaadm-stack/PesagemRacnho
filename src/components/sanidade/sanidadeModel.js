// Modelo de apresentação da tela de Sanidade (stores próprias da v8: programasSanidade,
// medicamentos, aplicacoesSanidade). Funções puras, sem React e sem banco: a tela chama o
// sanityService (src/modules/sanity/application/sanityService.js) e usa este módulo para
// permissões de UI, colunas, textos, formulários e busca de animais. O gate
// scripts/verify-sanity-ui.mjs importa este arquivo direto no Node — por isso só imports
// relativos de módulos também puros.
import { normalizeText } from '../../modules/reporting/domain/filterEngine.js';
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from '../../modules/weighing/domain/brazilianValues.js';

// Permissões (sem ações novas na matriz): leitura da tela por weighing.read; cadastros de
// programas/medicamentos por registry.write; aplicação avulsa por weighing.write;
// cancelamento por weighing.edit. O serviço confere de novo (falha fechada).
export const SANITY_READ_PERMISSION = 'weighing.read';
export const SANITY_REGISTRY_WRITE_PERMISSION = 'registry.write';
export const SANITY_APPLY_PERMISSION = 'weighing.write';
export const SANITY_CANCEL_PERMISSION = 'weighing.edit';

export const SANIDADE_TABS = [
  { id: 'programas', label: 'Programas/Procedimentos' },
  { id: 'medicamentos', label: 'Medicamentos/Produtos' },
  // F08: regra de dose versionada por medicamento (dose sugerida só de posologia aprovada).
  { id: 'posologias', label: 'Posologias' },
  { id: 'aplicacoes', label: 'Aplicações' },
];

export const EMPTY_TEXT = '—';

/** Decisões de UI a partir do contexto do AuthGate. Sem AuthGate (desenvolvimento) tudo é permitido. */
export function sanityPermissions(auth) {
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  return {
    canRead: can(SANITY_READ_PERMISSION),
    canWriteRegistry: can(SANITY_REGISTRY_WRITE_PERMISSION),
    canApply: can(SANITY_APPLY_PERMISSION),
    canCancel: can(SANITY_CANCEL_PERMISSION),
  };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------
const doseFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const textOr = (value, fallback = EMPTY_TEXT) => (hasText(value) ? String(value).trim() : fallback);

export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDateBR(value) {
  const iso = parseCivilDate(value);
  if (!iso) return EMPTY_TEXT;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDose(dose, unidade) {
  if (dose === null || dose === undefined || dose === '') return EMPTY_TEXT;
  const number = Number(dose);
  if (!Number.isFinite(number)) return EMPTY_TEXT;
  return hasText(unidade) ? `${doseFormat.format(number)} ${String(unidade).trim()}` : doseFormat.format(number);
}

export function formatCarencia(dias) {
  if (dias === null || dias === undefined || dias === '') return EMPTY_TEXT;
  const number = Number(dias);
  if (!Number.isInteger(number) || number < 0) return EMPTY_TEXT;
  return number === 0 ? 'Sem carência' : `${number} dia${number === 1 ? '' : 's'}`;
}

export const labelOf = (labels, code) => (hasText(code) ? (labels?.[code] ?? String(code)) : EMPTY_TEXT);

export const situacaoCadastro = (record) => (record?.ativo === false ? 'Inativo' : 'Ativo');
export const isApplicationCancelled = (row) => Boolean(row?.cancelled_at);
export const situacaoAplicacao = (row) => (isApplicationCancelled(row) ? 'Cancelada' : 'Aplicada');
// Aplicação gravada junto da pesagem carrega pesagem_id; sem pesagem é avulsa.
export const origemAplicacao = (row) => (row?.pesagem_id ? 'Lançamento' : 'Avulsa');
export const programaNomeDe = (row) => textOr(row?.programa_nome ?? row?.programa_nome_snapshot);
export const medicamentoNomeDe = (row) => textOr(row?.medicamento_nome ?? row?.medicamento_nome_snapshot);

// ---------------------------------------------------------------------------
// Animais: índice local para o filtro por número/marca e para a coluna Animal.
// ---------------------------------------------------------------------------
export function buildAnimalIndex(animals = []) {
  const list = (animals || [])
    .filter((animal) => animal && animal.id && !animal.deleted_at)
    .map((animal) => {
      const numero = textOr(animal.numero_animal, 'Sem número');
      const marca = textOr(animal.marca, 'Sem marca');
      return {
        id: String(animal.id),
        numero,
        marca,
        nome: hasText(animal.nome) ? String(animal.nome).trim() : '',
        situacao: hasText(animal.situacao) ? String(animal.situacao) : '',
        label: `${numero} · ${marca}`,
        // F09: último peso registrado (base da dose sugerida na aplicação avulsa, com aviso de idade do peso).
        ultimoPesoKg: Number(animal.ultimo_peso_kg) > 0 ? Number(animal.ultimo_peso_kg) : null,
        ultimaPesagemData: hasText(animal.ultima_pesagem_data) ? String(animal.ultima_pesagem_data) : null,
        numeroNormalizado: normalizeText(animal.numero_animal),
        busca: normalizeText(`${animal.numero_animal ?? ''} ${animal.marca ?? ''} ${animal.nome ?? ''}`),
      };
    })
    .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }) || a.marca.localeCompare(b.marca, 'pt-BR'));
  return { list, byId: new Map(list.map((item) => [item.id, item])) };
}

/** Busca por número e/ou marca ("123", "123 ABC", "abc"): número exato primeiro. */
export function searchAnimals(index, term, limit = 12) {
  const normalized = normalizeText(term);
  if (!index?.list?.length) return [];
  if (!normalized) return index.list.slice(0, limit);
  const tokens = normalized.split(' ').filter(Boolean);
  const rank = (item) => (item.numeroNormalizado === tokens[0] ? 0 : item.numeroNormalizado.startsWith(tokens[0]) ? 1 : 2);
  return index.list
    .filter((item) => tokens.every((token) => item.busca.includes(token)))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}

/** Número e marca exibidos numa aplicação: dado da linha (se o serviço trouxer) ou do índice. */
export function applicationAnimal(row, animalsById, loading = false) {
  const animal = animalsById?.get?.(String(row?.animal_id ?? '')) || null;
  if (hasText(row?.numero_animal) || hasText(row?.marca)) {
    return { numero: textOr(row.numero_animal), marca: textOr(row.marca) };
  }
  if (animal) return { numero: animal.numero, marca: animal.marca };
  if (loading && row?.animal_id) return { numero: '…', marca: '…' };
  return { numero: row?.animal_id ? 'Animal não encontrado' : EMPTY_TEXT, marca: EMPTY_TEXT };
}

/** Mais recentes primeiro: data da aplicação, depois criação e id (ordem estável). */
export function sortApplicationsNewestFirst(rows = []) {
  return [...rows].sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? ''))
    || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    || String(b.id ?? '').localeCompare(String(a.id ?? '')));
}

// ---------------------------------------------------------------------------
// Colunas (texto por linha; `tone` vira distintivo na tabela).
// ---------------------------------------------------------------------------
export const PROGRAMA_COLUMNS = [
  { id: 'nome', label: 'Nome', width: 240, strong: true, text: (row) => textOr(row.nome) },
  { id: 'tipo', label: 'Tipo', width: 150, text: (row, ctx) => labelOf(ctx?.tipoLabels, row.tipo) },
  { id: 'descricao', label: 'Descrição', width: 320, text: (row) => textOr(row.descricao) },
  { id: 'ordem', label: 'Ordem', width: 90, numeric: true, text: (row) => (Number.isFinite(Number(row.ordem)) && hasText(row.ordem) ? String(row.ordem) : EMPTY_TEXT) },
  { id: 'situacao', label: 'Situação', width: 110, text: situacaoCadastro, tone: (row) => (row.ativo === false ? 'inactive' : 'active') },
];

export const MEDICAMENTO_COLUMNS = [
  { id: 'nome', label: 'Nome', width: 220, strong: true, text: (row) => textOr(row.nome) },
  { id: 'principio_ativo', label: 'Princípio ativo', width: 170, text: (row) => textOr(row.principio_ativo) },
  { id: 'fabricante', label: 'Fabricante', width: 160, text: (row) => textOr(row.fabricante) },
  { id: 'unidade_padrao', label: 'Unidade padrão', width: 120, text: (row) => textOr(row.unidade_padrao) },
  { id: 'dose_padrao', label: 'Dose padrão', width: 150, text: (row) => textOr(row.dose_padrao) },
  { id: 'via_aplicacao', label: 'Via', width: 150, text: (row, ctx) => labelOf(ctx?.viaLabels, row.via_aplicacao) },
  { id: 'carencia_dias', label: 'Carência (dias)', width: 130, text: (row) => formatCarencia(row.carencia_dias) },
  { id: 'observacao', label: 'Observação', width: 240, text: (row) => textOr(row.observacao) },
  { id: 'situacao', label: 'Situação', width: 110, text: situacaoCadastro, tone: (row) => (row.ativo === false ? 'inactive' : 'active') },
];

export const APLICACAO_COLUMNS = [
  { id: 'data', label: 'Data', width: 104, text: (row) => formatDateBR(row.data) },
  { id: 'animal', label: 'Animal', width: 130, strong: true, text: (row, ctx) => applicationAnimal(row, ctx?.animalsById, ctx?.animalsLoading).numero },
  { id: 'marca', label: 'Marca', width: 120, text: (row, ctx) => applicationAnimal(row, ctx?.animalsById, ctx?.animalsLoading).marca },
  { id: 'programa', label: 'Programa', width: 180, text: programaNomeDe },
  { id: 'medicamento', label: 'Medicamento', width: 180, text: medicamentoNomeDe },
  { id: 'dose', label: 'Dose', width: 110, text: (row) => formatDose(row.dose, row.unidade) },
  { id: 'via', label: 'Via', width: 140, text: (row, ctx) => labelOf(ctx?.viaLabels, row.via_aplicacao) },
  { id: 'observacao', label: 'Observação', width: 220, text: (row) => textOr(row.observacao) },
  { id: 'responsavel', label: 'Responsável', width: 150, text: (row) => textOr(row.created_by_nome) },
  { id: 'origem', label: 'Origem', width: 110, text: origemAplicacao, tone: (row) => (row.pesagem_id ? 'launch' : 'standalone') },
  { id: 'situacao', label: 'Situação', width: 110, text: situacaoAplicacao, tone: (row) => (isApplicationCancelled(row) ? 'cancelled' : 'active') },
];

/** Pesquisa livre sem acento nem caixa sobre o texto de todas as colunas. */
export function matchesSanitySearch(row, columns, term, ctx) {
  const normalized = normalizeText(term);
  if (!normalized) return true;
  return columns.some((column) => normalizeText(column.text(row, ctx)).includes(normalized));
}

// ---------------------------------------------------------------------------
// Formulários (texto digitado ⇄ entrada do serviço). O serviço valida de novo.
// ---------------------------------------------------------------------------
const cleanOrNull = (value) => (hasText(value) ? String(value).trim().replace(/\s+/g, ' ') : null);
const multilineOrNull = (value) => (hasText(value) ? String(value).trim() : null);

function parseNonNegativeInteger(value) {
  if (!hasText(value)) return { value: null, valid: true };
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return { value: null, valid: false };
  return { value: Number(text), valid: true };
}

export const emptyProgramaForm = () => ({ nome: '', tipo: 'VACINACAO', descricao: '', ordem: '' });

export function programaFormFromRecord(record) {
  return {
    nome: record?.nome ?? '',
    tipo: record?.tipo ?? 'VACINACAO',
    descricao: record?.descricao ?? '',
    ordem: hasText(record?.ordem) ? String(record.ordem) : '',
  };
}

export function validateProgramaForm(form, tipos = []) {
  const erros = [];
  if (!hasText(form?.nome)) erros.push('Informe o nome do programa ou procedimento.');
  if (!tipos.includes(form?.tipo)) erros.push('Escolha o tipo do programa.');
  if (!parseNonNegativeInteger(form?.ordem).valid) erros.push('A ordem deve ser um número inteiro maior ou igual a zero.');
  return erros;
}

export function programaInputFromForm(form, { id, empresaId } = {}) {
  return {
    ...(id ? { id } : { empresa_id: empresaId }),
    nome: cleanOrNull(form.nome),
    tipo: form.tipo,
    descricao: multilineOrNull(form.descricao),
    ordem: parseNonNegativeInteger(form.ordem).value,
  };
}

export const emptyMedicamentoForm = () => ({
  nome: '', principio_ativo: '', fabricante: '', unidade_padrao: '', dose_padrao: '', via_aplicacao: '', carencia_dias: '', observacao: '',
});

export function medicamentoFormFromRecord(record) {
  const base = emptyMedicamentoForm();
  return Object.fromEntries(Object.keys(base).map((key) => [key, hasText(record?.[key]) ? String(record[key]) : '']));
}

export function validateMedicamentoForm(form, { unidades = [], vias = [] } = {}) {
  const erros = [];
  if (!hasText(form?.nome)) erros.push('Informe o nome do medicamento ou produto.');
  if (hasText(form?.unidade_padrao) && !unidades.includes(form.unidade_padrao)) erros.push('Escolha uma unidade padrão válida.');
  if (hasText(form?.via_aplicacao) && !vias.includes(form.via_aplicacao)) erros.push('Escolha uma via de aplicação válida.');
  if (!parseNonNegativeInteger(form?.carencia_dias).valid) erros.push('A carência deve ser um número inteiro de dias (0 ou mais).');
  return erros;
}

export function medicamentoInputFromForm(form, { id, empresaId } = {}) {
  return {
    ...(id ? { id } : { empresa_id: empresaId }),
    nome: cleanOrNull(form.nome),
    principio_ativo: cleanOrNull(form.principio_ativo),
    fabricante: cleanOrNull(form.fabricante),
    unidade_padrao: cleanOrNull(form.unidade_padrao),
    // Dose padrão é texto livre de referência ("1 ml / 50 kg", "10"); não há cálculo por peso.
    dose_padrao: cleanOrNull(form.dose_padrao),
    via_aplicacao: cleanOrNull(form.via_aplicacao),
    carencia_dias: parseNonNegativeInteger(form.carencia_dias).value,
    observacao: multilineOrNull(form.observacao),
  };
}

export const emptyAplicacaoForm = (now = new Date()) => ({
  animal: null, data: todayIso(now), programa_sanidade_id: '', medicamento_id: '', dose: '', unidade: '', via_aplicacao: '', observacao: '',
});

/**
 * Ao escolher o medicamento, preenche unidade, via e dose sugerida só nos campos ainda
 * vazios (o que o operador digitou nunca é sobrescrito). `suggestDose` é
 * sanityService.suggestedDose: número quando a dose padrão é só um número; senão null.
 */
export function applyMedicamentoDefaults(form, medicamento, suggestDose = () => null) {
  if (!medicamento) return form;
  const sugerida = suggestDose(medicamento);
  return {
    ...form,
    unidade: hasText(form.unidade) ? form.unidade : (medicamento.unidade_padrao || ''),
    via_aplicacao: hasText(form.via_aplicacao) ? form.via_aplicacao : (medicamento.via_aplicacao || ''),
    dose: hasText(form.dose) ? form.dose : (Number.isFinite(sugerida) && sugerida > 0 ? String(sugerida).replace('.', ',') : ''),
  };
}

export function validateAplicacaoForm(form, now = new Date()) {
  const erros = [];
  if (!form?.animal?.id) erros.push('Escolha o animal pelo número ou marca.');
  const data = parseCivilDate(form?.data);
  if (!data) erros.push('Informe a data da aplicação.');
  else if (isFutureCivilDate(data, now)) erros.push('A data da aplicação não pode ser futura.');
  if (!hasText(form?.programa_sanidade_id) && !hasText(form?.medicamento_id)) erros.push('Escolha o programa ou o medicamento aplicado.');
  if (hasText(form?.dose)) {
    const dose = parseBrazilianNumber(form.dose);
    if (dose === null || dose <= 0) erros.push('A dose deve ser um número maior que zero.');
  }
  return erros;
}

export function aplicacaoInputFromForm(form) {
  return {
    animal_id: form.animal?.id ?? null,
    data: parseCivilDate(form.data),
    programa_sanidade_id: cleanOrNull(form.programa_sanidade_id),
    medicamento_id: cleanOrNull(form.medicamento_id),
    dose: hasText(form.dose) ? parseBrazilianNumber(form.dose) : null,
    unidade: cleanOrNull(form.unidade),
    via_aplicacao: cleanOrNull(form.via_aplicacao),
    observacao: multilineOrNull(form.observacao),
    ...(form.posologia ? {
      posologia_id: form.posologia.posologia_id,
      dose_sugerida: form.posologia.dose_sugerida,
      peso_base_kg: form.posologia.peso_base_kg,
      peso_base_data: form.posologia.peso_base_data,
      peso_base_origem: form.posologia.peso_base_origem,
      dose_confirmada: form.posologia.confirmada === true,
    } : {}),
  };
}

// ---------------------------------------------------------------------------
// Filtros do histórico de aplicações → consulta do serviço.
// ---------------------------------------------------------------------------
export const emptyAplicacaoFilters = () => ({ animal: null, from: '', to: '', programaId: '', medicamentoId: '', includeCancelled: false });

export function hasActiveAplicacaoFilters(filters) {
  return Boolean(filters?.animal || filters?.from || filters?.to || filters?.programaId || filters?.medicamentoId || filters?.includeCancelled);
}

/** { query } para listApplications, ou { error } quando o período está invertido. */
export function applicationQueryFromFilters(filters, empresaId) {
  const from = parseCivilDate(filters?.from);
  const to = parseCivilDate(filters?.to);
  if (from && to && from > to) return { error: 'A data inicial do período é posterior à data final.' };
  return {
    query: {
      ...(filters?.animal?.id ? { animalId: filters.animal.id } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(filters?.programaId ? { programaId: filters.programaId } : {}),
      ...(filters?.medicamentoId ? { medicamentoId: filters.medicamentoId } : {}),
      includeCancelled: Boolean(filters?.includeCancelled),
      ...(empresaId ? { empresaId } : {}),
    },
  };
}

/** Opções de seleção: ativos + o valor já escolhido (mesmo inativo), por nome. */
export function catalogOptions(records = [], selectedId = '') {
  return records
    .filter((record) => record.ativo !== false || record.id === selectedId)
    .map((record) => ({ value: record.id, label: record.ativo === false ? `${record.nome} (inativo)` : record.nome }));
}

export function describeSanityError(error, fallback = 'A operação não pôde ser concluída.') {
  return hasText(error?.message) ? String(error.message) : fallback;
}
