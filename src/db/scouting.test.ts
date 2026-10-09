import { describe, it, expect, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  salvaRally,
  salvaAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  caricaDatiSet,
  caricaAzioniPartita,
  aggiornaValutazioneAzione,
  salvaCorrezionePunteggio,
  eliminaCorrezionePunteggio,
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
    origine: { x: 50, y: 50 },
    destinazione: { x: 50, y: 50 },
    toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('db/scouting', () => {
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
    const { data: rallyAncoraPresente } = await supabase.from('rallies').select('*').eq('id', 'r1').maybeSingle();
    expect(rallyAncoraPresente).toBeDefined();
    expect(rallyAncoraPresente).not.toBeNull();

    await eliminaAzione('az1');
    await eliminaRallySeVuoto('r1');
    const { data: rallyEliminato } = await supabase.from('rallies').select('*').eq('id', 'r1').maybeSingle();
    expect(rallyEliminato).toBeNull();
  });

  it('aggiorna la valutazione di unazione esistente', async () => {
    await salvaRally(creaRally());
    await salvaAzione(creaAzione({ valutazione: '+' }));
    await aggiornaValutazioneAzione('az1', '#');
    const { data: aggiornata } = await supabase.from('azioni').select('*').eq('id', 'az1').maybeSingle();
    expect(aggiornata?.valutazione).toBe('#');
  });

  it('carica tutte le azioni di tutti i set di una partita, cumulate tra i set', async () => {
    await supabase.from('sets').insert({ id: 'set-1', matchId: 'm1', numero: 1 });
    await supabase.from('sets').insert({ id: 'set-2', matchId: 'm1', numero: 2 });
    await supabase.from('sets').insert({ id: 'set-altro', matchId: 'm2', numero: 1 });
    await salvaAzione(creaAzione({ id: 'az-set1', setId: 'set-1' }));
    await salvaAzione(creaAzione({ id: 'az-set2', setId: 'set-2' }));
    await salvaAzione(creaAzione({ id: 'az-altra-partita', setId: 'set-altro' }));

    const azioni = await caricaAzioniPartita('m1');

    expect(azioni.map((a) => a.id).sort()).toEqual(['az-set1', 'az-set2']);
  });

  it('restituisce un array vuoto se la partita non ha ancora set', async () => {
    expect(await caricaAzioniPartita('m-senza-set')).toEqual([]);
  });
});

describe('correzioni_punteggio', () => {
  const correzione = { id: 'c1', setId: 's1', dopoRallyNumero: 2, deltaA: 1, deltaB: -1 };

  // Come risponde Supabase quando la tabella non e' ancora stata creata.
  function senzaTabella() {
    const client = supabase as unknown as { from: (nome: string) => unknown };
    const reale = client.from.bind(client);
    const errore = { code: 'PGRST205', message: "Could not find the table 'public.correzioni_punteggio'" };
    const finta = {
      select: () => ({ eq: () => Promise.resolve({ data: null, error: errore }) }),
      insert: () => Promise.resolve({ data: null, error: errore }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: errore }) }),
    };
    return vi.spyOn(client, 'from').mockImplementation((nome: string) => (nome === 'correzioni_punteggio' ? finta : reale(nome)));
  }

  it('le salva e le rilegge insieme ai dati del set', async () => {
    await salvaCorrezionePunteggio(correzione);
    const dati = await caricaDatiSet('s1');
    expect(dati.correzioniPunteggio).toEqual([correzione]);
  });

  it('non rilegge quelle di un altro set', async () => {
    await salvaCorrezionePunteggio({ ...correzione, setId: 'altro' });
    expect((await caricaDatiSet('s1')).correzioniPunteggio).toEqual([]);
  });

  it('senza la tabella sul database il set si carica lo stesso, senza correzioni', async () => {
    const spia = senzaTabella();
    await salvaRally(creaRally());
    const dati = await caricaDatiSet('s1');
    expect(dati.rallies).toHaveLength(1);
    expect(dati.correzioniPunteggio).toEqual([]);
    spia.mockRestore();
  });

  it('senza la tabella salvare una correzione spiega cosa fare', async () => {
    const spia = senzaTabella();
    await expect(salvaCorrezionePunteggio(correzione)).rejects.toThrow(/schema\.sql/);
    spia.mockRestore();
  });

  it('senza la tabella eliminare una correzione non da errore', async () => {
    const spia = senzaTabella();
    await expect(eliminaCorrezionePunteggio('c1')).resolves.toBeUndefined();
    spia.mockRestore();
  });
});
