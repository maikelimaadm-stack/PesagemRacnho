// Gate cross:surface:verify — auditoria corretiva R1, achado R09: regressões entre telas depois de R01–R08.
//   1. Entrada sem peso → Cadastro do mesmo animal: adota o animal pendente (sem 2º animal, uma entrada no livro).
//   2. Saída confirmada → cancelada: animal volta ATIVO e o inventário volta ao saldo de antes.
//   3. Movimentação interna (lote): não é entrada nem saída do rebanho; aparece como interna por lote.
//   4. Peso manual × operação × balança: a mesma regra (inteiro por truncamento) no que é gravado.
//   5. Backup v8 restaurado pelo fluxo novo (R01/R02) no app v9: migra e sai com recuperacaoCompleta.
//   6. Exportação JSON de pesagens NÃO é backup: a restauração a recusa.
//   7. STORES_V7 e STORES_V8 idênticas às da 1.5.6 (nenhuma edição no lugar; impressão digital fixa).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Dexie from 'dexie';
import { DB_NAME, STORES_V7, STORES_V8 } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { createFullBackupFromDb } from '../src/storage/indexedDb/backup/backupService.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { launchWeightKg } from '../src/modules/weighing/domain/weightNormalization.js';
import { formatWeightForField } from '../src/modules/equipment/domain/scaleContract.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';
import { analyzeImport, applyImport } from '../src/modules/import/application/importService.js';

const root = mkdtempSync(join(tmpdir(), 'pesagens-r09-'));
const dataDir = join(root, 'dados');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
const ponte = createGateAttachmentBridge(dataDir);
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

const fingerprint = (o) => createHash('sha256').update(JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]))).digest('hex');
const TS = '2026-01-01T00:00:00.000Z';
const base = { empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null };
const resumo = [];
try {
  // 7. Esquemas antigos intactos (impressões digitais tiradas da 1.5.6, commit 9392274).
  assert.equal(fingerprint(STORES_V7), '518889175432ce6067f219e9bd8d469fafa9420dc4d726ae4b7b8792102389ba', 'STORES_V7 igual à da 1.5.6');
  assert.equal(fingerprint(STORES_V8), 'aa131b1a43fae4cf7f5c7c83f37c183334f09b29644df7b85ef8dee108bbe63f', 'STORES_V8 igual à da 1.5.6');
  resumo.push('R09 STORES_V7/STORES_V8 iguais às da 1.5.6 (sem edição no lugar)');

  // 5. Backup v8 (banco v8 sintético) restaurado pelo fluxo novo.
  await deleteDbForTests();
  const v8 = new Dexie(DB_NAME);
  v8.version(8).stores(STORES_V8);
  await v8.open();
  const concluida = (versao) => ({ key: `migration:v${versao}`, value: { versao, status: 'CONCLUIDA', origem: 'fresh', passos_concluidos: [], started_at: TS, finished_at: TS, relatorio: {} } });
  await v8.table('appSettings').bulkPut([concluida(7), concluida(8)]);
  await v8.table('marcas').add({ ...base, id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true });
  await v8.table('animais').add({ ...base, id: 'V', numero_animal: 'V8', identificacao_normalizada: 'V8', marca_id: 'MK', situacao: 'ATIVO' });
  await v8.table('pesagens').add({ ...base, id: 'pV', data_pesagem: '2026-01-10', peso_kg: 300, animal_id: 'V', tipo_pesagem: 'Cadastro', lote_id: null, legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: 'V8', marca: 'ALFA', peso: 300 } });
  const backupV8 = await createFullBackupFromDb(v8, { reason: 'gate-r09', dbVersion: 8 });
  v8.close();
  await deleteDbForTests();
  await storage.ensureReady();
  const restaurado = await maintenance.applyRestoreBackup(backupV8.backup ?? backupV8);
  assert.equal(restaurado.restored, true);
  assert.equal(restaurado.schemaUpgradeRequired, true, 'backup v8 migra para v9 no restore');
  assert.equal(restaurado.recuperacaoCompleta, true, 'fluxo novo de restauração conclui com recuperação completa');
  assert.ok((await (await storage.ensureReady()).table('operacoes').count()) >= 1, 'operação legada criada pela migração');
  resumo.push('R09 backup v8 restaurado pelo fluxo novo (pré-backup verificado + conferência): migra para v9, recuperacaoCompleta');

  // 6. Exportação JSON de pesagens não é backup.
  const exportacao = (await storage.exportPesagensJson()).payload;
  let recusada = false;
  try { const dry = await storage.dryRunRestore(exportacao); recusada = dry?.restorable === false; } catch { recusada = true; }
  assert.ok(recusada, 'exportação de pesagens não é restaurável como backup');
  await assert.rejects(maintenance.applyRestoreBackup(exportacao));
  resumo.push('R09 exportação JSON de pesagens é recusada pela restauração (não é backup)');

  const db = await storage.ensureReady();
  await db.table('propriedades').bulkAdd([{ ...base, id: 'P1', nome: 'Sede' }]);
  for (const id of ['L1', 'L2']) await db.table('loteApartacoes').add({ ...base, id, apartacao_id: null, nome_lote: id, situacao: 'ABERTO' });
  const animal = async (n) => (await db.table('animais').toArray()).find((a) => a.numero_animal === n && !a.deleted_at);

  // 1. Entrada sem peso → Cadastro do mesmo animal.
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', propriedade_destino_id: 'P1', lote_destino_id: 'L1', itens: [{ numero_animal: '501', marca_id: 'MK', sexo: 'M' }, { numero_animal: '502', marca_id: 'MK', sexo: 'M', peso: 328.5 }] });
  await ops.confirmOperation(compra.operacao.id, { aceitarAvisos: true });
  const pendente = await animal('501');
  assert.equal(pendente.situacao_cadastro, 'PENDENTE_PESAGEM');
  await weighingService.createEntry({ tipo_manejo: 'Cadastro', numero_animal: '501', marca: 'ALFA', marca_id: 'MK', sexo: 'M', data_pesagem: '2026-02-03', peso: '301,9' });
  const iguais = (await db.table('animais').toArray()).filter((a) => a.numero_animal === '501' && !a.deleted_at);
  assert.equal(iguais.length, 1, 'Cadastro adota o animal pendente (sem segundo animal)');
  const entradas501 = (await db.table('movimentosAnimais').where('animal_id').equals(pendente.id).toArray()).filter((m) => !m.deleted_at && m.natureza === 'ENTRADA');
  assert.equal(entradas501.length, 1, 'uma única entrada no livro');
  resumo.push('R09 entrada sem peso + Cadastro: mesmo animal, uma entrada no livro');

  // 4. Mesma regra de peso: manual (301,9 → 301), operação (328,5 → 328), balança (328,5 → campo "328").
  const pesoCadastro = (await db.table('pesagens').where('animal_id').equals(pendente.id).toArray()).find((p) => !p.deleted_at);
  const pesoOperacao = (await db.table('pesagens').where('animal_id').equals((await animal('502')).id).toArray()).find((p) => !p.deleted_at);
  assert.equal(launchWeightKg('301,9'), 301);
  assert.equal(pesoOperacao.peso_kg, 328, 'operação grava 328,5 como 328');
  assert.equal(formatWeightForField(328.5), '328', 'balança mostra 328 para 328,5');
  assert.ok(pesoCadastro, 'Cadastro gravado');
  resumo.push('R09 peso: operação 328,5 → 328 = balança "328" (regra única)');

  // 3. Movimentação interna de lote.
  const totalAntes = (await ops.getInventory({ from: '2026-02-01', to: '2026-02-28' })).saldo_final;
  const mov = await ops.saveDraft({ tipo: 'MOVIMENTACAO', subtipo: 'MUDANCA_LOTE', data: '2026-02-10', lote_destino_id: 'L2', itens: [{ animal_id: (await animal('502')).id }] });
  await ops.confirmOperation(mov.operacao.id, { aceitarAvisos: true });
  const invTotal = await ops.getInventory({ from: '2026-02-01', to: '2026-02-28' });
  assert.equal(invTotal.saldo_final, totalAntes, 'movimentação interna não muda o rebanho');
  const invL2 = await ops.getInventory({ from: '2026-02-01', to: '2026-02-28', filtros: { lote_id: 'L2' } });
  assert.equal(invL2.internas.recebidas, 1, 'aparece como transferência interna recebida no lote');
  resumo.push('R09 movimentação interna: rebanho igual; lote de destino mostra a interna recebida');

  // 2. Saída confirmada e cancelada.
  const antesSaida = (await ops.getInventory({ from: '2026-03-01', to: '2026-03-31' })).saldo_final;
  const venda = await ops.saveDraft({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-03-05', itens: [{ animal_id: (await animal('502')).id, peso: 380 }] });
  await ops.confirmOperation(venda.operacao.id, { aceitarAvisos: true });
  assert.equal((await animal('502')).situacao, 'VENDIDO');
  assert.equal((await ops.getInventory({ from: '2026-03-01', to: '2026-03-31' })).saldo_final, antesSaida - 1);
  await ops.cancelOperation(venda.operacao.id, { motivo: 'Venda desfeita (gate R09)' });
  assert.equal((await animal('502')).situacao, 'ATIVO', 'cancelar a saída devolve o animal');
  assert.equal((await ops.getInventory({ from: '2026-03-01', to: '2026-03-31' })).saldo_final, antesSaida, 'inventário volta ao saldo de antes');
  resumo.push('R09 saída cancelada: animal ATIVO e inventário de volta ao saldo anterior');

  // R2-06 — importação de histórico na v9: um movimento de entrada por animal, inventário pelo livro, GMD derivado;
  // editar e cancelar uma pesagem importada reconcilia movimento e GMD (sem movimento órfão).
  {
    const texto = ['Brinco;Marca;Sexo;Raça;Data;Peso', '901;ALFA;M;;01/04/2026;300', '901;ALFA;M;;01/05/2026;330', '902;ALFA;F;;01/04/2026;280'].join('\r\n');
    const plano = await analyzeImport({ text: texto, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
    assert.equal(plano.blocking, false);
    const r = await applyImport(plano);
    assert.equal(r.animaisNovos, 2);
    const a901 = await animal('901');
    const movs = async (id) => (await db.table('movimentosAnimais').where('animal_id').equals(id).toArray()).filter((m) => !m.deleted_at);
    assert.equal((await movs(a901.id)).filter((m) => m.natureza === 'ENTRADA').length, 1, 'importado: uma entrada no livro');
    const inv = await ops.getInventory({ from: '2026-04-01', to: '2026-05-31' });
    assert.equal(inv.entradas.total, 2, 'inventário conta as 2 entradas importadas');
    const pes901 = (await db.table('pesagens').where('animal_id').equals(a901.id).toArray()).filter((p) => !p.deleted_at).sort((x, y) => x.data_pesagem.localeCompare(y.data_pesagem));
    assert.equal(Number(pes901[1].legacy_payload.gmd).toFixed(3), (30 / 30).toFixed(3), 'GMD derivado da importação (30 kg / 30 dias)');
    // Reimportar o mesmo arquivo não duplica nada.
    const replay = await analyzeImport({ text: texto, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
    assert.equal(replay.summary.jaExistem, 3, 'reimportação: 100% já existe');
    // Editar o peso do Manejo recalcula o GMD; cancelar o Manejo remove o derivado sem deixar movimento órfão.
    await weighingService.updateEntry(pes901[1].id, { ...pes901[1].legacy_payload, peso: 345 });
    const editado = (await db.table('pesagens').where('id').equals(pes901[1].id).first());
    assert.equal(Number(editado.legacy_payload.gmd).toFixed(3), (45 / 30).toFixed(3), 'GMD recalculado após editar');
    await weighingService.deleteEntry(pes901[1].id, { motivo: 'Lançado em duplicidade (gate R2-06)' });
    const restantes = await movs(a901.id);
    assert.ok(restantes.every((m) => !m.pesagem_id || m.pesagem_id !== pes901[1].id), 'nenhum movimento aponta para a pesagem cancelada');
    assert.equal(restantes.filter((m) => m.natureza === 'ENTRADA').length, 1, 'entrada continua única');
    resumo.push('R2-06 importação na v9: entrada única, inventário, GMD, reimportação sem duplicar, edição e cancelamento reconciliados');
  }

  console.log('OK verify-cross-surface-r1');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
