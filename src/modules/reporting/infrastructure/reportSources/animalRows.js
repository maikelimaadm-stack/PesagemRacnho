// Linhas canônicas dos grãos ANIMAL_CURRENT e ANIMAL_PERIOD. Funções puras (testáveis em Node);
// a leitura do Dexie fica em animalSource.js.
import { daysBetween } from '../../domain/reportPeriod.js';
import { toFiniteNumber } from '../../domain/aggregateEngine.js';
import { normalizeText } from '../../domain/filterEngine.js';

const nameMap = (rows, label = (row) => row.nome) => new Map((rows || []).filter((row) => !row.deleted_at).map((row) => [row.id, label(row)]));

export function buildAnimalLookups({ marcas, racas, categorias, apartacoes, lotes, propriedades } = {}) {
  return {
    marcas: nameMap(marcas),
    racas: nameMap(racas),
    categorias: nameMap(categorias),
    apartacoes: nameMap(apartacoes, (row) => row.nome_apartacao ?? row.nome),
    lotes: nameMap(lotes, (row) => row.nome_lote ?? row.nome),
    loteApartacao: new Map((lotes || []).filter((row) => !row.deleted_at).map((row) => [row.id, row.apartacao_id ?? null])),
    propriedades: nameMap(propriedades),
  };
}

/**
 * Faixa de peso: primeira faixa (na ordem dada) com min ≤ peso ≤ max (limites ausentes = aberto).
 * Sem faixas configuradas ou sem peso → null ("Não informado").
 */
export function weightBand(weight, bands = []) {
  const value = toFiniteNumber(weight);
  if (value === null || !bands.length) return null;
  for (const band of bands) {
    const min = toFiniteNumber(band.min);
    const max = toFiniteNumber(band.max);
    if ((min === null || value >= min) && (max === null || value <= max)) return band.label;
  }
  return null;
}

/** Faixas a partir das categorias com faixa de peso configurada (contrato existente; nada inventado). */
export function bandsFromCategories(categorias = []) {
  return categorias
    .filter((row) => !row.deleted_at && row.ativo !== false && (row.peso_min_kg != null || row.peso_max_kg != null))
    .sort((a, b) => (toFiniteNumber(a.ordem) ?? 9999) - (toFiniteNumber(b.ordem) ?? 9999) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    .map((row) => ({ label: `${row.nome} (${row.sexo_aplicavel === 'F' ? 'F' : row.sexo_aplicavel === 'M' ? 'M' : 'M/F'} · ${row.peso_min_kg ?? '…'}–${row.peso_max_kg ?? '…'} kg)`, min: row.peso_min_kg, max: row.peso_max_kg, sexo: row.sexo_aplicavel ?? null }));
}

function bandFor(weight, sexo, bands) {
  // Sem sexo, faixa de categoria sexuada não se aplica (mesma regra da categoria automática).
  const applicable = bands.filter((band) => !band.sexo || band.sexo === 'AMBOS' || (sexo && band.sexo === sexo));
  return weightBand(weight, applicable);
}

/** Estado atual (projeção `animais`) → linha ANIMAL_CURRENT. */
export function toAnimalCurrentRows(animals, lookups, { today, bands = [] } = {}) {
  return animals.filter((row) => !row.deleted_at).map((animal) => {
    const loteId = animal.lote_atual_id ?? null;
    const apartacaoId = animal.apartacao_atual_id ?? (loteId ? lookups.loteApartacao.get(loteId) ?? null : null);
    const lastDate = animal.ultima_pesagem_data ?? null;
    return {
      id: animal.id,
      animal_id: animal.id,
      numero_animal: animal.numero_animal ?? animal.identificacao_normalizada ?? null,
      marca_id: animal.marca_id ?? null,
      marca_nome: (animal.marca_id && lookups.marcas.get(animal.marca_id)) || animal.marca || null,
      sexo: animal.sexo ?? null,
      raca_id: animal.raca_id ?? null,
      raca_nome: (animal.raca_id && lookups.racas.get(animal.raca_id)) || animal.raca || null,
      categoria_id: animal.categoria_id ?? null,
      categoria_nome: animal.categoria_id ? lookups.categorias.get(animal.categoria_id) ?? null : null,
      era: animal.era ?? null,
      situacao: animal.situacao ?? null,
      lote_atual_id: loteId,
      lote_atual_nome: loteId ? lookups.lotes.get(loteId) ?? null : null,
      apartacao_atual_id: apartacaoId,
      apartacao_atual_nome: apartacaoId ? lookups.apartacoes.get(apartacaoId) ?? null : null,
      propriedade_id: animal.propriedade_id ?? null,
      propriedade_nome: animal.propriedade_id ? lookups.propriedades.get(animal.propriedade_id) ?? null : null,
      ultima_pesagem_data: lastDate,
      ultimo_peso_kg: toFiniteNumber(animal.ultimo_peso_kg),
      dias_sem_pesagem: lastDate && today ? daysBetween(String(lastDate).slice(0, 10), today) : null,
      faixa_peso: bandFor(animal.ultimo_peso_kg, animal.sexo, bands),
      data_saida: animal.data_saida ?? null,
      motivo_saida: animal.motivo_saida ?? null,
      data_cadastro: animal.created_at ? String(animal.created_at).slice(0, 10) : null,
    };
  });
}

const eventOrder = (left, right) => String(left.data_pesagem || '').localeCompare(String(right.data_pesagem || ''))
  || String(left.created_date || '').localeCompare(String(right.created_date || ''))
  || String(left.id || '').localeCompare(String(right.id || ''));

/** Chave do animal no período: id; legado sem id → número+marca normalizados. */
export function animalKeyOf(event) {
  return event.animal_key || event.animal_id || `legado:${normalizeText(event.numero_animal)}::${normalizeText(event.marca)}`;
}

/**
 * Eventos do período (event rows) → uma linha por animal (ANIMAL_PERIOD).
 * Peso inicial/final = primeiro/último evento COM peso no período; ganho e dias só com ≥ 2
 * pesagens com peso; GMD = ganho ÷ dias (dias > 0). Dimensões atuais vêm da projeção do animal
 * quando existe; senão, do último evento.
 */
export function toAnimalPeriodRows(events, animalsById, lookups, { bands = [] } = {}) {
  const byAnimal = new Map();
  for (const event of events) {
    const key = animalKeyOf(event);
    const list = byAnimal.get(key);
    if (list) list.push(event);
    else byAnimal.set(key, [event]);
  }
  const rows = [];
  for (const [key, list] of byAnimal) {
    list.sort(eventOrder);
    const weighed = list.filter((event) => toFiniteNumber(event.peso) !== null && toFiniteNumber(event.peso) > 0);
    const first = weighed[0] ?? null;
    const last = weighed.at(-1) ?? null;
    const latest = list.at(-1);
    const hasPair = weighed.length >= 2;
    const dias = hasPair ? daysBetween(first.data_pesagem, last.data_pesagem) : null;
    const ganho = hasPair ? toFiniteNumber(last.peso) - toFiniteNumber(first.peso) : null;
    const animalId = list.map((event) => event.animal_id || event.animal_id_resolvido).find(Boolean) || null;
    const animal = animalId ? animalsById.get(animalId) : null;
    const loteId = latest.lote_id ?? null;
    const apartacaoId = latest.apartacao_id ?? (loteId ? lookups.loteApartacao.get(loteId) ?? null : null);
    const sexo = animal?.sexo ?? latest.sexo ?? null;
    rows.push({
      id: key,
      animal_id: animalId,
      animal_key: key,
      numero_animal: animal?.numero_animal ?? latest.numero_animal ?? null,
      marca_id: animal?.marca_id ?? latest.marca_id ?? null,
      marca_nome: ((animal?.marca_id ?? latest.marca_id) && lookups.marcas.get(animal?.marca_id ?? latest.marca_id)) || animal?.marca || latest.marca || null,
      sexo,
      raca_id: animal?.raca_id ?? latest.raca_id ?? null,
      raca_nome: ((animal?.raca_id ?? latest.raca_id) && lookups.racas.get(animal?.raca_id ?? latest.raca_id)) || animal?.raca || latest.raca || null,
      categoria_id: animal?.categoria_id ?? latest.categoria_id ?? null,
      categoria_nome: (animal?.categoria_id ?? latest.categoria_id) ? lookups.categorias.get(animal?.categoria_id ?? latest.categoria_id) ?? null : null,
      situacao: animal?.situacao ?? null,
      lote_id: loteId,
      lote_nome: loteId ? lookups.lotes.get(loteId) ?? latest.nome_lote ?? null : latest.nome_lote ?? null,
      apartacao_id: apartacaoId,
      apartacao_nome: apartacaoId ? lookups.apartacoes.get(apartacaoId) ?? latest.nome_apartacao ?? null : latest.nome_apartacao ?? null,
      pesagens: list.length,
      pesagens_com_peso: weighed.length,
      data_inicial: first?.data_pesagem ?? null,
      peso_inicial: first ? toFiniteNumber(first.peso) : null,
      data_final: last?.data_pesagem ?? null,
      peso_final: last ? toFiniteNumber(last.peso) : null,
      dias,
      ganho,
      gmd: hasPair && dias > 0 ? ganho / dias : null,
      faixa_peso: bandFor(last?.peso, sexo, bands),
    });
  }
  return rows;
}
