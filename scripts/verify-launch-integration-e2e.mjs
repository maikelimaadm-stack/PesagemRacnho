// E2E da integração Lançamento × Entradas/Saídas/Sanidade no Electron REAL (build), perfil temporário e dados
// SINTÉTICOS (produto e regra de dose de teste, sem recomendação veterinária). Pela interface, como o operador:
//   1. Entrada COMPRA com peso no Lançamento → operação no livro (Rebanho › Entradas) e no inventário.
//   2. Painel de Sanidade: "Novo medicamento" e "Configurar posologia" (1 ml / 50 kg) em diálogo, aprovação, e a
//      sugestão aparece sem sair da tela: 300 kg → 6 ml; o operador aplica 5,5 ml, confirma e salva.
//   3. Saída VENDA com peso → operação de saída; Saída DOAÇÃO sem peso com aviso de carência confirmado.
//   4. Entrada NASCIMENTO sem peso → pendente; a Entrada seguinte do mesmo número é a 1ª pesagem (mesmo animal).
//   5. Layout 1440 / 768 / 390 px: Salvar e o painel visíveis, sem rolagem horizontal; capturas em
//      docs/evidence/integracao-lancamento/telas/.
// Linux sem tela: npm run build && xvfb-run -a npm run e2e:launch-integration:verify
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');
assert.ok(existsSync(join(root, 'dist', 'index.html')), 'rode npm run build antes do E2E');
const telas = join(root, 'docs', 'evidence', 'integracao-lancamento', 'telas');
mkdirSync(telas, { recursive: true });

const LOGIN = 'gestor';
const SENHA = 'Curral#2026';
const userData = mkdtempSync(join(tmpdir(), 'pesagens-e2e-integracao-'));
const errors = [];
const resumo = [];

async function abrir() {
  const args = [root];
  if (process.platform === 'linux') args.push('--no-sandbox');
  const app = await _electron.launch({ executablePath: electronPath, args, env: { ...process.env, ELECTRON_DEV: '0', PESAGENS_USER_DATA_DIR: userData, NODE_OPTIONS: '' } });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  win.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  return { app, win };
}
const irPara = (win, rota) => win.evaluate((r) => { window.location.hash = `#/${r}`; }, rota);
async function escolherTipo(win, tipo) {
  await win.locator('button[role="combobox"]').first().click();
  await win.getByRole('option', { name: tipo }).click();
}
async function escolherNoCombo(win, rotulo, opcao) {
  await win.getByRole('combobox', { name: rotulo }).click();
  await win.getByRole('option', { name: opcao, exact: true }).click();
}
async function identificar(win, numero) {
  const ident = win.getByPlaceholder('Ex: 1234', { exact: true });
  await ident.fill(numero);
  await ident.press('Tab');
}
async function escolherData(win, quando) {
  await win.getByLabel('Data da pesagem', { exact: true }).click();
  const calendario = win.getByRole('dialog', { name: 'Calendário: Data da pesagem' });
  if (quando === 'hoje') await calendario.getByRole('button', { name: 'Hoje' }).click();
  else {
    await calendario.getByRole('button', { name: 'Mês anterior' }).click();
    await calendario.locator('[role="gridcell"]:not(.is-outside)', { hasText: /^1$/ }).click();
  }
}
const salvar = (win) => win.getByRole('button', { name: /^Salvar/ }).click();
async function toast(win, texto) {
  try {
    await win.getByText(texto).first().waitFor({ timeout: 15000 });
  } catch (err) {
    const visiveis = await win.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role="dialog"]')].map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 300)));
    await win.screenshot({ path: join(tmpdir(), "falha-toast.png") });
    throw new Error(`esperado "${texto}"; na tela: ${JSON.stringify(visiveis)}`);
  }
}

// Leitura direta do IndexedDB do perfil (conferência do que foi gravado, sem passar pela tela).
const lerBanco = (win) => win.evaluate(async () => {
  const req = indexedDB.open('pesagens-individuais');
  const db = await new Promise((ok, err) => { req.onsuccess = () => ok(req.result); req.onerror = () => err(req.error); });
  const todos = async (store) => new Promise((ok) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result.filter((x) => !x.deleted_at)); });
  const out = {
    operacoes: await todos('operacoes'), itens: await todos('operacaoItens'), pesagens: await todos('pesagens'),
    movimentos: await todos('movimentosAnimais'), aplicacoes: await todos('aplicacoesSanidade'), animais: await todos('animais'),
  };
  db.close();
  return out;
});

// Capturas legíveis: espera os avisos (toasts) saírem da frente da tela.
async function capturar(win, arquivo, opcoes = {}) {
  await win.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, { timeout: 15000 }).catch(() => {});
  await win.screenshot({ path: join(telas, arquivo), ...opcoes });
}

async function semRolagemHorizontal(win, rotulo) {
  const largura = await win.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: window.innerWidth }));
  const salvarBox = await win.getByRole('button', { name: /^Salvar/ }).boundingBox();
  assert.ok(salvarBox && salvarBox.x >= 0 && salvarBox.x + salvarBox.width <= largura.vp + 1, `${rotulo}: botão Salvar dentro da tela`);
  return largura;
}

let app;
let win;
try {
  ({ app, win } = await abrir());
  await win.getByLabel('Nome do administrador').fill('Admin Integração');
  await win.getByLabel('Login', { exact: true }).fill(LOGIN);
  await win.getByLabel('Senha', { exact: true }).fill(SENHA);
  await win.getByLabel('Confirmar senha').fill(SENHA);
  await win.getByRole('button', { name: 'Criar administrador' }).click();
  await win.getByLabel('Guardei a chave').check();
  await win.getByRole('button', { name: 'Ir para o login' }).click();
  await win.getByLabel('Login', { exact: true }).fill(LOGIN);
  await win.getByLabel('Senha', { exact: true }).fill(SENHA);
  await win.keyboard.press('Enter');
  await win.getByText('Relação de Pesagens').first().waitFor();

  await irPara(win, 'Marcas');
  await win.locator('.aux-new-button').first().click();
  await win.getByLabel('Marca a fogo', { exact: true }).fill('INT');
  await win.getByLabel('Abreviação').fill('INT');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'INT' }).first().waitFor();

  // 1. Entrada COMPRA com peso
  await irPara(win, 'LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo(win, 'Entrada (novo animal)');
  await win.getByRole('combobox', { name: 'Motivo da Entrada' }).waitFor();
  await escolherData(win, 'mes-passado');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /INT/ }).first().click();
  await identificar(win, '501');
  await win.getByPlaceholder('Ex: 320', { exact: true }).fill('300');
  await salvar(win);
  await toast(win, /Entrada confirmada: animal 501 · Compra · com pesagem/);
  let banco = await lerBanco(win);
  assert.equal(banco.operacoes.filter((o) => o.tipo === 'ENTRADA' && o.subtipo === 'COMPRA' && o.status === 'CONFIRMADA' && o.origem === 'LANCAMENTO').length, 1);
  assert.equal(banco.movimentos.filter((m) => m.natureza === 'ENTRADA').length, 1, 'um movimento de entrada');
  assert.equal(banco.pesagens.length, 1, 'uma pesagem');
  resumo.push('1 Entrada COMPRA no Lançamento: operação confirmada (origem LANCAMENTO), 1 movimento, 1 pesagem');

  // 2. Medicamento e posologia no painel de Sanidade, sem sair da tela
  await win.getByRole('button', { name: 'Sanidade', exact: true }).click();
  const painel = win.locator('[data-launch-panel="sanidade"]');
  await painel.getByRole('button', { name: 'Novo medicamento' }).click();
  const dlgMed = win.getByRole('dialog').filter({ hasText: 'Novo medicamento' });
  await dlgMed.getByLabel('Nome').fill('PRODUTO SINTETICO TESTE E2E');
  await dlgMed.getByRole('button', { name: 'Salvar' }).last().click();
  await toast(win, 'Medicamento cadastrado.');
  await painel.getByText('Posologia: Sem posologia.').first().waitFor();
  await identificar(win, '502');
  await win.getByPlaceholder('Ex: 320', { exact: true }).fill('300');
  await painel.getByRole('button', { name: 'Configurar posologia da aplicação 1' }).click();
  const dlgPos = win.getByRole('dialog').filter({ hasText: 'Configurar posologia' });
  await dlgPos.getByRole('button', { name: 'Nova posologia' }).click();
  await dlgPos.getByLabel('Princípio ativo').fill('Princípio sintético');
  await dlgPos.getByLabel('Apresentação').fill('Frasco sintético');
  await dlgPos.getByLabel('Indicação').fill('Teste de software (sem uso clínico)');
  await dlgPos.getByLabel('Via da posologia').selectOption('SC');
  await dlgPos.getByLabel('Dose por unidade de peso').fill('1');
  await dlgPos.getByLabel('Quilos por unidade de dose').fill('50');
  await dlgPos.getByLabel('Carência de carne em dias').fill('90');
  await dlgPos.getByLabel('Fonte da posologia').selectOption('BULA');
  await dlgPos.getByLabel('Início da vigência', { exact: true }).click();
  const calVigencia = win.locator('.mak-date-picker-panel');
  await calVigencia.getByRole('button', { name: 'Mês anterior' }).click();
  await calVigencia.locator('[role="gridcell"]:not(.is-outside)', { hasText: /^1$/ }).click();
  assert.notEqual(await dlgPos.getByLabel('Início da vigência', { exact: true }).inputValue(), '', 'vigência preenchida pelo calendário dentro do diálogo');
  await dlgPos.getByRole('button', { name: 'Salvar rascunho' }).click();
  await toast(win, 'Rascunho da posologia salvo.');
  await dlgPos.getByRole('button', { name: 'Aprovar' }).click();
  await dlgPos.getByLabel('Responsável técnico').fill('Responsável Sintético CRMV 0000');
  await dlgPos.getByRole('button', { name: 'Confirmar aprovação' }).click();
  await toast(win, 'Posologia aprovada.');
  await capturar(win, 'posologia-no-lancamento-1440.png');
  await dlgPos.getByRole('button', { name: 'Voltar ao lançamento' }).click();
  // Sugestão sem recarregar a tela: 300 kg → 6 ml
  const sugestao = painel.locator('[data-dose-sugerida]');
  await sugestao.waitFor({ timeout: 15000 });
  assert.equal(await sugestao.getAttribute('data-dose-sugerida'), '6', 'dose sugerida 6 ml para 300 kg');
  await painel.getByRole('button', { name: 'Usar dose sugerida na aplicação 1' }).click();
  await painel.getByLabel('Dose da aplicação 1').fill('5,5');
  await painel.getByLabel('Confirmo a dose aplicada na aplicação 1').check();
  await capturar(win, 'lancamento-entrada-sanidade-1440.png');
  await salvar(win);
  await toast(win, /Entrada confirmada: animal 502 · Compra · com pesagem .* 1 aplicação de sanidade/);
  banco = await lerBanco(win);
  const pes502 = banco.pesagens.find((p) => p.legacy_payload?.numero_animal === '502');
  const ap = banco.aplicacoes.find((a) => a.pesagem_id === pes502?.id);
  assert.ok(ap, 'aplicação vinculada à pesagem do 502');
  assert.deepEqual([ap.dose_sugerida, ap.dose_aplicada, ap.peso_base_kg, ap.peso_base_origem, ap.dose_confirmada], [6, 5.5, 300, 'MANUAL', true]);
  assert.equal(ap.posologia_snapshot?.kg_por_unidade, 50, 'snapshot da regra');
  assert.ok(ap.carencia_carne_ate, 'carência calculada');
  resumo.push('2 Medicamento e posologia criados e aprovados no próprio painel; sugestão 6 ml (300 kg) sem recarregar; aplicado 5,5 ml confirmado; gravado com snapshot, peso-base e carência');

  // 3. Saída VENDA com peso e Saída DOAÇÃO sem peso (aviso de carência confirmado)
  await escolherTipo(win, 'Saída');
  await escolherData(win, 'hoje');
  await escolherNoCombo(win, /Motivo da Saída|Selecione/, 'Venda').catch(async () => {
    await win.locator('button[role="combobox"]').filter({ hasText: 'Selecione' }).first().click();
    await win.getByRole('option', { name: 'Venda', exact: true }).click();
  });
  await win.getByRole('button', { name: 'Dados da venda' }).click();
  await win.getByLabel('Rendimento de carcaça da venda').fill('52');
  await identificar(win, '501');
  await win.getByPlaceholder('Ex: 320', { exact: true }).fill('360');
  await salvar(win);
  await toast(win, /Saída confirmada: animal 501 · Venda · com pesagem/);
  await win.locator('button[role="combobox"]').filter({ hasText: 'Venda' }).first().click();
  await win.getByRole('option', { name: 'Doação', exact: true }).click();
  await identificar(win, '502');
  await win.getByPlaceholder('Ex: 320', { exact: true }).fill('');
  await salvar(win);
  const avisos = win.getByRole('dialog').filter({ hasText: 'Confira antes de confirmar' });
  await avisos.waitFor();
  await avisos.getByText(/carência/i).first().waitFor();
  await capturar(win, 'saida-aviso-carencia-1440.png');
  await avisos.getByRole('button', { name: 'Confirmar mesmo assim' }).click();
  await toast(win, /Saída confirmada: animal 502 · Doação · sem peso/);
  banco = await lerBanco(win);
  assert.equal(banco.operacoes.filter((o) => o.tipo === 'SAIDA' && o.status === 'CONFIRMADA').length, 2);
  assert.equal(banco.movimentos.filter((m) => m.natureza === 'SAIDA').length, 2, 'um movimento de saída por animal');
  const doacao = banco.pesagens.find((p) => p.legacy_payload?.numero_animal === '502' && p.legacy_payload?.tipo_manejo === 'Saída');
  assert.equal(doacao.peso_kg ?? null, null, 'doação sem peso inventado');
  resumo.push('3 Saída VENDA com peso e DOAÇÃO sem peso (aviso de carência confirmado): 2 operações, 2 movimentos, nenhum peso inventado');

  // 3b (PR #5 R1, T10). Desfazer a Doação com a CONSULTA DO VÍNCULO FALHANDO (falha injetada na leitura do índice
  // operacaoItens.pesagem_id do IndexedDB): a tela não trata como "sem vínculo" — avisa que nada foi apagado e não
  // deixa confirmar. Sem a falha, "Tentar de novo" mostra o cancelamento da operação, que exige motivo.
  const opDoacao = banco.operacoes.find((o) => o.subtipo === 'DOACAO');
  await win.evaluate(() => {
    const original = IDBObjectStore.prototype.index;
    window.__indexOriginal = original;
    IDBObjectStore.prototype.index = function indexComFalha(nome) {
      if (this.name === 'operacaoItens' && nome === 'pesagem_id') throw new DOMException('falha injetada na consulta (teste)', 'InvalidStateError');
      return original.call(this, nome);
    };
  });
  await win.getByRole('button', { name: 'Desfazer' }).click();
  const dlgFalha = win.getByRole('dialog').filter({ hasText: 'Nenhum dado foi apagado' });
  await dlgFalha.waitFor();
  assert.equal(await dlgFalha.getByRole('button', { name: 'Excluir' }).isDisabled(), true, 'consulta falhou: não confirma');
  await capturar(win, 'desfazer-consulta-falhou-1440.png');
  banco = await lerBanco(win);
  assert.equal(banco.operacoes.find((o) => o.id === opDoacao.id).status, 'CONFIRMADA', 'nada mudou com a consulta falhando');
  await win.evaluate(() => { IDBObjectStore.prototype.index = window.__indexOriginal; });
  await dlgFalha.getByRole('button', { name: 'Tentar de novo' }).click();
  const dlgCancelar = win.getByRole('dialog').filter({ hasText: 'Cancelar operação' });
  await dlgCancelar.getByText(/é a Saída registrada como operação/).waitFor();
  await dlgCancelar.getByLabel('Motivo do cancelamento').fill('doação lançada por engano (teste)');
  await dlgCancelar.getByRole('button', { name: 'Cancelar operação' }).click();
  await dlgCancelar.waitFor({ state: 'detached', timeout: 15000 });
  await toast(win, /Operação cancelada/);
  banco = await lerBanco(win);
  assert.equal(banco.operacoes.find((o) => o.id === opDoacao.id).status, 'CANCELADA', 'Desfazer cancela a operação de saída');
  const animal502 = banco.animais.find((a) => a.numero_animal === '502');
  assert.equal(animal502.situacao, 'ATIVO', 'o animal volta ao rebanho');
  assert.equal(banco.movimentos.filter((m) => m.natureza === 'SAIDA' && m.animal_id === animal502.id).length, 0, 'saída fora do livro');
  resumo.push('3b Desfazer da Saída com a consulta do vínculo falhando: bloqueado e "nenhum dado foi apagado"; Tentar de novo → cancelamento da operação com motivo (operação CANCELADA, animal ATIVO, saída fora do livro)');

  // 4. Entrada NASCIMENTO sem peso → 1ª pesagem do mesmo animal
  await escolherTipo(win, 'Entrada (novo animal)');
  await escolherNoCombo(win, 'Motivo da Entrada', 'Nascimento');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /INT/ }).first().click();
  await win.getByLabel('Entrada sem peso').check();
  await identificar(win, '503');
  await salvar(win);
  await toast(win, /Entrada confirmada: animal 503 · Nascimento · sem pesagem — animal pendente de pesagem/);
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /INT/ }).first().click();
  await identificar(win, '503');
  await win.getByPlaceholder('Ex: 320', { exact: true }).fill('40');
  await salvar(win);
  await toast(win, /Primeira pesagem do animal 503: mesmo animal da Nascimento/);
  banco = await lerBanco(win);
  assert.equal(banco.animais.filter((a) => a.numero_animal === '503').length, 1, 'um animal 503');
  const op503 = banco.operacoes.find((o) => o.subtipo === 'NASCIMENTO');
  assert.equal(banco.movimentos.filter((m) => m.natureza === 'ENTRADA' && m.animal_id === banco.animais.find((a) => a.numero_animal === '503').id).length, 1, 'uma entrada só');
  assert.ok(banco.itens.find((i) => i.operacao_id === op503.id)?.pesagem_id, 'item do nascimento aponta para a 1ª pesagem');
  resumo.push('4 Entrada NASCIMENTO sem peso: pendente; a Entrada seguinte do 503 é a 1ª pesagem do mesmo animal (uma entrada só)');

  // Telas de Rebanho refletem o Lançamento (mesmo livro)
  await irPara(win, 'Entradas');
  await win.locator('.rb-row').filter({ hasText: 'Nascimento' }).first().waitFor({ timeout: 15000 });
  assert.equal(await win.locator('.rb-row').filter({ hasText: 'Compra' }).count(), 2, 'Rebanho › Entradas lista as 2 compras do Lançamento');
  await irPara(win, 'Saidas');
  await win.locator('.rb-row').filter({ hasText: 'Venda' }).first().waitFor({ timeout: 15000 });
  await win.locator('.rb-row').filter({ hasText: 'Doação' }).first().waitFor();
  resumo.push('Rebanho › Entradas e Saídas mostram as operações feitas no Lançamento');

  // 5. Layout 1440 / 768 / 390
  await irPara(win, 'LancamentoPesagensIndividuais');
  await escolherTipo(win, 'Entrada (novo animal)');
  for (const [largura, altura] of [[1440, 900], [768, 1024], [390, 844]]) {
    await win.setViewportSize({ width: largura, height: altura });
    await win.waitForTimeout(300);
    const medidas = await semRolagemHorizontal(win, `${largura}px`);
    await capturar(win, `lancamento-entrada-${largura}.png`, { fullPage: true });
    resumo.push(`Layout ${largura}px: Salvar visível; largura do documento ${medidas.doc}px / tela ${medidas.vp}px`);
  }
  await app.close();
  app = null;
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);
  console.log('OK verify-launch-integration-e2e');
  console.log(JSON.stringify(resumo, null, 2));
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(userData, { recursive: true, force: true });
}
