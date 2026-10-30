// Exportações do painel do gestor (F18): CSV, XLSX e HTML para PDF a partir das MESMAS tabelas
// (`dashboardTables`). Reaproveita as peças do motor de relatórios: célula CSV com proteção de fórmula,
// ZIP determinístico do XLSX, escape XML e a impressão em PDF pela ponte do Electron.
import { CSV_BOM, CSV_NEWLINE, CSV_SEPARATOR, csvCell } from '../../reporting/infrastructure/exporters/csvExporter.js';
import { columnLetter, escapeXml, sanitizeSheetName, zipStored } from '../../reporting/infrastructure/exporters/xlsxExporter.js';

export const AVISO_PAINEL = 'Painel gerado a partir das pesagens observadas. Projeções são estimativas do cenário escolhido e não são pesagens.';

export function dashboardCsv(tabelas, { titulo = 'Painel do gestor' } = {}) {
  const out = [[titulo].map(csvCell).join(CSV_SEPARATOR), [AVISO_PAINEL].map(csvCell).join(CSV_SEPARATOR)];
  for (const t of tabelas) {
    out.push('', [t.titulo].map(csvCell).join(CSV_SEPARATOR), t.colunas.map(csvCell).join(CSV_SEPARATOR));
    for (const linha of t.linhas) out.push(linha.map(csvCell).join(CSV_SEPARATOR));
  }
  return CSV_BOM + out.join(CSV_NEWLINE) + CSV_NEWLINE;
}

function sheetXml(t) {
  const rows = [[t.titulo], t.colunas, ...t.linhas];
  const xmlRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    const ref = `${columnLetter(c)}${r + 1}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return '';
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(v))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

export function dashboardXlsx(tabelas) {
  const nomes = tabelas.map((t, i) => sanitizeSheetName(`${i + 1} ${t.id}`));
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabelas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabelas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  tabelas.forEach((t, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(t); });
  return zipStored(files);
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function dashboardHtml(tabelas, { titulo = 'Painel do gestor' } = {}) {
  const body = tabelas.map((t) => `<h2>${esc(t.titulo)}</h2><table><thead><tr>${t.colunas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.linhas.length ? t.linhas.map((l) => `<tr>${l.map((v) => `<td${typeof v === 'number' ? ' class="n"' : ''}>${esc(v === null ? '—' : v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.colunas.length}">Sem dados na janela.</td></tr>`}</tbody></table>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:Arial,sans-serif;font-size:9pt;color:#111}h1{font-size:14pt}h2{font-size:11pt;margin:14px 0 4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:2px 4px;text-align:left}th{background:#f1f3f4}td.n{text-align:right}p{color:#555}</style></head><body><h1>${esc(titulo)}</h1><p>${esc(AVISO_PAINEL)}</p>${body}</body></html>`;
}
