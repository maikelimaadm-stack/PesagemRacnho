// Medição perf:reconcile:node (R08) — "Reconciliar derivados" no Node, sobre fake-indexeddb. ATENÇÃO: o
// fake-indexeddb varre o índice inteiro a cada atualização (RecordStore.deleteByValue), então a 1ª execução aqui
// cresce ~N² e NÃO representa o aplicativo; o número do app vem de `perf:reconcile:electron` (Chromium real).
// Fora do test:quick (pesado).   node scripts/bench-reconcile-derivations.mjs 1000 5000
import 'fake-indexeddb/auto';
import { runReconcileBench } from './lib/reconcileBenchCore.mjs';

const tamanhos = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
for (const n of tamanhos.length ? tamanhos : [1000]) console.log(JSON.stringify({ motor: 'fake-indexeddb (Node)', ...(await runReconcileBench(n)) }));
console.log('OK bench-reconcile-derivations');
