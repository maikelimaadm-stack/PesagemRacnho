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

// Negativo: o formato antigo (sem role, só campos de auditoria) não pode abrir a trava.
setActorProvider(() => ({ usuario_id: 'u-legado', usuario_nome_snapshot: 'Legado' }));
assert.equal((await outcome(OPERATIONS[3][1])).code, 'MAINTENANCE_FORBIDDEN', 'ator sem papel é recusado');

setActorProvider(null);
console.log(JSON.stringify({ gate: 'auth:maintenance-access:verify', ok: true, results }, null, 2));
