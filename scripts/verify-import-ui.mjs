// Gate import:ui:verify — assistente de importação (src/pages/Importacao.jsx +
// src/components/importacao/**). Prova, por execução pura do modelo da tela e por
// inspeção de fonte:
//   1. as 7 etapas existem na ordem (Arquivo → Tipo → Colunas → Regras → Conciliação →
//      Conferência → Resultado) e a tela as renderiza nessa ordem;
//   2. a tela usa o motor (readImportFile/suggestMapping/listMappableFields/analyzeImport/
//      applyImport/planToCsv/resultToCsv) e NÃO reimplementa leitura nem cálculo;
//   3. nenhum campo técnico (id, id do animal, id externo, ids de cadastro) ou derivado
//      (peso anterior, data anterior, dias, ganho, GMD) é oferecido no mapeamento;
//   4. "Importar" fica bloqueado com plan.blocking;
//   5. rota e item de menu ÚNICOS, com weighing.write; cadastros mestres com registry.write;
//   6. a Relação de Pesagens não tem mais parser próprio e navega para a tela nova;
//   7. (17/09/2026) a pergunta "o arquivo tem mais de uma pesagem do mesmo animal?" com as
//      duas respostas, o aviso de animais repetidos fora do modo conciliado com o botão que
//      troca de modo e refaz a análise, e o resumo dos animais com várias linhas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_TYPES, ROW_STATUS } from '../src/modules/import/domain/importConstants.js';
import { listImportFields, listMappableFields, suggestMapping } from '../src/modules/import/domain/importFields.js';
import { readImportFile } from '../src/modules/import/domain/importFile.js';
import {
  CONCILIACAO_OPCOES,
  CONCILIACAO_PERGUNTA,
  IMPORT_STEPS,
  ROW_STATUS_TONE,
  STEP_IDS,
  afericaoDoArquivo,
  animaisComVariasLinhas,
  camposObrigatoriosFaltando,
  describeImportError,
  headerOfField,
  stepIndex,
} from '../src/components/importacao/importacaoModel.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (relative) => readFileSync(join(root, relative), 'utf8');

const page = read('src/pages/Importacao.jsx');
const model = read('src/components/importacao/importacaoModel.js');
const steps = read('src/components/importacao/ImportSteps.jsx');
const stepArquivo = read('src/components/importacao/StepArquivo.jsx');
const stepTipo = read('src/components/importacao/StepTipo.jsx');
const stepColunas = read('src/components/importacao/StepColunas.jsx');
const stepRegras = read('src/components/importacao/StepRegras.jsx');
const stepConciliacao = read('src/components/importacao/StepConciliacao.jsx');
const stepConferencia = read('src/components/importacao/StepConferencia.jsx');
const stepResultado = read('src/components/importacao/StepResultado.jsx');
const afericaoComponent = read('src/components/importacao/AfericaoArquivo.jsx');
const confirmDialog = read('src/components/importacao/ConfirmarImportacaoDialog.jsx');
const layout = read('src/Layout.jsx');
const routes = read('src/pages.config.js');
const relation = read('src/pages/PesagensIndividuais.jsx');
const telaToda = [page, model, steps, stepArquivo, stepTipo, stepColunas, stepRegras, stepConciliacao, stepConferencia, stepResultado, afericaoComponent, confirmDialog].join('\n');

// ---------------------------------------------------------------------------
// 1. As 7 etapas, na ordem.
// ---------------------------------------------------------------------------
assert.deepEqual(STEP_IDS, ['arquivo', 'tipo', 'colunas', 'regras', 'conciliacao', 'conferencia', 'resultado'], 'as 7 etapas na ordem do assistente');
assert.deepEqual(IMPORT_STEPS.map((step) => step.numero), [1, 2, 3, 4, 5, 6, 7], 'etapas numeradas de 1 a 7');
assert.deepEqual(IMPORT_STEPS.map((step) => step.label), ['Arquivo', 'Tipo', 'Colunas', 'Regras', 'Conciliação', 'Conferência', 'Resultado']);
assert.equal(stepIndex('conferencia'), 5);
assert.equal(stepIndex('inexistente'), -1);

const ordemNaTela = STEP_IDS.map((id) => page.indexOf(`{passo === '${id}' ? (`));
assert.ok(ordemNaTela.every((posicao) => posicao > 0), 'a tela renderiza um painel por etapa');
assert.deepEqual([...ordemNaTela].sort((a, b) => a - b), ordemNaTela, 'os painéis aparecem na ordem das etapas');
assert.match(page, /<ImportSteps[\s\S]{0,200}steps=\{IMPORT_STEPS\}/, 'a trilha de etapas é montada a partir de IMPORT_STEPS');
assert.match(page, /const podeAbrir = useCallback\(/, 'etapa à frente só abre com as anteriores válidas');
assert.match(page, /disabled=\{!proximo \|\| !etapaValida\(passo\)\}/, 'Avançar bloqueado enquanto a etapa atual for inválida');
assert.match(page, /disabled=\{!anterior\}[\s\S]{0,120}Voltar/, 'é possível voltar');
assert.match(steps, /disabled=\{!habilitada\}/, 'a trilha desabilita etapa ainda não liberada');

// ---------------------------------------------------------------------------
// 2. A tela orquestra o motor e não reimplementa regra.
// ---------------------------------------------------------------------------
const servico = page.match(/from '@\/modules\/import\/application\/importService'/g) || [];
assert.equal(servico.length, 1, 'a tela fala com um único serviço de importação');
for (const fn of ['analyzeImport', 'applyImport', 'planToCsv', 'resultToCsv', 'listMappableFields', 'suggestMapping', 'readImportFile', 'listImportTemplates', 'saveImportTemplate', 'deleteImportTemplate']) {
  assert.ok(page.includes(fn), `a tela usa ${fn} do serviço`);
}
assert.match(page, /const campos = useMemo\(\(\) => \(type \? listMappableFields\(type\) : \[\]\)/, 'os campos oferecidos vêm de listMappableFields');
assert.match(page, /await analyzeImport\(\s*\{ text: texto, type: tipo, mapping: mapeamento, rules:/, 'a conciliação é o dry-run do serviço');
assert.match(page, /await applyImport\(plan, actor, \{ onProgress:/, 'a gravação é do serviço, com progresso');
assert.match(page, /planToCsv\(plan\)/, 'o relatório de conciliação é o do motor');
assert.match(page, /resultToCsv\(resultado, plan\)/, 'o relatório do resultado é o do motor');
assert.match(page, /buildImportTemplateCsv\(TEMPLATE_KINDS\[kind\]\)/, 'o modelo de planilha vem de spreadsheetTemplate');
// NEGATIVO: nada de parse ou cálculo próprio na tela.
for (const proibido of ['parseCsv', 'parseBrazilianNumber', 'parseCivilDate', 'recalculateWeightSeries', 'compareWeighingEvents', 'buildImportPlan', 'prepareImportRows', 'weighingMapper', 'bulkCreateEntries']) {
  assert.ok(!telaToda.includes(proibido), `NEGATIVO: o assistente não reimplementa ${proibido}`);
}
assert.ok(!/\bgmd\s*=/.test(telaToda), 'NEGATIVO: o assistente não calcula GMD');
assert.ok(!/modules\/weighing\/domain/.test(telaToda), 'NEGATIVO: o assistente não importa domínio de pesagens');

// ---------------------------------------------------------------------------
// 3. Mapeamento só com o que a pessoa digita.
// ---------------------------------------------------------------------------
const PROIBIDOS = ['id', 'animal_id', 'id_externo', 'marca_id', 'raca_id', 'categoria_id', 'peso_anterior', 'data_anterior', 'dias', 'ganho', 'gmd'];
for (const type of Object.values(IMPORT_TYPES)) {
  const oferecidos = listMappableFields(type).map((campo) => campo.id);
  for (const proibido of PROIBIDOS) {
    assert.ok(!oferecidos.includes(proibido), `${type}: NEGATIVO: "${proibido}" não é oferecido no mapeamento`);
  }
  assert.ok(listMappableFields(type).every((campo) => !campo.derived && !campo.technical), `${type}: só campos digitáveis`);
  if (type !== IMPORT_TYPES.MESTRES) {
    assert.ok(oferecidos.includes('numero') && oferecidos.includes('data') && oferecidos.includes('peso'), `${type}: os campos digitados continuam disponíveis`);
    assert.ok(listImportFields(type).length > oferecidos.length, `${type}: o motor conhece mais campos do que a tela oferece`);
  }
}
assert.match(stepColunas, /campos\.map\(\(campo\) =>/, 'o select da coluna lista só os campos recebidos (listMappableFields)');
assert.match(stepColunas, /Não usar esta coluna/, 'dá para deixar uma coluna de fora');
assert.match(stepColunas, /amostra\.map/, 'a etapa Colunas mostra amostra das primeiras linhas');
assert.match(stepColunas, /importacao-colunas-faltando/, 'a etapa Colunas avisa o que falta mapear');
assert.match(page, /setMapping\(suggestMapping\(/, 'a sugestão automática é aplicada');

const arquivoExemplo = readImportFile('Data;Nº;Marca;Peso\n01/12/2025;101;ALFA;206\n15/01/2026;101;ALFA;238,5\n01/12/2025;102;ALFA;212\n');
const sugerido = suggestMapping(arquivoExemplo.headers, IMPORT_TYPES.HISTORICO);
assert.equal(sugerido['Nº'], 'numero', 'a sugestão reconhece o cabeçalho pelo alias');
assert.equal(headerOfField(sugerido, 'peso'), 'Peso');
assert.deepEqual(camposObrigatoriosFaltando(listMappableFields(IMPORT_TYPES.HISTORICO), sugerido, IMPORT_TYPES.HISTORICO), [], 'com o modelo completo nada falta');
const semPeso = { ...sugerido, Peso: null };
assert.deepEqual(camposObrigatoriosFaltando(listMappableFields(IMPORT_TYPES.HISTORICO), semPeso, IMPORT_TYPES.HISTORICO).map((campo) => campo.id), ['peso'], 'campo obrigatório sem coluna é apontado');
assert.equal(camposObrigatoriosFaltando([], {}, IMPORT_TYPES.MESTRES).length, 1, 'cadastros mestres exigem ao menos uma coluna de nome');

// ---------------------------------------------------------------------------
// 4. Importar bloqueado com plan.blocking.
// ---------------------------------------------------------------------------
assert.match(
  stepConferencia,
  /data-testid="importacao-importar"[\s\S]{0,200}disabled=\{!plan \|\| plan\.blocking \|\| !podeImportar \|\| gravando/,
  'o botão Importar é desabilitado quando o plano é bloqueante',
);
assert.match(page, /if \(!plan \|\| plan\.blocking\) return;/, 'a gravação recusa plano bloqueante antes de chamar o serviço');
assert.match(page, /case 'conferencia': return Boolean\(plan\) && !plan\.blocking;/, 'não se avança para a gravação com plano bloqueante');
assert.match(stepConciliacao, /importacao-bloqueio/, 'a etapa Conciliação deixa evidente o bloqueio');
assert.match(stepConciliacao, /plan\.blocking \?/, 'o bloqueio é lido do próprio plano');
assert.match(stepConferencia, /Baixar relatório de conciliação/, 'dá para baixar o relatório de conciliação');
assert.match(stepConferencia, /ROW_STATUS_TONE\[linha\.status\]/, 'cada situação tem cor própria');
assert.match(stepConferencia, /setFiltro\(valor\)/, 'a conferência filtra por situação');
for (const status of Object.values(ROW_STATUS)) {
  assert.ok(ROW_STATUS_TONE[status], `situação ${status} tem cor definida`);
}

// Contagens do resumo e do resultado: os nomes são os do motor, sem invenção.
for (const chave of ['linhasLidas', 'novos', 'animaisEncontrados', 'animaisNovos', 'cadastros', 'manejos', 'saidas', 'jaExistem', 'ignoradas', 'duplicidades', 'ambiguidades', 'conflitos', 'erros', 'cadastrosMestresAusentes', 'categoriasAutomaticasResolvidas', 'categoriasNaoResolvidas']) {
  assert.ok(stepConciliacao.includes(`summary.${chave}`) || stepConciliacao.includes(`summary?.${chave}`), `o resumo mostra ${chave}`);
}
for (const chave of ['linhasProcessadas', 'cadastrosCriados', 'manejosCriados', 'saidasCriadas', 'animaisConciliados', 'animaisNovos', 'duplicidadesIgnoradas', 'erros', 'seriesRecalculadas', 'eventosRecalculados', 'categoriasResolvidasAutomaticamente', 'cadastrosMestresCriados', 'lotes', 'linhasGravadas']) {
  assert.ok(stepResultado.includes(`resultado.${chave}`), `o resultado mostra ${chave}`);
}

// Confirmação explícita, backup só como texto e progresso.
assert.match(confirmDialog, /Confirmar importação/, 'há confirmação explícita antes de gravar');
assert.match(confirmDialog, /createPageUrl\('ManutencaoSistema'\)/, 'o lembrete de backup leva à Manutenção');
assert.ok(!/persistFullBackup|maintenanceService/.test(telaToda), 'NEGATIVO: a tela não executa backup');
assert.match(confirmDialog, /importacao-progress__fill/, 'a gravação mostra barra de progresso');
assert.match(page, /describeImportError\(error/, 'erros do serviço viram mensagem clara');
assert.equal(describeImportError({ code: 'AUTH_FORBIDDEN', message: 'x' }), 'Seu perfil não pode fazer esta importação. Peça a um gestor.');
assert.match(describeImportError({ code: 'IMPORT_BLOCKING', message: '2 erros' }), /pendências/, 'plano bloqueante é explicado');
assert.equal(describeImportError(null, 'padrão'), 'padrão');

// ---------------------------------------------------------------------------
// 5. Permissões, rota e menu únicos.
// ---------------------------------------------------------------------------
assert.equal((routes.match(/"Importacao": Importacao/g) || []).length, 1, 'rota única para a Importação');
assert.match(routes, /const Importacao = lazy\(\(\) => import\('\.\/pages\/Importacao'\)\);/, 'a tela entra por carregamento tardio como as demais');
const itensMenu = layout.match(/url: "Importacao"/g) || [];
assert.equal(itensMenu.length, 1, 'item de menu ÚNICO para a Importação');
assert.match(layout, /id: "pec-importacao"[\s\S]{0,260}url: "Importacao"[\s\S]{0,200}group: "operacao"[\s\S]{0,120}permission: "weighing\.write"/, 'o item fica em Operação e exige weighing.write');
assert.match(page, /const WEIGHING_WRITE = 'weighing\.write'/, 'a tela declara a permissão de gravação de pesagens');
assert.match(page, /const REGISTRY_WRITE = 'registry\.write'/, 'a tela declara a permissão de cadastros');
assert.match(page, /if \(!podeImportar\) return <AccessDenied/, 'sem weighing.write a tela explica em vez de abrir');
assert.match(stepTipo, /bloqueada = opcao\.id === 'MESTRES' && !podeCadastrosMestres/, 'cadastros mestres ficam indisponíveis sem registry.write');
assert.match(stepRegras, /disabled=\{!podeCadastrosMestres\}/, 'criar cadastros ausentes exige registry.write');
assert.match(stepRegras, /importacao-sem-registry-write/, 'a tela explica por que a opção está desligada');
assert.match(page, /if \(rules\.createMissingMasters && !podeCadastrosMestres\) return false;/, 'não se avança pedindo criação de cadastros sem permissão');

// ---------------------------------------------------------------------------
// 6. A Relação de Pesagens não importa mais.
// ---------------------------------------------------------------------------
assert.ok(!relation.includes('colMap'), 'NEGATIVO: a Relação não tem mais o mapeamento de colunas antigo');
assert.ok(!relation.includes('parseCsv'), 'NEGATIVO: a Relação não tem mais o parser antigo');
assert.ok(!relation.includes('FileReader'), 'NEGATIVO: a Relação não lê mais arquivo');
assert.ok(!relation.includes('showImportDialog'), 'NEGATIVO: o diálogo de importação antigo saiu');
assert.ok(!relation.includes('showVincularLotes'), 'NEGATIVO: o diálogo de vinculação de lotes antigo saiu');
assert.match(relation, /label: "Importar CSV"[\s\S]{0,120}navigate\(createPageUrl\("Importacao"\)\)/, '"Importar CSV" navega para o assistente');
assert.match(relation, /label: "Baixar modelo CSV"/, '"Baixar modelo CSV" continua onde estava');
assert.match(relation, /exportWeighingCsv\(/, 'a exportação continua intacta na Relação');

// ---------------------------------------------------------------------------
// 7. Pergunta da conciliação, aviso de repetidos e resumo dos animais com várias linhas.
// ---------------------------------------------------------------------------
assert.equal(CONCILIACAO_PERGUNTA, 'O arquivo tem mais de uma pesagem do mesmo animal?');
assert.deepEqual(CONCILIACAO_OPCOES.map((opcao) => opcao.id), ['SIM', 'NAO', 'MESTRES'], 'duas respostas para a pergunta + cadastros mestres');
assert.equal(CONCILIACAO_OPCOES[0].tipo, IMPORT_TYPES.HISTORICO, '"Sim" é a conciliação automática');
assert.equal(CONCILIACAO_OPCOES[1].tipo, null, '"Não" abre a escolha do tipo único');
assert.equal(CONCILIACAO_OPCOES[2].tipo, IMPORT_TYPES.MESTRES, 'cadastros mestres é opção separada');
assert.match(CONCILIACAO_OPCOES[0].titulo, /recomendado/, 'a conciliação automática é a recomendada');
assert.match(CONCILIACAO_OPCOES[0].texto, /mais antiga de cada animal novo vira Cadastro/, 'o texto explica Cadastro × Manejo pela data');
assert.match(CONCILIACAO_OPCOES[0].texto, /já existe no sistema, todas entram como Manejo/, 'o texto explica o animal já cadastrado');
assert.match(CONCILIACAO_OPCOES[0].detalhe, /ordem das linhas no arquivo não importa/, 'o texto diz que vale a data');
assert.match(CONCILIACAO_OPCOES[0].detalhe, /Peso anterior, dias, ganho e GMD são sempre recalculados/, 'o texto diz que os derivados são recalculados');
assert.match(stepTipo, /CONCILIACAO_PERGUNTA/, 'a etapa Tipo faz a pergunta');
assert.match(stepTipo, /CONCILIACAO_OPCOES\.map/, 'as respostas vêm em cartões');
assert.match(stepTipo, /importacao-tipos-unicos/, '"Não" abre Cadastros/Manejos/Saídas');
assert.match(page, /if \(opcao\?\.tipo\) escolherTipo\(opcao\.tipo\)/, 'a resposta escolhe o tipo de importação');

// Aferição do arquivo (linhas, animais, repetidos) calculada das linhas lidas.
const afericao = afericaoDoArquivo(arquivoExemplo, sugerido);
assert.deepEqual(afericao, { linhas: 3, mapeado: true, animais: 2, repetidos: 1, maxLinhas: 2 }, 'aferição conta linhas, animais e repetidos do arquivo');
assert.equal(afericaoDoArquivo(arquivoExemplo, {}).mapeado, false, 'sem a coluna do número não há aferição');
assert.match(afericaoComponent, /animais diferentes/, 'a linha de aferição aparece antes da análise');
assert.match(afericaoComponent, /animais com mais de uma linha/, 'a aferição conta os animais repetidos do arquivo');
assert.match(afericaoComponent, /máx\. \$\{fmtInt\(afericao\.maxLinhas\)\} linhas para o mesmo animal/, 'a aferição mostra o máximo de linhas do mesmo animal');
assert.match(afericaoComponent, /const alerta = repetidos > 0 && type !== IMPORT_TYPES\.HISTORICO;/, 'o aviso só aparece com repetidos fora do modo conciliado');
assert.match(afericaoComponent, /importacao-aviso-repetidos/, 'o aviso de animais repetidos existe');
assert.match(afericaoComponent, /Em “Cadastros” isso vira conflito\. Quer conciliar automaticamente\?/, 'o aviso explica a consequência');
assert.match(afericaoComponent, /data-testid="importacao-trocar-para-historico"[\s\S]{0,120}onClick=\{onConciliarAutomaticamente\}/, 'o aviso traz o botão que troca de modo');
assert.match(page, /setType\(IMPORT_TYPES\.HISTORICO\);/, 'o botão troca o modo para a conciliação automática');
assert.match(page, /await executarAnalise\(\{ tipo: IMPORT_TYPES\.HISTORICO/, 'ao trocar de modo a análise é refeita');
for (const etapa of [stepColunas, stepConciliacao]) {
  assert.match(etapa, /<AfericaoArquivo/, 'a aferição aparece antes da análise, nas etapas Colunas e Conciliação');
}

// Resumo dos animais com várias linhas, agrupado pelas linhas do próprio plano.
const planoFalso = {
  rows: [
    { line: 2, status: ROW_STATUS.NOVO, eventType: 'Cadastro', data: '2025-12-01', peso: 206, identity: { key: 'a:101', label: '101 · ALFA', animalId: null, isNew: true } },
    { line: 3, status: ROW_STATUS.NOVO, eventType: 'Manejo', data: '2026-01-15', peso: 238.5, identity: { key: 'a:101', label: '101 · ALFA', animalId: null, isNew: true } },
    { line: 4, status: ROW_STATUS.NOVO, eventType: 'Cadastro', data: '2025-12-01', peso: 212, identity: { key: 'a:102', label: '102 · ALFA', animalId: null, isNew: true } },
  ],
};
const repetidos = animaisComVariasLinhas(planoFalso);
assert.equal(repetidos.total, 1, 'só o animal com mais de uma linha entra na lista');
assert.equal(repetidos.grupos[0].label, '101 · ALFA');
assert.deepEqual(repetidos.grupos[0].linhas.map((linha) => linha.eventType), ['Cadastro', 'Manejo'], 'a decisão de cada linha aparece na ordem do arquivo');
assert.equal(animaisComVariasLinhas({ rows: [] }).total, 0, 'plano sem repetição não lista ninguém');
assert.match(stepConciliacao, /animaisComVariasLinhas\(plan\)/, 'o resumo agrupa pelas linhas do plano, sem recalcular');
assert.match(stepConciliacao, /importacao-animais-repetidos/, 'a seção "Animais com várias linhas" existe');
assert.match(stepConciliacao, /Animais com várias linhas/, 'a seção tem título em português claro');

console.log('OK verify-import-ui');
console.log(JSON.stringify({
  sevenStepsInOrder: true,
  wizardDelegatesToEngine: true,
  noTechnicalOrDerivedFieldOffered: true,
  importBlockedWhenPlanBlocking: true,
  singleRouteAndMenuItemWithWeighingWrite: true,
  masterRegistriesRequireRegistryWrite: true,
  legacyRelationImportRemoved: true,
  reconciliationQuestionWithTwoAnswers: true,
  repeatedAnimalsWarningSwitchesMode: true,
  repeatedAnimalsShownInSummary: true,
}, null, 2));
