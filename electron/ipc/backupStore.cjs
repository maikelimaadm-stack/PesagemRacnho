// Backup: cópia para destino independente (F21) e exclusão controlada pela retenção (F22).
// O destino externo (pendrive, segundo disco, outra pasta) é escolhido SÓ no diálogo nativo e guardado pelo
// processo principal em <dados>/backup-externo.json — o renderer nunca envia caminho. A cópia vai para
// <destino>/pesagens-backups/ (JSON + pasta .anexos), por temporário + rename, e é conferida lendo de volta
// (SHA-256). Destino ausente ou sem espaço = erro claro; o backup local continua valendo.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class BackupStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const sha256File = (full) => crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');

function validBackupName(name) {
  const base = path.basename(String(name || ''));
  if (!/^[\w.-]+\.json$/i.test(base) || base !== String(name)) throw new BackupStoreError('BACKUP_NOME', 'Nome de backup inválido.');
  return base;
}

function createBackupStore(dataDir) {
  const root = path.resolve(dataDir);
  const backupsDir = path.join(root, 'backups');
  const configFile = path.join(root, 'backup-externo.json');

  function readConfig() {
    try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { return null; }
  }

  function setExternalDir(dir) {
    const resolved = path.resolve(dir);
    if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
      throw new BackupStoreError('DESTINO_MESMA_PASTA', 'Escolha um destino fora da pasta de dados do aplicativo (pendrive, outro disco ou outra pasta).');
    }
    fs.writeFileSync(configFile, JSON.stringify({ dir: resolved, escolhidoEm: new Date().toISOString() }, null, 2));
    return status();
  }

  function clearExternalDir() {
    if (fs.existsSync(configFile)) fs.rmSync(configFile);
    return status();
  }

  function freeBytes(dir) {
    try {
      const st = fs.statfsSync(dir);
      return Number(st.bavail) * Number(st.bsize);
    } catch { return null; }
  }

  function status() {
    const cfg = readConfig();
    if (!cfg?.dir) return { configurado: false, disponivel: false, destino: null };
    let disponivel = false;
    try {
      disponivel = fs.existsSync(cfg.dir) && fs.statSync(cfg.dir).isDirectory();
      if (disponivel) fs.accessSync(cfg.dir, fs.constants.W_OK);
    } catch { disponivel = false; }
    return { configurado: true, disponivel, destino: cfg.dir, livreBytes: disponivel ? freeBytes(cfg.dir) : null, escolhidoEm: cfg.escolhidoEm || null };
  }

  function copyVerified(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dest);
    if (sha256File(dest) !== sha256File(src)) throw new BackupStoreError('COPIA_DIVERGENTE', `A cópia de ${path.basename(src)} não confere (SHA-256).`);
  }

  /** Copia o backup (JSON + .anexos) para o destino externo e confere cada arquivo lendo de volta. */
  function copyToExternal(backupFile) {
    const name = validBackupName(backupFile);
    const st = status();
    if (!st.configurado) throw new BackupStoreError('DESTINO_NAO_CONFIGURADO', 'Nenhum destino externo escolhido.');
    if (!st.disponivel) throw new BackupStoreError('DESTINO_INDISPONIVEL', `Destino externo indisponível (${st.destino}). Conecte o pendrive/disco e tente de novo.`);
    const src = path.join(backupsDir, name);
    if (!fs.existsSync(src)) throw new BackupStoreError('BACKUP_NAO_ENCONTRADO', 'Backup não encontrado na pasta local.');
    const anexosSrc = path.join(backupsDir, name.replace(/\.json$/i, '.anexos'));
    const arquivos = [[src, name]];
    if (fs.existsSync(anexosSrc)) {
      for (const f of fs.readdirSync(anexosSrc)) arquivos.push([path.join(anexosSrc, f), path.join(path.basename(anexosSrc), f)]);
    }
    const total = arquivos.reduce((acc, [f]) => acc + fs.statSync(f).size, 0);
    if (st.livreBytes !== null && st.livreBytes < total * 1.1) throw new BackupStoreError('ESPACO_INSUFICIENTE', 'Sem espaço suficiente no destino externo.');
    const destRoot = path.join(st.destino, 'pesagens-backups');
    for (const [from, rel] of arquivos) copyVerified(from, path.join(destRoot, rel));
    return { ok: true, destino: destRoot, arquivos: arquivos.length, bytes: total, sha256: sha256File(path.join(destRoot, name)), copiadoEm: new Date().toISOString() };
  }

  /** Remove um backup da pasta local (JSON + .anexos). Só nomes válidos e só dentro de backups/. */
  function deleteBackup(backupFile) {
    const name = validBackupName(backupFile);
    const full = path.join(backupsDir, name);
    if (!full.startsWith(`${backupsDir}${path.sep}`)) throw new BackupStoreError('BACKUP_NOME', 'Nome de backup inválido.');
    if (fs.existsSync(full)) fs.rmSync(full);
    const anexos = path.join(backupsDir, name.replace(/\.json$/i, '.anexos'));
    if (fs.existsSync(anexos)) fs.rmSync(anexos, { recursive: true, force: true });
    return { ok: true, removido: name };
  }

  return { status, setExternalDir, clearExternalDir, copyToExternal, deleteBackup, backupsDir };
}

module.exports = { createBackupStore, BackupStoreError };
