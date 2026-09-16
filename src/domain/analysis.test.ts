import { describe, it, expect } from 'vitest';
import { classificaDirezione, isMurato, analizzaTendenze, distribuzioneDirezioniAttacco } from './analysis';
import type { Azione } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('classificaDirezione', () => {
  it('stesso lato (sinistra->sinistra) è parallela', () => {
    expect(classificaDirezione(4, 5)).toBe('parallela');
  });

  it('lati opposti (sinistra->destra) è diagonale', () => {
    expect(classificaDirezione(4, 1)).toBe('diagonale');
  });

  it('colonna centrale coinvolta è centro', () => {
    expect(classificaDirezione(3, 5)).toBe('centro');
    expect(classificaDirezione(4, 8)).toBe('centro');
  });
});

describe('isMurato', () => {
  it('è vero se segue un muro avversario con punto nello stesso rally', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    const successive = [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '#' })];
    expect(isMurato(attacco, successive)).toBe(true);
  });

  it('è falso se il muro successivo è della stessa squadra o non è punto', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'A', fondamentale: 'muro', valutazione: '#' })])).toBe(false);
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '+' })])).toBe(false);
  });
});

describe('analizzaTendenze', () => {
  it('calcola le percentuali di direzione, murato, errore e il colpo principale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', zona: 4, direzione: 5, valutazione: '#' }),
      creaAzione({ id: 'att2', rallyId: 'r2', zona: 4, direzione: 5, valutazione: '+' }),
      creaAzione({ id: 'att3', rallyId: 'r3', zona: 4, direzione: 1, valutazione: '=' }),
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
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, zona: 4, direzione: 5, valutazione: '=' }),
      creaAzione({ id: 'muro1', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'muro', valutazione: '#', zona: 3, direzione: 6 }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it('segnala allerta quando errori+murati superano la soglia', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, zona: 4, direzione: 5, valutazione: '=' }),
      creaAzione({ id: 'att2', rallyId: 'r2', ordine: 1, zona: 4, direzione: 5, valutazione: '#' }),
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
  it('conta gli attacchi per zona di destinazione', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', direzione: 6 }),
      creaAzione({ id: 'att2', direzione: 6 }),
      creaAzione({ id: 'att3', direzione: 5 }),
    ];
    expect(distribuzioneDirezioniAttacco(azioni, 'p1')).toEqual({ 6: 2, 5: 1 });
  });
});
