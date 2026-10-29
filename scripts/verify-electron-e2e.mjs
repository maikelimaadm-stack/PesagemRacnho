// E2E real do app desktop: abre o Electron com Playwright e percorre o fluxo do
// curral pela interface, como o usuário faria. Diferente dos gates que leem o
// fonte, este prova comportamento: primeiro acesso → marca → Cadastro → Manejo →
// repesagem → peso fora da faixa (justificativa) → desfazer → Relação → fechar e
// reabrir com os dados no lugar → balança chegando a estável → Relatórios.
//
// Linux sem tela: xvfb-run -a npm run e2e:electron:verify
// Pede o build da interface (npm run build) antes: o main carrega dist/.
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

const LOGIN = 'gestor';
const SENHA = 'Curral#2026';
const userData = mkdtempSync(join(tmpdir(), 'pesagens-e2e-'));
const errors = [];

async function abrir() {
  const args = [root];
  // Root em container Linux (CI) exige --no-sandbox; no Windows o sandbox fica.
  if (process.platform === 'linux') args.push('--no-sandbox');
  const app = await _electron.launch({
    executablePath: electronPath,
    args,
    env: { ...process.env, ELECTRON_DEV: '0', PESAGENS_USER_DATA_DIR: userData, NODE_OPTIONS: '' },
  });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  win.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  return { app, win };
}

async function entrar(win) {
  await win.getByLabel('Login', { exact: true }).fill(LOGIN);
  await win.getByLabel('Senha', { exact: true }).fill(SENHA);
  await win.keyboard.press('Enter');
  await win.getByText('Relação de Pesagens').first().waitFor();
}

const irPara = (win, rota) => win.evaluate((r) => { window.location.hash = `#/${r}`; }, rota);

async function escolherTipo(win, tipo) {
  await win.locator('button[role="combobox"]').first().click();
  await win.getByRole('option', { name: tipo }).click();
}

async function lancar(win, numero, peso) {
  const ident = win.getByPlaceholder('Ex: 1234');
  await ident.fill(numero);
  await ident.press('Tab');
  await win.getByPlaceholder('Ex: 320').fill(peso);
  await win.getByRole('button', { name: /^Salvar/ }).click();
}

async function escolherData(win, quando) {
  await win.getByLabel('Data da pesagem', { exact: true }).click();
  const calendario = win.getByRole('dialog', { name: 'Calendário: Data da pesagem' });
  if (quando === 'hoje') {
    await calendario.getByRole('button', { name: 'Hoje' }).click();
  } else {
    await calendario.getByRole('button', { name: 'Mês anterior' }).click();
    await calendario.locator('[role="gridcell"]:not(.is-outside)', { hasText: /^1$/ }).click();
  }
}

const linhasDoNumero = (win, numero) => win.locator('table tbody tr').filter({ hasText: numero });

// Espera a contagem chegar a `esperado` (a tabela pode re-renderizar ao trocar de tela).
async function contarLinhas(win, numero, esperado, timeout = 15000) {
  const fim = Date.now() + timeout;
  let atual = -1;
  while (Date.now() < fim) {
    atual = await linhasDoNumero(win, numero).count();
    if (atual === esperado) return atual;
    await win.waitForTimeout(250);
  }
  return atual;
}

const RELACAO = 'Consulta, filtros e gestão dos registros de pesagem';

try {
  // 1. Primeiro acesso: administrador, chave de recuperação e login.
  let { app, win } = await abrir();
  await win.getByLabel('Nome do administrador').fill('Admin E2E');
  await win.getByLabel('Login', { exact: true }).fill(LOGIN);
  await win.getByLabel('Senha', { exact: true }).fill(SENHA);
  await win.getByLabel('Confirmar senha').fill(SENHA);
  await win.getByRole('button', { name: 'Criar administrador' }).click();
  await win.getByLabel('Guardei a chave').check();
  await win.getByRole('button', { name: 'Ir para o login' }).click();
  await entrar(win);

  // 2. Cadastro mestre: uma marca para o animal novo.
  await irPara(win, 'Marcas');
  await win.locator('.aux-new-button').first().click();
  await win.getByLabel('Marca', { exact: true }).fill('E2E');
  await win.getByLabel('Abreviação').fill('E2E');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'E2E' }).first().waitFor();

  // 3. Lançamento — Cadastro no dia 1º do mês passado, Manejo hoje. A tabela do
  // Lançamento mostra só o dia escolhido; a regra do dia recusa um segundo
  // lançamento do mesmo animal na mesma data.
  await irPara(win, 'LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo(win, 'Cadastro (Novo Animal)');
  await escolherData(win, 'mes-passado');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /E2E/ }).first().click();
  await lancar(win, '7001', '320');
  await linhasDoNumero(win, '7001').first().waitFor();

  await escolherTipo(win, 'Manejo (Pesagem Periódica)');
  await escolherData(win, 'hoje');
  await lancar(win, '7001', '350');
  await linhasDoNumero(win, '7001').first().waitFor();
  assert.equal(await linhasDoNumero(win, '7001').count(), 1, 'Lançamento de hoje mostra o Manejo do 7001');

  // Segundo Manejo no mesmo dia: o app pergunta e a repesagem substitui o peso.
  await lancar(win, '7001', '360');
  const repesar = win.getByRole('dialog').filter({ hasText: 'Esse animal já foi pesado hoje. Repesar?' });
  await repesar.waitFor();
  await repesar.getByRole('button', { name: 'Repesar (substitui)' }).click();
  await linhasDoNumero(win, '7001').filter({ hasText: '360' }).first().waitFor();
  assert.equal(await contarLinhas(win, '7001', 1), 1, 'repesagem substitui a pesagem do dia (uma linha, 360 kg)');

  // Peso fora da faixa (> 1500 kg): pede justificativa antes de gravar.
  await escolherTipo(win, 'Cadastro (Novo Animal)');
  await escolherData(win, 'hoje');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /E2E/ }).first().click();
  await lancar(win, '7002', '1600');
  const conferir = win.getByRole('dialog').filter({ hasText: 'Conferir peso informado' });
  await conferir.waitFor();
  const confirmarPeso = conferir.getByRole('button', { name: 'Confirmar e salvar' });
  assert.equal(await confirmarPeso.isDisabled(), true, 'peso fora da faixa só segue com justificativa');
  await conferir.getByLabel('Justificativa para continuar').fill('conferido na balança');
  await confirmarPeso.click();
  await linhasDoNumero(win, '7002').first().waitFor();

  // Desfazer o último lançamento: confirma e exclui só ele.
  await win.getByRole('button', { name: 'Desfazer' }).click();
  const excluir = win.getByRole('dialog').filter({ hasText: 'Confirmar exclusão' });
  await excluir.getByText('Somente este lançamento de 7002').waitFor();
  await excluir.getByRole('button', { name: 'Excluir' }).click();
  assert.equal(await contarLinhas(win, '7002', 0), 0, 'Desfazer exclui o lançamento do 7002');

  // 4. Relação de Pesagens lista as duas pesagens.
  await irPara(win, 'PesagensIndividuais');
  await win.getByText(RELACAO).waitFor();
  assert.equal(await contarLinhas(win, '7001', 2), 2, 'Relação lista as duas pesagens válidas do 7001 (Cadastro + Manejo repesado)');

  // 5. Fechar e reabrir: os dados ficam no IndexedDB do perfil.
  await app.close();
  ({ app, win } = await abrir());
  await entrar(win);
  await win.getByText(RELACAO).waitFor();
  assert.equal(await contarLinhas(win, '7001', 2), 2, 'pesagens continuam após reabrir o app');

  // 6. Cadastro feito depois de abrir a Relação aparece na edição em lote dela
  // (a Relação já tinha carregado as marcas antes; não pode ficar com a lista velha).
  await irPara(win, 'Marcas');
  await win.locator('.aux-new-button').first().click();
  await win.getByLabel('Marca', { exact: true }).fill('NOVA');
  await win.getByLabel('Abreviação').fill('NOV');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'NOVA' }).first().waitFor();
  await irPara(win, 'PesagensIndividuais');
  await win.getByText(RELACAO).waitFor();
  await win.getByLabel('Selecionar pesagem 7001').first().click();
  await win.getByRole('button', { name: /Ações para 1 registros selecionados/ }).click();
  await win.getByRole('menuitem', { name: /Identificação e classificação/ }).click();
  const perfil = win.getByRole('dialog').filter({ hasText: 'Identificação e classificação' });
  await perfil.getByText('Marca', { exact: true }).locator('..').getByRole('combobox').click();
  const novaVisivel = await win.getByRole('option', { name: 'NOVA' }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  assert.ok(novaVisivel, 'marca criada depois de abrir a Relação aparece na edição em lote');
  await win.keyboard.press('Escape');

  // 7. Balança (simulador no modo do S3 real: só envia o peso quando muda e nunca
  // marca estável). Com a pesagem automática, o campo Peso tem de chegar a estável
  // quando o número para — era o defeito: o monitor estabilizava e o app não.
  await irPara(win, 'Configuracoes');
  await win.getByRole('combobox', { name: 'Balança ativa' }).click();
  await win.getByRole('option', { name: /Simulador/ }).click();
  await irPara(win, 'LancamentoPesagensIndividuais');
  await win.getByRole('button', { name: 'Ligar pesagem automática' }).click();
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 15000 });
  assert.equal(await win.getByPlaceholder('Ex: 320').inputValue(), '328', 'peso estável do monitor no campo');
  await win.getByRole('button', { name: 'Desligar pesagem automática' }).click();

  // 8. Relatórios abre sem erro.
  await irPara(win, 'Relatorios');
  await win.getByText('Relatório de Pesagens Individuais').first().waitFor();

  await app.close();
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);
  console.log('OK verify-electron-e2e');
} finally {
  rmSync(userData, { recursive: true, force: true });
}
