// Ponte de compatibilidade: entrega ao Lançamento o mesmo shape que
// registryService.loadAuxiliaryCatalogs devolvia ({ compradores, vendedores,
// frigorificos, causasMorte }), agora lido das stores `parceiros` (por papel) e
// `causasMorte` (ADR-018/ADR-024). Inclui inativos: a tela filtra `ativo !== false`.
// Some quando o Lançamento passar a selecionar parceiro_id (Fase 3).
import { DEFAULT_EMPRESA_ID, deathCauseService, partnerService, propertyService } from '../../catalog/application/index.js';

const comPapel = (parceiros, papel) => parceiros.filter((p) => Array.isArray(p.papeis) && p.papeis.includes(papel));

const itemBase = (p) => ({
  id: p.id,
  nome: p.nome,
  ativo: p.ativo !== false,
  documento: p.documento ?? null,
  telefone: p.telefone ?? null,
  cidade: p.cidade ?? null,
});

export async function loadAuxiliaryCatalogs(empresaId = DEFAULT_EMPRESA_ID) {
  const opts = { empresaId, incluirInativos: true };
  const [parceiros, propriedades, causas] = await Promise.all([
    partnerService.list(opts),
    propertyService.list(opts),
    deathCauseService.list(opts),
  ]);

  // Vendedor mostra a propriedade de origem (primeira propriedade ativa ligada a ele).
  const propriedadePorParceiro = new Map();
  for (const prop of propriedades) {
    if (prop.ativo === false || !prop.parceiro_id || propriedadePorParceiro.has(prop.parceiro_id)) continue;
    propriedadePorParceiro.set(prop.parceiro_id, prop.nome);
  }

  return {
    compradores: comPapel(parceiros, 'COMPRADOR').map(itemBase),
    vendedores: comPapel(parceiros, 'VENDEDOR').map((p) => ({ ...itemBase(p), propriedade: propriedadePorParceiro.get(p.id) ?? null })),
    frigorificos: comPapel(parceiros, 'FRIGORIFICO').map((p) => ({ ...itemBase(p), sif: p.registro_sif ?? null })),
    causasMorte: causas.map((c) => ({
      id: c.id,
      nome: c.nome,
      ativo: c.ativo !== false,
      categoria: c.categoria ?? null,
      exigeObservacao: c.exige_observacao === true,
    })),
  };
}
