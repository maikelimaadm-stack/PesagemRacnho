// Gate launch:sticky-context:verify (programa sanity-launch-import, fatia C).
// Contexto fixo por sequência do Lançamento: a matriz STICKY_FIELDS/ANIMAL_FIELDS por modo
// (src/modules/weighing/domain/launchContext.js) decide o que fica entre um animal e o
// próximo. Reproduz a missão §53 (Cadastro ABC/Nelore/Garrote manual/M/Apartação A →
// salva 001 → contexto igual, animal limpo; Manejo; Saída Venda + Embarque X) e os
// vazamentos V-01..V-09 / resets R-01..R-04 de CURRENT-LAUNCH-FLOW.md como casos negativos.
// Por fim inspeciona a fonte: a página usa o módulo e não zera contexto na mão.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANIMAL_FIELDS,
  CATEGORIA_AUTOMATICA,
  FORM_FIELDS,
  LAUNCH_MODES,
  LOTE_SEM_LOTE,
  RENDIMENTO_ORIGEM_INFORMADO,
  RENDIMENTO_ORIGEM_PADRAO_EMPRESA,
  STICKY_FIELDS,
  advanceIdentifierSequence,
  applyContext,
  beginEdit,
  blankForm,
  changeExitReason,
  classifyField,
  contextOf,
  endEdit,
  focusAfterSave,
  launchContextStorageKey,
  mergeDefaults,
  nextFreeIdentifier,
  parseSequenceIdentifier,
  readStoredLaunchState,
  restoreLaunchState,
  serializeLaunchState,
  stateAfterSave,
  switchMode,
  writeStoredLaunchState,
} from '../src/modules/weighing/domain/launchContext.js';
import * as policies from '../src/modules/operations/application/operationalPolicies.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (relative) => readFileSync(join(root, relative), 'utf8');

const DEFAULTS = Object.freeze({ marca: 'ABC', marcaId: 'marca-abc', raca: 'Nelore', racaId: 'raca-nelore', apartacaoSelecionada: '', rendimento: '52,00' });
const DATA = '2026-09-17';
const withAnimal = (form, extra = {}) => ({
  ...form,
  numeroAnimal: '001',
  animalIdSelecionado: 'animal-001',
  peso: '320',
  observacao: 'mancando da pata traseira',
  avisoTela: { tipo: 'alerta', mensagem: 'aviso do animal anterior' },
  era: '24',
  valorPagoCabeca: '2500,00',
  valorFreteCompra: '180,00',
  valorVendaTotal: '5400,00',
  valorTotalAbate: '6100,00',
  valorFreteVenda: '90,00',
  ...extra,
});
const ANIMAL_BLANK = blankForm();
const assertAnimalCleared = (form, label) => {
  for (const field of ANIMAL_FIELDS.Cadastro) {
    assert.deepEqual(form[field], ANIMAL_BLANK[field], `${label}: ${field} não pode atravessar o salvamento`);
  }
};

// ---------------------------------------------------------------------------
// 1) Matriz explícita por modo.
assert.deepEqual([...LAUNCH_MODES], ['Cadastro', 'Manejo', 'Saída']);
for (const mode of LAUNCH_MODES) {
  const sticky = new Set(STICKY_FIELDS[mode]);
  for (const field of ANIMAL_FIELDS[mode]) assert.ok(!sticky.has(field), `${mode}: ${field} não pode ser contexto e dado do animal ao mesmo tempo`);
  for (const field of [...STICKY_FIELDS[mode], ...ANIMAL_FIELDS[mode]]) assert.ok(FORM_FIELDS.includes(field), `${mode}: ${field} precisa existir no formulário`);
  for (const field of FORM_FIELDS) assert.ok(['sticky', 'animal', 'inactive'].includes(classifyField(mode, field)));
  for (const field of ['numeroAnimal', 'animalIdSelecionado', 'peso', 'observacao', 'avisoTela', 'era', 'editingId', 'valorPagoCabeca', 'valorVendaTotal', 'valorTotalAbate']) {
    assert.equal(classifyField(mode, field), 'animal', `${mode}: ${field} é dado do animal`);
  }
  assert.equal(classifyField(mode, 'dataPesagem'), 'sticky', `${mode}: data é contexto`);
  assert.equal(classifyField(mode, 'tipoManejo'), 'sticky', `${mode}: tipo é contexto`);
  assert.equal(classifyField(mode, 'apartacaoSelecionada'), 'sticky', `${mode}: apartação é contexto`);
}
for (const field of ['sexo', 'raca', 'racaId', 'marca', 'marcaId', 'categoriaSelecao']) {
  assert.equal(classifyField('Cadastro', field), 'sticky', `Cadastro: ${field} é contexto`);
  assert.equal(classifyField('Manejo', field), 'inactive', `NEGATIVO: Manejo não guarda ${field} (perfil do animal não é contexto, V-08)`);
  assert.equal(classifyField('Saída', field), 'inactive', `NEGATIVO: Saída não guarda ${field}`);
}
assert.equal(classifyField('Saída', 'motivoSaida'), 'sticky');
assert.equal(classifyField('Saída', 'valorArroba'), 'sticky', 'preço da arroba é termo da negociação (contexto)');
assert.equal(classifyField('Cadastro', 'motivoSaida'), 'inactive');
assert.equal(RENDIMENTO_ORIGEM_INFORMADO, policies.RENDIMENTO_ORIGEM_INFORMADO, 'origem INFORMADO igual à das políticas');
assert.equal(RENDIMENTO_ORIGEM_PADRAO_EMPRESA, policies.RENDIMENTO_ORIGEM_PADRAO_EMPRESA, 'origem PADRAO_EMPRESA igual à das políticas');

// ---------------------------------------------------------------------------
// 2) Missão §53 — Cadastro: Marca ABC, Raça Nelore, Categoria Garrote (manual), Sexo M, Apartação A.
const cadastroBase = {
  ...applyContext('Cadastro', { dataPesagem: DATA }, null, { defaults: DEFAULTS }),
  sexo: 'M',
  categoriaSelecao: 'cat-garrote',
  apartacaoSelecionada: 'apartacao-a',
  mostrarDadosCompra: true,
  origemAnimal: 'Fazenda Boa Vista',
  numeroGTA: 'GTA-77',
};
assert.equal(cadastroBase.marca, 'ABC');
assert.equal(cadastroBase.raca, 'Nelore');
const cadastroPreenchido = withAnimal(cadastroBase);
const depoisCadastro = stateAfterSave('Cadastro', cadastroPreenchido, { categoriaModo: 'MANUAL' });
assert.deepEqual(contextOf('Cadastro', depoisCadastro), contextOf('Cadastro', cadastroBase), '§53: contexto do Cadastro igual depois de salvar 001');
assert.equal(depoisCadastro.tipoManejo, 'Cadastro');
assert.equal(depoisCadastro.dataPesagem, DATA);
assert.equal(depoisCadastro.marca, 'ABC');
assert.equal(depoisCadastro.marcaId, 'marca-abc');
assert.equal(depoisCadastro.raca, 'Nelore');
assert.equal(depoisCadastro.sexo, 'M');
assert.equal(depoisCadastro.categoriaSelecao, 'cat-garrote', 'categoria MANUAL fica para o próximo animal');
assert.equal(depoisCadastro.apartacaoSelecionada, 'apartacao-a');
assert.equal(depoisCadastro.origemAnimal, 'Fazenda Boa Vista', 'dados da compra (lote comprado) ficam');
assertAnimalCleared(depoisCadastro, '§53 Cadastro');
assert.equal(focusAfterSave('Cadastro', {}), 'numero', 'sem sequência o foco vai para o Nº');

// Categoria automática não é congelada: continua "Automático" e recalcula pelo próximo peso.
const cadastroAutomatico = stateAfterSave('Cadastro', withAnimal({ ...cadastroBase, categoriaSelecao: CATEGORIA_AUTOMATICA }), { categoriaModo: 'AUTOMATICA' });
assert.equal(cadastroAutomatico.categoriaSelecao, CATEGORIA_AUTOMATICA, 'categoria automática continua automática');
assert.equal(stateAfterSave('Cadastro', cadastroPreenchido, { categoriaModo: 'AUTOMATICA' }).categoriaSelecao, CATEGORIA_AUTOMATICA, 'NEGATIVO: seleção automática nunca vira a categoria calculada do animal anterior');

// ---------------------------------------------------------------------------
// 3) Manejo: contexto permanece, animal e prévia saem.
const manejoBase = { ...applyContext('Manejo', { dataPesagem: DATA }, null, { defaults: DEFAULTS }), apartacaoSelecionada: 'apartacao-b', loteTransferencia: LOTE_SEM_LOTE };
const depoisManejo = stateAfterSave('Manejo', withAnimal(manejoBase, { numeroAnimal: '009', animalIdSelecionado: 'animal-009' }), {});
assert.deepEqual(contextOf('Manejo', depoisManejo), contextOf('Manejo', manejoBase), 'Manejo: contexto igual depois de salvar');
assert.equal(depoisManejo.loteTransferencia, LOTE_SEM_LOTE, '"Sem lote" é regra da sequência e fica');
assertAnimalCleared(depoisManejo, 'Manejo');
// V-09: lote escolhido à mão vale só para o animal salvo.
const manejoLoteManual = stateAfterSave('Manejo', withAnimal({ ...manejoBase, loteTransferencia: 'lote-7' }), {});
assert.equal(manejoLoteManual.loteTransferencia, '', 'NEGATIVO V-09: lote manual não vaza para o próximo animal');
assert.equal(manejoLoteManual.apartacaoSelecionada, 'apartacao-b');

// V-08: perfil do animal selecionado no Manejo não contamina o contexto do Cadastro.
const manejoComPerfil = { ...withAnimal(manejoBase), sexo: 'F', marca: 'XYZ', marcaId: 'marca-xyz', raca: 'Angus', racaId: 'raca-angus', era: '36' };
const voltaCadastro = switchMode(manejoComPerfil, 'Cadastro', { Cadastro: contextOf('Cadastro', cadastroBase) }, { defaults: DEFAULTS });
assert.equal(voltaCadastro.form.marca, 'ABC', 'NEGATIVO V-08: marca do animal do Manejo não entra no Cadastro');
assert.equal(voltaCadastro.form.sexo, 'M', 'NEGATIVO V-08: sexo do animal do Manejo não entra no Cadastro');
assert.equal(voltaCadastro.form.raca, 'Nelore', 'NEGATIVO V-08: raça do animal do Manejo não entra no Cadastro');
assert.equal(voltaCadastro.form.era, '', 'NEGATIVO V-08: era do animal não entra no Cadastro');
assert.equal(voltaCadastro.form.categoriaSelecao, 'cat-garrote');
const cadastroSemContexto = switchMode(manejoComPerfil, 'Cadastro', {}, { defaults: DEFAULTS });
assert.equal(cadastroSemContexto.form.marca, 'ABC', 'Cadastro sem contexto usa o padrão da empresa, nunca o perfil do animal');
assert.equal(cadastroSemContexto.form.sexo, 'M');
assertAnimalCleared(cadastroSemContexto.form, 'troca Manejo → Cadastro');

// ---------------------------------------------------------------------------
// 4) Saída: Motivo Venda + Embarque X permanecem; valores e cálculos individuais saem.
const saidaVenda = {
  ...applyContext('Saída', { dataPesagem: DATA }, null, { defaults: DEFAULTS }),
  motivoSaida: 'Venda',
  embarqueSelecionadoDoc: 'embarque-x',
  documentoSelecionado: 'documento-x1',
  mostrarDadosVenda: true,
  comprador: 'Frigorífico Central',
  destinoVenda: 'Fazenda Destino',
  valorArroba: '310,00',
  rendimentoCarcacaVenda: '54',
  rendimentoOrigemVenda: RENDIMENTO_ORIGEM_INFORMADO,
  apartacaoSelecionada: 'apartacao-embarque',
};
const depoisVenda = stateAfterSave('Saída', withAnimal(saidaVenda), {});
assert.deepEqual(contextOf('Saída', depoisVenda), contextOf('Saída', saidaVenda), '§53 Saída: contexto igual depois de salvar');
assert.equal(depoisVenda.motivoSaida, 'Venda');
assert.equal(depoisVenda.embarqueSelecionadoDoc, 'embarque-x');
assert.equal(depoisVenda.documentoSelecionado, 'documento-x1');
assert.equal(depoisVenda.comprador, 'Frigorífico Central');
assert.equal(depoisVenda.valorArroba, '310,00');
assert.equal(depoisVenda.rendimentoCarcacaVenda, '54');
assert.equal(depoisVenda.valorVendaTotal, '', 'NEGATIVO V-02: valor total da venda do animal anterior não fica');
assert.equal(depoisVenda.valorFreteVenda, '', 'NEGATIVO: frete digitado no lançamento não fica');
assertAnimalCleared(depoisVenda, 'Saída Venda');
const depoisAbate = stateAfterSave('Saída', withAnimal({ ...saidaVenda, motivoSaida: 'Abate', frigorifico: 'Frigo Sul', valorArrobaAbate: '305,00' }), {});
assert.equal(depoisAbate.valorTotalAbate, '', 'NEGATIVO V-02: valor total do abate não fica');
assert.equal(depoisAbate.frigorifico, 'Frigo Sul');
assert.equal(depoisAbate.valorArrobaAbate, '305,00');
assert.equal(depoisAbate.embarqueSelecionadoDoc, 'embarque-x', 'Abate também usa embarque');

// V-03: causa da morte só com "Repetir causa para os próximos".
const saidaMorte = { ...changeExitReason(saidaVenda, 'Morte'), causaMorte: 'Picada de cobra' };
assert.equal(stateAfterSave('Saída', withAnimal(saidaMorte), {}).causaMorte, '', 'NEGATIVO V-03: causa não marcada não vaza');
assert.equal(stateAfterSave('Saída', withAnimal(saidaMorte), { repetirCausaMorte: true }).causaMorte, 'Picada de cobra', 'causa marcada para repetir fica');
assert.equal(stateAfterSave('Saída', withAnimal({ ...saidaMorte, repetirCausaMorte: true }), {}).repetirCausaMorte, true);
assert.equal(contextOf('Saída', { ...saidaMorte, motivoSaida: 'Venda', repetirCausaMorte: true }).causaMorte, '', 'NEGATIVO: repetir só vale para Morte');

// V-04: motivo sem embarque/documento solta os vínculos (na troca e no contexto).
assert.equal(saidaMorte.embarqueSelecionadoDoc, '', 'NEGATIVO V-04: trocar Venda → Morte limpa o embarque');
assert.equal(saidaMorte.documentoSelecionado, '', 'NEGATIVO V-04: trocar Venda → Morte limpa o documento');
assert.equal(saidaMorte.causaMorte, 'Picada de cobra');
const vendaParaAbate = changeExitReason(saidaVenda, 'Abate');
assert.equal(vendaParaAbate.embarqueSelecionadoDoc, 'embarque-x', 'Venda → Abate mantém o embarque (os dois usam)');
for (const motivo of ['Doação', 'Transferência', 'Outros']) {
  const contexto = contextOf('Saída', { ...saidaVenda, motivoSaida: motivo });
  assert.equal(contexto.embarqueSelecionadoDoc, '', `NEGATIVO V-04: ${motivo} não guarda embarque`);
  assert.equal(contexto.documentoSelecionado, '', `NEGATIVO V-04: ${motivo} não guarda documento`);
}
assert.equal(changeExitReason({ ...saidaMorte, repetirCausaMorte: true }, 'Venda').repetirCausaMorte, false, 'trocar de Morte desliga o repetir');

// ---------------------------------------------------------------------------
// 5) Troca de modo guarda e restaura o contexto de cada modo; a data é compartilhada.
let contexts = {};
let atual = cadastroPreenchido;
({ form: atual, contexts } = switchMode(atual, 'Manejo', contexts, { defaults: DEFAULTS }));
assertAnimalCleared(atual, 'troca Cadastro → Manejo');
atual = { ...atual, apartacaoSelecionada: 'apartacao-b', dataPesagem: '2026-09-16' };
({ form: atual, contexts } = switchMode(atual, 'Saída', contexts, { defaults: DEFAULTS }));
atual = { ...saidaVenda, dataPesagem: atual.dataPesagem };
({ form: atual, contexts } = switchMode(atual, 'Cadastro', contexts, { defaults: DEFAULTS }));
assert.deepEqual(contextOf('Cadastro', atual), { ...contextOf('Cadastro', cadastroBase), dataPesagem: '2026-09-16' }, 'Cadastro volta com o próprio contexto e a data atual');
({ form: atual, contexts } = switchMode(atual, 'Saída', contexts, { defaults: DEFAULTS }));
assert.equal(atual.motivoSaida, 'Venda');
assert.equal(atual.embarqueSelecionadoDoc, 'embarque-x');
assert.equal(atual.valorVendaTotal, '', 'NEGATIVO: troca de modo não restaura valor individual');
({ form: atual, contexts } = switchMode(atual, 'Manejo', contexts, { defaults: DEFAULTS }));
assert.equal(atual.apartacaoSelecionada, 'apartacao-b', 'Manejo volta com a própria apartação');
assert.equal(atual.dataPesagem, '2026-09-16');

// ---------------------------------------------------------------------------
// 6) Edição: beginEdit guarda o contexto; Atualizar/Cancelar (endEdit) devolve exatamente o anterior.
const { form: formEdicao, savedContext } = beginEdit(withAnimal(cadastroBase), { defaults: DEFAULTS });
assert.equal(formEdicao.apartacaoSelecionada, '', 'NEGATIVO V-06: registro sem apartação não herda a do contexto');
assert.equal(formEdicao.loteTransferencia, '');
assertAnimalCleared(formEdicao, 'formulário de edição');
assert.equal(savedContext.mode, 'Cadastro');
// O registro editado (uma Venda antiga) sobrescreve o formulário, como handleEditar faz.
const registroAberto = { ...formEdicao, editingId: 'pesagem-antiga', tipoManejo: 'Saída', motivoSaida: 'Venda', comprador: 'Comprador Antigo', valorVendaTotal: '7000', causaMorte: '', embarqueSelecionadoDoc: 'embarque-antigo', numeroAnimal: '555', peso: '480', marca: 'OUTRA' };
const depoisAtualizar = endEdit(savedContext, { form: registroAberto, defaults: DEFAULTS });
assert.deepEqual(contextOf('Cadastro', depoisAtualizar), contextOf('Cadastro', cadastroBase), 'Atualizar/Cancelar restaura o contexto anterior (V-05, R-01)');
assert.equal(depoisAtualizar.tipoManejo, 'Cadastro', 'volta ao tipo de antes da edição');
assert.equal(depoisAtualizar.comprador, '', 'NEGATIVO V-05: comprador do registro editado não fica');
assert.equal(depoisAtualizar.valorVendaTotal, '', 'NEGATIVO V-05: valor do registro editado não fica');
assert.equal(depoisAtualizar.marca, 'ABC', 'NEGATIVO V-05: marca do registro editado não fica');
assertAnimalCleared(depoisAtualizar, 'fim da edição');
// R-01: cancelar a edição a partir de uma Saída não zera motivo/causa repetida.
const saidaRepetindo = { ...saidaMorte, repetirCausaMorte: true };
const edicaoSaida = beginEdit(saidaRepetindo, { defaults: DEFAULTS });
const cancelada = endEdit(edicaoSaida.savedContext, { form: { ...edicaoSaida.form, motivoSaida: 'Venda', tipoManejo: 'Saída' }, defaults: DEFAULTS });
assert.equal(cancelada.motivoSaida, 'Morte', 'NEGATIVO R-01: cancelar não zera o motivo');
assert.equal(cancelada.causaMorte, 'Picada de cobra', 'NEGATIVO R-01: cancelar não zera a causa marcada para repetir');
assert.equal(cancelada.sexo, 'M');

// ---------------------------------------------------------------------------
// 7) SN (V-07): o perfil confirmado não está no formulário; o contexto do Cadastro não muda.
const depoisSn = stateAfterSave('Cadastro', withAnimal(cadastroBase, { numeroAnimal: 'SN 3' }), { categoriaModo: 'MANUAL' });
assert.deepEqual(contextOf('Cadastro', depoisSn), contextOf('Cadastro', cadastroBase), 'NEGATIVO V-07: salvar um SN não troca o contexto do Cadastro');

// ---------------------------------------------------------------------------
// 8) V-01: o contexto seguinte nasce do snapshot submetido (função pura, sem fechamento antigo).
const antigo = { ...cadastroBase, categoriaSelecao: 'cat-bezerro', marca: 'VELHA', marcaId: 'marca-velha' };
const submetido = withAnimal(cadastroBase);
const seguinte = stateAfterSave('Cadastro', submetido, { categoriaModo: 'MANUAL' });
assert.notEqual(seguinte.marca, antigo.marca, 'NEGATIVO V-01: nenhum valor de um snapshot anterior volta');
assert.equal(seguinte.categoriaSelecao, 'cat-garrote');

// ---------------------------------------------------------------------------
// 9) R-04: padrões que chegam depois só trocam o que ainda está com o padrão anterior.
const semPadroes = applyContext('Cadastro', { dataPesagem: DATA }, null, {});
const comPadroes = mergeDefaults(semPadroes, {}, DEFAULTS);
assert.equal(comPadroes.marca, 'ABC');
assert.equal(comPadroes.racaId, 'raca-nelore');
assert.equal(comPadroes.rendimentoCarcacaVenda, '52,00');
const escolhido = { ...semPadroes, marca: 'XYZ', marcaId: 'marca-xyz', rendimentoCarcacaAbate: '49', rendimentoOrigemAbate: RENDIMENTO_ORIGEM_INFORMADO };
const naoSobrescrito = mergeDefaults(escolhido, {}, DEFAULTS);
assert.equal(naoSobrescrito.marca, 'XYZ', 'NEGATIVO R-04: marca já escolhida não é sobrescrita');
assert.equal(naoSobrescrito.rendimentoCarcacaAbate, '49', 'NEGATIVO R-04: rendimento informado não é sobrescrito');
assert.deepEqual(Object.keys(mergeDefaults(contextOf('Manejo', manejoBase), {}, DEFAULTS)).sort(), Object.keys(contextOf('Manejo', manejoBase)).sort(), 'contexto parcial não ganha campos de outros modos');

// ---------------------------------------------------------------------------
// 10) R-03: sessionStorage por empresa + usuário, só contexto.
const chaveA = launchContextStorageKey({ empresaId: 'local', usuarioId: 'user-a' });
const chaveB = launchContextStorageKey({ empresaId: 'local', usuarioId: 'user-b' });
assert.notEqual(chaveA, chaveB, 'chave separada por usuário');
assert.notEqual(chaveA, launchContextStorageKey({ empresaId: 'outra', usuarioId: 'user-a' }), 'chave separada por empresa');
const snapshot = serializeLaunchState({ form: withAnimal(saidaVenda), contexts: { Cadastro: contextOf('Cadastro', cadastroBase) } });
const json = JSON.stringify(snapshot);
for (const proibido of ['mancando da pata traseira', '5400,00', '6100,00', '2500,00', 'animal-001', '"peso"', '"numeroAnimal"', '"observacao"', '"valorVendaTotal"', '"editingId"', '"avisoTela"']) {
  assert.ok(!json.includes(proibido), `NEGATIVO R-03: sessão não guarda ${proibido}`);
}
assert.equal(snapshot.modo, 'Saída');
assert.equal(snapshot.dataPesagem, DATA);
const memoria = new Map();
const storage = { getItem: (key) => (memoria.has(key) ? memoria.get(key) : null), setItem: (key, value) => memoria.set(key, String(value)) };
assert.equal(writeStoredLaunchState(storage, chaveA, snapshot), true);
const restaurado = restoreLaunchState(readStoredLaunchState(storage, chaveA), { defaults: DEFAULTS });
assert.equal(restaurado.mode, 'Saída');
assert.deepEqual(contextOf('Saída', restaurado.form), contextOf('Saída', saidaVenda), 'voltar à tela restaura o contexto da Saída');
assert.deepEqual(restaurado.contexts.Cadastro, { ...contextOf('Cadastro', cadastroBase), dataPesagem: '' }, 'contexto do Cadastro também volta (data vem do modo atual)');
assertAnimalCleared(restaurado.form, 'contexto restaurado');
assert.equal(readStoredLaunchState(storage, chaveB), null, 'NEGATIVO: outro usuário não recebe o contexto');
// Em edição a sessão guarda o contexto de ANTES da edição, nunca o registro aberto.
const emEdicao = serializeLaunchState({ form: registroAberto, contexts: {}, savedContext });
assert.equal(emEdicao.modo, 'Cadastro');
assert.ok(!JSON.stringify(emEdicao).includes('Comprador Antigo'), 'NEGATIVO: registro em edição não vai para a sessão');
// Snapshot adulterado: campos do animal são descartados; versão inválida é ignorada.
const adulterado = { ...snapshot, contextos: { ...snapshot.contextos, Saída: { ...snapshot.contextos.Saída, peso: '999', numeroAnimal: 'X1', valorVendaTotal: '1' } } };
const restauradoAdulterado = restoreLaunchState(adulterado, { defaults: DEFAULTS });
assert.equal(restauradoAdulterado.form.peso, '', 'NEGATIVO: peso vindo da sessão é descartado');
assert.equal(restauradoAdulterado.form.numeroAnimal, '');
assert.equal(restauradoAdulterado.form.valorVendaTotal, '');
assert.equal(restaurado.form.dataPesagem, DATA, 'data guardada volta');
assert.ok(!Object.hasOwn(restoreLaunchState({ ...snapshot, dataPesagem: '17/09' }, { defaults: DEFAULTS }).form, 'dataPesagem'), 'NEGATIVO: data inválida na sessão não apaga a data da tela');
assert.equal(restoreLaunchState({ ...snapshot, versao: 99 }), null, 'NEGATIVO: versão desconhecida');
assert.equal(restoreLaunchState({ ...snapshot, modo: 'Pesagem' }), null, 'NEGATIVO: modo desconhecido');
const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cota'); } };
assert.equal(readStoredLaunchState(quebrado, chaveA), null, 'storage indisponível não derruba a tela');
assert.equal(writeStoredLaunchState(quebrado, chaveA, snapshot), false);
assert.equal(readStoredLaunchState({ getItem: () => '{json inválido' }, chaveA), null);

// ---------------------------------------------------------------------------
// 11) Sequência de identificadores avança; Nº preenchido leva o foco ao Peso.
assert.deepEqual(parseSequenceIdentifier('br007'), { prefixo: 'BR', numero: 7, digitos: 3 }, 'prefixo normalizado em maiúsculas (B-08)');
assert.equal(parseSequenceIdentifier('7-A'), null, 'NEGATIVO V-12: fora do formato não inicia sequência');
const inicio = nextFreeIdentifier({ prefixo: '', inicio: 1, limite: 5, digitos: 3, usados: new Set(['001']) });
assert.deepEqual(inicio, { numero: 2, formatado: '002', pulos: 1 });
let cursor = { prefixo: '', numeroAtual: 2, numeroInicial: 1, digitos: 3, numeroFinal: 5, direcao: 'crescente' };
const passo1 = advanceIdentifierSequence(cursor, new Set(['001', '003']));
assert.equal(passo1.ok, true);
assert.equal(passo1.formatado, '004', 'avança pulando o número já usado');
assert.equal(passo1.pulos, 1);
cursor = passo1.state;
const passo2 = advanceIdentifierSequence(cursor, passo1.usados);
assert.equal(passo2.formatado, '005');
const fim = advanceIdentifierSequence(passo2.state, passo2.usados);
assert.equal(fim.ok, false, 'intervalo esgotado encerra a sequência');
const decrescente = advanceIdentifierSequence({ prefixo: '', numeroAtual: 0, digitos: 3, numeroFinal: null, direcao: 'decrescente' }, new Set());
assert.equal(decrescente.ok, false, 'NEGATIVO B-08: decrescente sem final não gera número negativo');
const cadastroSequencia = stateAfterSave('Cadastro', withAnimal(cadastroBase, { numeroAnimal: '003' }), { categoriaModo: 'MANUAL', sequenciaAtiva: true, proximoNumero: '004' });
assert.equal(cadastroSequencia.numeroAnimal, '004', 'sequência preenche o próximo Nº');
assert.equal(focusAfterSave('Cadastro', { sequenciaAtiva: true, proximoNumero: '004' }), 'peso', 'Nº preenchido pela sequência → foco no Peso');
assert.equal(focusAfterSave('Cadastro', { sequenciaAtiva: false, proximoNumero: null }), 'numero', 'NEGATIVO B-10: sequência esgotada → foco no Nº');
assert.equal(stateAfterSave('Manejo', withAnimal(manejoBase), { sequenciaAtiva: true, proximoNumero: '004' }).numeroAnimal, '', 'NEGATIVO: sequência só preenche Nº no Cadastro');
assert.equal(endEdit(savedContext, { defaults: DEFAULTS, proximoNumero: '004' }).numeroAnimal, '004', 'fim da edição devolve o Nº atual da sequência');

// ---------------------------------------------------------------------------
// 12) Fonte: a página usa launchContext e não zera contexto na mão.
const page = read('src/pages/LancamentoPesagensIndividuais.jsx');
const sequence = read('src/components/pesagens/SequenciaBrincos.jsx');
const snDialog = read('src/components/pesagens/ConfirmarAnimalSnDialog.jsx');
const between = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `trecho não encontrado: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `fim do trecho não encontrado: ${end}`);
  return source.slice(from, to);
};
assert.match(page, /from "@\/modules\/weighing\/domain\/launchContext"/, 'página importa launchContext');
for (const fn of ['stateAfterSave', 'beginEdit', 'endEdit', 'switchMode', 'changeExitReason', 'mergeDefaults', 'serializeLaunchState', 'restoreLaunchState', 'focusAfterSave']) {
  assert.match(page, new RegExp(`\\b${fn}\\(`), `página usa ${fn}`);
}
for (const legado of ['salvarConfiguracaoTipoAtual', 'aplicarConfiguracaoTipo', 'configuracoesPorTipoRef', 'criarConfiguracaoPadraoMovimentacao', 'window.__sequenciaBrincos', 'setDocumentacao']) {
  assert.ok(!page.includes(legado), `NEGATIVO: página não usa mais ${legado}`);
}
assert.ok(!sequence.includes('window.__sequenciaBrincos'), 'NEGATIVO: sequência sem ponte global em window');
assert.match(sequence, /controllerRef\.current = \{/, 'sequência entrega o controle por ref');
assert.match(sequence, /advanceIdentifierSequence\(/, 'sequência usa a regra pura de avanço');
const avancar = between(sequence, 'avancar: (usadosAtualizado) =>', 'getState:');
assert.ok(!/onSetNumeroAnimal|onFocusPeso/.test(avancar), 'NEGATIVO: avançar não aplica Nº/foco (a página decide com stateAfterSave)');

// Cada campo da matriz tem estado e setter na página (snapshot e aplicação completos).
const snapshotBlock = between(page, 'const formularioAtual = {', '};');
const settersBlock = between(page, 'const settersFormulario = {', '};');
for (const field of FORM_FIELDS) {
  assert.match(snapshotBlock, new RegExp(`\\b${field}\\b`), `formularioAtual inclui ${field}`);
  assert.match(settersBlock, new RegExp(`\\b${field}: set[A-Z]\\w*`), `settersFormulario inclui ${field}`);
}

// Pós-salvar: o próximo formulário vem do módulo; nenhum reset manual de contexto ou do animal.
const posSalvar = between(page, 'const eraEdicao = Boolean(editingId);', '} catch (error) {');
assert.match(posSalvar, /stateAfterSave\(tipoManejo, formularioSubmetido,/, 'novo lançamento usa stateAfterSave com o snapshot submetido');
assert.match(posSalvar, /endEdit\(contextoAntesEdicaoRef\.current,/, 'Atualizar usa endEdit');
assert.match(posSalvar, /aplicarForm\(proximoFormulario\)/);
assert.ok(!/\bset(?:NumeroAnimal|Peso|Observacao|AnimalIdSelecionado|EditingId|CategoriaSelecao|Era|Sexo|Marca|MarcaId|Raca|RacaId|ApartacaoSelecionada|LoteTransferencia|CausaMorte|MotivoSaida|ValorVendaTotal|ValorTotalAbate|ValorPagoCabeca|EmbarqueSelecionadoDoc|DocumentoSelecionado|AvisoTela|SanidadeAplicacoes)\(/.test(posSalvar), 'NEGATIVO: pós-salvar não zera nem preserva campos na mão');

// Edição e cancelamento.
const editar = between(page, 'const handleEditar = (p) => {', 'numeroInputRef.current?.focus();');
assert.match(editar, /beginEdit\(formRef\.current,/, 'handleEditar guarda o contexto com beginEdit');
assert.match(editar, /if \(!contextoAntesEdicaoRef\.current\) contextoAntesEdicaoRef\.current = savedContext;/, 'editar outra linha não perde o contexto guardado');
const cancelar = between(page, 'const cancelarEdicao = () => {', '};');
assert.match(cancelar, /endEdit\(contextoAntesEdicaoRef\.current,/, 'Cancelar usa endEdit (R-01)');
assert.match(page, /onClick=\{cancelarEdicao\}/, 'botão Cancelar chama cancelarEdicao');

// Troca de modo e motivo.
const trocaModo = between(page, 'const handleTipoManejoChange = (novoTipo) => {', '\n  };');
assert.match(trocaModo, /if \(editingId\) \{[\s\S]{0,200}return;/, 'R-02: troca de modo com edição aberta é recusada sem perder a edição');
assert.match(trocaModo, /switchMode\(formRef\.current, novoTipo, contextosPorModoRef\.current,/);
assert.match(page, /onValueChange=\{\(value\) => aplicarForm\(changeExitReason\(formRef\.current, value\)\)\}/, 'motivo da saída usa changeExitReason (V-04)');
assert.match(page, /Repetir causa para os próximos/, 'opção de repetir a causa da morte');

// V-08 / V-07: perfil do animal e do SN não escrevem nos estados do Cadastro.
const aplicarAnimal = between(page, 'const aplicarAnimalSelecionado = (animal) => {', 'return true;');
assert.ok(!/set(?:Sexo|Raca|RacaId|Marca|MarcaId|Era|CategoriaSelecao)\(/.test(aplicarAnimal), 'NEGATIVO V-08: animal selecionado não escreve no contexto do Cadastro');
const snConfirm = between(page, 'onConfirm={(profile) => {', 'handleSalvar({ skipSnConfirmation: true, snProfile: profile })');
assert.ok(!/set(?:Sexo|Raca|RacaId|Marca|MarcaId|Era|CategoriaSelecao)\(/.test(snConfirm), 'NEGATIVO V-07: confirmar SN não escreve no contexto do Cadastro');
assert.match(page, /sexo: animalSelecionado\?\.sexo \|\| null,/, 'NEGATIVO V-08: Manejo/Saída não usa o sexo do formulário como fallback');
assert.match(snDialog, /import \{ CATEGORIA_AUTOMATICA \} from '@\/modules\/weighing\/domain\/launchContext'/);

// V-04 no payload e R-03/R-04 na página.
assert.match(page, /const usaEmbarque = tipoManejo === 'Saída' && exitReasonUsesShipment\(motivoSaida\);/);
assert.match(page, /embarque_id: usaEmbarque \?/, 'NEGATIVO V-04: embarque só vai no payload de Venda/Abate');
assert.match(page, /documento_embarque_id: usaEmbarque \?/);
assert.match(page, /launchContextStorageKey\(\{ empresaId: empresaSelecionadaId, usuarioId: auth\?\.user\?\.id \}\)/, 'R-03: chave da sessão por empresa + usuário');
assert.match(page, /window\.sessionStorage/, 'R-03: contexto em sessionStorage');
assert.ok(!/localStorage\.setItem\([^)]*contexto/i.test(page), 'NEGATIVO: contexto não vai para localStorage');
assert.match(page, /savedContext: contextoAntesEdicaoRef\.current/, 'R-03: em edição a sessão guarda o contexto anterior');
assert.match(page, /mergeDefaults\(formRef\.current, padroesAnteriores, padroes\)/, 'R-04: catálogos tardios passam por mergeDefaults');
assert.ok(!/if \(!editarId\) aplicarPadroesEmpresa\(padroes\)/.test(page), 'NEGATIVO R-04: padrões não são reaplicados por cima do formulário');

// Exportar do rodapé: contrato de colunas de pesagens (perfil amigável, colunas visíveis da grade).
assert.match(page, /exportWeighingCsv\(linhas, \{\s*profile: 'FRIENDLY',\s*columns: colunasOrdenadas\.map\(\(coluna\) => coluna\.id\),\s*canSeeCommercial: podeVerValores,/, 'Exportar do rodapé usa o contrato de exportação');
assert.match(page, /downloadCsvFile\(arquivo\)/);
assert.ok(!/ufeff|headers\.join\(';'\)|a\.download = `pesagens_/.test(page), 'NEGATIVO: sem CSV montado à mão no Lançamento');

console.log(JSON.stringify({
  gate: 'launch:sticky-context:verify',
  ok: true,
  modes: LAUNCH_MODES,
  formFields: FORM_FIELDS.length,
  stickyFields: Object.fromEntries(LAUNCH_MODES.map((mode) => [mode, STICKY_FIELDS[mode].length])),
  animalFields: Object.fromEntries(LAUNCH_MODES.map((mode) => [mode, ANIMAL_FIELDS[mode].length])),
  mission53: { cadastro: true, manejo: true, saidaVendaEmbarque: true },
  leaksBlocked: ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09'],
  resetsFixed: ['R-01', 'R-02', 'R-03', 'R-04'],
  identifierSequence: true,
  sourceUsesLaunchContext: true,
}, null, 2));
