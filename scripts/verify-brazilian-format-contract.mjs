import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fmtCurrency,
  fmtDateBR,
  fmtDateTimeBR,
  fmtDecimal,
  fmtInt,
  fmtNum,
} from '../src/components/common/formatNumber.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(fmtInt(1234567), '1.234.567');
assert.equal(fmtNum(1000), '1.000');
assert.equal(fmtNum(1000.5), '1.000,50');
assert.equal(fmtNum('1.000,50'), '1.000,50');
assert.equal(fmtNum(-1234.56), '-1.234,56');
assert.equal(fmtDecimal(12.3), '12,30');
assert.equal(fmtNum(12.3456, 3), '12,346');
assert.equal(fmtNum(null), '-');
assert.match(fmtCurrency(1000.5).replace(/\s/g, ' '), /^R\$ 1\.000,50$/);
assert.equal(fmtDateBR('2026-08-06'), '06/08/2026');
assert.equal(fmtDateBR('6/8/2026'), '06/08/2026');
assert.equal(fmtDateBR('2026-08-06T15:42:00.000Z'), '06/08/2026');
assert.match(fmtDateTimeBR('2026-08-06T15:42:00'), /^06\/08\/2026,? 15:42$/);

const displayFiles = [
  'src/pages/PesagensIndividuais.jsx',
  'src/pages/LancamentoPesagensIndividuais.jsx',
  'src/components/pesagens/PesagensResumoRodape.jsx',
  'src/components/pesagens/ResumoLotes.jsx',
  'src/components/pesagens/ResumoVendaDia.jsx',
  'src/components/embarque/ResumoEmbarque.jsx',
  'src/components/embarque/GerenciarEmbarquesDialog.jsx',
  'src/components/pesagens/GerenciarApartacoesDialog.jsx',
  'src/components/pesagens/GerenciarSaidasDialog.jsx',
  'src/components/pesagens/ConfigurarResumosDialog.jsx',
];

for (const relativePath of displayFiles) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  assert.doesNotMatch(source, /\{[^}\n]+\}\s*(?:kg|@)\b/i, `${relativePath} não deve colar unidade ao valor`);
}

const dialogFiles = [
  'src/pages/PesagensIndividuais.jsx',
  'src/pages/LancamentoPesagensIndividuais.jsx',
  'src/components/embarque/GerenciarEmbarquesDialog.jsx',
  'src/components/mak/MakColumnConfigDialog.jsx',
  'src/components/pesagens/GerenciarApartacoesDialog.jsx',
  'src/components/pesagens/GerenciarSaidasDialog.jsx',
  'src/components/pesagens/ConfigurarResumosDialog.jsx',
  'src/components/pesagens/SelecionarAnimalDialog.jsx',
];

let dialogCount = 0;
for (const relativePath of dialogFiles) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  const openings = source.match(/<DialogContent\b[^>]*>/g) || [];
  dialogCount += openings.length;
  for (const opening of openings) {
    assert.match(opening, /d17b-standard-dialog/, `${relativePath} contém diálogo fora do contrato padrão`);
    assert.match(opening, /d17b-standard-dialog--(?:compact|medium|large)/, `${relativePath} não declara uma dimensão padrão`);
  }
}

assert.equal(dialogCount, 13, 'a auditoria deve cobrir os treze diálogos dos fluxos operacionais verificados');

const dialogCss = readFileSync(join(root, 'src/styles/d17b-modelobase1.css'), 'utf8');
for (const selector of [
  '.d17b-standard-dialog',
  '.d17b-standard-dialog--compact',
  '.d17b-standard-dialog--medium',
  '.d17b-standard-dialog--large',
]) {
  assert.ok(dialogCss.includes(selector), `CSS deve conter ${selector}`);
}

console.log('OK verify-brazilian-format-contract');
console.log(JSON.stringify({
  locale: 'pt-BR',
  dates: 'DD/MM/AAAA',
  integers: '1.000',
  decimals: '1.000,00',
  unitsDetachedFromValues: true,
  standardDialogs: dialogCount,
}, null, 2));
