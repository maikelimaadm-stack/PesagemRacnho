// IPC dos anexos (F16). Seleção pelo diálogo nativo (o caminho nunca vem do renderer); o renderer só envia
// sha256 + extensão (validados) e o NOME do backup (basename). A restauração usa a pasta de anexos ao lado do
// backup escolhido no diálogo de restauração (lembrada aqui no processo principal) ou a pasta de backups do app.
const path = require('path');
const { dialog, shell, BrowserWindow } = require('electron');
const { wrapIpcHandler } = require('../ipcErrors.cjs');
const { createAttachmentStore, EXTENSOES } = require('./attachmentStore.cjs');

let lastSelectedBackup = null; // { dir, fileName } — definido pelo diálogo de restauração

function rememberSelectedBackup(filePath) {
  lastSelectedBackup = filePath ? { dir: path.dirname(filePath), fileName: path.basename(filePath) } : null;
}

const objectsOf = (list) => (Array.isArray(list) ? list : []).slice(0, 100000).map((o) => ({ sha256: o?.sha256, ext: o?.ext }));

function registerAttachmentIpc(ipcMain, getDataDir) {
  const store = () => createAttachmentStore(getDataDir());

  ipcMain.handle('attachments:select-and-import', wrapIpcHandler(async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const result = await dialog.showOpenDialog(win, {
      title: 'Anexar arquivo ao documento',
      properties: ['openFile'],
      filters: [{ name: 'Documentos e imagens', extensions: EXTENSOES.map((e) => e.slice(1)) }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
    return { canceled: false, ...store().importFromPath(result.filePaths[0]) };
  }));
  ipcMain.handle('attachments:verify', wrapIpcHandler(async (_e, { objects } = {}) => store().verify(objectsOf(objects))));
  ipcMain.handle('attachments:open', wrapIpcHandler(async (_e, { sha256, ext } = {}) => {
    const full = store().pathOf(sha256, ext);
    const erro = await shell.openPath(full);
    return { ok: !erro, error: erro || null };
  }));
  ipcMain.handle('attachments:snapshot', wrapIpcHandler(async (_e, { backupFile, objects } = {}) => store().snapshot(backupFile, objectsOf(objects))));
  ipcMain.handle('attachments:verify-backup', wrapIpcHandler(async (_e, { backupFile, objects } = {}) => store().verifyBackup(backupFile, objectsOf(objects))));
  ipcMain.handle('attachments:restore', wrapIpcHandler(async (_e, { origem, backupFile, objects } = {}) => {
    if (origem === 'selecionado') {
      if (!lastSelectedBackup) return { total: 0, ok: 0, faltando: objectsOf(objects).map((o) => o.sha256), corrompidos: [], pasta: null };
      return store().restore(lastSelectedBackup.fileName, objectsOf(objects), lastSelectedBackup.dir);
    }
    return store().restore(backupFile, objectsOf(objects));
  }));
}

module.exports = { registerAttachmentIpc, rememberSelectedBackup };
