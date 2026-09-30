// Renderizador ÚNICO da folha do relatório (E1B 1.4.0): transforma o documento puro (domain/reportDocument)
// em marcação HTML — a mesma na tela (fragmento dentro do app), na impressão e no PDF (documento completo).
// Todo texto passa por escapeHtml; o logo só entra se for data URL PNG/JPEG válido. Cada célula leva
// data-col=<índice> igual ao do cabeçalho da sua coluna (base do gate de alinhamento).
// E1D visual: documento com style 'makgestao' sai com o desenho da folha do antigo (seção abaixo). E1E: é o
// estilo de todo relatório (os 5 desenhos de Pesagens e o resumo/lista genéricos); o desenho da E1B só sobra
// para documento sem relatório.
import { isAcceptedLogo } from '../../../catalog/domain/propertyHeader.js';
import { renderVendasBody } from './vendasHtml.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Cabeçalho da propriedade na folha (e na pré-visualização da ficha da Propriedade): logo, produtor,
 * fazenda, endereço – município-UF e, só com "Mostrar no cabeçalho" ligado, CPF/CNPJ, IE e telefone
 * (buildPropertyHeader decide). E1D item 8: o canto direito fica vazio — o período vai abaixo do título e
 * "Emitido por … em …" só no rodapé (a coluna continua, para o nome ficar centralizado).
 * @param header modelo de buildPropertyHeader (catalog/domain/propertyHeader.js)
 */
export function renderSheetHeaderHtml(header) {
  const model = header ?? { empty: true, titular: 'Pesagens Individuais' };
  const logo = model.logo && isAcceptedLogo(model.logo) ? `<img class="sheet-logo" src="${escapeHtml(model.logo)}" alt="Logo">` : '';
  const lines = [
    `<div class="sheet-titular">${escapeHtml(model.titular)}</div>`,
    model.fazenda ? `<div class="sheet-fazenda">${escapeHtml(model.fazenda)}</div>` : '',
    model.endereco ? `<div class="sheet-endereco">${escapeHtml(model.endereco)}</div>` : '',
    model.documentos ? `<div class="sheet-docs">${escapeHtml(model.documentos)}</div>` : '',
    model.telefone ? `<div class="sheet-docs">${escapeHtml(model.telefone)}</div>` : '',
  ].join('');
  return `<div class="sheet-header${model.empty ? ' sheet-header--system' : ''}"><div class="sheet-header__logo">${logo}</div><div class="sheet-header__id">${lines}</div><div class="sheet-header__meta"></div></div>`;
}

const ROW_CLASS = Object.freeze({
  GROUP: 'sheet-row',
  DATA: 'sheet-row sheet-data',
  SUBTOTAL: 'sheet-subtotal',
  LEAF_TOTAL: 'sheet-row sheet-leaf-total',
  TOTAL: 'sheet-total',
  GRAND_TOTAL: 'sheet-grand',
});

function cellClass(cell) {
  if (cell.kind === 'label') return 'lbl';
  return cell.kind === 'num' ? 'num' : 'txt';
}

function renderHeadRow(doc, { interactive, sort }) {
  const cells = doc.columns.map((column, index) => {
    const cls = column.align === 'left' ? ' class="lbl"' : '';
    let content = escapeHtml(column.label);
    if (interactive && column.kind === 'metric' && doc.layout === 'summary') {
      const state = sort?.key === column.key ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none';
      content = `<button type="button" class="sheet-sort" data-sort="${escapeHtml(column.key)}" aria-sort="${state}" title="Ordenar os grupos por ${escapeHtml(column.label)}">${escapeHtml(column.label)}</button>`;
    }
    return `<th data-col="${index}" data-key="${escapeHtml(column.key)}"${cls} scope="col">${content}</th>`;
  });
  return `<tr>${cells.join('')}</tr>`;
}

function renderRow(doc, row, { interactive }) {
  const cls = ROW_CLASS[row.type] ?? 'sheet-row';
  const attrs = `class="${cls}" data-row-type="${row.type}" data-row-id="${escapeHtml(row.id)}"`;
  if (row.chips) {
    const items = row.chips.items.map((item) => `<span class="sheet-chip">${escapeHtml(item.label)}: <b>${escapeHtml(item.text)}</b></span>`).join('');
    return `<tr ${attrs}><td class="sheet-chips" data-col="0" colspan="${doc.columns.length}"><strong>${escapeHtml(row.chips.title)}</strong> · ${items}</td></tr>`;
  }
  const cells = row.cells.map((cell) => {
    // Matriz (E1D): a célula leva vários valores (Qtd, Peso médio, GMD), um embaixo do outro.
    let text = Array.isArray(cell.lines) ? cell.lines.map(escapeHtml).join('<br>') : escapeHtml(cell.text);
    if (interactive && cell.kind === 'label' && row.drill) {
      text = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(row.drill)}" title="Abrir o detalhado de ${escapeHtml(cell.text)}">${text}</button>`;
    } else if (interactive && cell.drill && text) {
      text = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(cell.drill)}" title="Abrir o detalhado deste cruzamento">${text}</button>`;
    }
    const cls = cell.partial ? `${cellClass(cell)} sheet-partial` : cellClass(cell);
    const title = cell.partial ? ` title="Calculado com ${cell.partial.nValid} de ${cell.partial.nTotal} valores"` : '';
    return `<td data-col="${cell.col}" data-key="${escapeHtml(cell.key)}" class="${cls}"${title}>${text}</td>`;
  });
  return `<tr ${attrs}>${cells.join('')}</tr>`;
}

function renderTable(doc, table, options) {
  if (!table) return '';
  const colgroup = `<colgroup>${doc.print.widthPercents.map((percent) => `<col style="width:${percent}%">`).join('')}</colgroup>`;
  const rows = table.rows.map((row) => renderRow(doc, row, options)).join('\n');
  const title = table.title ? `<h3 class="sheet-sec-title sheet-sec-title--total">${escapeHtml(table.title)}</h3>` : '';
  // Tabela só com linha de totais (subtotal/total geral do Detalhado): sem cabeçalho de colunas.
  const head = table.rows.every((row) => row.chips) ? '' : `<thead>${renderHeadRow(doc, options)}</thead>`;
  return `${title}<table class="sheet-table sheet-table--${table.kind.toLowerCase()}" data-table-id="${escapeHtml(table.id)}" data-kind="${table.kind}">${colgroup}${head}<tbody>\n${rows}\n</tbody></table>`;
}

function renderSection(doc, section, options) {
  const tag = section.level === 1 ? 'h2' : 'h3';
  let title = escapeHtml(section.title);
  if (options.interactive && section.drill) {
    title = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(section.drill)}" title="Abrir o detalhado deste grupo">${title}</button>`;
  }
  const inner = [
    `<${tag} class="sheet-sec-title sheet-sec-title--${section.level}">${title}</${tag}>`,
    ...section.sections.map((child) => renderSection(doc, child, options)),
    renderTable(doc, section.table, options),
    renderTable(doc, section.leafTotal, options),
  ].join('\n');
  const keep = section.level === 1 ? ' sheet-keep' : '';
  return `<section class="sheet-sec sheet-sec--${section.level}${keep}" data-node-id="${escapeHtml(section.id)}">\n${inner}\n</section>`;
}

// ---------------------------------------------------------------------------
// Folha no estilo do MAKGESTAO (E1D visual — doc.style = 'makgestao'; E1E: todos os relatórios)
// ---------------------------------------------------------------------------
// Mesma marcação de base (data-col/data-key em cada célula, cabeçalho e rodapé iguais); muda o desenho: as
// linhas de total (row.line) saem como LINHA DE TEXTO abaixo da tabela ("Subtotal 02/06/2026: 103 animais …"),
// a célula da matriz empilha os 3 valores em <span> e as classes dizem alinhamento/fonte/negrito como no antigo.

const ALIGN_CLASS = Object.freeze({ left: 'al-l', center: 'al-c', right: 'al-r' });

function makCellClass(doc, cell) {
  const column = doc.columns[cell.col];
  const parts = [cellClass(cell), ALIGN_CLASS[cell.kind === 'label' ? 'left' : cell.align ?? column?.align] ?? 'al-l'];
  if (column?.mk?.mono && cell.kind !== 'label') parts.push('mk-mono');
  if (column?.mk?.weight) parts.push(`mk-${column.mk.weight}`);
  if (cell.tone) parts.push(`mk-${cell.tone}`);
  if (column?.total) parts.push('mk-tcol'); // coluna TOTAL da matriz
  if (cell.partial) parts.push('sheet-partial');
  return parts.join(' ');
}

/**
 * E1F — cabeçalho interativo (só na TELA, com headerMenu): o <th> diz a chave e o tipo da coluna
 * (data-col-key/data-col-kind), o título vira o botão do menu da coluna (data-col-menu — Ordenar, Calcular,
 * Agrupar, Subtotal/Total, Ocultar, Adicionar) e a borda direita ganha o puxador de largura (data-col-grip).
 * A coluna ordenada leva aria-sort. Valor do eixo X da matriz: só o puxador (não tem menu). A impressão e o
 * PDF não passam headerMenu: a marcação deles não muda.
 */
export function renderHeaderCell(column, index, { cls, sort }) {
  const key = escapeHtml(column.key);
  const label = escapeHtml(column.label);
  const sorted = sort?.key === column.key ? ` aria-sort="${sort.direction === 'desc' ? 'descending' : 'ascending'}"` : '';
  const menu = !(column.kind === 'matrix' && !column.total);
  const title = menu ? `<button type="button" class="sheet-col-btn" data-col-menu="${key}" aria-haspopup="menu" title="Opções da coluna ${label}">${label}</button>` : label;
  const grip = `<span class="sheet-col-grip" data-col-grip="${key}" aria-hidden="true" title="Arraste para mudar a largura (duplo clique: automática)"></span>`;
  return `<th data-col="${index}" data-key="${key}" data-col-key="${key}" data-col-kind="${escapeHtml(column.kind ?? 'data')}"${cls ? ` class="${cls}"` : ''}${sorted} scope="col">${title}${grip}</th>`;
}

function renderMakHeadRow(doc, { interactive, sort, headerMenu = false }) {
  const cells = doc.columns.map((column, index) => {
    const align = ALIGN_CLASS[column.align] ?? 'al-l';
    const cls = `${column.align === 'left' ? 'lbl ' : ''}${align}${column.total ? ' mk-tcol' : ''}`;
    if (headerMenu) return renderHeaderCell(column, index, { cls, sort });
    let content = escapeHtml(column.label);
    if (interactive && column.kind === 'metric' && doc.layout === 'summary') {
      const state = sort?.key === column.key ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none';
      content = `<button type="button" class="sheet-sort" data-sort="${escapeHtml(column.key)}" aria-sort="${state}" title="Ordenar os grupos por ${escapeHtml(column.label)}">${escapeHtml(column.label)}</button>`;
    }
    return `<th data-col="${index}" data-key="${escapeHtml(column.key)}" class="${cls}" scope="col">${content}</th>`;
  });
  return `<tr>${cells.join('')}</tr>`;
}

function renderMakRow(doc, row, { interactive }) {
  const cls = ROW_CLASS[row.type] ?? 'sheet-row';
  const attrs = `class="${cls}" data-row-type="${row.type}" data-row-id="${escapeHtml(row.id)}"`;
  const cells = row.cells.map((cell) => {
    // Matriz: Qtd, Peso Médio e GMD Médio, um embaixo do outro (cada um com o seu tamanho/cor, como no antigo).
    let text = Array.isArray(cell.lines) ? cell.lines.map((line, index) => `<span class="mk-v mk-v${index + 1}${line === '-' ? ' mk-none' : ''}">${escapeHtml(line)}</span>`).join('') : escapeHtml(cell.text);
    if (interactive && cell.kind === 'label' && row.drill) {
      text = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(row.drill)}" title="Abrir o detalhado de ${escapeHtml(cell.text)}">${text}</button>`;
    } else if (interactive && cell.drill && text) {
      text = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(cell.drill)}" title="Abrir o detalhado deste cruzamento">${text}</button>`;
    }
    const title = cell.partial ? ` title="Calculado com ${cell.partial.nValid} de ${cell.partial.nTotal} valores"` : '';
    return `<td data-col="${cell.col}" data-key="${escapeHtml(cell.key)}" class="${makCellClass(doc, cell)}"${title}>${text}</td>`;
  });
  return `<tr ${attrs}>${cells.join('')}</tr>`;
}

/**
 * Linha de total em texto. grid = itens espalhados na largura (Resumo por Data, Por Apartação/Lote, quadro do
 * comprador, resumo genérico com até 5 itens): "<b>Subtotal 02/06/2026:</b> 103 animais"; flow = o mesmo com
 * " | " entre os itens, quebrando linha (resumo genérico com mais itens); box/right = uma frase com " | "
 * (Analítico e lista genérica, TOTAL GERAL de Vendas).
 */
export function renderMakLine(row) {
  const { layout, items, leadFit } = row.line;
  const attrs = `class="mk-line mk-line--${layout}" data-row-type="${row.type}" data-row-id="${escapeHtml(row.id)}"`;
  if (layout === 'grid') {
    const cells = items.map((item) => `<div class="mk-item" data-key="${escapeHtml(item.key)}"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</div>`).join('');
    // leadFit (resumo genérico): o rótulo "Subtotal <grupo>" não quebra; os demais itens dividem o resto.
    const template = leadFit && items.length > 1 ? `max-content repeat(${items.length - 1}, minmax(0, 1fr))` : `repeat(${items.length}, minmax(0, 1fr))`;
    return `<div ${attrs} style="grid-template-columns: ${template}">${cells}</div>`;
  }
  const label = (item) => (layout === 'flow' ? `<strong>${escapeHtml(item.label)}:</strong>` : `${escapeHtml(item.label)}:`);
  const parts = items.map((item) => `<span class="mk-item" data-key="${escapeHtml(item.key)}">${label(item)} ${escapeHtml(item.text)}</span>`);
  return `<div ${attrs}>${parts.join('<span class="mk-sep"> | </span>')}</div>`;
}

function renderMakTable(doc, table, options) {
  if (!table) return '';
  const drawn = table.rows.filter((row) => !row.line);
  const lines = table.rows.filter((row) => row.line).map(renderMakLine).join('\n');
  let heading = '';
  if (table.legend) {
    // Matriz: "Linhas: Sexo | Colunas: Lote | Valores: Qtd / Peso Médio / GMD Médio" com os rótulos em negrito.
    heading = `<div class="mk-legend">${table.legend.map((part) => `<strong>${escapeHtml(part.label)}:</strong> ${escapeHtml(part.text)}`).join(' | ')}</div>`;
  } else if (table.heading ?? table.title) {
    heading = `<h3 class="sheet-sec-title sheet-sec-title--total">${escapeHtml(table.heading ?? table.title)}</h3>`;
  }
  if (!drawn.length) return `${heading}${lines}`;
  const colgroup = `<colgroup>${doc.print.widthPercents.map((percent) => `<col style="width:${percent}%">`).join('')}</colgroup>`;
  const rows = drawn.map((row) => renderMakRow(doc, row, options)).join('\n');
  return `${heading}<table class="sheet-table sheet-table--${table.kind.toLowerCase()}" data-table-id="${escapeHtml(table.id)}" data-kind="${table.kind}">${colgroup}<thead>${renderMakHeadRow(doc, options)}</thead><tbody>\n${rows}\n</tbody></table>${lines ? `\n${lines}` : ''}`;
}

function renderMakSection(doc, section, options) {
  const tag = section.level === 1 ? 'h2' : 'h3';
  let title = '';
  if (section.title) {
    let text = escapeHtml(section.title);
    if (options.interactive && section.drill) {
      text = `<button type="button" class="sheet-drill" data-drill="${escapeHtml(section.drill)}" title="Abrir o detalhado deste grupo">${text}</button>`;
    }
    title = `<${tag} class="sheet-sec-title sheet-sec-title--${section.level}">${text}</${tag}>`;
  }
  // Vendas do antigo: quadro do comprador (título + totais) antes da tabela.
  const head = section.lead ? `<div class="mk-box">${title}${renderMakLine(section.lead)}</div>` : title;
  const inner = [
    head,
    ...section.sections.map((child) => renderMakSection(doc, child, options)),
    renderMakTable(doc, section.table, options),
    section.leafTotal ? `<div class="mk-block">${renderMakTable(doc, section.leafTotal, options)}</div>` : '',
  ].filter(Boolean).join('\n');
  const keep = section.level === 1 ? ' sheet-keep' : '';
  const leaf = section.sections.length ? '' : ' mk-leaf';
  return `<section class="sheet-sec sheet-sec--${section.level}${keep}${leaf}" data-node-id="${escapeHtml(section.id)}">\n${inner}\n</section>`;
}

function renderMakContent(doc, options) {
  return [
    ...doc.sections.map((section) => renderMakSection(doc, section, options)),
    renderMakTable(doc, doc.flat, options),
    doc.grandTotal ? `<div class="mk-grand">${renderMakTable(doc, doc.grandTotal, options)}</div>` : '',
  ].filter(Boolean).join('\n');
}

// E1D item 8: filtros, @ (quando houver), colunas omitidas pelo perfil (quando houver) e quem emitiu/quando.
// E1G: "GMD de N de M cab." quando falta GMD para algum animal da folha.
function renderFooter(doc) {
  const parts = [doc.footer.filtros, doc.footer.arroba, doc.footer.gmd, doc.footer.omitidas, doc.footer.emitidoPor].filter(Boolean);
  return `<div class="sheet-footer">${parts.map((part) => `<span>${escapeHtml(part)}</span>`).join('')}<span class="sheet-footer__pages">Página X de Y na impressão</span></div>`;
}

/**
 * Marcação da folha inteira (cabeçalho que se repete, título e período, seções, total geral e rodapé).
 * @param doc documento de buildReportDocument
 * @param {{ mode?: 'fragment'|'print', interactive?: boolean, sort?: {key, direction}|null, headerMenu?: boolean }} options
 *   fragment = dentro do app (tela); print = corpo do documento impresso/PDF. headerMenu (E1F, só na tela
 *   do MAKGESTAO): cabeçalho interativo (renderHeaderCell) — ignorado na impressão.
 */
export function renderSheetBody(doc, { mode = 'fragment', interactive = false, sort = null, headerMenu = false } = {}) {
  const options = { interactive, sort, headerMenu: headerMenu && mode !== 'print' };
  const header = renderSheetHeaderHtml(doc.header);
  // Abaixo do título só o período (E1D item 8), no lugar do antigo subtítulo — mesma marcação e estilo.
  const titleRow = `<div class="sheet-title-row"><h1 class="sheet-title">${escapeHtml(doc.title)}</h1><span class="sheet-title-side">${escapeHtml(doc.periodText)}</span></div>`;
  const mak = doc.style === 'makgestao';
  let content;
  if (doc.empty) content = `<p class="sheet-empty">${escapeHtml(doc.emptyText ?? 'Nenhum registro para os filtros informados.')}</p>`;
  // E1D: "Vendas (Detalhado)" tem miolo próprio (o relatório de venda do MAKGESTAO — vendasHtml.js).
  else if (doc.layout === 'vendas') content = renderVendasBody(doc, options);
  else if (mak) content = renderMakContent(doc, options);
  else {
    content = [
      ...doc.sections.map((section) => renderSection(doc, section, options)),
      renderTable(doc, doc.flat, options),
      doc.grandTotal ? `<div class="sheet-grand-block">${renderTable(doc, doc.grandTotal, options)}</div>` : '',
    ].join('\n');
  }
  // Nenhuma nota na folha; só na tela, o aviso de linhas limitadas (a impressão leva todas).
  const notes = mode !== 'print' && doc.screenNotice ? `<ul class="sheet-notes"><li>${escapeHtml(doc.screenNotice)}</li></ul>` : '';
  const rootClass = `rpt-sheet rpt-sheet--${mode === 'print' ? 'print' : 'screen'} sheet--${doc.print.orientation} sheet-size-${doc.print.sizeClass}`;
  // E1D visual: data-style/data-view escopam o CSS da folha do MAKGESTAO (data-view = o desenho do documento).
  const styleAttrs = mak ? ` data-style="makgestao" data-view="${escapeHtml(doc.variant)}"` : '';
  return `<div class="${rootClass}" data-orientation="${doc.print.orientation}" data-layout="${doc.layout}"${styleAttrs}>
<table class="sheet-page">
<thead><tr><td>${header}${titleRow}</td></tr></thead>
<tfoot><tr><td>${renderFooter(doc)}</td></tr></tfoot>
<tbody><tr><td class="sheet-body">
${content}
${notes}
</td></tr></tbody>
</table>
</div>`;
}
