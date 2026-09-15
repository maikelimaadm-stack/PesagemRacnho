// Config de apoio para rodar o projeto base (ModeloBase1) sem alterá-lo.
// O projeto tem pares de arquivos que diferem só pela caixa
// (erpOperationBadge.js e ErpOperationBadge.jsx). Em Linux (produção) cada
// import resolve pelo nome exato; no Windows o FS ignora a caixa e o Vite
// resolve ambos para o mesmo arquivo. Este plugin refaz a resolução exata.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE_ROOT = 'C:/Users/maike/Desktop/projeto/arquivos do projetomgdomodelobase1/PROJETOMG-main';
const SRC = path.join(BASE_ROOT, 'src');
const EXTENSIONS = ['.jsx', '.js', '.tsx', '.ts', '.mjs', '.json'];

const baseConfigModule = await import(pathToFileURL(path.join(BASE_ROOT, 'vite.config.js')).href);
const baseConfig = baseConfigModule.default;

function exactCaseResolve(dir, base) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const entries = readdirSync(dir);
  for (const ext of EXTENSIONS) {
    const wanted = `${base}${ext}`;
    if (entries.includes(wanted)) return path.join(dir, wanted);
  }
  if (entries.includes(base) && statSync(path.join(dir, base)).isDirectory()) {
    const indexDir = path.join(dir, base);
    const indexEntries = readdirSync(indexDir);
    for (const ext of EXTENSIONS) {
      if (indexEntries.includes(`index${ext}`)) return path.join(indexDir, `index${ext}`);
    }
  }
  return null;
}

const exactCasePlugin = {
  name: 'exact-case-resolve',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!importer) return null;
    let target = null;
    // O plugin de alias do Vite roda antes e já converte "@/x" em caminho absoluto.
    if (source.startsWith('@/')) target = path.join(SRC, source.slice(2));
    else if (source.startsWith('./') || source.startsWith('../')) target = path.resolve(path.dirname(importer), source);
    else if (path.isAbsolute(source) && path.resolve(source).toLowerCase().startsWith(SRC.toLowerCase())) target = path.resolve(source);
    else return null;
    if (path.extname(target) && existsSync(target)) return null; // já tem extensão explícita
    const resolved = exactCaseResolve(path.dirname(target), path.basename(target));
    if (resolved && /operationbadge/i.test(resolved)) process.stderr.write(`[exact-case] ${source} -> ${resolved}\n`);
    return resolved ? resolved.replace(/\\/g, '/') : null;
  },
};

export default async (env) => {
  const resolved = typeof baseConfig === 'function' ? await baseConfig(env) : baseConfig;
  return {
    ...resolved,
    plugins: [exactCasePlugin, ...(resolved.plugins || [])],
    server: {
      ...(resolved.server || {}),
      host: '127.0.0.1',
      port: 5175,
      strictPort: true,
    },
  };
};
