import { describe, it, expect, beforeEach } from 'vitest';
import { ScoutingDatabase } from './schema';

describe('ScoutingDatabase', () => {
  let db: ScoutingDatabase;

  beforeEach(() => {
    db = new ScoutingDatabase(`test-db-${Math.random()}`);
  });

  it('salva e recupera una squadra', async () => {
    await db.teams.add({ id: 't1', nome: 'Volley Rossi', createdAt: new Date().toISOString() });
    const squadra = await db.teams.get('t1');
    expect(squadra?.nome).toBe('Volley Rossi');
  });

  it('trova i giocatori di una squadra tramite indice teamId', async () => {
    await db.players.bulkAdd([
      { id: 'p1', teamId: 't1', numero: 4, nome: 'Bianchi', ruolo: 'centrale', attivo: true },
      { id: 'p2', teamId: 't2', numero: 7, nome: 'Verdi', ruolo: 'libero', attivo: true },
    ]);
    const giocatori = await db.players.where('teamId').equals('t1').toArray();
    expect(giocatori).toHaveLength(1);
    expect(giocatori[0].nome).toBe('Bianchi');
  });
});
