// Descoberta de balança DENTRO do app — o usuário só liga o Bluetooth do PC.
// Emparelhar no Windows some sozinho; o app procura e conecta.
const { session, ipcMain, BrowserWindow } = require('electron');

let pendingSerial = null;
let pendingBluetooth = null;

function looksLikeBluetoothPort(port) {
  const text = `${port?.portName || ''} ${port?.displayName || ''} ${port?.deviceInstanceId || ''}`.toLowerCase();
  return /bluetooth|bth|btw|standard serial over bluetooth|incoming|outgoing/.test(text);
}

function serializePort(port) {
  return {
    id: port.portId,
    portId: port.portId,
    label: port.displayName || port.portName || 'Porta serial',
    portName: port.portName || '',
    bluetoothLikely: looksLikeBluetoothPort(port),
    kind: 'serial',
  };
}

function serializeBtDevice(device) {
  return {
    id: device.deviceId,
    deviceId: device.deviceId,
    label: device.deviceName || 'Dispositivo Bluetooth',
    kind: 'bluetooth',
  };
}

function resolveWebContents(explicit) {
  if (explicit && !explicit.isDestroyed?.()) return explicit;
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused.webContents;
  const first = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
  return first?.webContents || null;
}

function clearPendingSerial(portId = '') {
  if (!pendingSerial) return;
  try { pendingSerial.callback(portId || ''); } catch { /* ignore */ }
  pendingSerial = null;
}

function clearPendingBluetooth(deviceId = '') {
  if (!pendingBluetooth) return;
  try { pendingBluetooth.callback(deviceId || ''); } catch { /* ignore */ }
  pendingBluetooth = null;
}

function publishBluetoothList(webContents, deviceList) {
  const contents = resolveWebContents(webContents);
  if (!contents) return;
  const devices = (Array.isArray(deviceList) ? deviceList : []).map(serializeBtDevice);
  devices.sort((a, b) => {
    const score = (name) => (/tru|datamars|\bs3\b|scale|balan|pesag/i.test(name) ? 0 : 1);
    return score(a.label) - score(b.label) || a.label.localeCompare(b.label, 'pt-BR');
  });
  contents.send('equipment:device-list', {
    source: 'bluetooth',
    devices,
    empty: devices.length === 0,
  });
}

function handleSelectBluetoothDevice(event, deviceList, webContentsOrCallback, maybeCallback) {
  event.preventDefault();
  const callback = typeof webContentsOrCallback === 'function' ? webContentsOrCallback : maybeCallback;
  const webContents = typeof webContentsOrCallback === 'function' ? null : webContentsOrCallback;
  if (typeof callback !== 'function') return;

  pendingBluetooth = { callback, webContentsId: webContents?.id };
  publishBluetoothList(webContents, deviceList);
}

function registerEquipmentSessionHandlers() {
  const ses = session.defaultSession;

  ses.setPermissionCheckHandler((_webContents, permission) => (
    permission === 'serial' || permission === 'bluetooth'
  ));

  ses.setDevicePermissionHandler((details) => (
    details.deviceType === 'serial' || details.deviceType === 'bluetooth'
  ));

  if (typeof ses.setBluetoothPairingHandler === 'function') {
    ses.setBluetoothPairingHandler((_details, callback) => {
      callback({ confirmed: true });
    });
  }

  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    clearPendingSerial('');
    pendingSerial = { callback, webContentsId: webContents?.id };
    const devices = Array.isArray(portList) ? portList.map(serializePort) : [];
    const contents = resolveWebContents(webContents);
    contents?.send('equipment:device-list', {
      source: 'serial',
      devices,
      empty: devices.length === 0,
    });
  });

  if (typeof ses.on === 'function') {
    ses.on('select-bluetooth-device', handleSelectBluetoothDevice);
  }
}

/** Alguns Electron só emitem no webContents — cobre os dois. */
function attachBluetoothHandlerToContents(contents) {
  if (!contents || contents.__makScaleBtBound) return;
  contents.__makScaleBtBound = true;
  contents.on('select-bluetooth-device', (event, deviceList, callback) => {
    handleSelectBluetoothDevice(event, deviceList, contents, callback);
  });
}

function registerEquipmentIpc(ipcMainRef = ipcMain) {
  ipcMainRef.handle('equipment:choose-serial-port', (_event, portId) => {
    if (!pendingSerial) return { ok: false, reason: 'none-pending' };
    clearPendingSerial(portId == null ? '' : String(portId));
    return { ok: true };
  });

  ipcMainRef.handle('equipment:cancel-serial-port', () => {
    clearPendingSerial('');
    return { ok: true };
  });

  ipcMainRef.handle('equipment:choose-bluetooth-device', (_event, deviceId) => {
    if (!pendingBluetooth) return { ok: false, reason: 'none-pending' };
    clearPendingBluetooth(deviceId == null ? '' : String(deviceId));
    return { ok: true };
  });

  ipcMainRef.handle('equipment:cancel-bluetooth-device', () => {
    clearPendingBluetooth('');
    return { ok: true };
  });
}

module.exports = {
  registerEquipmentSessionHandlers,
  registerEquipmentIpc,
  attachBluetoothHandlerToContents,
};
