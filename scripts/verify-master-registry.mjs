// Gate dos cadastros mestres (ADR-018, docs 12 §3.1; contrato rev. 2): unicidade
// normalizada, referências, padrão só em ativo, vínculo HISTÓRICO bloqueia a
// exclusão, resolução por nome, permissão pela sessão (ADR-042/046), auditoria
// com usuario_id/usuario_nome_snapshot, seeds idempotentes (fonte única em
// domain/seeds.js) e resolvedor. Cada regra tem o caso negativo.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { PARCEIRO_PAPEIS } from '../src/storage/indexedDb/schema.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import {
  INACTIVE_DEFAULT_MESSAGE,
  REGISTRY_DEFINITIONS,
  brandService,
  breedService,
  categoryService,
  deathCauseService,
  ensureSeeds,
  getRegistryService,
  partnerService,
  propertyService,
  resolveMany,
  resolveNamesAgainst,
} from '../src/modules/catalog/application/index.js';
import * as registryServices from '../src/modules/catalog/application/registryServices.js';
import { normalizeDocument, normalizeName } from '../src/modules/catalog/domain/normalize.js';
import * as domainResolver from '../src/modules/catalog/domain/catalogResolver.js';
import * as applicationResolver from '../src/modules/catalog/application/catalogResolver.js';
import { CATEGORIAS_SEED, PROPRIEDADE_PADRAO_SEED, RACA_PADRAO_SEED, applySeeds, ensureSeeds as ensureSeedsFromDomain } from '../src/modules/catalog/domain/seeds.js';
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
// Um módulo por responsabilidade: o índice reexporta as MESMAS instâncias e funções.
assert.equal(brandService, registryServices.brandService, 'índice reexporta a instância única de registryServices.js');
assert.equal(getRegistryService, registryServices.getRegistryService);
assert.equal(resolveMany, applicationResolver.resolveMany, 'resolveMany vive em application/catalogResolver.js');
assert.equal(resolveNamesAgainst, domainResolver.resolveNamesAgainst, 'parte pura vive em domain/catalogResolver.js');
assert.equal(typeof domainResolver.buildNameIndex, 'function');
assert.ok(!('resolveMany' in domainResolver), 'domínio não conhece serviços (sem resolveMany)');
assert.equal(ensureSeeds, ensureSeedsFromDomain, 'ensureSeeds é o de domain/seeds.js (fonte única do backfill)');
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
  assert.ok(trilha.every((a) => a.usuario_id === GESTOR.id && a.usuario_nome_snapshot === GESTOR.nome), `${store}: auditoria com usuario_id/usuario_nome_snapshot (rev. 2)`);
  assert.ok(trilha.every((a) => !('actor_user_id' in a) && !('actor_user_profile' in a)), `${store}: sem campos actor_user_* (rev. 1)`);
  const alteracao = trilha.find((a) => a.acao === 'ATUALIZAR' && a.campos_alterados.includes(Object.keys(caso.patch)[0]));
  assert.ok(alteracao, `${store}: campos_alterados registrados`);
  // CRIAR: resumo + campos, sem `depois` completo; CANCELAR: `antes` só com id/nome (ADR-046).
  const criar = trilha.find((a) => a.acao === 'CRIAR' && a.entidade_id === created.id);
  assert.ok(criar && !('depois' in criar) && criar.campos_alterados.includes('nome'), `${store}: CRIAR sem depois completo, com campos`);
  assert.match(criar.resumo, /^Criou .*"/, `${store}: CRIAR com resumo`);
  const cancelar = trilha.find((a) => a.acao === 'CANCELAR' && a.entidade_id === outro.id);
  assert.deepEqual(cancelar.antes, { id: outro.id, nome: outro.nome }, `${store}: CANCELAR guarda antes só com o essencial`);

  resumo.cadastros[store] = { crud: true, duplicado: true, auditoria: trilha.length };
  caso.id = created.id;
}
ok('crud-por-cadastro');

// ---------------------------------------------------------------------------
// Permissão (ADR-042/046): OPERADOR/CONSULTA recusados com AUTH_FORBIDDEN; papel da
// sessão quando o chamador não informa; só sem sessão E sem ator é liberado.
// ---------------------------------------------------------------------------
const FORBIDDEN = /^AUTH_FORBIDDEN$/;
await rejects(brandService.create({ id: 'u-consulta', perfil: 'CONSULTA' }, { nome: 'Marca da consulta' }), FORBIDDEN, 'CONSULTA não cria');
await rejects(brandService.create({ id: 'u-sem-papel' }, { nome: 'Marca sem papel' }), FORBIDDEN, 'ator identificado sem papel é recusado');
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
assert.equal(auditSemAtor.usuario_id, null, 'auditoria sem sessão fica com ator nulo');
assert.equal(auditSemAtor.usuario_nome_snapshot, null);
await breedService.remove(GESTOR, semAtor.id);
await breedService.remove(GESTOR, admin.id);
// Sessão OPERADOR sem ator na chamada → recusado; sessão GESTOR → permitido e auditado com a sessão.
setActorProvider(() => ({ id: 'u-sessao-op', nome: 'Operador Sessão', role: 'OPERADOR' }));
await rejects(brandService.create(null, { nome: 'Marca sessão operador' }), FORBIDDEN, 'papel da sessão (OPERADOR) recusa sem ator explícito');
setActorProvider(() => ({ id: 'u-sessao-gestor', nome: 'Gestora Sessão', role: 'GESTOR' }));
const porSessao = await breedService.create(null, { nome: 'Por sessão' });
const auditSessao = await db.table('auditoria').where('entidade_id').equals(porSessao.id).first();
assert.equal(auditSessao.usuario_id, 'u-sessao-gestor', 'auditoria usa o usuário da sessão');
assert.equal(auditSessao.usuario_nome_snapshot, 'Gestora Sessão');
const porSessaoComAtor = await breedService.create(GESTOR, { nome: 'Por sessão com ator' });
const auditSessao2 = await db.table('auditoria').where('entidade_id').equals(porSessaoComAtor.id).first();
assert.equal(auditSessao2.usuario_id, 'u-sessao-gestor', 'com sessão, a auditoria grava a sessão (ator da chamada é só fallback)');
setActorProvider(null);
await breedService.remove(GESTOR, porSessao.id);
await breedService.remove(GESTOR, porSessaoComAtor.id);
assert.ok(existsSync(join(root, 'src/modules/auth/domain/accessPolicy.js')), 'fachada accessPolicy.js presente (assertCan)');
ok('permissao');

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
  const inativadoPadrao = await service.deactivate(GESTOR, b.id);
  assert.equal(await service.getDefault(), null, `${service.store}: inativar o padrão limpa o padrão`);
  assert.equal(inativadoPadrao.padrao, false);
  assert.match(inativadoPadrao.aviso ?? '', /deixou de ser o padrão/, `${service.store}: inativar o padrão avisa`);
  assert.ok(!('aviso' in (await service.get(b.id))), `${service.store}: aviso não é persistido`);
  const semAviso = await service.deactivate(GESTOR, a.id);
  assert.ok(!('aviso' in semAviso), `${service.store}: inativar quem não é padrão não avisa`);
  await service.activate(GESTOR, a.id);
  // NEGATIVO: inativo não pode ser padrão (setDefault, update, create)
  await rejects(service.setDefault(GESTOR, b.id), 'REGISTRY_INVALID', `${service.store}: inativo não vira padrão`);
  await rejects(service.update(GESTOR, b.id, { padrao: true }), 'REGISTRY_INVALID', `${service.store}: update padrao=true em inativo`);
  await assert.rejects(service.create(GESTOR, { nome: `${service.store} inativo padrão`, ativo: false, padrao: true }), (err) => {
    assert.equal(err.code, 'REGISTRY_INVALID');
    assert.equal(err.message, INACTIVE_DEFAULT_MESSAGE, `${service.store}: mensagem do contrato`);
    return true;
  }, `${service.store}: create inativo com padrao=true`);
  await rejects(service.update(GESTOR, a.id, { ativo: false, padrao: true }), 'REGISTRY_INVALID', `${service.store}: update inativando e marcando padrão`);
  assert.equal(await service.getDefault(), null, `${service.store}: recusas não gravam padrão`);
  await service.activate(GESTOR, b.id);
  await service.setDefault(GESTOR, b.id);
  assert.equal((await service.getDefault()).id, b.id, `${service.store}: reativado pode voltar a ser padrão`);
  await service.remove(GESTOR, a.id);
  await service.remove(GESTOR, b.id);
}
// NEGATIVO: cadastros sem padrão
for (const service of [categoryService, partnerService, deathCauseService]) {
  await rejects(service.setDefault(GESTOR, casos.find((c) => c.service === service).id), 'REGISTRY_UNSUPPORTED', `${service.store}: não tem padrão`);
}
ok('padrao-unico');

// ---------------------------------------------------------------------------
// Referências: id inexistente, inativo (salvo já gravado) e papel errado são recusados.
// ---------------------------------------------------------------------------
{
  const donoOk = await partnerService.create(GESTOR, { nome: 'Dono Ok', papeis: ['PROPRIETARIO'] });
  const semPapel = await partnerService.create(GESTOR, { nome: 'Sem Papel Proprietário', papeis: ['COMPRADOR'] });
  const donoInativo = await partnerService.create(GESTOR, { nome: 'Dono Inativo', papeis: ['PROPRIETARIO'] });
  const propOk = await propertyService.create(GESTOR, { nome: 'Propriedade Ref' });
  await rejects(brandService.create(GESTOR, { nome: 'Marca ref inexistente', proprietario_parceiro_id: 'nao-existe' }), 'REGISTRY_INVALID', 'referência inexistente (parceiro)');
  await rejects(brandService.create(GESTOR, { nome: 'Marca prop inexistente', propriedade_id: 'nao-existe' }), 'REGISTRY_INVALID', 'referência inexistente (propriedade)');
  await rejects(brandService.create(GESTOR, { nome: 'Marca papel errado', proprietario_parceiro_id: semPapel.id }), 'REGISTRY_INVALID', 'parceiro sem papel PROPRIETARIO');
  await rejects(propertyService.create(GESTOR, { nome: 'Prop dono inexistente', tipo: 'TERCEIRO', parceiro_id: 'nao-existe' }), 'REGISTRY_INVALID', 'propriedade com parceiro inexistente');
  const marcaRef = await brandService.create(GESTOR, { nome: 'Marca ref ok', proprietario_parceiro_id: donoInativo.id, propriedade_id: propOk.id });
  assert.equal(marcaRef.proprietario_parceiro_id, donoInativo.id, 'referência ativa com papel certo é aceita');
  await partnerService.deactivate(GESTOR, donoInativo.id);
  await rejects(brandService.create(GESTOR, { nome: 'Marca dono inativo', proprietario_parceiro_id: donoInativo.id }), 'REGISTRY_INVALID', 'referência inativa recusada em registro novo');
  const mantida = await brandService.update(GESTOR, marcaRef.id, { abreviacao: 'MR' });
  assert.equal(mantida.proprietario_parceiro_id, donoInativo.id, 'valor já gravado (agora inativo) continua aceito no update');
  await rejects(brandService.update(GESTOR, marcaRef.id, { proprietario_parceiro_id: donoOk.id, propriedade_id: 'nao-existe' }), 'REGISTRY_INVALID', 'update com nova referência inexistente');
  const trocada = await brandService.update(GESTOR, marcaRef.id, { proprietario_parceiro_id: donoOk.id });
  assert.equal(trocada.proprietario_parceiro_id, donoOk.id, 'trocar para referência ativa passa');
  await partnerService.activate(GESTOR, donoInativo.id);
  // Excluir referenciado é bloqueado (vínculo por marca) — o caminho é inativar.
  await rejects(partnerService.remove(GESTOR, donoOk.id), 'REGISTRY_IN_USE', 'parceiro proprietário de marca não é excluído');
  await rejects(propertyService.remove(GESTOR, propOk.id), 'REGISTRY_IN_USE', 'propriedade ligada à marca não é excluída');
  await brandService.remove(GESTOR, marcaRef.id);
  for (const id of [donoOk.id, semPapel.id, donoInativo.id]) await partnerService.remove(GESTOR, id);
  await propertyService.remove(GESTOR, propOk.id);
  ok('referencias');
}

// ---------------------------------------------------------------------------
// Vínculo HISTÓRICO: remover com qualquer registro não excluído citando o cadastro
// falha (REGISTRY_IN_USE); countUsage (coluna "Em uso") conta só o uso atual;
// describeUsage informa ambos. Inativar é o caminho.
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
// Vínculos exclusivos de marca: identificador por marca, faixa (inativa) e sessão com marca padrão.
await db.table('animalIdentificadores').add({ id: 'ident-marca', animal_id: 'animal-vinculo', tipo: 'VISUAL', valor: '1', valor_normalizado: '1', marca_id: marca, ativo: true, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('animalIdentificadores').add({ id: 'ident-marca-excluido', animal_id: 'animal-vinculo', tipo: 'VISUAL', valor: '2', valor_normalizado: '2', marca_id: marca, ativo: true, created_at: ts, updated_at: ts, deleted_at: ts });
await db.table('faixasIdentificadores').add({ id: 'faixa-marca', empresa_id: 'local', tipo: 'VISUAL', marca_id: marca, situacao: 'ESGOTADA', ativo: false, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('sessoesPesagem').add({ id: 'sessao-marca', data: '2026-09-02', status: 'FECHADA', operador: 'LOCAL', marca_padrao_id: marca, created_at: ts, updated_at: ts, deleted_at: null });

// [service, id, uso atual (coluna), uso histórico (bloqueia exclusão)]
const vinculos = [
  [brandService, marca, 2, 5],
  [breedService, raca, 1, 1],
  [categoryService, categoria, 1, 1],
  [propertyService, propriedade, 1, 1],
  [partnerService, parceiro, 2, 2],
  [deathCauseService, causa, 1, 1],
];
for (const [service, id, atual, historico] of vinculos) {
  assert.equal(await service.countUsage(id), atual, `${service.store}: countUsage (uso atual)`);
  const descricao = await service.describeUsage(id);
  assert.equal(descricao.total_atual, atual, `${service.store}: describeUsage.total_atual`);
  assert.equal(descricao.total_historico, historico, `${service.store}: describeUsage.total_historico`);
  assert.ok(descricao.atual && descricao.historico, `${service.store}: describeUsage informa atual e histórico`);
  await assert.rejects(service.remove(GESTOR, id), (err) => {
    assert.equal(err.code, 'REGISTRY_IN_USE', `${service.store}: remove com vínculo`);
    assert.equal(err.details.uso, historico, `${service.store}: erro traz a contagem histórica`);
    assert.match(err.message, /inative/i, `${service.store}: mensagem orienta a inativar`);
    return true;
  });
  assert.ok(await service.get(id), `${service.store}: registro em uso continua existindo`);
  const inativado = await service.deactivate(GESTOR, id);
  assert.equal(inativado.ativo, false, `${service.store}: inativar com vínculo é permitido`);
  await service.activate(GESTOR, id);
}
assert.deepEqual((await brandService.describeUsage(marca)).historico, { animais: 2, identificadores: 1, faixas: 1, sessoes: 1 }, 'marca: histórico por origem (identificador excluído não conta)');
// Animal que deixou de ser ATIVO sai da coluna "Em uso" mas segue bloqueando a exclusão (histórico).
await db.table('animais').where('id').equals('animal-vinculo').modify({ situacao: 'VENDIDO' });
await db.table('animais').where('id').equals('animal-legado').modify({ deleted_at: ts });
await db.table('pesagens').where('id').equals('pesagem-morte').modify({ deleted_at: ts });
assert.equal(await brandService.countUsage(marca), 0, 'animal vendido/excluído não conta como uso atual');
assert.equal((await brandService.describeUsage(marca)).total_historico, 4, 'animal vendido continua no histórico da marca');
assert.equal(await breedService.countUsage(raca), 0, 'raça sem animal ativo');
await rejects(breedService.remove(GESTOR, raca), 'REGISTRY_IN_USE', 'NEGATIVO: animal VENDIDO ainda bloqueia a exclusão da raça');
await rejects(brandService.remove(GESTOR, marca), 'REGISTRY_IN_USE', 'NEGATIVO: identificador/faixa/sessão ainda bloqueiam a marca');
assert.equal(await deathCauseService.countUsage(causa), 0, 'evento excluído não conta');
assert.equal(await partnerService.countUsage(parceiro), 2, 'embarque + evento de abate ainda contam');
// Só a exclusão lógica do que cita o cadastro libera a exclusão.
await db.table('animais').where('id').equals('animal-vinculo').modify({ deleted_at: ts });
assert.equal((await breedService.describeUsage(raca)).total_historico, 0, 'animal excluído não conta no histórico');
assert.equal(await breedService.remove(GESTOR, raca), true, 'remove após excluir o vínculo');
await breedService.create(GESTOR, casos[1].dados); // repõe a raça para o resolver
ok('vinculo-historico');

// ---------------------------------------------------------------------------
// Seeds idempotentes
// ---------------------------------------------------------------------------
await deleteDbForTests();
db = await ensureStorageReady();
assert.deepEqual(CATEGORIAS_SEED.map((c) => [c.nome, c.sexo_aplicavel, c.idade_min_meses, c.idade_max_meses]), [
  ['Bezerro', 'M', 0, 12], ['Bezerra', 'F', 0, 12], ['Garrote', 'M', 13, 24], ['Novilha', 'F', 13, 36],
  ['Boi', 'M', 25, null], ['Vaca', 'F', 37, null], ['Touro', 'M', 25, null],
], 'CATEGORIAS_SEED com sexo e faixas do contrato (docs 12 §3.1)');
assert.deepEqual(RACA_PADRAO_SEED, { nome: 'Nelore', grupo: 'ZEBUINO', ordem: 1 });
assert.equal(PROPRIEDADE_PADRAO_SEED.tipo, 'PROPRIA');
assert.ok(Object.isFrozen(CATEGORIAS_SEED) && CATEGORIAS_SEED.every((c) => Object.isFrozen(c)), 'seeds imutáveis');
assert.equal(typeof applySeeds, 'function');
const seed1 = await ensureSeeds('local');
assert.deepEqual(seed1, { categoriasAnimal: 7, racas: 1, propriedades: 1 }, 'primeira execução semeia tudo');
assert.ok(CATEGORIAS_SEED.every((c) => !('id' in c)), 'seed não carrega id fixo');
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
assert.deepEqual(Object.keys(legado).sort(), ['categorias', 'causasMorte', 'compradores', 'frigorificos', 'marcas', 'racas', 'vendedores'], 'shape do Lançamento (+ seletores marcas/racas/categorias)');
assert.deepEqual(legado.marcas, [{ id: marcaR.id, nome: 'ABC', padrao: false }], 'marcas: só ativas, { id, nome, padrao } (a inativa "Antiga" foi excluída; excluída não entra)');
assert.ok(legado.racas.some((r) => r.id === nelore.id && r.padrao === true), 'racas: Nelore padrão');
assert.ok(legado.racas.every((r) => Object.keys(r).sort().join() === 'id,nome,padrao'), 'seletor enxuto');
assert.deepEqual(legado.categorias.map((c) => c.nome), (await categoryService.list()).map((c) => c.nome), 'categorias ativas na ordem do serviço');
const marcaInativaBridge = await brandService.create(GESTOR, { nome: 'Marca inativa bridge' });
await brandService.deactivate(GESTOR, marcaInativaBridge.id);
assert.ok(!(await loadAuxiliaryCatalogs('local')).marcas.some((m) => m.id === marcaInativaBridge.id), 'NEGATIVO: marca inativa não entra nos seletores');
await brandService.remove(GESTOR, marcaInativaBridge.id);
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
