// Índices em memória dos cadastros usados pela conciliação (marcas, raças, categorias,
// causas de morte, apartações e lotes), sempre da empresa da importação. Mesma regra do
// resolvedor único (catalog/domain/catalogResolver): nome normalizado, inativo resolve
// (o histórico pode citá-lo), excluído não; entre homônimos vale o ativo.
import { normalizeName } from '../../catalog/domain/normalize.js';

const live = (rows, empresaId) => (rows || []).filter((row) => row && !row.deleted_at && (row.empresa_id ?? row.empresaId ?? empresaId) === empresaId);

function registryIndex(rows, nameOf = (row) => row.nome_normalizado || normalizeName(row.nome)) {
  const byId = new Map();
  const byName = new Map();
  for (const row of rows) {
    byId.set(String(row.id), row);
    const key = nameOf(row);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || (current.ativo === false && row.ativo !== false)) byName.set(key, row);
  }
  return { rows, byId, byName };
}

// Apartações e lotes podem repetir nome (lote "MEIO" em duas apartações): guarda a lista.
function multiIndex(rows, nameOf) {
  const byId = new Map();
  const byName = new Map();
  for (const row of rows) {
    byId.set(String(row.id), row);
    const key = normalizeName(nameOf(row));
    if (!key) continue;
    byName.set(key, [...(byName.get(key) || []), row]);
  }
  return { rows, byId, byName };
}

export function buildRegistryContext({ marcas = [], racas = [], categorias = [], causas = [], apartacoes = [], lotes = [] } = {}, empresaId = 'local') {
  return {
    empresaId,
    marcas: registryIndex(live(marcas, empresaId)),
    racas: registryIndex(live(racas, empresaId)),
    causas: registryIndex(live(causas, empresaId)),
    categorias: live(categorias, empresaId),
    apartacoes: multiIndex(live(apartacoes, empresaId), (row) => row.nome_apartacao ?? row.nome),
    lotes: multiIndex(live(lotes, empresaId), (row) => row.nome_lote ?? row.nome),
  };
}

/**
 * Resolve um cadastro por id explícito (coluna *_id ou valor fixo) ou por texto.
 * → { row, invalidId, unknownText } — `unknownText` é o nome não cadastrado (cadastro mestre ausente).
 * Id que não existe nesta base (CSV técnico vindo de outra instalação) cai para o nome, quando
 * houver; `invalidId` continua preenchido para a mensagem.
 */
export function resolveRegistryReference(index, { id = null, text = null } = {}) {
  const invalidId = id ? String(id) : null;
  if (id) {
    const row = index.byId.get(String(id));
    if (row) return { row, invalidId: null, unknownText: null };
  }
  const key = normalizeName(text);
  if (!key) return { row: null, invalidId, unknownText: null };
  const row = index.byName.get(key);
  return row ? { row, invalidId, unknownText: null } : { row: null, invalidId, unknownText: String(text).trim().replace(/\s+/g, ' ') };
}
