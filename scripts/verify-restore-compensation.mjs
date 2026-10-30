// Gate restore:compensation:verify — auditoria corretiva R2, achado R2-02.
// Toda falha DEPOIS que a restauração pode ter mudado a base passa pela compensação (volta ao backup de segurança):
//   • erro depois da transação da troca da base (como um backfill/migração que lança após gravar);
//   • erro no recálculo dos derivados; divergência real de contagem na conferência final;
//   → BACKUP_RESTAURACAO_REVERTIDA, banco idêntico por hash ao de antes, anexos anteriores intactos, sem "sucesso".
//   • compensação que também falha → BACKUP_RESTAURACAO_CRITICA: gravações bloqueadas, backup de segurança
//     preservado e conferível, nenhuma mensagem de sucesso; restaurar esse backup desbloqueia.
//   • conteúdo em memória diferente do arquivo selecionado (sem anexos) → recusado antes de mudar nada.
//   • assistente (restoreGuided) recusa backup comum sem a seleção do arquivo.
//   • restaurações boas: v9 → v9 e v8 → v9 (migração) com recuperacaoCompleta.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Dexie from 'dexie';
import { DB_NAME, STORES_V8 } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { createFullBackupFromDb } from '../src/storage/indexedDb/backup/backupService.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import { faltasRestauracaoParaTestes } from '../src/modules/maintenance/infrastructure/maintenanceDataAdapter.js';
import * as center from '../src/modules/backup/application/backupCenterService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'pesagens-compensacao-'));
const dataDir = join(root, 'dados');
const fora = join(root, 'fora');
mkdirSync(fora, { recursive: true });
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
  criticalState: ponte.criticalState,
};
setActorProvider(() => ({ id: 'u1', nome: 'Admin', role: 'ADMIN' }));
globalThis.__PESAGENS_GATE_FALTAS__ = true; // liga as falhas injetadas só neste processo de gate

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
  return { banco: partes.join('|'), anexos };
}

const resumo = [];
const applyRestoreOriginal = storage.applyRestore;
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  await db.table('usuarios').add({ id: 'u1', login: 'admin', nome: 'Admin', role: 'ADMIN', ativo: true, password_hash: 'h', password_salt: 's', created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [1, 2, 3].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
  await ops.confirmOperation(compra.operacao.id);
  proximo = join(fora, 'gta.pdf');
  writeFileSync(proximo, Buffer.from('%PDF-1.4 GTA sintetica do gate R2-02'));
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo: await docs.pickAttachment() });
  const bom = await maintenance.createBackupNow({ reason: 'manual-ui' });
  const backupA = JSON.parse(readFileSync(bom.backupPath, 'utf8'));
  // Base de hoje diferente do backup A.
  const compra2 = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-02', itens: [{ numero_animal: '4', marca_id: 'MK', sexo: 'F', peso: 240 }] });
  await ops.confirmOperation(compra2.operacao.id);
  const selA = () => ponte.selecionar(bom.backupPath).selecao;

  async function revertida(rotulo, preparar) {
    const antes = await fotografia();
    preparar();
    let erro = null;
    try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
    faltasRestauracaoParaTestes.em = null;
    storage.applyRestore = applyRestoreOriginal;
    assert.ok(erro, `${rotulo}: não pode terminar como sucesso`);
    assert.equal(erro.code, 'BACKUP_RESTAURACAO_REVERTIDA', `${rotulo}: ${erro.code} ${erro.message}`);
    assert.equal(erro.compensado, true);
    assert.equal(erro.recuperacaoCompleta, false);
    const depois = await fotografia();
    assert.equal(depois.banco, antes.banco, `${rotulo}: banco idêntico ao de antes`);
    for (const a of antes.anexos) assert.ok(depois.anexos.includes(a), `${rotulo}: anexos anteriores intactos`);
    const hist = (await (await storage.ensureReady()).table('backupHistory').toArray()).filter((h) => h.tipo === 'restore-compensated').at(-1);
    assert.match(hist.detalhes, new RegExp(`"fase":"${erro.fase}"`), `${rotulo}: fase registrada no histórico`);
    resumo.push(`R2-02 ${rotulo}: revertido na fase "${erro.fase}", banco idêntico por hash, sem sucesso falso`);
  }

  // 1. Erro DEPOIS da transação da troca da base (como migração/backfill que lança depois de gravar).
  await revertida('erro após a transação da troca da base', () => {
    let primeira = true;
    storage.applyRestore = async (...args) => {
      const r = await applyRestoreOriginal.apply(storage, args);
      if (primeira) { primeira = false; throw new Error('backfill falhou depois de gravar (simulado)'); }
      return r;
    };
  });
  // 2. Erro no recálculo dos derivados.
  await revertida('erro nos derivados', () => { faltasRestauracaoParaTestes.em = (fase) => { if (fase === 'derivados') throw new Error('derivados falharam (simulado)'); }; });
  // 3. Divergência REAL na conferência final (um registro some depois da troca).
  await revertida('divergência de contagem na conferência final', () => {
    faltasRestauracaoParaTestes.em = async (fase) => {
      if (fase === 'derivados') { const d = await storage.ensureReady(); const um = await d.table('animais').toCollection().first(); await d.table('animais').delete(um.localId); }
    };
  });

  // 4. Compensação que também falha → CRÍTICO.
  {
    faltasRestauracaoParaTestes.em = (fase) => { if (fase === 'derivados' || fase === 'compensacao') throw new Error(`${fase} falhou (simulado)`); };
    let erro = null;
    try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
    faltasRestauracaoParaTestes.em = null;
    assert.equal(erro?.code, 'BACKUP_RESTAURACAO_CRITICA');
    assert.equal(erro.critico, true);
    assert.match(erro.message, /NÃO CONCLUÍDA/);
    assert.throws(() => storage.assertWritable('Lançamento de pesagem'), (e) => e.code === 'RESTAURACAO_CRITICA', 'gravações bloqueadas');
    const seguranca = erro.safetyBackup;
    assert.equal(sha(readFileSync(seguranca.path)), seguranca.sha256, 'backup de segurança preservado e conferível');
    const hist = (await (await storage.ensureReady()).table('backupHistory').toArray()).filter((h) => h.tipo === 'restore-critical');
    assert.equal(hist.length, 1, 'estado crítico registrado');
    // Recuperação indicada: restaurar o backup de segurança desbloqueia.
    const r = await maintenance.applyRestoreBackup(JSON.parse(readFileSync(seguranca.path, 'utf8')), { selecao: ponte.selecionar(seguranca.path).selecao });
    assert.equal(r.recuperacaoCompleta, true);
    assert.doesNotThrow(() => storage.assertWritable('Lançamento de pesagem'), 'restaurado o backup de segurança, gravação liberada');
    resumo.push('R2-02 compensação que falha: CRÍTICO, gravação bloqueada, backup de segurança íntegro; restaurá-lo libera');
  }

  // 5. Conteúdo em memória ≠ arquivo selecionado (backup sem anexos) → recusado sem mudar nada.
  {
    await (await storage.ensureReady()).table('documentos').clear();
    const { backup: semAnexosB } = await storage.createFullBackup({ reason: 'gate' });
    const outroArquivo = join(fora, 'outro.json');
    writeFileSync(outroArquivo, JSON.stringify(backupA));
    const antes = await fotografia();
    await assert.rejects(maintenance.applyRestoreBackup(semAnexosB, { selecao: ponte.selecionar(outroArquivo).selecao }), (e) => e.code === 'BACKUP_CONTEUDO_DIVERGENTE');
    assert.equal((await fotografia()).banco, antes.banco);
    resumo.push('R2-02 conteúdo em memória diferente do arquivo selecionado: recusado sem mudar nada');
  }

  // 6. Assistente exige a seleção do arquivo para backup comum.
  {
    const insp = await center.inspectBackup(backupA);
    await assert.rejects(center.restoreGuided(insp, { confirmacao: 'RESTAURAR' }), (e) => e.code === 'BACKUP_SELECAO_INVALIDA');
    resumo.push('R2-02 assistente recusa backup comum sem a seleção do arquivo (sem desvio fora da tela)');
  }

  // 7. Restaurações boas: v9 → v9 e v8 → v9.
  {
    const r = await maintenance.applyRestoreBackup(backupA, { selecao: selA() });
    assert.equal(r.recuperacaoCompleta, true, 'v9 → v9');
    await deleteDbForTests();
    const v8 = new Dexie(DB_NAME);
    v8.version(8).stores(STORES_V8);
    await v8.open();
    const concl = (v) => ({ key: `migration:v${v}`, value: { versao: v, status: 'CONCLUIDA', origem: 'fresh', passos_concluidos: [], started_at: TS, finished_at: TS, relatorio: {} } });
    await v8.table('appSettings').bulkPut([concl(7), concl(8)]);
    await v8.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
    await v8.table('animais').add({ empresa_id: 'local', id: 'V', numero_animal: 'V8', identificacao_normalizada: 'V8', marca_id: 'MK', situacao: 'ATIVO', created_at: TS, updated_at: TS, deleted_at: null });
    await v8.table('pesagens').add({ empresa_id: 'local', id: 'pV', data_pesagem: '2026-01-10', peso_kg: 300, animal_id: 'V', tipo_pesagem: 'Cadastro', lote_id: null, legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: 'V8', marca: 'ALFA', peso: 300 }, created_at: TS, updated_at: TS, deleted_at: null });
    const backupV8 = await createFullBackupFromDb(v8, { reason: 'gate-r2', dbVersion: 8 });
    v8.close();
    await deleteDbForTests();
    await storage.ensureReady();
    const arquivoV8 = join(fora, 'backup-v8.json');
    writeFileSync(arquivoV8, JSON.stringify(backupV8.backup ?? backupV8));
    const r8 = await maintenance.applyRestoreBackup(backupV8.backup ?? backupV8, { selecao: ponte.selecionar(arquivoV8).selecao });
    assert.equal(r8.schemaUpgradeRequired, true);
    assert.equal(r8.recuperacaoCompleta, true, 'v8 → v9');
    assert.ok(await (await storage.ensureReady()).table('operacoes').count() >= 1, 'migração v9 rodou');
    resumo.push('R2-02 restaurações boas v9→v9 e v8→v9 (migração) com recuperacaoCompleta');
  }

  console.log('OK verify-restore-compensation');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  storage.applyRestore = applyRestoreOriginal;
  faltasRestauracaoParaTestes.em = null;
  setActorProvider(null);
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
