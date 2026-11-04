// E2E no Electron REAL (build), perfil temporário, dados sintéticos e balança SIMULADA (modo do S3: só envia
// quando o número muda):
//   1. Troca de modo com a pesagem automática ligada e o animal parado na balança: o Peso NÃO zera
//      (antes ficava vazio até o animal se mexer) e o lançamento salva com o peso estável.
//   2. Quadro opcional de peso e lote destino ao lado da Distribuição de Lotes: desligado por padrão; mostra o
//      mesmo peso do campo e o lote destino da apartação; Grande/Pequeno; lembra a escolha; ocultar.
// Linux sem tela: npm run build && xvfb-run -a npm run e2e:weight-board:verify
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
const userData = mkdtempSync(join(tmpdir(), 'pesagens-e2e-quadro-'));
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
  const quadro = () => win.getByRole('region', { name: 'Peso e lote destino' });
  const fotoQuadro = () => win.evaluate(() => {
    const el = document.querySelector('.d17d-weight-board');
    if (!el) return null;
    return {
      peso: el.querySelector('output')?.textContent,
      lote: el.querySelector('.d17d-weight-board__lot strong')?.textContent,
      estagio: el.getAttribute('data-estagio'),
      tamanho: el.classList.contains('is-large') ? 'grande' : 'pequeno',
    };
  });

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
  await win.getByRole('combobox', { name: 'Balança ativa' }).click();
  await win.getByRole('option', { name: /Simulador/ }).click();

  await ir('LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo('Entrada (novo animal)');
  await win.getByRole('combobox', { name: 'Motivo da Entrada' }).click();
  await win.getByRole('option', { name: 'Nascimento', exact: true }).click();
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /QDR/ }).first().click();
  await win.getByRole('combobox', { name: 'Sexo do animal' }).click();
  await win.getByRole('option', { name: 'F', exact: true }).click();
  // Apartação sintética (escolhida na Entrada — cada modo guarda o seu contexto): LEVES até 299 kg, PESADOS de 300 a 600 kg (o simulador para em 328,4 kg).
  await win.getByTitle('Gerenciar Apartações').click();
  await win.getByPlaceholder('Ex: ROTINA').fill('ROTINA');
  await win.getByRole('button', { name: /^Salvar|^Adicionar/ }).first().click();
  await win.getByRole('dialog').getByText('ROTINA').first().waitFor();
  await win.getByRole('button', { name: 'Lotes', exact: true }).click();
  const novoLote = async (nome, min, max) => {
    const dlg = win.getByRole('dialog');
    await dlg.getByPlaceholder('Ex: BOIADA').fill(nome);
    const campos = dlg.locator('input[inputmode="decimal"]');
    await campos.nth(0).fill(min);
    await campos.nth(1).fill(max);
    await dlg.getByRole('button', { name: 'Adicionar' }).click();
    await dlg.getByText(nome, { exact: true }).first().waitFor();
  };
  await novoLote('LEVES', '0', '299');
  await novoLote('PESADOS', '300', '600');
  await win.getByRole('button', { name: 'Apartações', exact: true }).click();
  await win.getByRole('dialog').getByRole('button', { name: 'Usar' }).first().click();
  await win.getByRole('dialog').waitFor({ state: 'detached' });

  // 2. Quadro: desligado por padrão; liga pelo botão da Distribuição de Lotes.
  assert.equal(await quadro().count(), 0, 'quadro de peso desligado por padrão');
  await win.getByRole('button', { name: 'Mostrar quadro de peso e lote' }).click();
  await quadro().waitFor();
  await win.getByPlaceholder('Ex: 1234').fill('7001');
  await campoPeso().fill('180');
  await win.waitForTimeout(300);
  assert.deepEqual(await fotoQuadro(), { peso: '180', lote: 'LEVES', estagio: 'manual', tamanho: 'grande' }, 'peso digitado e lote pela faixa');
  await campoPeso().fill('');
  await win.getByPlaceholder('Ex: 1234').fill('');

  // Pesagem automática: o quadro acompanha o campo Peso e o lote destino.
  await win.getByRole('button', { name: 'Ligar pesagem automática' }).click();
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 15000 });
  await win.waitForTimeout(300);
  assert.equal(await campoPeso().inputValue(), '328');
  assert.deepEqual(await fotoQuadro(), { peso: '328', lote: 'PESADOS', estagio: 'stable', tamanho: 'grande' }, 'quadro = campo Peso, lote pela faixa');
  resumo.push('Quadro: desligado por padrão; mostra o mesmo peso do campo (digitado 180 → LEVES; balança 328 estável → PESADOS)');

  // 1. Entrada → Manejo com o animal parado na balança: o Peso continua 328 e estável.
  await escolherTipo('Manejo / Pesagem');
  await win.waitForTimeout(1500);
  assert.equal(await campoPeso().inputValue(), '328', 'trocar Entrada → Manejo não zera o Peso da balança');
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 2000 });
  assert.equal((await fotoQuadro()).peso, '328', 'quadro também mantém o peso');
  // Volta para a Entrada (ainda sem mexer no animal): salva com o peso estável que não foi usado.
  await escolherTipo('Entrada (novo animal)');
  await win.waitForTimeout(800);
  assert.equal(await campoPeso().inputValue(), '328', 'voltar para a Entrada também mantém o Peso');
  await win.getByPlaceholder('Ex: 1234').fill('7002');
  await win.getByRole('button', { name: /^Salvar/ }).click();
  await win.getByText(/Entrada confirmada: animal 7002/).first().waitFor({ timeout: 15000 });
  await win.locator('table tbody tr').filter({ hasText: '7002' }).filter({ hasText: '328' }).first().waitFor({ timeout: 15000 });
  resumo.push('Entrada → Manejo → Entrada com a balança estável: o Peso continua 328 (estável) e salva o 7002 com 328 sem mexer o animal');

  // Grande / Pequeno, lembrado depois de recarregar; ocultar devolve o botão.
  await win.getByRole('button', { name: 'Diminuir quadro de peso' }).click();
  assert.equal((await fotoQuadro()).tamanho, 'pequeno');
  await win.reload();
  await win.getByText('Tipo de Movimentação').waitFor();
  await quadro().waitFor({ timeout: 15000 });
  assert.equal((await fotoQuadro()).tamanho, 'pequeno', 'tamanho lembrado ao reabrir');
  await win.getByRole('button', { name: 'Aumentar quadro de peso' }).click();
  assert.equal((await fotoQuadro()).tamanho, 'grande');
  await win.getByRole('button', { name: 'Ocultar quadro de peso' }).click();
  assert.equal(await quadro().count(), 0, 'ocultar some com o quadro');
  await win.getByRole('button', { name: 'Mostrar quadro de peso e lote' }).waitFor();
  resumo.push('Quadro: Grande ↔ Pequeno, lembrado ao reabrir; Ocultar devolve o botão de mostrar');

  for (const largura of [1440, 1024]) {
    await win.getByRole('button', { name: 'Mostrar quadro de peso e lote' }).click().catch(() => {});
    await win.setViewportSize({ width: largura, height: 860 });
    await win.waitForTimeout(300);
    const rolagem = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(rolagem <= 1, `sem rolagem horizontal em ${largura}px (${rolagem})`);
    if (process.env.QUADRO_SHOT_DIR) await win.screenshot({ path: join(process.env.QUADRO_SHOT_DIR, `quadro-${largura}.png`) });
  }

  await app.close();
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);
  console.log('OK verify-weight-board-e2e');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  await app.close().catch(() => {});
  rmSync(userData, { recursive: true, force: true });
}
