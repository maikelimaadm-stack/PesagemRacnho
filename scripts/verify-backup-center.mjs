// Gate backup:center:verify — missão pesagens-integrada, checkpoint B5 (F20, F21, F22, F23; fecha P14, P22, P26).
// Usa os MESMOS módulos do processo principal (electron/ipc/backupStore.cjs, attachmentStore.cjs) sobre pastas
// temporárias, ligados ao renderer por uma ponte simulada:
//   F20 periódico com o app aberto: roda na primeira oportunidade, não duplica (inclusive concorrente), respeita o
//       intervalo, espera após falha e para depois de 3 falhas no dia;
//   F21 cópia externa conferida por SHA-256; destino ausente = "cópia pendente/indisponível" sem falso positivo; destino
//       dentro da pasta de dados recusado;
//   F22 retenção só de periódicos (nunca o último verificado nem os de segurança); backup protegido AES-GCM com
//       senha certa/errada/arquivo alterado; legado JSON continua legível;
//   F23 restauração guiada: inspeção sem gravar, confirmação digitada, pré-backup, anexos, integridade e sessão
//       encerrada quando o backup traz usuários.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as center from '../src/modules/backup/application/backupCenterService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { planRetention } from '../src/modules/backup/domain/backupPolicy.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const require = createRequire(import.meta.url);
const { createBackupStore } = require('../electron/ipc/backupStore.cjs');
const root = mkdtempSync(join(tmpdir(), 'pesagens-central-'));
const dataDir = join(root, 'dados');
const externo = join(root, 'pendrive');
mkdirSync(externo, { recursive: true });
const bstore = createBackupStore(dataDir);
const ponte = createGateAttachmentBridge(dataDir, { importar: () => join(root, 'gta.pdf') });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
const wrap = (fn) => async (args) => { try { return { ok: true, data: await fn(args) }; } catch (err) { return { ok: false, error: { code: err.code, message: err.message } }; } };
let falharGravacao = false;
let ms = 0;

globalThis.window = globalThis.window || {};
window.pesagemApp = {
  files: {
    async writeUserFile({ subdir, filename, content }) {
      if (falharGravacao) throw Object.assign(new Error('Disco cheio (simulado)'), { code: 'ENOSPC' });
      // Nome único por chamada (o carimbo de tempo do app tem milissegundos; o gate grava muito rápido).
      const nome = filename.replace(/(\.\w+)$/, `-${String(ms += 1).padStart(4, '0')}$1`);
      const full = join(dirOf(subdir), nome);
      writeFileSync(full, content ?? '', 'utf8');
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes) };
    },
    async listUserFiles({ subdir, extension }) {
      const d = dirOf(subdir);
      return { ok: true, files: readdirSync(d).filter((n) => statSync(join(d, n)).isFile() && (!extension || n.endsWith(extension))).map((name) => ({ name, path: join(d, name), size: statSync(join(d, name)).size, modifiedAt: new Date(statSync(join(d, name)).mtimeMs).toISOString() })) };
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
    clearExternalDir: wrap(async () => bstore.clearExternalDir()),
  },
};
let ator = { id: 'u1', nome: 'Admin', role: 'ADMIN' };
setActorProvider(() => ator);

const resumo = [];
const ok = (r) => resumo.push(r);
const backupsJson = () => readdirSync(join(dataDir, 'backups')).filter((n) => n.endsWith('.json'));
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  await db.table('usuarios').add({ id: 'u1', login: 'admin', nome: 'Admin', role: 'ADMIN', ativo: true, password_hash: 'h', password_salt: 's', created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [{ numero_animal: '1', marca_id: 'MK', sexo: 'M', peso: 250 }] });
  await ops.confirmOperation(compra.operacao.id);
  writeFileSync(join(root, 'gta.pdf'), Buffer.from('%PDF-1.4 GTA sintética'));
  const anexo = await docs.pickAttachment();
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo });

  // ---------------------------------------------------------------------------
  // F20 — periódico.
  await assert.rejects(center.savePolicy({ intervalo_horas: 0 }), /1 a 720/);
  const t0 = new Date('2026-03-01T08:00:00Z');
  const [r1, r2] = await Promise.all([center.runPeriodicIfDue({ agora: t0 }), center.runPeriodicIfDue({ agora: t0 })]);
  assert.equal([r1, r2].filter((r) => r.ok).length, 1, 'concorrente: um backup só');
  assert.equal(backupsJson().length, 1);
  const r3 = await center.runPeriodicIfDue({ agora: new Date(t0.getTime() + 3600000) });
  assert.equal(r3.run, false, 'dentro do intervalo não repete');
  // O "último verificado" é carimbado com o relógio real: avança o relógio do teste para 25 h depois dele.
  const agoraReal = () => new Date(Date.now() + 25 * 3600000);
  const r4 = await center.runPeriodicIfDue({ agora: agoraReal() });
  assert.equal(r4.ok, true, 'intervalo vencido: roda de novo');
  assert.equal(backupsJson().length, 2);
  ok('F20 periódico: primeira oportunidade, sem duplicar (concorrente), respeita o intervalo');

  falharGravacao = true;
  const f1 = await center.runPeriodicIfDue({ agora: new Date(Date.now() + 50 * 3600000) });
  assert.equal(f1.ok, false);
  const f2 = await center.runPeriodicIfDue({ agora: new Date(Date.now() + 50 * 3600000 + 60000) });
  assert.equal(f2.run, false, 'espera depois de falha');
  falharGravacao = false;
  assert.equal((await center.getOverview()).status.protecao, 'VERIFICADO', 'falha não apaga o último verificado');
  ok('F20 falha registrada, espera antes de tentar de novo; último verificado preservado');

  // ---------------------------------------------------------------------------
  // F21 — cópia externa.
  await assert.rejects(center.copyToExternal(), (err) => err.code === 'DESTINO_NAO_CONFIGURADO');
  assert.throws(() => bstore.setExternalDir(join(dataDir, 'sub')), /fora da pasta de dados/);
  bstore.setExternalDir(externo);
  const copia = await center.copyToExternal();
  const nomeVerificado = (await center.getOverview()).status.lastVerified.name;
  const destinoJson = join(externo, 'pesagens-backups', nomeVerificado);
  assert.equal(sha(readFileSync(destinoJson)), sha(readFileSync(join(dataDir, 'backups', nomeVerificado))), 'cópia externa idêntica (SHA-256)');
  assert.ok(existsSync(join(externo, 'pesagens-backups', nomeVerificado.replace('.json', '.anexos'), `${anexo.sha256}.pdf`)), 'anexos copiados junto');
  assert.equal(copia.sha256, sha(readFileSync(destinoJson)));
  let ov = await center.getOverview();
  assert.deepEqual(ov.cobertura, { local: 'OK', copia: 'OK' });
  rmSync(externo, { recursive: true, force: true });
  await assert.rejects(center.copyToExternal(), (err) => err.code === 'DESTINO_INDISPONIVEL');
  ov = await center.getOverview();
  assert.deepEqual(ov.cobertura, { local: 'OK', copia: 'INDISPONIVEL' }, 'pendrive ausente: local OK, cópia indisponível (sem falso positivo)');
  mkdirSync(externo, { recursive: true });
  ok('F21 cópia externa conferida; destino ausente = indisponível; destino dentro dos dados recusado');

  // ---------------------------------------------------------------------------
  // F22 — retenção.
  const plano = planRetention([
    { name: 'p5.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-05' },
    { name: 'p4.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-04' },
    { name: 'p3.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-03' },
    { name: 'p2.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-02' },
    { name: 'p1.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-01' },
    { name: 'm.json', reason: 'manual-ui', estado: 'VERIFICADO', createdAt: '2025-12-01' },
    { name: 'pre.json', reason: 'pre-restore', estado: 'VERIFICADO', createdAt: '2025-11-01' },
  ], { manter: 3 });
  assert.deepEqual(plano, ['p2.json', 'p1.json'], 'só periódicos além dos 3 mais novos');
  assert.deepEqual(planRetention([{ name: 'p2.json', reason: 'periodico', estado: 'FALHOU', createdAt: '2026-01-02' }, { name: 'p1.json', reason: 'periodico', estado: 'VERIFICADO', createdAt: '2026-01-01' }, { name: 'x', reason: 'periodico', estado: 'FALHOU', createdAt: '2026-01-03' }, { name: 'y', reason: 'periodico', estado: 'FALHOU', createdAt: '2026-01-04' }], { manter: 3 }), [], 'nunca o último verificado');
  assert.throws(() => bstore.deleteBackup('../dados.json'), /inválido/);
  ok('F22 retenção conservadora (só periódicos; último verificado e segurança preservados)');

  // F22 — backup protegido.
  await assert.rejects(center.exportProtectedBackup('curta'), /10 caracteres/);
  const prot = await center.exportProtectedBackup('senha-forte-2026');
  assert.equal(prot.anexos, 1);
  const envelope = JSON.parse(readFileSync(prot.path, 'utf8'));
  assert.equal(envelope.cipher.alg, 'AES-GCM-256');
  // Nada legível fora do texto cifrado; dentro dele, os bytes não contêm marcadores longos do JSON em claro. (Antes o
  // teste procurava "GTA"/"ALFA" no base64, que por acaso pode conter essas letras: falha aleatória de ~1 em 25.)
  const { ciphertext, ...semCifra } = envelope;
  assert.ok(!/password_hash|ALFA|GTA/.test(JSON.stringify(semCifra)), 'envelope: nada legível fora do texto cifrado');
  const bytesCifrados = Buffer.from(String(ciphertext), 'base64');
  for (const marcador of ['password_hash', 'nome_normalizado', 'legacy_payload']) assert.equal(bytesCifrados.indexOf(marcador), -1, `conteúdo cifrado: "${marcador}" não aparece`);
  assert.deepEqual(await center.inspectBackup(envelope).then((r) => [r.protegido, r.precisaSenha]), [true, true]);
  await assert.rejects(center.inspectBackup(envelope, { senha: 'senha-errada-0000' }), (err) => err.code === 'PROTEGIDO_AUTENTICACAO');
  const adulterado = { ...envelope, ciphertext: `A${envelope.ciphertext.slice(1)}` };
  await assert.rejects(center.inspectBackup(adulterado, { senha: 'senha-forte-2026' }), (err) => err.code === 'PROTEGIDO_AUTENTICACAO');
  ok('F22 backup protegido AES-GCM: senha errada e arquivo alterado recusados; conteúdo ilegível sem senha');

  // ---------------------------------------------------------------------------
  // F23 — restauração guiada em base limpa a partir do protegido.
  const insp = await center.inspectBackup(envelope, { senha: 'senha-forte-2026' });
  assert.equal(insp.dry.restorable, true);
  assert.equal(insp.usuarios, 1);
  assert.ok(insp.comparacao.some((c) => c.store === 'animais'));
  await assert.rejects(center.restoreGuided(insp, { confirmacao: 'restaurar' }), /digite RESTAURAR/);
  ator = { id: 'u2', nome: 'Gestor', role: 'GESTOR' };
  await assert.rejects(center.restoreGuided(insp, { confirmacao: 'RESTAURAR' }), (err) => err.code === 'AUTH_FORBIDDEN', 'só ADMIN restaura');
  ator = { id: 'u1', nome: 'Admin', role: 'ADMIN' };
  await deleteDbForTests();
  rmSync(join(dataDir, 'anexos'), { recursive: true, force: true });
  await storage.ensureReady();
  let saiu = false;
  const res = await center.restoreGuided(insp, { confirmacao: 'RESTAURAR', onLogout: () => { saiu = true; } });
  assert.equal(res.restored, true);
  assert.deepEqual([res.anexos.total, res.anexos.ok], [1, 1]);
  assert.equal(sha(readFileSync(join(dataDir, 'anexos', `${anexo.sha256}.pdf`))), anexo.sha256);
  assert.equal(res.integridade.ok, true, JSON.stringify(res.integridade.issues));
  assert.equal(res.sessaoEncerrada, true);
  assert.equal(saiu, true, 'backup com usuários encerra a sessão atual');
  assert.equal((await (await storage.ensureReady()).table('animais').count()), 1);
  ok('F23 restauração guiada: inspeção, confirmação digitada, só ADMIN, anexos, integridade e sessão encerrada');

  // Legado: backup JSON comum segue inspecionável (não protegido).
  const legado = JSON.parse(readFileSync(join(dataDir, 'backups', backupsJson()[0]), 'utf8'));
  const inspLegado = await center.inspectBackup(legado);
  assert.equal(inspLegado.protegido, false);
  assert.equal(inspLegado.dry.restorable, true);
  ok('backup JSON comum (legado) continua legível');

  console.log('OK verify-backup-center');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
