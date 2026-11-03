// E2E no Electron REAL (build), perfil temporário, dados sintéticos e balança SIMULADA:
//   1. Entrada com Motivo (Nascimento), marca, sexo, sequência de brincos 7000… e pesagem automática ligada;
//      salva o 7000 → o Nº vai para 7001.
//   2. Trocar para Manejo / Pesagem e voltar para Entrada: tudo continua igual.
//   3. Sair do Lançamento (Relação de Pesagens) e voltar: motivo, sequência, próximo Nº (7001) e pesagem automática
//      continuam — antes desta correção voltavam Compra / sequência zerada / Nº vazio / pesagem automática desligada.
//   4. Bip de peso estável: UM toque quando o peso do animal estabiliza e é liberado; depois de salvar, com o mesmo
//      peso parado na balança, nenhum bip novo (o portão espera o próximo animal); voltar à tela também não bipa.
//      O som é contado pelos osciladores criados no AudioContext real da janela.
// Linux sem tela: npm run build && xvfb-run -a npm run e2e:launch-session:verify
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
const userData = mkdtempSync(join(tmpdir(), 'pesagens-e2e-sessao-'));
const errors = [];
const resumo = [];

const args = [root];
if (process.platform === 'linux') args.push('--no-sandbox');
const app = await _electron.launch({ executablePath: electronPath, args, env: { ...process.env, ELECTRON_DEV: '0', PESAGENS_USER_DATA_DIR: userData, NODE_OPTIONS: '' } });
try {
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  win.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  // Conta os bips: cada bip cria um oscilador no AudioContext da janela.
  await win.addInitScript(() => {
    window.__bips = 0;
    const original = window.AudioContext.prototype.createOscillator;
    window.AudioContext.prototype.createOscillator = function contarBip() { window.__bips += 1; return original.call(this); };
  });
  await win.reload();
  const bips = () => win.evaluate(() => window.__bips);
  const ir = (rota) => win.evaluate((r) => { window.location.hash = `#/${r}`; }, rota);
  const escolherTipo = async (tipo) => {
    await win.locator('button[role="combobox"]').first().click();
    await win.getByRole('option', { name: tipo }).click();
  };

  await win.getByLabel('Nome do administrador').fill('Admin Sessão');
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
  await win.getByLabel('Marca a fogo', { exact: true }).fill('SES');
  await win.getByLabel('Abreviação').fill('SES');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'SES' }).first().waitFor();
  await ir('Equipamentos');
  await win.getByRole('combobox', { name: 'Balança ativa' }).click();
  await win.getByRole('option', { name: /Simulador/ }).click();
  assert.equal(await win.getByLabel('Bip quando o peso estabilizar').isChecked(), true, 'bip ligado por padrão em Equipamentos');

  // 1. Entrada com sequência e balança automática
  await ir('LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo('Entrada (novo animal)');
  await win.getByRole('combobox', { name: 'Motivo da Entrada' }).click();
  await win.getByRole('option', { name: 'Nascimento', exact: true }).click();
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /SES/ }).first().click();
  await win.getByRole('combobox', { name: 'Sexo do animal' }).click();
  await win.getByRole('option', { name: 'F', exact: true }).click();
  await win.getByTitle('Sequência de Brincos').click();
  await win.getByLabel('Ativar sequência').check();
  await win.getByPlaceholder('Ex: 7000').fill('7000');
  await win.getByRole('button', { name: /Iniciar/ }).click();
  assert.equal(await bips(), 0, 'nenhum bip antes de ligar a pesagem automática');
  await win.getByRole('button', { name: 'Ligar pesagem automática' }).click();
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 15000 });
  await win.waitForFunction(() => window.__bips >= 1, null, { timeout: 10000 });
  await win.waitForTimeout(2500);
  assert.equal(await bips(), 1, 'UM bip quando o peso estabilizou (não repete com o animal parado)');
  await win.getByRole('button', { name: /^Salvar/ }).click();
  await win.getByText(/Entrada confirmada: animal 7000/).first().waitFor({ timeout: 15000 });
  await win.waitForTimeout(3000);
  assert.equal(await bips(), 1, 'depois de salvar, o mesmo peso parado na balança não bipa de novo');
  resumo.push('Bip: 1 toque quando o peso estabilizou; nenhum enquanto o animal fica parado nem depois de salvar com o mesmo peso');

  const foto = () => win.evaluate(() => {
    const combo = (rotulo) => [...document.querySelectorAll('button[role="combobox"]')].find((b) => b.getAttribute('aria-label') === rotulo)?.textContent?.trim() ?? null;
    const campo = (ph) => document.querySelector(`input[placeholder="${ph}"]`);
    return {
      tipo: document.querySelector('button[role="combobox"]')?.textContent?.trim(),
      motivoEntrada: combo('Motivo da Entrada'),
      marca: combo('Marca do animal'),
      sexo: combo('Sexo do animal'),
      numero: campo('Ex: 1234')?.value,
      sequenciaMarcada: document.querySelector('#usar-sequencia-brincos')?.getAttribute('data-state'),
      sequenciaInicial: campo('Ex: 7000')?.value,
      pesagemAutomatica: [...document.querySelectorAll('button')].some((b) => /Desligar pesagem automática/.test(b.getAttribute('aria-label') || '')),
    };
  });
  const antes = await foto();
  assert.deepEqual(antes, { tipo: 'Entrada (novo animal)', motivoEntrada: 'Nascimento', marca: 'SES', sexo: 'F', numero: '7001', sequenciaMarcada: 'checked', sequenciaInicial: '7000', pesagemAutomatica: true });

  // 2. Manejo e volta
  await escolherTipo('Manejo / Pesagem');
  await win.waitForTimeout(500);
  await escolherTipo('Entrada (novo animal)');
  await win.waitForTimeout(500);
  assert.deepEqual(await foto(), antes, 'trocar para Manejo e voltar mantém tudo');
  resumo.push('Entrada → Manejo / Pesagem → Entrada: motivo, marca, sexo, sequência, Nº 7001 e pesagem automática mantidos');

  // 3. Sair do Lançamento e voltar
  await ir('PesagensIndividuais');
  await win.getByText('Relação de Pesagens').first().waitFor();
  await win.waitForTimeout(500);
  await ir('LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await win.getByRole('button', { name: 'Desligar pesagem automática' }).waitFor({ timeout: 15000 });
  await win.waitForTimeout(800);
  assert.deepEqual(await foto(), antes, 'sair do Lançamento e voltar mantém motivo, sequência, Nº e pesagem automática');
  await win.waitForTimeout(2500);
  assert.equal(await bips(), 1, 'voltar à tela com o mesmo animal (já salvo) parado na balança não bipa');
  resumo.push('Sair do Lançamento (Relação) e voltar: motivo, sequência, Nº 7001 e pesagem automática voltam; sem bip falso');

  await app.close();
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);
  console.log('OK verify-launch-session-beep-e2e');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  await app.close().catch(() => {});
  rmSync(userData, { recursive: true, force: true });
}
