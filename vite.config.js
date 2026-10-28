import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Marcadores de build (ADR-047): commit curto e instante do build entram no bundle
// como __BUILD_INFO__ e são exibidos em Manutenção › Status › Versões. Sem git
// disponível, gitCommit fica null (nunca quebra o build).
function resolveGitCommit() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    if (!commit) return null;
    // Árvore com alterações não commitadas → sufixo "-dirty" (o manifesto e a
    // Manutenção deixam claro que o build não corresponde exatamente ao commit).
    const dirty = execSync('git status --porcelain', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim().length > 0;
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return null;
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __RELEASE_FEED_URL__: JSON.stringify(String(process.env.RELEASE_FEED_URL || '').trim()),
    __BUILD_INFO__: JSON.stringify({
      gitCommit: resolveGitCommit(),
      buildTimestamp: new Date().toISOString(),
    }),
  },
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/dist/**',
        '**/release/**',
        '**/release-*/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
