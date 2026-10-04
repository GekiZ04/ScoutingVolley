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

  it('in attacco (rotazione 1, giro schiacciatore-centrale) il palleggiatore sta a rete sul lato destro-centro', () => {
    const punti = posizioniSchema({
      squadra: 'A', fase: 'attacco', rotazione: ROTAZIONE, palleggiatoreId: 'p1', giro: 'schiacciatore-centrale',
    })!;
    // Palleggiatore = indice 0. Dal dataset: P(378,36) -> a rete (x vicino a 50), lateralmente ~67%.
    expect(punti[0].x).toBeCloseTo(45.5, 1);
    expect(punti[0].y).toBeCloseTo(67.3, 0);
  });

  it('assegna i ruoli giusti anche con giro centrale-schiacciatore (schema specchiato)', () => {
    // Palleggiatore in zona 1, giro C-S: zona 2 = centrale, zona 4 = opposto.
    // Lo schema originale e' per S-C: si usa la rotazione specchiata (5) con
    // le ascisse invertite. L'opposto (zona 4) deve finire a rete a sinistra
    // (y basso per la squadra A), il centrale (zona 2) al centro.
    const punti = posizioniSchema({
      squadra: 'A', fase: 'attacco', rotazione: ROTAZIONE, palleggiatoreId: 'p1', giro: 'centrale-schiacciatore',
    })!;
    expect(punti[3].y).toBeCloseTo(10, 0);
    expect(punti[1].y).toBeCloseTo(56.4, 0);
    expect(punti[3].x).toBeGreaterThan(40);
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
