const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { registerDialogIpc } = require('./ipc/dialogIpc.cjs');
const appLogger = require('./logging/appLogger.cjs');
const appRuntime = require('./appRuntime.cjs');
const { buildDiagnosticInfo } = require('./diagnostics.cjs');

const isDev = process.env.ELECTRON_DEV === '1';

// Override de userData APENAS para testes automatizados.
// NÃO é exposto na UI e NÃO é configuração para o usuário final.
if (process.env.PESAGENS_USER_DATA_DIR) {
  try {
    app.setPath('userData', process.env.PESAGENS_USER_DATA_DIR);
  } catch (err) {
    console.error('[bootstrap] PESAGENS_USER_DATA_DIR override falhou:', err.message);
  }
}

const getAppRoot = () => (isDev ? path.join(__dirname, '..') : app.getAppPath());
const getDataDir = () =>
  isDev ? path.join(__dirname, '..', 'data') : path.join(app.getPath('userData'), 'data');

const createWindow = () => {
  const distIndex = path.join(getAppRoot(), 'dist', 'index.html');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Pesagens Individuais',
    icon: isDev
      ? path.join(getAppRoot(), 'build', 'icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && !url.startsWith('http://localhost:5173')) {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173/#/PesagensIndividuais');
  } else if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex, { hash: '/PesagensIndividuais' });
  } else {
    win.loadURL('data:text/html,<body style="font-family:sans-serif;padding:24px"><h2>Erro ao iniciar</h2><p>Reinstale o aplicativo.</p></body>');
  }
};

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const dataDir = getDataDir();

  // Log local simples (userData/logs/app.log) — diagnóstico offline.
  appLogger.initLogger(path.join(userDataPath, 'logs'));
  appLogger.log('[bootstrap]', `app version ${app.getVersion()}`);
  appLogger.log('[bootstrap]', `isPackaged ${app.isPackaged}`);
  appLogger.log('[bootstrap]', `userData path ${userDataPath}`);
  appLogger.log('[bootstrap]', `dataDir ${dataDir}`);
  appLogger.log('[bootstrap]', 'armazenamento operacional: IndexedDB/Dexie (renderer)');

  appRuntime.configureAppRuntime({
    userDataPath,
    dataDir,
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
  });

  // Pasta de dados (backups/exportações). O app cria sozinho; usuário não configura.
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.error('[bootstrap] falha ao criar dataDir:', dataDir, '—', err.message);
    appLogger.log('[bootstrap]', `ERRO ao criar dataDir: ${err.message}`);
  }

  const diagnosticInfo = () =>
    buildDiagnosticInfo({
      productName: app.getName(),
      isPackaged: app.isPackaged,
      logPath: appLogger.getLogFilePath(),
    });

  ipcMain.handle('app:getReleaseInfo', () => {
    const d = diagnosticInfo();
    return {
      version: d.version,
      productName: d.productName,
      userDataPath: d.userDataPath,
      logPath: d.logPath,
    };
  });
  ipcMain.handle('app:getDiagnosticInfo', () => diagnosticInfo());
  ipcMain.handle('app:getDataDir', () => dataDir);
  ipcMain.handle('app:openDataFolder', () => shell.openPath(dataDir));

  // Persistência de arquivos gerados no renderer (backup/export Dexie).
  // Salva sob userData/data/<subdir> — usuário NÃO escolhe pasta.
  const safeUserDir = (subdir) => {
    const safeSub = String(subdir || 'exports').replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(dataDir, safeSub);
  };

  ipcMain.handle('app:writeUserFile', (_e, { subdir, filename, content } = {}) => {
    const dir = safeUserDir(subdir);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = path.basename(String(filename || `file-${Date.now()}`));
    const full = path.join(dir, safeName);
    const temporary = `${full}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporary, content ?? '', 'utf8');
    const descriptor = fs.openSync(temporary, 'r');
    try {
      fs.fsyncSync(descriptor);
    } catch (err) {
      // Alguns filesystems virtuais usados no smoke test não suportam fsync.
      // A escrita continua atômica pelo rename e é reaberta/hashada abaixo.
      if (!['EPERM', 'EINVAL', 'ENOSYS'].includes(err.code)) throw err;
      appLogger.log('[files]', `fsync indisponível para ${temporary}: ${err.code}`);
    } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, full);
    const bytes = fs.readFileSync(full);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    appLogger.log('[files]', `writeUserFile ${full}`);
    return { ok: true, path: full, size: bytes.length, sha256 };
  });

  ipcMain.handle('app:listUserFiles', (_e, { subdir, extension } = {}) => {
    const dir = safeUserDir(subdir);
    if (!fs.existsSync(dir)) return { ok: true, files: [] };
    const normalizedExtension = extension ? String(extension).toLowerCase() : '';
    const result = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (!normalizedExtension || entry.name.toLowerCase().endsWith(normalizedExtension)))
      .map((entry) => {
        const full = path.join(dir, entry.name);
        const stat = fs.statSync(full);
        return { name: entry.name, path: full, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
    return { ok: true, files: result };
  });

  registerDialogIpc(ipcMain, () => dataDir);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
