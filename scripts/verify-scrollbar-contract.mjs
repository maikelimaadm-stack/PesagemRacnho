import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const globalCss = await readFile(new URL('../src/styles/modelobase1/erp-scrollbar.css', import.meta.url), 'utf8');
const launchCss = await readFile(new URL('../src/styles/d17b-modelobase1.css', import.meta.url), 'utf8');

assert.match(globalCss, /--erp-scrollbar-size:\s*10px;/, 'a barra global deve usar dimensão inteira fixa');
assert.match(launchCss, /\.emp-table-shell\.d17c-table-scroll::\-webkit-scrollbar\s*\{\s*width:\s*10px\s*!important;\s*height:\s*10px\s*!important;/s);
assert.match(launchCss, /scrollbar-gutter:\s*stable\s*!important;/);
assert.doesNotMatch(launchCss, /scrollbar-gutter:\s*stable both-edges\s*!important;/, 'a barra não pode reservar uma faixa vazia no lado esquerdo');
assert.match(launchCss, /\.emp-table-shell\.d17c-table-scroll::\-webkit-scrollbar-thumb\s*\{[\s\S]*border:\s*2px solid #e8edf1\s*!important;/);
assert.match(launchCss, /html\.dark body \.emp-table-shell\.d17c-table-scroll::\-webkit-scrollbar-thumb/);

console.log('OK verify-scrollbar-contract');
console.log(JSON.stringify({ globalSizePx: 10, tableSizePx: 10, electronOverridePriority: true, stableRightGutterOnly: true, darkMode: true }, null, 2));
