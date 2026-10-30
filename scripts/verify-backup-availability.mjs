// Gate backup:availability:verify — auditoria corretiva R1, achado R03.
// "Verificado em [data]" (histórico) é separado de "Disponível agora", "Íntegro agora" e "Cópia externa válida".
// O backup NÃO conta como proteção quando o arquivo verificado foi apagado, renomeado, truncado, alterado com o
// MESMO tamanho (e a mesma data de modificação), quando um anexo da pasta dele foi adulterado ou quando a pasta
// está inacessível; nesses casos o backup periódico não é adiado por causa do registro antigo. Cópia externa só é
// válida conferida no destino agora (apagada, adulterada ou destino desconectado = não válida).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as center from '../src/modules/backup/application/backupCenterService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const require = createRequire(import.meta.url);
const { createBackupStore } = require('../electron/ipc/backupStore.cjs');
const root = mkdtempSync(join(tmpdir(), 'pesagens-disponivel-'));
const dataDir = join(root, 'dados');
const pendrive = join(root, 'pendrive');
mkdirSync(pendrive, { recursive: true });
const bstore = createBackupStore(dataDir);
const ponte = createGateAttachmentBridge(dataDir, { importar: () => join(root, 'gta.pdf') });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
const wrap = (fn) => async (args) => { try { return { ok: true, data: await fn(args || {}) }; } catch (err) { return { ok: false, error: { code: err.code, message: err.message } }; } };
let pastaInacessivel = false;
let seq = 0;

globalThis.window = globalThis.window || {};
window.pesagemApp = {
  files: {
    async writeUserFile({ subdir, filename, content }) {
      const full = join(dirOf(subdir), filename.replace(/(\.\w+)$/, `-${String(seq += 1).padStart(4, '0')}$1`));
      writeFileSync(full, content ?? '', 'utf8');
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes) };
    },
    async listUserFiles({ subdir, extension }) {
      if (pastaInacessivel) return { ok: false, error: { code: 'EACCES', message: 'EACCES: permissão negada (simulada)' } };
      const d = dirOf(subdir);
      return { ok: true, files: readdirSync(d).filter((n) => statSync(join(d, n)).isFile() && (!extension || n.endsWith(extension))).map((name) => ({ name, path: join(d, name), size: statSync(join(d, name)).size, modifiedAt: statSync(join(d, name)).mtime.toISOString() })) };
    },
    async readUserFile({ subdir, filename }) {
      const full = join(dirOf(subdir), filename);
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes), content: bytes.toString('utf8') };
    },
  },
  attachments: ponte.attachments,
  backup: {
    externalStatus: wrap(async () => bstore.status()),
    copyExternal: wrap(async ({ backupFile }) => bstore.copyToExternal(backupFile)),
    verifyExternal: wrap(async ({ backupFile, sha256: s }) => bstore.verifyExternal(backupFile, s)),
    deleteBackup: wrap(async ({ backupFile }) => bstore.deleteBackup(backupFile)),
  },
};
setActorProvider(() => ({ id: 'u1', nome: 'Admin', role: 'ADMIN' }));

const resumo = [];
const quadro = async () => {
  const ov = await center.getOverview();
  return { ov, local: ov.cobertura.local, copia: ov.cobertura.copia, st: ov.status };
};
// Agendador: com o backup verificado só no registro, o periódico NÃO pode ser adiado.
const periodicoRodaria = async () => (await center.getOverview()).periodico.proximo.run === true;

try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [{ numero_animal: '1', marca_id: 'MK', sexo: 'M', peso: 250 }] });
  await ops.confirmOperation(compra.operacao.id);
  writeFileSync(join(root, 'gta.pdf'), Buffer.from('%PDF-1.4 GTA sintetica do gate R03'));
  const anexo = await docs.pickAttachment();
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo });

  // Backup bom: verificado, disponível e íntegro agora; o periódico espera o intervalo.
  const b1 = await center.createBackupNow();
  let q = await quadro();
  assert.equal(q.local, 'OK');
  assert.deepEqual([q.st.disponivelAgora, q.st.integroAgora], [true, true]);
  assert.equal(await periodicoRodaria(), false, 'com backup íntegro agora, o periódico espera o intervalo');
  resumo.push('R03 backup bom: Verificado em, Disponível agora e Íntegro agora = sim; periódico espera');

  const arquivo = b1.backupPath;
  const nome = arquivo.split(/[\\/]/).pop();
  const bytes = readFileSync(arquivo);
  const mtime = statSync(arquivo).mtime;
  const restaurar = () => { writeFileSync(arquivo, bytes); utimesSync(arquivo, mtime, mtime); };
  async function naoProtege(rotulo, estado) {
    const r = await quadro();
    assert.equal(r.local, estado, `${rotulo}: cobertura ${estado}`);
    assert.equal(r.st.lastVerified, null, `${rotulo}: sem backup válido agora`);
    assert.ok(r.st.ultimaVerificacao?.verifiedAt, `${rotulo}: o histórico continua mostrando quando foi verificado`);
    assert.equal(r.st.integroAgora, false, `${rotulo}: não íntegro agora`);
    assert.equal(await periodicoRodaria(), true, `${rotulo}: periódico não é adiado pelo registro antigo`);
    resumo.push(`R03 ${rotulo}: cobertura ${estado}, histórico preservado, periódico não adiado`);
  }

  // Apagado.
  rmSync(arquivo);
  await naoProtege('arquivo apagado', 'ALTERADO');
  restaurar();
  // Renomeado.
  renameSync(arquivo, join(dataDir, 'backups', `renomeado-${nome}`));
  await naoProtege('arquivo renomeado', 'ALTERADO');
  renameSync(join(dataDir, 'backups', `renomeado-${nome}`), arquivo);
  utimesSync(arquivo, mtime, mtime);
  // Truncado.
  truncateSync(arquivo, Math.floor(bytes.length / 2));
  await naoProtege('arquivo truncado', 'ALTERADO');
  restaurar();
  // Alterado com o MESMO tamanho e a MESMA data de modificação (só o hash pega).
  const mexido = Buffer.from(bytes);
  const i = mexido.indexOf(Buffer.from('"reason"'));
  mexido[i + 1] = 'R'.charCodeAt(0);
  writeFileSync(arquivo, mexido);
  utimesSync(arquivo, mtime, mtime);
  assert.equal(statSync(arquivo).size, bytes.length);
  await naoProtege('alterado com o mesmo tamanho e data', 'ALTERADO');
  restaurar();
  // Anexo da pasta do backup adulterado.
  const anexoBackup = join(dataDir, 'backups', nome.replace(/\.json$/, '.anexos'), `${anexo.sha256}.pdf`);
  const bytesAnexo = readFileSync(anexoBackup);
  writeFileSync(anexoBackup, Buffer.concat([bytesAnexo.subarray(0, bytesAnexo.length - 1), Buffer.from([bytesAnexo.at(-1) ^ 1])]));
  await naoProtege('anexo do backup adulterado', 'ALTERADO');
  writeFileSync(anexoBackup, bytesAnexo);
  // Pasta inacessível.
  pastaInacessivel = true;
  await naoProtege('pasta inacessível', 'INDISPONIVEL');
  pastaInacessivel = false;
  q = await quadro();
  assert.equal(q.local, 'OK', 'restaurado o arquivo, volta a proteger');

  // Mais novo alterado, anterior íntegro: a proteção vale pelo anterior (com a data dele).
  const b2 = await center.createBackupNow();
  writeFileSync(b2.backupPath, readFileSync(b2.backupPath, 'utf8').replace('"reason"', '"Reason"'));
  q = await quadro();
  assert.equal(q.local, 'OK');
  assert.equal(q.st.lastVerified.path, arquivo, 'protegido pelo backup anterior íntegro');
  assert.equal(q.st.ultimaVerificacao.path, b2.backupPath, 'o histórico mostra o mais novo');
  assert.equal(q.st.files.find((f) => f.path === b2.backupPath).estado, 'ALTERADO');
  resumo.push('R03 mais novo alterado: proteção pelo anterior íntegro, mais novo marcado ALTERADO');
  rmSync(b2.backupPath);
  rmSync(b2.backupPath.replace(/\.json$/, '.anexos'), { recursive: true, force: true });

  // Cópia externa válida só conferida agora.
  bstore.setExternalDir(pendrive);
  q = await quadro();
  assert.equal(q.copia, 'PENDENTE', 'destino sem cópia: pendente');
  await center.copyToExternal();
  q = await quadro();
  assert.deepEqual([q.copia, q.ov.copiaExterna.valida], ['OK', true]);
  const copiaExterna = join(pendrive, 'pesagens-backups', nome);
  const bytesCopia = readFileSync(copiaExterna);
  rmSync(copiaExterna);
  q = await quadro();
  assert.equal(q.copia, 'PENDENTE', 'cópia apagada no destino: não válida apesar do registro');
  writeFileSync(copiaExterna, Buffer.concat([bytesCopia.subarray(0, bytesCopia.length - 1), Buffer.from('x')]));
  q = await quadro();
  assert.equal(q.copia, 'PENDENTE', 'cópia adulterada (mesmo tamanho): não válida');
  writeFileSync(copiaExterna, bytesCopia);
  q = await quadro();
  assert.equal(q.copia, 'OK');
  rmSync(pendrive, { recursive: true, force: true });
  q = await quadro();
  assert.equal(q.copia, 'INDISPONIVEL', 'destino desconectado');
  resumo.push('R03 cópia externa: válida só conferida no destino agora (apagada/adulterada = pendente; desconectado = indisponível)');

  console.log('OK verify-backup-availability');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  setActorProvider(null);
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
