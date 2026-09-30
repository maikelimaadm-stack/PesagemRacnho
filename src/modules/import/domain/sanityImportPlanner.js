// Planejador puro da importação de APLICAÇÕES DE SANIDADE (tipo SANIDADE, pedido do
// responsável em 17/09/2026). Não lê nem grava banco: o serviço carrega os cadastros, o
// índice de identidade, a série e as aplicações já gravadas dos animais candidatos, e este
// módulo decide a situação de cada linha. Duas fases, como no planejador de eventos:
//   1. prepareSanityImportRows: lê e valida os campos e junta os candidatos de identidade;
//   2. buildSanityImportPlan: resolve o animal pela identidade canônica (animalIdentity),
//      resolve programa e medicamento por NOME normalizado nos cadastros de sanidade,
//      valida a aplicação com as regras do próprio serviço de sanidade
//      (validateApplicationInput), confere a cronologia do animal e marca duplicidade.
//
// Nada de cálculo de dose por peso: dose, unidade e via são os da planilha.
import { normalizeName } from '../../catalog/domain/normalize.js';
import { SanityError, validateApplicationInput } from '../../sanity/domain/sanityRules.js';
import { IDENTITY_STATUS, findIdentityCandidates, resolveAnimalIdentity } from './animalIdentity.js';
import { EVENT_TYPES, IMPORT_TYPES, ROW_STATUS } from './importConstants.js';
import { invertMapping, listImportFields } from './importFields.js';
import { summarizePlan } from './importPlanner.js';
import { resolveRegistryReference } from './importRegistryContext.js';
import { normalizeImportRules } from './importRules.js';
import { cleanImportText, parseImportDate, parseImportDecimal } from './importValues.js';

// Cadastros mestres da sanidade, no mesmo formato de `cadastrosMestresAusentes` usado pelos
// outros tipos (store + rótulo), para a tela e o serviço tratarem tudo igual.
export const SANITY_MASTER_KINDS = Object.freeze({
  programas: Object.freeze({ store: 'programasSanidade', rotulo: 'Programa de sanidade', campo: 'programa' }),
  medicamentos: Object.freeze({ store: 'medicamentos', rotulo: 'Medicamento', campo: 'medicamento' }),
});

// Id provisório de um cadastro que só existirá depois de "criar cadastros ausentes". Serve
// apenas para a VALIDAÇÃO do dry-run não recusar a linha por falta de programa/medicamento;
// nunca chega à gravação (o serviço refaz a análise depois de criar os cadastros e o writer
// recusa qualquer id provisório que sobre).
export const PENDING_MASTER_PREFIX = 'novo:';
export const isPendingMasterId = (id) => typeof id === 'string' && id.startsWith(PENDING_MASTER_PREFIX);

const rawText = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());
const doseKey = (dose) => (dose === null || dose === undefined || dose === '' || !Number.isFinite(Number(dose)) ? '' : Number(dose).toFixed(3));
const labelOf = (numero, marca) => `${numero || '?'} / ${marca || 'sem marca'}`;

/** Chave canônica de uma aplicação: animal + data + programa + medicamento + dose. */
export function applicationKey({ animalId, data, programaId = null, medicamentoId = null, dose = null } = {}) {
  return [String(animalId || ''), data || '', programaId || '', medicamentoId || '', doseKey(dose)].join('|');
}

/**
 * Índices por nome dos cadastros de sanidade da empresa. Mesma régua do resolvedor de
 * cadastros mestres (nome normalizado); inativo NÃO resolve em aplicação nova — o
 * sanityDataAdapter recusa — mas é guardado à parte para a mensagem explicar o porquê.
 */
export function buildSanityRegistryContext({ programas = [], medicamentos = [] } = {}, empresaId = 'local') {
  const index = (rows) => {
    const live = (rows || []).filter((row) => row && !row.deleted_at && (row.empresa_id ?? row.empresaId ?? empresaId) === empresaId);
    const byId = new Map(live.map((row) => [String(row.id), row]));
    const byName = new Map();
    const inactiveByName = new Map();
    for (const row of live) {
      const key = row.nome_normalizado || normalizeName(row.nome);
      if (!key) continue;
      if (row.ativo === false) {
        if (!inactiveByName.has(key)) inactiveByName.set(key, row);
        continue;
      }
      if (!byName.has(key)) byName.set(key, row);
    }
    return { rows: live, byId, byName, inactiveByName };
  };
  return { empresaId, programas: index(programas), medicamentos: index(medicamentos) };
}

// ---------------------------------------------------------------------------
// Fase 1 — leitura e validação de campos
// ---------------------------------------------------------------------------

function newRow(line) {
  return {
    line,
    input: {},
    errors: [],
    messages: [],
    status: null,
    identity: null,
    animal: null,
    marca: null,
    programa: null,
    medicamento: null,
    normalized: null,
    payload: null,
    query: null,
  };
}

function sanityFileErrors(headerByField, file, mapping) {
  const errors = [];
  if (!file.rows.length) errors.push('O arquivo não tem linhas de dados.');
  const headers = new Set(file.headers);
  const validFields = new Set(listImportFields(IMPORT_TYPES.SANIDADE).map((item) => item.id));
  for (const [header, fieldId] of Object.entries(mapping || {})) {
    if (!fieldId) continue;
    if (!validFields.has(fieldId)) errors.push(`O campo "${fieldId}" não existe na importação de aplicações de sanidade.`);
    else if (!headers.has(header)) errors.push(`A coluna "${header}" do mapeamento não existe no arquivo.`);
  }
  for (const item of listImportFields(IMPORT_TYPES.SANIDADE)) {
    if (item.required && !headerByField.has(item.id)) errors.push(`A coluna obrigatória "${item.label}" não foi mapeada.`);
  }
  if (!headerByField.has('programa') && !headerByField.has('medicamento')) {
    errors.push('Mapeie a coluna Programa / Procedimento, a coluna Medicamento / Produto, ou as duas: toda aplicação precisa de ao menos uma delas.');
  }
  return errors;
}

function parseSanityRow(fileRow, get, rules, context, today) {
  const row = newRow(fileRow.line);
  if (context.ignoredLines.has(row.line)) {
    row.status = ROW_STATUS.IGNORADA;
    row.messages.push('Linha ignorada por escolha do usuário.');
    return row;
  }
  const input = row.input;
  input.numero = cleanImportText(get('numero'));
  input.programaTexto = cleanImportText(get('programa'));
  input.medicamentoTexto = cleanImportText(get('medicamento'));
  input.unidade = rawText(get('unidade'));
  input.via_aplicacao = rawText(get('via_aplicacao'));
  input.observacao = rawText(get('observacao'));

  const data = parseImportDate(get('data'), rules.dateFormat, { today });
  if (data.error) row.errors.push(data.error);
  else if (!data.value) row.errors.push('Data da aplicação não informada.');
  input.data = data.value;

  const dose = parseImportDecimal(get('dose'), rules.effectiveDecimal);
  if (dose.error) row.errors.push(`Dose: ${dose.error}`);
  input.dose = dose.value;

  if (!input.programaTexto && !input.medicamentoTexto) {
    row.errors.push('Informe o programa de sanidade ou o medicamento da aplicação.');
  }

  row.marca = resolveRegistryReference(context.registry.marcas, {
    id: get('marca') ? null : rules.fixedValues.marca_id,
    text: cleanImportText(get('marca')),
  });
  row.query = {
    animalId: null,
    numero: input.numero,
    marcaId: row.marca.row?.id ?? null,
    marcaNome: row.marca.row?.nome ?? row.marca.unknownText ?? null,
  };
  return row;
}

/**
 * Fase 1. prepareSanityImportRows({ file, mapping, rules, context, today }) →
 * { type, rules, headerByField, fileErrors, rows, candidateAnimalIds }
 * context = { identityIndex, registry (buildRegistryContext) }.
 */
export function prepareSanityImportRows({ file, mapping, rules: rawRules = {}, context, today = new Date() }) {
  const rules = normalizeImportRules(rawRules, file.headers);
  const headerByField = invertMapping(mapping, IMPORT_TYPES.SANIDADE);
  const fileErrors = sanityFileErrors(headerByField, file, mapping);
  const candidateAnimalIds = new Set();
  const parseContext = { ...context, ignoredLines: new Set(rules.ignoredLines) };
  const rows = file.rows.map((fileRow) => {
    const get = (fieldId) => {
      const header = headerByField.get(fieldId);
      return header === undefined ? null : rawText(fileRow.values[header]);
    };
    const row = parseSanityRow(fileRow, get, rules, parseContext, today);
    if (row.query) {
      for (const animal of findIdentityCandidates(context.identityIndex, row.query).candidates) candidateAnimalIds.add(String(animal.id));
    }
    return row;
  });
  return { type: IMPORT_TYPES.SANIDADE, rules, headerByField, fileErrors, rows, candidateAnimalIds };
}

// ---------------------------------------------------------------------------
// Fase 2 — identidade, cadastros de sanidade, validação e duplicidade
// ---------------------------------------------------------------------------

function lifecycleFrom(series, animal) {
  const registration = (series || []).find((event) => event.tipo_manejo === EVENT_TYPES.CADASTRO) || null;
  const exit = (series || []).find((event) => event.tipo_manejo === EVENT_TYPES.SAIDA) || null;
  return {
    registrationDate: registration?.data_pesagem ?? null,
    exitDate: exit?.data_pesagem ?? animal?.data_saida ?? null,
    exitReason: exit?.motivo_saida ?? animal?.motivo_saida ?? null,
  };
}

function resolveRowAnimal(row, context) {
  const { identityIndex, seriesByAnimal } = context;
  const lifecycleOf = (animal) => lifecycleFrom(seriesByAnimal.get(String(animal.id)) || [], animal);
  const result = resolveAnimalIdentity(identityIndex, row.query, { eventDate: row.input.data, lifecycleOf });
  const marcaNome = row.marca?.row?.nome ?? row.marca?.unknownText ?? null;
  if (result.status === IDENTITY_STATUS.MATCH) {
    const animal = result.animal;
    row.animal = animal;
    row.identity = { key: `id:${animal.id}`, animalId: String(animal.id), isNew: false, label: labelOf(animal.numero_animal, animal.marca), via: result.via };
    // E1G: casou só pelo número parecido ("01016" → 1016); o número do animal não muda.
    if (result.similarNumber) {
      row.identity.similarNumber = { informado: row.input.numero, cadastrado: animal.numero_animal };
      row.messages.push(`Número ${row.input.numero} reconhecido como o animal ${animal.numero_animal} já cadastrado (o mesmo número sem os zeros à esquerda ou sem o ",0" do Excel).`);
    }
    return;
  }
  row.identity = { key: `linha:${row.line}`, animalId: null, isNew: false, label: labelOf(row.input.numero, marcaNome), via: result.via };
  if (result.status === IDENTITY_STATUS.AMBIGUOUS) {
    row.ambiguous = result.message;
    return;
  }
  if (result.status === IDENTITY_STATUS.INVALID || result.status === IDENTITY_STATUS.INELIGIBLE) {
    row.errors.push(result.message);
    return;
  }
  // NONE: a aplicação é um fato sobre um animal que precisa existir.
  row.errors.push(`Animal ${row.identity.label} não encontrado. Importe o Cadastro do animal antes das aplicações de sanidade.`);
}

function noteMissingMaster(work, kind, nome, line) {
  const { store, rotulo } = SANITY_MASTER_KINDS[kind];
  const key = `${store}|${normalizeName(nome)}`;
  const current = work.missingMasters.get(key) || { store, rotulo, nome, linhas: new Set() };
  current.linhas.add(line);
  work.missingMasters.set(key, current);
}

/**
 * Programa/medicamento por NOME normalizado. Ausente vira "cadastro mestre ausente": ERRO,
 * ou segue com id provisório quando o usuário pediu para criar e tem registry.write.
 * Cadastro inativo é ERRO explicado (o serviço de sanidade recusa aplicação nova nele).
 */
function resolveSanityMaster(row, work, kind, texto) {
  if (!texto) return { id: null, row: null };
  const { rotulo } = SANITY_MASTER_KINDS[kind];
  const index = work.sanityRegistry[kind];
  const key = normalizeName(texto);
  const found = index.byName.get(key);
  if (found) return { id: String(found.id), row: found };
  const inactive = index.inactiveByName.get(key);
  if (inactive) {
    row.errors.push(`${rotulo} "${texto}" está inativo(a): reative o cadastro antes de importar as aplicações.`);
    return { id: null, row: null };
  }
  noteMissingMaster(work, kind, texto, row.line);
  if (work.rules.createMissingMasters && work.permissions.canRegistryWrite) {
    row.messages.push(`${rotulo} "${texto}" não cadastrado(a): será criado(a) antes da gravação.`);
    return { id: `${PENDING_MASTER_PREFIX}${SANITY_MASTER_KINDS[kind].store}:${key}`, row: null, pending: true };
  }
  if (work.rules.createMissingMasters) {
    row.errors.push(`${rotulo} "${texto}" não cadastrado(a) e o usuário não tem permissão registry.write para criá-lo(a).`);
  } else {
    row.errors.push(`${rotulo} "${texto}" não cadastrado(a). Cadastre antes ou marque "Criar cadastros ausentes".`);
  }
  return { id: null, row: null };
}

function checkChronology(row, context) {
  const series = context.seriesByAnimal.get(String(row.animal.id)) || [];
  const { registrationDate, exitDate } = lifecycleFrom(series, row.animal);
  if (registrationDate && row.input.data < registrationDate) {
    row.errors.push(`A data ${row.input.data} é anterior ao cadastro do animal (${registrationDate}).`);
  } else if (exitDate && row.input.data > exitDate) {
    row.errors.push(`A data ${row.input.data} é posterior à saída do animal (${exitDate}).`);
  }
}

function describeApplication(row) {
  const nomes = [row.input.programaTexto, row.input.medicamentoTexto].filter(Boolean).join(' / ');
  const dose = row.normalized?.dose ?? null;
  const partes = [nomes || 'Aplicação de sanidade'];
  if (dose !== null) partes.push(`${String(dose).replace('.', ',')}${row.normalized?.unidade ? ` ${row.normalized.unidade}` : ''}`);
  if (row.normalized?.via_aplicacao) partes.push(row.normalized.via_aplicacao);
  return partes.join(' · ');
}

function planRowOf(row) {
  return {
    line: row.line,
    status: row.status,
    eventType: null,
    identity: row.identity || { key: null, animalId: null, isNew: false, label: labelOf(row.input.numero, null), via: null },
    data: row.input.data ?? null,
    peso: null,
    categoria: { id: null, nome: null, origem: null },
    messages: [...row.errors, ...row.messages],
    sheetDerived: { peso_anterior: null, data_anterior: null, dias: null, ganho: null, gmd: null },
    derived: { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null },
    matchedEventId: null,
    matchedImportacaoId: null,
    payload: row.status === ROW_STATUS.NOVO ? { ...row.payload } : null,
    sanidade: {
      programa: row.input.programaTexto ?? null,
      medicamento: row.input.medicamentoTexto ?? null,
      dose: row.normalized?.dose ?? null,
      unidade: row.normalized?.unidade ?? null,
      via_aplicacao: row.normalized?.via_aplicacao ?? null,
      resumo: describeApplication(row),
    },
  };
}

/**
 * Fase 2. buildSanityImportPlan(prepared, context) → ImportPlan (mesmo formato dos demais
 * tipos, com `sanidade` por linha e `summary.aplicacoes`).
 * context = { identityIndex, registry, sanityRegistry, seriesByAnimal, applicationsByAnimal,
 *             permissions: { canRegistryWrite } }.
 */
export function buildSanityImportPlan(prepared, context) {
  const { rules, rows, fileErrors } = prepared;
  const work = {
    ...context,
    rules,
    missingMasters: new Map(),
    counters: { categoriasAutomaticasResolvidas: 0, categoriasNaoResolvidas: 0, seriesAfetadas: 0, eventosRecalculados: 0 },
  };
  // Chaves já gravadas (não canceladas) + as que este arquivo vai gravar, para pegar
  // repetição dentro do próprio arquivo.
  const stored = new Set();
  for (const [animalId, list] of context.applicationsByAnimal || new Map()) {
    for (const application of list) {
      stored.add(applicationKey({
        animalId,
        data: application.data,
        programaId: application.programa_sanidade_id,
        medicamentoId: application.medicamento_id,
        dose: application.dose,
      }));
    }
  }
  const seen = new Map();

  for (const row of rows) {
    if (row.status === ROW_STATUS.IGNORADA) continue;
    resolveRowAnimal(row, work);
    if (row.errors.length) {
      row.status = ROW_STATUS.ERRO;
      continue;
    }
    if (row.ambiguous) {
      row.status = ROW_STATUS.AMBIGUO;
      row.messages.push(row.ambiguous);
      continue;
    }
    row.programa = resolveSanityMaster(row, work, 'programas', row.input.programaTexto);
    row.medicamento = resolveSanityMaster(row, work, 'medicamentos', row.input.medicamentoTexto);
    checkChronology(row, work);
    // Cadastro ausente/inativo ou data fora da vida do animal já decidem a linha: a validação
    // do serviço de sanidade só roda sobre o que faz sentido validar (sem mensagem repetida).
    if (row.errors.length) {
      row.status = ROW_STATUS.ERRO;
      continue;
    }
    try {
      row.normalized = validateApplicationInput({
        animal_id: row.animal.id,
        data: row.input.data,
        programa_sanidade_id: row.programa.id,
        medicamento_id: row.medicamento.id,
        dose: row.input.dose,
        unidade: row.input.unidade,
        via_aplicacao: row.input.via_aplicacao,
        observacao: row.input.observacao,
      });
    } catch (error) {
      if (!(error instanceof SanityError)) throw error;
      row.errors.push(...(error.erros || [error.message]));
    }
    if (row.errors.length) {
      row.status = ROW_STATUS.ERRO;
      continue;
    }
    const key = applicationKey({
      animalId: row.animal.id,
      data: row.normalized.data,
      programaId: row.normalized.programa_sanidade_id,
      medicamentoId: row.normalized.medicamento_id,
      dose: row.normalized.dose,
    });
    if (stored.has(key)) {
      row.status = ROW_STATUS.JA_EXISTE;
      row.messages.push(`Esta aplicação já está registrada para ${row.identity.label} em ${row.normalized.data}.`);
      continue;
    }
    const first = seen.get(key);
    if (first !== undefined) {
      row.status = ROW_STATUS.POSSIVEL_DUPLICIDADE;
      row.messages.push(`Repete a linha ${first} (mesmo animal, data, programa, medicamento e dose); não será gravada.`);
      continue;
    }
    seen.set(key, row.line);
    row.status = ROW_STATUS.NOVO;
    row.payload = { ...row.normalized, sessao_id: null };
    row.messages.push(`Aplicação será registrada para ${row.identity.label}.`);
  }

  const planRows = rows.map(planRowOf);
  const groups = new Map();
  for (const row of rows) {
    const animalId = row.identity?.animalId;
    if (!animalId) continue;
    const group = groups.get(animalId) || { key: `id:${animalId}`, animalId, isNew: false, label: row.identity.label, lines: [], novos: [], create: null };
    group.lines.push(row.line);
    if (row.status === ROW_STATUS.NOVO) group.novos.push(row.line);
    groups.set(animalId, group);
  }
  const animals = [...groups.values()].map((group) => ({
    ...group,
    lines: [...group.lines].sort((a, b) => a - b),
    novos: [...group.novos].sort((a, b) => a - b),
  }));

  const plan = summarizePlan({ type: IMPORT_TYPES.SANIDADE, rules, fileErrors, planRows, animals, work });
  plan.summary.aplicacoes = planRows.filter((row) => row.status === ROW_STATUS.NOVO).length;
  return plan;
}
