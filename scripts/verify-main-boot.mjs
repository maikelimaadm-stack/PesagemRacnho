// Boot real do electron/main.cjs em Node, com o módulo 'electron' stubado.
// Prova que o main process inicializa (whenReady completo) e registra os IPCs
// esperados — sem precisar abrir a janela. É a rede de segurança para remoções
// no main (ex.: retirada do SQLite legado).
import { mkdtempSync, readdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import Module from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(pathToFileURL(join(root, 'package.json')).href);

function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

const userData = mkdtempSync(join(tmpdir(), 'pesagens-boot-'));
const handlers = {};
let readyResolve;
const readyPromise = new Promise((r) => { readyResolve = r; });
const windows = [];

const electronStub = {
  app: {
    getPath: (name) => (name === 'userData' ? userData : join(userData, name)),
    setPath: () => {},
    getVersion: () => require('./package.json').version,
    getName: () => 'Pesagens Individuais',
    getAppPath: () => root,
    isPackaged: false,
    whenReady: () => Promise.resolve().then(() => readyResolve?.()) && Promise.resolve(),
    on: () => {},
    quit: () => {},
  },
  BrowserWindow: class {
    constructor(opts) {
      const listeners = {};
      this.opts = opts;
      this.webContents = {
        setWindowOpenHandler: () => {},
        on: (event, fn) => { (listeners[event] ||= []).push(fn); },
        listeners,
        session: {},
      };
      windows.push(this);
    }
    once() {} on() {} show() {} loadURL() {} loadFile() {}
    static getAllWindows() { return windows; }
    static getFocusedWindow() { return windows[0] || null; }
  },
  ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
  shell: { openPath: () => Promise.resolve('') },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
};

// Intercepta require('electron') para devolver o stub.
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  return origLoad.call(this, request, parent, isMain);
};

try {
  // ELECTRON_DEV=0 → caminho "empacotado" (usa userData).
  process.env.ELECTRON_DEV = '0';
  process.env.PESAGENS_USER_DATA_DIR = userData;
  // No Electron empacotado `process.resourcesPath` aponta para a pasta
  // `resources/` (ícone distribuído via extraResources). O stub em Node não
  // define esse campo; sem ele `createWindow` falha ao montar o caminho do ícone.
  if (!process.resourcesPath) process.resourcesPath = join(userData, 'resources');

  let bootError = null;
  try {
    require('./electron/main.cjs');
  } catch (err) {
    bootError = err;
  }
  assert(!bootError, `main.cjs deve carregar sem erro: ${bootError?.message}`);

  // Aguarda o whenReady terminar (registro de IPC + createWindow).
  await readyPromise;
  await new Promise((r) => setTimeout(r, 300));

  // IPCs que o app precisa expor após o cutover Dexie.
  const required = [
    'app:getReleaseInfo',
    'app:getDiagnosticInfo',
    'app:writeUserFile',
    'app:openDataFolder',
    'dialog:select-import-json',
  ];
  for (const ch of required) {
    assert(typeof handlers[ch] === 'function', `IPC registrado: ${ch}`);
  }

  // Uma janela deve ter sido criada.
  assert(windows.length >= 1, 'createWindow foi chamado');

  // Diagnóstico responde (sem SQLite).
  const info = await handlers['app:getDiagnosticInfo']({});
  const diag = info?.data ?? info;
  assert(diag && diag.version, 'app:getDiagnosticInfo retorna versão');

  // Escrita de arquivo do usuário funciona (backup/export do Dexie).
  const w = await handlers['app:writeUserFile']({}, { subdir: 'exports', filename: 'boot-test.txt', content: 'ok' });
  const written = w?.data ?? w;
  assert(written?.path && existsSync(written.path), 'app:writeUserFile gravou arquivo');
  const exportDir = join(userData, 'data', 'exports');
  assert(written.path.startsWith(exportDir), 'arquivo legítimo fica em data/exports');

  // Nome ".." sobe um nível no path.join e o temporário vaza ao lado de data/.
  const before = readdirSync(userData);
  let rejectedDotDot = false;
  try {
    await handlers['app:writeUserFile']({}, { subdir: 'exports', filename: '..', content: 'fora' });
  } catch {
    rejectedDotDot = true;
  }
  const leaked = readdirSync(userData).filter((name) => !before.includes(name) || name.startsWith('data.tmp-'));
  assert(rejectedDotDot, 'app:writeUserFile recusa filename ..');
  assert(!leaked.some((name) => name.startsWith('data.tmp-') || name === 'data.tmp'), 'filename .. não deixa arquivo fora de data/');

  const sneaky = await handlers['app:writeUserFile']({}, { subdir: '..', filename: 'ok.txt', content: 'ok' });
  const sneakyPath = sneaky?.data ?? sneaky;
  assert(sneakyPath?.path?.startsWith(exportDir), 'subdir .. não grava fora de data/exports');

  const nav = windows[0]?.webContents?.listeners?.['will-navigate']?.[0];
  assert(typeof nav === 'function', 'will-navigate registrado na janela');
  const blocked = (url) => {
    let prevented = false;
    nav({ preventDefault: () => { prevented = true; } }, url);
    return prevented;
  };
  assert(blocked('file:///C:/Windows/win.ini'), 'navegação file: bloqueada no app instalado');
  assert(blocked('http://localhost:5173/'), 'localhost de desenvolvimento bloqueado no app instalado');
  assert(blocked('http://localhost:5173.evil.test/'), 'host parecido com o dev server bloqueado');
  assert(blocked('https://example.com/'), 'navegação externa bloqueada');

  console.log('OK verify-main-boot');
  console.log(JSON.stringify({
    booted: true,
    version: diag.version,
    ipcChannels: Object.keys(handlers).length,
    windowCreated: windows.length,
  }, null, 2));
} finally {
  Module._load = origLoad;
  try { rmSync(userData, { recursive: true, force: true }); } catch { /* noop */ }
}
