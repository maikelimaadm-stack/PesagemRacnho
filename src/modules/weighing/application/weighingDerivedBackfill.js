// E1G (1.4.2) — recálculo ÚNICO dos derivados das Saídas com peso (docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, A1).
// Até a 1.4.1 só o Manejo recebia data/peso anterior, dias, ganho e GMD; a Saída com peso (venda, abate) passa a
// receber (weighingSeries.receivesWeightGain). Os dados já gravados são recalculados UMA vez, na abertura do app:
// - passo de DADOS, sem versão nova de esquema e FORA da cadeia de migração: falha não bloqueia a escrita nem o uso
//   (fica no console, o marcador guarda o erro e a próxima abertura tenta de novo);
// - marcador em configurações (appSettings['derivados-saida-v1'], status CONCLUIDO): com ele, não roda mais;
// - só as séries (animais) que têm Saída com peso, pela MESMA função do lançamento e da edição
//   (recalculateWeightSeriesForKeys → recalculateWeightSeries): só os 5 campos derivados mudam — idempotente;
// - revisão E1G: regrava SÓ as pesagens cujos derivados mudaram (onlyChanged) — em geral a própria Saída; o histórico
//   dos animais vendidos não é reescrito, e a espera em "Preparando o sistema…" fica proporcional às saídas;
// - registrado na auditoria como ação do sistema (sem usuário) quando alguma série foi recalculada.
import storage from '../../../storage/storageAdapter.js';
import { storageRecordToViewModel } from '../domain/weighingMapper.js';
import { animalIdentityKey, measuredWeightOf } from '../domain/weighingSeries.js';
import { recalculateWeightSeriesForKeys } from './weighingService.js';

export const SAIDA_DERIVED_MARKER_KEY = 'derivados-saida-v1';
export const SAIDA_DERIVED_ORIGIN = 'recalculo-gmd-saida-1.4.2';
export const SAIDA_DERIVED_STATUS = Object.freeze({ CONCLUIDO: 'CONCLUIDO', FALHOU: 'FALHOU' });
export const SAIDA_DERIVED_FIELDS = Object.freeze(['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd']);

const nowIso = () => new Date().toISOString();

/**
 * Séries (animalIdentityKey) com Saída com peso. Uma leitura sequencial por cursor (não guarda a base na memória).
 * @returns {{ keys: Set<string>, saidas: number, semGmd: number }} saidas = Saídas com peso; semGmd = delas, sem GMD
 */
export async function seriesWithWeighedExit(db) {
  const keys = new Set();
  let saidas = 0;
  let semGmd = 0;
  await db.table('pesagens').each((row) => {
    if (row.deleted_at) return;
    const view = storageRecordToViewModel(row);
    if (view?.tipo_manejo !== 'Saída' || measuredWeightOf(view) === null) return;
    saidas += 1;
    if (view.gmd === null || view.gmd === undefined || view.gmd === '') semGmd += 1;
    keys.add(animalIdentityKey(view));
  });
  return { keys, saidas, semGmd };
}

/** Marcador gravado (ou null). */
export async function readSaidaDerivedMarker() {
  const db = await storage.ensureReady();
  return (await db.table('appSettings').get(SAIDA_DERIVED_MARKER_KEY))?.value ?? null;
}

/**
 * Roda o recálculo se ainda não foi concluído. Nunca lança: devolve o que aconteceu.
 * @param {{ log?: { info?: Function, warn?: Function } }} options
 * @returns {Promise<{ ran: boolean, completed: boolean, alreadyDone?: boolean, skipped?: string, marker?: object,
 *   error?: { code: string, message: string } }>}
 */
export async function runSaidaDerivedBackfill({ log = console } = {}) {
  let db;
  let previous = null;
  try {
    db = await storage.ensureReady();
    previous = (await db.table('appSettings').get(SAIDA_DERIVED_MARKER_KEY))?.value ?? null;
  } catch (err) {
    log?.warn?.('[dados] recálculo do GMD das saídas: banco indisponível; tenta na próxima abertura.', err?.message);
    return { ran: false, completed: false, error: { code: err?.code || 'STORAGE_UNAVAILABLE', message: err?.message || String(err) } };
  }
  if (previous?.status === SAIDA_DERIVED_STATUS.CONCLUIDO) return { ran: false, completed: true, alreadyDone: true, marker: previous };
  // Migração pendente/com falha: a escrita está bloqueada — fica para a próxima abertura.
  if (storage.isWriteBlocked()) {
    log?.warn?.('[dados] recálculo do GMD das saídas adiado: escrita bloqueada pela migração.');
    return { ran: false, completed: false, skipped: 'WRITE_BLOCKED' };
  }
  const startedAt = nowIso();
  const tentativas = (Number(previous?.tentativas) || 0) + 1;
  try {
    const { keys, saidas, semGmd } = await seriesWithWeighedExit(db);
    const regravadas = keys.size ? await recalculateWeightSeriesForKeys(keys, { onlyChanged: true }) : 0;
    const finishedAt = nowIso();
    const marker = {
      status: SAIDA_DERIVED_STATUS.CONCLUIDO,
      versao: 1,
      origem: SAIDA_DERIVED_ORIGIN,
      iniciado_em: startedAt,
      concluido_em: finishedAt,
      saidas_com_peso: saidas,
      saidas_sem_gmd_antes: semGmd,
      animais: keys.size,
      pesagens_regravadas: regravadas,
      tentativas,
    };
    await db.transaction('rw', db.table('appSettings'), db.table('auditoria'), async () => {
      await db.table('appSettings').put({ key: SAIDA_DERIVED_MARKER_KEY, value: marker });
      if (keys.size) {
        await db.table('auditoria').add({
          id: globalThis.crypto.randomUUID(),
          entidade: 'pesagens',
          entidade_id: SAIDA_DERIVED_MARKER_KEY,
          acao: 'ATUALIZAR',
          origem: SAIDA_DERIVED_ORIGIN,
          resumo: `Recálculo automático (1.4.2): ganho e GMD das saídas com peso — ${saidas} saída(s) de ${keys.size} animal(is); ${regravadas} pesagem(ns) regravada(s), só data/peso anterior, dias, ganho e GMD.`,
          campos_alterados: [...SAIDA_DERIVED_FIELDS],
          // Ação do sistema: sem usuário (a Trilha de auditoria mostra "Sistema").
          usuario_id: null,
          usuario_nome_snapshot: null,
          created_at: finishedAt,
        });
      }
    });
    log?.info?.(`[dados] recálculo do GMD das saídas concluído: ${saidas} saída(s) com peso, ${keys.size} animal(is), ${regravadas} pesagem(ns) regravada(s).`);
    return { ran: true, completed: true, marker };
  } catch (err) {
    const error = { code: err?.code || 'SAIDA_DERIVED_FAILED', message: err?.message || String(err) };
    log?.warn?.('[dados] recálculo do GMD das saídas falhou; tenta de novo na próxima abertura.', error.message);
    try {
      await db.table('appSettings').put({ key: SAIDA_DERIVED_MARKER_KEY, value: { status: SAIDA_DERIVED_STATUS.FALHOU, origem: SAIDA_DERIVED_ORIGIN, iniciado_em: startedAt, erro: error, tentativas } });
    } catch { /* o console já registrou; a próxima abertura tenta de novo */ }
    return { ran: true, completed: false, error };
  }
}
