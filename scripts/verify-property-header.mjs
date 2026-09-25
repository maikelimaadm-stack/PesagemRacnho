// Gate registry:property-header:verify (E1B 1.4.0) — cabeçalho dos relatórios a partir do
// cadastro da Propriedade. Confere: (a) campos novos na definição (seção 'cabecalho', logo
// tipo 'imagem', documento fora da unicidade, esquema sem mudança); (b) coerção/validação
// (logo svg/http:/texto/> 300 KB recusados, PNG pequeno aceito, documento só com dígitos, IE
// 'ISENTO' preservada); (c) redimensionamento (fitWithin e a escolha PNG → JPEG com canvas de
// teste); (d) modelo do cabeçalho (completo, sem titular, sem propriedade, documentos só com a
// opção ligada, logo inválido vira null) e o HTML da folha; (e) qual propriedade vai no
// cabeçalho (padrão × filtro por id × por nome × detalhe × vazio); (f) gravação pelo serviço
// sem o data URL na auditoria; (g) backup completo → restauração mantém o logo byte a byte;
// (h) loadReportHeader; (i) salvar de novo uma propriedade antiga sem mudança não gera
// "alteração" falsa. Cada regra tem caso negativo. O canvas real não existe em Node: o ajuste
// da imagem é exercitado com leitura e canvas de teste injetados em prepareLogoFromFile.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { DB_VERSION, STORES } from '../src/storage/indexedDb/schema.js';
import storage from '../src/storage/storageAdapter.js';
import { PARCEIROS, PROPRIEDADES, REGISTRY_DEFINITIONS, coerceRecord } from '../src/modules/catalog/domain/registryDefinitions.js';
import {
  LOGO_MAX_BYTES,
  LOGO_MAX_WIDTH_PX,
  SYSTEM_NAME,
  buildPropertyHeader,
  dataUrlBytes,
  fitWithin,
  formatDocumento,
  isAcceptedLogo,
  logoProblem,
  resolveHeaderProperty,
} from '../src/modules/catalog/domain/propertyHeader.js';
import { loadReportHeader, propertyService } from '../src/modules/catalog/application/index.js';
import { loadReportHeader as loadReportHeaderDirect } from '../src/modules/catalog/application/propertyHeaderService.js';
import { emptyFor, formFromRecord, groupFields, headerPreviewFromForm, payloadFromForm, recordCodeOf } from '../src/components/cadastros/registryFormModel.js';
import {
  LOGO_JPEG_QUALITIES,
  LOGO_READ_MESSAGE,
  LOGO_TOO_BIG_MESSAGE,
  LOGO_TYPE_MESSAGE,
  encodeLogoCanvas,
  isAcceptedLogoFile,
  prepareLogoFromFile,
} from '../src/components/cadastros/logoImage.js';
import { renderSheetHeaderHtml } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { SHEET_CSS } from '../src/modules/reporting/infrastructure/exporters/sheetStyles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const GESTOR = { id: 'u-gestor', nome: 'Gestora Teste', perfil: 'GESTOR' };
const safetyEvidence = { path: 'C:\\isolated-test\\pre-restore.json', size: 2048, sha256: 'c'.repeat(64) };
const resumo = { gate: 'registry:property-header:verify', ok: false, regras: [] };
const ok = (regra) => resumo.regras.push(regra);
const rejects = (promise, code, pattern, message) => assert.rejects(promise, (err) => {
  assert.equal(err?.code, code, `${message}: code ${err?.code} (${err?.message})`);
  if (pattern) assert.match(err.message, pattern, `${message}: mensagem`);
  return true;
}, message);
const sha = (text) => createHash('sha256').update(String(text)).digest('hex');
// Assinatura real do arquivo no começo (o validador confere: PNG 89 50 4E 47…, JPEG FF D8 FF).
const SIGNATURE_BYTES = { 'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/gif': [0x47, 0x49, 0x46] };
const dataUrlOf = (mime, bytes, fill = 7) => {
  const buffer = Buffer.alloc(bytes, fill);
  (SIGNATURE_BYTES[mime] ?? []).forEach((byte, index) => { if (index < bytes) buffer[index] = byte; });
  return `data:${mime};base64,${buffer.toString('base64')}`;
};
// PNG 1×1 real (transparente).
const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// "Logo" de ~200 KB com bytes variados (conteúdo não repetitivo para a comparação byte a byte), com a
// assinatura PNG no começo.
const bigLogoBytes = Buffer.alloc(200 * 1024);
for (let i = 0, seed = 12345; i < bigLogoBytes.length; i += 1) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; bigLogoBytes[i] = seed & 0xff; }
SIGNATURE_BYTES['image/png'].forEach((byte, index) => { bigLogoBytes[index] = byte; });
const LOGO_200KB = `data:image/png;base64,${bigLogoBytes.toString('base64')}`;
const HEADER_IDS = ['titular_nome', 'endereco', 'documento', 'inscricao_estadual', 'mostrar_documento_no_cabecalho', 'telefone', 'logo'];

// ---------------------------------------------------------------------------
// (a) Definição: campos novos, seção 'cabecalho', logo 'imagem', sem mudança de esquema.
// ---------------------------------------------------------------------------
const campos = Object.fromEntries(PROPRIEDADES.campos.map((campo) => [campo.id, campo]));
for (const id of HEADER_IDS) {
  assert.ok(campos[id], `Propriedades tem o campo ${id}`);
  assert.equal(campos[id].secao, 'cabecalho', `${id}: seção 'cabecalho'`);
}
assert.equal(campos.logo.tipo, 'imagem', 'logo é do tipo imagem');
assert.equal(campos.logo.ajuda, 'PNG ou JPG. Ajustamos o tamanho automaticamente.', 'ajuda do logo em linguagem simples');
assert.equal(campos.titular_nome.label, 'Produtor / razão social');
assert.equal(campos.titular_nome.ajuda, 'Sem ele o cabeçalho usa o nome da propriedade.');
assert.ok(campos.titular_nome.largo && campos.endereco.largo, 'produtor e endereço são campos largos');
assert.ok(campos.documento.compacto && campos.inscricao_estadual.compacto && campos.telefone.compacto, 'documento, IE e telefone compactos');
assert.equal(campos.inscricao_estadual.tipo, 'texto', 'IE é texto próprio (não passa pela limpeza de dígitos)');
assert.equal(campos.mostrar_documento_no_cabecalho.tipo, 'booleano');
assert.equal(campos.mostrar_documento_no_cabecalho.defaultValue, false, 'opção de mostrar documento nasce desligada');
assert.equal(campos.mostrar_documento_no_cabecalho.label, 'Mostrar CPF/CNPJ e IE no cabeçalho');
assert.ok(!PROPRIEDADES.colunas.some((coluna) => coluna.id === 'logo'), 'NEGATIVO: logo não vira coluna da lista');
assert.deepEqual(PROPRIEDADES.unicidade, ['nome_normalizado'], 'NEGATIVO: documento fora da unicidade (a store não tem índice de documento)');
for (const def of REGISTRY_DEFINITIONS.filter((item) => item !== PROPRIEDADES)) {
  assert.ok(!def.campos.some((campo) => campo.secao === 'cabecalho' || campo.tipo === 'imagem'), `NEGATIVO: ${def.store} não ganha seção de cabeçalho nem imagem`);
}
assert.equal(DB_VERSION, 8, 'esquema Dexie continua na v8');
assert.equal(STORES.propriedades, '++localId, &id, empresa_id, nome_normalizado, tipo, parceiro_id, ativo, created_at, updated_at, deleted_at', 'NEGATIVO: nenhum campo novo indexado em propriedades');
const grupos = groupFields(PROPRIEDADES);
assert.deepEqual(grupos.header.map((campo) => campo.id), HEADER_IDS, 'cartão "Cabeçalho dos relatórios" na ordem da definição');
assert.deepEqual(grupos.contact, [], 'telefone da propriedade sai de Contato e vai para o cabeçalho');
assert.deepEqual(grupos.additional.map((campo) => campo.id), ['municipio', 'uf', 'codigo_oficial'], 'Informações adicionais sem mudança');
assert.ok(grupos.primary.some((campo) => campo.id === 'nome') && !grupos.primary.some((campo) => HEADER_IDS.includes(campo.id)), 'nenhum campo do cabeçalho em Dados principais');
assert.deepEqual(groupFields(PARCEIROS).contact.map((campo) => campo.id), ['telefone', 'email'], 'NEGATIVO: telefone do parceiro continua em Contato');
assert.deepEqual(groupFields(PARCEIROS).header, [], 'NEGATIVO: parceiros sem cartão de cabeçalho');
ok('definicao');

// ---------------------------------------------------------------------------
// (b) Coerção e validação (definição = mesma régua do serviço e da tela).
// ---------------------------------------------------------------------------
const base = { nome: 'Fazenda Kaiman', tipo: 'PROPRIA' };
const errosLogo = (logo) => PROPRIEDADES.validar({ ...base, logo });
assert.deepEqual(errosLogo(PNG_1X1), [], 'PNG pequeno aceito');
assert.deepEqual(errosLogo(dataUrlOf('image/jpeg', 1000)), [], 'JPEG aceito');
assert.deepEqual(errosLogo(dataUrlOf('image/png', LOGO_MAX_BYTES)), [], 'exatamente 300 KB aceito');
assert.deepEqual(errosLogo(null), [], 'sem logo é permitido');
assert.deepEqual(errosLogo(''), [], 'logo vazio vira null (sem logo)');
const recusados = {
  svg: `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`,
  http: 'http://exemplo.com.br/logo.png',
  file: 'file:///C:/logo.png',
  texto: 'qualquer texto',
  script: 'javascript:alert(1)',
  gif: dataUrlOf('image/gif', 100),
  base64Invalido: 'data:image/png;base64,<script>alert(1)</script>',
  vazio: 'data:image/png;base64,A',
  // Revisão da E1B: base64 mal formado e bytes que não são do tipo declarado desenhariam imagem quebrada.
  base64Truncado: 'data:image/png;base64,AAAAA',
  semAssinatura: `data:image/png;base64,${Buffer.alloc(300, 7).toString('base64')}`,
  pngComBytesDeJpeg: `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64')}`,
};
for (const [caso, logo] of Object.entries(recusados)) {
  assert.deepEqual(errosLogo(logo), ['O logo precisa ser uma imagem PNG ou JPG.'], `NEGATIVO: logo ${caso} recusado com mensagem simples`);
  assert.equal(isAcceptedLogo(logo), false, `NEGATIVO: isAcceptedLogo(${caso})`);
}
const grande = dataUrlOf('image/png', LOGO_MAX_BYTES + 1);
assert.equal(dataUrlBytes(grande), LOGO_MAX_BYTES + 1, 'tamanho medido em bytes da imagem (não do texto base64)');
assert.deepEqual(errosLogo(grande), [logoProblem(grande)], 'NEGATIVO: logo > 300 KB recusado');
assert.match(logoProblem(grande), /limite é 300 KB/, 'mensagem do limite em KB');
const coagido = coerceRecord(PROPRIEDADES, { ...base, documento: '123.456.789-01', inscricao_estadual: ' ISENTO ', logo: `  ${PNG_1X1}\n`, titular_nome: '  Zigomar   Franco ' });
assert.equal(coagido.documento, '12345678901', 'documento guardado só com dígitos');
// CNPJ alfanumérico (Receita, desde jul/2026) válido: guardado com as letras e formatado no cabeçalho;
// "CPF 123…" continua só com os dígitos (letra solta não é CNPJ).
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: '12.ABC.345/01DE-35' }).documento, '12ABC34501DE35', 'CNPJ alfanumérico preservado');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: 'CPF 123.456.789-01' }).documento, '12345678901', 'prefixo "CPF" descartado');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: '12.ABC.345/01DE-36' }).documento, '123450136', 'alfanumérico com dígito verificador errado não vira CNPJ');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: '12ABC34501DE35' }).documento, '12ABC34501DE35', 'CNPJ alfanumérico sem pontuação também vale');
// Revisão final: "CPF " + 11 dígitos tem 14 posições e às vezes fecha os dígitos verificadores do CNPJ
// alfanumérico (CPF69957740601) — sem a forma de CNPJ, fica o CPF (só dígitos).
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: 'CPF 699.577.406-01' }).documento, '69957740601', 'NEGATIVO: "CPF 699.577.406-01" continua CPF');
assert.equal(buildPropertyHeader({ ...base, documento: '12ABC34501DE35', mostrar_documento_no_cabecalho: true }).documentos, 'CNPJ 12.ABC.345/01DE-35', 'cabeçalho com o CNPJ alfanumérico formatado');
assert.equal(coagido.inscricao_estadual, 'ISENTO', "IE 'ISENTO' preservada (sem virar null)");
assert.equal(coagido.logo, PNG_1X1, 'logo: só tira espaço das pontas, conteúdo intacto');
assert.equal(coagido.titular_nome, 'Zigomar Franco', 'texto do cabeçalho limpo como os demais');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, documento: 'sem dígitos' }).documento, null, 'NEGATIVO: documento sem dígitos vira null');
assert.equal(coerceRecord(PROPRIEDADES, base).logo, null, 'sem logo → null');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, mostrar_documento_no_cabecalho: true }).mostrar_documento_no_cabecalho, true, 'opção ligada grava true');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, mostrar_documento_no_cabecalho: false }).mostrar_documento_no_cabecalho, null, 'opção desligada grava null (igual ao registro antigo sem o campo)');
assert.equal(coerceRecord(PROPRIEDADES, { ...base, mostrar_documento_no_cabecalho: 'true' }).mostrar_documento_no_cabecalho, true, "'true' do formulário liga");
assert.equal(coerceRecord(PROPRIEDADES, { ...base, padrao: false }).padrao, false, 'NEGATIVO: os outros booleanos continuam gravando false');
// Formulário ⇄ registro: imagem vazia é null; o data URL passa inteiro.
const vazio = emptyFor(PROPRIEDADES);
assert.equal(vazio.logo, '', 'formulário novo sem logo');
assert.equal(vazio.mostrar_documento_no_cabecalho, false);
assert.equal(payloadFromForm(PROPRIEDADES, { ...vazio, nome: 'X' }).logo, null, 'Remover/sem logo → null');
assert.equal(payloadFromForm(PROPRIEDADES, { ...vazio, nome: 'X', logo: PNG_1X1 }).logo, PNG_1X1);
assert.equal(formFromRecord(PROPRIEDADES, { nome: 'X', logo: null }).logo, '');
assert.equal(formFromRecord(PROPRIEDADES, { nome: 'X', logo: PNG_1X1 }).logo, PNG_1X1);
ok('coercao-validacao');

// ---------------------------------------------------------------------------
// (c) Redimensionamento: fitWithin e a escolha PNG → JPEG (canvas de teste).
// ---------------------------------------------------------------------------
assert.equal(LOGO_MAX_WIDTH_PX, 400);
assert.deepEqual(fitWithin(1200, 600), { width: 400, height: 200 }, '1200×600 → 400×200');
assert.deepEqual(fitWithin(300, 900), { width: 300, height: 900 }, 'NEGATIVO: 300×900 fica igual (nunca amplia)');
assert.deepEqual(fitWithin(400, 120), { width: 400, height: 120 }, 'exatamente 400 fica igual');
assert.deepEqual(fitWithin(4000, 3), { width: 400, height: 1 }, 'altura nunca vira 0');
assert.deepEqual(fitWithin(0, 0), { width: 1, height: 1 }, 'medida inválida não quebra');
assert.ok(isAcceptedLogoFile({ type: 'image/png' }) && isAcceptedLogoFile({ type: 'image/jpeg' }), 'PNG e JPEG aceitos');
for (const type of ['image/svg+xml', 'image/gif', 'image/webp', 'text/plain', 'application/pdf', '']) {
  assert.equal(isAcceptedLogoFile({ type }), false, `NEGATIVO: arquivo ${type || '(sem tipo)'} recusado`);
}
await rejects(prepareLogoFromFile(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })), 'LOGO_INVALID', new RegExp(LOGO_TYPE_MESSAGE.replace('.', '\\.')), 'NEGATIVO: svg recusado antes de ler');
await rejects(prepareLogoFromFile(new File(['oi'], 'logo.txt', { type: 'text/plain' })), 'LOGO_INVALID', /PNG ou JPG/, 'NEGATIVO: texto recusado');
await rejects(prepareLogoFromFile(null), 'LOGO_INVALID', /PNG ou JPG/, 'NEGATIVO: sem arquivo');
// Leitura real indisponível (Node não tem createImageBitmap/Image): erro simples, sem travar.
await rejects(prepareLogoFromFile(new File([Buffer.from(PNG_1X1.split(',')[1], 'base64')], 'logo.png', { type: 'image/png' })), 'LOGO_INVALID', /Não foi possível abrir a imagem/, 'imagem ilegível vira mensagem simples');

function testCanvas({ pngBytes, jpegBytes = {} }) {
  const log = [];
  const context = {
    fillStyle: null,
    clearRect: () => log.push('limpa'),
    fillRect: () => log.push(`fundo:${context.fillStyle}`),
    drawImage: (_source, _x, _y, width, height) => log.push(`desenha:${width}x${height}`),
  };
  const makeCanvas = (width, height) => ({
    width,
    height,
    getContext: () => context,
    toDataURL: (type, quality) => {
      log.push(`gera:${type}${quality != null ? `:${quality}` : ''}`);
      const bytes = type === 'image/png' ? pngBytes : jpegBytes[quality];
      return dataUrlOf(type, bytes ?? LOGO_MAX_BYTES * 2);
    },
  });
  return { log, makeCanvas };
}
let liberado = 0;
const decode1200 = async () => ({ source: {}, width: 1200, height: 600, release: () => { liberado += 1; } });
const arquivoPng = new File(['x'], 'logo.png', { type: 'image/png' });
{
  const { log, makeCanvas } = testCanvas({ pngBytes: 50 * 1024 });
  const pronto = await prepareLogoFromFile(arquivoPng, { decode: decode1200, makeCanvas });
  assert.equal(pronto.formato, 'PNG', 'PNG que cabe fica PNG');
  assert.deepEqual([pronto.width, pronto.height], [400, 200], 'desenhado em 400×200');
  assert.ok(log.includes('desenha:400x200'), 'canvas recebe a imagem já reduzida');
  assert.ok(!log.some((item) => item.startsWith('fundo:')), 'PNG mantém a transparência (sem fundo)');
  assert.ok(isAcceptedLogo(pronto.dataUrl) && pronto.bytes === 50 * 1024);
}
{
  const { log, makeCanvas } = testCanvas({ pngBytes: 400 * 1024, jpegBytes: { 0.9: 350 * 1024, 0.8: 280 * 1024 } });
  const pronto = await prepareLogoFromFile(new File(['x'], 'logo.jpg', { type: 'image/jpeg' }), { decode: decode1200, makeCanvas });
  assert.equal(pronto.formato, 'JPEG', 'PNG grande demais cai para JPEG');
  assert.equal(pronto.qualidade, 0.8, 'qualidade decrescente até caber (0,9 → 0,8)');
  assert.match(pronto.dataUrl, /^data:image\/jpeg;base64,/);
  const fundo = log.indexOf('fundo:#ffffff');
  assert.ok(fundo > log.indexOf('gera:image/png') && fundo < log.indexOf('gera:image/jpeg:0.9'), 'fundo branco pintado antes do JPEG');
}
{
  const { log, makeCanvas } = testCanvas({ pngBytes: 900 * 1024 });
  await rejects(prepareLogoFromFile(arquivoPng, { decode: decode1200, makeCanvas }), 'LOGO_INVALID', /grande demais/, 'NEGATIVO: nem o JPEG 0,5 cabe → recusa');
  assert.deepEqual(log.filter((item) => item.startsWith('gera:image/jpeg')), LOGO_JPEG_QUALITIES.map((q) => `gera:image/jpeg:${q}`), 'tenta 0,9 → 0,5 em ordem');
  assert.equal(LOGO_TOO_BIG_MESSAGE.includes('300 KB'), true);
}
await rejects(prepareLogoFromFile(arquivoPng, { decode: async () => ({ source: {}, width: 0, height: 0 }), makeCanvas: testCanvas({ pngBytes: 10 }).makeCanvas }), 'LOGO_INVALID', new RegExp(LOGO_READ_MESSAGE.slice(0, 20)), 'NEGATIVO: imagem sem medida');
await rejects(prepareLogoFromFile(arquivoPng, { decode: async () => { throw new Error('corrompido'); } }), 'LOGO_INVALID', /Não foi possível abrir/, 'NEGATIVO: arquivo corrompido');
assert.ok(liberado >= 3, 'a imagem lida é liberada depois do ajuste (inclusive na recusa)');
assert.throws(() => encodeLogoCanvas({ toDataURL: () => 'data:,' }), /grande demais/, 'NEGATIVO: canvas sem imagem não vira logo');
ok('redimensionamento');

// ---------------------------------------------------------------------------
// (d) Modelo do cabeçalho e o HTML da folha (o mesmo da pré-visualização na ficha).
// ---------------------------------------------------------------------------
const completa = {
  id: 'p-kaiman', nome: 'FAZENDA KAIMAN', titular_nome: 'ZIGOMAR FERREIRA FRANCO FILHO', endereco: 'GLEBA RICARDO FRANCO SN - ZONA RURAL',
  municipio: 'VILA BELA DA SST. TRINDADE', uf: 'MT', documento: '12345678901', inscricao_estadual: 'ISENTO',
  mostrar_documento_no_cabecalho: true, telefone: '(65) 99999-0000', logo: PNG_1X1, padrao: true, ativo: true,
};
assert.deepEqual(buildPropertyHeader(completa), {
  empty: false,
  propriedadeId: 'p-kaiman',
  logo: PNG_1X1,
  titular: 'ZIGOMAR FERREIRA FRANCO FILHO',
  fazenda: 'FAZENDA KAIMAN',
  endereco: 'GLEBA RICARDO FRANCO SN - ZONA RURAL, VILA BELA DA SST. TRINDADE-MT',
  documentos: 'CPF 123.456.789-01 · IE ISENTO',
  telefone: 'Tel. (65) 99999-0000',
}, 'cabeçalho completo');
const semTitular = buildPropertyHeader({ ...completa, titular_nome: null });
assert.equal(semTitular.titular, 'FAZENDA KAIMAN', 'sem produtor o cabeçalho usa o nome da propriedade');
assert.equal(semTitular.fazenda, null, 'NEGATIVO: o nome não aparece duas vezes');
assert.deepEqual(buildPropertyHeader(null), { empty: true, propriedadeId: null, logo: null, titular: SYSTEM_NAME, fazenda: null, endereco: null, documentos: null, telefone: null }, 'sem propriedade: só o nome do sistema');
assert.equal(SYSTEM_NAME, 'Pesagens Individuais');
assert.equal(buildPropertyHeader({ ...completa, mostrar_documento_no_cabecalho: null }).documentos, null, 'NEGATIVO: documentos só com a opção ligada (desligada = null)');
assert.equal(buildPropertyHeader({ ...completa, mostrar_documento_no_cabecalho: false }).documentos, null, 'NEGATIVO: opção false também esconde');
assert.equal(buildPropertyHeader({ ...completa, mostrar_documento_no_cabecalho: undefined }).documentos, null, 'NEGATIVO: registro antigo (sem o campo) esconde');
assert.equal(buildPropertyHeader({ ...completa, documento: '12345678000190', inscricao_estadual: null }).documentos, 'CNPJ 12.345.678/0001-90', 'CNPJ formatado');
assert.deepEqual(formatDocumento('123'), { tipo: 'CPF/CNPJ', texto: '123' }, 'documento fora do tamanho sai como está');
for (const logo of [recusados.svg, recusados.http, grande, 'lixo']) {
  assert.equal(buildPropertyHeader({ ...completa, logo }).logo, null, 'NEGATIVO: logo inválido (ex.: backup adulterado) vira null');
}
const html = renderSheetHeaderHtml(buildPropertyHeader(completa), { periodText: 'Período: 02/06/2026 – 02/06/2026' });
assert.ok(html.includes(`<img class="sheet-logo" src="${PNG_1X1}"`), 'folha desenha o logo');
assert.ok(html.includes('ZIGOMAR FERREIRA FRANCO FILHO') && html.includes('FAZENDA KAIMAN') && html.includes('CPF 123.456.789-01 · IE ISENTO'), 'folha com produtor, fazenda e documentos');
assert.ok(!renderSheetHeaderHtml(buildPropertyHeader({ ...completa, logo: recusados.svg })).includes('<img'), 'NEGATIVO: logo inválido não vira <img>');
assert.ok(!renderSheetHeaderHtml({ ...buildPropertyHeader(completa), logo: recusados.script }).includes('<img'), 'NEGATIVO: a folha revalida o logo mesmo se o modelo vier adulterado');
const escapado = renderSheetHeaderHtml(buildPropertyHeader({ ...completa, titular_nome: '<b>A & "B"</b>' }));
assert.ok(escapado.includes('&lt;b&gt;A &amp; &quot;B&quot;&lt;/b&gt;') && !escapado.includes('<b>A'), 'texto do cadastro escapado na folha');
const vazioHtml = renderSheetHeaderHtml(buildPropertyHeader(null));
assert.ok(vazioHtml.includes('sheet-header--system') && vazioHtml.includes('Pesagens Individuais') && !vazioHtml.includes('<img'), 'sem propriedade: cabeçalho do sistema, sem logo');
assert.match(SHEET_CSS, /\.rpt-sheet\.rpt-sheet--preview/, 'CSS da folha tem a moldura da pré-visualização da ficha');
// Pré-visualização da ficha = cabeçalho da folha com o registro gravado (mesma coerção, mesmo modelo).
assert.deepEqual(headerPreviewFromForm(PROPRIEDADES, formFromRecord(PROPRIEDADES, completa), { id: completa.id }), buildPropertyHeader(completa), 'pré-visualização do formulário = cabeçalho do registro');
assert.equal(headerPreviewFromForm(PROPRIEDADES, { ...formFromRecord(PROPRIEDADES, completa), mostrar_documento_no_cabecalho: false }).documentos, null, 'pré-visualização muda ao desligar a opção');
assert.equal(headerPreviewFromForm(PROPRIEDADES, { ...formFromRecord(PROPRIEDADES, completa), logo: '' }).logo, null, 'pré-visualização muda ao remover o logo');
// Painel de contexto: o CPF da propriedade não aparece como "código" do registro.
assert.equal(recordCodeOf(PROPRIEDADES, { ...completa, codigo_oficial: null }), 'propriedade', 'NEGATIVO: documento do cabeçalho não vira código do registro');
assert.equal(recordCodeOf(PROPRIEDADES, { ...completa, codigo_oficial: 'MT-01' }), 'MT-01');
assert.equal(recordCodeOf(PARCEIROS, { documento: '12345678000190' }), '12345678000190', 'parceiro continua mostrando o documento');
ok('modelo-cabecalho');

// ---------------------------------------------------------------------------
// (e) Qual propriedade vai no cabeçalho.
// ---------------------------------------------------------------------------
const padrao = { id: 'p-a', nome: 'Fazenda A', padrao: true, ativo: true };
const outra = { id: 'p-b', nome: 'Fazenda Boa Vista', padrao: false, ativo: true };
const inativa = { id: 'p-c', nome: 'Fazenda Velha', padrao: false, ativo: false };
const excluida = { id: 'p-d', nome: 'Fazenda Excluída', padrao: false, ativo: true, deleted_at: '2026-09-01T00:00:00.000Z' };
const lista = [padrao, outra, inativa, excluida];
assert.equal(resolveHeaderProperty(lista)?.id, 'p-a', 'padrão: a marcada como Padrão');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'in', values: ['p-b'] } } })?.id, 'p-b', 'filtrado por id');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'equals', value: 'fazenda  boa vista', match: 'label' } } })?.id, 'p-b', 'filtrado por nome (match label, nome normalizado)');
// Revisão final da E1B: nome sem acento acha como o motor de filtros; texto digitado não escolhe;
// homônimas → Padrão.
const acentuada = { id: 'p-e', nome: 'Fazenda São João', padrao: false, ativo: true };
assert.equal(resolveHeaderProperty([...lista, acentuada], { filters: { propriedade: { operator: 'equals', value: 'fazenda sao joao', match: 'label' } } })?.id, 'p-e', 'nome sem acento acha a propriedade (como o filtro)');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'contains', value: 'Fazenda A', match: 'label' } } })?.id, 'p-a', 'NEGATIVO: texto em "contém" não escolhe (cai na Padrão)');
assert.equal(resolveHeaderProperty([...lista, acentuada], { filters: { propriedade: { operator: 'starts_with', value: 'Fazenda São', match: 'label' } } })?.id, 'p-a', 'NEGATIVO: "começa com" não escolhe');
const homonima = { id: 'p-f', nome: 'FAZENDA BOA VISTA', padrao: false, ativo: true };
assert.equal(resolveHeaderProperty([...lista, homonima], { filters: { propriedade: { operator: 'equals', value: 'Fazenda Boa Vista', match: 'label' } } })?.id, 'p-a', 'NEGATIVO: duas propriedades com o mesmo nome → Padrão');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'contains', values: ['FAZENDA VELHA'], match: 'label' } } })?.id, 'p-c', 'filtro numa inativa usa a dela');
assert.equal(resolveHeaderProperty(lista, { lockedFilters: { propriedade: { operator: 'equals', value: 'p-b' } } })?.id, 'p-b', 'condição fixa do relatório');
assert.equal(resolveHeaderProperty(lista, { drill: [{ columnId: 'marca', key: 'm1' }, { columnId: 'propriedade', key: 'p-b', label: 'Fazenda Boa Vista' }] })?.id, 'p-b', 'detalhe (drill) numa propriedade');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'in', values: ['p-a', 'p-b'] } } })?.id, 'p-a', 'NEGATIVO: duas propriedades no filtro → padrão');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'not_in', values: ['p-a'] } } })?.id, 'p-a', 'NEGATIVO: filtro negativo não escolhe propriedade');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'in', values: ['nao-existe'] } } })?.id, 'p-a', 'NEGATIVO: filtro sem correspondência → padrão');
assert.equal(resolveHeaderProperty(lista, { filters: { propriedade: { operator: 'in', values: ['p-d'] } } })?.id, 'p-a', 'NEGATIVO: excluída nunca vai no cabeçalho');
assert.equal(resolveHeaderProperty([{ ...padrao, ativo: false }, outra]), null, 'NEGATIVO: padrão inativa não vale → vazio');
assert.equal(resolveHeaderProperty([]), null, 'sem propriedade → vazio');
assert.equal(buildPropertyHeader(resolveHeaderProperty([])).titular, 'Pesagens Individuais', 'vazio → só o nome do sistema');
ok('resolucao');

// ---------------------------------------------------------------------------
// (f) Serviço: grava e relê os campos novos; a auditoria guarda nomes, nunca o data URL.
// ---------------------------------------------------------------------------
await deleteDbForTests();
const db = await ensureStorageReady();
const kaiman = await propertyService.create(GESTOR, {
  nome: 'Fazenda Kaiman', tipo: 'PROPRIA', municipio: 'Vila Bela da Sst. Trindade', uf: 'mt', padrao: true,
  titular_nome: 'Zigomar Ferreira Franco Filho', endereco: 'Gleba Ricardo Franco SN - Zona Rural', documento: '123.456.789-01',
  inscricao_estadual: 'ISENTO', mostrar_documento_no_cabecalho: true, telefone: '(65) 99999-0000', logo: LOGO_200KB,
});
const relida = await propertyService.get(kaiman.id);
assert.equal(relida.titular_nome, 'Zigomar Ferreira Franco Filho');
assert.equal(relida.endereco, 'Gleba Ricardo Franco SN - Zona Rural');
assert.equal(relida.documento, '12345678901', 'documento relido só com dígitos');
assert.equal(relida.inscricao_estadual, 'ISENTO', 'IE relida');
assert.equal(relida.mostrar_documento_no_cabecalho, true);
assert.equal(relida.telefone, '(65) 99999-0000');
assert.equal(relida.logo, LOGO_200KB, 'logo relido inteiro');
const mesmoDocumento = await propertyService.create(GESTOR, { nome: 'Retiro Kaiman', documento: '12345678901' });
assert.equal(mesmoDocumento.documento, '12345678901', 'mesmo produtor em outra fazenda: documento repetido é aceito');
await rejects(propertyService.create(GESTOR, { nome: 'Fazenda SVG', logo: recusados.svg }), 'REGISTRY_INVALID', /PNG ou JPG/, 'NEGATIVO: serviço recusa svg');
await rejects(propertyService.create(GESTOR, { nome: 'Fazenda Link', logo: recusados.http }), 'REGISTRY_INVALID', /PNG ou JPG/, 'NEGATIVO: serviço recusa http:');
await rejects(propertyService.create(GESTOR, { nome: 'Fazenda Grande', logo: grande }), 'REGISTRY_INVALID', /300 KB/, 'NEGATIVO: serviço recusa > 300 KB');
await rejects(propertyService.update(GESTOR, kaiman.id, { logo: 'qualquer texto' }), 'REGISTRY_INVALID', /PNG ou JPG/, 'NEGATIVO: update com logo inválido');
assert.equal((await propertyService.get(kaiman.id)).logo, LOGO_200KB, 'recusa não altera o logo gravado');
const trocado = await propertyService.update(GESTOR, kaiman.id, { logo: PNG_1X1, telefone: '(65) 3333-0000' });
assert.equal(trocado.logo, PNG_1X1, 'trocar o logo');
const semLogo = await propertyService.update(GESTOR, kaiman.id, payloadFromForm(PROPRIEDADES, { ...formFromRecord(PROPRIEDADES, trocado), logo: '' }));
assert.equal(semLogo.logo, null, 'Remover logo pela ficha grava null');
await propertyService.update(GESTOR, kaiman.id, { logo: LOGO_200KB, telefone: '(65) 99999-0000' });
const trilha = await db.table('auditoria').where('entidade').equals('propriedades').toArray();
const trilhaTexto = JSON.stringify(trilha);
assert.ok(trilha.length >= 5, 'criação e alterações auditadas');
assert.ok(!trilhaTexto.includes('data:image') && !trilhaTexto.includes(PNG_1X1.slice(40, 90)) && !trilhaTexto.includes(LOGO_200KB.slice(5000, 5100)), 'NEGATIVO: auditoria nunca guarda o data URL');
assert.ok(trilha.some((a) => a.acao === 'CRIAR' && a.campos_alterados.includes('logo')), 'criação registra o NOME do campo logo');
assert.ok(trilha.some((a) => a.acao === 'ATUALIZAR' && a.campos_alterados.includes('logo')), 'troca de logo registra o nome do campo');
assert.ok(trilha.every((a) => JSON.stringify(a).length < 4000), 'linhas de auditoria continuam pequenas');
ok('servico-auditoria');

// ---------------------------------------------------------------------------
// (g) Backup completo → restauração: o logo volta byte a byte.
// ---------------------------------------------------------------------------
const antesDoBackup = await propertyService.get(kaiman.id);
const bak = await storage.createFullBackup();
assert.ok(bak.ok, 'backup completo gerado');
const noBackup = bak.backup.stores.propriedades.find((row) => row.id === kaiman.id);
assert.equal(noBackup.logo, LOGO_200KB, 'logo dentro do backup (campo do registro)');
const arquivo = JSON.parse(JSON.stringify(bak.backup)); // como se fosse lido do disco
await propertyService.update(GESTOR, kaiman.id, { logo: PNG_1X1, titular_nome: 'Outro dono' });
await propertyService.deactivate(GESTOR, mesmoDocumento.id);
await assert.rejects(storage.applyRestore(arquivo), /backup físico/, 'NEGATIVO: restauração exige evidência de backup físico');
const restaurado = await storage.applyRestore(arquivo, { safetyEvidence });
assert.equal(restaurado.restored, true);
const depois = await propertyService.get(kaiman.id);
assert.equal(depois.logo.length, LOGO_200KB.length, 'mesmo tamanho');
assert.equal(sha(depois.logo), sha(LOGO_200KB), 'mesmo SHA-256');
assert.equal(depois.logo, LOGO_200KB, 'logo idêntico byte a byte após restaurar');
assert.deepEqual(Buffer.from(depois.logo.split(',')[1], 'base64'), bigLogoBytes, 'bytes da imagem idênticos');
assert.equal(depois.titular_nome, antesDoBackup.titular_nome, 'demais campos do cabeçalho restaurados');
assert.equal(depois.mostrar_documento_no_cabecalho, true);
assert.equal((await propertyService.get(mesmoDocumento.id)).ativo, true, 'estado do backup restaurado');
ok('backup-restore');

// ---------------------------------------------------------------------------
// (h) loadReportHeader: padrão, filtrado, tolerante a falha, vazio.
// ---------------------------------------------------------------------------
assert.equal(loadReportHeader, loadReportHeaderDirect, 'índice público reexporta o serviço do cabeçalho');
const doPadrao = await loadReportHeader();
assert.equal(doPadrao.propriedadeId, kaiman.id, 'cabeçalho da propriedade padrão');
assert.equal(doPadrao.titular, 'Zigomar Ferreira Franco Filho');
assert.equal(doPadrao.fazenda, 'Fazenda Kaiman');
assert.equal(doPadrao.endereco, 'Gleba Ricardo Franco SN - Zona Rural, Vila Bela da Sst. Trindade-MT');
assert.equal(doPadrao.documentos, 'CPF 123.456.789-01 · IE ISENTO');
assert.equal(doPadrao.logo, LOGO_200KB, 'logo da padrão no cabeçalho');
const filtrado = await loadReportHeader({ empresaId: 'local', filters: { propriedade: { operator: 'equals', value: 'retiro kaiman', match: 'label' } } });
assert.equal(filtrado.propriedadeId, mesmoDocumento.id, 'relatório filtrado por outra propriedade usa a dela');
assert.equal(filtrado.logo, null);
assert.equal((await loadReportHeader({ empresaId: 'outra-empresa' })).empty, true, 'NEGATIVO: outra empresa não vê a propriedade daqui');
const explode = { get propriedade() { throw new Error('falha de leitura simulada'); } };
assert.deepEqual(await loadReportHeader({ filters: explode }), buildPropertyHeader(null), 'falha na leitura → cabeçalho vazio (nunca quebra a impressão)');
ok('load-report-header');

// ---------------------------------------------------------------------------
// (i) Propriedade antiga (sem os campos novos): salvar de novo sem mudança não audita.
// ---------------------------------------------------------------------------
const ts = '2026-01-10T12:00:00.000Z';
await db.table('propriedades').add({
  id: 'prop-antiga', empresa_id: 'local', nome: 'Fazenda Antiga', nome_normalizado: 'FAZENDA ANTIGA', tipo: 'PROPRIA',
  parceiro_id: null, municipio: 'Cáceres', uf: 'MT', codigo_oficial: null, padrao: false, ativo: true,
  created_at: ts, updated_at: ts, deleted_at: null,
});
const auditoriasDaAntiga = async () => db.table('auditoria').where('entidade_id').equals('prop-antiga').toArray();
const antiga = await propertyService.get('prop-antiga');
const semPatch = await propertyService.update(GESTOR, 'prop-antiga', {});
assert.equal(semPatch.updated_at, ts, 'update vazio não regrava');
const pelaFicha = await propertyService.update(GESTOR, 'prop-antiga', payloadFromForm(PROPRIEDADES, formFromRecord(PROPRIEDADES, antiga)));
assert.equal(pelaFicha.updated_at, ts, 'reabrir e salvar pela ficha sem mudar nada não regrava');
assert.deepEqual(await auditoriasDaAntiga(), [], 'NEGATIVO: nenhuma "alteração" falsa na auditoria');
// Sem o tratamento da opção nova, a coerção gravaria false e o serviço veria false × ausente.
const semTratamento = { ...PROPRIEDADES, campos: PROPRIEDADES.campos.map((campo) => (campo.id === 'mostrar_documento_no_cabecalho' ? { ...campo, desligadoComoNulo: false } : campo)) };
assert.equal(coerceRecord(semTratamento, antiga).mostrar_documento_no_cabecalho, false, 'controle: sem o tratamento a opção viraria false (alteração falsa)');
const mudou = await propertyService.update(GESTOR, 'prop-antiga', { titular_nome: 'João da Antiga' });
let trilhaAntiga = await auditoriasDaAntiga();
assert.deepEqual(trilhaAntiga.map((a) => a.campos_alterados), [['titular_nome']], 'mudança real audita só o campo mudado');
assert.notEqual(mudou.updated_at, ts);
await propertyService.update(GESTOR, 'prop-antiga', { mostrar_documento_no_cabecalho: true });
await propertyService.update(GESTOR, 'prop-antiga', payloadFromForm(PROPRIEDADES, { ...formFromRecord(PROPRIEDADES, await propertyService.get('prop-antiga')), mostrar_documento_no_cabecalho: false }));
assert.equal((await propertyService.get('prop-antiga')).mostrar_documento_no_cabecalho, null, 'desligar pela ficha grava null');
await propertyService.update(GESTOR, 'prop-antiga', payloadFromForm(PROPRIEDADES, formFromRecord(PROPRIEDADES, await propertyService.get('prop-antiga'))));
trilhaAntiga = await auditoriasDaAntiga();
assert.deepEqual(trilhaAntiga.map((a) => a.campos_alterados), [['titular_nome'], ['mostrar_documento_no_cabecalho'], ['mostrar_documento_no_cabecalho']], 'ligar e desligar auditam; salvar de novo desligado não');
ok('sem-alteracao-falsa');

// ---------------------------------------------------------------------------
// Tela: ficha com o cartão do cabeçalho, o campo Logo e a pré-visualização da folha.
// ---------------------------------------------------------------------------
const page = read('src/components/cadastros/CadastroAuxiliarPage.jsx');
const logoField = read('src/components/cadastros/LogoField.jsx');
const preview = read('src/components/cadastros/PropertyHeaderPreview.jsx');
const logoImage = read('src/components/cadastros/logoImage.js');
const css = read('src/styles/auxiliary-registries.css');
assert.match(page, /<div className="emp-form-cards-row">\s*<FormCard title="Dados principais"/, 'primeira linha continua começando por "Dados principais"');
assert.match(page, /<FormCard title="Contato"[\s\S]{0,900}<div className="emp-form-cards-row" key=\{`cabecalho:\$\{editingId \?\? 'novo'\}`\}>\s*<FormCard title="Cabeçalho dos relatórios" fields=\{headerFields\}[\s\S]{0,300}<PropertyHeaderPreview /, 'linha nova depois das atuais: cartão do cabeçalho + pré-visualização, remontada por registro');
// Revisão da E1B: logo ainda sendo ajustado nunca cai na ficha de outra propriedade.
assert.match(logoField, /if \(mountedRef\.current\) onChange\(dataUrl\)/, 'resultado do ajuste descartado se a ficha trocou de registro');
assert.match(page, /header: headerFields \} = groupFields\(definition\)/, 'campos do cartão vêm da seção da definição');
assert.match(page, /if \(campo\.tipo === 'imagem'\) return <LogoField /, 'campo imagem usa o LogoField');
assert.match(page, /definition\.campos\.filter\(\(campo\) => campo\.tipo === 'texto'\)/, 'pesquisa só usa campos de texto (o logo fica fora)');
assert.match(logoField, /type="file"[\s\S]{0,120}accept="image\/png,image\/jpeg"[\s\S]{0,60}className="sr-only"/, 'input de arquivo escondido, só PNG/JPG');
assert.match(logoField, /const inputId = `arquivo-\$\{campo\.id\}`/, 'id do input sem o prefixo aux- (não herda o estilo de campo de texto)');
assert.ok(!/id=\{`aux-/.test(logoField), 'NEGATIVO: nenhum id aux- no campo de arquivo');
for (const texto of ["'Escolher logo'", "'Trocar'", 'Remover', 'prepareLogoFromFile(file)', 'isAcceptedLogo(current)']) assert.ok(logoField.includes(texto), `LogoField: ${texto}`);
assert.match(preview, /import \{ renderSheetHeaderHtml \} from '@\/modules\/reporting\/infrastructure\/exporters\/sheetHtml'/, 'pré-visualização usa o renderizador da folha');
assert.match(preview, /import \{ SHEET_CSS \} from '@\/modules\/reporting\/infrastructure\/exporters\/sheetStyles'/, 'pré-visualização usa o CSS da folha');
assert.match(preview, /<style>\{SHEET_CSS\}<\/style>\s*<div className="rpt-sheet rpt-sheet--preview" dangerouslySetInnerHTML=\{\{ __html: html \}\}/, 'folha dentro de .rpt-sheet--preview');
assert.ok(preview.includes('Assim vai sair nos relatórios') && preview.includes('headerPreviewFromForm(definition, form'), 'cartão "Assim vai sair nos relatórios" ao vivo com o formulário');
for (const trecho of ['createImageBitmap', 'URL.createObjectURL', "toDataURL('image/png')", "'image/jpeg'", 'fitWithin(', 'LOGO_MAX_WIDTH_PX']) assert.ok(logoImage.includes(trecho), `logoImage: ${trecho}`);
assert.match(css, /E1B[\s\S]{0,400}\.aux-logo-field/, 'bloco E1B no CSS dos cadastros');
ok('tela');

await deleteDbForTests();
resumo.ok = true;
resumo.campos = HEADER_IDS;
resumo.logo = { maxLarguraPx: LOGO_MAX_WIDTH_PX, maxBytes: LOGO_MAX_BYTES, jpegQualidades: LOGO_JPEG_QUALITIES, bytesRestauradosIdenticos: true };
console.log('OK verify-property-header');
console.log(JSON.stringify(resumo, null, 2));
