import { describe, it, expect } from 'vitest';
import { distribuzionePerFasce, type DatiSetDistribuzione } from './distribuzionePalleggio';
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
