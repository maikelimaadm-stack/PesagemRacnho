// Estabilidade do peso do monitor para o Lançamento.
//
// A Tru-Test/Datamars S3 decide sozinha quando o peso estabilizou (Superdamp III,
// LED vermelho), mas não manda isso pelo Bluetooth: a característica padrão
// Weight Measurement (0x2A9D) só tem unidade, data/hora, usuário e IMC nas flags.
// Desde o firmware 1.2.6 o S3 também só envia o peso QUANDO MUDA (antes era a cada
// 1 s). Então, quando o monitor trava o número, as notificações param — e a regra
// antiga (esperar outra leitura igual depois da janela) nunca marcava estável.
//
// Aqui o silêncio conta: peso parado por `windowMs` (> 0 kg) é estável, venha ou
// não outra leitura. "Parado" = sem se afastar mais de `toleranceKg` (stabilityKg da
// configuração, 0,5 kg) do peso em que começou a parar — assim 319,95 ↔ 320,00 não
// reinicia a contagem, e um passo de 1 kg (resolução do S3 acima de 200 kg) reinicia. Um timer emite a leitura estável quando a
// balança fica quieta. Leituras que o adaptador já marca estáveis (ASCII "ST",
// simulador) passam direto.
import { createReading } from './scaleContract.js';

export const DEFAULT_STABILITY_MS = 500;
export const DEFAULT_STABILITY_KG = 0.5;

export function createStabilityTracker({
  windowMs = DEFAULT_STABILITY_MS,
  toleranceKg = DEFAULT_STABILITY_KG,
  onSettled = () => {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let anchorKg = null;
  let since = 0;
  let lastReading = null;
  let timer = null;

  const cancel = () => {
    if (timer != null) clearTimer(timer);
    timer = null;
  };

  const reset = () => {
    cancel();
    anchorKg = null;
    since = 0;
    lastReading = null;
  };

  const settle = (reading) => createReading({ ...reading, stable: true });

  /** Leitura crua do adaptador → mesma leitura com `stable` decidido aqui. */
  const track = (reading) => {
    if (!reading || reading.weightKg == null || !Number.isFinite(Number(reading.weightKg))) {
      reset();
      return reading;
    }
    lastReading = reading;
    const kg = Number(reading.weightKg);
    // Monitor abaixo de 1 kg = plataforma livre: nada a estabilizar.
    const loaded = Math.floor(kg) > 0;

    if (reading.stable) {
      cancel();
      anchorKg = kg;
      since = now();
      return reading;
    }

    if (anchorKg == null || Math.abs(kg - anchorKg) > toleranceKg) {
      cancel();
      anchorKg = kg;
      since = now();
      if (loaded) {
        const anchor = anchorKg;
        timer = setTimer(() => {
          timer = null;
          if (anchorKg === anchor && lastReading) onSettled(settle(lastReading));
        }, windowMs);
      }
      return createReading({ ...reading, stable: false });
    }

    if (!loaded) return createReading({ ...reading, stable: false });
    if (now() - since >= windowMs) {
      cancel();
      return settle(reading);
    }
    return createReading({ ...reading, stable: false });
  };

  return { track, reset };
}
