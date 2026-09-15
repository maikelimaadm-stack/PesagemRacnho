// Seeds dos cadastros mestres (docs 12 §3.1): categorias usuais, uma
// propriedade PROPRIA padrão e a raça padrão Nelore. Ids sempre gerados.
// Idempotente: verifica por nome (inclusive registros excluídos, para não
// recriar o que o responsável removeu de propósito).
//
// As faixas etárias são ponto de partida editável na tela de Categorias; a
// sugestão por idade (ADR-028) escolhe a primeira categoria compatível na ordem.
export const CATEGORIAS_SEED = Object.freeze([
  { nome: 'Bezerro', sexo_aplicavel: 'M', idade_min_meses: 0, idade_max_meses: 12, ordem: 1 },
  { nome: 'Bezerra', sexo_aplicavel: 'F', idade_min_meses: 0, idade_max_meses: 12, ordem: 2 },
  { nome: 'Garrote', sexo_aplicavel: 'M', idade_min_meses: 13, idade_max_meses: 24, ordem: 3 },
  { nome: 'Novilha', sexo_aplicavel: 'F', idade_min_meses: 13, idade_max_meses: 36, ordem: 4 },
  { nome: 'Boi', sexo_aplicavel: 'M', idade_min_meses: 25, idade_max_meses: null, ordem: 5 },
  { nome: 'Vaca', sexo_aplicavel: 'F', idade_min_meses: 37, idade_max_meses: null, ordem: 6 },
  { nome: 'Touro', sexo_aplicavel: 'M', idade_min_meses: 25, idade_max_meses: null, ordem: 7 },
]);

export const RACA_PADRAO_SEED = Object.freeze({ nome: 'Nelore', grupo: 'ZEBUINO', ordem: 1 });
export const PROPRIEDADE_PADRAO_SEED = Object.freeze({ nome: 'Propriedade principal', tipo: 'PROPRIA' });

// `services` = { categoryService, breedService, propertyService } (application/index.js
// injeta as instâncias; evita import circular domínio → aplicação).
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
