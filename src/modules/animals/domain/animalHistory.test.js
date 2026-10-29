import { describe, expect, it } from 'vitest';
import { getAnimalHistory, getRegisteredAnimals } from './animalHistory';

describe('getAnimalHistory — identidade (P11)', () => {
  const vendido = { id: 'c1', animal_id: 'A1', tipo_manejo: 'Cadastro', numero_animal: '10', marca: 'MK', data_pesagem: '2025-01-01' };
  const saida = { id: 's1', animal_id: 'A1', tipo_manejo: 'Saída', numero_animal: '10', marca: 'MK', data_pesagem: '2025-06-01' };
  const novo = { id: 'c2', animal_id: 'A2', tipo_manejo: 'Cadastro', numero_animal: '10', marca: 'MK', data_pesagem: '2026-01-01' };
  const legadoSemId = { id: 'x', tipo_manejo: 'Manejo', numero_animal: '10', marca: 'MK', data_pesagem: '2025-03-01', peso: 300 };

  it('número reaproveitado na mesma marca: pesagem antiga sem animal_id não entra em nenhum dos dois', () => {
    const entries = [vendido, saida, novo, legadoSemId];
    expect(getAnimalHistory(entries, novo).map((e) => e.id)).toEqual(['c2']);
    expect(getAnimalHistory(entries, vendido).map((e) => e.id)).toEqual(['c1', 's1']);
  });

  it('sem ambiguidade, a pesagem legada continua ligada pelo número + marca', () => {
    expect(getAnimalHistory([vendido, legadoSemId], vendido).map((e) => e.id)).toEqual(['c1', 'x']);
  });

  it('mesmo número em marcas diferentes mantém históricos separados (SN e repetidos)', () => {
    const outraMarca = { id: 'c3', animal_id: 'B1', tipo_manejo: 'Cadastro', numero_animal: '10', marca: 'ZZ', data_pesagem: '2026-01-01' };
    const entries = [vendido, outraMarca, { id: 'm', animal_id: 'B1', tipo_manejo: 'Manejo', numero_animal: '10', marca: 'ZZ', data_pesagem: '2026-02-01' }];
    expect(getAnimalHistory(entries, outraMarca).map((e) => e.id)).toEqual(['c3', 'm']);
    expect(getRegisteredAnimals(entries).map((a) => a.animal_id).sort()).toEqual(['A1', 'B1']);
  });
});
