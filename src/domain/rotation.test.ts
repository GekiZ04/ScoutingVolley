import { describe, it, expect } from 'vitest';
import { ruotaPosizioni, applicaSostituzione } from './rotation';
import type { Sostituzione } from './types';

describe('ruotaPosizioni', () => {
  it('sposta ogni giocatore di una posizione in senso orario (P2->P1, ..., P1->P6)', () => {
    const rotazione = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    expect(ruotaPosizioni(rotazione)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p1']);
  });
});

describe('applicaSostituzione', () => {
  it('sostituisce solo il giocatore che esce, lasciando invariate le altre posizioni', () => {
    const rotazione = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const sostituzione: Sostituzione = {
      id: 's1',
      setId: 'set1',
      dopoRallyNumero: 3,
      squadra: 'A',
      giocatoreEsceId: 'p3',
      giocatoreEntraId: 'libero1',
    };
    expect(applicaSostituzione(rotazione, sostituzione)).toEqual([
      'p1', 'p2', 'libero1', 'p4', 'p5', 'p6',
    ]);
  });
});
