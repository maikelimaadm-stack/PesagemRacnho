// Cabeçalho dos relatórios a partir do cadastro da Propriedade (E1B 1.4.0). Leitura para
// a folha (tela, impressão e PDF): a propriedade do filtro/detalhe do relatório, senão a
// marcada como Padrão, senão só o nome do sistema. Nunca lança: qualquer falha de leitura
// devolve o cabeçalho vazio — o relatório imprime do mesmo jeito.
import { buildPropertyHeader, resolveHeaderProperty } from '../domain/propertyHeader.js';
import { DEFAULT_EMPRESA_ID } from './masterRegistryService.js';
import { propertyService } from './registryServices.js';

/**
 * @param {{ empresaId?: string, filters?: object, lockedFilters?: object, drill?: Array<{columnId, key, label}> }} contexto
 *   filtros serializáveis do relatório (viewModel.filters / lockedFilters / drill)
 * @returns {Promise<ReturnType<typeof buildPropertyHeader>>}
 */
export async function loadReportHeader({ empresaId = DEFAULT_EMPRESA_ID, filters, lockedFilters, drill } = {}) {
  try {
    // Inativas entram: um relatório filtrado por uma propriedade inativa usa o cabeçalho dela.
    const propriedades = await propertyService.list({ empresaId: empresaId ?? DEFAULT_EMPRESA_ID, incluirInativos: true });
    return buildPropertyHeader(resolveHeaderProperty(propriedades, { filters, lockedFilters, drill }));
  } catch {
    return buildPropertyHeader(null);
  }
}
