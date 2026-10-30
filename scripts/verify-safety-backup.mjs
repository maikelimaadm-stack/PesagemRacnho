// Gate safety:backup:verify — auditoria corretiva R1, achado R01.
// Antes de importar, restaurar, limpar ou fazer reset, o backup de segurança precisa ser GRAVADO E VERIFICADO
// (leitura de volta, SHA-256 do arquivo e do conteúdo, contagens e anexos). Falhas injetadas — gravação truncada,
// conteúdo trocado por outro backup válido, leitura de volta falhando, disco cheio, anexo de origem sumido —
// devem impedir a operação SEM alterar o banco nem a pasta de anexos (comparação por hash antes/depois). Com o
// backup bom, a operação roda e o backup de segurança restaura as contagens de antes.
// Usa o armazenamento de anexos real do processo principal (electron/ipc/attachmentStore.cjs) numa pasta temporária.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';

const require = createRequire(import.meta.url);
const { createAttachmentStore } = require('../electron/ipc/attachmentStore.cjs');
const root = mkdtempSync(join(tmpdir(), 'pesagens-seguranca-'));
const dataDir = join(root, 'dados');
const astore = createAttachmentStore(dataDir);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
const wrap = (fn) => async (args) => { try { return { ok: true, data: await fn(args) }; } catch (err) { return { ok: false, error: { code: err.code, message: err.message } }; } };
let falha = null; // modo de falha injetada
let backupBomAnterior = null; // conteúdo de um backup válido mais antigo (para "conteúdo trocado")
let seq = 0;
let selecionado = null;

globalThis.window = globalThis.window || {};
window.pesagemApp = {
  files: {
    // Mesma semântica do main: grava, relê do disco e devolve o SHA do que ESTÁ no disco.
    async writeUserFile({ subdir, filename, content }) {
      if (falha === 'ENOSPC' && subdir === 'backups') throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      let conteudo = content ?? '';
      if (falha === 'TRUNCADO' && subdir === 'backups') conteudo = conteudo.slice(0, Math.floor(conteudo.length / 2));
      if (falha === 'TROCADO' && subdir === 'backups' && backupBomAnterior) conteudo = backupBomAnterior;
      const nome = filename.replace(/(\.\w+)$/, `-${String(seq += 1).padStart(4, '0')}$1`);
      const full = join(dirOf(subdir), nome);
      writeFileSync(full, conteudo, 'utf8');
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes) };
    },
    async listUserFiles({ subdir, extension }) {
      const d = dirOf(subdir);
      return { ok: true, files: readdirSync(d).filter((n) => statSync(join(d, n)).isFile() && (!extension || n.endsWith(extension))).map((name) => ({ name, path: join(d, name), size: statSync(join(d, name)).size, modifiedAt: statSync(join(d, name)).mtime.toISOString() })) };
    },
    async readUserFile({ subdir, filename }) {
      if (falha === 'LEITURA') throw Object.assign(new Error('EIO: falha de leitura (simulada)'), { code: 'EIO' });
      const full = join(dirOf(subdir), filename);
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes), content: bytes.toString('utf8') };
    },
  },
  attachments: {
    selectAndImport: wrap(async () => astore.importFromPath(join(root, 'gta.pdf'))),
    verify: wrap(async ({ objects }) => astore.verify(objects)),
    snapshot: wrap(async ({ backupFile, objects }) => astore.snapshot(backupFile, objects)),
    verifyBackup: wrap(async ({ backupFile, objects }) => astore.verifyBackup(backupFile, objects)),
    // origem 'selecionado': o main usa o arquivo escolhido no diálogo (aqui, `selecionado`).
    restore: wrap(async ({ origem, backupFile, objects }) => astore.restore(origem === 'selecionado' ? selecionado : backupFile, objects)),
  },
};

// Hash de todo o banco operacional (fora o histórico de backup, que REGISTRA a tentativa) + pasta de anexos.
async function fotografia() {
  const db = await storage.ensureReady();
  const partes = [];
  for (const t of db.tables.map((x) => x.name).sort()) {
    if (t === 'backupHistory') continue;
    const rows = (await db.table(t).toArray()).map(({ localId: _l, ...r }) => r).sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
    partes.push(`${t}:${sha(JSON.stringify(rows))}`);
  }
  const dir = join(dataDir, 'anexos');
  const anexos = existsSync(dir) ? readdirSync(dir).sort().map((n) => `${n}:${sha(readFileSync(join(dir, n)))}`) : [];
  return { banco: partes.join('|'), anexos: anexos.join('|') };
}

const resumo = [];
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  await db.table('usuarios').add({ id: 'u1', login: 'admin', nome: 'Admin', role: 'ADMIN', ativo: true, password_hash: 'h', password_salt: 's', created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [1, 2, 3].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
  await ops.confirmOperation(compra.operacao.id);
  writeFileSync(join(root, 'gta.pdf'), Buffer.from('%PDF-1.4 GTA sintética do gate R01'));
  const anexo = await docs.pickAttachment();
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo });

  // Backup bom de referência (vira o "conteúdo trocado" e o arquivo a restaurar).
  const bom = await maintenance.createBackupNow({ reason: 'manual-ui' });
  backupBomAnterior = readFileSync(bom.backupPath, 'utf8');
  const backupParaRestaurar = JSON.parse(backupBomAnterior);
  // Muda o banco depois do backup de referência, para "conteúdo trocado" ser de fato OUTRO backup.
  const compra2 = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-02', itens: [{ numero_animal: '4', marca_id: 'MK', sexo: 'F', peso: 240 }] });
  await ops.confirmOperation(compra2.operacao.id);
  const exportacao = (await storage.exportPesagensJson()).payload;

  const operacoes = {
    importar: () => maintenance.applyImportWeighingJson(exportacao, { skipDuplicates: true }),
    restaurar: () => { selecionado = bom.backupPath.split(/[\\/]/).pop(); return maintenance.applyRestoreBackup(backupParaRestaurar); },
    limpar: () => maintenance.clearOperationalData({ confirmationText: maintenance.CLEAR_CONFIRMATION_TEXT }),
    reset: () => maintenance.resetAllData({ confirmationText: maintenance.RESET_CONFIRMATION_TEXT }),
  };
  const anexoApp = join(dataDir, 'anexos', `${anexo.sha256}.pdf`);
  const modos = ['TRUNCADO', 'TROCADO', 'LEITURA', 'ENOSPC', 'ANEXO_SUMIU'];
  for (const modo of modos) {
    for (const [nome, op] of Object.entries(operacoes)) {
      let guardado = null;
      if (modo === 'ANEXO_SUMIU') { guardado = readFileSync(anexoApp); rmSync(anexoApp); } else falha = modo;
      const antes = await fotografia();
      await assert.rejects(op(), (err) => err.code === 'BACKUP_PRE_OPERACAO_FALHOU', `${modo}/${nome}: operação recusada`);
      const depois = await fotografia();
      falha = null;
      if (guardado) writeFileSync(anexoApp, guardado);
      assert.equal(depois.banco, antes.banco, `${modo}/${nome}: banco idêntico`);
      assert.equal(depois.anexos, antes.anexos, `${modo}/${nome}: anexos idênticos`);
    }
    resumo.push(`R01 ${modo}: importar/restaurar/limpar/reset recusados, banco e anexos idênticos`);
  }
  const historico = (await db.table('backupHistory').toArray()).filter((h) => h.tipo === 'safety-failed');
  assert.equal(historico.length, modos.length * 4, 'cada falha fica no histórico');
  resumo.push('R01 falhas registradas no histórico (safety-failed)');

  // Sucesso: limpar com backup bom; o backup de segurança restaura as contagens de antes.
  const contagensAntes = Object.fromEntries(await Promise.all(['animais', 'pesagens', 'documentos', 'usuarios', 'operacoes'].map(async (t) => [t, await db.table(t).count()])));
  const limpo = await maintenance.clearOperationalData({ confirmationText: maintenance.CLEAR_CONFIRMATION_TEXT });
  assert.equal(limpo.safetyBackup.verified, true, 'evidência entregue ao motor é de backup verificado');
  const seguranca = JSON.parse(readFileSync(limpo.safetyBackup.path, 'utf8'));
  assert.equal(seguranca.manifest.reason, 'pre-clear-operational');
  const dry = await storage.dryRunRestore(seguranca);
  for (const [t, n] of Object.entries(contagensAntes)) assert.equal(dry.counts[t], n, `backup de segurança tem ${t}`);
  selecionado = limpo.safetyBackup.path.split(/[\\/]/).pop();
  await maintenance.applyRestoreBackup(seguranca);
  for (const [t, n] of Object.entries(contagensAntes)) assert.equal(await (await storage.ensureReady()).table(t).count(), n, `restaurado: ${t}`);
  resumo.push('R01 sucesso: evidência verificada, backup de segurança restaurável com as contagens de antes');

  console.log('OK verify-safety-backup');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
