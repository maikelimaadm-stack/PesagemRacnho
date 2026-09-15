// Resolvedor de textos livres → ids de cadastro por nome normalizado
// (IMPORT-TARGET-MODEL §3; backfill v7 docs 12 §5). Um único resolvedor para a
// importação e a migração.
//
// resolveMany({ marcas: ['abc', 'ABC '], racas: ['nelore'], ... }) →
// {
//   marcas: { 'abc': '<id>', 'ABC ': '<id>' },   // texto original → id
//   racas: {...}, categorias: {...}, parceiros: {...}, propriedades: {...}, causas: {...},
//   desconhecidos: { marcas: [], racas: [], ... },  // textos sem cadastro (únicos, na ordem de entrada)
//   totalDesconhecidos: n,
// }
// Textos vazios são ignorados. Registros inativos resolvem (o histórico pode
// citá-los); excluídos não.
import { getRegistryService } from '../application/index.js';
import { normalizeName } from './normalize.js';

export const RESOLVER_GROUPS = Object.freeze({
  marcas: 'marcas',
  racas: 'racas',
  categorias: 'categoriasAnimal',
  parceiros: 'parceiros',
  propriedades: 'propriedades',
  causas: 'causasMorte',
});

// nome_normalizado → id; prefere o registro ativo quando houver mais de um.
export function buildNameIndex(rows = []) {
  const index = new Map();
  for (const row of rows) {
    if (!row || row.deleted_at || !row.nome_normalizado) continue;
    const atual = index.get(row.nome_normalizado);
    if (!atual || (atual.ativo === false && row.ativo !== false)) index.set(row.nome_normalizado, row);
  }
  return new Map([...index].map(([nome, row]) => [nome, row.id]));
}

// Parte pura: resolve `textos` contra `rows` já carregadas.
export function resolveNamesAgainst(rows, textos = []) {
  const index = buildNameIndex(rows);
  const ids = {};
  const desconhecidos = [];
  const vistos = new Set();
  for (const texto of textos) {
    const alvo = normalizeName(texto);
    if (!alvo) continue;
    const id = index.get(alvo);
    if (id) {
      ids[texto] = id;
    } else if (!vistos.has(alvo)) {
      vistos.add(alvo);
      desconhecidos.push(texto);
    }
  }
  return { ids, desconhecidos };
}

export async function resolveMany(inputs = {}, { empresaId = 'local', loadRows } = {}) {
  const load = loadRows || ((store) => getRegistryService(store).list({ empresaId, incluirInativos: true }));
  const result = { desconhecidos: {}, totalDesconhecidos: 0 };
  for (const [grupo, store] of Object.entries(RESOLVER_GROUPS)) {
    const textos = Array.isArray(inputs[grupo]) ? inputs[grupo] : [];
    if (!textos.length) {
      result[grupo] = {};
      result.desconhecidos[grupo] = [];
      continue;
    }
    const { ids, desconhecidos } = resolveNamesAgainst(await load(store), textos);
    result[grupo] = ids;
    result.desconhecidos[grupo] = desconhecidos;
    result.totalDesconhecidos += desconhecidos.length;
  }
  return result;
}
