// Fábrica do serviço de cadastro mestre (ADR-018, docs 12 §3.1). Uma instância
// por store, todas com o mesmo contrato: list/get/create/update/deactivate/
// activate/remove/setDefault/resolveByName/countUsage. Escrita passa por
// assertRegistryWrite e grava `auditoria` com o ator (ADR-036).
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { createRepository } from '../../../storage/indexedDb/repositories/genericRepository.js';
import { coerceRecord } from '../domain/registryDefinitions.js';
import { normalizeName } from '../domain/normalize.js';
import { RegistryError } from '../domain/registryErrors.js';
import { assertRegistryWrite } from './registryAccess.js';

export const DEFAULT_EMPRESA_ID = 'local';

const nowIso = () => new Date().toISOString();
const capitalize = (text) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
const empresaDe = (row) => row.empresa_id ?? row.empresaId ?? DEFAULT_EMPRESA_ID;
const payloadOf = (row) => (row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload : {});
const hasTable = (db, name) => db.tables.some((table) => table.name === name);
// Animal ativo: enum v7 `ATIVO` ou projeção legada `Ativo` (antes do backfill B7).
const isActiveAnimal = (row) => !row.deleted_at && String(row.situacao ?? '').toLocaleUpperCase('pt-BR') === 'ATIVO';

async function countIndexed(db, table, field, value, extra = () => true) {
  if (!hasTable(db, table)) return 0;
  const rows = await db.table(table).where(field).equals(value).toArray();
  return rows.filter((row) => !row.deleted_at && extra(row)).length;
}

async function countScanned(db, table, predicate) {
  if (!hasTable(db, table)) return 0;
  return db.table(table).filter((row) => !row.deleted_at && predicate(row)).count();
}

// Eventos com dados comerciais/morte no payload: só os tipos que os carregam
// (índice `tipo_pesagem`), nunca a base inteira.
async function countEvents(db, tipos, predicate) {
  const rows = await db.table('pesagens').where('tipo_pesagem').anyOf(tipos).toArray();
  return rows.filter((row) => !row.deleted_at && predicate(row)).length;
}

const SAIDA = ['Saída', 'SAIDA'];
const CADASTRO = ['Cadastro', 'CADASTRO'];

// Vínculos por cadastro. Cada entrada devolve um detalhamento { origem: n }.
const USAGE_BY_STORE = {
  marcas: async (db, r) => ({
    animais: await countIndexed(db, 'animais', 'marca_id', r.id, isActiveAnimal),
    faixas: await countIndexed(db, 'faixasIdentificadores', 'marca_id', r.id, (f) => f.ativo !== false),
  }),
  racas: async (db, r) => ({
    animais: await countIndexed(db, 'animais', 'raca_id', r.id, isActiveAnimal),
  }),
  categoriasAnimal: async (db, r) => ({
    animais: await countIndexed(db, 'animais', 'categoria_id', r.id, isActiveAnimal),
    lotes: await countIndexed(db, 'loteApartacoes', 'categoria_id', r.id),
  }),
  propriedades: async (db, r) => ({
    animais: await countIndexed(db, 'animais', 'propriedade_id', r.id, isActiveAnimal),
    marcas: await countScanned(db, 'marcas', (m) => m.propriedade_id === r.id),
  }),
  parceiros: async (db, r) => ({
    embarques: await countIndexed(db, 'embarques', 'parceiro_id', r.id),
    operacoes: await countIndexed(db, 'operacoesComerciais', 'parceiro_id', r.id),
    propriedades: await countIndexed(db, 'propriedades', 'parceiro_id', r.id),
    marcas: await countScanned(db, 'marcas', (m) => m.proprietario_parceiro_id === r.id),
    // Eventos legados guardam o nome (comprador/frigorífico/origem) no payload.
    eventos: await countEvents(db, [...SAIDA, ...CADASTRO], (row) => {
      const p = payloadOf(row);
      return [p.comprador, p.frigorifico, p.origem_animal].some((nome) => nome && normalizeName(nome) === r.nome_normalizado);
    }),
  }),
  causasMorte: async (db, r) => ({
    mortes: await countEvents(db, SAIDA, (row) => {
      if (row.causa_morte_id === r.id) return true; // coluna promovida na v8
      const causa = payloadOf(row).causa_morte;
      return Boolean(causa) && normalizeName(causa) === r.nome_normalizado;
    }),
  }),
};

export function createMasterRegistryService(definition) {
  const { store, singular } = definition;
  const repo = createRepository(store);
  const rotulo = capitalize(singular);

  function validateOrThrow(record) {
    const erros = definition.validar(record);
    if (erros.length) throw new RegistryError('REGISTRY_INVALID', erros.join(' '), { erros });
  }

  async function assertUnique(db, record, selfId) {
    const t = db.table(store);
    const mesmoNome = await t.where('nome_normalizado').equals(record.nome_normalizado).toArray();
    if (mesmoNome.some((r) => !r.deleted_at && r.id !== selfId && empresaDe(r) === record.empresa_id)) {
      throw new RegistryError('REGISTRY_DUPLICATE', `Já existe ${singular} com o nome "${record.nome}".`, { campo: 'nome', valor: record.nome });
    }
    if (definition.unicidade.includes('documento') && record.documento) {
      const mesmoDoc = await t.where('documento').equals(record.documento).toArray();
      if (mesmoDoc.some((r) => !r.deleted_at && r.id !== selfId && empresaDe(r) === record.empresa_id)) {
        throw new RegistryError('REGISTRY_DUPLICATE', `Já existe ${singular} com o documento ${record.documento}.`, { campo: 'documento', valor: record.documento });
      }
    }
  }

  // Apenas um `padrao` por empresa: desmarca os demais antes de marcar o novo.
  async function clearDefault(db, empresaId, exceptId) {
    const ts = nowIso();
    await db.table(store)
      .where('empresa_id').equals(empresaId)
      .filter((r) => !r.deleted_at && r.padrao === true && r.id !== exceptId)
      .modify({ padrao: false, updated_at: ts });
  }

  async function audit(db, acao, record, actor, extra = {}) {
    const fromProvider = getActor();
    // Sem provedor de sessão (gates/migração) usa o ator informado na chamada.
    const actorFields = fromProvider.actor_user_id || !actor?.id
      ? fromProvider
      : { actor_user_id: String(actor.id), actor_user_name: actor.nome ?? null, actor_user_profile: actor.perfil ?? null };
    await db.table('auditoria').add({
      id: crypto.randomUUID(),
      entidade: store,
      entidade_id: record.id,
      acao,
      resumo: extra.resumo ?? null,
      campos_alterados: extra.campos_alterados ?? [],
      ...(extra.antes ? { antes: extra.antes } : {}),
      ...(extra.depois ? { depois: extra.depois } : {}),
      ...actorFields,
      created_at: nowIso(),
    });
  }

  async function requireExisting(id) {
    const existing = await repo.get(id);
    if (!existing || existing.deleted_at) {
      throw new RegistryError('REGISTRY_NOT_FOUND', `${rotulo} não encontrado(a).`, { id });
    }
    return existing;
  }

  function withTransaction(db, fn) {
    return db.transaction('rw', db.table(store), db.table('auditoria'), fn);
  }

  async function describeUsage(record) {
    const db = await ensureStorageReady();
    const counter = USAGE_BY_STORE[store];
    return counter ? counter(db, record) : {};
  }

  const service = {
    store,
    definition,

    async list({ empresaId = DEFAULT_EMPRESA_ID, incluirInativos = false } = {}) {
      const rows = await repo.list({ empresaId });
      const visiveis = incluirInativos ? rows : rows.filter((r) => r.ativo !== false);
      // Ordem explícita primeiro (quem tem `ordem` vem antes de quem não tem), depois nome.
      return visiveis.sort((a, b) => {
        const oa = Number.isFinite(a.ordem) ? a.ordem : Number.MAX_SAFE_INTEGER;
        const ob = Number.isFinite(b.ordem) ? b.ordem : Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return String(a.nome_normalizado ?? '').localeCompare(String(b.nome_normalizado ?? ''), 'pt-BR');
      });
    },

    async get(id) {
      const row = await repo.get(id);
      return row && !row.deleted_at ? row : null;
    },

    async create(actor, data = {}) {
      assertRegistryWrite(actor);
      const empresaId = data.empresa_id ?? data.empresaId ?? DEFAULT_EMPRESA_ID;
      const record = { ...coerceRecord(definition, data), empresa_id: empresaId };
      validateOrThrow(record);
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        await assertUnique(db, record, null);
        if (definition.temPadrao && record.padrao) await clearDefault(db, empresaId, null);
        const created = await repo.create({
          ...record,
          ...(data.id ? { id: data.id } : {}),
          ...(data.created_at ? { created_at: data.created_at } : {}),
        });
        await audit(db, 'CRIAR', created, actor, { resumo: `Criou ${singular} "${created.nome}".`, depois: created });
        return created;
      });
    },

    async update(actor, id, patch = {}) {
      assertRegistryWrite(actor);
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        const merged = { ...coerceRecord(definition, { ...existing, ...patch }), empresa_id: empresaDe(existing) };
        validateOrThrow(merged);
        await assertUnique(db, merged, existing.id);
        const alterados = Object.keys(merged).filter((key) => JSON.stringify(merged[key] ?? null) !== JSON.stringify(existing[key] ?? null));
        if (!alterados.length) return existing;
        if (definition.temPadrao && merged.padrao && !existing.padrao) await clearDefault(db, merged.empresa_id, existing.id);
        const changes = Object.fromEntries(alterados.map((key) => [key, merged[key]]));
        const updated = await repo.update(existing.id, changes);
        const campos = alterados.filter((key) => key !== 'nome_normalizado');
        await audit(db, 'ATUALIZAR', updated, actor, { resumo: `Alterou ${singular} "${updated.nome}": ${campos.join(', ')}.`, campos_alterados: campos });
        return updated;
      });
    },

    async deactivate(actor, id) {
      assertRegistryWrite(actor);
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        if (existing.ativo === false) return existing;
        // Inativo não pode continuar como padrão (não apareceria na seleção).
        const changes = { ativo: false, ...(definition.temPadrao && existing.padrao ? { padrao: false } : {}) };
        const updated = await repo.update(existing.id, changes);
        await audit(db, 'INATIVAR', updated, actor, { resumo: `Inativou ${singular} "${updated.nome}".`, campos_alterados: Object.keys(changes) });
        return updated;
      });
    },

    async activate(actor, id) {
      assertRegistryWrite(actor);
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        if (existing.ativo !== false) return existing;
        const updated = await repo.update(existing.id, { ativo: true });
        await audit(db, 'ATUALIZAR', updated, actor, { resumo: `Reativou ${singular} "${updated.nome}".`, campos_alterados: ['ativo'] });
        return updated;
      });
    },

    // Exclusão lógica só sem vínculo; com vínculo o caminho é inativar.
    async remove(actor, id) {
      assertRegistryWrite(actor);
      const existing = await requireExisting(id);
      const detalhe = await describeUsage(existing);
      const uso = Object.values(detalhe).reduce((sum, n) => sum + n, 0);
      if (uso > 0) {
        throw new RegistryError('REGISTRY_IN_USE', `${rotulo} "${existing.nome}" está em uso por ${uso} registro(s); inative em vez de excluir.`, { uso, detalhe });
      }
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        await repo.remove(existing.id);
        await audit(db, 'CANCELAR', existing, actor, { resumo: `Excluiu ${singular} "${existing.nome}".`, antes: existing });
        return true;
      });
    },

    async setDefault(actor, id) {
      assertRegistryWrite(actor);
      if (!definition.temPadrao) {
        throw new RegistryError('REGISTRY_UNSUPPORTED', `${rotulo} não possui padrão.`, { store });
      }
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        if (existing.ativo === false) {
          throw new RegistryError('REGISTRY_INVALID', `${rotulo} inativo(a) não pode ser padrão.`, { id });
        }
        await clearDefault(db, empresaDe(existing), existing.id);
        if (existing.padrao) return existing;
        const updated = await repo.update(existing.id, { padrao: true });
        await audit(db, 'ATUALIZAR', updated, actor, { resumo: `Definiu ${singular} "${updated.nome}" como padrão.`, campos_alterados: ['padrao'] });
        return updated;
      });
    },

    async getDefault({ empresaId = DEFAULT_EMPRESA_ID } = {}) {
      if (!definition.temPadrao) return null;
      const rows = await service.list({ empresaId });
      return rows.find((r) => r.padrao === true) ?? null;
    },

    // Resolve por nome normalizado. Prefere o registro ativo; ignora excluídos
    // salvo `incluirExcluidos` (usado pelos seeds para não recriar o que foi removido).
    async resolveByName(nome, { empresaId = DEFAULT_EMPRESA_ID, incluirExcluidos = false } = {}) {
      const alvo = normalizeName(nome);
      if (!alvo) return null;
      const db = await ensureStorageReady();
      const rows = (await db.table(store).where('nome_normalizado').equals(alvo).toArray())
        .filter((r) => empresaDe(r) === empresaId && (incluirExcluidos || !r.deleted_at));
      if (!rows.length) return null;
      return rows.find((r) => !r.deleted_at && r.ativo !== false) ?? rows.find((r) => !r.deleted_at) ?? rows[rows.length - 1];
    },

    async describeUsage(id) {
      const existing = await requireExisting(id);
      return describeUsage(existing);
    },

    async countUsage(id) {
      const detalhe = await service.describeUsage(id);
      return Object.values(detalhe).reduce((sum, n) => sum + n, 0);
    },
  };

  return service;
}
