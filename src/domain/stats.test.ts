import { describe, it, expect } from 'vitest';
import { calcolaStatistiche } from './stats';
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
      creaAzione({ id: 'az1', valutazione: '#' }),
      creaAzione({ id: 'az2', valutazione: '+' }),
      creaAzione({ id: 'az3', valutazione: '=' }),
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
      creaAzione({ id: 'az1', valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', valutazione: '#', giocatoreId: 'p2' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco');
    expect(stats.tentativi).toBe(2);
    expect(stats.efficienzaPercento).toBeCloseTo(100);
  });

  it("conta come errore un attacco murato per punto ('/'), non solo '='", () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', valutazione: '#' }),
      creaAzione({ id: 'az2', valutazione: '/' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(2);
    expect(stats.errori).toBe(1);
    expect(stats.efficienzaPercento).toBeCloseTo(0);
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
