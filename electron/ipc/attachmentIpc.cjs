// IPC dos anexos (F16). Seleção pelo diálogo nativo (o caminho nunca vem do renderer); o renderer só envia
// sha256 + extensão (validados), o NOME do backup (basename) e, na restauração, o TOKEN da seleção (R02): a pasta
// "<backup>.anexos" é a do arquivo exato que foi inspecionado, conferido de novo pelo SHA-256 antes de cada uso.
const { dialog, shell, BrowserWindow } = require('electron');
const { wrapIpcHandler } = require('../ipcErrors.cjs');
const { createAttachmentStore, EXTENSOES } = require('./attachmentStore.cjs');
const { createSelectionRegistry } = require('./backupSelection.cjs');

const selecoes = createSelectionRegistry();

/** Chamado pelo diálogo de seleção com os bytes lidos; devolve o token que vincula a restauração ao arquivo. */
function rememberSelectedBackup(filePath, bytes) {
  return selecoes.remember(filePath, bytes);
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
  ipcMain.handle('attachments:read', wrapIpcHandler(async (_e, { sha256, ext } = {}) => store().readObject(sha256, ext)));
  ipcMain.handle('attachments:snapshot', wrapIpcHandler(async (_e, { backupFile, objects } = {}) => store().snapshot(backupFile, objectsOf(objects))));
  ipcMain.handle('attachments:verify-backup', wrapIpcHandler(async (_e, { backupFile, objects } = {}) => store().verifyBackup(backupFile, objectsOf(objects))));
  // R02 — restauração em fases: conferir (nada muda) → preparar (pasta de preparo) → [banco] → efetivar | descartar.
  ipcMain.handle('attachments:preflight-selected', wrapIpcHandler(async (_e, { selecao, objects } = {}) => {
    const sel = selecoes.resolve(selecao);
    return { arquivo: { fileName: sel.fileName, sha256: sel.sha256, size: sel.size }, conteudoSha256: sel.conteudoSha256, ...(objectsOf(objects).length ? store().verifyBackup(sel.fileName, objectsOf(objects), sel.dir) : { total: 0, ok: 0, faltando: [], corrompidos: [] }) };
  }));
  ipcMain.handle('attachments:stage', wrapIpcHandler(async (_e, { selecao, objects, inline } = {}) => {
    if (Array.isArray(inline)) return store().stageInline(inline.slice(0, 100000).map((a) => ({ sha256: a?.sha256, ext: a?.ext, base64: a?.base64 })));
    const sel = selecoes.resolve(selecao);
    return store().stageFromBackup(sel.fileName, objectsOf(objects), sel.dir);
  }));
  ipcMain.handle('attachments:commit-stage', wrapIpcHandler(async (_e, { stageId, objects } = {}) => store().commitStage(stageId, objectsOf(objects))));
  ipcMain.handle('attachments:discard-stage', wrapIpcHandler(async (_e, { stageId } = {}) => store().discardStage(stageId)));
}

module.exports = { registerAttachmentIpc, rememberSelectedBackup };
