import { describe, it, expect } from 'vitest';
import { normalizzaSuSquadra, normalizzaSet, normalizzaSostituzioni } from './sommaPartite';
import type { Azione, Rally, SetPallavolo, Sostituzione } from './types';

function az(overrides: Partial<Azione>): Azione {
  return {
    id: 'a', rallyId: 'r', setId: 's', ordine: 1, squadra: 'A', giocatoreId: 'g', fondamentale: 'battuta',
    tipoBattuta: 'flottante', valutazione: '+', origine: null, destinazione: null, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}
function rally(overrides: Partial<Rally>): Rally {
  return { id: 'r', setId: 's', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false, ...overrides };
}

describe('normalizzaSuSquadra', () => {
  it('porta la squadra scelta sul lato A', () => {
    const r = normalizzaSuSquadra([az({ squadra: 'B' })], [rally({ squadraAlServizio: 'B', esito: 'punto_B' })], 'B');
    expect(r.azioni[0].squadra).toBe('A');
    expect(r.rallies[0]).toMatchObject({ squadraAlServizio: 'A', esito: 'punto_A' });
  });
  it('lato A: invariato', () => {
    const r = normalizzaSuSquadra([az({ squadra: 'B' })], [rally({ esito: 'punto_B' })], 'A');
    expect(r.azioni[0].squadra).toBe('B');
    expect(r.rallies[0].esito).toBe('punto_B');
  });
  it('esito null resta null', () => {
    expect(normalizzaSuSquadra([], [rally({})], 'B').rallies[0].esito).toBeNull();
  });
  it('somma di due partite con la squadra su lati diversi', () => {
    const p1 = normalizzaSuSquadra([az({ squadra: 'A' }), az({ id: 'b', squadra: 'B' })], [], 'A');
    const p2 = normalizzaSuSquadra(
      [az({ squadra: 'B' }), az({ id: 'c', squadra: 'B' }), az({ id: 'd', squadra: 'A' })],
      [],
      'B',
    );
    const tutte = [...p1.azioni, ...p2.azioni];
    expect(tutte.filter((a) => a.squadra === 'A' && a.fondamentale === 'battuta')).toHaveLength(3);
  });
});

describe('normalizzaSet / normalizzaSostituzioni', () => {
  const set = {
    id: 's', matchId: 'm', numero: 1, formazioneInizialeA: ['a'], formazioneInizialeB: ['b'],
    primaSquadraAlServizio: 'B', stato: 'concluso', vincitore: 'B',
    paleggiatoreIdA: 'pa', paleggiatoreIdB: 'pb', giroA: 'orario', giroB: 'antiorario',
  } as unknown as SetPallavolo;
  it('lato B scambia i campi per squadra', () => {
    const n = normalizzaSet(set, 'B');
    expect(n).toMatchObject({
      formazioneInizialeA: ['b'], formazioneInizialeB: ['a'], paleggiatoreIdA: 'pb', paleggiatoreIdB: 'pa',
      giroA: 'antiorario', giroB: 'orario', primaSquadraAlServizio: 'A', vincitore: 'A',
    });
  });
  it('lato A invariato', () => {
    expect(normalizzaSet(set, 'A')).toBe(set);
  });
  it('sostituzioni scambiano la squadra', () => {
    const s = [{ squadra: 'B' }] as Sostituzione[];
    expect(normalizzaSostituzioni(s, 'B')[0].squadra).toBe('A');
  });
});
