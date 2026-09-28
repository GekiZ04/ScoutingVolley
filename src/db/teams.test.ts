import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';
import { creaSquadra, rinominaSquadra, eliminaSquadra, aggiungiGiocatore, archiviaGiocatore, importaGiocatori } from './teams';

describe('db/teams', () => {
  it('crea una squadra e la rinomina', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await rinominaSquadra(squadra.id, 'Volley Rossi 2010');
    const { data: aggiornata } = await supabase.from('teams').select('*').eq('id', squadra.id).maybeSingle();
    expect(aggiornata?.nome).toBe('Volley Rossi 2010');
  });

  it('aggiunge un giocatore attivo di default', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const giocatore = await aggiungiGiocatore({
      teamId: squadra.id,
      numero: 9,
      nome: 'Neri',
      ruolo: 'opposto',
    });
    expect(giocatore.attivo).toBe(true);
  });

  it('archivia un giocatore senza eliminarlo', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const giocatore = await aggiungiGiocatore({
      teamId: squadra.id,
      numero: 9,
      nome: 'Neri',
      ruolo: 'opposto',
    });
    await archiviaGiocatore(giocatore.id);
    const { data: aggiornato } = await supabase.from('players').select('*').eq('id', giocatore.id).maybeSingle();
    expect(aggiornato?.attivo).toBe(false);
  });

  it('importa piu giocatori attivi in un colpo solo', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const giocatori = await importaGiocatori(squadra.id, [
      { numero: 1, nome: 'Rossi', ruolo: 'palleggiatore' },
      { numero: 2, nome: 'Bianchi', ruolo: 'opposto' },
    ]);
    expect(giocatori).toHaveLength(2);
    expect(giocatori.every((g) => g.attivo)).toBe(true);
    const { data: salvati } = await supabase.from('players').select('*').eq('teamId', squadra.id);
    expect(salvati).toHaveLength(2);
  });

  it('eliminando una squadra elimina anche i suoi giocatori', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await aggiungiGiocatore({ teamId: squadra.id, numero: 9, nome: 'Neri', ruolo: 'opposto' });
    await eliminaSquadra(squadra.id);
    const { data: giocatoriRimasti } = await supabase.from('players').select('*').eq('teamId', squadra.id);
    expect(giocatoriRimasti).toHaveLength(0);
  });
});
