// Job da importação conciliada na store EXISTENTE `importacoes` (nenhuma store nova).
// Situação EM_ANDAMENTO → CONCLUIDA | FALHOU, contagens acumuladas, checkpoint por lote de
// animais (gravado na MESMA transação do lote), regras, mapeamento e ator.
//
// Índice único `&arquivo_hash`: o primeiro job de um arquivo usa o SHA-256 do texto
// normalizado; os seguintes (outro tipo, nova tentativa depois de concluir) usam
// `<sha256>#<n>` com n = 2, 3, … O hash puro fica sempre em `arquivo_sha256`. Reimportar um
// arquivo já importado nunca esbarra no índice: a análise devolve 100% JÁ EXISTE e a
// gravação sem nada novo não cria job.
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { auditRow } from '../../weighing/infrastructure/weighingDataAdapter.js';
import { JOB_STATUS } from '../domain/importConstants.js';

export const IMPORT_JOB_ORIGIN = 'assistente-importacao';

export const EMPTY_JOB_COUNTERS = Object.freeze({
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
  cadastros_mestres_criados: 0,
  aplicacoes_criadas: 0,
});

/** Jobs de um arquivo (qualquer tipo/situação), do mais antigo ao mais novo. */
export async function listJobsForHash(db, sha256) {
  if (!sha256) return [];
  const rows = await db.table('importacoes').where('arquivo_hash').startsWith(sha256).toArray();
  return rows
    .filter((row) => !row.deleted_at && (row.arquivo_sha256 === sha256 || row.arquivo_hash === sha256 || String(row.arquivo_hash).startsWith(`${sha256}#`)))
    .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));
}

/** Próxima chave livre do índice único para o arquivo. */
export function nextHashKey(existingRows, sha256) {
  const keys = new Set(existingRows.map((row) => String(row.arquivo_hash)));
  if (!keys.has(sha256)) return sha256;
  let n = 2;
  while (keys.has(`${sha256}#${n}`)) n += 1;
  return `${sha256}#${n}`;
}

export async function createJob(db, { plan, operador }) {
  const ts = new Date().toISOString();
  const actor = getActor();
  let job = null;
  await db.transaction('rw', db.table('importacoes'), db.table('auditoria'), async () => {
    const existing = await db.table('importacoes').where('arquivo_hash').startsWith(plan.hash).toArray();
    job = {
      id: crypto.randomUUID(),
      arquivo_hash: nextHashKey(existing, plan.hash),
      arquivo_sha256: plan.hash,
      arquivo_nome: plan.fileName ?? null,
      arquivo_tamanho: plan.fileSize ?? null,
      origem: IMPORT_JOB_ORIGIN,
      tipo_importacao: plan.type,
      status: JOB_STATUS.EM_ANDAMENTO,
      regras: plan.rules,
      mapeamento: plan.mapping,
      operador: operador ?? null,
      usuario_id: actor.usuario_id,
      usuario_nome_snapshot: actor.usuario_nome_snapshot,
      linhas_total: plan.summary.linhasLidas,
      linhas_novas: plan.summary.novos,
      duplicidades_ignoradas: plan.summary.jaExistem + plan.summary.duplicidades,
      ...EMPTY_JOB_COUNTERS,
      checkpoint: { lotes_concluidos: 0, animais_processados: 0, animais_total: plan.animals.filter((animal) => animal.novos.length).length, ultima_chave: null },
      tentativas: 1,
      erro: null,
      created_at: ts,
      updated_at: ts,
      concluida_em: null,
      deleted_at: null,
    };
    await db.table('importacoes').add(job);
  });
  return job;
}

/** Reabre um job FALHOU/EM_ANDAMENTO para continuar do checkpoint. */
export async function reopenJob(db, jobId, { animaisTotal = null } = {}) {
  const ts = new Date().toISOString();
  let job = null;
  await db.transaction('rw', db.table('importacoes'), async () => {
    const row = await db.table('importacoes').where('id').equals(jobId).first();
    if (!row) throw new Error(`Importação ${jobId} não encontrada para retomar.`);
    const changes = {
      status: JOB_STATUS.EM_ANDAMENTO,
      erro: null,
      tentativas: (row.tentativas || 1) + 1,
      updated_at: ts,
      ...(animaisTotal !== null ? { checkpoint: { ...row.checkpoint, animais_total: (row.checkpoint?.animais_processados || 0) + animaisTotal } } : {}),
    };
    await db.table('importacoes').update(row.localId, changes);
    job = { ...row, ...changes };
  });
  return job;
}

/** Soma contagens e avança o checkpoint. Chamar DENTRO da transação do lote. */
export async function advanceJobInTransaction(db, jobId, counters, { lastKey, animals }) {
  const row = await db.table('importacoes').where('id').equals(jobId).first();
  if (!row) throw new Error(`Importação ${jobId} não encontrada.`);
  const changes = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(counters)) changes[key] = (row[key] || 0) + (value || 0);
  changes.checkpoint = {
    ...(row.checkpoint || {}),
    lotes_concluidos: (row.checkpoint?.lotes_concluidos || 0) + 1,
    animais_processados: (row.checkpoint?.animais_processados || 0) + animals,
    ultima_chave: lastKey,
  };
  await db.table('importacoes').update(row.localId, changes);
  return { ...row, ...changes };
}

/** CONCLUIDA + auditoria IMPORTAR do job, na mesma transação. */
export async function completeJob(db, jobId, extra = {}) {
  const ts = new Date().toISOString();
  let job = null;
  await db.transaction('rw', db.table('importacoes'), db.table('auditoria'), async () => {
    const row = await db.table('importacoes').where('id').equals(jobId).first();
    const changes = { ...extra, status: JOB_STATUS.CONCLUIDA, erro: null, concluida_em: ts, updated_at: ts };
    for (const [key, value] of Object.entries(extra)) if (typeof value === 'number' && key in EMPTY_JOB_COUNTERS) changes[key] = (row[key] || 0) + value;
    await db.table('importacoes').update(row.localId, changes);
    job = { ...row, ...changes };
    await db.table('auditoria').add(auditRow({
      entidade: 'importacoes',
      entidade_id: job.id,
      acao: 'IMPORTAR',
      origem: 'importacao',
      resumo: `Importação ${job.tipo_importacao} concluída: ${job.registros_criados} evento(s), ${job.animais_criados} animal(is) novo(s), ${job.cadastros_mestres_criados} cadastro(s) mestre(s).`,
      depois: {
        id: job.id,
        tipo_importacao: job.tipo_importacao,
        arquivo_nome: job.arquivo_nome,
        arquivo_sha256: job.arquivo_sha256,
        linhas_total: job.linhas_total,
        registros_criados: job.registros_criados,
        cadastros_criados: job.cadastros_criados,
        manejos_criados: job.manejos_criados,
        saidas_criadas: job.saidas_criadas,
        animais_criados: job.animais_criados,
        cadastros_mestres_criados: job.cadastros_mestres_criados,
      },
      operador: job.operador ?? null,
      created_at: ts,
    }));
  });
  return job;
}

export async function failJob(db, jobId, error) {
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table('importacoes'), async () => {
    const row = await db.table('importacoes').where('id').equals(jobId).first();
    if (!row) return;
    await db.table('importacoes').update(row.localId, { status: JOB_STATUS.FALHOU, erro: String(error?.message || error || 'Falha desconhecida'), updated_at: ts });
  });
}
