// Gate backup:partial:verify — auditoria corretiva R2, achado R2-01.
// O backup de segurança PARCIAL (exceção da restauração: anexos que já faltavam no app ficam fora) é guardado e
// auditado, mas NUNCA conta como proteção completa:
//   (a) backup completo → protegido;
//   (b) anexo ausente na origem + exceção → arquivo criado, estado PARCIAL, não é proteção;
//   (c) periódico vencido continua devido (não é adiado pelo parcial);
//   (d) histórico e arquivo do parcial permanecem; a retenção não o apaga;
//   (e) backup completo anterior continua valendo (o parcial não o substitui);
//   (f) importar, limpar e reset não aceitam o pré-backup parcial;
//   (g) a tela não chama o parcial de verificado/protegido.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenanceAdapter from '../src/modules/maintenance/infrastructure/maintenanceDataAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import * as center from '../src/modules/backup/application/backupCenterService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { planRetention } from '../src/modules/backup/domain/backupPolicy.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'pesagens-parcial-'));
const dataDir = join(root, 'dados');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
let proximo = null;
const ponte = createGateAttachmentBridge(dataDir, { importar: () => proximo });
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
};
setActorProvider(() => ({ id: 'u1', nome: 'Admin', role: 'ADMIN' }));

const resumo = [];
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [{ numero_animal: '1', marca_id: 'MK', sexo: 'M', peso: 250 }] });
  await ops.confirmOperation(compra.operacao.id);
  proximo = join(root, 'gta.pdf');
  writeFileSync(proximo, Buffer.from('%PDF-1.4 GTA sintetica do gate R2-01'));
  const anexo = await docs.pickAttachment();
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo });
  const anexoApp = join(dataDir, 'anexos', `${anexo.sha256}.pdf`);
  const bytesAnexo = readFileSync(anexoApp);

  // --- Base sem nenhum backup completo: só o parcial existe.
  rmSync(anexoApp);
  const parcial1 = await maintenanceAdapter.createBackupNow({ reason: 'pre-restore', automatic: true, aceitarAnexosAusentesNaOrigem: true });
  assert.equal(parcial1.incompleto, true, '(b) o parcial é marcado incompleto');
  let st = await maintenanceAdapter.getBackupStatus();
  assert.notEqual(st.protecao, 'VERIFICADO', '(b) parcial não é proteção');
  assert.equal(st.lastVerified, null, '(b) parcial não vira o último backup válido');
  const linhaParcial = st.files.find((f) => f.path === parcial1.backupPath);
  assert.equal(linhaParcial?.estado, 'PARCIAL', '(b) catálogo marca PARCIAL');
  let ov = await center.getOverview();
  assert.notEqual(ov.cobertura.local, 'OK', '(g) cobertura não diz protegido');
  assert.equal(ov.periodico.proximo.run, true, '(c) periódico continua devido');
  resumo.push('R2-01 (b)(c)(g) só o parcial: estado PARCIAL, sem proteção, periódico devido');

  // (f) operações destrutivas comuns não aceitam o pré-backup parcial (anexo ainda faltando).
  const exportacao = (await storage.exportPesagensJson()).payload;
  await assert.rejects(maintenance.applyImportWeighingJson(exportacao, { aceitarAnexosAusentesNaOrigem: true }), (e) => e.code === 'BACKUP_PRE_OPERACAO_FALHOU');
  await assert.rejects(maintenance.clearOperationalData({ confirmationText: maintenance.CLEAR_CONFIRMATION_TEXT, aceitarAnexosAusentesNaOrigem: true }), (e) => e.code === 'BACKUP_PRE_OPERACAO_FALHOU');
  await assert.rejects(maintenance.resetAllData({ confirmationText: maintenance.RESET_CONFIRMATION_TEXT, aceitarAnexosAusentesNaOrigem: true }), (e) => e.code === 'BACKUP_PRE_OPERACAO_FALHOU');
  resumo.push('R2-01 (f) importar, limpar e reset recusam pré-backup parcial');

  // --- Com um backup completo antes, o parcial mais novo não o substitui.
  writeFileSync(anexoApp, bytesAnexo);
  const completo = await maintenanceAdapter.createBackupNow({ reason: 'manual-ui' });
  st = await maintenanceAdapter.getBackupStatus();
  assert.equal(st.protecao, 'VERIFICADO', '(a) backup completo protege');
  assert.equal(st.lastVerified.path, completo.backupPath);
  rmSync(anexoApp);
  const parcial2 = await maintenanceAdapter.createBackupNow({ reason: 'pre-restore', automatic: true, aceitarAnexosAusentesNaOrigem: true });
  st = await maintenanceAdapter.getBackupStatus();
  assert.equal(st.lastVerified?.path, completo.backupPath, '(e) a proteção continua sendo o completo anterior');
  assert.notEqual(st.ultimaVerificacao?.path, parcial2.backupPath, '(g) "Verificado em" não mostra o parcial');
  assert.equal(st.files.find((f) => f.path === parcial2.backupPath)?.estado, 'PARCIAL');
  resumo.push('R2-01 (a)(e) completo protege; parcial mais novo não o substitui');

  // (d) histórico e arquivos ficam; a retenção nunca escolhe o parcial.
  const hist = (await db.table('backupHistory').toArray()).filter((h) => h.tipo === 'verify' && /incompleto/.test(h.detalhes || ''));
  assert.ok(hist.length >= 2, '(d) histórico das verificações parciais');
  const catalogo = st.files.map((f) => ({ name: f.name, reason: f.reason, automatic: f.automatic, estado: f.estado, createdAt: f.modifiedAt }));
  const remover = planRetention(catalogo, { manter: 0 });
  for (const p of [parcial1, parcial2]) assert.ok(!remover.includes(p.backupPath.split(/[\\/]/).pop()), '(d) retenção não apaga parcial');
  resumo.push('R2-01 (d) histórico e arquivo dos parciais preservados; retenção não os remove');

  // (g) texto da tela.
  const pagina = readFileSync(new URL('../src/pages/BackupRestauracao.jsx', import.meta.url), 'utf8');
  assert.match(pagina, /PARCIAL:\s*'[^']*(não é proteção|incompleto)/i, '(g) rótulo do estado PARCIAL na tela');
  resumo.push('R2-01 (g) tela rotula PARCIAL como não-proteção');

  console.log('OK verify-backup-partial');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  setActorProvider(null);
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
