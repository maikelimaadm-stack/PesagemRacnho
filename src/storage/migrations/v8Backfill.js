// Backfill v7 → v8 (ADR-049; docs/arquitetura-produto/14-MIGRACOES.md §3-§5; ADR-038).
//
// A v8 é ADITIVA: o upgrade do Dexie só cria as stores de sanidade vazias
// (`programasSanidade`, `medicamentos`, `aplicacoesSanidade`) e nenhum dado
// existente é reescrito. O backfill existe para que a v8 tenha estado técnico
// próprio (appSettings['migration:v8']) na mesma cadeia resumível da v7: backup
// pré-migração, PENDENTE antes de abrir, FALHOU com escrita bloqueada e
// "Continuar migração". Passo único S1 (idempotente): confere as stores criadas
// e registra as contagens no relatório.
//
// A chave legada `cadastros-auxiliares:sanidade:*` NÃO é convertida aqui: ela é
// tratada pelo B11 da v7 (exportada e removida; retida só sem porta de arquivos).
import { SANITY_STORES } from '../indexedDb/schema.js';
import {
  MIGRATION_STATUS,
  MigrationError,
  emptyMigrationReportV8,
  emptyMigrationState,
  readMigrationState,
  writeMigrationState,
} from './migrationState.js';

export const V8_VERSION = 8;
export const V8_STEPS = ['S1'];

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// S1 — stores de sanidade presentes; contagens (nada é gravado nelas).
// ---------------------------------------------------------------------------
async function runS1(ctx) {
  const installed = new Set(ctx.db.tables.map((table) => table.name));
  const missing = SANITY_STORES.filter((name) => !installed.has(name));
  if (missing.length) {
    throw new MigrationError('MIGRATION_V8_STORES_MISSING', `Stores da v8 ausentes no banco aberto: ${missing.join(', ')}.`, { missing });
  }
  ctx.report.storesCriadas = [...SANITY_STORES];
  for (const name of SANITY_STORES) ctx.report[name] = await ctx.db.table(name).count();
}

const STEP_RUNNERS = { S1: runS1 };

/**
 * Executa (ou continua) o backfill v8. Mesmo contrato de runV7Backfill:
 * reentrante, `maxBatches` limita passos por chamada, `hooks.beforeStep` injeta
 * falhas nos gates. Devolve { completed, state, alreadyDone }.
 */
export async function runV8Backfill(db, { onProgress, maxBatches = Infinity, hooks = null, origem = null } = {}) {
  let state = (await readMigrationState(db, V8_VERSION)) || emptyMigrationState(V8_VERSION, { origem });
  if (state.status === MIGRATION_STATUS.CONCLUIDA) return { completed: true, state, alreadyDone: true };
  state = await writeMigrationState(db, V8_VERSION, {
    ...state,
    status: MIGRATION_STATUS.EM_ANDAMENTO,
    origem: state.origem || origem,
    started_at: state.started_at || nowIso(),
    total: V8_STEPS.length,
    error: null,
    passos_concluidos: Array.isArray(state.passos_concluidos) ? state.passos_concluidos : [],
    relatorio: { ...emptyMigrationReportV8(), ...(state.relatorio || {}) },
  });
  const ctx = {
    db,
    state,
    report: state.relatorio,
    progress(passo, message) {
      onProgress?.({ versao: V8_VERSION, passo, processed: ctx.state.processed, total: ctx.state.total, message });
    },
  };
  let used = 0;
  let currentStep = null;
  try {
    for (const step of V8_STEPS) {
      if (ctx.state.passos_concluidos.includes(step)) continue;
      if (used >= maxBatches) return { completed: false, state: ctx.state, alreadyDone: false };
      currentStep = step;
      hooks?.beforeStep?.(step, ctx.state);
      ctx.progress(step, `Iniciando ${step}`);
      await STEP_RUNNERS[step](ctx);
      used += 1;
      ctx.state = await writeMigrationState(db, V8_VERSION, {
        status: MIGRATION_STATUS.EM_ANDAMENTO,
        passo: step,
        cursor: null,
        last_checkpoint: `${step}:done`,
        passos_concluidos: [...ctx.state.passos_concluidos, step],
        processed: ctx.state.passos_concluidos.length + 1,
        relatorio: ctx.report,
      });
    }
    ctx.state = await writeMigrationState(db, V8_VERSION, {
      status: MIGRATION_STATUS.CONCLUIDA,
      passo: null,
      cursor: null,
      last_checkpoint: `${V8_STEPS.at(-1)}:done`,
      finished_at: nowIso(),
      processed: ctx.state.total,
      error: null,
      relatorio: ctx.report,
    });
    ctx.progress(V8_STEPS.at(-1), 'Migração v8 concluída');
    return { completed: true, state: ctx.state, alreadyDone: false };
  } catch (err) {
    const error = { code: err?.code || 'MIGRATION_STEP_FAILED', message: err?.message || String(err), passo: currentStep, at: nowIso() };
    try {
      ctx.state = await writeMigrationState(db, V8_VERSION, { status: MIGRATION_STATUS.FALHOU, error, relatorio: ctx.report });
    } catch { /* o estado em memória já reflete a falha */ }
    throw new MigrationError('MIGRATION_FAILED', `Migração v8 falhou no passo ${currentStep}: ${error.message}`, { cause: err, passo: currentStep, state: ctx.state, versao: V8_VERSION });
  }
}

/** Relatório do que o backfill v8 faria, sem gravar (Manutenção e evidência). */
export async function dryRunV8(db) {
  const state = await readMigrationState(db, V8_VERSION);
  const installed = new Set(db.tables.map((table) => table.name));
  const sanidade = {};
  for (const name of SANITY_STORES) sanidade[name] = installed.has(name) ? await db.table(name).count() : null;
  return {
    versao: V8_VERSION,
    status: state?.status || MIGRATION_STATUS.PENDENTE,
    pendente: state?.status !== MIGRATION_STATUS.CONCLUIDA,
    storesAusentes: SANITY_STORES.filter((name) => !installed.has(name)),
    sanidade,
    estado: state,
  };
}
