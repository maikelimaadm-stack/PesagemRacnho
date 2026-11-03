// Bip de "peso estável" da pesagem automática (pedido do curral): UM toque curto quando a balança LIBERA uma
// leitura estável nova para o animal da vez — a mesma liberação do portão da captura (captureGate, P01–P03).
//   - nunca com a plataforma vazia / peso 0 (abaixo de emptyThresholdKg o portão nem libera);
//   - uma vez por animal: o mesmo animal parado (leituras estáveis seguidas) não bipa de novo;
//   - o animal mexer e voltar ao mesmo peso (±toleranceKg) não bipa de novo; esvaziar a plataforma rearma;
//   - depois de salvar, o portão espera o próximo animal — o bip também (só volta quando liberar de novo).
// Puro: sem som, sem timers. A tela chama update() a cada leitura e toca o som quando devolve true.
export const STABLE_BEEP_DEFAULTS = Object.freeze({ emptyThresholdKg: 10, toleranceKg: 1 });

const numero = (valor) => (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor));

export function createStableBeepTracker({ emptyThresholdKg = STABLE_BEEP_DEFAULTS.emptyThresholdKg, toleranceKg = STABLE_BEEP_DEFAULTS.toleranceKg } = {}) {
  let liberadoAntes = false;
  let ultimoBipKg = null;

  /** @param {{ kg: number|null, liberado: boolean }} leitura  liberado = evaluateCapture().ok */
  const update = ({ kg, liberado } = {}) => {
    const peso = numero(kg);
    if (peso === null || peso < emptyThresholdKg) {
      // Plataforma vazia (ou sem peso): nada a bipar; o próximo animal pode bipar.
      liberadoAntes = false;
      ultimoBipKg = null;
      return false;
    }
    const liberadoAgora = liberado === true;
    const acabouDeLiberar = liberadoAgora && !liberadoAntes;
    liberadoAntes = liberadoAgora;
    if (!acabouDeLiberar) return false;
    if (ultimoBipKg !== null && Math.abs(peso - ultimoBipKg) <= toleranceKg) return false;
    ultimoBipKg = peso;
    return true;
  };

  /** Pesagem automática ligada/desligada: começa do zero. */
  const reset = () => {
    liberadoAntes = false;
    ultimoBipKg = null;
  };

  return { update, reset };
}
