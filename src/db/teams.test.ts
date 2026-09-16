import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { creaSquadra, rinominaSquadra, eliminaSquadra, aggiungiGiocatore, archiviaGiocatore } from './teams';

describe('db/teams', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
  });

  it('crea una squadra e la rinomina', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await rinominaSquadra(squadra.id, 'Volley Rossi 2010');
    const aggiornata = await db.teams.get(squadra.id);
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
    const aggiornato = await db.players.get(giocatore.id);
    expect(aggiornato?.attivo).toBe(false);
  });

  it('eliminando una squadra elimina anche i suoi giocatori', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await aggiungiGiocatore({ teamId: squadra.id, numero: 9, nome: 'Neri', ruolo: 'opposto' });
    await eliminaSquadra(squadra.id);
    const giocatoriRimasti = await db.players.where('teamId').equals(squadra.id).toArray();
    expect(giocatoriRimasti).toHaveLength(0);
  });
});
