// Impressão e PDF (R4). Mesmo view model da tela → documento HTML (printDocument) → Electron.
// Imprimir/gerar PDF é uma forma de exportar: exige reports.export e recusa coluna sensível sem
// permissão (assertCanExport), exatamente como CSV/JSON.
import { assertCanExport } from '../domain/reportPermissions.js';
import { getReportDefinition } from '../definitions/reportCatalog.js';
import { buildPrintDocument, footerText } from '../infrastructure/exporters/printDocument.js';
import { buildManifest, exportFileName } from './reportExportService.js';

function authorize(viewModel, actor) {
  if (!actor?.role) {
    const error = new Error('Acesso não permitido: sessão sem papel.');
    error.code = 'AUTH_FORBIDDEN';
    throw error;
  }
  if (viewModel.emittedBy?.id && actor.id && viewModel.emittedBy.id !== actor.id) {
    const error = new Error('Acesso não permitido: o relatório foi gerado por outra sessão.');
    error.code = 'AUTH_FORBIDDEN';
    throw error;
  }
  const definition = getReportDefinition(viewModel.reportId);
  if (!definition) throw new Error(`relatório desconhecido (${viewModel.reportId})`);
  assertCanExport(definition, actor.role, viewModel.columns.map((column) => column.id));
}

/** Documento pronto (sem imprimir): layout, aviso de largura e manifesto. */
export function preparePrint(viewModel, actor, options = {}) {
  authorize(viewModel, actor);
  const document = buildPrintDocument(viewModel, options);
  const manifest = { ...buildManifest(viewModel, options.format ?? 'print'), orientation: document.layout.orientation, fileName: exportFileName(viewModel, 'pdf') };
  return { ...document, manifest };
}

function bridge() {
  return typeof window !== 'undefined' ? window.pesagemApp?.reports ?? null : null;
}

function unwrap(result) {
  if (result && result.ok === false) {
    const error = new Error(result.error?.message || 'Falha na emissão');
    error.code = result.error?.code || 'REPORT_IPC';
    throw error;
  }
  return result?.data ?? result;
}

/** Fallback do navegador de desenvolvimento: iframe oculto com o documento e print(). */
function printInIframe(html) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';
    frame.srcdoc = html;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        resolve({ printed: true, channel: 'iframe' });
      } finally {
        setTimeout(() => frame.remove(), 1000);
      }
    };
    document.body.appendChild(frame);
  });
}

export async function printReport(viewModel, actor, options = {}) {
  const prepared = preparePrint(viewModel, actor, { ...options, format: 'print' });
  if (!prepared.layout.fits && !options.acceptTooWide) return { blocked: true, layout: prepared.layout };
  const api = bridge();
  if (api?.print) {
    const result = unwrap(await api.print({ html: prepared.html, landscape: prepared.layout.orientation === 'landscape' }));
    return { ...result, layout: prepared.layout, manifest: prepared.manifest, channel: 'electron' };
  }
  return { ...(await printInIframe(prepared.html)), layout: prepared.layout, manifest: prepared.manifest };
}

export async function exportPdf(viewModel, actor, options = {}) {
  const prepared = preparePrint(viewModel, actor, { ...options, format: 'pdf', pageNumbersInCss: false });
  if (!prepared.layout.fits && !options.acceptTooWide) return { blocked: true, layout: prepared.layout };
  const api = bridge();
  if (!api?.printToPdf) {
    // Navegador de desenvolvimento: sem Electron não há printToPDF; abre a impressão (Salvar como PDF).
    return { ...(await printInIframe(buildPrintDocument(viewModel, { ...options, pageNumbersInCss: true }).html)), fallback: 'iframe', layout: prepared.layout };
  }
  const result = unwrap(await api.printToPdf({
    html: prepared.html,
    landscape: prepared.layout.orientation === 'landscape',
    suggestedName: prepared.manifest.fileName,
    footerText: footerText(viewModel),
  }));
  if (result.canceled) return { canceled: true, layout: prepared.layout };
  const manifest = { ...prepared.manifest, fileName: result.path.split(/[\\/]/).pop(), sha256: result.sha256, size: result.size };
  const files = typeof window !== 'undefined' ? window.pesagemApp?.files : null;
  if (files?.writeUserFile) {
    await files.writeUserFile({ subdir: 'relatorios', filename: `${manifest.fileName}.manifest.json`, content: `${JSON.stringify(manifest, null, 2)}\n` });
  }
  return { ...result, manifest, layout: prepared.layout, channel: 'electron' };
}
