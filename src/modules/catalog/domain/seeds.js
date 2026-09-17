// Seeds dos cadastros mestres (docs 12 §3.1) — FONTE ÚNICA para a primeira
// execução e para o backfill v7 (B2/B3/B6): categorias usuais, raça padrão
// Nelore e uma propriedade PROPRIA padrão. Ids sempre gerados, nunca fixos.
// Idempotente: verifica por nome (inclusive registros excluídos, para não
// recriar o que o responsável removeu de propósito).
//
// Faixas de peso e era ficam vazias: são definidas pelo responsável na tela de
// Categorias. Sem faixa de peso a categoria não entra na escolha automática.
const categoria = (nome, sexo, ordem) => ({ nome, sexo_aplicavel: sexo, peso_min_kg: null, peso_max_kg: null, era: null, ordem });
export const CATEGORIAS_SEED = Object.freeze([
  categoria('Bezerro', 'M', 1),
  categoria('Bezerra', 'F', 2),
  categoria('Garrote', 'M', 3),
  categoria('Novilha', 'F', 4),
  categoria('Boi', 'M', 5),
  categoria('Vaca', 'F', 6),
  categoria('Touro', 'M', 7),
].map((seed) => Object.freeze(seed)));

export const RACA_PADRAO_SEED = Object.freeze({ nome: 'Nelore', grupo: 'ZEBUINO', ordem: 1 });
export const PROPRIEDADE_PADRAO_SEED = Object.freeze({ nome: 'Propriedade principal', tipo: 'PROPRIA' });

// `services` = { categoryService, breedService, propertyService }: instâncias
// injetadas (application/registryServices.js) ou substitutos em testes.
// Devolve quantos registros foram criados por store; zero em toda reexecução.
export async function applySeeds({ categoryService, breedService, propertyService }, empresaId = 'local') {
  const criados = { categoriasAnimal: 0, racas: 0, propriedades: 0 };
  const opts = { empresaId, incluirExcluidos: true };

  for (const seed of CATEGORIAS_SEED) {
    if (await categoryService.resolveByName(seed.nome, opts)) continue;
    await categoryService.create(null, { ...seed, empresa_id: empresaId });
    criados.categoriasAnimal += 1;
  }

  if (!(await breedService.resolveByName(RACA_PADRAO_SEED.nome, opts))) {
    const jaTemPadrao = Boolean(await breedService.getDefault({ empresaId }));
    await breedService.create(null, { ...RACA_PADRAO_SEED, padrao: !jaTemPadrao, empresa_id: empresaId });
    criados.racas += 1;
  }

  // Propriedade padrão só quando a empresa ainda não tem nenhuma propriedade:
  // se o responsável já cadastrou (ou renomeou) a sua, nada é acrescentado.
  const propriedades = await propertyService.list({ empresaId, incluirInativos: true });
  if (!propriedades.length && !(await propertyService.resolveByName(PROPRIEDADE_PADRAO_SEED.nome, opts))) {
    await propertyService.create(null, { ...PROPRIEDADE_PADRAO_SEED, padrao: true, empresa_id: empresaId });
    criados.propriedades += 1;
  }

  return criados;
}

// Seeds pelas instâncias oficiais dos serviços (backfill v7 e primeira
// execução importam daqui). Import dinâmico: o domínio não depende da camada de
// aplicação em tempo de carga e não há ciclo estático com application/index.js.
export async function ensureSeeds(empresaId = 'local') {
  const { categoryService, breedService, propertyService } = await import('../application/registryServices.js');
  return applySeeds({ categoryService, breedService, propertyService }, empresaId);
}
