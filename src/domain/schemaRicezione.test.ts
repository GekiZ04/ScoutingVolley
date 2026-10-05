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
      for (const fase of ['ricezione', 'cambio'] as const) {
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

  // Posizioni fisse per la squadra A (vedi POSIZIONI_A in courtPositions).
  const Z1 = { x: 10, y: 90 };
  const Z2 = { x: 40, y: 90 };
  const Z3 = { x: 40, y: 50 };
  const Z4 = { x: 40, y: 10 };
  const Z5 = { x: 10, y: 10 };
  const Z6 = { x: 10, y: 50 };

  describe('cambio (dopo battuta e ricezione)', () => {
    const cambio = (indicePalleggiatore: number, giro: Giro, squadra: 'A' | 'B' = 'A') =>
      posizioniSchema({ squadra, fase: 'cambio', rotazione: ROTAZIONE, palleggiatoreId: ROTAZIONE[indicePalleggiatore], giro })!;

    it('P5 (S-C): opposto 2, banda 4, centrale 3; palleggiatore 1, banda dietro 6, libero/centrale 5', () => {
      // Zone: 1=C, 2=O, 3=S, 4=C, 5=P, 6=S.
      const punti = cambio(4, 'schiacciatore-centrale');
      expect(punti[1]).toEqual(Z2); // opposto
      expect(punti[2]).toEqual(Z4); // banda
      expect(punti[3]).toEqual(Z3); // centrale
      expect(punti[4]).toEqual(Z1); // palleggiatore
      expect(punti[5]).toEqual(Z6); // banda dietro
      expect(punti[0]).toEqual(Z5); // centrale dietro (libero)
    });

    it('P1 (S-C): opposto in 4 e banda in 2; dietro palleggiatore 1, banda 6, libero 5', () => {
      // Zone: 1=P, 2=S, 3=C, 4=O, 5=S, 6=C.
      const punti = cambio(0, 'schiacciatore-centrale');
      expect(punti[1]).toEqual(Z2); // banda
      expect(punti[2]).toEqual(Z3); // centrale
      expect(punti[3]).toEqual(Z4); // opposto
      expect(punti[0]).toEqual(Z1); // palleggiatore
      expect(punti[4]).toEqual(Z6); // banda dietro
      expect(punti[5]).toEqual(Z5); // libero
    });

    it('P1 col giro centrale-schiacciatore: banda in 2, centrale in 3, opposto in 4', () => {
      // Zone: 1=P, 2=C, 3=S, 4=O, 5=C, 6=S.
      const punti = cambio(0, 'centrale-schiacciatore');
      expect(punti[1]).toEqual(Z3); // centrale
      expect(punti[2]).toEqual(Z2); // banda
      expect(punti[3]).toEqual(Z4); // opposto
      expect(punti[4]).toEqual(Z5); // libero
      expect(punti[5]).toEqual(Z6); // banda dietro
    });

    it('palleggiatore a rete (P3, S-C): va in 2; l opposto in seconda linea va in 1', () => {
      // Zone: 1=S, 2=C, 3=P, 4=S, 5=C, 6=O.
      const punti = cambio(2, 'schiacciatore-centrale');
      expect(punti[2]).toEqual(Z2); // palleggiatore
      expect(punti[1]).toEqual(Z3); // centrale
      expect(punti[3]).toEqual(Z4); // banda
      expect(punti[5]).toEqual(Z1); // opposto dietro
      expect(punti[0]).toEqual(Z6); // banda dietro
      expect(punti[4]).toEqual(Z5); // libero
    });

    it('in ogni rotazione e giro i 6 giocatori occupano 6 zone diverse', () => {
      for (const giro of ['schiacciatore-centrale', 'centrale-schiacciatore'] as Giro[]) {
        for (let i = 0; i < 6; i += 1) {
          const punti = cambio(i, giro);
          expect(new Set(punti.map((p) => `${p.x}:${p.y}`)).size).toBe(6);
        }
      }
    });

    it('la squadra B e il riflesso della A', () => {
      const a = cambio(4, 'schiacciatore-centrale', 'A');
      const b = cambio(4, 'schiacciatore-centrale', 'B');
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
