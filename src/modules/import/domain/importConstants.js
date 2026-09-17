// Contrato público da importação conciliada (missão sanity-launch-import §18-§37).
// Tipos de importação, rótulos exibidos no assistente e situação de cada linha do
// plano (dry-run). Tudo aqui é constante: nenhuma regra, nenhum acesso a banco.

export const IMPORT_TYPES = Object.freeze({
  HISTORICO: 'HISTORICO',
  CADASTROS: 'CADASTROS',
  MANEJOS: 'MANEJOS',
  SAIDAS: 'SAIDAS',
  MESTRES: 'MESTRES',
  SANIDADE: 'SANIDADE',
});

export const IMPORT_TYPE_LABELS = Object.freeze({
  HISTORICO: 'Histórico conciliado — Cadastro + Manejos',
  CADASTROS: 'Cadastros de animais',
  MANEJOS: 'Manejos',
  SAIDAS: 'Saídas',
  MESTRES: 'Cadastros mestres',
  SANIDADE: 'Aplicações de sanidade',
});

export const ROW_STATUS = Object.freeze({
  NOVO: 'NOVO',
  JA_EXISTE: 'JÁ EXISTE',
  POSSIVEL_DUPLICIDADE: 'POSSÍVEL DUPLICIDADE',
  CONFLITO: 'CONFLITO',
  ERRO: 'ERRO',
  AMBIGUO: 'AMBÍGUO',
  IGNORADA: 'IGNORADA',
});

// Situações que impedem gravar o plano inteiro (a tela resolve e refaz a análise).
export const BLOCKING_STATUSES = Object.freeze([ROW_STATUS.ERRO, ROW_STATUS.AMBIGUO, ROW_STATUS.CONFLITO]);

export const EVENT_TYPES = Object.freeze({ CADASTRO: 'Cadastro', MANEJO: 'Manejo', SAIDA: 'Saída' });

// Motivos aceitos numa Saída (mesma lista do Lançamento).
export const EXIT_REASONS = Object.freeze(['Venda', 'Abate', 'Morte', 'Doação', 'Transferência', 'Outros']);

// Saída que aceita peso ausente (validateUiPayload do mapper e Lançamento).
export const EXIT_REASONS_WITHOUT_WEIGHT = Object.freeze(['Morte', 'Doação', 'Transferência']);

export const CATEGORY_MODES = Object.freeze({ PLANILHA: 'PLANILHA', FIXA: 'FIXA', AUTOMATICA: 'AUTOMATICA' });

export const DATE_FORMATS = Object.freeze(['auto', 'DD/MM/AAAA', 'AAAA-MM-DD']);
export const DECIMAL_FORMATS = Object.freeze(['auto', 'virgula', 'ponto']);

// Situação do job na store `importacoes`.
export const JOB_STATUS = Object.freeze({ EM_ANDAMENTO: 'EM_ANDAMENTO', CONCLUIDA: 'CONCLUIDA', FALHOU: 'FALHOU' });

export const DEFAULT_EMPRESA_ID = 'local';
