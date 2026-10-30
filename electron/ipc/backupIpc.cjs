// IPC do backup externo e da retenção (F21/F22). O destino é escolhido no diálogo nativo; o renderer só envia
// o NOME do backup (basename validado).
const { dialog, BrowserWindow } = require('electron');
const { wrapIpcHandler } = require('../ipcErrors.cjs');
const { createBackupStore } = require('./backupStore.cjs');

function registerBackupIpc(ipcMain, getDataDir) {
  const store = () => createBackupStore(getDataDir());
  ipcMain.handle('backup:external-status', wrapIpcHandler(async () => store().status()));
  ipcMain.handle('backup:select-external-dir', wrapIpcHandler(async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const result = await dialog.showOpenDialog(win, { title: 'Escolher destino da cópia do backup (pendrive, outro disco ou pasta)', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, ...store().status() };
    return { canceled: false, ...store().setExternalDir(result.filePaths[0]) };
  }));
  ipcMain.handle('backup:clear-external-dir', wrapIpcHandler(async () => store().clearExternalDir()));
  ipcMain.handle('backup:copy-external', wrapIpcHandler(async (_e, { backupFile } = {}) => store().copyToExternal(backupFile)));
  ipcMain.handle('backup:delete', wrapIpcHandler(async (_e, { backupFile } = {}) => store().deleteBackup(backupFile)));
}

module.exports = { registerBackupIpc };
