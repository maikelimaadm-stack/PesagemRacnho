// Seeds dos cadastros mestres (docs 12 §3.1) — FONTE ÚNICA para a primeira
// execução e para o backfill v7 (B2/B3/B6): categorias usuais, raça padrão
// Nelore e uma propriedade PROPRIA padrão. Ids sempre gerados, nunca fixos.
// Idempotente: verifica por nome (inclusive registros excluídos, para não
// recriar o que o responsável removeu de propósito).
//
// Pré-cadastro de categorias definido pelo responsável em 17/09/2026: faixa de peso por sexo
// (contígua, a última sem máximo) e a era em MESES, que é o que o cadastro aceita e o que vai
// gravado na pesagem — usamos o limite superior da faixa etária da tabela ("0 a 12 meses" → 12;
// faixas abertas "acima de 30 meses" → 36). É só um ponto de partida: quem usa pode editar,
// renomear ou apagar à vontade.
const categoria = (ordem, nome, sexo, pesoMin, pesoMax, era) => ({ nome, sexo_aplicavel: sexo, peso_min_kg: pesoMin, peso_max_kg: pesoMax, era, ordem });
export const CATEGORIAS_SEED = Object.freeze([
  categoria(1, 'Bezerro', 'M', 0, 199, 12),
  categoria(2, 'Garrote leve', 'M', 200, 269, 18),
  categoria(3, 'Garrote', 'M', 270, 329, 24),
  categoria(4, 'Boi magro', 'M', 330, 399, 30),
  categoria(5, 'Boi em engorda', 'M', 400, 449, 36),
  categoria(6, 'Boi terminado', 'M', 450, 499, 36),
  categoria(7, 'Boi pesado', 'M', 500, null, 36),
  categoria(8, 'Bezerra', 'F', 0, 199, 12),
  categoria(9, 'Novilha leve', 'F', 200, 269, 18),
  categoria(10, 'Novilha', 'F', 270, 329, 24),
  categoria(11, 'Novilha pesada', 'F', 330, 399, 30),
  categoria(12, 'Fêmea adulta', 'F', 400, null, 36),
].map((seed) => Object.freeze(seed)));

// Pré-cadastro anterior (1.2.0), sem faixa de peso. Os nomes que não continuam saem do caminho
// quando ninguém os editou nem usou; em uso ou editados, ficam como estão.
export const CATEGORIAS_SEED_ANTERIOR = Object.freeze(['Bezerro', 'Bezerra', 'Garrote', 'Novilha', 'Boi', 'Vaca', 'Touro']);

export const RACA_PADRAO_SEED = Object.freeze({ nome: 'Nelore', grupo: 'ZEBUINO', ordem: 1 });
export const PROPRIEDADE_PADRAO_SEED = Object.freeze({ nome: 'Propriedade principal', tipo: 'PROPRIA' });

// `services` = { categoryService, breedService, propertyService }: instâncias
// injetadas (application/registryServices.js) ou substitutos em testes.
// Devolve quantos registros foram criados por store; zero em toda reexecução.
export async function applySeeds({ categoryService, breedService, propertyService }, empresaId = 'local') {
  const criados = { categoriasAnimal: 0, racas: 0, propriedades: 0 };
  const opts = { empresaId, incluirExcluidos: true };

  const intocada = (registro) => registro.peso_min_kg == null && registro.peso_max_kg == null && !registro.era;
  criados.categoriasAtualizadas = 0;
  criados.categoriasRemovidas = 0;

  for (const seed of CATEGORIAS_SEED) {
    const existente = await categoryService.resolveByName(seed.nome, opts);
    if (!existente) {
      await categoryService.create(null, { ...seed, empresa_id: empresaId });
      criados.categoriasAnimal += 1;
      continue;
    }
    // Só completa o que ainda está como veio do pré-cadastro antigo (sem faixa e sem era):
    // categoria que o responsável ajustou nunca é sobrescrita.
    if (!existente.deleted_at && intocada(existente) && existente.sexo_aplicavel === seed.sexo_aplicavel) {
      await categoryService.update(null, existente.id, { peso_min_kg: seed.peso_min_kg, peso_max_kg: seed.peso_max_kg, era: seed.era, ordem: seed.ordem });
      criados.categoriasAtualizadas += 1;
    }
  }

  // Nomes do pré-cadastro anterior que não fazem parte do novo: saem se ninguém mexeu e se não
  // estão em uso (o serviço recusa excluir cadastro citado por qualquer registro).
  const nomesNovos = new Set(CATEGORIAS_SEED.map((seed) => seed.nome.toLocaleLowerCase('pt-BR')));
  for (const nome of CATEGORIAS_SEED_ANTERIOR) {
    if (nomesNovos.has(nome.toLocaleLowerCase('pt-BR'))) continue;
    const existente = await categoryService.resolveByName(nome, { empresaId });
    if (!existente || existente.deleted_at || !intocada(existente)) continue;
    try {
      await categoryService.remove(null, existente.id);
      criados.categoriasRemovidas += 1;
    } catch {
      // Em uso por algum animal/lote: fica como está (fato histórico não se apaga).
    }
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
