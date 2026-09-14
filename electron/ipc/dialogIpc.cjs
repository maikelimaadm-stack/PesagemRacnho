const { dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { wrapIpcHandler, AppError } = require('../ipcErrors.cjs');

function focusedWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function assertExtension(filePath, allowed) {
  const ext = path.extname(filePath).toLowerCase();
  if (!allowed.includes(ext)) {
    throw new AppError('PATH_001', `Extensão não permitida (${ext || 'nenhuma'})`);
  }
}

function assertRegularFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new AppError('PATH_001', 'Arquivo não encontrado');
  }
  if (fs.statSync(resolved).isDirectory()) {
    throw new AppError('PATH_001', 'Diretório não é permitido como arquivo');
  }
  return resolved;
}

function registerDialogIpc(ipcMain, getDataDir) {
  ipcMain.handle(
    'dialog:select-import-json',
    wrapIpcHandler(async () => {
      const win = focusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Selecionar arquivo JSON para importação',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return { canceled: true };
      }
      const filePath = assertRegularFile(result.filePaths[0]);
      assertExtension(filePath, ['.json']);
      let payload;
      try {
        payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        throw new AppError('IMPORT_001', 'Arquivo JSON inválido');
      }
      return {
        canceled: false,
        fileName: path.basename(filePath),
        payload,
      };
    })
  );

  ipcMain.handle(
    'dialog:select-export-directory',
    wrapIpcHandler(async () => {
      const win = focusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Selecionar pasta de exportação',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return { canceled: true };
      }
      const directoryPath = path.resolve(result.filePaths[0]);
      if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
        throw new AppError('PATH_001', 'Pasta inválida');
      }
      return { canceled: false, directoryPath };
    })
  );
}

module.exports = {
  registerDialogIpc,
  assertExtension,
  assertRegularFile,
};
