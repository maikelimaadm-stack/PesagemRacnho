import { WeighingError, toUserMessage } from '../domain/weighingErrors.js';
import {
  uiToStorageRecord,
  validateUiPayload,
} from '../domain/weighingMapper.js';
import * as weighingDataAdapter from '../infrastructure/weighingDataAdapter.js';
import { animalIdentityKey, receivesWeightGain, recalculateWeightSeries } from '../domain/weighingSeries.js';
import { calculateWeightGain } from '../domain/weighingCalculations.js';
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, can, forbiddenError } from '../../auth/domain/permissionService.js';
import { parseCivilDate } from '../domain/brazilianValues.js';
import { SanityError, validateLaunchApplications } from '../../sanity/domain/sanityRules.js';
import { MOTIVO_REPESAGEM, planSameDayReweigh } from '../domain/repesagem.js';

// Escrita autorizada no SERVIÇO (não só na tela): com sessão, o papel precisa da ação
// (weighing.write para lançar/importar; weighing.edit para editar/excluir). Com o módulo de
// autenticação ativo e sem sessão, recusa (falha fechada). Sem provedor de ator (gates em
// Node, migração) a verificação não se aplica.
function requireWeighingPermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

// Valores comerciais digitados (preços e totais em dinheiro) só entram com commercial.write.
// Arrobas/carcaça derivadas do rendimento configurado não são digitação de preço e seguem.
const COMMERCIAL_INPUT_FIELDS = ['valor_pago_cabeca', 'valor_venda_total', 'valor_arroba', 'valor_arroba_abate', 'valor_total_abate'];

function withoutCommercialInput(actor, payload) {
  if (!actor || !payload || can(actor.role, 'commercial.write')) return payload;
  const copy = { ...payload };
  for (const field of COMMERCIAL_INPUT_FIELDS) delete copy[field];
  if (copy.documentacao) {
    try {
      const documentation = typeof copy.documentacao === 'string'
        ? JSON.parse(copy.documentacao)
        : { ...copy.documentacao };
      if (documentation && typeof documentation === 'object') {
        delete documentation.frete;
        copy.documentacao = JSON.stringify(documentation);
      }
    } catch {
      delete copy.documentacao;
    }
  }
  return copy;
}

/**
 * Fluxo operacional IndexedDB/Dexie no armazenamento local do renderer.
 */
export async function detectStorageStatus() {
  let available = false;
  try {
    available = await weighingDataAdapter.isStorageAvailable();
  } catch {
    available = false;
  }
  return {
    storage: { type: 'indexeddb', available, healthy: available },
    mode: available ? 'indexeddb' : 'unavailable',
  };
}

// Aplicações de sanidade do lançamento (ADR-049): payload.aplicacoes_sanidade (0..N)
// NUNCA vai para o legacy_payload (ADR-027); é validada antes de qualquer leitura e
// gravada em `aplicacoesSanidade` na MESMA transação da pesagem (animal, data,
// sessão e pesagem vêm da própria pesagem). Qualquer aplicação inválida: nada é gravado.
// Payload novo do Lançamento: sem valores comerciais para quem não tem commercial.write, validado, e as aplicações de
// sanidade (payload.aplicacoes_sanidade) validadas antes de qualquer leitura.
function prepareNewEntry(actor, rawPayload) {
  const { aplicacoes_sanidade: rawApplications, ...payloadWithoutSanity } = rawPayload || {};
  const uiPayload = withoutCommercialInput(actor, payloadWithoutSanity);
  validateUiPayload(uiPayload);
  const aplicacoesSanidade = validateLaunchApplications(rawApplications, {
    data: parseCivilDate(uiPayload.data_pesagem || uiPayload.dataPesagem || uiPayload.data),
  });
  return { uiPayload, aplicacoesSanidade };
}

// Registro de armazenamento com os derivados contra a pesagem anterior (data estritamente menor: a pesagem do mesmo
// dia nunca é a anterior — calculateWeightGain). Devolve também a série lida (para saber se há pesagens depois).
async function storageRecordWithDerived(uiPayload) {
  const animalId = uiPayload.animal_id || uiPayload.animalId || null;
  const existingSeries = animalId
    ? await weighingDataAdapter.listAllEntries({ animalId })
    : [];
  // E1G: Manejo e Saída com peso (venda/abate) ganham os derivados contra a pesagem anterior; Cadastro não.
  const derived = receivesWeightGain(uiPayload.tipo_manejo)
    ? calculateWeightGain({
      history: existingSeries,
      date: uiPayload.data_pesagem,
      weight: uiPayload.peso ?? uiPayload.peso_kg,
    })
    : { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  const enrichedPayload = {
    ...uiPayload,
    data_anterior: derived.dataAnterior,
    peso_anterior: derived.pesoAnterior,
    dias: derived.dias,
    ganho: derived.ganho,
    gmd: derived.gmd,
  };
  return { storageRecord: uiToStorageRecord(enrichedPayload), existingSeries };
}

export async function createEntry(rawPayload) {
  const { uiPayload, aplicacoesSanidade } = prepareNewEntry(requireWeighingPermission('weighing.write'), rawPayload);
  try {
    const trace = globalThis.__MAK_PERF_TRACE__ === true;
    const startedAt = trace ? performance.now() : 0;
    const { storageRecord, existingSeries } = await storageRecordWithDerived(uiPayload);
    const created = await weighingDataAdapter.createEntry(storageRecord, { aplicacoesSanidade });
    const createdAt = trace ? performance.now() : 0;
    const hasLaterEntries = existingSeries.some((entry) =>
      String(entry.data_pesagem || '') > String(created.data_pesagem || ''));
    // No fluxo normal (nova pesagem cronologicamente mais recente), somente o
    // registro criado recebe os valores calculados acima. Séries posteriores
    // só precisam ser regravadas quando há inserção retroativa.
    if (hasLaterEntries) {
      await recalculateWeightSeriesForKeys(new Set([animalIdentityKey(created)]));
    }
    const recalculatedAt = trace ? performance.now() : 0;
    const result = await weighingDataAdapter.getEntryById(created.id);
    if (trace) {
      console.error('[perf:createEntry]', {
        adapterCreateMs: Number((createdAt - startedAt).toFixed(2)),
        recalculateMs: Number((recalculatedAt - createdAt).toFixed(2)),
        getByIdMs: Number((performance.now() - recalculatedAt).toFixed(2)),
      });
    }
    return { ...result, aplicacoes_sanidade: created.aplicacoes_sanidade || [] };
  } catch (err) {
    if (err instanceof WeighingError || err instanceof SanityError) throw err;
    throw new WeighingError('WEIGHING_SAVE_001', toUserMessage(err));
  }
}

// Toda falha antes do fim da transação da repesagem deixa o banco como estava: a mensagem diz isso ao operador.
export const REPESAGEM_NAO_GRAVADA = 'A repesagem não foi gravada; a pesagem de hoje continua valendo.';

/**
 * M1 (1.5.0) — Repesagem no mesmo dia (M1-FUNDACAO-NUMERO.md §4): cancela a(s) pesagem(ns) de hoje do MESMO animal
 * com o motivo "repesagem" e grava a nova, numa única transação (weighingDataAdapter.replaceEntries). Se algo
 * falhar, nada muda: a pesagem de hoje continua valendo. Exige lançar (weighing.write) e cancelar (weighing.edit).
 * O serviço confere de novo a regra da tela (planSameDayReweigh): só Manejo com peso substitui Manejo com peso;
 * outro animal, outra data, Cadastro ou Saída são recusados sem gravar nada. Os derivados da nova (anterior, dias,
 * ganho, GMD) usam a pesagem de data estritamente anterior — nunca a de hoje. Depois, a série do animal é
 * recalculada (as pesagens seguintes passam a usar o peso novo como anterior).
 * @param {string[]} previousIds pesagens de hoje a substituir
 * @param {object} rawPayload mesmo payload do createEntry (inclusive aplicacoes_sanidade)
 */
export async function replaceSameDayEntry(previousIds, rawPayload) {
  const actor = requireWeighingPermission('weighing.write');
  requireWeighingPermission('weighing.edit');
  const ids = [...new Set((Array.isArray(previousIds) ? previousIds : [previousIds]).filter(Boolean).map(String))];
  const { uiPayload, aplicacoesSanidade } = prepareNewEntry(actor, rawPayload);
  let created;
  try {
    const anteriores = (await Promise.all(ids.map((id) => weighingDataAdapter.getEntryById(id)))).filter(Boolean);
    const plano = planSameDayReweigh({
      entries: anteriores,
      animal: uiPayload,
      date: parseCivilDate(uiPayload.data_pesagem),
      tipoManejo: uiPayload.tipo_manejo,
      peso: uiPayload.peso ?? uiPayload.peso_kg,
    });
    if (!ids.length || anteriores.length !== ids.length || !plano.repesar || plano.anteriores.length !== ids.length) {
      throw new WeighingError('WEIGHING_SAVE_001', 'Só se repesa pesagem de Manejo com peso do mesmo animal, na mesma data.');
    }
    const { storageRecord } = await storageRecordWithDerived(uiPayload);
    created = await weighingDataAdapter.replaceEntries(ids, storageRecord, { motivo: MOTIVO_REPESAGEM, aplicacoesSanidade });
  } catch (err) {
    const code = err instanceof WeighingError ? err.code : 'WEIGHING_SAVE_001';
    throw new WeighingError(code, `${REPESAGEM_NAO_GRAVADA} ${toUserMessage(err)}`, { cause: err });
  }
  try {
    await recalculateWeightSeriesForKeys(new Set([animalIdentityKey(created)]));
  } catch (err) {
    throw new WeighingError('WEIGHING_SAVE_001', `A repesagem foi gravada, mas o recálculo das pesagens seguintes falhou: ${toUserMessage(err)}`, { cause: err });
  }
  const result = await weighingDataAdapter.getEntryById(created.id);
  return { ...result, aplicacoes_sanidade: created.aplicacoes_sanidade || [], substituidas: ids };
}

export async function bulkCreateEntries(rawItems, options = {}) {
  const actor = requireWeighingPermission('weighing.write');
  const items = rawItems.map((item) => withoutCommercialInput(actor, item));
  const payloads = items.map((item) => {
    validateUiPayload(item);
    return uiToStorageRecord(item);
  });
  const report = await weighingDataAdapter.bulkCreateEntries(payloads, options);
  await recalculateAllWeightSeries();
  return { ...report, payloads };
}

export async function bulkUpdateEntries(rawItems, { recalculate = true, systemDerived = false } = {}) {
  const actor = requireWeighingPermission('weighing.edit');
  // Patch sem valores comerciais: o valor gravado anteriormente é preservado (merge com existing).
  const items = rawItems.map((item) => ({ ...item, patch: withoutCommercialInput(actor, item.patch) }));
  const payloads = [];
  for (const item of items) {
    validateUiPayload(item.patch, { isUpdate: true });
    const existing = await weighingDataAdapter.getEntryById(item.id);
    if (!existing) throw new WeighingError('WEIGHING_SAVE_001', `Pesagem não encontrada (${item.id})`);
    payloads.push({ id: item.id, patch: uiToStorageRecord({ ...existing, ...item.patch, id: item.id }, { isUpdate: true, id: item.id }) });
  }
  await weighingDataAdapter.bulkUpdateEntries(payloads, {
    audit: !systemDerived,
    origin: systemDerived ? 'recalculo-automatico' : 'edicao-coletiva',
    systemDerived,
  });
  if (recalculate) await recalculateAllWeightSeries();
  return payloads.length;
}

/**
 * Altera dados mestres dos animais selecionados. Diferentemente de
 * `bulkUpdateEntries`, esta operação não modifica apenas um fato de pesagem:
 * marca, raça, sexo, era e categoria formam o cadastro atual do animal e,
 * portanto, precisam permanecer coerentes em todo o histórico apresentado.
 */
export async function bulkUpdateAnimalProfiles(rawItems) {
  requireWeighingPermission('weighing.edit');
  if (!Array.isArray(rawItems) || rawItems.length === 0) return 0;
  return weighingDataAdapter.bulkUpdateAnimalProfiles(rawItems, {
    audit: true,
    origin: 'edicao-coletiva',
  });
}

// `motivo` (opcional, M1) vai para a auditoria CANCELAR; sem ele, o texto de sempre ("Exclusão lógica pela interface").
export async function bulkDeleteEntries(ids, { recalculate = true, motivo } = {}) {
  requireWeighingPermission('weighing.edit');
  const removed = await weighingDataAdapter.bulkDeleteEntries(ids, { motivo });
  if (recalculate) await recalculateAllWeightSeries();
  return removed;
}

export async function recalculateAllWeightSeries() {
  return recalculateWeightSeriesForKeys(null);
}

// E1G (revisão): derivado igual ao gravado? null/undefined/'' são "sem valor"; números comparados pelo valor.
const DERIVED_KEYS = ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'];
const blankDerived = (value) => value === null || value === undefined || value === '';
const sameDerived = (stored, computed) => (blankDerived(stored) || blankDerived(computed)
  ? blankDerived(stored) && blankDerived(computed)
  : String(stored) === String(computed) || Number(stored) === Number(computed));
const derivedUnchanged = (entry, patch) => Boolean(entry) && DERIVED_KEYS.every((key) => sameDerived(entry[key], patch[key]));

// Exportada para a importação: recalcula só as séries afetadas (nunca a base inteira).
// E1G (revisão): onlyChanged regrava só as pesagens cujos derivados mudaram (o recálculo único da abertura não
// reescreve o histórico inteiro dos animais vendidos — só a Saída, e o que estiver desatualizado).
export async function recalculateWeightSeriesForKeys(affectedKeys, { onlyChanged = false } = {}) {
  const trace = globalThis.__MAK_PERF_TRACE__ === true;
  const startedAt = trace ? performance.now() : 0;
  let entries;
  if (!affectedKeys) {
    entries = await listEntries();
  } else {
    const keys = [...affectedKeys].filter(Boolean);
    const canonicalAnimalIds = keys
      .filter((key) => key.startsWith('id:'))
      .map((key) => key.slice(3))
      .filter(Boolean);
    const hasLegacyIdentity = keys.some((key) => key.startsWith('legacy:'));

    // animal_id possui índice no Dexie. Um lançamento normal precisa reler e
    // recalcular somente a série do animal afetado; varrer toda a base fazia o
    // tempo de salvar crescer linearmente com 36 mil/250 mil registros.
    // Registros legados sem animal_id mantêm o fallback integral para preservar
    // a compatibilidade e a correção do agrupamento número + marca.
    entries = hasLegacyIdentity
      ? await listEntries()
      : (await Promise.all(
        [...new Set(canonicalAnimalIds)].map((animalId) =>
          weighingDataAdapter.listAllEntries({ animalId })),
      )).flat();
  }
  const loadedAt = trace ? performance.now() : 0;
  const computed = recalculateWeightSeries(entries, affectedKeys);
  const storedById = onlyChanged ? new Map(entries.filter((entry) => !entry.deleted_at).map((entry) => [entry.id, entry])) : null;
  const updates = onlyChanged ? computed.filter((update) => !derivedUnchanged(storedById.get(update.id), update.patch)) : computed;
  const calculatedAt = trace ? performance.now() : 0;
  if (updates.length) {
    // Patches derivados já foram produzidos pelo domínio e contêm somente os
    // cinco campos calculados. O caminho direto evita uma consulta individual
    // por lançamento antes do bulkUpdate transacional do adapter.
    await weighingDataAdapter.bulkUpdateEntries(updates, {
      audit: false,
      origin: 'recalculo-automatico',
      systemDerived: true,
    });
  }
  if (trace) {
    console.error('[perf:recalculateWeightSeries]', {
      entries: entries.length,
      updates: updates.length,
      loadMs: Number((loadedAt - startedAt).toFixed(2)),
      calculateMs: Number((calculatedAt - loadedAt).toFixed(2)),
      updateMs: Number((performance.now() - calculatedAt).toFixed(2)),
    });
  }
  return updates.length;
}

export async function updateEntry(id, rawPayload) {
  const uiPayload = withoutCommercialInput(requireWeighingPermission('weighing.edit'), rawPayload);
  try {
    validateUiPayload(uiPayload, { isUpdate: true });
    const existing = await weighingDataAdapter.getEntryById(id);
    const merged = existing ? { ...existing, ...uiPayload, id } : { ...uiPayload, id };
    const storageRecord = uiToStorageRecord(merged, { isUpdate: true, id });
    await weighingDataAdapter.updateEntry(id, storageRecord);
    const updated = await weighingDataAdapter.getEntryById(id);
    const affected = new Set([animalIdentityKey(updated)]);
    if (existing) affected.add(animalIdentityKey(existing));
    await recalculateWeightSeriesForKeys(affected);
    return weighingDataAdapter.getEntryById(id);
  } catch (err) {
    if (err instanceof WeighingError) throw err;
    throw new WeighingError('WEIGHING_SAVE_001', toUserMessage(err));
  }
}

// `motivo` (opcional, M1) vai para a auditoria CANCELAR; sem ele, o texto de sempre ("Exclusão lógica pela interface").
export async function deleteEntry(pesagemOrId, { motivo } = {}) {
  requireWeighingPermission('weighing.edit');
  const pesagem = typeof pesagemOrId === 'object' ? pesagemOrId : { id: pesagemOrId };
  const id = pesagem.id;
  try {
    const existing = await weighingDataAdapter.getEntryById(id);
    const result = await weighingDataAdapter.deleteEntry(id, { motivo });
    if (existing) await recalculateWeightSeriesForKeys(new Set([animalIdentityKey(existing)]));
    return result;
  } catch (err) {
    if (err instanceof WeighingError) throw err;
    throw new WeighingError('WEIGHING_DELETE_001', toUserMessage(err));
  }
}

export async function getEntryById(id) {
  return weighingDataAdapter.getEntryById(id);
}

export async function listEntries({ empresaId, ...filters } = {}) {
  let entries = [];
  try {
    if (await weighingDataAdapter.isStorageAvailable()) {
      entries = await weighingDataAdapter.listAllEntries(filters);
    }
  } catch (err) {
    console.warn('[weighingService] Falha ao consultar o armazenamento local:', err.message);
  }

  return empresaId
    ? entries.filter((p) => p.empresa_id === empresaId)
    : entries;
}

export async function countEntries(filters = {}) {
  const list = await listEntries(filters);
  return list.length;
}

export async function getSummary(filters = {}) {
  try {
    return await weighingDataAdapter.getSummary(filters);
  } catch {
    const list = await listEntries(filters);
    return {
      total: list.length,
      pesoTotal: list.reduce((s, p) => s + (Number(p.peso) || 0), 0),
    };
  }
}
