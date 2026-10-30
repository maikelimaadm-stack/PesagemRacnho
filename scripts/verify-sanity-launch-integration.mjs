// Gate sanity:launch-integration:verify (programa sanity-launch-import, fatia C).
// Painel de Sanidade do Lançamento: rascunhos de aplicação → payload.aplicacoes_sanidade do
// weighingService.createEntry. Puro + inspeção de fonte:
// - "Aplicar esta configuração aos próximos animais" marcado preserva programa, medicamento,
//   dose, unidade e via por 3 animais; a observação da aplicação nunca vaza;
// - desmarcado limpa depois de salvar;
// - payload montado no formato aceito pelas regras puras da sanidade (validateLaunchApplications);
// - dose padrão só pré-preenche quando é número (suggestedDose); sem cálculo por peso;
// - painel ligado ao sanityService e escondido sem weighing.write; edição só lê.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SANITY_MODES,
  applyContext,
  applyMedicamentoToDraft,
  beginEdit,
  buildSanityPayload,
  contextOf,
  endEdit,
  formatDoseInput,
  modeSupportsSanity,
  newSanityDraft,
  restoreLaunchState,
  sanityDraftsAfterSave,
  serializeLaunchState,
  stateAfterSave,
  switchMode,
} from '../src/modules/weighing/domain/launchContext.js';
import { suggestedDose, validateLaunchApplications } from '../src/modules/sanity/domain/sanityRules.js';
import { LEGACY_PAYLOAD_ALLOWLIST } from '../src/modules/weighing/domain/weighingMapper.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const DATA = '2026-09-17';
const TODAY = new Date(2026, 8, 17, 12, 0, 0);
const DEFAULTS = { marca: 'ABC', marcaId: 'marca-abc', raca: 'Nelore', racaId: 'raca-nelore', apartacaoSelecionada: '', rendimento: '' };
const CATALOGO = { programaIds: ['prog-aftosa', 'prog-verme'], medicamentoIds: ['med-ivermectina', 'med-vacina'] };

const ivermectina = { id: 'med-ivermectina', nome: 'Ivermectina 1%', dose_padrao: '1 ml / 50 kg', unidade_padrao: 'ml', via_aplicacao: 'SC' };
const vacina = { id: 'med-vacina', nome: 'Vacina Aftosa', dose_padrao: '5', unidade_padrao: 'ml', via_aplicacao: 'IM' };

// ---------------------------------------------------------------------------
// 1) Dose padrão: número pré-preenche; texto é só sugestão; unidade e via do medicamento.
assert.equal(suggestedDose(vacina), 5);
assert.equal(suggestedDose({ dose_padrao: '10,5' }), 10.5);
assert.equal(suggestedDose(ivermectina), null, 'texto de referência não vira dose');
const comVacina = applyMedicamentoToDraft(newSanityDraft({ programa_sanidade_id: 'prog-aftosa' }), vacina, suggestedDose(vacina));
assert.equal(comVacina.medicamento_id, 'med-vacina');
assert.equal(comVacina.dose, '5', 'dose numérica pré-preenchida');
assert.equal(comVacina.unidade, 'ml');
assert.equal(comVacina.via_aplicacao, 'IM');
assert.equal(comVacina.programa_sanidade_id, 'prog-aftosa', 'programa escolhido continua');
const comIvermectina = applyMedicamentoToDraft({ ...comVacina }, ivermectina, suggestedDose(ivermectina));
assert.equal(comIvermectina.dose, '', 'NEGATIVO: trocar para medicamento com dose em texto não herda a dose do anterior');
assert.equal(comIvermectina.via_aplicacao, 'SC');
assert.equal(formatDoseInput(10.5), '10,5');
assert.equal(formatDoseInput(null), '');
assert.equal(applyMedicamentoToDraft.length <= 3, true, 'NEGATIVO: pré-preenchimento não recebe peso (sem dose por peso)');

// ---------------------------------------------------------------------------
// 2) Sequência marcada: 3 animais com a mesma configuração; observação da aplicação nunca vaza.
let form = {
  ...applyContext('Manejo', { dataPesagem: DATA }, null, { defaults: DEFAULTS }),
  apartacaoSelecionada: 'apartacao-a',
  mostrarSanidade: true,
  sanidadeSequencia: true,
  sanidadeAplicacoes: [
    { ...comVacina, observacao: 'animal 1 agitado' },
    newSanityDraft({ programa_sanidade_id: 'prog-verme', medicamento_id: 'med-ivermectina', dose: '6,5', unidade: 'ml', via_aplicacao: 'SC' }),
  ],
};
const payloads = [];
for (const [indice, numero] of ['101', '102', '103'].entries()) {
  form = { ...form, numeroAnimal: numero, animalIdSelecionado: `animal-${numero}`, peso: String(300 + indice), observacao: `obs pesagem ${numero}` };
  if (indice === 1) form = { ...form, sanidadeAplicacoes: form.sanidadeAplicacoes.map((draft, i) => (i === 0 ? { ...draft, observacao: 'animal 2 com ferida' } : draft)) };
  const montado = buildSanityPayload(form.sanidadeAplicacoes, CATALOGO);
  assert.equal(montado.ok, true, `animal ${numero}: payload válido`);
  const normalizado = validateLaunchApplications(montado.payload, { data: DATA, today: TODAY });
  assert.equal(normalizado.length, 2, `animal ${numero}: duas aplicações aceitas pelas regras da sanidade`);
  payloads.push(montado.payload);
  form = stateAfterSave('Manejo', form, { sanidadeSequencia: true });
  assert.equal(form.sanidadeSequencia, true);
  assert.equal(form.sanidadeAplicacoes.length, 2, `depois do animal ${numero}: configuração preservada`);
  assert.ok(form.sanidadeAplicacoes.every((draft) => draft.observacao === ''), `NEGATIVO: observação da aplicação do animal ${numero} não vaza`);
  assert.equal(form.observacao, '', 'observação da pesagem também sai');
  assert.equal(form.numeroAnimal, '');
}
const semObservacao = (lista) => lista.map(({ observacao, ...resto }) => resto);
assert.deepEqual(semObservacao(payloads[1]), semObservacao(payloads[0]), 'animal 2 recebe a mesma configuração do animal 1');
assert.deepEqual(semObservacao(payloads[2]), semObservacao(payloads[0]), 'animal 3 recebe a mesma configuração do animal 1');
assert.deepEqual(payloads[0][0], { programa_sanidade_id: 'prog-aftosa', medicamento_id: 'med-vacina', dose: 5, unidade: 'ml', via_aplicacao: 'IM', observacao: 'animal 1 agitado' });
assert.deepEqual(payloads[0][1], { programa_sanidade_id: 'prog-verme', medicamento_id: 'med-ivermectina', dose: 6.5, unidade: 'ml', via_aplicacao: 'SC', observacao: null });
assert.equal(payloads[1][0].observacao, 'animal 2 com ferida');
assert.equal(payloads[2][0].observacao, null, 'NEGATIVO: observação do animal 2 não chega ao animal 3');

// ---------------------------------------------------------------------------
// 3) Sequência desmarcada: limpa depois de salvar.
const desmarcado = stateAfterSave('Manejo', { ...form, sanidadeSequencia: false, sanidadeAplicacoes: [comVacina] }, {});
assert.deepEqual(desmarcado.sanidadeAplicacoes, [], 'desmarcado: aplicações não seguem para o próximo animal');
assert.deepEqual(buildSanityPayload(desmarcado.sanidadeAplicacoes, CATALOGO).payload, [], 'próximo animal sem aplicação');
assert.deepEqual(stateAfterSave('Cadastro', { ...applyContext('Cadastro', { dataPesagem: DATA }, null, { defaults: DEFAULTS }), sanidadeAplicacoes: [comVacina] }, { sanidadeSequencia: false }).sanidadeAplicacoes, [], 'Cadastro desmarcado também limpa');
assert.deepEqual(sanityDraftsAfterSave([newSanityDraft({ observacao: 'só observação' })], true), [], 'rascunho sem programa/medicamento não vira configuração');

// ---------------------------------------------------------------------------
// 4) Montagem do payload: vazios ignorados, erros em pt-BR, nada é enviado com erro.
assert.deepEqual(buildSanityPayload([], CATALOGO), { ok: true, errors: [], payload: [] }, 'sem aplicação: payload vazio (painel opcional)');
assert.deepEqual(buildSanityPayload([newSanityDraft()], CATALOGO).payload, [], 'linha adicionada e não preenchida é ignorada');
const soMedicamento = buildSanityPayload([newSanityDraft({ medicamento_id: 'med-vacina' })], CATALOGO);
assert.deepEqual(soMedicamento.payload, [{ programa_sanidade_id: null, medicamento_id: 'med-vacina', dose: null, unidade: null, via_aplicacao: null, observacao: null }]);
const semProduto = buildSanityPayload([newSanityDraft({ dose: '5', observacao: 'x' })], CATALOGO);
assert.equal(semProduto.ok, false, 'NEGATIVO: dose sem programa e sem medicamento');
assert.match(semProduto.errors[0], /Aplicação de sanidade 1: escolha o programa ou o medicamento\./);
assert.deepEqual(semProduto.payload, [], 'NEGATIVO: com erro nada vai no payload');
const doseTexto = buildSanityPayload([comVacina, { ...comVacina, key: 'b', dose: '1 ml / 50 kg' }], CATALOGO);
assert.equal(doseTexto.ok, false, 'NEGATIVO: dose em texto não é enviada');
assert.match(doseTexto.errors[0], /Aplicação de sanidade 2: a dose deve ser um número maior que zero\./);
assert.equal(buildSanityPayload([{ ...comVacina, dose: '0' }], CATALOGO).ok, false, 'NEGATIVO: dose zero');
const inativo = buildSanityPayload([newSanityDraft({ programa_sanidade_id: 'prog-removido' })], CATALOGO);
assert.equal(inativo.ok, false, 'NEGATIVO: programa inativo/removido é recusado antes de salvar');
assert.match(inativo.errors[0], /programa escolhido não está ativo/);
assert.equal(buildSanityPayload([newSanityDraft({ programa_sanidade_id: 'prog-removido' })]).ok, true, 'sem catálogo carregado a checagem de ativo fica para o serviço');
assert.throws(() => validateLaunchApplications([{ dose: 5 }], { data: DATA, today: TODAY }), /programa de sanidade ou o medicamento/, 'serviço recusa o mesmo caso negativo');

// ---------------------------------------------------------------------------
// 5) Contexto por modo: sanidade só em Cadastro/Manejo; troca de modo, sessão e edição.
assert.deepEqual([...SANITY_MODES], ['Cadastro', 'Manejo']);
assert.equal(modeSupportsSanity('Saída'), false, 'Saída não mostra o painel');
const manejoSequencia = { ...applyContext('Manejo', { dataPesagem: DATA }, null, { defaults: DEFAULTS }), sanidadeSequencia: true, mostrarSanidade: true, sanidadeAplicacoes: [{ ...comVacina, observacao: 'não guardar' }] };
let troca = switchMode(manejoSequencia, 'Saída', {}, { defaults: DEFAULTS });
assert.deepEqual(troca.form.sanidadeAplicacoes, [], 'NEGATIVO: aplicações do Manejo não vão para a Saída');
troca = switchMode(troca.form, 'Manejo', troca.contexts, { defaults: DEFAULTS });
assert.equal(troca.form.sanidadeAplicacoes.length, 1, 'voltar ao Manejo restaura a configuração marcada');
assert.equal(troca.form.sanidadeAplicacoes[0].observacao, '', 'NEGATIVO: observação da aplicação não é contexto');
assert.deepEqual(contextOf('Manejo', { ...manejoSequencia, sanidadeSequencia: false }).sanidadeAplicacoes, [], 'desmarcado não é contexto');
const sessao = serializeLaunchState({ form: manejoSequencia });
assert.ok(!JSON.stringify(sessao).includes('não guardar'), 'NEGATIVO: sessão não guarda observação da aplicação');
assert.equal(restoreLaunchState(sessao, { defaults: DEFAULTS }).form.sanidadeAplicacoes[0].medicamento_id, 'med-vacina', 'sessão restaura a configuração marcada');
assert.deepEqual(serializeLaunchState({ form: { ...manejoSequencia, sanidadeSequencia: false } }).contextos.Manejo.sanidadeAplicacoes, [], 'NEGATIVO: aplicações do animal atual (desmarcado) não vão para a sessão');
const edicao = beginEdit(manejoSequencia, { defaults: DEFAULTS });
assert.deepEqual(edicao.form.sanidadeAplicacoes, [], 'edição não mostra rascunhos da sequência');
assert.equal(endEdit(edicao.savedContext, { defaults: DEFAULTS }).sanidadeAplicacoes.length, 1, 'fim da edição devolve a configuração marcada');

// ---------------------------------------------------------------------------
// 6) Legacy payload: aplicações nunca entram no registro da pesagem.
assert.ok(!LEGACY_PAYLOAD_ALLOWLIST.includes('aplicacoes_sanidade'), 'aplicacoes_sanidade fora do legacy_payload (ADR-027)');

// ---------------------------------------------------------------------------
// 7) Fonte: página e painel ligados ao sanityService; escondidos sem weighing.write.
const page = read('src/pages/LancamentoPesagensIndividuais.jsx');
const panel = read('src/components/pesagens/SanidadeLancamentoPanel.jsx');
const between = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `trecho não encontrado: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `fim do trecho não encontrado: ${end}`);
  return source.slice(from, to);
};
assert.match(page, /import \{ listApplications, listMedicamentos, listProgramas \} from "@\/modules\/sanity\/application\/sanityService";/, 'página carrega cadastros e aplicações pelo sanityService');
assert.match(page, /import SanidadeLancamentoPanel from "\.\.\/components\/pesagens\/SanidadeLancamentoPanel";/);
assert.match(page, /const podeRegistrarSanidade = auth \? Boolean\(auth\.can\?\.\('weighing\.write'\)\) : true;/, 'permissão do painel = weighing.write (sem ação nova)');
assert.match(page, /\{podeRegistrarSanidade && modeSupportsSanity\(tipoManejo\) && mostrarSanidade &&\s*<SanidadeLancamentoPanel/, 'painel só com weighing.write, em Cadastro/Manejo');
assert.match(page, /\{podeRegistrarSanidade && modeSupportsSanity\(tipoManejo\) && \(\s*<Button[\s\S]{0,400}d17d-sanity-toggle/, 'botão da barra só com weighing.write');
assert.equal((page.match(/<SanidadeLancamentoPanel/g) || []).length, 1, 'um único painel na tela');
assert.match(page, /listProgramas\(\{ empresaId: empresaSelecionadaId \}\)/, 'programas ativos');
assert.match(page, /listMedicamentos\(\{ empresaId: empresaSelecionadaId \}\)/, 'medicamentos ativos');
assert.match(page, /if \(!podeRegistrarSanidade\) return undefined;/, 'sem weighing.write nem carrega os cadastros');
assert.match(page, /weighingService\.createEntry\(\{ \.\.\.data, (?:id: cicloLancamentoRef\.current, )?aplicacoes_sanidade: sanidadeValidada\.payload \}\)/, 'createEntry recebe aplicacoes_sanidade');
assert.match(page, /const sanidadeNoLancamento = !editingId && podeRegistrarSanidade && modeSupportsSanity\(tipoManejo\);/, 'edição e Saída não enviam aplicações');
assert.match(page, /buildSanityPayload\(sanidadeAplicacoes,/, 'payload montado pelo módulo puro');
const dataBlock = between(page, 'const data = {', '\n    };');
assert.ok(!dataBlock.includes('aplicacoes_sanidade'), 'NEGATIVO: aplicações não fazem parte do payload da pesagem (nem da edição)');
assert.match(page, /weighingService\.updateEntry\(editingId, data\)/, 'NEGATIVO: updateEntry não recebe aplicações');
assert.match(page, /listApplications\(\{ animalId: animalIdSelecionado, includeCancelled: true, empresaId: empresaSelecionadaId \}\)[\s\S]{0,200}linha\.pesagem_id === editingId/, 'edição lista as aplicações desta pesagem');
assert.match(page, /modoEdicao=\{Boolean\(editingId\)\}/);
assert.match(page, /sanidadeSequencia,\n\s*\}\);/, 'stateAfterSave recebe a marcação da sequência');

assert.match(panel, /from "@\/modules\/sanity\/application\/sanityService";/, 'painel usa enumerações e suggestedDose do sanityService');
for (const nome of ['suggestedDose', 'VIA_LABELS', 'VIAS_APLICACAO', 'UNIDADES_DOSE', 'PROGRAMA_TIPO_LABELS']) assert.match(panel, new RegExp(`\\b${nome}\\b`), `painel usa ${nome}`);
for (const texto of ['Sanidade', 'Adicionar aplicação', 'Programa/Procedimento', 'Medicamento/Produto', '>Dose<', '>Unidade<', '>Via<', '>Observação<', 'Aplicar esta configuração aos próximos animais', 'Sugestão: {sugestaoTexto}', 'tela Sanidade', 'somente leitura']) {
  assert.ok(panel.includes(texto), `painel exibe "${texto}"`);
}
assert.match(panel, /applyMedicamentoToDraft\(atual, medicamento, medicamento \? suggestedDose\(medicamento\) : null\)/, 'escolher medicamento pré-preenche pela dose padrão numérica');
const panelCode = panel.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
// Missão pesagens-integrada F09: o painel recebe o peso (pesoBase) para PEDIR a dose sugerida ao serviço, mas não faz
// conta de dose: o cálculo fica em sanityService.getDoseSuggestion (posologia APROVADA) e a dose exige confirmação.
assert.ok(!/pesoInformado|kg\s*[*/]|[*/]\s*(peso|kg)\b/i.test(panelCode), 'NEGATIVO: painel não calcula dose (sem aritmética de peso)');
assert.match(panelCode, /getDoseSuggestion\(/, 'dose sugerida vem do serviço (posologia aprovada)');
assert.ok(panel.includes('Confirmo a dose aplicada'), 'dose pela posologia exige confirmação do operador');
assert.ok(panel.includes('aguardando peso estável da balança'), 'na pesagem automática só sugere com peso estável (portão da Fase A)');
assert.match(panel, /d17d-detail-panel/, 'painel segue o padrão ModeloBase1 dos painéis do Lançamento');
const edicaoPainel = between(panel, '{modoEdicao ? (', ') : (');
assert.ok(!/<Select|<Input|onAplicacoesChange/.test(edicaoPainel), 'NEGATIVO: em edição o painel é somente leitura');

console.log(JSON.stringify({
  gate: 'sanity:launch-integration:verify',
  ok: true,
  sequenceAnimals: payloads.length,
  applicationsPerAnimal: payloads[0].length,
  observationLeaks: 0,
  uncheckedClears: true,
  payloadAcceptedBySanityRules: true,
  panelRequiresWeighingWrite: true,
  editReadOnly: true,
}, null, 2));
