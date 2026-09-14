import { existsSync, statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const required = [
  'docs/user/GUIA-RAPIDO.md',
  'docs/user/BACKUP-E-RESTAURACAO.md',
  'docs/user/EXPORTAR-DADOS.md',
  'docs/user/INSTALACAO-WINDOWS.md',
  'docs/user/TESTE-MAQUINA-LIMPA.md',
  `docs/release/${version}/RELEASE-NOTES.md`,
  `docs/release/${version}/RELEASE-CHECKLIST.md`,
  'CHANGELOG.md',
];

let failed = false;
const results = required.map((rel) => {
  const full = join(root, rel);
  const exists = existsSync(full);
  const nonEmpty = exists && statSync(full).size > 0;
  if (!exists || !nonEmpty) failed = true;
  return { doc: rel, exists, nonEmpty };
});

for (const r of results) {
  const ok = r.exists && r.nonEmpty ? 'OK ' : 'FAIL';
  console.log(`${ok} ${r.doc}${r.exists && !r.nonEmpty ? ' (vazio)' : ''}${!r.exists ? ' (ausente)' : ''}`);
}

if (failed) {
  console.error('FAIL: documentação de usuário/release incompleta');
  process.exit(1);
}

console.log('OK verify-user-docs');
