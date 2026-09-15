// Resolvedor de textos livres → ids de cadastro por nome normalizado
// (IMPORT-TARGET-MODEL §3; backfill v7 docs 12 §5). Um único resolvedor para a
// importação e a migração. A parte pura (buildNameIndex, resolveNamesAgainst,
// RESOLVER_GROUPS) vive em domain/catalogResolver.js; aqui fica só o que
// depende dos serviços (carregar as linhas de cada store).
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
import { getRegistryService } from './registryServices.js';
import { RESOLVER_GROUPS, resolveNamesAgainst } from '../domain/catalogResolver.js';

export { RESOLVER_GROUPS, buildNameIndex, resolveNamesAgainst } from '../domain/catalogResolver.js';

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
