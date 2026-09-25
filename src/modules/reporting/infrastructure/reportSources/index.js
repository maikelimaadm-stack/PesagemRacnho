// Registro de fontes: id declarado na ReportDefinition → função de carga.
// Cada fonte recebe { definition, params, empresaId, today, arrobaDivisor } e devolve
// { rows, strategy, rowsRead, timings: { query, transform }, warnings? }.
// arrobaDivisor (E1B): divisor da @ de peso vivo resolvido pelo runReport (entra no sourceKey).
import { loadEventRows } from './eventSource.js';
import { loadAnimalCurrentRows, loadAnimalPeriodRows } from './animalSource.js';
import { loadAuditRows, loadBackupRows, loadDataIssueRows, loadLotRows, loadLotStayRows, loadRegistryRows, loadShipmentDocumentRows } from './controlSources.js';

function periodOf(params) {
  return Object.values(params || {}).find((value) => value && value.from && value.to) || null;
}

const SOURCES = {
  'events.byPeriod': async ({ definition, params, empresaId, arrobaDivisor }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte events.byPeriod exige período`);
    return loadEventRows({ from: period.from, to: period.to, empresaId, tipos: definition.sourceOptions?.tipos, arrobaDivisor });
  },
  'animals.current': async ({ params, empresaId, today }) => loadAnimalCurrentRows({ empresaId, today, params }),
  'animals.period': async ({ definition, params, empresaId }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte animals.period exige período`);
    return loadAnimalPeriodRows({ empresaId, period, params });
  },
  'lots.current': async ({ empresaId }) => loadLotRows({ empresaId }),
  'lotStays.byPeriod': async ({ definition, params, today }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: permanências exigem período`);
    return loadLotStayRows({ period, today });
  },
  'shipments.documents': async ({ params }) => loadShipmentDocumentRows({ period: periodOf(params) }),
  'audit.byPeriod': async ({ definition, params }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: auditoria exige período`);
    return loadAuditRows({ period });
  },
  'data.quality': async () => loadDataIssueRows(),
  'backups.history': async () => loadBackupRows(),
  ...Object.fromEntries(['marcas', 'racas', 'categoriasAnimal', 'parceiros', 'propriedades', 'causasMorte', 'usuarios'].map((store) => [`registry.${store}`, async () => loadRegistryRows({ store })])),
};

export function registerReportSource(id, loader) {
  if (SOURCES[id] && SOURCES[id] !== loader) throw new Error(`fonte já registrada: ${id}`);
  SOURCES[id] = loader;
}

export function getReportSource(id) {
  const source = SOURCES[id];
  if (!source) throw new Error(`fonte de relatório desconhecida: ${id}`);
  return source;
}

export function listReportSourceIds() {
  return Object.keys(SOURCES);
}
