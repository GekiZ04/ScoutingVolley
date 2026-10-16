import { describe, it, expect } from 'vitest';
import { trovaUltimoAnnullabile, bozzaDaAzioniAnnullate, chiaviDaAnnullare } from './annulla';
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

describe('bozzaDaAzioniAnnullate', () => {
  const p = (x: number, y: number) => ({ x, y });
  const base = { rallyId: 'r1', setId: 's', timestamp: '2026-10-16T10:00:00.000Z', toccoMuro: false, tipoBattuta: null };

  it('battuta con ricezione: riapre la battuta alla scelta della valutazione, col ricevitore gia scelto', () => {
    const bozza = bozzaDaAzioniAnnullate([
      { ...base, id: 'b', ordine: 1, squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'salto_spin', valutazione: '-', origine: p(2, 20), destinazione: p(80, 70) },
      { ...base, id: 'r', ordine: 2, squadra: 'B', giocatoreId: 'b4', fondamentale: 'ricezione', valutazione: '+', origine: null, destinazione: null },
    ]);
    expect(bozza).toEqual({
      flusso: 'battuta', passo: 'ricezione-valutazione', tipoBattuta: 'salto_spin',
      origine: p(2, 20), destinazione: p(80, 70), ricevitore: { giocatoreId: 'b4', squadra: 'B' },
    });
  });

  it('ace o errore diretto: riapre la battuta alla scelta dell esito', () => {
    const bozza = bozzaDaAzioniAnnullate([
      { ...base, id: 'b', ordine: 1, squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', origine: p(2, 20), destinazione: p(80, 70) },
    ]);
    expect(bozza).toEqual({ flusso: 'battuta', passo: 'esito', tipoBattuta: 'flottante', origine: p(2, 20), destinazione: p(80, 70) });
  });

  it('ricezione registrata a parte: riapre la scelta della valutazione', () => {
    const bozza = bozzaDaAzioniAnnullate([
      { ...base, id: 'r', ordine: 2, squadra: 'B', giocatoreId: 'b4', fondamentale: 'ricezione', valutazione: '!', origine: null, destinazione: null },
    ]);
    expect(bozza).toEqual({ flusso: 'ricezione', passo: 'valutazione', giocatoreId: 'b4', squadra: 'B' });
  });

  it('attacco senza muro: riapre la scelta della destinazione', () => {
    const bozza = bozzaDaAzioniAnnullate([
      { ...base, id: 'a', ordine: 3, squadra: 'A', giocatoreId: 'a4', fondamentale: 'attacco', valutazione: '+', origine: p(40, 10), destinazione: p(90, 90) },
    ]);
    expect(bozza).toEqual({ flusso: 'attacco', passo: 'destinazione', giocatoreId: 'a4', squadra: 'A', origine: p(40, 10) });
  });

  it('attacco toccato a muro: riapre dove e finita la palla, con chi ha murato gia scelto', () => {
    const bozza = bozzaDaAzioniAnnullate([
      { ...base, id: 'a', ordine: 3, squadra: 'A', giocatoreId: 'a4', fondamentale: 'attacco', valutazione: '/', origine: p(40, 10), destinazione: p(30, 15), toccoMuro: true },
      { ...base, id: 'm', ordine: 4, squadra: 'B', giocatoreId: 'b3', fondamentale: 'muro', valutazione: '#', origine: p(52, 12), destinazione: p(52, 12) },
    ]);
    expect(bozza).toEqual({
      flusso: 'attacco', passo: 'muro-destinazione', giocatoreId: 'a4', squadra: 'A', origine: p(40, 10),
      muro: { puntoTocco: p(52, 12), giocatoreId: 'b3' },
    });
  });

  it('senza i dati necessari non propone nulla (azioni vecchie incomplete)', () => {
    expect(bozzaDaAzioniAnnullate([])).toBeNull();
    expect(bozzaDaAzioniAnnullate([
      { ...base, id: 'b', ordine: 1, squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: null, valutazione: '#', origine: null, destinazione: null },
    ])).toBeNull();
    expect(bozzaDaAzioniAnnullate([
      { ...base, id: 'r', ordine: 2, squadra: 'B', giocatoreId: null, fondamentale: 'ricezione', valutazione: '!', origine: null, destinazione: null },
    ])).toBeNull();
  });
});

describe('chiaviDaAnnullare', () => {
  const attacco = (id: string, ordine: number, valutazione: Azione['valutazione']) =>
    azione(id, 'r1', ordine, { fondamentale: 'attacco', tipoBattuta: null, valutazione });

  it('rally aperto: solo il gesto', () => {
    const azioni = [azione('a', 'r1', 1), attacco('b', 2, '+')];
    expect(chiaviDaAnnullare({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] }, azioni, [])).toEqual(['b']);
  });

  it('rally chiuso in automatico: azioni del gesto e codice punto', () => {
    const azioni = [azione('a', 'r1', 1), attacco('b', 2, '#')];
    expect(chiaviDaAnnullare({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] }, azioni, [])).toEqual(['b', 'punto-r1']);
  });

  it('rallyManuale: il codice punto del rally', () => {
    expect(chiaviDaAnnullare({ tipo: 'rallyManuale', rallyId: 'r1', haAzioni: true }, [], [])).toEqual(['punto-r1']);
  });

  it('correzione che chiude il rally: azione corretta e punto', () => {
    const azioni = [attacco('b', 1, '#')];
    const storia = [{ azioneId: 'b', precedente: '+', nuova: '#' }];
    expect(chiaviDaAnnullare({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] }, azioni, storia)).toEqual(['b', 'punto-r1']);
  });

  it('correzione che non cambia la chiusura: solo l azione corretta', () => {
    const azioni = [attacco('b', 1, '=')];
    const storia = [{ azioneId: 'b', precedente: '/', nuova: '=' }];
    expect(chiaviDaAnnullare({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] }, azioni, storia)).toEqual(['b']);
  });

  it('correzione su un rally aperto: solo l azione corretta', () => {
    const azioni = [attacco('b', 1, '!')];
    const storia = [{ azioneId: 'b', precedente: '+', nuova: '!' }];
    expect(chiaviDaAnnullare({ tipo: 'azioni', rallyId: 'r1', azioneIds: ['b'] }, azioni, storia)).toEqual(['b']);
  });

  it('sostituzione, timeout, correzione punteggio e nessun bersaglio: nessun codice', () => {
    expect(chiaviDaAnnullare({ tipo: 'sostituzione', id: 'x' }, [], [])).toEqual([]);
    expect(chiaviDaAnnullare({ tipo: 'timeout', id: 'x' }, [], [])).toEqual([]);
    expect(chiaviDaAnnullare({ tipo: 'correzionePunteggio', id: 'x' }, [], [])).toEqual([]);
    expect(chiaviDaAnnullare(null, [], [])).toEqual([]);
  });

  it('battuta+ricezione: il punto e incluso solo se togliere il gesto riapre il rally', () => {
    const stesso = '2026-10-09T10:00:05.000Z';
    const coppia = (valBattuta: Azione['valutazione']) => [
      azione('s', 'r1', 1, { fondamentale: 'battuta', valutazione: valBattuta, timestamp: stesso }),
      azione('r', 'r1', 2, { squadra: 'B', fondamentale: 'ricezione', valutazione: '+', timestamp: stesso }),
    ];
    const bersaglio = { tipo: 'azioni' as const, rallyId: 'r1', azioneIds: ['s', 'r'] };
    expect(chiaviDaAnnullare(bersaglio, coppia('='), [])).toEqual(['s', 'r', 'punto-r1']);
    expect(chiaviDaAnnullare(bersaglio, coppia('+'), [])).toEqual(['s', 'r']);
    // correzione della sola battuta: la ricezione non e evidenziata
    const storia = [{ azioneId: 's', precedente: '+', nuova: '=' }];
    expect(chiaviDaAnnullare(bersaglio, coppia('='), storia)).toEqual(['s', 'punto-r1']);
  });
});
