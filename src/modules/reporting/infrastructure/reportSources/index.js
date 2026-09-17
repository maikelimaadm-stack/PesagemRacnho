// Registro de fontes: id declarado na ReportDefinition → função de carga.
// Cada fonte recebe { definition, params, empresaId, today } e devolve
// { rows, strategy, rowsRead, timings: { query, transform }, warnings? }.
import { loadEventRows } from './eventSource.js';
import { loadAnimalCurrentRows, loadAnimalPeriodRows } from './animalSource.js';

function periodOf(params) {
  return Object.values(params || {}).find((value) => value && value.from && value.to) || null;
}

const SOURCES = {
  'events.byPeriod': async ({ definition, params, empresaId }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte events.byPeriod exige período`);
    return loadEventRows({ from: period.from, to: period.to, empresaId, tipos: definition.sourceOptions?.tipos });
  },
  'animals.current': async ({ params, empresaId, today }) => loadAnimalCurrentRows({ empresaId, today, params }),
  'animals.period': async ({ definition, params, empresaId }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte animals.period exige período`);
    return loadAnimalPeriodRows({ empresaId, period, params });
  },
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
