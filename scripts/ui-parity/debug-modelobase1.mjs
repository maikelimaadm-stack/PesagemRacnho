// Diagnóstico: por que o Cadastro de Empresas do projeto base não renderiza com a API simulada.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

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
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiCalls = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
const page = await context.newPage();
const errors = [];
const consoleErrors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`${msg.type()}: ${msg.text().slice(0, 300)}`); });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (!path.startsWith('/api/')) return route.continue();
  apiCalls.push(`${route.request().method()} ${path}${url.search}`);
  if (path === '/api/auth/login' || path === '/api/auth/session') return route.fulfill(json(mockSession));
  if (path === '/api/auth/empresas') return route.fulfill(json({ empresas: mockSession.empresas }));
  if (path === '/api/empresas/campos') return route.fulfill(json({ items: [] }));
  if (path.startsWith('/api/empresas')) return route.fulfill(json({ items: [{ id: 'emp-1', codempresa: 1, razao_social: 'EMPRESA TESTE LTDA', nome_empresa: 'EMPRESA TESTE', tipo_pessoa: 'PJ', status: 'Ativa', campos_personalizados: {} }], total: 1, page: 1, pageSize: 50, totalPages: 1 }));
  if (path.includes('/api/preferences')) return route.fulfill(json({}, 404));
  if (path === '/api/health') return route.fulfill({ status: 200, body: 'ok' });
  return route.fulfill(json({}));
});
await page.addInitScript(({ token }) => { localStorage.setItem('erp_auth_token', token); }, { token: MOCK_TOKEN });

await page.goto(`${BASE}/CadastroEmpresas`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/00-debug.png` });
const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 800));
const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(Boolean).slice(0, 40));
console.log(JSON.stringify({ url: page.url(), errors, consoleErrors: consoleErrors.slice(0, 15), apiCalls: apiCalls.slice(0, 30), text, buttons }, null, 2));
await browser.close();
