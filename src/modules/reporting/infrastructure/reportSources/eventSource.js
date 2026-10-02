// Fonte Dexie do grão EVENT. Com período, a consulta usa o índice `data_pesagem`
// (between inclusivo) — nunca `toArray()` da base inteira. Sem período (Relação de Pesagens,
// tela operacional) lê a store como a tela sempre fez. As entidades referenciadas (animais,
// sessões) são buscadas por `anyOf` nos índices; cadastros são stores pequenas.
import storage from '../../../../storage/storageAdapter.js';
import { buildAnimalIdentityIndex, buildEventLookups, enrichEventRows, storageRowToEventViewModel } from './eventRows.js';
import { readAppSetting } from '../../../../storage/indexedDb/repositories/index.js';
import { readByKeys } from './readByKeys.js';

const instrumentation = { lastQuery: null };

/** Última estratégia de consulta (gate reports:index-prefilter:verify e benchmarks). */
export function lastEventQuery() {
  return instrumentation.lastQuery;
}

async function activeByIds(table, ids) {
  return (await readByKeys(table, 'id', ids)).filter((row) => !row.deleted_at);
}

async function readAllActive(table) {
  return (await table.toArray()).filter((row) => !row.deleted_at);
}

export async function loadEventLookups(db, viewModels, { arrobaDivisor, gmdDiasMinimos } = {}) {
  const [marcas, racas, categorias, apartacoes, lotes, usuarios] = await Promise.all([
    readAllActive(db.table('marcas')),
    readAllActive(db.table('racas')),
    readAllActive(db.table('categoriasAnimal')),
    readAllActive(db.table('apartacoes')),
    readAllActive(db.table('loteApartacoes')),
    readAllActive(db.table('usuarios')),
  ]);
  // Identidade de legados só quando há evento sem animal_id (evita ler todos os animais à toa).
  const hasLegacy = viewModels.some((row) => !row.animal_id);
  const [sessoes, animais, allAnimals] = await Promise.all([
    activeByIds(db.table('sessoesPesagem'), viewModels.map((row) => row.sessao_id)),
    activeByIds(db.table('animais'), viewModels.map((row) => row.animal_id)),
    hasLegacy ? readAllActive(db.table('animais')) : [],
  ]);
  const animalIdentity = hasLegacy ? buildAnimalIdentityIndex(allAnimals, new Map(marcas.map((row) => [row.id, row.nome]))) : null;
  // Política de vendas (documento obrigatório) para as pendências; sem configuração, sem exigência.
  const salesPolicy = (await readAppSetting('sales-policy:local').catch(() => null)) || {};
  // Usuários: só id e nome saem daqui (buildEventLookups descarta o resto). Lotes: nome e faixa de
  // peso (peso_minimo/peso_maximo) da store já lida — nenhuma leitura nova.
  return buildEventLookups({ marcas, racas, categorias, apartacoes, lotes, sessoes, usuarios, animais: hasLegacy ? allAnimals : animais, salesPolicy, animalIdentity, arrobaDivisor, gmdDiasMinimos });
}

/**
 * @param {{ from?: string, to?: string, empresaId?: string, tipos?: string[], arrobaDivisor?: number, gmdDiasMinimos?: number }} params
 *   arrobaDivisor: divisor da @ de peso vivo (30 ou 15; padrão 30) gravado em cada linha (E1B).
 *   gmdDiasMinimos (M1): intervalo mínimo do GMD (7/14/21/28; padrão 21) — a qualidade derivada de cada GMD.
 * @returns {Promise<{ rows: object[], timings: { query: number, transform: number }, strategy: string, rowsRead: number, gmdDiasMinimos: number }>}
 */
export async function loadEventRows({ from, to, empresaId, tipos, arrobaDivisor, gmdDiasMinimos } = {}) {
  const db = await storage.ensureReady();
  const table = db.table('pesagens');
  const startedAt = performance.now();
  let strategy;
  let raw;
  if (from && to) {
    strategy = 'index:data_pesagem';
    raw = await table.where('data_pesagem').between(from, to, true, true).toArray();
  } else if (from) {
    strategy = 'index:data_pesagem';
    raw = await table.where('data_pesagem').aboveOrEqual(from).toArray();
  } else if (to) {
    strategy = 'index:data_pesagem';
    raw = await table.where('data_pesagem').belowOrEqual(to).toArray();
  } else {
    strategy = 'full-scan';
    raw = await table.toArray();
  }
  const queriedAt = performance.now();
  const viewModels = [];
  for (const row of raw) {
    if (row.deleted_at) continue;
    const viewModel = storageRowToEventViewModel(row);
    if (empresaId && viewModel.empresa_id !== empresaId) continue;
    if (tipos && !tipos.includes(viewModel.tipo_manejo)) continue;
    viewModels.push(viewModel);
  }
  const lookups = await loadEventLookups(db, viewModels, { arrobaDivisor, gmdDiasMinimos });
  const rows = enrichEventRows(viewModels, lookups);
  instrumentation.lastQuery = { strategy, from: from ?? null, to: to ?? null, rowsRead: raw.length, rowsOut: rows.length };
  return {
    rows,
    strategy,
    rowsRead: raw.length,
    timings: { query: queriedAt - startedAt, transform: performance.now() - queriedAt },
    // M1: o mínimo com que a qualidade do GMD foi derivada (o runReport confere com o resolvido).
    gmdDiasMinimos: lookups.gmdDiasMinimos,
  };
}
