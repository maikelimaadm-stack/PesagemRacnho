import { describe, expect, it } from 'vitest';
import { REGRA_PESO_LANCAMENTO, launchWeightKg, normalizeLaunchWeight } from './weightNormalization.js';
import { formatWeightForField } from '../../equipment/domain/scaleContract.js';
import { validateItem } from '../../livestock/domain/operationRules.js';

// R07: o mesmo peso dá o mesmo inteiro em todos os caminhos — digitado, balança (S3) e item de operação.
const pelaOperacao = (peso) => {
  try {
    return validateItem({ tipo: 'ENTRADA' }, { numero_animal: '1', marca_id: 'M', sexo: 'M', peso }, 1).peso_kg ?? null;
  } catch {
    return 'ERRO';
  }
};

describe('normalização única do peso lançado (R07)', () => {
  it('trunca: 328,4 → 328; 328,5 → 328; 328,99 → 328', () => {
    expect(REGRA_PESO_LANCAMENTO).toBe('INTEIRO_TRUNCADO');
    for (const [entrada, kg] of [[328.4, 328], [328.5, 328], [328.99, 328], ['328,4', 328], ['328,5', 328], ['328,99', 328], ['1.234,5', 1234], [329, 329], ['329', 329]]) {
      expect(normalizeLaunchWeight(entrada)).toMatchObject({ ok: true, kg });
    }
  });

  it('zero, negativo, abaixo de 1 kg e texto inválido são recusados com motivo; vazio é vazio', () => {
    expect(normalizeLaunchWeight(0)).toMatchObject({ ok: false, codigo: 'PESO_NAO_POSITIVO' });
    expect(normalizeLaunchWeight(-5)).toMatchObject({ ok: false, codigo: 'PESO_NAO_POSITIVO' });
    expect(normalizeLaunchWeight('-328,4')).toMatchObject({ ok: false, codigo: 'PESO_NAO_POSITIVO' });
    expect(normalizeLaunchWeight(0.5)).toMatchObject({ ok: false, codigo: 'PESO_NAO_POSITIVO' });
    expect(normalizeLaunchWeight('abc')).toMatchObject({ ok: false, codigo: 'PESO_INVALIDO' });
    expect(normalizeLaunchWeight('32a8')).toMatchObject({ ok: false, codigo: 'PESO_INVALIDO' });
    expect(normalizeLaunchWeight(Number.NaN)).toMatchObject({ ok: false, codigo: 'PESO_INVALIDO' });
    expect(normalizeLaunchWeight('')).toMatchObject({ ok: true, kg: null, vazio: true });
    expect(normalizeLaunchWeight(null)).toMatchObject({ ok: true, kg: null, vazio: true });
  });

  it('balança (campo do Lançamento), digitado e operação dão o mesmo inteiro', () => {
    for (const leitura of [328.4, 328.5, 328.99, 58.5, 1234.5]) {
      const campo = formatWeightForField(leitura);
      expect(launchWeightKg(campo)).toBe(launchWeightKg(leitura));
      expect(pelaOperacao(leitura)).toBe(launchWeightKg(leitura));
      expect(pelaOperacao(String(leitura).replace('.', ','))).toBe(launchWeightKg(leitura));
    }
  });

  it('operação recusa peso inválido, zero e negativo como o Lançamento', () => {
    for (const peso of [0, -1, '-328,4', 'abc']) expect(pelaOperacao(peso)).toBe('ERRO');
  });
});
