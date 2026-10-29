// Gate migration:v8:verify (ADR-049; ADR-038; docs/arquitetura-produto/14-MIGRACOES.md).
// Banco v7 com dados reais simulados (cadastros, usuários, animais, identificadores, sessões,
// pesagens, movimentos, auditoria, importação, embarque, estado migration:v7 CONCLUIDA e a chave
// legada de sanidade retida) aberto pelo app v8. Casos:
//   A. upgrade v7 → v8: backup pré-migração validado (formato da v7, sem as stores novas), PENDENTE
//      gravado antes de abrir, dados intactos store a store (linha a linha), stores de sanidade vazias,
//      v7 não reexecutada, chave legada não convertida, integridade, idempotência e dry-run da cadeia;
//   B. falha injetada no backfill v8 → FALHOU, escrita bloqueada (inclusive sanidade), reabertura
//      continua bloqueada, retomada resumível (maxBatches) e "Continuar migração";
//   C. backup pré-migração falha/sem porta → banco continua v7 (fail closed);
//   D. backup v7 restaurado no app v8 → sanidade vazia, dados v7 intactos, só a v8 roda;
//   E. banco novo → seeds da v7 e estado v8, sem backup;
//   F. v6 → v8 roda a cadeia inteira (v7 e depois v8) com um único backup;
//   G. backup v8 → restore preserva as stores de sanidade; backups de versão futura recusados;
//      stores legadas da v5 ignoradas.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { CATEGORIAS_SEED } from '../src/modules/catalog/domain/seeds.js';
import { createHash } from 'node:crypto';
import Dexie from 'dexie';
import { DB_NAME, DB_VERSION, SANITY_STORES, STORES_V6, STORES_V7, STORE_NAMES, V9_STORES } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests, ensureStorageReady, resetDbForTests } from '../src/storage/indexedDb/db.js';
import * as coordinator from '../src/storage/migrations/migrationCoordinator.js';
import { MIGRATION_STATUS, clearWriteBlock, emptyMigrationState, getWriteBlock, isWriteBlocked, readMigrationState } from '../src/storage/migrations/migrationState.js';
import { V7_STEPS } from '../src/storage/migrations/v7Backfill.js';
import { V8_STEPS } from '../src/storage/migrations/v8Backfill.js';
import { V9_STEPS } from '../src/storage/migrations/v9Backfill.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';

const TS = '2026-09-01T12:00:00.000Z';
const V7_FINISHED_AT = '2026-09-01T12:30:00.000Z';
const SANIDADE_LEGADA = 'cadastros-auxiliares:sanidade:local';
const safetyEvidence = { path: 'C:\\isolated-test\\pre-operation.json', size: 2048, sha256: 'd'.repeat(64) };
const summary = { casos: [] };

function makeFilesPort({ fail = false, corrupt = false } = {}) {
  const written = [];
  return {
    written,
    async writeUserFile({ subdir, filename, content }) {
      if (fail) throw new Error('disco cheio (simulado)');
      const bytes = Buffer.from(content, 'utf8');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      written.push({ subdir, filename, content, size: bytes.length, sha256 });
      return { ok: true, path: `C:/fake/${subdir}/${filename}`, size: corrupt ? bytes.length - 1 : bytes.length, sha256 };
    },
  };
}

async function rejectsCode(run, code, message) {
  let error = null;
  try { await run(); } catch (err) { error = err; }
  assert.ok(error, `${message}: deveria lançar ${code}`);
  assert.equal(error.code, code, `${message}: code esperado ${code}, obtido ${error.code} (${error.message})`);
  return error;
}

const row = (extra) => ({ empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null, ...extra });

/** Banco v7 "de produção" (1.2.0-rc1): tudo coerente com o contrato v7. */
function v7Fixture() {
  const animals = ['1', '2', '3'].map((numero, index) => row({
    id: `a${numero}`, numero_animal: numero, identificacao_normalizada: numero, sexo: index === 2 ? 'F' : 'M', raca: 'Nelore', marca: 'ALFA',
    marca_id: 'm1', raca_id: 'r1', categoria_id: null, categoria_automatica: true, propriedade_id: 'prop1', situacao: 'ATIVO',
    nascimento: null, nascimento_estimado: false, ultimo_peso_kg: 230 + index, ultima_pesagem_data: '2026-08-20', lote_atual_id: null,
  }));
  const pesagem = (animal, tipo, data, sessao, peso) => row({
    id: `p-${animal.id}-${tipo}`, data_pesagem: data, peso_kg: peso, animal_id: animal.id, sessao_id: sessao, lote_id: null, tipo_pesagem: tipo, observacao: null,
    created_by_user_id: 'u1', updated_by_user_id: 'u1',
    legacy_payload: { id: `p-${animal.id}-${tipo}`, empresa_id: 'local', tipo_manejo: tipo, data_pesagem: data, animal_id: animal.id, sessao_id: sessao, numero_animal: animal.numero_animal, sexo: animal.sexo, raca: 'Nelore', marca: 'ALFA', marca_id: 'm1', peso, origem: 'manual', operador: 'Ana' },
  });
  const pesagens = animals.flatMap((animal, index) => [
    pesagem(animal, 'Cadastro', '2026-08-01', 's1', 200 + index),
    pesagem(animal, 'Manejo', '2026-08-20', 's2', 230 + index),
  ]);
  const v7State = emptyMigrationState(7, {
    status: MIGRATION_STATUS.CONCLUIDA, origem: 'upgrade-v6', started_at: TS, finished_at: V7_FINISHED_AT, passos_concluidos: [...V7_STEPS],
    last_checkpoint: 'B12:done', processed: 9, total: 9, backup: { path: 'C:/fake/backups/pre-migration-v7-20260901-120000.json', sha256: 'e'.repeat(64), size: 10 },
  });
  return {
    marcas: [row({ id: 'm1', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true })],
    racas: [row({ id: 'r1', nome: 'Nelore', nome_normalizado: 'NELORE', ativo: true, padrao: true })],
    categoriasAnimal: [row({ id: 'cat1', nome: 'Boi', nome_normalizado: 'BOI', sexo_aplicavel: 'M', peso_min_kg: 300, peso_max_kg: null, ativo: true, ordem: 5 })],
    parceiros: [row({ id: 'par1', nome: 'Comprador Um', nome_normalizado: 'COMPRADOR UM', documento: '12345678901', papeis: ['COMPRADOR'], ativo: true })],
    propriedades: [row({ id: 'prop1', nome: 'Propriedade principal', nome_normalizado: 'PROPRIEDADE PRINCIPAL', tipo: 'PROPRIA', parceiro_id: null, padrao: true, ativo: true })],
    causasMorte: [row({ id: 'c1', nome: 'Acidente', nome_normalizado: 'ACIDENTE', ativo: true })],
    faixasIdentificadores: [row({ id: 'f1', tipo: 'VISUAL', marca_id: 'm1', situacao: 'ATIVA', inicio: 1, fim: 100, proximo: 4, ativo: true })],
    excecoesIdentificadores: [row({ id: 'e1', faixa_id: 'f1', numero: 50, motivo: 'PERDIDO' })],
    usuarios: [row({ id: 'u1', nome: 'Ana', login: 'ana', login_normalizado: 'ana', role: 'ADMIN', ativo: true, password_hash: 'aGFzaA==', password_salt: 'c2FsdA==' })],
    animais: animals,
    animalIdentificadores: animals.map((animal) => row({ id: `i-${animal.id}`, animal_id: animal.id, tipo: 'VISUAL', valor: animal.numero_animal, valor_normalizado: animal.numero_animal, marca_id: 'm1', faixa_id: 'f1', inicio: '2026-08-01', fim: null, principal: true, ativo: true })),
    sessoesPesagem: [
      row({ id: 's1', data: '2026-08-01', local: null, status: 'FECHADA', operador: 'Ana', operador_usuario_id: 'u1' }),
      row({ id: 's2', data: '2026-08-20', local: null, status: 'ABERTA', operador: 'Ana', operador_usuario_id: 'u1' }),
    ],
    pesagens,
    movimentosAnimais: animals.map((animal) => row({ id: `mov-${animal.id}`, animal_id: animal.id, pesagem_id: `p-${animal.id}-Cadastro`, tipo: 'Entrada', data_evento: '2026-08-01', lote_origem_id: null, lote_destino_id: null })),
    animalLotes: [],
    apartacoes: [row({ id: 'ap1', nome: 'Recria', ativo: true })],
    loteApartacoes: [row({ id: 'lt1', apartacao_id: 'ap1', nome_lote: 'Leves', situacao: 'ABERTO', categoria_id: null, ativo: true })],
    embarques: [row({ id: 'emb1', data: '2026-08-25', status: 'ABERTO', parceiro_id: 'par1' })],
    documentosEmbarque: [row({ id: 'doc1', embarque_id: 'emb1', tipo: 'GTA', numero: '123' })],
    auditoria: pesagens.map((p) => ({ id: `aud-${p.id}`, entidade: 'pesagens', entidade_id: p.id, acao: 'CRIAR', origem: 'manual', usuario_id: 'u1', usuario_nome_snapshot: 'Ana', created_at: TS })),
    importacoes: [row({ id: 'imp1', arquivo_hash: 'hash-1', arquivo_nome: 'pesagens.csv', origem: 'csv', status: 'CONCLUIDA', linhas_total: 0, registros_criados: 0 })],
    appSettings: [
      { key: 'migration:v7', value: v7State },
      { key: 'resumo-personalizado:local', value: { versao: 1, itens: ['peso'] } },
      // Chave legada retida pelo B11 da v7 quando não havia porta de arquivos (SEM_PORTA_DE_ARQUIVOS).
      { key: SANIDADE_LEGADA, value: { programasSanidade: [{ id: 'ps-legado', nome: 'Vacinação' }], medicamentos: [{ id: 'med-legado', nome: 'Ivermectina' }] } },
    ],
    backupHistory: [{ id: 'bh1', tipo: 'migration-v7', detalhes: '{}', created_at: V7_FINISHED_AT }],
  };
}

async function seedV7() {
  await deleteDbForTests();
  clearWriteBlock();
  const legacy = new Dexie(DB_NAME);
  legacy.version(7).stores(STORES_V7);
  await legacy.open();
  const fixture = v7Fixture();
  for (const [name, rows] of Object.entries(fixture)) {
    if (rows.length) await legacy.table(name).bulkAdd(rows);
  }
  const snapshot = {};
  for (const name of Object.keys(STORES_V7)) snapshot[name] = await legacy.table(name).toArray();
  legacy.close();
  return snapshot;
}

async function openDynamic() {
  const probe = new Dexie(DB_NAME);
  await probe.open();
  return probe;
}

async function expectStillV7() {
  const probe = await openDynamic();
  try {
    assert.equal(probe.verno, 7, 'banco continua na v7');
    const names = probe.tables.map((table) => table.name);
    assert.ok(SANITY_STORES.every((name) => !names.includes(name)), 'stores de sanidade não foram criadas');
  } finally {
    probe.close();
  }
}

const dataStores = Object.keys(STORES_V7).filter((name) => !['appSettings', 'backupHistory'].includes(name));
// O passo S2 aplica o pré-cadastro de categorias (e audita o que fez): essas duas stores mudam
// de propósito na v8. Todo o resto tem de sair exatamente como entrou.
const storesIntactas = dataStores.filter((name) => !['categoriasAnimal', 'auditoria'].includes(name));
// v9 (aditiva) grava `natureza` (e o vínculo com a operação legada) nos movimentos existentes: fora esses
// campos, o movimento tem de sair exatamente como entrou.
const V9_MOVEMENT_FIELDS = ['natureza', 'operacao_id', 'updated_at'];
const semCamposV9 = (name, rows) => (name === 'movimentosAnimais'
  ? rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !V9_MOVEMENT_FIELDS.includes(key))))
  : rows);
const CADEIA = [7, 8, 9];

// ---------------------------------------------------------------------------
// Caso A — upgrade v7 → v8 com dados reais simulados.
// ---------------------------------------------------------------------------
let v7BackupJson = null;
{
  const before = await seedV7();
  const inspection = await coordinator.inspectDatabase();
  assert.deepEqual({ currentVersion: inspection.currentVersion, targetVersion: inspection.targetVersion, needsMigration: inspection.needsMigration, blockers: inspection.blockers }, { currentVersion: 7, targetVersion: DB_VERSION, needsMigration: true, blockers: [] });
  assert.deepEqual(coordinator.MIGRATION_CHAIN, CADEIA, 'cadeia de backfills v7 → v8 → v9');
  assert.deepEqual(coordinator.chainVersionsAfter(7), [8, 9]);

  const files = makeFilesPort();
  const pendingSeen = {};
  const progress = [];
  const result = await coordinator.openWithMigration({
    files,
    onProgress: (p) => progress.push(p),
    hooks: {
      beforeOpen: async () => {
        const probe = await openDynamic();
        try {
          pendingSeen.verno = probe.verno;
          pendingSeen.v7 = await readMigrationState(probe, 7);
          pendingSeen.v8 = await readMigrationState(probe, 8);
        } finally {
          probe.close();
        }
      },
    },
  });
  assert.equal(pendingSeen.verno, 7, 'estado PENDENTE gravado ainda na v7 (antes de abrir na v8)');
  assert.equal(pendingSeen.v8?.status, MIGRATION_STATUS.PENDENTE, 'migration:v8 PENDENTE antes de abrir');
  assert.equal(pendingSeen.v8.origem, 'upgrade-v7');
  assert.ok(pendingSeen.v8.backup?.sha256, 'PENDENTE já referencia o backup pré-migração');
  assert.equal(pendingSeen.v7.status, MIGRATION_STATUS.CONCLUIDA, 'migration:v7 CONCLUIDA não é reaberta');

  assert.equal(result.migrated, true);
  assert.equal(result.blocked, false, JSON.stringify(result.error));
  assert.equal(isWriteBlocked(), false);
  assert.equal(result.state.versao, DB_VERSION, 'a cadeia termina na versão vigente');
  assert.equal(result.state.status, MIGRATION_STATUS.CONCLUIDA);
  const v8 = result.states[8];
  assert.equal(v8.status, MIGRATION_STATUS.CONCLUIDA);
  assert.deepEqual(v8.passos_concluidos, V8_STEPS);
  assert.deepEqual(v8.relatorio, { storesCriadas: SANITY_STORES, programasSanidade: 0, medicamentos: 0, aplicacoesSanidade: 0, categoriasCriadas: v8.relatorio.categoriasCriadas, categoriasAtualizadas: v8.relatorio.categoriasAtualizadas, categoriasRemovidas: v8.relatorio.categoriasRemovidas }, 'relatório próprio da v8');
assert.equal(typeof v8.relatorio.categoriasCriadas, 'number', 'S2 registra o pré-cadastro de categorias aplicado');
  assert.deepEqual(result.states[9].passos_concluidos, V9_STEPS, 'v9 roda depois da v8');
  assert.deepEqual(result.states[7], before.appSettings.find((item) => item.key === 'migration:v7').value, 'estado da v7 intacto (a v7 não é reexecutada)');
  assert.ok(progress.length > 0 && progress.every((p) => (p.versao === 8 && V8_STEPS.includes(p.passo)) || (p.versao === 9 && V9_STEPS.includes(p.passo))), 'só os backfills v8 e v9 reportam progresso (a v7 não reexecuta)');

  // Backup pré-migração: nome da versão alvo, formato/dados da v7, validado por SHA-256 e tamanho.
  const backupFile = files.written.find((file) => file.subdir === 'backups');
  assert.ok(backupFile, 'backup pré-migração gravado');
  assert.match(backupFile.filename, new RegExp(`^pre-migration-v${DB_VERSION}-\\d{8}-\\d{6}\\.json$`));
  assert.equal(files.written.length, 1, 'somente o backup pré-migração foi gravado');
  v7BackupJson = JSON.parse(backupFile.content);
  assert.equal(v7BackupJson.formatVersion, 3, 'banco v7 → backup formato 3 (inalterado na v8)');
  assert.equal(v7BackupJson.manifest.dbVersion, 7);
  assert.equal(v7BackupJson.manifest.schemaVersion, 7, 'schemaVersion descreve os dados do arquivo (v7)');
  assert.deepEqual([...v7BackupJson.manifest.stores].sort(), Object.keys(STORES_V7).sort(), 'backup com todas as stores da v7');
  assert.ok(SANITY_STORES.every((name) => !(name in v7BackupJson.stores)), 'backup da v7 não tem stores de sanidade');
  for (const name of dataStores) assert.equal(v7BackupJson.stores[name].length, before[name].length, `backup conta ${name}`);
  assert.equal(result.state.backup.sha256, backupFile.sha256);
  assert.equal(result.state.backup.size, backupFile.size);
  assert.equal(result.state.backup.sourceVersion, 7);
  assert.equal(result.state.backup.targetVersion, DB_VERSION);

  // Dados intactos store a store, linha a linha; stores novas vazias.
  const db = await ensureStorageReady();
  assert.equal(db.verno, DB_VERSION);
  for (const name of storesIntactas) {
    assert.deepEqual(semCamposV9(name, await db.table(name).toArray()), semCamposV9(name, before[name]), `store ${name} intacta após a v8/v9 (${before[name].length} registro(s))`);
  }
  // S2: o pré-cadastro de categorias entra sem apagar o que já existia e sem duplicar nomes.
  const categoriasDepois = (await db.table('categoriasAnimal').toArray()).filter((row) => !row.deleted_at);
  const nomes = categoriasDepois.map((row) => row.nome);
  assert.equal(new Set(nomes).size, nomes.length, 'S2 não duplica categorias');
  for (const antes of before.categoriasAnimal.filter((row) => !row.deleted_at)) {
    const depois = (await db.table('categoriasAnimal').toArray()).find((row) => row.id === antes.id);
    assert.ok(depois, `categoria ${antes.nome} continua no banco`);
  }
  for (const seed of ['Bezerro', 'Garrote', 'Novilha', 'Boi pesado', 'Fêmea adulta']) {
    assert.ok(nomes.includes(seed), `pré-cadastro aplicado: ${seed}`);
  }
  for (const name of SANITY_STORES) assert.equal(await db.table(name).count(), 0, `${name} nasce vazia`);
  const settings = await db.table('appSettings').toArray();
  assert.equal(settings.length, before.appSettings.length + 2, 'appSettings ganha só migration:v8 e migration:v9');
  assert.deepEqual(settings.find((item) => item.key === SANIDADE_LEGADA), before.appSettings.find((item) => item.key === SANIDADE_LEGADA), 'chave legada de sanidade não é convertida nem apagada pela v8');
  const history = (await db.table('backupHistory').toArray()).map((item) => item.tipo);
  assert.deepEqual(history, ['migration-v7', 'pre-migration', 'migration-v8', 'migration-v9'], `histórico: ${history.join(',')}`);
  const integrity = await logicalIntegrity();
  assert.deepEqual(integrity.issues, [], 'integridade do banco migrado');
  assert.equal(integrity.v7Contract, true);

  // Idempotência + dry-run da cadeia + estado para a Manutenção.
  resetDbForTests();
  const again = await coordinator.openWithMigration({ files: makeFilesPort() });
  assert.equal(again.migrated, false);
  assert.equal(again.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal((await (await ensureStorageReady()).table('backupHistory').count()), 4, 'reabrir não grava histórico novo');
  const dry = await coordinator.dryRunBackfill();
  assert.equal(dry.pendente, false);
  assert.equal(dry.versao, DB_VERSION);
  assert.deepEqual(dry.cadeia, CADEIA.map((versao) => ({ versao, status: 'CONCLUIDA', pendente: false })));
  assert.equal(dry.marcas.novas, 0, 'forma histórica da v7 no topo do dry-run');
  assert.deepEqual((await coordinator.dryRunBackfill(8)).sanidade, { programasSanidade: 0, medicamentos: 0, aplicacoesSanidade: 0 });
  await rejectsCode(() => coordinator.dryRunBackfill(99), 'MIGRATION_UNKNOWN_VERSION', 'dry-run de versão sem backfill');
  const status = await coordinator.getMigrationState();
  assert.equal(status.versao, DB_VERSION);
  assert.deepEqual(status.cadeia, CADEIA.map((versao) => ({ versao, status: 'CONCLUIDA' })));
  assert.equal((await coordinator.getMigrationState(7)).state.finished_at, V7_FINISHED_AT);
  summary.casos.push({ caso: 'upgrade-v7-v8', stores: dataStores.length, pesagens: before.pesagens.length, backup: backupFile.filename });
}

// ---------------------------------------------------------------------------
// Caso B — falha injetada no backfill v8, bloqueio, reabertura e retomada resumível.
// ---------------------------------------------------------------------------
{
  const before = await seedV7();
  const files = makeFilesPort();
  const failed = await coordinator.openWithMigration({ files, hooks: { beforeStep: (step) => { if (step === 'S1') throw new Error('falha injetada em S1'); } } });
  assert.equal(failed.blocked, true, 'falha no backfill v8 abre em somente leitura');
  assert.equal(failed.state.versao, 8);
  assert.equal(failed.state.status, MIGRATION_STATUS.FALHOU);
  assert.equal(failed.state.error.passo, 'S1');
  assert.match(failed.state.error.message, /falha injetada/);
  assert.ok(failed.state.backup?.sha256, 'backup preservado no estado');
  assert.equal(failed.states[7].status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(isWriteBlocked(), true);
  assert.equal(getWriteBlock().version, 8, 'bloqueio identifica a versão que falhou');
  await rejectsCode(() => sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' }), 'MIGRATION_BLOCKED', 'cadastro de sanidade bloqueado');
  await rejectsCode(() => storage.animais.create({ id: 'novo', numero_animal: '9' }), 'MIGRATION_BLOCKED', 'repositório bloqueado');
  const diag = await coordinator.getMigrationState();
  assert.equal(diag.versao, 8, 'Manutenção foca a versão pendente');
  assert.equal(diag.state.status, MIGRATION_STATUS.FALHOU);
  assert.equal(diag.blocked, true);
  const dry = await coordinator.dryRunBackfill();
  assert.equal(dry.pendente, true);
  assert.deepEqual(dry.cadeia.map((item) => item.pendente), [false, true, true]);

  resetDbForTests();
  clearWriteBlock();
  const reopened = await coordinator.openWithMigration({ files });
  assert.equal(reopened.blocked, true, 'reabrir com FALHOU continua bloqueado (retomada manual)');
  assert.equal(reopened.state.status, MIGRATION_STATUS.FALHOU);

  const partial = await coordinator.runPendingBackfills({ files, maxBatches: 0 });
  assert.equal(partial.completed, false, 'retomada respeita maxBatches (resumível)');
  assert.equal(partial.versao, 8);
  assert.equal(partial.state.status, MIGRATION_STATUS.EM_ANDAMENTO);
  assert.equal(isWriteBlocked(), true, 'escrita segue bloqueada até concluir');
  const resumed = await coordinator.runPendingBackfills({ files });
  assert.equal(resumed.completed, true);
  assert.equal(resumed.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(resumed.state.error, null);
  assert.deepEqual(resumed.results, [{ versao: 7, completed: true, alreadyDone: true }, { versao: 8, completed: true, alreadyDone: false }, { versao: 9, completed: true, alreadyDone: false }]);
  assert.equal(isWriteBlocked(), false, '"Continuar migração" libera a escrita');
  const db = await ensureStorageReady();
  for (const name of storesIntactas) assert.deepEqual(semCamposV9(name, await db.table(name).toArray()), semCamposV9(name, before[name]), `store ${name} intacta após falha e retomada`);
  assert.ok((await sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' })).id, 'gravação de sanidade liberada após concluir');
  summary.casos.push({ caso: 'falha-e-retomada-v8', passoFalho: 'S1' });
}

// ---------------------------------------------------------------------------
// Caso B2 — crash entre o backup e a abertura: o PENDENTE (com backup) é retomado.
// ---------------------------------------------------------------------------
{
  await seedV7();
  const firstFiles = makeFilesPort();
  const inspection = await coordinator.inspectDatabase();
  const firstBackup = await coordinator.prepareMigration({ files: firstFiles, inspection });
  await coordinator.recordPendingMigrationBeforeOpen({ backup: firstBackup, inspection });
  await expectStillV7();
  // "App fechou": nova abertura gera outro backup, mas o estado PENDENTE existente é preservado.
  const result = await coordinator.openWithMigration({ files: makeFilesPort() });
  assert.equal(result.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(result.state.backup.sha256, firstBackup.sha256, 'estado pendente preserva a referência do primeiro backup');
  summary.casos.push({ caso: 'crash-antes-de-abrir' });
}

// ---------------------------------------------------------------------------
// Caso C — backup pré-migração falha → banco continua v7 (fail closed).
// ---------------------------------------------------------------------------
{
  await seedV7();
  await rejectsCode(() => coordinator.openWithMigration({ files: makeFilesPort({ fail: true }) }), 'MIGRATION_BACKUP_FAILED', 'porta de arquivos falha');
  assert.equal(isWriteBlocked(), true);
  await expectStillV7();
  clearWriteBlock();
  const corrupt = await rejectsCode(() => coordinator.openWithMigration({ files: makeFilesPort({ corrupt: true }) }), 'MIGRATION_BACKUP_FAILED', 'tamanho divergente');
  assert.equal(corrupt.reason, 'VALIDATION_MISMATCH');
  await expectStillV7();
  clearWriteBlock();
  const semPorta = await rejectsCode(() => coordinator.openWithMigration({ files: null }), 'MIGRATION_BACKUP_FAILED', 'sem porta de arquivos');
  assert.equal(semPorta.reason, 'NO_FILES_PORT');
  await expectStillV7();
  const probe = await openDynamic();
  assert.equal(await readMigrationState(probe, 8), null, 'nenhum estado v8 gravado quando o backup falha');
  probe.close();
  clearWriteBlock();
  summary.casos.push({ caso: 'backup-falha-bloqueia', variantes: ['porta falha', 'sha/tamanho divergente', 'sem porta'] });
}

// ---------------------------------------------------------------------------
// Caso D — backup v7 restaurado no app v8.
// ---------------------------------------------------------------------------
{
  await deleteDbForTests();
  clearWriteBlock();
  await coordinator.openWithMigration({ files: null });
  const db = await ensureStorageReady();
  const programa = await sanity.saveProgram({ nome: 'Pré-restore', tipo: 'OUTRO' });
  assert.ok(programa.id);

  const dry = await storage.dryRunRestore(v7BackupJson);
  assert.equal(dry.sourceDbVersion, 7);
  assert.equal(dry.targetDbVersion, DB_VERSION);
  assert.equal(dry.schemaUpgradeRequired, true);
  assert.deepEqual([...dry.newStores].sort(), [...SANITY_STORES, ...V9_STORES].sort(), 'stores de sanidade e da v9 nascem vazias no restore da v7');
  assert.deepEqual(dry.ignoredStores, []);
  const restored = await storage.applyRestore(v7BackupJson, { safetyEvidence });
  assert.equal(restored.restored, true);
  assert.equal(restored.backfill.status, MIGRATION_STATUS.CONCLUIDA);
  for (const name of SANITY_STORES) assert.equal(await db.table(name).count(), 0, `${name} vazia após restore do backup v7 (o pré-restore some)`);
  for (const name of storesIntactas) {
    const expected = v7BackupJson.stores[name].map(({ localId: _localId, ...rest }) => rest);
    const actual = (await db.table(name).toArray()).map(({ localId: _localId, ...rest }) => rest);
    assert.deepEqual(semCamposV9(name, actual), semCamposV9(name, expected), `dados v7 intactos após restore: ${name}`);
  }
  const v7State = await readMigrationState(db, 7);
  const v8State = await readMigrationState(db, 8);
  assert.equal(v7State.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(v7State.finished_at, V7_FINISHED_AT, 'estado da v7 vem do backup (não reexecutado)');
  assert.equal(v8State.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(v8State.origem, 'restore-v7');
  const history = (await db.table('backupHistory').toArray()).map((item) => item.tipo);
  assert.ok(history.includes('restore') && history.includes('backfill-v8') && !history.includes('backfill-v7'), `só a v8 roda no restore da v7 (${history.join(',')})`);
  assert.deepEqual((await logicalIntegrity()).issues, [], 'integridade após restore v7');
  summary.casos.push({ caso: 'restore-backup-v7' });
}

// ---------------------------------------------------------------------------
// Caso E — banco novo: seeds da v7, estado v8, sem backup.
// ---------------------------------------------------------------------------
{
  await deleteDbForTests();
  clearWriteBlock();
  const files = makeFilesPort();
  const fresh = await coordinator.openWithMigration({ files });
  assert.equal(fresh.migrated, false);
  assert.equal(fresh.blocked, false);
  assert.equal(files.written.length, 0, 'banco novo não gera backup');
  assert.equal(fresh.states[7].status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(fresh.states[7].origem, 'fresh');
  assert.equal(fresh.states[8].status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(fresh.states[8].origem, 'fresh');
  const db = await ensureStorageReady();
  assert.equal(await db.table('categoriasAnimal').count(), CATEGORIAS_SEED.length, 'banco novo: pré-cadastro de categorias completo (v7 semeia, S2 completa faixa e era)');
assert.ok((await db.table('categoriasAnimal').toArray()).every((row) => row.peso_min_kg != null && row.era != null), 'todas com faixa de peso e era');
  assert.equal((await db.table('racas').toArray()).find((item) => item.padrao)?.nome, 'Nelore');
  assert.equal((await db.table('propriedades').toArray()).filter((item) => item.tipo === 'PROPRIA' && item.padrao).length, 1);
  for (const name of SANITY_STORES) assert.equal(await db.table(name).count(), 0);
  assert.ok(STORE_NAMES.every((name) => db.tables.some((table) => table.name === name)), 'todas as stores vigentes criadas');
  summary.casos.push({ caso: 'banco-novo' });
}

// ---------------------------------------------------------------------------
// Caso F — v6 → v8: a cadeia inteira roda, v7 antes da v8, com um único backup.
// ---------------------------------------------------------------------------
{
  await deleteDbForTests();
  clearWriteBlock();
  const legacy = new Dexie(DB_NAME);
  legacy.version(6).stores(STORES_V6);
  await legacy.open();
  await legacy.table('appSettings').put({ key: 'cadastros-auxiliares:mortalidade:local', value: { causasMorte: [{ id: 'causa-1', nome: 'Acidente' }] } });
  await legacy.table('sessoesPesagem').add({ id: 's1', data: '2026-01-05', status: 'Aberta', operador: 'LOCAL', created_at: TS, updated_at: TS, deleted_at: null });
  await legacy.table('animais').add({ id: 'a1', empresa_id: 'local', numero_animal: '1', identificacao_normalizada: '1', marca: 'ALFA', raca: 'Nelore', sexo: 'M', situacao: 'Ativo', created_at: TS, updated_at: TS, deleted_at: null });
  await legacy.table('animalIdentificadores').add({ id: 'i1', animal_id: 'a1', tipo: 'visual_marca', valor: '1', valor_normalizado: '1::ALFA', marca: 'ALFA', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
  await legacy.table('pesagens').add({ id: 'p1', data_pesagem: '2026-01-05', peso_kg: 200, animal_id: 'a1', sessao_id: 's1', tipo_pesagem: 'Cadastro', legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'ALFA', peso: 200, status_animal: 'Ativo' }, created_at: TS, updated_at: TS, deleted_at: null });
  legacy.close();

  const files = makeFilesPort();
  const seen = {};
  const result = await coordinator.openWithMigration({
    files,
    hooks: {
      beforeOpen: async () => {
        const probe = await openDynamic();
        try {
          seen.verno = probe.verno;
          seen.v7 = (await readMigrationState(probe, 7))?.status;
          seen.v8 = (await readMigrationState(probe, 8))?.status;
        } finally {
          probe.close();
        }
      },
    },
  });
  assert.deepEqual(seen, { verno: 6, v7: 'PENDENTE', v8: 'PENDENTE' }, 'v6: v7 e v8 PENDENTE antes de abrir');
  assert.equal(result.blocked, false, JSON.stringify(result.error));
  assert.equal(result.states[7].status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(result.states[8].status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(result.states[7].origem, 'upgrade-v6');
  assert.equal(result.states[8].origem, 'upgrade-v6');
  assert.equal(result.states[7].backup.sha256, result.states[8].backup.sha256, 'um único backup pré-migração para a cadeia');
  assert.ok(result.states[7].finished_at <= result.states[8].started_at, 'v7 conclui antes de a v8 começar');
  assert.equal(files.written.filter((file) => file.subdir === 'backups').length, 1);
  const backup = JSON.parse(files.written.find((file) => file.subdir === 'backups').content);
  assert.equal(backup.formatVersion, 2, 'backup no formato da v6');
  assert.equal(backup.manifest.dbVersion, 6);
  const db = await ensureStorageReady();
  const animal = await db.table('animais').where('id').equals('a1').first();
  assert.ok(animal.marca_id && animal.situacao === 'ATIVO', 'backfill v7 converteu o animal');
  assert.equal(await db.table('causasMorte').count(), 1, 'backfill v7 migrou o catálogo legado');
  assert.equal(await db.table('categoriasAnimal').count(), CATEGORIAS_SEED.length, 'cadeia v6 → v8: seeds da v7 mais o pré-cadastro completado pelo S2');
  for (const name of SANITY_STORES) assert.equal(await db.table(name).count(), 0);
  const history = (await db.table('backupHistory').toArray()).map((item) => item.tipo);
  assert.deepEqual(history, ['pre-migration', 'migration-v7', 'migration-v8', 'migration-v9'], `ordem da cadeia no histórico (${history.join(',')})`);
  assert.deepEqual((await logicalIntegrity()).issues, []);
  summary.casos.push({ caso: 'cadeia-v6-v8' });
}

// ---------------------------------------------------------------------------
// Caso G — backup v8 → restore; versão futura recusada; stores da v5 ignoradas.
// ---------------------------------------------------------------------------
{
  await deleteDbForTests();
  clearWriteBlock();
  setActorProvider(null);
  await coordinator.openWithMigration({ files: null });
  const db = await ensureStorageReady();
  const weighingService = await import('../src/modules/weighing/application/weighingService.js');
  const programa = await sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' });
  const medicamento = await sanity.saveMedicamento({ nome: 'Vacina', unidade_padrao: 'dose' });
  const lancamento = await weighingService.createEntry({ empresa_id: 'local', tipo_manejo: 'Cadastro', numero_animal: '77', marca: 'ALFA', sexo: 'M', data_pesagem: '2026-09-05', peso: 250, aplicacoes_sanidade: [{ programa_sanidade_id: programa.id, medicamento_id: medicamento.id, dose: 1 }] });
  const avulsa = await sanity.registerApplication({ animal_id: lancamento.animal_id, data: '2026-09-06', medicamento_id: medicamento.id });
  const strip = ({ localId: _localId, ...rest }) => rest;
  const expected = {};
  for (const name of SANITY_STORES) expected[name] = (await db.table(name).toArray()).map(strip);

  const { backup } = await storage.createFullBackup();
  assert.equal(backup.manifest.dbVersion, DB_VERSION);
  assert.equal(backup.formatVersion, 3, 'backup vigente continua no formato 3');
  const dry = await storage.dryRunRestore(backup);
  assert.equal(dry.schemaUpgradeRequired, false);
  assert.deepEqual(dry.newStores, []);

  await sanity.cancelApplication(avulsa.id, { motivo: 'depois do backup' });
  await sanity.saveProgram({ nome: 'Criado depois do backup', tipo: 'OUTRO' });
  const restored = await storage.applyRestore(backup, { safetyEvidence });
  assert.equal(restored.backfill, null, 'backup da própria versão não roda backfill');
  for (const name of SANITY_STORES) assert.deepEqual((await db.table(name).toArray()).map(strip), expected[name], `restore do backup v8 preserva ${name}`);

  const futuro = structuredClone(backup);
  futuro.manifest.dbVersion = DB_VERSION + 1;
  delete futuro.integrity;
  await assert.rejects(storage.dryRunRestore(futuro), (err) => err.code === 'DEXIE_BACKUP_005', 'backup de versão futura recusado');

  const comLegadoV5 = structuredClone(backup);
  comLegadoV5.stores.configuracoesSanidade = [{ id: 'v5', nome: 'Legada', tipo: 'Vacina' }];
  comLegadoV5.stores.sanidadesAnimal = [{ id: 'v5-app', animal_id: 'x' }];
  delete comLegadoV5.integrity;
  const dryV5 = await storage.dryRunRestore(comLegadoV5);
  assert.deepEqual([...dryV5.ignoredStores].sort(), ['configuracoesSanidade', 'sanidadesAnimal'], 'stores de sanidade da v5 são ignoradas');
  await storage.applyRestore(comLegadoV5, { safetyEvidence });
  const names = db.tables.map((table) => table.name);
  assert.ok(!names.includes('configuracoesSanidade') && !names.includes('sanidadesAnimal'), 'stores da v5 não voltam');
  for (const name of SANITY_STORES) assert.deepEqual((await db.table(name).toArray()).map(strip), expected[name], `linhas da v5 não entram em ${name}`);
  summary.casos.push({ caso: 'backup-v8-restore', aplicacoes: expected.aplicacoesSanidade.length });
}

await deleteDbForTests();
clearWriteBlock();
console.log(JSON.stringify({
  gate: 'migration:v8:verify',
  ok: true,
  targetVersion: DB_VERSION,
  chain: coordinator.MIGRATION_CHAIN,
  v8Steps: V8_STEPS,
  negativeTests: ['falha injetada no S1 bloqueia escrita', 'reabrir com FALHOU continua bloqueado', 'porta de arquivos falha', 'tamanho/SHA divergente', 'sem porta de arquivos', 'dry-run de versão desconhecida', 'backup de versão futura', 'stores da v5 no backup'],
  ...summary,
}, null, 2));
