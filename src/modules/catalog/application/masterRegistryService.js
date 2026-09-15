// Fábrica do serviço de cadastro mestre (ADR-018, docs 12 §3.1). Uma instância
// por store, todas com o mesmo contrato: list/get/create/update/deactivate/
// activate/remove/setDefault/getDefault/resolveByName/describeUsage/countUsage.
// Escrita passa por assertRegistryWrite e grava `auditoria` com o ator da sessão
// (getActor → usuario_id/usuario_nome_snapshot, ADR-046; o ator explícito da
// chamada é só fallback para gates/migração).
import Dexie from 'dexie';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { createRepository } from '../../../storage/indexedDb/repositories/genericRepository.js';
import { coerceRecord } from '../domain/registryDefinitions.js';
import { normalizeName } from '../domain/normalize.js';
import { RegistryError } from '../domain/registryErrors.js';
import { assertRegistryWrite } from './registryAccess.js';

export const DEFAULT_EMPRESA_ID = 'local';
export const INACTIVE_DEFAULT_MESSAGE = 'Registro inativo não pode ser padrão.';

const nowIso = () => new Date().toISOString();
const capitalize = (text) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
const empresaDe = (row) => row.empresa_id ?? row.empresaId ?? DEFAULT_EMPRESA_ID;
const payloadOf = (row) => (row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload : {});
const hasTable = (db, name) => db.tables.some((table) => table.name === name);
const sum = (detalhe) => Object.values(detalhe).reduce((total, n) => total + n, 0);
// Animal ativo: enum v7 `ATIVO` ou projeção legada `Ativo` (antes do backfill B7).
const isActiveAnimal = (row) => String(row.situacao ?? '').toLocaleUpperCase('pt-BR') === 'ATIVO';
const any = () => true;

async function countIndexed(db, table, field, value, extra = any) {
  if (!hasTable(db, table)) return 0;
  const rows = await db.table(table).where(field).equals(value).toArray();
  return rows.filter((row) => !row.deleted_at && extra(row)).length;
}

// Índice composto [marca_id+valor_normalizado]: todos os identificadores de uma marca.
async function countByBrandIndex(db, marcaId) {
  if (!hasTable(db, 'animalIdentificadores')) return 0;
  const rows = await db.table('animalIdentificadores')
    .where('[marca_id+valor_normalizado]')
    .between([marcaId, Dexie.minKey], [marcaId, Dexie.maxKey], true, true)
    .toArray();
  return rows.filter((row) => !row.deleted_at).length;
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

// Vínculos por cadastro. Cada entrada devolve { atual, historico }, ambos no
// formato { origem: n }. `atual` é o uso corrente (animais ATIVOS, faixas
// ativas…) que a coluna "Em uso" mostra; `historico` conta qualquer registro
// não excluído (todas as situações) e é o que bloqueia a exclusão (docs 12 §3.1:
// cadastro citado pelo histórico se inativa, nunca se exclui).
const USAGE_BY_STORE = {
  marcas: async (db, r) => ({
    atual: {
      animais: await countIndexed(db, 'animais', 'marca_id', r.id, isActiveAnimal),
      faixas: await countIndexed(db, 'faixasIdentificadores', 'marca_id', r.id, (f) => f.ativo !== false),
    },
    historico: {
      animais: await countIndexed(db, 'animais', 'marca_id', r.id),
      identificadores: await countByBrandIndex(db, r.id),
      faixas: await countIndexed(db, 'faixasIdentificadores', 'marca_id', r.id),
      sessoes: await countScanned(db, 'sessoesPesagem', (s) => s.marca_padrao_id === r.id),
    },
  }),
  racas: async (db, r) => ({
    atual: { animais: await countIndexed(db, 'animais', 'raca_id', r.id, isActiveAnimal) },
    historico: { animais: await countIndexed(db, 'animais', 'raca_id', r.id) },
  }),
  categoriasAnimal: async (db, r) => ({
    atual: {
      animais: await countIndexed(db, 'animais', 'categoria_id', r.id, isActiveAnimal),
      lotes: await countIndexed(db, 'loteApartacoes', 'categoria_id', r.id),
    },
    historico: {
      animais: await countIndexed(db, 'animais', 'categoria_id', r.id),
      lotes: await countIndexed(db, 'loteApartacoes', 'categoria_id', r.id),
    },
  }),
  propriedades: async (db, r) => ({
    atual: {
      animais: await countIndexed(db, 'animais', 'propriedade_id', r.id, isActiveAnimal),
      marcas: await countScanned(db, 'marcas', (m) => m.propriedade_id === r.id),
    },
    historico: {
      animais: await countIndexed(db, 'animais', 'propriedade_id', r.id),
      marcas: await countScanned(db, 'marcas', (m) => m.propriedade_id === r.id),
    },
  }),
  parceiros: async (db, r) => {
    const detalhe = {
      embarques: await countIndexed(db, 'embarques', 'parceiro_id', r.id),
      operacoes: await countIndexed(db, 'operacoesComerciais', 'parceiro_id', r.id),
      propriedades: await countIndexed(db, 'propriedades', 'parceiro_id', r.id),
      marcas: await countScanned(db, 'marcas', (m) => m.proprietario_parceiro_id === r.id),
      // Eventos legados guardam o nome (comprador/frigorífico/origem) no payload.
      eventos: await countEvents(db, [...SAIDA, ...CADASTRO], (row) => {
        const p = payloadOf(row);
        return [p.comprador, p.frigorifico, p.origem_animal].some((nome) => nome && normalizeName(nome) === r.nome_normalizado);
      }),
    };
    return { atual: detalhe, historico: { ...detalhe } };
  },
  causasMorte: async (db, r) => {
    const detalhe = {
      mortes: await countEvents(db, SAIDA, (row) => {
        if (row.causa_morte_id === r.id) return true; // coluna promovida na v8
        const causa = payloadOf(row).causa_morte;
        return Boolean(causa) && normalizeName(causa) === r.nome_normalizado;
      }),
    };
    return { atual: detalhe, historico: { ...detalhe } };
  },
};

// Linha ATIVA (não excluída) de um cadastro referenciado, pelo id de domínio.
async function findReferenced(db, store, id) {
  if (!hasTable(db, store)) return null;
  const rows = await db.table(store).where('id').equals(id).toArray();
  const vivos = rows.filter((row) => !row.deleted_at);
  return vivos.length ? vivos[vivos.length - 1] : null;
}

export function createMasterRegistryService(definition) {
  const { store, singular } = definition;
  const repo = createRepository(store);
  const rotulo = capitalize(singular);
  const referenceFields = definition.campos.filter((campo) => campo.referencia?.store);

  function validateOrThrow(record) {
    const erros = definition.validar(record);
    if (erros.length) throw new RegistryError('REGISTRY_INVALID', erros.join(' '), { erros });
  }

  // `padrao` só em registro ativo (create/update); inativar limpa o padrão.
  function assertDefaultAllowed(record) {
    if (definition.temPadrao && record.padrao === true && record.ativo === false) {
      throw new RegistryError('REGISTRY_INVALID', INACTIVE_DEFAULT_MESSAGE, { campo: 'padrao', erros: [INACTIVE_DEFAULT_MESSAGE] });
    }
  }

  // Referências (proprietario_parceiro_id, propriedade_id, parceiro_id…): o id
  // precisa existir na mesma empresa; inativo só é aceito quando já era o valor
  // gravado; parceiro precisa ter o papel exigido pelo campo (docs 12 §3.1).
  async function assertReferences(db, record, existing = null) {
    const erros = [];
    for (const campo of referenceFields) {
      const id = record[campo.id];
      if (id == null || id === '') continue;
      const { store: refStore, papel } = campo.referencia;
      const alvo = await findReferenced(db, refStore, id);
      if (!alvo || empresaDe(alvo) !== record.empresa_id) {
        erros.push(`${campo.label}: registro não encontrado.`);
        continue;
      }
      const jaGravado = existing != null && existing[campo.id] === id;
      if (alvo.ativo === false && !jaGravado) erros.push(`${campo.label}: "${alvo.nome}" está inativo(a).`);
      if (papel && !(Array.isArray(alvo.papeis) && alvo.papeis.includes(papel))) {
        erros.push(`${campo.label}: "${alvo.nome}" não tem o papel ${papel}.`);
      }
    }
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

  // Ator: sessão (provedor registrado pelo auth) → ator informado na chamada
  // (gates/migração) → nulo (docs 11 §7). Campos rev. 2: usuario_id/usuario_nome_snapshot.
  function actorFields(actor) {
    const sessao = getActor();
    if (sessao.usuario_id) return sessao;
    if (actor?.id) return { usuario_id: String(actor.id), usuario_nome_snapshot: actor.nome ? String(actor.nome) : null };
    return { usuario_id: null, usuario_nome_snapshot: null };
  }

  async function audit(db, acao, record, actor, extra = {}) {
    await db.table('auditoria').add({
      id: crypto.randomUUID(),
      entidade: store,
      entidade_id: record.id,
      acao,
      resumo: extra.resumo ?? null,
      campos_alterados: extra.campos_alterados ?? [],
      ...(extra.antes ? { antes: extra.antes } : {}),
      ...(extra.depois ? { depois: extra.depois } : {}),
      ...actorFields(actor),
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

  async function usageOf(record) {
    const db = await ensureStorageReady();
    const counter = USAGE_BY_STORE[store];
    const { atual, historico } = counter ? await counter(db, record) : { atual: {}, historico: {} };
    return { atual, historico, total_atual: sum(atual), total_historico: sum(historico) };
  }

  // Campos informados (fora nome/ativo/normalizado) — resumo do CRIAR sem `depois` completo.
  const camposInformados = (record) => Object.keys(record).filter((key) => !['id', 'localId', 'nome_normalizado', 'empresa_id', 'created_at', 'updated_at', 'deleted_at'].includes(key) && record[key] != null && record[key] !== '' && !(Array.isArray(record[key]) && !record[key].length));

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
      assertDefaultAllowed(record);
      const db = await ensureStorageReady();
      await assertReferences(db, record, null);
      return withTransaction(db, async () => {
        await assertUnique(db, record, null);
        if (definition.temPadrao && record.padrao) await clearDefault(db, empresaId, null);
        const created = await repo.create({
          ...record,
          ...(data.id ? { id: data.id } : {}),
          ...(data.created_at ? { created_at: data.created_at } : {}),
        });
        const campos = camposInformados(created);
        await audit(db, 'CRIAR', created, actor, { resumo: `Criou ${singular} "${created.nome}" (${campos.join(', ')}).`, campos_alterados: campos });
        return created;
      });
    },

    async update(actor, id, patch = {}) {
      assertRegistryWrite(actor);
      const db = await ensureStorageReady();
      // Referências são lidas fora da transação (outras stores); a coerência do
      // próprio registro é revalidada dentro dela.
      const atual = await requireExisting(id);
      const candidato = { ...coerceRecord(definition, { ...atual, ...patch }), empresa_id: empresaDe(atual) };
      validateOrThrow(candidato);
      assertDefaultAllowed(candidato);
      await assertReferences(db, candidato, atual);
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        const merged = { ...coerceRecord(definition, { ...existing, ...patch }), empresa_id: empresaDe(existing) };
        validateOrThrow(merged);
        assertDefaultAllowed(merged);
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

    // Inativar limpa o padrão (inativo não aparece na seleção) e avisa: o
    // registro devolvido traz `aviso` (não persistido) quando isso acontece.
    async deactivate(actor, id) {
      assertRegistryWrite(actor);
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        const existing = await requireExisting(id);
        if (existing.ativo === false) return existing;
        const eraPadrao = definition.temPadrao && existing.padrao === true;
        const changes = { ativo: false, ...(eraPadrao ? { padrao: false } : {}) };
        const updated = await repo.update(existing.id, changes);
        const aviso = eraPadrao ? `${rotulo} "${updated.nome}" deixou de ser o padrão; defina outro(a) ${singular} padrão.` : null;
        await audit(db, 'INATIVAR', updated, actor, {
          resumo: `Inativou ${singular} "${updated.nome}".${eraPadrao ? ' Deixou de ser padrão.' : ''}`,
          campos_alterados: Object.keys(changes),
        });
        return aviso ? { ...updated, aviso } : updated;
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

    // Exclusão lógica só sem vínculo HISTÓRICO (qualquer registro não excluído
    // que cite o cadastro, em qualquer situação); com vínculo o caminho é inativar.
    async remove(actor, id) {
      assertRegistryWrite(actor);
      const existing = await requireExisting(id);
      const uso = await usageOf(existing);
      if (uso.total_historico > 0) {
        throw new RegistryError('REGISTRY_IN_USE', `${rotulo} "${existing.nome}" está em uso por ${uso.total_historico} registro(s); inative em vez de excluir.`, {
          uso: uso.total_historico,
          detalhe: uso.historico,
          atual: uso.atual,
        });
      }
      const db = await ensureStorageReady();
      return withTransaction(db, async () => {
        await repo.remove(existing.id);
        await audit(db, 'CANCELAR', existing, actor, { resumo: `Excluiu ${singular} "${existing.nome}".`, antes: { id: existing.id, nome: existing.nome } });
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
          throw new RegistryError('REGISTRY_INVALID', INACTIVE_DEFAULT_MESSAGE, { id, campo: 'padrao' });
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

    // { atual: { origem: n }, historico: { origem: n }, total_atual, total_historico }
    async describeUsage(id) {
      const existing = await requireExisting(id);
      return usageOf(existing);
    },

    // Uso corrente (coluna "Em uso"): animais ativos, faixas ativas etc.
    async countUsage(id) {
      const { total_atual } = await service.describeUsage(id);
      return total_atual;
    },
  };

  return service;
}
