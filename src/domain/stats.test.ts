import { describe, it, expect } from 'vitest';
import { calcolaStatistiche, distribuzionePalleggio } from './stats';
import type { Azione } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('calcolaStatistiche', () => {
  it('calcola tentativi, perfetti, errori ed efficienza per un giocatore su un fondamentale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', valutazione: '#' }),
      creaAzione({ id: 'az2', rallyId: 'r2', valutazione: '+' }),
      creaAzione({ id: 'az3', rallyId: 'r3', valutazione: '=' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(3);
    expect(stats.perfetti).toBe(1);
    expect(stats.errori).toBe(1);
    expect(stats.efficienzaPercento).toBeCloseTo(0);
  });

  it('ignora azioni di altri fondamentali o di altri giocatori', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', valutazione: '#', giocatoreId: 'p2' }),
      creaAzione({ id: 'az3', fondamentale: 'muro', valutazione: '#', giocatoreId: 'p1' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(1);
  });

  it('aggrega per squadra quando non si passa un giocatoreId', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', rallyId: 'r2', valutazione: '#', giocatoreId: 'p2' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco');
    expect(stats.tentativi).toBe(2);
    expect(stats.efficienzaPercento).toBeCloseTo(100);
  });

  it("conta come errore un attacco murato per punto ('/'), non solo '='", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', valutazione: '#' }),
      creaAzione({ id: 'az2', rallyId: 'r2', valutazione: '/' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(2);
    expect(stats.errori).toBe(1);
    expect(stats.efficienzaPercento).toBeCloseTo(0);
  });

  it("il primo attacco di un rally resta 'attacco', quelli successivi diventano 'contrattacco'", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', ordine: 1, valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', rallyId: 'r1', ordine: 2, valutazione: '+', giocatoreId: 'p2' }),
      creaAzione({ id: 'az3', rallyId: 'r1', ordine: 3, valutazione: '=', giocatoreId: 'p1' }),
    ];
    const attacco = calcolaStatistiche(azioni, 'attacco');
    const contrattacco = calcolaStatistiche(azioni, 'contrattacco');
    expect(attacco.tentativi).toBe(1);
    expect(contrattacco.tentativi).toBe(2);
    expect(contrattacco.errori).toBe(1);
  });

  it("se la ricezione passa di la e attacca per prima la squadra al servizio, quell attacco e un contrattacco", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'bat', rallyId: 'r1', ordine: 1, squadra: 'A', fondamentale: 'battuta', valutazione: '/' }),
      creaAzione({ id: 'ric', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'ricezione', valutazione: '/' }),
      creaAzione({ id: 'attA', rallyId: 'r1', ordine: 3, squadra: 'A', valutazione: '+' }),
      creaAzione({ id: 'attB', rallyId: 'r1', ordine: 4, squadra: 'B', valutazione: '#' }),
    ];
    expect(calcolaStatistiche(azioni, 'attacco').tentativi).toBe(0);
    expect(calcolaStatistiche(azioni, 'contrattacco').tentativi).toBe(2);
  });

  it("il primo attacco della squadra che ha ricevuto resta 'attacco'", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'bat', rallyId: 'r1', ordine: 1, squadra: 'A', fondamentale: 'battuta', valutazione: '-' }),
      creaAzione({ id: 'ric', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'ricezione', valutazione: '+' }),
      creaAzione({ id: 'attB', rallyId: 'r1', ordine: 3, squadra: 'B', valutazione: '+' }),
      creaAzione({ id: 'attA', rallyId: 'r1', ordine: 4, squadra: 'A', valutazione: '#' }),
    ];
    expect(calcolaStatistiche(azioni, 'attacco').tentativi).toBe(1);
    expect(calcolaStatistiche(azioni, 'contrattacco').tentativi).toBe(1);
  });

  it("il contrattacco resta filtrabile per giocatore come gli altri fondamentali", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', ordine: 1, valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', rallyId: 'r1', ordine: 2, valutazione: '#', giocatoreId: 'p2' }),
      creaAzione({ id: 'az3', rallyId: 'r1', ordine: 3, valutazione: '#', giocatoreId: 'p1' }),
    ];
    expect(calcolaStatistiche(azioni, 'contrattacco', 'p1').tentativi).toBe(1);
    expect(calcolaStatistiche(azioni, 'contrattacco', 'p2').tentativi).toBe(1);
  });

  it("conta come errore un muro con invasione ('/')", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', fondamentale: 'muro', valutazione: '/' }),
      creaAzione({ id: 'az2', fondamentale: 'muro', valutazione: '+' }),
    ];
    const stats = calcolaStatistiche(azioni, 'muro', 'p1');
    expect(stats.errori).toBe(1);
    expect(stats.efficienzaPercento).toBeCloseTo(-50);
  });

  it("non conta come errore '/' su battuta e ricezione (il rally continua)", () => {
    const battute = calcolaStatistiche(
      [creaAzione({ id: 'az1', fondamentale: 'battuta', valutazione: '/' })],
      'battuta',
      'p1',
    );
    expect(battute.errori).toBe(0);
    const ricezioni = calcolaStatistiche(
      [creaAzione({ id: 'az2', fondamentale: 'ricezione', valutazione: '/' })],
      'ricezione',
      'p1',
    );
    expect(ricezioni.errori).toBe(0);
  });

  it('restituisce efficienza 0 quando non ci sono tentativi', () => {
    const stats = calcolaStatistiche([], 'attacco', 'p1');
    expect(stats.tentativi).toBe(0);
    expect(stats.efficienzaPercento).toBe(0);
  });
});

describe('distribuzionePalleggio', () => {
  it('conta gli attacchi per giocatore e calcola la percentuale sul totale della squadra', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', rallyId: 'r2', giocatoreId: 'p1' }),
      creaAzione({ id: 'az3', rallyId: 'r3', giocatoreId: 'p1' }),
      creaAzione({ id: 'az4', rallyId: 'r4', giocatoreId: 'p2' }),
    ];
    const distribuzione = distribuzionePalleggio(azioni, 'A');
    expect(distribuzione).toEqual([
      { giocatoreId: 'p1', tentativi: 3, percentuale: 75 },
      { giocatoreId: 'p2', tentativi: 1, percentuale: 25 },
    ]);
  });

  it('include sia il primo attacco che i contrattacchi dello stesso rally', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', ordine: 1, giocatoreId: 'p1', valutazione: '+' }),
      creaAzione({ id: 'az2', rallyId: 'r1', ordine: 2, giocatoreId: 'p1', valutazione: '#' }),
    ];
    const distribuzione = distribuzionePalleggio(azioni, 'A');
    expect(distribuzione).toEqual([{ giocatoreId: 'p1', tentativi: 2, percentuale: 100 }]);
  });

  it('ignora le azioni della squadra avversaria e i fondamentali diversi da attacco', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', rallyId: 'r1', giocatoreId: 'p1', squadra: 'A' }),
      creaAzione({ id: 'az2', rallyId: 'r2', giocatoreId: 'q1', squadra: 'B' }),
      creaAzione({ id: 'az3', rallyId: 'r3', giocatoreId: 'p1', squadra: 'A', fondamentale: 'muro' }),
    ];
    expect(distribuzionePalleggio(azioni, 'A')).toEqual([{ giocatoreId: 'p1', tentativi: 1, percentuale: 100 }]);
  });

  it('restituisce un array vuoto se la squadra non ha ancora attaccato', () => {
    expect(distribuzionePalleggio([], 'A')).toEqual([]);
  });
});
