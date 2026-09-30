// Fontes dos grãos LOT, LOT_STAY, SHIPMENT_DOCUMENT, AUDIT_ENTRY, DATA_ISSUE, BACKUP_ENTRY e
// REGISTRY_ITEM. Leituras indexadas quando há índice útil; stores pequenas lidas inteiras.
// Nenhuma fonte devolve credenciais (usuários: só campos seguros, montados aqui).
import { readByKeys } from './readByKeys.js';
import storage from '../../../../storage/storageAdapter.js';
import { logicalIntegrity } from '../../../../storage/indexedDb/health/health.js';
import { daysBetween } from '../../domain/reportPeriod.js';
import { toFiniteNumber } from '../../domain/aggregateEngine.js';
import { dedupeById, storageRowToEventViewModel } from './eventRows.js';
import { normalizeText } from '../../domain/filterEngine.js';
import { storageRecordToViewModel } from '../../../weighing/domain/weighingMapper.js';
import { compareWeighingEvents, measuredWeightOf } from '../../../weighing/domain/weighingSeries.js';

const active = (rows) => rows.filter((row) => !row.deleted_at);
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const now = () => performance.now();

function timed(startedAt, queriedAt, rows, strategy, rowsRead, warnings = []) {
  return { rows, strategy, rowsRead, timings: { query: queriedAt - startedAt, transform: now() - queriedAt }, warnings };
}

/** Lotes com ocupação atual (projeção `animais.lote_atual_id`). */
export async function loadLotRows({ empresaId } = {}) {
  const db = await storage.ensureReady();
  const startedAt = now();
  const [lots, apartacoes, animais] = await Promise.all([
    db.table('loteApartacoes').toArray(), db.table('apartacoes').toArray(), db.table('animais').where('situacao').equals('ATIVO').toArray(),
  ]);
  const queriedAt = now();
  const apartacaoById = byId(active(apartacoes));
  const animalsByLot = new Map();
  for (const animal of active(animais)) {
    if (empresaId && animal.empresa_id && animal.empresa_id !== empresaId) continue;
    if (!animal.lote_atual_id) continue;
    const list = animalsByLot.get(animal.lote_atual_id) || [];
    list.push(animal);
    animalsByLot.set(animal.lote_atual_id, list);
  }
  const rows = active(lots).map((lot) => {
    const members = animalsByLot.get(lot.id) || [];
    const weights = members.map((animal) => toFiniteNumber(animal.ultimo_peso_kg)).filter((value) => value !== null);
    const capacity = toFiniteNumber(lot.quantidade_maxima);
    const hasCapacity = capacity !== null && capacity > 0;
    return {
      id: lot.id,
      lote_id: lot.id,
      lote: lot.nome_lote ?? lot.nome ?? null,
      apartacao_id: lot.apartacao_id ?? null,
      apartacao: apartacaoById.get(lot.apartacao_id)?.nome_apartacao ?? lot.nome_apartacao ?? null,
      situacao_lote: lot.fechado || lot.situacao === 'FECHADO' ? 'FECHADO' : 'ABERTO',
      capacidade: hasCapacity ? capacity : null,
      animais: members.length,
      animais_com_peso: weights.length,
      animais_x100_com_capacidade: hasCapacity ? members.length * 100 : null,
      ocupacao: hasCapacity ? (members.length / capacity) * 100 : null,
      peso_medio_atual: weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : null,
      peso_min_lote: weights.length ? weights.reduce((low, value) => (value < low ? value : low), Infinity) : null,
      peso_max_lote: weights.length ? weights.reduce((high, value) => (value > high ? value : high), -Infinity) : null,
    };
  });
  return timed(startedAt, queriedAt, rows, 'stores:loteApartacoes+index:animais.situacao', lots.length + animais.length);
}

/** Permanências animal×lote que tocam o período (projeção animalLotes, recriada a partir dos eventos). */
export async function loadLotStayRows({ period, today } = {}) {
  const db = await storage.ensureReady();
  const startedAt = now();
  // `inicio` indexado: toda permanência que começou até o fim do período; as encerradas antes do início são descartadas.
  const stays = active(await db.table('animalLotes').where('inicio').belowOrEqual(period.to).toArray());
  const queriedAt = now();
  // Encerrada no primeiro dia do período = mudou de lote nesse dia: não conta no lote anterior.
  const relevant = stays.filter((stay) => !stay.fim || stay.fim > period.from);
  const animalIds = [...new Set(relevant.map((stay) => stay.animal_id))];
  const [animals, lots, apartacoes, allStaysOfAnimals] = await Promise.all([
    readByKeys(db.table('animais'), 'id', animalIds),
    db.table('loteApartacoes').toArray(),
    db.table('apartacoes').toArray(),
    readByKeys(db.table('animalLotes'), 'animal_id', animalIds),
  ]);
  const animalById = byId(active(animals));
  const lotById = byId(active(lots));
  const apartacaoById = byId(active(apartacoes));
  const previousOf = new Map();
  const staysByAnimal = new Map();
  for (const stay of active(allStaysOfAnimals)) {
    const list = staysByAnimal.get(stay.animal_id) || [];
    list.push(stay);
    staysByAnimal.set(stay.animal_id, list);
  }
  for (const list of staysByAnimal.values()) {
    list.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    list.forEach((stay, index) => previousOf.set(stay.id, index > 0 ? list[index - 1] : null));
  }
  const rows = relevant.map((stay) => {
    const animal = animalById.get(stay.animal_id) || {};
    const previous = previousOf.get(stay.id) ?? null;
    const lot = lotById.get(stay.lote_id);
    // Dias DENTRO do período: [max(início, de), min(fim ou hoje, até)].
    const clipStart = stay.inicio > period.from ? stay.inicio : period.from;
    const rawEnd = stay.fim || today;
    const clipEnd = rawEnd && rawEnd < period.to ? rawEnd : period.to;
    return {
      id: stay.id,
      animal_id: stay.animal_id,
      numero_animal: animal.numero_animal ?? null,
      marca: animal.marca ?? null,
      marca_id: animal.marca_id ?? null,
      sexo: animal.sexo ?? null,
      lote_id: stay.lote_id,
      lote: lot?.nome_lote ?? null,
      apartacao_id: stay.apartacao_id ?? lot?.apartacao_id ?? null,
      apartacao: apartacaoById.get(stay.apartacao_id ?? lot?.apartacao_id)?.nome_apartacao ?? lot?.nome_apartacao ?? null,
      lote_origem_id: previous?.lote_id ?? null,
      lote_origem: previous ? lotById.get(previous.lote_id)?.nome_lote ?? null : null,
      inicio: stay.inicio,
      fim: stay.fim ?? null,
      dias_no_lote: clipEnd && clipEnd >= clipStart ? daysBetween(clipStart, clipEnd) : null,
      mudanca: Boolean(previous),
      // Mesma regra da antiga condição fixa de "Mudanças de lote": entrada entre de e até (dia civil).
      entrada_no_periodo: Boolean(stay.inicio) && String(stay.inicio).slice(0, 10) >= period.from && String(stay.inicio).slice(0, 10) <= period.to,
    };
  });
  return timed(startedAt, queriedAt, rows, 'index:animalLotes.inicio', stays.length);
}

/** Documentos de embarque × saídas vinculadas (previsto × realizado). */
export async function loadShipmentDocumentRows({ period } = {}) {
  const db = await storage.ensureReady();
  const startedAt = now();
  const [documents, shipments] = await Promise.all([db.table('documentosEmbarque').toArray(), db.table('embarques').toArray()]);
  // Saídas pelo índice tipo_pesagem (o vínculo com o documento vive no payload, sem índice).
  const exits = active(await db.table('pesagens').where('tipo_pesagem').equals('Saída').toArray());
  const queriedAt = now();
  const shipmentById = byId(active(shipments));
  const byDocument = new Map();
  // Mesma transformação das pesagens (payload em texto JSON incluído) e deduplicação por id.
  for (const exit of dedupeById(exits.map(storageRowToEventViewModel).filter(Boolean))) {
    const documentId = exit.documento_embarque_id;
    if (!documentId) continue;
    const list = byDocument.get(documentId) || [];
    list.push({ sexo: exit.sexo ?? null, peso: toFiniteNumber(exit.peso) });
    byDocument.set(documentId, list);
  }
  const rows = active(documents).map((document) => {
    const shipment = shipmentById.get(document.embarque_id) || {};
    const linked = byDocument.get(document.id) || [];
    const prevMachos = toFiniteNumber(document.qtd_prev_machos);
    const prevFemeas = toFiniteNumber(document.qtd_prev_femeas);
    const prevTotal = prevMachos === null && prevFemeas === null ? null : (prevMachos ?? 0) + (prevFemeas ?? 0);
    const weights = linked.map((item) => item.peso).filter((value) => value !== null);
    return {
      id: document.id,
      embarque_id: document.embarque_id ?? null,
      embarque: shipment.nome ?? document.embarque_nome ?? null,
      data_embarque: shipment.data ?? null,
      destino: shipment.frigorifico ?? null,
      status_embarque: shipment.status ?? null,
      tipo_documento: document.tipo_documento ?? document.tipo ?? null,
      numero_gta: document.numero_gta ?? null,
      numero_nfe: document.numero_nfe ?? null,
      motorista: document.motorista_nome ?? null,
      placa: document.placa_carreta ?? null,
      prev_machos: prevMachos,
      prev_femeas: prevFemeas,
      prev_total: prevTotal,
      real_machos: linked.filter((item) => item.sexo === 'M').length,
      real_femeas: linked.filter((item) => item.sexo === 'F').length,
      real_sem_sexo: linked.filter((item) => item.sexo !== 'M' && item.sexo !== 'F').length,
      real_total: linked.length,
      diferenca_total: prevTotal === null ? null : linked.length - prevTotal,
      peso_total_real: weights.length ? weights.reduce((sum, value) => sum + value, 0) : null,
    };
  // Com período, documento sem data de embarque fica de fora (não infla todos os períodos).
  }).filter((row) => !period || (row.data_embarque && row.data_embarque >= period.from && row.data_embarque <= period.to));
  return timed(startedAt, queriedAt, rows, 'stores:documentosEmbarque+index:pesagens.tipo_pesagem', documents.length + exits.length);
}

/** Auditoria do período pelo índice created_at. Nunca devolve antes/depois (podem conter valores). */
export async function loadAuditRows({ period } = {}) {
  const db = await storage.ensureReady();
  const startedAt = now();
  const from = new Date(`${period.from}T00:00:00`).toISOString();
  const to = new Date(`${period.to}T23:59:59.999`).toISOString();
  const entries = await db.table('auditoria').where('created_at').between(from, to, true, true).toArray();
  const queriedAt = now();
  const users = byId(active(await db.table('usuarios').toArray()));
  const pad = (value) => String(value).padStart(2, '0');
  const rows = entries.map((entry) => {
    const date = new Date(entry.created_at);
    return {
      id: entry.id,
      data_hora: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
      dia: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      usuario_id: entry.usuario_id ?? null,
      usuario_nome: entry.usuario_nome_snapshot ?? users.get(entry.usuario_id)?.nome ?? (entry.usuario_id ? null : 'Sistema'),
      entidade: entry.entidade ?? null,
      acao: entry.acao ?? null,
      registro: entry.entidade_id ?? null,
      resumo: entry.resumo ?? null,
      campos_alterados: Array.isArray(entry.campos_alterados) ? entry.campos_alterados.join(', ') : null,
      origem: entry.origem ?? null,
      motivo: entry.motivo ?? null,
    };
  });
  return timed(startedAt, queriedAt, rows, 'index:auditoria.created_at', entries.length);
}

const ISSUE_RULES = [
  [/órfão/, 'Referência quebrada', 'ALTA'],
  [/duplicado/, 'Identificador duplicado', 'ALTA'],
  [/sem credencial/, 'Usuário sem credencial', 'ALTA'],
  [/inválid|anterior ao início/, 'Dado inválido', 'MEDIA'],
  [/fora do enum/, 'Valor fora do padrão', 'MEDIA'],
  [/sem marca_id|sem id/, 'Campo estrutural ausente', 'MEDIA'],
];

function classifyIssue(text) {
  const [, area = 'geral', registro = null] = String(text).match(/^(\S+)\s+([^:]+):/) || [];
  const descricao = String(text).includes(':') ? String(text).slice(String(text).indexOf(':') + 1).trim() : String(text);
  const rule = ISSUE_RULES.find(([pattern]) => pattern.test(descricao)) || [null, 'Outro', 'BAIXA'];
  return { area, registro, descricao, categoria_problema: rule[1], gravidade: rule[2] };
}

// E1G (A6): número de brinco só com algarismos (e ",0"/".0" do Excel) sem os zeros à esquerda — "07", "7" e "7,0"
// viram "7". Texto com letra não tem forma numérica (null). Só para APONTAR parecidos; nada é regravado.
export function similarNumberKey(numero) {
  const text = String(numero ?? '').trim();
  const match = /^(\d+)(?:[.,]0+)?$/.exec(text);
  if (!match) return null;
  return match[1].replace(/^0+(?=\d)/, '');
}

const isBlankValue = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
const brDate = (value) => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '-');
const numberOf = (animal) => String(animal.numero_animal ?? animal.identificacao_normalizada ?? '').trim();

/**
 * E1G (A6): apontamentos do GMD (só leitura): "Animal com uma pesagem só" (ativo, sem pesagem anterior: sem GMD),
 * "Manejo sem GMD" com o motivo e "Números parecidos (zeros à esquerda)" (mesmo número e marca escritos de outro
 * jeito: a série pode estar partida em dois animais). Função pura sobre a projeção `animais` e as pesagens (view
 * models de Cadastro e Manejo — animal ativo não tem Saída).
 * @returns {{ area, registro, descricao, categoria_problema, gravidade }[]}
 */
export function gmdDataIssues({ animais = [], pesagens = [], marcaNames = new Map() } = {}) {
  const issues = [];
  const push = (area, registro, descricao, categoria, gravidade) => issues.push({ area, registro, descricao, categoria_problema: categoria, gravidade });
  const byAnimal = new Map();
  for (const view of pesagens) {
    if (!view?.animal_id) continue;
    const list = byAnimal.get(view.animal_id) || [];
    list.push(view);
    byAnimal.set(view.animal_id, list);
  }
  for (const list of byAnimal.values()) list.sort(compareWeighingEvents);
  const liveAnimals = active(animais);

  for (const animal of liveAnimals) {
    if (animal.situacao !== 'ATIVO') continue;
    const weighed = (byAnimal.get(animal.id) || []).filter((view) => measuredWeightOf(view) !== null);
    if (weighed.length !== 1) continue;
    push('animais', animal.id, `animal ${numberOf(animal)} tem uma pesagem só (${brDate(weighed[0].data_pesagem)}): sem pesagem anterior, fica sem GMD`, 'Animal com uma pesagem só', 'BAIXA');
  }

  for (const view of pesagens) {
    if (view?.tipo_manejo !== 'Manejo' || !isBlankValue(view.gmd)) continue;
    const date = String(view.data_pesagem || '').slice(0, 10);
    let motivo;
    if (measuredWeightOf(view) === null) motivo = 'pesagem sem peso';
    else if (!view.animal_id) motivo = 'pesagem sem animal_id (registro legado): o histórico do animal não foi encontrado';
    else {
      const others = (byAnimal.get(view.animal_id) || []).filter((item) => item !== view && measuredWeightOf(item) !== null);
      if (others.some((item) => String(item.data_pesagem || '').slice(0, 10) < date)) motivo = 'há pesagem anterior, mas o GMD não foi gravado: edite a pesagem para recalcular';
      else if (others.some((item) => String(item.data_pesagem || '').slice(0, 10) === date)) motivo = 'mesma data da pesagem anterior: o GMD conta a partir do dia seguinte';
      else motivo = 'sem pesagem com peso antes desta data';
    }
    push('pesagens', view.id, `manejo do animal ${view.numero_animal ?? ''} em ${brDate(date)} sem GMD: ${motivo}`, 'Manejo sem GMD', 'MEDIA');
  }

  const groups = new Map();
  for (const animal of liveAnimals) {
    const key = similarNumberKey(numberOf(animal));
    if (key === null) continue;
    const brand = animal.marca_id || normalizeText((animal.marca_id && marcaNames.get(animal.marca_id)) || animal.marca || '');
    const groupKey = `${key}::${brand}`;
    const list = groups.get(groupKey) || [];
    list.push(animal);
    groups.set(groupKey, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2 || new Set(list.map(numberOf)).size < 2) continue;
    for (const animal of list) {
      const others = [...new Set(list.filter((item) => item !== animal).map((item) => `"${numberOf(item)}"`))].join(', ');
      const brand = (animal.marca_id && marcaNames.get(animal.marca_id)) || animal.marca || 'sem marca';
      push('animais', animal.id, `animal "${numberOf(animal)}" (marca ${brand}) parecido com ${others}: mesmo número sem zeros à esquerda — pode ser o mesmo animal com a série partida`, 'Números parecidos (zeros à esquerda)', 'MEDIA');
    }
  }
  return issues;
}

/** Qualidade dos dados: verificação lógica existente + checagens de dados legados para relatórios. */
export async function loadDataIssueRows() {
  const db = await storage.ensureReady();
  const startedAt = now();
  const result = await logicalIntegrity();
  // Mensagens sobre usuários citam o login: removido (dado pessoal fora do relatório de usuários).
  const issues = (result?.issues ?? result?.problems ?? (Array.isArray(result) ? result : [])).map((text, index) => ({ id: `integridade-${index}`, ...classifyIssue(String(text).replace(/\s*\([^)]*\)\s*$/, (match) => (/credencial/.test(text) ? '' : match))) }));
  const [animais, pesagens, marcas] = await Promise.all([db.table('animais').toArray(), db.table('pesagens').where('tipo_pesagem').anyOf(['Cadastro', 'Manejo']).toArray(), db.table('marcas').toArray()]);
  const queriedAt = now();
  let seq = 0;
  const push = (area, registro, descricao, categoria, gravidade) => issues.push({ id: `extra-${seq += 1}`, area, registro, descricao, categoria_problema: categoria, gravidade });
  for (const animal of active(animais)) {
    if (animal.situacao === 'ATIVO' && animal.categoria_automatica !== false && !animal.categoria_id) push('animais', animal.id, `animal ${animal.numero_animal ?? ''} ativo com categoria automática sem faixa correspondente`, 'Classificação ausente', 'BAIXA');
    if (animal.situacao === 'ATIVO' && animal.ultimo_peso_kg == null) push('animais', animal.id, `animal ${animal.numero_animal ?? ''} ativo sem peso atual`, 'Campo estrutural ausente', 'MEDIA');
  }
  for (const row of active(pesagens)) {
    const payload = typeof row.legacy_payload === 'object' && row.legacy_payload ? row.legacy_payload : {};
    if (!row.animal_id) push('pesagens', row.id, 'pesagem sem animal_id (registro legado: animais únicos por número+marca)', 'Registro legado', 'MEDIA');
    if (payload.marca && !payload.marca_id) push('pesagens', row.id, `marca "${payload.marca}" gravada só como texto (anterior à 1.2.0)`, 'Cadastro não resolvido', 'BAIXA');
  }
  // E1G (A6): apontamentos do GMD sobre as MESMAS leituras (Cadastro e Manejo; animal ativo não tem Saída).
  const marcaNames = new Map(active(marcas).map((row) => [row.id, row.nome]));
  const views = active(pesagens).map((row) => storageRecordToViewModel(row)).filter(Boolean);
  for (const issue of gmdDataIssues({ animais, pesagens: views, marcaNames })) push(issue.area, issue.registro, issue.descricao, issue.categoria_problema, issue.gravidade);
  return timed(startedAt, queriedAt, issues, 'health:logicalIntegrity+stores', issues.length);
}

export async function loadBackupRows() {
  const db = await storage.ensureReady();
  const startedAt = now();
  const entries = await db.table('backupHistory').toArray();
  const queriedAt = now();
  const pad = (value) => String(value).padStart(2, '0');
  const rows = entries.map((entry) => {
    let details = {};
    try { details = typeof entry.detalhes === 'string' ? JSON.parse(entry.detalhes) : entry.detalhes || {}; } catch { details = {}; }
    const date = new Date(entry.created_at);
    const file = details.path ?? details.file ?? details.backup?.path ?? null;
    return {
      id: entry.id ?? entry.localId,
      data_hora: Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
      tipo: entry.tipo ?? null,
      arquivo: file ? String(file).split(/[\\/]/).pop() : null,
      tamanho_bytes: toFiniteNumber(details.size ?? details.backup?.size),
      sha256: details.sha256 ?? details.integrity?.sha256 ?? details.backup?.sha256 ?? null,
      formato: details.formatVersion ?? details.manifest?.formatVersion ?? null,
    };
  });
  return timed(startedAt, queriedAt, rows, 'store:backupHistory', entries.length);
}

const SAFE_USER_FIELDS = ['id', 'nome', 'login', 'role', 'ativo', 'last_login_at', 'created_at'];

export async function loadRegistryRows({ store } = {}) {
  const db = await storage.ensureReady();
  const startedAt = now();
  const records = active(await db.table(store).toArray());
  const queriedAt = now();
  const rows = records.map((record) => {
    if (store === 'usuarios') {
      // Projeção segura campo a campo: hash, salt, chave de recuperação e afins nunca saem daqui.
      const safe = Object.fromEntries(SAFE_USER_FIELDS.map((field) => [field, record[field] ?? null]));
      return { id: safe.id, nome: safe.nome, login: safe.login, perfil: safe.role, ativo: safe.ativo !== false, ultimo_acesso: safe.last_login_at, criado_em: safe.created_at ? String(safe.created_at).slice(0, 10) : null };
    }
    return {
      id: record.id,
      nome: record.nome ?? null,
      ativo: record.ativo !== false,
      padrao: record.padrao === true,
      criado_em: record.created_at ? String(record.created_at).slice(0, 10) : null,
      abreviacao: record.abreviacao ?? null,
      grupo: record.grupo ?? null,
      sexo_aplicavel: record.sexo_aplicavel ?? null,
      peso_min_kg: toFiniteNumber(record.peso_min_kg),
      peso_max_kg: toFiniteNumber(record.peso_max_kg),
      era: record.era ?? null,
      ordem: toFiniteNumber(record.ordem),
      tipo_pessoa: record.tipo_pessoa ?? null,
      documento: record.documento ?? null,
      papeis: Array.isArray(record.papeis) ? record.papeis.join(', ') : record.papeis ?? null,
      cidade: record.cidade ?? null,
      uf: record.uf ?? null,
      registro_sif: record.registro_sif ?? null,
      rendimento_padrao: toFiniteNumber(record.rendimento_padrao),
      tipo: record.tipo ?? null,
      municipio: record.municipio ?? null,
      codigo_oficial: record.codigo_oficial ?? null,
      categoria: record.categoria ?? null,
      exige_observacao: record.exige_observacao === true,
    };
  });
  return timed(startedAt, queriedAt, rows, `store:${store}`, records.length);
}
