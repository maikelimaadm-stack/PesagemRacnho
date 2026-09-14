import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyImportLotSelection, importLotKey } from '../src/modules/weighing/domain/importLotSelection.js';

const candidates = [
  { nome_lote: 'Lote A', nome_apartacao: 'Apartação 1', lote_id: 'lote-a', apartacao_id: 'apartacao-1' },
  { nome_lote: 'Lote B', nome_apartacao: 'Apartação 1', lote_id: 'lote-b', apartacao_id: 'apartacao-1' },
];
const rows = [
  { numero_animal: '1', nome_lote: ' lote a ', nome_apartacao: 'APARTAÇÃO 1' },
  { numero_animal: '2', nome_lote: 'LOTE B', nome_apartacao: 'Apartação 1' },
  { numero_animal: '3', nome_lote: 'Não cadastrado', nome_apartacao: 'Outra' },
];
const selected = { [importLotKey(candidates[0])]: true, [importLotKey(candidates[1])]: false };
const result = applyImportLotSelection(rows, candidates, selected);
assert.equal(result.length, 2, 'lote recusado deve permanecer fora da importação');
assert.deepEqual(result.map((row) => row.numero_animal), ['1', '3']);
assert.equal(result[0].lote_id, 'lote-a');
assert.equal(result[0].apartacao_id, 'apartacao-1');
assert.equal(result[1].lote_id, undefined, 'linha sem lote cadastrado não deve receber vínculo');

const relation = await readFile(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
assert.match(relation, /applyImportLotSelection\(importData, lotesParaVincular, vincularLotesSelecionados\)/);
assert.match(relation, /Selecionar todos os lotes encontrados/);
assert.match(relation, /motivoSaidaImport \|\| undefined/);
assert.doesNotMatch(relation, /SelectItem\s+value=\{null\}/);

console.log('OK verify-import-selection');
console.log(JSON.stringify({ selectionPersists: true, rejectedLotsExcluded: true, acceptedLotsLinked: true, importExitReasonSelectable: true }, null, 2));
