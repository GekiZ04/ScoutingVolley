import { describe, it, expect } from 'vitest';
import {
  distribuzionePerFasce,
  distribuzionePerRotazione,
  riepilogoCambioPalla,
  type DatiSetDistribuzione,
} from './distribuzionePalleggio';
import type { Azione, Rally, SetPallavolo, Valutazione } from './types';

const set: SetPallavolo = {
  id: 'set1', matchId: 'm1', numero: 1,
  formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
  formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
  primaSquadraAlServizio: 'B', stato: 'in_corso', vincitore: null,
  paleggiatoreIdA: null, paleggiatoreIdB: null, giroA: null, giroB: null,
};

let ordine = 0;
function az(rallyId: string, overrides: Partial<Azione>): Azione {
  ordine += 1;
  return {
    id: `x${ordine}`, rallyId, setId: 'set1', ordine, squadra: 'A', giocatoreId: 'a2', fondamentale: 'attacco',
    tipoBattuta: null, valutazione: '+', origine: null, destinazione: null,
    toccoMuro: false, timestamp: '2026-11-17T10:00:00.000Z', ...overrides,
  };
}

// Rally in cui B batte, A riceve con `ric` e `attaccante` di A fa punto.
function rallyCambioPalla(numero: number, ric: Valutazione, attaccante: string): { rally: Rally; azioni: Azione[] } {
  const id = `r${numero}`;
  return {
    rally: { id, setId: 'set1', numero, squadraAlServizio: 'B', esito: null, chiusuraManuale: false },
    azioni: [
      az(id, { squadra: 'B', giocatoreId: 'b1', fondamentale: 'battuta', valutazione: '-' }),
      az(id, { fondamentale: 'ricezione', giocatoreId: 'a5', valutazione: ric }),
      az(id, { giocatoreId: attaccante, valutazione: '#' }),
    ],
  };
}

// Rally chiuso a mano: il punto va a B, nessuna azione.
function puntoB(numero: number): Rally {
  return { id: `r${numero}`, setId: 'set1', numero, squadraAlServizio: 'B', esito: 'punto_B', chiusuraManuale: true };
}

function dati(rallies: Rally[], azioni: Azione[]): DatiSetDistribuzione[] {
  return [{ set, rallies, azioni, sostituzioni: [], correzioni: [] }];
}

describe('distribuzionePerFasce', () => {
  it('conta gli attacchi per giocatrice: totale, ricezione positiva e negativa', () => {
    const r1 = rallyCambioPalla(1, '#', 'a2');
    const r2 = rallyCambioPalla(2, '-', 'a4');
    const r3 = rallyCambioPalla(3, '!', 'a4');
    const r4 = rallyCambioPalla(4, '+', 'a2');
    const tutti = [r1, r2, r3, r4];
    const d = distribuzionePerFasce(dati(tutti.map((r) => r.rally), tutti.flatMap((r) => r.azioni)), 'A');
    expect(d.totali).toMatchObject({ totale: 4, ricPositiva: 2, ricNegativa: 2 });
    const a2 = d.righe.find((r) => r.giocatoreId === 'a2')!;
    const a4 = d.righe.find((r) => r.giocatoreId === 'a4')!;
    expect(a2.conteggi).toMatchObject({ totale: 2, ricPositiva: 2, ricNegativa: 0 });
    expect(a4.conteggi).toMatchObject({ totale: 2, ricPositiva: 0, ricNegativa: 2 });
  });

  it('i contrattacchi contano nel totale ma non nelle colonne di ricezione', () => {
    const id = 'r1';
    const rally: Rally = { id, setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = [
      az(id, { fondamentale: 'battuta', giocatoreId: 'a1', valutazione: '-' }),
      az(id, { squadra: 'B', giocatoreId: 'b5', fondamentale: 'ricezione', valutazione: '+' }),
      az(id, { squadra: 'B', giocatoreId: 'b4', valutazione: '-' }),
      az(id, { giocatoreId: 'a3', valutazione: '#' }),
    ];
    const d = distribuzionePerFasce(dati([rally], azioni), 'A');
    expect(d.totali).toMatchObject({ totale: 1, ricPositiva: 0, ricNegativa: 0 });
  });

  it('fasce di punteggio dal punteggio piu alto prima del rally: 0-9, 10-19, 20 in su', () => {
    const rallies: Rally[] = [];
    const azioni: Azione[] = [];
    // A segna al rally 1 (0-0), poi B fa 9 punti di fila (1-9), poi A attacca a 1-9.
    const primo = rallyCambioPalla(1, '#', 'a2');
    rallies.push(primo.rally);
    azioni.push(...primo.azioni);
    for (let n = 2; n <= 10; n += 1) rallies.push(puntoB(n));
    const a19 = rallyCambioPalla(11, '#', 'a3'); // prima del rally: 1-9 -> fascia 0-10
    rallies.push(a19.rally);
    azioni.push(...a19.azioni);
    rallies.push(puntoB(12)); // 2-10
    const a210 = rallyCambioPalla(13, '#', 'a4'); // prima: 2-10 -> fascia 10-20
    rallies.push(a210.rally);
    azioni.push(...a210.azioni);
    for (let n = 14; n <= 23; n += 1) rallies.push(puntoB(n)); // 3-20
    const a320 = rallyCambioPalla(24, '#', 'a4'); // prima: 3-20 -> fascia 20-25
    rallies.push(a320.rally);
    azioni.push(...a320.azioni);

    const d = distribuzionePerFasce(dati(rallies, azioni), 'A');
    expect(d.totali).toMatchObject({ totale: 4, da0a10: 2, da10a20: 1, da20: 1 });
    expect(d.righe.find((r) => r.giocatoreId === 'a4')!.conteggi).toMatchObject({ da0a10: 0, da10a20: 1, da20: 1 });
  });

  it('righe ordinate dalla piu servita, solo la squadra richiesta', () => {
    const r1 = rallyCambioPalla(1, '#', 'a4');
    const r2 = rallyCambioPalla(2, '#', 'a2');
    const r3 = rallyCambioPalla(3, '#', 'a2');
    const tutti = [r1, r2, r3];
    const d = distribuzionePerFasce(dati(tutti.map((r) => r.rally), tutti.flatMap((r) => r.azioni)), 'A');
    expect(d.righe.map((r) => r.giocatoreId)).toEqual(['a2', 'a4']);
    expect(distribuzionePerFasce(dati(tutti.map((r) => r.rally), tutti.flatMap((r) => r.azioni)), 'B').righe).toEqual([]);
  });
});

// r1: B batte, A riceve '#', a4 attacca da zona 4 e fa punto (A ruota: a1 da P1 a P6).
// r2: A batte, B riceve e attacca, a2 contrattacca da zona 2 e sbaglia (punto B).
function partitaConPalleggiatore(): DatiSetDistribuzione[] {
  const conPalleggiatore = { ...set, paleggiatoreIdA: 'a1' };
  const rallies: Rally[] = [
    { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'B', esito: null, chiusuraManuale: false },
    { id: 'r2', setId: 'set1', numero: 2, squadraAlServizio: 'A', esito: null, chiusuraManuale: false },
  ];
  const azioni = [
    az('r1', { squadra: 'B', giocatoreId: 'b1', fondamentale: 'battuta', valutazione: '-' }),
    az('r1', { fondamentale: 'ricezione', giocatoreId: 'a5', valutazione: '#' }),
    az('r1', { giocatoreId: 'a4', valutazione: '#', origine: { x: 45, y: 10 }, destinazione: { x: 80, y: 50 } }),
    az('r2', { fondamentale: 'battuta', giocatoreId: 'a2', valutazione: '-' }),
    az('r2', { squadra: 'B', giocatoreId: 'b5', fondamentale: 'ricezione', valutazione: '+' }),
    az('r2', { squadra: 'B', giocatoreId: 'b4', valutazione: '-', origine: { x: 55, y: 90 }, destinazione: { x: 20, y: 50 } }),
    az('r2', { giocatoreId: 'a2', valutazione: '=', origine: { x: 45, y: 90 }, destinazione: { x: 99, y: 50 } }),
  ];
  return [{ set: conPalleggiatore, rallies, azioni, sostituzioni: [], correzioni: [] }];
}

describe('distribuzionePerRotazione', () => {
  it('attacchi per rotazione del palleggiatore e zona di partenza, col filtro scelto', () => {
    const positiva = distribuzionePerRotazione(partitaConPalleggiatore(), 'A', 'ricPositiva');
    expect(positiva.get(1)!.get(4)).toEqual({ tot: 1, punti: 1, errori: 0, murati: 0 });
    expect(positiva.get(6)!.size).toBe(0);
    const contrattacco = distribuzionePerRotazione(partitaConPalleggiatore(), 'A', 'contrattacco');
    expect(contrattacco.get(6)!.get(2)).toEqual({ tot: 1, punti: 0, errori: 1, murati: 0 });
    expect(contrattacco.get(1)!.size).toBe(0);
  });
});

describe('riepilogoCambioPalla', () => {
  it('primo attacco dopo ricezione, contrattacco, punti CP e BP, differenza per rotazione', () => {
    const r = riepilogoCambioPalla(partitaConPalleggiatore(), 'A');
    expect(r.ricPositiva).toEqual({ tot: 1, punti: 1, errori: 0, murati: 0 });
    expect(r.ricNegativa.tot).toBe(0);
    expect(r.contrattacco).toEqual({ tot: 1, punti: 0, errori: 1, murati: 0 });
    expect(r).toMatchObject({ ricezioni: 1, battute: 1, puntiCambioPalla: 1, puntiBreak: 0 });
    expect(r.diffRotazione).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, 6: -1 });
  });

  it('senza palleggiatore niente differenza per rotazione', () => {
    const r1 = rallyCambioPalla(1, '#', 'a2');
    expect(riepilogoCambioPalla(dati([r1.rally], r1.azioni), 'A').diffRotazione).toBeNull();
  });
});
