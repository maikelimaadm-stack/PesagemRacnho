// Gate restore:critical-restart:verify — auditoria corretiva R3, achado R3-01.
// O estado CRÍTICO de restauração (restauração e volta automática falharam) sobrevive a fechar e reabrir o app:
//   • falha depois da troca da base + falha na compensação → marcador em arquivo (nome fixo, conteúdo mínimo, sem
//     caminho nem dados) e escrita bloqueada;
//   • PROCESSO NOVO apontando para a MESMA pasta de dados, pela abertura real do app (bootstrapLocalDb): escrita
//     continua bloqueada, inclusive depois de clearWriteBlock (migração); login (usuarios/auditoria) segue liberado;
//     processo novo com OUTRA pasta não herda o bloqueio;
//   • histórico de backup falhando no ramo crítico: o erro continua CRÍTICO e a escrita bloqueada;
//   • marcador em arquivo sem conseguir gravar (disco cheio): CRÍTICO avisa e fica a cópia no banco, que reinstala o
//     bloqueio numa abertura nova;
//   • restauração de recuperação que falha: marcador continua; restauração conferida: marcador limpo; reabrir → CRUD;
//   • bloqueio de migração continua funcionando e não apaga o crítico.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const ARQUIVO_MARCADOR = 'estado-restauracao-critica.json';
const modo = process.argv[2] || 'principal';
const dataDir = process.argv[3] || join(mkdtempSync(join(tmpdir(), 'pesagens-critico-')), 'dados');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
const ponte = createGateAttachmentBridge(dataDir);
let seq = 0;
globalThis.localStorage = globalThis.localStorage || { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); } };
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

const storage = (await import('../src/storage/storageAdapter.js')).default;
const escreve = () => { try { storage.assertWritable('Lançamento de pesagem'); return { ok: true }; } catch (e) { return { ok: false, code: e.code }; } };

// ---------------------------------------------------------------------------------------------------------------
// Processo filho = o app aberto de novo (mesma pasta de dados ou outra), pela abertura real (bootstrapLocalDb).
// ---------------------------------------------------------------------------------------------------------------
if (modo === 'abrir') {
  const { bootstrapLocalDb } = await import('../src/api/db.js');
  const boot = await bootstrapLocalDb();
  const antes = escreve();
  storage.clearWriteBlock(); // o que a migração faz ao concluir — não pode liberar o crítico
  const depoisClear = escreve();
  let login = true;
  try { storage.assertWritable('Login', { store: 'usuarios' }); } catch { login = false; }
  let crud = null;
  if (antes.ok) {
    const ops = await import('../src/modules/livestock/application/operationsService.js');
    const db = await storage.ensureReady();
    const TS = '2026-01-01T00:00:00.000Z';
    await db.table('marcas').put({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
    const r = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-03-01', itens: [{ numero_animal: '77', marca_id: 'MK', sexo: 'M', peso: 300 }] });
    await ops.confirmOperation(r.operacao.id);
    crud = (await db.table('animais').toArray()).some((a) => a.numero_animal === '77');
  }
  console.log(JSON.stringify({ ready: boot.ready, escrita: antes, escritaDepoisDeClearWriteBlock: depoisClear, loginLiberado: login, crud }));
  process.exit(0);
}
const abrirDeNovo = (pasta = dataDir) => {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'abrir', pasta], { encoding: 'utf8' });
  const linha = r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  assert.ok(linha, `processo filho sem resultado: ${r.stderr.slice(-1500)}`);
  return JSON.parse(linha);
};

// ---------------------------------------------------------------------------------------------------------------
const maintenance = await import('../src/modules/maintenance/application/maintenanceService.js');
const { faltasRestauracaoParaTestes } = await import('../src/modules/maintenance/infrastructure/maintenanceDataAdapter.js');
const { carregarBloqueioCritico } = await import('../src/storage/criticalRestoreState.js');
const { clearCriticalBlock, setWriteBlocked } = await import('../src/storage/migrations/migrationState.js');
const ops = await import('../src/modules/livestock/application/operationsService.js');
const { deleteDbForTests } = await import('../src/storage/indexedDb/db.js');
globalThis.__PESAGENS_GATE_FALTAS__ = true;

const resumo = [];
const critico = () => { faltasRestauracaoParaTestes.em = (fase) => { if (fase === 'derivados' || fase === 'compensacao') throw new Error(`${fase} falhou (simulado)`); }; };
const semFalhas = () => { faltasRestauracaoParaTestes.em = null; };
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  const c = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [1, 2].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
  await ops.confirmOperation(c.operacao.id);
  const bom = await maintenance.createBackupNow({ reason: 'manual-ui' });
  const backupA = JSON.parse(readFileSync(bom.backupPath, 'utf8'));
  const selA = () => ponte.selecionar(bom.backupPath).selecao;

  // 1. Crítico: marcador em arquivo, conteúdo mínimo, escrita bloqueada.
  critico();
  let erro = null;
  try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
  semFalhas();
  assert.equal(erro?.code, 'BACKUP_RESTAURACAO_CRITICA');
  assert.deepEqual([erro.marcadorPersistido.arquivo, erro.marcadorPersistido.banco], [true, true]);
  const marcadorPath = join(dataDir, ARQUIVO_MARCADOR);
  assert.ok(existsSync(marcadorPath), 'marcador gravado na pasta de dados');
  const marcador = JSON.parse(readFileSync(marcadorPath, 'utf8'));
  assert.deepEqual(Object.keys(marcador).sort(), ['backupNome', 'backupSha256', 'codigo', 'em', 'fase']);
  assert.ok(!/[\\/]/.test(marcador.backupNome), 'só o nome do backup, sem caminho');
  assert.equal(marcador.backupSha256, erro.safetyBackup.sha256);
  assert.equal(escreve().code, 'RESTAURACAO_CRITICA');
  resumo.push('R3-01 crítico: marcador atômico na pasta de dados (código, instante, fase, nome e SHA-256 do backup de segurança — sem caminho nem dados), escrita bloqueada');

  // 2. Reabrir: mesma pasta → bloqueado (mesmo após clearWriteBlock); outra pasta → livre.
  const reaberto = abrirDeNovo();
  assert.equal(reaberto.ready, true);
  assert.deepEqual(reaberto.escrita, { ok: false, code: 'RESTAURACAO_CRITICA' }, 'reabrir o app não libera');
  assert.deepEqual(reaberto.escritaDepoisDeClearWriteBlock, { ok: false, code: 'RESTAURACAO_CRITICA' }, 'clearWriteBlock (migração) não libera');
  assert.equal(reaberto.loginLiberado, true, 'login (usuarios/auditoria) continua possível');
  const outroPerfil = abrirDeNovo(join(mkdtempSync(join(tmpdir(), 'pesagens-outro-')), 'dados'));
  assert.equal(outroPerfil.escrita.ok, true, 'outro perfil não herda o bloqueio');
  resumo.push('R3-01 processo novo na MESMA pasta: escrita bloqueada (também depois de clearWriteBlock), login liberado; outra pasta: livre');

  // 3. Recuperação que falha: marcador continua.
  faltasRestauracaoParaTestes.em = (fase) => { if (fase === 'derivados') throw new Error('falha na recuperação (simulado)'); };
  const seguranca = erro.safetyBackup;
  await assert.rejects(maintenance.applyRestoreBackup(JSON.parse(readFileSync(seguranca.path, 'utf8')), { selecao: ponte.selecionar(seguranca.path).selecao }));
  semFalhas();
  assert.ok(existsSync(marcadorPath), 'recuperação que falha não limpa o marcador');
  assert.equal(escreve().code, 'RESTAURACAO_CRITICA');
  assert.equal(abrirDeNovo().escrita.code, 'RESTAURACAO_CRITICA');
  resumo.push('R3-01 recuperação que falha: marcador e bloqueio continuam (também ao reabrir)');

  // 4. Recuperação conferida: marcador limpo; reabrir → escrita e CRUD normais.
  const rec = await maintenance.applyRestoreBackup(JSON.parse(readFileSync(seguranca.path, 'utf8')), { selecao: ponte.selecionar(seguranca.path).selecao });
  assert.equal(rec.recuperacaoCompleta, true);
  assert.equal(rec.estadoCriticoLiberado, true);
  assert.ok(!existsSync(marcadorPath), 'marcador limpo depois da recuperação conferida');
  assert.equal(escreve().ok, true);
  const livre = abrirDeNovo();
  assert.deepEqual([livre.escrita.ok, livre.crud], [true, true], 'reaberto depois da recuperação: CRUD normal');
  const historico = readFileSync(join(dataDir, 'estado-restauracao-critica.historico.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).evento);
  assert.ok(historico.includes('CRITICO') && historico.includes('LIBERADO'), 'histórico do marcador auditado');
  resumo.push('R3-01 recuperação conferida: marcador limpo e auditado; reabrir → escrita e CRUD normais');

  // 5. Histórico de backup falhando no ramo crítico: continua CRÍTICO e bloqueado.
  const recordOriginal = storage.recordBackupHistory;
  storage.recordBackupHistory = async (tipo, d) => { if (/^restore-(compensated|critical)$/.test(tipo)) throw new Error('histórico indisponível (simulado)'); return recordOriginal.call(storage, tipo, d); };
  critico();
  erro = null;
  try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
  semFalhas();
  storage.recordBackupHistory = recordOriginal;
  assert.equal(erro?.code, 'BACKUP_RESTAURACAO_CRITICA', 'falha no histórico não troca a mensagem');
  assert.equal(escreve().code, 'RESTAURACAO_CRITICA');
  assert.ok(existsSync(marcadorPath));
  resumo.push('R3-01 histórico falhando no ramo crítico: erro continua CRÍTICO, escrita bloqueada, marcador gravado');
  await maintenance.applyRestoreBackup(JSON.parse(readFileSync(erro.safetyBackup.path, 'utf8')), { selecao: ponte.selecionar(erro.safetyBackup.path).selecao });
  assert.ok(!existsSync(marcadorPath));

  // 6. Marcador em arquivo impossível (disco cheio): aviso explícito; cópia no banco reinstala o bloqueio.
  ponte.falhas.marcador = true;
  critico();
  erro = null;
  try { await maintenance.applyRestoreBackup(backupA, { selecao: selA() }); } catch (e) { erro = e; }
  semFalhas();
  ponte.falhas.marcador = false;
  assert.equal(erro?.code, 'BACKUP_RESTAURACAO_CRITICA');
  assert.deepEqual([erro.marcadorPersistido.arquivo, erro.marcadorPersistido.banco], [false, true]);
  assert.match(erro.message, /NÃO pôde ser gravado.*NÃO feche/);
  clearCriticalBlock(); // simula a memória de um processo novo (o banco real persistiria; aqui é o mesmo processo)
  await carregarBloqueioCritico(await storage.ensureReady());
  assert.equal(escreve().code, 'RESTAURACAO_CRITICA', 'cópia no banco reinstala o bloqueio');
  resumo.push('R3-01 marcador em arquivo impossível: CRÍTICO avisa "NÃO feche"; cópia em appSettings reinstala o bloqueio');
  await maintenance.applyRestoreBackup(JSON.parse(readFileSync(erro.safetyBackup.path, 'utf8')), { selecao: ponte.selecionar(erro.safetyBackup.path).selecao });
  assert.equal(escreve().ok, true);

  // 7. Bloqueio de migração continua funcionando, separado do crítico.
  setWriteBlocked({ code: 'MIGRATION_BLOCKED', message: 'teste' });
  assert.equal(escreve().code, 'MIGRATION_BLOCKED');
  storage.clearWriteBlock();
  assert.equal(escreve().ok, true);
  resumo.push('R3-01 bloqueio de migração continua funcionando e independente do crítico');

  console.log('OK verify-restore-critical-restart');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  semFalhas();
  rmSync(join(dataDir, '..'), { recursive: true, force: true });
  await deleteDbForTests();
}
