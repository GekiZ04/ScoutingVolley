import { describe, it, expect } from 'vitest';
import { determinaPassoAtteso } from './flowLogic';
import type { Azione } from '@/domain/types';

function creaAzione(fondamentale: Azione['fondamentale']): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale, tipoBattuta: null, valutazione: '#', zona: 1, direzione: 5,
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

  it('è un bivio dopo un attacco o un muro', () => {
    expect(determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco')])).toBe('bivio');
    expect(
      determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco'), creaAzione('muro')]),
    ).toBe('bivio');
  });
});
