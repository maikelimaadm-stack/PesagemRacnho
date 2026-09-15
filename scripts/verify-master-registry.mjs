// Gate dos cadastros mestres (ADR-018, docs 12 §3.1): unicidade normalizada,
// inativação com vínculo, resolução por nome, padrão único, permissão, seeds
// idempotentes e resolvedor. Cada regra tem o caso negativo (o comportamento
// incorreto deve falhar).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { PARCEIRO_PAPEIS } from '../src/storage/indexedDb/schema.js';
import {
  REGISTRY_DEFINITIONS,
  brandService,
  breedService,
  categoryService,
  deathCauseService,
  ensureSeeds,
  getRegistryService,
  partnerService,
  propertyService,
} from '../src/modules/catalog/application/index.js';
import { normalizeDocument, normalizeName } from '../src/modules/catalog/domain/normalize.js';
import { resolveMany, resolveNamesAgainst } from '../src/modules/catalog/domain/catalogResolver.js';
import { loadAuxiliaryCatalogs } from '../src/modules/auxiliary/application/legacyCatalogBridge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GESTOR = { id: 'u-gestor', nome: 'Gestor Teste', perfil: 'GESTOR' };
const OPERADOR = { id: 'u-op', nome: 'Operador Teste', perfil: 'OPERADOR' };
const rejects = (promise, code, message) => assert.rejects(promise, (err) => {
  assert.ok(err && typeof err.code === 'string', `${message}: erro sem code (${err?.message})`);
  assert.match(err.code, code instanceof RegExp ? code : new RegExp(`^${code}$`), `${message}: code ${err.code} (${err.message})`);
  return true;
}, message);

await deleteDbForTests();
let db = await ensureStorageReady();
const resumo = { cadastros: {}, regras: [] };
const ok = (regra) => resumo.regras.push(regra);

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------
assert.equal(normalizeName('  fazenda   são   joão '), 'FAZENDA SÃO JOÃO');
assert.equal(normalizeName(null), '');
assert.equal(normalizeDocument('123.456.789-01'), '12345678901');
assert.equal(normalizeDocument('sem digitos'), null);
assert.equal(normalizeDocument(''), null);
ok('normalizacao');

// ---------------------------------------------------------------------------
// Definições: fonte única para a UI
// ---------------------------------------------------------------------------
assert.equal(REGISTRY_DEFINITIONS.length, 6);
for (const def of REGISTRY_DEFINITIONS) {
  assert.ok(def.store && def.singular && def.plural && def.rotulo, `definição completa: ${def.store}`);
  assert.ok(def.campos.some((c) => c.id === 'nome' && c.obrigatorio), `${def.store}: nome obrigatório`);
  assert.ok(def.campos.some((c) => c.id === 'ativo' && c.tipo === 'booleano'), `${def.store}: campo ativo`);
  assert.ok(def.colunas.length > 0 && def.colunas[0].id === 'nome', `${def.store}: colunas começam por nome`);
  assert.ok(def.unicidade.includes('nome_normalizado'), `${def.store}: unicidade por nome`);
  for (const campo of def.campos) {
    assert.ok(['texto', 'numero', 'booleano', 'select', 'multiselect'].includes(campo.tipo), `${def.store}.${campo.id}: tipo ${campo.tipo}`);
  }
  assert.ok(def.validar({}).some((e) => /nome/i.test(e)), `${def.store}: validar sem nome falha`);
  assert.equal(getRegistryService(def.store).store, def.store);
}
const papeisCampo = REGISTRY_DEFINITIONS.find((d) => d.store === 'parceiros').campos.find((c) => c.id === 'papeis');
assert.deepEqual(papeisCampo.opcoes.map((o) => o.value), PARCEIRO_PAPEIS, 'papéis vêm exatamente de schema.js');
assert.throws(() => getRegistryService('inexistente'), /desconhecido/);
ok('definicoes');

// ---------------------------------------------------------------------------
// CRUD genérico por cadastro: criar, duplicar normalizado, atualizar, resolver,
// inativar, reativar, remover sem vínculo, auditoria.
// ---------------------------------------------------------------------------
const casos = [
  { service: brandService, dados: { nome: 'Fazenda  Boa Vista', abreviacao: 'FBV' }, duplicado: ' fazenda boa  VISTA ', patch: { abreviacao: 'BV', observacao: 'marca principal' } },
  { service: breedService, dados: { nome: 'Angus', grupo: 'TAURINO', ordem: 2 }, duplicado: 'ANGUS', patch: { abreviacao: 'AN' } },
  { service: categoryService, dados: { nome: 'Novilho', sexo_aplicavel: 'M', idade_min_meses: 13, idade_max_meses: 24 }, duplicado: 'novilho', patch: { idade_max_meses: 30 } },
  { service: partnerService, dados: { nome: 'Frigorífico Boi Gordo', papeis: ['FRIGORIFICO', 'COMPRADOR'], documento: '12.345.678/0001-90', registro_sif: 'SIF 1234' }, duplicado: 'FRIGORÍFICO  BOI GORDO', patch: { telefone: '(67) 99999-0000', uf: 'ms' } },
  { service: propertyService, dados: { nome: 'Sítio Recanto', tipo: 'TERCEIRO', municipio: 'Campo Grande', uf: 'MS' }, duplicado: 'sítio recanto', patch: { codigo_oficial: 'MS-001' } },
  { service: deathCauseService, dados: { nome: 'Acidente no curral', categoria: 'Acidente', exige_observacao: true }, duplicado: 'ACIDENTE NO CURRAL', patch: { descricao: 'Fraturas e quedas' } },
];

for (const caso of casos) {
  const { service } = caso;
  const store = service.store;
  const created = await service.create(GESTOR, caso.dados);
  assert.ok(created.id && created.localId, `${store}: create devolve id`);
  assert.equal(created.empresa_id, 'local');
  assert.equal(created.ativo, true, `${store}: nasce ativo`);
  assert.equal(created.nome_normalizado, normalizeName(caso.dados.nome), `${store}: nome_normalizado`);
  assert.equal(created.nome, caso.dados.nome.trim().replace(/\s+/g, ' '), `${store}: nome guardado sem espaços sobrando`);
  assert.equal(created.deleted_at, null);

  // NEGATIVO: duplicado por nome normalizado
  await rejects(service.create(GESTOR, { ...caso.dados, nome: caso.duplicado }), 'REGISTRY_DUPLICATE', `${store}: duplicado normalizado`);
  // NEGATIVO: sem nome
  await rejects(service.create(GESTOR, { ...caso.dados, nome: '   ' }), 'REGISTRY_INVALID', `${store}: nome obrigatório`);

  // atualizar
  const updated = await service.update(GESTOR, created.id, caso.patch);
  for (const [key, value] of Object.entries(caso.patch)) {
    const esperado = key === 'uf' ? value.toUpperCase() : value;
    assert.equal(updated[key], esperado, `${store}: patch ${key}`);
  }
  const renamed = await service.update(GESTOR, created.id, { nome: `${caso.dados.nome} II` });
  assert.equal(renamed.nome_normalizado, normalizeName(`${caso.dados.nome} II`), `${store}: renomear recalcula nome_normalizado`);
  await service.update(GESTOR, created.id, { nome: caso.dados.nome });

  // NEGATIVO: renomear para nome de outro registro
  const outro = await service.create(GESTOR, { ...caso.dados, nome: `${caso.dados.nome} Outro`, documento: undefined });
  await rejects(service.update(GESTOR, outro.id, { nome: caso.duplicado }), 'REGISTRY_DUPLICATE', `${store}: update para nome existente`);
  // NEGATIVO: atualizar inexistente
  await rejects(service.update(GESTOR, 'nao-existe', { nome: 'X' }), 'REGISTRY_NOT_FOUND', `${store}: update inexistente`);

  // resolver por nome normalizado
  const resolved = await service.resolveByName(caso.duplicado);
  assert.equal(resolved?.id, created.id, `${store}: resolveByName`);
  assert.equal(await service.resolveByName('nome que não existe'), null, `${store}: resolveByName desconhecido`);

  // inativar / listar / reativar
  const inativo = await service.deactivate(GESTOR, created.id);
  assert.equal(inativo.ativo, false, `${store}: deactivate`);
  assert.ok(!(await service.list()).some((r) => r.id === created.id), `${store}: list oculta inativos`);
  assert.ok((await service.list({ incluirInativos: true })).some((r) => r.id === created.id), `${store}: list incluirInativos`);
  assert.equal((await service.resolveByName(caso.dados.nome))?.id, created.id, `${store}: inativo ainda resolve por nome`);
  const reativado = await service.activate(GESTOR, created.id);
  assert.equal(reativado.ativo, true, `${store}: activate`);

  // remover sem vínculo → exclusão lógica
  assert.equal(await service.countUsage(outro.id), 0);
  assert.equal(await service.remove(GESTOR, outro.id), true, `${store}: remove sem vínculo`);
  assert.equal(await service.get(outro.id), null, `${store}: get após remover`);
  const linhaExcluida = await db.table(store).where('id').equals(outro.id).first();
  assert.ok(linhaExcluida?.deleted_at, `${store}: exclusão é lógica (deleted_at)`);
  assert.equal(await service.resolveByName(`${caso.dados.nome} Outro`), null, `${store}: excluído não resolve`);
  // nome do excluído pode ser reutilizado
  const reuso = await service.create(GESTOR, { ...caso.dados, nome: `${caso.dados.nome} Outro`, documento: undefined });
  await service.remove(GESTOR, reuso.id);

  // auditoria com ator
  const trilha = await db.table('auditoria').where('entidade').equals(store).toArray();
  const acoes = new Set(trilha.map((a) => a.acao));
  for (const acao of ['CRIAR', 'ATUALIZAR', 'INATIVAR', 'CANCELAR']) assert.ok(acoes.has(acao), `${store}: auditoria ${acao}`);
  assert.ok(trilha.every((a) => a.entidade_id && a.resumo && a.created_at), `${store}: auditoria com resumo`);
  assert.ok(trilha.every((a) => a.actor_user_id === GESTOR.id && a.actor_user_profile === 'GESTOR'), `${store}: auditoria com ator`);
  const alteracao = trilha.find((a) => a.acao === 'ATUALIZAR' && a.campos_alterados.includes(Object.keys(caso.patch)[0]));
  assert.ok(alteracao, `${store}: campos_alterados registrados`);

  resumo.cadastros[store] = { crud: true, duplicado: true, auditoria: trilha.length };
  caso.id = created.id;
}
ok('crud-por-cadastro');

// ---------------------------------------------------------------------------
// Permissão: OPERADOR recusado (fallback local ou assertCan oficial); sem ator permitido.
// ---------------------------------------------------------------------------
const FORBIDDEN = /^(REGISTRY_FORBIDDEN|AUTH_FORBIDDEN)$/;
await rejects(brandService.create(OPERADOR, { nome: 'Marca do operador' }), FORBIDDEN, 'OPERADOR não cria');
await rejects(brandService.update(OPERADOR, casos[0].id, { abreviacao: 'X' }), FORBIDDEN, 'OPERADOR não altera');
await rejects(brandService.deactivate(OPERADOR, casos[0].id), FORBIDDEN, 'OPERADOR não inativa');
await rejects(brandService.remove(OPERADOR, casos[0].id), FORBIDDEN, 'OPERADOR não exclui');
await rejects(brandService.setDefault(OPERADOR, casos[0].id), FORBIDDEN, 'OPERADOR não define padrão');
assert.equal(await brandService.resolveByName('fazenda boa vista').then((r) => r.id), casos[0].id, 'OPERADOR nada alterou');
assert.equal((await brandService.list()).length, 1, 'recusa não grava nada');
const semAtor = await breedService.create(null, { nome: 'Sem ator' });
assert.ok(semAtor.id, 'sem ator (gates/migração) é permitido');
const admin = await breedService.create({ id: 'u-admin', perfil: 'ADMIN' }, { nome: 'Por admin' });
assert.ok(admin.id, 'ADMIN permitido');
const auditSemAtor = await db.table('auditoria').where('entidade_id').equals(semAtor.id).first();
assert.equal(auditSemAtor.actor_user_id, null, 'auditoria sem sessão fica com ator nulo');
await breedService.remove(GESTOR, semAtor.id);
await breedService.remove(GESTOR, admin.id);
const accessPolicyExists = existsSync(join(root, 'src/modules/auth/domain/accessPolicy.js'));
ok(`permissao(${accessPolicyExists ? 'accessPolicy presente' : 'fallback local'})`);

// ---------------------------------------------------------------------------
// Validações específicas (todas NEGATIVAS)
// ---------------------------------------------------------------------------
await rejects(brandService.create(GESTOR, { nome: 'Marca longa', abreviacao: 'ABCDEFG' }), 'REGISTRY_INVALID', 'abreviação > 6');
await rejects(breedService.create(GESTOR, { nome: 'Raça X', grupo: 'ALIEN' }), 'REGISTRY_INVALID', 'grupo inválido');
await rejects(breedService.create(GESTOR, { nome: 'Raça Y', ordem: 'abc' }), 'REGISTRY_INVALID', 'ordem não numérica');
await rejects(categoryService.create(GESTOR, { nome: 'Cat sexo', sexo_aplicavel: 'X' }), 'REGISTRY_INVALID', 'sexo_aplicavel inválido');
await rejects(categoryService.create(GESTOR, { nome: 'Cat faixa', sexo_aplicavel: 'F', idade_min_meses: 30, idade_max_meses: 12 }), 'REGISTRY_INVALID', 'faixa etária incoerente (min > max)');
await rejects(categoryService.create(GESTOR, { nome: 'Cat negativa', sexo_aplicavel: 'F', idade_min_meses: -1 }), 'REGISTRY_INVALID', 'idade negativa');
const catOk = await categoryService.create(GESTOR, { nome: 'Cat coerente', sexo_aplicavel: 'AMBOS', idade_min_meses: '12', idade_max_meses: '24' });
assert.equal(catOk.idade_min_meses, 12, 'numero vindo como string é coagido');
await rejects(categoryService.update(GESTOR, catOk.id, { idade_min_meses: 40 }), 'REGISTRY_INVALID', 'update com faixa incoerente');
await categoryService.remove(GESTOR, catOk.id);
await rejects(partnerService.create(GESTOR, { nome: 'Parceiro sem papel', papeis: [] }), 'REGISTRY_INVALID', 'papéis vazios');
await rejects(partnerService.create(GESTOR, { nome: 'Parceiro sem papel 2' }), 'REGISTRY_INVALID', 'papéis ausentes');
await rejects(partnerService.create(GESTOR, { nome: 'Parceiro papel errado', papeis: ['COMPRADOR', 'FORNECEDOR'] }), 'REGISTRY_INVALID', 'papel inválido');
await rejects(partnerService.create(GESTOR, { nome: 'Parceiro UF', papeis: ['VENDEDOR'], uf: 'XX' }), 'REGISTRY_INVALID', 'UF inválida');
await rejects(partnerService.create(GESTOR, { nome: 'Parceiro rendimento', papeis: ['FRIGORIFICO'], rendimento_padrao: 150 }), 'REGISTRY_INVALID', 'rendimento fora de 0-100');
const frig = await partnerService.get(casos[3].id);
assert.equal(frig.rendimento_padrao, null, 'sem rendimento informado não existe valor oculto');
assert.equal(frig.documento, '12345678000190', 'documento guardado só com dígitos');
// NEGATIVO: documento duplicado (formatado diferente)
await rejects(partnerService.create(GESTOR, { nome: 'Outro nome', papeis: ['COMPRADOR'], documento: '12345678000190' }), 'REGISTRY_DUPLICATE', 'documento duplicado');
await rejects(partnerService.create(GESTOR, { nome: 'Outro nome 2', papeis: ['COMPRADOR'], documento: '12.345.678/0001-90' }), 'REGISTRY_DUPLICATE', 'documento duplicado formatado');
const semDoc1 = await partnerService.create(GESTOR, { nome: 'Sem documento 1', papeis: ['COMPRADOR'] });
const semDoc2 = await partnerService.create(GESTOR, { nome: 'Sem documento 2', papeis: ['COMPRADOR'], documento: '' });
assert.equal(semDoc2.documento, null, 'documento vazio vira null e não colide');
await partnerService.remove(GESTOR, semDoc1.id);
await partnerService.remove(GESTOR, semDoc2.id);
await rejects(propertyService.create(GESTOR, { nome: 'Propriedade tipo', tipo: 'ALUGADA' }), 'REGISTRY_INVALID', 'tipo de propriedade inválido');
await rejects(deathCauseService.create(GESTOR, { nome: 'Causa cat', categoria: 'Inexistente' }), 'REGISTRY_INVALID', 'categoria de causa inválida');
ok('validacoes-negativas');

// ---------------------------------------------------------------------------
// Padrão único (marcas, raças, propriedades); cadastros sem padrão recusam.
// ---------------------------------------------------------------------------
for (const service of [brandService, breedService, propertyService]) {
  const a = await service.create(GESTOR, { nome: `${service.store} padrão A`, papeis: undefined, padrao: true });
  assert.equal(a.padrao, true);
  const b = await service.create(GESTOR, { nome: `${service.store} padrão B`, padrao: true });
  assert.equal(b.padrao, true);
  let padroes = (await service.list()).filter((r) => r.padrao === true);
  assert.equal(padroes.length, 1, `${service.store}: create com padrao desmarca o anterior`);
  assert.equal(padroes[0].id, b.id);
  await service.setDefault(GESTOR, a.id);
  padroes = (await service.list()).filter((r) => r.padrao === true);
  assert.deepEqual(padroes.map((r) => r.id), [a.id], `${service.store}: setDefault único`);
  assert.equal((await service.getDefault()).id, a.id, `${service.store}: getDefault`);
  await service.update(GESTOR, b.id, { padrao: true });
  padroes = (await service.list()).filter((r) => r.padrao === true);
  assert.deepEqual(padroes.map((r) => r.id), [b.id], `${service.store}: update padrao=true desmarca o outro`);
  await service.deactivate(GESTOR, b.id);
  assert.equal(await service.getDefault(), null, `${service.store}: inativar o padrão limpa o padrão`);
  // NEGATIVO: inativo não pode ser padrão
  await rejects(service.setDefault(GESTOR, b.id), 'REGISTRY_INVALID', `${service.store}: inativo não vira padrão`);
  await service.activate(GESTOR, b.id);
  await service.remove(GESTOR, a.id);
  await service.remove(GESTOR, b.id);
}
// NEGATIVO: cadastros sem padrão
for (const service of [categoryService, partnerService, deathCauseService]) {
  await rejects(service.setDefault(GESTOR, casos.find((c) => c.service === service).id), 'REGISTRY_UNSUPPORTED', `${service.store}: não tem padrão`);
}
ok('padrao-unico');

// ---------------------------------------------------------------------------
// Vínculo: remover com uso falha (REGISTRY_IN_USE com contagem); inativar é o caminho.
// ---------------------------------------------------------------------------
const [marca, raca, categoria, parceiro, propriedade, causa] = casos.map((c) => c.id);
const ts = new Date().toISOString();
await db.table('animais').add({
  id: 'animal-vinculo', empresa_id: 'local', identificacao_normalizada: '1::FBV', situacao: 'ATIVO',
  marca_id: marca, raca_id: raca, categoria_id: categoria, propriedade_id: propriedade,
  created_at: ts, updated_at: ts, deleted_at: null,
});
await db.table('animais').add({
  id: 'animal-legado', empresa_id: 'local', identificacao_normalizada: '2::FBV', situacao: 'Ativo',
  marca_id: marca, raca_id: null, categoria_id: null, propriedade_id: null,
  created_at: ts, updated_at: ts, deleted_at: null,
});
await db.table('pesagens').add({
  id: 'pesagem-morte', data_pesagem: '2026-09-01', animal_id: 'animal-vinculo', tipo_pesagem: 'Saída', peso_kg: null,
  legacy_payload: { tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'acidente no  CURRAL' },
  created_at: ts, updated_at: ts, deleted_at: null,
});
await db.table('pesagens').add({
  id: 'pesagem-abate', data_pesagem: '2026-09-02', animal_id: 'animal-legado', tipo_pesagem: 'Saída', peso_kg: 480,
  legacy_payload: { tipo_manejo: 'Saída', motivo_saida: 'Abate', frigorifico: 'Frigorífico Boi Gordo' },
  created_at: ts, updated_at: ts, deleted_at: null,
});
await db.table('embarques').add({ id: 'embarque-vinculo', data: '2026-09-02', status: 'PLANEJADO', parceiro_id: parceiro, created_at: ts, updated_at: ts, deleted_at: null });

const vinculos = [
  [brandService, marca, 2],
  [breedService, raca, 1],
  [categoryService, categoria, 1],
  [propertyService, propriedade, 1],
  [partnerService, parceiro, 2],
  [deathCauseService, causa, 1],
];
for (const [service, id, esperado] of vinculos) {
  assert.equal(await service.countUsage(id), esperado, `${service.store}: countUsage`);
  await assert.rejects(service.remove(GESTOR, id), (err) => {
    assert.equal(err.code, 'REGISTRY_IN_USE', `${service.store}: remove com vínculo`);
    assert.equal(err.details.uso, esperado, `${service.store}: erro traz a contagem`);
    assert.match(err.message, /inative/i, `${service.store}: mensagem orienta a inativar`);
    return true;
  });
  assert.ok(await service.get(id), `${service.store}: registro em uso continua existindo`);
  const inativado = await service.deactivate(GESTOR, id);
  assert.equal(inativado.ativo, false, `${service.store}: inativar com vínculo é permitido`);
  await service.activate(GESTOR, id);
}
// Vínculo desfeito → exclusão passa (animal deixou de ser ativo; evento excluído logicamente).
await db.table('animais').where('id').equals('animal-vinculo').modify({ situacao: 'VENDIDO' });
await db.table('animais').where('id').equals('animal-legado').modify({ deleted_at: ts });
await db.table('pesagens').where('id').equals('pesagem-morte').modify({ deleted_at: ts });
assert.equal(await brandService.countUsage(marca), 0, 'animal vendido/excluído não conta como vínculo');
assert.equal(await deathCauseService.countUsage(causa), 0, 'evento excluído não conta');
assert.equal(await partnerService.countUsage(parceiro), 2, 'embarque + evento de abate ainda contam');
assert.equal(await breedService.remove(GESTOR, raca), true, 'remove após desfazer vínculo');
await breedService.create(GESTOR, casos[1].dados); // repõe a raça para o resolver
ok('vinculo-in-use');

// ---------------------------------------------------------------------------
// Seeds idempotentes
// ---------------------------------------------------------------------------
await deleteDbForTests();
db = await ensureStorageReady();
const seed1 = await ensureSeeds('local');
assert.deepEqual(seed1, { categoriasAnimal: 7, racas: 1, propriedades: 1 }, 'primeira execução semeia tudo');
const seed2 = await ensureSeeds('local');
assert.deepEqual(seed2, { categoriasAnimal: 0, racas: 0, propriedades: 0 }, 'segunda execução não cria nada');
const categorias = await categoryService.list();
assert.deepEqual(categorias.map((c) => c.nome), ['Bezerro', 'Bezerra', 'Garrote', 'Novilha', 'Boi', 'Vaca', 'Touro'], 'categorias padrão na ordem');
assert.ok(categorias.every((c) => c.id && c.id.length >= 32), 'ids gerados, nunca fixos');
assert.ok(categorias.every((c) => c.idade_min_meses == null || c.idade_max_meses == null || c.idade_min_meses <= c.idade_max_meses), 'faixas coerentes');
const nelore = await breedService.resolveByName('nelore');
assert.equal(nelore?.padrao, true, 'Nelore é a raça padrão');
const propPadrao = await propertyService.getDefault();
assert.equal(propPadrao?.tipo, 'PROPRIA', 'propriedade padrão PROPRIA');
// renomear a propriedade padrão e reexecutar não recria "Propriedade principal"
await propertyService.update(GESTOR, propPadrao.id, { nome: 'Fazenda Real' });
const seed3 = await ensureSeeds('local');
assert.equal(seed3.propriedades, 0, 'propriedade renomeada não é recriada');
// excluir uma categoria de propósito e reexecutar não a recria
await categoryService.remove(GESTOR, categorias[6].id);
const seed4 = await ensureSeeds('local');
assert.equal(seed4.categoriasAnimal, 0, 'categoria excluída de propósito não volta');
assert.equal((await db.table('categoriasAnimal').count()), 7, 'sem linhas duplicadas');
ok('seeds-idempotentes');

// ---------------------------------------------------------------------------
// Resolvedor por nome normalizado + ponte legada do Lançamento
// ---------------------------------------------------------------------------
const marcaR = await brandService.create(GESTOR, { nome: 'ABC' });
const marcaInativa = await brandService.create(GESTOR, { nome: 'Antiga' });
await brandService.deactivate(GESTOR, marcaInativa.id);
const comprador = await partnerService.create(GESTOR, { nome: 'João Comprador', papeis: ['COMPRADOR'] });
const vendedor = await partnerService.create(GESTOR, { nome: 'Maria Vendedora', papeis: ['VENDEDOR', 'PROPRIETARIO'] });
const frigorifico = await partnerService.create(GESTOR, { nome: 'Frigo Sul', papeis: ['FRIGORIFICO'], registro_sif: 'SIF 42' });
const inativoParceiro = await partnerService.create(GESTOR, { nome: 'Comprador Antigo', papeis: ['COMPRADOR'] });
await partnerService.deactivate(GESTOR, inativoParceiro.id);
await propertyService.create(GESTOR, { nome: 'Fazenda da Maria', tipo: 'TERCEIRO', parceiro_id: vendedor.id });
const causaR = await deathCauseService.create(GESTOR, { nome: 'Raio', categoria: 'Acidente' });

const resolvido = await resolveMany({
  marcas: ['abc', ' ABC ', 'antiga', 'zzz', '', null],
  racas: ['NELORE', 'Angus'],
  categorias: ['boi', 'Cavalo'],
  parceiros: ['joão  comprador', 'Ninguém'],
  propriedades: ['fazenda real'],
  causas: ['raio', '???'],
});
assert.equal(resolvido.marcas['abc'], marcaR.id, 'resolve minúsculo');
assert.equal(resolvido.marcas[' ABC '], marcaR.id, 'resolve com espaços');
assert.equal(resolvido.marcas['antiga'], marcaInativa.id, 'inativo resolve (histórico)');
assert.deepEqual(resolvido.desconhecidos.marcas, ['zzz'], 'desconhecido listado; vazios ignorados');
assert.equal(resolvido.racas['NELORE'], nelore.id);
assert.deepEqual(resolvido.desconhecidos.racas, ['Angus']);
assert.equal(resolvido.categorias['boi'], categorias[4].id);
assert.deepEqual(resolvido.desconhecidos.categorias, ['Cavalo']);
assert.equal(resolvido.parceiros['joão  comprador'], comprador.id);
assert.deepEqual(resolvido.desconhecidos.parceiros, ['Ninguém']);
assert.equal(resolvido.propriedades['fazenda real'], propPadrao.id);
assert.equal(resolvido.causas['raio'], causaR.id);
assert.deepEqual(resolvido.desconhecidos.causas, ['???']);
assert.equal(resolvido.totalDesconhecidos, 5);
// NEGATIVO: excluído não resolve
await brandService.remove(GESTOR, marcaInativa.id);
const aposExclusao = await resolveMany({ marcas: ['antiga'] });
assert.deepEqual(aposExclusao.desconhecidos.marcas, ['antiga'], 'excluído não resolve');
// parte pura: prefere o ativo quando há homônimo inativo
const puro = resolveNamesAgainst([
  { id: 'i', nome_normalizado: 'X', ativo: false },
  { id: 'a', nome_normalizado: 'X', ativo: true },
  { id: 'd', nome_normalizado: 'Y', deleted_at: ts },
], ['x', 'y', 'y']);
assert.deepEqual(puro, { ids: { x: 'a' }, desconhecidos: ['y'] }, 'prefere ativo; desconhecidos sem repetição');

const legado = await loadAuxiliaryCatalogs('local');
assert.deepEqual(Object.keys(legado).sort(), ['causasMorte', 'compradores', 'frigorificos', 'vendedores'], 'shape do Lançamento');
assert.deepEqual(legado.compradores.map((i) => [i.nome, i.ativo]), [['Comprador Antigo', false], ['João Comprador', true]], 'compradores por papel, inativos incluídos');
assert.equal(legado.vendedores[0].nome, 'Maria Vendedora');
assert.equal(legado.vendedores[0].propriedade, 'Fazenda da Maria', 'vendedor traz a propriedade ligada');
assert.equal(legado.frigorificos[0].sif, 'SIF 42', 'frigorífico traz sif');
assert.ok(legado.causasMorte.some((c) => c.nome === 'Raio' && c.ativo === true && c.exigeObservacao === false), 'causas com shape legado');
assert.ok(legado.compradores.every((i) => 'id' in i && 'nome' in i && 'ativo' in i));
ok('resolver-e-ponte-legada');

// registryService legado não pode voltar
assert.equal(existsSync(join(root, 'src/modules/auxiliary/application/registryService.js')), false, 'registryService legado removido');

await deleteDbForTests();
console.log('OK verify-master-registry');
console.log(JSON.stringify(resumo, null, 2));
