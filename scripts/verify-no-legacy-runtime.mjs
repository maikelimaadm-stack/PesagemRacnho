import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const removedRuntimeFiles = [
  'src/pages/ModeloBase1VisualLab.jsx',
  'src/components/modelobase1/Fields.jsx',
  'src/components/modelobase1/Filters.jsx',
  'src/components/modelobase1/Table.jsx',
  'src/components/modelobase1/Overlays.jsx',
];

for (const file of removedRuntimeFiles) {
  assert.equal(existsSync(join(root, file)), false, `legado voltou ao runtime: ${file}`);
}

const pages = readFileSync(join(root, 'src/pages.config.js'), 'utf8');
const barrel = readFileSync(join(root, 'src/components/modelobase1/index.js'), 'utf8');
const launch = readFileSync(join(root, 'src/pages/LancamentoPesagensIndividuais.jsx'), 'utf8');
const sequence = readFileSync(join(root, 'src/components/pesagens/SequenciaBrincos.jsx'), 'utf8');
const componentsCss = readFileSync(join(root, 'src/components/modelobase1/modelo-base1-components.css'), 'utf8');

assert(!/ModeloBase1VisualLab/.test(pages), 'laboratório visual não pode ser rota de produção');
assert(!/\.\/(Fields|Filters|Table|Overlays)/.test(barrel), 'barrel não pode exportar módulos de laboratório removidos');
assert(!/window\.__toast/.test(launch + sequence), 'runtime não pode depender de ponte global de toast');
assert.match(sequence, /import \{ toast \} from ["']sonner["']/, 'SequenciaBrincos usa dependência explícita de toast');
assert(!/mb1-(page|section|form-grid|filter-rail|dialog|popover|table-root)/.test(componentsCss), 'CSS de demonstração não pode voltar ao bundle operacional');
assert.match(componentsCss, /\.mb1-scope \.mb1-action-bar/, 'CSS operacional preserva a barra de ações usada');

console.log('OK verify-no-legacy-runtime');
console.log(JSON.stringify({
  removedRuntimeFiles: removedRuntimeFiles.length,
  visualLabRouteRemoved: true,
  globalToastBridgeRemoved: true,
  demoCssRemoved: true,
  operationalActionBarPreserved: true,
}, null, 2));
