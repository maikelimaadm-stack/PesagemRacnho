// Gate import:sanity:verify — importação de APLICAÇÕES DE SANIDADE (tipo SANIDADE),
// pedido do responsável em 17/09/2026. Prova, com fake-indexeddb e asserts exatos:
//   1. tipo (B): animal existente resolvido pela identidade canônica, programa e medicamento
//      resolvidos por NOME normalizado, dose/unidade/via validadas pelo sanityService, com
//      animal, data, ator e auditoria CRIAR_APLICACAO_SANIDADE corretos;
//   2. cadastro mestre ausente: ERRO bloqueante sem a opção; criado só com "criar cadastros
//      ausentes" + registry.write; sem registry.write a linha continua bloqueada;
//   3. animal inexistente e identificação ambígua bloqueiam (nada é gravado);
//   4. idempotência: reimportar o mesmo arquivo → tudo JÁ EXISTE e ZERO gravações;
//   5. dry-run não grava nada;
//   6. rollback: aplicação inválida no meio do lote desfaz o lote inteiro;
//   7. modelo de planilha do tipo e reconhecimento automático das colunas;
//   8. permissões: importar exige weighing.write (CONSULTA recusado).
//
// A regra (A) — aplicar uma configuração sanitária às linhas de pesagem durante a importação
// de Cadastros/Manejos/Histórico — NÃO foi implementada nesta rodada (ficou como pendência,
// por decisão do responsável de priorizar a entrada pela tela Sanidade). Quando entrar, os
// casos dela devem ser acrescentados a este gate.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { brandService } from '../src/modules/catalog/application/registryServices.js';
import * as sanity from '../src/modules/sanity/application/sanityService.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import {
  IMPORT_TYPES,
  IMPORT_TYPE_LABELS,
  ROW_STATUS,
  analyzeImport,
  applyImport,
  listImportFields,
  listMappableFields,
  suggestMapping,
} from '../src/modules/import/application/importService.js';
import { TEMPLATE_KINDS, buildImportTemplateCsv, importTemplateHeaders } from '../src/modules/import/domain/spreadsheetTemplate.js';
import { applicationKey } from '../src/modules/import/domain/sanityImportPlanner.js';
import { writeSanityImportBatch } from '../src/modules/import/infrastructure/sanityImportWriter.js';

const STORES = ['aplicacoesSanidade', 'programasSanidade', 'medicamentos', 'pesagens', 'animais', 'auditoria', 'importacoes', 'sessoesPesagem'];
const csv = (...lines) => lines.join('\r\n');
const regras = [];
const ok = (regra) => regras.push(regra);
const as = (role, nome = `Usuário ${role}`) => setActorProvider(() => ({ id: `u-${role}`, nome, role }));

const rejects = async (promise, code, rotulo) => {
  let error = null;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error, `${rotulo}: esperava recusa ${code}`);
  assert.equal(error.code, code, `${rotulo}: ${error.message}`);
  return error;
};

setActorProvider(null);
await deleteDbForTests();
const db = await storage.ensureReady();
const counts = async () => Object.fromEntries(await Promise.all(STORES.map(async (name) => [name, await db.table(name).count()])));
const aplicacoes = async () => (await db.table('aplicacoesSanidade').toArray()).filter((row) => !row.deleted_at);

// Atores do gate existem em `usuarios` (a integridade exige o operador das sessões).
await db.table('usuarios').bulkAdd(['ADMIN', 'OPERADOR', 'CONSULTA'].map((role) => ({
  id: `u-${role}`, empresa_id: 'local', nome: role, login: role.toLowerCase(), login_normalizado: role.toLowerCase(), role, ativo: true,
  password_hash: 'aGFzaA==', password_salt: 'c2FsdA==', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null,
})));

// ---------------------------------------------------------------------------
// 0. Contrato público do tipo novo e modelo de planilha.
// ---------------------------------------------------------------------------
assert.equal(IMPORT_TYPES.SANIDADE, 'SANIDADE');
assert.equal(IMPORT_TYPE_LABELS.SANIDADE, 'Aplicações de sanidade');
assert.deepEqual(
  listImportFields(IMPORT_TYPES.SANIDADE).map((campo) => campo.id),
  ['data', 'numero', 'marca', 'programa', 'medicamento', 'dose', 'unidade', 'via_aplicacao', 'observacao'],
  'campos do tipo SANIDADE na ordem do modelo',
);
assert.deepEqual(
  listImportFields(IMPORT_TYPES.SANIDADE).filter((campo) => campo.required).map((campo) => campo.id),
  ['data', 'numero'],
  'obrigatórios: data e identificação do animal',
);
assert.deepEqual(
  listMappableFields(IMPORT_TYPES.SANIDADE).map((campo) => campo.id),
  listImportFields(IMPORT_TYPES.SANIDADE).map((campo) => campo.id),
  'nenhum campo técnico ou derivado no tipo SANIDADE',
);
const modelo = buildImportTemplateCsv(TEMPLATE_KINDS.SANIDADE);
assert.deepEqual(importTemplateHeaders(TEMPLATE_KINDS.SANIDADE), ['Data', 'NumeroAnimal', 'Marca', 'Programa', 'Medicamento', 'Dose', 'Unidade', 'Via', 'Observação']);
assert.equal(modelo.fileName, 'modelo_importacao_aplicacoes_sanidade.csv');
assert.deepEqual(
  Object.values(suggestMapping(modelo.headers, IMPORT_TYPES.SANIDADE)),
  ['data', 'numero', 'marca', 'programa', 'medicamento', 'dose', 'unidade', 'via_aplicacao', 'observacao'],
  'o motor reconhece cada coluna do modelo de aplicações',
);
assert.ok(!modelo.headers.some((header) => header.toLowerCase() === 'id'), 'modelo sem coluna ID');
for (const proibida of ['externo', 'peso', 'anterior', 'gmd', 'ganho', 'dias']) {
  assert.ok(!modelo.headers.some((header) => header.toLowerCase().includes(proibida)), `modelo sem coluna calculada/técnica (${proibida})`);
}
ok('contrato-tipo-e-modelo');

// ---------------------------------------------------------------------------
// 1. Massa: dois animais, dois programas e dois medicamentos.
// ---------------------------------------------------------------------------
as('ADMIN', 'Ana Admin');
await brandService.create(null, { nome: 'ABC' });
const aftosa = await sanity.saveProgram({ nome: 'Aftosa', tipo: 'VACINACAO' });
const vermifugacao = await sanity.saveProgram({ nome: 'Vermifugação', tipo: 'VERMIFUGACAO' });
const iver = await sanity.saveMedicamento({ nome: 'Ivermectina 1%', unidade_padrao: 'ml', via_aplicacao: 'SC' });
const vacina = await sanity.saveMedicamento({ nome: 'Vacina aftosa', unidade_padrao: 'dose', via_aplicacao: 'IM' });

as('OPERADOR', 'Olga Operadora');
const base = { empresa_id: 'local', marca: 'ABC', sexo: 'M', raca: 'Nelore' };
await weighingService.createEntry({ ...base, tipo_manejo: 'Cadastro', numero_animal: '101', data_pesagem: '2026-01-05', peso: 200 });
await weighingService.createEntry({ ...base, tipo_manejo: 'Cadastro', numero_animal: '102', data_pesagem: '2026-01-05', peso: 210 });
const animais = (await db.table('animais').toArray()).filter((row) => !row.deleted_at);
const animal101 = animais.find((row) => row.numero_animal === '101');
const animal102 = animais.find((row) => row.numero_animal === '102');
assert.ok(animal101 && animal102, 'massa criada');

// ---------------------------------------------------------------------------
// 2. Dry-run do tipo (B): nada é gravado e o plano mostra o que será criado.
// ---------------------------------------------------------------------------
const arquivo = csv(
  'Data;NumeroAnimal;Marca;Programa;Medicamento;Dose;Unidade;Via;Observação',
  '05/02/2026;101;ABC;Aftosa;Vacina aftosa;5;ml;SC;primeira dose',
  '05/02/2026;102;ABC;Aftosa;Vacina aftosa;5;ml;SC;',
  '10/03/2026;101;ABC;Vermifugação;Ivermectina 1%;4,5;ml;SC;',
);
const antesDoDryRun = await counts();
const plano = await analyzeImport({ text: arquivo, type: IMPORT_TYPES.SANIDADE, fileName: 'aplicacoes.csv' });
assert.deepEqual(await counts(), antesDoDryRun, 'DRY-RUN: zero gravações em qualquer store');
assert.equal(plano.blocking, false, 'plano sem pendências');
assert.deepEqual(plano.rows.map((row) => row.status), [ROW_STATUS.NOVO, ROW_STATUS.NOVO, ROW_STATUS.NOVO]);
assert.equal(plano.summary.aplicacoes, 3, 'o plano conta as aplicações que serão criadas');
assert.equal(plano.summary.novos, 3);
assert.equal(plano.summary.animaisEncontrados, 2, 'três linhas de dois animais');
assert.equal(plano.summary.animaisNovos, 0, 'importar aplicações nunca cria animal');
assert.deepEqual(plano.summary.cadastrosMestresAusentes, [], 'programas e medicamentos já cadastrados');
assert.deepEqual(plano.rows.map((row) => row.identity.animalId), [animal101.id, animal102.id, animal101.id], 'animal resolvido pela identidade canônica');
assert.deepEqual(plano.rows.map((row) => row.data), ['2026-02-05', '2026-02-05', '2026-03-10'], 'data do próprio evento');
assert.deepEqual(plano.rows.map((row) => row.sanidade.resumo), [
  'Aftosa / Vacina aftosa · 5 ml · SC',
  'Aftosa / Vacina aftosa · 5 ml · SC',
  'Vermifugação / Ivermectina 1% · 4,5 ml · SC',
], 'a Conferência mostra a aplicação linha a linha');
assert.deepEqual(plano.rows[2].payload, {
  animal_id: animal101.id, data: '2026-03-10', programa_sanidade_id: vermifugacao.id, medicamento_id: iver.id,
  dose: 4.5, unidade: 'ml', via_aplicacao: 'SC', observacao: null, sessao_id: null,
}, 'dose com vírgula, unidade e via normalizadas pelo sanityService');
ok('dry-run-nao-grava');

// ---------------------------------------------------------------------------
// 3. Gravação: aplicações com animal, data, ator e auditoria corretos.
// ---------------------------------------------------------------------------
const resultado = await applyImport(plano);
assert.equal(resultado.status, 'CONCLUIDA');
assert.equal(resultado.aplicacoesCriadas, 3, 'três aplicações gravadas');
assert.equal(resultado.animaisConciliados, 2);
assert.equal(resultado.cadastrosCriados + resultado.manejosCriados + resultado.saidasCriadas, 0, 'nenhuma pesagem é criada');
assert.deepEqual(resultado.linhasGravadas, [2, 3, 4]);
const gravadas = await aplicacoes();
assert.equal(gravadas.length, 3);
assert.deepEqual(gravadas.map((row) => [row.animal_id, row.data, row.programa_sanidade_id, row.medicamento_id, row.dose, row.unidade, row.via_aplicacao]).sort(), [
  [animal101.id, '2026-02-05', aftosa.id, vacina.id, 5, 'ml', 'SC'],
  [animal101.id, '2026-03-10', vermifugacao.id, iver.id, 4.5, 'ml', 'SC'],
  [animal102.id, '2026-02-05', aftosa.id, vacina.id, 5, 'ml', 'SC'],
].sort(), 'animal, data, programa, medicamento, dose, unidade e via gravados');
assert.ok(gravadas.every((row) => row.pesagem_id === null && row.sessao_id === null), 'aplicação importada não inventa pesagem nem sessão');
assert.ok(gravadas.every((row) => row.cancelled_at === null), 'nasce ativa');
assert.deepEqual([...new Set(gravadas.map((row) => row.programa_nome_snapshot))].sort(), ['Aftosa', 'Vermifugação'], 'snapshot do nome do programa');
assert.deepEqual([...new Set(gravadas.map((row) => row.medicamento_nome_snapshot))].sort(), ['Ivermectina 1%', 'Vacina aftosa'], 'snapshot do nome do medicamento');
assert.ok(gravadas.every((row) => row.created_by === 'u-OPERADOR' && row.created_by_nome === 'Olga Operadora'), 'ator real gravado na aplicação');
assert.equal(gravadas.find((row) => row.observacao === 'primeira dose').animal_id, animal101.id, 'observação da planilha preservada');

const auditoria = (await db.table('auditoria').toArray()).filter((row) => row.acao === 'CRIAR_APLICACAO_SANIDADE');
assert.equal(auditoria.length, 3, 'uma auditoria CRIAR_APLICACAO_SANIDADE por aplicação');
assert.ok(auditoria.every((row) => row.entidade === 'aplicacoesSanidade' && row.origem === 'importacao'), 'auditoria da store certa, origem importacao');
assert.ok(auditoria.every((row) => row.usuario_id === 'u-OPERADOR' && row.usuario_nome_snapshot === 'Olga Operadora'), 'auditoria com o ator real');
assert.deepEqual(auditoria.map((row) => row.entidade_id).sort(), gravadas.map((row) => row.id).sort());

// As aplicações aparecem no histórico do animal pelo próprio serviço de sanidade.
const historico101 = await sanity.listApplications({ animalId: animal101.id });
assert.deepEqual(historico101.map((row) => [row.data, row.programa_nome, row.medicamento_nome]), [
  ['2026-02-05', 'Aftosa', 'Vacina aftosa'],
  ['2026-03-10', 'Vermifugação', 'Ivermectina 1%'],
], 'listApplications enxerga as aplicações importadas');
const job = (await db.table('importacoes').toArray()).find((row) => row.tipo_importacao === 'SANIDADE');
assert.equal(job.aplicacoes_criadas, 3, 'o job registra as aplicações criadas');
assert.equal(job.status, 'CONCLUIDA');
assert.equal((await logicalIntegrity()).ok, true, 'integridade lógica preservada');
ok('tipo-b-grava-com-ator-e-auditoria');

// ---------------------------------------------------------------------------
// 4. Idempotência: reimportar o mesmo arquivo não duplica nada.
// ---------------------------------------------------------------------------
const depoisDaPrimeira = await counts();
for (const rodada of [1, 2]) {
  const replay = await analyzeImport({ text: arquivo, type: IMPORT_TYPES.SANIDADE });
  assert.deepEqual(replay.rows.map((row) => row.status), Array(3).fill(ROW_STATUS.JA_EXISTE), `reimportação ${rodada}: 100% JÁ EXISTE`);
  assert.equal(replay.blocking, false, `reimportação ${rodada}: não bloqueia`);
  assert.equal(replay.summary.aplicacoes, 0);
  assert.equal(replay.summary.jaExistem, 3);
  assert.deepEqual(replay.previousImports.map((item) => item.status), ['CONCLUIDA'], 'a análise mostra a importação anterior');
  const semAlteracoes = await applyImport(replay);
  assert.equal(semAlteracoes.status, 'SEM_ALTERACOES', `reimportação ${rodada}: nada a gravar`);
  assert.equal(semAlteracoes.importacaoId, null, 'nem job novo é criado');
  assert.deepEqual(await counts(), depoisDaPrimeira, `reimportação ${rodada}: ZERO gravações`);
}
// Mesma aplicação repetida dentro do próprio arquivo: a segunda não grava.
const repetido = csv(
  'Data;NumeroAnimal;Marca;Programa;Dose;Unidade',
  '15/04/2026;101;ABC;Aftosa;5;ml',
  '15/04/2026;101;ABC;Aftosa;5;ml',
);
const planoRepetido = await analyzeImport({ text: repetido, type: IMPORT_TYPES.SANIDADE });
assert.deepEqual(planoRepetido.rows.map((row) => row.status), [ROW_STATUS.NOVO, ROW_STATUS.POSSIVEL_DUPLICIDADE]);
assert.equal(planoRepetido.rows[1].messages[0], 'Repete a linha 2 (mesmo animal, data, programa, medicamento e dose); não será gravada.');
assert.equal((await applyImport(planoRepetido)).aplicacoesCriadas, 1, 'repetição dentro do arquivo não duplica');
assert.equal((await aplicacoes()).length, 4);
// Dose diferente no mesmo dia é outra aplicação (não é duplicidade).
const outraDose = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa;Dose;Unidade', '15/04/2026;101;ABC;Aftosa;2;ml'), type: IMPORT_TYPES.SANIDADE });
assert.equal(outraDose.rows[0].status, ROW_STATUS.NOVO, 'dose diferente não é a mesma aplicação');
assert.equal(applicationKey({ animalId: 'a', data: '2026-04-15', programaId: 'p', dose: 5 }) === applicationKey({ animalId: 'a', data: '2026-04-15', programaId: 'p', dose: 2 }), false);
ok('idempotencia-sem-duplicar');

// ---------------------------------------------------------------------------
// 5. Cadastros mestres ausentes: erro, criação opcional e permissão.
// ---------------------------------------------------------------------------
const comAusentes = csv(
  'Data;NumeroAnimal;Marca;Programa;Medicamento;Dose;Unidade;Via',
  '20/05/2026;101;ABC;Brucelose;Vacina B19;2;ml;SC',
);
const antesAusentes = await counts();
const semOpcao = await analyzeImport({ text: comAusentes, type: IMPORT_TYPES.SANIDADE });
assert.equal(semOpcao.rows[0].status, ROW_STATUS.ERRO, 'cadastro de sanidade ausente é ERRO');
assert.equal(semOpcao.blocking, true, 'erro bloqueia a gravação');
assert.deepEqual(semOpcao.summary.cadastrosMestresAusentes.map((item) => [item.store, item.rotulo, item.nome, item.linhas]), [
  ['programasSanidade', 'Programa de sanidade', 'Brucelose', [2]],
  ['medicamentos', 'Medicamento', 'Vacina B19', [2]],
], 'o plano diz quais cadastros faltam e em que linhas');
assert.deepEqual(semOpcao.rows[0].messages, [
  'Programa de sanidade "Brucelose" não cadastrado(a). Cadastre antes ou marque "Criar cadastros ausentes".',
  'Medicamento "Vacina B19" não cadastrado(a). Cadastre antes ou marque "Criar cadastros ausentes".',
]);
await rejects(applyImport(semOpcao), 'IMPORT_BLOCKING', 'plano bloqueante');
assert.deepEqual(await counts(), antesAusentes, 'plano bloqueante → zero gravações');

// Sem registry.write a opção não salva ninguém (falha fechada).
as('CONSULTA', 'Carlos Consulta');
await rejects(analyzeImport({ text: comAusentes, type: IMPORT_TYPES.SANIDADE }), 'AUTH_FORBIDDEN', 'CONSULTA não importa aplicações');
as('OPERADOR', 'Olga Operadora');
const semRegistryWrite = await analyzeImport({ text: comAusentes, type: IMPORT_TYPES.SANIDADE, rules: { createMissingMasters: true } });
assert.equal(semRegistryWrite.rows[0].status, ROW_STATUS.ERRO, 'OPERADOR não tem registry.write: continua bloqueado');
assert.match(semRegistryWrite.rows[0].messages[0], /não tem permissão registry\.write/);
await rejects(applyImport(semRegistryWrite), 'AUTH_FORBIDDEN', 'gravação recusada sem registry.write');
assert.deepEqual(await counts(), antesAusentes, 'zero gravações');

// Com registry.write e a opção ligada: cria os cadastros e grava a aplicação.
as('ADMIN', 'Ana Admin');
const comCriacao = await analyzeImport({ text: comAusentes, type: IMPORT_TYPES.SANIDADE, rules: { createMissingMasters: true } });
assert.equal(comCriacao.rows[0].status, ROW_STATUS.NOVO, 'com a opção ligada a linha deixa de ser erro');
assert.equal(comCriacao.blocking, false);
assert.deepEqual(comCriacao.rows[0].messages.slice(0, 2), [
  'Programa de sanidade "Brucelose" não cadastrado(a): será criado(a) antes da gravação.',
  'Medicamento "Vacina B19" não cadastrado(a): será criado(a) antes da gravação.',
]);
const criados = await applyImport(comCriacao);
assert.equal(criados.cadastrosMestresCriados, 2, 'programa e medicamento criados');
assert.equal(criados.aplicacoesCriadas, 1);
const brucelose = (await sanity.listProgramas({ empresaId: 'local' })).find((row) => row.nome === 'Brucelose');
const b19 = (await sanity.listMedicamentos({ empresaId: 'local' })).find((row) => row.nome === 'Vacina B19');
assert.equal(brucelose.tipo, 'OUTRO', 'programa criado pela importação nasce como "Outro"');
assert.ok(b19 && b19.ativo !== false);
const novaAplicacao = (await aplicacoes()).find((row) => row.programa_sanidade_id === brucelose.id);
assert.deepEqual([novaAplicacao.medicamento_id, novaAplicacao.data, novaAplicacao.animal_id], [b19.id, '2026-05-20', animal101.id]);
assert.ok((await db.table('auditoria').toArray()).some((row) => row.acao === 'CRIAR_PROGRAMA_SANIDADE' && row.entidade_id === brucelose.id), 'criação do programa auditada pelo serviço');
// Reimportar depois de criar não duplica cadastro nem aplicação.
const replayCriacao = await analyzeImport({ text: comAusentes, type: IMPORT_TYPES.SANIDADE, rules: { createMissingMasters: true } });
assert.equal(replayCriacao.rows[0].status, ROW_STATUS.JA_EXISTE);
assert.equal((await applyImport(replayCriacao)).aplicacoesCriadas, 0);
ok('cadastros-ausentes-com-permissao');

// Programa inativo é recusado com mensagem própria (o serviço de sanidade não aceita).
await sanity.setProgramActive(brucelose.id, false);
const inativo = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa;Dose;Unidade', '21/05/2026;101;ABC;Brucelose;2;ml'), type: IMPORT_TYPES.SANIDADE });
assert.equal(inativo.rows[0].status, ROW_STATUS.ERRO);
assert.equal(inativo.rows[0].messages[0], 'Programa de sanidade "Brucelose" está inativo(a): reative o cadastro antes de importar as aplicações.');
await sanity.setProgramActive(brucelose.id, true);
ok('cadastro-inativo-recusado');

// ---------------------------------------------------------------------------
// 6. Animal inexistente, ambíguo e fora da cronologia.
// ---------------------------------------------------------------------------
let antesErros = await counts();
const inexistente = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa', '01/06/2026;999;ABC;Aftosa'), type: IMPORT_TYPES.SANIDADE });
assert.equal(inexistente.rows[0].status, ROW_STATUS.ERRO);
assert.equal(inexistente.rows[0].messages[0], 'Animal 999 / ABC não encontrado. Importe o Cadastro do animal antes das aplicações de sanidade.');
assert.equal(inexistente.blocking, true);
await rejects(applyImport(inexistente), 'IMPORT_BLOCKING', 'animal inexistente bloqueia');

// Ambiguidade: mesmo número em duas marcas, linha sem marca.
await brandService.create(null, { nome: 'XYZ' });
await weighingService.createEntry({ empresa_id: 'local', marca: 'XYZ', sexo: 'M', raca: 'Nelore', tipo_manejo: 'Cadastro', numero_animal: '101', data_pesagem: '2026-01-06', peso: 205 });
antesErros = await counts();
const ambiguo = await analyzeImport({ text: csv('Data;NumeroAnimal;Programa', '02/06/2026;101;Aftosa'), type: IMPORT_TYPES.SANIDADE });
assert.equal(ambiguo.rows[0].status, ROW_STATUS.AMBIGUO, 'mais de um animal atende à linha');
assert.match(ambiguo.rows[0].messages[0], /Identificação ambígua/);
assert.equal(ambiguo.blocking, true);
await rejects(applyImport(ambiguo), 'IMPORT_BLOCKING', 'ambiguidade bloqueia');
// Com a marca, a mesma linha resolve.
const comMarca = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa', '02/06/2026;101;ABC;Aftosa'), type: IMPORT_TYPES.SANIDADE });
assert.equal(comMarca.rows[0].status, ROW_STATUS.NOVO, 'a marca separa os homônimos');
assert.equal(comMarca.rows[0].identity.animalId, animal101.id);

// Cronologia do animal (mesma régua da aplicação avulsa).
const antesDoCadastro = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa', '01/01/2026;101;ABC;Aftosa'), type: IMPORT_TYPES.SANIDADE });
assert.equal(antesDoCadastro.rows[0].status, ROW_STATUS.ERRO);
assert.equal(antesDoCadastro.rows[0].messages[0], 'A data 2026-01-01 é anterior ao cadastro do animal (2026-01-05).');
// Valores fora da lista do serviço de sanidade.
const valorInvalido = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa;Dose;Unidade;Via', '03/06/2026;101;ABC;Aftosa;0;litro;Retal'), type: IMPORT_TYPES.SANIDADE });
assert.equal(valorInvalido.rows[0].status, ROW_STATUS.ERRO);
assert.deepEqual(valorInvalido.rows[0].messages, [
  'Dose deve ser numérica e maior que zero.',
  'Unidade da dose inválida. Use: ml, mg, g, dose, comprimido, UI.',
  'Via de aplicação inválida. Use: Subcutânea (SC), Intramuscular (IM), Intravenosa (IV), Oral, Pour-on, Tópica, Intranasal, Outra.',
], 'dose, unidade e via validadas pelo sanityService');
// Linha sem programa nem medicamento.
const semReferencia = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca;Programa;Medicamento', '03/06/2026;101;ABC;;'), type: IMPORT_TYPES.SANIDADE });
assert.equal(semReferencia.rows[0].status, ROW_STATUS.ERRO);
assert.equal(semReferencia.rows[0].messages[0], 'Informe o programa de sanidade ou o medicamento da aplicação.');
// Nenhuma coluna de programa/medicamento mapeada: erro de arquivo.
const semColuna = await analyzeImport({ text: csv('Data;NumeroAnimal;Marca', '03/06/2026;101;ABC'), type: IMPORT_TYPES.SANIDADE });
assert.equal(semColuna.blocking, true);
assert.match(semColuna.fileErrors.join(' '), /Mapeie a coluna Programa \/ Procedimento/);
assert.deepEqual(await counts(), antesErros, 'nenhum caso de erro gravou coisa alguma');
ok('erros-bloqueantes-nao-gravam');

// ---------------------------------------------------------------------------
// 7. Rollback: aplicação inválida no meio do lote desfaz o lote inteiro.
// ---------------------------------------------------------------------------
const antesRollback = await counts();
const planoLote = await analyzeImport({
  text: csv(
    'Data;NumeroAnimal;Marca;Programa;Dose;Unidade',
    '10/07/2026;101;ABC;Aftosa;1;ml',
    '10/07/2026;102;ABC;Aftosa;1;ml',
    '11/07/2026;101;ABC;Aftosa;1;ml',
  ),
  type: IMPORT_TYPES.SANIDADE,
});
assert.deepEqual(planoLote.rows.map((row) => row.status), Array(3).fill(ROW_STATUS.NOVO));
const loteComDefeito = planoLote.rows.map((row, index) => (index === 1
  ? { ...row, payload: { ...row.payload, programa_sanidade_id: 'programa-que-nao-existe' } }
  : row));
const jobFalso = { id: 'job-rollback' };
await db.table('importacoes').add({
  id: jobFalso.id, arquivo_hash: 'rollback', arquivo_sha256: 'rollback', origem: 'assistente-importacao', tipo_importacao: 'SANIDADE',
  status: 'EM_ANDAMENTO', checkpoint: { lotes_concluidos: 0, animais_processados: 0, animais_total: 3, ultima_chave: null },
  created_at: '2026-07-10T00:00:00.000Z', updated_at: '2026-07-10T00:00:00.000Z', deleted_at: null,
});
let rollbackError = null;
try {
  await writeSanityImportBatch(db, { rows: loteComDefeito, job: jobFalso, empresaId: 'local' });
} catch (caught) {
  rollbackError = caught;
}
assert.ok(rollbackError, 'a aplicação inválida interrompe o lote');
assert.match(String(rollbackError.message), /Programa de sanidade não encontrado/);
const depoisRollback = await counts();
assert.equal(depoisRollback.aplicacoesSanidade, antesRollback.aplicacoesSanidade, 'ROLLBACK: nenhuma aplicação do lote foi gravada');
assert.equal(depoisRollback.auditoria, antesRollback.auditoria, 'ROLLBACK: nenhuma auditoria do lote foi gravada');
const jobRollback = (await db.table('importacoes').toArray()).find((row) => row.id === jobFalso.id);
assert.equal(jobRollback.checkpoint.lotes_concluidos, 0, 'ROLLBACK: o checkpoint do job não avançou');
// O mesmo lote sem defeito grava inteiro.
assert.equal((await applyImport(planoLote)).aplicacoesCriadas, 3, 'lote íntegro grava as três aplicações');
assert.equal((await aplicacoes()).length, antesRollback.aplicacoesSanidade + 3);
ok('rollback-por-lote');

assert.equal((await logicalIntegrity()).ok, true, 'integridade lógica ao final');
setActorProvider(null);

console.log('OK verify-import-sanity');
console.log(JSON.stringify({
  gate: 'import:sanity:verify',
  regras,
  aplicacoesGravadas: (await aplicacoes()).length,
  regraAPendente: 'aplicar configuração sanitária às linhas de pesagem (Cadastros/Manejos/Histórico) não implementada nesta rodada',
}, null, 2));
