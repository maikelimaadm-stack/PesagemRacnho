// SSOT dos caminhos do app em runtime (userData, pasta de dados, versão).
// Configurado UMA vez pelo main no app.whenReady(), antes dos IPCs.
// O armazenamento operacional é IndexedDB/Dexie (renderer); aqui ficam apenas
// caminhos de sistema de arquivos usados por backups/exportações e pelo log.
let runtime = null;

function configureAppRuntime({ userDataPath, dataDir, appVersion, isPackaged }) {
  runtime = {
    userDataPath: userDataPath || null,
    dataDir: dataDir || null,
    appVersion: appVersion || null,
    isPackaged: !!isPackaged,
    configuredAt: new Date().toISOString(),
  };
  return runtime;
}

function getAppRuntime() {
  return runtime;
}

function isConfigured() {
  return !!(runtime && runtime.dataDir);
}

function resetRuntimeForTests() {
  runtime = null;
}

module.exports = { configureAppRuntime, getAppRuntime, isConfigured, resetRuntimeForTests };
