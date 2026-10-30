// E2E real do app desktop: abre o Electron com Playwright e percorre o fluxo do
// curral pela interface, como o usuário faria. Diferente dos gates que leem o
// fonte, este prova comportamento: primeiro acesso → marca → Cadastro → Manejo →
// repesagem → peso fora da faixa (justificativa) → desfazer → Relação → fechar e
// reabrir com os dados no lugar → balança chegando a estável → Relatórios → estado crítico de
// restauração persistente (R3-01) ao reabrir.
//
// Linux sem tela: xvfb-run -a npm run e2e:electron:verify
// Pede o build da interface (npm run build) antes: o main carrega dist/.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  await win.getByLabel('Marca a fogo', { exact: true }).fill('E2E');
  await win.getByLabel('Abreviação').fill('E2E');
  await win.getByTitle('Salvar (Enter)').click();
  await win.locator('table tbody tr').filter({ hasText: 'E2E' }).first().waitFor();

  // 3. Lançamento — Cadastro no dia 1º do mês passado, Manejo hoje. A tabela do
  // Lançamento mostra só o dia escolhido; a regra do dia recusa um segundo
  // lançamento do mesmo animal na mesma data.
  await irPara(win, 'LancamentoPesagensIndividuais');
  await win.getByText('Tipo de Movimentação').waitFor();
  await escolherTipo(win, 'Entrada (novo animal)');
  await escolherData(win, 'mes-passado');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /E2E/ }).first().click();
  await lancar(win, '7001', '320');
  await linhasDoNumero(win, '7001').first().waitFor();

  await escolherTipo(win, 'Manejo / Pesagem');
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
  await escolherTipo(win, 'Entrada (novo animal)');
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

  // Desfazer o último lançamento: a Entrada do 7002 é uma operação (Compra) — desfazer cancela a operação, com motivo.
  await win.getByRole('button', { name: 'Desfazer' }).click();
  const excluir = win.getByRole('dialog').filter({ hasText: 'Cancelar operação' });
  await excluir.getByText(/Este lançamento de 7002 .* é a Entrada registrada como operação/).waitFor();
  await excluir.getByLabel('Motivo do cancelamento').fill('lançado por engano');
  await excluir.getByRole('button', { name: 'Cancelar operação' }).click();
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
  await win.getByLabel('Marca a fogo', { exact: true }).fill('NOVA');
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
  // F26: a balança fica em Sistema › Balança e Equipamentos.
  await irPara(win, 'Equipamentos');
  await win.getByRole('combobox', { name: 'Balança ativa' }).click();
  await win.getByRole('option', { name: /Simulador/ }).click();
  await irPara(win, 'LancamentoPesagensIndividuais');
  await win.getByRole('button', { name: 'Ligar pesagem automática' }).click();
  await win.locator('.d17d-weight-control.is-auto.is-stable').waitFor({ timeout: 15000 });
  assert.equal(await win.getByPlaceholder('Ex: 320').inputValue(), '328', 'peso estável do monitor no campo');

  // P01: o peso estável salva UM animal; o próximo, sem a balança mudar, é recusado.
  await escolherTipo(win, 'Entrada (novo animal)');
  await win.getByRole('combobox', { name: 'Marca do animal' }).click();
  await win.getByRole('option', { name: /E2E/ }).first().click();
  const salvarAuto = async (numero) => {
    const ident = win.getByPlaceholder('Ex: 1234');
    await ident.fill(numero);
    await ident.press('Tab');
    await win.getByRole('button', { name: /^Salvar/ }).click();
  };
  await salvarAuto('7003');
  await linhasDoNumero(win, '7003').filter({ hasText: '328' }).first().waitFor();
  await win.locator('.d17d-weight-control.is-auto.is-waiting').waitFor({ timeout: 5000 });
  await salvarAuto('7004');
  await win.getByText('Esse peso já foi usado no animal anterior').first().waitFor();
  assert.equal(await contarLinhas(win, '7004', 0), 0, 'P01: animal seguinte não herda o peso do anterior');
  const origem = await win.evaluate(async () => {
    const req = indexedDB.open('pesagens-individuais');
    const db = await new Promise((ok, err) => { req.onsuccess = () => ok(req.result); req.onerror = () => err(req.error); });
    const rows = await new Promise((ok) => { const r = db.transaction('pesagens').objectStore('pesagens').getAll(); r.onsuccess = () => ok(r.result); });
    db.close();
    const row = rows.find((item) => item.legacy_payload?.numero_animal === '7003' && !item.deleted_at);
    return { origem: row?.legacy_payload?.peso_origem, bruto: row?.legacy_payload?.balanca_leitura?.kg_bruto };
  });
  assert.deepEqual(origem, { origem: 'BALANCA', bruto: 328.4 }, 'pesagem pela balança grava a origem e o peso bruto');
  await win.getByRole('button', { name: 'Desligar pesagem automática' }).click();

  // 8. Backup (P19/P21): um botão só, que grava e lê de volta pela ponte do Electron; o quadro mostra
  // o último backup VERIFICADO e o arquivo aparece como verificado no catálogo.
  // F19: página própria de Backup e Restauração; a Manutenção avançada não tem o botão de backup (P20).
  await irPara(win, 'BackupRestauracao');
  await win.getByRole('button', { name: 'Criar backup agora' }).click();
  await win.getByText('Backup criado e verificado.').first().waitFor({ timeout: 30000 });
  await win.locator('[data-protecao="OK"]').first().waitFor();
  await win.locator('[data-copia="NAO_CONFIGURADA"]').first().waitFor();
  assert.ok(await win.locator('[data-backup-estado="VERIFICADO"]').count() >= 1, 'catálogo mostra o arquivo verificado');
  assert.equal(await win.getByRole('button', { name: /Criar backup completo|Criar backup do banco/ }).count(), 0, 'P19: sem os dois botões antigos');
  await irPara(win, 'ManutencaoSistema');
  await win.getByRole('button', { name: 'Abrir Backup e Restauração' }).first().waitFor();
  assert.equal(await win.getByRole('button', { name: 'Criar backup agora' }).count(), 0, 'P20: Manutenção avançada sem o botão de backup');

  // 9. Entradas (F01) e Inventário (F17): compra de 2 animais (um sem peso) pela tela, conferência com aviso,
  // confirmação; o inventário do dia conta as 2 compras.
  await irPara(win, 'Entradas');
  await win.getByRole('button', { name: /Nova entrada/ }).click();
  await win.getByLabel('Número do animal 1').fill('8001');
  await win.getByLabel('Marca do animal 1').selectOption({ label: 'E2E' });
  await win.getByLabel('Sexo do animal 1').selectOption('M');
  await win.getByLabel('Peso do animal 1').fill('250');
  await win.getByRole('button', { name: 'Animal', exact: true }).click();
  await win.getByLabel('Número do animal 2').fill('8002');
  await win.getByLabel('Marca do animal 2').selectOption({ label: 'E2E' });
  await win.getByLabel('Sexo do animal 2').selectOption('F');
  await win.getByRole('button', { name: /Conferir e confirmar/ }).click();
  await win.getByText(/sem peso: ficam pendentes de pesagem/).first().waitFor();
  await win.getByLabel('Conferi os avisos acima').check();
  await win.getByRole('button', { name: /Conferir e confirmar/ }).click();
  await win.getByText('Compra confirmada: 2 animal(is).').first().waitFor({ timeout: 15000 });
  await win.locator('.rb-row').filter({ hasText: 'Compra' }).first().waitFor();
  // F16: documento (GTA) registrado na operação confirmada.
  await win.locator('.rb-row').filter({ hasText: 'Compra' }).first().click();
  const docsOperacao = win.getByRole('region', { name: 'Documentos da operação' });
  await docsOperacao.getByRole('button', { name: 'Documento' }).click();
  await docsOperacao.getByLabel('Número do documento').fill('GTA-E2E-1');
  await docsOperacao.getByRole('button', { name: 'Salvar documento' }).click();
  await win.getByText('Documento registrado.').first().waitFor();
  await docsOperacao.getByText('GTA-E2E-1').first().waitFor();
  await irPara(win, 'Inventario');
  const compras = win.locator('.rb-table--balance tr').filter({ hasText: '+ Compras' });
  await compras.first().waitFor({ timeout: 15000 });
  // 3 = as 2 compras desta tela + a Entrada (Compra) do 7003 feita hoje no Lançamento: a Entrada do Lançamento é
  // uma operação do livro, conciliada no inventário como as demais.
  assert.equal((await compras.first().locator('td').innerText()).trim(), '3', 'inventário conta as compras da tela Entradas e a do Lançamento');

  // 10. Identificadores (F06) e Ficha do Animal (F04/F15): recebe 3 brincos; no 8002 (comprado sem peso, pendente)
  // informa o nascimento por mês estimado e aplica um brinco — o saldo cai para 2 disponíveis.
  await irPara(win, 'Identificadores');
  await win.getByLabel('Prefixo').fill('E');
  await win.getByLabel('Número inicial').fill('1');
  await win.getByLabel('Número final').fill('3');
  await win.getByRole('button', { name: 'Receber' }).click();
  await win.getByText('Identificadores recebidos.').first().waitFor();
  await irPara(win, 'FichaAnimal');
  await win.getByLabel('Buscar animal').fill('8002');
  await win.locator('.op-search-result').filter({ hasText: '8002' }).first().click();
  const ficha = win.getByRole('region', { name: 'Identidade, idade e rastreabilidade' });
  await ficha.waitFor();
  await ficha.getByRole('button', { name: 'Corrigir nascimento/idade' }).click();
  await ficha.getByLabel('Precisão do nascimento').selectOption('MES');
  await ficha.getByLabel('Mês e ano de nascimento').fill('2025-03');
  await ficha.getByLabel('Fonte do nascimento').selectOption('DECLARACAO_VENDEDOR');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await win.getByText('Nascimento corrigido (auditado).').first().waitFor();
  await ficha.getByText(/mês estimado/).first().waitFor();
  await ficha.getByLabel('Código do identificador').fill('E1');
  await ficha.getByRole('button', { name: 'Aplicar' }).click();
  await win.getByText('Identificador aplicado.').first().waitFor();
  await ficha.getByText('Brinco visual: E1').first().waitFor();
  await irPara(win, 'Identificadores');
  const disponiveis = win.locator('.rb-summary__item').filter({ hasText: 'Disponível' }).locator('strong');
  await win.locator('.rb-table tbody tr').filter({ hasText: 'E1' }).filter({ hasText: 'Aplicado' }).first().waitFor();
  assert.equal((await disponiveis.innerText()).trim(), '2', 'aplicar o brinco tira exatamente um do saldo');

  // 11. Sanidade › Posologias (F08): a aba abre; sem posologia aprovada a dose é manual.
  await irPara(win, 'Sanidade');
  await win.getByRole('tab', { name: 'Posologias' }).click();
  await win.getByText('Nenhuma posologia. Sem posologia aprovada, a dose é sempre manual.').first().waitFor();

  // 12. Parametrização (F05/F12/F13) e Desempenho (F11/F18): as seções abrem e o painel monta as tabelas.
  await irPara(win, 'Parametrizacao');
  await win.getByRole('region', { name: 'Idade, era e categorias' }).waitFor();
  await win.getByRole('region', { name: 'Calendário de seca e águas' }).waitFor();
  await win.getByRole('region', { name: 'Metas e cenários' }).waitFor();
  await irPara(win, 'Desempenho');
  await win.getByText(/Desempenho por Raça/).first().waitFor({ timeout: 15000 });
  await win.getByText('Dias de seca por lote (intervalos observados)').first().waitFor();

  // 13. Relatórios abre sem erro.
  await irPara(win, 'Relatorios');
  await win.getByText('Relatório de Pesagens Individuais').first().waitFor();

  await app.close();
  assert.deepEqual(errors, [], `sem erros no console da interface:\n${errors.join('\n')}`);

  // 14. R3-01 no Electron real: marcador de restauração crítica na pasta de dados (mesmo formato do processo
  // principal) → reabrir: login funciona, a faixa global orienta a restauração (não a migração), gravar é recusado,
  // a página Backup mostra o backup de segurança indicado e o marcador continua lá.
  const pastaDados = join(userData, 'data');
  mkdirSync(pastaDados, { recursive: true });
  const marcador = join(pastaDados, 'estado-restauracao-critica.json');
  writeFileSync(marcador, JSON.stringify({ codigo: 'RESTAURACAO_CRITICA', em: new Date().toISOString(), fase: 'compensacao', backupNome: 'pre-restauracao-e2e.json', backupSha256: 'a'.repeat(64) }));
  ({ app, win } = await abrir());
  await entrar(win);
  const faixaGlobal = win.locator('[data-estado-critico-global="RESTAURACAO_CRITICA"]');
  await faixaGlobal.waitFor();
  const textoFaixa = await faixaGlobal.innerText();
  assert.ok(textoFaixa.includes('pre-restauracao-e2e.json') && !/Continuar migração/.test(textoFaixa), 'faixa global orienta a restauração');
  await irPara(win, 'Marcas');
  await win.locator('.aux-new-button').first().click();
  await win.getByLabel('Marca a fogo', { exact: true }).fill('CRT');
  await win.getByLabel('Abreviação').fill('CRT');
  await win.getByTitle('Salvar (Enter)').click();
  await win.getByText(/Gravação em marcas bloqueada: a última restauração falhou/).first().waitFor();
  await irPara(win, 'BackupRestauracao');
  await win.locator('[data-estado-critico="RESTAURACAO_CRITICA"]').filter({ hasText: 'pre-restauracao-e2e.json' }).waitFor();
  await app.close();
  assert.ok(existsSync(marcador), 'reabrir não apaga o marcador crítico');
  assert.deepEqual(errors, [], `sem erros no console da interface (estado crítico):\n${errors.join('\n')}`);
  console.log('OK verify-electron-e2e');
} finally {
  rmSync(userData, { recursive: true, force: true });
}
