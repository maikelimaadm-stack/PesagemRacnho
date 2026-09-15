// Índice público dos cadastros mestres (ADR-018). A UI, a importação e a
// migração importam daqui; nunca acessam as stores diretamente.
// Um módulo por responsabilidade:
//   - registryServices.js  → instâncias nomeadas dos serviços (fonte única);
//   - masterRegistryService.js → fábrica;
//   - registryAccess.js    → permissão de escrita;
//   - catalogResolver.js   → resolveMany (serviços) + parte pura do domínio;
//   - domain/seeds.js      → seeds (fonte única; o backfill v7 importa de lá).
export {
  REGISTRY_SERVICES,
  brandService,
  breedService,
  categoryService,
  deathCauseService,
  getRegistryService,
  partnerService,
  propertyService,
} from './registryServices.js';
export { createMasterRegistryService, DEFAULT_EMPRESA_ID, INACTIVE_DEFAULT_MESSAGE } from './masterRegistryService.js';
export { REGISTRY_WRITE_PERMISSION, assertRegistryWrite, resolveWriterRole } from './registryAccess.js';
export { RESOLVER_GROUPS, buildNameIndex, resolveMany, resolveNamesAgainst } from './catalogResolver.js';
export { RegistryError } from '../domain/registryErrors.js';
export {
  CATEGORIAS_SEED,
  PROPRIEDADE_PADRAO_SEED,
  RACA_PADRAO_SEED,
  applySeeds,
  ensureSeeds,
} from '../domain/seeds.js';
export {
  REGISTRY_DEFINITIONS,
  REGISTRY_DEFINITIONS_BY_STORE,
  getRegistryDefinition,
} from '../domain/registryDefinitions.js';
