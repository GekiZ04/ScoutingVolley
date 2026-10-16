import { describe, it, expect } from 'vitest';
import { codiceAzione, codiciSet } from './codiciDataVolley';
import type { Azione, Rally, SetPallavolo } from './types';

function creaSet(overrides: Partial<SetPallavolo> = {}): SetPallavolo {
  return {
    id: 'set1', matchId: 'match1', numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A', stato: 'in_corso', vincitore: null,
    paleggiatoreIdA: null, paleggiatoreIdB: null, giroA: null, giroB: null,
    ...overrides,
  };
}
function creaRally(numero: number, overrides: Partial<Rally> = {}): Rally {
  return { id: `r${numero}`, setId: 'set1', numero, squadraAlServizio: 'A', esito: null, chiusuraManuale: false, ...overrides };
}
function az(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'a1',
    fondamentale: 'battuta', tipoBattuta: null, valutazione: '#', origine: null, destinazione: null,
    toccoMuro: false, timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}
const battuta = (o: Partial<Azione>) => az({ fondamentale: 'battuta', ...o });
const ricezione = (o: Partial<Azione>) => az({ fondamentale: 'ricezione', ...o });
const attacco = (o: Partial<Azione>) => az({ fondamentale: 'attacco', ...o });
const muro = (o: Partial<Azione>) => az({ fondamentale: 'muro', ...o });

const numeri: Record<string, number> = { a1: 1, b1: 15, b2: 98 };
const numeroDi = (id: string) => numeri[id] ?? null;

describe('codiceAzione', () => {
  it('codice battuta, ricezione, attacco, muro', () => {
    expect(codiceAzione(battuta({ squadra: 'B', tipoBattuta: 'salto_spin', valutazione: '-' }), 15)).toBe('a15SQ-');
    expect(codiceAzione(attacco({ squadra: 'A', valutazione: '#' }), 46)).toBe('*46AH#');
    expect(codiceAzione(muro({ squadra: 'A', valutazione: '#' }), null)).toBe('*$$BH#');
    expect(codiceAzione(attacco({ squadra: 'A', valutazione: '+' }), 7)).toBe('*07AH+');
    expect(codiceAzione(battuta({ tipoBattuta: 'salto_flottante' }), 1)).toBe('*01SM#');
    expect(codiceAzione(battuta({ tipoBattuta: 'flottante' }), 1)).toBe('*01SH#');
    expect(codiceAzione(battuta({ tipoBattuta: null }), 1)).toBe('*01SH#');
  });
});

describe('codiciSet', () => {
  const base = { sostituzioni: [], numeroDi };

  it('la ricezione eredita il tipo della battuta', () => {
    const c = codiciSet({
      set: creaSet(), rallies: [creaRally(1)], ...base,
      azioni: [
        battuta({ id: 'b', ordine: 1, squadra: 'A', tipoBattuta: 'salto_spin', valutazione: '+' }),
        ricezione({ id: 'r', ordine: 2, squadra: 'B', giocatoreId: 'b2', valutazione: '+' }),
      ],
    });
    expect(c.map((x) => x.testo)).toEqual(['*01SQ+', 'a98RQ+']);
  });

  it('codice punto con punteggio dopo il rally', () => {
    const c = codiciSet({
      set: creaSet(),
      rallies: [creaRally(1, { chiusuraManuale: true, esito: 'punto_A' }), creaRally(2, { chiusuraManuale: true, esito: 'punto_B' })],
      azioni: [], ...base,
    });
    expect(c.map((x) => x.testo)).toEqual(['*p01:00', 'ap01:01']);
  });

  it('rally manuale senza azioni produce solo il punto', () => {
    const c = codiciSet({
      set: creaSet(), rallies: [creaRally(1, { chiusuraManuale: true, esito: 'punto_B' })], azioni: [], ...base,
    });
    expect(c).toHaveLength(1);
    expect(c[0].testo).toBe('ap00:01');
    expect(c[0].azioneIds).toEqual([]);
    expect(c[0].squadra).toBe('B');
  });

  it('battuta+ricezione dello stesso gesto hanno lo stesso gesto', () => {
    const c = codiciSet({
      set: creaSet(), rallies: [creaRally(1)], ...base,
      azioni: [
        battuta({ id: 'b', ordine: 1, valutazione: '+', timestamp: 't1' }),
        ricezione({ id: 'r', ordine: 2, squadra: 'B', valutazione: '+', timestamp: 't1' }),
        attacco({ id: 'x', ordine: 3, squadra: 'B', valutazione: '+', timestamp: 't2' }),
      ],
    });
    expect(c[0].gesto).toBe(c[1].gesto);
    expect(c[2].gesto).not.toBe(c[0].gesto);
    expect(c[0].azioneIds).toEqual(['b']);
    expect(new Set(c.map((x) => x.chiave)).size).toBe(3);
  });

  it('set concluso aggiunge **NSet in fondo', () => {
    const c = codiciSet({
      set: creaSet({ numero: 4, stato: 'concluso', vincitore: 'A' }),
      rallies: [creaRally(1, { chiusuraManuale: true, esito: 'punto_A' })], azioni: [], ...base,
    });
    expect(c[c.length - 1]).toMatchObject({ testo: '**4Set', squadra: null, azioneIds: [] });
  });
});
