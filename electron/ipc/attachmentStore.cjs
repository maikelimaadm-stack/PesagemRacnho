// Anexos de documentos (F16) guardados OFFLINE na pasta de dados do usuário, fora do IndexedDB:
//   <dados>/anexos/<sha256>.<ext>   — endereçado pelo conteúdo (mesmo arquivo = um objeto só)
//   <dados>/backups/<backup>.anexos/<sha256>.<ext> — cópia junto do backup completo (pacote: JSON + pasta)
// Regras: extensões permitidas e tamanho máximo; o renderer nunca manda caminho (só sha256 + extensão
// validados, ou o nome do backup reduzido a basename); toda cópia é temporário + rename e é conferida pelo
// SHA-256 lido de volta. Nada aqui apaga anexo (retenção: anexo de fato cancelado continua guardado).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AppError } = require('../ipcErrors.cjs');

const EXTENSOES = Object.freeze(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.xml', '.txt', '.csv']);
const MAX_BYTES = 25 * 1024 * 1024;
const SHA_RE = /^[a-f0-9]{64}$/;

// Erro de domínio: estende AppError para o código e a mensagem chegarem ao renderer (não "Erro interno").
class AttachmentError extends AppError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'AttachmentError';
  }
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function normalizeExt(ext) {
  const e = `.${String(ext || '').replace(/^\./, '').toLowerCase()}`;
  if (!EXTENSOES.includes(e)) throw new AttachmentError('ANEXO_EXTENSAO', `Tipo de arquivo não permitido (${e}). Use PDF, imagem, XML, TXT ou CSV.`);
  return e;
}

function assertSha(value) {
  if (!SHA_RE.test(String(value || ''))) throw new AttachmentError('ANEXO_INVALIDO', 'Identificador do anexo inválido.');
  return String(value);
}

function backupDirName(backupFile) {
  const base = path.basename(String(backupFile || ''));
  if (!/^[\w.-]+\.json$/i.test(base)) throw new AttachmentError('ANEXO_INVALIDO', 'Nome de backup inválido.');
  return `${base.replace(/\.json$/i, '')}.anexos`;
}

function atomicCopy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(src, tmp);
  fs.renameSync(tmp, dest);
}

function createAttachmentStore(dataDir) {
  const root = path.resolve(dataDir);
  const anexosDir = path.join(root, 'anexos');
  const backupsDir = path.join(root, 'backups');
  const objectPath = (dir, sha, ext) => path.join(dir, `${assertSha(sha)}${normalizeExt(ext)}`);

  /** Copia um arquivo escolhido no diálogo nativo para a pasta de anexos (endereçado pelo SHA-256). */
  function importFromPath(srcPath) {
    const resolved = path.resolve(srcPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new AttachmentError('ANEXO_INVALIDO', 'Arquivo não encontrado.');
    const ext = normalizeExt(path.extname(resolved));
    const size = fs.statSync(resolved).size;
    if (size === 0) throw new AttachmentError('ANEXO_VAZIO', 'Arquivo vazio.');
    if (size > MAX_BYTES) throw new AttachmentError('ANEXO_GRANDE', 'Arquivo maior que 25 MB.');
    const bytes = fs.readFileSync(resolved);
    const hash = sha256(bytes);
    const dest = objectPath(anexosDir, hash, ext);
    if (!fs.existsSync(dest) || sha256(fs.readFileSync(dest)) !== hash) atomicCopy(resolved, dest);
    if (sha256(fs.readFileSync(dest)) !== hash) throw new AttachmentError('ANEXO_CORROMPIDO', 'A cópia do anexo não confere (SHA-256).');
    const nome = path.basename(resolved).replace(/[^\w.\- ()À-ÿ]/g, '_').slice(0, 120);
    return { sha256: hash, size, ext: ext.slice(1), nome_original: nome };
  }

  function checkObject(dir, { sha256: sha, ext }) {
    const full = objectPath(dir, sha, ext);
    if (!fs.existsSync(full)) return { sha256: sha, estado: 'FALTANDO' };
    return sha256(fs.readFileSync(full)) === sha ? { sha256: sha, estado: 'OK', size: fs.statSync(full).size } : { sha256: sha, estado: 'CORROMPIDO' };
  }

  const summarize = (checks) => ({
    total: checks.length,
    ok: checks.filter((c) => c.estado === 'OK').length,
    faltando: checks.filter((c) => c.estado === 'FALTANDO').map((c) => c.sha256),
    corrompidos: checks.filter((c) => c.estado === 'CORROMPIDO').map((c) => c.sha256),
  });

  function verify(objects = []) {
    return summarize(objects.map((o) => checkObject(anexosDir, o)));
  }

  /** Copia os anexos para a pasta do backup e confere cada um. Anexo ausente na origem = backup incompleto. */
  function snapshot(backupFile, objects = []) {
    const dir = path.join(backupsDir, backupDirName(backupFile));
    const checks = objects.map((o) => {
      const origem = checkObject(anexosDir, o);
      if (origem.estado !== 'OK') return origem;
      const dest = objectPath(dir, o.sha256, o.ext);
      if (!fs.existsSync(dest) || sha256(fs.readFileSync(dest)) !== o.sha256) atomicCopy(objectPath(anexosDir, o.sha256, o.ext), dest);
      return checkObject(dir, o);
    });
    return { pasta: path.basename(dir), ...summarize(checks) };
  }

  function verifyBackup(backupFile, objects = [], baseDir = backupsDir) {
    const dir = path.join(baseDir, backupDirName(backupFile));
    return { pasta: path.basename(dir), ...summarize(objects.map((o) => checkObject(dir, o))) };
  }

  /** Restaura os anexos da pasta do backup (em `baseDir`) para a pasta de anexos, conferindo o hash. */
  function restore(backupFile, objects = [], baseDir = backupsDir) {
    const dir = path.join(baseDir, backupDirName(backupFile));
    const checks = objects.map((o) => {
      const naOrigem = checkObject(dir, o);
      if (naOrigem.estado !== 'OK') {
        // Já presente e íntegro na pasta de anexos (mesmo conteúdo): restaurado.
        const local = checkObject(anexosDir, o);
        return local.estado === 'OK' ? local : naOrigem;
      }
      const dest = objectPath(anexosDir, o.sha256, o.ext);
      if (!fs.existsSync(dest) || sha256(fs.readFileSync(dest)) !== o.sha256) atomicCopy(objectPath(dir, o.sha256, o.ext), dest);
      return checkObject(anexosDir, o);
    });
    return { pasta: path.basename(dir), ...summarize(checks) };
  }

  /** Bytes de um anexo em base64 (backup protegido, F22) — conferidos pelo hash antes de sair. */
  function readObject(sha, ext) {
    const full = objectPath(anexosDir, sha, ext);
    if (!fs.existsSync(full)) throw new AttachmentError('ANEXO_FALTANDO', 'Arquivo do anexo não encontrado.');
    const bytes = fs.readFileSync(full);
    if (sha256(bytes) !== sha) throw new AttachmentError('ANEXO_CORROMPIDO', 'Anexo corrompido (SHA-256).');
    return { sha256: sha, ext: normalizeExt(ext).slice(1), base64: bytes.toString('base64') };
  }

  /** Grava um anexo vindo de backup protegido; recusa se o conteúdo não bater com o SHA-256 informado. */
  function writeObject(sha, ext, base64) {
    const bytes = Buffer.from(String(base64 || ''), 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) throw new AttachmentError('ANEXO_INVALIDO', 'Anexo inválido.');
    if (sha256(bytes) !== assertSha(sha)) throw new AttachmentError('ANEXO_CORROMPIDO', 'O conteúdo do anexo não confere com o SHA-256.');
    const dest = objectPath(anexosDir, sha, ext);
    fs.mkdirSync(anexosDir, { recursive: true });
    const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, dest);
    return checkObject(anexosDir, { sha256: sha, ext });
  }

  // R02: preparo (staging) da restauração. Os anexos do backup são copiados e conferidos numa pasta de preparo
  // na mesma unidade ANTES de o banco ser substituído; se qualquer um faltar ou não conferir, o preparo é
  // descartado e nada foi alterado. Depois do banco, `commitStage` move cada objeto para a pasta de anexos
  // (rename) e confere de novo. Anexo íntegro já presente nunca é sobrescrito.
  const STAGE_RE = /^[a-f0-9]{32}$/;
  const stageDir = (stageId) => {
    if (!STAGE_RE.test(String(stageId || ''))) throw new AttachmentError('ANEXO_INVALIDO', 'Identificador de preparo inválido.');
    return path.join(root, 'anexos-preparo', stageId);
  };
  const newStageId = () => crypto.randomBytes(16).toString('hex');
  const stageFail = (dir, checks, causa) => {
    fs.rmSync(dir, { recursive: true, force: true });
    const r = summarize(checks);
    return new AttachmentError('ANEXO_PREPARO', `Preparo dos anexos falhou (${causa}): ${r.faltando.length} faltando, ${r.corrompidos.length} corrompido(s). Nada foi alterado.`, { faltando: r.faltando, corrompidos: r.corrompidos, causa });
  };

  /** Prepara os anexos a partir da pasta "<backup>.anexos" em `baseDir`. Tudo ou nada. */
  function stageFromBackup(backupFile, objects = [], baseDir = backupsDir, { antesDeCopiar } = {}) {
    const origem = path.join(baseDir, backupDirName(backupFile));
    const stageId = newStageId();
    const dir = stageDir(stageId);
    const checks = [];
    try {
      for (const o of objects) {
        const c = checkObject(origem, o);
        if (c.estado !== 'OK') { checks.push(c); continue; }
        if (antesDeCopiar) antesDeCopiar(o);
        atomicCopy(objectPath(origem, o.sha256, o.ext), objectPath(dir, o.sha256, o.ext));
        checks.push(checkObject(dir, o));
      }
    } catch (err) {
      throw stageFail(dir, checks, err.code || err.message);
    }
    if (checks.some((c) => c.estado !== 'OK')) throw stageFail(dir, checks, 'origem');
    return { stageId, ...summarize(checks) };
  }

  /** Prepara anexos vindos de backup protegido (base64): cada conteúdo precisa bater com o SHA-256. Tudo ou nada. */
  function stageInline(anexos = [], { antesDeCopiar } = {}) {
    const stageId = newStageId();
    const dir = stageDir(stageId);
    const checks = [];
    try {
      for (const a of anexos) {
        const bytes = Buffer.from(String(a?.base64 || ''), 'base64');
        const sha = assertSha(a?.sha256);
        if (!bytes.length || bytes.length > MAX_BYTES || sha256(bytes) !== sha) { checks.push({ sha256: sha, estado: 'CORROMPIDO' }); continue; }
        if (antesDeCopiar) antesDeCopiar(a);
        const dest = objectPath(dir, sha, a.ext);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dest, bytes);
        checks.push(checkObject(dir, { sha256: sha, ext: a.ext }));
      }
    } catch (err) {
      throw stageFail(dir, checks, err.code || err.message);
    }
    if (checks.some((c) => c.estado !== 'OK')) throw stageFail(dir, checks, 'conteúdo');
    return { stageId, ...summarize(checks) };
  }

  /** Move os anexos preparados para a pasta de anexos e confere cada um lá. */
  function commitStage(stageId, objects = [], { antesDeMover } = {}) {
    const dir = stageDir(stageId);
    for (const o of objects) {
      const dest = objectPath(anexosDir, o.sha256, o.ext);
      if (checkObject(anexosDir, o).estado === 'OK') continue;
      const src = objectPath(dir, o.sha256, o.ext);
      if (!fs.existsSync(src)) continue; // conferido abaixo (fica FALTANDO)
      if (antesDeMover) antesDeMover(o);
      fs.mkdirSync(anexosDir, { recursive: true });
      try { fs.renameSync(src, dest); } catch { atomicCopy(src, dest); }
    }
    const r = verify(objects);
    if (!r.faltando.length && !r.corrompidos.length) fs.rmSync(dir, { recursive: true, force: true });
    return { stageId, ...r };
  }

  function discardStage(stageId) {
    fs.rmSync(stageDir(stageId), { recursive: true, force: true });
    return { stageId, descartado: true };
  }

  function pathOf(sha, ext) {
    const full = objectPath(anexosDir, sha, ext);
    if (!fs.existsSync(full)) throw new AttachmentError('ANEXO_FALTANDO', 'Arquivo do anexo não encontrado.');
    return full;
  }

  return { importFromPath, verify, snapshot, verifyBackup, restore, readObject, writeObject, stageFromBackup, stageInline, commitStage, discardStage, pathOf, anexosDir, backupsDir };
}

module.exports = { createAttachmentStore, AttachmentError, EXTENSOES, MAX_BYTES };
