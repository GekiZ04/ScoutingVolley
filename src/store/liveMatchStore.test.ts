import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { useLiveMatchStore } from './liveMatchStore';
import type { SetPallavolo } from '@/domain/types';

async function contaRighe(tabella: string): Promise<number> {
  const { data } = await supabase.from(tabella).select('*');
  return data?.length ?? 0;
}

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
  beforeEach(() => {
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
    expect(await contaRighe('azioni')).toBe(2);
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
    expect(await contaRighe('azioni')).toBe(1);
    expect(await contaRighe('rallies')).toBe(1);
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
    const { data: sostituzioni } = await supabase.from('sostituzioni').select('*');
    expect((sostituzioni as { dopoRallyNumero: number }[])[0].dopoRallyNumero).toBe(0);
  });

  it('corregge la valutazione di unazione esistente e il punteggio derivato si aggiorna di conseguenza', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a7', fondamentale: 'attacco', tipoBattuta: null,
      valutazione: '+', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
    });
    const azioneId = useLiveMatchStore.getState().azioni[0].id;

    await useLiveMatchStore.getState().correggiValutazione(azioneId, '#');

    const azioneCorretta = useLiveMatchStore.getState().azioni.find((a) => a.id === azioneId);
    expect(azioneCorretta?.valutazione).toBe('#');
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(1);
  });
});
