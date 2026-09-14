// F0 — captura visual das telas atuais (claro/escuro) com uma massa anônima.
// Executado pelo binário do Electron a partir de scripts/capture-screens.mjs.
// Usa um userData isolado (nunca toca o banco do usuário) e o preload oficial.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const outDir = process.env.CAPTURE_OUT || path.join(process.cwd(), 'docs', 'evidence', 'f0-baseline', 'screens');
const baseUrl = process.env.CAPTURE_URL || 'http://localhost:5173';
const massKey = process.env.CAPTURE_MASS || 'pequena';
const routes = (process.env.CAPTURE_ROUTES || 'PesagensIndividuais,LancamentoPesagensIndividuais,ManutencaoSistema').split(',');
const themes = (process.env.CAPTURE_THEMES || 'claro,escuro').split(',');
const settleMs = Number(process.env.CAPTURE_SETTLE_MS) || 1800;
let steps = [];
try {
  steps = process.env.CAPTURE_STEPS ? JSON.parse(process.env.CAPTURE_STEPS) : [];
} catch (error) {
  process.stderr.write(`CAPTURE_STEPS inválido: ${error.message}\n`);
}

app.setPath('userData', path.join(os.tmpdir(), 'pesagens-individuais-capture-userdata'));
app.commandLine.appendSwitch('force-device-scale-factor', '1');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const loaded = (win) => new Promise((resolve) => win.webContents.once('did-finish-load', resolve));

// A rota é carregada sob demanda (React.lazy) e o Vite transforma o módulo na
// primeira requisição. Espera o placeholder "Carregando tela…" sumir e a tela
// pintar conteúdo real antes de capturar (limite de 45 s).
async function settled(win) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const ready = await win.webContents.executeJavaScript(
      `(() => { const t = document.body.innerText || ''; return !t.includes('Carregando tela') && t.trim().length > 40; })()`,
    );
    if (ready) return true;
    await wait(250);
  }
  return false;
}

// Handlers mínimos para a tela de Manutenção não registrar erro de IPC. Não
// gravam nada: a captura roda em userData isolado, sem pasta de dados real.
ipcMain.handle('app:getReleaseInfo', () => ({ version: app.getVersion(), productName: 'Pesagens Individuais', userDataPath: app.getPath('userData'), logPath: null }));
ipcMain.handle('app:getDiagnosticInfo', () => ({ version: app.getVersion(), productName: 'Pesagens Individuais', isPackaged: false, userDataPath: app.getPath('userData'), logPath: null, capture: true }));
ipcMain.handle('app:getDataDir', () => path.join(app.getPath('userData'), 'data'));
ipcMain.handle('app:openDataFolder', () => null);
ipcMain.handle('app:listUserFiles', () => ({ ok: true, files: [] }));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const report = { baseUrl, massKey, routes, themes, files: [], errors: [] };
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) report.errors.push(message);
  });

  await win.loadURL(`${baseUrl}/#/${routes[0]}`);
  await wait(settleMs);
  report.dataset = await win.webContents.executeJavaScript(
    `(async () => { const m = await import('/src/modules/perf/baselineBench.js'); const r = await m.seedMass(${JSON.stringify(massKey)}); return r.summary; })()`,
  );
  // Prelúdio opcional (CAPTURE_PRELUDE: JavaScript assíncrono executado uma vez
  // após a massa, ainda no userData isolado) — usado para semear cadastros
  // auxiliares e outros dados que a massa de pesagens não cobre.
  if (process.env.CAPTURE_PRELUDE) {
    try {
      report.prelude = await win.webContents.executeJavaScript(`(async () => { ${process.env.CAPTURE_PRELUDE} })()`);
    } catch (error) {
      report.errors.push(`prelude: ${error.message}`);
    }
  }

  for (const theme of themes) {
    await win.webContents.executeJavaScript(`localStorage.setItem('erp-tema', ${JSON.stringify(theme)}); true;`);
    for (const route of routes) {
      await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(`#/${route}`)}; true;`);
      const finished = loaded(win);
      win.webContents.reload();
      await finished;
      const ready = await settled(win);
      await wait(settleMs);
      const image = await win.webContents.capturePage();
      const file = path.join(outDir, `${route}-${theme}.png`);
      fs.writeFileSync(file, image.toPNG());
      report.files.push({ route, theme, file, size: image.getSize(), ready });
      if (!ready) report.errors.push(`${route}/${theme}: tela não terminou de carregar em 45 s`);

      // Passos extras por rota (CAPTURE_STEPS: JSON [{route, name, js}]): executa o
      // JavaScript na página e captura um estado adicional (painel aberto, pesquisa…).
      for (const step of steps.filter((item) => item.route === route)) {
        try {
          await win.webContents.executeJavaScript(`(async () => { ${step.js} })()`);
          await wait(step.settleMs || settleMs);
          const extra = await win.webContents.capturePage();
          const extraFile = path.join(outDir, `${route}-${theme}-${step.name}.png`);
          fs.writeFileSync(extraFile, extra.toPNG());
          report.files.push({ route, theme, step: step.name, file: extraFile, size: extra.getSize() });
        } catch (error) {
          report.errors.push(`${route}/${theme}/${step.name}: ${error.message}`);
        }
      }
    }
  }

  await win.webContents.executeJavaScript(
    `(async () => { const m = await import('/src/modules/perf/baselineBench.js'); await m.clearMass(); return true; })()`,
  );
  fs.writeFileSync(path.join(outDir, 'capture-report.json'), JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify(report)}\n`);
  app.exit(0);
}

app.whenReady().then(main).catch((error) => {
  process.stderr.write(`capture failed: ${error.stack || error.message}\n`);
  app.exit(1);
});
