import { describe, it, expect } from 'vitest';
import { cronologiaSet, zonaPalleggiatore } from './cronologiaSet';
import { deriveSetState, raggruppaPerRally } from './reducer';
import { parzialiSet } from './tabellinoExtra';
import type { Azione, CorrezionePunteggio, Rally, SetPallavolo, Sostituzione } from './types';

function creaSet(overrides: Partial<SetPallavolo> = {}): SetPallavolo {
  return {
    id: 'set1',
    matchId: 'match1',
    numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A',
    stato: 'in_corso',
    vincitore: null,
    paleggiatoreIdA: null,
    paleggiatoreIdB: null,
    giroA: null,
    giroB: null,
    ...overrides,
  };
}

function creaRally(numero: number, overrides: Partial<Rally> = {}): Rally {
  return {
    id: `r${numero}`,
    setId: 'set1',
    numero,
    squadraAlServizio: 'A',
    esito: null,
    chiusuraManuale: false,
    ...overrides,
  };
}

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az',
    rallyId: 'r1',
    setId: 'set1',
    ordine: 1,
    squadra: 'A',
    giocatoreId: 'a1',
    fondamentale: 'battuta',
    tipoBattuta: 'flottante',
    valutazione: '#',
    origine: { x: 50, y: 50 },
    destinazione: { x: 50, y: 50 },
    toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

// rally 1: battuta A '=' (punto B); rally 2: attacco B '#' (punto B); rally 3 aperto
const rallies = [creaRally(1), creaRally(2, { squadraAlServizio: 'B' }), creaRally(3, { squadraAlServizio: 'B' })];
const azioni = [
  creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', fondamentale: 'battuta', valutazione: '=' }),
  creaAzione({ id: 'az2', rallyId: 'r2', squadra: 'B', fondamentale: 'attacco', valutazione: '#' }),
  creaAzione({ id: 'az3', rallyId: 'r3', squadra: 'B', fondamentale: 'battuta', valutazione: '+' }),
];

describe('cronologiaSet', () => {
  it('segue servizio, rotazione e punteggio rally per rally', () => {
    const c = cronologiaSet(creaSet(), rallies, azioni, []);
    expect(c.map((r) => r.squadraAlServizio)).toEqual(['A', 'B', 'B']);
    expect(c[0].rotazioneB).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
    expect(c[1].rotazioneB).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b1']); // B ha ruotato al cambio palla
    expect(c.map((r) => [r.punteggioA, r.punteggioB])).toEqual([[0, 1], [0, 2], [0, 2]]);
    expect(c.map((r) => r.numero)).toEqual([1, 2, 3]);
    expect(c.map((r) => r.vincitore)).toEqual(['B', 'B', null]);
    expect(c[2].vincitore).toBeNull();
  });

  it('ultimo stato coerente con deriveSetState', () => {
    const chiusi = rallies.slice(0, 2);
    const c = cronologiaSet(creaSet(), chiusi, azioni, []);
    const stato = deriveSetState(creaSet(), chiusi, raggruppaPerRally(azioni), []);
    const ultimo = c[c.length - 1];
    expect(ultimo.punteggioA).toBe(stato.punteggioA);
    expect(ultimo.punteggioB).toBe(stato.punteggioB);
    // stato prima dell'ultimo rally + sua conclusione: B ha vinto al servizio, nessuna rotazione ulteriore
    expect(ultimo.rotazioneB).toEqual(stato.rotazioneB);
    expect(ultimo.rotazioneA).toEqual(stato.rotazioneA);
    expect(ultimo.squadraAlServizio).toBe(stato.squadraAlServizio);
  });

  it('rally manuale senza azioni usa rally.esito', () => {
    const rally = creaRally(1, { chiusuraManuale: true, esito: 'punto_A' });
    const c = cronologiaSet(creaSet(), [rally], [], []);
    expect(c).toHaveLength(1);
    expect(c[0].vincitore).toBe('A');
    expect([c[0].punteggioA, c[0].punteggioB]).toEqual([1, 0]);
  });

  it('applica le sostituzioni dopo il rally precedente, prima del rally', () => {
    const sostituzioni: Sostituzione[] = [
      { id: 's1', setId: 'set1', dopoRallyNumero: 1, squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'a7' },
    ];
    const c = cronologiaSet(creaSet(), rallies, azioni, sostituzioni);
    expect(c[0].rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
    expect(c[1].rotazioneA).toEqual(['a1', 'a2', 'a7', 'a4', 'a5', 'a6']);
  });

  it('ignora i rally duplicati con lo stesso numero', () => {
    const doppio = [creaRally(1), creaRally(1, { id: 'r1bis' }), creaRally(2, { squadraAlServizio: 'B' })];
    const c = cronologiaSet(creaSet(), doppio, azioni, []);
    expect(c.map((r) => r.numero)).toEqual([1, 2]);
    expect(c[0].rallyId).toBe('r1');
  });

  it('applica le correzioni di punteggio fatte prima della fine del rally', () => {
    // +2 ad A dopo il rally 1 (quindi prima del rally 2), -1 a B a rally 3 aperto.
    const correzioni: CorrezionePunteggio[] = [
      { id: 'c1', setId: 'set1', dopoRallyNumero: 1, deltaA: 2, deltaB: 0 },
      { id: 'c2', setId: 'set1', dopoRallyNumero: 2, deltaA: 0, deltaB: -1 },
    ];
    const c = cronologiaSet(creaSet(), rallies, azioni, [], correzioni);
    expect(c.map((r) => [r.punteggioA, r.punteggioB])).toEqual([[0, 1], [2, 2], [2, 1]]);
    // L'ultimo rally coincide col tabellone (deriveSetState).
    const stato = deriveSetState(creaSet(), rallies, raggruppaPerRally(azioni), [], correzioni);
    expect([c[2].punteggioA, c[2].punteggioB]).toEqual([stato.punteggioA, stato.punteggioB]);
  });

  it('senza correzioni il risultato non cambia (parametro facoltativo)', () => {
    expect(cronologiaSet(creaSet(), rallies, azioni, [], [])).toEqual(cronologiaSet(creaSet(), rallies, azioni, []));
  });

  it('i parziali del tabellino tengono conto delle correzioni', () => {
    // 8 rally vinti da A; correzione +3 a B dopo il rally 2.
    const tanti = Array.from({ length: 8 }, (_, i) => creaRally(i + 1, { chiusuraManuale: true, esito: 'punto_A' }));
    const correzioni: CorrezionePunteggio[] = [{ id: 'c', setId: 'set1', dopoRallyNumero: 2, deltaA: 0, deltaB: 3 }];
    expect(parzialiSet(cronologiaSet(creaSet(), tanti, [], [], correzioni))[0]).toBe('8-3');
  });
});

describe('zonaPalleggiatore', () => {
  it('restituisce la zona (1-6) del palleggiatore o null', () => {
    expect(zonaPalleggiatore(['p', 'x', 'x', 'x', 'x', 'x'], 'p')).toBe(1);
    expect(zonaPalleggiatore(['x', 'x', 'x', 'p', 'x', 'x'], 'p')).toBe(4);
    expect(zonaPalleggiatore(['x', 'x', 'x', 'x', 'x', 'x'], null)).toBeNull();
    expect(zonaPalleggiatore(['x', 'x', 'x', 'x', 'x', 'x'], 'p')).toBeNull();
  });
});
