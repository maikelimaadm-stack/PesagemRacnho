import { describe, expect, it } from 'vitest';
import { validateAnimalTimeline } from './animalTimeline';

const ev = (id, tipo_manejo, data_pesagem, extra = {}) => ({ id, tipo_manejo, data_pesagem, created_at: `${data_pesagem}T10:00:00Z`, ...extra });
const SERIE = [
  ev('c', 'Cadastro', '2026-01-10'),
  ev('m1', 'Manejo', '2026-03-01'),
  ev('m2', 'Manejo', '2026-05-01'),
];
const codigo = (fn) => { try { fn(); return null; } catch (err) { return err.code; } };

describe('validateAnimalTimeline', () => {
  it('série válida volta na ordem canônica (Cadastro → Manejo → Saída no mesmo dia)', () => {
    const r = validateAnimalTimeline([ev('s', 'Saída', '2026-05-01'), ...SERIE]);
    expect(r.map((e) => e.id)).toEqual(['c', 'm1', 'm2', 's']);
  });

  it('primeira entrada: cadastro sozinho é válido', () => {
    expect(validateAnimalTimeline([], { upsert: [ev('c', 'Cadastro', '2026-01-10')] })).toHaveLength(1);
  });

  it('cadastro retroativo correto passa; P05: mover o Cadastro para depois de um Manejo é recusado', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('c', 'Cadastro', '2025-12-01')] }))).toBeNull();
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('c', 'Cadastro', '2026-04-01')] }))).toBe('TIMELINE_ANTES_DO_CADASTRO');
  });

  it('Manejo antes do Cadastro é recusado', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('x', 'Manejo', '2026-01-01')] }))).toBe('TIMELINE_ANTES_DO_CADASTRO');
  });

  it('segundo Cadastro e segunda Saída são recusados', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('c2', 'Cadastro', '2026-06-01')] }))).toBe('TIMELINE_CADASTRO_DUPLICADO');
    const comSaida = [...SERIE, ev('s', 'Saída', '2026-06-01', { motivo_saida: 'Venda' })];
    expect(codigo(() => validateAnimalTimeline(comSaida, { upsert: [ev('s2', 'Saída', '2026-06-01')] }))).toBe('TIMELINE_SAIDA_DUPLICADA');
  });

  it('Saída antes de Manejo (retroativa) e Manejo depois da Saída são recusados', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('s', 'Saída', '2026-04-01')] }))).toBe('TIMELINE_DEPOIS_DA_SAIDA');
    const comSaida = [...SERIE, ev('s', 'Saída', '2026-06-01')];
    expect(codigo(() => validateAnimalTimeline(comSaida, { upsert: [ev('m3', 'Manejo', '2026-07-01')] }))).toBe('TIMELINE_DEPOIS_DA_SAIDA');
    // mover a Saída para trás de um Manejo existente
    expect(codigo(() => validateAnimalTimeline(comSaida, { upsert: [ev('s', 'Saída', '2026-04-15')] }))).toBe('TIMELINE_DEPOIS_DA_SAIDA');
  });

  it('P07: dois Manejos do mesmo animal no mesmo dia são recusados; Cadastro/Saída no mesmo dia, não', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('m3', 'Manejo', '2026-05-01')] }))).toBe('TIMELINE_MANEJO_DUPLICADO');
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('s', 'Saída', '2026-05-01')] }))).toBeNull();
    expect(codigo(() => validateAnimalTimeline([], { upsert: [ev('c', 'Cadastro', '2026-05-01'), ev('m', 'Manejo', '2026-05-01')] }))).toBeNull();
  });

  it('repesagem: cancelar a de hoje e gravar a nova na mesma mudança é válido', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { removeIds: ['m2'], upsert: [ev('m2b', 'Manejo', '2026-05-01')] }))).toBeNull();
  });

  it('data impossível (30/02) é recusada', () => {
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [ev('m3', 'Manejo', '2026-02-30')] }))).toBe('TIMELINE_DATA_INVALIDA');
  });

  it('eventos cancelados não contam', () => {
    const comCancelado = [...SERIE, ev('m3', 'Manejo', '2026-05-01', { deleted_at: '2026-05-02T00:00:00Z' })];
    expect(codigo(() => validateAnimalTimeline(comCancelado))).toBeNull();
  });

  it('aceita registros do banco (tipo e data no legacy_payload)', () => {
    const doBanco = { id: 'm9', data_pesagem: '2026-05-01', legacy_payload: { tipo_manejo: 'Manejo' } };
    expect(codigo(() => validateAnimalTimeline(SERIE, { upsert: [doBanco] }))).toBe('TIMELINE_MANEJO_DUPLICADO');
  });

  it('anomalia antiga (dois Manejos aceitos na importação) não trava lançamento em outra data', () => {
    const legado = [...SERIE, ev('m2b', 'Manejo', '2026-05-01')];
    expect(codigo(() => validateAnimalTimeline(legado, { upsert: [ev('m4', 'Manejo', '2026-06-01')] }))).toBeNull();
    // mas criar uma nova duplicidade continua recusado
    expect(codigo(() => validateAnimalTimeline(legado, { upsert: [ev('m5', 'Manejo', '2026-03-01')] }))).toBe('TIMELINE_MANEJO_DUPLICADO');
  });

  it('mensagens: evento depois da venda × venda antes de evento existente', () => {
    const comVenda = [...SERIE, ev('s', 'Saída', '2026-06-01', { motivo_saida: 'Venda' })];
    expect(() => validateAnimalTimeline(comVenda, { upsert: [ev('m9', 'Manejo', '2026-07-01')] })).toThrow(/já possui venda em 01\/06\/2026/);
    expect(() => validateAnimalTimeline(SERIE, { upsert: [ev('s', 'Saída', '2026-04-01', { motivo_saida: 'Venda' })] })).toThrow(/posteriores a 01\/04\/2026/);
  });

  it('10 mil eventos validam em tempo de tela', () => {
    const muitos = [ev('c', 'Cadastro', '2000-01-01')];
    for (let i = 0; i < 10000; i += 1) {
      const d = new Date(Date.UTC(2000, 0, 2 + i));
      muitos.push(ev(`m${i}`, 'Manejo', d.toISOString().slice(0, 10)));
    }
    const t = performance.now();
    validateAnimalTimeline(muitos);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
