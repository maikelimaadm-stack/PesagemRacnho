// Gravação de um lote de animais do plano de importação. Um lote = uma transação Dexie com
// pesagens, animais, animalIdentificadores, animalLotes, movimentosAnimais, sessoesPesagem,
// categoriasAnimal, auditoria e importacoes: eventos, animais novos, sessões, movimentos,
// auditoria CRIAR por evento, derivados das séries AFETADAS recalculados
// (recalculateWeightSeries), projeções do animal e checkpoint do job. Nada é recalculado
// fora dos animais do lote. Os helpers de gravação são os do Lançamento
// (weighingDataAdapter): newAnimal, newVisualIdentifier, newSession, stampAutomaticCategory,
// rebuildAnimalStateProjection, rebuildAnimalLotProjection e auditRow.
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { isOpenSessionStatus } from '../../../storage/indexedDb/normalize.js';
import { filterLegacyPayload, storageRecordToViewModel, uiToStorageRecord } from '../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents, recalculateWeightSeries } from '../../weighing/domain/weighingSeries.js';
import {
  auditRow,
  newAnimal,
  newSession,
  newVisualIdentifier,
  rebuildAnimalLotProjection,
  rebuildAnimalStateProjection,
  stampAutomaticCategory,
  weightOf,
} from '../../weighing/infrastructure/weighingDataAdapter.js';
import { EVENT_TYPES } from '../domain/importConstants.js';
import { advanceJobInTransaction } from './importJobs.js';

export const IMPORT_WRITE_STORES = Object.freeze([
  'pesagens', 'animais', 'animalIdentificadores', 'animalLotes', 'movimentosAnimais', 'sessoesPesagem', 'categoriasAnimal', 'auditoria', 'importacoes',
]);

const DERIVED_FIELDS = ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'];

export class ImportWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Categoria do evento pelo helper do Lançamento. Dentro da transação só se aguarda operação do
// IndexedDB: aguardar uma função async que retorna sem tocar o banco (animal manual, ou evento sem
// peso) esgota o rastreio de zona do Dexie em lotes grandes e a transação fecha antes da hora
// (PrematureCommitError). Sem peso, o helper só herda a categoria atual — o mesmo é feito aqui.
// Síncrona de propósito: devolve true quando o helper (que lê categoriasAnimal) precisa rodar.
function needsCategoryRead(entry, options) {
  if (!options.automatic) return false;
  if (weightOf(entry) === null) {
    entry.legacy_payload.categoria_id = options.categoriaAtualId ?? entry.legacy_payload.categoria_id ?? null;
    entry.legacy_payload.categoria_automatica = true;
    return false;
  }
  return true;
}

async function findDefaultPropertyId(db) {
  const rows = await db.table('propriedades').toArray();
  return rows.find((row) => !row.deleted_at && row.padrao === true)?.id ?? null;
}

/** Propriedade padrão lida antes das transações de lote (a store não entra na transação). */
export async function loadWriteDefaults(db) {
  return { propriedadeId: db.tables.some((table) => table.name === 'propriedades') ? await findDefaultPropertyId(db) : null };
}

function buildEntry({ row, animal, animalId, group, session, job, empresaId, operador, createdAt, ts, userId }) {
  const p = row.payload;
  const isRegistration = p.tipo_manejo === EVENT_TYPES.CADASTRO;
  const ui = {
    id: crypto.randomUUID(),
    empresa_id: empresaId,
    tipo_manejo: p.tipo_manejo,
    motivo_saida: p.motivo_saida ?? null,
    causa_morte: p.causa_morte ?? null,
    causa_morte_id: p.causa_morte_id ?? null,
    data_pesagem: p.data_pesagem,
    animal_id: animalId,
    sessao_id: session.id,
    // Perfil do animal: no Cadastro vem da linha; em Manejo/Saída, do animal (como no Lançamento).
    numero_animal: animal.numero_animal,
    sexo: animal.sexo,
    raca: animal.raca,
    raca_id: animal.raca_id ?? null,
    era: animal.era,
    marca: animal.marca,
    marca_id: animal.marca_id ?? null,
    peso: p.peso,
    observacao: p.observacao ?? null,
    apartacao_id: p.apartacao_id ?? null,
    nome_apartacao: p.nome_apartacao ?? null,
    lote_id: p.lote_id ?? null,
    nome_lote: p.nome_lote ?? null,
    origem: 'importacao',
    operador,
    id_externo: p.id_externo ?? null,
    categoria_id: isRegistration && group.isNew ? group.create.categoria_id ?? null : null,
    categoria_automatica: isRegistration && group.isNew ? group.create.categoria_automatica !== false : undefined,
    importacao_id: job.id,
    import_fingerprint: p.import_fingerprint,
  };
  if (ui.categoria_automatica === undefined) delete ui.categoria_automatica;
  const record = uiToStorageRecord(ui);
  return {
    ...record,
    sessao_id: session.id,
    created_by_user_id: userId,
    updated_by_user_id: userId,
    created_at: createdAt,
    updated_at: ts,
    deleted_at: null,
  };
}

// Movimentos dos eventos novos pela série mesclada: Entrada (Cadastro), Saída (motivo) e
// Mudança de lote quando o lote muda em relação ao evento anterior com lote.
function buildMovements(mergedViewModels, newIds, animalId, ts) {
  const movements = [];
  let currentLot = null;
  for (const event of mergedViewModels) {
    const isNew = newIds.has(String(event.id));
    if (event.tipo_manejo === EVENT_TYPES.SAIDA) {
      if (isNew) movements.push({ tipo: event.motivo_saida || 'Saída', event, origem: currentLot, destino: null });
      currentLot = null;
      continue;
    }
    let tipo = isNew && event.tipo_manejo === EVENT_TYPES.CADASTRO ? 'Entrada' : null;
    const origem = currentLot;
    if (event.lote_id && event.lote_id !== currentLot) {
      if (!tipo && isNew && currentLot) tipo = 'Mudança de lote';
      currentLot = event.lote_id;
    }
    if (tipo) movements.push({ tipo, event, origem, destino: event.lote_id || null });
  }
  return movements.map(({ tipo, event, origem, destino }) => ({
    id: crypto.randomUUID(),
    animal_id: animalId,
    pesagem_id: event.id,
    tipo,
    data_evento: event.data_pesagem,
    lote_origem_id: origem || null,
    lote_destino_id: destino,
    motivo: event.motivo_saida || null,
    origem: 'importacao',
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }));
}

/**
 * writeImportBatch(db, { groups, rowsByLine, job, empresaId, operador, propriedadeId, clock }) → contagens do lote.
 * `clock()` devolve um instante ISO crescente: define `created_at` dos eventos na ordem das
 * linhas (desempate canônico entre eventos do mesmo dia e tipo).
 */
export async function writeImportBatch(db, { groups, rowsByLine, job, empresaId, operador, propriedadeId, clock }) {
  const ts = new Date().toISOString();
  const userId = getActor().usuario_id ?? null;
  const tables = IMPORT_WRITE_STORES.map((name) => db.table(name));
  const counters = {
    registros_criados: 0,
    animais_criados: 0,
    movimentos_criados: 0,
    cadastros_criados: 0,
    manejos_criados: 0,
    saidas_criadas: 0,
    animais_conciliados: 0,
    series_recalculadas: 0,
    eventos_recalculados: 0,
    categorias_resolvidas_automaticamente: 0,
  };
  await db.transaction('rw', tables, async () => {
    const weighings = db.table('pesagens');
    const openSessions = (await db.table('sessoesPesagem').toArray()).filter((row) => !row.deleted_at && isOpenSessionStatus(row.status));
    const sessionsByDate = new Map();
    for (const session of openSessions) if (!sessionsByDate.has(session.data)) sessionsByDate.set(session.data, session);
    const newSessions = [];
    const sessionFor = (data) => {
      let session = sessionsByDate.get(data);
      if (!session) {
        session = newSession({ data, operador, ts });
        sessionsByDate.set(data, session);
        newSessions.push(session);
      }
      return session;
    };

    const newAnimals = [];
    const newIdentifiers = [];
    const entries = [];
    const movements = [];
    const audits = [];
    const derivedUpdates = [];
    const projectionTargets = [];

    for (const group of groups) {
      const rows = group.novos.map((line) => rowsByLine.get(line)).filter(Boolean).sort((left, right) => left.line - right.line);
      if (!rows.length) continue;
      let animal;
      let storedViewModels = [];
      if (group.isNew) {
        if (!group.create) throw new ImportWriteError('IMPORT_STALE_PLAN', `Animal ${group.label} sem Cadastro no plano.`);
        const animalId = crypto.randomUUID();
        const profile = {
          empresa_id: empresaId,
          numero_animal: group.create.numero_animal,
          sexo: group.create.sexo,
          raca: group.create.raca,
          era: group.create.era,
          marca: group.create.marca,
          categoria_id: group.create.categoria_id,
          categoria_automatica: group.create.categoria_automatica,
        };
        const registrationRow = rowsByLine.get(group.create.line);
        // Guarda contra gravação concorrente (dois cliques, outra janela): a identidade pode ter
        // nascido depois da análise. Mesma normalização de newVisualIdentifier.
        if (group.create.marca_id) {
          const valor = String(group.create.numero_animal || '').trim().toUpperCase();
          const taken = (await db.table('animalIdentificadores').where('[marca_id+valor_normalizado]').equals([group.create.marca_id, valor]).toArray())
            .some((row) => !row.deleted_at && row.ativo !== false);
          if (taken) throw new ImportWriteError('IMPORT_STALE_PLAN', `O animal ${group.label} foi cadastrado depois da análise; refaça a análise.`);
        }
        animal = newAnimal({ animalId, ui: profile, marcaId: group.create.marca_id, racaId: group.create.raca_id, propriedadeId, situacao: 'ATIVO', origem: 'importacao', ts });
        newAnimals.push(animal);
        newIdentifiers.push(newVisualIdentifier({ animalId, ui: profile, marcaId: group.create.marca_id, inicio: registrationRow.payload.data_pesagem, ts }));
        counters.animais_criados += 1;
      } else {
        animal = (await db.table('animais').where('id').equals(group.animalId).toArray()).find((row) => !row.deleted_at);
        if (!animal) throw new ImportWriteError('IMPORT_STALE_PLAN', `Animal ${group.label} não existe mais; refaça a análise.`);
        storedViewModels = (await weighings.where('animal_id').equals(animal.id).toArray())
          .filter((row) => !row.deleted_at)
          .map(storageRecordToViewModel);
        const classOf = (tipo) => (tipo === EVENT_TYPES.SAIDA ? 'S' : 'P');
        const clash = rows.find((row) => storedViewModels.some((event) => event.data_pesagem === row.payload.data_pesagem && classOf(event.tipo_manejo) === classOf(row.payload.tipo_manejo)));
        if (clash) {
          throw new ImportWriteError('IMPORT_STALE_PLAN', `O animal ${group.label} recebeu lançamento em ${clash.payload.data_pesagem} depois da análise; refaça a análise.`);
        }
        counters.animais_conciliados += 1;
      }

      const groupEntries = [];
      for (const row of rows) {
        const entry = buildEntry({ row, animal, animalId: animal.id, group, session: sessionFor(row.payload.data_pesagem), job, empresaId, operador, createdAt: clock(), ts, userId });
        const isRegistration = row.payload.tipo_manejo === EVENT_TYPES.CADASTRO;
        if (isRegistration && group.isNew) {
          if (group.create.categoria_automatica !== false) {
            const options = { automatic: true, sexo: animal.sexo };
            if (needsCategoryRead(entry, options)) await stampAutomaticCategory(db, entry, options);
            if (entry.legacy_payload.categoria_id && group.create.categoria_id) counters.categorias_resolvidas_automaticamente += 1;
          } else if (group.create.era) {
            entry.legacy_payload.era = group.create.era;
          }
        } else {
          const options = { automatic: animal.categoria_automatica !== false, sexo: animal.sexo, categoriaAtualId: animal.categoria_id ?? null };
          if (needsCategoryRead(entry, options)) await stampAutomaticCategory(db, entry, options);
        }
        if (isRegistration) counters.cadastros_criados += 1;
        else if (row.payload.tipo_manejo === EVENT_TYPES.SAIDA) counters.saidas_criadas += 1;
        else counters.manejos_criados += 1;
        groupEntries.push(entry);
      }

      // Derivados pela série mesclada (gravada + nova), com a função canônica do Lançamento.
      const newIds = new Set(groupEntries.map((entry) => String(entry.id)));
      const entryById = new Map(groupEntries.map((entry) => [String(entry.id), entry]));
      const merged = [...storedViewModels, ...groupEntries.map(storageRecordToViewModel)].sort(compareWeighingEvents);
      for (const update of recalculateWeightSeries(merged)) {
        const entry = entryById.get(String(update.id));
        if (entry) {
          Object.assign(entry, update.patch);
          entry.legacy_payload = filterLegacyPayload({ ...entry.legacy_payload, ...update.patch });
          continue;
        }
        const stored = merged.find((event) => String(event.id) === String(update.id));
        if (DERIVED_FIELDS.some((field) => (update.patch[field] ?? null) !== (stored?.[field] ?? null))) derivedUpdates.push(update);
      }
      movements.push(...buildMovements(merged, newIds, animal.id, ts));
      for (const entry of groupEntries) {
        audits.push(auditRow({ entidade: 'pesagens', entidade_id: entry.id, acao: 'CRIAR', depois: entry, origem: 'importacao', operador, importacao_id: job.id, created_at: ts }));
      }
      entries.push(...groupEntries);
      counters.series_recalculadas += 1;
      projectionTargets.push({ animalId: animal.id, rebuildLots: groupEntries.some((entry) => entry.lote_id || entry.legacy_payload.tipo_manejo === EVENT_TYPES.SAIDA) });
    }

    if (newAnimals.length) await db.table('animais').bulkAdd(newAnimals);
    if (newIdentifiers.length) await db.table('animalIdentificadores').bulkAdd(newIdentifiers);
    if (newSessions.length) await db.table('sessoesPesagem').bulkAdd(newSessions);
    if (entries.length) await weighings.bulkAdd(entries);
    if (movements.length) await db.table('movimentosAnimais').bulkAdd(movements);
    if (audits.length) await db.table('auditoria').bulkAdd(audits);
    // Mesmo caminho do recálculo automático (systemDerived): atualização direta pela chave
    // primária, sem auditoria, só nos eventos cujos derivados mudaram.
    for (const update of derivedUpdates) {
      await weighings.update(update.localId, {
        ...update.patch,
        legacy_payload: filterLegacyPayload(update.legacyPayload),
        id: update.id,
        updated_at: ts,
      });
    }
    counters.eventos_recalculados = derivedUpdates.length;
    for (const target of projectionTargets) {
      if (target.rebuildLots) await rebuildAnimalLotProjection(db, target.animalId, ts);
      await rebuildAnimalStateProjection(db, target.animalId, ts);
    }
    counters.registros_criados = entries.length;
    counters.movimentos_criados = movements.length;
    await advanceJobInTransaction(db, job.id, counters, { lastKey: groups.at(-1)?.key ?? null, animals: groups.length });
  });
  return counters;
}
