import { describe, it, expect } from 'vitest';
import { coloreRampa, fondoPer, mescolaConBianco, poligonoSettore, puntoEtichetta, tagliaPoligono } from './geometriaCampo';

describe('tagliaPoligono', () => {
  it('lascia invariato un poligono tutto dentro', () => {
    const quadrato = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
    expect(tagliaPoligono(quadrato, 0, 0, 9, 9)).toEqual(quadrato);
  });

  it('taglia sul bordo del campo la parte che esce', () => {
    const triangolo = [{ x: 4.5, y: 12 }, { x: 4.5, y: -5 }, { x: 12, y: -5 }];
    const tagliato = tagliaPoligono(triangolo, 0, 0, 9, 9);
    for (const p of tagliato) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(9 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(9 + 1e-9);
    }
    expect(tagliato.length).toBeGreaterThanOrEqual(3);
  });

  it('un poligono tutto fuori sparisce', () => {
    expect(tagliaPoligono([{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }], 0, 0, 9, 9)).toEqual([]);
  });
});

describe('poligonoSettore', () => {
  it('parte dall origine e si apre tra i due angoli', () => {
    const punti = poligonoSettore({ x: 4.5, y: 10 }, -15, 15, 20);
    expect(punti[0]).toEqual({ x: 4.5, y: 10 });
    expect(punti[1].x).toBeLessThan(4.5);
    expect(punti[punti.length - 1].x).toBeGreaterThan(4.5);
    expect(punti[1].y).toBeLessThan(0);
  });
});

describe('puntoEtichetta', () => {
  it('sta dentro il campo avversario lungo la bisettrice', () => {
    const p = puntoEtichetta({ x: 0.9, y: 10.8 }, 7.5, 15)!;
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(9);
    expect(p.x).toBeGreaterThan(0.9);
  });

  it('niente etichetta per gli spicchi troppo stretti o che vanno indietro', () => {
    expect(puntoEtichetta({ x: 0.9, y: 10.8 }, -80, 15)).toBeNull();
    expect(puntoEtichetta({ x: 4.5, y: 10 }, 120, 15)).toBeNull();
  });
});

describe('fondoPer', () => {
  it('lascia spazio sotto la rete fino alla partenza piu lontana', () => {
    expect(fondoPer([])).toBeCloseTo(10.2);
    expect(fondoPer([{ x: 1, y: 14 }])).toBeCloseTo(14.7);
    expect(fondoPer([{ x: 1, y: 30 }])).toBeCloseTo(18.7);
  });
});

describe('colori', () => {
  it('rampa: chiaro per poco, scuro per tanto, testo bianco sui toni scuri', () => {
    expect(coloreRampa(0)).toEqual({ fondo: '#cde2fb', testo: '#0b0b0b' });
    expect(coloreRampa(1)).toEqual({ fondo: '#0d366b', testo: '#ffffff' });
  });

  it('mescolaConBianco: 0 = bianco, 1 = colore pieno', () => {
    expect(mescolaConBianco('#256abf', 0)).toEqual([255, 255, 255]);
    expect(mescolaConBianco('#256abf', 1)).toEqual([37, 106, 191]);
  });
});
