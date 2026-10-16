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

describe('annulla un tocco alla volta', () => {
  const battutaConDati: Input = { ...battuta, tipoBattuta: 'flottante', origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 } };
  const attacco: Input = {
    squadra: 'A', giocatoreId: 'a4', fondamentale: 'attacco', tipoBattuta: null,
    valutazione: '+', origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 90 }, toccoMuro: false,
  };

  it('annullando battuta e ricezione riapre la battuta alla scelta della valutazione della ricezione', async () => {
    await store().registraDueAzioni(battutaConDati, ricezione);
    await store().annullaUltimaAzione();
    expect(store().azioni).toHaveLength(0);
    expect(store().bozza).toEqual({
      flusso: 'battuta', passo: 'ricezione-valutazione', tipoBattuta: 'flottante',
      origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 }, ricevitore: { giocatoreId: 'b1', squadra: 'B' },
    });
  });

  it('annullando un attacco murato riapre l attacco a "dove e finita la palla"', async () => {
    await store().registraDueAzioni(attaccoMurato, muro);
    await store().annullaUltimaAzione();
    expect(store().bozza).toMatchObject({ flusso: 'attacco', passo: 'muro-destinazione', giocatoreId: 'a7', muro: { giocatoreId: 'b2' } });
  });

  it('la bozza sparisce con la prossima registrazione o con un punto', async () => {
    await store().registraAzione(battutaConDati);
    await store().annullaUltimaAzione();
    expect(store().bozza).not.toBeNull();
    await store().registraAzione(battutaConDati);
    expect(store().bozza).toBeNull();

    await store().annullaUltimaAzione();
    expect(store().bozza).not.toBeNull();
    await store().chiudiRallyManuale('punto_A');
    expect(store().bozza).toBeNull();
  });

  it('annullare un punto manuale non lascia bozze', async () => {
    await store().chiudiRallyManuale('punto_A');
    await store().annullaUltimaAzione();
    expect(store().bozza).toBeNull();
  });

  it('una correzione di valutazione fatta dalla striscia si annulla prima dell azione', async () => {
    await store().registraAzione(attacco);
    const id = store().azioni[0].id;
    await store().correggiValutazione(id, '#');
    expect(store().statoDerivato().punteggioA).toBe(1);

    await store().annullaUltimaAzione();
    expect(store().azioni.find((a) => a.id === id)?.valutazione).toBe('+');
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 0, rallyApertoNumero: 1 });
    expect(store().bozza).toBeNull();
    const { data } = await supabase.from('azioni').select('*').eq('id', id);
    expect((data as Azione[])[0].valutazione).toBe('+');

    await store().annullaUltimaAzione();
    expect(store().azioni).toHaveLength(0);
    expect(store().bozza).toMatchObject({ flusso: 'attacco', passo: 'destinazione' });
  });

  it('piu correzioni sulla stessa azione si annullano dalla piu recente', async () => {
    await store().registraAzione(attacco);
    const id = store().azioni[0].id;
    await store().correggiValutazione(id, '#');
    await store().correggiValutazione(id, '=');
    await store().annullaUltimaAzione();
    expect(store().azioni[0].valutazione).toBe('#');
    await store().annullaUltimaAzione();
    expect(store().azioni[0].valutazione).toBe('+');
  });

  it('annullando la correzione di un attacco murato torna anche il muro di prima', async () => {
    await store().registraDueAzioni({ ...attaccoMurato, valutazione: '+' }, { ...muro, valutazione: '!' });
    const [att, mur] = store().azioni;
    await store().correggiValutazione(att.id, '/');
    expect(store().azioni.find((a) => a.id === mur.id)?.valutazione).toBe('#');
    await store().annullaUltimaAzione();
    expect(store().azioni.find((a) => a.id === att.id)?.valutazione).toBe('+');
    expect(store().azioni.find((a) => a.id === mur.id)?.valutazione).toBe('!');
  });

  it('se dopo la correzione si e registrata un altra azione, Annulla toglie prima quella', async () => {
    await store().registraAzione(attacco);
    const id = store().azioni[0].id;
    await store().correggiValutazione(id, '!');
    await store().registraAzione({ ...attacco, squadra: 'B', giocatoreId: 'b5' });
    await store().annullaUltimaAzione();
    expect(store().azioni.map((a) => a.giocatoreId)).toEqual(['a4']);
    expect(store().azioni[0].valutazione).toBe('!');
  });

  it('un ricaricamento dal database dello stesso set non perde le correzioni da annullare', async () => {
    await store().registraAzione(attacco);
    const id = store().azioni[0].id;
    await store().correggiValutazione(id, '#');
    const { set, rallies, azioni } = store();
    store().caricaSet({ set: set!, rallies, azioni, sostituzioni: [], timeouts: [] });
    await store().annullaUltimaAzione();
    expect(store().azioni[0].valutazione).toBe('+');
  });
});

describe('punto manuale dopo un attacco ancora "+"', () => {
  const attaccoA: Input = {
    squadra: 'A', giocatoreId: 'a4', fondamentale: 'attacco', tipoBattuta: null,
    valutazione: '+', origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 90 }, toccoMuro: false,
  };

  it('se il punto va a chi ha attaccato, l attacco diventa # e il rally si chiude da solo', async () => {
    await store().registraAzione(attaccoA);
    await store().chiudiRallyManuale('punto_A');
    const azione = store().azioni[0];
    expect(azione.valutazione).toBe('#');
    expect(store().rallies[0]).toMatchObject({ chiusuraManuale: false, esito: null });
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 1, punteggioB: 0, rallyApertoNumero: 2 });
    const { data } = await supabase.from('azioni').select('*').eq('id', azione.id);
    expect((data as Azione[])[0].valutazione).toBe('#');
  });

  it('con l attacco toccato a muro anche il muro si aggiorna (tocco senza fermarlo)', async () => {
    await store().registraDueAzioni({ ...attaccoA, toccoMuro: true }, { ...muro, valutazione: '!' });
    await store().chiudiRallyManuale('punto_A');
    expect(store().azioni.map((a) => a.valutazione)).toEqual(['#', '=']);
    expect(store().statoDerivato().punteggioA).toBe(1);
  });

  it('se il punto va all altra squadra l attacco resta com e e il punto e manuale', async () => {
    await store().registraAzione(attaccoA);
    await store().chiudiRallyManuale('punto_B');
    expect(store().azioni[0].valutazione).toBe('+');
    expect(store().rallies[0]).toMatchObject({ chiusuraManuale: true, esito: 'punto_B' });
    expect(store().statoDerivato().punteggioB).toBe(1);
  });

  it('una valutazione gia scelta dallo scout non viene toccata', async () => {
    await store().registraAzione({ ...attaccoA, valutazione: '!' });
    await store().chiudiRallyManuale('punto_A');
    expect(store().azioni[0].valutazione).toBe('!');
    expect(store().rallies[0]).toMatchObject({ chiusuraManuale: true, esito: 'punto_A' });
  });

  it('se l ultima azione non e un attacco il punto resta manuale', async () => {
    await store().registraDueAzioni(battuta, ricezione);
    await store().chiudiRallyManuale('punto_B');
    expect(store().azioni.map((a) => a.valutazione)).toEqual(['-', '+']);
    expect(store().rallies[0]).toMatchObject({ chiusuraManuale: true, esito: 'punto_B' });
  });

  it('Annulla riporta l attacco a + e riapre il rally', async () => {
    await store().registraAzione(attaccoA);
    await store().chiudiRallyManuale('punto_A');
    await store().annullaUltimaAzione();
    expect(store().azioni[0].valutazione).toBe('+');
    expect(store().statoDerivato()).toMatchObject({ punteggioA: 0, rallyApertoNumero: 1 });
  });
});
