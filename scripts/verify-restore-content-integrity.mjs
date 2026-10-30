// Gate restore:content-integrity:verify — auditoria corretiva R3, achado R3-02.
// A restauração e a compensação conferem o CONTEÚDO de cada registro, não só as contagens (leitura real do Dexie):
//   • campo real alterado depois da troca da base, com as MESMAS contagens (peso de pesagem, identificação do animal,
//     documento, movimento) → detectado → compensação → banco idêntico ao de antes (REVERTIDA, nunca sucesso);
//   • conteúdo alterado depois da COMPENSAÇÃO (mesmas contagens) → CRÍTICO persistente, sem "recuperação completa";
//     com o histórico de backup quebrado ao mesmo tempo, continua CRÍTICO;
//   • casos bons: v9 → v9 com anexo, v9 → v9 sem anexo, v8 → v9 (migração; contrato com as tolerâncias documentadas).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Dexie from 'dexie';
import { DB_NAME, STORES_V8 } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { createFullBackupFromDb } from '../src/storage/indexedDb/backup/backupService.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import { faltasRestauracaoParaTestes } from '../src/modules/maintenance/infrastructure/maintenanceDataAdapter.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'pesagens-conteudo-'));
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
globalThis.__PESAGENS_GATE_FALTAS__ = true;

async function fotografia() {
  const db = await storage.ensureReady();
  const partes = [];
  for (const t of db.tables.map((x) => x.name).sort()) {
    if (t === 'backupHistory' || t === 'appSettings') continue;
    const rows = (await db.table(t).toArray()).map(({ localId: _l, ...r }) => r).sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
    partes.push(`${t}:${sha(JSON.stringify(rows))}`);
  }
  return partes.join('|');
}
const contagens = async () => { const db = await storage.ensureReady(); return Object.fromEntries(await Promise.all(db.tables.filter((t) => t.name !== 'backupHistory').map(async (t) => [t.name, await t.count()]))); };
const altera = (store, campo, valor) => async () => {
  const d = await storage.ensureReady();
  const linha = await d.table(store).toCollection().first();
  assert.ok(linha, `há linha em ${store} para alterar`);
  await d.table(store).update(linha.localId, typeof campo === 'function' ? campo(linha) : { [campo]: valor });
};

const resumo = [];
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [1, 2, 3].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
  await ops.confirmOperation(compra.operacao.id);
  proximo = join(fora, 'gta.pdf');
  writeFileSync(proximo, Buffer.from('%PDF-1.4 GTA sintetica do gate R3-02'));
  await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo: await docs.pickAttachment() });
  const bom = await maintenance.createBackupNow({ reason: 'manual-ui' });
  const backupA = JSON.parse(readFileSync(bom.backupPath, 'utf8'));
  const compra2 = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-02', itens: [{ numero_animal: '4', marca_id: 'MK', sexo: 'F', peso: 240 }] });
  await ops.confirmOperation(compra2.operacao.id);
  const selA = () => ponte.selecionar(bom.backupPath).selecao;

  // 1. Sucesso com conteúdo alterado e as MESMAS contagens → detectado e revertido.
  const casos = [
    ['peso de pesagem', altera('pesagens', 'peso_kg', 999)],
    ['identificação do animal', altera('animais', (a) => ({ numero_animal: `${a.numero_animal}-X`, identificacao_normalizada: `${a.identificacao_normalizada}X` }))],
    ['documento', altera('documentos', 'numero', 'ADULTERADO')],
    ['movimento', altera('movimentosAnimais', 'data_evento', '2030-01-01')],
  ];
  for (const [rotulo, mexer] of casos) {
    const antes = await fotografia();
    let contDepoisTroca = null;
    faltasRestauracaoParaTestes.em = async (fase) => {
      if (fase === 'derivados') { const c0 = await contagens(); await mexer(); contDepoisTroca = { antes: c0, depois: await contagens() }; }
    };
    let erro = null;
    let r = null;
    try { r = await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
    faltasRestauracaoParaTestes.em = null;
    assert.deepEqual(contDepoisTroca.depois, contDepoisTroca.antes, `${rotulo}: contagens idênticas depois da alteração`);
    assert.equal(r, null, `${rotulo}: nunca sucesso`);
    assert.equal(erro?.code, 'BACKUP_RESTAURACAO_REVERTIDA', `${rotulo}: ${erro?.code} ${erro?.message}`);
    assert.equal(erro.fase, 'conferencia');
    assert.equal(await fotografia(), antes, `${rotulo}: banco idêntico ao de antes`);
    resumo.push(`R3-02 ${rotulo} alterado com contagens iguais: detectado na conferência de conteúdo e revertido`);
  }

  // 2. Conteúdo alterado DEPOIS da compensação (mesmas contagens) → CRÍTICO; com histórico quebrado também.
  for (const quebraHistorico of [false, true]) {
    const recordOriginal = storage.recordBackupHistory;
    if (quebraHistorico) storage.recordBackupHistory = async (tipo, d) => { if (/^restore-/.test(tipo)) throw new Error('histórico indisponível (simulado)'); return recordOriginal.call(storage, tipo, d); };
    faltasRestauracaoParaTestes.em = async (fase) => {
      if (fase === 'derivados') throw new Error('derivados falharam (simulado)');
      if (fase === 'compensacao-aplicada') await altera('pesagens', 'peso_kg', 777)();
    };
    let erro = null;
    try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
    faltasRestauracaoParaTestes.em = null;
    storage.recordBackupHistory = recordOriginal;
    assert.equal(erro?.code, 'BACKUP_RESTAURACAO_CRITICA', `compensação com conteúdo divergente (histórico ${quebraHistorico ? 'quebrado' : 'ok'})`);
    assert.match(erro.message, /conteúdo não voltou/);
    assert.equal(erro.recuperacaoCompleta, false);
    assert.throws(() => storage.assertWritable('Lançamento de pesagem'), (e) => e.code === 'RESTAURACAO_CRITICA');
    assert.ok(existsSync(join(dataDir, 'estado-restauracao-critica.json')), 'marcador persistente');
    // Recuperação conferida libera.
    const seg = erro.safetyBackup;
    const rec = await maintenance.applyRestoreBackup(JSON.parse(readFileSync(seg.path, 'utf8')), { selecao: ponte.selecionar(seg.path).selecao });
    assert.equal(rec.recuperacaoCompleta, true);
    assert.equal(rec.conferenciaConteudo.ok, true);
    resumo.push(`R3-02 compensação com conteúdo divergente e contagens iguais${quebraHistorico ? ' + histórico quebrado' : ''}: CRÍTICO persistente; recuperação conferida libera`);
  }

  // 3. Casos bons: v9 → v9 com anexo e sem anexo; v8 → v9.
  {
    const r = await maintenance.applyRestoreBackup(backupA, { selecao: selA() });
    assert.equal(r.recuperacaoCompleta, true);
    assert.equal(r.conferenciaConteudo.ok, true);
    assert.ok(r.conferenciaConteudo.impressoes.pesagens.esperado === r.conferenciaConteudo.impressoes.pesagens.banco, 'impressão digital de pesagens igual');
    await (await storage.ensureReady()).table('documentos').clear();
    const { backup: semAnexo } = await storage.createFullBackup({ reason: 'gate' });
    const arqSem = join(fora, 'sem-anexo.json');
    writeFileSync(arqSem, JSON.stringify(semAnexo));
    const r2 = await maintenance.applyRestoreBackup(semAnexo, { selecao: ponte.selecionar(arqSem).selecao });
    assert.equal(r2.conferenciaConteudo.ok, true, 'v9 → v9 sem anexo');
    await deleteDbForTests();
    const v8 = new Dexie(DB_NAME);
    v8.version(8).stores(STORES_V8);
    await v8.open();
    const concl = (v) => ({ key: `migration:v${v}`, value: { versao: v, status: 'CONCLUIDA', origem: 'fresh', passos_concluidos: [], started_at: TS, finished_at: TS, relatorio: {} } });
    await v8.table('appSettings').bulkPut([concl(7), concl(8)]);
    await v8.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
    for (const [id, n] of [['V', 'V8'], ['W', 'W8']]) await v8.table('animais').add({ empresa_id: 'local', id, numero_animal: n, identificacao_normalizada: n, marca_id: 'MK', situacao: 'ATIVO', created_at: TS, updated_at: TS, deleted_at: null });
    await v8.table('pesagens').bulkAdd([
      { empresa_id: 'local', id: 'pV', data_pesagem: '2026-01-10', peso_kg: 300, animal_id: 'V', tipo_pesagem: 'Cadastro', lote_id: null, legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: 'V8', marca: 'ALFA', peso: 300 }, created_at: TS, updated_at: TS, deleted_at: null },
      { empresa_id: 'local', id: 'mV', data_pesagem: '2026-02-10', peso_kg: 330, animal_id: 'V', tipo_pesagem: 'Manejo', lote_id: null, legacy_payload: { tipo_manejo: 'Manejo', numero_animal: 'V8', marca: 'ALFA', peso: 330 }, created_at: TS, updated_at: TS, deleted_at: null },
      { empresa_id: 'local', id: 'pW', data_pesagem: '2026-01-10', peso_kg: 280, animal_id: 'W', tipo_pesagem: 'Cadastro', lote_id: null, legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: 'W8', marca: 'ALFA', peso: 280 }, created_at: TS, updated_at: TS, deleted_at: null },
    ]);
    await v8.table('movimentosAnimais').add({ empresa_id: 'local', id: 'mvV', animal_id: 'V', pesagem_id: 'pV', tipo: 'Entrada', data_evento: '2026-01-10', created_at: TS, updated_at: TS, deleted_at: null });
    const b8 = await createFullBackupFromDb(v8, { reason: 'gate-r3', dbVersion: 8 });
    v8.close();
    await deleteDbForTests();
    await storage.ensureReady();
    const conteudo8 = b8.backup ?? b8;
    const arq8 = join(fora, 'v8.json');
    writeFileSync(arq8, JSON.stringify(conteudo8));
    const r8 = await maintenance.applyRestoreBackup(conteudo8, { selecao: ponte.selecionar(arq8).selecao });
    assert.equal(r8.schemaUpgradeRequired, true);
    assert.equal(r8.conferenciaConteudo.ok, true, 'v8 → v9: dados de origem conferidos com as tolerâncias da migração');
    resumo.push(`R3-02 casos bons: v9→v9 com e sem anexo e v8→v9 (migração) — conteúdo conferido (${r.conferenciaConteudo.ms} ms / ${r8.conferenciaConteudo.ms} ms)`);
  }

  console.log('OK verify-restore-content-integrity');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  faltasRestauracaoParaTestes.em = null;
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
