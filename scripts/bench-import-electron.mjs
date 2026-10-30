// Medição perf:import:electron (R2-05) — importação conciliada no IndexedDB REAL do Electron do aplicativo, com o
// código-fonte servido pelo Vite e perfil temporário isolado (mesmo arranjo do perf:reconcile:electron). Pesado:
// fora do test:quick/test:full.   xvfb-run -a node scripts/bench-import-electron.mjs 12000 3
import { _electron as electron } from 'playwright';
import { createServer } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const animais = Number(process.argv[2] || 12000);
const eventos = Number(process.argv[3] || 3);
const porta = 5292;
const perfil = mkdtempSync(join(tmpdir(), 'pesagens-bench-import-'));
const server = await createServer({ logLevel: 'error', server: { port: porta, strictPort: true } });
await server.listen();
const app = await electron.launch({
  args: [fileURLToPath(new URL('./lib/benchElectronMain.cjs', import.meta.url)), '--no-sandbox'],
  env: { ...process.env, PESAGENS_BENCH_URL: `http://localhost:${porta}/app-icon.png`, PESAGENS_BENCH_USER_DATA: perfil },
});
try {
  const page = await app.firstWindow();
  await page.waitForLoadState('load');
  page.on('console', (m) => { if (/\[perf\]/.test(m.text())) console.error(m.text()); });
  const versoes = await app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome }));
  const t0 = Date.now();
  const r = await page.evaluate(async ([a, e]) => (await import('/scripts/lib/importBenchCore.mjs')).runImportBench(a, e, { log: (m) => console.log(m) }), [animais, eventos]);
  console.log(JSON.stringify({ motor: `Electron ${versoes.electron} / Chromium ${versoes.chrome} (IndexedDB real)`, total_ms: Date.now() - t0, ...r }, null, 2));
  console.log('OK bench-import-electron');
} finally {
  await app.close();
  await server.close();
  rmSync(perfil, { recursive: true, force: true });
}
