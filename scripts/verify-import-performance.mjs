// Importação conciliada com massa sintética, no Node + fake-indexeddb (R2-05). Duas utilidades:
//   • import:contract:verify (test:full): massa PEQUENA e determinística (600 × 3) — confere contagens,
//     deduplicação, reimportação sem gravar, idempotência e Manejos retroativos (só séries afetadas);
//   • perf:import:node: massa de CAPACIDADE (padrão 12.000 × 3 = 36.000). ATENÇÃO: o fake-indexeddb cresce ~N² nas
//     gravações (varre o índice a cada atualização) e NÃO representa o aplicativo; o número do app vem de
//     perf:import:electron (IndexedDB real). Uso: node scripts/verify-import-performance.mjs [animais] [eventos]
import 'fake-indexeddb/auto';
import { runImportBench } from './lib/importBenchCore.mjs';

const animais = Number(process.argv[2] || 12000);
const eventos = Number(process.argv[3] || 3);
const r = await runImportBench(animais, eventos, { log: (m) => console.error(m) });
console.log(JSON.stringify({ gate: 'import (node + fake-indexeddb)', motor: 'fake-indexeddb (Node)', node: process.version, ...r }, null, 2));
