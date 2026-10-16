import { describe, expect, it } from 'vitest';
import {
  cellaSetGiocatore,
  durataSet,
  parzialiSet,
  puntiVintiPerFonte,
  statPunti,
} from './tabellinoExtra';
import { vincePunto } from './reducer';
import type { InfoRally } from './cronologiaSet';
import type { Azione, Player, Rally, SetPallavolo, Sostituzione } from './types';

let n = 0;
function az(over: Partial<Azione> = {}): Azione {
  n += 1;
  return {
    id: `a${n}`,
    rallyId: 'r1',
    setId: 's1',
    ordine: n,
    squadra: 'A',
    giocatoreId: 'p1',
    fondamentale: 'attacco',
    tipoBattuta: null,
    valutazione: '+',
    origine: null,
    destinazione: null,
    toccoMuro: false,
    timestamp: '2026-01-01T10:00:00Z',
    ...over,
  };
}
function rally(id: string, numero: number, srv: 'A' | 'B', over: Partial<Rally> = {}): Rally {
  return { id, setId: 's1', numero, squadraAlServizio: srv, esito: null, chiusuraManuale: false, ...over };
}
const tempo = (h: string) => `2026-01-01T${h}:00Z`;

describe('vincePunto', () => {
  it('true solo per le chiusure a favore dell esecutore', () => {
    expect(vincePunto('attacco', '#')).toBe(true);
    expect(vincePunto('battuta', '#')).toBe(true);
    expect(vincePunto('muro', '#')).toBe(true);
    expect(vincePunto('attacco', '/')).toBe(false);
    expect(vincePunto('ricezione', '+')).toBe(false);
  });
});

describe('statPunti', () => {
  it('punti, break point e vinti-persi', () => {
    const rallies = [rally('r1', 1, 'A'), rally('r2', 2, 'B'), rally('r3', 3, 'A')];
    const azioni = [
      az({ rallyId: 'r1', fondamentale: 'attacco', valutazione: '#' }),
      az({ rallyId: 'r2', squadra: 'A', fondamentale: 'muro', valutazione: '#' }),
      az({ rallyId: 'r3', fondamentale: 'attacco', valutazione: '/' }),
    ];
    expect(statPunti(azioni, rallies, (a) => a.giocatoreId === 'p1')).toEqual({ tot: 2, bp: 1, vp: 1 });
  });
});

describe('puntiVintiPerFonte', () => {
  it('rally manuale senza azioni in erAv', () => {
    const rallies = [
      rally('r1', 1, 'A'),
      rally('r2', 2, 'A'),
      rally('r3', 3, 'A', { chiusuraManuale: true, esito: 'punto_A' }),
    ];
    const azioni = [
      az({ rallyId: 'r1', fondamentale: 'attacco', valutazione: '#' }),
      az({ rallyId: 'r2', fondamentale: 'muro', valutazione: '#' }),
    ];
    expect(puntiVintiPerFonte(azioni, rallies, 'A')).toEqual({ batt: 0, att: 1, mur: 1, erAv: 1 });
  });
  it('battuta e errore avversario', () => {
    const rallies = [rally('r1', 1, 'A'), rally('r2', 2, 'A')];
    const azioni = [
      az({ rallyId: 'r1', fondamentale: 'battuta', valutazione: '#' }),
      az({ rallyId: 'r2', squadra: 'B', fondamentale: 'attacco', valutazione: '=' }),
    ];
    expect(puntiVintiPerFonte(azioni, rallies, 'A')).toEqual({ batt: 1, att: 0, mur: 0, erAv: 1 });
  });
});

describe('cellaSetGiocatore', () => {
  const set = {
    id: 's1',
    formazioneInizialeA: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
    formazioneInizialeB: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    paleggiatoreIdA: 'p2',
    paleggiatoreIdB: null,
  } as unknown as SetPallavolo;
  const pl = (id: string) => ({ id }) as unknown as Player;
  const sost = [{ id: 'x', setId: 's1', squadra: 'A', giocatoreEntraId: 'p7' }] as unknown as Sostituzione[];
  it('titolare con posizione, palleggiatore, entrato, null', () => {
    expect(cellaSetGiocatore({ set, sostituzioni: sost, azioni: [], giocatore: pl('p2') })).toEqual({
      tipo: 'titolare', posizione: 2, palleggiatore: true,
    });
    expect(cellaSetGiocatore({ set, sostituzioni: sost, azioni: [], giocatore: pl('p3') })).toEqual({
      tipo: 'titolare', posizione: 3, palleggiatore: false,
    });
    expect(cellaSetGiocatore({ set, sostituzioni: sost, azioni: [], giocatore: pl('p7') })).toEqual({ tipo: 'entrato' });
    expect(
      cellaSetGiocatore({ set, sostituzioni: [], azioni: [az({ giocatoreId: 'p8' })], giocatore: pl('p8') }),
    ).toEqual({ tipo: 'entrato' });
    expect(cellaSetGiocatore({ set, sostituzioni: sost, azioni: [], giocatore: pl('p9') })).toBeNull();
  });
  it('titolare di B', () => {
    expect(cellaSetGiocatore({ set, sostituzioni: [], azioni: [], giocatore: pl('q4') })).toEqual({
      tipo: 'titolare', posizione: 4, palleggiatore: false,
    });
  });
});

describe('durataSet', () => {
  it('h.mm', () => {
    expect(durataSet([az({ timestamp: tempo('10:00') }), az({ timestamp: tempo('11:07') })])).toBe('1.07');
    expect(durataSet([az({ timestamp: tempo('10:00') }), az({ timestamp: tempo('10:25') })])).toBe('0.25');
  });
  it('0.00 con meno di 2 azioni', () => {
    expect(durataSet([])).toBe('0.00');
    expect(durataSet([az()])).toBe('0.00');
  });
});

function cron(punti: [number, number][]): InfoRally[] {
  return punti.map(([a, b], i) => ({
    rallyId: `r${i}`, numero: i + 1, squadraAlServizio: 'A', rotazioneA: [], rotazioneB: [],
    vincitore: null, punteggioA: a, punteggioB: b,
  }));
}
describe('parzialiSet', () => {
  it('a 8, 16, 21', () => {
    expect(parzialiSet(cron([[6, 7], [6, 8], [10, 15], [10, 16], [11, 20], [11, 21]]))).toEqual(['6-8', '10-16', '11-21']);
  });
  it('non raggiunti restano null', () => {
    expect(parzialiSet(cron([[8, 5], [15, 10]]))).toEqual(['8-5', null, null]);
  });
});
