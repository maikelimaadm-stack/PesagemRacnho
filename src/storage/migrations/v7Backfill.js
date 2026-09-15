// Backfill resumível v6 → v7 (docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md §5,
// 14-MIGRACOES.md §3-§5; ADR-018, ADR-021, ADR-022, ADR-028, ADR-038).
//
// Passos B1..B12. Cada passo é idempotente (só grava o que falta); os passos
// pesados (B7 animais, B8 identificadores, B10 payload) andam em lotes de 500
// por cursor de localId com checkpoint em appSettings['migration:v7'] gravado
// na MESMA transação do lote. Fechar o app no meio e reabrir continua do
// checkpoint sem duplicar nada.
import { ANIMAL_SITUACOES, IDENTIFICADOR_TIPOS, SESSAO_STATUS, STORE_NAMES } from '../indexedDb/schema.js';
import { civilDateFromIso, estimateBirth, normalizeName, normalizeSessionStatus, situacaoFromExitReason } from '../indexedDb/normalize.js';
import { LEGACY_PAYLOAD_FORBIDDEN } from '../../modules/weighing/domain/weighingMapper.js';
import { logicalIntegrity } from '../indexedDb/health/health.js';
import {
  MIGRATION_STATUS,
  MigrationError,
  emptyMigrationState,
  readMigrationState,
  writeMigrationState,
} from './migrationState.js';

export { estimateBirth };

export const V7_VERSION = 7;
export const BATCH_SIZE = 500;
export const V7_STEPS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'];
export const PROPRIEDADE_PADRAO_NOME = 'Propriedade principal';
export const RACA_PADRAO_NOME = 'Nelore';
// Seed fixo (docs 12 §3.1); ids sempre gerados. Sexo aplicável decorre do nome;
// faixas etárias ficam nulas (não inventar regra de idade na migração).
export const SEED_CATEGORIAS = Object.freeze([
  { nome: 'Bezerro', sexo_aplicavel: 'M' },
  { nome: 'Bezerra', sexo_aplicavel: 'F' },
  { nome: 'Garrote', sexo_aplicavel: 'M' },
  { nome: 'Novilha', sexo_aplicavel: 'F' },
  { nome: 'Boi', sexo_aplicavel: 'M' },
  { nome: 'Vaca', sexo_aplicavel: 'F' },
  { nome: 'Touro', sexo_aplicavel: 'M' },
]);
export const LEGACY_SETTING_PATTERNS = Object.freeze([/^cadastros-auxiliares:/, /^perfis-saida:/]);
const SANIDADE_PATTERN = /^cadastros-auxiliares:sanidade:/;
const MORTALIDADE_PATTERN = /^cadastros-auxiliares:mortalidade:/;
const COMERCIAIS_PATTERN = /^cadastros-auxiliares:comerciais:/;
const PERFIS_SAIDA_PATTERN = /^perfis-saida:/;
const EMPRESA_ID = 'local';
const BUCKET_PAPEL = { compradores: 'COMPRADOR', vendedores: 'VENDEDOR', frigorificos: 'FRIGORIFICO' };

const nowIso = () => new Date().toISOString();
const trimText = (value) => String(value ?? '').trim();
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

function baseRecord(ts, extra) {
  return { id: crypto.randomUUID(), empresa_id: EMPRESA_ID, ativo: true, created_at: ts, updated_at: ts, deleted_at: null, ...extra };
}

export function payloadObject(row) {
  const raw = row?.legacy_payload;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Situação legada ("Ativo"/"Inativo"/texto livre) → enum v7. Devolve { situacao, semMotivo }. */
export function normalizeAnimalSituacao(row) {
  const current = trimText(row.situacao);
  if (ANIMAL_SITUACOES.includes(current)) return { situacao: current, semMotivo: false };
  const upper = current.toLocaleUpperCase('pt-BR');
  const saiu = upper === 'INATIVO' || Boolean(row.data_saida) || Boolean(trimText(row.motivo_saida));
  if (!saiu) return { situacao: 'ATIVO', semMotivo: false };
  const situacao = situacaoFromExitReason(row.motivo_saida);
  return { situacao, semMotivo: situacao === 'INATIVO' };
}

async function activeRows(db, storeName) {
  return (await db.table(storeName).toArray()).filter((row) => !row.deleted_at);
}

async function legacySettings(db, pattern) {
  return (await db.table('appSettings').toArray()).filter((row) => pattern.test(String(row.key)));
}

// ---------------------------------------------------------------------------
// B1 — marcas (ADR-021)
// ---------------------------------------------------------------------------
async function collectBrandTexts(db) {
  const raws = new Map();
  const add = (value) => {
    const text = trimText(value);
    if (text) raws.set(text, (raws.get(text) || 0) + 1);
  };
  await db.table('animais').each((row) => add(row.marca));
  await db.table('animalIdentificadores').each((row) => add(row.marca));
  await db.table('pesagens').each((row) => add(payloadObject(row)?.marca));
  return raws;
}

function groupByNormalized(raws) {
  const groups = new Map();
  for (const [raw, count] of raws) {
    const norm = normalizeName(raw);
    const group = groups.get(norm) || { nome_normalizado: norm, grafias: [], contagem: new Map() };
    group.grafias.push(raw);
    group.contagem.set(raw, count);
    groups.set(norm, group);
  }
  return groups;
}

// Colisão: fundir as grafias de um grupo faria dois animais DISTINTOS terem o
// mesmo (marca_id, número). Só grupos com mais de uma grafia podem colidir.
async function detectBrandCollisions(db, groups) {
  const candidates = new Set([...groups.values()].filter((g) => g.grafias.length > 1).map((g) => g.nome_normalizado));
  const collisions = new Map();
  if (!candidates.size) return collisions;
  const perGroup = new Map();
  await db.table('animais').each((animal) => {
    if (animal.deleted_at) return;
    const raw = trimText(animal.marca);
    const norm = normalizeName(raw);
    if (!candidates.has(norm)) return;
    const numero = trimText(animal.identificacao_normalizada) || normalizeName(animal.numero_animal);
    if (!numero) return;
    const byNumero = perGroup.get(norm) || new Map();
    const byRaw = byNumero.get(numero) || new Map();
    const ids = byRaw.get(raw) || new Set();
    ids.add(animal.id);
    byRaw.set(raw, ids);
    byNumero.set(numero, byRaw);
    perGroup.set(norm, byNumero);
  });
  for (const [norm, byNumero] of perGroup) {
    const numeros = [];
    for (const [numero, byRaw] of byNumero) {
      if (byRaw.size > 1) {
        numeros.push({ numero, grafias: [...byRaw.entries()].map(([grafia, ids]) => ({ grafia, animais: [...ids] })) });
      }
    }
    if (numeros.length) collisions.set(norm, numeros);
  }
  return collisions;
}

export async function planMarcas(db) {
  const raws = await collectBrandTexts(db);
  const groups = groupByNormalized(raws);
  const collisions = await detectBrandCollisions(db, groups);
  const existing = await activeRows(db, 'marcas');
  const existingByNorm = new Map();
  for (const marca of existing) if (!existingByNorm.has(marca.nome_normalizado)) existingByNorm.set(marca.nome_normalizado, marca);
  const items = [];
  for (const group of groups.values()) {
    const uso = (raw) => group.contagem.get(raw) || 0;
    if (collisions.has(group.nome_normalizado)) {
      for (const raw of group.grafias) {
        items.push({ nome: raw, nome_normalizado: raw, grafias: [raw], uso: uso(raw), colisao: true, existenteId: existingByNorm.get(raw)?.id || null });
      }
    } else {
      const nome = [...group.grafias].sort((a, b) => uso(b) - uso(a) || a.localeCompare(b))[0];
      const total = group.grafias.reduce((sum, raw) => sum + uso(raw), 0);
      items.push({ nome, nome_normalizado: group.nome_normalizado, grafias: group.grafias, uso: total, colisao: false, existenteId: existingByNorm.get(group.nome_normalizado)?.id || null });
    }
  }
  const colisoes = [...collisions.entries()].map(([norm, numeros]) => ({
    nome_normalizado: norm,
    grafias: groups.get(norm).grafias,
    numeros,
  }));
  return { items, novas: items.filter((item) => !item.existenteId).length, existentes: existing.length, colisoes };
}

/** Resolvedor texto → marca_id a partir da store (grafias em colisão casam pelo texto bruto). */
export async function buildBrandResolver(db) {
  const marcas = await activeRows(db, 'marcas');
  const byRaw = new Map();
  const byNorm = new Map();
  for (const marca of marcas) {
    const nome = trimText(marca.nome);
    if (nome && !byRaw.has(nome)) byRaw.set(nome, marca.id);
    if (marca.nome_normalizado === normalizeName(nome) && !byNorm.has(marca.nome_normalizado)) byNorm.set(marca.nome_normalizado, marca.id);
  }
  return (text) => {
    const raw = trimText(text);
    if (!raw) return null;
    return byRaw.get(raw) ?? byNorm.get(normalizeName(raw)) ?? null;
  };
}

async function runB1(ctx) {
  const plan = await planMarcas(ctx.db);
  const ts = nowIso();
  const hasPadrao = (await activeRows(ctx.db, 'marcas')).some((row) => row.padrao === true);
  const novas = plan.items.filter((item) => !item.existenteId);
  const maisUsada = [...plan.items].sort((a, b) => b.uso - a.uso)[0] || null;
  const records = novas.map((item) => baseRecord(ts, {
    nome: item.nome,
    nome_normalizado: item.nome_normalizado,
    abreviacao: null,
    proprietario_parceiro_id: null,
    propriedade_id: null,
    padrao: !hasPadrao && maisUsada && item.nome_normalizado === maisUsada.nome_normalizado,
    observacao: item.colisao ? 'Migração v7: grafia mantida separada por colisão de números (ADR-021)' : null,
  }));
  if (records.length) await ctx.db.table('marcas').bulkAdd(records);
  ctx.report.marcas += records.length;
  ctx.report.colisoesMarca = plan.colisoes;
}

// ---------------------------------------------------------------------------
// B2 — raças
// ---------------------------------------------------------------------------
export async function planRacas(db) {
  const raws = new Map();
  const add = (value) => { const text = trimText(value); if (text) raws.set(text, (raws.get(text) || 0) + 1); };
  await db.table('animais').each((row) => add(row.raca));
  await db.table('pesagens').each((row) => add(payloadObject(row)?.raca));
  add(RACA_PADRAO_NOME);
  const groups = groupByNormalized(raws);
  const existing = await activeRows(db, 'racas');
  const existingNorm = new Set(existing.map((row) => row.nome_normalizado));
  const items = [...groups.values()].map((group) => ({
    nome: [...group.grafias].sort((a, b) => (group.contagem.get(b) || 0) - (group.contagem.get(a) || 0) || a.localeCompare(b))[0],
    nome_normalizado: group.nome_normalizado,
    grafias: group.grafias,
    existente: existingNorm.has(group.nome_normalizado),
  }));
  return { items, novas: items.filter((item) => !item.existente).length, existentes: existing.length };
}

async function runB2(ctx) {
  const plan = await planRacas(ctx.db);
  const ts = nowIso();
  const hasPadrao = (await activeRows(ctx.db, 'racas')).some((row) => row.padrao === true);
  const records = plan.items.filter((item) => !item.existente).map((item, index) => baseRecord(ts, {
    nome: item.nome_normalizado === normalizeName(RACA_PADRAO_NOME) ? RACA_PADRAO_NOME : item.nome,
    nome_normalizado: item.nome_normalizado,
    abreviacao: null,
    grupo: null,
    padrao: !hasPadrao && item.nome_normalizado === normalizeName(RACA_PADRAO_NOME),
    ordem: index + 1,
  }));
  if (records.length) await ctx.db.table('racas').bulkAdd(records);
  ctx.report.racas += records.length;
}

// ---------------------------------------------------------------------------
// B3 — categorias (seed)
// ---------------------------------------------------------------------------
async function missingCategorias(db) {
  const existing = new Set((await activeRows(db, 'categoriasAnimal')).map((row) => row.nome_normalizado));
  return SEED_CATEGORIAS.map((seed, index) => ({ ...seed, ordem: index + 1 })).filter((seed) => !existing.has(normalizeName(seed.nome)));
}

async function runB3(ctx) {
  const ts = nowIso();
  const records = (await missingCategorias(ctx.db)).map((seed) => baseRecord(ts, {
    nome: seed.nome,
    nome_normalizado: normalizeName(seed.nome),
    sexo_aplicavel: seed.sexo_aplicavel,
    idade_min_meses: null,
    idade_max_meses: null,
    ordem: seed.ordem,
  }));
  if (records.length) await ctx.db.table('categoriasAnimal').bulkAdd(records);
  ctx.report.categorias += records.length;
}

// ---------------------------------------------------------------------------
// B4 — causas de morte (ids preservados)
// ---------------------------------------------------------------------------
export async function planCausas(db) {
  const origem = [];
  for (const row of await legacySettings(db, MORTALIDADE_PATTERN)) {
    for (const record of Array.isArray(row.value?.causasMorte) ? row.value.causasMorte : []) {
      if (trimText(record?.nome)) origem.push({ ...record, chave: row.key });
    }
  }
  const existing = await activeRows(db, 'causasMorte');
  const byId = new Set(existing.map((row) => row.id));
  const byNorm = new Set(existing.map((row) => row.nome_normalizado));
  const seen = new Set();
  const novas = [];
  for (const record of origem) {
    const norm = normalizeName(record.nome);
    if (byNorm.has(norm) || (record.id && byId.has(record.id)) || seen.has(norm)) continue;
    seen.add(norm);
    novas.push(record);
  }
  return { origem, novas, existentes: existing.length };
}

async function runB4(ctx) {
  const plan = await planCausas(ctx.db);
  const ts = nowIso();
  const records = plan.novas.map((record, index) => baseRecord(ts, {
    id: record.id || crypto.randomUUID(),
    nome: trimText(record.nome),
    nome_normalizado: normalizeName(record.nome),
    categoria: record.categoria || null,
    descricao: record.descricao || null,
    exige_observacao: Boolean(record.exigeObservacao ?? record.exige_observacao),
    ativo: record.ativo !== false,
    ordem: index + 1,
  }));
  if (records.length) await ctx.db.table('causasMorte').bulkAdd(records);
  ctx.report.causasMorte += records.length;
}

// ---------------------------------------------------------------------------
// B5 — parceiros (união por documento ou nome normalizado; papéis consolidados)
// ---------------------------------------------------------------------------
function partnerKey(record) {
  const documento = digitsOnly(record.documento);
  return documento.length >= 11 ? `doc:${documento}` : `nome:${normalizeName(record.nome)}`;
}

export async function planParceiros(db) {
  const origem = [];
  for (const row of await legacySettings(db, COMERCIAIS_PATTERN)) {
    for (const [bucket, papel] of Object.entries(BUCKET_PAPEL)) {
      for (const record of Array.isArray(row.value?.[bucket]) ? row.value[bucket] : []) {
        if (trimText(record?.nome)) origem.push({ ...record, papel, chave: row.key, bucket });
      }
    }
  }
  for (const row of await legacySettings(db, PERFIS_SAIDA_PATTERN)) {
    for (const record of Array.isArray(row.value?.compradores) ? row.value.compradores : []) {
      if (trimText(record?.nome)) origem.push({ ...record, papel: 'COMPRADOR', chave: row.key, bucket: 'perfis-saida.compradores' });
    }
  }
  // União por id legado, documento ou nome normalizado; o primeiro registro visto
  // define o id (registry antes de perfis-saida, que repete os mesmos ids).
  const merged = new Map();
  const groupById = new Map();
  for (const record of origem) {
    const key = partnerKey(record);
    const current = (record.id && groupById.get(record.id)) || merged.get(key) || { key, ids: [], papeis: new Set(), registros: [] };
    if (record.id && !current.ids.includes(record.id)) current.ids.push(record.id);
    current.papeis.add(record.papel);
    current.registros.push(record);
    merged.set(current.key, current);
    if (!merged.has(key)) merged.set(key, current);
    for (const id of current.ids) groupById.set(id, current);
  }
  const grupos = [...new Set(merged.values())];
  const existing = await activeRows(db, 'parceiros');
  const existingByKey = new Map(existing.map((row) => [partnerKey(row), row]));
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const novos = [];
  const atualizarPapeis = [];
  for (const group of grupos) {
    const found = existingByKey.get(group.key) || group.ids.map((id) => existingById.get(id)).find(Boolean);
    if (found) {
      const faltantes = [...group.papeis].filter((papel) => !(found.papeis || []).includes(papel));
      if (faltantes.length) atualizarPapeis.push({ localId: found.localId, papeis: [...(found.papeis || []), ...faltantes] });
      continue;
    }
    novos.push(group);
  }
  return { origem, grupos, novos, atualizarPapeis, existentes: existing.length };
}

function buildParceiro(group, ts) {
  const base = group.registros[0];
  const pick = (field) => group.registros.map((record) => trimText(record[field])).find(Boolean) || null;
  const documento = digitsOnly(pick('documento')) || null;
  const tipoPessoa = documento?.length === 11 ? 'FISICA' : documento?.length === 14 ? 'JURIDICA' : null;
  const usedId = group.ids[0] || crypto.randomUUID();
  return baseRecord(ts, {
    id: usedId,
    nome: trimText(base.nome),
    nome_normalizado: normalizeName(base.nome),
    tipo_pessoa: tipoPessoa,
    documento,
    papeis: [...group.papeis],
    telefone: pick('telefone'),
    email: pick('email'),
    cidade: pick('cidade'),
    uf: pick('uf'),
    registro_sif: pick('sif') || pick('registro_sif'),
    // Rendimento nunca é assumido silenciosamente (ADR-025).
    rendimento_padrao: null,
    observacao: pick('observacoes') || pick('observacao'),
    ativo: group.registros.every((record) => record.ativo !== false),
    ids_legados: group.ids.slice(1),
  });
}

async function runB5(ctx) {
  const plan = await planParceiros(ctx.db);
  const ts = nowIso();
  const records = plan.novos.map((group) => buildParceiro(group, ts));
  if (records.length) await ctx.db.table('parceiros').bulkAdd(records);
  for (const patch of plan.atualizarPapeis) await ctx.db.table('parceiros').update(patch.localId, { papeis: patch.papeis, updated_at: ts });
  ctx.report.parceiros += records.length;
}

// ---------------------------------------------------------------------------
// B6 — propriedades (uma PROPRIA padrão; vendedores com texto → TERCEIRO)
// ---------------------------------------------------------------------------
export async function planPropriedades(db) {
  const existing = await activeRows(db, 'propriedades');
  const hasPropria = existing.some((row) => row.tipo === 'PROPRIA');
  const parceiros = await activeRows(db, 'parceiros');
  const parceiroByKey = new Map(parceiros.map((row) => [partnerKey(row), row]));
  const parceiroById = new Map(parceiros.map((row) => [row.id, row]));
  const terceiros = new Map();
  for (const row of await legacySettings(db, COMERCIAIS_PATTERN)) {
    for (const record of Array.isArray(row.value?.vendedores) ? row.value.vendedores : []) {
      const nome = trimText(record?.propriedade);
      if (!nome || !trimText(record?.nome)) continue;
      const parceiro = parceiroById.get(record.id) || parceiroByKey.get(partnerKey(record)) || null;
      const key = `${normalizeName(nome)}::${parceiro?.id || ''}`;
      if (!terceiros.has(key)) terceiros.set(key, { nome, nome_normalizado: normalizeName(nome), parceiro_id: parceiro?.id || null });
    }
  }
  const existingKeys = new Set(existing.map((row) => `${row.nome_normalizado}::${row.parceiro_id || ''}`));
  const novasTerceiro = [...terceiros.entries()].filter(([key]) => !existingKeys.has(key)).map(([, value]) => value);
  return { criarPropria: !hasPropria, novasTerceiro, existentes: existing.length };
}

async function runB6(ctx) {
  const plan = await planPropriedades(ctx.db);
  const ts = nowIso();
  const records = [];
  if (plan.criarPropria) {
    records.push(baseRecord(ts, {
      nome: PROPRIEDADE_PADRAO_NOME,
      nome_normalizado: normalizeName(PROPRIEDADE_PADRAO_NOME),
      tipo: 'PROPRIA',
      parceiro_id: null,
      municipio: null,
      uf: null,
      codigo_oficial: null,
      padrao: true,
    }));
  }
  for (const item of plan.novasTerceiro) {
    records.push(baseRecord(ts, { ...item, tipo: 'TERCEIRO', municipio: null, uf: null, codigo_oficial: null, padrao: false }));
  }
  if (records.length) await ctx.db.table('propriedades').bulkAdd(records);
  ctx.report.propriedades += records.length;
}

// ---------------------------------------------------------------------------
// Passos por cursor (B7, B8, B10)
// ---------------------------------------------------------------------------
async function runCursorStep(ctx, step, storeName, prepare) {
  const table = ctx.db.table(storeName);
  const transform = await prepare(ctx);
  let cursor = ctx.state.passo === step && Number.isFinite(ctx.state.cursor) ? ctx.state.cursor : 0;
  for (;;) {
    if (ctx.budget.used >= ctx.budget.max) return { done: false };
    const rows = await table.where('localId').above(cursor).limit(BATCH_SIZE).toArray();
    if (!rows.length) break;
    const changedRows = { count: 0 };
    await ctx.db.transaction('rw', table, ctx.db.table('appSettings'), async () => {
      for (const row of rows) {
        const changes = transform(row, changedRows);
        if (changes) {
          await table.update(row.localId, changes);
          changedRows.count += 1;
        }
      }
      cursor = rows[rows.length - 1].localId;
      ctx.state = await writeMigrationState(ctx.db, V7_VERSION, {
        status: MIGRATION_STATUS.EM_ANDAMENTO,
        passo: step,
        cursor,
        last_checkpoint: `${step}:localId=${cursor}`,
        processed: (ctx.state.processed || 0) + rows.length,
        relatorio: ctx.report,
      });
    });
    ctx.budget.used += 1;
    ctx.progress(step, `${storeName}: ${rows.length} registros processados (lote até localId ${cursor})`);
    if (rows.length < BATCH_SIZE) break;
  }
  return { done: true };
}

async function prepareB7(ctx) {
  const resolveMarca = await buildBrandResolver(ctx.db);
  const racas = await activeRows(ctx.db, 'racas');
  const racaByNorm = new Map(racas.map((row) => [row.nome_normalizado, row.id]));
  const propriedadePadrao = (await activeRows(ctx.db, 'propriedades')).find((row) => row.tipo === 'PROPRIA' && row.padrao) || null;
  return (row, counters) => {
    const changes = {};
    if (row.marca_id == null) {
      const marcaId = resolveMarca(row.marca);
      if (marcaId) changes.marca_id = marcaId;
    }
    if (row.raca_id == null) {
      const racaId = racaByNorm.get(normalizeName(row.raca));
      if (racaId) changes.raca_id = racaId;
    }
    if (row.categoria_id === undefined) changes.categoria_id = null;
    if (row.propriedade_id == null && propriedadePadrao) changes.propriedade_id = propriedadePadrao.id;
    const { situacao, semMotivo } = normalizeAnimalSituacao(row);
    if (row.situacao !== situacao) {
      changes.situacao = situacao;
      if (semMotivo) ctx.report.saidasSemMotivo += 1;
    }
    if (row.nascimento === undefined || row.nascimento === null) {
      const estimated = row.nascimento ? null : estimateBirth(civilDateFromIso(row.created_at) || row.ultima_pesagem_data, row.era);
      if (estimated) {
        changes.nascimento = estimated;
        changes.nascimento_estimado = true;
      } else if (row.nascimento === undefined) {
        changes.nascimento = null;
        changes.nascimento_estimado = false;
      }
    }
    if (!Object.keys(changes).length) return null;
    changes.updated_at = nowIso();
    ctx.report.animaisAtualizados += 1;
    return changes;
  };
}

function identifierNeedsBackfill(row) {
  if (!IDENTIFICADOR_TIPOS.includes(row.tipo)) return true;
  if (row.tipo === 'VISUAL' && (row.marca_id == null || String(row.valor_normalizado || '').includes('::'))) return true;
  return false;
}

async function prepareB8(ctx) {
  const resolveMarca = await buildBrandResolver(ctx.db);
  const animalMarca = new Map();
  await ctx.db.table('animais').each((row) => { if (row.marca_id) animalMarca.set(row.id, row.marca_id); });
  return (row) => {
    if (!identifierNeedsBackfill(row)) return null;
    const changes = { tipo: row.tipo === 'visual_marca' || !IDENTIFICADOR_TIPOS.includes(row.tipo) ? 'VISUAL' : row.tipo };
    const parts = String(row.valor_normalizado ?? '').split('::');
    const numero = normalizeName(parts[0] || row.valor);
    if (row.valor_normalizado !== numero) changes.valor_normalizado = numero;
    const marcaTexto = trimText(row.marca) || trimText(parts[1]);
    const marcaId = row.marca_id ?? resolveMarca(marcaTexto) ?? animalMarca.get(row.animal_id) ?? null;
    if (marcaId) changes.marca_id = marcaId;
    if (row.faixa_id === undefined) changes.faixa_id = null;
    if (!row.inicio) changes.inicio = civilDateFromIso(row.created_at);
    if (row.fim === undefined) changes.fim = null;
    if (row.motivo_troca === undefined) changes.motivo_troca = null;
    changes.updated_at = nowIso();
    ctx.report.identificadores += 1;
    return changes;
  };
}

function stripForbiddenKeys(payload) {
  let changed = false;
  for (const key of LEGACY_PAYLOAD_FORBIDDEN) {
    if (key in payload) { delete payload[key]; changed = true; }
  }
  return changed;
}

async function prepareB10() {
  return (row) => {
    const raw = row.legacy_payload;
    if (!raw) return null;
    if (typeof raw === 'object') {
      const copy = { ...raw };
      if (!stripForbiddenKeys(copy)) return null;
      return { legacy_payload: copy, updated_at: nowIso() };
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !stripForbiddenKeys(parsed)) return null;
        return { legacy_payload: parsed, updated_at: nowIso() };
      } catch {
        return null; // snapshot ilegível permanece intacto (o mapper já o ignora)
      }
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// B9 — enums de sessões, lotes e apartações
// ---------------------------------------------------------------------------
function loteNeedsBackfill(row) {
  return !row.situacao || row.ativo === undefined || row.codigo === undefined || row.categoria_id === undefined || row.ordem === undefined;
}

async function runB9(ctx) {
  const ts = nowIso();
  let sessoes = 0;
  let lotes = 0;
  let apartacoes = 0;
  await ctx.db.transaction('rw', ctx.db.table('sessoesPesagem'), ctx.db.table('loteApartacoes'), ctx.db.table('apartacoes'), async () => {
    await ctx.db.table('sessoesPesagem').toCollection().modify((row) => {
      const status = normalizeSessionStatus(row.status);
      const needs = row.status !== status || row.local === undefined || row.operador_user_id === undefined;
      if (!needs) return;
      row.status = SESSAO_STATUS.includes(status) ? status : row.status;
      if (row.local === undefined) row.local = null;
      if (row.operador_user_id === undefined) row.operador_user_id = null;
      if (row.marca_padrao_id === undefined) row.marca_padrao_id = null;
      if (row.apartacao_padrao_id === undefined) row.apartacao_padrao_id = null;
      if (row.tipo_manejo_padrao === undefined) row.tipo_manejo_padrao = null;
      if (row.snapshot === undefined) row.snapshot = null;
      if (row.motivo_reabertura === undefined) row.motivo_reabertura = null;
      row.updated_at = ts;
      sessoes += 1;
    });
    await ctx.db.table('loteApartacoes').toCollection().modify((row) => {
      if (!loteNeedsBackfill(row)) return;
      if (!row.situacao) row.situacao = row.fechado ? 'FECHADO' : 'ABERTO';
      if (row.ativo === undefined) row.ativo = true;
      if (row.codigo === undefined) row.codigo = null;
      if (row.categoria_id === undefined) row.categoria_id = null;
      if (row.data_abertura === undefined) row.data_abertura = civilDateFromIso(row.created_at);
      if (row.data_fechamento === undefined) row.data_fechamento = null;
      if (row.ordem === undefined) row.ordem = null;
      row.updated_at = ts;
      lotes += 1;
    });
    await ctx.db.table('apartacoes').toCollection().modify((row) => {
      if (row.ativo !== undefined && row.ordem !== undefined) return;
      if (row.ativo === undefined) row.ativo = true;
      if (row.ordem === undefined) row.ordem = null;
      if (row.observacao === undefined) row.observacao = null;
      row.updated_at = ts;
      apartacoes += 1;
    });
  });
  ctx.report.sessoes += sessoes;
  ctx.report.lotes += lotes;
  ctx.report.apartacoes += apartacoes;
}

// ---------------------------------------------------------------------------
// B11 — limpeza das chaves legadas (após validação; sanidade exportada antes)
// ---------------------------------------------------------------------------
export async function planSanidade(db) {
  const rows = await legacySettings(db, SANIDADE_PATTERN);
  const registros = rows.reduce((sum, row) => sum + Object.values(row.value || {}).reduce((inner, list) => inner + (Array.isArray(list) ? list.length : 0), 0), 0);
  return { chaves: rows.map((row) => row.key), registros, valores: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

async function exportSanidade(ctx, plan) {
  if (!plan.registros) return { exportado: false, registros: 0, chaves: plan.chaves };
  const files = ctx.files;
  if (!files || typeof files.writeUserFile !== 'function') {
    return { exportado: false, registros: plan.registros, chaves: plan.chaves, motivo: 'SEM_PORTA_DE_ARQUIVOS' };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sanidade-export-${stamp}.json`;
  const content = JSON.stringify({ exportadoEm: new Date().toISOString(), motivo: 'ADR-022 — sanidade retirada do produto', chaves: plan.valores }, null, 2);
  const res = await files.writeUserFile({ subdir: 'exports', filename, content });
  const saved = res?.data ?? res;
  if (res?.ok === false || !saved?.path) {
    throw new MigrationError('MIGRATION_SANIDADE_EXPORT_FAILED', 'Não foi possível exportar os dados de sanidade antes da remoção (ADR-022).');
  }
  return { exportado: true, registros: plan.registros, chaves: plan.chaves, path: saved.path, sha256: saved.sha256 || null, size: saved.size ?? null };
}

async function validateLegacyMigration(db) {
  const causas = await planCausas(db);
  const parceiros = await planParceiros(db);
  const problems = [];
  if (causas.novas.length) problems.push(`causas de morte não migradas: ${causas.novas.length}`);
  if (parceiros.novos.length) problems.push(`parceiros não migrados: ${parceiros.novos.length}`);
  if (problems.length) {
    throw new MigrationError('MIGRATION_VALIDATION_FAILED', `Validação antes da limpeza falhou (${problems.join('; ')}).`);
  }
}

async function runB11(ctx) {
  await validateLegacyMigration(ctx.db);
  const sanidade = await planSanidade(ctx.db);
  const sanidadeResult = await exportSanidade(ctx, sanidade);
  ctx.report.sanidade = sanidadeResult;
  const keepSanidade = sanidade.registros > 0 && !sanidadeResult.exportado;
  const legacyKeys = (await ctx.db.table('appSettings').toArray())
    .map((row) => String(row.key))
    .filter((key) => LEGACY_SETTING_PATTERNS.some((pattern) => pattern.test(key)))
    .filter((key) => !(keepSanidade && SANIDADE_PATTERN.test(key)));
  if (legacyKeys.length) await ctx.db.table('appSettings').bulkDelete(legacyKeys);
  ctx.report.chavesLegadasRemovidas = [...new Set([...(ctx.report.chavesLegadasRemovidas || []), ...legacyKeys])];
}

// ---------------------------------------------------------------------------
// B12 — verificação
// ---------------------------------------------------------------------------
async function runB12(ctx) {
  const contagens = {};
  for (const name of STORE_NAMES) contagens[name] = await ctx.db.table(name).count();
  const integrity = await logicalIntegrity({ enforceV7: true });
  ctx.report.contagens = contagens;
  ctx.report.integridade = { ok: integrity.ok, total: integrity.issues.length, issues: integrity.issues.slice(0, 50) };
}

const STEP_RUNNERS = {
  B1: runB1,
  B2: runB2,
  B3: runB3,
  B4: runB4,
  B5: runB5,
  B6: runB6,
  B7: (ctx) => runCursorStep(ctx, 'B7', 'animais', prepareB7),
  B8: (ctx) => runCursorStep(ctx, 'B8', 'animalIdentificadores', prepareB8),
  B9: runB9,
  B10: (ctx) => runCursorStep(ctx, 'B10', 'pesagens', prepareB10),
  B11: runB11,
  B12: runB12,
};

async function countTotal(db) {
  return (await db.table('animais').count()) + (await db.table('animalIdentificadores').count()) + (await db.table('pesagens').count());
}

/**
 * Executa (ou continua) o backfill v7. Reentrante: lê appSettings['migration:v7']
 * e continua do checkpoint. `maxBatches` limita o trabalho por chamada (usado
 * pelos gates para interromper no meio); `hooks.beforeStep` permite injetar
 * falhas nos testes. Devolve { completed, state, alreadyDone }.
 */
export async function runV7Backfill(db, { onProgress, maxBatches = Infinity, files = null, hooks = null, origem = null } = {}) {
  let state = (await readMigrationState(db, V7_VERSION)) || emptyMigrationState(V7_VERSION, { origem });
  if (state.status === MIGRATION_STATUS.CONCLUIDA) return { completed: true, state, alreadyDone: true };
  state = await writeMigrationState(db, V7_VERSION, {
    ...state,
    status: MIGRATION_STATUS.EM_ANDAMENTO,
    origem: state.origem || origem,
    started_at: state.started_at || nowIso(),
    total: state.total || await countTotal(db),
    error: null,
    passos_concluidos: Array.isArray(state.passos_concluidos) ? state.passos_concluidos : [],
    relatorio: { ...emptyMigrationStateReportFallback(), ...(state.relatorio || {}) },
  });
  const ctx = {
    db,
    state,
    report: state.relatorio,
    files,
    budget: { max: maxBatches, used: 0 },
    progress(passo, message) {
      onProgress?.({ versao: V7_VERSION, passo, processed: ctx.state.processed, total: ctx.state.total, message });
    },
  };
  let currentStep = null;
  try {
    for (const step of V7_STEPS) {
      if (ctx.state.passos_concluidos.includes(step)) continue;
      if (ctx.budget.used >= ctx.budget.max) return { completed: false, state: ctx.state, alreadyDone: false };
      currentStep = step;
      hooks?.beforeStep?.(step, ctx.state);
      ctx.progress(step, `Iniciando ${step}`);
      const result = await STEP_RUNNERS[step](ctx);
      if (result && result.done === false) return { completed: false, state: ctx.state, alreadyDone: false };
      if (!STEP_RUNNERS[step].length || !['B7', 'B8', 'B10'].includes(step)) ctx.budget.used += 1;
      ctx.state = await writeMigrationState(db, V7_VERSION, {
        status: MIGRATION_STATUS.EM_ANDAMENTO,
        passo: step,
        cursor: null,
        last_checkpoint: `${step}:done`,
        passos_concluidos: [...ctx.state.passos_concluidos, step],
        relatorio: ctx.report,
      });
    }
    ctx.state = await writeMigrationState(db, V7_VERSION, {
      status: MIGRATION_STATUS.CONCLUIDA,
      passo: null,
      cursor: null,
      last_checkpoint: 'B12:done',
      finished_at: nowIso(),
      processed: ctx.state.total,
      error: null,
      relatorio: ctx.report,
    });
    ctx.progress('B12', 'Migração v7 concluída');
    return { completed: true, state: ctx.state, alreadyDone: false };
  } catch (err) {
    const error = { code: err?.code || 'MIGRATION_STEP_FAILED', message: err?.message || String(err), passo: currentStep, at: nowIso() };
    try {
      ctx.state = await writeMigrationState(db, V7_VERSION, { status: MIGRATION_STATUS.FALHOU, error, relatorio: ctx.report });
    } catch { /* o estado em memória já reflete a falha */ }
    throw new MigrationError('MIGRATION_FAILED', `Migração v7 falhou no passo ${currentStep}: ${error.message}`, { cause: err, passo: currentStep, state: ctx.state });
  }
}

function emptyMigrationStateReportFallback() {
  return emptyMigrationState(V7_VERSION).relatorio;
}

/** Relatório do que o backfill faria, sem gravar (Manutenção e evidência). */
export async function dryRunV7(db) {
  const state = await readMigrationState(db, V7_VERSION);
  const [marcas, racas, categorias, causas, parceiros, propriedades, sanidade] = await Promise.all([
    planMarcas(db), planRacas(db), missingCategorias(db), planCausas(db), planParceiros(db), planPropriedades(db), planSanidade(db),
  ]);
  const animais = { total: 0, pendentes: 0, saidasSemMotivo: 0 };
  await db.table('animais').each((row) => {
    animais.total += 1;
    const { situacao, semMotivo } = normalizeAnimalSituacao(row);
    if (row.marca_id == null || row.situacao !== situacao) animais.pendentes += 1;
    if (semMotivo && row.situacao !== situacao) animais.saidasSemMotivo += 1;
  });
  const identificadores = { total: 0, pendentes: 0 };
  await db.table('animalIdentificadores').each((row) => {
    identificadores.total += 1;
    if (identifierNeedsBackfill(row)) identificadores.pendentes += 1;
  });
  const pesagens = { total: 0, payloadsPendentes: 0 };
  await db.table('pesagens').each((row) => {
    pesagens.total += 1;
    const payload = payloadObject(row);
    if (payload && LEGACY_PAYLOAD_FORBIDDEN.some((key) => key in payload)) pesagens.payloadsPendentes += 1;
  });
  const sessoes = { total: 0, pendentes: 0 };
  await db.table('sessoesPesagem').each((row) => { sessoes.total += 1; if (!SESSAO_STATUS.includes(row.status)) sessoes.pendentes += 1; });
  const lotes = { total: 0, pendentes: 0 };
  await db.table('loteApartacoes').each((row) => { lotes.total += 1; if (loteNeedsBackfill(row)) lotes.pendentes += 1; });
  const chavesLegadas = (await db.table('appSettings').toArray()).map((row) => String(row.key)).filter((key) => LEGACY_SETTING_PATTERNS.some((pattern) => pattern.test(key)));
  return {
    versao: V7_VERSION,
    status: state?.status || MIGRATION_STATUS.PENDENTE,
    pendente: state?.status !== MIGRATION_STATUS.CONCLUIDA,
    marcas: {
      novas: marcas.novas,
      existentes: marcas.existentes,
      grupos: marcas.items.map((item) => ({ nome: item.nome, grafias: item.grafias, colisao: item.colisao, existente: Boolean(item.existenteId) })),
      colisoes: marcas.colisoes,
    },
    racas: { novas: racas.novas, existentes: racas.existentes, nomes: racas.items.filter((item) => !item.existente).map((item) => item.nome) },
    categorias: { faltantes: categorias.map((seed) => seed.nome) },
    causasMorte: { origem: causas.origem.length, novas: causas.novas.length, existentes: causas.existentes },
    parceiros: { origem: parceiros.origem.length, novos: parceiros.novos.length, existentes: parceiros.existentes },
    propriedades: { criarPropria: propriedades.criarPropria, novasTerceiro: propriedades.novasTerceiro.length, existentes: propriedades.existentes },
    animais,
    identificadores,
    pesagens,
    sessoes,
    lotes,
    chavesLegadas,
    sanidade: { registros: sanidade.registros, chaves: sanidade.chaves },
    estado: state,
  };
}
