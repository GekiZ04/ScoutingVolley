import { describe, it, expect } from 'vitest';
import { deriveSetState } from './reducer';
import type { Azione, Rally, SetPallavolo } from './types';

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
    zona: 1,
    direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('deriveSetState', () => {
  it('assegna il punto al servizio su ace, senza ruotare', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '#' })]]]);
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
        creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '#', direzione: null }),
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
