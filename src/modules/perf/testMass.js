// Massa de teste anônima e determinística (F0 — Contratos e baseline).
// Gera animais, identificadores, sessões, lotes históricos e pesagens no mesmo
// formato persistido pelo runtime (stores Dexie), sem nomes reais, sem CPF,
// sem documentos. A mesma semente produz sempre a mesma massa.
//
// Roda em Node (fake-indexeddb) e no navegador (IndexedDB real) porque só usa
// APIs presentes nos dois: crypto.randomUUID, Date e Map.
import { recalculateWeightSeries } from '../weighing/domain/weighingSeries.js';

export const TEST_MASSES = Object.freeze({
  vazia: { label: 'Vazia', weighings: 0, weighingsPerAnimal: 0 },
  pequena: { label: 'Pequena', weighings: 300, weighingsPerAnimal: 3 },
  '36k': { label: '36 mil', weighings: 36_000, weighingsPerAnimal: 3 },
  '250k': { label: '250 mil', weighings: 250_000, weighingsPerAnimal: 4 },
});

export const MASS_KEYS = Object.keys(TEST_MASSES);

const BRANDS = ['ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA'];
const BREEDS = ['Nelore', 'Angus', 'Brangus', 'Guzerá', 'Tabapuã'];
const ERAS = ['12', '18', '24', '30', '36'];
const APARTACOES = [
  { nome: 'Recria', lotes: [['Leves', 150, 280], ['Médios', 281, 380], ['Pesados', 381, 800]] },
  { nome: 'Engorda', lotes: [['E1', 150, 350], ['E2', 351, 450], ['E3', 451, 800]] },
  { nome: 'Venda', lotes: [['V1', 150, 420], ['V2', 421, 520], ['V3', 521, 800]] },
];
const BASE_DAY = Date.UTC(2025, 0, 6); // 06/01/2025 (segunda-feira)
const MAX_DAY = Date.UTC(2026, 7, 31); // 31/08/2026 — nunca no futuro para o app

// mulberry32: PRNG pequeno e determinístico (não criptográfico; só para massa).
export function createRandom(seed = 20260908) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    // UUID v4 determinístico a partir do PRNG (formato válido, sem entropia real).
    uuid: () => {
      const hex = [];
      for (let index = 0; index < 32; index += 1) hex.push(Math.floor(next() * 16).toString(16));
      hex[12] = '4';
      hex[16] = (8 + Math.floor(next() * 4)).toString(16);
      const s = hex.join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}

const isoDay = (utcMs) => new Date(utcMs).toISOString().slice(0, 10);
const isoInstant = (utcMs, offsetMinutes = 0) => new Date(utcMs + offsetMinutes * 60_000).toISOString();

function findLot(apartacao, weight) {
  return apartacao.lotes.find((lot) => weight >= lot.peso_minimo && weight <= lot.peso_maximo) || null;
}

/**
 * Gera a massa em memória. Retorna as linhas por store, já no formato Dexie,
 * mais os payloads de UI (legacy_payload) usados pelas telas.
 */
export function generateTestMass(massKey, { seed = 20260908, empresaId = 'local' } = {}) {
  const spec = TEST_MASSES[massKey];
  if (!spec) throw new Error(`Massa desconhecida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
  const random = createRandom(seed);
  const createdAt = isoInstant(BASE_DAY);

  const apartacoes = APARTACOES.map((apartacao) => ({
    id: random.uuid(),
    empresa_id: empresaId,
    nome_apartacao: apartacao.nome,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
    lotes: apartacao.lotes.map(([nome, min, max]) => ({
      id: random.uuid(),
      empresa_id: empresaId,
      nome_lote: nome,
      peso_minimo: min,
      peso_maximo: max,
      quantidade_maxima: 100_000,
      fechado: false,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    })),
  }));
  const loteApartacoes = apartacoes.flatMap((apartacao) =>
    apartacao.lotes.map((lot) => ({ ...lot, apartacao_id: apartacao.id })));
  const apartacaoRows = apartacoes.map(({ lotes: _lotes, ...row }) => row);

  const animalsTotal = spec.weighingsPerAnimal ? Math.floor(spec.weighings / spec.weighingsPerAnimal) : 0;
  const animais = [];
  const animalIdentificadores = [];
  const uiEntries = [];
  const sessionsByDate = new Map();

  const sessionFor = (day) => {
    let session = sessionsByDate.get(day);
    if (!session) {
      const ts = isoInstant(Date.parse(`${day}T09:00:00Z`));
      session = { id: random.uuid(), data: day, status: 'Aberta', operador: 'MASSA', inicio: ts, created_at: ts, updated_at: ts, deleted_at: null };
      sessionsByDate.set(day, session);
    }
    return session;
  };

  for (let index = 0; index < animalsTotal; index += 1) {
    const animalId = random.uuid();
    const brand = BRANDS[index % BRANDS.length];
    // 1 em cada 8 animais repete o número do animal anterior, que está em outra
    // marca (marcas alternam por índice), para exercitar a desambiguação sem
    // jamais duplicar a identidade número + marca.
    const number = String(index % 8 === 7 ? index : index + 1);
    const sexo = random.next() < 0.6 ? 'M' : 'F';
    const raca = random.pick(BREEDS);
    const era = random.pick(ERAS);
    const apartacao = apartacoes[index % apartacoes.length];
    const registrationDay = BASE_DAY + random.int(0, 300) * 86_400_000;
    let weight = random.int(160, 320);
    let day = registrationDay;
    let currentLotId = null;

    for (let event = 0; event < spec.weighingsPerAnimal; event += 1) {
      if (event > 0) {
        const gapDays = random.int(20, 75);
        day = Math.min(day + gapDays * 86_400_000, MAX_DAY);
        weight = Math.max(120, weight + random.int(-8, 65));
      }
      const dataPesagem = isoDay(day);
      const session = sessionFor(dataPesagem);
      const lot = findLot(apartacao, weight);
      const tipoManejo = event === 0 ? 'Cadastro' : 'Manejo';
      const entryId = random.uuid();
      const created = isoInstant(day, 9 * 60 + (index % 480));
      const ui = {
        id: entryId,
        empresa_id: empresaId,
        tipo_manejo: tipoManejo,
        motivo_saida: null,
        status_animal: 'Ativo',
        data_pesagem: dataPesagem,
        animal_id: animalId,
        sessao_id: session.id,
        numero_animal: number,
        sexo,
        raca,
        era,
        marca: brand,
        peso: weight,
        observacao: null,
        apartacao_id: apartacao.id,
        nome_apartacao: apartacao.nome_apartacao,
        lote_id: lot?.id || null,
        nome_lote: lot?.nome_lote || null,
        origem: 'massa-teste',
        operador: 'MASSA',
        created_date: created,
        updated_date: created,
      };
      uiEntries.push(ui);
      if (lot?.id) currentLotId = lot.id;
    }

    animais.push({
      id: animalId,
      empresa_id: empresaId,
      identificacao_normalizada: number.toUpperCase(),
      numero_animal: number,
      nome: null,
      sexo,
      raca,
      era,
      marca: brand,
      situacao: 'Ativo',
      data_saida: null,
      motivo_saida: null,
      ultima_pesagem_data: isoDay(day),
      ultimo_peso_kg: weight,
      lote_atual_id: currentLotId,
      apartacao_atual_id: apartacao.id,
      origem: 'massa-teste',
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    });
    animalIdentificadores.push({
      id: random.uuid(),
      animal_id: animalId,
      tipo: 'visual_marca',
      valor: number,
      valor_normalizado: `${number.toUpperCase()}::${brand}`,
      marca: brand,
      principal: true,
      ativo: true,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    });
  }

  // Derivados (peso anterior, dias, ganho, GMD) pela mesma regra do runtime.
  const derived = new Map(recalculateWeightSeries(uiEntries).map((update) => [update.id, update.patch]));
  const pesagens = uiEntries.map((ui) => {
    const patch = derived.get(ui.id) || {};
    const legacy = { ...ui, ...patch };
    return {
      id: ui.id,
      data_pesagem: ui.data_pesagem,
      peso_kg: ui.peso,
      lote_id: ui.lote_id,
      animal_id: ui.animal_id,
      sessao_id: ui.sessao_id,
      tipo_pesagem: ui.tipo_manejo,
      observacao: null,
      legacy_payload: legacy,
      created_at: ui.created_date,
      updated_at: ui.created_date,
      deleted_at: null,
    };
  });

  // Histórico de lote: intervalo aberto por animal (projeção compatível).
  const animalLotes = [];
  const byAnimal = new Map();
  for (const ui of uiEntries) {
    const list = byAnimal.get(ui.animal_id) || [];
    list.push(ui);
    byAnimal.set(ui.animal_id, list);
  }
  for (const [animalId, list] of byAnimal) {
    list.sort((left, right) => left.data_pesagem.localeCompare(right.data_pesagem));
    let current = null;
    for (const ui of list) {
      if (ui.lote_id && current?.lote_id !== ui.lote_id) {
        if (current) current.fim = ui.data_pesagem;
        current = { id: random.uuid(), animal_id: animalId, lote_id: ui.lote_id, apartacao_id: ui.apartacao_id, inicio: ui.data_pesagem, fim: null, origem: 'massa-teste', created_at: createdAt, updated_at: createdAt, deleted_at: null };
        animalLotes.push(current);
      }
    }
  }

  return {
    massKey,
    label: spec.label,
    seed,
    empresaId,
    stores: {
      apartacoes: apartacaoRows,
      loteApartacoes,
      animais,
      animalIdentificadores,
      sessoesPesagem: [...sessionsByDate.values()],
      animalLotes,
      pesagens,
    },
    summary: {
      pesagens: pesagens.length,
      animais: animais.length,
      sessoes: sessionsByDate.size,
      apartacoes: apartacaoRows.length,
      lotes: loteApartacoes.length,
      animalLotes: animalLotes.length,
    },
  };
}

/**
 * Grava a massa no banco Dexie informado, em lotes, dentro de transações.
 * Apaga somente o conteúdo das stores tocadas — o chamador decide se o banco
 * deve estar vazio (deleteDbForTests) antes de semear.
 */
export async function seedTestMass(db, mass, { chunkSize = 5_000, onProgress } = {}) {
  const names = Object.keys(mass.stores);
  const tables = names.map((name) => db.table(name));
  let written = 0;
  const total = names.reduce((sum, name) => sum + mass.stores[name].length, 0);
  for (const name of names) {
    const rows = mass.stores[name];
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      await db.transaction('rw', tables, async () => {
        await db.table(name).bulkAdd(chunk);
      });
      written += chunk.length;
      onProgress?.({ store: name, written, total });
    }
  }
  return { written, total };
}
