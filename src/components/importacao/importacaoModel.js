// Peças puras do assistente de importação (tela). Nada aqui interpreta a planilha nem
// calcula série: a leitura, a conciliação e a gravação são do motor em
// src/modules/import/**. Este arquivo só guarda os textos da tela, a ordem das etapas,
// as cores por situação e contagens de exibição feitas sobre o que o motor já devolveu.
// Sem React e com imports relativos para o gate (scripts/verify-import-ui.mjs) exercitar
// em Node as mesmas funções que a tela usa.
import {
  CATEGORY_MODES,
  DATE_FORMATS,
  DECIMAL_FORMATS,
  EXIT_REASONS,
  IMPORT_TYPES,
  IMPORT_TYPE_LABELS,
  ROW_STATUS,
} from '../../modules/import/domain/importConstants.js';
import { importGroupingKey } from '../../modules/import/domain/animalIdentity.js';

export { CATEGORY_MODES, DATE_FORMATS, DECIMAL_FORMATS, EXIT_REASONS, IMPORT_TYPES, IMPORT_TYPE_LABELS, ROW_STATUS };

// Trilha do assistente, sempre nesta ordem.
export const IMPORT_STEPS = Object.freeze([
  Object.freeze({ id: 'arquivo', numero: 1, label: 'Arquivo', titulo: 'Escolha o arquivo' }),
  Object.freeze({ id: 'tipo', numero: 2, label: 'Tipo', titulo: 'O que tem neste arquivo' }),
  Object.freeze({ id: 'colunas', numero: 3, label: 'Colunas', titulo: 'Ligue as colunas aos campos' }),
  Object.freeze({ id: 'regras', numero: 4, label: 'Regras', titulo: 'Como ler os valores' }),
  Object.freeze({ id: 'conciliacao', numero: 5, label: 'Conciliação', titulo: 'O que o sistema entendeu' }),
  Object.freeze({ id: 'conferencia', numero: 6, label: 'Conferência', titulo: 'Confira linha por linha' }),
  Object.freeze({ id: 'resultado', numero: 7, label: 'Resultado', titulo: 'O que foi gravado' }),
]);

export const STEP_IDS = Object.freeze(IMPORT_STEPS.map((step) => step.id));
export const stepIndex = (id) => STEP_IDS.indexOf(id);

// Pergunta principal da etapa Tipo, em português de quem opera (17/09/2026): o nome
// técnico "Histórico conciliado" não diz nada a quem só quer saber se o arquivo tem mais
// de uma pesagem do mesmo animal.
export const CONCILIACAO_PERGUNTA = 'O arquivo tem mais de uma pesagem do mesmo animal?';

export const CONCILIACAO_OPCOES = Object.freeze([
  Object.freeze({
    id: 'SIM',
    titulo: 'Sim — conciliar automaticamente (recomendado)',
    // E1G: pesagem anterior ao Cadastro de um animal já cadastrado antecipa o Cadastro.
    texto: 'O sistema ordena as linhas por data: a pesagem mais antiga de cada animal novo vira Cadastro e as seguintes viram Manejo. Se o animal já existe no sistema, todas entram como Manejo — a não ser que o arquivo traga pesagem mais antiga que o Cadastro dele: aí a mais antiga passa a ser o Cadastro e o Cadastro antigo vira Manejo.',
    detalhe: 'A ordem das linhas no arquivo não importa — vale a data. O número do brinco escrito com zeros à esquerda ou com o ",0" do Excel (01016, 1016,0) é reconhecido como o mesmo animal. Peso anterior, dias, ganho e GMD são sempre recalculados pelo sistema, mesmo que venham na planilha.',
    tipo: IMPORT_TYPES.HISTORICO,
  }),
  Object.freeze({
    id: 'NAO',
    titulo: 'Não — todas as linhas são do mesmo tipo',
    texto: 'Escolha abaixo se o arquivo é só de Cadastros de animais, só de Manejos ou só de Saídas.',
    detalhe: 'Neste modo, dois registros do mesmo animal no mesmo arquivo viram conflito em vez de virar Cadastro + Manejo.',
    tipo: null,
  }),
  Object.freeze({
    id: 'MESTRES',
    titulo: 'Cadastros mestres (marcas, raças, causas, categorias)',
    texto: 'O arquivo não tem pesagens: cada nome preenchido vira um cadastro de marca, raça, causa de morte ou categoria.',
    detalhe: 'Exige permissão para gravar cadastros.',
    tipo: IMPORT_TYPES.MESTRES,
  }),
  Object.freeze({
    id: 'SANIDADE',
    titulo: 'Aplicações de sanidade (vacinas, vermífugos, tratamentos)',
    texto: 'O arquivo não tem pesagens: cada linha é uma aplicação já feita em um animal, com data, programa/procedimento, medicamento, dose, unidade e via.',
    detalhe: 'O animal precisa existir; programa e medicamento são reconhecidos pelo nome. Entra também pela tela Sanidade, na aba Aplicações.',
    tipo: IMPORT_TYPES.SANIDADE,
  }),
]);

// Tipos oferecidos quando a resposta é "todas as linhas são do mesmo tipo".
export const TIPOS_UNICOS = Object.freeze([IMPORT_TYPES.CADASTROS, IMPORT_TYPES.MANEJOS, IMPORT_TYPES.SAIDAS]);

export const IMPORT_TYPE_HINTS = Object.freeze({
  [IMPORT_TYPES.HISTORICO]: 'O sistema decide sozinho, pela data, o que é Cadastro e o que é Manejo de cada animal.',
  [IMPORT_TYPES.CADASTROS]: 'Uma linha por animal: a entrada dele no sistema, com marca, sexo, raça e o primeiro peso.',
  [IMPORT_TYPES.MANEJOS]: 'Pesagens de animais que já existem no sistema. Nenhum animal novo é criado.',
  [IMPORT_TYPES.SAIDAS]: 'Venda, abate, morte, doação ou transferência. Tem fluxo próprio: motivo da saída obrigatório e peso opcional em morte, doação e transferência.',
  [IMPORT_TYPES.MESTRES]: 'Cria marcas, raças, causas de morte e categorias a partir dos nomes do arquivo.',
  [IMPORT_TYPES.SANIDADE]: 'Uma linha por aplicação já feita. Nenhuma pesagem é criada e nenhum peso é lido: a aplicação fica ligada ao animal, na data do próprio evento.',
});

// Modelos de planilha oferecidos na etapa Arquivo. As colunas de cada modelo estão em
// src/modules/import/domain/spreadsheetTemplate.js (o assistente só pede o arquivo pronto).
export const MODELOS_PLANILHA = Object.freeze([
  Object.freeze({ kind: 'PESAGENS', rotulo: 'Baixar modelo de pesagens', tipos: Object.freeze([IMPORT_TYPES.HISTORICO, IMPORT_TYPES.CADASTROS, IMPORT_TYPES.MANEJOS]) }),
  Object.freeze({ kind: 'SAIDAS', rotulo: 'Baixar modelo de saídas', tipos: Object.freeze([IMPORT_TYPES.SAIDAS]) }),
  Object.freeze({ kind: 'SANIDADE', rotulo: 'Baixar modelo de aplicações de sanidade', tipos: Object.freeze([IMPORT_TYPES.SANIDADE]) }),
]);

/** Com o tipo já escolhido, oferece só o modelo daquele tipo; sem tipo, oferece todos. */
export function modelosParaTipo(type) {
  const doTipo = MODELOS_PLANILHA.filter((modelo) => modelo.tipos.includes(type));
  return doTipo.length ? doTipo : MODELOS_PLANILHA;
}

/** Resposta da etapa Tipo que corresponde a um tipo já escolhido (ex.: vindo da tela Sanidade). */
export function respostaDoTipo(type) {
  if (!type) return null;
  // A opção "Não" tem tipo nulo de propósito (ela abre a escolha do tipo único), por isso a
  // busca só vale para as opções que já carregam um tipo.
  return CONCILIACAO_OPCOES.find((opcao) => opcao.tipo === type)?.id ?? 'NAO';
}

// Situação da linha → classe de cor (importacao.css).
export const ROW_STATUS_TONE = Object.freeze({
  [ROW_STATUS.NOVO]: 'importacao-status--novo',
  [ROW_STATUS.JA_EXISTE]: 'importacao-status--existe',
  [ROW_STATUS.POSSIVEL_DUPLICIDADE]: 'importacao-status--duplicidade',
  [ROW_STATUS.CONFLITO]: 'importacao-status--conflito',
  [ROW_STATUS.ERRO]: 'importacao-status--erro',
  [ROW_STATUS.AMBIGUO]: 'importacao-status--ambiguo',
  [ROW_STATUS.IGNORADA]: 'importacao-status--ignorada',
});

export const ROW_STATUS_HINTS = Object.freeze({
  [ROW_STATUS.NOVO]: 'Será gravada.',
  [ROW_STATUS.JA_EXISTE]: 'Já está no sistema: nada será gravado de novo.',
  [ROW_STATUS.POSSIVEL_DUPLICIDADE]: 'Repetição do mesmo animal, data e peso.',
  [ROW_STATUS.CONFLITO]: 'O arquivo diz uma coisa e o sistema diz outra. Resolva antes de gravar.',
  [ROW_STATUS.ERRO]: 'Falta informação ou o valor não é aceito. Corrija o arquivo.',
  [ROW_STATUS.AMBIGUO]: 'Mais de um animal atende a esta linha. Informe a marca para separar.',
  [ROW_STATUS.IGNORADA]: 'Fora deste tipo de importação.',
});

export const CATEGORY_MODE_OPTIONS = Object.freeze([
  Object.freeze({ id: CATEGORY_MODES.PLANILHA, label: 'Vem da planilha', hint: 'Usa a coluna Categoria do arquivo.' }),
  Object.freeze({ id: CATEGORY_MODES.FIXA, label: 'Uma categoria para todos', hint: 'Escolha a categoria aplicada a todos os animais criados.' }),
  Object.freeze({ id: CATEGORY_MODES.AUTOMATICA, label: 'Automática pelo peso', hint: 'O sistema escolhe pela faixa de peso e pelo sexo. Vale só para animais criados no Cadastro; manejos não mudam a categoria.' }),
]);

export const DATE_FORMAT_LABELS = Object.freeze({ auto: 'Reconhecer sozinho', 'DD/MM/AAAA': 'Dia/mês/ano (31/12/2026)', 'AAAA-MM-DD': 'Ano-mês-dia (2026-12-31)' });
export const DECIMAL_LABELS = Object.freeze({ auto: 'Reconhecer sozinho', virgula: 'Vírgula (238,5)', ponto: 'Ponto (238.5)' });
export const DELIMITER_LABELS = Object.freeze({ ';': 'ponto e vírgula (;)', ',': 'vírgula (,)', '\t': 'tabulação' });

export const delimiterLabel = (value) => DELIMITER_LABELS[value] || value || '—';

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Campo → cabeçalho, a partir do mapeamento cabeçalho → campo escolhido na tela. */
export function headerOfField(mapping, fieldId) {
  for (const [header, field] of Object.entries(mapping || {})) if (field === fieldId) return header;
  return null;
}

/**
 * Aferição do próprio arquivo, antes da análise: quantas linhas, quantos animais
 * diferentes e quantos aparecem mais de uma vez. Só conta os textos já lidos por
 * readImportFile na coluna que a pessoa ligou a "Nº / Identificação" (mais a Marca,
 * quando mapeada). Não interpreta datas, pesos nem decide evento nenhum.
 */
export function afericaoDoArquivo(file, mapping) {
  const linhas = file?.rows?.length || 0;
  const headerNumero = headerOfField(mapping, 'numero');
  if (!headerNumero || !linhas) return { linhas, mapeado: Boolean(headerNumero), animais: 0, repetidos: 0, maxLinhas: 0 };
  const headerMarca = headerOfField(mapping, 'marca');
  const contagem = new Map();
  for (const row of file.rows) {
    // E1G: mesma chave da importação — "007" e "7" contam como um animal só.
    const numero = importGroupingKey(row.values?.[headerNumero]);
    if (!numero) continue;
    const marca = headerMarca ? String(row.values?.[headerMarca] ?? '').trim().toUpperCase() : '';
    const chave = `${numero}|${marca}`;
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  const valores = [...contagem.values()];
  return {
    linhas,
    mapeado: true,
    animais: valores.length,
    repetidos: valores.filter((quantidade) => quantidade > 1).length,
    maxLinhas: valores.length ? Math.max(...valores) : 0,
  };
}

/**
 * Animais com mais de uma linha no plano, agrupados pela identidade que o próprio plano
 * trouxe (identity.key/label). Nada é recalculado: só reúne as linhas do plano.
 */
export function animaisComVariasLinhas(plan, { limite = 12 } = {}) {
  const grupos = new Map();
  for (const row of plan?.rows || []) {
    const chave = row.identity?.key || row.identity?.label || `linha-${row.line}`;
    const grupo = grupos.get(chave) || { chave, label: row.identity?.label || '—', animalId: row.identity?.animalId || null, novo: Boolean(row.identity?.isNew), linhas: [] };
    grupo.linhas.push({ line: row.line, data: row.data, eventType: row.eventType, status: row.status, peso: row.peso });
    grupos.set(chave, grupo);
  }
  const repetidos = [...grupos.values()].filter((grupo) => grupo.linhas.length > 1);
  for (const grupo of repetidos) grupo.linhas.sort((a, b) => a.line - b.line);
  repetidos.sort((a, b) => b.linhas.length - a.linhas.length || String(a.label).localeCompare(String(b.label), 'pt-BR'));
  return { total: repetidos.length, grupos: repetidos.slice(0, limite) };
}

/**
 * E1G: aviso das linhas que casaram com animais já cadastrados por número parecido
 * ("12 linhas casaram com animais existentes por número parecido: 01016 → 1016").
 * Só lê o resumo do plano; null quando não houve nenhuma.
 */
export function avisoNumerosParecidos(summary) {
  const info = summary?.numerosParecidos;
  if (!info?.linhas) return null;
  const inicio = info.linhas === 1
    ? '1 linha casou com um animal existente por número parecido'
    : `${info.linhas} linhas casaram com animais existentes por número parecido`;
  const outros = info.outrosExemplos ? ` e mais ${info.outrosExemplos}` : '';
  return `${inicio}: ${info.exemplos.join(', ')}${outros}.`;
}

// Data ISO do plano → dd/mm/aaaa (sem os formatadores da tela, para o gate rodar em Node).
const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/**
 * E1G: uma frase por animal cujo Cadastro gravado passa a Manejo porque o histórico começa
 * antes dele ("O Cadastro de 29/09/2026 do animal 701 passa a Manejo; o novo Cadastro é 02/06/2026.").
 */
export function avisosCadastrosAntecipados(summary) {
  return (summary?.cadastrosAntecipados || []).map((item) => (
    `O Cadastro de ${dataBR(item.cadastroGravado)} do animal ${item.numero ?? item.animal} passa a Manejo; o novo Cadastro é ${dataBR(item.novoCadastro)}.`
  ));
}

/** Campos obrigatórios do tipo que ainda não têm coluna ligada (mesma regra do motor). */
export function camposObrigatoriosFaltando(campos, mapping, type) {
  const usados = new Set(Object.values(mapping || {}).filter(Boolean));
  if (type === IMPORT_TYPES.MESTRES) {
    const algum = ['marca', 'raca', 'causa_morte', 'categoria'].some((id) => usados.has(id));
    return algum ? [] : [{ id: 'marca', label: 'Marca, Raça, Causa da morte ou Categoria' }];
  }
  return (campos || []).filter((campo) => campo.required && !usados.has(campo.id)).map((campo) => ({ id: campo.id, label: campo.label }));
}

const MENSAGENS_POR_CODIGO = Object.freeze({
  AUTH_FORBIDDEN: 'Seu perfil não pode fazer esta importação. Peça a um gestor.',
  IMPORT_BLOCKING: 'O plano tem pendências que impedem a gravação. Resolva o arquivo e refaça a análise.',
  IMPORT_STALE_PLAN: 'Os dados mudaram desde a análise. Refaça a análise antes de gravar.',
  IMPORT_INVALID_PLAN: 'A análise se perdeu. Refaça a análise.',
  IMPORT_INVALID_TYPE: 'Escolha o tipo de importação antes de continuar.',
});

/** Erro do serviço → frase pt-BR para a tela, sem jargão e sem travar o assistente. */
export function describeImportError(error, fallback = 'Não foi possível concluir a importação.') {
  if (!error) return fallback;
  const codigo = error.code || error.name;
  if (codigo === 'AUTH_FORBIDDEN') return MENSAGENS_POR_CODIGO.AUTH_FORBIDDEN;
  const base = MENSAGENS_POR_CODIGO[codigo];
  const detalhe = String(error.message || '').trim();
  if (base && detalhe && codigo !== 'AUTH_FORBIDDEN') return `${base} (${detalhe})`;
  return base || detalhe || fallback;
}
