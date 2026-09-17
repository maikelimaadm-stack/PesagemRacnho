// Gate auth:maintenance-access:verify (R0 do programa reporting, G-P0-01).
// Prova que restaurar, limpar, resetar e continuar migração são recusados no SERVIÇO para
// GESTOR/OPERADOR/CONSULTA e para sessão sem papel, usando o papel real do ator
// (getCurrentActor), e que ADMIN passa da autorização. Regressão: antes o serviço lia
// o papel de getActor(), que não o traz, e a trava nunca disparava.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as maintenance from '../src/modules/maintenance/application/maintenanceService.js';

const OPERATIONS = [
  ['applyRestoreBackup', () => maintenance.applyRestoreBackup('x.json')],
  ['resumeMigration', () => maintenance.resumeMigration({})],
  ['clearOperationalData', () => maintenance.clearOperationalData({ confirmationText: 'errado' })],
  ['resetAllData', () => maintenance.resetAllData({ confirmationText: 'errado' })],
];

async function outcome(run) {
  try {
    await run();
    return { code: 'OK' };
  } catch (error) {
    return { code: error.code ?? 'OTHER', error };
  }
}

const results = {};
for (const role of ['GESTOR', 'OPERADOR', 'CONSULTA', null]) {
  setActorProvider(() => ({ id: `u-${role}`, nome: 'Teste', role }));
  for (const [name, run] of OPERATIONS) {
    const { code } = await outcome(run);
    assert.equal(code, 'MAINTENANCE_FORBIDDEN', `${name} deve ser recusado para ${role ?? 'sessão sem papel'}`);
    results[`${role ?? 'SEM_PAPEL'}.${name}`] = code;
  }
}

// ADMIN passa da autorização: limpar/resetar param na confirmação textual, não no perfil.
setActorProvider(() => ({ id: 'u-admin', nome: 'Admin', role: 'ADMIN' }));
for (const [name, run] of OPERATIONS) {
  const { code } = await outcome(run);
  assert.notEqual(code, 'MAINTENANCE_FORBIDDEN', `${name} não pode ser recusado por perfil para ADMIN`);
  results[`ADMIN.${name}`] = code;
}
assert.equal(results['ADMIN.clearOperationalData'], 'MAINTENANCE_CONFIRMATION_REQUIRED');
assert.equal(results['ADMIN.resetAllData'], 'MAINTENANCE_CONFIRMATION_REQUIRED');

// Backup, exportação e importação: maintenance.backup (ADMIN/GESTOR). O backup completo
// contém dados comerciais e hashes de senha — OPERADOR/CONSULTA são recusados no serviço.
const BACKUP_OPERATIONS = [
  ['createDatabaseBackup', () => maintenance.createDatabaseBackup({})],
  ['createFullDataBackup', () => maintenance.createFullDataBackup({})],
  ['exportWeighingJson', () => maintenance.exportWeighingJson({})],
  ['exportWeighingCsv', () => maintenance.exportWeighingCsv({})],
  ['dryRunImportWeighingJson', () => maintenance.dryRunImportWeighingJson({})],
  ['applyImportWeighingJson', () => maintenance.applyImportWeighingJson({}, {})],
  ['dryRunRestoreBackup', () => maintenance.dryRunRestoreBackup('x.json')],
];
for (const role of ['OPERADOR', 'CONSULTA']) {
  setActorProvider(() => ({ id: `u-${role}`, nome: 'Teste', role }));
  for (const [name, run] of BACKUP_OPERATIONS) {
    assert.equal((await outcome(run)).code, 'MAINTENANCE_FORBIDDEN', `${name} recusado para ${role}`);
    results[`${role}.${name}`] = 'MAINTENANCE_FORBIDDEN';
  }
}
setActorProvider(() => ({ id: 'u-gestor', nome: 'Gestor', role: 'GESTOR' }));
for (const [name, run] of BACKUP_OPERATIONS.filter(([name]) => name !== 'dryRunRestoreBackup')) {
  assert.notEqual((await outcome(run)).code, 'MAINTENANCE_FORBIDDEN', `${name} permitido ao GESTOR`);
}
assert.equal((await outcome(BACKUP_OPERATIONS.at(-1)[1])).code, 'MAINTENANCE_FORBIDDEN', 'GESTOR não simula restauração');

// Autenticação ativa e sem sessão: falha fechada.
setActorProvider(() => null);
for (const [name, run] of [...OPERATIONS, ...BACKUP_OPERATIONS]) {
  assert.equal((await outcome(run)).code, 'MAINTENANCE_FORBIDDEN', `${name} recusado sem sessão`);
}
setActorProvider(() => ({ id: 'u-op', nome: 'Op', role: 'OPERADOR' }));
const mensagem = (await outcome(OPERATIONS[0][1])).error.message;
assert.match(mensagem, /^Restauração: /, 'mensagem nomeia a operação');

// Negativo: o formato antigo (sem role, só campos de auditoria) não pode abrir a trava.
setActorProvider(() => ({ usuario_id: 'u-legado', usuario_nome_snapshot: 'Legado' }));
assert.equal((await outcome(OPERATIONS[3][1])).code, 'MAINTENANCE_FORBIDDEN', 'ator sem papel é recusado');

setActorProvider(null);
console.log(JSON.stringify({ gate: 'auth:maintenance-access:verify', ok: true, results }, null, 2));
