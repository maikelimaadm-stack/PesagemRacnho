// Gate do contrato S-01.5 "Lançamento seleciona cadastros" e dos consumidores
// de configuração (ADR-025 rendimento com origem; ADR-028 categoria sugerida;
// ADR-033 documento na venda; APPSETTINGS-AUDIT §3 política de avisos;
// IMPORT-TARGET-MODEL §2.2 importação sem criação silenciosa). Mantém o que
// ainda vale do contrato anterior (registry selecionado para comprador/
// frigorífico/vendedor, resumos configuráveis, foco suave). Cada regra tem o
// caso negativo.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady, resetDbForTests } from '../src/storage/indexedDb/db.js';
import { getSetting, setSetting } from '../src/modules/settings/application/settingsService.js';
import * as appConfig from '../src/modules/settings/application/appConfigService.js';
import { brandService, breedService, ensureSeeds, resolveMany } from '../src/modules/catalog/application/index.js';
import {
  RENDIMENTO_ORIGEM_INFORMADO,
  RENDIMENTO_ORIGEM_PADRAO_EMPRESA,
  exitRequiresDocument,
  formatRendimento,
  loadOperationalPolicies,
  normalizeSalesPolicy,
  normalizeWeightWarningPolicy,
  resolveDefaultRegistry,
} from '../src/modules/operations/application/operationalPolicies.js';
import { categoriesForSex, eraOfCategory, suggestCategory } from '../src/modules/operations/domain/categorySuggestion.js';
import { collectRegistryTexts, countUnknownRegistries, splitImportRowsByRegistry } from '../src/modules/operations/domain/importRegistryResolution.js';
import { DEFAULT_WEIGHT_WARNING_POLICY, buildWeightWarningPolicy, evaluateWeighingWarnings } from '../src/modules/weighing/domain/weighingWarnings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const ADMIN = { id: 'u-admin', nome: 'Admin Teste', role: 'ADMIN' };
const EMPRESA = 'local';

await deleteDbForTests();
await ensureStorageReady();
await ensureSeeds(EMPRESA);

// ---------------------------------------------------------------------------
// 1) Persistência de resumos e do registry legado (contrato anterior que ainda vale).
const comerciais = {
  compradores: [{ id: 'c1', nome: 'COMPRADOR TESTE', documento: '', telefone: '', cidade: '', ativo: true }],
  vendedores: [{ id: 'v1', nome: 'VENDEDOR TESTE', propriedade: 'FAZENDA', ativo: true }],
  frigorificos: [{ id: 'f1', nome: 'FRIGORIFICO TESTE', sif: '123', ativo: true }],
};
const resumos = [
  { id: 'r1', label: 'Peso total', field: 'peso', operation: 'sum', scope: 'dia' },
  { id: 'r2', label: 'Peso por arroba', field: 'peso', operation: 'ratio', divisorField: 'quantidade_arrobas', scope: 'venda' },
];
await setSetting('cadastros-auxiliares:comerciais:empresa-teste', comerciais);
await setSetting('resumo-personalizado:empresa-teste', resumos);
resetDbForTests();
await ensureStorageReady();
const reloaded = await getSetting('cadastros-auxiliares:comerciais:empresa-teste', { compradores: [], vendedores: [], frigorificos: [] });
assert.deepEqual(reloaded.compradores.map((item) => item.nome), ['COMPRADOR TESTE'], 'compradores do registry devem persistir após reabrir');
assert.deepEqual(reloaded.vendedores.map((item) => item.nome), ['VENDEDOR TESTE'], 'vendedores do registry devem persistir após reabrir');
assert.deepEqual(reloaded.frigorificos.map((item) => item.nome), ['FRIGORIFICO TESTE'], 'frigoríficos do registry devem persistir após reabrir');
assert.deepEqual(await getSetting('resumo-personalizado:empresa-teste'), resumos, 'configuração de resumo deve persistir');

// ---------------------------------------------------------------------------
// 2) Cadastros mestres → padrões da empresa (marca/raça/apartação) e política comercial.
const marcaAbc = await brandService.create(null, { nome: 'ABC', empresa_id: EMPRESA });
const marcaXyz = await brandService.create(null, { nome: 'XYZ', empresa_id: EMPRESA, padrao: true });
const marcaInativa = await brandService.create(null, { nome: 'Antiga', empresa_id: EMPRESA });
await brandService.deactivate(null, marcaInativa.id);
const marcas = await brandService.list({ empresaId: EMPRESA, incluirInativos: true });
assert.equal(resolveDefaultRegistry(marcas, marcaAbc.id)?.id, marcaAbc.id, 'marca_padrao_id da configuração vence o padrao=true do cadastro');
assert.equal(resolveDefaultRegistry(marcas, null)?.id, marcaXyz.id, 'sem configuração vale a marca padrao=true');
assert.equal(resolveDefaultRegistry(marcas, 'id-inexistente')?.id, marcaXyz.id, 'id configurado inexistente cai no padrao=true (nunca inventa)');
assert.equal(resolveDefaultRegistry(marcas, marcaInativa.id)?.id, marcaXyz.id, 'NEGATIVO: marca inativa configurada como padrão não é pré-selecionada');
assert.equal(resolveDefaultRegistry([{ id: 'x', nome: 'X', ativo: true }], null), null, 'NEGATIVO: sem padrao=true e sem configuração não há pré-seleção');

const antes = await loadOperationalPolicies(EMPRESA);
assert.equal(antes.sales.exigir_documento_venda, false, 'sem configuração a venda não exige documento');
assert.equal(antes.sales.rendimento_padrao, null, 'sem configuração explícita não há rendimento padrão (nunca 50 implícito)');
assert.equal(antes.sales.rendimento_padrao_origem, RENDIMENTO_ORIGEM_PADRAO_EMPRESA);
assert.deepEqual(antes.weightWarningPolicy, DEFAULT_WEIGHT_WARNING_POLICY, 'sem configuração a política de avisos é a default');

await appConfig.updateAppConfig(ADMIN, {
  marca_padrao_id: marcaAbc.id,
  apartacao_padrao_id: 'apartacao-padrao',
  rendimento_padrao: 52.5,
  exigir_documento_venda: true,
  faixa_peso_min: 100,
  faixa_peso_max: 900,
  limite_gmd_alerta: 2,
  variacao_max_percent: 10,
}, EMPRESA);
const politicas = await loadOperationalPolicies(EMPRESA);
assert.equal(politicas.defaults.marca_padrao_id, marcaAbc.id, 'operational-defaults expõe marca_padrao_id');
assert.equal(politicas.defaults.apartacao_padrao_id, 'apartacao-padrao', 'operational-defaults expõe apartacao_padrao_id');
assert.equal(politicas.sales.exigir_documento_venda, true, 'sales-policy expõe exigir_documento_venda');
assert.equal(politicas.sales.rendimento_padrao, 52.5, 'rendimento padrão configurado chega ao lançamento');
assert.equal(formatRendimento(politicas.sales.rendimento_padrao), '52,5', 'rendimento é apresentado em pt-BR');
assert.deepEqual(politicas.weightWarningPolicy, { minimumWeightKg: 100, maximumWeightKg: 900, maximumAbsoluteGmdKg: 2, maximumWeightChangePercent: 10 }, 'weight-warning-policy vira a política do domínio de avisos');

// Documento na venda (ADR-033).
assert.equal(exitRequiresDocument('Abate', { exigir_documento_venda: false }), true, 'Abate sempre exige embarque + documento');
assert.equal(exitRequiresDocument('Venda', politicas.sales), true, 'Venda exige documento quando a política está ligada');
assert.equal(exitRequiresDocument('Venda', antes.sales), false, 'NEGATIVO: Venda sem a política não exige documento');
assert.equal(exitRequiresDocument('Morte', politicas.sales), false, 'NEGATIVO: Morte nunca exige documento');
assert.equal(exitRequiresDocument('', politicas.sales), false, 'NEGATIVO: sem motivo não exige documento');

// Rendimento nunca um 50 fixo silencioso; origem sempre explícita.
assert.equal(normalizeSalesPolicy({}).rendimento_padrao, null, 'sem configuração não existe rendimento implícito de 50');
assert.equal(normalizeSalesPolicy({ rendimento_padrao: 150 }).rendimento_padrao, null, 'NEGATIVO: rendimento acima de 100% é descartado');
assert.equal(normalizeSalesPolicy({ rendimento_padrao: -1 }).rendimento_padrao, null, 'NEGATIVO: rendimento negativo é descartado');
assert.ok(appConfig.RENDIMENTO_ORIGENS.includes(RENDIMENTO_ORIGEM_INFORMADO) && appConfig.RENDIMENTO_ORIGENS.includes(RENDIMENTO_ORIGEM_PADRAO_EMPRESA), 'origens do lançamento pertencem ao enum do contrato');

// ---------------------------------------------------------------------------
// 3) Política de avisos de conferência (faixa, GMD, variação %) com fallback.
const base = [{ data_pesagem: '2026-08-15', peso: 300, tipo_manejo: 'Cadastro' }];
const avisosPadrao = evaluateWeighingWarnings({ weight: 50, date: '2026-09-15', history: [], policy: DEFAULT_WEIGHT_WARNING_POLICY });
assert.equal(avisosPadrao.length, 0, 'NEGATIVO: 50 kg está dentro da faixa default (20–1500)');
const avisosEmpresa = evaluateWeighingWarnings({ weight: 50, date: '2026-09-15', history: [], policy: politicas.weightWarningPolicy });
assert.deepEqual(avisosEmpresa.map((w) => w.code), ['WEIGHT_RANGE'], 'faixa configurada (100–900) gera aviso para 50 kg');
const avisosGmd = evaluateWeighingWarnings({ weight: 400, date: '2026-09-15', history: base, policy: politicas.weightWarningPolicy });
assert.ok(avisosGmd.some((w) => w.code === 'WEIGHT_CHANGE') && avisosGmd.some((w) => w.code === 'GMD_RANGE'), 'variação % e GMD configurados geram avisos');
assert.equal(evaluateWeighingWarnings({ weight: 400, date: '2026-09-15', history: base, policy: DEFAULT_WEIGHT_WARNING_POLICY }).length, 0, 'NEGATIVO: a mesma pesagem não gera aviso com a política default');
assert.deepEqual(buildWeightWarningPolicy({ faixa_peso_min: 900, faixa_peso_max: 100 }), DEFAULT_WEIGHT_WARNING_POLICY, 'NEGATIVO: faixa invertida cai nos defaults inteiros');
assert.deepEqual(normalizeWeightWarningPolicy({ faixa_peso_min: 'abc', limite_gmd_alerta: 0 }), { faixa_peso_min: 20, faixa_peso_max: 1500, limite_gmd_alerta: 5, variacao_max_percent: 35 }, 'NEGATIVO: valores inválidos caem nos defaults');
assert.deepEqual(evaluateWeighingWarnings({ weight: 50, date: '2026-09-15', history: [], policy: null }).length, 0, 'política nula completa-se com os defaults');

// ---------------------------------------------------------------------------
// 4) Categoria automática pelo PESO dentro do sexo (decisão de 16/09/2026; sem nascimento/idade).
const categorias = [
  { id: 'c-garrote', nome: 'Garrote', sexo_aplicavel: 'M', peso_min_kg: 350, peso_max_kg: null, era: 24, ordem: 2, ativo: true },
  { id: 'c-bezerro', nome: 'Bezerro', sexo_aplicavel: 'M', peso_min_kg: 300, peso_max_kg: 350, era: 12, ordem: 1, ativo: true },
  { id: 'c-novilha', nome: 'Novilha', sexo_aplicavel: 'F', peso_min_kg: 250, peso_max_kg: 380, era: 24, ordem: 3, ativo: true },
  { id: 'c-touro', nome: 'Touro', sexo_aplicavel: 'M', peso_min_kg: null, peso_max_kg: null, era: 36, ordem: 4, ativo: true },
  { id: 'c-inativa', nome: 'Inativa', sexo_aplicavel: 'M', peso_min_kg: 0, peso_max_kg: null, era: 1, ordem: 0, ativo: false },
];
assert.equal(suggestCategory({ categorias, sexo: 'M', peso: 320 })?.id, 'c-bezerro', 'macho de 320 kg → Bezerro (300 a 350)');
assert.equal(suggestCategory({ categorias, sexo: 'M', peso: '360,5' })?.id, 'c-garrote', 'macho acima de 350 kg → Garrote (peso em pt-BR)');
assert.equal(suggestCategory({ categorias, sexo: 'M', peso: 350 })?.id, 'c-bezerro', 'faixas que se cruzam no limite: vale a menor ordem');
assert.equal(suggestCategory({ categorias, sexo: 'F', peso: 300 })?.id, 'c-novilha', 'fêmea só considera categorias de fêmea');
assert.equal(suggestCategory({ categorias, sexo: 'F', peso: 400 }), null, 'NEGATIVO: fora de toda faixa do sexo não há categoria');
assert.equal(suggestCategory({ categorias, sexo: 'M', peso: 200 }), null, 'NEGATIVO: inativa e categoria sem faixa (Touro) nunca são automáticas');
assert.equal(suggestCategory({ categorias, sexo: '', peso: 320 }), null, 'NEGATIVO: sem sexo não há categoria automática');
assert.equal(suggestCategory({ categorias, sexo: 'M', peso: '' }), null, 'NEGATIVO: sem peso não há categoria automática');
assert.deepEqual(categoriesForSex(categorias, 'M').map((c) => c.id), ['c-bezerro', 'c-garrote', 'c-touro'], 'lista do sexo: só ativas, na ordem do cadastro');
assert.equal(eraOfCategory(categorias[1]), '12', 'era da categoria vira o texto gravado na pesagem');
assert.equal(eraOfCategory(null), null);

// ---------------------------------------------------------------------------
// 5) Importação: marca/raça resolvidas por nome normalizado; desconhecidos nunca criados em silêncio.
const linhas = [
  { linha: 2, numero_animal: '1', marca: ' abc ', raca: 'NELORE', peso: 300 },
  { linha: 3, numero_animal: '2', marca: 'Sem Cadastro', raca: 'Nelore', peso: 310 },
  { linha: 4, numero_animal: '3', marca: '', raca: 'Angus', peso: 320 },
  { linha: 5, numero_animal: '4', marca: 'ABC', raca: '', peso: 330 },
];
const textos = collectRegistryTexts(linhas);
assert.deepEqual(textos, { marcas: ['abc', 'Sem Cadastro'], racas: ['NELORE', 'Angus'] }, 'textos únicos (aparados) por nome normalizado');
const marcasAntes = (await brandService.list({ empresaId: EMPRESA, incluirInativos: true })).length;
const racasAntes = (await breedService.list({ empresaId: EMPRESA, incluirInativos: true })).length;
const resolvido = await resolveMany(textos, { empresaId: EMPRESA });
const semOpcao = splitImportRowsByRegistry(linhas, resolvido, { criarDesconhecidos: false });
assert.deepEqual(semOpcao.elegiveis.map((r) => r.numero_animal), ['1', '4'], 'só linhas com cadastros existentes (ou em branco) são elegíveis sem a opção');
assert.equal(semOpcao.elegiveis[0].marca_id, marcaAbc.id, 'linha elegível recebe marca_id resolvido');
assert.ok(semOpcao.elegiveis[0].raca_id, 'linha elegível recebe raca_id (Nelore semeada)');
assert.equal(semOpcao.elegiveis[1].raca_id, null, 'raça em branco fica sem id (adapter aplica o padrão)');
assert.deepEqual(semOpcao.rejeitadas.map((r) => r.linha), [3, 4], 'NEGATIVO: linhas com marca/raça não cadastrada são rejeitadas');
assert.match(semOpcao.rejeitadas[0].erro, /Marca "Sem Cadastro" não cadastrada/, 'erro por linha nomeia o cadastro ausente');
assert.deepEqual(semOpcao.desconhecidos, { marcas: ['Sem Cadastro'], racas: ['Angus'] }, 'lista "Cadastros não encontrados"');
assert.equal(countUnknownRegistries(semOpcao.desconhecidos), 2);
const comOpcao = splitImportRowsByRegistry(linhas, resolvido, { criarDesconhecidos: true });
assert.equal(comOpcao.elegiveis.length, 4, 'com a opção todas as linhas seguem (ids nulos até os cadastros existirem)');
assert.equal(comOpcao.pendentes, 2);
assert.equal((await brandService.list({ empresaId: EMPRESA, incluirInativos: true })).length, marcasAntes, 'NEGATIVO: o dry-run não criou marca');
assert.equal((await breedService.list({ empresaId: EMPRESA, incluirInativos: true })).length, racasAntes, 'NEGATIVO: o dry-run não criou raça');
assert.ok(!Object.hasOwn(resolvido.marcas, 'Sem Cadastro'), 'NEGATIVO: o resolvedor não inventa id para texto desconhecido');

// ---------------------------------------------------------------------------
// 6) Fonte das telas: seletores a partir dos serviços, sem ComboboxComNovo, rendimento com origem, política, documento e importação.
const launch = read('src/pages/LancamentoPesagensIndividuais.jsx');
const snDialog = read('src/components/pesagens/ConfirmarAnimalSnDialog.jsx');
const closing = read('src/pages/FechamentoDia.jsx');
const relation = read('src/pages/PesagensIndividuais.jsx');

assert.ok(!existsSync(join(root, 'src/components/pesagens/ComboboxComNovo.jsx')), 'ComboboxComNovo foi removido (marca/raça/era não são texto livre)');
for (const [file, source] of [['Lançamento', launch], ['ConfirmarAnimalSnDialog', snDialog], ['Relação', relation]]) {
  assert.doesNotMatch(source, /ComboboxComNovo/, `${file} não usa ComboboxComNovo`);
}
assert.match(launch, /import \{ brandService, breedService, categoryService \} from "@\/modules\/catalog\/application\/index"/, 'lançamento carrega marcas/raças/categorias dos serviços de cadastro');
assert.match(launch, /brandService\.list\(\{ empresaId: empresaSelecionadaId \}\)/, 'marcas vêm de brandService.list');
assert.match(launch, /breedService\.list\(\{ empresaId: empresaSelecionadaId \}\)/, 'raças vêm de breedService.list');
assert.match(launch, /categoryService\.list\(\{ empresaId: empresaSelecionadaId \}\)/, 'categorias vêm de categoryService.list');
assert.match(launch, /resolveDefaultRegistry\(marcas, carregadas\.defaults\.marca_padrao_id\)/, 'marca pré-selecionada por marca_padrao_id ou padrao=true');
assert.match(launch, /resolveDefaultRegistry\(racas, carregadas\.defaults\.raca_padrao_id\)/, 'raça pré-selecionada por raca_padrao_id ou padrao=true');
assert.match(launch, /d17d-field--brand[\s\S]{0,900}marcasAtivas\.map\(\(item\) => <SelectItem key=\{item\.id\} value=\{item\.id\}>/, 'Marca é um seletor alimentado pelo cadastro');
assert.match(launch, /racasAtivas\.map\(\(item\) => <SelectItem key=\{item\.id\} value=\{item\.id\}>/, 'Raça é um seletor alimentado pelo cadastro');
assert.match(launch, /d17d-field--category[\s\S]{0,1400}<SelectItem value=\{CATEGORIA_AUTOMATICA\}>Automático<\/SelectItem>[\s\S]{0,120}categoriasDoSexo\.map\(\(item\) => <SelectItem key=\{item\.id\} value=\{item\.id\}>/, 'Categoria: "Automático" + só as categorias do sexo escolhido');
assert.match(launch, /suggestCategory\(\{ categorias: categoriasAtivas, sexo, peso: parseBrazilianNumber\(peso\) \}\)/, 'categoria automática pelo sexo e pelo peso digitado');
assert.match(launch, /categoriesForSex\(categoriasAtivas, sexo\)/, 'lista de categorias filtrada pelo sexo');
assert.match(launch, /if \(!categoriasDoSexo\.some\(\(item\) => item\.id === categoriaSelecao\)\) setCategoriaSelecao\(CATEGORIA_AUTOMATICA\)/, 'trocar o sexo descarta categoria do outro sexo');
// Ordem do Cadastro pedida em 16/09/2026: Data, Sexo, Categoria, Raça, Marca, Identificação, Peso, Observação.
assert.match(launch, /d17d-field--date"[\s\S]*?d17d-field--sex[\s\S]*?d17d-field--category[\s\S]*?Raça do animal[\s\S]*?d17d-field--brand[\s\S]*?d17d-field--animal[\s\S]*?d17d-field--weight[\s\S]*?d17d-field--observation/, 'ordem dos campos: data, sexo, categoria, raça, marca, identificação, peso, observação');
assert.doesNotMatch(launch, /nascimento|Nascimento|d17d-field--birth/, 'NEGATIVO: data de nascimento saiu do lançamento');
assert.doesNotMatch(launch, /d17d-field--era/, 'NEGATIVO: Era não é digitada (vem da categoria)');
assert.match(launch, /coluna\.id === 'era'\) \{[\s\S]{0,120}p\.era/, 'a era continua exibida na grade');
assert.match(launch, /era: eraOfCategory\(categoriaEfetiva\) \?\? \(era \|\| null\)/, 'Cadastro grava a era da categoria');
assert.match(launch, /marca_id: perfilAnimal\.marca_id \|\| null,[\s\S]{0,60}raca_id: perfilAnimal\.raca_id \|\| null,[\s\S]{0,60}categoria_id: perfilAnimal\.categoria_id \|\| null,[\s\S]{0,60}categoria_automatica: perfilAnimal\.categoria_automatica !== false/, 'payload envia marca_id/raca_id/categoria_id/categoria_automatica além dos textos');
assert.match(launch, /if \(tipoManejo === 'Cadastro' && !isSN && !marcaId\)/, 'Cadastro exige marca SELECIONADA (id), não texto');
assert.match(launch, /apartacaoSelecionada: carregadas\.defaults\.apartacao_padrao_id \|\| ''/, 'apartacao_padrao_id pré-seleciona a apartação');
// Missão 17/09 (contexto fixo do Lançamento): cancelar/atualizar edição volta ao contexto de antes
// (launchContext.endEdit); sem contexto salvo, os padrões da empresa (inclusive a apartação) são reaplicados.
assert.match(launch, /const cancelarEdicao = \(\) => \{[\s\S]{0,200}endEdit\(contextoAntesEdicaoRef\.current, \{ form: formRef\.current, defaults: padroesEmpresaRef\.current/, 'cancelar edição usa endEdit com os padrões da empresa');
{
  const { endEdit } = await import('../src/modules/weighing/domain/launchContext.js');
  const semContexto = endEdit(null, { form: { tipoManejo: 'Manejo', apartacaoSelecionada: '' }, defaults: { apartacaoSelecionada: 'ap-padrao' } });
  assert.equal(semContexto.apartacaoSelecionada, 'ap-padrao', 'limpar o formulário reaplica a apartação padrão');
}
assert.match(launch, /rendimento: formatRendimento\(carregadas\.sales\.rendimento_padrao\)/, 'rendimento inicial vem de rendimento_padrao da configuração');
assert.match(launch, /rendimento_origem: calculoComercial\?\.yieldPercent != null \? rendimentoOrigem : null/, 'payload envia rendimento_origem (só quando há rendimento válido)');
assert.match(launch, /setRendimentoCarcacaVenda\(e\.target\.value\); setRendimentoOrigemVenda\(RENDIMENTO_ORIGEM_INFORMADO\)/, 'digitar o rendimento da venda marca origem INFORMADO');
assert.match(launch, /setRendimentoCarcacaAbate\(e\.target\.value\); setRendimentoOrigemAbate\(RENDIMENTO_ORIGEM_INFORMADO\)/, 'digitar o rendimento do abate marca origem INFORMADO');
assert.match(launch, /'\(informado\)' : '\(padrão da empresa\)'/, 'rótulo do rendimento mostra a origem');
assert.doesNotMatch(launch, /rendimento_carcaca \?\? 50|placeholder="50,00"|useState\("50"\)|useState\(50\)/, 'NEGATIVO: nenhum 50 fixo de rendimento no código');
assert.match(launch, /evaluateWeighingWarnings\(\{ weight: pesoInformado, date: dataPesagem, history: registrosMesmaIdentidade, policy: weightWarningPolicy \}\)/, 'avisos de conferência usam a política carregada');
assert.match(launch, /loadOperationalPolicies\(empresaSelecionadaId\)/, 'lançamento carrega as políticas uma vez com os cadastros');
assert.match(launch, /exitRequiresDocument\(motivoSaida, politicas\.sales\)/, 'Saída/Venda exige embarque + documento quando exigir_documento_venda');
assert.match(launch, /<ConfirmarAnimalSnDialog[\s\S]{0,400}marcas=\{marcasAtivas\}[\s\S]{0,60}racas=\{racasAtivas\}[\s\S]{0,60}categorias=\{categoriasAtivas\}/, 'diálogo SN usa os mesmos cadastros do lançamento');
assert.match(snDialog, /marcasAtivas\.map\(\(item\) => <SelectItem key=\{item\.id\} value=\{item\.id\}>/, 'diálogo SN seleciona a marca do cadastro');
assert.match(snDialog, /racasAtivas\.map\(\(item\) => <SelectItem key=\{item\.id\} value=\{item\.id\}>/, 'diálogo SN seleciona a raça do cadastro');
assert.match(snDialog, /categoriesForSex\(categorias, form\.sexo\)/, 'diálogo SN lista só as categorias do sexo');
assert.match(snDialog, /Automático \(pelo peso\)/, 'diálogo SN oferece a categoria automática');
assert.doesNotMatch(snDialog, /nascimento/i, 'NEGATIVO: diálogo SN não pede nascimento');
assert.doesNotMatch(snDialog, /\bera\b/, 'NEGATIVO: diálogo SN não pede Era');
// R5: a regra saiu da tela para a fonte única (closingPendencies), compartilhada com os relatórios.
assert.match(closing, /pendenciesOf\(row, salesPolicy\)/, 'Fechamento usa a regra única de pendências com a política de venda');
{
  const { exitRequiresDocument, pendenciesOf } = await import('../src/modules/operations/domain/closingPendencies.js');
  assert.equal(exitRequiresDocument('Abate', {}), true, 'Abate sempre exige documento');
  assert.equal(exitRequiresDocument('Venda', {}), false, 'Venda sem política: não exige');
  assert.equal(exitRequiresDocument('Venda', { exigir_documento_venda: true }), true, 'Venda com política: exige');
  assert.equal(exitRequiresDocument('Morte', { exigir_documento_venda: true }), false);
  const venda = { id: 'v', tipo_manejo: 'Saída', motivo_saida: 'Venda' };
  assert.deepEqual(pendenciesOf(venda, {}).map((item) => item.type), [], 'Fechamento só gera pendência "Doc" para Venda quando a política exigir');
  assert.deepEqual(pendenciesOf(venda, { exigir_documento_venda: true }).map((item) => item.type), ['Doc']);
  assert.deepEqual(pendenciesOf({ ...venda, documento_embarque_id: 'D1' }, { exigir_documento_venda: true }), []);
}
assert.match(closing, /session\?\.status === 'FECHADA'/, 'Fechamento lê o status de sessão no enum v7');
assert.match(closing, /loadOperationalPolicies\(\)/, 'Fechamento lê a política comercial');
assert.doesNotMatch(closing, /totalWeight \* 0\.5 \/ 15/, 'NEGATIVO: @ estimada não usa 50% fixo');

// Importação (17/09/2026): saiu da Relação e virou tela própria (src/pages/Importacao.jsx).
// O que continua valendo — dry-run que resolve cadastros por nome, cadastros ausentes listados
// e criação só com opção explícita + registry.write, ANTES de gravar as pesagens — é do motor
// (src/modules/import) e passa a ser provado ali, não por inspeção do código da Relação.
assert.ok(!relation.includes('splitImportRowsByRegistry'), 'NEGATIVO: a Relação não faz mais a conciliação de cadastros da importação');
assert.ok(!relation.includes('brandService.create('), 'NEGATIVO: a Relação não cria mais marcas/raças');
assert.ok(!relation.includes('bulkCreateEntries'), 'NEGATIVO: a Relação não grava mais importação');
assert.match(relation, /label: "Importar CSV"[\s\S]{0,120}navigate\(createPageUrl\("Importacao"\)\)/, '"Importar CSV" leva ao assistente');
const wizard = read('src/pages/Importacao.jsx');
const wizardRules = read('src/components/importacao/StepRegras.jsx');
assert.match(wizard, /analyzeImport\(/, 'o assistente concilia pelo dry-run do serviço');
assert.match(wizard, /applyImport\(plan, actor/, 'o assistente grava pelo serviço, com o ator da sessão');
assert.match(wizardRules, /createMissingMasters: event\.target\.checked/, 'criar cadastros ausentes continua sendo opção explícita');
assert.match(wizardRules, /disabled=\{!podeCadastrosMestres\}/, 'a opção exige registry.write');
assert.match(wizard, /const REGISTRY_WRITE = 'registry\.write'/, 'o assistente declara a permissão de cadastros');
const importService = read('src/modules/import/application/importService.js');
assert.match(importService, /requireImportPermission\(actor, 'registry\.write'\)/, 'o serviço recusa criar cadastros sem registry.write');
assert.ok(importService.indexOf('await createMissingMasters(fresh, actor)') < importService.indexOf('await writeImportBatch('), 'cadastros ausentes são criados ANTES de gravar as pesagens');

// Contrato anterior que continua valendo.
assert.doesNotMatch(launch, /GerenciarSaidasDialog/, 'o popup legado de perfis de venda/abate não deve voltar ao lançamento');
assert.match(launch, /loadAuxiliaryCatalogs\(/, 'lançamento carrega compradores/vendedores/frigoríficos da ponte de cadastros mestres (stores v7)');
assert.match(launch, /auxiliaryCatalogs\.compradores[\s\S]{0,200}<SelectItem/, 'comprador da venda é selecionado do cadastro, não digitado');
assert.match(launch, /auxiliaryCatalogs\.frigorificos[\s\S]{0,200}<SelectItem/, 'frigorífico do abate é selecionado do cadastro, não digitado');
assert.match(launch, /auxiliaryCatalogs\.vendedores[\s\S]{0,200}<SelectItem/, 'vendedor da compra é selecionado do cadastro, não digitado');
assert.match(launch, /ConfigurarResumosDialog/, 'resumos devem ser configuráveis');
assert.doesNotMatch(launch, /title=\{mostrarDadosVenda \? 'Ocultar Dados de Venda'/, 'venda não deve depender do botão de olho');

const summaryDialog = read('src/components/pesagens/ConfigurarResumosDialog.jsx');
for (const operation of ['count', 'sum', 'average', 'min', 'max', 'ratio']) {
  assert.ok(summaryDialog.includes(`id: '${operation}'`), `operação ${operation} deve existir`);
}

const css = read('src/styles/d17b-modelobase1.css');
assert.match(css, /box-shadow:\s*0 0 0 2px rgba\(39, 196, 91, \.10\)/, 'foco deve usar brilho suave de 2 px');
assert.ok(css.includes('.d17d-management-table'), 'listas dos popups devem usar tabela gerencial padronizada');

console.log('OK verify-operational-customization');
console.log(JSON.stringify({
  registrySelectedInLaunch: ['marcas', 'racas', 'categorias', 'compradores', 'vendedores', 'frigorificos'],
  comboboxComNovoRemoved: true,
  defaultsFromConfig: ['marca_padrao_id', 'raca_padrao_id', 'apartacao_padrao_id', 'rendimento_padrao'],
  rendimentoOrigem: [RENDIMENTO_ORIGEM_INFORMADO, RENDIMENTO_ORIGEM_PADRAO_EMPRESA],
  categorySuggestion: true,
  weightWarningPolicyFromConfig: true,
  exigirDocumentoVenda: true,
  importNoSilentRegistryCreation: true,
  legacyExitProfilesDialog: false,
  customSummaryOperations: ['count', 'sum', 'average', 'min', 'max', 'ratio'],
  settingsPersistAfterReopen: true,
  softFocus: true,
}, null, 2));
