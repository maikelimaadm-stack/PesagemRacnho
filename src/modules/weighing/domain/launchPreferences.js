// Preferências de trabalho do Lançamento que ficam na SESSÃO junto do contexto por modo (launchContext): sair da tela
// (outro menu) e voltar não pode apagar o que o operador montou para a lida —
//   - motivo da Entrada (Compra, Nascimento…);
//   - sequência de brincos: marcada, brinco inicial/final, direção e o CURSOR (próximo número);
//   - pesagem automática ligada (volta a ligar quando a balança estiver conectada).
// Nunca guarda dado de animal nem peso. Valores fora do formato são descartados (fail-safe: vira o padrão).
export const LAUNCH_PREFERENCES_VERSION = 1;
const DIRECOES = Object.freeze(['crescente', 'decrescente']);
const texto = (valor, max = 40) => (typeof valor === 'string' ? valor.slice(0, max) : '');
const inteiro = (valor, { min = 0, max = 1e12 } = {}) => (Number.isInteger(valor) && valor >= min && valor <= max ? valor : null);

export function launchPreferencesStorageKey({ empresaId, usuarioId } = {}) {
  return `lancamento-pesagens:preferencias:${String(empresaId || 'local')}:${String(usuarioId || 'sem-usuario')}`;
}

function cursorValido(cursor) {
  if (!cursor || typeof cursor !== 'object') return null;
  const numeroAtual = inteiro(cursor.numeroAtual);
  const numeroInicial = inteiro(cursor.numeroInicial);
  const digitos = inteiro(cursor.digitos, { max: 15 });
  if (numeroAtual === null || numeroInicial === null || digitos === null) return null;
  if (typeof cursor.prefixo !== 'string' || cursor.prefixo.length > 20) return null;
  const numeroFinal = cursor.numeroFinal === null || cursor.numeroFinal === undefined ? null : inteiro(cursor.numeroFinal);
  if (cursor.numeroFinal !== null && cursor.numeroFinal !== undefined && numeroFinal === null) return null;
  return {
    prefixo: cursor.prefixo,
    numeroAtual,
    numeroInicial,
    digitos,
    numeroFinal,
    direcao: DIRECOES.includes(cursor.direcao) ? cursor.direcao : 'crescente',
  };
}

/** Estado da sequência de brincos (o que a tela SequenciaBrincos precisa para voltar igual). */
export function sanitizeSequencePreferences(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const usar = raw.usar === true;
  const cursor = usar ? cursorValido(raw.cursor) : null;
  return {
    usar,
    inicial: texto(raw.inicial),
    final: texto(raw.final),
    direcao: DIRECOES.includes(raw.direcao) ? raw.direcao : 'crescente',
    cursor,
  };
}

/** Preferências guardadas → valores válidos (ou os padrões). `subtiposEntrada`: lista aceita para o motivo. */
export function sanitizeLaunchPreferences(raw, { subtiposEntrada = [] } = {}) {
  const fonte = raw && typeof raw === 'object' && raw.versao === LAUNCH_PREFERENCES_VERSION ? raw : {};
  return {
    versao: LAUNCH_PREFERENCES_VERSION,
    subtipoEntrada: subtiposEntrada.includes(fonte.subtipoEntrada) ? fonte.subtipoEntrada : null,
    pesagemAuto: fonte.pesagemAuto === true,
    sequencia: sanitizeSequencePreferences(fonte.sequencia),
  };
}
