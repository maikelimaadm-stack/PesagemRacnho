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
    readUserFile: (args) => ipcRenderer.invoke('app:readUserFile', args),
  },
  // Relatórios: o renderer envia o documento/conteúdo e um nome sugerido; o destino é escolhido
  // no diálogo nativo do processo principal (nenhum caminho vem do renderer).
  reports: {
    printToPdf: (args) => ipcRenderer.invoke('reports:print-to-pdf', args),
    print: (args) => ipcRenderer.invoke('reports:print', args),
    saveFile: (args) => ipcRenderer.invoke('reports:save-file', args),
  },
  // Anexos de documentos (F16): o renderer só envia sha256 + extensão e o nome do backup; nunca caminho.
  attachments: {
    selectAndImport: () => ipcRenderer.invoke('attachments:select-and-import'),
    verify: (args) => ipcRenderer.invoke('attachments:verify', args),
    open: (args) => ipcRenderer.invoke('attachments:open', args),
    snapshot: (args) => ipcRenderer.invoke('attachments:snapshot', args),
    verifyBackup: (args) => ipcRenderer.invoke('attachments:verify-backup', args),
    restore: (args) => ipcRenderer.invoke('attachments:restore', args),
    read: (args) => ipcRenderer.invoke('attachments:read', args),
    write: (args) => ipcRenderer.invoke('attachments:write', args),
  },
  // Backup (F21/F22): destino externo escolhido no diálogo nativo; o renderer só envia o nome do backup.
  backup: {
    externalStatus: () => ipcRenderer.invoke('backup:external-status'),
    selectExternalDir: () => ipcRenderer.invoke('backup:select-external-dir'),
    clearExternalDir: () => ipcRenderer.invoke('backup:clear-external-dir'),
    copyExternal: (args) => ipcRenderer.invoke('backup:copy-external', args),
    deleteBackup: (args) => ipcRenderer.invoke('backup:delete', args),
  },
  dialogs: {
    selectImportJson: () => ipcRenderer.invoke('dialog:select-import-json'),
    selectExportDirectory: () => ipcRenderer.invoke('dialog:select-export-directory'),
  },
  // Balança: o app lista e conecta (Bluetooth ou COM) — sem emparelhar no Windows.
  equipment: {
    onDeviceList: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('equipment:device-list', listener);
      return () => ipcRenderer.removeListener('equipment:device-list', listener);
    },
    // Só portas COM reais — não reaproveitar lista Bluetooth (quebrava o clique no S3).
    onSerialPortList: (handler) => {
      const listener = (_event, payload) => {
        if (payload?.source !== 'serial') return;
        handler({
          ports: (payload?.devices || []).map((d) => ({
            portId: d.portId || d.id,
            displayName: d.label,
            portName: d.portName || '',
            bluetoothLikely: d.bluetoothLikely,
          })),
          empty: payload?.empty,
        });
      };
      ipcRenderer.on('equipment:device-list', listener);
      return () => ipcRenderer.removeListener('equipment:device-list', listener);
    },
    chooseSerialPort: (portId) => ipcRenderer.invoke('equipment:choose-serial-port', portId),
    cancelSerialPort: () => ipcRenderer.invoke('equipment:cancel-serial-port'),
    chooseBluetoothDevice: (deviceId) => ipcRenderer.invoke('equipment:choose-bluetooth-device', deviceId),
    cancelBluetoothDevice: () => ipcRenderer.invoke('equipment:cancel-bluetooth-device'),
  },
});
