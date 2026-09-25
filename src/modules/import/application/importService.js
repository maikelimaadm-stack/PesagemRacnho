// Serviço público da importação conciliada (missão sanity-launch-import §18-§37, §59-§61).
// Consumido pelo assistente de importação e pelo gate de exportação/reimportação.
//
//   readImportFile   → cabeçalhos, linhas com a linha FÍSICA, separador e SHA-256;
//   suggestMapping   → cabeçalho → campo (CSV técnico mapeia 1:1);
//   analyzeImport    → DRY-RUN: nada é gravado; devolve o ImportPlan;
//   applyImport      → grava o plano em lotes de animais, revalidando contra o banco;
//   planToCsv/resultToCsv → relatório de conciliação exportável;
//   modelos          → appSettings `import-template:<empresa>`, nunca dados.
//
// Permissão no SERVIÇO com falha fechada (padrão de requireWeighingPermission): eventos exigem
// weighing.write; cadastros mestres (tipo MESTRES ou "criar cadastros ausentes") exigem
// registry.write. Nenhuma ação nova na matriz.
//
// Backup: este serviço não tem porta de arquivos. O backup físico prévio é responsabilidade da
// tela, que chama o backup completo existente (maintenanceDataAdapter.persistFullBackup) antes
// de applyImport. A gravação é idempotente e retomável: cada lote é atômico e o job guarda o
// checkpoint; repetir applyImport com o mesmo plano continua de onde parou.
import storage from '../../../storage/storageAdapter.js';
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError, roleOf } from '../../auth/domain/permissionService.js';
import { normalizeName } from '../../catalog/domain/normalize.js';
import { getRegistryService } from '../../catalog/application/registryServices.js';
import { listMedicamentos, listProgramas, saveMedicamento, saveProgram } from '../../sanity/application/sanityService.js';
import { buildAnimalIdentityIndex } from '../domain/animalIdentity.js';
import {
  DEFAULT_EMPRESA_ID,
  IMPORT_TYPES,
  IMPORT_TYPE_LABELS,
  JOB_STATUS,
  ROW_STATUS,
} from '../domain/importConstants.js';
import { invertMapping, listImportFields, listMappableFields, suggestMapping } from '../domain/importFields.js';
import { readImportFile } from '../domain/importFile.js';
import { buildImportPlan, prepareImportRows } from '../domain/importPlanner.js';
import { buildRegistryContext } from '../domain/importRegistryContext.js';
import { planToCsv, resultToCsv } from '../domain/importReport.js';
import { weightKey } from '../domain/importValues.js';
import { buildMasterImportPlan } from '../domain/masterImportPlanner.js';
import { buildSanityImportPlan, buildSanityRegistryContext, prepareSanityImportRows } from '../domain/sanityImportPlanner.js';
import { loadApplicationsForAnimals, loadImportRegistry, loadSanityRegistry, loadSeriesForAnimals } from '../infrastructure/importContextLoader.js';
import { IMPORT_JOB_ORIGIN, completeJob, createJob, failJob, listJobsForHash, reopenJob } from '../infrastructure/importJobs.js';
import { readTemplateStore, sanitizeImportTemplate, writeTemplateStore } from '../infrastructure/importTemplates.js';
import { loadWriteDefaults, writeImportBatch } from '../infrastructure/importWriter.js';
import { writeSanityImportBatch } from '../infrastructure/sanityImportWriter.js';

export { IMPORT_TYPES, IMPORT_TYPE_LABELS, ROW_STATUS } from '../domain/importConstants.js';
export { listImportFields, listMappableFields, suggestMapping, readImportFile, planToCsv, resultToCsv };

export class ImportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    Object.assign(this, details);
  }
}

// ---------------------------------------------------------------------------
// Permissão (falha fechada)
// ---------------------------------------------------------------------------

/**
 * Sessão ativa → papel da sessão. Provedor de autenticação registrado sem sessão → recusa.
 * Sem provedor (gates em Node): ator informado com papel é verificado; ator identificado sem
 * papel é recusado; nenhum ator → liberado (mesma regra de requireWeighingPermission).
 */
export function requireImportPermission(actor, action) {
  const session = getCurrentActor();
  if (session) {
    authorize(session.role, action);
    return session;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  if (actor && (actor.id || roleOf(actor))) {
    authorize(roleOf(actor), action);
    return actor;
  }
  return null;
}

function canImport(actor, action) {
  try {
    requireImportPermission(actor, action);
    return true;
  } catch {
    return false;
  }
}

const permissionFor = (type) => (type === IMPORT_TYPES.MESTRES ? 'registry.write' : 'weighing.write');

// ---------------------------------------------------------------------------
// Análise (dry-run)
// ---------------------------------------------------------------------------

const sameCompany = (empresaId) => (row) => (row.empresa_id ?? row.empresaId ?? DEFAULT_EMPRESA_ID) === empresaId;

/**
 * analyzeImport({ text, type, mapping, rules, fileName, fileSize, delimiter }, actor) → ImportPlan.
 * Não grava nada. `mapping` ausente → suggestMapping. O plano carrega `input` (texto, tipo,
 * mapeamento e regras) para que applyImport refaça a análise contra o banco antes de gravar.
 */
export async function analyzeImport({ text, type, mapping = null, rules = {}, fileName = null, fileSize = null, delimiter = 'auto' } = {}, actor = null) {
  if (!Object.values(IMPORT_TYPES).includes(type)) throw new ImportError('IMPORT_INVALID_TYPE', `Tipo de importação desconhecido: ${type}.`);
  requireImportPermission(actor, permissionFor(type));
  const file = readImportFile(text, { delimiter });
  const effectiveMapping = mapping && Object.keys(mapping).length ? { ...mapping } : suggestMapping(file.headers, type);
  const db = await storage.ensureReady();
  const raw = await loadImportRegistry(db);
  const prepared0 = { type, file, mapping: effectiveMapping, rules };
  let plan;
  let context = null;
  if (type === IMPORT_TYPES.MESTRES) {
    const prepared = prepareImportRows({ ...prepared0, context: { registry: null, identityIndex: null } });
    const registry = buildRegistryContext(raw, prepared.rules.empresaId);
    plan = buildMasterImportPlan({
      file,
      headerByField: invertMapping(effectiveMapping, type),
      rules: prepared.rules,
      fileErrors: prepared.fileErrors,
      existing: { marcas: registry.marcas.rows, racas: registry.racas.rows, causasMorte: registry.causas.rows, categoriasAnimal: registry.categorias },
    });
  } else if (type === IMPORT_TYPES.SANIDADE) {
    const empresaId = String(rules?.empresaId || DEFAULT_EMPRESA_ID);
    const registry = buildRegistryContext(raw, empresaId);
    const identityIndex = buildAnimalIdentityIndex({ animals: raw.animals.filter(sameCompany(empresaId)), identifiers: raw.identifiers, marcas: registry.marcas.rows });
    const sanityRegistry = buildSanityRegistryContext(await loadSanityRegistry(db), empresaId);
    context = { identityIndex, registry, sanityRegistry };
    const prepared = prepareSanityImportRows({ file, mapping: effectiveMapping, rules, context });
    const [seriesByAnimal, applicationsByAnimal] = await Promise.all([
      loadSeriesForAnimals(db, prepared.candidateAnimalIds),
      loadApplicationsForAnimals(db, prepared.candidateAnimalIds, { empresaId }),
    ]);
    plan = buildSanityImportPlan(prepared, {
      ...context,
      seriesByAnimal,
      applicationsByAnimal,
      permissions: { canRegistryWrite: canImport(actor, 'registry.write') },
    });
  } else {
    const empresaId = String(rules?.empresaId || DEFAULT_EMPRESA_ID);
    const registry = buildRegistryContext(raw, empresaId);
    const identityIndex = buildAnimalIdentityIndex({ animals: raw.animals.filter(sameCompany(empresaId)), identifiers: raw.identifiers, marcas: registry.marcas.rows });
    context = { identityIndex, registry };
    const prepared = prepareImportRows({ ...prepared0, context });
    const seriesByAnimal = await loadSeriesForAnimals(db, prepared.candidateAnimalIds);
    plan = buildImportPlan(prepared, { ...context, seriesByAnimal, permissions: { canRegistryWrite: canImport(actor, 'registry.write') } });
  }
  const previousImports = (await listJobsForHash(db, file.hash)).map((job) => ({
    id: job.id,
    tipo: job.tipo_importacao ?? null,
    status: job.status,
    created_at: job.created_at,
    registros_criados: job.registros_criados ?? 0,
  }));
  return {
    ...plan,
    typeLabel: IMPORT_TYPE_LABELS[type],
    hash: file.hash,
    delimiter: file.delimiter,
    headers: file.headers,
    mapping: effectiveMapping,
    fileName,
    fileSize,
    previousImports,
    createdAt: new Date().toISOString(),
    input: { text, type, mapping: effectiveMapping, rules, fileName, fileSize, delimiter },
  };
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

const rowKey = (plan, row) => `${row.line}|${plan.type === IMPORT_TYPES.MESTRES ? row.identity?.key : ''}`;

function rowSignature(row) {
  return [
    row.status,
    row.eventType || '',
    row.identity?.animalId || row.identity?.key || '',
    row.data || '',
    weightKey(row.peso),
    row.derived?.data_anterior ?? '',
    weightKey(row.derived?.peso_anterior),
    row.derived?.dias ?? '',
    row.derived?.gmd ?? '',
  ].join('|');
}

/**
 * Plano do dry-run × análise refeita agora. Diferença aceita: linha NOVO que virou JÁ EXISTE
 * por gravação de um job deste mesmo arquivo (retomada ou plano já aplicado) — e, em cadastros
 * mestres, qualquer NOVO → JÁ EXISTE (idempotente por nome). Qualquer outra diferença recusa.
 */
function comparePlans(original, fresh, jobs) {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const freshByKey = new Map(fresh.rows.map((row) => [rowKey(fresh, row), row]));
  const divergent = [];
  const writtenBy = new Set();
  for (const row of original.rows) {
    const current = freshByKey.get(rowKey(original, row));
    if (!current) {
      divergent.push(row.line);
      continue;
    }
    if (rowSignature(row) === rowSignature(current)) continue;
    const becameExisting = row.status === ROW_STATUS.NOVO && current.status === ROW_STATUS.JA_EXISTE;
    if (becameExisting && (original.type === IMPORT_TYPES.MESTRES || original.type === IMPORT_TYPES.SANIDADE)) continue;
    if (becameExisting && current.matchedImportacaoId && jobsById.has(current.matchedImportacaoId)) {
      writtenBy.add(current.matchedImportacaoId);
      continue;
    }
    divergent.push(row.line);
  }
  const originalKeys = new Set(original.rows.map((row) => rowKey(original, row)));
  for (const row of fresh.rows) if (!originalKeys.has(rowKey(fresh, row))) divergent.push(row.line);
  const resumable = [...writtenBy].map((id) => jobsById.get(id)).filter((job) => job && job.status !== JOB_STATUS.CONCLUIDA);
  return { divergent: [...new Set(divergent)].sort((a, b) => a - b), resumeJob: resumable.at(-1) || null, writtenBy: [...writtenBy] };
}

const operatorName = (actor) => getCurrentActor()?.nome || actor?.nome || 'IMPORTACAO';

function emptyResult(plan, extra = {}) {
  return {
    importacaoId: null,
    status: 'SEM_ALTERACOES',
    retomada: false,
    linhasProcessadas: plan.summary.linhasLidas,
    cadastrosCriados: 0,
    manejosCriados: 0,
    saidasCriadas: 0,
    animaisConciliados: 0,
    animaisNovos: 0,
    duplicidadesIgnoradas: plan.summary.jaExistem + plan.summary.duplicidades,
    erros: plan.summary.erros,
    seriesRecalculadas: 0,
    eventosRecalculados: 0,
    categoriasResolvidasAutomaticamente: 0,
    cadastrosMestresCriados: 0,
    aplicacoesCriadas: 0,
    lotes: 0,
    linhasGravadas: [],
    ...extra,
  };
}

// Cadastros de sanidade criados junto da importação. O programa nasce com tipo "Outro"
// (a planilha só traz o nome) e pode ser detalhado depois na tela de Sanidade. A gravação é
// sempre pelo sanityService, que valida, audita e recusa nome repetido.
const SANITY_MASTER_CREATORS = Object.freeze({
  programasSanidade: Object.freeze({
    list: (empresaId) => listProgramas({ includeInactive: true, empresaId }),
    create: (nome, empresaId) => saveProgram({ nome, tipo: 'OUTRO', empresa_id: empresaId }),
  }),
  medicamentos: Object.freeze({
    list: (empresaId) => listMedicamentos({ includeInactive: true, empresaId }),
    create: (nome, empresaId) => saveMedicamento({ nome, empresa_id: empresaId }),
  }),
});

async function createMissingMasters(plan, actor) {
  const creatable = (plan.summary.cadastrosMestresAusentes || [])
    .filter((item) => ['marcas', 'racas', 'causasMorte'].includes(item.store) || SANITY_MASTER_CREATORS[item.store]);
  if (!creatable.length) return 0;
  const registryActor = requireImportPermission(actor, 'registry.write');
  const empresaId = plan.rules.empresaId;
  let created = 0;
  for (const item of creatable) {
    const sanityCreator = SANITY_MASTER_CREATORS[item.store];
    if (sanityCreator) {
      const existing = await sanityCreator.list(empresaId);
      if (existing.some((row) => (row.nome_normalizado || normalizeName(row.nome)) === normalizeName(item.nome))) continue;
      await sanityCreator.create(item.nome, empresaId);
      created += 1;
      continue;
    }
    const service = getRegistryService(item.store);
    if (await service.resolveByName(item.nome, { empresaId })) continue;
    await service.create(registryActor, { nome: item.nome, empresa_id: empresaId });
    created += 1;
  }
  return created;
}

async function applyMasterPlan(fresh, actor, { onProgress }) {
  const novos = fresh.rows.filter((row) => row.status === ROW_STATUS.NOVO);
  if (!novos.length) return emptyResult(fresh);
  const db = await storage.ensureReady();
  const registryActor = requireImportPermission(actor, 'registry.write');
  const job = await createJob(db, { plan: fresh, operador: operatorName(actor) });
  let created = 0;
  try {
    for (const row of novos) {
      const service = getRegistryService(row.master.store);
      if (!(await service.resolveByName(row.master.nome, { empresaId: fresh.rules.empresaId }))) {
        await service.create(registryActor, row.master.dados);
        created += 1;
      }
      onProgress?.({ lote: created, lotes: novos.length, animaisProcessados: 0, animaisTotal: 0, registrosCriados: created });
    }
    await completeJob(db, job.id, { cadastros_mestres_criados: created });
  } catch (error) {
    await failJob(db, job.id, error).catch(() => {});
    throw error;
  }
  return { ...emptyResult(fresh), importacaoId: job.id, status: JOB_STATUS.CONCLUIDA, cadastrosMestresCriados: created, linhasGravadas: [...new Set(novos.map((row) => row.line))] };
}

/**
 * applySanityPlan(fresh, actor, …) → ImportResult das aplicações de sanidade. Cada lote é uma
 * transação própria (writeSanityImportBatch); reimportar o mesmo arquivo não duplica nada
 * porque a análise já devolve tudo como JÁ EXISTE.
 */
async function applySanityPlan(fresh, actor, { onProgress = null, batchRows = 200, mastersCreated = 0, resumeJob = null } = {}) {
  const db = await storage.ensureReady();
  const novos = fresh.rows.filter((row) => row.status === ROW_STATUS.NOVO && row.payload);
  if (!novos.length) {
    if (resumeJob) {
      const done = await completeJob(db, resumeJob.id, { cadastros_mestres_criados: mastersCreated });
      return emptyResult(fresh, { importacaoId: done.id, status: JOB_STATUS.CONCLUIDA, retomada: true, cadastrosMestresCriados: mastersCreated });
    }
    return emptyResult(fresh, { cadastrosMestresCriados: mastersCreated });
  }
  const retomada = Boolean(resumeJob);
  const job = resumeJob
    ? await reopenJob(db, resumeJob.id, { animaisTotal: fresh.animals.filter((animal) => animal.novos.length).length })
    : await createJob(db, { plan: fresh, operador: operatorName(actor) });
  const size = Math.max(1, Math.floor(Number(batchRows) || 200));
  const totalBatches = Math.ceil(novos.length / size);
  const totals = {};
  let processed = 0;
  try {
    for (let index = 0; index < novos.length; index += size) {
      const batch = novos.slice(index, index + size);
      const counters = await writeSanityImportBatch(db, { rows: batch, job, empresaId: fresh.rules.empresaId });
      for (const [key, value] of Object.entries(counters)) totals[key] = (totals[key] || 0) + value;
      processed += batch.length;
      onProgress?.({ lote: index / size + 1, lotes: totalBatches, animaisProcessados: processed, animaisTotal: novos.length, registrosCriados: totals.registros_criados });
    }
    await completeJob(db, job.id, { cadastros_mestres_criados: mastersCreated });
  } catch (error) {
    await failJob(db, job.id, error).catch(() => {});
    throw error;
  }
  return {
    ...emptyResult(fresh),
    importacaoId: job.id,
    status: JOB_STATUS.CONCLUIDA,
    retomada,
    aplicacoesCriadas: totals.aplicacoes_criadas || 0,
    animaisConciliados: totals.animais_conciliados || 0,
    cadastrosMestresCriados: mastersCreated,
    lotes: totalBatches,
    linhasGravadas: novos.map((row) => row.line).sort((a, b) => a - b),
  };
}

// Trava de "gravação em andamento" (25/09/2026, PROMPT-00B): duas chamadas simultâneas de
// applyImport com o mesmo plano passavam pela revalidação e criavam um job cada (a perdedora
// terminava FALHOU). Na tela o botão "Gravar agora" já fica desabilitado durante a gravação; o caso
// vinha do gate (que simula o duplo clique) e vale para qualquer chamador programático. Dentro do
// processo, o mesmo plano (tipo + hash do arquivo + mapeamento, regras e separador) em gravação
// devolve a MESMA promessa — mesmo job, mesmo resultado. Planos com chave diferente continuam
// protegidos pela guarda de concorrência dentro da transação do importWriter.
const inFlightApplies = new Map();

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value instanceof Set) return `set${stableJson([...value].map(stableJson).sort())}`;
  if (value instanceof Map) return `map${stableJson([...value.entries()].map(stableJson).sort())}`;
  if (value && typeof value.toJSON === 'function') return JSON.stringify(value);
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Chave da trava de gravação (exportada para o gate import:idempotency:verify). */
export function importApplyFingerprint(plan) {
  const { mapping = null, rules = {}, delimiter = 'auto' } = plan.input;
  return `${plan.type}|${plan.hash}|${stableJson({ mapping, rules, delimiter })}`;
}

/**
 * applyImport(plan, actor, { onProgress, batchAnimals = 200 }) → ImportResult.
 * Recusa plano bloqueante. Refaz a análise contra o banco e recusa divergência (exceto a
 * retomada do próprio arquivo). Grava lotes de `batchAnimals` animais, cada lote numa transação.
 * Chamada repetida com o mesmo plano enquanto a primeira grava → mesma promessa (sem 2º job);
 * `onProgress` da chamada repetida não é chamado.
 */
export async function applyImport(plan, actor = null, options = {}) {
  // Todas as recusas síncronas (plano, permissões, bloqueio, somente leitura) valem para quem
  // chega depois: nenhuma chamada recebe carona sem passar pelas mesmas checagens.
  assertApplyAllowed(plan, actor);
  const key = importApplyFingerprint(plan);
  const running = inFlightApplies.get(key);
  if (running) return running;
  const promise = applyImportOnce(plan, actor, options);
  inFlightApplies.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inFlightApplies.get(key) === promise) inFlightApplies.delete(key);
  }
}

function assertApplyAllowed(plan, actor) {
  if (!plan || !plan.input || !Array.isArray(plan.rows)) throw new ImportError('IMPORT_INVALID_PLAN', 'Plano de importação inválido: refaça a análise.');
  requireImportPermission(actor, permissionFor(plan.type));
  if (plan.rules?.createMissingMasters && plan.summary?.cadastrosMestresAusentes?.length) requireImportPermission(actor, 'registry.write');
  if (plan.blocking) {
    throw new ImportError('IMPORT_BLOCKING', `O plano tem ${plan.summary.erros} erro(s), ${plan.summary.conflitos} conflito(s) e ${plan.summary.ambiguidades} ambiguidade(s). Resolva antes de gravar.`);
  }
  storage.assertWritable('Importação conciliada');
}

async function applyImportOnce(plan, actor = null, { onProgress = null, batchAnimals = 200 } = {}) {
  const db = await storage.ensureReady();
  let fresh = await analyzeImport(plan.input, actor);
  if (fresh.hash !== plan.hash) throw new ImportError('IMPORT_STALE_PLAN', 'O arquivo do plano mudou: refaça a análise.');
  const jobs = await listJobsForHash(db, plan.hash);
  const comparison = comparePlans(plan, fresh, jobs);
  if (comparison.divergent.length) {
    throw new ImportError('IMPORT_STALE_PLAN', `O banco mudou desde a análise (linhas ${comparison.divergent.slice(0, 20).join(', ')}${comparison.divergent.length > 20 ? '…' : ''}). Refaça a análise antes de gravar.`, { lines: comparison.divergent });
  }
  if (fresh.blocking) throw new ImportError('IMPORT_BLOCKING', 'A análise refeita encontrou pendências bloqueantes. Refaça a análise.');
  if (plan.type === IMPORT_TYPES.MESTRES) return applyMasterPlan(fresh, actor, { onProgress });

  let mastersCreated = 0;
  if (fresh.rules.createMissingMasters && fresh.summary.cadastrosMestresAusentes.length) {
    mastersCreated = await createMissingMasters(fresh, actor);
    fresh = await analyzeImport(plan.input, actor);
    if (fresh.blocking) throw new ImportError('IMPORT_BLOCKING', 'Depois de criar os cadastros ausentes a análise ainda tem pendências. Refaça a análise.');
  }

  if (plan.type === IMPORT_TYPES.SANIDADE) {
    return applySanityPlan(fresh, actor, { onProgress, mastersCreated, resumeJob: comparison.resumeJob });
  }

  const groups = fresh.animals.filter((animal) => animal.novos.length);
  let job = comparison.resumeJob;
  if (!groups.length) {
    if (job) {
      const done = await completeJob(db, job.id, { cadastros_mestres_criados: mastersCreated });
      return emptyResult(fresh, { importacaoId: done.id, status: JOB_STATUS.CONCLUIDA, retomada: true, cadastrosMestresCriados: mastersCreated });
    }
    return emptyResult(fresh, { cadastrosMestresCriados: mastersCreated, jaAplicadaPor: comparison.writtenBy[0] ?? null });
  }

  const retomada = Boolean(job);
  job = job ? await reopenJob(db, job.id, { animaisTotal: groups.length }) : await createJob(db, { plan: fresh, operador: operatorName(actor) });
  const rowsByLine = new Map(fresh.rows.filter((row) => row.status === ROW_STATUS.NOVO).map((row) => [row.line, row]));
  const { propriedadeId } = await loadWriteDefaults(db);
  const size = Math.max(1, Math.floor(Number(batchAnimals) || 200));
  const totalBatches = Math.ceil(groups.length / size);
  let tick = Date.now();
  const clock = () => new Date(tick++).toISOString();
  const totals = {};
  let processed = 0;
  try {
    for (let index = 0; index < groups.length; index += size) {
      const batch = groups.slice(index, index + size);
      const counters = await writeImportBatch(db, {
        groups: batch,
        rowsByLine,
        job,
        empresaId: fresh.rules.empresaId,
        operador: operatorName(actor),
        propriedadeId,
        clock,
      });
      for (const [key, value] of Object.entries(counters)) totals[key] = (totals[key] || 0) + value;
      processed += batch.length;
      onProgress?.({ lote: index / size + 1, lotes: totalBatches, animaisProcessados: processed, animaisTotal: groups.length, registrosCriados: totals.registros_criados });
    }
    await completeJob(db, job.id, { cadastros_mestres_criados: mastersCreated });
  } catch (error) {
    await failJob(db, job.id, error).catch(() => {});
    throw error;
  }
  return {
    importacaoId: job.id,
    status: JOB_STATUS.CONCLUIDA,
    retomada,
    linhasProcessadas: fresh.summary.linhasLidas,
    cadastrosCriados: totals.cadastros_criados || 0,
    manejosCriados: totals.manejos_criados || 0,
    saidasCriadas: totals.saidas_criadas || 0,
    animaisConciliados: totals.animais_conciliados || 0,
    animaisNovos: totals.animais_criados || 0,
    duplicidadesIgnoradas: fresh.summary.jaExistem + fresh.summary.duplicidades,
    erros: fresh.summary.erros,
    seriesRecalculadas: totals.series_recalculadas || 0,
    eventosRecalculados: totals.eventos_recalculados || 0,
    categoriasResolvidasAutomaticamente: totals.categorias_resolvidas_automaticamente || 0,
    cadastrosMestresCriados: mastersCreated,
    lotes: totalBatches,
    linhasGravadas: [...rowsByLine.keys()].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Histórico de jobs e modelos
// ---------------------------------------------------------------------------

/** Jobs da importação conciliada, do mais novo ao mais antigo (weighing.read). */
export async function listImportJobs({ limit = 50 } = {}, actor = null) {
  requireImportPermission(actor, 'weighing.read');
  const db = await storage.ensureReady();
  const rows = (await db.table('importacoes').toArray()).filter((row) => !row.deleted_at && row.origem === IMPORT_JOB_ORIGIN);
  return rows.sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || ''))).slice(0, limit);
}

export async function listImportTemplates(empresaId = DEFAULT_EMPRESA_ID) {
  return (await readTemplateStore(empresaId)).templates;
}

export async function saveImportTemplate(template, actor = null) {
  requireImportPermission(actor, permissionFor(template?.tipoImportacao));
  const empresaId = template?.empresaId || DEFAULT_EMPRESA_ID;
  const clean = sanitizeImportTemplate(template);
  const store = await readTemplateStore(empresaId);
  const index = store.templates.findIndex((item) => item.id === clean.id);
  if (index >= 0) store.templates[index] = clean;
  else store.templates.push(clean);
  await writeTemplateStore(empresaId, store);
  return clean;
}

export async function deleteImportTemplate(id, actor = null, { empresaId = DEFAULT_EMPRESA_ID } = {}) {
  const store = await readTemplateStore(empresaId);
  const target = store.templates.find((item) => item.id === id);
  requireImportPermission(actor, permissionFor(target?.tipoImportacao));
  if (!target) return false;
  store.templates = store.templates.filter((item) => item.id !== id);
  await writeTemplateStore(empresaId, store);
  return true;
}
