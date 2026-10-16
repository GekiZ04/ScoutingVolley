import { describe, it, expect } from 'vitest';
import { attacchiInRotazione, type DatiSetRotazioni } from './rotazioni';
import type { Azione, Rally, SetPallavolo } from './types';

function creaSet(overrides: Partial<SetPallavolo> = {}): SetPallavolo {
  return {
    id: 'set1', matchId: 'm1', numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'B', stato: 'in_corso', vincitore: null,
    paleggiatoreIdA: 'a1', paleggiatoreIdB: null, giroA: null, giroB: null,
    ...overrides,
  };
}
function creaRally(numero: number, overrides: Partial<Rally> = {}): Rally {
  return { id: `r${numero}`, setId: 'set1', numero, squadraAlServizio: 'B', esito: null, chiusuraManuale: false, ...overrides };
}
function az(id: string, rallyId: string, ordine: number, overrides: Partial<Azione>): Azione {
  return {
    id, rallyId, setId: 'set1', ordine, squadra: 'A', giocatoreId: 'a2', fondamentale: 'attacco',
    tipoBattuta: null, valutazione: '+', origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 },
    toccoMuro: false, timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

// r1: B batte, A riceve ('-') e attacca '#' (punto A): A ruota, a1 passa in zona 6.
// r2: A batte, B riceve e attacca, poi A contrattacca '#'.
function dati(): DatiSetRotazioni {
  const rallies = [creaRally(1), creaRally(2, { squadraAlServizio: 'A' })];
  const azioni = [
    az('b1', 'r1', 1, { squadra: 'B', giocatoreId: 'b1', fondamentale: 'battuta' }),
    az('ric1', 'r1', 2, { fondamentale: 'ricezione', valutazione: '-', giocatoreId: 'a3' }),
    az('att1', 'r1', 3, { valutazione: '#' }),
    az('b2', 'r2', 1, { fondamentale: 'battuta' }),
    az('ric2', 'r2', 2, { squadra: 'B', giocatoreId: 'b2', fondamentale: 'ricezione' }),
    az('attB', 'r2', 3, { squadra: 'B', giocatoreId: 'b2' }),
    az('con', 'r2', 4, { valutazione: '#' }),
  ];
  return { set: creaSet(), rallies, azioni, sostituzioni: [] };
}

describe('attacchiInRotazione', () => {
  it('attacchi dopo ricezione nella rotazione del palleggiatore in zona 1', () => {
    const r = attacchiInRotazione({ dati: [dati()], squadra: 'A', zona: 1, filtro: 'dopoRicezione' });
    expect(r.attacchi.map((a) => a.id)).toEqual(['att1']);
    expect(r.rotazioneUltima).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('altra rotazione: solo gli attacchi di quel rally', () => {
    const r = attacchiInRotazione({ dati: [dati()], squadra: 'A', zona: 6, filtro: 'dopoRicezione' });
    expect(r.attacchi).toEqual([]);
    expect(r.rotazioneUltima).toBeNull();
  });

  it('dopo ricezione positiva esclude le ricezioni - ! /', () => {
    const d = dati();
    expect(attacchiInRotazione({ dati: [d], squadra: 'A', zona: 1, filtro: 'dopoRicezionePositiva' }).attacchi).toEqual([]);
    d.azioni.find((a) => a.id === 'ric1')!.valutazione = '+';
    expect(
      attacchiInRotazione({ dati: [d], squadra: 'A', zona: 1, filtro: 'dopoRicezionePositiva' }).attacchi.map((a) => a.id),
    ).toEqual(['att1']);
  });

  it('contrattacco usa idAzioniContrattacco', () => {
    const r = attacchiInRotazione({ dati: [dati()], squadra: 'A', zona: 6, filtro: 'contrattacco' });
    expect(r.attacchi.map((a) => a.id)).toEqual(['con']);
    expect(r.rotazioneUltima).toEqual(['a2', 'a3', 'a4', 'a5', 'a6', 'a1']);
    expect(attacchiInRotazione({ dati: [dati()], squadra: 'A', zona: 1, filtro: 'contrattacco' }).attacchi).toEqual([]);
  });

  it('set senza palleggiatore non contribuisce e non va in errore', () => {
    const d = dati();
    d.set = creaSet({ paleggiatoreIdA: null });
    const r = attacchiInRotazione({ dati: [d], squadra: 'A', zona: 1, filtro: 'dopoRicezione' });
    expect(r.attacchi).toEqual([]);
    expect(r.rotazioneUltima).toBeNull();
  });
});
