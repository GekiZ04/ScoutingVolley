import { describe, it, expect } from 'vitest';
import { codiceScout, zonaBattuta, zonaCampo } from './dvw';
import type { Azione } from './types';

describe('zonaCampo: zone 1-9 viste dalla squadra che sta in quella meta campo', () => {
  it('squadra A: rete 4-3-2 da sinistra a destra, centro 7-8-9, fondo 5-6-1', () => {
    expect([10, 50, 90].map((y) => zonaCampo({ x: 40, y }, 'A'))).toEqual([4, 3, 2]);
    expect([10, 50, 90].map((y) => zonaCampo({ x: 25, y }, 'A'))).toEqual([7, 8, 9]);
    expect([10, 50, 90].map((y) => zonaCampo({ x: 10, y }, 'A'))).toEqual([5, 6, 1]);
  });

  it('squadra B: stesse zone viste dall altra parte della rete', () => {
    expect([90, 50, 10].map((y) => zonaCampo({ x: 60, y }, 'B'))).toEqual([4, 3, 2]);
    expect([90, 50, 10].map((y) => zonaCampo({ x: 90, y }, 'B'))).toEqual([5, 6, 1]);
  });

  it('un punto nell altra meta campo non ha zona per quella squadra', () => {
    expect(zonaCampo({ x: 60, y: 50 }, 'A')).toBeNull();
    expect(zonaCampo({ x: 40, y: 50 }, 'B')).toBeNull();
  });
});

describe('zonaBattuta: partenza della battuta 5-7-6-9-1 da sinistra a destra di chi batte', () => {
  it('squadra A', () => {
    expect([5, 30, 50, 70, 95].map((y) => zonaBattuta({ x: 2, y }, 'A'))).toEqual([5, 7, 6, 9, 1]);
  });
  it('squadra B', () => {
    expect([95, 70, 50, 30, 5].map((y) => zonaBattuta({ x: 98, y }, 'B'))).toEqual([5, 7, 6, 9, 1]);
  });
});

function azione(extra: Partial<Azione>): Azione {
  return {
    id: 'x', rallyId: 'r', setId: 's', ordine: 1, squadra: 'A', giocatoreId: 'g', fondamentale: 'attacco',
    tipoBattuta: null, valutazione: '+', origine: null, destinazione: null, toccoMuro: false,
    timestamp: '2026-10-25T16:00:00.000Z', ...extra,
  };
}

describe('codiceScout', () => {
  it('battuta: squadra, numero, S, tipo, valutazione, poi zona di partenza e di arrivo', () => {
    const battuta = azione({ fondamentale: 'battuta', tipoBattuta: 'salto_flottante', origine: { x: 2, y: 10 }, destinazione: { x: 90, y: 10 } });
    // Arrivo in fondo a destra per chi riceve: zona 1.
    expect(codiceScout(battuta, 10, battuta)).toBe('*10SM+~~~51');
  });

  it('ricezione: tipo e zone della battuta che riceve', () => {
    const battuta = azione({ fondamentale: 'battuta', tipoBattuta: 'salto_spin', origine: { x: 2, y: 10 }, destinazione: { x: 90, y: 10 } });
    const ricezione = azione({ squadra: 'B', fondamentale: 'ricezione', valutazione: '#' });
    expect(codiceScout(ricezione, 7, battuta)).toBe('a07RQ#~~~51');
  });

  it('attacco: zona di partenza nel proprio campo e di arrivo in quello avversario', () => {
    const attacco = azione({ valutazione: '#', origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 90 } });
    // Da zona 4 a fondo campo avversario sulla sinistra di chi riceve: zona 5.
    expect(codiceScout(attacco, 9, null)).toBe('*09AH#~~~45');
  });

  it('senza coordinate solo la parte base, giocatore sconosciuto come $$', () => {
    expect(codiceScout(azione({ fondamentale: 'muro', squadra: 'B', valutazione: '!' }), null, null)).toBe('a$$BH!');
  });
});
