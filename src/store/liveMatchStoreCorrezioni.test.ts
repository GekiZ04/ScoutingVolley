import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { useLiveMatchStore } from './liveMatchStore';
import type { Azione, SetPallavolo } from '@/domain/types';

type Input = Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>;

const store = () => useLiveMatchStore.getState();

async function contaRighe(tabella: string): Promise<number> {
  const { data } = await supabase.from(tabella).select('*');
  return data?.length ?? 0;
}

function creaSetDiTest(): SetPallavolo {
  return {
    id: 'set-test', matchId: 'match-test', numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A', stato: 'in_corso', vincitore: null,
    paleggiatoreIdA: null, paleggiatoreIdB: null, giroA: null, giroB: null,
  };
}

const battuta: Input = {
  squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
  valutazione: '-', origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 }, toccoMuro: false,
};
const ricezione: Input = {
  squadra: 'B', giocatoreId: 'b1', fondamentale: 'ricezione', tipoBattuta: null,
  valutazione: '+', origine: { x: 55, y: 40 }, destinazione: null, toccoMuro: false,
};
const attaccoMurato: Input = {
  squadra: 'A', giocatoreId: 'a7', fondamentale: 'attacco', tipoBattuta: null,
  valutazione: '/', origine: { x: 30, y: 30 }, destinazione: { x: 52, y: 40 }, toccoMuro: true,
};
const muro: Input = {
  squadra: 'B', giocatoreId: 'b2', fondamentale: 'muro', tipoBattuta: null,
  valutazione: '#', origine: { x: 52, y: 40 }, destinazione: { x: 52, y: 40 }, toccoMuro: false,
};

beforeEach(async () => {
  const set = creaSetDiTest();
  await supabase.from('sets').insert(set);
  store().caricaSet({ set, rallies: [], azioni: [], sostituzioni: [], timeouts: [], correzioniPunteggio: [] });
});

describe('doppio tocco', () => {
  it('due tocchi ravvicinati su Punto A danno un solo punto', async () => {
    await Promise.all([store().chiudiRallyManuale('punto_A'), store().chiudiRallyManuale('punto_A')]);
    expect(store().statoDerivato().punteggioA).toBe(1);
    expect(await contaRighe('rallies')).toBe(1);
  });

  it('due tocchi ravvicinati sulla stessa azione ne registrano una sola', async () => {
    await Promise.all([store().registraAzione(battuta), store().registraAzione(battuta)]);
    expect(await contaRighe('azioni')).toBe(1);
    expect(await contaRighe('rallies')).toBe(1);
  });

  it('due tocchi ravvicinati sul timeout ne registrano uno solo', async () => {
    await Promise.all([store().aggiungiTimeout('A'), store().aggiungiTimeout('A')]);
    expect(await contaRighe('timeouts')).toBe(1);
  });

  it('due tocchi ravvicinati su Annulla tolgono un solo gesto', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().chiudiRallyManuale('punto_B');
    await Promise.all([store().annullaUltimaAzione(), store().annullaUltimaAzione()]);
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 1, punteggioB: 0 });
  });

  it('a salvataggio finito un nuovo tocco funziona: due punti distinti restano due punti', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().chiudiRallyManuale('punto_A');
    expect(store().statoDerivato().punteggioA).toBe(2);
  });

  it('segnala che sta salvando solo mentre il salvataggio e in corso', async () => {
    expect(store().occupato).toBe(false);
    const salvataggio = store().chiudiRallyManuale('punto_A');
    expect(store().occupato).toBe(true);
    await salvataggio;
    expect(store().occupato).toBe(false);
  });

  it('se il salvataggio fallisce sblocca comunque i pulsanti', async () => {
    store().resetSet();
    await expect(store().chiudiRallyManuale('punto_A')).rejects.toThrow();
    expect(store().occupato).toBe(false);
  });

  it('un azione o un rally gia presenti non vengono duplicati nello store', async () => {
    await store().registraAzione(battuta);
    // Ricarica dal database come farebbe un evento realtime, poi aggiunge un altra azione.
    const { rallies, azioni } = store();
    store().caricaSet({ set: store().set!, rallies, azioni, sostituzioni: [], timeouts: [] });
    await store().registraAzione(ricezione);
    expect(store().rallies).toHaveLength(1);
    expect(new Set(store().azioni.map((a) => a.id)).size).toBe(store().azioni.length);
  });
});

describe('annulla', () => {
  it('toglie un punto manuale senza azioni', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().annullaUltimaAzione();
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 0, punteggioB: 0, rallyApertoNumero: 1 });
    expect(await contaRighe('rallies')).toBe(0);
  });

  it('un punto manuale su un rally con azioni riapre il rally e lascia le azioni', async () => {
    await store().registraAzione(battuta);
    await store().chiudiRallyManuale('punto_B');
    expect(store().statoDerivato().punteggioB).toBe(1);

    await store().annullaUltimaAzione();

    expect(store().statoDerivato()).toMatchObject({ punteggioB: 0, rallyApertoNumero: 1 });
    expect(await contaRighe('azioni')).toBe(1);
    const { data } = await supabase.from('rallies').select('*');
    expect(data).toHaveLength(1);
    expect((data as { chiusuraManuale: boolean; esito: string | null }[])[0]).toMatchObject({
      chiusuraManuale: false, esito: null,
    });
  });

  it('battuta e ricezione registrate insieme si tolgono con un solo annulla', async () => {
    await store().registraDueAzioni(battuta, ricezione);
    await store().annullaUltimaAzione();
    expect(await contaRighe('azioni')).toBe(0);
    expect(await contaRighe('rallies')).toBe(0);
    expect(store().statoDerivato().rallyApertoNumero).toBe(1);
  });

  it('un attacco murato e il suo muro si tolgono insieme e il punto sparisce', async () => {
    await store().registraDueAzioni(attaccoMurato, muro);
    expect(store().statoDerivato().punteggioB).toBe(1);

    await store().annullaUltimaAzione();

    expect(await contaRighe('azioni')).toBe(0);
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 0, punteggioB: 0 });
  });

  it('azioni registrate a parte si tolgono una alla volta', async () => {
    await store().registraAzione(battuta);
    await store().registraAzione(ricezione);
    await store().annullaUltimaAzione();
    expect(store().azioni.map((a) => a.fondamentale)).toEqual(['battuta']);
  });

  it('toglie l ultimo timeout e l ultima sostituzione fatti dopo l ultimo punto, poi il punto', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().aggiungiSostituzione({ squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'x1' });
    await store().aggiungiTimeout('B');

    await store().annullaUltimaAzione();
    expect(await contaRighe('timeouts')).toBe(0);
    expect(await contaRighe('sostituzioni')).toBe(1);

    await store().annullaUltimaAzione();
    expect(await contaRighe('sostituzioni')).toBe(0);
    expect(store().statoDerivato().punteggioA).toBe(1);

    await store().annullaUltimaAzione();
    expect(store().statoDerivato().punteggioA).toBe(0);
  });

  it('non fa nulla se non c e niente da annullare', async () => {
    await store().annullaUltimaAzione();
    expect(store().statoDerivato().punteggioA).toBe(0);
  });
});

describe('ruotaSquadra', () => {
  it('un passo avanti porta in P4 chi era in P5, tenendo gli stessi giocatori', async () => {
    await store().ruotaSquadra('B', 1);
    expect(store().statoDerivato().rotazioneB).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b1']);
    expect(store().statoDerivato().rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('salva la nuova formazione nel set sul database', async () => {
    await store().ruotaSquadra('A', 1);
    const { data } = await supabase.from('sets').select('*').eq('id', 'set-test');
    expect((data as SetPallavolo[])[0].formazioneInizialeA).toEqual(['a2', 'a3', 'a4', 'a5', 'a6', 'a1']);
  });

  it('un passo indietro annulla un passo avanti', async () => {
    await store().ruotaSquadra('A', 1);
    await store().ruotaSquadra('A', -1);
    expect(store().statoDerivato().rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('a partita in corso sposta la rotazione attuale e le sostituzioni restano sullo stesso giocatore', async () => {
    await store().aggiungiSostituzione({ squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'x1' });
    await store().chiudiRallyManuale('punto_B');
    expect(store().statoDerivato().rotazioneB).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b1']);

    await store().ruotaSquadra('A', 1);
    await store().ruotaSquadra('B', -1);

    expect(store().statoDerivato().rotazioneA).toEqual(['a2', 'x1', 'a4', 'a5', 'a6', 'a1']);
    expect(store().statoDerivato().rotazioneB).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  });

  it('non cambia punteggio ne servizio', async () => {
    await store().chiudiRallyManuale('punto_B');
    const prima = store().statoDerivato();
    await store().ruotaSquadra('A', 2);
    const dopo = store().statoDerivato();
    expect(dopo.punteggioA).toBe(prima.punteggioA);
    expect(dopo.punteggioB).toBe(prima.punteggioB);
    expect(dopo.squadraAlServizio).toBe(prima.squadraAlServizio);
  });
});

describe('correggiPunteggio', () => {
  it('porta il punteggio ai valori indicati senza toccare rotazione e servizio', async () => {
    await store().chiudiRallyManuale('punto_A');
    const prima = store().statoDerivato();

    await store().correggiPunteggio(7, 3);

    const dopo = store().statoDerivato();
    expect(dopo).toMatchObject({ punteggioA: 7, punteggioB: 3 });
    expect(dopo.rotazioneA).toEqual(prima.rotazioneA);
    expect(dopo.rotazioneB).toEqual(prima.rotazioneB);
    expect(dopo.squadraAlServizio).toBe(prima.squadraAlServizio);
    expect(dopo.rallyApertoNumero).toBe(prima.rallyApertoNumero);
  });

  it('i punti successivi si sommano al punteggio corretto', async () => {
    await store().correggiPunteggio(10, 4);
    await store().chiudiRallyManuale('punto_B');
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 10, punteggioB: 5 });
  });

  it('puo anche abbassare il punteggio', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().chiudiRallyManuale('punto_A');
    await store().correggiPunteggio(1, 0);
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 1, punteggioB: 0 });
  });

  it('se il punteggio e gia quello indicato non registra nulla', async () => {
    await store().correggiPunteggio(0, 0);
    expect(await contaRighe('correzioni_punteggio')).toBe(0);
  });

  it('salva la correzione sul database e Annulla la toglie', async () => {
    await store().correggiPunteggio(5, 2);
    expect(await contaRighe('correzioni_punteggio')).toBe(1);

    await store().annullaUltimaAzione();

    expect(await contaRighe('correzioni_punteggio')).toBe(0);
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 0, punteggioB: 0 });
  });

  it('rifiuta punteggi negativi o non interi', async () => {
    await expect(store().correggiPunteggio(-1, 0)).rejects.toThrow();
    await expect(store().correggiPunteggio(1.5, 0)).rejects.toThrow();
    expect(store().occupato).toBe(false);
  });
});
