export class WeighingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WeighingError';
    this.code = code;
    this.details = details;
  }
}

export const WEIGHING_ERROR_CODES = {
  WEIGHING_MAP_001: 'Payload inválido',
  WEIGHING_LIST_001: 'Falha ao listar pesagens',
  WEIGHING_SAVE_001: 'Falha ao salvar pesagem',
  WEIGHING_DELETE_001: 'Falha ao excluir pesagem',
};

export function toUserMessage(error) {
  if (error instanceof WeighingError) return error.message;
  if (error?.message) return error.message;
  return 'Erro ao processar pesagem';
}
