// F0 — orquestra a captura visual: garante o Vite em localhost:5173 e executa o
// Electron com scripts/capture-screens.electron.cjs (userData isolado).
// Uso: node scripts/capture-screens.mjs [--out=docs/evidence/f0-baseline/screens] [--mass=pequena]
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const baseUrl = args.url || 'http://localhost:5173';
const outDir = join(root, args.out || 'docs/evidence/f0-baseline/screens');

async function isUp() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

let vite = null;
if (!(await isUp())) {
  process.stderr.write('Vite não está ativo; iniciando servidor de desenvolvimento…\n');
  vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', '5173', '--strictPort'], {
    cwd: root, stdio: 'ignore', shell: process.platform === 'win32',
  });
  const deadline = Date.now() + 60_000;
  while (!(await isUp())) {
    if (Date.now() > deadline) {
      vite.kill();
      console.error('FAIL: Vite não respondeu em 60 s');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const code = await new Promise((resolve) => {
  const child = spawn(electronPath, [join(root, 'scripts', 'capture-screens.electron.cjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CAPTURE_OUT: outDir, CAPTURE_URL: baseUrl, CAPTURE_MASS: args.mass || 'pequena', ELECTRON_DEV: '1' },
  });
  child.on('exit', resolve);
  child.on('error', (error) => { console.error('FAIL:', error.message); resolve(1); });
});

// No Windows o `spawn` com shell cria um cmd; matar só o pai deixa o Vite órfão
// segurando a porta 5173. Encerra a árvore inteira.
if (vite) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' });
  else vite.kill();
}
if (code !== 0) {
  console.error(`FAIL: captura terminou com código ${code}`);
  process.exit(code || 1);
}
console.log(`OK capture-screens → ${outDir}`);
