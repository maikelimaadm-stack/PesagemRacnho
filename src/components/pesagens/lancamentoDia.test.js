import { describe, expect, it } from 'vitest';
import {
  automaticLot,
  buildDayEntries,
  countByShipmentDocument,
  getColumnFilterType,
  isLotFull,
  latestEntryOfDay,
  lotCandidates,
  summarizeEntries,
  summarizeShipmentDocuments,
} from './lancamentoDia';

const HOJE = '2026-10-29';
const pesagem = (id, extra = {}) => ({ id, data_pesagem: HOJE, peso: 300, sexo: 'M', ...extra });

const DIA = [
  pesagem('c', { numero_animal: '30', peso: 410, sexo: 'F', created_date: '2026-10-29T10:03:00Z' }),
  pesagem('a', { numero_animal: '10', peso: 320, created_date: '2026-10-29T10:01:00Z', documento_embarque_id: 'd1' }),
  pesagem('b', { numero_animal: '20', peso: 280, created_date: '2026-10-29T10:02:00Z', documento_embarque_id: 'd1' }),
  pesagem('x', { numero_animal: '99', data_pesagem: '2026-10-28', created_date: '2026-10-28T09:00:00Z' }),
];

describe('buildDayEntries', () => {
  it('só a data escolhida, numerada pela ordem de lançamento', () => {
    const linhas = buildDayEntries(DIA, { date: HOJE });
    expect(linhas.map((l) => [l.id, l._numero_registro])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('ordena por peso e por texto, nos dois sentidos, mantendo o nº do registro', () => {
    expect(buildDayEntries(DIA, { date: HOJE, sortColumn: 'peso', sortDirection: 'desc' }).map((l) => l.id)).toEqual(['c', 'a', 'b']);
    const porNumero = buildDayEntries(DIA, { date: HOJE, sortColumn: 'numero_animal', sortDirection: 'desc' });
    expect(porNumero.map((l) => l.numero_animal)).toEqual(['30', '20', '10']);
    expect(porNumero.map((l) => l._numero_registro)).toEqual([3, 2, 1]);
  });

  it('não altera a lista original', () => {
    const copia = JSON.stringify(DIA);
    buildDayEntries(DIA, { date: HOJE, sortColumn: 'peso' });
    expect(JSON.stringify(DIA)).toBe(copia);
  });
});

describe('resumos', () => {
  it('totais de cabeças, sexo e peso', () => {
    expect(summarizeEntries(DIA.slice(0, 3))).toEqual({ total: 3, machos: 2, femeas: 1, pesoTotal: 1010, pesoMedio: 1010 / 3 });
    expect(summarizeEntries([])).toEqual({ total: 0, machos: 0, femeas: 0, pesoTotal: 0, pesoMedio: 0 });
  });

  it('contagem por documento e resumo dos documentos do embarque', () => {
    expect(countByShipmentDocument(DIA)).toEqual({ d1: 2 });
    const [doc] = summarizeShipmentDocuments([{ id: 'd1', numero_gta: 'G1', qtd_prev_machos: 5 }], DIA);
    expect(doc).toEqual({ id: 'd1', gta: 'G1', nfe: '-', prevM: 5, prevF: 0, pesoTotal: 600, pesoMedio: 300 });
  });

  it('último lançamento do dia é o mais recente', () => {
    expect(latestEntryOfDay(DIA, HOJE).id).toBe('c');
    expect(latestEntryOfDay(DIA, '2026-01-01')).toBeNull();
  });

  it('tipo do filtro por coluna', () => {
    expect(getColumnFilterType('peso')).toBe('number');
    expect(getColumnFilterType('data_pesagem')).toBe('date');
    expect(getColumnFilterType('marca')).toBe('text');
  });
});

describe('lotes', () => {
  const LOTES = [
    { id: 'L1', peso_minimo: 200, peso_maximo: 350, quantidade_maxima: 2 },
    { id: 'L2', peso_minimo: 300, peso_maximo: 450 },
    { id: 'L3', peso_minimo: 300, peso_maximo: 450, fechado: true },
  ];

  it('lote fechado ou com a quantidade máxima está cheio', () => {
    expect(isLotFull(LOTES[2], [])).toBe(true);
    expect(isLotFull(LOTES[0], [{ lote_id: 'L1' }])).toBe(false);
    expect(isLotFull(LOTES[0], [{ lote_id: 'L1' }, { lote_id: 'L1' }])).toBe(true);
    expect(isLotFull(null, [])).toBe(false);
  });

  it('candidatos pela faixa de peso, sem os cheios', () => {
    expect(lotCandidates(LOTES, [], 320).map((l) => l.id)).toEqual(['L1', 'L2']);
    expect(lotCandidates(LOTES, [{ lote_id: 'L1' }, { lote_id: 'L1' }], 320).map((l) => l.id)).toEqual(['L2']);
    expect(lotCandidates(LOTES, [], Number.NaN)).toEqual([]);
  });

  it('automático: o primeiro candidato; com atalho e empate, ninguém', () => {
    expect(automaticLot(LOTES, [], 320).id).toBe('L1');
    expect(automaticLot(LOTES, [], 320, { shortcutEnabled: true })).toBeNull();
    expect(automaticLot(LOTES, [], 400, { shortcutEnabled: true }).id).toBe('L2');
    expect(automaticLot(LOTES, [], 900)).toBeNull();
  });
});
