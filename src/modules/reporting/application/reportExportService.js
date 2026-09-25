// Emissão de relatórios (docs/reporting/EXPORT-CONTRACT.md). Toda emissão:
//   1. valida permissão no SERVIÇO (reports.export + requires + colunas sensíveis);
//   2. lê SOMENTE o view model já calculado (mesma população e totais da tela);
//   3. gera o conteúdo e o manifesto com identificador, emissor, versão e SHA-256;
//   4. grava pelo writer injetado (Electron: pasta de dados do app; navegador: download).
// Nenhum segredo de autenticação entra no manifesto (só id, nome e papel do emissor).
import { sha256Hex } from '../../../lib/sha256.js';
import { assertCanExport } from '../domain/reportPermissions.js';
import { describePeriod } from '../domain/reportPeriod.js';
import { getReportDefinition } from '../definitions/reportCatalog.js';
import { buildCsv } from '../infrastructure/exporters/csvExporter.js';
import { buildJsonBody } from '../infrastructure/exporters/jsonExporter.js';
import { buildXlsx } from '../infrastructure/exporters/xlsxExporter.js';

export const EXPORT_FORMATS = Object.freeze({
  csv: { extension: 'csv', mime: 'text/csv;charset=utf-8', binary: false },
  json: { extension: 'json', mime: 'application/json;charset=utf-8', binary: false },
  xlsx: { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', binary: true },
});

export const MANIFEST_FORMAT_VERSION = 1;

function slug(text) {
  return String(text || 'relatorio').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'relatorio';
}

export function exportFileName(viewModel, extension) {
  const stamp = String(viewModel.generatedAt).replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `${slug(viewModel.reportName)}_${stamp}_${String(viewModel.emissionId).slice(0, 8)}.${extension}`;
}

/** Manifesto da emissão (sem sha256 — preenchido depois de gerar o conteúdo). */
export function buildManifest(viewModel, format) {
  return {
    manifestFormat: MANIFEST_FORMAT_VERSION,
    kind: 'pesagens.report-emission',
    reportId: viewModel.reportId,
    reportName: viewModel.reportName,
    reportDefinitionVersion: viewModel.reportDefinitionVersion,
    presetId: viewModel.presetId ?? null,
    family: viewModel.family,
    grain: viewModel.grain,
    classification: viewModel.classification,
    emissionId: viewModel.emissionId,
    emittedAt: viewModel.generatedAt,
    emittedBy: { id: viewModel.emittedBy.id, nome: viewModel.emittedBy.nome, role: viewModel.emittedBy.role },
    appVersion: viewModel.appVersion,
    schemaVersion: viewModel.schemaVersion,
    dataBuildId: viewModel.dataBuildId,
    format,
    mode: viewModel.mode ?? 'DETALHADO',
    summarySort: viewModel.summarySort ?? null,
    period: viewModel.period,
    periodDescription: viewModel.period ? describePeriod(viewModel.period) : null,
    parameters: viewModel.params,
    // E1B: divisor da @ de peso vivo usado na emissão (Média/Total em @); null em view model antigo.
    arrobaDivisor: viewModel.arrobaDivisor ?? null,
    filters: viewModel.filters,
    lockedFilters: viewModel.lockedFilters,
    drill: (viewModel.drill ?? []).map(({ columnId, key, label }) => ({ columnId, key, label })),
    search: viewModel.search,
    sort: viewModel.sort,
    groups: viewModel.groups,
    columns: viewModel.columns.map((column) => ({ id: column.id, label: column.label })),
    aggregates: viewModel.aggregates,
    recordCount: viewModel.rowCount,
    uniqueAnimalCount: viewModel.uniqueAnimalCount,
    hiddenByPermission: viewModel.hiddenByPermission,
  };
}

/**
 * Gera conteúdo + manifesto sem gravar (usado pelos gates e pela gravação).
 * @returns {Promise<{ fileName, mime, content, manifest }>}
 */
export async function prepareEmission(viewModel, format, actor) {
  const spec = EXPORT_FORMATS[format];
  if (!spec) throw new Error(`formato de exportação desconhecido (${format})`);
  if (!actor?.role) {
    const error = new Error('Acesso não permitido: sessão sem papel.');
    error.code = 'AUTH_FORBIDDEN';
    throw error;
  }
  const definition = getReportDefinition(viewModel.reportId);
  if (!definition) throw new Error(`relatório desconhecido (${viewModel.reportId})`);
  if (viewModel.emittedBy?.id && actor.id && viewModel.emittedBy.id !== actor.id) {
    const error = new Error('Acesso não permitido: o relatório foi gerado por outra sessão.');
    error.code = 'AUTH_FORBIDDEN';
    throw error;
  }
  assertCanExport(definition, actor.role, viewModel.columns.map((column) => column.id));
  const manifest = buildManifest(viewModel, format);
  manifest.fileName = exportFileName(viewModel, spec.extension);
  let content;
  if (format === 'csv') {
    content = buildCsv(viewModel);
    manifest.sha256 = await sha256Hex(content);
  } else if (format === 'xlsx') {
    // A aba Manifesto leva o manifesto sem o hash (o hash é do próprio arquivo, calculado depois).
    content = buildXlsx(viewModel, { ...manifest });
    manifest.sha256 = await sha256Hex(content);
  } else {
    const body = buildJsonBody(viewModel);
    manifest.contentSha256 = await sha256Hex(JSON.stringify(body));
    content = `${JSON.stringify({ manifest, ...body }, null, 2)}\n`;
    manifest.sha256 = await sha256Hex(content);
  }
  return { fileName: manifest.fileName, mime: spec.mime, content, manifest };
}

/** Writer padrão: Electron grava em <dados>/relatorios; navegador baixa o arquivo. */
function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function defaultReportWriter({ fileName, content, mime }) {
  const api = typeof window !== 'undefined' ? window.pesagemApp : null;
  if (content instanceof Uint8Array) {
    // Binário (XLSX): destino escolhido no diálogo nativo; renderer não envia caminho.
    if (api?.reports?.saveFile) {
      const response = await api.reports.saveFile({ extension: `.${fileName.split('.').pop()}`, base64: toBase64(content), suggestedName: fileName });
      const result = response?.data ?? response;
      if (response?.ok === false) throw Object.assign(new Error(response.error?.message || 'Falha ao salvar'), { code: response.error?.code });
      if (result.canceled) return { canceled: true };
      return { location: result.path, size: result.size, sha256: result.sha256, channel: 'electron-dialog' };
    }
  } else if (api?.files?.writeUserFile) {
    const result = await api.files.writeUserFile({ subdir: 'relatorios', filename: fileName, content });
    return { location: result.path, size: result.size, sha256: result.sha256, channel: 'electron' };
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { location: fileName, size: blob.size, sha256: null, channel: 'download' };
}

/** Emite CSV/JSON/XLSX: grava o arquivo e o manifesto (<arquivo>.manifest.json). */
export async function emitReport(viewModel, format, actor, { writer = defaultReportWriter } = {}) {
  const prepared = await prepareEmission(viewModel, format, actor);
  const written = await writer(prepared);
  if (written.canceled) return { ...prepared, written, manifestWritten: null, canceled: true };
  if (written.sha256 && written.sha256 !== prepared.manifest.sha256) {
    const error = new Error('Falha de integridade: o arquivo gravado não confere com o conteúdo gerado.');
    error.code = 'REPORT_INTEGRITY';
    throw error;
  }
  const manifestFile = `${prepared.fileName}.manifest.json`;
  const manifestContent = `${JSON.stringify(prepared.manifest, null, 2)}\n`;
  // Manifesto é texto: no Electron vai para <dados>/relatorios; no navegador, download.
  const manifestWritten = format === 'json' ? null : await writer({ fileName: manifestFile, content: manifestContent, mime: 'application/json;charset=utf-8' });
  return { ...prepared, written, manifestWritten };
}
