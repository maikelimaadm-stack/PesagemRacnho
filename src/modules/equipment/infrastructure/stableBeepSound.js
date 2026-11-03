// Som do bip de peso estável: um tom só (sine 880 Hz), ~1 s, com entrada e saída suaves (sem estalo).
// Web Audio, sem arquivo de som. Um bip não se sobrepõe a outro (intervalo mínimo).
const DURACAO_S = 1.0;
const FREQUENCIA_HZ = 880;
const VOLUME = 0.25;
const INTERVALO_MINIMO_MS = 1200;

let contexto = null;
let ultimoBip = 0;

function obterContexto() {
  if (contexto) return contexto;
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!Ctor) return null;
  contexto = new Ctor();
  return contexto;
}

/** Prepara o áudio num gesto do operador (ligar a pesagem automática): navegador libera o som depois disso. */
export function prepareStableBeep() {
  try {
    const ctx = obterContexto();
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* sem áudio: a pesagem segue sem bip */ }
}

/** Toca o bip; devolve false quando não deu (sem áudio, ou bip anterior ainda tocando). */
export function playStableBeep() {
  try {
    const agora = Date.now();
    if (agora - ultimoBip < INTERVALO_MINIMO_MS) return false;
    const ctx = obterContexto();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const inicio = ctx.currentTime;
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIA_HZ, inicio);
    ganho.gain.setValueAtTime(0, inicio);
    ganho.gain.linearRampToValueAtTime(VOLUME, inicio + 0.02);
    ganho.gain.setValueAtTime(VOLUME, inicio + DURACAO_S - 0.08);
    ganho.gain.linearRampToValueAtTime(0, inicio + DURACAO_S);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + DURACAO_S + 0.02);
    ultimoBip = agora;
    return true;
  } catch {
    return false;
  }
}
