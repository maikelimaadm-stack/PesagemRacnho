// Portão da captura de peso pela balança (P01–P03, missão pesagens-integrada).
//
// O campo Peso do Lançamento espelha o monitor (1.5.4), mas ESPELHAR não é LIBERAR para
// salvar. Este módulo decide, a partir das leituras numeradas do scaleService, se existe
// uma leitura estável NOVA para o animal da vez:
//   - toda leitura chega com `seq` (sequência monotônica) e `epoch` (época da conexão:
//     muda a cada conexão, desconexão, troca de aparelho ou erro do adaptador);
//   - só vale a última leitura ESTÁVEL da época atual, com a balança conectada;
//   - leitura instável fora da faixa do peso estável derruba a estabilidade (o animal mexeu);
//   - depois de um salvamento a leitura é CONSUMIDA: o próximo animal só é liberado quando
//     a balança mostra que mudou de animal — plataforma vazia (< emptyThresholdKg) ou uma
//     variação grande (≥ rearmDeltaKg) seguida de estável num peso DIFERENTE do consumido.
//     Assim o boi A parado na balança (ou mexendo e voltando ao mesmo peso) não vira o peso
//     do boi B, e leitura tardia do A depois de começar o B não libera o B.
//   - nunca promove leitura instável a estável (sem timeout que "inventa" estabilidade).
//   - balança sem tara (vazia marcando 15–40 kg, barro na plataforma): conta como "vazia" qualquer leitura abaixo
//     de EMPTY_RATIO do peso consumido — o animal saiu mesmo sem o número chegar perto de zero (1.6.2);
//   - release(): o operador confirma que é outro animal ("Liberar peso"): o estável atual vale para o próximo.
// Puro: sem timers, sem Dexie, sem React. O scaleService alimenta e a tela consulta.

export const CAPTURE_REASONS = Object.freeze({
  OK: 'OK',
  DESCONECTADA: 'DESCONECTADA',
  SEM_LEITURA: 'SEM_LEITURA',
  INSTAVEL: 'INSTAVEL',
  AGUARDANDO_PROXIMO_ANIMAL: 'AGUARDANDO_PROXIMO_ANIMAL',
  MESMO_PESO_DO_ANTERIOR: 'MESMO_PESO_DO_ANTERIOR',
  OUTRA_CONEXAO: 'OUTRA_CONEXAO',
});

export const CAPTURE_MESSAGES = Object.freeze({
  DESCONECTADA: 'Balança desconectada: reconecte ou desligue a pesagem automática e digite o peso.',
  SEM_LEITURA: 'Ainda não chegou peso da balança.',
  INSTAVEL: 'Peso ainda não estabilizou. Aguarde o monitor travar o número.',
  AGUARDANDO_PROXIMO_ANIMAL: 'Esse peso já foi usado no animal anterior. Esvazie a plataforma (ou troque o animal) para a balança liberar o próximo peso.',
  MESMO_PESO_DO_ANTERIOR: 'O peso estável é o mesmo do animal anterior. Esvazie a plataforma para confirmar que é outro animal, ou desligue a pesagem automática e digite o peso.',
  OUTRA_CONEXAO: 'A balança reconectou depois dessa leitura. Aguarde uma leitura estável nova.',
});

export const DEFAULT_EMPTY_THRESHOLD_KG = 10;
export const DEFAULT_REARM_DELTA_KG = 30;
export const DEFAULT_SAME_WEIGHT_TOLERANCE_KG = 1;
/** Depois de salvar, leitura abaixo desta fração do peso usado = plataforma vazia (balança sem tara). */
export const EMPTY_RATIO = 0.25;

const finite = (value) => (value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null));

export function createCaptureGate({
  emptyThresholdKg = DEFAULT_EMPTY_THRESHOLD_KG,
  rearmDeltaKg = DEFAULT_REARM_DELTA_KG,
  sameWeightToleranceKg = DEFAULT_SAME_WEIGHT_TOLERANCE_KG,
} = {}) {
  let epoch = 0;
  let lastReading = null;
  let lastStable = null;
  /** Leitura consumida no último salvamento: { seq, epoch, weightKg } */
  let consumed = null;
  /** true depois de consumir até a balança mostrar que mudou de animal */
  let awaitingNext = false;
  /** a troca veio por variação grande (e não por plataforma vazia): exige peso diferente */
  let rearmedBySwing = false;

  const observe = (reading) => {
    if (!reading) return;
    const kg = finite(reading.weightKg);
    if (reading.epoch != null && reading.epoch !== epoch) {
      // Outra conexão: o estável antigo não vale mais (a espera do próximo animal continua).
      epoch = reading.epoch;
      lastStable = null;
    }
    lastReading = reading;
    if (kg == null) {
      lastStable = null;
      return;
    }
    if (kg < emptyThresholdKg) {
      // Plataforma vazia: nada a capturar; libera o próximo animal.
      lastStable = null;
      if (awaitingNext) {
        awaitingNext = false;
        rearmedBySwing = false;
      }
      return;
    }
    if (awaitingNext && consumed && kg < consumed.weightKg * EMPTY_RATIO) {
      // Balança sem tara: o animal saiu (o peso caiu para menos de 1/4 do usado) sem chegar a zero.
      lastStable = null;
      awaitingNext = false;
      rearmedBySwing = false;
      return;
    }
    if (reading.stable) {
      lastStable = reading;
      return;
    }
    // Instável: só derruba o estável se saiu da faixa dele (o tracker já decide a faixa).
    if (lastStable && Math.abs(kg - Number(lastStable.weightKg)) > sameWeightToleranceKg) lastStable = null;
    if (awaitingNext && consumed && Math.abs(kg - consumed.weightKg) >= rearmDeltaKg) {
      awaitingNext = false;
      rearmedBySwing = true;
    }
  };

  /**
   * Libera a leitura estável para o salvamento?
   * @param {{ connected: boolean, epoch: number }} context estado atual da conexão
   */
  const evaluate = ({ connected, epoch: currentEpoch } = {}) => {
    const deny = (reason) => ({ ok: false, reason, message: CAPTURE_MESSAGES[reason], reading: null });
    if (!connected) return deny(CAPTURE_REASONS.DESCONECTADA);
    if (!lastReading) return deny(CAPTURE_REASONS.SEM_LEITURA);
    if (awaitingNext) return deny(CAPTURE_REASONS.AGUARDANDO_PROXIMO_ANIMAL);
    if (!lastStable) return deny(CAPTURE_REASONS.INSTAVEL);
    if (currentEpoch != null && lastStable.epoch != null && lastStable.epoch !== currentEpoch) return deny(CAPTURE_REASONS.OUTRA_CONEXAO);
    if (consumed && lastStable.seq != null && consumed.seq != null && lastStable.seq <= consumed.seq) {
      return deny(CAPTURE_REASONS.AGUARDANDO_PROXIMO_ANIMAL);
    }
    if (rearmedBySwing && consumed && Math.abs(Number(lastStable.weightKg) - consumed.weightKg) <= sameWeightToleranceKg) {
      return deny(CAPTURE_REASONS.MESMO_PESO_DO_ANTERIOR);
    }
    return { ok: true, reason: CAPTURE_REASONS.OK, message: null, reading: lastStable };
  };

  /** Marca a leitura como usada (só depois do salvamento ter dado certo). */
  const consume = (reading) => {
    if (!reading) return;
    consumed = { seq: reading.seq ?? null, epoch: reading.epoch ?? null, weightKg: Number(reading.weightKg) };
    awaitingNext = true;
    rearmedBySwing = false;
    lastStable = null;
  };

  /**
   * O operador confirma que o animal na balança é OUTRO ("Liberar peso"): a espera do próximo animal acaba e o
   * último estável (se a leitura atual é estável e não vazia) volta a valer. Continua exigindo leitura estável.
   */
  const release = () => {
    awaitingNext = false;
    rearmedBySwing = false;
    consumed = null;
    const kg = finite(lastReading?.weightKg);
    if (!lastStable && lastReading?.stable && kg != null && kg >= emptyThresholdKg) lastStable = lastReading;
  };

  /** Desconexão, erro do adaptador ou troca de aparelho: o estável deixa de valer. */
  const invalidate = () => {
    lastStable = null;
  };

  /** Pesagem automática desligada/ligada ou novo dia de trabalho: começa do zero. */
  const reset = () => {
    lastReading = null;
    lastStable = null;
    consumed = null;
    awaitingNext = false;
    rearmedBySwing = false;
  };

  const snapshot = () => ({
    epoch,
    lastReading,
    lastStable,
    consumed,
    awaitingNext,
  });

  return { observe, evaluate, consume, release, invalidate, reset, snapshot };
}
