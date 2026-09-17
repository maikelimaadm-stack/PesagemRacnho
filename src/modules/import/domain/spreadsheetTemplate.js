// Modelos de planilha de importação (CSV UTF-8 com BOM, separador ';').
// Só entram colunas que a pessoa preenche. Nunca: ID, ID externo, peso anterior, data
// anterior, dias, ganho, GMD — tudo isso é calculado pelo sistema na importação, a partir
// da série cronológica do animal (pedido do responsável em 17/09/2026).
import { CSV_BOM, csvCell } from '../../reporting/infrastructure/exporters/csvExporter.js';

export const TEMPLATE_KINDS = Object.freeze({ PESAGENS: 'PESAGENS', SAIDAS: 'SAIDAS', SANIDADE: 'SANIDADE' });

const TEMPLATES = Object.freeze({
  // Cadastros e manejos (também o Histórico conciliado: o sistema decide Cadastro/Manejo pela data).
  PESAGENS: {
    fileName: 'modelo_importacao_pesagens.csv',
    headers: ['Data', 'NumeroAnimal', 'Marca', 'Sexo', 'Raça', 'Categoria', 'Peso', 'Apartação', 'Lote', 'Observação'],
    examples: [
      ['01/12/2025', '4368', 'ABC', 'M', 'Nelore', '', '206', 'ROTINA', 'MEIO', ''],
      ['15/01/2026', '4368', 'ABC', 'M', 'Nelore', '', '238,5', 'ROTINA', 'MEIO', ''],
      ['01/12/2025', '4370', 'XYZ', 'F', 'Nelore', '', '212', 'ROTINA', 'MEIO', 'animal calmo'],
    ],
  },
  SAIDAS: {
    fileName: 'modelo_importacao_saidas.csv',
    headers: ['Data', 'NumeroAnimal', 'Marca', 'MotivoSaida', 'CausaMorte', 'Peso', 'Observação'],
    examples: [
      ['10/02/2026', '4368', 'ABC', 'Venda', '', '310', ''],
      ['12/02/2026', '4370', 'XYZ', 'Morte', 'Raio', '', ''],
    ],
  },
  // Aplicações de sanidade já feitas: uma por linha. Programa e medicamento vão pelo NOME
  // (o sistema resolve nos cadastros de sanidade); dose, unidade e via seguem a validação do
  // serviço de sanidade. Nunca há cálculo de dose por peso.
  SANIDADE: {
    fileName: 'modelo_importacao_aplicacoes_sanidade.csv',
    headers: ['Data', 'NumeroAnimal', 'Marca', 'Programa', 'Medicamento', 'Dose', 'Unidade', 'Via', 'Observação'],
    examples: [
      ['05/01/2026', '4368', 'ABC', 'Aftosa', 'Vacina aftosa', '5', 'ml', 'SC', ''],
      ['05/01/2026', '4370', 'XYZ', 'Aftosa', 'Vacina aftosa', '5', 'ml', 'SC', 'lote 22A'],
      ['12/02/2026', '4368', 'ABC', 'Vermifugação', 'Ivermectina 1%', '4,5', 'ml', 'SC', ''],
    ],
  },
});

/** Colunas que o sistema calcula ou gera sozinho e que não devem estar no modelo. */
export const COLUMNS_NOT_IN_TEMPLATE = Object.freeze(['ID', 'ID_Externo', 'DataAnterior', 'PesoAnterior', 'Dias', 'Ganho', 'GMD']);

export function importTemplateHeaders(kind = TEMPLATE_KINDS.PESAGENS) {
  const template = TEMPLATES[kind];
  if (!template) throw new Error(`modelo de importação desconhecido (${kind})`);
  return [...template.headers];
}

/** → { content (com BOM, CRLF), fileName, headers } */
export function buildImportTemplateCsv(kind = TEMPLATE_KINDS.PESAGENS) {
  const template = TEMPLATES[kind];
  if (!template) throw new Error(`modelo de importação desconhecido (${kind})`);
  const lines = [template.headers, ...template.examples].map((cells) => cells.map((cell) => csvCell(cell)).join(';'));
  return { content: `${CSV_BOM}${lines.join('\r\n')}\r\n`, fileName: template.fileName, headers: [...template.headers] };
}
