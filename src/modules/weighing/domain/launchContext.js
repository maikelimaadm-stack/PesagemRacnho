// Contexto fixo por sequência do Lançamento de Pesagens (programa sanity-launch-import, fatia C).
//
// O operador lança dezenas de animais seguidos com a mesma configuração (tipo,
// data, marca, apartação, motivo, embarque, sanidade...). Este módulo PURO separa,
// campo a campo e por modo, o que é CONTEXTO da sequência (fica depois de salvar)
// do que é DADO DO ANIMAL (nunca atravessa um salvamento, uma troca de modo ou uma
// edição). A página só monta o snapshot dos estados e aplica o resultado: as regras
// vivem aqui e são verificadas por scripts/verify-launch-sticky-context.mjs.
//
// Corrige os vazamentos V-01..V-09 e os resets R-01..R-04 mapeados em
// docs/evidence/operational-reconciliation-preflight/CURRENT-LAUNCH-FLOW.md §22.
import { parseBrazilianNumber } from './brazilianValues.js';

export const LAUNCH_MODES = Object.freeze(['Cadastro', 'Manejo', 'Saída']);
// Categoria do Cadastro: "Automático" escolhe pelo sexo e pela faixa de peso da categoria.
export const CATEGORIA_AUTOMATICA = '__auto__';
// Transferência de lote: '' = Automático (pela faixa de peso), 'NENHUM' = sem lote.
export const LOTE_AUTOMATICO = '';
export const LOTE_SEM_LOTE = 'NENHUM';
// Mesmos valores de operationalPolicies (o gate confere a igualdade); repetidos aqui
// para o módulo continuar puro (operationalPolicies importa a configuração do banco).
export const RENDIMENTO_ORIGEM_INFORMADO = 'INFORMADO';
export const RENDIMENTO_ORIGEM_PADRAO_EMPRESA = 'PADRAO_EMPRESA';
// Motivos de saída que usam embarque e documento (GTA/NF-e).
export const EXIT_REASONS_WITH_SHIPMENT = Object.freeze(['Venda', 'Abate']);
// Modos em que o painel de Sanidade aparece (a saída encerra a vida do animal no rebanho).
export const SANITY_MODES = Object.freeze(['Cadastro', 'Manejo']);

export const exitReasonUsesShipment = (motivo) => EXIT_REASONS_WITH_SHIPMENT.includes(motivo);
export const modeSupportsSanity = (mode) => SANITY_MODES.includes(mode);

const PADROES_VAZIOS = Object.freeze({ marca: '', marcaId: '', raca: '', racaId: '', apartacaoSelecionada: '', rendimento: '' });
const text = (value) => (value === null || value === undefined ? '' : String(value));

function normalizeDefaults(defaults) {
  const source = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    marca: text(source.marca), marcaId: text(source.marcaId),
    raca: text(source.raca), racaId: text(source.racaId),
    apartacaoSelecionada: text(source.apartacaoSelecionada),
    rendimento: text(source.rendimento),
  };
}

/**
 * Formulário vazio do Lançamento com os padrões da empresa (marca/raça/apartação/
 * rendimento vêm da configuração e dos cadastros mestres — nunca de valor fixo, ADR-025).
 * As chaves são exatamente os estados do formulário da página (FORM_FIELDS).
 */
export function blankForm(defaults = PADROES_VAZIOS) {
  const padroes = normalizeDefaults(defaults);
  return {
    // Evento corrente
    editingId: null,
    tipoManejo: 'Manejo',
    dataPesagem: '',
    numeroAnimal: '',
    animalIdSelecionado: '',
    peso: '',
    observacao: '',
    avisoTela: null,
    era: '',
    // Cadastro
    sexo: 'M',
    raca: padroes.raca,
    racaId: padroes.racaId,
    marca: padroes.marca,
    marcaId: padroes.marcaId,
    categoriaSelecao: CATEGORIA_AUTOMATICA,
    apartacaoSelecionada: padroes.apartacaoSelecionada,
    loteTransferencia: LOTE_AUTOMATICO,
    mostrarSequenciaBrinco: false,
    mostrarDadosCompra: false,
    valorPagoCabeca: '',
    origemAnimal: '',
    numeroGTA: '',
    numeroNFeCompra: '',
    valorFreteCompra: '',
    observacoesCompra: '',
    // Saída
    motivoSaida: '',
    causaMorte: '',
    repetirCausaMorte: false,
    mostrarDadosVenda: false,
    comprador: '',
    valorVendaTotal: '',
    valorArroba: '',
    rendimentoCarcacaVenda: padroes.rendimento,
    rendimentoOrigemVenda: RENDIMENTO_ORIGEM_PADRAO_EMPRESA,
    destinoVenda: '',
    numeroGTAVenda: '',
    numeroNFeVenda: '',
    valorFreteVenda: '',
    observacoesVenda: '',
    mostrarDadosAbate: false,
    frigorifico: '',
    valorArrobaAbate: '',
    rendimentoCarcacaAbate: padroes.rendimento,
    rendimentoOrigemAbate: RENDIMENTO_ORIGEM_PADRAO_EMPRESA,
    valorTotalAbate: '',
    numeroGTAAbate: '',
    observacoesAbate: '',
    embarqueSelecionadoDoc: '',
    documentoSelecionado: '',
    // Sanidade (painel do formulário)
    mostrarSanidade: false,
    sanidadeSequencia: false,
    sanidadeAplicacoes: [],
  };
}

export const FORM_FIELDS = Object.freeze(Object.keys(blankForm()));

const BOOLEAN_FIELDS = new Set(['mostrarSequenciaBrinco', 'mostrarDadosCompra', 'repetirCausaMorte', 'mostrarDadosVenda', 'mostrarDadosAbate', 'mostrarSanidade', 'sanidadeSequencia']);

// Campos compartilhados por todos os modos: trocar de modo não os troca.
export const SHARED_CONTEXT_FIELDS = Object.freeze(['dataPesagem']);

// Dado do animal/evento corrente e valores monetários individuais: NUNCA preservados.
// "Valor individual" = valor digitado que pertence a este lançamento (valor por cabeça,
// valor total do animal, frete digitado no lançamento). Preço da arroba e rendimento são
// termos da negociação (contexto), não do animal.
const EVENT_FIELDS = ['editingId', 'numeroAnimal', 'animalIdSelecionado', 'peso', 'observacao', 'avisoTela', 'era'];
const INDIVIDUAL_VALUE_FIELDS = ['valorPagoCabeca', 'valorFreteCompra', 'valorVendaTotal', 'valorTotalAbate', 'valorFreteVenda'];

export const ANIMAL_FIELDS = Object.freeze({
  Cadastro: Object.freeze([...EVENT_FIELDS, ...INDIVIDUAL_VALUE_FIELDS]),
  Manejo: Object.freeze([...EVENT_FIELDS, ...INDIVIDUAL_VALUE_FIELDS]),
  Saída: Object.freeze([...EVENT_FIELDS, ...INDIVIDUAL_VALUE_FIELDS]),
});

const SANITY_CONTEXT = ['mostrarSanidade', 'sanidadeSequencia', 'sanidadeAplicacoes'];
const APARTATION_CONTEXT = ['apartacaoSelecionada', 'loteTransferencia'];

// Contexto preservado por modo. Campos marcados em CONDITIONAL_STICKY_RULES só ficam
// quando a regra permite; os demais campos do formulário que não aparecem no modo
// ficam em branco (vêm do contexto do próprio modo ao trocar).
export const STICKY_FIELDS = Object.freeze({
  Cadastro: Object.freeze([
    'tipoManejo', 'dataPesagem',
    'sexo', 'raca', 'racaId', 'marca', 'marcaId', 'categoriaSelecao',
    ...APARTATION_CONTEXT,
    'mostrarSequenciaBrinco', 'mostrarDadosCompra', 'origemAnimal', 'numeroGTA', 'numeroNFeCompra', 'observacoesCompra',
    ...SANITY_CONTEXT,
  ]),
  Manejo: Object.freeze([
    'tipoManejo', 'dataPesagem',
    ...APARTATION_CONTEXT,
    ...SANITY_CONTEXT,
  ]),
  Saída: Object.freeze([
    'tipoManejo', 'dataPesagem',
    'motivoSaida', 'causaMorte', 'repetirCausaMorte',
    ...APARTATION_CONTEXT,
    'mostrarDadosVenda', 'comprador', 'destinoVenda', 'valorArroba', 'rendimentoCarcacaVenda', 'rendimentoOrigemVenda',
    'numeroGTAVenda', 'numeroNFeVenda', 'observacoesVenda',
    'mostrarDadosAbate', 'frigorifico', 'valorArrobaAbate', 'rendimentoCarcacaAbate', 'rendimentoOrigemAbate',
    'numeroGTAAbate', 'observacoesAbate',
    'embarqueSelecionadoDoc', 'documentoSelecionado',
  ]),
});

// Documentação das regras condicionais (aplicadas em contextOf).
export const CONDITIONAL_STICKY_RULES = Object.freeze({
  categoriaSelecao: 'Somente categoria MANUAL; "Automático" continua automático e recalcula pelo próximo peso.',
  loteTransferencia: 'Automático e "Sem lote" ficam; um lote escolhido à mão vale só para o animal salvo (V-09).',
  causaMorte: 'Somente com "Repetir causa para os próximos" marcado e motivo Morte (V-03).',
  repetirCausaMorte: 'Só existe com motivo Morte.',
  embarqueSelecionadoDoc: 'Somente quando o motivo usa embarque/documento (Venda/Abate) (V-04).',
  documentoSelecionado: 'Somente quando o motivo usa embarque/documento (Venda/Abate) (V-04).',
  sanidadeAplicacoes: 'Somente com "Aplicar esta configuração aos próximos animais" marcado; observação sempre limpa.',
});

/** Classificação de um campo no modo: 'sticky' (contexto), 'animal' (nunca fica) ou 'inactive' (não usado no modo). */
export function classifyField(mode, field) {
  assertMode(mode);
  if (STICKY_FIELDS[mode].includes(field)) return 'sticky';
  if (ANIMAL_FIELDS[mode].includes(field)) return 'animal';
  return 'inactive';
}

function assertMode(mode) {
  if (!LAUNCH_MODES.includes(mode)) throw new Error(`Tipo de movimentação desconhecido: ${mode}`);
}

const hasField = (object, field) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, field);

// ---------------------------------------------------------------------------
// Sanidade: rascunhos de aplicação do painel do formulário.

let draftSequence = 0;
const DRAFT_FIELDS = ['programa_sanidade_id', 'medicamento_id', 'dose', 'unidade', 'via_aplicacao', 'observacao'];
// F09: dose pela posologia aprovada — campos do ANIMAL atual (peso usado, sugestão, confirmação). Nunca seguem
// para o próximo animal nem para o sessionStorage do contexto: o próximo tem outro peso.
const POSOLOGY_FIELDS = ['posologia_id', 'dose_sugerida', 'peso_base_kg', 'peso_base_data', 'peso_base_origem', 'dose_confirmada'];

/** Rascunho de aplicação (valores de formulário em texto; `key` só identifica a linha na tela). */
export function newSanityDraft(template = {}) {
  draftSequence += 1;
  const source = template && typeof template === 'object' ? template : {};
  const draft = { key: text(source.key) || `sanidade-${draftSequence}` };
  for (const field of DRAFT_FIELDS) draft[field] = text(source[field]);
  for (const field of POSOLOGY_FIELDS) if (source[field] !== undefined && source[field] !== null && source[field] !== '') draft[field] = text(source[field]);
  return draft;
}

/** Remove a dose calculada (posologia, sugestão, peso e confirmação) — volta a ser dose manual. */
export function clearPosologyFromDraft(draft) {
  const next = { ...draft };
  for (const field of POSOLOGY_FIELDS) delete next[field];
  return next;
}

const draftHasProduct = (draft) => Boolean(text(draft?.programa_sanidade_id) || text(draft?.medicamento_id));
const draftIsEmpty = (draft) => DRAFT_FIELDS.every((field) => !text(draft?.[field]).trim());

/** Configuração que segue para o próximo animal: programa, medicamento, dose, unidade e via; observação nunca. */
export function sanityDraftsAfterSave(drafts, sequencia) {
  if (sequencia !== true || !Array.isArray(drafts)) return [];
  return drafts.filter(draftHasProduct).map((draft) => {
    const next = { ...clearPosologyFromDraft(newSanityDraft(draft)), observacao: '' };
    // Dose calculada pelo peso do animal anterior não segue: o próximo recalcula.
    if (draft.posologia_id) next.dose = '';
    return next;
  });
}

/** Dose sugerida no formato do campo (vírgula decimal) ou '' quando não há número. */
export function formatDoseInput(value) {
  const number = typeof value === 'number' ? value : parseBrazilianNumber(value);
  return Number.isFinite(number) && number > 0 ? String(number).replace('.', ',') : '';
}

/**
 * Escolher o medicamento pré-preenche dose (só quando a dose padrão é um número —
 * `suggestedDose` do sanityService), unidade e via. Sem cálculo de dose por peso.
 */
export function applyMedicamentoToDraft(draft, medicamento, dosePadrao = null) {
  const next = { ...clearPosologyFromDraft(newSanityDraft(draft)), medicamento_id: text(medicamento?.id) };
  if (!medicamento) return next;
  next.dose = formatDoseInput(dosePadrao);
  if (medicamento.unidade_padrao) next.unidade = text(medicamento.unidade_padrao);
  if (medicamento.via_aplicacao) next.via_aplicacao = text(medicamento.via_aplicacao);
  return next;
}

/**
 * Monta `payload.aplicacoes_sanidade` do createEntry a partir dos rascunhos.
 * Linhas totalmente vazias são ignoradas; linha preenchida sem programa e sem
 * medicamento, dose inválida ou cadastro inativo viram erros (nada é gravado).
 */
export function buildSanityPayload(drafts, { programaIds = null, medicamentoIds = null } = {}) {
  const errors = [];
  const payload = [];
  const programas = programaIds ? new Set([...programaIds].map(String)) : null;
  const medicamentos = medicamentoIds ? new Set([...medicamentoIds].map(String)) : null;
  (Array.isArray(drafts) ? drafts : []).forEach((draft, index) => {
    if (draftIsEmpty(draft)) return;
    const rotulo = `Aplicação de sanidade ${index + 1}`;
    const programaId = text(draft.programa_sanidade_id).trim();
    const medicamentoId = text(draft.medicamento_id).trim();
    if (!programaId && !medicamentoId) {
      errors.push(`${rotulo}: escolha o programa ou o medicamento.`);
      return;
    }
    if (programaId && programas && !programas.has(programaId)) errors.push(`${rotulo}: o programa escolhido não está ativo.`);
    if (medicamentoId && medicamentos && !medicamentos.has(medicamentoId)) errors.push(`${rotulo}: o medicamento escolhido não está ativo.`);
    const doseTexto = text(draft.dose).trim();
    const dose = doseTexto ? parseBrazilianNumber(doseTexto) : null;
    if (doseTexto && !(Number.isFinite(dose) && dose > 0)) errors.push(`${rotulo}: a dose deve ser um número maior que zero.`);
    const posologiaId = text(draft.posologia_id).trim();
    if (posologiaId && text(draft.dose_confirmada) !== 'true') errors.push(`${rotulo}: confirme a dose aplicada (calculada pela posologia).`);
    if (posologiaId && !(Number.isFinite(dose) && dose > 0)) errors.push(`${rotulo}: informe a dose aplicada.`);
    payload.push({
      programa_sanidade_id: programaId || null,
      medicamento_id: medicamentoId || null,
      dose: Number.isFinite(dose) && dose > 0 ? dose : null,
      unidade: text(draft.unidade).trim() || null,
      via_aplicacao: text(draft.via_aplicacao).trim() || null,
      observacao: text(draft.observacao).trim() || null,
      ...(posologiaId ? {
        posologia_id: posologiaId,
        dose_sugerida: parseBrazilianNumber(text(draft.dose_sugerida)),
        dose_confirmada: true,
        peso_base_kg: parseBrazilianNumber(text(draft.peso_base_kg)),
        peso_base_data: text(draft.peso_base_data) || null,
        peso_base_origem: text(draft.peso_base_origem) || null,
      } : {}),
    });
  });
  return { ok: errors.length === 0, errors, payload: errors.length ? [] : payload };
}

// ---------------------------------------------------------------------------
// Contexto por modo.

function coerce(field, value) {
  if (BOOLEAN_FIELDS.has(field)) return value === true;
  if (field === 'sanidadeAplicacoes') return Array.isArray(value) ? value.map((draft) => clearPosologyFromDraft(newSanityDraft(draft))) : [];
  return text(value);
}

/**
 * Contexto do modo extraído de um formulário: só os campos de STICKY_FIELDS[mode],
 * com as regras condicionais aplicadas. Nunca contém dado do animal — por isso é
 * também o que vai para o sessionStorage.
 */
export function contextOf(mode, form = {}) {
  assertMode(mode);
  const source = { ...blankForm(), ...(form && typeof form === 'object' ? form : {}) };
  const context = {};
  for (const field of STICKY_FIELDS[mode]) context[field] = coerce(field, source[field]);
  context.tipoManejo = mode;
  if (![LOTE_AUTOMATICO, LOTE_SEM_LOTE].includes(context.loteTransferencia)) context.loteTransferencia = LOTE_AUTOMATICO;
  if (!context.categoriaSelecao && hasField(context, 'categoriaSelecao')) context.categoriaSelecao = CATEGORIA_AUTOMATICA;
  if (mode === 'Saída') {
    if (context.motivoSaida !== 'Morte') context.repetirCausaMorte = false;
    if (!context.repetirCausaMorte) context.causaMorte = '';
    if (!exitReasonUsesShipment(context.motivoSaida)) {
      context.embarqueSelecionadoDoc = '';
      context.documentoSelecionado = '';
    }
  }
  if (hasField(context, 'sanidadeAplicacoes')) {
    context.sanidadeAplicacoes = sanityDraftsAfterSave(context.sanidadeAplicacoes, context.sanidadeSequencia);
  }
  return context;
}

/**
 * Formulário do modo a partir de um contexto guardado (ou dos padrões da empresa,
 * quando o modo ainda não tem contexto). Campos compartilhados (data) vêm do
 * formulário atual; dados do animal começam vazios. `proximoNumero` preenche o
 * Nº quando a sequência de identificadores do Cadastro está ativa.
 */
export function applyContext(mode, form, context, { defaults = PADROES_VAZIOS, proximoNumero = null } = {}) {
  assertMode(mode);
  const base = blankForm(defaults);
  const restored = contextOf(mode, { ...base, ...(context && typeof context === 'object' ? context : {}) });
  const next = { ...base, ...restored, tipoManejo: mode };
  for (const field of SHARED_CONTEXT_FIELDS) {
    if (hasField(form, field)) next[field] = text(form[field]);
  }
  if (mode === 'Cadastro' && proximoNumero) next.numeroAnimal = text(proximoNumero);
  return next;
}

/** Troca de modo: guarda o contexto do modo atual e restaura o do novo modo. */
export function switchMode(form, nextMode, contexts = {}, options = {}) {
  assertMode(nextMode);
  const currentMode = form?.tipoManejo;
  const nextContexts = { ...(contexts || {}) };
  if (currentMode === nextMode) return { form: { ...form }, contexts: nextContexts };
  if (LAUNCH_MODES.includes(currentMode)) nextContexts[currentMode] = contextOf(currentMode, form);
  return { form: applyContext(nextMode, form, nextContexts[nextMode] || null, options), contexts: nextContexts };
}

/**
 * Formulário depois de salvar um animal NOVO: mantém o contexto do modo e limpa o
 * animal. Construído do snapshot submetido (nunca de um fechamento antigo — V-01).
 */
export function stateAfterSave(mode, form, {
  categoriaModo,
  sequenciaAtiva = false,
  proximoNumero = null,
  repetirCausaMorte,
  sanidadeSequencia,
} = {}) {
  assertMode(mode);
  const submitted = { ...blankForm(), ...(form || {}) };
  if (repetirCausaMorte !== undefined) submitted.repetirCausaMorte = repetirCausaMorte === true;
  if (sanidadeSequencia !== undefined) submitted.sanidadeSequencia = sanidadeSequencia === true;
  if (categoriaModo === 'AUTOMATICA') submitted.categoriaSelecao = CATEGORIA_AUTOMATICA;
  const next = { ...submitted, ...contextOf(mode, submitted) };
  const vazio = blankForm();
  for (const field of ANIMAL_FIELDS[mode]) next[field] = vazio[field];
  next.numeroAnimal = mode === 'Cadastro' && sequenciaAtiva && proximoNumero ? text(proximoNumero) : '';
  return next;
}

/**
 * Foco depois de salvar: SEMPRE o Nº/Identificação (pedido do responsável em 17/09/2026).
 * Quem lança no curral digita o próximo animal em seguida; mesmo com a sequência de brincos
 * preenchendo o Nº, o cursor volta para a identificação para conferir ou trocar.
 */
export function focusAfterSave() {
  return 'numero';
}

/** Trocar o motivo da saída: causa recomeça; motivo sem embarque/documento solta esses vínculos (V-04). */
export function changeExitReason(form, motivo) {
  const next = { ...form, motivoSaida: text(motivo), causaMorte: '' };
  if (next.motivoSaida !== 'Morte') next.repetirCausaMorte = false;
  if (!exitReasonUsesShipment(next.motivoSaida)) {
    next.embarqueSelecionadoDoc = '';
    next.documentoSelecionado = '';
  }
  return next;
}

/**
 * Abrir um registro para edição: guarda o contexto atual (modo + contexto + data) e
 * devolve um formulário limpo para receber o registro — apartação/lote vazios, para
 * que um registro sem apartação não herde a do contexto (V-05, V-06). Preferências
 * de exibição dos painéis continuam como estavam.
 */
export function beginEdit(form, { defaults = PADROES_VAZIOS } = {}) {
  const mode = LAUNCH_MODES.includes(form?.tipoManejo) ? form.tipoManejo : 'Manejo';
  const savedContext = { mode, context: contextOf(mode, form), dataPesagem: text(form?.dataPesagem) };
  const editForm = {
    ...blankForm(defaults),
    tipoManejo: mode,
    dataPesagem: savedContext.dataPesagem,
    apartacaoSelecionada: '',
    loteTransferencia: LOTE_AUTOMATICO,
  };
  for (const field of ['mostrarSequenciaBrinco', 'mostrarDadosCompra', 'mostrarDadosVenda', 'mostrarDadosAbate']) {
    editForm[field] = form?.[field] === true;
  }
  return { form: editForm, savedContext };
}

/** Atualizar ou Cancelar a edição: volta exatamente ao contexto anterior (R-01). */
export function endEdit(savedContext, { form = null, defaults = PADROES_VAZIOS, proximoNumero = null } = {}) {
  if (!savedContext || !LAUNCH_MODES.includes(savedContext.mode)) {
    const mode = LAUNCH_MODES.includes(form?.tipoManejo) ? form.tipoManejo : 'Manejo';
    return applyContext(mode, form, null, { defaults, proximoNumero });
  }
  const restored = applyContext(savedContext.mode, null, savedContext.context, { defaults, proximoNumero });
  if (savedContext.dataPesagem) restored.dataPesagem = savedContext.dataPesagem;
  return restored;
}

/**
 * Chegada tardia dos catálogos/configuração (R-04): substitui só os campos que ainda
 * estão com o padrão anterior (não tocados); o que o operador já escolheu fica.
 * Serve para o formulário e para contextos parciais (campos ausentes são ignorados).
 */
export function mergeDefaults(form, previousDefaults, nextDefaults) {
  const anterior = normalizeDefaults(previousDefaults);
  const novo = normalizeDefaults(nextDefaults);
  const out = { ...form };
  const intocado = (field, valor) => hasField(form, field) && text(form[field]) === valor;
  if (intocado('marcaId', anterior.marcaId) && intocado('marca', anterior.marca)) {
    out.marcaId = novo.marcaId;
    out.marca = novo.marca;
  }
  if (intocado('racaId', anterior.racaId) && intocado('raca', anterior.raca)) {
    out.racaId = novo.racaId;
    out.raca = novo.raca;
  }
  for (const [valor, origem] of [['rendimentoCarcacaVenda', 'rendimentoOrigemVenda'], ['rendimentoCarcacaAbate', 'rendimentoOrigemAbate']]) {
    if (intocado(valor, anterior.rendimento) && text(form[origem]) !== RENDIMENTO_ORIGEM_INFORMADO) {
      out[valor] = novo.rendimento;
      out[origem] = RENDIMENTO_ORIGEM_PADRAO_EMPRESA;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Persistência na sessão (R-03): sessionStorage por empresa + usuário, só contexto.

export const LAUNCH_CONTEXT_STORAGE_VERSION = 1;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function launchContextStorageKey({ empresaId, usuarioId } = {}) {
  return `lancamento-pesagens:contexto:${text(empresaId) || 'local'}:${text(usuarioId) || 'sem-usuario'}`;
}

/**
 * Snapshot serializável: modo atual, data e o contexto de cada modo já visitado.
 * Em edição persiste o contexto guardado antes da edição, nunca o registro aberto.
 */
export function serializeLaunchState({ form, contexts = {}, savedContext = null } = {}) {
  const editing = Boolean(savedContext && LAUNCH_MODES.includes(savedContext.mode));
  const mode = editing ? savedContext.mode : (LAUNCH_MODES.includes(form?.tipoManejo) ? form.tipoManejo : 'Manejo');
  const atual = editing ? { ...savedContext.context, dataPesagem: savedContext.dataPesagem } : form;
  const contextos = {};
  for (const modo of LAUNCH_MODES) {
    const origem = modo === mode ? atual : contexts?.[modo];
    if (!origem) continue;
    const contexto = contextOf(modo, origem);
    for (const field of SHARED_CONTEXT_FIELDS) delete contexto[field];
    contextos[modo] = contexto;
  }
  const dataPesagem = text(atual?.dataPesagem);
  return { versao: LAUNCH_CONTEXT_STORAGE_VERSION, modo: mode, dataPesagem: ISO_DATE.test(dataPesagem) ? dataPesagem : '', contextos };
}

/** Reconstrói { mode, form, contexts } de um snapshot; `null` quando inválido. */
export function restoreLaunchState(stored, { defaults = PADROES_VAZIOS } = {}) {
  if (!stored || typeof stored !== 'object' || stored.versao !== LAUNCH_CONTEXT_STORAGE_VERSION) return null;
  if (!LAUNCH_MODES.includes(stored.modo)) return null;
  const contexts = {};
  for (const modo of LAUNCH_MODES) {
    const salvo = stored.contextos?.[modo];
    if (!salvo || typeof salvo !== 'object') continue;
    const conhecido = {};
    for (const field of STICKY_FIELDS[modo]) if (hasField(salvo, field)) conhecido[field] = salvo[field];
    contexts[modo] = contextOf(modo, { ...blankForm(defaults), ...conhecido });
  }
  const dataPesagem = ISO_DATE.test(text(stored.dataPesagem)) ? text(stored.dataPesagem) : '';
  const form = applyContext(stored.modo, dataPesagem ? { dataPesagem } : null, contexts[stored.modo] || null, { defaults });
  // Sem data válida guardada, o formulário não traz a chave: a tela mantém a data atual.
  if (!dataPesagem) delete form.dataPesagem;
  return { mode: stored.modo, form, contexts };
}

export function readStoredLaunchState(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredLaunchState(storage, key, state) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sequência automática de identificadores do Cadastro (prefixo + dígitos).

/** "BR007" → { prefixo: 'BR', numero: 7, digitos: 3 }; fora do formato → null. */
export function parseSequenceIdentifier(valor) {
  const match = text(valor).trim().match(/^([A-Za-z]*)(\d+)$/);
  if (!match) return null;
  return { prefixo: match[1].toUpperCase(), numero: Number.parseInt(match[2], 10), digitos: match[2].length };
}

export function formatSequenceIdentifier(prefixo, numero, digitos) {
  return `${text(prefixo).toUpperCase()}${String(numero).padStart(digitos, '0')}`;
}

/**
 * Primeiro identificador livre a partir de `inicio` na direção, até o limite
 * (inclusivo). Sem limite, a busca crescente sempre termina (os usados são finitos)
 * e a decrescente para no zero (B-08: nunca gera número negativo).
 */
export function nextFreeIdentifier({ prefixo, inicio, limite = null, digitos, usados, direcao = 'crescente' }) {
  const passo = direcao === 'decrescente' ? -1 : 1;
  const ocupados = usados instanceof Set ? usados : new Set(usados || []);
  const semLimite = limite === null || limite === undefined;
  const dentro = (numero) => numero >= 0 && (semLimite || (direcao === 'decrescente' ? numero >= limite : numero <= limite));
  let atual = inicio;
  let pulos = 0;
  while (dentro(atual)) {
    const formatado = formatSequenceIdentifier(prefixo, atual, digitos);
    if (!ocupados.has(formatado)) return { numero: atual, formatado, pulos };
    pulos += 1;
    atual += passo;
  }
  return null;
}

/** Avança o cursor depois de salvar: marca o atual como usado e acha o próximo livre. */
export function advanceIdentifierSequence(state, usados) {
  if (!state) return { ok: false, state: null };
  const ocupados = new Set(usados || []);
  ocupados.add(formatSequenceIdentifier(state.prefixo, state.numeroAtual, state.digitos));
  const passo = state.direcao === 'decrescente' ? -1 : 1;
  const livre = nextFreeIdentifier({
    prefixo: state.prefixo,
    inicio: state.numeroAtual + passo,
    limite: state.numeroFinal,
    digitos: state.digitos,
    usados: ocupados,
    direcao: state.direcao,
  });
  if (!livre) return { ok: false, state: null, usados: ocupados };
  return { ok: true, state: { ...state, numeroAtual: livre.numero }, formatado: livre.formatado, pulos: livre.pulos, usados: ocupados };
}
