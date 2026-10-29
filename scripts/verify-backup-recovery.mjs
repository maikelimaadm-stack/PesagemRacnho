// Gate backup:recovery:verify — missão pesagens-integrada, checkpoint A3 (P19, P21, P24, P26).
// Comportamento real (fake-indexeddb + ponte de arquivos simulada sobre uma pasta temporária, com a mesma
// semântica do processo principal: gravação, listagem e leitura de volta com SHA-256):
//   P19 um comando só (createBackupNow) e os nomes antigos delegam a ele;
//   P21 "verificado" só com leitura de volta; arquivo corrompido/truncado = FALHOU; status separa
//       último verificado × não verificado;
//   P24 exportação de pesagens recusada na restauração com mensagem clara;
//   P26 diagnóstico sem hash/salt; aviso de dado sensível na tela.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';

const root = mkdtempSync(join(tmpdir(), 'pesagens-backup-'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const dirOf = (subdir) => { const d = join(root, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
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
      const files = readdirSync(d).filter((n) => !extension || n.endsWith(extension)).map((name) => {
        const full = join(d, name);
        const st = statSync(full);
        return { name, path: full, size: st.size, modifiedAt: st.mtime.toISOString() };
      });
      return { ok: true, files };
    },
    async readUserFile({ subdir, filename }) {
      const full = join(dirOf(subdir), filename);
      const bytes = readFileSync(full);
      return { ok: true, path: full, size: bytes.length, sha256: sha(bytes), content: bytes.toString('utf8') };
    },
  },
};

const resumo = [];
const ok = (r) => resumo.push(r);
try {
  await deleteDbForTests();
  await storage.ensureReady();
  await weighingService.createEntry({ id: 'c1', animal_id: 'A1', tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'MK', sexo: 'M', data_pesagem: '2026-01-10', peso: 210 });

  // Sem backup ainda.
  let status = await maintenance.getBackupStatus();
  assert.equal(status.protecao, 'SEM_BACKUP');

  // P19 + P21: comando único grava e verifica lendo de volta.
  const criado = await maintenance.createBackupNow({ reason: 'manual-ui' });
  assert.equal(criado.verified, true);
  status = await maintenance.getBackupStatus();
  assert.equal(status.protecao, 'VERIFICADO');
  assert.equal(status.lastVerified.path, criado.backupPath);
  assert.equal(status.files.length, 1);
  assert.equal(status.files[0].estado, 'VERIFICADO');
  ok('P19/P21 Criar backup agora grava e verifica (leitura de volta)');

  // Os nomes antigos são o MESMO backup (SSOT), também verificado.
  const antigo = await maintenance.createFullDataBackup({ reason: 'manual-ui' });
  assert.equal(antigo.verified, true);
  assert.deepEqual(Object.keys(antigo.counts).sort(), Object.keys(criado.counts).sort(), 'mesmo conteúdo de stores');
  ok('P19 createDatabaseBackup/createFullDataBackup delegam ao comando único');

  // Arquivo que aparece na pasta sem ter sido verificado: NAO_VERIFICADO até Verificar.
  const copia = join(dirOf('backups'), 'copia-manual.json');
  writeFileSync(copia, readFileSync(criado.backupPath));
  status = await maintenance.getBackupStatus();
  assert.equal(status.files.find((f) => f.name === 'copia-manual.json').estado, 'NAO_VERIFICADO', 'arquivo encontrado não é verificado');
  const v = await maintenance.verifyBackupFile({ name: 'copia-manual.json' });
  assert.equal(v.ok, true);
  status = await maintenance.getBackupStatus();
  assert.equal(status.files.find((f) => f.name === 'copia-manual.json').estado, 'VERIFICADO');
  ok('P21 arquivo encontrado ≠ verificado; Verificar promove');

  // Truncado e adulterado: FALHOU, com motivo.
  const truncado = join(dirOf('backups'), 'truncado.json');
  const bytes = readFileSync(criado.backupPath);
  writeFileSync(truncado, bytes.subarray(0, Math.floor(bytes.length / 2)));
  const vt = await maintenance.verifyBackupFile({ name: 'truncado.json' });
  assert.equal(vt.ok, false);
  assert.match(vt.error, /truncado|JSON/i);
  const adulterado = join(dirOf('backups'), 'adulterado.json');
  const json = JSON.parse(bytes.toString('utf8'));
  json.stores.pesagens[0].peso_kg = 999;
  writeFileSync(adulterado, JSON.stringify(json));
  const va = await maintenance.verifyBackupFile({ name: 'adulterado.json' });
  assert.equal(va.ok, false);
  assert.match(va.error, /SHA-256/);
  status = await maintenance.getBackupStatus();
  assert.equal(status.files.find((f) => f.name === 'adulterado.json').estado, 'FALHOU');
  assert.equal(status.protecao, 'VERIFICADO', 'um arquivo ruim não apaga o último verificado');
  // Arquivo trocado depois de gravado: SHA do disco ≠ SHA gravado.
  const vs = await maintenance.verifyBackupFile({ name: 'copia-manual.json', expectedFileSha256: '0'.repeat(64) });
  assert.equal(vs.ok, false);
  assert.match(vs.error, /SHA-256 diferente/);
  ok('P21 truncado/adulterado/trocado = FALHOU com motivo; não promovido');

  // P24: exportação de pesagens não restaura.
  const { payload } = await storage.exportPesagensJson();
  await assert.rejects(maintenance.dryRunRestoreBackup(payload), (err) => err.code === 'DEXIE_BACKUP_007' && /EXPORTAÇÃO DE PESAGENS/.test(err.message));
  ok('P24 exportação de pesagens recusada na restauração com mensagem clara');

  // P26: diagnóstico copiável não leva hash/salt nem usuários.
  const diag = JSON.stringify(await maintenance.getDiagnosticSnapshot());
  assert.doesNotMatch(diag, /password_hash|password_salt/);
  const ui = readFileSync(new URL('../src/pages/ManutencaoSistema.jsx', import.meta.url), 'utf8');
  assert.match(ui, /O arquivo de backup contém todos os dados, inclusive valores comerciais e os usuários/, 'aviso de dado sensível na tela');
  assert.match(ui, /Exportação de pesagens \(não é backup\)/, 'exportação rotulada como não-backup');
  assert.equal((ui.match(/maintenanceService\.(createDatabaseBackup|createFullDataBackup)\(/g) || []).length, 0, 'P19: a tela não oferece os dois comandos antigos');
  ok('P26 diagnóstico sem credenciais; avisos e rótulos na tela');

  console.log('OK verify-backup-recovery');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
