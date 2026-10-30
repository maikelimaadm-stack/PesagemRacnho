// Núcleo da medição de "Reconciliar derivados" (R08), igual no Node (fake-indexeddb) e no Chromium real
// (IndexedDB do navegador, o mesmo motor do Electron). Base sintética: Cadastro + 2 Manejos por animal, lotes.
// 1ª execução cria os derivados; 2ª execução é idempotente (não grava nada); a cancelada para entre blocos.
import { deleteDbForTests } from '../../src/storage/indexedDb/db.js';
import storage from '../../src/storage/storageAdapter.js';
import { reconcileAllAnimalDerivations } from '../../src/modules/weighing/infrastructure/weighingDataAdapter.js';

const TS = '2026-01-01T00:00:00.000Z';
const base = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
const agora = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
const pct = (lista, p) => { const s = [...lista].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null; };
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const falha = (msg) => { throw new Error(`bench: ${msg}`); };

async function semear(n) {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  await db.table('marcas').add({ ...base, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
  await db.table('apartacoes').add({ ...base, id: 'AP', nome_apartacao: 'AP', data: '2026-01-10' });
  for (const id of ['L1', 'L2']) await db.table('loteApartacoes').add({ ...base, id, apartacao_id: 'AP', nome_lote: id, situacao: 'ABERTO' });
  await db.table('categoriasAnimal').bulkAdd([
    { ...base, id: 'C1', nome: 'Bezerro', sexo: 'M', peso_min: 0, peso_max: 250, ativo: true },
    { ...base, id: 'C2', nome: 'Garrote', sexo: 'M', peso_min: 250, peso_max: 400, ativo: true },
    { ...base, id: 'C3', nome: 'Boi', sexo: 'M', peso_min: 400, peso_max: 2000, ativo: true },
  ]);
  const animais = [];
  const pesagens = [];
  for (let i = 0; i < n; i += 1) {
    const id = `A${i}`;
    const numero = String(100000 + i);
    animais.push({ ...base, id, numero_animal: numero, identificacao_normalizada: numero, marca_id: 'MK', marca: 'ALFA', sexo: 'M', situacao: 'ATIVO', categoria_automatica: true });
    const ev = (k, data, tipo, peso, lote) => ({ ...base, id: `${id}-${k}`, animal_id: id, data_pesagem: data, peso_kg: peso, tipo_pesagem: tipo, lote_id: lote, legacy_payload: { tipo_manejo: tipo, numero_animal: numero, marca: 'ALFA', peso, lote_id: lote, apartacao_id: 'AP' } });
    pesagens.push(ev('c', '2026-01-10', 'Cadastro', 200 + (i % 50), 'L1'), ev('m1', '2026-03-10', 'Manejo', 260 + (i % 50), 'L1'), ev('m2', '2026-05-10', 'Manejo', 320 + (i % 50), i % 3 ? 'L1' : 'L2'));
  }
  await db.table('animais').bulkAdd(animais);
  await db.table('pesagens').bulkAdd(pesagens);
  return db;
}

async function execucao(opcoes = {}) {
  const tempos = [];
  let ultimo = agora();
  const t0 = ultimo;
  const r = await reconcileAllAnimalDerivations({ ...opcoes, onProgress: (p) => { const t = agora(); tempos.push(t - ultimo); ultimo = t; opcoes.onProgress?.(p); } });
  return { ms: agora() - t0, tempos, r };
}

export async function runReconcileBench(n, { chunkSize } = {}) {
  const bloco = chunkSize ? { chunkSize } : {};
  const db = await semear(n);
  const primeira = await execucao(bloco);
  const contagens = { movimentos: await db.table('movimentosAnimais').count(), lotes: await db.table('animalLotes').count() };
  if (contagens.movimentos < n) falha('movimentos de entrada não criados');
  const carimbos = async () => (await Promise.all(['pesagens', 'animais', 'animalLotes', 'movimentosAnimais'].map(async (t) => (await db.table(t).toArray()).map((r) => r.updated_at).join('|')))).join('#');
  const antes = await carimbos();
  const segunda = await execucao(bloco);
  if (await carimbos() !== antes) falha('2ª execução regravou registros (não idempotente)');
  // Cancelamento: interrompe depois do 1º bloco; o que foi feito fica consistente e reexecutar termina.
  const sinal = { aborted: false };
  const cancelada = await reconcileAllAnimalDerivations({ ...bloco, signal: sinal, onProgress: () => { sinal.aborted = true; } });
  if (n > cancelada.chunk && (!cancelada.cancelado || cancelada.feitos >= n)) falha('cancelamento não interrompeu entre blocos');
  await deleteDbForTests();
  return {
    animais: n,
    chunk: primeira.r.chunk,
    primeira_s: r1(primeira.ms / 1000),
    primeira_animais_por_s: Math.round(n / (primeira.ms / 1000)),
    primeira_bloco_p50_ms: r1(pct(primeira.tempos, 50)),
    primeira_bloco_p95_ms: r1(pct(primeira.tempos, 95)),
    segunda_s: r1(segunda.ms / 1000),
    segunda_bloco_p50_ms: r1(pct(segunda.tempos, 50)),
    segunda_bloco_p95_ms: r1(pct(segunda.tempos, 95)),
    cancelada_feitos: cancelada.feitos,
    ...contagens,
  };
}
