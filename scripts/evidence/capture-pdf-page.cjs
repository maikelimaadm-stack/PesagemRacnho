// Evidência R4: abre um PDF no visualizador do Chromium (Electron) e salva captura PNG.
// Uso: npx electron scripts/evidence/capture-pdf-page.cjs <arquivo.pdf> <saida.png> [#page=N]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [pdfFile, pngFile, fragment = ''] = process.argv.slice(2);
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 1300, webPreferences: { plugins: true, sandbox: true, contextIsolation: true } });
  await win.loadURL(`${pathToFileURL(path.resolve(pdfFile)).href}${fragment}`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(pngFile, image.toPNG());
  console.log(JSON.stringify({ png: pngFile, size: image.getSize() }));
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
