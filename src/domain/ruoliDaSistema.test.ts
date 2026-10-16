import { describe, it, expect } from 'vitest';
import { ruoloInSlot } from './ruoliDaSistema';
import { indiciCentrali } from './liberoAutoSwap';
import type { Giro } from './types';

describe('ruoloInSlot', () => {
  it('P-S-C con palleggiatore in zona 1', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => ruoloInSlot(i, 0, 'schiacciatore-centrale'))).toEqual([
      'P', 'S', 'C', 'O', 'S', 'C',
    ]);
  });
  it('P-C-S con palleggiatore in zona 1', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => ruoloInSlot(i, 0, 'centrale-schiacciatore'))).toEqual([
      'P', 'C', 'S', 'O', 'C', 'S',
    ]);
  });
  it('concorda con indiciCentrali per ogni palleggiatore e giro', () => {
    const rotazione = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (const giro of ['schiacciatore-centrale', 'centrale-schiacciatore'] as Giro[]) {
      for (let p = 0; p < 6; p += 1) {
        const centrali = [0, 1, 2, 3, 4, 5].filter((i) => ruoloInSlot(i, p, giro) === 'C');
        expect(centrali.sort()).toEqual(indiciCentrali(rotazione, rotazione[p], giro).sort());
      }
    }
  });
});
