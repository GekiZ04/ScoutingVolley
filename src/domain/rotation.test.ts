import { describe, it, expect } from 'vitest';
import { ruotaPosizioni, ruotaFormazione, applicaSostituzione, occupanteDelPosto } from './rotation';
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

describe('ruotaFormazione', () => {
  const formazione = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

  it('un passo avanti equivale a una rotazione normale: chi era in P5 passa in P4', () => {
    expect(ruotaFormazione(formazione, 1)).toEqual(ruotaPosizioni(formazione));
    expect(ruotaFormazione(formazione, 1)[3]).toBe('p5');
  });

  it('un passo indietro e il suo inverso: chi era in P4 passa in P5', () => {
    expect(ruotaFormazione(formazione, -1)).toEqual(['p6', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(ruotaFormazione(ruotaFormazione(formazione, 1), -1)).toEqual(formazione);
  });

  it('sei passi tornano alla formazione di partenza e i passi si sommano', () => {
    expect(ruotaFormazione(formazione, 6)).toEqual(formazione);
    expect(ruotaFormazione(formazione, 2)).toEqual(ruotaFormazione(ruotaFormazione(formazione, 1), 1));
  });

  it('non modifica l array di partenza', () => {
    ruotaFormazione(formazione, 3);
    expect(formazione).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });
});

describe('occupanteDelPosto', () => {
  const cambio = (esce: string, entra: string, squadra: 'A' | 'B' = 'A'): Sostituzione => ({
    id: `${esce}-${entra}`, setId: 'set1', dopoRallyNumero: 1, squadra, giocatoreEsceId: esce, giocatoreEntraId: entra,
  });

  it("il giocatore e' in campo: restituisce lui", () => {
    expect(occupanteDelPosto(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 'p3', [])).toBe('p3');
  });

  it("dopo un cambio restituisce chi e' entrato al suo posto", () => {
    expect(occupanteDelPosto(['p1', 'p2', 'x9', 'p4', 'p5', 'p6'], 'p3', [cambio('p3', 'x9')])).toBe('x9');
  });

  it("segue il rientro e piu' cambi sullo stesso posto, in qualunque ordine", () => {
    const cambi = [cambio('x9', 'p3'), cambio('p5', 'y1'), cambio('p3', 'x9')];
    expect(occupanteDelPosto(['p1', 'p2', 'p3', 'p4', 'y1', 'p6'], 'p3', cambi)).toBe('p3');
    expect(occupanteDelPosto(['p1', 'p2', 'x9', 'p4', 'y1', 'p6'], 'p3', cambi)).toBe('x9');
  });

  it("null senza giocatore o se il suo posto non e' in campo", () => {
    expect(occupanteDelPosto(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], null, [])).toBeNull();
    expect(occupanteDelPosto(['p1', 'p2', 'p4', 'p5', 'p6', 'z1'], 'p3', [cambio('p3', 'x9')])).toBeNull();
  });

  it("ignora i cambi dell'altra squadra quando la squadra e' indicata", () => {
    expect(occupanteDelPosto(['p1', 'p2', 'x9', 'p4', 'p5', 'p6'], 'p3', [cambio('p3', 'x9', 'B')], 'A')).toBeNull();
  });
});
