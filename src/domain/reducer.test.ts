import { describe, it, expect } from 'vitest';
import { deriveSetState, squadraOpposta, determinaEsitoAutomatico } from './reducer';
import type { Azione, CorrezionePunteggio, Rally, SetPallavolo } from './types';

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

describe('deriveSetState', () => {
  it('assegna il punto al servizio su ace segnato direttamente sulla battuta, senza ruotare', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '#' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(1);
    expect(stato.punteggioB).toBe(0);
    expect(stato.squadraAlServizio).toBe('A');
    expect(stato.rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('assegna il punto alla squadra al servizio quando la ricezione avversaria è un errore totale (es. ace rilevato dalla ricezione)', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [
      creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', fondamentale: 'battuta', valutazione: '+' }),
      creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '=' }),
    ]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(1);
    expect(stato.punteggioB).toBe(0);
    expect(stato.squadraAlServizio).toBe('A');
    expect(stato.rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('assegna il punto alla squadra ricevente su errore di battuta e ruota chi ha vinto', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '=' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(1);
    expect(stato.squadraAlServizio).toBe('B');
    expect(stato.rotazioneB).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b1']);
  });

  it('lascia il rally aperto se nessuna azione lo chiude (es. sola ricezione positiva)', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([
      ['r1', [
        creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', fondamentale: 'battuta', valutazione: '+' }),
        creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '#', destinazione: null }),
      ]],
    ]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(0);
    expect(stato.rallyApertoNumero).toBe(1);
  });

  it('rispetta la chiusura manuale ignorando le azioni presenti', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: 'punto_B', chiusuraManuale: true };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '#' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioB).toBe(1);
    expect(stato.punteggioA).toBe(0);
  });

  it('applica una sostituzione prima del rally successivo alla sua registrazione', () => {
    const rally1: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: 'punto_A', chiusuraManuale: true };
    const rally2: Rally = { id: 'r2', setId: 'set1', numero: 2, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map<string, Azione[]>([['r1', []], ['r2', []]]);
    const sostituzioni = [{ id: 'sub1', setId: 'set1', dopoRallyNumero: 1, squadra: 'A' as const, giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1' }];
    const stato = deriveSetState(creaSet(), [rally1, rally2], azioni, sostituzioni);
    expect(stato.rotazioneA).toEqual(['a1', 'a2', 'libero1', 'a4', 'a5', 'a6']);
  });
});

describe('determinaEsitoAutomatico', () => {
  it('un attacco murato per punto (valutazione /) chiude il rally a favore della squadra che ha murato', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', squadra: 'A', fondamentale: 'attacco', valutazione: '/' }),
    ];
    expect(determinaEsitoAutomatico(azioni)).toBe('punto_B');
  });

  it('un muro in invasione (valutazione /) chiude il rally a favore della squadra avversaria', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', squadra: 'B', fondamentale: 'muro', valutazione: '/' }),
    ];
    expect(determinaEsitoAutomatico(azioni)).toBe('punto_A');
  });
});

describe('squadraOpposta', () => {
  it('restituisce la squadra avversaria', () => {
    expect(squadraOpposta('A')).toBe('B');
    expect(squadraOpposta('B')).toBe('A');
  });
});

describe('deriveSetState — rally con lo stesso numero', () => {
  const rallyManuale = (id: string, numero: number, esito: Rally['esito']): Rally => ({
    id, setId: 'set1', numero, squadraAlServizio: 'A', esito, chiusuraManuale: true,
  });

  it('un punto manuale registrato due volte con lo stesso numero conta una volta sola', () => {
    const rallies = [rallyManuale('r1', 1, 'punto_A'), rallyManuale('r1bis', 1, 'punto_A')];
    const stato = deriveSetState(creaSet(), rallies, new Map(), []);
    expect(stato.punteggioA).toBe(1);
    expect(stato.rallyApertoNumero).toBe(2);
  });

  it('lo stesso rally presente due volte (stesso id) conta una volta sola', () => {
    const rally = rallyManuale('r1', 1, 'punto_B');
    const stato = deriveSetState(creaSet(), [rally, rally], new Map(), []);
    expect(stato.punteggioB).toBe(1);
  });

  it('tra due rally con lo stesso numero vale quello che ha le azioni', () => {
    const vuoto: Rally = { id: 'vuoto', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const conAce: Rally = { id: 'conAce', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['conAce', [creaAzione({ id: 'ace', rallyId: 'conAce', valutazione: '#' })]]]);
    expect(deriveSetState(creaSet(), [vuoto, conAce], azioni, []).punteggioA).toBe(1);
    expect(deriveSetState(creaSet(), [conAce, vuoto], azioni, []).punteggioA).toBe(1);
  });

  it('rally con numeri diversi continuano a contare tutti', () => {
    const rallies = [rallyManuale('r1', 1, 'punto_A'), rallyManuale('r2', 2, 'punto_A')];
    expect(deriveSetState(creaSet(), rallies, new Map(), []).punteggioA).toBe(2);
  });
});

describe('deriveSetState — correzioni di punteggio', () => {
  const correzione = (deltaA: number, deltaB: number, dopoRallyNumero = 0): CorrezionePunteggio => ({
    id: `c-${deltaA}-${deltaB}`, setId: 'set1', dopoRallyNumero, deltaA, deltaB,
  });
  const puntoB: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: 'punto_B', chiusuraManuale: true };

  it('somma le correzioni al punteggio dei rally', () => {
    const stato = deriveSetState(creaSet(), [puntoB], new Map(), [], [correzione(3, -1, 1)]);
    expect(stato.punteggioA).toBe(3);
    expect(stato.punteggioB).toBe(0);
  });

  it('non cambia rotazione, servizio ne numero del rally aperto', () => {
    const senza = deriveSetState(creaSet(), [puntoB], new Map(), []);
    const con = deriveSetState(creaSet(), [puntoB], new Map(), [], [correzione(5, 5, 1)]);
    expect(con.rotazioneA).toEqual(senza.rotazioneA);
    expect(con.rotazioneB).toEqual(senza.rotazioneB);
    expect(con.squadraAlServizio).toBe(senza.squadraAlServizio);
    expect(con.rallyApertoNumero).toBe(senza.rallyApertoNumero);
  });

  it('piu correzioni si sommano e il punteggio non scende sotto zero', () => {
    const stato = deriveSetState(creaSet(), [], new Map(), [], [correzione(2, 1), correzione(-5, 0)]);
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(1);
  });
});
