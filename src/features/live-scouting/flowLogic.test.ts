import { describe, it, expect } from 'vitest';
import { determinaPassoAtteso, fasiSchema } from './flowLogic';
import type { Azione } from '@/domain/types';

function creaAzione(fondamentale: Azione['fondamentale'], squadra: Azione['squadra'] = 'A'): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra, giocatoreId: 'p1',
    fondamentale, tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z',
  };
}

describe('determinaPassoAtteso', () => {
  it('è battuta quando il rally aperto non ha ancora azioni', () => {
    expect(determinaPassoAtteso([])).toBe('battuta');
  });

  it('è ricezione subito dopo una battuta', () => {
    expect(determinaPassoAtteso([creaAzione('battuta')])).toBe('ricezione');
  });

  it('è attacco subito dopo una ricezione', () => {
    expect(determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione')])).toBe('attacco');
  });

  it('è ancora attacco (contrattacco) dopo un attacco o un muro: il muro non si sceglie mai a parte', () => {
    expect(determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco')])).toBe('attacco');
    expect(
      determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco'), creaAzione('muro')]),
    ).toBe('attacco');
  });
});

describe('fasiSchema', () => {
  it('prima della battuta solo chi riceve e schierato in ricezione', () => {
    expect(fasiSchema([], 'A')).toEqual({ B: 'ricezione' });
    expect(fasiSchema([], 'B')).toEqual({ A: 'ricezione' });
  });

  it('dopo la battuta chi riceve resta in ricezione', () => {
    expect(fasiSchema([creaAzione('battuta', 'A')], 'A')).toEqual({ B: 'ricezione' });
  });

  it('finito lo scambio battuta-ricezione entrambe le squadre vanno ai loro posti', () => {
    expect(fasiSchema([creaAzione('battuta', 'A'), creaAzione('ricezione', 'B')], 'A')).toEqual({
      A: 'cambio', B: 'cambio',
    });
  });

  it('ci restano per tutto il resto del rally (attacchi, muri, contrattacchi)', () => {
    const rally = [creaAzione('battuta', 'A'), creaAzione('ricezione', 'B'), creaAzione('attacco', 'B'), creaAzione('muro', 'A')];
    expect(fasiSchema(rally, 'A')).toEqual({ A: 'cambio', B: 'cambio' });
  });
});
