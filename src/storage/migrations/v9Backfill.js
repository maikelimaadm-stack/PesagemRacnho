// Backfill v8 → v9 (docs/arquitetura-produto/17-MODELO-DADOS-V9.md; mesma cadeia resumível da v7/v8).
//
// A v9 é ADITIVA: o Dexie só cria stores e índices. Os passos são idempotentes:
//   S1 confere as stores novas e registra as contagens;
//   S2 grava `natureza` (ENTRADA/SAIDA/INTERNA) em todo movimento existente sem o campo;
//   S3/S4 projetam operações LEGADAS de Entrada (Cadastros) e de Saída (Saídas, por dia e motivo), com um
//   item por animal (`origem_pesagem_id`) e o `operacao_id` no movimento derivado da pesagem. Pesagem já
//   convertida não gera outro item; nada é inventado (sem parceiro, preço nem documento).
import { V9_STORES } from '../indexedDb/schema.js';
import { naturezaDoTipo } from '../../modules/livestock/domain/movementNature.js';
import { planLegacyOperations } from '../../modules/livestock/domain/legacyOperations.js';
import {
  MIGRATION_STATUS,
  MigrationError,
  emptyMigrationReportV9,
  emptyMigrationState,
  readMigrationState,
  writeMigrationState,
} from './migrationState.js';

export const V9_VERSION = 9;
export const V9_STEPS = ['S1', 'S2', 'S3'];
const nowIso = () => new Date().toISOString();

async function runS1(ctx) {
  const installed = new Set(ctx.db.tables.map((table) => table.name));
  const missing = V9_STORES.filter((name) => !installed.has(name));
  if (missing.length) {
    throw new MigrationError('MIGRATION_V9_STORES_MISSING', `Stores da v9 ausentes no banco aberto: ${missing.join(', ')}.`, { missing });
  }
  ctx.report.storesCriadas = [...V9_STORES];
}

async function runS2(ctx) {
  const table = ctx.db.table('movimentosAnimais');
  const ts = nowIso();
  let com = 0;
  let sem = 0;
  await ctx.db.transaction('rw', table, async () => {
    await table.toCollection().modify((row) => {
      if (row.natureza) return;
      const natureza = naturezaDoTipo(row.tipo);
      if (natureza) { row.natureza = natureza; row.updated_at = ts; com += 1; } else sem += 1;
    });
  });
  ctx.report.movimentosComNatureza = com;
  ctx.report.movimentosSemNatureza = sem;
}

async function runS3(ctx) {
  const db = ctx.db;
  const tables = ['pesagens', 'operacoes', 'operacaoItens', 'movimentosAnimais'].map((name) => db.table(name));
  const ts = nowIso();
  await db.transaction('rw', tables, async () => {
    const jaConvertidas = new Set((await db.table('operacaoItens').toArray())
      .filter((row) => !row.deleted_at && row.origem_pesagem_id).map((row) => String(row.origem_pesagem_id)));
    const pesagens = await db.table('pesagens').toArray();
    const { operacoes, itens, ignoradas } = planLegacyOperations(pesagens, jaConvertidas);
    const stamp = (row) => ({ ...row, created_at: ts, updated_at: ts, deleted_at: null });
    if (operacoes.length) await db.table('operacoes').bulkAdd(operacoes.map(stamp));
    if (itens.length) await db.table('operacaoItens').bulkAdd(itens.map(stamp));
    // O movimento da pesagem convertida passa a apontar para a operação (mesmo efeito de saldo, sem duplicar).
    const operacaoPorPesagem = new Map(itens.map((item) => [String(item.origem_pesagem_id), item.operacao_id]));
    if (operacaoPorPesagem.size) {
      await db.table('movimentosAnimais').toCollection().modify((row) => {
        if (row.deleted_at || row.operacao_id || !row.pesagem_id) return;
        const operacaoId = operacaoPorPesagem.get(String(row.pesagem_id));
        if (operacaoId && (row.natureza === 'ENTRADA' || row.natureza === 'SAIDA' || naturezaDoTipo(row.tipo) === 'ENTRADA' || naturezaDoTipo(row.tipo) === 'SAIDA')) {
          row.operacao_id = operacaoId;
          row.updated_at = ts;
        }
      });
    }
    ctx.report.operacoesLegadasEntrada = (ctx.report.operacoesLegadasEntrada || 0) + operacoes.filter((op) => op.tipo === 'ENTRADA').length;
    ctx.report.operacoesLegadasSaida = (ctx.report.operacoesLegadasSaida || 0) + operacoes.filter((op) => op.tipo === 'SAIDA').length;
    ctx.report.itensLegados = (ctx.report.itensLegados || 0) + itens.length;
    ctx.report.pesagensJaConvertidas = ignoradas;
  });
}

const STEP_RUNNERS = { S1: runS1, S2: runS2, S3: runS3 };

/** Mesmo contrato de runV8Backfill: reentrante, maxBatches, hooks.beforeStep. */
export async function runV9Backfill(db, { onProgress, maxBatches = Infinity, hooks = null, origem = null } = {}) {
  let state = (await readMigrationState(db, V9_VERSION)) || emptyMigrationState(V9_VERSION, { origem });
  if (state.status === MIGRATION_STATUS.CONCLUIDA) return { completed: true, state, alreadyDone: true };
  state = await writeMigrationState(db, V9_VERSION, {
    ...state,
    status: MIGRATION_STATUS.EM_ANDAMENTO,
    origem: state.origem || origem,
    started_at: state.started_at || nowIso(),
    total: V9_STEPS.length,
    error: null,
    passos_concluidos: Array.isArray(state.passos_concluidos) ? state.passos_concluidos : [],
    relatorio: { ...emptyMigrationReportV9(), ...(state.relatorio || {}) },
  });
  const ctx = {
    db,
    state,
    report: { ...emptyMigrationReportV9(), ...(state.relatorio || {}) },
    progress: (passo, message) => onProgress?.({ versao: V9_VERSION, passo, message }),
  };
  let used = 0;
  let currentStep = null;
  try {
    for (const step of V9_STEPS) {
      if (ctx.state.passos_concluidos.includes(step)) continue;
      if (used >= maxBatches) return { completed: false, state: ctx.state, alreadyDone: false };
      currentStep = step;
      hooks?.beforeStep?.(step, ctx.state);
      ctx.progress(step, `Iniciando ${step}`);
      await STEP_RUNNERS[step](ctx);
      used += 1;
      ctx.state = await writeMigrationState(db, V9_VERSION, {
        status: MIGRATION_STATUS.EM_ANDAMENTO,
        passo: step,
        cursor: null,
        last_checkpoint: `${step}:done`,
        passos_concluidos: [...ctx.state.passos_concluidos, step],
        processed: ctx.state.passos_concluidos.length + 1,
        relatorio: ctx.report,
      });
    }
    ctx.state = await writeMigrationState(db, V9_VERSION, {
      status: MIGRATION_STATUS.CONCLUIDA,
      passo: null,
      cursor: null,
      last_checkpoint: `${V9_STEPS.at(-1)}:done`,
      finished_at: nowIso(),
      processed: ctx.state.total,
      error: null,
      relatorio: ctx.report,
    });
    ctx.progress(V9_STEPS.at(-1), 'Migração v9 concluída');
    return { completed: true, state: ctx.state, alreadyDone: false };
  } catch (err) {
    const error = { code: err?.code || 'MIGRATION_STEP_FAILED', message: err?.message || String(err), passo: currentStep, at: nowIso() };
    try {
      ctx.state = await writeMigrationState(db, V9_VERSION, { status: MIGRATION_STATUS.FALHOU, error, relatorio: ctx.report });
    } catch { /* estado em memória já reflete a falha */ }
    throw new MigrationError('MIGRATION_FAILED', `Migração v9 falhou no passo ${currentStep}: ${error.message}`, { cause: err, passo: currentStep, state: ctx.state, versao: V9_VERSION });
  }
}

/** O que o backfill v9 faria, sem gravar. */
export async function dryRunV9(db) {
  const state = await readMigrationState(db, V9_VERSION);
  const installed = new Set(db.tables.map((table) => table.name));
  const movimentos = installed.has('movimentosAnimais') ? await db.table('movimentosAnimais').toArray() : [];
  const jaConvertidas = installed.has('operacaoItens')
    ? new Set((await db.table('operacaoItens').toArray()).filter((r) => !r.deleted_at && r.origem_pesagem_id).map((r) => String(r.origem_pesagem_id)))
    : new Set();
  const plano = installed.has('pesagens') ? planLegacyOperations(await db.table('pesagens').toArray(), jaConvertidas) : { operacoes: [], itens: [] };
  return {
    versao: V9_VERSION,
    status: state?.status || MIGRATION_STATUS.PENDENTE,
    pendente: state?.status !== MIGRATION_STATUS.CONCLUIDA,
    storesAusentes: V9_STORES.filter((name) => !installed.has(name)),
    movimentosSemNatureza: movimentos.filter((row) => !row.natureza).length,
    operacoesLegadas: plano.operacoes.length,
    itensLegados: plano.itens.length,
    estado: state,
  };
}
