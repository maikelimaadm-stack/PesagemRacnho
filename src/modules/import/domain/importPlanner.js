// Planejador puro da importação conciliada (dry-run). Não lê nem grava banco: o serviço
// carrega os cadastros, o índice de identidade e a série dos animais candidatos, e este
// módulo decide a situação de cada linha. Duas fases:
//   1. prepareImportRows: lê e valida os campos, resolve cadastros e junta os candidatos
//      de identidade (o serviço carrega só a série desses animais);
//   2. buildImportPlan: resolve a identidade com a série (datas de Cadastro e Saída),
//      agrupa por animal, mescla com a série existente, ordena pela ordem canônica
//      (compareWeighingEvents), classifica, valida e recalcula peso anterior/dias/ganho/GMD
//      com recalculateWeightSeries sobre a série mesclada. Derivados da planilha servem só
//      para comparação ("planilha X, recalculado Y").
// E1G: número de brinco parecido ("01016" → 1016) casa com o animal existente e agrupa as
// linhas do mesmo animal novo ("007" e "7"); no Histórico, pesagem anterior ao Cadastro
// gravado antecipa o Cadastro (a linha mais antiga vira Cadastro e o gravado vira Manejo).
import { normalizeName } from '../../catalog/domain/normalize.js';
import { eraOfCategory } from '../../operations/domain/categorySuggestion.js';
import { validateUiPayload } from '../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents, recalculateWeightSeries } from '../../weighing/domain/weighingSeries.js';
import { IDENTITY_STATUS, findIdentityCandidates, importGroupingKey, normalizeIdentifierValue, resolveAnimalIdentity } from './animalIdentity.js';
import { resolveImportCategory } from './importCategory.js';
import { BLOCKING_STATUSES, CATEGORY_MODES, EVENT_TYPES, EXIT_REASONS_WITHOUT_WEIGHT, IMPORT_TYPES, ROW_STATUS } from './importConstants.js';
import { invertMapping, listImportFields } from './importFields.js';
import { eventFingerprint } from './importFingerprint.js';
import { resolveRegistryReference } from './importRegistryContext.js';
import { normalizeImportRules } from './importRules.js';
import { cleanImportText, parseImportDate, parseImportDecimal, parseMotivoSaida, parseSexo, parseTipo, weightKey } from './importValues.js';

const MASTER_LABELS = Object.freeze({ marcas: 'Marca', racas: 'Raça', causasMorte: 'Causa da morte', categoriasAnimal: 'Categoria' });

const fmtNumber = (value) => (value === null || value === undefined ? '—' : String(value).replace('.', ','));
const rawText = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());
// Data ISO → dd/mm/aaaa nas mensagens novas para a tela (E1G).
const fmtDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : String(iso ?? '—'));

// ---------------------------------------------------------------------------
// Fase 1 — leitura e validação de campos
// ---------------------------------------------------------------------------

function newWorkingRow(fileRow) {
  return {
    line: fileRow.line,
    input: {},
    sheetDerived: { peso_anterior: null, data_anterior: null, dias: null, ganho: null, gmd: null },
    errors: [],
    // Erros que só importam quando a linha cria o animal (sexo/raça inválidos num Manejo não bloqueiam).
    creationErrors: [],
    messages: [],
    status: null,
    eventType: null,
    query: null,
    identity: null,
    animal: null,
    groupKey: null,
    marca: null,
    raca: null,
    causa: null,
    category: null,
    matchedEvent: null,
    derived: null,
    payload: {},
  };
}

function fileLevelErrors(type, headerByField, file, mapping) {
  const errors = [];
  if (!file.rows.length) errors.push('O arquivo não tem linhas de dados.');
  // Modelo aplicado a outro arquivo: coluna ausente ou campo desconhecido nunca some em silêncio.
  const headers = new Set(file.headers);
  const validFields = new Set(listImportFields(type).map((item) => item.id));
  for (const [header, fieldId] of Object.entries(mapping || {})) {
    if (!fieldId) continue;
    if (!validFields.has(fieldId)) errors.push(`O campo "${fieldId}" não existe na importação deste tipo.`);
    else if (!headers.has(header)) errors.push(`A coluna "${header}" do mapeamento não existe no arquivo.`);
  }
  if (type === IMPORT_TYPES.MESTRES) {
    if (!['marca', 'raca', 'causa_morte', 'categoria'].some((id) => headerByField.has(id))) {
      errors.push('Mapeie ao menos uma coluna de Marca, Raça, Causa da morte ou Categoria.');
    }
    return errors;
  }
  for (const item of listImportFields(type)) {
    if (!item.required || headerByField.has(item.id)) continue;
    if (item.id === 'numero' && headerByField.has('animal_id')) continue;
    errors.push(`A coluna obrigatória "${item.label}" não foi mapeada.`);
  }
  return errors;
}

function typeFilterMessage(type, tipo) {
  if (!tipo) return null;
  if (type === IMPORT_TYPES.HISTORICO && tipo === EVENT_TYPES.SAIDA) return 'Saída não entra no Histórico conciliado: importe as saídas pelo tipo Saídas.';
  const expected = { CADASTROS: EVENT_TYPES.CADASTRO, MANEJOS: EVENT_TYPES.MANEJO, SAIDAS: EVENT_TYPES.SAIDA }[type];
  if (expected && tipo !== expected) return `Linha do tipo ${tipo} ignorada na importação de ${expected === EVENT_TYPES.SAIDA ? 'Saídas' : `${expected}s`}.`;
  return null;
}

// Id de cadastro que não existe nesta base: com nome na linha vira aviso; sem nome, erro.
function noteInvalidReference(row, reference, field, label, errors) {
  if (!reference.invalidId) return;
  if (reference.row || reference.unknownText) row.messages.push(`${field} "${reference.invalidId}" não existe nesta base; ${label} identificada pelo nome.`);
  else errors.push(`${field} "${reference.invalidId}" não existe nos cadastros.`);
}

function parseEventRow(fileRow, get, type, rules, context, today) {
  const row = newWorkingRow(fileRow);
  if (context.ignoredLines.has(row.line)) {
    row.status = ROW_STATUS.IGNORADA;
    row.messages.push('Linha ignorada por escolha do usuário.');
    return row;
  }
  const tipo = parseTipo(get('tipo'));
  const filtered = typeFilterMessage(type, tipo.value);
  if (filtered) {
    row.status = ROW_STATUS.IGNORADA;
    row.messages.push(filtered);
    return row;
  }
  if (tipo.error) row.errors.push(tipo.error);
  const { fixedValues, effectiveDecimal } = rules;
  const input = row.input;
  input.tipoPlanilha = tipo.value;
  input.id = rawText(get('id'));
  input.animal_id = rawText(get('animal_id'));
  input.id_externo = rawText(get('id_externo'));
  input.numero = cleanImportText(get('numero'));
  input.observacao = rawText(get('observacao'));

  const date = parseImportDate(get('data'), rules.dateFormat, { today });
  if (date.error) row.errors.push(date.error);
  else if (!date.value) row.errors.push('Data não informada.');
  input.data = date.value;

  const peso = parseImportDecimal(get('peso'), effectiveDecimal);
  if (peso.error) row.errors.push(`Peso: ${peso.error}`);
  else if (peso.value !== null && peso.value <= 0) row.errors.push('Peso deve ser maior que zero.');
  input.peso = peso.value !== null && peso.value > 0 ? peso.value : null;

  if (type === IMPORT_TYPES.SAIDAS) {
    const motivo = parseMotivoSaida(get('motivo_saida') ?? fixedValues.motivo_saida);
    if (motivo.error) row.errors.push(motivo.error);
    else if (!motivo.value) row.errors.push('Motivo da saída obrigatório.');
    input.motivo_saida = motivo.value;
    input.causa_morte = cleanImportText(get('causa_morte'));
    if (!peso.error && input.peso === null && motivo.value && !EXIT_REASONS_WITHOUT_WEIGHT.includes(motivo.value)) {
      row.errors.push(`Peso obrigatório para saída por ${motivo.value}.`);
    }
  } else if (!peso.error && input.peso === null && !row.errors.includes('Peso deve ser maior que zero.')) {
    row.errors.push('Peso não informado.');
  }

  if (type === IMPORT_TYPES.HISTORICO || type === IMPORT_TYPES.CADASTROS) {
    const sexo = parseSexo(get('sexo') ?? fixedValues.sexo);
    if (sexo.error) row.creationErrors.push(sexo.error);
    input.sexo = sexo.value;
    input.categoria = cleanImportText(get('categoria'));
    input.categoria_id = rawText(get('categoria_id'));
    row.raca = resolveRegistryReference(context.registry.racas, { id: rawText(get('raca_id')) || (get('raca') ? null : fixedValues.raca_id), text: cleanImportText(get('raca')) });
    noteInvalidReference(row, row.raca, 'raca_id', 'Raça', row.creationErrors);
  }

  for (const [field, label] of [['peso_anterior', 'Peso anterior'], ['ganho', 'Ganho'], ['gmd', 'GMD'], ['dias', 'Dias']]) {
    const parsed = parseImportDecimal(get(field), effectiveDecimal);
    if (parsed.error) row.messages.push(`${label} da planilha ignorado: ${parsed.error}`);
    row.sheetDerived[field] = parsed.value;
  }
  const previousDate = parseImportDate(get('data_anterior'), rules.dateFormat, { today });
  if (previousDate.error) row.messages.push(`Data anterior da planilha ignorada: ${previousDate.error}`);
  row.sheetDerived.data_anterior = previousDate.value;

  row.marca = resolveRegistryReference(context.registry.marcas, { id: rawText(get('marca_id')) || (get('marca') ? null : fixedValues.marca_id), text: cleanImportText(get('marca')) });
  noteInvalidReference(row, row.marca, 'marca_id', 'Marca', row.errors);
  input.apartacao = cleanImportText(get('apartacao'));
  input.lote = cleanImportText(get('lote'));

  row.query = {
    animalId: input.animal_id,
    numero: input.numero,
    marcaId: row.marca.row?.id ?? null,
    marcaNome: row.marca.row?.nome ?? row.marca.unknownText ?? null,
  };
  return row;
}

/**
 * Fase 1. prepareImportRows({ type, file, mapping, rules, context, today }) →
 * { type, rules, headerByField, fileErrors, rows, candidateAnimalIds }
 * context = { identityIndex, registry (buildRegistryContext) }.
 */
export function prepareImportRows({ type, file, mapping, rules: rawRules = {}, context, today = new Date() }) {
  const rules = normalizeImportRules(rawRules, file.headers);
  const headerByField = invertMapping(mapping, type);
  const fileErrors = fileLevelErrors(type, headerByField, file, mapping);
  const candidateAnimalIds = new Set();
  const parseContext = { ...context, ignoredLines: new Set(rules.ignoredLines) };
  if (type === IMPORT_TYPES.MESTRES) return { type, rules, headerByField, fileErrors, rows: [], candidateAnimalIds };
  const rows = file.rows.map((fileRow) => {
    const get = (fieldId) => {
      const header = headerByField.get(fieldId);
      return header === undefined ? null : rawText(fileRow.values[header]);
    };
    const row = parseEventRow(fileRow, get, type, rules, parseContext, today);
    if (row.query) {
      for (const animal of findIdentityCandidates(context.identityIndex, row.query).candidates) candidateAnimalIds.add(String(animal.id));
    }
    return row;
  });
  return { type, rules, headerByField, fileErrors, rows, candidateAnimalIds };
}

// ---------------------------------------------------------------------------
// Fase 2 — identidade, agrupamento, classificação e recálculo
// ---------------------------------------------------------------------------

const classOf = (tipo) => (tipo === EVENT_TYPES.SAIDA ? 'S' : 'P');
const labelOf = (numero, marca) => `${numero || '?'} / ${marca || 'sem marca'}`;

function lifecycleFrom(series, animal) {
  const registration = series.find((event) => event.tipo_manejo === EVENT_TYPES.CADASTRO) || null;
  const exit = series.find((event) => event.tipo_manejo === EVENT_TYPES.SAIDA) || null;
  return {
    registration,
    exit,
    registrationDate: registration?.data_pesagem ?? null,
    exitDate: exit?.data_pesagem ?? animal?.data_saida ?? null,
    exitReason: exit?.motivo_saida ?? animal?.motivo_saida ?? null,
  };
}

function setStatus(row, status, message) {
  row.status = status;
  if (message) row.messages.push(message);
}

function resolveRowIdentity(row, type, context) {
  const { identityIndex, seriesByAnimal } = context;
  const lifecycleOf = (animal) => lifecycleFrom(seriesByAnimal.get(String(animal.id)) || [], animal);
  const result = resolveAnimalIdentity(identityIndex, row.query, { eventDate: row.input.data, lifecycleOf });
  const marcaNome = row.marca?.row?.nome ?? row.marca?.unknownText ?? null;
  if (result.invalidAnimalId) {
    row.messages.push(`animal_id "${row.input.animal_id}" não existe nesta base; a identificação usa número e marca.`);
  }
  if (result.status === IDENTITY_STATUS.MATCH) {
    const animal = result.animal;
    row.animal = animal;
    row.groupKey = `id:${animal.id}`;
    row.identity = { key: row.groupKey, animalId: String(animal.id), isNew: false, label: labelOf(animal.numero_animal, animal.marca), via: result.via };
    // E1G: casou só pelo número parecido — o número gravado do animal não muda.
    if (result.similarNumber) {
      row.identity.similarNumber = { informado: row.input.numero, cadastrado: animal.numero_animal };
      row.messages.push(`Número ${row.input.numero} reconhecido como o animal ${animal.numero_animal} já cadastrado (o mesmo número sem os zeros à esquerda ou sem o ",0" do Excel); o número do animal não muda.`);
    }
    const informed = importGroupingKey(row.input.numero);
    if (result.via === 'animal_id' && informed && informed !== importGroupingKey(animal.numero_animal)) {
      row.errors.push(`animal_id aponta para ${row.identity.label}, mas a linha informa a identificação ${row.input.numero}.`);
    }
    return;
  }
  // E1G: animal novo agrupa pela chave numérica ("007" e "7" = o mesmo animal).
  const numeroKey = importGroupingKey(row.input.numero);
  const brandKey = row.marca?.row ? `id:${row.marca.row.id}` : row.marca?.unknownText ? `nome:${normalizeName(row.marca.unknownText)}` : 'sem-marca';
  row.identity = { key: `novo:${brandKey}|${numeroKey}`, animalId: null, isNew: false, label: labelOf(row.input.numero, marcaNome), via: result.via };
  if (result.status === IDENTITY_STATUS.INVALID || result.status === IDENTITY_STATUS.INELIGIBLE) {
    row.errors.push(result.message);
    return;
  }
  if (result.status === IDENTITY_STATUS.AMBIGUOUS) {
    row.ambiguous = result.message;
    return;
  }
  // NONE
  if (type === IMPORT_TYPES.MANEJOS || type === IMPORT_TYPES.SAIDAS) {
    row.errors.push(`Animal ${row.identity.label} não encontrado. Importe o Cadastro antes (tipo Cadastros ou Histórico).`);
    return;
  }
  row.groupKey = row.identity.key;
  row.identity.isNew = true;
}

function sameStoredEvent(row, event, type) {
  if (row.input.data !== event.data_pesagem) return false;
  if (type === IMPORT_TYPES.HISTORICO) {
    if (classOf(event.tipo_manejo) !== 'P') return false;
  } else if (event.tipo_manejo !== row.eventType) {
    return false;
  }
  if (weightKey(row.input.peso) !== weightKey(event.peso ?? event.peso_kg)) return false;
  if (row.eventType === EVENT_TYPES.SAIDA && normalizeName(row.input.motivo_saida) !== normalizeName(event.motivo_saida)) return false;
  if (row.input.causa_morte && event.causa_morte && normalizeName(row.input.causa_morte) !== normalizeName(event.causa_morte)) return false;
  return true;
}

// Linhas do mesmo animal comparadas com a série gravada e entre si (duplicidade e conflito).
function matchAgainstSeries(rows, series, type, rules) {
  const byId = new Map(series.map((event) => [String(event.id), event]));
  const byExternal = new Map(series.filter((event) => event.id_externo).map((event) => [String(event.id_externo), event]));
  const rowClass = (row) => (type === IMPORT_TYPES.HISTORICO ? 'P' : classOf(row.eventType));
  for (const row of rows) {
    const explicit = (row.input.id && byId.get(row.input.id)) || (row.input.id_externo && byExternal.get(row.input.id_externo)) || null;
    if (explicit) {
      row.matchedEvent = explicit;
      if (sameStoredEvent(row, explicit, type)) setStatus(row, ROW_STATUS.JA_EXISTE, 'Evento já gravado (mesmo identificador, data, tipo e peso).');
      else setStatus(row, ROW_STATUS.CONFLITO, `O evento ${row.input.id && byId.has(row.input.id) ? `id ${row.input.id}` : `id_externo ${row.input.id_externo}`} já existe com dados diferentes (${explicit.tipo_manejo} em ${explicit.data_pesagem}, peso ${fmtNumber(explicit.peso)}).`);
      continue;
    }
    const sameDay = series.filter((event) => event.data_pesagem === row.input.data && classOf(event.tipo_manejo) === rowClass(row));
    if (!sameDay.length) continue;
    const equal = sameDay.find((event) => sameStoredEvent(row, event, type));
    if (equal) {
      row.matchedEvent = equal;
      setStatus(row, ROW_STATUS.JA_EXISTE, `Já existe ${equal.tipo_manejo} em ${equal.data_pesagem} com o mesmo peso.`);
    } else {
      const other = sameDay[0];
      row.matchedEvent = other;
      setStatus(row, ROW_STATUS.CONFLITO, `Já existe ${other.tipo_manejo} em ${other.data_pesagem} com peso ${fmtNumber(other.peso)}${other.motivo_saida ? ` (${other.motivo_saida})` : ''}; a linha informa ${fmtNumber(row.input.peso)}.`);
    }
  }
  // Repetições dentro do arquivo: iguais → POSSÍVEL DUPLICIDADE; diferentes → CONFLITO.
  const buckets = new Map();
  for (const row of rows.filter((item) => !item.status)) {
    const key = `${row.input.data}|${rowClass(row)}`;
    buckets.set(key, [...(buckets.get(key) || []), row]);
  }
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    bucket.sort((left, right) => left.line - right.line);
    const [first] = bucket;
    const identical = bucket.every((row) => weightKey(row.input.peso) === weightKey(first.input.peso)
      && (row.input.id_externo || '') === (first.input.id_externo || '')
      && normalizeName(row.input.motivo_saida) === normalizeName(first.input.motivo_saida)
      && normalizeName(row.input.causa_morte) === normalizeName(first.input.causa_morte));
    if (identical) {
      for (const row of bucket.slice(1)) {
        if (rules.acceptDuplicates) row.messages.push(`Repete a linha ${first.line}; gravada como repesagem por escolha do usuário.`);
        else setStatus(row, ROW_STATUS.POSSIVEL_DUPLICIDADE, `Repete a linha ${first.line} (mesmo animal, data, tipo e peso); não será gravada.`);
      }
    } else {
      const lines = bucket.map((row) => row.line).join(', ');
      for (const row of bucket) setStatus(row, ROW_STATUS.CONFLITO, `Mesmo animal e data em mais de uma linha com dados diferentes (linhas ${lines}).`);
    }
  }
}

function classifyGroup(group, type, context) {
  const { rules } = context;
  const series = group.series;
  const { registration, exit } = lifecycleFrom(series, group.animal);
  const rows = group.rows;
  if (type === IMPORT_TYPES.CADASTROS) for (const row of rows) row.eventType = EVENT_TYPES.CADASTRO;
  if (type === IMPORT_TYPES.MANEJOS) for (const row of rows) row.eventType = EVENT_TYPES.MANEJO;
  if (type === IMPORT_TYPES.SAIDAS) for (const row of rows) row.eventType = EVENT_TYPES.SAIDA;
  if (type === IMPORT_TYPES.HISTORICO && group.animal) {
    for (const row of rows) row.eventType = registration && row.input.data === registration.data_pesagem ? EVENT_TYPES.CADASTRO : EVENT_TYPES.MANEJO;
  }
  matchAgainstSeries(rows, series, type, rules);
  const pending = rows.filter((row) => !row.status).sort((left, right) => String(left.input.data).localeCompare(String(right.input.data)) || left.line - right.line);
  const exitText = exit ? `${exit.motivo_saida || 'saída'} em ${exit.data_pesagem}` : null;
  const beforeRegistration = (row) => registration && row.input.data < registration.data_pesagem;

  if (type === IMPORT_TYPES.HISTORICO) {
    if (group.animal) {
      for (const row of pending) {
        row.eventType = EVENT_TYPES.MANEJO;
        if (!registration) setStatus(row, ROW_STATUS.CONFLITO, 'O animal já existe sem Cadastro: importe o Cadastro pelo tipo Cadastros ou corrija o animal antes do histórico.');
        else if (beforeRegistration(row)) setStatus(row, ROW_STATUS.CONFLITO, `A data ${row.input.data} é anterior ao Cadastro do animal (${registration.data_pesagem}).`);
        else if (exit && row.input.data >= exit.data_pesagem) setStatus(row, ROW_STATUS.CONFLITO, `O animal já possui ${exitText}; o evento de ${row.input.data} não pode entrar.`);
      }
    } else {
      const blockedEarliest = rows.some((row) => row.status === ROW_STATUS.CONFLITO && pending.length && row.input.data <= pending[0].input.data);
      pending.forEach((row, index) => {
        row.eventType = index === 0 ? EVENT_TYPES.CADASTRO : EVENT_TYPES.MANEJO;
        if (blockedEarliest) setStatus(row, ROW_STATUS.ERRO, 'O evento mais antigo deste animal está em conflito; resolva-o para definir o Cadastro.');
      });
      const registrationDate = pending[0]?.input.data ?? null;
      for (const row of rows.filter((item) => !item.eventType)) {
        row.eventType = row.input.data === registrationDate ? EVENT_TYPES.CADASTRO : EVENT_TYPES.MANEJO;
      }
    }
    for (const row of rows) {
      if (row.eventType && row.input.tipoPlanilha && row.input.tipoPlanilha !== row.eventType && row.status !== ROW_STATUS.IGNORADA) {
        row.messages.push(`Tipo na planilha: ${row.input.tipoPlanilha}; conciliado como ${row.eventType}.`);
      }
    }
  } else if (type === IMPORT_TYPES.CADASTROS) {
    if (group.animal) {
      for (const row of pending) {
        setStatus(row, ROW_STATUS.CONFLITO, registration
          ? `Animal já cadastrado em ${registration.data_pesagem} (peso ${fmtNumber(registration.peso)}).`
          : 'O animal já existe sem Cadastro: corrija o animal existente em vez de importar outro Cadastro.');
      }
    } else if (pending.length > 1) {
      const lines = pending.map((row) => row.line).join(', ');
      for (const row of pending) setStatus(row, ROW_STATUS.CONFLITO, `Mais de um Cadastro para o mesmo animal no arquivo (linhas ${lines}).`);
    }
  } else if (type === IMPORT_TYPES.MANEJOS) {
    for (const row of pending) {
      if (!registration) setStatus(row, ROW_STATUS.ERRO, 'O animal existe sem Cadastro: importe o Cadastro antes dos Manejos.');
      else if (beforeRegistration(row)) setStatus(row, ROW_STATUS.CONFLITO, `A data ${row.input.data} é anterior ao Cadastro do animal (${registration.data_pesagem}).`);
      else if (exit && row.input.data >= exit.data_pesagem) setStatus(row, ROW_STATUS.CONFLITO, `O animal já possui ${exitText}; o Manejo de ${row.input.data} não pode entrar.`);
    }
  } else if (type === IMPORT_TYPES.SAIDAS) {
    if (pending.length > 1) {
      const lines = pending.map((row) => row.line).join(', ');
      for (const row of pending) setStatus(row, ROW_STATUS.CONFLITO, `Mais de uma saída para o mesmo animal no arquivo (linhas ${lines}).`);
    }
    for (const row of pending.filter((item) => !item.status)) {
      const later = series.find((event) => event.data_pesagem > row.input.data);
      if (exit) setStatus(row, ROW_STATUS.CONFLITO, `O animal já possui ${exitText}.`);
      else if (beforeRegistration(row)) setStatus(row, ROW_STATUS.CONFLITO, `A data ${row.input.data} é anterior ao Cadastro do animal (${registration.data_pesagem}).`);
      else if (later) setStatus(row, ROW_STATUS.CONFLITO, `Existem lançamentos posteriores a ${row.input.data} (${later.tipo_manejo} em ${later.data_pesagem}). Corrija ou cancele antes da saída retroativa.`);
      else if (!registration) row.messages.push('O animal não tem Cadastro registrado; a saída será gravada mesmo assim.');
    }
  }
  for (const row of rows) if (!row.status) row.status = ROW_STATUS.NOVO;
}

function noteMissingMaster(context, store, nome, line) {
  const key = `${store}|${normalizeName(nome)}`;
  const current = context.missingMasters.get(key) || { store, rotulo: MASTER_LABELS[store], nome, linhas: new Set() };
  current.linhas.add(line);
  context.missingMasters.set(key, current);
}

// Cadastro mestre ausente: ERRO, ou segue NOVO quando o usuário pediu para criar (com registry.write).
function requireMaster(row, context, store, reference, requiredMessage = null) {
  if (reference?.row) return reference.row;
  if (reference?.unknownText) {
    noteMissingMaster(context, store, reference.unknownText, row.line);
    const label = MASTER_LABELS[store];
    if (store !== 'categoriasAnimal' && context.rules.createMissingMasters && context.permissions.canRegistryWrite) {
      row.messages.push(`${label} "${reference.unknownText}" não cadastrada: será criada antes da gravação.`);
    } else if (context.rules.createMissingMasters && !context.permissions.canRegistryWrite) {
      row.errors.push(`${label} "${reference.unknownText}" não cadastrada e o usuário não tem permissão registry.write para criá-la.`);
    } else {
      row.errors.push(`${label} "${reference.unknownText}" não cadastrada. Cadastre antes ou marque "Criar cadastros ausentes".`);
    }
    return null;
  }
  if (requiredMessage) row.errors.push(requiredMessage);
  return null;
}

function resolveLot(row, context) {
  const { registry, rules } = context;
  const { fixedValues } = rules;
  let apartacao = null;
  if (row.input.apartacao) {
    const found = registry.apartacoes.byName.get(normalizeName(row.input.apartacao)) || [];
    apartacao = found.find((item) => item.ativo !== false) || found[0] || null;
    if (!apartacao) row.messages.push(`Apartação "${row.input.apartacao}" não cadastrada: o evento fica sem vínculo de apartação.`);
  } else if (fixedValues.apartacao_id) {
    apartacao = registry.apartacoes.byId.get(fixedValues.apartacao_id) || null;
    if (!apartacao) row.errors.push(`Apartação fixa "${fixedValues.apartacao_id}" não existe.`);
  }
  let lote = null;
  if (row.input.lote) {
    const found = (registry.lotes.byName.get(normalizeName(row.input.lote)) || []).filter((item) => !apartacao || item.apartacao_id === apartacao.id);
    if (found.length === 1) lote = found[0];
    else if (found.length > 1) row.messages.push(`Lote "${row.input.lote}" existe em mais de uma apartação; informe a apartação para vincular.`);
    else row.messages.push(`Lote "${row.input.lote}" não cadastrado${apartacao ? ` na apartação ${apartacao.nome_apartacao}` : ''}: o evento fica só com o nome do lote.`);
  } else if (fixedValues.lote_id) {
    lote = registry.lotes.byId.get(fixedValues.lote_id) || null;
    if (!lote) row.errors.push(`Lote fixo "${fixedValues.lote_id}" não existe.`);
  }
  if (lote && !apartacao && lote.apartacao_id) apartacao = registry.apartacoes.byId.get(String(lote.apartacao_id)) || null;
  Object.assign(row.payload, {
    lote_id: lote?.id ?? null,
    nome_lote: lote?.nome_lote ?? row.input.lote ?? null,
    apartacao_id: apartacao?.id ?? null,
    nome_apartacao: apartacao?.nome_apartacao ?? row.input.apartacao ?? null,
  });
}

// Validações que só valem para o que será gravado (cadastros mestres, categoria, lote, mapper).
function validateNewRow(row, group, type, context) {
  const { registry, rules } = context;
  const createsAnimal = group.isNew && row.eventType === EVENT_TYPES.CADASTRO;
  Object.assign(row.payload, {
    tipo_manejo: row.eventType,
    data_pesagem: row.input.data,
    peso: row.input.peso,
    observacao: row.input.observacao,
    id_externo: row.input.id_externo,
  });
  if (createsAnimal) {
    row.errors.push(...row.creationErrors);
    const marca = requireMaster(row, context, 'marcas', row.marca, 'Marca obrigatória para criar o animal (a identidade é número + marca). Informe a coluna Marca ou um valor fixo.');
    const raca = requireMaster(row, context, 'racas', row.raca);
    const category = resolveImportCategory({
      mode: rules.categoryMode,
      categorias: registry.categorias,
      sexo: row.input.sexo,
      peso: row.input.peso,
      categoriaId: row.input.categoria_id,
      categoriaNome: row.input.categoria,
      fixedCategoriaId: rules.fixedValues.categoria_id,
    });
    if (category.error) row.errors.push(category.error);
    if (category.missingMaster) noteMissingMaster(context, 'categoriasAnimal', category.missingMaster, row.line);
    if (category.message) row.messages.push(category.message);
    row.category = category;
    if (rules.categoryMode === CATEGORY_MODES.AUTOMATICA) {
      if (category.categoria) context.counters.categoriasAutomaticasResolvidas += 1;
      else context.counters.categoriasNaoResolvidas += 1;
    } else if (!category.categoria && !category.error) {
      context.counters.categoriasNaoResolvidas += 1;
    }
    Object.assign(row.payload, {
      numero_animal: row.input.numero,
      marca_id: marca?.id ?? null,
      marca: marca?.nome ?? row.marca?.unknownText ?? null,
      raca_id: raca?.id ?? null,
      raca: raca?.nome ?? row.raca?.unknownText ?? null,
      sexo: row.input.sexo,
      categoria_id: category.categoria?.id ?? null,
      categoria_automatica: category.automatic,
      era: eraOfCategory(category.categoria),
    });
  }
  if (row.eventType === EVENT_TYPES.SAIDA) {
    row.payload.motivo_saida = row.input.motivo_saida;
    if (row.input.motivo_saida === 'Morte') {
      if (!row.input.causa_morte) row.errors.push('Causa da morte obrigatória para saída por Morte.');
      else {
        const causa = requireMaster(row, context, 'causasMorte', resolveRegistryReference(registry.causas, { text: row.input.causa_morte }));
        row.payload.causa_morte = causa?.nome ?? row.input.causa_morte;
        row.payload.causa_morte_id = causa?.id ?? null;
      }
    }
    if (row.input.motivo_saida === 'Abate') row.messages.push('Abate importado sem embarque e documento: a pendência "Doc" aparecerá no Fechamento do dia.');
  } else {
    resolveLot(row, context);
  }
  try {
    validateUiPayload({ tipo_manejo: row.eventType, motivo_saida: row.input.motivo_saida, data_pesagem: row.input.data, peso: row.input.peso });
  } catch (error) {
    row.errors.push(error.message);
  }
  if (row.errors.length) row.status = ROW_STATUS.ERRO;
}

const SHEET_COMPARISONS = Object.freeze([
  ['data_anterior', 'Data anterior', null],
  ['peso_anterior', 'Peso anterior', 0.01],
  ['dias', 'Dias', 0],
  ['ganho', 'Ganho', 0.01],
  ['gmd', 'GMD', 0.001],
]);

function compareSheetDerived(row) {
  if (!row.derived) return;
  for (const [field, label, tolerance] of SHEET_COMPARISONS) {
    const sheet = row.sheetDerived[field];
    if (sheet === null || sheet === undefined) continue;
    const recalculated = row.derived[field];
    const differs = tolerance === null
      ? sheet !== recalculated
      : recalculated === null || recalculated === undefined || Math.abs(Number(sheet) - Number(recalculated)) > tolerance + 1e-9;
    if (differs) row.messages.push(`${label}: planilha ${fmtNumber(sheet)}, recalculado ${fmtNumber(recalculated)}.`);
  }
}

const SYNTHETIC_CREATED = (line) => `9999-12-31T${String(line).padStart(12, '0')}`;
const DERIVED_FIELDS = ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'];
const derivedOf = (patch) => ({ data_anterior: patch.data_anterior, peso_anterior: patch.peso_anterior, dias: patch.dias, ganho: patch.ganho, gmd: patch.gmd });

// Série mesclada (gravada + linhas NOVO) recalculada pela função canônica do Lançamento.
function recalculateGroup(group, context) {
  const newRows = group.rows.filter((row) => row.status === ROW_STATUS.NOVO);
  const matchedRows = group.rows.filter((row) => row.status === ROW_STATUS.JA_EXISTE && row.matchedEvent);
  if (!newRows.length && !matchedRows.length) return;
  const syntheticKey = `import:${group.key}`;
  const merged = [
    ...group.series.map((event) => ({ ...event, animal_id: syntheticKey })),
    ...newRows.map((row) => ({
      id: `linha:${row.line}`,
      animal_id: syntheticKey,
      tipo_manejo: row.eventType,
      data_pesagem: row.input.data,
      peso: row.input.peso,
      created_date: SYNTHETIC_CREATED(row.line),
    })),
  ];
  const patches = new Map(recalculateWeightSeries(merged).map((update) => [String(update.id), update.patch]));
  for (const row of newRows) row.derived = derivedOf(patches.get(`linha:${row.line}`));
  for (const row of matchedRows) row.derived = derivedOf(patches.get(String(row.matchedEvent.id)) || {});
  if (newRows.length) {
    context.counters.seriesAfetadas += 1;
    for (const event of group.series) {
      const patch = patches.get(String(event.id));
      if (patch && DERIVED_FIELDS.some((field) => (patch[field] ?? null) !== (event[field] ?? null))) context.counters.eventosRecalculados += 1;
    }
  }
}

/**
 * Fase 2. buildImportPlan(prepared, context) → ImportPlan (sem `input`, que o serviço anexa).
 * context = { identityIndex, registry, seriesByAnimal: Map(animalId → view models), permissions: { canRegistryWrite } }
 */
export function buildImportPlan(prepared, context) {
  const { type, rules, rows, fileErrors } = prepared;
  const work = {
    ...context,
    rules,
    missingMasters: new Map(),
    counters: { categoriasAutomaticasResolvidas: 0, categoriasNaoResolvidas: 0, seriesAfetadas: 0, eventosRecalculados: 0 },
  };
  const groups = new Map();
  for (const row of rows) {
    if (row.status === ROW_STATUS.IGNORADA) continue;
    resolveRowIdentity(row, type, work);
    if (row.errors.length) {
      row.status = ROW_STATUS.ERRO;
      continue;
    }
    if (row.ambiguous) {
      setStatus(row, ROW_STATUS.AMBIGUO, row.ambiguous);
      continue;
    }
    const group = groups.get(row.groupKey) || {
      key: row.groupKey,
      animal: row.animal,
      isNew: !row.animal,
      rows: [],
      series: row.animal ? [...(context.seriesByAnimal.get(String(row.animal.id)) || [])].sort(compareWeighingEvents) : [],
    };
    group.rows.push(row);
    groups.set(row.groupKey, group);
  }

  // E1G: animal novo com o número escrito de jeitos diferentes no arquivo ("007" e "7").
  for (const group of groups.values()) {
    if (!group.isNew) continue;
    const numbers = [...new Set(group.rows.map((row) => normalizeIdentifierValue(row.input.numero)))];
    if (numbers.length < 2) continue;
    for (const row of group.rows) row.messages.push(`Os números ${numbers.join(', ')} foram tratados como o mesmo animal (zeros à esquerda ou ",0" do Excel).`);
  }

  for (const group of groups.values()) {
    classifyGroup(group, type, work);
    for (const row of group.rows.filter((item) => item.status === ROW_STATUS.NOVO)) validateNewRow(row, group, type, work);
    if (group.isNew) {
      const registration = group.rows.find((row) => row.eventType === EVENT_TYPES.CADASTRO);
      if (registration && registration.status !== ROW_STATUS.NOVO) {
        for (const row of group.rows.filter((item) => item.status === ROW_STATUS.NOVO && item !== registration)) {
          setStatus(row, ROW_STATUS.ERRO, `Depende do Cadastro da linha ${registration.line}, que não será gravado.`);
        }
      }
    }
    recalculateGroup(group, work);
    for (const row of group.rows) {
      compareSheetDerived(row);
      if (row.status !== ROW_STATUS.NOVO) continue;
      row.payload.import_fingerprint = eventFingerprint({
        empresaId: rules.empresaId,
        animalRef: group.animal ? String(group.animal.id) : group.key,
        data: row.input.data,
        tipo: row.eventType,
        peso: row.input.peso,
        idExterno: row.input.id_externo,
      });
    }
  }

  const planRows = rows.map((row) => ({
    line: row.line,
    status: row.status,
    eventType: row.eventType,
    identity: row.identity || { key: null, animalId: null, isNew: false, label: labelOf(row.input.numero, null), via: null },
    data: row.input.data ?? null,
    peso: row.input.peso ?? null,
    categoria: row.category
      ? { id: row.category.categoria?.id ?? null, nome: row.category.categoria?.nome ?? null, origem: row.category.origem ?? null }
      : { id: null, nome: null, origem: null },
    messages: [...row.errors, ...row.messages],
    sheetDerived: { ...row.sheetDerived },
    derived: row.derived ? { ...row.derived } : { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null },
    matchedEventId: row.matchedEvent?.id ?? null,
    matchedImportacaoId: row.matchedEvent?.importacao_id ?? null,
    payload: row.status === ROW_STATUS.NOVO ? { ...row.payload } : null,
  }));

  const animals = [...groups.values()].map((group) => {
    const novos = group.rows.filter((row) => row.status === ROW_STATUS.NOVO);
    const registration = group.isNew ? novos.find((row) => row.eventType === EVENT_TYPES.CADASTRO) : null;
    return {
      key: group.key,
      animalId: group.animal ? String(group.animal.id) : null,
      isNew: group.isNew,
      label: group.animal ? labelOf(group.animal.numero_animal, group.animal.marca) : group.rows[0].identity.label,
      lines: group.rows.map((row) => row.line).sort((a, b) => a - b),
      novos: novos.map((row) => row.line).sort((a, b) => a - b),
      create: registration ? {
        line: registration.line,
        numero_animal: registration.payload.numero_animal,
        marca_id: registration.payload.marca_id,
        marca: registration.payload.marca,
        raca_id: registration.payload.raca_id,
        raca: registration.payload.raca,
        sexo: registration.payload.sexo,
        categoria_id: registration.payload.categoria_id,
        categoria_automatica: registration.payload.categoria_automatica,
        era: registration.payload.era,
      } : null,
    };
  });

  return summarizePlan({ type, rules, fileErrors, planRows, animals, work });
}

const SIMILAR_NUMBER_EXAMPLES = 10;

/** E1G: linhas que casaram com animal existente só pelo número parecido ("01016 → 1016"). */
export function similarNumbersOf(planRows) {
  const rows = planRows.filter((row) => row.status !== ROW_STATUS.IGNORADA && row.identity?.similarNumber);
  const exemplos = [...new Set(rows.map((row) => `${row.identity.similarNumber.informado} → ${row.identity.similarNumber.cadastrado}`))];
  return {
    linhas: rows.length,
    exemplos: exemplos.slice(0, SIMILAR_NUMBER_EXAMPLES),
    outrosExemplos: Math.max(0, exemplos.length - SIMILAR_NUMBER_EXAMPLES),
  };
}

export function summarizePlan({ type, rules, fileErrors, planRows, animals, work }) {
  const count = (status) => planRows.filter((row) => row.status === status).length;
  const novos = planRows.filter((row) => row.status === ROW_STATUS.NOVO);
  const summary = {
    linhasLidas: new Set(planRows.map((row) => row.line)).size,
    novos: novos.length,
    animaisEncontrados: new Set(planRows.filter((row) => row.status !== ROW_STATUS.IGNORADA && row.identity?.animalId).map((row) => row.identity.animalId)).size,
    animaisNovos: animals.filter((animal) => animal.isNew && animal.create).length,
    cadastros: novos.filter((row) => row.eventType === EVENT_TYPES.CADASTRO).length,
    manejos: novos.filter((row) => row.eventType === EVENT_TYPES.MANEJO).length,
    saidas: novos.filter((row) => row.eventType === EVENT_TYPES.SAIDA).length,
    jaExistem: count(ROW_STATUS.JA_EXISTE),
    ignoradas: count(ROW_STATUS.IGNORADA),
    duplicidades: count(ROW_STATUS.POSSIVEL_DUPLICIDADE),
    ambiguidades: count(ROW_STATUS.AMBIGUO),
    conflitos: count(ROW_STATUS.CONFLITO),
    erros: count(ROW_STATUS.ERRO),
    cadastrosMestresAusentes: [...work.missingMasters.values()].map((item) => ({ ...item, linhas: [...item.linhas].sort((a, b) => a - b) })),
    categoriasAutomaticasResolvidas: work.counters.categoriasAutomaticasResolvidas,
    categoriasNaoResolvidas: work.counters.categoriasNaoResolvidas,
    seriesAfetadas: work.counters.seriesAfetadas,
    eventosRecalculados: work.counters.eventosRecalculados,
    cadastrosMestresNovos: planRows.filter((row) => row.status === ROW_STATUS.NOVO && row.master).length,
    numerosParecidos: similarNumbersOf(planRows),
  };
  const blocking = fileErrors.length > 0 || planRows.some((row) => BLOCKING_STATUSES.includes(row.status));
  return { type, rules, fileErrors, summary, rows: planRows, blocking, animals };
}
