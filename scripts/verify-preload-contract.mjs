import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

// Cruza o que o renderer USA (window.pesagemApp.X) com o que o preload EXPÕE.
// Pega bugs como "preload enxugado deixou a UI pedindo uma API que não existe".
const preload = readFileSync(join(root, 'electron', 'preload.cjs'), 'utf8');
const exposedBlock = preload.slice(preload.indexOf('exposeInMainWorld'));
const exposed = new Set(
  [...exposedBlock.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map((m) => m[1])
);
assert(exposed.size > 0, 'preload expõe alguma API');

function walk(d) {
  const out = [];
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(p)) out.push(p);
  }
  return out;
}

const used = new Map();
for (const f of walk(join(root, 'src'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/pesagemApp\??\.\s*([a-zA-Z][a-zA-Z0-9_]*)/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(f.replace(root, ''));
  }
}

const faltando = [...used.entries()].filter(([api]) => !exposed.has(api));
assert(
  faltando.length === 0,
  `renderer usa APIs que o preload NÃO expõe: ${faltando.map(([a, fs2]) => `${a} (${fs2.join(', ')})`).join(' | ')}`
);

// A tela não pode exigir APIs de dados que foram removidas no cutover Dexie.
const removidas = ['entities', 'weighing', 'database', 'maintenance', 'apartacoes', 'loteApartacoes',
  'shipments', 'shipmentDocuments'];
const zumbis = removidas.filter((r) => used.has(r));
assert(zumbis.length === 0, `renderer ainda referencia APIs de dados removidas: ${zumbis.join(', ')}`);

console.log('OK verify-preload-contract');
console.log(JSON.stringify({ expostas: [...exposed], usadas: [...used.keys()] }, null, 2));
