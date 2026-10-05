import { describe, it, expect } from 'vitest';
import { calcolaRigaGiocatore, calcolaRigaSquadra } from './statisticheComplete';
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
  it("conta come errore anche il muro negativo ('='), cioe' toccato ma l'attacco e' passato", () => {
    const azioni = [
      az({ fondamentale: 'muro', valutazione: '=' }),
      az({ fondamentale: 'muro', valutazione: '!' }),
      az({ fondamentale: 'muro', valutazione: '#' }),
    ];
    expect(calcolaRigaGiocatore(azioni, 'p1').muro).toEqual({ tot: 3, err: 1, pt: 1, ptPercento: expect.closeTo(33.33, 1) });
  });

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

describe('calcolaRigaGiocatore — direzioni battuta', () => {
  it('calcola le percentuali di parallela/diagonale/centro sulle battute con traiettoria nota, separate dall attacco', () => {
    const azioni = [
      az({ fondamentale: 'battuta', origine: { x: 5, y: 10 }, destinazione: { x: 95, y: 10 } }), // parallela
      az({ fondamentale: 'battuta', origine: { x: 5, y: 10 }, destinazione: { x: 95, y: 90 } }), // diagonale
      // Un attacco con traiettoria diversa non deve influenzare le direzioni di battuta.
      az({ fondamentale: 'attacco', origine: { x: 30, y: 50 }, destinazione: { x: 70, y: 50 } }),
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    expect(riga.direzioniBattuta.parallelaPercento).toBeCloseTo(50, 1);
    expect(riga.direzioniBattuta.diagonalePercento).toBeCloseTo(50, 1);
    expect(riga.direzioniBattuta.centroPercento).toBe(0);
    expect(riga.direzioniAttacco.centroPercento).toBe(100);
  });

  it('restituisce tutto a 0 se non ci sono battute con traiettoria nota', () => {
    const riga = calcolaRigaGiocatore([], 'p1');
    expect(riga.direzioniBattuta).toEqual({ parallelaPercento: 0, diagonalePercento: 0, centroPercento: 0 });
  });
});

describe('calcolaRigaSquadra', () => {
  it('somma le azioni di tutta la squadra e ricalcola le percentuali sul totale', () => {
    const azioni = [
      az({ giocatoreId: 'p1', fondamentale: 'battuta', valutazione: '#' }),
      az({ giocatoreId: 'p1', fondamentale: 'battuta', valutazione: '=' }),
      az({ giocatoreId: 'p2', fondamentale: 'battuta', valutazione: '+' }),
      az({ giocatoreId: 'p2', fondamentale: 'battuta', valutazione: '#' }),
      az({ squadra: 'B', giocatoreId: 'b1', fondamentale: 'battuta', valutazione: '#' }),
    ];
    expect(calcolaRigaSquadra(azioni, 'A').battuta).toEqual({ tot: 4, err: 1, pt: 2, ptPercento: 50 });
  });

  it('conta errori e murate di attacco della squadra, con efficienza sul totale', () => {
    const azioni = [
      az({ id: 'a1', rallyId: 'r1', giocatoreId: 'p1', valutazione: '#' }),
      az({ id: 'a2', rallyId: 'r2', giocatoreId: 'p2', valutazione: '=' }),
      az({ id: 'a3', rallyId: 'r3', giocatoreId: 'p2', valutazione: '/' }),
      az({ id: 'a4', rallyId: 'r4', giocatoreId: 'p3', valutazione: '#' }),
    ];
    const riga = calcolaRigaSquadra(azioni, 'A');
    expect(riga.attacco).toEqual({ tot: 4, err: 1, mur: 1, pt: 2, ptPercento: 50, efficienzaPercento: 0 });
  });

  it('include anche i muri senza giocatore assegnato', () => {
    const azioni = [
      az({ giocatoreId: null, fondamentale: 'muro', valutazione: '#' }),
      az({ giocatoreId: 'p1', fondamentale: 'muro', valutazione: '!' }),
    ];
    expect(calcolaRigaSquadra(azioni, 'A').muro).toEqual({ tot: 2, err: 0, pt: 1, ptPercento: 50 });
  });
});
