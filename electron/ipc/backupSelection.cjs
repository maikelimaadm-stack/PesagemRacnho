// R02 (auditoria corretiva R1): a restauração fica VINCULADA ao arquivo exato escolhido no diálogo. Cada seleção
// recebe um token aleatório guardado aqui, no processo principal, com pasta, nome, tamanho e SHA-256 dos bytes
// que foram lidos e entregues ao renderer. Antes de ler anexos, o arquivo é relido e conferido: se foi trocado,
// truncado ou alterado (mesmo com o mesmo tamanho) depois da inspeção, a restauração é recusada. Uma seleção
// posterior (outro diálogo) não muda o alvo de uma restauração já inspecionada — o token é outro.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AppError } = require('../ipcErrors.cjs');

const TOKEN_RE = /^[a-f0-9]{32}$/;

// Erro de domínio: estende AppError para o código e a mensagem chegarem ao renderer (não "Erro interno").
class SelectionError extends AppError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'SelectionError';
  }
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function createSelectionRegistry({ max = 16 } = {}) {
  const selecoes = new Map();

  /** Registra o arquivo escolhido (com os bytes já lidos) e devolve o token da seleção. */
  function remember(filePath, bytes) {
    const token = crypto.randomBytes(16).toString('hex');
    const full = path.resolve(filePath);
    selecoes.set(token, { dir: path.dirname(full), fileName: path.basename(full), size: bytes.length, sha256: sha256(bytes) });
    while (selecoes.size > max) selecoes.delete(selecoes.keys().next().value);
    return { token, sha256: sha256(bytes), size: bytes.length };
  }

  /** Devolve a seleção do token, depois de conferir que o arquivo no disco ainda é o mesmo que foi inspecionado. */
  function resolve(token) {
    const sel = TOKEN_RE.test(String(token || '')) ? selecoes.get(token) : null;
    if (!sel) throw new SelectionError('BACKUP_SELECAO_INVALIDA', 'Seleção de backup expirada ou inválida: selecione o arquivo de novo.');
    const full = path.join(sel.dir, sel.fileName);
    let bytes;
    try {
      bytes = fs.readFileSync(full);
    } catch {
      throw new SelectionError('BACKUP_ARQUIVO_TROCADO', 'O arquivo de backup selecionado não está mais disponível. Nada foi alterado.');
    }
    if (bytes.length !== sel.size || sha256(bytes) !== sel.sha256) {
      throw new SelectionError('BACKUP_ARQUIVO_TROCADO', 'O arquivo de backup mudou depois da inspeção (conteúdo diferente do conferido). Selecione e inspecione de novo. Nada foi alterado.');
    }
    return { ...sel };
  }

  return { remember, resolve };
}

module.exports = { createSelectionRegistry, SelectionError };
