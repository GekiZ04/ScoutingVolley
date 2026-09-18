import { describe, it, expect } from 'vitest';
import { posizioneZona, costruisciMarker, fasciaMuro, ZONE_PRIMA_LINEA } from './courtPositions';
import type { Player } from './types';

describe('posizioneZona', () => {
  it('squadra A occupa la metà sinistra del campo (x <= 50)', () => {
    for (let zona = 1; zona <= 6; zona += 1) {
      const p = posizioneZona('A', zona as 1 | 2 | 3 | 4 | 5 | 6);
      expect(p.x).toBeLessThanOrEqual(50);
    }
  });

  it('squadra B è il punto simmetrico rispetto al centro campo (50,50)', () => {
    for (let zona = 1; zona <= 6; zona += 1) {
      const a = posizioneZona('A', zona as 1 | 2 | 3 | 4 | 5 | 6);
      const b = posizioneZona('B', zona as 1 | 2 | 3 | 4 | 5 | 6);
      expect(b.x).toBeCloseTo(100 - a.x);
      expect(b.y).toBeCloseTo(100 - a.y);
    }
  });
});

describe('costruisciMarker', () => {
  it('associa la posizione di rotazione P1..P6 in ordine ai giocatori in campo', () => {
    const giocatori: Player[] = [
      { id: 'p1', teamId: 't', numero: 1, nome: 'Uno', ruolo: 'palleggiatore', attivo: true },
      { id: 'p2', teamId: 't', numero: 2, nome: 'Due', ruolo: 'schiacciatore', attivo: true },
    ];
    const marker = costruisciMarker(giocatori, 'A');
    expect(marker[0]).toEqual({ giocatoreId: 'p1', numero: 1, zona: 1, ...posizioneZona('A', 1) });
    expect(marker[1]).toEqual({ giocatoreId: 'p2', numero: 2, zona: 2, ...posizioneZona('A', 2) });
  });
});

describe('geometria zone', () => {
  it('le zone di prima linea (2,3,4) sono piu vicine alla rete (x maggiore) delle zone di fondo (1,5,6)', () => {
    for (const zonaPrimaLinea of ZONE_PRIMA_LINEA) {
      const posizionePrimaLinea = posizioneZona('A', zonaPrimaLinea);
      for (const zonaFondo of [1, 5, 6] as const) {
        const posizioneFondo = posizioneZona('A', zonaFondo);
        expect(posizionePrimaLinea.x).toBeGreaterThan(posizioneFondo.x);
      }
    }
  });
});

describe('fasciaMuro', () => {
  it('per la squadra A la fascia è appena oltre la rete sul lato B', () => {
    expect(fasciaMuro('A')).toEqual({ xMin: 50, xMax: 55 });
  });

  it('per la squadra B la fascia è appena oltre la rete sul lato A', () => {
    expect(fasciaMuro('B')).toEqual({ xMin: 45, xMax: 50 });
  });
});
