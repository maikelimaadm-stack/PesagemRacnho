// Gate migration:v7:verify (docs/arquitetura-produto/14-MIGRACOES.md §8; ADR-038).
// Fixture v6 criada com Dexie + STORES_V6 (chaves legadas de appSettings, marcas em
// texto com um caso de colisão, identificadores visual_marca, sessões "Aberta",
// loteApartacoes com `fechado`, `lotes` vazia). Porta de arquivos falsa captura o
// backup pré-migração. Casos: migração completa (contagens, ids, payload limpo,
// enums, lotes removida, chaves legadas, relatório, idempotência), reentrância
// (interromper por lote e continuar sem duplicar, fechando/reabrindo o banco),
// falha injetada (FALHOU → escrita bloqueada → retomada), bloqueio quando a porta
// de arquivos falha ou corrompe, bloqueio sem porta, bloqueio com `lotes`
// preenchida, banco novo (seeds) e, opcionalmente, massa 36k (MIGRATION_36K=1).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import Dexie from 'dexie';
import {
  ANIMAL_SITUACOES, DB_NAME, DB_VERSION, IDENTIFICADOR_TIPOS, LOTE_SITUACOES, SESSAO_STATUS, STORES_V6,
} from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests, ensureStorageReady, resetDbForTests } from '../src/storage/indexedDb/db.js';
import * as coordinator from '../src/storage/migrations/migrationCoordinator.js';
import { MIGRATION_STATUS, clearWriteBlock, isWriteBlocked, readMigrationState } from '../src/storage/migrations/migrationState.js';
import { BATCH_SIZE, V7_STEPS } from '../src/storage/migrations/v7Backfill.js';
import { SESSION_OPERATOR_FIELD, normalizeName } from '../src/storage/indexedDb/normalize.js';
import { LEGACY_PAYLOAD_FORBIDDEN } from '../src/modules/weighing/domain/weighingMapper.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import storage from '../src/storage/storageAdapter.js';

const TS = '2026-01-10T12:00:00.000Z';

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

const forbiddenIn = (payload) => LEGACY_PAYLOAD_FORBIDDEN.filter((key) => payload && key in payload);

function v6Animal({ id, numero, marca, raca = 'Nelore', era = '12', situacao = 'Ativo', motivo = null, saida = null }) {
  return {
    id, empresa_id: 'local', identificacao_normalizada: numero.toUpperCase(), numero_animal: numero, nome: null, sexo: 'M',
    raca, era, marca, situacao, data_saida: saida, motivo_saida: motivo, ultima_pesagem_data: '2026-01-05', ultimo_peso_kg: 200,
    lote_atual_id: null, apartacao_atual_id: null, created_at: TS, updated_at: TS, deleted_at: null,
  };
}
function v6Identifier(animal) {
  return {
    id: `ident-${animal.id}`, animal_id: animal.id, tipo: 'visual_marca', valor: animal.numero_animal,
    valor_normalizado: `${animal.numero_animal.toUpperCase()}::${String(animal.marca).trim().toUpperCase()}`, marca: animal.marca,
    principal: true, ativo: true, created_at: TS, updated_at: TS, deleted_at: null,
  };
}
function v6Weighing(animal, sessionId, extra = {}) {
  const ui = {
    id: `pes-${animal.id}`, empresa_id: 'local', tipo_manejo: 'Cadastro', motivo_saida: null, status_animal: 'Ativo',
    data_pesagem: '2026-01-05', animal_id: animal.id, sessao_id: sessionId, numero_animal: animal.numero_animal, sexo: 'M',
    raca: animal.raca, era: animal.era, marca: animal.marca, peso: 200, observacao: null, origem: 'legado', operador: 'LOCAL',
    created_date: TS, updated_date: TS, _localId: 1, peso_kg: 200, ...extra,
  };
  return {
    id: ui.id, data_pesagem: ui.data_pesagem, peso_kg: 200, lote_id: null, animal_id: animal.id, sessao_id: sessionId,
    tipo_pesagem: 'Cadastro', observacao: null, legacy_payload: ui, created_at: TS, updated_at: TS, deleted_at: null,
  };
}

const FIXTURE_ANIMALS = [
  v6Animal({ id: 'a1', numero: '1', marca: 'ALFA', era: '12' }),
  v6Animal({ id: 'a2', numero: '2', marca: 'alfa', raca: 'nelore', era: 'x' }),           // grafia diferente, número distinto → funde
  v6Animal({ id: 'a3', numero: '10', marca: 'BETA', situacao: 'Inativo', motivo: 'Venda', saida: '2026-01-06' }),
  v6Animal({ id: 'a4', numero: '11', marca: 'BETA', situacao: 'Inativo', motivo: null, saida: '2026-01-06' }), // sem motivo → INATIVO
  v6Animal({ id: 'a5', numero: '7', marca: 'GAMA' }),
  v6Animal({ id: 'a6', numero: '7', marca: 'gama' }),                                        // colisão: mesmo número, animais distintos
  v6Animal({ id: 'a7', numero: '3', marca: 'ALFA', raca: 'Angus', situacao: 'Inativo', motivo: 'Morte', saida: '2026-01-07' }),
];

async function seedV6Fixture({ lotesRows = [], animals = FIXTURE_ANIMALS, withLegacySettings = true } = {}) {
  await deleteDbForTests();
  clearWriteBlock();
  const legacy = new Dexie(DB_NAME);
  legacy.version(6).stores(STORES_V6);
  await legacy.open();
  if (withLegacySettings) {
    await legacy.table('appSettings').bulkPut([
      { key: 'cadastros-auxiliares:comerciais:local', value: {
        compradores: [{ id: 'comp-1', nome: 'Comprador Um', documento: '123.456.789-01', telefone: '11 9999', cidade: 'Cuiabá', ativo: true }],
        vendedores: [{ id: 'vend-1', nome: 'Vendedor Um', documento: '12.345.678/0001-90', propriedade: 'Fazenda Boa Vista', ativo: true }],
        frigorificos: [{ id: 'frig-1', nome: 'Frigorífico Norte', documento: '', sif: 'SIF 123', ativo: true }],
      } },
      { key: 'cadastros-auxiliares:mortalidade:local', value: { causasMorte: [
        { id: 'causa-1', nome: 'Acidente', categoria: 'Acidente', exigeObservacao: false, ativo: true },
        { id: 'causa-2', nome: 'Doença', categoria: 'Doença', exigeObservacao: true, ativo: true },
      ] } },
      { key: 'cadastros-auxiliares:sanidade:local', value: { programasSanidade: [{ id: 'ps-1', nome: 'Vermifugação' }], medicamentos: [] } },
      { key: 'perfis-saida:local', value: { compradores: [{ id: 'comp-1', nome: 'Comprador Um' }, { id: 'comp-2', nome: 'comprador dois' }], venda: [{ id: 'v1', nome: 'Perfil venda' }], abate: [] } },
      { key: 'resumo-personalizado:local', value: { versao: 1, itens: [] } },
    ]);
  }
  const sessions = [
    { id: 's1', data: '2026-01-05', status: 'Aberta', operador: 'LOCAL', inicio: TS, created_at: TS, updated_at: TS, deleted_at: null },
    { id: 's2', data: '2026-01-06', status: 'Aberta', operador: 'LOCAL', inicio: TS, created_at: TS, updated_at: TS, deleted_at: null },
    { id: 's3', data: '2026-01-07', status: 'Fechada', operador: 'LOCAL', inicio: TS, fim: TS, created_at: TS, updated_at: TS, deleted_at: null },
  ];
  await legacy.table('sessoesPesagem').bulkAdd(sessions);
  await legacy.table('apartacoes').add({ id: 'ap1', empresa_id: 'local', nome_apartacao: 'Recria', created_at: TS, updated_at: TS, deleted_at: null });
  await legacy.table('loteApartacoes').bulkAdd([
    { id: 'lt1', empresa_id: 'local', apartacao_id: 'ap1', nome_lote: 'Leves', fechado: false, created_at: TS, updated_at: TS, deleted_at: null },
    { id: 'lt2', empresa_id: 'local', apartacao_id: 'ap1', nome_lote: 'Pesados', fechado: true, created_at: TS, updated_at: TS, deleted_at: null },
  ]);
  await legacy.table('animais').bulkAdd(animals);
  await legacy.table('animalIdentificadores').bulkAdd(animals.map(v6Identifier));
  const weighings = animals.map((animal, index) => v6Weighing(animal, index === 0 ? 's1' : 's2', index === 1 ? { sanidade_ids: ['x'] } : {}));
  // Uma pesagem com legacy_payload serializado em string (formato antigo).
  if (weighings.length > 2) weighings[2] = { ...weighings[2], legacy_payload: JSON.stringify(weighings[2].legacy_payload) };
  await legacy.table('pesagens').bulkAdd(weighings);
  if (lotesRows.length) await legacy.table('lotes').bulkAdd(lotesRows);
  legacy.close();
}

async function expectDbStillV6() {
  const inspection = await coordinator.inspectDatabase();
  assert.equal(inspection.currentVersion, 6, 'banco deve continuar na v6');
  assert.ok(inspection.stores.includes('lotes'), 'store lotes ainda existe na v6');
  const probe = new Dexie(DB_NAME);
  await probe.open();
  assert.equal(probe.verno, 6);
  probe.close();
}

const summary = { casos: [] };

// ---------------------------------------------------------------------------
// Caso A — migração completa v6 → v7
// ---------------------------------------------------------------------------
{
  await seedV6Fixture();
  const before = await coordinator.inspectDatabase();
  assert.deepEqual({ exists: before.exists, currentVersion: before.currentVersion, needsMigration: before.needsMigration, blockers: before.blockers }, { exists: true, currentVersion: 6, needsMigration: true, blockers: [] });

  const files = makeFilesPort();
  const progress = [];
  const result = await coordinator.openWithMigration({ files, onProgress: (p) => progress.push(p) });
  assert.equal(result.migrated, true);
  assert.equal(result.blocked, false, `migração bloqueada: ${JSON.stringify(result.error)}`);
  assert.equal(result.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(isWriteBlocked(), false);
  assert.ok(progress.length > 0 && progress.every((p) => V7_STEPS.includes(p.passo)), 'onProgress recebe passos B1..B12');

  // Backup pré-migração: nome, subdir, formato da versão de origem, validado por tamanho e SHA-256.
  const backupFile = files.written.find((f) => f.subdir === 'backups');
  assert.ok(backupFile, 'backup pré-migração gravado em backups/');
  assert.match(backupFile.filename, /^pre-migration-v7-\d{8}-\d{6}\.json$/);
  const backupJson = JSON.parse(backupFile.content);
  assert.equal(backupJson.formatVersion, 2, 'backup pré-migração no formato da versão de origem');
  assert.equal(backupJson.manifest.dbVersion, 6);
  assert.ok(Array.isArray(backupJson.stores.lotes), 'backup pré-migração contém a store lotes da v6');
  assert.equal(backupJson.stores.animais.length, FIXTURE_ANIMALS.length);
  assert.equal(result.state.backup.sha256, backupFile.sha256);
  assert.equal(result.state.backup.size, backupFile.size);
  assert.match(result.state.backup.path, /pre-migration-v7-/);

  const db = await ensureStorageReady();
  assert.equal(db.verno, DB_VERSION);
  assert.ok(!db.tables.map((t) => t.name).includes('lotes'), 'store lotes removida na v7');

  // B1 marcas: ALFA/alfa fundidas; GAMA/gama mantidas separadas (colisão do número 7).
  const marcas = await db.table('marcas').toArray();
  assert.equal(marcas.length, 4, `marcas criadas (${marcas.map((m) => m.nome).join(', ')})`);
  const alfa = marcas.filter((m) => m.nome_normalizado === 'ALFA');
  assert.equal(alfa.length, 1, 'grafias sem colisão são fundidas');
  assert.equal(marcas.filter((m) => normalizeName(m.nome) === 'GAMA').length, 2, 'grafias em colisão viram marcas separadas');
  assert.equal(marcas.filter((m) => m.padrao === true).length, 1, 'uma marca padrão');
  assert.equal(result.state.relatorio.colisoesMarca.length, 1);
  assert.equal(result.state.relatorio.colisoesMarca[0].nome_normalizado, 'GAMA');
  assert.deepEqual(result.state.relatorio.colisoesMarca[0].numeros.map((n) => n.numero), ['7']);
  assert.equal(result.state.relatorio.marcas, 4);

  const animais = await db.table('animais').toArray();
  const byId = new Map(animais.map((a) => [a.id, a]));
  assert.equal(byId.get('a1').marca_id, byId.get('a2').marca_id, 'ALFA e alfa apontam para a mesma marca');
  assert.equal(byId.get('a1').marca_id, alfa[0].id);
  assert.notEqual(byId.get('a5').marca_id, byId.get('a6').marca_id, 'GAMA e gama não são fundidas');
  assert.ok(animais.every((a) => a.marca_id), 'todo animal recebeu marca_id');
  assert.ok(animais.every((a) => a.propriedade_id), 'todo animal recebeu propriedade_id (PROPRIA padrão)');
  assert.ok(animais.every((a) => ANIMAL_SITUACOES.includes(a.situacao)), 'situacao dentro do enum');
  assert.equal(byId.get('a1').situacao, 'ATIVO');
  assert.equal(byId.get('a3').situacao, 'VENDIDO');
  assert.equal(byId.get('a4').situacao, 'INATIVO', 'saída sem motivo mapeável → INATIVO');
  assert.equal(byId.get('a7').situacao, 'MORTO');
  assert.equal(result.state.relatorio.saidasSemMotivo, 1);
  // 16/09/2026: nascimento não é usado — a migração nunca o estima a partir da era.
  assert.ok(animais.every((a) => a.nascimento === null && a.nascimento_estimado === false), 'nascimento fica vazio em todo animal migrado');
  assert.equal(byId.get('a1').era, '12', 'era legada preservada');
  assert.ok(animais.every((a) => a.categoria_automatica === true), 'animais migrados entram na categoria automática (pelo peso)');
  assert.equal(byId.get('a1').marca, 'ALFA', 'texto legado preservado');
  assert.equal(result.state.relatorio.animaisAtualizados, FIXTURE_ANIMALS.length);

  // B2 raças: Nelore/nelore fundidas, Angus, Nelore padrão.
  const racas = await db.table('racas').toArray();
  assert.deepEqual(racas.map((r) => r.nome_normalizado).sort(), ['ANGUS', 'NELORE']);
  assert.equal(racas.find((r) => r.padrao)?.nome, 'Nelore');
  assert.equal(byId.get('a2').raca_id, racas.find((r) => r.nome_normalizado === 'NELORE').id);
  assert.equal(byId.get('a7').raca_id, racas.find((r) => r.nome_normalizado === 'ANGUS').id);

  // B3 categorias (seed, ids gerados), B4 causas (ids preservados), B5 parceiros, B6 propriedades.
  const categorias = await db.table('categoriasAnimal').toArray();
  assert.deepEqual(categorias.map((c) => c.nome), ['Bezerro', 'Bezerra', 'Garrote', 'Novilha', 'Boi', 'Vaca', 'Touro']);
  assert.ok(categorias.every((c) => /^[0-9a-f-]{36}$/.test(c.id)), 'ids das categorias são UUID gerados');
  const causas = await db.table('causasMorte').toArray();
  assert.deepEqual(causas.map((c) => c.id).sort(), ['causa-1', 'causa-2'], 'ids das causas preservados');
  assert.equal(causas.find((c) => c.id === 'causa-2').exige_observacao, true);
  const parceiros = await db.table('parceiros').toArray();
  assert.equal(parceiros.length, 4, `parceiros (${parceiros.map((p) => p.nome).join(', ')})`);
  const compradorUm = parceiros.find((p) => p.id === 'comp-1');
  assert.ok(compradorUm, 'id do registry preservado');
  assert.deepEqual(compradorUm.papeis, ['COMPRADOR']);
  assert.equal(compradorUm.documento, '12345678901');
  assert.equal(compradorUm.tipo_pessoa, 'FISICA');
  assert.equal(parceiros.find((p) => p.id === 'vend-1').tipo_pessoa, 'JURIDICA');
  assert.equal(parceiros.find((p) => p.id === 'frig-1').registro_sif, 'SIF 123');
  assert.ok(parceiros.find((p) => p.id === 'comp-2'), 'comprador só de perfis-saida migrado');
  assert.ok(parceiros.every((p) => p.rendimento_padrao === null), 'rendimento nunca assumido (ADR-025)');
  const propriedades = await db.table('propriedades').toArray();
  assert.equal(propriedades.filter((p) => p.tipo === 'PROPRIA' && p.padrao).length, 1);
  const terceiro = propriedades.find((p) => p.tipo === 'TERCEIRO');
  assert.equal(terceiro?.nome, 'Fazenda Boa Vista');
  assert.equal(terceiro?.parceiro_id, 'vend-1');

  // B8 identificadores: VISUAL, só número, marca_id do animal.
  const identificadores = await db.table('animalIdentificadores').toArray();
  assert.ok(identificadores.every((i) => i.tipo === 'VISUAL' && IDENTIFICADOR_TIPOS.includes(i.tipo)), 'tipo VISUAL');
  assert.ok(identificadores.every((i) => !String(i.valor_normalizado).includes('::')), 'valor_normalizado sem ::MARCA');
  assert.ok(identificadores.every((i) => i.marca_id === byId.get(i.animal_id).marca_id), 'marca_id do identificador = do animal');
  assert.ok(identificadores.every((i) => i.inicio === '2026-01-10' && i.fim === null), 'inicio = data de created_at');
  assert.equal(result.state.relatorio.identificadores, FIXTURE_ANIMALS.length);

  // B9 enums.
  const sessoes = await db.table('sessoesPesagem').toArray();
  assert.deepEqual(sessoes.map((s) => s.status).sort(), ['ABERTA', 'ABERTA', 'FECHADA']);
  // Nome do campo conforme o esquema vigente (rev. 2: operador_usuario_id).
  assert.ok(sessoes.every((s) => SESSAO_STATUS.includes(s.status) && s.local === null && s[SESSION_OPERATOR_FIELD] === null));
  assert.ok(sessoes.every((s) => s.operador_user_id === undefined), 'campo da rev. 1 não sobrevive à migração');
  const lotes = await db.table('loteApartacoes').toArray();
  assert.deepEqual(lotes.map((l) => l.situacao).sort(), ['ABERTO', 'FECHADO']);
  assert.ok(lotes.every((l) => LOTE_SITUACOES.includes(l.situacao) && l.ativo === true));
  assert.ok((await db.table('apartacoes').toArray()).every((a) => a.ativo === true));

  // B10 payload limpo (inclusive o snapshot que era string JSON).
  const pesagens = await db.table('pesagens').toArray();
  for (const row of pesagens) {
    assert.equal(typeof row.legacy_payload, 'object', `payload de ${row.id} é objeto`);
    assert.deepEqual(forbiddenIn(row.legacy_payload), [], `payload de ${row.id} sem chaves proibidas`);
    assert.equal(row.legacy_payload.marca, byId.get(row.animal_id).marca, 'snapshot histórico da marca preservado');
  }

  // B11 chaves legadas removidas; configuração real preservada; sanidade exportada antes.
  const keys = (await db.table('appSettings').toArray()).map((r) => r.key);
  assert.ok(!keys.some((k) => /^cadastros-auxiliares:|^perfis-saida:/.test(k)), 'chaves legadas removidas');
  assert.ok(keys.includes('resumo-personalizado:local'), 'configuração real preservada');
  assert.ok(keys.includes('migration:v7'));
  const sanidadeFile = files.written.find((f) => f.subdir === 'exports');
  assert.ok(sanidadeFile && /^sanidade-export-.*\.json$/.test(sanidadeFile.filename), 'sanidade exportada em exports/');
  assert.equal(JSON.parse(sanidadeFile.content).chaves['cadastros-auxiliares:sanidade:local'].programasSanidade[0].id, 'ps-1');
  assert.equal(result.state.relatorio.sanidade.exportado, true);
  assert.equal(result.state.relatorio.chavesLegadasRemovidas.length, 4);

  // B12 verificação + histórico + integridade com o contrato v7 ativo.
  assert.equal(result.state.relatorio.integridade.ok, true, JSON.stringify(result.state.relatorio.integridade));
  const history = (await db.table('backupHistory').toArray()).map((h) => h.tipo);
  assert.ok(history.includes('pre-migration') && history.includes('migration-v7'), `backupHistory: ${history.join(',')}`);
  const integrity = await logicalIntegrity();
  assert.equal(integrity.v7Contract, true, 'contrato v7 ativo após CONCLUIDA');
  assert.deepEqual(integrity.issues, []);

  // Idempotência: nova abertura não duplica nada.
  resetDbForTests();
  const again = await coordinator.openWithMigration({ files: makeFilesPort() });
  assert.equal(again.migrated, false);
  assert.equal(again.state.status, MIGRATION_STATUS.CONCLUIDA);
  const db2 = await ensureStorageReady();
  assert.equal(await db2.table('marcas').count(), 4);
  assert.equal(await db2.table('categoriasAnimal').count(), 7);
  assert.equal(await db2.table('parceiros').count(), 4);
  const dry = await coordinator.dryRunBackfill();
  assert.equal(dry.pendente, false);
  assert.equal(dry.marcas.novas, 0);
  assert.equal(dry.animais.pendentes, 0);
  const inspection = await coordinator.inspectDatabase();
  assert.equal(inspection.currentVersion, DB_VERSION);
  assert.equal(inspection.needsMigration, false);
  summary.casos.push({ caso: 'migracao-completa', marcas: 4, colisoes: 1, parceiros: 4, animais: FIXTURE_ANIMALS.length });
}

// ---------------------------------------------------------------------------
// Caso B — reentrância: lotes de 500 por cursor, interrupção por chamada e
// fechamento/reabertura do banco entre chamadas, sem duplicar.
// ---------------------------------------------------------------------------
{
  const many = [];
  for (let i = 0; i < 1100; i += 1) {
    many.push(v6Animal({ id: `m${i}`, numero: String(1000 + i), marca: i % 2 ? 'BETA' : 'ALFA', raca: i % 3 ? 'Nelore' : 'Angus' }));
  }
  await seedV6Fixture({ animals: many, withLegacySettings: false });
  const files = makeFilesPort();
  const prepared = await coordinator.prepareMigration({ files });
  assert.ok(prepared?.sha256, 'prepareMigration devolve o backup validado');
  await ensureStorageReady(); // abre na v7 (upgrade estrutural) sem rodar o backfill
  const dry = await coordinator.dryRunBackfill();
  assert.equal(dry.pendente, true);
  assert.equal(dry.marcas.novas, 2);
  assert.equal(dry.animais.pendentes, 1100);
  assert.equal(dry.identificadores.pendentes, 1100);
  assert.equal(dry.pesagens.payloadsPendentes, 1100);
  assert.equal(await (await ensureStorageReady()).table('marcas').count(), 0, 'dry-run não grava');

  let calls = 0;
  let interruptedMidCursor = 0;
  let completed = false;
  const checkpoints = [];
  while (!completed) {
    const result = await coordinator.runPendingBackfills({ files, maxBatches: 1 });
    calls += 1;
    completed = result.completed;
    if (!completed) {
      assert.equal(result.state.status, MIGRATION_STATUS.EM_ANDAMENTO);
      assert.match(result.state.last_checkpoint, /^B\d+:(localId=\d+|done)$/);
      if (/localId=/.test(result.state.last_checkpoint)) interruptedMidCursor += 1;
      checkpoints.push(result.state.last_checkpoint);
      // Simula fechar e reabrir o app: o checkpoint precisa vir do banco.
      resetDbForTests();
      const reopened = await readMigrationState(await ensureStorageReady(), 7);
      assert.equal(reopened.last_checkpoint, result.state.last_checkpoint, 'checkpoint persistido no banco');
    }
    assert.ok(calls < 100, 'backfill deve terminar');
  }
  assert.ok(calls >= V7_STEPS.length, `várias chamadas até concluir (${calls})`);
  assert.ok(interruptedMidCursor >= 4, `interrompido no meio de passos por cursor (${interruptedMidCursor}; lote=${BATCH_SIZE})`);
  const db = await ensureStorageReady();
  const state = await readMigrationState(db, 7);
  assert.equal(state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(state.processed, state.total);
  assert.equal(await db.table('marcas').count(), 2, 'marcas não duplicadas após retomadas');
  assert.equal(await db.table('racas').count(), 2);
  assert.equal(await db.table('categoriasAnimal').count(), 7);
  assert.equal(await db.table('propriedades').count(), 1);
  assert.equal(state.relatorio.animaisAtualizados, 1100, 'cada animal contado uma única vez');
  assert.equal(state.relatorio.identificadores, 1100);
  const animais = await db.table('animais').toArray();
  assert.ok(animais.every((a) => a.marca_id && a.raca_id && a.situacao === 'ATIVO'));
  assert.ok((await db.table('animalIdentificadores').toArray()).every((i) => i.tipo === 'VISUAL' && !String(i.valor_normalizado).includes('::')));
  assert.ok((await db.table('pesagens').toArray()).every((row) => forbiddenIn(row.legacy_payload).length === 0));
  assert.deepEqual((await logicalIntegrity()).issues, []);
  summary.casos.push({ caso: 'reentrancia', chamadas: calls, interrupcoesNoMeioDoCursor: interruptedMidCursor, animais: 1100 });
}

// ---------------------------------------------------------------------------
// Caso C — falha injetada: FALHOU, escrita bloqueada, diagnóstico, retomada manual.
// ---------------------------------------------------------------------------
{
  await seedV6Fixture();
  const files = makeFilesPort();
  const result = await coordinator.openWithMigration({ files, hooks: { beforeStep: (step) => { if (step === 'B8') throw new Error('falha injetada em B8'); } } });
  assert.equal(result.blocked, true, 'falha no backfill devolve blocked=true (app abre somente leitura)');
  assert.equal(result.state.status, MIGRATION_STATUS.FALHOU);
  assert.equal(result.state.error.passo, 'B8');
  assert.match(result.state.error.message, /falha injetada/);
  assert.ok(result.state.backup?.sha256, 'backup pré-migração preservado no estado');
  assert.equal(isWriteBlocked(), true);
  await assert.rejects(storage.animais.create({ id: 'novo', numero_animal: '99' }), (err) => err.code === 'MIGRATION_BLOCKED', 'repositório bloqueado');
  await assert.rejects(storage.settings.set('x', 1), (err) => err.code === 'MIGRATION_BLOCKED', 'configuração bloqueada');
  const weighingService = await import('../src/modules/weighing/application/weighingService.js');
  await assert.rejects(weighingService.createEntry({ tipo_manejo: 'Manejo', numero_animal: '1', marca: 'ALFA', data_pesagem: '2026-02-01', peso: 210 }), /bloqueada/i, 'lançamento bloqueado');
  const db = await ensureStorageReady();
  assert.equal(await db.table('marcas').count(), 4, 'passos anteriores à falha ficaram gravados');
  const diag = await coordinator.getMigrationState();
  assert.equal(diag.blocked, true);
  assert.equal(diag.state.status, MIGRATION_STATUS.FALHOU);

  // Reabrir o app com o estado FALHOU continua bloqueado (retomada é manual).
  resetDbForTests();
  const reopened = await coordinator.openWithMigration({ files });
  assert.equal(reopened.blocked, true);
  assert.equal(reopened.state.status, MIGRATION_STATUS.FALHOU);

  // "Continuar migração": conclui do checkpoint sem duplicar.
  const resumed = await coordinator.runPendingBackfills({ files });
  assert.equal(resumed.completed, true);
  assert.equal(resumed.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(resumed.state.error, null);
  assert.equal(isWriteBlocked(), false);
  const db2 = await ensureStorageReady();
  assert.equal(await db2.table('marcas').count(), 4, 'sem duplicar após retomada');
  assert.equal(await db2.table('parceiros').count(), 4);
  assert.ok((await db2.table('animalIdentificadores').toArray()).every((i) => i.tipo === 'VISUAL'));
  const created = await storage.animais.create({ id: 'novo', numero_animal: '99', identificacao_normalizada: '99', situacao: 'ATIVO', marca_id: (await db2.table('marcas').toArray())[0].id });
  assert.ok(created.localId, 'escrita liberada após concluir');
  summary.casos.push({ caso: 'falha-e-retomada', passoFalho: 'B8' });
}

// ---------------------------------------------------------------------------
// Caso D — bloqueio quando o backup pré-migração falha (fail closed).
// ---------------------------------------------------------------------------
{
  await seedV6Fixture();
  await assert.rejects(coordinator.openWithMigration({ files: makeFilesPort({ fail: true }) }), (err) => err.code === 'MIGRATION_BACKUP_FAILED');
  assert.equal(isWriteBlocked(), true);
  await expectDbStillV6();
  clearWriteBlock();
  await assert.rejects(coordinator.openWithMigration({ files: makeFilesPort({ corrupt: true }) }), (err) => err.code === 'MIGRATION_BACKUP_FAILED' && /SHA-256|tamanho/.test(err.message), 'tamanho/SHA divergentes bloqueiam');
  await expectDbStillV6();
  clearWriteBlock();
  await assert.rejects(coordinator.openWithMigration({ files: null }), (err) => err.code === 'MIGRATION_BACKUP_FAILED' && err.reason === 'NO_FILES_PORT', 'sem porta de arquivos bloqueia');
  await expectDbStillV6();
  clearWriteBlock();
  // Chave de desenvolvimento (nunca no pacote): libera sem backup e registra skipped.
  globalThis.localStorage = { getItem: (key) => (key === 'pesagens.dev.allowUnsafeMigration' ? '1' : null) };
  try {
    const dev = await coordinator.openWithMigration({ files: null });
    assert.equal(dev.migrated, true);
    assert.equal(dev.state.backup.skipped, true);
    assert.equal(dev.state.status, MIGRATION_STATUS.CONCLUIDA);
    assert.equal(dev.state.relatorio.sanidade.exportado, false, 'sem porta, sanidade não é exportada');
    assert.equal(dev.state.relatorio.sanidade.motivo, 'SEM_PORTA_DE_ARQUIVOS');
    const keys = (await (await ensureStorageReady()).table('appSettings').toArray()).map((r) => r.key);
    assert.ok(keys.includes('cadastros-auxiliares:sanidade:local'), 'chave de sanidade preservada quando não pôde ser exportada');
    assert.ok(!keys.includes('perfis-saida:local'), 'demais chaves legadas removidas');
  } finally {
    delete globalThis.localStorage;
  }
  summary.casos.push({ caso: 'backup-falha-bloqueia', variantes: ['porta falha', 'sha divergente', 'sem porta', 'chave dev'] });
}

// ---------------------------------------------------------------------------
// Caso E — bloqueio quando `lotes` tem registros.
// ---------------------------------------------------------------------------
{
  await seedV6Fixture({ lotesRows: [{ id: 'lote-legado', nome: 'Lote X', created_at: TS, updated_at: TS }] });
  const inspection = await coordinator.inspectDatabase();
  assert.equal(inspection.blockers[0]?.code, 'MIGRATION_BLOCKED_LOTES');
  const files = makeFilesPort();
  await assert.rejects(coordinator.openWithMigration({ files }), (err) => err.code === 'MIGRATION_BLOCKED_LOTES' && /lotes/.test(err.message));
  assert.equal(files.written.length, 0, 'nenhum backup é gerado quando há bloqueio prévio');
  assert.equal(isWriteBlocked(), true);
  await expectDbStillV6();
  clearWriteBlock();
  summary.casos.push({ caso: 'lotes-bloqueia' });
}

// ---------------------------------------------------------------------------
// Caso F — banco novo: sem backup, seeds criados, estado CONCLUIDA (origem fresh).
// ---------------------------------------------------------------------------
{
  await deleteDbForTests();
  clearWriteBlock();
  const files = makeFilesPort();
  const fresh = await coordinator.openWithMigration({ files });
  assert.equal(fresh.migrated, false);
  assert.equal(fresh.blocked, false);
  assert.equal(fresh.state.status, MIGRATION_STATUS.CONCLUIDA);
  assert.equal(fresh.state.origem, 'fresh');
  assert.equal(files.written.length, 0, 'banco novo não gera backup pré-migração');
  const db = await ensureStorageReady();
  assert.equal(await db.table('categoriasAnimal').count(), 7);
  assert.equal((await db.table('propriedades').toArray()).filter((p) => p.tipo === 'PROPRIA' && p.padrao).length, 1);
  assert.equal((await db.table('racas').toArray()).find((r) => r.padrao)?.nome, 'Nelore');
  assert.equal(await db.table('marcas').count(), 0, 'sem dados não há marcas');
  summary.casos.push({ caso: 'banco-novo', seeds: { categorias: 7, propriedades: 1, racas: 1 } });
}

// ---------------------------------------------------------------------------
// Caso G (opcional) — massa 36k v6 com tempo registrado.
// ---------------------------------------------------------------------------
if (process.env.MIGRATION_36K === '1') {
  const { generateTestMass, seedTestMass } = await import('../src/modules/perf/testMass.js');
  await deleteDbForTests();
  clearWriteBlock();
  const legacy = new Dexie(DB_NAME);
  legacy.version(6).stores(STORES_V6);
  await legacy.open();
  const mass = generateTestMass('36k', { schema: 'v6' });
  await seedTestMass(legacy, mass);
  legacy.close();
  const startedAt = performance.now();
  const result = await coordinator.openWithMigration({ files: makeFilesPort() });
  const elapsedMs = Math.round(performance.now() - startedAt);
  assert.equal(result.state.status, MIGRATION_STATUS.CONCLUIDA);
  const db = await ensureStorageReady();
  assert.equal(await db.table('animais').count(), mass.summary.animais);
  assert.equal((await db.table('animais').filter((a) => !a.marca_id).count()), 0, 'todos os animais com marca_id');
  assert.equal(await db.table('marcas').count(), 5);
  assert.equal(result.state.relatorio.colisoesMarca.length, 0);
  assert.deepEqual((await logicalIntegrity()).issues, []);
  summary.casos.push({ caso: 'massa-36k', pesagens: mass.summary.pesagens, animais: mass.summary.animais, tempoMs: elapsedMs });
  console.log(`[migration:v7] massa 36k migrada em ${elapsedMs} ms`);
}

await deleteDbForTests();
clearWriteBlock();

console.log('OK verify-v7-migration');
console.log(JSON.stringify({
  targetVersion: DB_VERSION,
  batchSize: BATCH_SIZE,
  steps: V7_STEPS,
  negativeTests: ['falha no backfill bloqueia escrita', 'porta de arquivos falha', 'SHA/tamanho divergentes', 'sem porta de arquivos', 'lotes com registros', 'dry-run não grava'],
  ...summary,
}, null, 2));
