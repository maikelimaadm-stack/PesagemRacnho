// Persistência do calendário sazonal (F12) e das metas/cenários (F13) — stores v9 `calendariosSazonais` e
// `metasDesempenho` — e leitura das fontes do painel (F11/F14/F18). Sobreposição de períodos no mesmo escopo e
// meta conflitante (mesmo escopo/alvo/tipo com vigência sobreposta) são recusadas na gravação; exclusão é
// lógica e auditada.
import storage from '../../../storage/storageAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { naturezaDe } from '../../livestock/domain/movementNature.js';
import { SeasonError, findOverlap } from '../domain/seasonCalendar.js';
import { TargetError, findConflict } from '../domain/targets.js';

const active = (row) => row && !row.deleted_at;
const strip = ({ localId: _l, ...rest }) => rest;
const audit = (fields) => ({ id: crypto.randomUUID(), ...fields, ...getActor() });

async function save(store, { id, fields, check, rotulo }) {
  storage.assertWritable(rotulo);
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let saved = null;
  await db.transaction('rw', db.table(store), db.table('auditoria'), async () => {
    const existentes = (await db.table(store).toArray()).filter(active);
    check(fields, existentes, id);
    if (id) {
      const atual = existentes.find((r) => r.id === id);
      if (!atual) throw new Error(`${rotulo}: registro não encontrado.`);
      await db.table(store).update(atual.localId, { ...fields, updated_at: ts });
      await db.table('auditoria').add(audit({ entidade: store, entidade_id: id, acao: 'ATUALIZAR', antes: strip(atual), depois: fields, created_at: ts }));
      saved = { ...strip(atual), ...fields };
    } else {
      saved = { id: crypto.randomUUID(), empresa_id: 'local', ...fields, created_at: ts, updated_at: ts, deleted_at: null };
      await db.table(store).add(saved);
      await db.table('auditoria').add(audit({ entidade: store, entidade_id: saved.id, acao: 'CRIAR', depois: saved, created_at: ts }));
    }
  });
  return strip(saved);
}

async function remove(store, id, motivo, rotulo) {
  storage.assertWritable(rotulo);
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table(store), db.table('auditoria'), async () => {
    const atual = (await db.table(store).where('id').equals(id).toArray()).find(active);
    if (!atual) throw new Error(`${rotulo}: registro não encontrado.`);
    await db.table(store).update(atual.localId, { deleted_at: ts, updated_at: ts, motivo_exclusao: motivo });
    await db.table('auditoria').add(audit({ entidade: store, entidade_id: id, acao: 'EXCLUIR', antes: strip(atual), motivo, created_at: ts }));
  });
  return true;
}

export async function listSeasons() {
  const db = await storage.ensureReady();
  return (await db.table('calendariosSazonais').toArray()).filter(active).map(strip).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export const saveSeason = (id, fields) => save('calendariosSazonais', {
  id, fields, rotulo: 'Calendário sazonal',
  check: (f, existentes, selfId) => {
    const choque = findOverlap(f, existentes, selfId);
    if (choque) throw new SeasonError(`Sobrepõe o período ${choque.periodo} de ${choque.inicio} a ${choque.fim} do mesmo escopo.`);
  },
});
export const removeSeason = (id, motivo) => remove('calendariosSazonais', id, motivo, 'Calendário sazonal');

export async function listTargets() {
  const db = await storage.ensureReady();
  return (await db.table('metasDesempenho').toArray()).filter(active).map(strip).sort((a, b) => String(a.vigencia_inicio).localeCompare(String(b.vigencia_inicio)));
}

export const saveTarget = (id, fields) => save('metasDesempenho', {
  id, fields, rotulo: 'Meta de desempenho',
  check: (f, existentes, selfId) => {
    const choque = findConflict(f, existentes, selfId);
    if (choque) throw new TargetError('Já existe meta do mesmo escopo, alvo e tipo com vigência sobreposta: encerre a anterior antes (nenhuma meta é aplicada em silêncio).');
  },
});
export const removeTarget = (id, motivo) => remove('metasDesempenho', id, motivo, 'Meta de desempenho');

/** Fontes do painel (somente ativos; pesagens reduzidas ao necessário). */
export async function loadSources() {
  const db = await storage.ensureReady();
  const [pesagens, animais, animalLotes, movimentos, operacoes, calendario, metas, racas, lotes, propriedades] = await Promise.all([
    db.table('pesagens').toArray(), db.table('animais').toArray(), db.table('animalLotes').toArray(), db.table('movimentosAnimais').toArray(),
    db.table('operacoes').toArray(), db.table('calendariosSazonais').toArray(), db.table('metasDesempenho').toArray(),
    db.table('racas').toArray(), db.table('loteApartacoes').toArray(), db.table('propriedades').toArray(),
  ]);
  return {
    pesagens: pesagens.filter(active).map((p) => ({ id: p.id, animal_id: p.animal_id, data_pesagem: p.data_pesagem, peso_kg: p.peso_kg, lote_id: p.lote_id, created_at: p.created_at, legacy_payload: { tipo_manejo: p.legacy_payload?.tipo_manejo, peso: p.legacy_payload?.peso, peso_origem: p.legacy_payload?.peso_origem } })),
    animais: animais.filter(active).map(strip),
    animalLotes: animalLotes.filter(active).map(strip),
    movimentos: movimentos.filter(active).map((m) => ({ ...strip(m), natureza: naturezaDe(m) })),
    operacoes: operacoes.filter(active).map(strip),
    calendario: calendario.filter(active).map(strip),
    metas: metas.filter(active).map(strip),
    nomes: {
      racas: new Map(racas.map((r) => [r.id, r.nome])),
      lotes: new Map(lotes.map((l) => [l.id, l.nome_lote || l.id])),
      propriedades: new Map(propriedades.map((p) => [p.id, p.nome])),
    },
  };
}
