import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { creaPartita, creaSet, aggiornaStatoSet, aggiornaStatoPartita } from './matches';

describe('db/matches', () => {
  beforeEach(async () => {
    await db.matches.clear();
    await db.sets.clear();
  });

  it('crea una partita in corso con i punti set di default', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: 'sq-a',
      formatoSet: 5,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    expect(match.stato).toBe('in_corso');
  });

  it('crea un set con formazioni iniziali e lo chiude assegnando il vincitore', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    const aggiornato = await db.sets.get(set.id);
    expect(aggiornato?.stato).toBe('concluso');
    expect(aggiornato?.vincitore).toBe('A');
  });

  it('conclude una partita', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    await aggiornaStatoPartita(match.id, 'conclusa');
    const aggiornata = await db.matches.get(match.id);
    expect(aggiornata?.stato).toBe('conclusa');
  });
});
