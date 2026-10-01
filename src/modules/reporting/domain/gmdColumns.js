// M1 (1.5.0) — qualidade do GMD nas colunas dos relatórios (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.2).
// Consome o CONTRATO congelado (src/modules/weighing/domain/gmdQuality.js): classifyGmd, isGmdConfiavel e o
// formatador compartilhado gmdExibicao. Nenhuma regra de qualidade nova mora aqui — só a ligação com as colunas.
//
// Uma coluna de GMD declara de onde vêm os dias do intervalo e onde a linha guarda a qualidade derivada:
//   gmdQuality: { dias: 'dias', qualidade: 'gmd_qualidade', motivo: 'gmd_motivo' }
// A fonte grava a qualidade na LEITURA (annotateGmdQuality, com o mínimo de Configurações › Relatórios); o fato
// gravado (pesagens.gmd) não muda. A partir daí:
//   - toda conta de GMD (média, ponderado, mínimo, máximo, contagem, subtotal, total, "Calcular", matriz, gráfico,
//     linha de texto do resumo) usa SÓ as linhas CONFIAVEL (reportAggregates.computeAggregate);
//   - a folha, o CSV e o XLSX mostram o mesmo número, em cinza e com o aviso, no NAO_CONFIAVEL (gmdExibicao).
import {
  GMD_DIAS_MINIMOS_PADRAO, GMD_QUALIDADE, classifyGmd, gmdExibicao, isGmdConfiavel, normalizeGmdDiasMinimos,
} from '../../weighing/domain/gmdQuality.js';

const QUALIDADES = new Set(Object.values(GMD_QUALIDADE));

/** A coluna tem qualidade de GMD declarada? */
export function hasGmdQuality(column) {
  return Boolean(column?.gmdQuality);
}

const fieldOrFn = (spec, row) => (typeof spec === 'function' ? spec(row) : row?.[spec]);
const gmdValueOf = (column, row) => (column.accessor ? column.accessor(row) : row?.[column.id]);

/**
 * Qualidade do GMD de uma linha numa coluna. A gravada pela fonte (annotateGmdQuality) quando existe; linha sem ela
 * (montada fora da fonte) é classificada na hora com o mínimo padrão (21) — nunca entra na média sem passar pela regra.
 * @returns {{ gmdQualidade: string, gmdMotivo: string|null } | null} null = coluna sem qualidade declarada
 */
export function gmdQualityOf(column, row) {
  const spec = column?.gmdQuality;
  if (!spec) return null;
  const stored = row?.[spec.qualidade];
  if (QUALIDADES.has(stored)) return { gmdQualidade: stored, gmdMotivo: row?.[spec.motivo] ?? null };
  return classifyGmd({ dias: fieldOrFn(spec.dias, row), gmd: gmdValueOf(column, row) }, GMD_DIAS_MINIMOS_PADRAO);
}

/** A linha entra nas contas desta coluna? Coluna sem qualidade declarada: sempre (não é GMD). */
export function entersGmdMath(column, row) {
  const quality = gmdQualityOf(column, row);
  return quality === null || isGmdConfiavel(quality.gmdQualidade);
}

/** Só as linhas que entram nas contas da coluna (a própria lista quando a coluna não tem qualidade). */
export function reliableRowsOf(column, rows) {
  if (!hasGmdQuality(column)) return rows;
  return rows.filter((row) => entersGmdMath(column, row));
}

/**
 * Grava a qualidade derivada nas linhas (na leitura — nenhum campo novo no banco): para cada coluna com
 * gmdQuality, `row[qualidade]` e `row[motivo]` pelos dias do intervalo e pelo mínimo (7/14/21/28; inválido → 21).
 * Muta as linhas recebidas (são as linhas canônicas recém-montadas pela fonte) e devolve o mínimo usado.
 */
export function annotateGmdQuality(rows, columns, diasMinimos = GMD_DIAS_MINIMOS_PADRAO) {
  const minimo = normalizeGmdDiasMinimos(diasMinimos);
  const gmdColumns = (columns ?? []).filter(hasGmdQuality);
  if (!gmdColumns.length) return minimo;
  for (const row of rows ?? []) {
    for (const column of gmdColumns) {
      const spec = column.gmdQuality;
      const { gmdQualidade, gmdMotivo } = classifyGmd({ dias: fieldOrFn(spec.dias, row), gmd: gmdValueOf(column, row) }, minimo);
      row[spec.qualidade] = gmdQualidade;
      row[spec.motivo] = gmdMotivo;
    }
  }
  return minimo;
}

/**
 * Como o GMD de uma linha aparece (o formatador compartilhado do contrato) — null quando a coluna não tem qualidade.
 * @param {(value:number)=>string} format o formatador de número da camada (folha, CSV…)
 * @returns {null | { texto, cinza, aviso, entraNaMedia, gmdQualidade }}
 */
export function gmdCellOf(column, row, format) {
  const quality = gmdQualityOf(column, row);
  if (!quality) return null;
  const shown = gmdExibicao({ gmd: gmdValueOf(column, row), ...quality }, format ? { format } : undefined);
  return { ...shown, gmdQualidade: quality.gmdQualidade };
}

/** O GMD da linha está no cinza (NAO_CONFIAVEL com número)? */
export function isGrayGmd(column, row) {
  return Boolean(gmdCellOf(column, row)?.cinza);
}

/** Cabeçalho da coluna do aviso no CSV/XLSX, logo após o GMD: "Aviso do GMD" (ou do "Último GMD", …). */
export function gmdWarningHeader(column) {
  const label = String(column?.label ?? 'GMD').trim();
  return label === 'GMD' ? 'Aviso do GMD' : `Aviso do ${label}`;
}

/** Nota do rodapé quando a folha tem GMD em cinza (texto de curral, curto). */
export function gmdGrayNote(diasMinimos) {
  return `GMD em cinza = intervalo menor que ${normalizeGmdDiasMinimos(diasMinimos)} dias: não entra na média`;
}

export { GMD_QUALIDADE };
