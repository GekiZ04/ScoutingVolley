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
  it('lato B specchia origine e destinazione: gli attacchi della squadra partono tutti da x<50', () => {
    // Partita 1: la squadra e' A (meta' sinistra). Partita 2: e' B (meta' destra).
    const p1 = normalizzaSuSquadra(
      [az({ fondamentale: 'attacco', squadra: 'A', origine: { x: 40, y: 20 }, destinazione: { x: 80, y: 70 } })],
      [],
      'A',
    );
    const p2 = normalizzaSuSquadra(
      [az({ id: 'b', fondamentale: 'attacco', squadra: 'B', origine: { x: 62, y: 30 }, destinazione: { x: 15, y: 90 } })],
      [],
      'B',
    );
    const attacchi = [...p1.azioni, ...p2.azioni].filter((a) => a.squadra === 'A' && a.fondamentale === 'attacco');
    expect(attacchi).toHaveLength(2);
    for (const a of attacchi) expect(a.origine!.x).toBeLessThan(50);
    expect(p2.azioni[0].origine).toEqual({ x: 38, y: 70 });
    expect(p2.azioni[0].destinazione).toEqual({ x: 85, y: 10 });
  });
  it('lato B: origine/destinazione null restano null', () => {
    const r = normalizzaSuSquadra([az({ squadra: 'B' })], [], 'B');
    expect(r.azioni[0].origine).toBeNull();
    expect(r.azioni[0].destinazione).toBeNull();
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
