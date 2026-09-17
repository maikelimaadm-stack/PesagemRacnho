// IPC mínimo de emissão de relatórios (programa reporting R4/R6).
//
// - reports:print-to-pdf  → renderiza o HTML do relatório numa janela oculta SEM JavaScript,
//                           gera o PDF (A4, rodapé com página X de Y) e grava onde o usuário escolher.
// - reports:print         → mesma janela oculta, diálogo de impressão do sistema.
// - reports:save-file     → grava CSV/JSON/XLSX (texto ou base64) no caminho escolhido no diálogo.
//
// Segurança: o renderer NUNCA envia caminho — só um nome sugerido (basename saneado) e a extensão
// de uma lista fechada; o destino vem do diálogo nativo. A janela de renderização é sandbox,
// contextIsolation, sem preload, sem Node, sem JavaScript, sem navegação e sem abrir janelas.
const { BrowserWindow, dialog, app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { wrapIpcHandler, AppError } = require('../ipcErrors.cjs');

const MAX_HTML_BYTES = 80 * 1024 * 1024;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const EXTENSIONS = Object.freeze({
  '.pdf': { name: 'PDF', binary: true },
  '.csv': { name: 'CSV', binary: false },
  '.json': { name: 'JSON', binary: false },
  '.xlsx': { name: 'Planilha Excel', binary: true },
});

function focusedWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

/** Nome sugerido → basename seguro com a extensão exigida. */
function safeFileName(suggested, extension) {
  if (!EXTENSIONS[extension]) throw new AppError('REPORT_IPC_001', `Extensão não permitida (${extension})`);
  const base = path.basename(String(suggested || 'relatorio'))
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\.+$/, '')
    .slice(0, 120) || 'relatorio';
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

function assertHtml(html) {
  if (typeof html !== 'string' || !html.startsWith('<!doctype html>')) throw new AppError('REPORT_IPC_002', 'Documento de impressão inválido');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new AppError('REPORT_IPC_003', 'Documento de impressão grande demais');
}

// O template de rodapé do printToPDF não respeita UTF-8: todo caractere fora do ASCII vira
// entidade numérica (senão "Emissão" sai como "EmissÃ£o").
function escapeTemplate(text) {
  return String(text ?? '')
    .replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    .replace(/[^\x20-\x7E]/gu, (char) => `&#${char.codePointAt(0)};`);
}

function writeAtomic(target, buffer) {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, buffer);
  fs.renameSync(temporary, target);
  const bytes = fs.readFileSync(target);
  return { path: target, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function askDestination(fileName, extension, title) {
  const documents = (() => { try { return app.getPath('documents'); } catch { return os.homedir(); } })();
  const result = await dialog.showSaveDialog(focusedWindow(), {
    title,
    defaultPath: path.join(documents, fileName),
    filters: [{ name: EXTENSIONS[extension].name, extensions: [extension.slice(1)] }],
  });
  if (result.canceled || !result.filePath) return null;
  const chosen = path.resolve(result.filePath);
  return path.extname(chosen).toLowerCase() === extension ? chosen : `${chosen}${extension}`;
}

/** Janela oculta e trancada para renderizar o HTML do relatório (arquivo temporário, sem JS). */
async function withRenderWindow(html, fn) {
  assertHtml(html);
  const temporary = path.join(os.tmpdir(), `pesagens-relatorio-${crypto.randomUUID()}.html`);
  fs.writeFileSync(temporary, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true, preload: undefined },
  });
  try {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    await win.loadFile(temporary);
    return await fn(win);
  } finally {
    try { win.destroy(); } catch { /* janela já fechada */ }
    try { fs.rmSync(temporary, { force: true }); } catch { /* temporário já removido */ }
  }
}

function pdfOptions({ landscape, footerText }) {
  return {
    pageSize: 'A4',
    landscape: landscape === true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-family:Arial,sans-serif;font-size:7px;color:#555;width:100%;padding:0 10mm;display:flex;justify-content:space-between;"><span>${escapeTemplate(footerText)}</span><span>P&#225;gina <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    margins: { marginType: 'custom', top: 0.45, bottom: 0.55, left: 0.4, right: 0.4 },
    preferCSSPageSize: false,
  };
}

function registerReportIpc(ipcMain) {
  ipcMain.handle('reports:print-to-pdf', wrapIpcHandler(async (_event, args = {}) => {
    if (typeof args.landscape !== 'boolean') throw new AppError('REPORT_IPC_004', 'Orientação inválida');
    const fileName = safeFileName(args.suggestedName, '.pdf');
    const pdf = await withRenderWindow(args.html, (win) => win.webContents.printToPDF(pdfOptions(args)));
    const destination = await askDestination(fileName, '.pdf', 'Salvar relatório em PDF');
    if (!destination) return { canceled: true };
    return { canceled: false, ...writeAtomic(destination, Buffer.from(pdf)) };
  }));

  ipcMain.handle('reports:print', wrapIpcHandler(async (_event, args = {}) => {
    if (typeof args.landscape !== 'boolean') throw new AppError('REPORT_IPC_004', 'Orientação inválida');
    return withRenderWindow(args.html, (win) => new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true, landscape: args.landscape, pageSize: 'A4' }, (success, failureReason) => {
        resolve({ printed: Boolean(success), reason: success ? null : failureReason || 'cancelado' });
      });
    }));
  }));

  ipcMain.handle('reports:save-file', wrapIpcHandler(async (_event, args = {}) => {
    const extension = String(args.extension || '').toLowerCase();
    const spec = EXTENSIONS[extension];
    if (!spec || extension === '.pdf') throw new AppError('REPORT_IPC_001', `Extensão não permitida (${extension})`);
    const buffer = spec.binary
      ? Buffer.from(String(args.base64 || ''), 'base64')
      : Buffer.from(String(args.text ?? ''), 'utf8');
    if (!buffer.length) throw new AppError('REPORT_IPC_005', 'Arquivo vazio');
    if (buffer.length > MAX_FILE_BYTES) throw new AppError('REPORT_IPC_003', 'Arquivo grande demais');
    const destination = await askDestination(safeFileName(args.suggestedName, extension), extension, 'Salvar relatório');
    if (!destination) return { canceled: true };
    return { canceled: false, ...writeAtomic(destination, buffer) };
  }));
}

module.exports = { registerReportIpc, safeFileName, pdfOptions, EXTENSIONS, MAX_HTML_BYTES };
