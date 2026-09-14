// Log local simples para diagnóstico do app instalado.
// SEM telemetria, SEM internet. Grava em userData/logs/app.log.
// Não registra dados sensíveis do usuário (nem pesagens).
const fs = require('fs');
const path = require('path');

let logFilePath = null;

function initLogger(logDir) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, 'app.log');
  } catch (err) {
    logFilePath = null;
    // fallback silencioso para console
    console.error('[appLogger] falha ao iniciar log:', err.message);
  }
  return logFilePath;
}

function getLogFilePath() {
  return logFilePath;
}

function log(tag, message) {
  const line = `[${new Date().toISOString()}] ${tag} ${message}`;
  try {
    if (logFilePath) fs.appendFileSync(logFilePath, line + '\n', 'utf8');
  } catch {
    /* nunca deixar o log quebrar o app */
  }
  console.log(line);
}

module.exports = { initLogger, getLogFilePath, log };
