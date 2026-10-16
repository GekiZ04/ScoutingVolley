import { describe, it, expect } from 'vitest';
import { codiciSet } from './codiciDataVolley';
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

const numeri: Record<string, number> = { a1: 1, a7: 7, a46: 46, b1: 15, b2: 98 };
const numeroDi = (id: string) => numeri[id] ?? null;

describe('codiciSet', () => {
  const base = { sostituzioni: [], numeroDi };

  // Un'azione per rally: solo i codici delle azioni (niente punti).
  function codiceSingolo(azione: Azione): string {
    const c = codiciSet({
      set: creaSet(), rallies: [creaRally(1)], ...base, azioni: [{ ...azione, rallyId: 'r1' }],
    });
    return c.filter((x) => x.azioneIds.length > 0)[0].testo;
  }

  it('codice battuta, attacco, muro (tipo battuta, numero a due cifre, murante tralasciato)', () => {
    expect(codiceSingolo(battuta({ squadra: 'B', giocatoreId: 'b1', tipoBattuta: 'salto_spin', valutazione: '-' }))).toBe('a15SQ-');
    expect(codiceSingolo(attacco({ squadra: 'A', giocatoreId: 'a46', valutazione: '#' }))).toBe('*46AH#');
    expect(codiceSingolo(muro({ squadra: 'A', giocatoreId: null, valutazione: '#' }))).toBe('*$$BH#');
    expect(codiceSingolo(attacco({ squadra: 'A', giocatoreId: 'a7', valutazione: '+' }))).toBe('*07AH+');
    expect(codiceSingolo(battuta({ tipoBattuta: 'salto_flottante' }))).toBe('*01SM#');
    expect(codiceSingolo(battuta({ tipoBattuta: 'flottante' }))).toBe('*01SH#');
    expect(codiceSingolo(battuta({ tipoBattuta: null }))).toBe('*01SH#');
  });

  it('il codice punto tiene conto delle correzioni di punteggio', () => {
    const c = codiciSet({
      set: creaSet(),
      rallies: [creaRally(1, { chiusuraManuale: true, esito: 'punto_A' }), creaRally(2, { chiusuraManuale: true, esito: 'punto_B' })],
      azioni: [], ...base,
      correzioniPunteggio: [{ id: 'c', setId: 'set1', dopoRallyNumero: 1, deltaA: 4, deltaB: 0 }],
    });
    expect(c.map((x) => x.testo)).toEqual(['*p01:00', 'ap05:01']);
  });

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
