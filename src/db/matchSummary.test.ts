import { describe, it, expect } from 'vitest';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { salvaRally } from '@/db/scouting';
import { caricaRiepilogoPartita } from './matchSummary';

async function partita() {
  const a = await creaSquadra('Volley Rossi');
  const b = await creaSquadra('Volley Blu');
  const match = await creaPartita({
    data: '2026-10-03', squadraAId: a.id, squadraBId: b.id,
    squadraRiferimentoId: a.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  return { a, b, match };
}

const formazione = { formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'], primaSquadraAlServizio: 'A' as const };

describe('caricaRiepilogoPartita', () => {
  it('salta i set mai giocati (senza rally) e numera i set giocati in ordine', async () => {
    const { match } = await partita();
    // Come nei dati reali colpiti dal vecchio bug: 1, 3, 3 vuoto, 5, 6 vuoto.
    const giocati: string[] = [];
    for (const [numero, giocato] of [[1, true], [3, true], [3, false], [5, true], [6, false]] as const) {
      const set = await creaSet({ matchId: match.id, numero, ...formazione });
      if (giocato) {
        await salvaRally({ id: `r-${set.id}`, setId: set.id, numero: 1, squadraAlServizio: 'A', esito: 'punto_A', chiusuraManuale: true });
        giocati.push(set.id);
      }
    }

    const { riepiloghi } = await caricaRiepilogoPartita(match.id);

    expect(riepiloghi.map((r) => r.set.id)).toEqual(giocati);
    expect(riepiloghi.map((r) => r.set.numero)).toEqual([1, 2, 3]);
  });

  it('restituisce i giocatori ordinati per numero di maglia', async () => {
    const { a, match } = await partita();
    await aggiungiGiocatore({ teamId: a.id, numero: 19, nome: 'Selva', ruolo: 'libero' });
    await aggiungiGiocatore({ teamId: a.id, numero: 2, nome: 'Bonini', ruolo: 'centrale' });
    await aggiungiGiocatore({ teamId: a.id, numero: 7, nome: 'Malagoli', ruolo: 'schiacciatore' });

    const { giocatori } = await caricaRiepilogoPartita(match.id);

    expect(giocatori.map((g) => g.numero)).toEqual([2, 7, 19]);
  });
});
