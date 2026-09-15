// Serviços nomeados dos cadastros mestres (ADR-018). A UI, a importação e a
// migração usam estas instâncias; nunca acessam as stores diretamente.
import { createMasterRegistryService, DEFAULT_EMPRESA_ID } from './masterRegistryService.js';
import {
  CATEGORIAS_ANIMAL,
  CAUSAS_MORTE,
  MARCAS,
  PARCEIROS,
  PROPRIEDADES,
  RACAS,
} from '../domain/registryDefinitions.js';
import { applySeeds } from '../domain/seeds.js';

export const brandService = createMasterRegistryService(MARCAS);
export const breedService = createMasterRegistryService(RACAS);
export const categoryService = createMasterRegistryService(CATEGORIAS_ANIMAL);
export const partnerService = createMasterRegistryService(PARCEIROS);
export const propertyService = createMasterRegistryService(PROPRIEDADES);
export const deathCauseService = createMasterRegistryService(CAUSAS_MORTE);

// Acesso por nome da store (página genérica de cadastro e resolver).
export const REGISTRY_SERVICES = Object.freeze({
  marcas: brandService,
  racas: breedService,
  categoriasAnimal: categoryService,
  parceiros: partnerService,
  propriedades: propertyService,
  causasMorte: deathCauseService,
});

export function getRegistryService(store) {
  const service = REGISTRY_SERVICES[store];
  if (!service) throw new Error(`Cadastro mestre desconhecido: ${store}`);
  return service;
}

// Seeds idempotentes (categorias padrão, raça Nelore, propriedade principal).
export function ensureSeeds(empresaId = DEFAULT_EMPRESA_ID) {
  return applySeeds({ categoryService, breedService, propertyService }, empresaId);
}

export { createMasterRegistryService, DEFAULT_EMPRESA_ID } from './masterRegistryService.js';
export { RegistryError } from '../domain/registryErrors.js';
export { REGISTRY_WRITE_PERMISSION, assertRegistryWrite } from './registryAccess.js';
export {
  REGISTRY_DEFINITIONS,
  REGISTRY_DEFINITIONS_BY_STORE,
  getRegistryDefinition,
} from '../domain/registryDefinitions.js';
