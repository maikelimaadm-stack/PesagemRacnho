// Medição perf:reconcile:electron (R08) — "Reconciliar derivados" no IndexedDB REAL do Electron do aplicativo
// (Chromium do Electron), com o código-fonte servido pelo Vite e perfil temporário isolado. Fora do test:quick
// (pesado): job de desempenho ou à mão, com tela virtual no Linux:
//   xvfb-run -a node scripts/bench-reconcile-electron.mjs 1000 5000 12000
import { _electron as electron } from 'playwright';
import { createServer } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tamanhos = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const porta = 5291;
const perfil = mkdtempSync(join(tmpdir(), 'pesagens-bench-'));
const server = await createServer({ logLevel: 'error', server: { port: porta, strictPort: true } });
await server.listen();
const app = await electron.launch({
  args: [fileURLToPath(new URL('./lib/benchElectronMain.cjs', import.meta.url)), '--no-sandbox'],
  env: { ...process.env, PESAGENS_BENCH_URL: `http://localhost:${porta}/app-icon.png`, PESAGENS_BENCH_USER_DATA: perfil },
});
try {
  const page = await app.firstWindow();
  await page.waitForLoadState('load');
  const versao = await app.evaluate(() => process.versions.chrome);
  const electronV = await app.evaluate(() => process.versions.electron);
  for (const n of tamanhos.length ? tamanhos : [1000]) {
    const r = await page.evaluate(async (qtd) => (await import('/scripts/lib/reconcileBenchCore.mjs')).runReconcileBench(qtd), n);
    console.log(JSON.stringify({ motor: `Electron ${electronV} / Chromium ${versao} (IndexedDB real)`, ...r }));
  }
  console.log('OK bench-reconcile-electron');
} finally {
  await app.close();
  await server.close();
  rmSync(perfil, { recursive: true, force: true });
}
