// R3-01: marcador DURÁVEL de restauração crítica (a restauração falhou e a volta automática também). Fica fora do
// banco (que pode estar inconsistente), na pasta de dados do app, num arquivo de nome FIXO — o renderer não escolhe
// caminho. Gravação atômica: arquivo temporário + fsync + rename (+ fsync da pasta quando o sistema permite). Conteúdo
// mínimo e validado: código, instante, fase, nome do backup de segurança (só o nome) e SHA-256 dele — nada de dados de
// animais, senhas, conteúdo ou caminho do usuário. Arquivo ilegível conta como crítico (fail-closed).
const path = require('path');
const fs = require('fs');
const { AppError } = require('../ipcErrors.cjs');

const ARQUIVO = 'estado-restauracao-critica.json';
const HISTORICO = 'estado-restauracao-critica.historico.jsonl';
const FASES = Object.freeze(['banco', 'anexos', 'derivados', 'conferencia', 'compensacao', 'desconhecida']);
const NOME_RE = /^[\w.-]{1,160}\.json$/;
const SHA_RE = /^[a-f0-9]{64}$/;

class CriticalStateError extends AppError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'CriticalStateError';
  }
}

function escreverAtomico(destino, conteudo) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, conteudo);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, destino);
  try { const dfd = fs.openSync(path.dirname(destino), 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch { /* Windows não sincroniza pasta */ }
}

function createCriticalStateStore(dataDir) {
  const arquivo = path.join(path.resolve(dataDir), ARQUIVO);
  const historico = path.join(path.resolve(dataDir), HISTORICO);

  function get() {
    if (!fs.existsSync(arquivo)) return null;
    try {
      const m = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (m?.codigo !== 'RESTAURACAO_CRITICA') throw new Error('formato');
      return m;
    } catch {
      // Existe mas não se lê: continua crítico (fail-closed).
      return { codigo: 'RESTAURACAO_CRITICA', ilegivel: true, fase: 'desconhecida', em: null, backupNome: null, backupSha256: null };
    }
  }

  function set(input = {}) {
    const marcador = {
      codigo: 'RESTAURACAO_CRITICA',
      em: new Date().toISOString(),
      fase: FASES.includes(input.fase) ? input.fase : 'desconhecida',
      backupNome: NOME_RE.test(String(input.backupNome || '')) ? path.basename(String(input.backupNome)) : null,
      backupSha256: SHA_RE.test(String(input.backupSha256 || '')) ? String(input.backupSha256) : null,
    };
    escreverAtomico(arquivo, JSON.stringify(marcador, null, 2));
    try { fs.appendFileSync(historico, `${JSON.stringify({ evento: 'CRITICO', ...marcador })}\n`); } catch { /* o marcador é o que importa */ }
    return marcador;
  }

  /** Só depois de uma restauração conferida (motivo fixo + SHA-256 do conteúdo restaurado). */
  function clear(input = {}) {
    if (input.motivo !== 'restauracao-verificada' || !SHA_RE.test(String(input.conteudoSha256 || ''))) {
      throw new CriticalStateError('CRITICO_LIBERACAO_INVALIDA', 'O estado crítico só é liberado por uma restauração conferida.');
    }
    const anterior = get();
    if (!anterior) return { liberado: false };
    try { fs.appendFileSync(historico, `${JSON.stringify({ evento: 'LIBERADO', em: new Date().toISOString(), conteudoSha256: input.conteudoSha256, anterior })}\n`); } catch { /* idem */ }
    fs.rmSync(arquivo, { force: true });
    return { liberado: true };
  }

  return { get, set, clear, arquivo };
}

function registerCriticalStateIpc(ipcMain, getDataDir, wrapIpcHandler) {
  const store = () => createCriticalStateStore(getDataDir());
  ipcMain.handle('app:critical-state-get', wrapIpcHandler(async () => store().get()));
  ipcMain.handle('app:critical-state-set', wrapIpcHandler(async (_e, input = {}) => store().set(input)));
  ipcMain.handle('app:critical-state-clear', wrapIpcHandler(async (_e, input = {}) => store().clear(input)));
}

module.exports = { createCriticalStateStore, registerCriticalStateIpc, CriticalStateError, ARQUIVO };
