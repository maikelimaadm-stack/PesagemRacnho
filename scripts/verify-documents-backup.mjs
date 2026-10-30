// Gate documents:backup:verify — missão pesagens-integrada, checkpoint B4 (F16).
// Usa o MESMO armazenamento de anexos do processo principal (electron/ipc/attachmentStore.cjs) sobre uma pasta
// temporária, ligado ao renderer por uma ponte simulada:
//   • anexo: extensão permitida, tamanho máximo, vazio recusado, endereçado por SHA-256, sem caminho do renderer;
//   • documento vinculado a operação/animal; cancelar não apaga o arquivo;
//   • backup completo = JSON + pasta "<backup>.anexos" verificada; anexo faltando = backup NÃO completo;
//     anexo corrompido na pasta do backup = verificação FALHOU;
//   • restauração em base limpa recupera documentos, vínculos e anexos com o mesmo hash; anexo ausente no pacote
//     aparece como faltando; backup legado (sem documentos) continua restaurável.
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
const root = mkdtempSync(join(tmpdir(), 'pesagens-anexos-'));
const dataDir = join(root, 'dados');
const fora = join(root, 'fora');
mkdirSync(fora, { recursive: true });
const store = createAttachmentStore(dataDir);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
let selecionado = null; // simula o diálogo nativo de restauração (o processo principal lembra o arquivo)
let proximoArquivo = null; // simula o arquivo escolhido no diálogo de anexo
const wrap = (fn) => async (args) => { try { return { ok: true, data: await fn(args) }; } catch (err) { return { ok: false, error: { code: err.code, message: err.message } }; } };

globalThis.window = globalThis.window || {};
window.pesagemApp = {
  files: {
    async writeUserFile({ subdir, filename, content }) {
      const full = join(dirOf(subdir), filename);
      writeFileSync(full, content ?? '', 'utf8');
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes) };
    },
    async listUserFiles({ subdir, extension }) {
      const d = dirOf(subdir);
      return { ok: true, files: readdirSync(d).filter((n) => !extension || n.endsWith(extension)).filter((n) => statSync(join(d, n)).isFile()).map((name) => ({ name, path: join(d, name), size: statSync(join(d, name)).size, modifiedAt: statSync(join(d, name)).mtime.toISOString() })) };
    },
    async readUserFile({ subdir, filename }) {
      const full = join(dirOf(subdir), filename);
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes), content: bytes.toString('utf8') };
    },
  },
  attachments: {
    selectAndImport: wrap(async () => (proximoArquivo ? store.importFromPath(proximoArquivo) : { canceled: true })),
    verify: wrap(async ({ objects }) => store.verify(objects)),
    snapshot: wrap(async ({ backupFile, objects }) => store.snapshot(backupFile, objects)),
    verifyBackup: wrap(async ({ backupFile, objects }) => store.verifyBackup(backupFile, objects)),
    restore: wrap(async ({ origem, backupFile, objects }) => (origem === 'selecionado' ? store.restore(selecionado.fileName, objects, selecionado.dir) : store.restore(backupFile, objects))),
  },
};

const resumo = [];
const ok = (r) => resumo.push(r);
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });

  // --- Anexo: regras do armazenamento.
  const gtaPdf = join(fora, 'GTA 123.pdf');
  writeFileSync(gtaPdf, Buffer.from('%PDF-1.4\n% GTA de teste sintética\n'));
  const exe = join(fora, 'virus.exe');
  writeFileSync(exe, 'MZ');
  const vazio = join(fora, 'vazio.pdf');
  writeFileSync(vazio, '');
  const grande = join(fora, 'grande.pdf');
  writeFileSync(grande, Buffer.alloc(26 * 1024 * 1024, 1));
  assert.throws(() => store.importFromPath(exe), /não permitido/);
  assert.throws(() => store.importFromPath(vazio), /vazio/);
  assert.throws(() => store.importFromPath(grande), /25 MB/);
  assert.equal(store.snapshot('../../fora.json', []).pasta, 'fora.anexos', 'path traversal reduzido ao nome (fica dentro de backups/)');
  assert.ok(!existsSync(join(root, 'fora.anexos')), 'nada criado fora da pasta de dados');
  assert.throws(() => store.snapshot('backup;rm -rf.json', []), /inválido/, 'nome de backup com caracteres proibidos');
  assert.throws(() => store.verify([{ sha256: '../x', ext: 'pdf' }]), /inválido/);
  rmSync(grande);
  ok('anexo: extensão, vazio, 25 MB, traversal e identificador validados');

  // --- Documento vinculado a operação, com anexo pelo "diálogo".
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', gta_numero: '123', itens: [{ numero_animal: '1', marca_id: 'MK', sexo: 'M', peso: 250 }] });
  await ops.confirmOperation(compra.operacao.id);
  const animalId = (await db.table('animais').toArray())[0].id;
  proximoArquivo = gtaPdf;
  const anexo = await docs.pickAttachment();
  assert.equal(anexo.sha256, sha(readFileSync(gtaPdf)));
  assert.ok(existsSync(join(dataDir, 'anexos', `${anexo.sha256}.pdf`)), 'anexo copiado para a pasta de anexos');
  const doc = await docs.saveDocument({ tipo: 'GTA', numero: '123', data: '2026-02-01', emissor: 'IAGRO', operacao_id: compra.operacao.id, animal_id: animalId, anexo });
  await assert.rejects(docs.saveDocument({ tipo: 'GTA', data: '2026-02-01' }), /Vincule/);
  const laudo = join(fora, 'laudo.txt');
  writeFileSync(laudo, 'Laudo sintético de resíduo negativo');
  proximoArquivo = laudo;
  const anexo2 = await docs.pickAttachment();
  const doc2 = await docs.saveDocument({ tipo: 'LAUDO', data: '2026-02-05', animal_id: animalId, anexo: anexo2 });
  await docs.cancelDocument(doc2.id, { motivo: 'Lançado em duplicidade' });
  assert.ok(existsSync(join(dataDir, 'anexos', `${anexo2.sha256}.txt`)), 'cancelar não apaga o arquivo');
  assert.deepEqual((await docs.listDocuments({ operacaoId: compra.operacao.id })).map((d) => d.id), [doc.id]);
  ok('documento com anexo vinculado a operação/animal; cancelado conserva o arquivo');

  // --- Backup completo = JSON + anexos verificados.
  const criado = await maintenance.createBackupNow({ reason: 'gate' });
  assert.equal(criado.verified, true);
  assert.deepEqual([criado.anexos.total, criado.anexos.ok], [2, 2], 'inclui também o anexo do documento cancelado');
  const nomeBackup = criado.backupPath.split(/[\\/]/).pop();
  const pastaAnexos = join(dataDir, 'backups', nomeBackup.replace(/\.json$/, '.anexos'));
  assert.ok(existsSync(join(pastaAnexos, `${anexo.sha256}.pdf`)));
  ok('backup completo leva os anexos (pasta conferida por SHA-256)');

  // Anexo corrompido na pasta do backup: verificação falha com motivo.
  const copiaCorrompida = join(pastaAnexos, `${anexo2.sha256}.txt`);
  const original2 = readFileSync(copiaCorrompida);
  writeFileSync(copiaCorrompida, 'adulterado');
  const v = await maintenance.verifyBackupFile({ name: nomeBackup });
  assert.equal(v.ok, false);
  assert.match(v.error, /Backup incompleto: 0 anexo\(s\) faltando e 1 corrompido/);
  writeFileSync(copiaCorrompida, original2);
  assert.equal((await maintenance.verifyBackupFile({ name: nomeBackup })).ok, true);

  // Anexo sumiu da pasta do app: o próximo backup NÃO é chamado de completo.
  const anexoApp = join(dataDir, 'anexos', `${anexo.sha256}.pdf`);
  const bytesApp = readFileSync(anexoApp);
  rmSync(anexoApp);
  await assert.rejects(maintenance.createBackupNow({ reason: 'gate' }), (err) => err.code === 'BACKUP_ANEXOS_INCOMPLETO' && /NÃO está completo/.test(err.message));
  writeFileSync(anexoApp, bytesApp);
  ok('anexo corrompido = verificação falha; anexo ausente = backup não é completo');

  // --- Restauração em base limpa: banco e anexos zerados.
  const documentosAntes = (await db.table('documentos').toArray()).map(({ localId: _l, ...r }) => r);
  const backupJson = JSON.parse(readFileSync(criado.backupPath, 'utf8'));
  await deleteDbForTests();
  rmSync(join(dataDir, 'anexos'), { recursive: true, force: true });
  await storage.ensureReady();
  selecionado = { dir: join(dataDir, 'backups'), fileName: nomeBackup };
  const restaurado = await maintenance.applyRestoreBackup(backupJson);
  assert.deepEqual([restaurado.anexos.total, restaurado.anexos.ok, restaurado.anexos.faltando.length], [2, 2, 0]);
  const db2 = await storage.ensureReady();
  const documentosDepois = (await db2.table('documentos').toArray()).map(({ localId: _l, ...r }) => r);
  assert.deepEqual(documentosDepois, documentosAntes, 'documentos e vínculos iguais');
  assert.equal(sha(readFileSync(join(dataDir, 'anexos', `${anexo.sha256}.pdf`))), anexo.sha256, 'anexo restaurado com o mesmo hash');
  ok('restauração em base limpa recupera documentos, vínculos e anexos (mesmo hash)');

  // Pacote sem a pasta de anexos (só o JSON copiado para outro lugar): anexos aparecem como faltando.
  const soJson = join(fora, nomeBackup);
  writeFileSync(soJson, JSON.stringify(backupJson));
  rmSync(join(dataDir, 'anexos'), { recursive: true, force: true });
  selecionado = { dir: fora, fileName: nomeBackup };
  const semAnexos = await maintenance.applyRestoreBackup(backupJson);
  assert.equal(semAnexos.anexos.faltando.length, 2, 'anexo faltante é erro visível');

  // Backup sem documentos com anexo (como os anteriores à v9): restaura sem passo de anexos.
  await (await storage.ensureReady()).table('documentos').clear();
  const { backup: semDocs } = await storage.createFullBackup({ reason: 'gate' });
  const legadoRestaurado = await maintenance.applyRestoreBackup(semDocs);
  assert.equal(legadoRestaurado.restored, true);
  assert.equal(legadoRestaurado.anexos, undefined, 'sem anexos no pacote, sem passo de anexos');
  ok('pacote sem pasta de anexos = faltando visível; backup sem documentos segue o fluxo antigo');

  console.log('OK verify-documents-backup');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
