import { describe, it, expect } from 'vitest';
import { posizioniSchema } from './schemaRicezione';
import type { Giro } from './types';

const ROTAZIONE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

describe('posizioniSchema', () => {
  it('senza palleggiatore o giro non propone posizioni (campo statico)', () => {
    expect(posizioniSchema({ squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: null, giro: null })).toBeNull();
    expect(posizioniSchema({ squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'p1', giro: null })).toBeNull();
  });

  it('se il palleggiatore non e in rotazione non propone posizioni', () => {
    expect(posizioniSchema({ squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'xx', giro: 'schiacciatore-centrale' })).toBeNull();
  });

  it('restituisce 6 punti dentro al campo per ogni rotazione, fase, giro e squadra', () => {
    const giri: Giro[] = ['schiacciatore-centrale', 'centrale-schiacciatore'];
    for (const giro of giri) {
      for (const fase of ['ricezione', 'attacco'] as const) {
        for (const squadra of ['A', 'B'] as const) {
          for (let indicePalleggiatore = 0; indicePalleggiatore < 6; indicePalleggiatore += 1) {
            const punti = posizioniSchema({
              squadra, fase, rotazione: ROTAZIONE, palleggiatoreId: ROTAZIONE[indicePalleggiatore], giro,
            })!;
            expect(punti).toHaveLength(6);
            for (const p of punti) {
              const xDaRete = squadra === 'A' ? 50 - p.x : p.x - 50;
              expect(xDaRete).toBeGreaterThanOrEqual(4);
              expect(xDaRete).toBeLessThanOrEqual(50);
              expect(p.y).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    }
  });

  it('in ricezione col giro centrale-schiacciatore usa lo schema specchiato (opposto a sinistra)', () => {
    // Palleggiatore in zona 1, giro C-S: zona 4 = opposto. Rotazione specchiata 5,
    // ascisse invertite: dal dataset O(485,110) -> laterale 0.911 -> specchiato 0.089 -> 10.
    const punti = posizioniSchema({
      squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'p1', giro: 'centrale-schiacciatore',
    })!;
    expect(punti[3].y).toBeCloseTo(10, 0);
  });

  // Posizioni fisse per la squadra A (vedi POSIZIONI_A in courtPositions):
  // zona 4 = (40,10), zona 3 = (40,50), zona 2 = (40,90), zone 5/6/1 = (10,10)/(10,50)/(10,90).
  const Z2 = { x: 40, y: 90 };
  const Z3 = { x: 40, y: 50 };
  const Z4 = { x: 40, y: 10 };

  describe('attacco', () => {
    const attacco = (indicePalleggiatore: number, giro: Giro, squadra: 'A' | 'B' = 'A') =>
      posizioniSchema({ squadra, fase: 'attacco', rotazione: ROTAZIONE, palleggiatoreId: ROTAZIONE[indicePalleggiatore], giro })!;

    it('con palleggiatore in seconda linea (P5): opposto in 2, banda in 4, centrale in 3', () => {
      // Giro S-C, palleggiatore in zona 5: zona 2 = O, zona 3 = S, zona 4 = C.
      const punti = attacco(4, 'schiacciatore-centrale');
      expect(punti[1]).toEqual(Z2); // opposto
      expect(punti[2]).toEqual(Z4); // banda
      expect(punti[3]).toEqual(Z3); // centrale
    });

    it('in P6 (S-C): zona 2 = C, zona 3 = O, zona 4 = S -> opposto in 2, centrale in 3, banda in 4', () => {
      const punti = attacco(5, 'schiacciatore-centrale');
      expect(punti[2]).toEqual(Z2); // opposto
      expect(punti[1]).toEqual(Z3); // centrale
      expect(punti[3]).toEqual(Z4); // banda
    });

    it('in P1 resta com e: opposto in 4 e banda in 2 (centrale in 3)', () => {
      const punti = attacco(0, 'schiacciatore-centrale');
      expect(punti[1]).toEqual(Z2); // banda (zona 2)
      expect(punti[2]).toEqual(Z3); // centrale
      expect(punti[3]).toEqual(Z4); // opposto (zona 4)
    });

    it('in P1 col giro centrale-schiacciatore la banda va in 2, il centrale in 3, l opposto resta in 4', () => {
      // Zona 2 = C, zona 3 = S, zona 4 = O.
      const punti = attacco(0, 'centrale-schiacciatore');
      expect(punti[1]).toEqual(Z3); // centrale
      expect(punti[2]).toEqual(Z2); // banda
      expect(punti[3]).toEqual(Z4); // opposto
    });

    it('con palleggiatore a rete va in 2, il centrale in 3, la banda in 4', () => {
      // P3 (S-C): zona 2 = C, zona 3 = P, zona 4 = S.
      const punti = attacco(2, 'schiacciatore-centrale');
      expect(punti[2]).toEqual(Z2); // palleggiatore
      expect(punti[1]).toEqual(Z3); // centrale
      expect(punti[3]).toEqual(Z4); // banda
    });

    it('la seconda linea resta sulle zone fisse', () => {
      const punti = attacco(4, 'schiacciatore-centrale');
      expect(punti[4]).toEqual({ x: 10, y: 10 }); // zona 5
      expect(punti[5]).toEqual({ x: 10, y: 50 }); // zona 6
      expect(punti[0]).toEqual({ x: 10, y: 90 }); // zona 1
    });

    it('la squadra B e il riflesso della A', () => {
      const a = attacco(4, 'schiacciatore-centrale', 'A');
      const b = attacco(4, 'schiacciatore-centrale', 'B');
      a.forEach((p, i) => {
        expect(b[i]).toEqual({ x: 100 - p.x, y: 100 - p.y });
      });
    });
  });

  it('la squadra B e il riflesso puntuale della A (stessa fase, stessa rotazione)', () => {
    const a = posizioniSchema({ squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'p3', giro: 'schiacciatore-centrale' })!;
    const b = posizioniSchema({ squadra: 'B', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'p3', giro: 'schiacciatore-centrale' })!;
    a.forEach((p, i) => {
      expect(b[i].x).toBeCloseTo(100 - p.x, 5);
      expect(b[i].y).toBeCloseTo(100 - p.y, 5);
    });
  });

  it('segue il palleggiatore: cambiando indice cambia la formazione ma i punti restano 6 distinti', () => {
    const punti = posizioniSchema({
      squadra: 'A', fase: 'ricezione', rotazione: ROTAZIONE, palleggiatoreId: 'p4', giro: 'schiacciatore-centrale',
    })!;
    const unici = new Set(punti.map((p) => `${p.x.toFixed(1)}:${p.y.toFixed(1)}`));
    expect(unici.size).toBe(6);
  });
});
