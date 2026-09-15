// Parte pura do resolvedor de nomes (IMPORT-TARGET-MODEL §3; backfill v7 docs 12
// §5): índice nome_normalizado → id e resolução de textos contra linhas já
// carregadas. Não conhece serviços nem banco — quem carrega as linhas é
// application/catalogResolver.js (resolveMany).
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

// Resolve `textos` contra `rows` já carregadas. Textos vazios são ignorados;
// desconhecidos saem únicos (por nome normalizado), na ordem de entrada.
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
