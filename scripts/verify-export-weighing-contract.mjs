// Gate export:weighing-contract:verify (fatia D da reconciliação sanidade/lançamento/importação).
// Contrato de colunas e exportação de pesagens (src/modules/weighing/export):
// 1) CSV canônico: BOM, ";", CRLF, escape de ";", aspas e quebra de linha, proteção contra fórmula;
// 2) ausente = célula vazia (nunca "0", "0,00", "--/--/----", "—" nem "[object Object]");
// 3) cabeçalhos estáveis nos perfis FRIENDLY e REIMPORT; Tipo e Motivo da saída sempre presentes;
// 4) valores comerciais só com permissão (pedido da tela E commercial.values do papel, no serviço);
// 5) CSV técnico da Manutenção: exclui apagados, deduplica por id e segue a cronologia canônica;
// 6) inspeção de fonte: Relação e Fechamento usam o contrato; o Lançamento chama buildWeighingCsv.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSV_BOM, parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import {
  COMMERCIAL_EXPORT_COLUMN_IDS,
  DERIVED_COLUMN_IDS,
  EXPORT_PROFILES,
  FRIENDLY_DEFAULT_COLUMN_IDS,
  REIMPORT_HEADERS,
  WEIGHING_EXPORT_COLUMNS,
  buildWeighingCsv,
  buildWeighingTechnicalCsv,
  columnsForProfile,
} from '../src/modules/weighing/export/weighingExportContract.js';
import { exportWeighingCsv } from '../src/modules/weighing/export/weighingExportService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const NOW = new Date(2026, 8, 17, 7, 5, 9);

const FRIENDLY_HEADERS = [
  'Data', 'Tipo', 'Motivo da saída', 'Causa da morte', 'Identificação', 'Marca', 'Sexo', 'Raça', 'Categoria', 'Era',
  'Peso', 'Data anterior', 'Peso anterior', 'Dias', 'Ganho', 'GMD', 'Apartação', 'Lote', 'Sessão', 'Observação',
];
const REIMPORT_HEADER_LINE = 'id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao';

const TRICKY_OBS = 'pasto; "novo"\nlinha 2\r\nlinha 3';
const rows = [
  {
    id: 'p-1', animal_id: 'a-1', id_externo: 22207, data_pesagem: '2026-09-01', tipo_manejo: 'Cadastro', numero_animal: '4368', marca: 'ALFA', marca_id: 'm-alfa',
    sexo: 'M', raca: 'Nelore', raca_id: 'r-nel', categoria_id: 'c-bez', categoria_nome: 'Bezerro', era: '12', peso: 1234.5,
    data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null, nome_apartacao: 'ROTINA', nome_lote: 'MEIO',
    sessao_label: '01/09/2026 · aberta', observacao: TRICKY_OBS, valor_pago_cabeca: 98765.43,
  },
  {
    id: 'p-2', animal_id: 'a-1', data_pesagem: '2026-09-15', tipo_manejo: 'Manejo', numero_animal: '4368', marca: '=HYPERLINK("http://x")', sexo: 'M',
    peso: 1250, data_anterior: '2026-09-01', peso_anterior: 1234.5, dias: 14, ganho: -3.5, gmd: -0.25, observacao: '+SOMA(A1)', nome_lote: '@lote',
    nome_apartacao: '-apart', valor_venda_total: 55555.55,
  },
  {
    id: 'p-3', animal_id: 'a-2', data_pesagem: '2026-09-16', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'Raio', numero_animal: 'SN', sexo: 'F',
    peso: null, peso_anterior: 0, dias: 0, gmd: 0, categoria_nome: { nome: 'Novilha' }, raca: { id: 'objeto-sem-nome' }, observacao: ['a', { nome: 'b' }],
  },
  null,
];

/** Remove células entre aspas (com "" escapado) para inspecionar só os separadores do arquivo. */
const outsideQuotes = (text) => text.replace(/"(?:[^"]|"")*"/g, '""');

// ---------------------------------------------------------------------------
// 1) Definições: ids únicos, perfis e sensibilidade coerentes com as colunas canônicas.
{
  const ids = WEIGHING_EXPORT_COLUMNS.map((column) => column.id);
  assert.equal(new Set(ids).size, ids.length, 'ids de coluna únicos');
  for (const column of WEIGHING_EXPORT_COLUMNS) {
    assert.ok(column.label && typeof column.label === 'string', `${column.id}: rótulo`);
    assert.equal(typeof column.accessor, 'function', `${column.id}: accessor`);
    assert.ok(column.profiles.includes(EXPORT_PROFILES.FRIENDLY), `${column.id}: disponível no amigável`);
    assert.equal(column.profiles.includes(EXPORT_PROFILES.REIMPORT), Boolean(column.technicalHeader), `${column.id}: perfil técnico só com cabeçalho técnico`);
  }
  for (const label of ['ID', 'Animal ID', 'Identificação', 'Marca', 'Marca ID', 'Sexo', 'Raça', 'Categoria', 'Era', 'Data', 'Tipo', 'Motivo da saída', 'Causa da morte', 'Peso', 'Peso anterior', 'Data anterior', 'Dias', 'Ganho', 'GMD', 'Apartação', 'Lote', 'Sessão', 'Observação']) {
    assert.ok(WEIGHING_EXPORT_COLUMNS.some((column) => column.label === label), `contrato distingue a coluna "${label}"`);
  }
  const canonicalCommercial = EVENT_COLUMNS.filter((column) => column.sensitive === 'commercial').map((column) => column.id);
  assert.ok(canonicalCommercial.length >= 8);
  for (const id of canonicalCommercial) assert.ok(COMMERCIAL_EXPORT_COLUMN_IDS.includes(id), `coluna comercial canônica continua sensível: ${id}`);
  assert.deepEqual(REIMPORT_HEADERS.join(';'), REIMPORT_HEADER_LINE, 'cabeçalhos técnicos exatos');
  assert.ok(DERIVED_COLUMN_IDS.every((id) => !columnsForProfile('REIMPORT').some((column) => column.id === id)), 'NEGATIVO: perfil técnico sem derivados');
  assert.deepEqual(FRIENDLY_DEFAULT_COLUMN_IDS.filter((id) => COMMERCIAL_EXPORT_COLUMN_IDS.includes(id)), [], 'padrão amigável sem valores comerciais');
  assert.throws(() => buildWeighingCsv(rows, { profile: 'XLSX' }), /Perfil de exportação inválido/, 'NEGATIVO: perfil desconhecido recusado');
  assert.throws(() => columnsForProfile('amigavel'), /Perfil de exportação inválido/);
}

// ---------------------------------------------------------------------------
// 2) FRIENDLY padrão: BOM, ";", CRLF, escape, fórmula, ausentes e formatos pt-BR.
const friendly = buildWeighingCsv(rows, { now: NOW });
{
  const { content } = friendly;
  assert.ok(content.startsWith(CSV_BOM) && content.charCodeAt(0) === 0xfeff, 'começa com BOM');
  assert.equal(content.charCodeAt(1), 'D'.charCodeAt(0), 'um único BOM');
  assert.ok(content.endsWith('\r\n'), 'termina com CRLF');
  const structure = outsideQuotes(content);
  assert.doesNotMatch(structure, /[^\r]\n/, 'toda quebra de linha fora de aspas é CRLF');
  assert.doesNotMatch(structure, /\r(?!\n)/, 'NEGATIVO: sem CR solto');
  assert.equal(structure.split('\r\n').length - 1, 4, 'cabeçalho + 3 linhas (linha nula ignorada)');
  assert.equal(friendly.rowCount, 3);
  assert.deepEqual(friendly.headers, FRIENDLY_HEADERS, 'cabeçalhos amigáveis estáveis');
  assert.equal(content.slice(1, content.indexOf('\r\n')), FRIENDLY_HEADERS.join(';'), 'separador ";" no cabeçalho');
  assert.match(friendly.fileName, /^pesagens-20260917-070509\.csv$/, 'nome pesagens-AAAAMMDD-HHMMSS.csv');

  const parsed = parseCsv(content);
  const [header, ...body] = parsed;
  assert.deepEqual(header, FRIENDLY_HEADERS);
  assert.equal(body.length, 3);
  for (const line of body) assert.equal(line.length, FRIENDLY_HEADERS.length, 'nenhuma coluna deslocada');
  const cell = (index, label) => body[index][FRIENDLY_HEADERS.indexOf(label)];

  assert.equal(cell(0, 'Observação'), TRICKY_OBS, 'escape preserva ";", aspas e quebras de linha');
  assert.ok(content.includes('"pasto; ""novo""'), 'célula com ";"/aspas vai entre aspas com aspas dobradas');
  assert.equal(cell(1, 'Marca'), `'=HYPERLINK("http://x")`, 'fórmula "=" neutralizada');
  assert.equal(cell(1, 'Observação'), "'+SOMA(A1)", 'fórmula "+" neutralizada');
  assert.equal(cell(1, 'Lote'), "'@lote", 'fórmula "@" neutralizada');
  assert.equal(cell(1, 'Apartação'), "'-apart", 'fórmula "-" (não numérica) neutralizada');
  assert.equal(cell(1, 'Ganho'), '-3,50', 'NEGATIVO: número negativo não recebe apóstrofo');
  assert.equal(cell(1, 'GMD'), '-0,250');

  assert.equal(cell(0, 'Data'), '01/09/2026', 'data dd/mm/aaaa');
  assert.equal(cell(0, 'Peso'), '1234,50', 'decimal com vírgula e sem milhar');
  assert.equal(cell(1, 'Peso anterior'), '1234,50');
  assert.equal(cell(1, 'Data anterior'), '01/09/2026');
  assert.equal(cell(1, 'Dias'), '14');
  assert.equal(cell(0, 'Sexo'), 'Macho');
  assert.equal(cell(2, 'Sexo'), 'Fêmea');
  assert.equal(cell(0, 'Tipo'), 'Cadastro');
  assert.equal(cell(2, 'Tipo'), 'Saída');
  assert.equal(cell(2, 'Motivo da saída'), 'Morte');
  assert.equal(cell(2, 'Causa da morte'), 'Raio');
  assert.equal(cell(0, 'Categoria'), 'Bezerro');
  assert.equal(cell(2, 'Categoria'), 'Novilha', 'objeto com nome vira o nome');
  assert.equal(cell(0, 'Sessão'), '01/09/2026 · aberta');
  assert.equal(cell(2, 'Observação'), 'a, b', 'lista vira texto');

  for (const label of ['Data anterior', 'Peso anterior', 'Dias', 'Ganho', 'GMD']) assert.equal(cell(0, label), '', `ausente vazio: ${label}`);
  assert.equal(cell(2, 'Peso'), '', 'Saída sem peso: vazio (nunca 0)');
  assert.equal(cell(2, 'Peso anterior'), '', 'peso 0 não é pesagem: vazio');
  assert.equal(cell(2, 'Raça'), '', 'objeto sem nome: vazio');
  assert.equal(cell(2, 'Dias'), '0', 'zero real continua zero');
  assert.equal(cell(2, 'GMD'), '0,000');
  for (const forbidden of ['[object Object]', '--/--/----', '—', 'undefined', 'null', 'NaN', '1.234']) {
    assert.ok(!content.includes(forbidden), `NEGATIVO: conteúdo sem ${JSON.stringify(forbidden)}`);
  }
  assert.ok(!content.includes('98765') && !content.includes('55555'), 'NEGATIVO: padrão sem valores comerciais');
}

// ---------------------------------------------------------------------------
// 3) Colunas da tela: ordem respeitada, ids de controle ignorados, Tipo e Motivo sempre presentes.
{
  const visible = buildWeighingCsv(rows, { columns: ['selecao', 'acoes', 'numero_animal', 'peso', 'xpto', 'peso'] });
  assert.deepEqual(visible.headers, ['Tipo', 'Motivo da saída', 'Identificação', 'Peso'], 'Tipo/Motivo entram; controles, desconhecidos e repetidos saem');
  const withDate = buildWeighingCsv(rows, { columns: ['numero_animal', 'data_pesagem', 'gmd'] });
  assert.deepEqual(withDate.headers, ['Identificação', 'Data', 'Tipo', 'Motivo da saída', 'GMD'], 'Tipo/Motivo logo após a Data');
  const ordered = buildWeighingCsv(rows, { columns: ['gmd', 'motivo_saida', 'tipo_manejo', 'marca'] });
  assert.deepEqual(ordered.headers, ['GMD', 'Motivo da saída', 'Tipo', 'Marca'], 'ordem da tela preservada quando Tipo/Motivo estão visíveis');
  const ids = buildWeighingCsv(rows, { columns: ['id', 'animal_id', 'marca_id', 'raca_id', 'categoria_id', 'id_externo'] });
  assert.equal(parseCsv(ids.content)[1].slice(-6).join('|'), 'p-1|a-1|m-alfa|r-nel|c-bez|22207', 'ids técnicos disponíveis no amigável quando pedidos');
  const empty = buildWeighingCsv([], { columns: ['data_pesagem'] });
  assert.equal(empty.content, `${CSV_BOM}Data;Tipo;Motivo da saída\r\n`, 'sem linhas: só o cabeçalho');
  assert.equal(empty.rowCount, 0);
  const fechamento = buildWeighingCsv(rows, { columns: ['data_pesagem'], fileBase: 'fechamento 2026/09/17', now: NOW });
  assert.equal(fechamento.fileName, 'fechamento-2026-09-17-20260917-070509.csv', 'fileBase saneado para nome de arquivo');
}

// ---------------------------------------------------------------------------
// 4) Valores comerciais: só com permissão (contrato) e só com commercial.values (serviço).
{
  const requested = ['numero_animal', 'valor_pago_cabeca', 'valor_venda_total'];
  const hidden = buildWeighingCsv(rows, { columns: requested, canSeeCommercial: false });
  assert.ok(!hidden.headers.includes('Valor compra') && !hidden.headers.includes('Valor venda'), 'NEGATIVO: sem permissão a coluna comercial não sai');
  assert.ok(!hidden.content.includes('98765') && !hidden.content.includes('55555'), 'NEGATIVO: nenhum valor comercial vaza');
  const shown = buildWeighingCsv(rows, { columns: requested, canSeeCommercial: true });
  assert.deepEqual(shown.headers, ['Tipo', 'Motivo da saída', 'Identificação', 'Valor compra', 'Valor venda']);
  assert.ok(shown.content.includes('98765,43') && shown.content.includes('55555,55'), 'com permissão os valores saem sem "R$" e sem milhar');
  const defaultWithValues = buildWeighingCsv(rows, { canSeeCommercial: true });
  for (const id of COMMERCIAL_EXPORT_COLUMN_IDS) {
    const label = WEIGHING_EXPORT_COLUMNS.find((column) => column.id === id).label;
    assert.ok(defaultWithValues.headers.includes(label), `padrão com permissão inclui ${label}`);
  }

  const as = (role) => setActorProvider(() => (role ? { id: `u-${role}`, nome: role, role } : null));
  as('CONSULTA');
  const consulta = exportWeighingCsv(rows, { columns: requested, canSeeCommercial: true });
  assert.ok(!consulta.headers.includes('Valor compra') && !consulta.content.includes('98765'), 'NEGATIVO: CONSULTA exporta sem valores mesmo se a tela pedir');
  as('GESTOR');
  assert.ok(exportWeighingCsv(rows, { columns: requested, canSeeCommercial: true }).headers.includes('Valor compra'), 'GESTOR exporta valores');
  assert.ok(!exportWeighingCsv(rows, { columns: requested, canSeeCommercial: false }).headers.includes('Valor compra'), 'pedido da tela só restringe');
  as('OPERADOR');
  assert.throws(() => exportWeighingCsv(rows, {}), (error) => error.code === 'AUTH_FORBIDDEN', 'NEGATIVO: OPERADOR sem reports.export');
  as(null);
  assert.throws(() => exportWeighingCsv(rows, {}), (error) => error.code === 'AUTH_FORBIDDEN', 'NEGATIVO: sem sessão com autenticação ativa, falha fechada');
  setActorProvider(null);
  assert.equal(exportWeighingCsv(rows, { profile: 'REIMPORT' }).rowCount, 3, 'sem provedor (Node) a verificação não se aplica');
}

// ---------------------------------------------------------------------------
// 5) REIMPORT: cabeçalhos técnicos, ISO, ponto, sem derivados; colunas da tela não mudam o contrato.
{
  const technical = buildWeighingCsv(rows, { profile: 'REIMPORT', columns: ['peso'], canSeeCommercial: true, now: NOW });
  assert.equal(technical.content.slice(1, technical.content.indexOf('\r\n')), REIMPORT_HEADER_LINE, 'cabeçalho técnico exato');
  assert.deepEqual(technical.headers, [...REIMPORT_HEADERS]);
  assert.match(technical.fileName, /^pesagens-reimportacao-20260917-070509\.csv$/);
  const [header, ...body] = parseCsv(technical.content);
  const cell = (index, name) => body[index][header.indexOf(name)];
  assert.equal(cell(0, 'data'), '2026-09-01', 'data ISO');
  assert.equal(cell(0, 'peso'), '1234.5', 'decimal com ponto');
  assert.equal(cell(1, 'peso'), '1250');
  assert.equal(cell(2, 'peso'), '', 'Saída sem peso: vazio');
  assert.equal(cell(0, 'sexo'), 'M');
  assert.equal(cell(2, 'sexo'), 'F');
  assert.equal(cell(0, 'id_externo'), '22207');
  assert.equal(cell(0, 'numero'), '4368');
  assert.equal(cell(0, 'categoria'), 'Bezerro');
  assert.equal(cell(0, 'observacao'), TRICKY_OBS);
  assert.equal(cell(2, 'tipo'), 'Saída');
  assert.equal(cell(2, 'motivo_saida'), 'Morte');
  for (const derived of ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd']) assert.ok(!header.includes(derived), `NEGATIVO: sem derivado ${derived}`);
  assert.ok(!technical.content.includes('98765'), 'NEGATIVO: técnico nunca leva valores comerciais');
  assert.ok(!technical.content.includes('1234,5') && !technical.content.includes('01/09/2026'), 'NEGATIVO: nada no formato amigável');
  assert.notDeepEqual(friendly.headers, technical.headers, 'NEGATIVO: perfis distintos');
}

// ---------------------------------------------------------------------------
// 6) CSV técnico da Manutenção a partir de registros Dexie crus.
{
  const ts = (hour) => `2026-09-02T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const storageRows = [
    { localId: 1, id: 't-1', data_pesagem: '2026-09-02', peso_kg: 300, animal_id: 'a-9', tipo_pesagem: 'Manejo', observacao: null, created_at: ts(10), legacy_payload: { tipo_manejo: 'Manejo', numero_animal: '9', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'Macho', categoria_id: 'c-bez', ganho: 10, gmd: 1 } },
    { localId: 2, id: 't-0', data_pesagem: '2026-09-01', peso_kg: 320.40000000000003, animal_id: 'a-9', tipo_pesagem: 'Cadastro', observacao: 'entrada', created_at: ts(8), legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: '9', marca_id: 'm-alfa', sexo: 'M' } },
    { localId: 3, id: 't-1', data_pesagem: '2026-09-02', peso_kg: 301, animal_id: 'a-9', tipo_pesagem: 'Manejo', observacao: null, created_at: ts(10), legacy_payload: { tipo_manejo: 'Manejo', numero_animal: '9', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'Macho', categoria_id: 'c-bez' } },
    { localId: 4, id: 't-x', data_pesagem: '2026-09-01', peso_kg: 999, animal_id: 'a-7', tipo_pesagem: 'Manejo', deleted_at: ts(12), created_at: ts(9), legacy_payload: { tipo_manejo: 'Manejo', numero_animal: '7' } },
    { localId: 5, id: 't-2', data_pesagem: '2026-09-02', peso_kg: 280, animal_id: 'a-8', tipo_pesagem: 'Cadastro', observacao: null, created_at: ts(11), legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: '8', marca: 'BETA', sexo: 'F', categoria_id: 'c-nov' } },
  ];
  const lookups = { marcas: [{ id: 'm-alfa', nome: 'ALFA' }], categorias: new Map([['c-bez', 'Bezerro'], ['c-nov', 'Novilha']]) };
  const technical = buildWeighingTechnicalCsv(storageRows, { lookups, now: NOW });
  const [header, ...body] = parseCsv(technical.content);
  assert.deepEqual(header, [...REIMPORT_HEADERS]);
  assert.deepEqual(body.map((line) => line[0]), ['t-0', 't-2', 't-1'], 'cronologia canônica: data → Cadastro antes de Manejo; apagado fora; id duplicado uma vez');
  const byId = new Map(body.map((line) => [line[0], Object.fromEntries(header.map((name, index) => [name, line[index]]))]));
  assert.equal(byId.get('t-1').peso, '301', 'duplicado por id: vale o localId mais recente');
  assert.equal(byId.get('t-0').peso, '320.4', 'sem ruído binário');
  assert.equal(byId.get('t-0').marca, 'ALFA', 'nome da marca pelos cadastros quando o evento não traz texto');
  assert.equal(byId.get('t-1').categoria, 'Bezerro', 'nome da categoria pelos cadastros');
  assert.equal(byId.get('t-1').sexo, 'M', 'sexo legado normalizado para código');
  assert.equal(byId.get('t-0').observacao, 'entrada');
  assert.ok(!technical.content.includes('999'), 'NEGATIVO: registro apagado não sai');
  assert.equal(technical.rowCount, 3);
  assert.match(technical.fileName, /^pesagens-reimportacao-\d{8}-\d{6}\.csv$/);
}

// ---------------------------------------------------------------------------
// 7) Inspeção de fonte: as telas usam o contrato (nenhum CSV montado à mão).
// Falha com a mensagem do contrato, sem despejar o arquivo inteiro no terminal.
const has = (source, pattern, message) => assert.ok(pattern.test(source), message);
const hasNot = (source, pattern, message) => assert.ok(!pattern.test(source), message);
const contractSource = read('src/modules/weighing/export/weighingExportContract.js');
has(contractSource, /import \{ CSV_BOM, CSV_NEWLINE, CSV_SEPARATOR, csvCell \} from '\.\.\/\.\.\/reporting\/infrastructure\/exporters\/csvExporter\.js'/, 'contrato usa o CSV canônico');
has(contractSource, /measuredWeightOf/, 'peso ausente pela regra canônica (weighingSeries)');

const relation = read('src/pages/PesagensIndividuais.jsx');
has(relation, /import \{ exportWeighingCsv \} from "@\/modules\/weighing\/export\/weighingExportService"/, 'Relação importa o serviço de exportação');
has(relation, /import \{ EXPORT_PROFILES \} from "@\/modules\/weighing\/export\/weighingExportContract"/, 'Relação usa os perfis do contrato');
const relationExport = relation.slice(relation.indexOf('const exportarCSV'), relation.indexOf('const toggleSelectAll'));
has(relationExport, /exportWeighingCsv\(pesagensFiltradas, \{/, 'mesma população filtrada/ordenada da tela');
has(relationExport, /columns: colunasOrdenadas\.map\(\(coluna\) => coluna\.id\)/, 'colunas visíveis na ordem da tela');
has(relationExport, /canSeeCommercial: podeVerValores/, 'valores comerciais pela permissão da tela');
hasNot(relationExport, /join\(';'\)|fmtDateBR|new Blob/, 'NEGATIVO: sem CSV montado à mão na Relação');
has(relation, /\.\.\.\(podeExportar \? \[\s*\{ id: "exportar", label: "Exportar relatório \(CSV\)"[^\n]*EXPORT_PROFILES\.FRIENDLY[^\n]*\n\s*\{ id: "exportar-reimportacao", label: "Exportar para reimportação \(CSV\)"[^\n]*EXPORT_PROFILES\.REIMPORT/, 'menu com os dois perfis, só com reports.export');
hasNot(relation, /pesagens_individuais_\$\{/, 'NEGATIVO: nome de arquivo antigo');

const closing = read('src/pages/FechamentoDia.jsx');
has(closing, /import \{ exportWeighingCsv \} from '@\/modules\/weighing\/export\/weighingExportService'/, 'Fechamento importa o serviço de exportação');
const closingExport = closing.slice(closing.indexOf('const exportCsv'), closing.indexOf('const backupDay'));
has(closingExport, /exportWeighingCsv\(\[\.\.\.rows\]\.sort\(compareWeighingEvents\), \{ columns: FECHAMENTO_CSV_COLUMNS/, 'Fechamento exporta pelo contrato na cronologia canônica');
has(closing, /const FECHAMENTO_CSV_COLUMNS = \[[^\]]*'tipo_manejo', 'motivo_saida'[^\]]*'peso'/, 'Fechamento leva Tipo, Motivo e Peso');
has(closing, /const podeExportar = auth \? Boolean\(auth\.can\?\.\('reports\.export'\)\) : true/, 'Fechamento: botão só com reports.export');
has(closing, /\{podeExportar \? <button[^>]*onClick=\{exportCsv\}/);
hasNot(closing, /const csvCell =|Number\(row\.peso\) \|\| 0/, 'NEGATIVO: sem escape local nem peso ausente = 0');

const launch = read('src/pages/LancamentoPesagensIndividuais.jsx');
has(launch, /from ["']@\/modules\/weighing\/export\/weighing(ExportContract|ExportService)["']/, 'Lançamento importa o contrato de exportação');
has(launch, /\b(buildWeighingCsv|exportWeighingCsv)\(/, 'Lançamento chama buildWeighingCsv (ou o serviço que o envolve)');
hasNot(launch, /\[headers\.join\(';'\), \.\.\.rows\.map\(\(r\) => r\.join\(';'\)\)\]/, 'NEGATIVO: Lançamento sem CSV montado à mão');

console.log(JSON.stringify({
  gate: 'export:weighing-contract:verify',
  ok: true,
  columns: WEIGHING_EXPORT_COLUMNS.length,
  friendlyHeaders: FRIENDLY_HEADERS.length,
  reimportHeaders: REIMPORT_HEADERS.length,
  commercialColumns: COMMERCIAL_EXPORT_COLUMN_IDS.length,
  screens: ['Relação', 'Fechamento', 'Lançamento'],
}, null, 2));
