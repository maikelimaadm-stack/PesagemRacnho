// Grão do relatório (docs/reporting/GRAIN-CONTRACT.md): o que é UMA linha.
// Todo relatório declara exatamente um grão; colunas declaram em quais grãos existem.
// Um animal com 8 pesagens = 8 linhas em EVENT, 1 em ANIMAL_CURRENT, 1 em ANIMAL_PERIOD.

export const GRAINS = Object.freeze({
  EVENT: 'EVENT',
  ANIMAL_CURRENT: 'ANIMAL_CURRENT',
  ANIMAL_PERIOD: 'ANIMAL_PERIOD',
  SESSION: 'SESSION',
  LOT: 'LOT',
  LOT_STAY: 'LOT_STAY',
  EXIT: 'EXIT',
  SHIPMENT_DOCUMENT: 'SHIPMENT_DOCUMENT',
  AUDIT_ENTRY: 'AUDIT_ENTRY',
  DATA_ISSUE: 'DATA_ISSUE',
  REGISTRY_ITEM: 'REGISTRY_ITEM',
  BACKUP_ENTRY: 'BACKUP_ENTRY',
});

export const GRAIN_LIST = Object.freeze(Object.values(GRAINS));

export const GRAIN_LABELS = Object.freeze({
  EVENT: 'uma linha por pesagem (evento)',
  ANIMAL_CURRENT: 'uma linha por animal (estado atual)',
  ANIMAL_PERIOD: 'uma linha por animal no período',
  SESSION: 'uma linha por sessão de pesagem',
  LOT: 'uma linha por lote',
  LOT_STAY: 'uma linha por permanência do animal no lote',
  EXIT: 'uma linha por saída definitiva',
  SHIPMENT_DOCUMENT: 'uma linha por documento de embarque',
  AUDIT_ENTRY: 'uma linha por registro de auditoria',
  DATA_ISSUE: 'uma linha por inconsistência encontrada',
  REGISTRY_ITEM: 'uma linha por item de cadastro',
  BACKUP_ENTRY: 'uma linha por backup registrado',
});

// Grãos cujas linhas carregam um animal: animais únicos = countDistinct(animal_id).
export const ANIMAL_KEYED_GRAINS = Object.freeze(new Set([
  GRAINS.EVENT, GRAINS.ANIMAL_CURRENT, GRAINS.ANIMAL_PERIOD, GRAINS.LOT_STAY, GRAINS.EXIT, GRAINS.SHIPMENT_DOCUMENT,
]));

export function isGrain(value) {
  return GRAIN_LIST.includes(value);
}

export function assertGrain(value, context = 'relatório') {
  if (!isGrain(value)) throw new Error(`${context}: grão inválido (${value ?? 'ausente'})`);
  return value;
}

/** Coluna existe no grão? (`grains` ausente na coluna = coluna inválida, nunca "todas"). */
export function columnSupportsGrain(column, grain) {
  return Array.isArray(column?.grains) && column.grains.includes(grain);
}

export function grainHasAnimal(grain) {
  return ANIMAL_KEYED_GRAINS.has(grain);
}
