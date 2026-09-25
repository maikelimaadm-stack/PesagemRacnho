// Linhas canônicas do grão EVENT. Uma única transformação alimenta a Relação de Pesagens e os
// relatórios de pesagens: mesma deduplicação, mesmos nomes de cadastro, mesmos campos.
import { storageRecordToViewModel } from '../../../weighing/domain/weighingMapper.js';
import { pendenciesOf } from '../../../operations/domain/closingPendencies.js';
import { normalizeCarcassYield } from '../../../weighing/domain/commercialCalculations.js';
import { normalizeText } from '../../domain/filterEngine.js';

/**
 * Deduplica por id de domínio mantendo a linha ativa mais recente (maior localId).
 * O `id` de pesagem não é único no IndexedDB (chave primária é localId).
 */
export function dedupeById(rows) {
  const byId = new Map();
  const withoutId = [];
  for (const row of rows) {
    if (row.id === null || row.id === undefined) { withoutId.push(row); continue; }
    const current = byId.get(row.id);
    const localId = row._localId ?? row.localId ?? -1;
    if (!current || localId > (current._localId ?? current.localId ?? -1)) byId.set(row.id, row);
  }
  return [...byId.values(), ...withoutId];
}

const nameMap = (rows, label = (row) => row.nome) => new Map((rows || []).filter((row) => !row.deleted_at).map((row) => [row.id, label(row)]));

// E1B: divisor da @ de PESO VIVO (kg por arroba) levado a cada linha — 30 (padrão) ou 15, vindo de
// Configurações › Relatórios pelo runReport. Não é a @ de carcaça do Comercial (carcaça ÷ 15).
export const DEFAULT_LIVE_ARROBA_DIVISOR = 30;
export const LIVE_ARROBA_DIVISORS = Object.freeze([30, 15]);

export function normalizeLiveArrobaDivisor(value) {
  const number = Number(value);
  return LIVE_ARROBA_DIVISORS.includes(number) ? number : DEFAULT_LIVE_ARROBA_DIVISOR;
}

const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Faixa de peso do lote (cadastro ATUAL): só pelo id — nome de lote se repete entre apartações.
const lotRangeMap = (rows) => new Map((rows || []).filter((row) => !row.deleted_at && row.id)
  .map((row) => [row.id, { min: finiteOrNull(row.peso_minimo), max: finiteOrNull(row.peso_maximo) }]));

function sessionLabel(session) {
  const date = String(session.data || '').split('-').reverse().join('/');
  const status = session.status ? ` · ${String(session.status).toLowerCase()}` : '';
  return `${date}${status}`;
}

/** Mapas id → nome a partir das stores de cadastro (pequenas) e das entidades referenciadas. */
const idByName = (rows) => {
  const map = new Map();
  const ambiguous = new Set();
  for (const row of (rows || []).filter((item) => !item.deleted_at)) {
    const key = normalizeText(row.nome);
    if (!key) continue;
    if (map.has(key) && map.get(key) !== row.id) ambiguous.add(key);
    map.set(key, row.id);
  }
  for (const key of ambiguous) map.delete(key);
  return map;
};

/** Número+marca (texto normalizado) → id do animal, só quando a identidade é única. */
export function buildAnimalIdentityIndex(animals = [], marcaNames = new Map()) {
  const map = new Map();
  const ambiguous = new Set();
  for (const animal of animals.filter((row) => !row.deleted_at)) {
    const brand = (animal.marca_id && marcaNames.get(animal.marca_id)) || animal.marca;
    const key = `${normalizeText(animal.numero_animal ?? animal.identificacao_normalizada)}::${normalizeText(brand)}`;
    if (map.has(key) && map.get(key) !== animal.id) ambiguous.add(key);
    map.set(key, animal.id);
  }
  for (const key of ambiguous) map.delete(key);
  return map;
}

export function buildEventLookups({ marcas, racas, categorias, apartacoes, lotes, sessoes, usuarios, animais, salesPolicy = {}, animalIdentity = null, arrobaDivisor = DEFAULT_LIVE_ARROBA_DIVISOR } = {}) {
  return {
    salesPolicy,
    arrobaDivisor: normalizeLiveArrobaDivisor(arrobaDivisor),
    loteFaixas: lotRangeMap(lotes),
    // Texto do evento → id do cadastro (grafias diferentes do mesmo cadastro no mesmo grupo).
    marcaIdByName: idByName(marcas),
    racaIdByName: idByName(racas),
    // Registros legados sem animal_id → animal por número+marca (só identidade única).
    animalIdentity: animalIdentity || new Map(),
    marcas: nameMap(marcas),
    racas: nameMap(racas),
    categorias: nameMap(categorias),
    apartacoes: nameMap(apartacoes, (row) => row.nome_apartacao ?? row.nome),
    lotes: nameMap(lotes, (row) => row.nome_lote ?? row.nome),
    sessoes: nameMap(sessoes, sessionLabel),
    // Ordem cronológica da sessão no agrupamento (o rótulo "dd/mm/aaaa · status" não ordena por data).
    sessoesOrdem: nameMap(sessoes, (row) => (row.data ? `${row.data}|${row.created_at ?? ''}` : null)),
    // Só o nome: nenhum outro campo de usuário entra em relatório.
    usuarios: nameMap(usuarios, (row) => row.nome ?? row.login ?? null),
    situacaoAnimal: new Map((animais || []).filter((row) => !row.deleted_at).map((row) => [row.id, row.situacao ?? null])),
  };
}

/**
 * View models (storageRecordToViewModel) → event rows enriquecidas. Função pura.
 * `documentCounts` conta pesagens por documento dentro da população recebida.
 */
export function enrichEventRows(viewModels, lookups = buildEventLookups()) {
  const rows = dedupeById(viewModels);
  const documentCounts = new Map();
  for (const row of rows) {
    if (row.documento_embarque_id) documentCounts.set(row.documento_embarque_id, (documentCounts.get(row.documento_embarque_id) || 0) + 1);
  }
  return rows.map((row) => {
    const resolvedAnimalId = row.animal_id || lookups.animalIdentity.get(`${normalizeText(row.numero_animal)}::${normalizeText(row.marca)}`) || null;
    // Arroba canônica exige rendimento válido: valor legado gravado sem rendimento não entra em conta.
    const validYield = normalizeCarcassYield(row.rendimento_carcaca) !== null;
    const faixa = row.lote_id ? lookups.loteFaixas?.get(row.lote_id) ?? null : null;
    return {
    ...row,
    animal_key: resolvedAnimalId || `legado:${normalizeText(row.numero_animal)}::${normalizeText(row.marca)}`,
    animal_id_resolvido: resolvedAnimalId,
    marca_grupo_id: row.marca_id || lookups.marcaIdByName.get(normalizeText(row.marca)) || null,
    raca_grupo_id: row.raca_id || lookups.racaIdByName.get(normalizeText(row.raca)) || null,
    quantidade_arrobas: validYield ? row.quantidade_arrobas ?? null : null,
    peso_carcaca_estimado: validYield ? row.peso_carcaca_estimado ?? null : null,
    marca_nome: (row.marca_id || lookups.marcaIdByName.get(normalizeText(row.marca))) ? lookups.marcas.get(row.marca_id || lookups.marcaIdByName.get(normalizeText(row.marca))) ?? null : null,
    raca_nome: (row.raca_id || lookups.racaIdByName.get(normalizeText(row.raca))) ? lookups.racas.get(row.raca_id || lookups.racaIdByName.get(normalizeText(row.raca))) ?? null : null,
    categoria_nome: row.categoria_id ? lookups.categorias.get(row.categoria_id) ?? null : null,
    lote_nome_atual: row.lote_id ? lookups.lotes.get(row.lote_id) ?? null : null,
    // E1B: faixa exigida do lote (cadastro atual) e divisor da @ viva usado nas colunas em @.
    lote_peso_minimo: faixa?.min ?? null,
    lote_peso_maximo: faixa?.max ?? null,
    arroba_divisor: lookups.arrobaDivisor ?? DEFAULT_LIVE_ARROBA_DIVISOR,
    apartacao_nome_atual: row.apartacao_id ? lookups.apartacoes.get(row.apartacao_id) ?? null : null,
    sessao_label: row.sessao_id ? lookups.sessoes.get(row.sessao_id) ?? null : null,
    sessao_ordem: row.sessao_id ? lookups.sessoesOrdem?.get(row.sessao_id) ?? null : null,
    operador_nome: row.created_by_user_id ? lookups.usuarios.get(row.created_by_user_id) ?? null : null,
    situacao_atual: resolvedAnimalId ? lookups.situacaoAnimal.get(resolvedAnimalId) ?? null : null,
    doc_qtd: row.documento_embarque_id ? documentCounts.get(row.documento_embarque_id) : null,
    // Mesmas regras do Fechamento do Dia (closingPendencies).
    pendencias: pendenciesOf(row, lookups.salesPolicy).map((item) => item.type).join(', ') || null,
    embarque_vinculado: Boolean(row.embarque_id || row.documento_embarque_id),
    };
  });
}

/** Registro Dexie → view model com os campos de topo que o mapper não projeta. */
export function storageRowToEventViewModel(row) {
  const viewModel = storageRecordToViewModel(row);
  if (!viewModel) return null;
  return {
    ...viewModel,
    sessao_id: row.sessao_id ?? viewModel.sessao_id ?? null,
    created_by_user_id: row.created_by_user_id ?? null,
    tipo_pesagem: row.tipo_pesagem ?? null,
    empresa_id: viewModel.empresa_id ?? null,
  };
}
