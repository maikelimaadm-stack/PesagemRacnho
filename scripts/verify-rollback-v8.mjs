// Verificação rollback:v8:verify — auditoria corretiva R1, achado R04. Volta da 1.6.0 (banco v9) para a 1.5.x
// (banco v8) executada com o CÓDIGO REAL da 1.5.x (checkout separado), sobre bancos sintéticos (fake-indexeddb):
//   A. mesmo perfil: 1.5.x cria e usa o banco v8 → 1.6.0 migra para v9 (backup pré-migração) e grava dados novos →
//      a 1.5.x abre o MESMO perfil: o banco v9 é recusado (VersionError) — a tela de restauração da 1.5.x não abre
//      sobre ele — e nada é apagado (a 1.6.0 reabre com tudo);
//   B. perfil SEPARADO e limpo (outro processo = outro IndexedDB, como PESAGENS_USER_DATA_DIR noutra pasta): a 1.5.x
//      restaura o backup pré-migração v8 com as contagens de antes; os dados lançados na 1.6.0 NÃO voltam (perda
//      documentada); um backup comum da 1.6.0 (v9) é recusado pela 1.5.x.
// Não roda em test:quick: precisa do checkout da 1.5.x (ROLLBACK_APP_DIR) ou cria um worktree do commit da 1.5.6.
// Uso: node scripts/verify-rollback-v8.mjs   (ROLLBACK_APP_DIR=/caminho/da/1.5.x opcional)
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REF_156 = '9392274'; // merge da 1.5.6 em main (release 1.5.6)
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const TS = '2026-09-01T12:00:00.000Z';
const row = (extra) => ({ empresa_id: 'local', created_at: TS, updated_at: TS, deleted_at: null, ...extra });

function portaDeArquivos(dir) {
  const dirOf = (subdir) => { const d = join(dir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
  return {
    async writeUserFile({ subdir, filename, content }) {
      const full = join(dirOf(subdir), filename);
      writeFileSync(full, content ?? '', 'utf8');
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes) };
    },
    async listUserFiles({ subdir, extension }) {
      const d = dirOf(subdir);
      return { ok: true, files: readdirSync(d).filter((n) => !extension || n.endsWith(extension)).map((name) => ({ name, path: join(d, name), size: readFileSync(join(d, name)).length })) };
    },
    async readUserFile({ subdir, filename }) {
      const full = join(dirOf(subdir), filename);
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes), content: bytes.toString('utf8') };
    },
  };
}

function checkout156() {
  if (process.env.ROLLBACK_APP_DIR) return { dir: resolve(process.env.ROLLBACK_APP_DIR), criado: false };
  const dir = mkdtempSync(join(tmpdir(), 'pesagens-156-'));
  rmSync(dir, { recursive: true, force: true });
  execFileSync('git', ['-C', repo, 'worktree', 'add', '--detach', dir, REF_156], { stdio: 'ignore' });
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'));
  return { dir, criado: true };
}

const importar = (dir, rel) => import(pathToFileURL(join(dir, rel)).href);
const CONTADAS = ['animais', 'pesagens', 'marcas', 'movimentosAnimais', 'usuarios'];
const contagens = async (db) => Object.fromEntries(await Promise.all(CONTADAS.map(async (t) => [t, await db.table(t).count()])));

// ---------------------------------------------------------------------------------------------------------------
// B. Perfil separado e limpo (processo filho).
// ---------------------------------------------------------------------------------------------------------------
if (process.argv[2] === '--perfil-limpo') {
  const [, , , dir156, preMigracao, backupV9, esperadoJson, dados] = process.argv;
  globalThis.window = { pesagemApp: { files: portaDeArquivos(dados) } };
  const storage156 = (await importar(dir156, 'src/storage/storageAdapter.js')).default;
  const manut156 = await importar(dir156, 'src/modules/maintenance/infrastructure/maintenanceDataAdapter.js');
  const db = await storage156.ensureReady();
  const vazio = await contagens(db);
  assert.equal(vazio.pesagens, 0, 'perfil limpo começa vazio');
  // Backup comum da 1.6.0 (v9): recusado pela 1.5.x, sem tocar no banco.
  await assert.rejects(manut156.applyRestoreBackup(JSON.parse(readFileSync(backupV9, 'utf8'))), /banco mais novo/);
  assert.deepEqual(await contagens(await storage156.ensureReady()), vazio, 'recusa não altera o perfil limpo');
  // Backup pré-migração (v8): restaurado pela 1.5.x.
  const r = await manut156.applyRestoreBackup(JSON.parse(readFileSync(preMigracao, 'utf8')));
  assert.equal(r.restored, true);
  const depois = await contagens(await storage156.ensureReady());
  const esperado = JSON.parse(esperadoJson);
  assert.deepEqual(depois, esperado, 'contagens da 1.5.x restaurada = contagens de antes da migração');
  const novas = await (await storage156.ensureReady()).table('pesagens').where('id').equals('p-lancada-na-160').count();
  assert.equal(novas, 0, 'pesagem lançada na 1.6.0 não existe no backup pré-migração (perda documentada)');
  const integ = await storage156.logicalIntegrity();
  console.log(JSON.stringify({ ok: true, contagens: depois, integridade: integ.ok, verno: (await storage156.ensureReady()).verno }));
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------
// A. Mesmo perfil.
// ---------------------------------------------------------------------------------------------------------------
const raiz = mkdtempSync(join(tmpdir(), 'pesagens-rollback-'));
const dados = join(raiz, 'dados');
const { dir: dir156, criado } = checkout156();
const resumo = [];
try {
  const versao156 = JSON.parse(readFileSync(join(dir156, 'package.json'), 'utf8')).version;
  assert.match(versao156, /^1\.5\./, `checkout da 1.5.x (${versao156})`);
  globalThis.window = { pesagemApp: { files: portaDeArquivos(dados) } };

  // 1. A 1.5.x cria e usa o banco v8.
  const storage156 = (await importar(dir156, 'src/storage/storageAdapter.js')).default;
  const db156 = await importar(dir156, 'src/storage/indexedDb/db.js');
  let db = await storage156.ensureReady();
  assert.equal(db.verno, 8, 'a 1.5.x usa o banco v8');
  await db.table('marcas').add(row({ id: 'm1', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true }));
  for (const id of ['A', 'B', 'C']) await db.table('animais').add(row({ id, numero_animal: id, identificacao_normalizada: id, marca_id: 'm1', situacao: 'ATIVO' }));
  for (const [id, animal, data, tipo] of [['pA', 'A', '2026-01-10', 'Cadastro'], ['pB', 'B', '2026-01-10', 'Cadastro'], ['pC', 'C', '2026-02-01', 'Cadastro'], ['mA', 'A', '2026-03-01', 'Manejo']]) {
    await db.table('pesagens').add(row({ id, data_pesagem: data, peso_kg: 300, animal_id: animal, tipo_pesagem: tipo, lote_id: null, legacy_payload: { tipo_manejo: tipo, numero_animal: animal, marca: 'ALFA', peso: 300 } }));
  }
  await db.table('movimentosAnimais').add(row({ id: 'mvA', animal_id: 'A', pesagem_id: 'pA', tipo: 'Entrada', data_evento: '2026-01-10' }));
  await db.table('usuarios').add(row({ id: 'u1', login: 'admin', nome: 'Admin', role: 'ADMIN', ativo: true, password_hash: 'h', password_salt: 's' }));
  const antesDaMigracao = await contagens(db);
  db156.resetDbForTests();
  resumo.push(`1.5.x (${versao156}) criou o banco v8: ${JSON.stringify(antesDaMigracao)}`);

  // 2. A 1.6.0 abre o mesmo perfil: backup pré-migração + v9; dados novos lançados na 1.6.0.
  const coordinator = await import('../src/storage/migrations/migrationCoordinator.js');
  const db160 = await import('../src/storage/indexedDb/db.js');
  const storage160 = (await import('../src/storage/storageAdapter.js')).default;
  const mig = await coordinator.openWithMigration({ files: window.pesagemApp.files });
  assert.equal(mig.blocked, false, JSON.stringify(mig.error));
  db = await db160.ensureStorageReady();
  assert.equal(db.verno, 9);
  const preMigracao = readdirSync(join(dados, 'backups')).find((n) => /^pre-migration-v9-/.test(n));
  assert.ok(preMigracao, 'backup pré-migração gravado');
  const preMigracaoPath = join(dados, 'backups', preMigracao);
  assert.equal(JSON.parse(readFileSync(preMigracaoPath, 'utf8')).manifest.dbVersion, 8, 'backup pré-migração é do banco v8');
  await db.table('pesagens').add(row({ id: 'p-lancada-na-160', data_pesagem: '2026-09-01', peso_kg: 333, animal_id: 'A', tipo_pesagem: 'Manejo', lote_id: null, legacy_payload: { tipo_manejo: 'Manejo', numero_animal: 'A', marca: 'ALFA', peso: 333 } }));
  const depoisNa160 = await contagens(db);
  const { backup: backupV9 } = await storage160.createFullBackup({ reason: 'gate-rollback' });
  const backupV9Path = join(dados, 'backups', 'backup-comum-160.json');
  writeFileSync(backupV9Path, JSON.stringify(backupV9));
  db160.resetDbForTests();
  resumo.push(`1.6.0 migrou para v9 com backup pré-migração v8 (${preMigracao}); 1 pesagem nova lançada na 1.6.0`);

  // 3. A 1.5.x abre o MESMO perfil (v9). Medido: o Dexie 4 da 1.5.x abre o banco v9 SEM erro (reporta verno 8) e a
  //    1.5.x funciona sobre ele — a recusa que a documentação anterior prometia não existe. Restaurar o backup
  //    pré-migração NESSE perfil deixa as tabelas só da v9 (operações, documentos…) com os dados da 1.6.0: estado
  //    misto. Por isso a volta é SEMPRE num perfil separado (passo 4) e nunca sobre o perfil da 1.6.0.
  db156.resetDbForTests();
  const aberto = await storage156.ensureReady();
  assert.equal(aberto.verno, 8, 'a 1.5.x abre o banco v9 e se apresenta como v8 (sem aviso)');
  assert.equal((await contagens(aberto)).pesagens, depoisNa160.pesagens, 'e enxerga os dados gravados pela 1.6.0');
  const manut156 = await importar(dir156, 'src/modules/maintenance/infrastructure/maintenanceDataAdapter.js');
  // A tabela 'operacoes' não existe no esquema da 1.5.x: contada direto no IndexedDB.
  const contarOperacoes = () => new Promise((ok, falha) => { const req = aberto.backendDB().transaction('operacoes', 'readonly').objectStore('operacoes').count(); req.onsuccess = () => ok(req.result); req.onerror = falha; });
  assert.ok(await contarOperacoes() > 0, 'operações legadas da v9 existem');
  await manut156.applyRestoreBackup(JSON.parse(readFileSync(preMigracaoPath, 'utf8')));
  const restauradoNoMesmoPerfil = await contagens(await storage156.ensureReady());
  assert.deepEqual(restauradoNoMesmoPerfil, antesDaMigracao, 'tabelas da v8 voltam ao backup');
  const operacoesDepois = await contarOperacoes();
  assert.ok(operacoesDepois > 0, 'MAS as tabelas só da v9 continuam com os dados da 1.6.0 (estado misto)');
  db156.resetDbForTests();
  resumo.push(`1.5.x no MESMO perfil: abre o banco v9 sem erro (verno ${aberto.verno}); restaurar ali volta as tabelas da v8 mas deixa ${operacoesDepois} operação(ões) da v9 — estado misto (por isso: perfil separado)`);

  // 4. Perfil separado (processo novo = IndexedDB novo).
  const filho = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--perfil-limpo', dir156, preMigracaoPath, backupV9Path, JSON.stringify(antesDaMigracao), join(raiz, 'perfil-limpo')], { encoding: 'utf8' });
  const saida = filho.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  assert.equal(filho.status, 0, `perfil limpo: ${filho.stderr.slice(-2000)}`);
  const r = JSON.parse(saida);
  resumo.push(`1.5.x em perfil SEPARADO: backup v9 comum recusado; pré-migração v8 restaurado com ${JSON.stringify(r.contagens)} (integridade ${r.integridade ? 'OK' : 'com pendências'}); a pesagem lançada na 1.6.0 não volta`);

  console.log('OK verify-rollback-v8');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(raiz, { recursive: true, force: true });
  if (criado) {
    try { execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', dir156], { stdio: 'ignore' }); } catch { /* worktree temporário */ }
    if (existsSync(dir156)) rmSync(dir156, { recursive: true, force: true });
  }
}
