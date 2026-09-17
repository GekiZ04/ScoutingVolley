import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import { useLiveMatchStore } from './liveMatchStore';
import type { SetPallavolo } from '@/domain/types';

function creaSetDiTest(): SetPallavolo {
  return {
    id: 'set-test',
    matchId: 'match-test',
    numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A',
    stato: 'in_corso',
    vincitore: null,
  };
}

describe('useLiveMatchStore', () => {
  beforeEach(async () => {
    await db.rallies.clear();
    await db.azioni.clear();
    await db.sostituzioni.clear();
    await db.timeouts.clear();
    useLiveMatchStore.getState().caricaSet({
      set: creaSetDiTest(), rallies: [], azioni: [], sostituzioni: [], timeouts: [],
    });
  });

  it('parte da 0-0 dopo il caricamento del set', () => {
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(0);
  });

  it('registra un ace (ricezione avversaria fallita) e aggiorna il punteggio derivato', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
      valutazione: '+', origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
    });
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'B', giocatoreId: 'b1', fondamentale: 'ricezione', tipoBattuta: null,
      valutazione: '=', origine: { x: 50, y: 50 }, destinazione: null, toccoMuro: false,
    });
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(1);
    expect(await db.azioni.count()).toBe(2);
  });

  it('annulla lultima azione e ripristina il rally aperto quando era stata chiusa da un ace', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
      valutazione: '+', origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
    });
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'B', giocatoreId: 'b1', fondamentale: 'ricezione', tipoBattuta: null,
      valutazione: '=', origine: { x: 50, y: 50 }, destinazione: null, toccoMuro: false,
    });
    await useLiveMatchStore.getState().annullaUltimaAzione();
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(0);
    expect(await db.azioni.count()).toBe(1);
    expect(await db.rallies.count()).toBe(1);
  });

  it('chiude un rally manualmente ignorando eventuali azioni presenti', async () => {
    await useLiveMatchStore.getState().chiudiRallyManuale('punto_B');
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioB).toBe(1);
  });

  it('registra una sostituzione riferita al rally aperto corrente', async () => {
    await useLiveMatchStore.getState().aggiungiSostituzione({
      squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1',
    });
    const sostituzioni = await db.sostituzioni.toArray();
    expect(sostituzioni[0].dopoRallyNumero).toBe(0);
  });
});
