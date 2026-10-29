// Fluxo operacional IndexedDB/Dexie. O adapter preserva o contrato da UI e
// concentra transações, projeções e auditoria do domínio de pesagens.
//
// v7 (docs 12 §3.2): animais nascem com marca_id/raca_id/propriedade_id e
// situacao em enum; identificadores VISUAL guardam só o número em
// valor_normalizado e a marca em marca_id; sessões nascem ABERTA; toda linha de
// auditoria carrega o ator (auditActor) e ATUALIZAR em massa grava resumo +
// campos_alterados em vez de antes/depois completos.
import { compareWeighingEvents, recalculateWeightSeries } from '../domain/weighingSeries.js';
import { filterLegacyPayload, storageRecordToViewModel } from '../domain/weighingMapper.js';
import { TimelineError, validateAnimalTimeline } from '../domain/animalTimeline.js';
import { deriveLotStays, deriveWeighingMovements, movementKey, stayKey } from '../domain/weighingMovements.js';
import storage from '../../../storage/storageAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { isOpenSessionStatus, normalizeName, situacaoFromExitReason } from '../../../storage/indexedDb/normalize.js';
import { STORES } from '../../../storage/indexedDb/schema.js';
import { eraOfCategory, suggestCategory } from '../../operations/domain/categorySuggestion.js';
import {
  APLICACOES_STORE,
  LAUNCH_SANITY_TABLES,
  cancelApplicationsForWeighingsInTransaction,
  prepareApplicationRowsInTransaction,
} from '../../sanity/infrastructure/sanityDataAdapter.js';

const EMPRESA_ID = 'local';
// Nome do campo do operador da sessão segue o índice declarado no esquema
// (`operador_usuario_id` na rev. 2 do documento 12; `operador_user_id` na rev. 1).
const SESSION_OPERATOR_FIELD = String(STORES.sessoesPesagem).includes('operador_usuario_id') ? 'operador_usuario_id' : 'operador_user_id';

// Id do usuário autenticado (`actor_user_id` no auditActor atual; `usuario_id` na rev. 2).
function actorUserId() {
  const actor = getActor();
  return actor.actor_user_id ?? actor.usuario_id ?? null;
}

// Mesma ordem canônica do domínio (data → tipo → gravação → id).
const eventView = (row) => ({ tipo_manejo: weighingUi(row).tipo_manejo, data_pesagem: row.data_pesagem ?? weighingUi(row).data_pesagem, created_at: row.created_at, id: row.id });
const eventOrder = (left, right) => compareWeighingEvents(eventView(left), eventView(right));

function weighingUi(row) {
  return typeof row?.legacy_payload === 'object' ? row.legacy_payload : {};
}

const normalized = (value) => String(value || '').trim().toUpperCase();

// Registro base de cadastro mestre criado "de passagem" pelo lançamento
// (marca/raça digitadas que ainda não existem na store).
function registryRecord(storeName, nome, ts) {
  const extra = storeName === 'marcas'
    ? { abreviacao: null, proprietario_parceiro_id: null, propriedade_id: null, padrao: false, observacao: null }
    : { abreviacao: null, grupo: null, padrao: false, ordem: null };
  return { id: crypto.randomUUID(), empresa_id: EMPRESA_ID, nome, nome_normalizado: normalizeName(nome), ativo: true, ...extra, created_at: ts, updated_at: ts, deleted_at: null };
}

async function findDefaultRegistryId(db, storeName) {
  const rows = await db.table(storeName).toArray();
  return rows.find((row) => !row.deleted_at && row.padrao === true)?.id || null;
}

// Texto → id na store de cadastro; cria a entrada quando não existe. Sem texto,
// devolve o padrão da store (marca/propriedade padrão) ou null.
async function resolveRegistryId(db, storeName, text, ts, { fallbackToDefault = false } = {}) {
  const nome = String(text ?? '').trim();
  const norm = normalizeName(nome);
  if (!norm) return fallbackToDefault ? findDefaultRegistryId(db, storeName) : null;
  const existing = (await db.table(storeName).where('nome_normalizado').equals(norm).toArray()).find((row) => !row.deleted_at);
  if (existing) return existing.id;
  const record = registryRecord(storeName, nome, ts);
  await db.table(storeName).add(record);
  return record.id;
}

// Id escolhido na UI (marca_id/raca_id) vale quando existe e está ativo na store; só na
// ausência dele o texto é resolvido (evita criar cadastro duplicado por grafia).
async function existingRegistryId(db, storeName, id) {
  if (!id) return null;
  const row = (await db.table(storeName).where('id').equals(id).toArray()).find((candidate) => !candidate.deleted_at);
  return row ? row.id : null;
}

export function auditRow(fields) {
  return { id: crypto.randomUUID(), ...fields, ...getActor() };
}

// Campos alterados entre duas versões do registro (auditoria resumida).
function changedFields(before, after) {
  const fields = new Set();
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    if (key === 'updated_at' || key === 'localId') continue;
    if (key === 'legacy_payload') {
      const b = before?.legacy_payload || {};
      const a = after?.legacy_payload || {};
      for (const inner of new Set([...Object.keys(b), ...Object.keys(a)])) {
        if (JSON.stringify(b[inner]) !== JSON.stringify(a[inner])) fields.add(`legacy_payload.${inner}`);
      }
      continue;
    }
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) fields.add(key);
  }
  return [...fields].sort();
}

export function newSession({ data, operador, ts }) {
  return {
    id: crypto.randomUUID(),
    data,
    local: null,
    status: 'ABERTA',
    operador: operador || 'LOCAL',
    [SESSION_OPERATOR_FIELD]: actorUserId(),
    marca_padrao_id: null,
    apartacao_padrao_id: null,
    tipo_manejo_padrao: null,
    snapshot: null,
    motivo_reabertura: null,
    inicio: ts,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
}

export function newAnimal({ animalId, ui, marcaId, racaId, propriedadeId, situacao, origem, ts }) {
  return {
    id: animalId,
    empresa_id: ui.empresa_id || EMPRESA_ID,
    identificacao_normalizada: normalized(ui.numero_animal),
    numero_animal: ui.numero_animal || null,
    nome: ui.nome_animal || null,
    sexo: ui.sexo || null,
    // Texto legado somente-leitura (docs 12 §3.2); a referência vive nos ids.
    raca: ui.raca || null,
    era: ui.era || null,
    marca: ui.marca || null,
    marca_id: marcaId,
    raca_id: racaId,
    categoria_id: ui.categoria_id || null,
    // Automática salvo escolha manual no lançamento: o Manejo recalcula pelo peso.
    categoria_automatica: ui.categoria_automatica !== false,
    propriedade_id: propriedadeId,
    nascimento: null,
    nascimento_estimado: false,
    situacao,
    ...(origem ? { origem } : {}),
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
}

export function newVisualIdentifier({ animalId, ui, marcaId, inicio, ts }) {
  return {
    id: crypto.randomUUID(),
    animal_id: animalId,
    tipo: 'VISUAL',
    valor: ui.numero_animal || null,
    valor_normalizado: normalized(ui.numero_animal),
    marca_id: marcaId,
    marca: ui.marca || null,
    faixa_id: null,
    inicio,
    fim: null,
    motivo_troca: null,
    principal: true,
    ativo: true,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
}

async function activeEventsOf(db, animalId) {
  if (!animalId) return [];
  return (await db.table('pesagens').where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at);
}

/**
 * Linha do tempo do animal (P05/P07): valida a SÉRIE INTEIRA depois da mudança (domain/animalTimeline).
 * Chamar DENTRO da transação de escrita: duas gravações concorrentes do mesmo animal são serializadas pelo
 * IndexedDB e a segunda já enxerga a primeira (sem duplicar Manejo no dia).
 * @param {{ upsert?: object[], removeIds?: string[] }} change
 */
export async function assertAnimalTimeline(db, animalId, change = {}) {
  if (!animalId) return;
  try {
    validateAnimalTimeline(await activeEventsOf(db, animalId), change);
  } catch (err) {
    if (err instanceof TimelineError) throw Object.assign(new Error(err.message), { code: err.code });
    throw err;
  }
}

// Compatibilidade (contrato antigo): valida o evento como inclusão/edição na série do animal.
export async function validateAnimalChronology(db, { animalId, data, ui, ignoredEntryId = null }) {
  if (!animalId || !data) return;
  await assertAnimalTimeline(db, animalId, {
    upsert: [{ id: ignoredEntryId || `__novo__${crypto.randomUUID()}`, data_pesagem: data, legacy_payload: ui, created_at: new Date().toISOString() }],
  });
}

// Pesagem de animal com categoria automática: grava no payload a categoria e a era
// da faixa de peso daquele momento (a relação mostra a era de cada pesagem).
// Sem peso (Saída por Morte/Doação/Transferência) ou peso fora de toda faixa, a pesagem
// herda a última categoria válida do animal: ausência de peso nunca apaga classificação.
export async function stampAutomaticCategory(db, entry, { automatic, sexo, categoriaAtualId = null }) {
  const ui = entry.legacy_payload;
  if (!automatic || !ui || typeof ui !== 'object') return;
  const peso = weightOf(entry);
  const categorias = peso == null ? [] : await db.table('categoriasAnimal').toArray();
  const categoria = peso == null ? null : suggestCategory({ categorias, sexo, peso });
  ui.categoria_id = categoria?.id ?? categoriaAtualId ?? ui.categoria_id ?? null;
  ui.categoria_automatica = true;
  const era = eraOfCategory(categoria);
  if (era) ui.era = era;
}

// Peso válido do evento (coluna ou payload); null quando ausente ou não positivo.
export function weightOf(row) {
  const value = Number(row?.peso_kg ?? weighingUi(row).peso);
  return row && (row.peso_kg != null || weighingUi(row).peso != null) && Number.isFinite(value) && value > 0 ? value : null;
}

export async function rebuildAnimalStateProjection(db, animalId, timestamp = new Date().toISOString()) {
  if (!animalId) return null;
  const animal = await db.table('animais').where('id').equals(animalId).first();
  if (!animal || animal.deleted_at) return null;
  const events = (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
    .filter((row) => !row.deleted_at)
    .sort(eventOrder);
  const latest = events.at(-1) || null;
  const latestUi = weighingUi(latest);
  const latestExit = [...events].reverse().find((row) => weighingUi(row).tipo_manejo === 'Saída') || null;
  const exitUi = weighingUi(latestExit);
  const openLots = (await db.table('animalLotes').where('animal_id').equals(animalId).toArray())
    .filter((row) => !row.deleted_at && !row.fim)
    .sort((left, right) => String(left.inicio || '').localeCompare(String(right.inicio || '')));
  const currentLot = openLots.at(-1) || null;
  const inactive = Boolean(latestExit);
  // Último evento COM peso: Saída sem peso não zera peso atual nem categoria (R0 reporting).
  const latestWeighed = [...events].reverse().find((row) => weightOf(row) != null) || null;
  const categoryChanges = {};
  if (animal.categoria_automatica !== false && latestWeighed) {
    const categorias = await db.table('categoriasAnimal').toArray();
    const categoria = suggestCategory({ categorias, sexo: animal.sexo, peso: weightOf(latestWeighed) });
    // Sem faixa correspondente, preserva a última categoria válida em vez de gravar null.
    if (categoria) {
      categoryChanges.categoria_id = categoria.id;
      const era = eraOfCategory(categoria);
      if (era) categoryChanges.era = era;
    }
  }
  const changes = {
    ...categoryChanges,
    // Enum v7 (ADR-028): derivado do motivo da saída definitiva; sem motivo mapeável → INATIVO.
    situacao: inactive ? situacaoFromExitReason(exitUi.motivo_saida) : 'ATIVO',
    data_saida: inactive ? latestExit.data_pesagem : null,
    motivo_saida: inactive ? exitUi.motivo_saida || 'Saída' : null,
    ultima_pesagem_data: latestWeighed?.data_pesagem || latest?.data_pesagem || null,
    ultimo_peso_kg: latestWeighed ? weightOf(latestWeighed) : null,
    lote_atual_id: inactive ? null : currentLot?.lote_id || latest?.lote_id || null,
    apartacao_atual_id: inactive ? null : currentLot?.apartacao_id || latestUi.apartacao_id || null,
    updated_at: timestamp,
  };
  await db.table('animais').update(animal.localId, changes);
  return changes;
}

/**
 * Animal sem nenhuma pesagem ativa deixa de existir: ele nasce do Cadastro e, sem nenhum
 * evento, não há o que representar. Sem isso o registro continuava ATIVO depois de excluir
 * todas as pesagens e o cadastro (marca, raça, categoria) seguia aparecendo "em uso".
 * Fato histórico: exclusão lógica (deleted_at) no animal, nos identificadores, nas
 * permanências de lote e nos movimentos, com auditoria.
 */
export async function removeOrphanAnimal(db, animalId, timestamp = new Date().toISOString()) {
  if (!animalId) return false;
  const animal = await db.table('animais').where('id').equals(animalId).first();
  if (!animal || animal.deleted_at) return false;
  const restantes = (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
    .filter((row) => !row.deleted_at);
  if (restantes.length) return false;

  await db.table('animais').update(animal.localId, { deleted_at: timestamp, updated_at: timestamp });
  for (const [store, campo] of [['animalIdentificadores', 'animal_id'], ['animalLotes', 'animal_id'], ['movimentosAnimais', 'animal_id']]) {
    const linhas = (await db.table(store).where(campo).equals(animalId).toArray()).filter((row) => !row.deleted_at);
    for (const linha of linhas) await db.table(store).update(linha.localId, { deleted_at: timestamp, updated_at: timestamp });
  }
  await db.table('auditoria').add(auditRow({
    entidade: 'animais',
    entidade_id: animalId,
    acao: 'CANCELAR',
    antes: animal,
    motivo: 'Animal sem pesagens após exclusão',
    created_at: timestamp,
  }));
  return true;
}

/**
 * Permanência em lote derivada das pesagens (P13): compara o esperado (domain/weighingMovements) com o
 * gravado e escreve só a diferença — reaplicar ao mesmo estado não gera soft-delete nem inserção.
 * Mantém a linha existente (e a origem dela) quando lote e início batem; ajusta fim/apartação.
 */
export async function rebuildAnimalLotProjection(db, animalId, timestamp = new Date().toISOString()) {
  if (!animalId) return 0;
  const animalLotTable = db.table('animalLotes');
  const expected = deriveLotStays(await activeEventsOf(db, animalId));
  const previous = (await animalLotTable.where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at);
  const byKey = new Map();
  const extras = [];
  for (const row of previous) {
    const key = stayKey(row);
    if (byKey.has(key)) extras.push(row); else byKey.set(key, row);
  }
  const used = new Set();
  const adds = [];
  for (const stay of expected) {
    const row = byKey.get(stayKey(stay));
    if (row) {
      used.add(row.localId);
      const changes = {};
      if ((row.fim || null) !== (stay.fim || null)) changes.fim = stay.fim || null;
      if ((row.apartacao_id || null) !== (stay.apartacao_id || null)) changes.apartacao_id = stay.apartacao_id || null;
      if (Object.keys(changes).length) await animalLotTable.update(row.localId, { ...changes, updated_at: timestamp });
    } else {
      adds.push({ id: crypto.randomUUID(), animal_id: animalId, lote_id: stay.lote_id, apartacao_id: stay.apartacao_id, inicio: stay.inicio, fim: stay.fim, origem: 'projecao', created_at: timestamp, updated_at: timestamp, deleted_at: null });
    }
  }
  const stale = [...previous.filter((row) => !used.has(row.localId) && !extras.includes(row)), ...extras];
  if (stale.length) await animalLotTable.bulkUpdate(stale.map((row) => ({ key: row.localId, changes: { deleted_at: timestamp, updated_at: timestamp } })));
  if (adds.length) await animalLotTable.bulkAdd(adds);
  return expected.length;
}

/**
 * Movimentos derivados das pesagens (P04/P09): o esperado pela série ativa contra os movimentos ativos COM
 * pesagem_id. Movimento de pesagem cancelada/alterada é cancelado com auditoria; o que falta é criado; o que
 * bate fica como está (idempotente). Movimentos sem pesagem_id (movimentação própria) nunca são tocados.
 */
export async function reconcileWeighingMovements(db, animalId, timestamp = new Date().toISOString(), { origem = 'lancamento' } = {}) {
  if (!animalId) return { criados: 0, cancelados: 0 };
  const table = db.table('movimentosAnimais');
  const expected = deriveWeighingMovements(await activeEventsOf(db, animalId));
  const existing = (await table.where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at && row.pesagem_id);
  const byKey = new Map();
  const duplicates = [];
  for (const row of existing) {
    const key = movementKey(row);
    if (byKey.has(key)) duplicates.push(row); else byKey.set(key, row);
  }
  const matched = new Set();
  const adds = [];
  for (const movement of expected) {
    const row = byKey.get(movementKey(movement));
    if (row) matched.add(row.localId);
    else adds.push({ id: crypto.randomUUID(), animal_id: animalId, ...movement, origem, created_at: timestamp, updated_at: timestamp, deleted_at: null });
  }
  const stale = existing.filter((row) => !matched.has(row.localId));
  for (const row of stale) {
    await table.update(row.localId, { deleted_at: timestamp, updated_at: timestamp });
    await db.table('auditoria').add(auditRow({
      entidade: 'movimentosAnimais', entidade_id: row.id, acao: 'CANCELAR', antes: row,
      motivo: duplicates.includes(row) ? 'Reconciliação: movimento duplicado' : 'Reconciliação: pesagem de origem cancelada ou alterada',
      created_at: timestamp,
    }));
  }
  if (adds.length) await table.bulkAdd(adds);
  return { criados: adds.length, cancelados: stale.length };
}

const DERIVED_FIELDS = ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'];
const sameDerivedValue = (a, b) => {
  const blank = (v) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return blank(a) && blank(b);
  return String(a) === String(b) || Number(a) === Number(b);
};

/**
 * Recalcula os derivados (anterior, dias, ganho, GMD) da série do animal DENTRO da transação de quem chama
 * (P08): se algo falhar, nada fica gravado com GMD velho. Só reescreve as pesagens cujo derivado mudou.
 */
export async function recalculateAnimalSeriesInTransaction(db, animalId, timestamp = new Date().toISOString()) {
  if (!animalId) return 0;
  const rows = await activeEventsOf(db, animalId);
  const views = rows.map((row) => storageRecordToViewModel(row));
  const updates = recalculateWeightSeries(views, new Set([`id:${animalId}`]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  let written = 0;
  for (const update of updates) {
    const row = byId.get(update.id);
    if (!row) continue;
    const ui = weighingUi(row);
    if (DERIVED_FIELDS.every((field) => sameDerivedValue(ui[field], update.patch[field]))) continue;
    await db.table('pesagens').update(row.localId, { legacy_payload: filterLegacyPayload({ ...ui, ...update.patch }), updated_at: timestamp });
    written += 1;
  }
  return written;
}

/** Tudo o que deriva das pesagens do animal, na mesma transação: lotes, movimentos, derivados e estado. */
export async function reconcileAnimalAfterChange(db, animalId, timestamp = new Date().toISOString(), options = {}) {
  if (!animalId) return;
  await rebuildAnimalLotProjection(db, animalId, timestamp);
  await reconcileWeighingMovements(db, animalId, timestamp, options);
  await recalculateAnimalSeriesInTransaction(db, animalId, timestamp);
  await rebuildAnimalStateProjection(db, animalId, timestamp);
}

export async function isStorageAvailable() {
  try {
    await storage.ensureReady();
    return true;
  } catch {
    return false;
  }
}

// `aplicacoesSanidade` (ADR-049): itens já validados pelo domínio de sanidade. As
// stores de sanidade entram no escopo da transação e as aplicações (com auditoria
// CRIAR_APLICACAO_SANIDADE) são gravadas junto da pesagem; referência inválida
// aborta a transação inteira. O retorno traz `aplicacoes_sanidade` (linhas criadas).
export async function createEntry(payload, { aplicacoesSanidade = [] } = {}) {
  storage.assertWritable('Lançamento de pesagem');
  const db = await storage.ensureReady();
  const ui = typeof payload.legacy_payload === 'object' ? payload.legacy_payload : {};
  const ts = new Date().toISOString();
  const entryId = payload.id || crypto.randomUUID();
  const animalId = payload.animal_id || ui.animal_id || (ui.tipo_manejo === 'Cadastro' ? crypto.randomUUID() : null);
  let sessionId = ui.sessao_id || null;
  const entry = { ...payload, id: entryId, animal_id: animalId, sessao_id: sessionId, created_by_user_id: actorUserId(), updated_by_user_id: actorUserId(), created_at: payload.created_at || ts, updated_at: ts, deleted_at: null };
  const isRegistration = ui.tipo_manejo === 'Cadastro';

  const tableNames = ['pesagens', 'auditoria', 'sessoesPesagem', 'animalLotes', 'categoriasAnimal'];
  if (animalId) tableNames.push('animais', 'movimentosAnimais');
  if (isRegistration) tableNames.push('animalIdentificadores', 'marcas', 'racas', 'propriedades');
  const sanityItems = Array.isArray(aplicacoesSanidade) ? aplicacoesSanidade : [];
  if (sanityItems.length) tableNames.push(...LAUNCH_SANITY_TABLES);
  const tables = [...new Set(tableNames)].map((name) => db.table(name));
  let sanityRows = [];

  await db.transaction('rw', tables, async () => {
    if (!sessionId) {
      const session = (await db.table('sessoesPesagem').where('data').equals(payload.data_pesagem).toArray())
        .find((candidate) => !candidate.deleted_at && isOpenSessionStatus(candidate.status));
      if (session) {
        sessionId = session.id;
      } else {
        const created = newSession({ data: payload.data_pesagem, operador: ui.operador, ts });
        await db.table('sessoesPesagem').add(created);
        sessionId = created.id;
      }
      entry.sessao_id = sessionId;
    }
    if (await db.table('pesagens').where('id').equals(entryId).first()) throw new Error(`Pesagem duplicada (${entryId})`);
    // Linha do tempo (P05/P07) dentro da transação: série inteira, sem duplicar Manejo no dia.
    await assertAnimalTimeline(db, animalId, { upsert: [entry] });
    // Referências das aplicações resolvidas antes de gravar a pesagem: erro aborta tudo.
    const sanity = await prepareApplicationRowsInTransaction(db, sanityItems, {
      animalId, data: payload.data_pesagem, sessaoId: sessionId, pesagemId: entryId, empresaId: ui.empresa_id || EMPRESA_ID, ts, origem: 'lancamento',
    });
    const existingForCategory = !isRegistration && animalId ? await db.table('animais').where('id').equals(animalId).first() : null;
    await stampAutomaticCategory(db, entry, isRegistration
      ? { automatic: ui.categoria_automatica !== false, sexo: ui.sexo }
      : { automatic: Boolean(existingForCategory) && existingForCategory.categoria_automatica !== false, sexo: existingForCategory?.sexo, categoriaAtualId: existingForCategory?.categoria_id ?? null });
    await db.table('pesagens').add(entry);
    if (isRegistration) {
      const existingAnimal = await db.table('animais').where('id').equals(animalId).first();
      if (!existingAnimal) {
        const marcaId = await existingRegistryId(db, 'marcas', ui.marca_id) ?? await resolveRegistryId(db, 'marcas', ui.marca, ts, { fallbackToDefault: true });
        const racaId = await existingRegistryId(db, 'racas', ui.raca_id) ?? await resolveRegistryId(db, 'racas', ui.raca, ts);
        const propriedadeId = await findDefaultRegistryId(db, 'propriedades');
        await db.table('animais').add(newAnimal({ animalId, ui, marcaId, racaId, propriedadeId, situacao: 'ATIVO', origem: null, ts }));
        await db.table('animalIdentificadores').add(newVisualIdentifier({ animalId, ui, marcaId, inicio: payload.data_pesagem, ts }));
      }
    }
    const currentLots = animalId
      ? (await db.table('animalLotes').where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at && !row.fim)
      : [];
    const currentLot = currentLots.sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')))[0] || null;
    if (ui.tipo_manejo === 'Saída') {
      if (currentLot) await db.table('animalLotes').update(currentLot.localId, { fim: payload.data_pesagem, updated_at: ts });
    } else if (animalId && payload.lote_id && currentLot?.lote_id !== payload.lote_id) {
      if (currentLot) await db.table('animalLotes').update(currentLot.localId, { fim: payload.data_pesagem, updated_at: ts });
      await db.table('animalLotes').add({ id: crypto.randomUUID(), animal_id: animalId, lote_id: payload.lote_id, apartacao_id: ui.apartacao_id || null, inicio: payload.data_pesagem, fim: null, origem: 'lancamento', created_at: ts, updated_at: ts, deleted_at: null });
    }
    await db.table('auditoria').add(auditRow({
      entidade: 'pesagens',
      entidade_id: entryId,
      acao: 'CRIAR',
      depois: entry,
      origem: ui.origem || 'manual',
      operador: ui.operador || null,
      created_at: ts,
    }));
    if (sanity.rows.length) {
      await db.table(APLICACOES_STORE).bulkAdd(sanity.rows.map((row) => ({ ...row })));
      await db.table('auditoria').bulkAdd(sanity.audits);
      sanityRows = sanity.rows;
    }
    // Lotes (idempotente), movimentos derivados (P04/P09), derivados da série (P08) e estado do animal —
    // tudo na mesma transação: retroativo ou não, o histórico sai coerente ou nada é gravado.
    await reconcileAnimalAfterChange(db, animalId, ts, { origem: ui.origem === 'importacao' ? 'importacao' : 'lancamento' });
  });
  return { ...storageRecordToViewModel(entry), aplicacoes_sanidade: sanityRows };
}

/**
 * Correção da identificação no Cadastro (P06): número/marca mudam no animal E no identificador VISUAL
 * ativo, na mesma transação, com checagem de colisão contra outro animal ativo e auditoria. É correção
 * de digitação (o identificador é o mesmo); troca real de brinco é outro fluxo (Identificadores).
 */
async function correctVisualIdentification(db, animal, { numero, marcaId, marcaNome, ts }) {
  const novoNumero = normalized(numero);
  const atualNumero = normalized(animal.numero_animal || animal.identificacao_normalizada);
  if (!novoNumero || (novoNumero === atualNumero && (marcaId || null) === (animal.marca_id || null))) return false;
  const colisoes = (await db.table('animais').where('identificacao_normalizada').equals(novoNumero).toArray())
    .filter((row) => !row.deleted_at && String(row.id) !== String(animal.id) && (row.marca_id || null) === (marcaId || null)
      && !['VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO'].includes(row.situacao));
  if (colisoes.length) {
    throw Object.assign(new Error(`A identificação ${numero} já pertence a outro animal ativo${marcaNome ? ` da marca ${marcaNome}` : ''}.`), { code: 'IDENTIFICACAO_EM_USO' });
  }
  const visuais = (await db.table('animalIdentificadores').where('animal_id').equals(animal.id).toArray())
    .filter((row) => !row.deleted_at && row.tipo === 'VISUAL' && row.ativo !== false);
  if (visuais.length) {
    for (const row of visuais) {
      await db.table('animalIdentificadores').update(row.localId, {
        valor: numero, valor_normalizado: novoNumero, marca_id: marcaId || null, marca: marcaNome || null, updated_at: ts,
      });
    }
  } else {
    await db.table('animalIdentificadores').add(newVisualIdentifier({ animalId: animal.id, ui: { numero_animal: numero, marca: marcaNome }, marcaId: marcaId || null, inicio: animal.created_at?.slice(0, 10) || null, ts }));
  }
  await db.table('auditoria').add(auditRow({
    entidade: 'animalIdentificadores', entidade_id: animal.id, acao: 'CORRIGIR',
    resumo: `Correção da identificação do cadastro: ${animal.numero_animal || atualNumero} → ${numero}`,
    campos_alterados: ['valor', 'valor_normalizado', 'marca_id'], created_at: ts,
  }));
  return true;
}

export async function updateEntry(id, payload) {
  storage.assertWritable('Edição de pesagem');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  const tables = ['pesagens', 'animais', 'animalLotes', 'auditoria', 'marcas', 'racas', 'categoriasAnimal', 'movimentosAnimais', 'animalIdentificadores'].map((name) => db.table(name));
  let updated = null;
  await db.transaction('rw', tables, async () => {
    const rows = await db.table('pesagens').where('id').equals(id).toArray();
    const existing = [...rows].reverse().find((row) => !row.deleted_at);
    if (!existing) return;
    updated = { ...existing, ...payload, id, updated_by_user_id: actorUserId(), updated_at: ts };
    const ui = typeof updated.legacy_payload === 'object' ? updated.legacy_payload : {};
    // Série inteira (P05): mover o Cadastro para depois dos Manejos ou a Saída para antes deles é recusado.
    await assertAnimalTimeline(db, updated.animal_id, { upsert: [updated] });
    const trocouAnimal = existing.animal_id && existing.animal_id !== updated.animal_id;
    if (trocouAnimal) await assertAnimalTimeline(db, existing.animal_id, { removeIds: [id] });
    const animalAtual = updated.animal_id ? await db.table('animais').where('id').equals(updated.animal_id).first() : null;
    const isRegistration = ui.tipo_manejo === 'Cadastro';
    await stampAutomaticCategory(db, updated, isRegistration
      ? { automatic: ui.categoria_automatica !== false, sexo: ui.sexo ?? animalAtual?.sexo }
      : { automatic: Boolean(animalAtual) && animalAtual.categoria_automatica !== false, sexo: animalAtual?.sexo, categoriaAtualId: animalAtual?.categoria_id ?? null });
    await db.table('pesagens').update(existing.localId, updated);
    if (isRegistration && updated.animal_id) {
      const animal = animalAtual;
      if (animal) {
        const marcaId = await existingRegistryId(db, 'marcas', ui.marca_id) ?? (ui.marca ? await resolveRegistryId(db, 'marcas', ui.marca, ts) : animal.marca_id ?? null);
        const racaId = await existingRegistryId(db, 'racas', ui.raca_id) ?? (ui.raca ? await resolveRegistryId(db, 'racas', ui.raca, ts) : animal.raca_id ?? null);
        const numero = ui.numero_animal || animal.numero_animal;
        const marcaNome = ui.marca ?? animal.marca;
        await correctVisualIdentification(db, animal, { numero, marcaId, marcaNome, ts });
        await db.table('animais').update(animal.localId, {
          numero_animal: numero,
          identificacao_normalizada: String(numero || animal.identificacao_normalizada || '').trim().toUpperCase(),
          sexo: ui.sexo ?? animal.sexo,
          raca: ui.raca ?? animal.raca,
          era: ui.era ?? animal.era,
          marca: marcaNome,
          marca_id: marcaId,
          raca_id: racaId,
          categoria_id: ui.categoria_id ?? animal.categoria_id ?? null,
          categoria_automatica: ui.categoria_automatica !== undefined ? ui.categoria_automatica !== false : animal.categoria_automatica !== false,
          updated_at: ts,
        });
      }
    }
    await db.table('auditoria').add(auditRow({ entidade: 'pesagens', entidade_id: id, acao: 'ATUALIZAR', antes: existing, depois: updated, origem: 'manual', operador: ui.operador || null, created_at: ts }));
    // Lotes, movimentos da versão anterior (P09), derivados (P08) e estado — na mesma transação.
    await reconcileAnimalAfterChange(db, updated.animal_id, ts);
    if (trocouAnimal) await reconcileAnimalAfterChange(db, existing.animal_id, ts);
  });
  return updated ? storageRecordToViewModel(updated) : null;
}

export async function deleteEntry(id, { motivo } = {}) {
  return bulkDeleteEntries([id], { motivo });
}

// M1 (1.5.0) — Repesagem no mesmo dia (M1-FUNDACAO-NUMERO.md §4). Cancela a(s) pesagem(ns) de hoje do animal e grava
// a nova numa ÚNICA transação: se qualquer parte falhar, nada muda e a de hoje continua valendo — o animal nunca fica
// sem nenhuma das duas. Sem campo novo: nada de esquema.
// Ordem dentro da transação:
//   1. cancelamento pelo fluxo de sempre (bulkDeleteEntries: deleted_at + auditoria CANCELAR, com o motivo informado;
//      aplicações de sanidade vinculadas canceladas junto — ADR-049; permanência em lote reconstruída);
//   2. se o animal ficou sem nenhuma pesagem (só tinha a de hoje, sem Cadastro — dado antigo), desfaz tudo: o
//      cancelamento o removeria (removeOrphanAnimal) e a nova ficaria presa a um animal excluído;
//   3. grava a nova (createEntry), que gera o próprio movimento quando muda de lote em relação ao lote reconstruído;
//   4. o movimento que a pesagem substituída gerou (Mudança de lote) não fica apontando para pesagem cancelada:
//      passa para a nova quando ela não gerou o dela e vai para o mesmo lote (repesagem retroativa, em que o
//      createEntry compara com o lote atual); senão sai junto. O cancelamento comum ainda deixa esse movimento ativo
//      (limitação conhecida, docs/evidence/operational-reconciliation-preflight); a repesagem não.
// createEntry e bulkDeleteEntries abrem transações com subconjuntos destas tabelas, que o Dexie aninha nesta.
const REWEIGH_TABLES = Object.freeze([
  'pesagens', 'auditoria', 'sessoesPesagem', 'animalLotes', 'categoriasAnimal', 'animais', 'movimentosAnimais',
  'animalIdentificadores', 'marcas', 'racas', 'propriedades', ...LAUNCH_SANITY_TABLES,
]);

export async function replaceEntries(previousIds, payload, { motivo, aplicacoesSanidade = [] } = {}) {
  const ids = [...new Set((previousIds || []).filter(Boolean).map(String))];
  if (!ids.length) throw new Error('Repesagem sem a pesagem de hoje a substituir.');
  storage.assertWritable('Repesagem');
  const db = await storage.ensureReady();
  const ui = typeof payload?.legacy_payload === 'object' ? payload.legacy_payload : {};
  const animalId = payload?.animal_id || ui.animal_id || null;
  let created = null;
  await db.transaction('rw', REWEIGH_TABLES.map((name) => db.table(name)), async () => {
    const cancelled = await bulkDeleteEntries(ids, { motivo });
    // Já cancelada (outra tela, outro operador) ou inexistente: nada é gravado.
    if (cancelled !== ids.length) throw new Error('A pesagem de hoje deste animal não está mais ativa. Nada foi gravado; confira a lista do dia.');
    const animal = animalId ? await db.table('animais').where('id').equals(animalId).first() : null;
    if (animal?.deleted_at) throw new Error('Esse animal só tem a pesagem de hoje, sem cadastro. Para trocar o peso, use Editar na lista do dia.');
    // Movimento da pesagem substituída: a reconciliação do createEntry (reconcileWeighingMovements) cancela o
    // dela e cria o da nova quando ela também muda de lote — um único "Mudança de lote" ativo, da nova.
    created = await createEntry(payload, { aplicacoesSanidade });
  });
  return created;
}

export async function bulkCreateEntries(payloads, { importMetadata = null } = {}) {
  if ((!Array.isArray(payloads) || payloads.length === 0) && !importMetadata?.hash) {
    return { registros_criados: 0, animais_criados: 0, movimentos_criados: 0, animais_afetados: 0 };
  }
  storage.assertWritable('Importação de pesagens');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  // categoriasAnimal por último: só a projeção do animal a lê (fora da desestruturação abaixo).
  const tableNames = ['pesagens', 'animais', 'animalIdentificadores', 'movimentosAnimais', 'animalLotes', 'sessoesPesagem', 'auditoria', 'importacoes', 'marcas', 'racas', 'propriedades', 'categoriasAnimal'];
  const tables = tableNames.map((name) => db.table(name));
  const [weighingTable, animalTable, identifierTable, movementTable, animalLotTable, sessionTable, auditTable, importTable, marcaTable, racaTable, propriedadeTable] = tables;
  const identityKey = (ui) => `${normalized(ui.numero_animal)}::${normalized(ui.marca)}`;
  let report = null;

  await db.transaction('rw', tables, async () => {
    if (importMetadata?.hash) {
      const previous = await importTable.where('arquivo_hash').equals(importMetadata.hash).first();
      if (previous && !previous.deleted_at && previous.status === 'CONCLUIDA') {
        throw new Error(`Arquivo já importado em ${previous.created_at || 'data anterior'} (${previous.id})`);
      }
    }

    if (!Array.isArray(payloads) || payloads.length === 0) {
      const importRecord = {
        id: importMetadata.id || crypto.randomUUID(), arquivo_hash: importMetadata.hash,
        arquivo_nome: importMetadata.name || null, arquivo_tamanho: importMetadata.size ?? null,
        origem: importMetadata.origin || 'csv', status: 'CONCLUIDA', linhas_total: importMetadata.totalRows ?? 0,
        registros_criados: 0, animais_criados: 0, movimentos_criados: 0,
        created_at: ts, updated_at: ts, deleted_at: null,
      };
      await importTable.add(importRecord);
      report = importRecord;
      return;
    }

    const payloadIds = new Set();
    for (const payload of payloads) {
      const id = payload.id || crypto.randomUUID();
      if (payloadIds.has(String(id))) throw new Error(`pesagens: id duplicado no lote (${id})`);
      payloadIds.add(String(id));
      if (await weighingTable.where('id').equals(id).first()) throw new Error(`pesagens: id já existente (${id})`);
      payload.id = id;
    }

    // Cadastros mestres: mapa nome_normalizado → id (existentes + criados no lote).
    const marcas = (await marcaTable.toArray()).filter((row) => !row.deleted_at);
    const racas = (await racaTable.toArray()).filter((row) => !row.deleted_at);
    const marcaIdByNorm = new Map(marcas.map((row) => [row.nome_normalizado, row.id]));
    const marcaNomeById = new Map(marcas.map((row) => [row.id, row.nome]));
    const racaIdByNorm = new Map(racas.map((row) => [row.nome_normalizado, row.id]));
    const marcaPadraoId = marcas.find((row) => row.padrao === true)?.id || null;
    const propriedadePadraoId = (await propriedadeTable.toArray()).find((row) => !row.deleted_at && row.padrao === true)?.id || null;
    const newMarcas = [];
    const newRacas = [];
    const resolveInBatch = (storeName, text, map, pending) => {
      const nome = String(text ?? '').trim();
      const norm = normalizeName(nome);
      if (!norm) return null;
      if (map.has(norm)) return map.get(norm);
      const record = registryRecord(storeName, nome, ts);
      map.set(norm, record.id);
      pending.push(record);
      if (storeName === 'marcas') marcaNomeById.set(record.id, record.nome);
      return record.id;
    };

    const animals = await animalTable.toArray();
    const identifiers = await identifierTable.toArray();
    const existingWeighings = (await weighingTable.toArray()).filter((row) => !row.deleted_at);
    const animalsById = new Map(animals.filter((row) => !row.deleted_at).map((row) => [String(row.id), row]));
    const identifierByIdentity = new Map();
    for (const identifier of identifiers.filter((row) => !row.deleted_at && row.ativo !== false)) {
      if (!identifier.valor_normalizado) continue;
      // v7: VISUAL guarda só o número; a marca vem de marca_id. Legado: NÚMERO::MARCA.
      const key = identifier.tipo === 'VISUAL' && identifier.marca_id
        ? `${normalized(identifier.valor_normalizado)}::${normalized(marcaNomeById.get(identifier.marca_id) ?? identifier.marca)}`
        : normalized(identifier.valor_normalizado);
      identifierByIdentity.set(key, identifier.animal_id);
    }
    for (const animal of animals.filter((row) => !row.deleted_at)) {
      identifierByIdentity.set(`${normalized(animal.numero_animal || animal.identificacao_normalizada)}::${normalized(animal.marca)}`, animal.id);
    }

    const openSessions = (await sessionTable.toArray()).filter((row) => !row.deleted_at && isOpenSessionStatus(row.status));
    const sessionsByDate = new Map(openSessions.map((row) => [row.data, row]));
    const existingLotHistory = (await animalLotTable.toArray()).filter((row) => !row.deleted_at);
    const currentLotByAnimal = new Map(existingLotHistory.filter((row) => !row.fim).map((row) => [String(row.animal_id), row]));
    const chronologyByAnimal = new Map();
    for (const row of [...existingWeighings].sort(eventOrder)) {
      if (!row.animal_id || !row.data_pesagem) continue;
      const animalKey = String(row.animal_id);
      const state = chronologyByAnimal.get(animalKey) || { registrationDate: null, exitDate: null, latestDate: null };
      const rowUi = weighingUi(row);
      if (rowUi.tipo_manejo === 'Cadastro' && !state.registrationDate) state.registrationDate = row.data_pesagem;
      if (rowUi.tipo_manejo === 'Saída' && !state.exitDate) state.exitDate = row.data_pesagem;
      if (!state.latestDate || row.data_pesagem > state.latestDate) state.latestDate = row.data_pesagem;
      chronologyByAnimal.set(animalKey, state);
    }
    const newAnimals = [];
    const newIdentifiers = [];
    const newSessions = [];
    const entries = [];
    const movements = [];
    const newAnimalLots = [];
    const lotUpdates = [];
    const audits = [];
    const affectedAnimals = new Set();

    const orderedPayloads = [...payloads].sort((left, right) => String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || '')) || String(left.id).localeCompare(String(right.id)));
    for (const payload of orderedPayloads) {
      const ui = typeof payload.legacy_payload === 'object' ? { ...payload.legacy_payload } : {};
      const key = identityKey(ui);
      let animalId = payload.animal_id || ui.animal_id || identifierByIdentity.get(key) || null;
      let animal = animalId ? animalsById.get(String(animalId)) : null;
      if (!animal) {
        animalId = animalId || crypto.randomUUID();
        const marcaId = resolveInBatch('marcas', ui.marca, marcaIdByNorm, newMarcas) ?? marcaPadraoId;
        const racaId = resolveInBatch('racas', ui.raca, racaIdByNorm, newRacas);
        animal = newAnimal({
          animalId,
          ui,
          marcaId,
          racaId,
          propriedadeId: propriedadePadraoId,
          situacao: ui.tipo_manejo === 'Saída' ? situacaoFromExitReason(ui.motivo_saida) : 'ATIVO',
          origem: 'importacao',
          ts,
        });
        newAnimals.push(animal);
        animalsById.set(String(animalId), animal);
        identifierByIdentity.set(key, animalId);
        newIdentifiers.push(newVisualIdentifier({ animalId, ui, marcaId, inicio: payload.data_pesagem, ts }));
      }
      affectedAnimals.add(animalId);

      const chronologyKey = String(animalId);
      const chronology = chronologyByAnimal.get(chronologyKey) || { registrationDate: null, exitDate: null, latestDate: null };
      const eventDate = payload.data_pesagem;
      if (ui.tipo_manejo === 'Cadastro' && chronology.registrationDate) {
        throw new Error(`O animal já possui cadastro em ${chronology.registrationDate}. Use a edição do cadastro existente.`);
      }
      if (ui.tipo_manejo !== 'Cadastro' && chronology.registrationDate && eventDate < chronology.registrationDate) {
        throw new Error(`A data ${eventDate} é anterior ao cadastro do animal (${chronology.registrationDate}).`);
      }
      if (chronology.exitDate && eventDate >= chronology.exitDate) {
        throw new Error(`O animal já possui saída em ${chronology.exitDate}. Cancele ou corrija esse evento antes de importar outro.`);
      }
      if (ui.tipo_manejo === 'Saída' && chronology.latestDate && chronology.latestDate > eventDate) {
        throw new Error(`Existem lançamentos posteriores a ${eventDate}. Corrija ou cancele esses eventos antes de importar a saída retroativa.`);
      }
      if (ui.tipo_manejo === 'Cadastro') chronology.registrationDate = eventDate;
      if (ui.tipo_manejo === 'Saída') chronology.exitDate = eventDate;
      if (!chronology.latestDate || eventDate > chronology.latestDate) chronology.latestDate = eventDate;
      chronologyByAnimal.set(chronologyKey, chronology);

      let session = sessionsByDate.get(payload.data_pesagem);
      if (!session) {
        session = newSession({ data: payload.data_pesagem, operador: importMetadata?.operador || 'IMPORTACAO', ts });
        sessionsByDate.set(payload.data_pesagem, session);
        newSessions.push(session);
      }
      const entry = {
        ...payload,
        animal_id: animalId,
        sessao_id: session.id,
        legacy_payload: filterLegacyPayload({ ...ui, animal_id: animalId, sessao_id: session.id, origem: 'importacao' }),
        created_by_user_id: actorUserId(),
        updated_by_user_id: actorUserId(),
        created_at: payload.created_at || ts,
        updated_at: ts,
        deleted_at: null,
      };
      entries.push(entry);

      const currentLot = currentLotByAnimal.get(String(animalId)) || null;
      let movementType = ui.tipo_manejo === 'Cadastro' ? 'Entrada' : ui.tipo_manejo === 'Saída' ? ui.motivo_saida || 'Saída' : null;
      if (ui.tipo_manejo === 'Saída') {
        if (currentLot) {
          if (currentLot.localId) lotUpdates.push({ key: currentLot.localId, changes: { fim: payload.data_pesagem, updated_at: ts } });
          else currentLot.fim = payload.data_pesagem;
          currentLotByAnimal.delete(String(animalId));
        }
      } else if (payload.lote_id && currentLot?.lote_id !== payload.lote_id) {
        if (currentLot?.localId) lotUpdates.push({ key: currentLot.localId, changes: { fim: payload.data_pesagem, updated_at: ts } });
        else if (currentLot) currentLot.fim = payload.data_pesagem;
        const nextLot = { id: crypto.randomUUID(), animal_id: animalId, lote_id: payload.lote_id, apartacao_id: ui.apartacao_id || null, inicio: payload.data_pesagem, fim: null, origem: 'importacao', created_at: ts, updated_at: ts, deleted_at: null };
        newAnimalLots.push(nextLot);
        currentLotByAnimal.set(String(animalId), nextLot);
        if (!movementType && currentLot) movementType = 'Mudança de lote';
      }
      if (movementType) movements.push({
        id: crypto.randomUUID(), animal_id: animalId, pesagem_id: entry.id, tipo: movementType,
        data_evento: payload.data_pesagem, lote_origem_id: currentLot?.lote_id || null, lote_destino_id: payload.lote_id || null,
        motivo: ui.motivo_saida || null, origem: 'importacao', created_at: ts, updated_at: ts, deleted_at: null,
      });
      audits.push(auditRow({ entidade: 'pesagens', entidade_id: entry.id, acao: 'CRIAR', depois: entry, origem: 'importacao', operador: importMetadata?.operador || null, created_at: ts }));
    }

    if (newMarcas.length) await marcaTable.bulkAdd(newMarcas);
    if (newRacas.length) await racaTable.bulkAdd(newRacas);
    if (newAnimals.length) await animalTable.bulkAdd(newAnimals);
    if (newIdentifiers.length) await identifierTable.bulkAdd(newIdentifiers);
    if (newSessions.length) await sessionTable.bulkAdd(newSessions);
    await weighingTable.bulkAdd(entries);
    if (movements.length) await movementTable.bulkAdd(movements);
    if (lotUpdates.length) await animalLotTable.bulkUpdate(lotUpdates);
    if (newAnimalLots.length) await animalLotTable.bulkAdd(newAnimalLots);
    if (audits.length) await auditTable.bulkAdd(audits);
    for (const animalId of affectedAnimals) await rebuildAnimalStateProjection(db, animalId, ts);

    if (importMetadata?.hash) {
      const importRecord = {
        id: importMetadata.id || crypto.randomUUID(), arquivo_hash: importMetadata.hash,
        arquivo_nome: importMetadata.name || null, arquivo_tamanho: importMetadata.size ?? null,
        origem: importMetadata.origin || 'csv', status: 'CONCLUIDA', linhas_total: importMetadata.totalRows ?? payloads.length,
        registros_criados: entries.length, animais_criados: newAnimals.length, movimentos_criados: movements.length,
        created_at: ts, updated_at: ts, deleted_at: null,
      };
      await importTable.add(importRecord);
      report = importRecord;
    }
    report = report || { registros_criados: entries.length, animais_criados: newAnimals.length, movimentos_criados: movements.length, animais_afetados: affectedAnimals.size };
  });
  return report;
}

export async function bulkUpdateEntries(items, { audit = true, origin = 'edicao-coletiva', systemDerived = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  storage.assertWritable('Atualização de pesagens');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  if (systemDerived) {
    const table = db.table('pesagens');
    const unresolved = items.filter((item) => item.localId == null);
    const requestedIds = [...new Set(unresolved.map((item) => item.id))];
    const rows = requestedIds.length
      ? await table.where('id').anyOf(requestedIds).toArray()
      : [];
    const activeById = new Map();
    for (const row of rows) if (!row.deleted_at) activeById.set(row.id, row);
    const operations = items.map((item) => {
      const existing = item.localId == null ? activeById.get(item.id) : null;
      const localId = item.localId ?? existing?.localId;
      if (localId == null) throw new Error(`pesagens: registro não encontrado (${item.id})`);
      // O recálculo recebe o view model inteiro (_localId, status_animal, created_date…):
      // só a lista permitida entra no snapshot (ADR-027).
      const legacyPayload = item.legacyPayload ? filterLegacyPayload(item.legacyPayload) : null;
      return {
        key: localId,
        changes: {
          ...item.patch,
          ...(legacyPayload ? { legacy_payload: legacyPayload } : {}),
          id: item.id,
          updated_at: ts,
        },
      };
    });
    // Para séries curtas, bulkUpdate do Dexie/fake-indexeddb percorre uma rota
    // desproporcionalmente cara conforme a tabela cresce. Atualizações diretas
    // pela chave primária, agrupadas em uma única transação, preservam a
    // atomicidade e mantêm o custo proporcional ao histórico do animal.
    await db.transaction('rw', table, async () => {
      for (const operation of operations) {
        await table.update(operation.key, operation.changes);
      }
    });
    return operations.length;
  }
  const affectedAnimals = new Set();
  let updatedCount = 0;
  await db.transaction('rw', db.table('pesagens'), db.table('animais'), db.table('animalLotes'), db.table('auditoria'), db.table('categoriasAnimal'), db.table('movimentosAnimais'), async () => {
    for (const item of items) {
      const rows = await db.table('pesagens').where('id').equals(item.id).toArray();
      const existing = [...rows].reverse().find((row) => !row.deleted_at);
      if (!existing) throw new Error(`pesagens: registro não encontrado (${item.id})`);
      const updated = { ...existing, ...item.patch, id: existing.id, updated_by_user_id: actorUserId(), updated_at: ts };
      const ui = weighingUi(updated);
      await assertAnimalTimeline(db, updated.animal_id, { upsert: [updated] });
      if (existing.animal_id && existing.animal_id !== updated.animal_id) await assertAnimalTimeline(db, existing.animal_id, { removeIds: [existing.id] });
      await db.table('pesagens').update(existing.localId, updated);
      if (existing.animal_id) affectedAnimals.add(existing.animal_id);
      if (updated.animal_id) affectedAnimals.add(updated.animal_id);
      if (audit) {
        // ATUALIZAR em massa: resumo + campos alterados (docs 12 §3.2), sem antes/depois completos.
        const campos = changedFields(existing, updated);
        await db.table('auditoria').add(auditRow({
          entidade: 'pesagens', entidade_id: existing.id,
          acao: 'ATUALIZAR', origem: origin,
          resumo: `${origin === 'edicao-coletiva' ? 'Edição coletiva' : 'Atualização em massa'}: ${campos.length} campo(s) alterado(s)`,
          campos_alterados: campos,
          operador: ui.operador || null, created_at: ts,
        }));
      }
      updatedCount += 1;
    }
    // Lotes (idempotente), movimentos (P09), derivados (P08) e estado de cada animal afetado.
    for (const animalId of affectedAnimals) await reconcileAnimalAfterChange(db, animalId, ts);
  });
  return updatedCount;
}

const ANIMAL_PROFILE_FIELDS = Object.freeze(['sexo', 'era']);
const ANIMAL_PROFILE_REFERENCES = Object.freeze({
  marca_id: { store: 'marcas', textField: 'marca' },
  raca_id: { store: 'racas', textField: 'raca' },
  categoria_id: { store: 'categoriasAnimal', textField: null },
});

/**
 * Atualização coletiva do cadastro atual do animal.
 *
 * O animal é a fonte canônica, mas os lançamentos anteriores ainda carregam um
 * snapshot compatível em `legacy_payload`. Mantê-los sincronizados garante que
 * a Relação, exportações e instalações antigas mostrem a mesma identificação.
 * Uma troca de marca também atualiza o identificador VISUAL e recusa colisões
 * número + marca com outro animal.
 */
export async function bulkUpdateAnimalProfiles(items, { audit = true, origin = 'edicao-coletiva' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  storage.assertWritable('Atualização coletiva de animais');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  const byAnimal = new Map();
  for (const item of items) {
    const animalId = String(item?.animalId || item?.animal_id || '').trim();
    if (!animalId) continue;
    byAnimal.set(animalId, { animalId, patch: { ...(item.patch || {}) } });
  }
  if (!byAnimal.size) return 0;

  const tables = ['animais', 'animalIdentificadores', 'pesagens', 'auditoria', 'marcas', 'racas', 'categoriasAnimal'].map((name) => db.table(name));
  let updatedCount = 0;
  await db.transaction('rw', tables, async () => {
    for (const { animalId, patch } of byAnimal.values()) {
      const animal = (await db.table('animais').where('id').equals(animalId).toArray())
        .find((row) => !row.deleted_at);
      if (!animal) throw new Error(`Animal não encontrado (${animalId}).`);

      const changes = {};
      const eventPatch = {};
      for (const field of ANIMAL_PROFILE_FIELDS) {
        if (patch[field] === undefined || patch[field] === null || patch[field] === '') continue;
        changes[field] = patch[field];
        eventPatch[field] = patch[field];
      }

      for (const [idField, config] of Object.entries(ANIMAL_PROFILE_REFERENCES)) {
        if (!patch[idField]) continue;
        const reference = (await db.table(config.store).where('id').equals(patch[idField]).toArray())
          .find((row) => !row.deleted_at && row.ativo !== false);
        if (!reference) throw new Error(`${config.store === 'categoriasAnimal' ? 'Categoria' : config.store === 'marcas' ? 'Marca' : 'Raça'} não encontrada ou inativa.`);
        changes[idField] = reference.id;
        eventPatch[idField] = reference.id;
        if (config.textField) {
          changes[config.textField] = reference.nome;
          eventPatch[config.textField] = reference.nome;
        }
        if (idField === 'categoria_id') {
          changes.categoria_automatica = false;
          eventPatch.categoria_automatica = false;
        }
      }

      if (!Object.keys(changes).length) continue;

      if (changes.marca_id) {
        const visualValue = normalized(animal.numero_animal || animal.identificacao_normalizada);
        const collisions = (await db.table('animalIdentificadores')
          .where('[marca_id+valor_normalizado]')
          .equals([changes.marca_id, visualValue])
          .toArray())
          .filter((row) => !row.deleted_at && row.ativo !== false && String(row.animal_id) !== animalId);
        if (collisions.length) {
          throw new Error(`A identificação ${animal.numero_animal || animal.identificacao_normalizada} já existe na marca ${changes.marca}.`);
        }
      }

      await db.table('animais').update(animal.localId, { ...changes, updated_at: ts });

      if (changes.marca_id) {
        const identifiers = (await db.table('animalIdentificadores').where('animal_id').equals(animalId).toArray())
          .filter((row) => !row.deleted_at && row.tipo === 'VISUAL' && row.ativo !== false);
        for (const identifier of identifiers) {
          await db.table('animalIdentificadores').update(identifier.localId, {
            marca_id: changes.marca_id,
            marca: changes.marca,
            updated_at: ts,
          });
        }
      }

      const events = (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
        .filter((row) => !row.deleted_at);
      for (const event of events) {
        const legacy = filterLegacyPayload({ ...weighingUi(event), ...eventPatch });
        const promoted = {};
        if (eventPatch.marca_id) promoted.marca_id = eventPatch.marca_id;
        if (eventPatch.raca_id) promoted.raca_id = eventPatch.raca_id;
        if (eventPatch.categoria_id) promoted.categoria_id = eventPatch.categoria_id;
        await db.table('pesagens').update(event.localId, {
          ...promoted,
          legacy_payload: legacy,
          updated_at: ts,
          updated_by_user_id: actorUserId(),
        });
      }

      if (audit) {
        const campos = Object.keys(changes).sort();
        await db.table('auditoria').add(auditRow({
          entidade: 'animais',
          entidade_id: animalId,
          acao: 'ATUALIZAR',
          origem: origin,
          resumo: `Edição coletiva do animal: ${campos.length} campo(s) alterado(s)`,
          campos_alterados: campos,
          created_at: ts,
        }));
      }
      updatedCount += 1;
    }
  });
  return updatedCount;
}

// Motivo da auditoria CANCELAR quando quem cancela não informa outro (o texto de sempre).
export const MOTIVO_CANCELAMENTO_PADRAO = 'Exclusão lógica pela interface';
const cancellationReason = (motivo) => (typeof motivo === 'string' && motivo.trim() ? motivo.trim() : MOTIVO_CANCELAMENTO_PADRAO);

// Cancelar a pesagem cancela, na mesma transação, as aplicações de sanidade
// vinculadas por pesagem_id (cancelled_at + motivo "pesagem cancelada"; ADR-049).
// M1: `motivo` opcional vai para a auditoria (ex.: "repesagem"); sem ele, o texto de sempre.
export async function bulkDeleteEntries(ids, { motivo } = {}) {
  const reason = cancellationReason(motivo);
  storage.assertWritable('Exclusão de pesagens');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let removed = 0;
  const affectedAnimals = new Set();
  const removedIds = [];
  await db.transaction('rw', db.table('pesagens'), db.table('animais'), db.table('animalIdentificadores'), db.table('animalLotes'), db.table('movimentosAnimais'), db.table('auditoria'), db.table('categoriasAnimal'), db.table(APLICACOES_STORE), async () => {
    for (const id of ids) {
      const rows = await db.table('pesagens').where('id').equals(id).toArray();
      const existing = [...rows].reverse().find((row) => !row.deleted_at);
      if (!existing) continue;
      if (existing.animal_id) affectedAnimals.add(existing.animal_id);
      await db.table('pesagens').update(existing.localId, { deleted_at: ts, updated_at: ts });
      await db.table('auditoria').add(auditRow({ entidade: 'pesagens', entidade_id: id, acao: 'CANCELAR', antes: existing, motivo: reason, created_at: ts }));
      removedIds.push(existing.id);
      removed += 1;
    }
    await cancelApplicationsForWeighingsInTransaction(db, removedIds, { ts });
    for (const animalId of affectedAnimals) {
      // Sem pesagem nenhuma, o animal sai junto (libera marca/raça/categoria do "Em uso").
      if (await removeOrphanAnimal(db, animalId, ts)) continue;
      // P04: movimento da pesagem cancelada sai junto (auditado); lotes, derivados e estado recompostos.
      await reconcileAnimalAfterChange(db, animalId, ts);
    }
  });
  return removed;
}

export async function getEntryById(id) {
  const row = await storage.weighing.get(id);
  return storageRecordToViewModel(row);
}

export async function listEntriesPage(filters = {}) {
  // rows crus (a listAllEntries mapeia). Usa a consulta por período do repo.
  return storage.weighing.listByPeriodo(filters);
}

export async function listAllEntries(filters = {}) {
  const rows = await storage.weighing.listByPeriodo(filters);
  return rows.map((row) => storageRecordToViewModel(row));
}

export async function countEntries(filters = {}) {
  const rows = await storage.weighing.listByPeriodo(filters);
  return rows.length;
}

export async function getSummary(filters = {}) {
  const s = await storage.weighing.summary(filters);
  return { total: s.total, pesoTotal: s.somaPeso, ...s };
}

/**
 * Reparo (P04/P08/P13): reconcilia lotes, movimentos derivados, GMD e estado de TODOS os animais com
 * pesagem ativa — limpa o que versões anteriores deixaram (movimento de pesagem cancelada, permanências
 * duplicadas, derivados velhos). Idempotente: num banco coerente não grava nada. Quem chama faz o backup
 * antes (Manutenção). Em blocos para não segurar uma transação gigante.
 */
export async function reconcileAllAnimalDerivations({ chunkSize = 200, onProgress } = {}) {
  storage.assertWritable('Reconciliação de derivados');
  const db = await storage.ensureReady();
  const ids = [...new Set((await db.table('pesagens').toArray()).filter((row) => !row.deleted_at && row.animal_id).map((row) => row.animal_id))];
  const tables = ['pesagens', 'animais', 'animalLotes', 'movimentosAnimais', 'auditoria', 'categoriasAnimal'].map((name) => db.table(name));
  const before = { animalLotes: await db.table('animalLotes').count(), movimentosAnimais: await db.table('movimentosAnimais').count() };
  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    const ts = new Date().toISOString();
    await db.transaction('rw', tables, async () => {
      for (const animalId of chunk) await reconcileAnimalAfterChange(db, animalId, ts);
    });
    onProgress?.({ feitos: Math.min(start + chunkSize, ids.length), total: ids.length });
  }
  return { animais: ids.length, antes: before };
}
