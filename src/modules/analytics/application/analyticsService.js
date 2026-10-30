// Serviço de inteligência gerencial (F11–F14, F18): calendário sazonal, metas e cenários, projeção diária e
// painel do gestor com exportações. Autorização no serviço pela matriz existente: ler/painel com reports.read;
// exportar com reports.export; gravar calendário, metas e cenários com settings.manage.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { getAgePolicy } from '../../livestock/infrastructure/animalProfileDataAdapter.js';
import { getReportSettings } from '../../settings/application/appConfigService.js';
import { normalizeGmdDiasMinimos } from '../../weighing/domain/gmdQuality.js';
import { buildDashboard, dashboardTables } from '../domain/dashboard.js';
import { projectScenarios, projectWeight, scenarioResolver } from '../domain/projection.js';
import { validateSeasonInput } from '../domain/seasonCalendar.js';
import { resolveTarget, validateTargetInput } from '../domain/targets.js';
import * as adapter from '../infrastructure/analyticsDataAdapter.js';
import { dashboardCsv, dashboardHtml, dashboardXlsx } from '../infrastructure/dashboardExport.js';

export { CENARIOS, CENARIO_LABELS, monthlyObserved, projectWeight, scenarioResolver } from '../domain/projection.js';
export { FONTES_CALENDARIO, FONTE_CALENDARIO_LABELS, PERIODOS, PERIODO_LABELS } from '../domain/seasonCalendar.js';
export { ESCOPOS, ESCOPO_LABELS, TIPOS_META, TIPO_META_LABELS } from '../domain/targets.js';
export { DIMENSOES, DIMENSAO_LABELS } from '../domain/performance.js';
export { AVISO_PAINEL } from '../infrastructure/dashboardExport.js';

function requirePermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function listSeasons() {
  requirePermission('reports.read');
  return adapter.listSeasons();
}
export async function saveSeason(input = {}) {
  requirePermission('settings.manage');
  return adapter.saveSeason(input.id || null, validateSeasonInput(input));
}
export async function removeSeason(id, { motivo } = {}) {
  requirePermission('settings.manage');
  if (!motivo || String(motivo).trim().length < 3) throw new Error('Informe o motivo da exclusão.');
  return adapter.removeSeason(id, String(motivo).trim());
}

export async function listTargets() {
  requirePermission('reports.read');
  return adapter.listTargets();
}
export async function saveTarget(input = {}) {
  requirePermission('settings.manage');
  return adapter.saveTarget(input.id || null, validateTargetInput(input));
}
export async function removeTarget(id, { motivo } = {}) {
  requirePermission('settings.manage');
  if (!motivo || String(motivo).trim().length < 3) throw new Error('Informe o motivo da exclusão.');
  return adapter.removeTarget(id, String(motivo).trim());
}

async function context() {
  const [fontes, policy, settings] = await Promise.all([adapter.loadSources(), getAgePolicy(), getReportSettings().catch(() => ({}))]);
  return { fontes: { ...fontes, policy }, diasMinimos: normalizeGmdDiasMinimos(settings?.gmd_dias_minimos), nomes: fontes.nomes };
}

/** Painel do gestor: { from, to, dimensoes, comparar, cenario, hoje }. */
export async function getDashboard(opts = {}) {
  requirePermission('reports.read');
  if (!opts.from || !opts.to || opts.from > opts.to) throw new Error('Informe a janela (início ≤ fim).');
  const { fontes, diasMinimos, nomes } = await context();
  const result = buildDashboard(fontes, { ...opts, hoje: opts.hoje || today(), diasMinimos, nomes });
  return { ...result, tabelas: dashboardTables(result) };
}

/** Exportação do painel: formato 'csv' | 'xlsx' | 'html' (PDF imprime o HTML). Paridade: mesmas tabelas. */
export async function exportDashboard(opts = {}, formato = 'csv') {
  requirePermission('reports.export');
  const painel = await getDashboard(opts);
  const titulo = `Painel do gestor — ${opts.from} a ${opts.to}`;
  if (formato === 'xlsx') return { painel, bytes: dashboardXlsx(painel.tabelas) };
  if (formato === 'html') return { painel, html: dashboardHtml(painel.tabelas, { titulo }) };
  return { painel, text: dashboardCsv(painel.tabelas, { titulo }) };
}

/**
 * Projeção de um animal até `alvo` nos cenários cadastrados (meta tipo CENARIO aplicável ao animal), ou com um
 * cenário avulso `cenarioAvulso`. Nunca grava pesagem.
 */
export async function projectAnimal(animalId, alvo, { cenarioAvulso = null, regimes = [] } = {}) {
  requirePermission('reports.read');
  const { fontes } = await context();
  const animal = fontes.animais.find((a) => a.id === animalId);
  if (!animal) throw new Error('Animal não encontrado.');
  const pesos = fontes.pesagens.filter((p) => p.animal_id === animalId && Number(p.peso_kg ?? p.legacy_payload?.peso) > 0).sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem));
  const ultimo = pesos.at(-1);
  const base = ultimo ? { peso_kg: Number(ultimo.peso_kg ?? ultimo.legacy_payload?.peso), data: ultimo.data_pesagem, origem: ultimo.legacy_payload?.peso_origem || 'PESAGEM_REGISTRADA' } : null;
  const ctx = { calendario: fontes.calendario, propriedadeId: animal.propriedade_id || null, regimes };
  if (cenarioAvulso) return { base, avulso: projectWeight(base, alvo, scenarioResolver(cenarioAvulso, ctx)) };
  const cenarios = {};
  for (const nome of ['CONSERVADOR', 'BASE', 'OTIMISTA']) {
    const r = resolveTarget(fontes.metas, { animal_id: animal.id, lote_id: animal.lote_atual_id, propriedade_id: animal.propriedade_id, raca_id: animal.raca_id, sexo: animal.sexo }, base?.data || today(), { tipos: ['CENARIO'], cenario: nome });
    if (r.meta) cenarios[nome] = r.meta;
  }
  return { base, cenarios: projectScenarios(base, alvo, cenarios, ctx) };
}
