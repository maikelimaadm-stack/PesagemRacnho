// Gate migration:v9:verify — v8 → v9 (docs/arquitetura-produto/17-MODELO-DADOS-V9.md).
// Banco v8 "de produção" (Cadastros, Manejos, Saídas, movimentos sem natureza) aberto pelo app v9:
//   - backup pré-migração gravado e conferido antes de abrir;
//   - stores v9 criadas vazias; pesagens/animais/cadastros intactos;
//   - S2 grava natureza em todo movimento; S3 cria operações LEGADAS (Entrada por dia; Saída por dia e
//     motivo) com um item por pesagem, sem inventar parceiro/preço/documento, e liga o movimento à operação;
//   - reexecutar o backfill não cria nada (idempotente); Saída sem motivo vira SAIDA_SEM_MOTIVO;
//   - backup v8 restaurado no app v9 roda a v9 e chega ao mesmo resultado.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Dexie from 'dexie';
import { DB_NAME, DB_VERSION, STORES_V8, V9_STORES } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests, ensureStorageReady, resetDbForTests } from '../src/storage/indexedDb/db.js';
import * as coordinator from '../src/storage/migrations/migrationCoordinator.js';
import { MIGRATION_STATUS, clearWriteBlock, readMigrationState } from '../src/storage/migrations/migrationState.js';
import { V9_STEPS, runV9Backfill } from '../src/storage/migrations/v9Backfill.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import storage from '../src/storage/storageAdapter.js';

const TS = '2026-09-01T12:00:00.000Z';
const safetyEvidence = { path: 'C:\\isolated-test\\pre-operation.json', size: 2048, sha256: 'd'.repeat(64) };
const row = (extra) => ({ empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null, ...extra });
const files = () => {
  const written = [];
  return {
    written,
    async writeUserFile({ subdir, filename, content }) {
      const bytes = Buffer.from(content, 'utf8');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      written.push({ subdir, filename, content, size: bytes.length, sha256 });
      return { ok: true, path: `C:/fake/${subdir}/${filename}`, size: bytes.length, sha256 };
    },
  };
};
const concluida = (versao) => ({ key: `migration:v${versao}`, value: { versao, status: 'CONCLUIDA', origem: 'fresh', passos_concluidos: [], started_at: TS, finished_at: TS, relatorio: {} } });
const pesagem = (id, animal, data, tipo, extra = {}) => {
  const peso = 'peso' in extra ? extra.peso : 300;
  return row({ id, data_pesagem: data, peso_kg: peso, animal_id: animal, tipo_pesagem: tipo, lote_id: extra.lote ?? null, legacy_payload: { tipo_manejo: tipo, numero_animal: animal, marca: 'ALFA', peso, ...(extra.ui || {}) } });
};

async function seedV8() {
  await deleteDbForTests();
  clearWriteBlock();
  const v8 = new Dexie(DB_NAME);
  v8.version(8).stores(STORES_V8);
  await v8.open();
  await v8.table('appSettings').bulkPut([concluida(7), concluida(8)]);
  await v8.table('apartacoes').add(row({ id: 'AP', nome: 'AP', data: '2026-01-10' }));
  for (const id of ['L1', 'L2']) await v8.table('loteApartacoes').add(row({ id, apartacao_id: 'AP', nome_lote: id, situacao: 'ABERTO' }));
  await v8.table('marcas').add(row({ id: 'm1', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true }));
  for (const id of ['A', 'B', 'C', 'D']) await v8.table('animais').add(row({ id, numero_animal: id, identificacao_normalizada: id, marca_id: 'm1', situacao: 'ATIVO' }));
  const pesagens = [
    pesagem('pA', 'A', '2026-01-10', 'Cadastro', { lote: 'L1' }),
    pesagem('pB', 'B', '2026-01-10', 'Cadastro', { lote: 'L1' }),
    pesagem('pC', 'C', '2026-02-01', 'Cadastro'),
    pesagem('pD', 'D', '2026-02-01', 'Cadastro'),
    pesagem('mA', 'A', '2026-03-01', 'Manejo', { lote: 'L2' }),
    pesagem('sA', 'A', '2026-05-01', 'Saída', { ui: { motivo_saida: 'Venda', comprador: 'Fazenda X' } }),
    pesagem('sB', 'B', '2026-05-01', 'Saída', { ui: { motivo_saida: 'Venda' } }),
    pesagem('sC', 'C', '2026-05-01', 'Saída', { peso: null, ui: { motivo_saida: 'Morte', peso: null } }),
    pesagem('sD', 'D', '2026-05-02', 'Saída', { ui: {} }),
    { ...pesagem('xA', 'A', '2026-04-01', 'Manejo'), deleted_at: TS },
  ];
  await v8.table('pesagens').bulkAdd(pesagens);
  await v8.table('movimentosAnimais').bulkAdd([
    row({ id: 'mvA', animal_id: 'A', pesagem_id: 'pA', tipo: 'Entrada', data_evento: '2026-01-10', lote_destino_id: 'L1' }),
    row({ id: 'mvB', animal_id: 'B', pesagem_id: 'pB', tipo: 'Entrada', data_evento: '2026-01-10', lote_destino_id: 'L1' }),
    row({ id: 'mvL', animal_id: 'A', pesagem_id: 'mA', tipo: 'Mudança de lote', data_evento: '2026-03-01', lote_origem_id: 'L1', lote_destino_id: 'L2' }),
    row({ id: 'mvSA', animal_id: 'A', pesagem_id: 'sA', tipo: 'Venda', data_evento: '2026-05-01' }),
    row({ id: 'mvX', animal_id: 'C', pesagem_id: null, tipo: 'Tipo desconhecido', data_evento: '2026-02-02' }),
  ]);
  const before = { pesagens: await v8.table('pesagens').toArray(), animais: await v8.table('animais').toArray(), marcas: await v8.table('marcas').toArray() };
  v8.close();
  return before;
}

const strip = ({ localId: _l, ...rest }) => rest;
const resumo = [];

// --- Caso A: upgrade v8 → v9 -------------------------------------------------
const before = await seedV8();
const inspection = await coordinator.inspectDatabase();
assert.deepEqual({ currentVersion: inspection.currentVersion, targetVersion: inspection.targetVersion, needsMigration: inspection.needsMigration }, { currentVersion: 8, targetVersion: DB_VERSION, needsMigration: true });
const port = files();
const result = await coordinator.openWithMigration({ files: port });
assert.equal(result.blocked, false, JSON.stringify(result.error));
assert.equal(result.states[9].status, MIGRATION_STATUS.CONCLUIDA);
assert.deepEqual(result.states[9].passos_concluidos, V9_STEPS);
assert.equal(result.states[9].origem, 'upgrade-v8');
const backupFile = port.written.find((f) => f.subdir === 'backups');
assert.match(backupFile.filename, /^pre-migration-v9-\d{8}-\d{6}\.json$/, 'backup pré-migração da v9');
assert.equal(JSON.parse(backupFile.content).manifest.dbVersion, 8, 'backup com os dados da v8');
const db = await ensureStorageReady();
assert.equal(db.verno, 9);
for (const name of V9_STORES) assert.ok(db.tables.some((t) => t.name === name), `store ${name} criada`);
assert.deepEqual((await db.table('pesagens').toArray()).map(strip), before.pesagens.map(strip), 'pesagens intactas');
assert.deepEqual((await db.table('animais').toArray()).map(strip), before.animais.map(strip), 'animais intactos');
resumo.push('upgrade v8 → v9 com backup pré-migração; dados intactos');

// S2: natureza.
const movs = await db.table('movimentosAnimais').toArray();
const nat = Object.fromEntries(movs.map((m) => [m.id, m.natureza ?? null]));
assert.deepEqual(nat, { mvA: 'ENTRADA', mvB: 'ENTRADA', mvL: 'INTERNA', mvSA: 'SAIDA', mvX: null });
assert.equal(result.states[9].relatorio.movimentosSemNatureza, 1, 'tipo desconhecido fica sem natureza (não inventa)');
resumo.push('S2 natureza em todo movimento reconhecido');

// S3: operações legadas.
const ops = (await db.table('operacoes').toArray()).sort((a, b) => `${a.data}${a.tipo}${a.subtipo}`.localeCompare(`${b.data}${b.tipo}${b.subtipo}`));
assert.deepEqual(ops.map((o) => [o.data, o.tipo, o.subtipo, o.quantidade_prevista]), [
  ['2026-01-10', 'ENTRADA', 'LEGADO_CADASTRO', 2],
  ['2026-02-01', 'ENTRADA', 'LEGADO_CADASTRO', 2],
  ['2026-05-01', 'SAIDA', 'MORTE', 1],
  ['2026-05-01', 'SAIDA', 'VENDA', 2],
  ['2026-05-02', 'SAIDA', 'SAIDA_SEM_MOTIVO', 1],
]);
assert.ok(ops.every((o) => o.origem === 'LEGADO' && o.documento_situacao === 'SEM_DOCUMENTO' && o.parceiro_id === null && o.status === 'CONFIRMADA'), 'nada inventado');
const itens = await db.table('operacaoItens').toArray();
assert.equal(itens.length, 8, 'um item por Cadastro/Saída ativo (Manejo e cancelada fora)');
assert.equal(new Set(itens.map((i) => i.origem_pesagem_id)).size, 8, 'cada pesagem convertida uma vez');
const venda = itens.find((i) => i.origem_pesagem_id === 'sA');
assert.equal(venda.texto_legado, 'Fazenda X', 'comprador fica como texto legado do item');
assert.equal(itens.find((i) => i.origem_pesagem_id === 'sC').peso_kg, null, 'morte sem peso não vira 0 kg');
const opVenda = ops.find((o) => o.subtipo === 'VENDA');
assert.equal((await db.table('movimentosAnimais').where('id').equals('mvSA').first()).operacao_id, opVenda.id, 'movimento ligado à operação');
assert.equal((await db.table('movimentosAnimais').where('id').equals('mvL').first()).operacao_id, undefined, 'movimento interno não vira operação legada');
resumo.push('S3 operações legadas por dia/motivo, item por pesagem, movimento ligado');

// Idempotência: reexecutar não cria nada.
const counts = async () => Object.fromEntries(await Promise.all(['operacoes', 'operacaoItens', 'movimentosAnimais'].map(async (t) => [t, await db.table(t).count()])));
const snap = await counts();
await db.table('appSettings').delete('migration:v9');
const rerun = await runV9Backfill(db);
assert.equal(rerun.completed, true);
assert.deepEqual(await counts(), snap, 'reexecutar o backfill não duplica operações nem itens');
assert.equal(rerun.state.relatorio.pesagensJaConvertidas, 8);
resumo.push('backfill v9 idempotente');
assert.deepEqual((await logicalIntegrity()).issues, [], 'integridade do banco migrado');

// --- Caso B: backup v8 restaurado no app v9 ----------------------------------
const v8Backup = JSON.parse(backupFile.content);
const dry = await storage.dryRunRestore(v8Backup);
assert.equal(dry.sourceDbVersion, 8);
assert.equal(dry.schemaUpgradeRequired, true);
assert.deepEqual([...dry.newStores].sort(), [...V9_STORES].sort(), 'stores v9 nascem vazias no restore da v8');
const restored = await storage.applyRestore(v8Backup, { safetyEvidence });
assert.equal(restored.restored, true);
assert.equal(restored.backfill.status, MIGRATION_STATUS.CONCLUIDA);
assert.equal(await db.table('operacoes').count(), 5, 'restore da v8 projeta as mesmas operações legadas');
assert.equal((await readMigrationState(db, 9)).origem, 'restore-v8');
resumo.push('restore de backup v8 no app v9 roda a v9');

resetDbForTests();
await deleteDbForTests();
clearWriteBlock();
console.log('OK verify-v9-migration');
console.log(JSON.stringify(resumo, null, 2));
