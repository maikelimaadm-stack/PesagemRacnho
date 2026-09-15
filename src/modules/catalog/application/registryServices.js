// Instâncias nomeadas dos serviços de cadastro mestre (ADR-018). Módulo sem
// dependência de seeds/resolver para que estes possam importá-lo sem ciclo;
// a UI, a importação e a migração importam pelo índice (application/index.js).
import { createMasterRegistryService } from './masterRegistryService.js';
import {
  CATEGORIAS_ANIMAL,
  CAUSAS_MORTE,
  MARCAS,
  PARCEIROS,
  PROPRIEDADES,
  RACAS,
} from '../domain/registryDefinitions.js';

export const brandService = createMasterRegistryService(MARCAS);
export const breedService = createMasterRegistryService(RACAS);
export const categoryService = createMasterRegistryService(CATEGORIAS_ANIMAL);
export const partnerService = createMasterRegistryService(PARCEIROS);
export const propertyService = createMasterRegistryService(PROPRIEDADES);
export const deathCauseService = createMasterRegistryService(CAUSAS_MORTE);

// Acesso por nome da store (página genérica de cadastro e resolvedor).
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
