import { describe, it, expect } from 'vitest';
import { classificaDirezione, isMurato, analizzaTendenze, distribuzioneDirezioniAttacco, fasciaLaterale } from './analysis';
import type { Azione, Punto } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

const P = (x: number, y: number): Punto => ({ x, y });

describe('fasciaLaterale', () => {
  it('classifica sinistra, centro, destra per terzi di y', () => {
    expect(fasciaLaterale(10)).toBe('sinistra');
    expect(fasciaLaterale(50)).toBe('centro');
    expect(fasciaLaterale(90)).toBe('destra');
  });
});

describe('classificaDirezione', () => {
  it('stessa fascia laterale è parallela', () => {
    expect(classificaDirezione(P(20, 10), P(70, 15))).toBe('parallela');
  });

  it('fasce laterali opposte è diagonale', () => {
    expect(classificaDirezione(P(20, 10), P(70, 90))).toBe('diagonale');
  });

  it('fascia centrale coinvolta è centro', () => {
    expect(classificaDirezione(P(20, 50), P(70, 10))).toBe('centro');
    expect(classificaDirezione(P(20, 10), P(70, 50))).toBe('centro');
  });
});

describe('isMurato', () => {
  it('è vero se segue un muro avversario con punto nello stesso rally', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    const successive = [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '#' })];
    expect(isMurato(attacco, successive)).toBe(true);
  });

  it("è vero se l'attacco stesso ha toccoMuro anche senza azione muro successiva", () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco', toccoMuro: true });
    expect(isMurato(attacco, [])).toBe(true);
  });

  it("è falso se il muro successivo è della stessa squadra o non è punto, e non c'è toccoMuro", () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'A', fondamentale: 'muro', valutazione: '#' })])).toBe(false);
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '+' })])).toBe(false);
  });
});

describe('analizzaTendenze', () => {
  it('calcola le percentuali di direzione, murato, errore e il colpo principale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', origine: P(20, 10), destinazione: P(70, 15), valutazione: '#' }),
      creaAzione({ id: 'att2', rallyId: 'r2', origine: P(20, 10), destinazione: P(70, 15), valutazione: '+' }),
      creaAzione({ id: 'att3', rallyId: 'r3', origine: P(20, 10), destinazione: P(70, 90), valutazione: '=' }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.tentativi).toBe(3);
    expect(tendenze.percParallela).toBeCloseTo((2 / 3) * 100);
    expect(tendenze.percDiagonale).toBeCloseTo((1 / 3) * 100);
    expect(tendenze.colpoPrincipale).toBe('parallela');
    expect(tendenze.percErrore).toBeCloseTo((1 / 3) * 100);
  });

  it('marca murato un attacco seguito da un muro avversario vincente nello stesso rally', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '=' }),
      creaAzione({
        id: 'muro1', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'muro', valutazione: '#',
        origine: P(52, 50), destinazione: P(45, 50),
      }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it('marca murato anche un attacco con toccoMuro senza azione muro separata', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '!', toccoMuro: true }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it("conta come errore anche un attacco murato per punto ('/')", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '/' }),
      creaAzione({ id: 'att2', rallyId: 'r2', ordine: 1, valutazione: '+' }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percErrore).toBeCloseTo(50);
  });

  it('segnala allerta quando errori+murati superano la soglia', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '=' }),
      creaAzione({ id: 'att2', rallyId: 'r2', ordine: 1, valutazione: '#' }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1', 30);
    expect(tendenze.allerta).toBe(true);
  });

  it('restituisce un risultato neutro senza tentativi', () => {
    const tendenze = analizzaTendenze([], 'p1');
    expect(tendenze.tentativi).toBe(0);
    expect(tendenze.colpoPrincipale).toBeNull();
    expect(tendenze.allerta).toBe(false);
  });
});

describe('distribuzioneDirezioniAttacco', () => {
  it('conta gli attacchi per fascia laterale di destinazione', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', destinazione: P(70, 50) }),
      creaAzione({ id: 'att2', destinazione: P(70, 50) }),
      creaAzione({ id: 'att3', destinazione: P(70, 90) }),
    ];
    expect(distribuzioneDirezioniAttacco(azioni, 'p1')).toEqual({ sinistra: 0, centro: 2, destra: 1 });
  });
});
