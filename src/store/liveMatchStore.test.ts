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
    paleggiatoreIdA: null,
    paleggiatoreIdB: null,
    giroA: null,
    giroB: null,
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

  it('riapre il rally quando la correzione toglie la valutazione che lo chiudeva', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a7', fondamentale: 'attacco', tipoBattuta: null,
      valutazione: '#', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
    });
    const azioneId = useLiveMatchStore.getState().azioni[0].id;
    const statoChiuso = useLiveMatchStore.getState().statoDerivato();
    expect(statoChiuso.punteggioA).toBe(1);
    expect(statoChiuso.rallyApertoNumero).toBe(2);

    await useLiveMatchStore.getState().correggiValutazione(azioneId, '+');

    const statoRiaperto = useLiveMatchStore.getState().statoDerivato();
    expect(statoRiaperto.punteggioA).toBe(0);
    expect(statoRiaperto.rallyApertoNumero).toBe(1);
  });

  it('correggendo la ricezione a = ri-deriva anche la valutazione della battuta appaiata', async () => {
    // Coppia battuta+ricezione come la registra BattutaFlow: la ricezione
    // derivata a '+' porta la battuta a '-' (scala invertita).
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
      valutazione: '-', origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 }, toccoMuro: false,
    });
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'B', giocatoreId: 'b1', fondamentale: 'ricezione', tipoBattuta: null,
      valutazione: '+', origine: { x: 55, y: 40 }, destinazione: null, toccoMuro: false,
    });
    const [battuta, ricezione] = useLiveMatchStore.getState().azioni;

    await useLiveMatchStore.getState().correggiValutazione(ricezione.id, '=');

    const azioni = useLiveMatchStore.getState().azioni;
    expect(azioni.find((a) => a.id === ricezione.id)?.valutazione).toBe('=');
    // Ricezione '=' = ace: la battuta appaiata deve valere '#', non restare '-'.
    expect(azioni.find((a) => a.id === battuta.id)?.valutazione).toBe('#');
    const { data } = await supabase.from('azioni').select('*').eq('id', battuta.id);
    expect((data as { valutazione: string }[])[0].valutazione).toBe('#');
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(1);
    expect(stato.punteggioB).toBe(0);
  });

  it('registraDueAzioni mette entrambe le azioni nello stesso rally anche se la prima lo chiude gia', async () => {
    // Riproduce l'attacco murato per punto: l'attacco (valutazione '/', che
    // chiude gia' il rally da sola) e il tocco muro devono restare nello
    // stesso rally, non finire in due rally separati (bug: registraAzione()
    // chiamata due volte in sequenza ricalcola il rally aperto ad ogni
    // chiamata, e dopo la prima azione chiudente il rally e' gia' avanzato).
    await useLiveMatchStore.getState().registraDueAzioni(
      {
        squadra: 'B', giocatoreId: 'b7', fondamentale: 'attacco', tipoBattuta: null,
        valutazione: '/', origine: { x: 80, y: 20 }, destinazione: { x: 20, y: 50 }, toccoMuro: true,
      },
      {
        squadra: 'A', giocatoreId: 'a5', fondamentale: 'muro', tipoBattuta: null,
        valutazione: '#', origine: { x: 47, y: 50 }, destinazione: { x: 20, y: 50 }, toccoMuro: false,
      },
    );

    const azioni = useLiveMatchStore.getState().azioni;
    expect(azioni).toHaveLength(2);
    expect(azioni[0].rallyId).toBe(azioni[1].rallyId);
    expect(azioni[1].ordine).toBe(azioni[0].ordine + 1);

    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(1);
    expect(stato.punteggioB).toBe(0);
    expect(stato.rallyApertoNumero).toBe(2);
    expect(await contaRighe('rallies')).toBe(1);
  });
});
