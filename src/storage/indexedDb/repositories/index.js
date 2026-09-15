// Repositórios Dexie por entidade com uma interface CRUD comum.
import { createRepository } from './genericRepository.js';
import { ensureStorageReady } from '../db.js';
import { assertWritable } from '../../migrations/migrationState.js';
import { STORE_NAMES } from '../schema.js';

// Store de usuários locais: `usuarios` (docs 11 rev. 2) ou `usuariosLocais` (rev. 1) — quem decide é o schema.js.
export const USERS_STORE = STORE_NAMES.includes('usuarios') ? 'usuarios' : 'usuariosLocais';

function matchesWeighingFilters(row, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (['includeDeleted', 'limit', 'offset', 'orderBy', 'orderDirection'].includes(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (row[key] !== value) return false;
  }
  return true;
}

export const weighingRepository = createRepository('pesagens');
export const apartacaoRepository = createRepository('apartacoes');
export const loteApartacaoRepository = createRepository('loteApartacoes');
export const shipmentRepository = createRepository('embarques');
export const shipmentDocumentRepository = createRepository('documentosEmbarque');
export const animalRepository = createRepository('animais');
// v7 (ADR-023): a store `lotes` foi removida; `loteApartacaoRepository` é o repositório canônico de lote.
export const animalIdentifierRepository = createRepository('animalIdentificadores');
export const animalMovementRepository = createRepository('movimentosAnimais');
export const animalLotRepository = createRepository('animalLotes');
export const weighingSessionRepository = createRepository('sessoesPesagem');
export const auditRepository = createRepository('auditoria');
export const importRepository = createRepository('importacoes');
// v7 (ADR-018/ADR-019/ADR-035): cadastros mestres, estoque de identificadores e usuários locais.
export const marcaRepository = createRepository('marcas');
export const racaRepository = createRepository('racas');
export const categoriaAnimalRepository = createRepository('categoriasAnimal');
export const parceiroRepository = createRepository('parceiros');
export const propriedadeRepository = createRepository('propriedades');
export const causaMorteRepository = createRepository('causasMorte');
export const faixaIdentificadorRepository = createRepository('faixasIdentificadores');
export const excecaoIdentificadorRepository = createRepository('excecoesIdentificadores');
export const usuarioLocalRepository = createRepository(USERS_STORE);
export const usuarioRepository = usuarioLocalRepository;

// Consultas específicas de pesagens (data range + summary) sobre o repo genérico.
export const weighing = {
  ...weighingRepository,

  async listByPeriodo({ dataInicial, dataFinal, animalId, loteId, ...rest } = {}) {
    const db = await ensureStorageReady();
    const table = db.table('pesagens');
    let collection;

    // Evita table.toArray() nas consultas operacionais mais frequentes. A
    // pesquisa do animal e a troca para o campo Peso deixam de percorrer a
    // base inteira quando já há animal, período ou lote definidos.
    if (animalId && dataInicial && dataFinal) {
      collection = table.where('[animal_id+data_pesagem]').between(
        [animalId, dataInicial],
        [animalId, dataFinal],
        true,
        true,
      );
    } else if (animalId) {
      collection = table.where('animal_id').equals(animalId);
    } else if (dataInicial && dataFinal) {
      collection = table.where('data_pesagem').between(dataInicial, dataFinal, true, true);
    } else if (dataInicial) {
      collection = table.where('data_pesagem').aboveOrEqual(dataInicial);
    } else if (dataFinal) {
      collection = table.where('data_pesagem').belowOrEqual(dataFinal);
    } else if (loteId) {
      collection = table.where('lote_id').equals(loteId);
    }

    let rows = collection ? await collection.toArray() : await table.toArray();
    if (!rest.includeDeleted) rows = rows.filter((row) => !row.deleted_at);
    rows = rows.filter((row) => {
      if (animalId && row.animal_id !== animalId) return false;
      if (loteId && row.lote_id !== loteId) return false;
      if (dataInicial && row.data_pesagem < dataInicial) return false;
      if (dataFinal && row.data_pesagem > dataFinal) return false;
      return matchesWeighingFilters(row, rest);
    });
    if (rest.orderBy) {
      const direction = rest.orderDirection === 'desc' ? -1 : 1;
      rows.sort((left, right) => direction * String(left[rest.orderBy] ?? '').localeCompare(String(right[rest.orderBy] ?? '')));
    }
    const offset = Math.max(0, Number(rest.offset) || 0);
    const limit = Number(rest.limit);
    return Number.isFinite(limit) && limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
  },

  async summary(filters = {}) {
    const rows = await this.listByPeriodo(filters);
    const total = rows.length;
    const pesos = rows.map((r) => Number(r.peso_kg) || 0).filter((n) => n > 0);
    const somaPeso = pesos.reduce((a, b) => a + b, 0);
    return {
      total,
      somaPeso,
      mediaPeso: pesos.length ? somaPeso / pesos.length : 0,
      pesoMin: pesos.length ? Math.min(...pesos) : 0,
      pesoMax: pesos.length ? Math.max(...pesos) : 0,
    };
  },
};

export async function readAppSetting(key) {
  const db = await ensureStorageReady();
  const row = await db.table('appSettings').get(key);
  return row?.value ?? null;
}

export async function writeAppSetting(key, value) {
  assertWritable('Gravação de configuração');
  const db = await ensureStorageReady();
  await db.table('appSettings').put({ key, value });
  return true;
}
