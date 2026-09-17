// Gate da UI dos cadastros mestres (Agente F1): as seis páginas do menu CADASTROS
// são wrappers finos de CadastroAuxiliarPage sobre definição + serviço; o modelo
// de formulário (src/components/cadastros/registryFormModel.js) converte o que o
// operador digita (números pt-BR, Sim/Não, seleções, papéis) no registro que o
// serviço coage/valida; erros do serviço (REGISTRY_IN_USE, REGISTRY_INVALID,
// AUTH_FORBIDDEN) chegam à tela com mensagem em pt-BR. Cada regra tem caso negativo.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import {
  CATEGORIAS_ANIMAL,
  CAUSAS_MORTE,
  MARCAS,
  PARCEIROS,
  PROPRIEDADES,
  RACAS,
  REGISTRY_DEFINITIONS,
} from '../src/modules/catalog/domain/registryDefinitions.js';
import {
  brandService,
  categoryService,
  partnerService,
  propertyService,
} from '../src/modules/catalog/application/index.js';
import {
  NONE_OPTION,
  USAGE_IN_LIST_LIMIT,
  USAGE_IN_LIST_STORES,
  USAGE_UNAVAILABLE_TEXT,
  USAGE_UNAVAILABLE_TITLE,
  usageAvailableFor,
  describeError,
  emptyFor,
  formFromRecord,
  formatCellValue,
  groupFields,
  hasFieldValue,
  payloadFromForm,
  referenceOptionsFor,
} from '../src/components/cadastros/registryFormModel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const GESTOR = { id: 'u-gestor', nome: 'Gestor Teste', perfil: 'GESTOR' };
const OPERADOR = { id: 'u-op', nome: 'Operador Teste', perfil: 'OPERADOR' };
const resumo = { regras: [] };
const ok = (regra) => resumo.regras.push(regra);
const rejects = (promise, code, message) => assert.rejects(promise, (err) => {
  assert.equal(err?.code, code, `${message}: code ${err?.code} (${err?.message})`);
  return true;
}, message);

// ---------------------------------------------------------------------------
// Páginas: seis wrappers finos; páginas antigas removidas (ADR-022, ADR-031).
// ---------------------------------------------------------------------------
const PAGES = [
  ['Marcas', 'MARCAS', 'brandService', 'Nova marca'],
  ['Racas', 'RACAS', 'breedService', 'Nova raça'],
  ['Categorias', 'CATEGORIAS_ANIMAL', 'categoryService', 'Nova categoria'],
  ['Parceiros', 'PARCEIROS', 'partnerService', 'Novo parceiro'],
  ['Propriedades', 'PROPRIEDADES', 'propertyService', 'Nova propriedade'],
  ['CausasMorte', 'CAUSAS_MORTE', 'deathCauseService', 'Nova causa de morte'],
];
for (const [page, definition, service, newLabel] of PAGES) {
  const source = read(`src/pages/${page}.jsx`);
  assert.match(source, /import CadastroAuxiliarPage from '@\/components\/cadastros\/CadastroAuxiliarPage'/, `${page}: usa a página genérica`);
  assert.match(source, new RegExp(`import \\{ ${definition} \\} from '@/modules/catalog/domain/registryDefinitions'`), `${page}: importa a definição ${definition}`);
  assert.match(source, new RegExp(`import \\{ ${service} \\} from '@/modules/catalog/application/index'`), `${page}: importa o serviço ${service}`);
  assert.match(source, new RegExp(`definition: ${definition}, persistence: ${service}`), `${page}: aba com definição e porta de persistência`);
  assert.match(source, new RegExp(`newLabel: '${newLabel}'`), `${page}: rótulo de novo registro com concordância`);
  assert.ok(!/registryService|appSettings|loadRegistryGroup|saveRegistryGroup/.test(source), `${page}: sem acesso ao registry legado`);
  assert.ok(source.split('\n').length <= 16, `${page}: wrapper fino (${source.split('\n').length} linhas)`);
}
for (const removed of ['src/pages/CadastrosComerciais.jsx', 'src/pages/ConfiguracoesSanidade.jsx']) {
  assert.equal(existsSync(join(root, removed)), false, `${removed} removida`);
}
// ADR-049: a sanidade voltou ao produto em stores próprias da v8 (programasSanidade,
// medicamentos, aplicacoesSanidade). A proibição da ADR-022 continua valendo no ponto do
// registry: nada de sanidade em appSettings (`cadastros-auxiliares:sanidade:*`) nem no
// registry mestre genérico.
assert.ok(!/sanidade|medicamento/i.test(read('src/modules/catalog/domain/registryDefinitions.js')), 'registry mestre não ganha grupo de sanidade (stores próprias, ADR-049)');
for (const file of ['src/modules/sanity/application/sanityService.js', 'src/modules/sanity/infrastructure/sanityDataAdapter.js']) {
  if (!existsSync(join(root, file))) continue;
  assert.ok(!/table\(['"]appSettings['"]\)|storage\.settings|writeAppSetting|readAppSetting|cadastros-auxiliares|registryService/.test(read(file)), `${file}: sanidade não grava em appSettings nem no registry legado`);
}
ok('paginas');

// ---------------------------------------------------------------------------
// Componente: porta de persistência, permissões, ações da barra, teclado, campos.
// ---------------------------------------------------------------------------
const component = read('src/components/cadastros/CadastroAuxiliarPage.jsx');
assert.ok(!/registryService|loadRegistryGroup|saveRegistryGroup|appSettings/.test(component), 'componente não importa o registry legado');
assert.match(component, /from '\.\/registryFormModel\.js'/, 'componente usa o modelo de formulário compartilhado com o gate');
assert.match(component, /const \{ definition, persistence \} = tab;/, 'aba expõe definição e porta de persistência');
for (const call of ['persistence.list(', 'persistence.create(actor,', 'persistence.update(actor, editingId,', 'persistence.remove(actor,', 'persistence.activate(actor,', 'persistence.deactivate(actor,', 'persistence.setDefault(actor,', 'persistence.countUsage(']) {
  assert.ok(component.includes(call), `porta de persistência: ${call}`);
}
assert.match(component, /REGISTRY_READ_PERMISSION = 'registry\.read'/, 'permissão de leitura declarada');
assert.match(component, /REGISTRY_WRITE_PERMISSION = 'registry\.write'/, 'permissão de escrita declarada');
assert.match(component, /const canWrite = auth \? Boolean\(auth\.can\?\.\(REGISTRY_WRITE_PERMISSION\)\) : true;/, 'ações de escrita dependem de registry.write (sem AuthGate: permitido, o serviço valida)');
assert.match(component, /if \(!canRead\) return <AccessDenied/, 'sem registry.read a página mostra Acesso não permitido');
assert.match(component, /const actor = auth\?\.user \?\? null;/, 'ator da sessão vai para o serviço (auditoria)');
for (const label of ['>Novo<', '{editActionLabel}', '>Inativar<', '>Ativar<', 'Definir padrão', 'Excluir', "label: 'Atualizar'"]) {
  assert.ok(component.includes(label), `ação na barra: ${label}`);
}
assert.match(component, /aria-hidden=\{!canWrite\}>\s*<button[^>]*aux-new-button/, 'Novo oculto sem permissão de escrita');
assert.match(component, /canSetDefault = canWrite && selectedRecords\.length === 1 && selectedTab\.definition\.temPadrao/, 'Definir padrão só com temPadrao e um selecionado');
assert.match(component, /onSubmit=\{save\}/, 'Enter salva pelo submit do formulário');
assert.match(component, /event\.key === 'Escape'[\s\S]{0,160}closeForm\(\)/, 'Esc cancela o registro');
assert.match(component, /\[data-radix-select-content\], \[role="listbox"\]/, 'Esc dentro de uma lista suspensa aberta não fecha o registro');
assert.match(component, /campo\.tipo === 'multiselect'[\s\S]{0,900}className=\{`aux-chip/, 'multiselect renderiza chips');
assert.match(component, /value: NONE_OPTION, label: 'Nenhum'/, 'select opcional oferece "Nenhum" para limpar');
assert.match(component, /getRegistryService\(store\)\.list\(\{ empresaId, incluirInativos: true \}\)/, 'referências carregadas pelo serviço do cadastro referenciado');
assert.match(component, /referenceOptionsFor\(campo, references\[campo\.referencia\.store\], form\[campo\.id\]\)/, 'opções de referência filtradas por papel e situação');
assert.match(component, /USAGE_COLUMN = \{ id: '_uso', label: 'Em uso'/, 'coluna "Em uso" declarada');
assert.match(component, /usageInList = tabs\.length === 1 && tab\.usageInList/, 'coluna "Em uso" só quando a contagem é por índice');
assert.match(component, /Em uso: \{usage\[editingRecord\.id\]\}/, 'registro aberto mostra a contagem de uso sob demanda');
// Acima do limite: célula "—" com title explicativo, sem pílula de filtro e sem "…" permanente.
assert.match(component, /const usageAvailable = usageAvailableFor\(usageInList, \(catalog\[tab\.id\] \|\| \[\]\)\.length\);/, 'disponibilidade da coluna "Em uso" decidida pelo tamanho da lista');
assert.match(component, /if \(column\.id === '_uso' && !usageAvailable\) return null;/, 'pílula "Em uso" só quando a contagem está disponível');
assert.match(component, /title=\{!usageAvailable \? USAGE_UNAVAILABLE_TITLE : undefined\}>\{!usageAvailable \? USAGE_UNAVAILABLE_TEXT : usage\[record\.id\] == null \? '…' : usage\[record\.id\]\}/, 'célula mostra "—" com title acima do limite; "…" só enquanto conta');
assert.ok(!/\{usageInList \? \(\s*<MakFilterPill/.test(component), 'NEGATIVO: pílula não depende só de usageInList');
// Inativar um padrão: o aviso do serviço chega à tela.
assert.match(component, /const result = await owner\.persistence\.deactivate\(actor, record\.id\);\s*if \(result\?\.aviso\) toast\.warning\(result\.aviso\);/, 'aviso de "deixou de ser padrão" vira notificação');
assert.match(component, /notifyError\(error, 'Não foi possível salvar o cadastro\.'\)/, 'erro de gravação vai para a notificação com a mensagem do serviço');
assert.match(component, /const \{ message, description \} = describeError\(error, fallback\);/, 'REGISTRY_IN_USE mostra a mensagem e o detalhe do serviço');
assert.match(component, /inputMode=\{isNumber \? 'decimal' : undefined\}/, 'campo numérico aceita vírgula decimal (formato brazileiro via parseBrazilianNumber no modelo)');
const eslintConfig = read('eslint.config.js');
assert.match(eslintConfig, /src\/components\/\*\*/, 'ESLint cobre os componentes de cadastros');
ok('componente');

// ---------------------------------------------------------------------------
// Modelo de formulário: defaults visíveis, ida e volta e conversão pt-BR.
// ---------------------------------------------------------------------------
const vazioMarca = emptyFor(MARCAS);
assert.deepEqual(vazioMarca, { nome: '', abreviacao: '', proprietario_parceiro_id: '', propriedade_id: '', padrao: false, observacao: '', ativo: true }, 'marca vazia: ativo true, padrao false, referências vazias');
// Categoria (16/09/2026): sexo obrigatório sem valor pré-escolhido; faixa de peso e era no formulário e na lista.
assert.equal(emptyFor(CATEGORIAS_ANIMAL).sexo_aplicavel, '', 'categoria nova começa sem sexo: o operador escolhe Macho ou Fêmea');
assert.deepEqual(CATEGORIAS_ANIMAL.campos.map((c) => c.id), ['nome', 'sexo_aplicavel', 'peso_min_kg', 'peso_max_kg', 'era', 'ordem', 'ativo'], 'campos da categoria');
assert.deepEqual(CATEGORIAS_ANIMAL.colunas.map((c) => c.id), ['nome', 'sexo_aplicavel', 'peso_min_kg', 'peso_max_kg', 'era', 'ordem', 'ativo'], 'colunas da categoria');
assert.ok(!CATEGORIAS_ANIMAL.campos.some((c) => /idade|nascimento/.test(c.id)), 'NEGATIVO: categoria não usa idade nem nascimento');
assert.equal(emptyFor(PROPRIEDADES).tipo, 'PROPRIA');
assert.equal(emptyFor(CAUSAS_MORTE).categoria, 'Outra');
assert.deepEqual(emptyFor(PARCEIROS).papeis, [], 'papéis começam vazios (obrigatório: o operador escolhe)');
assert.equal(emptyFor(RACAS).ordem, '', 'número sem default vira campo vazio, nunca 0 escondido');
assert.equal(hasFieldValue([]), false);
assert.equal(hasFieldValue(['COMPRADOR']), true);
assert.equal(hasFieldValue('  '), false);

const registroParceiro = { id: 'p1', nome: 'Frigorífico Boi Gordo', tipo_pessoa: 'JURIDICA', documento: '12345678000190', papeis: ['FRIGORIFICO', 'COMPRADOR'], telefone: null, email: null, cidade: 'Campo Grande', uf: 'MS', registro_sif: 'SIF 1234', rendimento_padrao: 52.5, observacao: null, ativo: true, _tabId: 'x', _key: 'k' };
const formParceiro = formFromRecord(PARCEIROS, registroParceiro);
assert.equal(formParceiro.rendimento_padrao, '52,5', 'número entra no campo com vírgula');
assert.deepEqual(formParceiro.papeis, ['FRIGORIFICO', 'COMPRADOR']);
assert.equal(formParceiro.telefone, '', 'nulo vira campo vazio');
assert.ok(!('_tabId' in formParceiro) && !('_key' in formParceiro), 'chaves internas da lista não entram no formulário');
const payloadParceiro = payloadFromForm(PARCEIROS, formParceiro);
assert.equal(payloadParceiro.rendimento_padrao, 52.5, 'vírgula volta a número');
assert.equal(payloadParceiro.telefone, '', 'texto vazio segue vazio (o serviço limpa para null)');
assert.deepEqual(payloadParceiro.papeis, ['FRIGORIFICO', 'COMPRADOR']);
assert.notEqual(payloadParceiro.papeis, formParceiro.papeis, 'array copiado, não compartilhado');
assert.equal(payloadFromForm(PARCEIROS, { ...formParceiro, rendimento_padrao: '1.234,5' }).rendimento_padrao, 1234.5, 'milhar com ponto e decimal com vírgula');
assert.equal(payloadFromForm(PARCEIROS, { ...formParceiro, rendimento_padrao: '' }).rendimento_padrao, null, 'número vazio é nulo, não zero');
assert.ok(Number.isNaN(payloadFromForm(PARCEIROS, { ...formParceiro, rendimento_padrao: 'abc' }).rendimento_padrao), 'número inválido vira NaN para a definição recusar');
assert.equal(payloadFromForm(MARCAS, { ...vazioMarca, nome: 'X' }).proprietario_parceiro_id, null, 'select vazio vira null');
assert.equal(payloadFromForm(MARCAS, { ...vazioMarca, nome: 'X', propriedade_id: 'prop-1' }).propriedade_id, 'prop-1');
assert.equal(payloadFromForm(CATEGORIAS_ANIMAL, { ...emptyFor(CATEGORIAS_ANIMAL), nome: 'Boi', peso_min_kg: '350,5' }).peso_min_kg, 350.5, 'peso da faixa com vírgula volta a número');
assert.equal(payloadFromForm(CAUSAS_MORTE, { ...emptyFor(CAUSAS_MORTE), nome: 'Raio', exige_observacao: true }).exige_observacao, true);
// NEGATIVO: o que a definição recusa a partir do formulário
assert.ok(PARCEIROS.validar(payloadFromForm(PARCEIROS, { ...formParceiro, rendimento_padrao: 'abc' })).some((e) => /número válido/i.test(e)), 'número inválido é recusado pela definição');
assert.ok(PARCEIROS.validar(payloadFromForm(PARCEIROS, { ...formParceiro, papeis: [] })).some((e) => /Papéis/.test(e)), 'parceiro sem papel é recusado');
assert.ok(CATEGORIAS_ANIMAL.validar(payloadFromForm(CATEGORIAS_ANIMAL, { ...emptyFor(CATEGORIAS_ANIMAL), nome: 'Boi', sexo_aplicavel: 'M', peso_min_kg: '400', peso_max_kg: '300' })).some((e) => /Peso mínimo/.test(e)), 'faixa de peso invertida é recusada');
assert.ok(CATEGORIAS_ANIMAL.validar(payloadFromForm(CATEGORIAS_ANIMAL, { ...emptyFor(CATEGORIAS_ANIMAL), nome: 'Boi' })).some((e) => /Sexo/.test(e)), 'categoria sem sexo é recusada');
assert.equal(PARCEIROS.validar(payloadParceiro).length, 0, 'formulário válido passa na definição');
assert.notEqual(NONE_OPTION, '', 'sentinela "Nenhum" nunca é o valor vazio (Radix não aceita item vazio)');
ok('modelo-formulario');

// ---------------------------------------------------------------------------
// Agrupamento dos cards: cada campo em exatamente um card.
// ---------------------------------------------------------------------------
for (const def of REGISTRY_DEFINITIONS) {
  const grupos = groupFields(def);
  const todos = [...grupos.primary, ...grupos.additional, ...grupos.contact, ...grupos.observation].map((c) => c.id).sort();
  assert.deepEqual(todos, def.campos.map((c) => c.id).sort(), `${def.store}: todo campo aparece uma única vez nos cards`);
  assert.ok(grupos.primary.some((c) => c.id === 'nome') && grupos.primary.some((c) => c.id === 'ativo'), `${def.store}: nome e situação ficam em Dados principais`);
}
const gruposParceiro = groupFields(PARCEIROS);
assert.deepEqual(gruposParceiro.contact.map((c) => c.id), ['telefone', 'email']);
assert.deepEqual(gruposParceiro.additional.map((c) => c.id), ['cidade', 'uf', 'registro_sif', 'rendimento_padrao']);
assert.deepEqual(gruposParceiro.observation.map((c) => c.id), ['observacao']);
assert.ok(gruposParceiro.primary.some((c) => c.id === 'papeis'), 'papéis ficam no card principal');
assert.deepEqual(groupFields(CAUSAS_MORTE).observation.map((c) => c.id), ['descricao'], 'descrição da causa vai para a aba Observações');
ok('cards');

// ---------------------------------------------------------------------------
// Fluxo com o serviço real: formulário → serviço → lista → células e referências.
// ---------------------------------------------------------------------------
await deleteDbForTests();
const db = await ensureStorageReady();

const dono = await partnerService.create(GESTOR, payloadFromForm(PARCEIROS, { ...emptyFor(PARCEIROS), nome: 'João Proprietário', papeis: ['PROPRIETARIO'], tipo_pessoa: 'FISICA' }));
const comprador = await partnerService.create(GESTOR, payloadFromForm(PARCEIROS, { ...emptyFor(PARCEIROS), nome: 'Comprador Sem Marca', papeis: ['COMPRADOR'] }));
const donoInativo = await partnerService.create(GESTOR, payloadFromForm(PARCEIROS, { ...emptyFor(PARCEIROS), nome: 'Antigo Proprietário', papeis: ['PROPRIETARIO'] }));
await partnerService.deactivate(GESTOR, donoInativo.id);
const sede = await propertyService.create(GESTOR, payloadFromForm(PROPRIEDADES, { ...emptyFor(PROPRIEDADES), nome: 'Fazenda Sede', uf: 'MS', municipio: 'Campo Grande' }));

const formMarca = { ...emptyFor(MARCAS), nome: 'Marca  Boa   Vista', abreviacao: 'MBV', proprietario_parceiro_id: dono.id, propriedade_id: sede.id, padrao: true, observacao: 'principal' };
const marca = await brandService.create(GESTOR, { ...payloadFromForm(MARCAS, formMarca), empresa_id: 'local' });
assert.equal(marca.nome, 'Marca Boa Vista', 'serviço limpa espaços do nome digitado');
assert.equal(marca.proprietario_parceiro_id, dono.id);
assert.equal(marca.padrao, true);

// Referências como a página carrega: list(incluirInativos) do cadastro referenciado.
const parceiros = await partnerService.list({ empresaId: 'local', incluirInativos: true });
const propriedades = await propertyService.list({ empresaId: 'local', incluirInativos: true });
const referenceName = (store, id) => ({ parceiros, propriedades })[store]?.find((row) => row.id === id)?.nome ?? '';
const campoProprietario = MARCAS.campos.find((c) => c.id === 'proprietario_parceiro_id');
const opcoes = referenceOptionsFor(campoProprietario, parceiros, '');
assert.deepEqual(opcoes.map((o) => o.label), ['João Proprietário'], 'select de proprietário lista só parceiros ativos com papel PROPRIETARIO');
assert.ok(!opcoes.some((o) => o.value === comprador.id), 'comprador sem papel PROPRIETARIO não aparece');
const opcoesComInativo = referenceOptionsFor(campoProprietario, parceiros, donoInativo.id);
assert.ok(opcoesComInativo.some((o) => o.value === donoInativo.id && /\(inativo\)$/.test(o.label)), 'valor já gravado aparece mesmo inativo, marcado');
const campoPropriedade = MARCAS.campos.find((c) => c.id === 'propriedade_id');
assert.deepEqual(referenceOptionsFor(campoPropriedade, propriedades, '').map((o) => o.value), [sede.id], 'select de propriedade sem filtro de papel');

const marcas = await brandService.list({ empresaId: 'local', incluirInativos: true });
const linha = marcas.find((row) => row.id === marca.id);
const colunaProprietario = MARCAS.colunas.find((c) => c.id === 'proprietario_parceiro_id');
assert.equal(formatCellValue(colunaProprietario, linha, { campo: campoProprietario, referenceName }), 'João Proprietário', 'coluna de referência mostra o nome, não o id');
assert.equal(formatCellValue(MARCAS.colunas.find((c) => c.id === 'padrao'), linha, { campo: MARCAS.campos.find((c) => c.id === 'padrao') }), 'Sim');
assert.equal(formatCellValue(MARCAS.colunas.find((c) => c.id === 'ativo'), linha, {}), 'Ativo');
assert.equal(formatCellValue({ id: '_uso', label: 'Em uso' }, linha, { usage: { [marca.id]: 3 } }), '3');
assert.equal(formatCellValue({ id: '_uso', label: 'Em uso' }, linha, { usage: {} }), '', 'uso desconhecido fica vazio (a célula mostra "…")');
const linhaParceiro = parceiros.find((row) => row.id === dono.id);
assert.equal(formatCellValue(PARCEIROS.colunas.find((c) => c.id === 'papeis'), linhaParceiro, { campo: PARCEIROS.campos.find((c) => c.id === 'papeis') }), 'Proprietário de marca', 'papéis renderizam com rótulo pt-BR');
const linhaRendimento = { ...linhaParceiro, rendimento_padrao: 1234.5 };
assert.equal(formatCellValue({ id: 'rendimento_padrao', label: 'Rendimento' }, linhaRendimento, { campo: PARCEIROS.campos.find((c) => c.id === 'rendimento_padrao') }), (1234.5).toLocaleString('pt-BR', { maximumFractionDigits: 4 }), 'número na grade em formato brasileiro');
// Ida e volta do registro gravado: reabrir e salvar sem mudar nada não altera o registro.
const reaberto = formFromRecord(MARCAS, linha);
assert.equal(reaberto.proprietario_parceiro_id, dono.id);
const semMudanca = await brandService.update(GESTOR, marca.id, payloadFromForm(MARCAS, reaberto));
assert.equal(semMudanca.updated_at, linha.updated_at, 'reabrir e salvar sem alteração não regrava');
ok('fluxo-servico');

// ---------------------------------------------------------------------------
// Erros do serviço como a tela mostra: IN_USE com detalhe, INVALID, FORBIDDEN.
// ---------------------------------------------------------------------------
await db.table('animais').add({ id: 'animal-1', empresa_id: 'local', identificacao_normalizada: '1::MBV', situacao: 'ATIVO', marca_id: marca.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null });
await assert.rejects(brandService.remove(GESTOR, marca.id), (err) => {
  const shown = describeError(err, 'fallback');
  assert.match(shown.message, /em uso por 1 registro/, 'mensagem do serviço vai para a notificação');
  assert.match(shown.description, /^Vínculos — animais: 1\.$/, 'detalhe lista as origens com vínculo (>0)');
  return true;
});
assert.ok(await brandService.get(marca.id), 'marca em uso continua existindo');
// NEGATIVO: outros erros não inventam detalhe; erro sem mensagem usa o fallback.
await rejects(brandService.create(GESTOR, payloadFromForm(MARCAS, { ...emptyFor(MARCAS), nome: '   ' })), 'REGISTRY_INVALID', 'nome vazio pelo formulário');
try { await brandService.create(GESTOR, payloadFromForm(MARCAS, { ...emptyFor(MARCAS), nome: 'marca boa vista' })); assert.fail('duplicado deveria falhar'); }
catch (err) {
  assert.equal(err.code, 'REGISTRY_DUPLICATE');
  const shown = describeError(err, 'fallback');
  assert.equal(shown.description, undefined, 'só REGISTRY_IN_USE traz descrição');
  assert.match(shown.message, /Já existe marca/, 'mensagem de duplicidade do serviço');
}
assert.deepEqual(describeError(null, 'Não foi possível salvar o cadastro.'), { message: 'Não foi possível salvar o cadastro.', description: undefined }, 'sem erro estruturado usa o fallback');
assert.equal(describeError({ code: 'REGISTRY_IN_USE', message: 'm', details: { detalhe: { animais: 0, faixas: 0 } } }, 'f').description, undefined, 'detalhe todo zero não vira descrição');
// NEGATIVO: número inválido digitado é recusado antes e pelo serviço
const formInvalido = { ...emptyFor(CATEGORIAS_ANIMAL), nome: 'Garrote', idade_min_meses: 'treze' };
assert.ok(CATEGORIAS_ANIMAL.validar(payloadFromForm(CATEGORIAS_ANIMAL, formInvalido)).length > 0, 'a tela recusa antes de chamar o serviço');
await rejects(categoryService.create(GESTOR, payloadFromForm(CATEGORIAS_ANIMAL, formInvalido)), 'REGISTRY_INVALID', 'serviço também recusa');
// NEGATIVO: ator sem registry.write (OPERADOR) é recusado pela porta com o ator da sessão
await rejects(brandService.create(OPERADOR, payloadFromForm(MARCAS, { ...emptyFor(MARCAS), nome: 'Marca do Operador' })), 'AUTH_FORBIDDEN', 'OPERADOR não grava cadastro');
await rejects(brandService.setDefault(OPERADOR, marca.id), 'AUTH_FORBIDDEN', 'OPERADOR não define padrão');
ok('erros-na-tela');

// ---------------------------------------------------------------------------
// Política da coluna "Em uso": só stores com contagem por índice.
// ---------------------------------------------------------------------------
assert.deepEqual([...USAGE_IN_LIST_STORES].sort(), ['categoriasAnimal', 'marcas', 'propriedades', 'racas'], 'coluna "Em uso" só para marcas, raças, categorias e propriedades');
assert.ok(!USAGE_IN_LIST_STORES.has('parceiros') && !USAGE_IN_LIST_STORES.has('causasMorte'), 'parceiros e causas (varredura de eventos) contam só sob demanda');
assert.equal(await brandService.countUsage(marca.id), 1, 'contagem que a coluna exibe');
// Política do limite: até USAGE_IN_LIST_LIMIT conta; acima mostra "—" com explicação (nunca "…" permanente).
assert.equal(usageAvailableFor(true, USAGE_IN_LIST_LIMIT), true, 'no limite ainda conta');
assert.equal(usageAvailableFor(true, USAGE_IN_LIST_LIMIT + 1), false, 'NEGATIVO: acima do limite não conta');
assert.equal(usageAvailableFor(false, 1), false, 'NEGATIVO: store sem contagem por índice nunca conta na lista');
assert.equal(USAGE_UNAVAILABLE_TEXT, '—');
assert.match(USAGE_UNAVAILABLE_TITLE, new RegExp(`${USAGE_IN_LIST_LIMIT} registros`), 'title explica o limite');
// describeError continua entendendo o detalhe histórico (identificadores/sessões com rótulo pt-BR).
assert.equal(describeError({ code: 'REGISTRY_IN_USE', message: 'm', details: { detalhe: { animais: 0, identificadores: 2, sessoes: 1 } } }, 'f').description, 'Vínculos — identificadores: 2 · sessões: 1.', 'origens novas do vínculo histórico com rótulo');
// Inativar o padrão devolve aviso; inativar quem não é padrão não devolve.
const marcaPadrao2 = await brandService.create(GESTOR, { nome: 'Marca padrão dois', padrao: true });
const inativada = await brandService.deactivate(GESTOR, marcaPadrao2.id);
assert.match(inativada.aviso, /deixou de ser o padrão/, 'serviço avisa ao inativar o padrão');
const outraMarca = await brandService.create(GESTOR, { nome: 'Marca comum' });
assert.equal((await brandService.deactivate(GESTOR, outraMarca.id)).aviso, undefined, 'NEGATIVO: sem padrão não há aviso');
ok('em-uso');

await deleteDbForTests();
console.log('OK verify-registry-ui');
console.log(JSON.stringify(resumo, null, 2));
