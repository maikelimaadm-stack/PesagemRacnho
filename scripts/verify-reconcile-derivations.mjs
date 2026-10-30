// Gate reconcile:derivations:verify — auditoria corretiva R1, achado R08 (versão barata, para o test:quick).
// "Reconciliar derivados" em base sintética pequena com blocos pequenos: cria os derivados; a 2ª execução não
// regrava nada (pesagens, animais, permanências, movimentos); o cancelamento para entre blocos. A medição de
// desempenho (1k/5k/12k) fica em perf:reconcile:electron, fora deste gate.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { runReconcileBench } from './lib/reconcileBenchCore.mjs';

const r = await runReconcileBench(60, { chunkSize: 20 });
assert.equal(r.animais, 60);
assert.ok(r.movimentos >= 60 && r.lotes >= 60, 'derivados criados');
assert.equal(r.cancelada_feitos, 20, 'cancelamento para depois do 1º bloco');
console.log('OK verify-reconcile-derivations');
console.log(JSON.stringify(['R08 1ª execução cria derivados; 2ª não regrava nada; cancelamento entre blocos'], null, 2));
