import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import {
  salvaRally,
  salvaAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  caricaDatiSet,
} from './scouting';
import type { Azione, Rally } from '@/domain/types';

function creaRally(overrides: Partial<Rally> = {}): Rally {
  return {
    id: 'r1',
    setId: 's1',
    numero: 1,
    squadraAlServizio: 'A',
    esito: null,
    chiusuraManuale: false,
    ...overrides,
  };
}

function creaAzione(overrides: Partial<Azione> = {}): Azione {
  return {
    id: 'az1',
    rallyId: 'r1',
    setId: 's1',
    ordine: 1,
    squadra: 'A',
    giocatoreId: 'p1',
    fondamentale: 'battuta',
    tipoBattuta: 'flottante',
    valutazione: '#',
    zona: 1,
    direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('db/scouting', () => {
  beforeEach(async () => {
    await db.rallies.clear();
    await db.azioni.clear();
  });

  it('carica rally e azioni di un set ordinati', async () => {
    await salvaRally(creaRally());
    await salvaAzione(creaAzione());
    const dati = await caricaDatiSet('s1');
    expect(dati.rallies).toHaveLength(1);
    expect(dati.azioni).toHaveLength(1);
  });

  it('ordina le azioni per numero di rally e poi per ordine quando i timestamp sono identici', async () => {
    await salvaRally(creaRally());
    const timestampIdentico = '2026-09-16T10:00:00.000Z';
    await salvaAzione(
      creaAzione({ id: 'az-ordine-2', ordine: 2, timestamp: timestampIdentico, valutazione: '+' }),
    );
    await salvaAzione(
      creaAzione({ id: 'az-ordine-1', ordine: 1, timestamp: timestampIdentico, valutazione: '+' }),
    );

    const dati = await caricaDatiSet('s1');

    expect(dati.azioni.map((a) => a.id)).toEqual(['az-ordine-1', 'az-ordine-2']);
  });

  it('elimina un rally solo se non ha più azioni', async () => {
    await salvaRally(creaRally());
    await salvaAzione(creaAzione());
    await eliminaRallySeVuoto('r1');
    const rallyAncoraPresente = await db.rallies.get('r1');
    expect(rallyAncoraPresente).toBeDefined();

    await eliminaAzione('az1');
    await eliminaRallySeVuoto('r1');
    const rallyEliminato = await db.rallies.get('r1');
    expect(rallyEliminato).toBeUndefined();
  });
});
