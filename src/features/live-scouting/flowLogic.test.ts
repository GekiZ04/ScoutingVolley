import { describe, it, expect } from 'vitest';
import { determinaPassoAtteso, faseSchemaSquadra } from './flowLogic';
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

describe('faseSchemaSquadra', () => {
  it('prima della battuta chi riceve e gia schierato in ricezione, chi serve resta fermo', () => {
    expect(faseSchemaSquadra([], 'A')).toEqual({ squadra: 'B', fase: 'ricezione' });
    expect(faseSchemaSquadra([], 'B')).toEqual({ squadra: 'A', fase: 'ricezione' });
  });

  it('dopo la battuta la squadra avversaria a chi batte resta in ricezione', () => {
    expect(faseSchemaSquadra([creaAzione('battuta', 'A')], 'A')).toEqual({ squadra: 'B', fase: 'ricezione' });
    expect(faseSchemaSquadra([creaAzione('battuta', 'B')], 'B')).toEqual({ squadra: 'A', fase: 'ricezione' });
  });

  it('dopo la ricezione la squadra che ha ricevuto si sposta in attacco', () => {
    expect(
      faseSchemaSquadra([creaAzione('battuta', 'A'), creaAzione('ricezione', 'B')], 'A'),
    ).toEqual({ squadra: 'B', fase: 'attacco' });
  });

  it('dal primo attacco in poi le posizioni tornano libere', () => {
    expect(
      faseSchemaSquadra([creaAzione('battuta', 'A'), creaAzione('ricezione', 'B'), creaAzione('attacco', 'B')], 'A'),
    ).toBeNull();
  });
});
