import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from './exportCsv';

describe('exportCsv', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
  });

  async function creaScenarioBase() {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', zona: 1, direzione: 5,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    return { match, giocatoreA1 };
  }

  it('genera il csv delle azioni con una riga per azione', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvAzioni(match.id);
    const righe = csv.split('\n');
    expect(righe[0]).toBe('data,set,rally,squadra,giocatore,fondamentale,tipoBattuta,valutazione,zona,direzione,timestamp');
    expect(righe[1]).toContain(`#1 ${giocatoreA1.nome}`);
    expect(righe[1]).toContain('battuta');
    expect(righe).toHaveLength(2);
  });

  it('genera il csv del box score con tentativi ed efficienza per fondamentale', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvBoxScore(match.id);
    const righe = csv.split('\n');
    const rigaGiocatore = righe.find((r) => r.startsWith(`#1 ${giocatoreA1.nome}`));
    expect(rigaGiocatore).toContain('1,100.0');
  });

  it('scaricaCsv crea e scarica un blob con il nome file indicato', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    scaricaCsv('partita.csv', 'a,b,c');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
