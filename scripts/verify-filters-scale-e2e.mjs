// E2E no Electron REAL (build), perfil temporário, dados sintéticos e balança SIMULADA — correções da 1.6.2:
//   1. Filtro da coluna: a condição escolhida vale ("Maior que" 250 → só 320 e 410; "Termina com" 3 → só 103) —
//      antes aparecia a lista de caixas e marcar um valor virava "é um destes", ignorando a condição;
//      a lista "Condição" abre POR CIMA do filtro (antes abria atrás e escondia as primeiras opções).
//   2. Manejo: número digitado e Salvar na hora (sem sair do campo) reconhece o animal cadastrado — antes dava
//      "Selecione o animal cadastrado antes de salvar".
//   3. Animal que entrou sem peso digitado no Manejo: aviso "entrou sem peso" com "Pesar em Entrada", que leva à
//      Entrada com o número e a marca; a 1ª pesagem adota o mesmo animal.
//   4. Pesagem automática: "Esse peso já foi usado" traz "Liberar peso"; liberado, o próximo animal salva.
// Linux sem tela: npm run build && xvfb-run -a npm run e2e:filters-scale:verify
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');
assert.ok(existsSync(join(root, 'dist', 'index.html')), 'rode npm run build antes do E2E');
const userData = mkdtempSync(join(tmpdir(), 'pesagens-e2e-162-'));
const errors = [];
const resumo = [];

const args = [root];
if (process.platform === 'linux') args.push('--no-sandbox');
const app = await _electron.launch({ executablePath: electronPath, args, env: { ...process.env, ELECTRON_DEV: '0', PESAGENS_USER_DATA_DIR: userData, NODE_OPTIONS: '' } });
try {
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  win.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  const ir = (rota) => win.evaluate((r) => { window.location.hash = `#/${r}`; }, rota);
  const escolherTipo = async (tipo) => {
    await win.locator('button[role="combobox"]').first().click();
    await win.getByRole('option', { name: tipo }).click();
  };
  const campoPeso = () => win.getByPlaceholder('Ex: 320');
  await win.getByLabel('Nome do administrador').fill('Admin Quadro');
  await win.getByLabel('Login', { exact: true }).fill('gestor');
  await win.getByLabel('Senha', { exact: true }).fill('Curral#2026');
  await win.getByLabel('Confirmar senha').fill('Curral#2026');
  await win.getByRole('button', { name: 'Criar administrador' }).click();
  await win.getByLabel('Guardei a chave').check();
  await win.getByRole('button', { name: 'Ir para o login' }).click();
  await win.getByLabel('Login', { exact: true }).fill('gestor');
  await win.getByLabel('Senha', { exact: true }).fill('Curral#2026');
  await win.keyboard.press('Enter');
  await win.getByText('Relação de Pesagens').first().waitFor();
  await ir('Marcas');
  await win.locator('.aux-new-button').first().click();
  await win.getByLabel('Marca a fogo', { exact: true }).fill('QDR');
  await win.getByLabel('Abreviação').fill('QDR');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'QDR' }).first().waitFor();
  await ir('Equipamentos');
  const toasts = () => win.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent));
  const salvar = () => win.getByRole('button', { name: /^Salvar/ }).dispatchEvent('click');
  const numero = () => win.getByPlaceholder('Ex: 1234');
  const linhas = () => win.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((r) => [...r.cells].map((c) => c.textContent.trim()).join('|')));

  // Animais 101–104 (Entrada com peso digitado) e 7000 (Entrada sem peso).
  await ir('LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo('Entrada (novo animal)');
  await win.getByRole('combobox', { name: 'Motivo da Entrada' }).click();
  await win.getByRole('option', { name: 'Nascimento', exact: true }).click();
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /QDR/ }).first().click();
  await win.getByRole('combobox', { name: 'Sexo do animal' }).click();
  await win.getByRole('option', { name: 'F', exact: true }).click();
  for (const [n, p] of [['101', '180'], ['102', '250'], ['103', '320'], ['104', '410']]) {
    await numero().fill(n);
    await campoPeso().fill(p);
    await salvar();
    await win.getByText(new RegExp(`Entrada confirmada: animal ${n}`)).first().waitFor({ timeout: 15000 });
  }
  await numero().fill('7000');
  await win.getByLabel('Entrada sem peso').check();
  await salvar();
  await win.getByText(/Entrada confirmada: animal 7000/).first().waitFor({ timeout: 15000 });

  // 2. Manejo: digita 101 e salva na hora (sem Tab/blur).
  await escolherTipo('Manejo / Pesagem');
  await win.waitForTimeout(400);
  await numero().fill('101');
  await campoPeso().fill('190');
  await salvar();
  await win.waitForTimeout(1500);
  const t2 = (await toasts()).join(' | ');
  assert.ok(!/Selecione o animal cadastrado/.test(t2), `Salvar logo depois de digitar reconhece o animal: ${t2}`);
  assert.ok(/já possui lançamento hoje/.test(t2), `chegou à conferência do animal 101 (mesmo dia): ${t2}`);
  resumo.push('Manejo: número digitado e Salvar na hora reconhece o animal 101 (não pede mais "Selecione o animal cadastrado")');

  // 3. Animal que entrou sem peso: aviso com "Pesar em Entrada" → Entrada com 7000/QDR → 1ª pesagem adota o animal.
  await numero().fill('7000');
  await numero().press('Tab');
  await win.getByText(/Animal 7000 entrou sem peso/).first().waitFor({ timeout: 5000 });
  assert.ok(!(await toasts()).some((t) => /7000 não cadastrado/.test(t)), 'não diz "não cadastrado" para animal que entrou sem peso');
  await win.getByRole('button', { name: 'Pesar em Entrada' }).click();
  await win.waitForTimeout(600);
  assert.equal(await win.locator('button[role="combobox"]').first().textContent(), 'Entrada (novo animal)');
  assert.equal(await numero().inputValue(), '7000');
  assert.match(await win.getByRole('combobox', { name: 'Marca do animal' }).textContent(), /QDR/);
  await campoPeso().fill('300');
  await salvar();
  await win.getByText(/Primeira pesagem do animal 7000/).first().waitFor({ timeout: 15000 });
  resumo.push('Animal que entrou sem peso digitado no Manejo: aviso "entrou sem peso" + "Pesar em Entrada" (Entrada com 7000/QDR); a 1ª pesagem adota o mesmo animal');

  // 4. Pesagem automática: peso usado → "Liberar peso" → próximo animal salva.
  await ir('Equipamentos');
  await win.getByRole('combobox', { name: 'Balança ativa' }).click();
  await win.getByRole('option', { name: /Simulador/ }).click();
  await ir('LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await win.getByRole('button', { name: 'Ligar pesagem automática' }).click();
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 15000 });
  await numero().fill('8001');
  await salvar();
  await win.getByText(/Entrada confirmada: animal 8001/).first().waitFor({ timeout: 15000 });
  await numero().fill('8002');
  await salvar();
  await win.getByText(/Esse peso já foi usado no animal anterior/).first().waitFor({ timeout: 5000 });
  await win.getByRole('button', { name: 'Liberar peso' }).click();
  await win.getByText(/Peso da balança liberado para este animal \(328\)/).first().waitFor({ timeout: 5000 });
  await numero().fill('8002');
  await salvar();
  await win.getByText(/Entrada confirmada: animal 8002/).first().waitFor({ timeout: 15000 });
  resumo.push('Pesagem automática: "Esse peso já foi usado" traz "Liberar peso"; liberado, o 8002 salva com 328 (continua exigindo peso estável)');
  await win.getByRole('button', { name: 'Desligar pesagem automática' }).click();

  // 1. Filtros da Relação.
  await ir('PesagensIndividuais');
  await win.getByText('Relação de Pesagens').first().waitFor();
  await win.waitForTimeout(1200);
  const abrirFiltro = async (coluna) => {
    await win.getByRole('button', { name: `Abrir menu da coluna ${coluna}` }).first().click();
    await win.getByText('Abrir filtro avançado').click();
    await win.locator('.mak-column-filter').waitFor();
  };
  const escolherCondicao = async (nome) => {
    await win.getByRole('button', { name: /Condição do filtro/ }).click();
    const opcao = win.getByRole('option', { name: nome, exact: true });
    await opcao.waitFor();
    // A lista está por cima do filtro: o ponto da 1ª opção pertence à lista, não ao painel do filtro.
    const porCima = await win.evaluate(() => {
      const primeira = document.querySelector('.mak-condition-popover [role="option"]');
      const r = primeira.getBoundingClientRect();
      return Boolean(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.mak-condition-popover'));
    });
    assert.ok(porCima, 'lista "Condição" abre por cima do filtro da coluna');
    await opcao.click();
  };
  await abrirFiltro('Peso');
  await escolherCondicao('Maior que');
  assert.equal(await win.locator('.mak-column-filter__option').count(), 0, '"Maior que" não mostra a lista de caixas');
  await win.locator('.mak-column-filter__input').fill('250');
  await win.getByRole('button', { name: 'OK' }).click();
  await win.waitForTimeout(500);
  const animaisListados = async () => (await linhas()).map((l) => l.split('|').find((c) => /^(10[1-4]|7000|800[12])$/.test(c))).filter(Boolean).sort();
  const maior = await animaisListados();
  assert.deepEqual(maior, ['103', '104', '7000', '8001', '8002'], `Peso maior que 250 → 103, 104, 7000 (300), 8001 e 8002 (328): ${maior}`);
  await win.getByRole('button', { name: /Limpar filtro da coluna Peso/ }).first().click();
  await win.waitForTimeout(400);
  await abrirFiltro('Animal');
  await escolherCondicao('Termina com');
  await win.locator('.mak-column-filter__input').fill('3');
  await win.getByRole('button', { name: 'OK' }).click();
  await win.waitForTimeout(500);
  const termina = await animaisListados();
  assert.deepEqual(termina, ['103'], `Animal termina com 3 → só 103: ${termina}`);
  resumo.push('Filtros: "Maior que" 250 no Peso → 103, 104, 7000, 8001 e 8002 (180 e 250 ficam fora); "Termina com" 3 no Animal → 103; a lista de condições abre por cima do filtro');
  if (process.env.SHOT_DIR) await win.screenshot({ path: join(process.env.SHOT_DIR, 'filtro-162.png') });

  await app.close();
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);
  console.log('OK verify-filters-scale-e2e');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  await app.close().catch(() => {});
  rmSync(userData, { recursive: true, force: true });
}
