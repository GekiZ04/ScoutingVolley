import { describe, it, expect } from 'vitest';
import { trovaUltimoAnnullabile } from './annulla';
import type { Azione, CorrezionePunteggio, Rally, Sostituzione, Timeout } from './types';

const rally = (id: string, numero: number, extra: Partial<Rally> = {}): Rally => ({
  id, setId: 's', numero, squadraAlServizio: 'A', esito: null, chiusuraManuale: false, ...extra,
});

const azione = (id: string, rallyId: string, ordine: number, extra: Partial<Azione> = {}): Azione => ({
  id, rallyId, setId: 's', ordine, squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
  valutazione: '+', origine: null, destinazione: null, toccoMuro: false,
  timestamp: `2026-10-09T10:00:0${ordine}.000Z`, ...extra,
});

const sostituzione = (id: string, dopoRallyNumero: number): Sostituzione => ({
  id, setId: 's', dopoRallyNumero, squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'x',
});
const timeout = (id: string, dopoRallyNumero: number): Timeout => ({ id, setId: 's', dopoRallyNumero, squadra: 'B' });
const correzione = (id: string, dopoRallyNumero: number): CorrezionePunteggio => ({
  id, setId: 's', dopoRallyNumero, deltaA: 1, deltaB: 0,
});

const vuoti = { rallies: [] as Rally[], azioni: [] as Azione[], sostituzioni: [] as Sostituzione[], timeouts: [] as Timeout[], correzioniPunteggio: [] as CorrezionePunteggio[] };

describe('trovaUltimoAnnullabile', () => {
  it('non trova nulla in un set vuoto', () => {
    expect(trovaUltimoAnnullabile({ ...vuoti, rallyApertoNumero: 1 })).toBeNull();
  });

  it('toglie l ultima azione del rally aperto', () => {
    const r = rally('r1', 1);
    const risultato = trovaUltimoAnnullabile({
      ...vuoti, rallies: [r], azioni: [azione('a', 'r1', 1), azione('b', 'r1', 2)], rallyApertoNumero: 1,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] });
  });

  it('toglie insieme le due azioni registrate nello stesso gesto (stesso timestamp)', () => {
    const stesso = '2026-10-09T10:00:05.000Z';
    const risultato = trovaUltimoAnnullabile({
      ...vuoti,
      rallies: [rally('r1', 1)],
      azioni: [
        azione('att', 'r1', 1, { timestamp: '2026-10-09T10:00:01.000Z' }),
        azione('bat', 'r1', 2, { timestamp: stesso }),
        azione('ric', 'r1', 3, { timestamp: stesso, squadra: 'B', fondamentale: 'ricezione' }),
      ],
      rallyApertoNumero: 1,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['bat', 'ric'] });
  });

  it('un rally chiuso da un attacco murato torna aperto togliendo attacco e muro insieme', () => {
    const stesso = '2026-10-09T10:00:05.000Z';
    const risultato = trovaUltimoAnnullabile({
      ...vuoti,
      rallies: [rally('r1', 1)],
      azioni: [
        azione('att', 'r1', 1, { fondamentale: 'attacco', valutazione: '/', toccoMuro: true, timestamp: stesso }),
        azione('muro', 'r1', 2, { squadra: 'B', fondamentale: 'muro', valutazione: '#', timestamp: stesso }),
      ],
      rallyApertoNumero: 2,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['att', 'muro'] });
  });

  it('un punto manuale senza azioni si annulla eliminando quel rally', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti, rallies: [rally('r1', 1, { esito: 'punto_A', chiusuraManuale: true })], rallyApertoNumero: 2,
    });
    expect(risultato).toEqual({ tipo: 'rallyManuale', rallyId: 'r1', haAzioni: false });
  });

  it('un punto manuale su un rally con azioni si annulla riaprendo il rally, prima delle sue azioni', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti,
      rallies: [rally('r1', 1, { esito: 'punto_B', chiusuraManuale: true })],
      azioni: [azione('a', 'r1', 1)],
      rallyApertoNumero: 2,
    });
    expect(risultato).toEqual({ tipo: 'rallyManuale', rallyId: 'r1', haAzioni: true });
  });

  it('un rally chiuso in automatico si annulla togliendo il suo ultimo gesto', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti,
      rallies: [rally('r1', 1)],
      azioni: [azione('ace', 'r1', 1, { valutazione: '#' })],
      rallyApertoNumero: 2,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['ace'] });
  });

  it('sostituzione, timeout e correzione fatti dopo l ultimo punto si annullano prima del punto', () => {
    const base = { ...vuoti, rallies: [rally('r1', 1, { esito: 'punto_A', chiusuraManuale: true })], rallyApertoNumero: 2 };
    expect(trovaUltimoAnnullabile({ ...base, sostituzioni: [sostituzione('sub', 1)] })).toEqual({ tipo: 'sostituzione', id: 'sub' });
    expect(trovaUltimoAnnullabile({ ...base, timeouts: [timeout('to', 1)] })).toEqual({ tipo: 'timeout', id: 'to' });
    expect(trovaUltimoAnnullabile({ ...base, correzioniPunteggio: [correzione('c', 1)] })).toEqual({ tipo: 'correzionePunteggio', id: 'c' });
  });

  it('di piu sostituzioni nello stesso punto annulla l ultima registrata', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti, rallyApertoNumero: 1, sostituzioni: [sostituzione('prima', 0), sostituzione('dopo', 0)],
    });
    expect(risultato).toEqual({ tipo: 'sostituzione', id: 'dopo' });
  });

  it('le azioni del rally aperto vengono prima di sostituzioni e timeout dello stesso punto', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti, rallies: [rally('r1', 1)], azioni: [azione('a', 'r1', 1)], timeouts: [timeout('to', 0)], rallyApertoNumero: 1,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['a'] });
  });

  it('con rally duplicati sceglie quello con le azioni', () => {
    const risultato = trovaUltimoAnnullabile({
      ...vuoti,
      rallies: [rally('vuoto', 1), rally('pieno', 1)],
      azioni: [azione('a', 'pieno', 1)],
      rallyApertoNumero: 1,
    });
    expect(risultato).toEqual({ tipo: 'azioni', rallyId: 'pieno', azioneIds: ['a'] });
  });
});
