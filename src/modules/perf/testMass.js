// Massa de teste anônima e determinística (F0 — Contratos e baseline; Programa 2.0).
// Gera animais, identificadores, sessões, lotes históricos e pesagens no mesmo
// formato persistido pelo runtime (stores Dexie), sem nomes reais, sem CPF,
// sem documentos. A mesma semente produz sempre a mesma massa.
//
// Dois esquemas de saída (docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md):
//   - "v6": formato 1.1.17 (marca/raça em texto, identificador `visual_marca`,
//     sessão "Aberta", lote `fechado`). Saída congelada: alimenta os testes de
//     migração v6 → v7.
//   - "v7" (padrão do bench): cadastros mestres como stores (ADR-018), animais e
//     identificadores por marca_id/raca_id/categoria_id/propriedade_id
//     (ADR-020/ADR-028), enums em maiúsculas (ADR-030). Os snapshots de
//     legacy_payload mantêm marca/raça em texto (histórico, ADR-021) e não
//     carregam as chaves proibidas pela ADR-027 (estado pós-backfill B10).
// Os ids de animais, pesagens, sessões e permanências são os mesmos nos dois
// esquemas para a mesma semente: o fluxo principal do PRNG é idêntico e só os
// cadastros mestres usam um fluxo derivado. Migrar a massa v6 e gerar a v7
// produzem, portanto, bases comparáveis registro a registro.
//
// Roda em Node (fake-indexeddb) e no navegador (IndexedDB real) porque só usa
// APIs presentes nos dois: Date, Map e aritmética inteira.
import { recalculateWeightSeries } from '../weighing/domain/weighingSeries.js';

export const TEST_MASSES = Object.freeze({
  vazia: { label: 'Vazia', weighings: 0, weighingsPerAnimal: 0 },
  pequena: { label: 'Pequena', weighings: 300, weighingsPerAnimal: 3 },
  '36k': { label: '36 mil', weighings: 36_000, weighingsPerAnimal: 3 },
  '250k': { label: '250 mil', weighings: 250_000, weighingsPerAnimal: 4 },
});

export const MASS_KEYS = Object.keys(TEST_MASSES);
export const MASS_SCHEMAS = Object.freeze(['v6', 'v7']);
export const DEFAULT_MASS_SCHEMA = 'v7';

const BRANDS = ['ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA'];
const BREEDS = ['Nelore', 'Angus', 'Brangus', 'Guzerá', 'Tabapuã'];
const ERAS = ['12', '18', '24', '30', '36'];
const APARTACOES = [
  { nome: 'Recria', lotes: [['Leves', 150, 280], ['Médios', 281, 380], ['Pesados', 381, 800]] },
  { nome: 'Engorda', lotes: [['E1', 150, 350], ['E2', 351, 450], ['E3', 451, 800]] },
  { nome: 'Venda', lotes: [['V1', 150, 420], ['V2', 421, 520], ['V3', 521, 800]] },
];
// Cadastros mestres fixos da massa v7 (docs 12 §3.1). Sem nomes reais nem documentos.
const BREED_GROUPS = { Nelore: 'ZEBUINO', Angus: 'TAURINO', Brangus: 'CRUZADO', Guzerá: 'ZEBUINO', Tabapuã: 'ZEBUINO' };
const CATEGORIES = [
  ['Bezerro', 'M', 0, 12], ['Bezerra', 'F', 0, 12], ['Garrote', 'M', 13, 24], ['Novilha', 'F', 13, 36],
  ['Boi', 'M', 25, null], ['Vaca', 'F', 37, null], ['Touro', 'M', 36, null],
];
const PARTNERS = [
  ['Comprador da massa', 'JURIDICA', ['COMPRADOR']],
  ['Frigorífico da massa', 'JURIDICA', ['FRIGORIFICO', 'COMPRADOR']],
  ['Fornecedor da massa', 'FISICA', ['VENDEDOR', 'PROPRIETARIO']],
];
const DEATH_CAUSES = [['Doença', 'Doença', false], ['Acidente', 'Acidente', false], ['Desconhecida', 'Desconhecida', true], ['Outra', 'Outra', true]];
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

// Regra de `nome_normalizado` dos cadastros mestres (docs 12 §1).
export const normalizeRegistryName = (value) =>
  String(value ?? '').trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ');

const isoDay = (utcMs) => new Date(utcMs).toISOString().slice(0, 10);
const isoInstant = (utcMs, offsetMinutes = 0) => new Date(utcMs + offsetMinutes * 60_000).toISOString();

function findLot(apartacao, weight) {
  return apartacao.lotes.find((lot) => weight >= lot.peso_minimo && weight <= lot.peso_maximo) || null;
}

// Cadastros mestres da massa v7. Consome só o PRNG derivado, para não deslocar
// os ids do fluxo principal (compartilhado com a saída v6).
function generateMasterRegistry(random, empresaId, createdAt) {
  const named = (nome) => ({
    id: random.uuid(),
    empresa_id: empresaId,
    nome,
    nome_normalizado: normalizeRegistryName(nome),
    ativo: true,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  });
  const parceiros = PARTNERS.map(([nome, tipoPessoa, papeis]) => ({
    ...named(nome), tipo_pessoa: tipoPessoa, documento: null, papeis, telefone: null, email: null, cidade: null, uf: null,
    // Rendimento nunca é assumido silenciosamente (ADR-025): fica nulo até ser informado.
    registro_sif: null, rendimento_padrao: null, observacao: null,
  }));
  const owner = parceiros.find((row) => row.papeis.includes('PROPRIETARIO'));
  const propriedades = [
    { ...named('Propriedade principal'), tipo: 'PROPRIA', parceiro_id: null, municipio: null, uf: null, codigo_oficial: null, padrao: true },
    { ...named('Propriedade de terceiro'), tipo: 'TERCEIRO', parceiro_id: owner.id, municipio: null, uf: null, codigo_oficial: null, padrao: false },
  ];
  const marcas = BRANDS.map((nome, index) => ({
    ...named(nome), abreviacao: null, proprietario_parceiro_id: null, propriedade_id: propriedades[0].id, padrao: index === 0, observacao: null,
  }));
  const racas = BREEDS.map((nome, index) => ({
    ...named(nome), abreviacao: null, grupo: BREED_GROUPS[nome] || 'OUTRO', padrao: nome === 'Nelore', ordem: index + 1,
  }));
  const categoriasAnimal = CATEGORIES.map(([nome, sexo, min, max], index) => ({
    ...named(nome), sexo_aplicavel: sexo, idade_min_meses: min, idade_max_meses: max, ordem: index + 1,
  }));
  const causasMorte = DEATH_CAUSES.map(([nome, categoria, exige], index) => ({
    ...named(nome), categoria, descricao: null, exige_observacao: exige, ordem: index + 1,
  }));
  return { marcas, racas, categoriasAnimal, parceiros, propriedades, causasMorte };
}

// Sugestão explicável de categoria (ADR-028): primeira compatível com sexo e idade.
function categoryFor(categorias, sexo, months) {
  return categorias.find((row) =>
    (row.sexo_aplicavel === sexo || row.sexo_aplicavel === 'AMBOS')
    && (row.idade_min_meses == null || months >= row.idade_min_meses)
    && (row.idade_max_meses == null || months <= row.idade_max_meses)) || null;
}

// Nascimento estimado a partir da "era" em meses na data do Cadastro (docs 12 §5 B7).
function estimatedBirth(dayMs, months) {
  const date = new Date(dayMs);
  date.setUTCMonth(date.getUTCMonth() - months);
  return isoDay(date.getTime());
}

/**
 * Gera a massa em memória. Retorna as linhas por store, já no formato Dexie,
 * mais os payloads de UI (legacy_payload) usados pelas telas.
 * `schema`: "v6" (saída congelada, testes de migração) ou "v7" (padrão do bench).
 */
export function generateTestMass(massKey, { seed = 20260908, empresaId = 'local', schema = DEFAULT_MASS_SCHEMA } = {}) {
  const spec = TEST_MASSES[massKey];
  if (!spec) throw new Error(`Massa desconhecida: ${massKey}. Use: ${MASS_KEYS.join(', ')}`);
  if (!MASS_SCHEMAS.includes(schema)) throw new Error(`Esquema desconhecido: ${schema}. Use: ${MASS_SCHEMAS.join(', ')}`);
  const v7 = schema === 'v7';
  const random = createRandom(seed);
  const createdAt = isoInstant(BASE_DAY);
  const registry = v7 ? generateMasterRegistry(createRandom((seed ^ 0x5a5a5a5a) >>> 0), empresaId, createdAt) : null;
  const brandIdByName = new Map((registry?.marcas || []).map((row) => [row.nome, row.id]));
  const breedIdByName = new Map((registry?.racas || []).map((row) => [row.nome, row.id]));
  const mainPropertyId = registry?.propriedades[0].id || null;

  const apartacoes = APARTACOES.map((apartacao, apartacaoIndex) => ({
    id: random.uuid(),
    empresa_id: empresaId,
    nome_apartacao: apartacao.nome,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
    ...(v7 ? { ativo: true, ordem: apartacaoIndex + 1, observacao: null } : {}),
    lotes: apartacao.lotes.map(([nome, min, max], lotIndex) => ({
      id: random.uuid(),
      empresa_id: empresaId,
      nome_lote: nome,
      peso_minimo: min,
      peso_maximo: max,
      quantidade_maxima: 100_000,
      // v7: `fechado` vira `situacao` (ADR-023); v6 mantém o booleano legado.
      ...(v7
        ? { codigo: null, situacao: 'ABERTO', categoria_id: null, data_abertura: isoDay(BASE_DAY), data_fechamento: null, ativo: true, ordem: lotIndex + 1 }
        : { fechado: false }),
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
      const id = random.uuid();
      session = v7
        ? { id, data: day, local: null, status: 'ABERTA', operador: 'MASSA', operador_user_id: null, marca_padrao_id: null, apartacao_padrao_id: null, tipo_manejo_padrao: null, snapshot: null, motivo_reabertura: null, inicio: ts, created_at: ts, updated_at: ts, deleted_at: null }
        : { id, data: day, status: 'Aberta', operador: 'MASSA', inicio: ts, created_at: ts, updated_at: ts, deleted_at: null };
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
    let registrationCreated = createdAt;

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
      if (event === 0) registrationCreated = created;
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

    const animal = {
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
    };
    // v7: ids de cadastro + situação em maiúsculas; marca/raca/era ficam como legado somente-leitura.
    animais.push(v7
      ? {
        ...animal,
        situacao: 'ATIVO',
        marca_id: brandIdByName.get(brand),
        raca_id: breedIdByName.get(raca),
        categoria_id: categoryFor(registry.categoriasAnimal, sexo, Number(era))?.id || null,
        propriedade_id: mainPropertyId,
        nascimento: estimatedBirth(registrationDay, Number(era)),
        nascimento_estimado: true,
      }
      : animal);
    const identifierId = random.uuid();
    animalIdentificadores.push(v7
      ? {
        id: identifierId,
        animal_id: animalId,
        tipo: 'VISUAL',
        valor: number,
        // v7 (ADR-020): só o número; a marca vai em marca_id e a unicidade é por [marca_id+valor_normalizado].
        valor_normalizado: number.toUpperCase(),
        marca_id: brandIdByName.get(brand),
        marca: brand,
        faixa_id: null,
        principal: true,
        ativo: true,
        inicio: registrationCreated,
        fim: null,
        motivo_troca: null,
        created_at: createdAt,
        updated_at: createdAt,
        deleted_at: null,
      }
      : {
        id: identifierId,
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
    if (v7) {
      // Estado pós-backfill B10 (ADR-027): chaves redundantes não ficam no snapshot.
      delete legacy.status_animal;
      delete legacy.created_date;
      delete legacy.updated_date;
    }
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

  const operational = {
    apartacoes: apartacaoRows,
    loteApartacoes,
    animais,
    animalIdentificadores,
    sessoesPesagem: [...sessionsByDate.values()],
    animalLotes,
    pesagens,
  };
  const summary = {
    pesagens: pesagens.length,
    animais: animais.length,
    sessoes: sessionsByDate.size,
    apartacoes: apartacaoRows.length,
    lotes: loteApartacoes.length,
    animalLotes: animalLotes.length,
  };

  return {
    massKey,
    label: spec.label,
    seed,
    empresaId,
    schema,
    // Cadastros mestres primeiro: a semeadura grava na ordem das chaves.
    stores: v7 ? { ...registry, ...operational } : operational,
    summary: v7
      ? { ...summary, marcas: registry.marcas.length, racas: registry.racas.length, categorias: registry.categoriasAnimal.length, parceiros: registry.parceiros.length, propriedades: registry.propriedades.length, causasMorte: registry.causasMorte.length }
      : summary,
  };
}

/**
 * Grava a massa no banco Dexie informado, em lotes, dentro de transações.
 * Apaga somente o conteúdo das stores tocadas — o chamador decide se o banco
 * deve estar vazio (deleteDbForTests) antes de semear. Uma store ausente no
 * esquema vigente (ex.: `lotes`, removida na v7) faz a semeadura falhar.
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
