// Captura visual do ModeloBase1 real (Cadastro de Empresas do PROJETOMG-main)
// com a API simulada como em e2e/empresas-view-record-mock.spec.js.
// Usa o Chrome do sistema. Vite do projeto base em http://127.0.0.1:5175.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.OUT || 'C:/Users/maike/Desktop/projeto/MAKGESTAO-main/docs/evidence/modelobase1-referencia';
const BASE = process.env.BASE || 'http://127.0.0.1:5175';
mkdirSync(OUT, { recursive: true });

const MOCK_TOKEN = 'mock-token-e2e';
const mockSession = {
  token: MOCK_TOKEN,
  user: { id: 'user-e2e-mock', cliente_id: 'cliente-mock', login: 'maike', perfil: 'ADMIN', acesso_global: true },
  cliente: { id: 'cliente-mock', codigo: 'kaiman', nome: 'Kaiman' },
  empresas: [{ id: 'emp-1', codempresa: 1, nome_empresa: 'EMPRESA TESTE' }],
  allowAllEmpresas: true,
  selectedEmpresaId: 'all',
};
const cidades = ['Campo Grande', 'Cuiabá', 'Goiânia', 'Uberlândia', 'Rondonópolis', 'Dourados', 'Sinop', 'Rio Verde'];
const items = Array.from({ length: 14 }, (_, i) => ({
  id: `emp-${i + 1}`,
  codempresa: i + 1,
  razao_social: `EMPRESA ${String(i + 1).padStart(2, '0')} AGROPECUARIA LTDA`,
  nome_empresa: `EMPRESA ${String(i + 1).padStart(2, '0')}`,
  nome_fantasia: `FAZENDA ${String(i + 1).padStart(2, '0')}`,
  tipo_pessoa: i % 3 === 0 ? 'PF' : 'PJ',
  cpf_cnpj: i % 3 === 0 ? `123.456.789-${String(10 + i)}` : `12.345.678/0001-${String(10 + i)}`,
  cidade: cidades[i % cidades.length],
  estado: ['MS', 'MT', 'GO', 'MG'][i % 4],
  telefone: `(67) 9${String(9000 + i * 37).padStart(4, '0')}-${String(1000 + i * 91).padStart(4, '0')}`,
  email: `contato${i + 1}@empresa.com.br`,
  status: i % 5 === 4 ? 'Inativa' : 'Ativa',
  campos_personalizados: {},
}));
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiCalls = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  // Só a API do backend é simulada; módulos do Vite (inclusive pastas "api/"
  // dentro de src) seguem para o servidor de desenvolvimento.
  if (!path.startsWith('/api/')) return route.continue();
  apiCalls.push(`${route.request().method()} ${path}${url.search}`);
  if (path === '/api/auth/login' || path === '/api/auth/session') return route.fulfill(json(mockSession));
  if (path === '/api/auth/empresas') return route.fulfill(json({ empresas: mockSession.empresas }));
  if (path === '/api/empresas/campos') return route.fulfill(json({ items: [] }));
  if (path.startsWith('/api/empresas')) return route.fulfill(json({ items, total: items.length, page: 1, pageSize: 50, totalPages: 1 }));
  if (path === '/api/user/preferences/bootstrap') {
    return route.fulfill(json({ preferences: [{
      modulo: 'empresas', tela: 'listagem', versao_schema: 1, updatedAt: new Date().toISOString(),
      preferencias: {
        version: 1,
        viewMode: 'table',
        table: {
          columnOrder: ['codempresa', 'razao_social', 'nome_fantasia', 'tipo_pessoa', 'cpf_cnpj', 'telefone', 'cidade', 'estado', 'status'],
          visibleColumns: ['codempresa', 'razao_social', 'nome_fantasia', 'tipo_pessoa', 'cpf_cnpj', 'telefone', 'cidade', 'estado', 'status'],
        },
      },
    }] }));
  }
  if (path.startsWith('/api/user/preferences/')) return route.fulfill(json({ modulo: 'empresas', tela: 'listagem', versao_schema: 1, preferencias: {}, updatedAt: new Date().toISOString() }));
  if (path.includes('/api/preferences')) return route.fulfill(json({}, 404));
  if (path === '/api/health') return route.fulfill({ status: 200, body: 'ok' });
  return route.fulfill(json({}));
});
await page.addInitScript(({ token }) => { localStorage.setItem('erp_auth_token', token); }, { token: MOCK_TOKEN });

await page.goto(`${BASE}/CadastroEmpresas`, { waitUntil: 'load', timeout: 120_000 });
// Primeira carga do Vite transforma centenas de módulos: espera ativa longa.
const deadline = Date.now() + 120_000;
let ready = false;
while (Date.now() < deadline) {
  ready = await page.evaluate(() => Boolean(document.querySelector('.emp-th-label')) && Boolean(document.querySelector('.emp-table-data-row')));
  if (ready) break;
  await page.waitForTimeout(1000);
}
// Menu lateral fixado cobre a tela: desfixa se estiver aberto.
const unpin = page.getByText('Desfixar menu', { exact: true }).first();
if (await unpin.count()) { try { await unpin.click({ timeout: 3000 }); } catch { /* menu já fechado */ } }
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-cadastro-empresas-tabela.png` });

const structure = await page.evaluate(() => {
  const describe = (el, depth = 0, max = 3) => {
    if (!el || depth > max) return null;
    const tag = el.tagName.toLowerCase();
    const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).slice(0, 6).join('.') : '';
    const text = el.children.length === 0 ? (el.textContent || '').trim().slice(0, 40) : '';
    const attrs = ['placeholder', 'aria-label', 'title', 'data-mak-region', 'data-template-id', 'role'].map((a) => el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : '').filter(Boolean).join(' ');
    const node = `${'  '.repeat(depth)}<${tag}${cls ? '.' + cls : ''}${attrs ? ' ' + attrs : ''}>${text ? ' ' + JSON.stringify(text) : ''}`;
    const kids = [...el.children].map((c) => describe(c, depth + 1, max)).filter(Boolean);
    return [node, ...kids].join('\n');
  };
  const regions = [...document.querySelectorAll('[data-mak-region]')].map((r) => `${r.getAttribute('data-mak-region')} ${Math.round(r.getBoundingClientRect().width)}x${Math.round(r.getBoundingClientRect().height)}px`);
  return {
    regions,
    toolbar: describe(document.querySelector('[data-mak-region="toolbar"]'), 0, 5),
    panelStrip: describe(document.querySelector('[data-mak-region="panel-strip"]'), 0, 5),
    tableHead: describe(document.querySelector('thead tr'), 0, 4),
    firstRow: describe(document.querySelector('.emp-table-data-row'), 0, 2),
    footer: describe(document.querySelector('[data-mak-region="view-stack"] > *:last-child'), 0, 3),
    filterPanel: describe(document.querySelector('#filter-panel'), 0, 4),
    bodyText: (document.body.innerText || '').slice(0, 400),
  };
});

const shots = [];
const tryShot = async (name, fn) => { try { await fn(); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png` }); shots.push(name); } catch (error) { shots.push(`${name}: ${error.message.split('\n')[0]}`); } };
// Inventário dos botões visíveis (classe, rótulo, posição) para o porte.
const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => {
  const r = b.getBoundingClientRect();
  if (!r.width || r.top > 130) return null;
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), cls: (b.className || '').toString().split(' ').filter(Boolean).slice(0, 4).join('.'), label: (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().slice(0, 40) };
}).filter(Boolean));

const clickAt = async (x, y) => { await page.mouse.click(x, y); };
await tryShot('02-painel-filtros-aberto', async () => { await clickAt(26, 54); await page.waitForTimeout(600); });
const filterPanelDom = await page.evaluate(() => { const p = document.querySelector('#filter-panel'); return p ? { open: p.className, width: getComputedStyle(p).width, html: p.outerHTML.slice(0, 3000) } : null; });
await tryShot('03-menu-coluna', async () => { await clickAt(26, 54); await page.waitForTimeout(400); await page.locator('.emp-th-menu-button').first().click({ timeout: 5000 }); });
await tryShot('04-pesquisa-toolbar', async () => { await page.keyboard.press('Escape'); await clickAt(1244, 54); await page.waitForTimeout(400); await page.keyboard.type('EMPRESA 0'); await page.waitForTimeout(800); });
const searchDom = await page.evaluate(() => { const i = document.querySelector('input[type="search"], input[placeholder*="esquis" i], .mg-search input, input[aria-label*="esquis" i]'); if (!i) return null; const box = i.closest('form, div'); return { placeholder: i.placeholder, aria: i.getAttribute('aria-label'), cls: i.className, boxCls: box?.className, boxHtml: box?.outerHTML.slice(0, 1500), dropdown: document.querySelector('[class*="search-results"], [class*="SearchResults"], .mg-search-results')?.outerHTML.slice(0, 1200) || null }; });
await tryShot('05-config-colunas', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.locator('.mg-table-panel-strip__config-btn').first().click({ timeout: 5000 }); });
await tryShot('06-config-filtros', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await clickAt(733, 90); });
await tryShot('07-menu-mais-opcoes', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await clickAt(1413, 54); });
await tryShot('08-pill-filtro-aberta', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await clickAt(376, 90); });

const computed = await page.evaluate(() => {
  const pick = (sel, props) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); const o = { rect: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] }; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  return {
    toolbar: pick('[data-mak-region="toolbar"]', ['height', 'background-color', 'padding-left', 'border-bottom-color']),
    searchInput: pick('[data-mak-region="toolbar"] input', ['height', 'width', 'font-size', 'border-radius', 'background-color', 'border-top-color', 'padding-left']),
    panelStrip: pick('[data-mak-region="panel-strip"]', ['height', 'background-color', 'padding-left']),
    pill: pick('.mg-filter-pill__trigger, .mg-panel-strip__filters button', ['height', 'font-size', 'border-radius', 'background-color', 'border-top-color', 'color', 'padding-left']),
    th: pick('thead th', ['height', 'font-size', 'font-weight', 'color', 'background-color', 'border-bottom-color']),
    td: pick('.emp-table-data-row td', ['height', 'font-size', 'color', 'border-bottom-color']),
    filterPanel: pick('#filter-panel', ['width', 'position', 'background-color']),
    filterInput: pick('#filter-panel input', ['height', 'font-size', 'border-radius', 'background-color']),
  };
});

const report = { ready, errors, apiCalls: apiCalls.slice(0, 20), shots, buttons, filterPanelDom, searchDom, structure, computed };
writeFileSync(`${OUT}/estrutura-dom.json`, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ ready, errors, apiCalls: apiCalls.slice(0, 12), shots, regions: structure.regions, bodyText: structure.bodyText.slice(0, 200) }, null, 2));
await browser.close();
