// Entrega do CSV no renderer (Blob + download), comum às telas que exportam pesagens.
// O conteúdo já vem pronto do contrato (BOM, ";", CRLF); aqui só o arquivo.
export const CSV_MIME_TYPE = 'text/csv;charset=utf-8';

/** Baixa o resultado de buildWeighingCsv/exportWeighingCsv ({ content, fileName }). */
export function downloadCsvFile({ content, fileName }) {
  const url = URL.createObjectURL(new Blob([content], { type: CSV_MIME_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
