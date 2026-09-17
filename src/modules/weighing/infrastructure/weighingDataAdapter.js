// Fluxo operacional IndexedDB/Dexie. O adapter preserva o contrato da UI e
// concentra transações, projeções e auditoria do domínio de pesagens.
//
// v7 (docs 12 §3.2): animais nascem com marca_id/raca_id/propriedade_id e
// situacao em enum; identificadores VISUAL guardam só o número em
// valor_normalizado e a marca em marca_id; sessões nascem ABERTA; toda linha de
// auditoria carrega o ator (auditActor) e ATUALIZAR em massa grava resumo +
// campos_alterados em vez de antes/depois completos.
import { filterLegacyPayload, storageRecordToViewModel } from '../domain/weighingMapper.js';
import storage from '../../../storage/storageAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { isOpenSessionStatus, normalizeName, situacaoFromExitReason } from '../../../storage/indexedDb/normalize.js';
import { STORES } from '../../../storage/indexedDb/schema.js';
import { eraOfCategory, suggestCategory } from '../../operations/domain/categorySuggestion.js';

const EMPRESA_ID = 'local';
// Nome do campo do operador da sessão segue o índice declarado no esquema
// (`operador_usuario_id` na rev. 2 do documento 12; `operador_user_id` na rev. 1).
const SESSION_OPERATOR_FIELD = String(STORES.sessoesPesagem).includes('operador_usuario_id') ? 'operador_usuario_id' : 'operador_user_id';

// Id do usuário autenticado (`actor_user_id` no auditActor atual; `usuario_id` na rev. 2).
function actorUserId() {
  const actor = getActor();
  return actor.actor_user_id ?? actor.usuario_id ?? null;
}

const eventOrder = (left, right) =>
  String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || ''))
  || String(left.created_at || '').localeCompare(String(right.created_at || ''))
  || String(left.id || '').localeCompare(String(right.id || ''));

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

function auditRow(fields) {
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

function newSession({ data, operador, ts }) {
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

function newAnimal({ animalId, ui, marcaId, racaId, propriedadeId, situacao, origem, ts }) {
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

function newVisualIdentifier({ animalId, ui, marcaId, inicio, ts }) {
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

async function validateAnimalChronology(db, { animalId, data, ui, ignoredEntryId = null }) {
  if (!animalId || !data) return;
  const events = (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
    .filter((row) => !row.deleted_at && row.id !== ignoredEntryId);
  const registration = events
    .filter((row) => weighingUi(row).tipo_manejo === 'Cadastro')
    .sort(eventOrder)[0];
  if (ui.tipo_manejo === 'Cadastro' && registration) {
    throw new Error(`O animal já possui cadastro em ${registration.data_pesagem}. Use a edição do cadastro existente.`);
  }
  if (ui.tipo_manejo !== 'Cadastro' && registration && data < registration.data_pesagem) {
    throw new Error(`A data ${data} é anterior ao cadastro do animal (${registration.data_pesagem}).`);
  }
  if (ui.tipo_manejo === 'Saída') {
    const laterEvent = events.find((row) => row.data_pesagem > data);
    if (laterEvent) {
      throw new Error(`Existem lançamentos posteriores a ${data}. Corrija ou cancele esses eventos antes de registrar a saída retroativa.`);
    }
  }
  const definitiveExit = events
    .filter((row) => weighingUi(row).tipo_manejo === 'Saída')
    .sort(eventOrder)[0];
  if (definitiveExit && data >= definitiveExit.data_pesagem) {
    const reason = weighingUi(definitiveExit).motivo_saida || 'Saída';
    throw new Error(`O animal já possui ${reason.toLowerCase()} em ${definitiveExit.data_pesagem}. Cancele ou corrija esse evento antes de lançar outro.`);
  }
}

// Pesagem de animal com categoria automática: grava no payload a categoria e a era
// da faixa de peso daquele momento (a relação mostra a era de cada pesagem).
// Sem peso (Saída por Morte/Doação/Transferência) ou peso fora de toda faixa, a pesagem
// herda a última categoria válida do animal: ausência de peso nunca apaga classificação.
async function stampAutomaticCategory(db, entry, { automatic, sexo, categoriaAtualId = null }) {
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
function weightOf(row) {
  const value = Number(row?.peso_kg ?? weighingUi(row).peso);
  return row && (row.peso_kg != null || weighingUi(row).peso != null) && Number.isFinite(value) && value > 0 ? value : null;
}

async function rebuildAnimalStateProjection(db, animalId, timestamp = new Date().toISOString()) {
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

async function rebuildAnimalLotProjection(db, animalId, timestamp = new Date().toISOString()) {
  if (!animalId) return 0;
  const weighingTable = db.table('pesagens');
  const animalLotTable = db.table('animalLotes');
  const rows = (await weighingTable.where('animal_id').equals(animalId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((left, right) => String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || '')) || String(left.created_at || '').localeCompare(String(right.created_at || '')) || String(left.id || '').localeCompare(String(right.id || '')));
  const previous = (await animalLotTable.where('animal_id').equals(animalId).toArray()).filter((row) => !row.deleted_at);
  if (previous.length) await animalLotTable.bulkUpdate(previous.map((row) => ({ key: row.localId, changes: { deleted_at: timestamp, updated_at: timestamp } })));
  const projection = [];
  let current = null;
  for (const row of rows) {
    const ui = typeof row.legacy_payload === 'object' ? row.legacy_payload : {};
    if (ui.tipo_manejo === 'Saída') {
      if (current && !current.fim) current.fim = row.data_pesagem;
      current = null;
      continue;
    }
    if (row.lote_id && current?.lote_id !== row.lote_id) {
      if (current && !current.fim) current.fim = row.data_pesagem;
      current = { id: crypto.randomUUID(), animal_id: animalId, lote_id: row.lote_id, apartacao_id: ui.apartacao_id || null, inicio: row.data_pesagem, fim: null, origem: 'projecao', created_at: timestamp, updated_at: timestamp, deleted_at: null };
      projection.push(current);
    }
  }
  if (projection.length) await animalLotTable.bulkAdd(projection);
  return projection.length;
}

export async function isStorageAvailable() {
  try {
    await storage.ensureReady();
    return true;
  } catch {
    return false;
  }
}

export async function createEntry(payload) {
  storage.assertWritable('Lançamento de pesagem');
  const db = await storage.ensureReady();
  const ui = typeof payload.legacy_payload === 'object' ? payload.legacy_payload : {};
  const ts = new Date().toISOString();
  const entryId = payload.id || crypto.randomUUID();
  const animalId = payload.animal_id || ui.animal_id || (ui.tipo_manejo === 'Cadastro' ? crypto.randomUUID() : null);
  let sessionId = ui.sessao_id || null;
  const entry = { ...payload, id: entryId, animal_id: animalId, sessao_id: sessionId, created_by_user_id: actorUserId(), updated_by_user_id: actorUserId(), created_at: payload.created_at || ts, updated_at: ts, deleted_at: null };
  const isRegistration = ui.tipo_manejo === 'Cadastro';
  let movementType = isRegistration ? 'Entrada' : ui.tipo_manejo === 'Saída' ? ui.motivo_saida || 'Saída' : null;

  await validateAnimalChronology(db, { animalId, data: payload.data_pesagem, ui });

  const tableNames = ['pesagens', 'auditoria', 'sessoesPesagem', 'animalLotes', 'categoriasAnimal'];
  if (animalId) tableNames.push('animais', 'movimentosAnimais');
  if (isRegistration) tableNames.push('animalIdentificadores', 'marcas', 'racas', 'propriedades');
  if (movementType) tableNames.push('movimentosAnimais');
  const tables = [...new Set(tableNames)].map((name) => db.table(name));

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
      if (!movementType && currentLot) movementType = 'Mudança de lote';
    }
    if (movementType) {
      await db.table('movimentosAnimais').add({
        id: crypto.randomUUID(),
        animal_id: animalId,
        pesagem_id: entryId,
        tipo: movementType,
        data_evento: payload.data_pesagem,
        lote_origem_id: currentLot?.lote_id || null,
        lote_destino_id: payload.lote_id || null,
        motivo: ui.motivo_saida || null,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      });
    }
    // Lançamento retroativo (data anterior a outro evento do animal): a permanência em lote é
    // reconstruída a partir de todos os eventos, senão o lote atual e o histórico ficam errados.
    if (animalId) {
      const later = (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
        .some((row) => !row.deleted_at && row.id !== entryId && String(row.data_pesagem) > String(payload.data_pesagem));
      if (later) await rebuildAnimalLotProjection(db, animalId, ts);
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
    await rebuildAnimalStateProjection(db, animalId, ts);
  });
  return storageRecordToViewModel(entry);
}

export async function updateEntry(id, payload) {
  storage.assertWritable('Edição de pesagem');
  const db = await storage.ensureReady();
  const rows = await db.table('pesagens').where('id').equals(id).toArray();
  const existing = [...rows].reverse().find((row) => !row.deleted_at);
  if (!existing) return null;
  const ts = new Date().toISOString();
  const updated = { ...existing, ...payload, id, updated_by_user_id: actorUserId(), updated_at: ts };
  const ui = typeof updated.legacy_payload === 'object' ? updated.legacy_payload : {};
  await validateAnimalChronology(db, { animalId: updated.animal_id, data: updated.data_pesagem, ui, ignoredEntryId: id });
  const tables = ['pesagens', 'animais', 'animalLotes', 'auditoria', 'marcas', 'racas', 'categoriasAnimal'].map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
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
        await db.table('animais').update(animal.localId, {
          numero_animal: ui.numero_animal || animal.numero_animal,
          identificacao_normalizada: String(ui.numero_animal || animal.numero_animal || '').trim().toUpperCase(),
          sexo: ui.sexo ?? animal.sexo,
          raca: ui.raca ?? animal.raca,
          era: ui.era ?? animal.era,
          marca: ui.marca ?? animal.marca,
          marca_id: marcaId,
          raca_id: racaId,
          categoria_id: ui.categoria_id ?? animal.categoria_id ?? null,
          categoria_automatica: ui.categoria_automatica !== undefined ? ui.categoria_automatica !== false : animal.categoria_automatica !== false,
          updated_at: ts,
        });
      }
    }
    await rebuildAnimalLotProjection(db, updated.animal_id, ts);
    await db.table('auditoria').add(auditRow({ entidade: 'pesagens', entidade_id: id, acao: 'ATUALIZAR', antes: existing, depois: updated, origem: 'manual', operador: ui.operador || null, created_at: ts }));
    await rebuildAnimalStateProjection(db, updated.animal_id, ts);
  });
  return storageRecordToViewModel(updated);
}

export async function deleteEntry(id) {
  return bulkDeleteEntries([id]);
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
  const projectionAnimals = new Set();
  let updatedCount = 0;
  await db.transaction('rw', db.table('pesagens'), db.table('animais'), db.table('animalLotes'), db.table('auditoria'), db.table('categoriasAnimal'), async () => {
    for (const item of items) {
      const rows = await db.table('pesagens').where('id').equals(item.id).toArray();
      const existing = [...rows].reverse().find((row) => !row.deleted_at);
      if (!existing) throw new Error(`pesagens: registro não encontrado (${item.id})`);
      const updated = { ...existing, ...item.patch, id: existing.id, updated_by_user_id: actorUserId(), updated_at: ts };
      const ui = weighingUi(updated);
      await validateAnimalChronology(db, { animalId: updated.animal_id, data: updated.data_pesagem, ui, ignoredEntryId: existing.id });
      await db.table('pesagens').update(existing.localId, updated);
      if (existing.animal_id) affectedAnimals.add(existing.animal_id);
      if (updated.animal_id) affectedAnimals.add(updated.animal_id);
      if (
        existing.animal_id !== updated.animal_id
        || existing.data_pesagem !== updated.data_pesagem
        || existing.lote_id !== updated.lote_id
        || weighingUi(existing).tipo_manejo !== ui.tipo_manejo
        || weighingUi(existing).apartacao_id !== ui.apartacao_id
      ) {
        if (existing.animal_id) projectionAnimals.add(existing.animal_id);
        if (updated.animal_id) projectionAnimals.add(updated.animal_id);
      }
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
    for (const animalId of projectionAnimals) await rebuildAnimalLotProjection(db, animalId, ts);
    for (const animalId of affectedAnimals) await rebuildAnimalStateProjection(db, animalId, ts);
  });
  return updatedCount;
}

export async function bulkDeleteEntries(ids) {
  storage.assertWritable('Exclusão de pesagens');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let removed = 0;
  const affectedAnimals = new Set();
  await db.transaction('rw', db.table('pesagens'), db.table('animais'), db.table('animalLotes'), db.table('auditoria'), db.table('categoriasAnimal'), async () => {
    for (const id of ids) {
      const rows = await db.table('pesagens').where('id').equals(id).toArray();
      const existing = [...rows].reverse().find((row) => !row.deleted_at);
      if (!existing) continue;
      if (existing.animal_id) affectedAnimals.add(existing.animal_id);
      await db.table('pesagens').update(existing.localId, { deleted_at: ts, updated_at: ts });
      await db.table('auditoria').add(auditRow({ entidade: 'pesagens', entidade_id: id, acao: 'CANCELAR', antes: existing, motivo: 'Exclusão lógica pela interface', created_at: ts }));
      removed += 1;
    }
    for (const animalId of affectedAnimals) {
      await rebuildAnimalLotProjection(db, animalId, ts);
      await rebuildAnimalStateProjection(db, animalId, ts);
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
