// Gate reports:pdf-contract:verify (R4) — IPC mínimo de PDF/impressão/salvar arquivo com o
// módulo 'electron' stubado: janela de renderização trancada (sandbox, sem JS, sem navegação),
// printToPDF A4 com página X de Y, destino só pelo diálogo nativo (nenhum caminho do renderer),
// extensão fechada, escrita atômica com SHA-256; serviço do renderer usa o mesmo view model.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { exportPdf } from '../src/modules/reporting/application/reportPrintService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const outDir = mkdtempSync(join(tmpdir(), 'pesagens-pdf-'));
const windows = [];
const handlers = {};
let saveDialogResult = null;
const PDF_BYTES = Buffer.from('%PDF-1.7\n% relatório de teste\n%%EOF\n');

class FakeWindow {
  constructor(options) {
    this.options = options;
    this.destroyed = false;
    this.navigationBlocked = null;
    this.openHandler = null;
    this.loadedFile = null;
    this.webContents = {
      setWindowOpenHandler: (fn) => { this.openHandler = fn; },
      on: (event, fn) => { if (event === 'will-navigate') { let prevented = false; fn({ preventDefault: () => { prevented = true; } }); this.navigationBlocked = prevented; } },
      printToPDF: async (options) => { this.pdfOptions = options; this.htmlAtPrint = readFileSync(this.loadedFile, 'utf8'); return PDF_BYTES; },
      print: (options, callback) => { this.printOptions = options; callback(true, ''); },
    };
    windows.push(this);
  }
  async loadFile(file) { this.loadedFile = file; }
  destroy() { this.destroyed = true; }
  static getFocusedWindow() { return null; }
  static getAllWindows() { return []; }
}

const electronStub = {
  BrowserWindow: FakeWindow,
  app: { getPath: () => outDir },
  dialog: { showSaveDialog: async (_win, options) => { saveDialogResult = options; return saveDialogResult.__cancel ? { canceled: true } : { canceled: false, filePath: join(outDir, `escolhido-${randomUUID().slice(0, 6)}`) }; } },
};
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'electron') return electronStub;
  return originalLoad.call(this, request, parent, isMain);
};
const { registerReportIpc, safeFileName, MAX_HTML_BYTES } = require('./electron/ipc/reportIpc.cjs');
registerReportIpc({ handle: (channel, fn) => { handlers[channel] = fn; } });
assert.deepEqual(Object.keys(handlers).sort(), ['reports:print', 'reports:print-to-pdf', 'reports:save-file']);

await seedReportFixture();
const vm = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, selection: { groups: [{ columnId: 'tipo_manejo' }] } }, ADMIN);

// Renderer → bridge (window.pesagemApp simulado ligado aos handlers)
const manifests = [];
globalThis.window = {
  pesagemApp: {
    reports: {
      printToPdf: (args) => handlers['reports:print-to-pdf']({}, args),
      print: (args) => handlers['reports:print']({}, args),
    },
    files: { writeUserFile: async (args) => { manifests.push(args); return { ok: true, path: join(outDir, args.filename) }; } },
  },
};
const result = await exportPdf(vm, ADMIN, {});
assert.equal(result.canceled, false);
assert.ok(result.path.endsWith('.pdf'), 'extensão .pdf acrescentada ao caminho do diálogo');
assert.ok(existsSync(result.path));
assert.equal(result.sha256, createHash('sha256').update(PDF_BYTES).digest('hex'), 'sha256 dos bytes gravados');
assert.equal(result.manifest.sha256, result.sha256, 'manifesto com o hash do PDF');
assert.equal(manifests.length, 1);
assert.equal(manifests[0].subdir, 'relatorios');
assert.ok(manifests[0].filename.endsWith('.pdf.manifest.json'));
assert.equal(JSON.parse(manifests[0].content).emissionId, vm.emissionId);

const win = windows.at(-1);
assert.deepEqual(
  { sandbox: win.options.webPreferences.sandbox, contextIsolation: win.options.webPreferences.contextIsolation, nodeIntegration: win.options.webPreferences.nodeIntegration, javascript: win.options.webPreferences.javascript, show: win.options.show },
  { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, show: false },
  'janela de renderização trancada',
);
assert.equal(win.options.webPreferences.preload, undefined, 'sem preload');
assert.deepEqual(win.openHandler(), { action: 'deny' }, 'não abre janelas');
assert.equal(win.navigationBlocked, true, 'navegação bloqueada');
assert.equal(win.destroyed, true, 'janela destruída');
assert.ok(!existsSync(win.loadedFile), 'HTML temporário removido');
assert.equal(win.pdfOptions.pageSize, 'A4');
assert.equal(win.pdfOptions.printBackground, true);
// E1B: página, margens de 10 mm e "Página X de Y" vêm do PRÓPRIO documento (@page), o mesmo mecanismo da
// impressão — o rodapé nativo do printToPDF sairia duplicado (conferido no Electron 35/Chromium 134).
assert.equal(win.pdfOptions.displayHeaderFooter, false, 'sem rodapé nativo (o documento já pagina)');
assert.equal(win.pdfOptions.preferCSSPageSize, true, 'tamanho e orientação do @page do documento');
assert.equal(win.pdfOptions.footerTemplate, undefined);
assert.ok(win.htmlAtPrint.includes('content: "Página " counter(page) " de " counter(pages)'), 'PDF com Página X de Y do documento');
// E1D item 8: a margem da página só com "Página X de Y"; a emissão fica rastreável pelo manifesto do PDF
// (conferido acima: manifest.emissionId e sha256), não no papel.
assert.ok(!win.htmlAtPrint.includes(vm.emissionId.slice(0, 8)) && !win.htmlAtPrint.includes('@bottom-left'), 'NEGATIVO (E1D): sem código da emissão na margem do PDF');
assert.ok(/@page \{ size: A4 (portrait|landscape); margin: 10mm/.test(win.htmlAtPrint), 'A4 com margens de 10 mm');
// E1E: a folha de todo relatório é a do MAKGESTAO (total geral em linha de texto, "TOTAL GERAL:").
assert.ok(win.htmlAtPrint.includes('<table class="sheet-page">') && win.htmlAtPrint.includes('TOTAL GERAL:') &&win.htmlAtPrint.includes('data-style="makgestao"'), 'PDF renderiza a folha do mesmo view model');
assert.ok(win.htmlAtPrint.includes("img-src data:"), 'CSP permite só o logo embutido');
assert.equal(saveDialogResult.filters[0].extensions[0], 'pdf');

// Negativos do IPC
const call = async (channel, args) => { const response = await handlers[channel]({}, args); return response.ok ? 'OK' : response.error.code; };
assert.equal(await call('reports:print-to-pdf', { html: '<!doctype html><p>x', landscape: 'sim' }), 'REPORT_IPC_004', 'orientação precisa ser booleana');
assert.equal(await call('reports:print-to-pdf', { html: '<html><script>', landscape: false }), 'REPORT_IPC_002', 'documento sem doctype recusado');
assert.equal(await call('reports:print-to-pdf', { html: `<!doctype html>${'x'.repeat(MAX_HTML_BYTES)}`, landscape: false }), 'REPORT_IPC_003', 'documento grande demais');
assert.equal(safeFileName('../../Windows/System32/evil', '.pdf'), 'evil.pdf', 'nome sugerido vira basename');
assert.equal(safeFileName('rel:atório?*', '.csv'), 'rel_atório__.csv');
assert.throws(() => safeFileName('x', '.exe'), (error) => error.code === 'REPORT_IPC_001');
electronStub.dialog.showSaveDialog = async () => ({ canceled: true });
const before = readdirSync(outDir).length;
const canceled = await handlers['reports:print-to-pdf']({}, { html: '<!doctype html><p>ok</p>', landscape: true, suggestedName: 'x' });
assert.equal(canceled.data.canceled, true, 'diálogo cancelado não grava');
assert.equal(readdirSync(outDir).length, before);
assert.equal(windows.at(-1).pdfOptions.landscape, true, 'paisagem repassada');

// Impressão e salvar arquivo
const printed = await handlers['reports:print']({}, { html: '<!doctype html><p>ok</p>', landscape: false });
assert.equal(printed.data.printed, true);
assert.equal(windows.at(-1).printOptions.silent, false, 'impressão mostra o diálogo do sistema');
electronStub.dialog.showSaveDialog = async () => ({ canceled: false, filePath: join(outDir, 'planilha') });
assert.equal(await call('reports:save-file', { extension: '.exe', base64: 'AA==' }), 'REPORT_IPC_001');
assert.equal(await call('reports:save-file', { extension: '.pdf', base64: 'AA==' }), 'REPORT_IPC_001', 'PDF só pelo printToPDF');
assert.equal(await call('reports:save-file', { extension: '.xlsx', base64: '' }), 'REPORT_IPC_005');
const saved = (await handlers['reports:save-file']({}, { extension: '.xlsx', base64: Buffer.from('PK\u0003\u0004xlsx').toString('base64'), suggestedName: 'r' })).data;
assert.ok(saved.path.endsWith('planilha.xlsx'));
assert.equal(saved.sha256, createHash('sha256').update(readFileSync(saved.path)).digest('hex'));

// Permissão no renderer: OPERADOR não gera PDF
const vmOperador = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } } }, OPERADOR);
await assert.rejects(() => exportPdf(vmOperador, OPERADOR, {}), (error) => error.code === 'AUTH_FORBIDDEN');

// Preload e main
const preload = readFileSync(join(root, 'electron/preload.cjs'), 'utf8');
assert.match(preload, /printToPdf: \(args\) => ipcRenderer\.invoke\('reports:print-to-pdf', args\)/);
assert.doesNotMatch(preload, /reports:[a-z-]+', \{ ?path/, 'preload não aceita caminho');
assert.match(readFileSync(join(root, 'electron/main.cjs'), 'utf8'), /registerReportIpc\(ipcMain\);/);

Module._load = originalLoad;
delete globalThis.window;
await resetDb();
rmSync(outDir, { recursive: true, force: true });
console.log(JSON.stringify({ gate: 'reports:pdf-contract:verify', ok: true, windows: windows.length }, null, 2));
