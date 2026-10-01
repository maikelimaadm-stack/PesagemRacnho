// Registro de fontes: id declarado na ReportDefinition → função de carga.
// Cada fonte recebe { definition, params, empresaId, today, arrobaDivisor, gmdDiasMinimos? } e devolve
// { rows, strategy, rowsRead, timings: { query, transform }, warnings? }.
// arrobaDivisor (E1B): divisor da @ de peso vivo resolvido pelo runReport (entra no sourceKey).
// gmdDiasMinimos (M1): mínimo do GMD confiável (gmd_dias_minimos), quando o serviço o resolver; é repassado às
// cargas de pesagem e de animal. Sem ele, quem precisa lê Configurações › Relatórios (ausente/inválido → 21).
import { loadEventRows } from './eventSource.js';
import { loadAnimalCurrentRows, loadAnimalPeriodRows } from './animalSource.js';
import {
  loadAuditRows, loadBackupRows, loadDataIssueRows, loadLotRows, loadLotStayRows, loadRegistryRows, loadShipmentDocumentRows, loadWeighingCheckRows,
} from './controlSources.js';

function periodOf(params) {
  return Object.values(params || {}).find((value) => value && value.from && value.to) || null;
}

const SOURCES = {
  'events.byPeriod': async ({ definition, params, empresaId, arrobaDivisor, gmdDiasMinimos }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte events.byPeriod exige período`);
    return loadEventRows({ from: period.from, to: period.to, empresaId, tipos: definition.sourceOptions?.tipos, arrobaDivisor, gmdDiasMinimos });
  },
  'animals.current': async ({ params, empresaId, today, gmdDiasMinimos }) => loadAnimalCurrentRows({ empresaId, today, params, gmdDiasMinimos }),
  'animals.period': async ({ definition, params, empresaId, gmdDiasMinimos }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: fonte animals.period exige período`);
    return loadAnimalPeriodRows({ empresaId, period, params, gmdDiasMinimos });
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
  // M1: "Manejo sem GMD" aponta também o intervalo curto (gmd_dias_minimos).
  'data.quality': async ({ empresaId, gmdDiasMinimos }) => loadDataIssueRows({ empresaId, gmdDiasMinimos }),
  // M1: "Pesagens para conferir" (aba Controle da Manutenção) — só aponta; nada sai das médias.
  'weighings.check': async ({ definition, params, empresaId, arrobaDivisor, gmdDiasMinimos }) => {
    const period = periodOf(params);
    if (!period) throw new Error(`relatório ${definition.id}: pesagens para conferir exigem período`);
    return loadWeighingCheckRows({ period, empresaId, arrobaDivisor, gmdDiasMinimos });
  },
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
