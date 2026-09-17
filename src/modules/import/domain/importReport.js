// Relatório de conciliação exportável (dry-run e resultado). Reaproveita o CSV canônico do
// reporting (csvCell: aspas quando preciso e proteção contra fórmula; UTF-8 com BOM; ";";
// CRLF). Datas dd/mm/aaaa e números com vírgula, sem milhar; ausente = vazio.
import { CSV_BOM, CSV_NEWLINE, CSV_SEPARATOR, csvCell } from '../../reporting/infrastructure/exporters/csvExporter.js';
import { IMPORT_TYPE_LABELS, ROW_STATUS } from './importConstants.js';

const brDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const brNumber = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '' : String(value).replace('.', ','));
const line = (cells) => cells.map(csvCell).join(CSV_SEPARATOR);

export const PLAN_CSV_HEADERS = Object.freeze([
  'linha', 'situacao', 'tipo_evento', 'animal', 'animal_id', 'animal_novo', 'data', 'peso', 'categoria', 'origem_categoria',
  'data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd', 'mensagens',
]);

function planRowCells(row) {
  return [
    row.line,
    row.status,
    row.eventType || '',
    row.identity?.label || '',
    row.identity?.animalId || '',
    row.identity?.isNew ? 'Sim' : 'Não',
    brDate(row.data),
    brNumber(row.peso),
    row.categoria?.nome || '',
    row.categoria?.origem || '',
    brDate(row.derived?.data_anterior),
    brNumber(row.derived?.peso_anterior),
    brNumber(row.derived?.dias),
    brNumber(row.derived?.ganho),
    brNumber(row.derived?.gmd),
    (row.messages || []).join(' | '),
  ];
}

/** planToCsv(plan) → texto CSV (BOM, ";", CRLF) com uma linha por linha do plano. */
export function planToCsv(plan) {
  const out = [line(PLAN_CSV_HEADERS)];
  for (const row of plan?.rows || []) out.push(line(planRowCells(row)));
  return CSV_BOM + out.join(CSV_NEWLINE) + CSV_NEWLINE;
}

export const RESULT_METRICS = Object.freeze([
  ['importacaoId', 'Importação'],
  ['linhasProcessadas', 'Linhas processadas'],
  ['cadastrosCriados', 'Cadastros criados'],
  ['manejosCriados', 'Manejos criados'],
  ['saidasCriadas', 'Saídas criadas'],
  ['animaisConciliados', 'Animais conciliados'],
  ['animaisNovos', 'Animais novos'],
  ['duplicidadesIgnoradas', 'Duplicidades ignoradas'],
  ['erros', 'Erros'],
  ['seriesRecalculadas', 'Séries recalculadas'],
  ['categoriasResolvidasAutomaticamente', 'Categorias resolvidas automaticamente'],
  ['cadastrosMestresCriados', 'Cadastros mestres criados'],
  ['aplicacoesCriadas', 'Aplicações de sanidade criadas'],
]);

/**
 * resultToCsv(result, plan) → CSV com o resumo (metrica;valor), uma linha em branco e o
 * relatório do plano acrescido da coluna `resultado` (GRAVADO / NÃO GRAVADO).
 */
export function resultToCsv(result = {}, plan = null) {
  const out = [line(['metrica', 'valor'])];
  if (plan?.type) out.push(line(['Tipo de importação', IMPORT_TYPE_LABELS[plan.type] || plan.type]));
  for (const [key, label] of RESULT_METRICS) out.push(line([label, result[key] ?? '']));
  if (plan?.rows?.length) {
    out.push('');
    out.push(line([...PLAN_CSV_HEADERS, 'resultado']));
    const written = new Set(result.linhasGravadas || []);
    for (const row of plan.rows) {
      const gravado = written.size ? written.has(row.line) : row.status === ROW_STATUS.NOVO && Boolean(result.importacaoId);
      out.push(line([...planRowCells(row), gravado ? 'GRAVADO' : 'NÃO GRAVADO']));
    }
  }
  return CSV_BOM + out.join(CSV_NEWLINE) + CSV_NEWLINE;
}
