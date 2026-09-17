const { contextBridge, ipcRenderer } = require('electron');

// Após o cutover Dexie, o armazenamento operacional vive no renderer (IndexedDB).
// O IPC existe apenas para: diagnóstico/versão, pasta de dados, gravação de
// arquivos (backup/exportação) e diálogos de seleção de arquivo.
contextBridge.exposeInMainWorld('pesagemApp', {
  getReleaseInfo: () => ipcRenderer.invoke('app:getReleaseInfo'),
  getDiagnosticInfo: () => ipcRenderer.invoke('app:getDiagnosticInfo'),
  getDataDir: () => ipcRenderer.invoke('app:getDataDir'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  files: {
    writeUserFile: (args) => ipcRenderer.invoke('app:writeUserFile', args),
    listUserFiles: (args) => ipcRenderer.invoke('app:listUserFiles', args),
  },
  // Relatórios: o renderer envia o documento/conteúdo e um nome sugerido; o destino é escolhido
  // no diálogo nativo do processo principal (nenhum caminho vem do renderer).
  reports: {
    printToPdf: (args) => ipcRenderer.invoke('reports:print-to-pdf', args),
    print: (args) => ipcRenderer.invoke('reports:print', args),
    saveFile: (args) => ipcRenderer.invoke('reports:save-file', args),
  },
  dialogs: {
    selectImportJson: () => ipcRenderer.invoke('dialog:select-import-json'),
    selectExportDirectory: () => ipcRenderer.invoke('dialog:select-export-directory'),
  },
});
