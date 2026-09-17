// Evidência R4: roda no Electron real (`npx electron scripts/evidence/render-report-pdf.cjs <pasta>`)
// e gera os PDFs com as MESMAS opções do IPC reports:print-to-pdf (pdfOptions). Não é gate.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pdfOptions } = require('../../electron/ipc/reportIpc.cjs');

const dir = path.resolve(process.argv[2] || '.tmp/print-sample');
app.disableHardwareAcceleration();
// Script avulso: sem janela principal, fechar a janela de render encerraria o app (no aplicativo a janela principal continua aberta).
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const jobs = JSON.parse(fs.readFileSync(path.join(dir, 'jobs.json'), 'utf8'));
  const results = [];
  for (const job of jobs) {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    await win.loadFile(path.join(dir, job.html));
    const pdf = await win.webContents.printToPDF(pdfOptions({ landscape: job.landscape, footerText: job.footerText }));
    fs.writeFileSync(path.join(dir, job.pdf), pdf);
    results.push({ pdf: job.pdf, bytes: pdf.length, landscape: job.landscape });
    win.destroy();
  }
  console.log(JSON.stringify(results));
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
