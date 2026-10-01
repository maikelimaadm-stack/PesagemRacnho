// Corpo da folha no layout "vendas" (E1D; E1E: também Comercial › Abates e Compras): o relatório de venda do
// MAKGESTAO, igual ao PDF da responsável — tabela Métrica | Valor, TOTAIS POR MARCA, TOTAIS POR COMPRADOR |
// FRIGORÍFICO | ORIGEM e o bloco DETALHADO com um cartão por grupo (e os lançamentos dele com "Mostrar Detalhes")
// e a linha TOTAL GERAL à direita. Só desenha os blocos de domain/vendasLayout (doc.vendas): nenhuma conta aqui.
// Cabeçalho, título, período e rodapé continuam os da folha comum (sheetHtml.renderSheetBody chama esta função só
// para o miolo). Estilo em sheetStyles.js (bloco ".sheet-vendas", classes sv-* iguais nos três desenhos), copiado
// das classes Tailwind do antigo.
// escapeHtml vem de sheetHtml (que importa este arquivo): só é chamado na renderização, nunca ao carregar.
import { GMD_GRAY_CLASS, escapeHtml, renderHeaderCell } from './sheetHtml.js';

const ALIGN = Object.freeze({ left: 'sv-l', right: 'sv-r', center: 'sv-c' });

function cellClass({ align = 'left', numeric = false, strong = false, emphasis = null } = {}) {
  return [ALIGN[align] ?? 'sv-l', numeric ? 'sv-num' : '', strong || emphasis === 'semibold' ? 'sv-semibold' : '', emphasis === 'medium' ? 'sv-medium' : ''].filter(Boolean).join(' ');
}

function head(columns) {
  return `<thead><tr>${columns.map((column) => `<th class="${ALIGN[column.align] ?? 'sv-l'}" data-key="${escapeHtml(column.key)}" scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>`;
}

// Métrica | Valor. A linha "Valor total" vai em negrito (font-bold text-slate-800), como no antigo.
function renderResumo(resumo) {
  const rows = resumo.rows.map((row) => `<tr${row.strong ? ' class="sv-strong"' : ''} data-key="${escapeHtml(row.key)}"><td class="sv-l">${escapeHtml(row.label)}</td><td class="sv-r sv-num">${escapeHtml(row.text)}</td></tr>`);
  return `<table class="sv-table sv-table--resumo" data-block="resumo">${head(resumo.columns)}<tbody>${rows.join('')}</tbody></table>`;
}

// TOTAIS POR MARCA / TOTAIS POR <grupo>: rótulo à esquerda, Qtd ao centro, números à direita em fonte mono.
function renderTotais(block, id) {
  const rows = block.rows.map((row) => {
    const cells = row.cells.map((cell) => `<td class="${cellClass({ align: cell.align, numeric: cell.align !== 'center', strong: cell.strong })}" data-key="${escapeHtml(cell.key)}">${escapeHtml(cell.text)}</td>`);
    return `<tr data-row-id="${escapeHtml(row.id)}"><td class="sv-l">${escapeHtml(row.label)}</td>${cells.join('')}</tr>`;
  });
  return `<section class="sv-block" data-block="${id}"><div class="sv-title">${escapeHtml(block.title)}</div><table class="sv-table">${head(block.columns)}<tbody>${rows.join('')}</tbody></table></section>`;
}

// Tabela "Mostrar Detalhes" abaixo do cartão: as colunas do tipo (seletor "Colunas"), números à direita.
// E1F: na tela, o cabeçalho interativo (menu e puxador — sheetHtml.renderHeaderCell); com largura escolhida
// pela pessoa, as larguras da folha (doc.print) em colgroup, na tela, na impressão e no PDF.
function renderDetail(columns, rows, { headerMenu = false, sort = null, widthPercents = null } = {}) {
  // M1: GMD de intervalo curto em cinza, com o motivo no title (a mesma marca da folha comum — sheetHtml).
  const gmdMark = (cell) => (cell.gmd?.cinza ? { cls: ` ${GMD_GRAY_CLASS}`, attrs: ` title="${escapeHtml(`GMD não entra na média: ${cell.gmd.aviso ?? 'intervalo curto'}`)}" data-gmd="${escapeHtml(cell.gmd.qualidade ?? 'NAO_CONFIAVEL')}"` } : { cls: '', attrs: '' });
  const body = rows.map((row) => `<tr data-row-id="${escapeHtml(row.id)}">${row.cells.map((cell) => { const mark = gmdMark(cell); return `<td class="${cellClass({ align: cell.align, numeric: cell.align === 'right', emphasis: cell.emphasis })}${mark.cls}" data-key="${escapeHtml(cell.key)}"${mark.attrs}>${escapeHtml(cell.text)}</td>`; }).join('')}</tr>`);
  const thead = headerMenu ? `<thead><tr>${columns.map((column, index) => renderHeaderCell({ ...column, kind: 'data' }, index, { cls: ALIGN[column.align] ?? 'sv-l', sort })).join('')}</tr></thead>` : head(columns);
  const fixed = widthPercents?.length === columns.length;
  const colgroup = fixed ? `<colgroup>${widthPercents.map((percent) => `<col style="width:${percent}%">`).join('')}</colgroup>` : '';
  return `<table class="sv-table sv-table--detail"${fixed ? ' style="table-layout: fixed"' : ''}>${colgroup}${thead}<tbody>${body.join('')}</tbody></table>`;
}

// Cartão do grupo: título "COMPRADOR: X" (FRIGORÍFICO/ORIGEM) e os totais em grade de 2 colunas ("Total: 90 animais").
function renderGrupo(entry, detailColumns, options) {
  const totals = entry.totals.map((total) => `<div data-key="${escapeHtml(total.key)}"><strong>${escapeHtml(total.label)}:</strong> ${escapeHtml(total.display)}</div>`).join('');
  const card = `<div class="sv-card"><h3 class="sv-card__title">${escapeHtml(entry.title)}</h3><div class="sv-card__grid">${totals}</div></div>`;
  const detail = entry.rows && detailColumns ? renderDetail(detailColumns, entry.rows, options) : '';
  return `<div class="sv-comprador${detail ? ' sv-comprador--detalhes' : ''}" data-grupo="${escapeHtml(entry.id)}">${card}${detail}</div>`;
}

/**
 * Miolo da folha do relatório de venda (dentro de td.sheet-body). Todo texto passa por escapeHtml.
 * @param doc documento de buildReportDocument com layout "vendas" (doc.vendas = buildVendasBlocks)
 * @param {{ headerMenu?: boolean, sort?: object|null }} options E1F: cabeçalho interativo da tabela de detalhe (só na tela)
 */
export function renderVendasBody(doc, { headerMenu = false, sort = null } = {}) {
  const blocks = doc.vendas;
  const detailOptions = { headerMenu, sort, widthPercents: doc.print?.userWidths?.length ? doc.print.widthPercents : null };
  const grupos = blocks.grupos.items.map((entry) => renderGrupo(entry, blocks.grupos.detailColumns, detailOptions)).join('\n');
  return `<div class="sheet-vendas${blocks.showDetails ? ' sheet-vendas--detalhes' : ''}" data-sheet-layout="${escapeHtml(blocks.layout ?? 'vendas')}" data-show-details="${blocks.showDetails}">
${renderResumo(blocks.resumo)}
${renderTotais(blocks.porMarca, 'marca')}
${renderTotais(blocks.porGrupo, 'grupo')}
<section class="sv-block sv-block--compradores" data-block="grupos"><div class="sv-title">${escapeHtml(blocks.grupos.title)}</div>
${grupos}
</section>
<div class="sv-total-geral" data-block="total-geral">${escapeHtml(blocks.totalGeral.text)}</div>
</div>`;
}
