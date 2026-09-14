// Diagnóstico local (sem telemetria, sem internet). Não inclui dados do usuário.
// O estado do armazenamento (IndexedDB/Dexie) é reportado pela tela de Manutenção,
// que consulta o próprio banco no renderer; aqui vão versão/caminhos/log.
const fs = require('fs');
const runtime = require('./appRuntime.cjs');

function buildDiagnosticInfo({ productName, isPackaged, logPath } = {}) {
  const rt = runtime.getAppRuntime() || {};
  const dataDir = rt.dataDir || null;
  return {
    version: rt.appVersion || null,
    productName: productName || 'Pesagens Individuais',
    isPackaged: !!isPackaged,
    storage: 'IndexedDB local (Dexie)',
    userDataPath: rt.userDataPath || null,
    dataDir,
    dataDirExists: dataDir ? fs.existsSync(dataDir) : false,
    logPath: logPath || null,
    logExists: logPath ? fs.existsSync(logPath) : false,
  };
}

module.exports = { buildDiagnosticInfo };
