import { describe, it, expect } from 'vitest';
import {
  attacchiPerAnalisi,
  filtraAttacchi,
  riepilogoAttacchi,
  griglia1m,
  settoriAngolo,
  densitaArrivi,
  zonaDiPartenza,
} from './analisiAttacco';
import type { Azione, Rally } from './types';

let contatore = 0;
function azione(extra: Partial<Azione>): Azione {
  contatore += 1;
  return {
    id: `az${contatore}`, rallyId: `r${contatore}`, setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'a4',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '+',
    origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 10 }, toccoMuro: false,
    timestamp: '2026-10-23T10:00:00.000Z', ...extra,
  };
}

describe('attacchiPerAnalisi: punto di vista di chi attacca, in metri', () => {
  it('rete in basso a 9 m dal fondo avversario, sinistra dell attaccante a sinistra', () => {
    const [a] = attacchiPerAnalisi([azione({ origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 10 } })]);
    expect(a.origine.x).toBeCloseTo(0.9);
    expect(a.origine.y).toBeCloseTo(10.8); // 1,8 m dietro la rete, nel proprio campo
    expect(a.arrivo.x).toBeCloseTo(0.9);
    expect(a.arrivo.y).toBeCloseTo(1.8); // 7,2 m oltre la rete
  });

  it('gli attacchi della squadra B si girano nello stesso verso di quelli della A', () => {
    const [a] = attacchiPerAnalisi([azione({ squadra: 'B', origine: { x: 60, y: 90 }, destinazione: { x: 10, y: 90 } })]);
    expect(a.origine.x).toBeCloseTo(0.9);
    expect(a.origine.y).toBeCloseTo(10.8);
    expect(a.arrivo.x).toBeCloseTo(0.9);
    expect(a.arrivo.y).toBeCloseTo(1.8);
  });

  it('scarta gli attacchi senza partenza o arrivo', () => {
    expect(attacchiPerAnalisi([azione({ origine: null }), azione({ destinazione: null })])).toEqual([]);
  });

  it('esito: # punto, = e / errore, il resto difeso', () => {
    const esiti = attacchiPerAnalisi(['#', '=', '/', '+', '!', '-'].map((v) => azione({ valutazione: v as Azione['valutazione'] })))
      .map((a) => a.esito);
    expect(esiti).toEqual(['punto', 'errore', 'errore', 'difeso', 'difeso', 'difeso']);
  });

  it('fase: il primo attacco dopo la propria ricezione e cambio palla, gli altri transizione', () => {
    const ric = azione({ rallyId: 'r', ordine: 2, squadra: 'A', fondamentale: 'ricezione', origine: null, destinazione: null });
    const bat = azione({ rallyId: 'r', ordine: 1, squadra: 'B', fondamentale: 'battuta', tipoBattuta: 'flottante' });
    const primo = azione({ rallyId: 'r', ordine: 3 });
    const secondo = azione({ rallyId: 'r', ordine: 4, squadra: 'B', origine: { x: 60, y: 50 }, destinazione: { x: 20, y: 50 } });
    const fasi = attacchiPerAnalisi([bat, ric, primo, secondo]).map((a) => a.fase);
    expect(fasi).toEqual(['ricezione', 'transizione']);
  });

  it('punto vinto: dal rally chiuso a mano o dalle azioni del rally', () => {
    const vinto = azione({ rallyId: 'man', valutazione: '+' });
    const perso = azione({ rallyId: 'auto', valutazione: '=' });
    const ignoto = azione({ rallyId: 'aperto', valutazione: '+' });
    const rallies: Rally[] = [{ id: 'man', setId: 's1', numero: 1, squadraAlServizio: 'A', esito: 'punto_A', chiusuraManuale: true }];
    expect(attacchiPerAnalisi([vinto, perso, ignoto], rallies).map((a) => a.puntoVinto)).toEqual([true, false, null]);
  });
});

describe('zonaDiPartenza', () => {
  it('prima linea 4-3-2 da sinistra a destra, seconda linea 5-6-1', () => {
    expect([10, 50, 90].map((y) => zonaDiPartenza({ x: 40, y }))).toEqual([4, 3, 2]);
    expect([10, 50, 90].map((y) => zonaDiPartenza({ x: 20, y }))).toEqual([5, 6, 1]);
  });
});

describe('filtraAttacchi', () => {
  const attacchi = attacchiPerAnalisi([
    azione({ squadra: 'A', giocatoreId: 'a4', setId: 's1' }),
    azione({ squadra: 'A', giocatoreId: 'a2', setId: 's2', origine: { x: 40, y: 90 } }),
    azione({ squadra: 'B', giocatoreId: 'b4', origine: { x: 60, y: 90 }, destinazione: { x: 10, y: 90 } }),
  ]);

  it('per squadra, giocatore, zona e set', () => {
    expect(filtraAttacchi(attacchi, { squadra: 'A' })).toHaveLength(2);
    expect(filtraAttacchi(attacchi, { squadra: 'A', giocatoreId: 'a2' })).toHaveLength(1);
    expect(filtraAttacchi(attacchi, { squadra: 'A', zona: 2 }).map((a) => a.giocatoreId)).toEqual(['a2']);
    expect(filtraAttacchi(attacchi, { setId: 's2' })).toHaveLength(1);
    expect(filtraAttacchi(attacchi, {})).toHaveLength(3);
  });
});

describe('riepilogoAttacchi', () => {
  it('kill %, efficienza e punto vinto %', () => {
    const rallies: Rally[] = [{ id: 'rv', setId: 's1', numero: 1, squadraAlServizio: 'A', esito: 'punto_A', chiusuraManuale: true }];
    const attacchi = attacchiPerAnalisi(
      [azione({ valutazione: '#' }), azione({ valutazione: '=' }), azione({ valutazione: '+', rallyId: 'rv' }), azione({ valutazione: '+' })],
      rallies,
    );
    const r = riepilogoAttacchi(attacchi);
    expect(r.totale).toBe(4);
    expect(r.killPercento).toBe(25);
    expect(r.efficienzaPercento).toBe(0);
    // punto vinto: # (si), = (no), + con rally vinto (si); l ultimo + non ha esito noto.
    expect(r.puntoVintoPercento).toBeCloseTo(66.67, 1);
  });

  it('senza attacchi tutto a zero', () => {
    expect(riepilogoAttacchi([])).toEqual({ totale: 0, killPercento: 0, efficienzaPercento: 0, puntoVintoPercento: null });
  });
});

describe('griglia1m', () => {
  it('conta gli arrivi in quadrati da 1 m (riga 0 = fondo campo) e a parte quelli fuori', () => {
    const attacchi = attacchiPerAnalisi([
      azione({ destinazione: { x: 90, y: 10 } }), // 0,9 m; 1,8 m -> colonna 0, riga 1
      azione({ destinazione: { x: 90, y: 10 } }),
      azione({ destinazione: { x: 99.9, y: 99.9 } }), // angolo in fondo a destra -> colonna 8, riga 0
      azione({ destinazione: { x: 45, y: 50 } }), // nel proprio campo: fuori
    ]);
    const g = griglia1m(attacchi);
    expect(g.celle[1][0]).toBe(2);
    expect(g.celle[0][8]).toBe(1);
    expect(g.fuori).toBe(1);
    expect(g.totale).toBe(4);
  });
});

describe('settoriAngolo', () => {
  it('raggruppa gli attacchi per angolo rispetto alla perpendicolare alla rete, con kill % per settore', () => {
    const attacchi = attacchiPerAnalisi([
      azione({ destinazione: { x: 90, y: 10 }, valutazione: '#' }), // dritto: 0 gradi
      azione({ destinazione: { x: 90, y: 10 }, valutazione: '+' }),
      azione({ destinazione: { x: 90, y: 90 }, valutazione: '#' }), // diagonale verso destra: ~39 gradi
    ]);
    const { settori, origineMedia } = settoriAngolo(attacchi);
    const dritto = settori.find((s) => s.daGradi === 0)!;
    expect(dritto).toMatchObject({ aGradi: 15, n: 2, percentuale: expect.closeTo(66.67, 1), killPercento: 50 });
    const diagonale = settori.find((s) => s.daGradi === 30)!;
    expect(diagonale).toMatchObject({ n: 1, killPercento: 100 });
    expect(settori).toHaveLength(12);
    expect(origineMedia!.x).toBeCloseTo(0.9);
    expect(origineMedia!.y).toBeCloseTo(10.8);
  });

  it('senza attacchi validi non c e un origine', () => {
    expect(settoriAngolo([]).origineMedia).toBeNull();
  });
});

describe('densitaArrivi', () => {
  it('normalizzata a 1 nel punto con piu arrivi', () => {
    const attacchi = attacchiPerAnalisi([
      azione({ destinazione: { x: 90, y: 10 } }),
      azione({ destinazione: { x: 90, y: 10 } }),
      azione({ destinazione: { x: 60, y: 90 } }),
    ]);
    const d = densitaArrivi(attacchi);
    let max = 0;
    let dove = { x: 0, y: 0 };
    d.valori.forEach((riga, r) => riga.forEach((v, c) => {
      if (v > max) {
        max = v;
        dove = { x: d.x0 + (c + 0.5) * d.passo, y: d.y0 + (r + 0.5) * d.passo };
      }
    }));
    expect(max).toBeCloseTo(1);
    expect(dove.x).toBeCloseTo(0.9, 0);
    expect(dove.y).toBeCloseTo(1.8, 0);
  });
});
