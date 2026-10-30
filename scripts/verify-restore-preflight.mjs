// Gate restore:preflight:verify — auditoria corretiva R1, achado R02.
// A restauração só substitui a base depois de conferir TODOS os anexos do arquivo exato que foi inspecionado:
//   • restauração boa → recuperacaoCompleta, anexos com o mesmo hash;
//   • pasta .anexos ausente, um anexo ausente, anexo adulterado com o MESMO tamanho, arquivo trocado depois da
//     inspeção, falha de gravação no preparo → recusa, banco e pasta de anexos idênticos (hash antes/depois);
//   • uma seleção posterior (outro arquivo) não muda o alvo da restauração já inspecionada;
//   • falha ao efetivar os anexos DEPOIS do banco → compensação: banco devolvido ao estado anterior;
//   • backup protegido (.pbk): senha errada recusada; anexo adulterado no envelope recusado antes de gravar.
// Usa o armazenamento de anexos e o registro de seleções reais do processo principal numa pasta temporária.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import storage from '../src/storage/storageAdapter.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';
import * as center from '../src/modules/backup/application/backupCenterService.js';
import * as docs from '../src/modules/documents/application/documentsService.js';
import * as ops from '../src/modules/livestock/application/operationsService.js';
import { createGateAttachmentBridge } from './lib/gateAttachmentBridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'pesagens-preflight-'));
const dataDir = join(root, 'dados');
const fora = join(root, 'fora');
mkdirSync(fora, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirOf = (subdir) => { const d = join(dataDir, String(subdir || '')); mkdirSync(d, { recursive: true }); return d; };
let proximoArquivo = null;
const ponte = createGateAttachmentBridge(dataDir, { importar: () => proximoArquivo });

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
setActorProvider(() => ({ id: 'u1', nome: 'Admin', role: 'ADMIN' }));

// Hash do banco (fora o histórico de backup, que REGISTRA as tentativas) + pasta de anexos.
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
  return { banco: partes.join('|'), anexos: anexos.join('|') };
}
const preparoVazio = () => !existsSync(join(dataDir, 'anexos-preparo')) || readdirSync(join(dataDir, 'anexos-preparo')).length === 0;

const resumo = [];
try {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const TS = '2026-01-01T00:00:00.000Z';
  await db.table('marcas').add({ empresa_id: 'local', id: 'MK', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, padrao: true, created_at: TS, updated_at: TS, deleted_at: null });
  await db.table('usuarios').add({ id: 'u1', login: 'admin', nome: 'Admin', role: 'ADMIN', ativo: true, password_hash: 'h', password_salt: 's', created_at: TS, updated_at: TS, deleted_at: null });
  const compra = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-01', itens: [1, 2, 3].map((n) => ({ numero_animal: String(n), marca_id: 'MK', sexo: 'M', peso: 250 + n })) });
  await ops.confirmOperation(compra.operacao.id);
  // Dois anexos do mesmo tamanho (o adulterado "com o mesmo tamanho" precisa ser realista).
  const pdfX = join(fora, 'gta-x.pdf');
  const pdfY = join(fora, 'nf-y.pdf');
  writeFileSync(pdfX, Buffer.from('%PDF-1.4 GTA sintetica X do gate R02'));
  writeFileSync(pdfY, Buffer.from('%PDF-1.4 NFe sintetica Y do gate R02'));
  proximoArquivo = pdfX;
  const anexoX = await docs.pickAttachment();
  const docX = await docs.saveDocument({ tipo: 'GTA', data: '2026-02-01', operacao_id: compra.operacao.id, anexo: anexoX });
  proximoArquivo = pdfY;
  const anexoY = await docs.pickAttachment();
  await docs.saveDocument({ tipo: 'NFE', data: '2026-02-01', operacao_id: compra.operacao.id, anexo: anexoY });

  // Backup A (o que será restaurado) e o protegido com a mesma situação.
  const bom = await maintenance.createBackupNow({ reason: 'manual-ui' });
  const nomeA = bom.backupPath.split(/[\\/]/).pop();
  const backupA = JSON.parse(readFileSync(bom.backupPath, 'utf8'));
  const pastaA = join(dataDir, 'backups', nomeA.replace(/\.json$/, '.anexos'));
  const protegido = await center.exportProtectedBackup('senha-forte-2026');
  const envelope = JSON.parse(readFileSync(protegido.path, 'utf8'));

  // Base de hoje: outra compra, o documento X fora do banco e o arquivo X fora da pasta do app — restaurar A
  // precisa, de fato, gravar o anexo X (é o que exercita preparo e efetivação).
  const compra2 = await ops.saveDraft({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-02-02', itens: [{ numero_animal: '4', marca_id: 'MK', sexo: 'F', peso: 240 }] });
  await ops.confirmOperation(compra2.operacao.id);
  await db.table('documentos').where('id').equals(docX.id).delete();
  const anexoAppX = join(dataDir, 'anexos', `${anexoX.sha256}.pdf`);
  rmSync(anexoAppX);
  const animaisHoje = await db.table('animais').count();

  async function recusada(rotulo, op, codigo) {
    const antes = await fotografia();
    await assert.rejects(op(), (err) => (Array.isArray(codigo) ? codigo.includes(err.code) : err.code === codigo), `${rotulo}: recusada com ${codigo}`);
    const depois = await fotografia();
    assert.equal(depois.banco, antes.banco, `${rotulo}: banco idêntico`);
    assert.equal(depois.anexos, antes.anexos, `${rotulo}: anexos idênticos`);
    assert.ok(preparoVazio(), `${rotulo}: pasta de preparo descartada`);
    resumo.push(`R02 ${rotulo}: recusada (${codigo}), banco e anexos idênticos`);
  }

  // 1. Pasta .anexos ausente (só o JSON copiado para outro lugar).
  const soJson = join(fora, nomeA);
  writeFileSync(soJson, readFileSync(bom.backupPath));
  await recusada('pasta ausente', () => maintenance.applyRestoreBackup(backupA, { selecao: ponte.selecionar(soJson).selecao }), 'BACKUP_ANEXOS_PREFLIGHT');

  // 2. Um anexo ausente na pasta do backup.
  const xNoPacote = join(pastaA, `${anexoX.sha256}.pdf`);
  const bytesX = readFileSync(xNoPacote);
  rmSync(xNoPacote);
  await recusada('um anexo ausente', () => maintenance.applyRestoreBackup(backupA, { selecao: ponte.selecionar(bom.backupPath).selecao }), 'BACKUP_ANEXOS_PREFLIGHT');

  // 3. Anexo adulterado com o MESMO tamanho.
  const adulterado = Buffer.from(bytesX);
  adulterado[adulterado.length - 1] ^= 0x01;
  writeFileSync(xNoPacote, adulterado);
  assert.equal(statSync(xNoPacote).size, bytesX.length);
  await recusada('anexo adulterado (mesmo tamanho)', () => maintenance.applyRestoreBackup(backupA, { selecao: ponte.selecionar(bom.backupPath).selecao }), 'BACKUP_ANEXOS_PREFLIGHT');
  writeFileSync(xNoPacote, bytesX);

  // 4. Arquivo trocado depois da inspeção (mesmo tamanho, conteúdo diferente).
  const copiaA = join(fora, 'copia', nomeA);
  mkdirSync(join(fora, 'copia'), { recursive: true });
  cpSync(bom.backupPath, copiaA);
  cpSync(pastaA, copiaA.replace(/\.json$/, '.anexos'), { recursive: true });
  const selTrocado = ponte.selecionar(copiaA);
  const textoA = readFileSync(copiaA, 'utf8');
  writeFileSync(copiaA, textoA.replace('"reason": "manual-ui"', '"reason": "manual-uj"'));
  assert.equal(statSync(copiaA).size, Buffer.byteLength(textoA));
  await recusada('arquivo trocado após a inspeção', () => maintenance.applyRestoreBackup(backupA, { selecao: selTrocado.selecao }), 'BACKUP_ARQUIVO_TROCADO');
  await recusada('sem seleção', () => maintenance.applyRestoreBackup(backupA, {}), 'BACKUP_SELECAO_INVALIDA');

  // 5. Falha de gravação no preparo (depois do backup de segurança, antes do banco).
  ponte.falhas.preparo = true;
  await recusada('falha de gravação no preparo', () => maintenance.applyRestoreBackup(backupA, { selecao: ponte.selecionar(bom.backupPath).selecao }), 'BACKUP_ANEXOS_PREPARO');
  ponte.falhas.preparo = false;

  // 6. Falha ao efetivar os anexos DEPOIS do banco → compensação devolve o banco de antes.
  {
    const antes = await fotografia();
    ponte.falhas.efetivar = true;
    await assert.rejects(maintenance.applyRestoreBackup(backupA, { selecao: ponte.selecionar(bom.backupPath).selecao }), (err) => err.code === 'BACKUP_RESTAURACAO_REVERTIDA' && err.compensado === true && err.recuperacaoCompleta === false);
    ponte.falhas.efetivar = false;
    const depois = await fotografia();
    assert.equal(depois.banco, antes.banco, 'pós-commit: banco devolvido ao estado anterior');
    for (const linha of antes.anexos.split('|').filter(Boolean)) assert.ok(depois.anexos.includes(linha), 'pós-commit: anexos anteriores intactos');
    assert.equal(await (await storage.ensureReady()).table('animais').count(), animaisHoje);
    const hist = (await (await storage.ensureReady()).table('backupHistory').toArray()).filter((h) => h.tipo === 'restore-compensated');
    assert.equal(hist.length, 1, 'compensação registrada no histórico');
    resumo.push('R02 falha ao efetivar anexos após o banco: compensado, banco de antes, anexos anteriores intactos');
    // A pasta de preparo fica (com o anexo que não foi movido) só até a próxima tentativa; limpa aqui para o gate.
    rmSync(join(dataDir, 'anexos-preparo'), { recursive: true, force: true });
  }

  // 7. Seleção posterior não redireciona; restauração boa → recuperação completa.
  {
    const selA = ponte.selecionar(bom.backupPath);
    ponte.selecionar(soJson); // outro diálogo depois (arquivo sem pasta de anexos)
    const r = await maintenance.applyRestoreBackup(backupA, { selecao: selA.selecao });
    assert.equal(r.recuperacaoCompleta, true, 'restauração boa: recuperação completa');
    assert.deepEqual([r.anexos.total, r.anexos.ok], [2, 2]);
    assert.equal(sha(readFileSync(anexoAppX)), anexoX.sha256, 'anexo X voltou com o mesmo hash');
    assert.equal(await (await storage.ensureReady()).table('animais').count(), backupA.stores.animais.length);
    assert.ok(preparoVazio(), 'preparo removido após efetivar');
    resumo.push('R02 restauração boa: seleção posterior não muda o alvo; recuperacaoCompleta = true; anexos com o mesmo hash');
  }

  // 8. Backup protegido: senha errada e anexo adulterado no envelope, antes de gravar.
  {
    await db.table('documentos').where('id').equals(docX.id).delete();
    rmSync(anexoAppX);
    await assert.rejects(center.inspectBackup(envelope, { senha: 'senha-errada-0000' }), (err) => err.code === 'PROTEGIDO_AUTENTICACAO');
    resumo.push('R02 .pbk: senha errada recusada na inspeção (nada gravado)');
    const insp = await center.inspectBackup(envelope, { senha: 'senha-forte-2026' });
    const alvo = insp.anexosInline.find((a) => a.sha256 === anexoX.sha256);
    const original = alvo.base64;
    alvo.base64 = (original[0] === 'A' ? 'B' : 'A') + original.slice(1);
    await recusada('.pbk com anexo adulterado', () => center.restoreGuided(insp, { confirmacao: 'RESTAURAR' }), 'BACKUP_ANEXOS_PREPARO');
    alvo.base64 = original;
    const ok = await center.restoreGuided(insp, { confirmacao: 'RESTAURAR' });
    assert.equal(ok.recuperacaoCompleta, true, '.pbk íntegro: recuperação completa');
    assert.equal(sha(readFileSync(anexoAppX)), anexoX.sha256);
    resumo.push('R02 .pbk íntegro: recuperacaoCompleta = true');
  }

  console.log('OK verify-restore-preflight');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  setActorProvider(null);
  rmSync(root, { recursive: true, force: true });
  await deleteDbForTests();
}
