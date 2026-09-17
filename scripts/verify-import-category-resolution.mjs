// Gate import:category-resolution:verify — categoria do Cadastro importado (missão §29).
// Faixas: Bezerro 0–199, Garrote 200–349, Boi 350+ (macho). AUTOMATICA vale só no Cadastro
// (tipo Cadastros e primeiro evento do Histórico): Cadastro 250 → Garrote. Faixa ambígua, sem faixa,
// sem sexo ou sem peso → não resolvida, com mensagem, sem escolha silenciosa. Depois, Manejo 380:
// animal automático é reclassificado para Boi pela projeção (regra vigente, igual ao Lançamento);
// animal com categoria manual permanece. PLANILHA resolve pelo nome e FIXA pelo id, respeitando o
// sexo. Negativos: categoria não cadastrada, sexo incompatível, categoria fixa ausente.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { brandService, categoryService } from '../src/modules/catalog/application/registryServices.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { ROW_STATUS, analyzeImport, applyImport } from '../src/modules/import/application/importService.js';
import { resolveAutomaticCategory } from '../src/modules/import/domain/importCategory.js';

const csv = (...lines) => lines.join('\r\n');

async function base({ overlapping = false } = {}) {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const marca = await brandService.create(null, { nome: 'ABC' });
  const cats = {
    bezerro: await categoryService.create(null, { nome: 'Bezerro', sexo_aplicavel: 'M', peso_min_kg: 0, peso_max_kg: 199, era: 12, ordem: 1 }),
    garrote: await categoryService.create(null, { nome: 'Garrote', sexo_aplicavel: 'M', peso_min_kg: 200, peso_max_kg: 349, era: 24, ordem: 2 }),
    boi: await categoryService.create(null, { nome: 'Boi', sexo_aplicavel: 'M', peso_min_kg: 350, era: 36, ordem: 3 }),
    vaca: await categoryService.create(null, { nome: 'Vaca', sexo_aplicavel: 'F', ordem: 4 }),
  };
  if (overlapping) cats.garrotePesado = await categoryService.create(null, { nome: 'Garrote pesado', sexo_aplicavel: 'M', peso_min_kg: 300, peso_max_kg: 400, ordem: 5 });
  return { db, marca, cats };
}
const animalOf = async (db, numero) => (await db.table('animais').toArray()).find((row) => row.numero_animal === numero);
const eventsOf = async (db, animalId) => (await db.table('pesagens').where('animal_id').equals(animalId).toArray()).sort((l, r) => l.data_pesagem.localeCompare(r.data_pesagem));
const importPlan = async (text, type, rules) => {
  const plan = await analyzeImport({ text, type, rules });
  assert.equal(plan.blocking, false, JSON.stringify(plan.rows.map((row) => [row.line, row.status, row.messages])));
  return { plan, result: await applyImport(plan) };
};

// 1. Função pura estrita.
{
  const { cats } = await base({ overlapping: true });
  const categorias = Object.values(cats);
  assert.equal(resolveAutomaticCategory({ categorias, sexo: 'M', peso: 250 }).categoria.nome, 'Garrote');
  assert.equal(resolveAutomaticCategory({ categorias, sexo: 'M', peso: 320 }).reason, 'AMBIGUA', 'NEGATIVO: duas faixas contêm 320');
  assert.equal(resolveAutomaticCategory({ categorias, sexo: 'M', peso: 500 }).categoria.nome, 'Boi');
  assert.equal(resolveAutomaticCategory({ categorias, sexo: 'F', peso: 300 }).reason, 'SEM_FAIXA', 'categoria sem faixa não entra na escolha automática');
  assert.equal(resolveAutomaticCategory({ categorias, sexo: 'M', peso: null }).reason, 'SEM_PESO');
  assert.equal(resolveAutomaticCategory({ categorias, sexo: null, peso: 250 }).reason, 'SEM_SEXO');
}

// 2. CADASTROS automático: resolvida, ambígua, sem faixa, sem sexo.
{
  const { db, cats } = await base({ overlapping: true });
  const file = csv('Brinco;Marca;Sexo;Data;Peso', '1;ABC;M;05/01/2026;250', '2;ABC;M;05/01/2026;320', '3;ABC;F;05/01/2026;300', '4;ABC;;05/01/2026;250');
  const { plan, result } = await importPlan(file, 'CADASTROS', { categoryMode: 'AUTOMATICA' });
  const rows = plan.rows;
  assert.deepEqual(rows.map((row) => row.status), Array(4).fill(ROW_STATUS.NOVO), 'categoria não resolvida não bloqueia');
  assert.deepEqual(rows[0].categoria, { id: cats.garrote.id, nome: 'Garrote', origem: 'AUTOMATICA' }, 'Cadastro 250 → Garrote');
  assert.deepEqual(rows[1].categoria, { id: null, nome: null, origem: 'AUTOMATICA' });
  assert.equal(rows[1].messages[0], 'Categoria automática não resolvida: mais de uma faixa contém 320 kg (Garrote, Garrote pesado). Ajuste as faixas ou escolha a categoria.');
  assert.equal(rows[2].messages[0], 'Categoria automática não resolvida: nenhuma faixa de peso do sexo F contém 300 kg.');
  assert.equal(rows[3].messages[0], 'Categoria automática não resolvida: informe o sexo do animal.');
  assert.equal(plan.summary.categoriasAutomaticasResolvidas, 1);
  assert.equal(plan.summary.categoriasNaoResolvidas, 3);
  assert.equal(result.categoriasResolvidasAutomaticamente, 1);
  const a1 = await animalOf(db, '1');
  assert.equal(a1.categoria_id, cats.garrote.id);
  assert.equal(a1.categoria_automatica, true);
  assert.equal(a1.era, '24', 'era da categoria');
  const e1 = (await eventsOf(db, a1.id))[0];
  assert.equal(e1.legacy_payload.categoria_id, cats.garrote.id, 'evento carimbado');
  assert.equal(e1.legacy_payload.categoria_automatica, true);
  const a2 = await animalOf(db, '2');
  assert.equal(a2.categoria_id, null, 'NEGATIVO: faixa ambígua não escolhe em silêncio (nem pela projeção)');
  assert.equal(a2.categoria_automatica, false, 'ambígua nasce manual e vazia');
  assert.equal((await eventsOf(db, a2.id))[0].legacy_payload.categoria_id, null);
  const a3 = await animalOf(db, '3');
  assert.equal(a3.categoria_id, null);
  assert.equal(a3.categoria_automatica, true, 'sem faixa segue automático para os próximos pesos');
}

// 3. Manejo 380 depois: automático → Boi pela projeção; manual permanece.
{
  const { db, cats } = await base();
  await importPlan(csv('Brinco;Marca;Sexo;Data;Peso', '10;ABC;M;05/01/2026;250'), 'CADASTROS', { categoryMode: 'AUTOMATICA' });
  await importPlan(csv('Brinco;Marca;Sexo;Data;Peso;Categoria', '11;ABC;M;05/01/2026;250;garrote'), 'CADASTROS', { categoryMode: 'PLANILHA' });
  await importPlan(csv('Brinco;Marca;Sexo;Data;Peso', '12;ABC;M;05/01/2026;250'), 'CADASTROS', { categoryMode: 'FIXA', fixedValues: { categoria_id: cats.garrote.id } });
  for (const numero of ['10', '11', '12']) assert.equal((await animalOf(db, numero)).categoria_id, cats.garrote.id, `${numero}: Garrote no Cadastro`);
  assert.equal((await animalOf(db, '11')).categoria_automatica, false, 'PLANILHA = manual');
  assert.equal((await animalOf(db, '12')).categoria_automatica, false, 'FIXA = manual');
  const { plan } = await importPlan(csv('Brinco;Marca;Data;Peso;Categoria', '10;ABC;05/03/2026;380;Bezerro', '11;ABC;05/03/2026;380;', '12;ABC;05/03/2026;380;'), 'MANEJOS');
  assert.equal(plan.summary.categoriasAutomaticasResolvidas, 0, 'AUTOMATICA não se aplica a Manejos');
  const a10 = await animalOf(db, '10');
  assert.equal(a10.categoria_id, cats.boi.id, 'automático reclassificado para Boi');
  assert.equal(a10.era, '36');
  assert.equal((await eventsOf(db, a10.id))[1].legacy_payload.categoria_id, cats.boi.id, 'Manejo carimbado como no Lançamento');
  const a11 = await animalOf(db, '11');
  assert.equal(a11.categoria_id, cats.garrote.id, 'NEGATIVO: manual (PLANILHA) nunca muda');
  assert.equal((await animalOf(db, '12')).categoria_id, cats.garrote.id, 'NEGATIVO: manual (FIXA) nunca muda');
  assert.equal((await eventsOf(db, a11.id))[1].legacy_payload.categoria_id ?? null, null, 'coluna Categoria do Manejo é ignorada');

  // Paridade com o Lançamento: a mesma série pelo createEntry dá as mesmas categorias.
  const marca = await brandService.resolveByName('ABC');
  const cadastro = await weighingService.createEntry({ empresa_id: 'local', tipo_manejo: 'Cadastro', numero_animal: '90', marca: 'ABC', marca_id: marca.id, sexo: 'M', data_pesagem: '2026-01-05', peso: 250, categoria_automatica: true });
  await weighingService.createEntry({ empresa_id: 'local', tipo_manejo: 'Manejo', animal_id: cadastro.animal_id, numero_animal: '90', marca: 'ABC', data_pesagem: '2026-03-05', peso: 380 });
  const launched = await eventsOf(db, cadastro.animal_id);
  const imported = await eventsOf(db, a10.id);
  assert.deepEqual(imported.map((row) => [row.legacy_payload.categoria_id, row.legacy_payload.era ?? null]), launched.map((row) => [row.legacy_payload.categoria_id, row.legacy_payload.era ?? null]), 'paridade de categoria/era por evento');
  assert.equal((await animalOf(db, '90')).categoria_id, a10.categoria_id, 'paridade da projeção do animal');
}

// 4. Histórico: automático só no primeiro evento; Manejos seguem a regra vigente.
{
  const { db, cats } = await base();
  const { plan } = await importPlan(csv('Brinco;Marca;Sexo;Data;Peso', '20;ABC;M;01/03/2026;380', '20;ABC;M;01/01/2026;180', '20;ABC;M;01/02/2026;260'), 'HISTORICO', { categoryMode: 'AUTOMATICA' });
  const cadastro = plan.rows.find((row) => row.eventType === 'Cadastro');
  assert.equal(cadastro.line, 3);
  assert.equal(cadastro.categoria.nome, 'Bezerro');
  assert.equal(plan.summary.categoriasAutomaticasResolvidas, 1, 'só o Cadastro resolve categoria na importação');
  assert.deepEqual(plan.rows.filter((row) => row.eventType === 'Manejo').map((row) => row.categoria.origem), [null, null]);
  const a20 = await animalOf(db, '20');
  assert.deepEqual((await eventsOf(db, a20.id)).map((row) => row.legacy_payload.categoria_id), [cats.bezerro.id, cats.garrote.id, cats.boi.id]);
  assert.equal(a20.categoria_id, cats.boi.id);
}

// 5. PLANILHA e FIXA: negativos.
{
  const { cats } = await base();
  const sheet = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso;Categoria', '30;ABC;M;05/01/2026;250;Novilho', '31;ABC;M;05/01/2026;250;Vaca', '32;ABC;M;05/01/2026;250;', '33;ABC;M;05/01/2026;250;BOI'), type: 'CADASTROS', rules: { categoryMode: 'PLANILHA' } });
  assert.deepEqual(sheet.rows.map((row) => row.status), [ROW_STATUS.ERRO, ROW_STATUS.ERRO, ROW_STATUS.NOVO, ROW_STATUS.NOVO]);
  assert.equal(sheet.rows[0].messages[0], 'Categoria "Novilho" não cadastrada.', 'NEGATIVO: categoria desconhecida');
  assert.deepEqual(sheet.summary.cadastrosMestresAusentes, [{ store: 'categoriasAnimal', rotulo: 'Categoria', nome: 'Novilho', linhas: [2] }]);
  assert.equal(sheet.rows[1].messages[0], 'A categoria "Vaca" não se aplica ao sexo M.', 'NEGATIVO: sexo incompatível');
  assert.equal(sheet.rows[2].messages[0], 'Categoria não informada na planilha: o animal fica sem categoria.');
  assert.deepEqual(sheet.rows[3].categoria, { id: cats.boi.id, nome: 'Boi', origem: 'PLANILHA' }, 'nome resolvido sem caixa');
  const withCreate = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso;Categoria', '30;ABC;M;05/01/2026;250;Novilho'), type: 'CADASTROS', rules: { categoryMode: 'PLANILHA', createMissingMasters: true } });
  assert.equal(withCreate.rows[0].status, ROW_STATUS.ERRO, 'NEGATIVO: categoria nunca é criada pela importação de eventos (faixa/sexo/ordem)');
  const fixedMissing = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '34;ABC;M;05/01/2026;250'), type: 'CADASTROS', rules: { categoryMode: 'FIXA' } });
  assert.equal(fixedMissing.rows[0].messages[0], 'Categoria fixa não informada ou inexistente.', 'NEGATIVO: FIXA sem id');
  const fixedWrongSex = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '35;ABC;M;05/01/2026;250'), type: 'CADASTROS', rules: { categoryMode: 'FIXA', fixedValues: { categoria_id: cats.vaca.id } } });
  assert.equal(fixedWrongSex.rows[0].status, ROW_STATUS.ERRO, 'NEGATIVO: FIXA com sexo incompatível');
  const byId = await analyzeImport({ text: csv('numero;marca;sexo;data;peso;categoria_id', `36;ABC;M;2026-01-05;250;${cats.garrote.id}`), type: 'CADASTROS', rules: { categoryMode: 'PLANILHA' } });
  assert.equal(byId.rows[0].categoria.id, cats.garrote.id, 'categoria_id do CSV técnico');
}

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:category-resolution:verify',
  ok: true,
  ranges: { Bezerro: '0–199', Garrote: '200–349', Boi: '350+' },
  cases: ['Cadastro 250 → Garrote', 'ambígua/sem faixa/sem sexo/sem peso não resolvidas', 'Manejo 380: automático → Boi, manual permanece', 'histórico: automático só no Cadastro', 'paridade com o Lançamento', 'PLANILHA e FIXA'],
  negativeTests: ['faixa ambígua não escolhe', 'categoria desconhecida', 'sexo incompatível', 'FIXA sem id', 'categoria não é criada por eventos'],
}, null, 2));
