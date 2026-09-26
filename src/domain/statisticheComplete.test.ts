import { describe, it, expect } from 'vitest';
import { calcolaRigaGiocatore } from './statisticheComplete';
import type { Azione } from './types';

function az(overrides: Partial<Azione>): Azione {
  return {
    id: `az-${Math.random()}`, rallyId: 'r1', setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 30, y: 50 }, destinazione: { x: 70, y: 50 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('calcolaRigaGiocatore — battuta', () => {
  it('conta tentativi, errori e ace con la percentuale punto', () => {
    const azioni = [
      az({ fondamentale: 'battuta', valutazione: '#' }),
      az({ fondamentale: 'battuta', valutazione: '+' }),
      az({ fondamentale: 'battuta', valutazione: '=' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.battuta).toEqual({ tot: 3, err: 1, pt: 1, ptPercento: expect.closeTo(33.33, 1) });
  });
});

describe('calcolaRigaGiocatore — ricezione', () => {
  it('calcola Pos% (perfetta+buona) e Prf% (solo perfetta)', () => {
    const azioni = [
      az({ fondamentale: 'ricezione', valutazione: '#' }),
      az({ fondamentale: 'ricezione', valutazione: '+' }),
      az({ fondamentale: 'ricezione', valutazione: '!' }),
      az({ fondamentale: 'ricezione', valutazione: '-' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.ricezione.tot).toBe(4);
    expect(riga.ricezione.posPercento).toBeCloseTo(50, 1);
    expect(riga.ricezione.prfPercento).toBeCloseTo(25, 1);
  });
});

describe('calcolaRigaGiocatore — attacco vs contrattacco', () => {
  it('separa Err (=) e Mur (/) in colonne distinte, con efficienza (pt-err-mur)/tot', () => {
    const azioni = [
      az({ id: 'a1', rallyId: 'r1', ordine: 1, valutazione: '#' }),
      az({ id: 'a2', rallyId: 'r1', ordine: 2, valutazione: '=' }),
      az({ id: 'a3', rallyId: 'r1', ordine: 3, valutazione: '/' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.attacco.tot).toBe(1);
    expect(riga.contrattacco.tot).toBe(2);
    expect(riga.contrattacco.err).toBe(1);
    expect(riga.contrattacco.mur).toBe(1);
    expect(riga.contrattacco.efficienzaPercento).toBeCloseTo(-100, 1);
  });
});

describe('calcolaRigaGiocatore — attacco dopo ricezione positiva/negativa', () => {
  it('classifica il primo attacco del rally in base alla ricezione appaiata della stessa squadra', () => {
    const azioni = [
      // Rally 1: ricezione positiva ('+') seguita da un attacco perfetto.
      az({ id: 'r1-ric', rallyId: 'rally1', ordine: 1, squadra: 'A', fondamentale: 'ricezione', valutazione: '+', giocatoreId: 'ricevente' }),
      az({ id: 'r1-att', rallyId: 'rally1', ordine: 2, squadra: 'A', fondamentale: 'attacco', valutazione: '#' }),
      // Rally 2: ricezione negativa ('-') seguita da un attacco in errore.
      az({ id: 'r2-ric', rallyId: 'rally2', ordine: 1, squadra: 'A', fondamentale: 'ricezione', valutazione: '-', giocatoreId: 'ricevente' }),
      az({ id: 'r2-att', rallyId: 'rally2', ordine: 2, squadra: 'A', fondamentale: 'attacco', valutazione: '=' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.attaccoDopoRicezionePositiva).toEqual({ tot: 1, err: 0, pt: 1, ptPercento: 100 });
    expect(riga.attaccoDopoRicezioneNegativa).toEqual({ tot: 1, err: 1, pt: 0, ptPercento: 0 });
  });

  it('non classifica i contrattacchi (non seguono direttamente una ricezione)', () => {
    const azioni = [
      az({ id: 'ric', rallyId: 'r1', ordine: 1, squadra: 'A', fondamentale: 'ricezione', valutazione: '+', giocatoreId: 'ricevente' }),
      az({ id: 'att1', rallyId: 'r1', ordine: 2, squadra: 'A', valutazione: '!' }),
      az({ id: 'muro', rallyId: 'r1', ordine: 3, squadra: 'B', fondamentale: 'muro', valutazione: '!', giocatoreId: 'bloccante' }),
      az({ id: 'att2', rallyId: 'r1', ordine: 4, squadra: 'A', valutazione: '#' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.attaccoDopoRicezionePositiva.tot).toBe(1);
    expect(riga.attaccoDopoRicezioneNegativa.tot).toBe(0);
    expect(riga.contrattacco.tot).toBe(1);
  });
});

describe('calcolaRigaGiocatore — muro', () => {
  it('conta tentativi, invasioni come errore e vincenti come punto', () => {
    const azioni = [
      az({ fondamentale: 'muro', valutazione: '#' }),
      az({ fondamentale: 'muro', valutazione: '/' }),
      az({ fondamentale: 'muro', valutazione: '+' }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.muro).toEqual({ tot: 3, err: 1, pt: 1, ptPercento: expect.closeTo(33.33, 1) });
  });
});

describe('calcolaRigaGiocatore — direzioni attacco', () => {
  it('calcola le percentuali di parallela/diagonale/centro sugli attacchi con traiettoria nota', () => {
    const azioni = [
      az({ origine: { x: 30, y: 10 }, destinazione: { x: 70, y: 10 } }), // stessa fascia -> parallela
      az({ origine: { x: 30, y: 10 }, destinazione: { x: 70, y: 90 } }), // fasce opposte -> diagonale
      az({ origine: { x: 30, y: 50 }, destinazione: { x: 70, y: 50 } }), // fascia centro -> centro
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.direzioniAttacco.parallelaPercento).toBeCloseTo(33.33, 1);
    expect(riga.direzioniAttacco.diagonalePercento).toBeCloseTo(33.33, 1);
    expect(riga.direzioniAttacco.centroPercento).toBeCloseTo(33.33, 1);
  });
});
