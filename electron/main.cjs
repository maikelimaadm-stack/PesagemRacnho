const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { registerDialogIpc } = require('./ipc/dialogIpc.cjs');
const { registerReportIpc } = require('./ipc/reportIpc.cjs');
const { registerAttachmentIpc } = require('./ipc/attachmentIpc.cjs');
const { registerBackupIpc } = require('./ipc/backupIpc.cjs');
const { registerCriticalStateIpc } = require('./ipc/criticalState.cjs');
const { wrapIpcHandler } = require('./ipcErrors.cjs');
const { registerEquipmentSessionHandlers, registerEquipmentIpc, attachBluetoothHandlerToContents } = require('./ipc/equipmentIpc.cjs');
const appLogger = require('./logging/appLogger.cjs');
const appRuntime = require('./appRuntime.cjs');
const { buildDiagnosticInfo } = require('./diagnostics.cjs');

const isDev = process.env.ELECTRON_DEV === '1';

function isDevNavigation(url) {
  if (!isDev) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === '5173';
  } catch {
    return false;
  }
}

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
    title: `Pesagens Individuais ${app.getVersion()}`,
    icon: isDev
      ? path.join(getAppRoot(), 'build', 'icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'),
    autoHideMenuBar: true,
    // F11 fica livre para atalho de lote no lançamento (sem fullscreen do Chromium).
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Instalado: sem DevTools (a sessão e as regras de permissão vivem no renderer).
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => win.show());
  attachBluetoothHandlerToContents(win.webContents);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // A carga inicial (loadFile / loadURL) não passa por aqui. No app instalado nenhuma
  // navegação seguinte é legítima (o router é por hash). Em desenvolvimento só o Vite
  // local entra; `file:` e hosts parecidos com localhost:5173 ficam de fora.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isDevNavigation(url)) event.preventDefault();
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
  // Instalado: sem menu (remove atalhos de recarregar/DevTools).
  if (app.isPackaged) Menu.setApplicationMenu(null);
  registerEquipmentSessionHandlers();
  registerEquipmentIpc(ipcMain);
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
  // path.basename('..') continua sendo '..', e path.join(dir, '..') sobe um nível:
  // o temporário nascia fora de data/ e o rename falhava deixando o arquivo lá.
  const containedUserDir = (subdir) => {
    const safeSub = String(subdir || 'exports').replace(/[^a-zA-Z0-9_-]/g, '') || 'exports';
    const root = path.resolve(dataDir);
    const dir = path.resolve(root, safeSub);
    if (!dir.startsWith(`${root}${path.sep}`)) {
      throw Object.assign(new Error('Pasta de arquivo inválida'), { code: 'PATH_001' });
    }
    return dir;
  };

  const containedUserFile = (subdir, filename) => {
    const dir = containedUserDir(subdir);
    const raw = filename == null || String(filename).trim() === '' ? `file-${Date.now()}` : String(filename).replace(/\0/g, '');
    const safeName = path.basename(raw);
    if (!safeName || safeName === '.' || safeName === '..' || /[:/\\]/.test(safeName)) {
      throw Object.assign(new Error('Nome de arquivo inválido'), { code: 'PATH_001' });
    }
    const full = path.resolve(dir, safeName);
    if (!full.startsWith(`${dir}${path.sep}`)) {
      throw Object.assign(new Error('Nome de arquivo inválido'), { code: 'PATH_001' });
    }
    return { dir, full };
  };

  ipcMain.handle('app:writeUserFile', (_e, { subdir, filename, content } = {}) => {
    const { dir, full } = containedUserFile(subdir, filename);
    fs.mkdirSync(dir, { recursive: true });
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
    const dir = containedUserDir(subdir);
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

  // Leitura de volta de um arquivo do app (verificação de backup — P21): mesma contenção da gravação
  // (só dentro da pasta de dados do usuário, sem caminho vindo do renderer). Devolve conteúdo + SHA-256.
  const MAX_READ_BYTES = 1024 * 1024 * 1024;
  ipcMain.handle('app:readUserFile', (_e, { subdir, filename } = {}) => {
    const { full } = containedUserFile(subdir, filename);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw Object.assign(new Error('Arquivo não encontrado'), { code: 'PATH_001' });
    }
    const size = fs.statSync(full).size;
    if (size > MAX_READ_BYTES) throw Object.assign(new Error('Arquivo grande demais para verificar'), { code: 'PATH_002' });
    const bytes = fs.readFileSync(full);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return { ok: true, path: full, size: bytes.length, sha256, content: bytes.toString('utf8') };
  });

  registerDialogIpc(ipcMain, () => dataDir);
  // Anexos de documentos (F16): pasta de dados do usuário, seleção pelo diálogo nativo.
  registerAttachmentIpc(ipcMain, () => dataDir);
  // Backup: cópia externa verificada e retenção (F21/F22).
  registerBackupIpc(ipcMain, () => dataDir);
  // R3-01: marcador durável de restauração crítica (sobrevive a fechar e reabrir o app).
  registerCriticalStateIpc(ipcMain, () => dataDir, wrapIpcHandler);
  // Emissão de relatórios (PDF, impressão, salvar arquivo) — destino sempre escolhido no diálogo nativo.
  registerReportIpc(ipcMain);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
