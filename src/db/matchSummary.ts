import { db } from './schema';
import { caricaDatiSet } from './scouting';
import { deriveSetState, raggruppaPerRally } from '@/domain/reducer';
import type { Azione, Match, Player, Rally, SetPallavolo, Sostituzione, Timeout } from '@/domain/types';

export interface RiepilogoSet {
  set: SetPallavolo;
  punteggioA: number;
  punteggioB: number;
}

export interface RiepilogoPartita {
  match: Match;
  giocatori: Player[];
  riepiloghi: RiepilogoSet[];
  tutteLeAzioni: Azione[];
  tutteLeRallies: Rally[];
  tutteLeSostituzioni: Sostituzione[];
  tutteITimeout: Timeout[];
}

/**
 * Carica in un'unica passata tutti i dati necessari per il report, gli export
 * e qualunque altra vista di riepilogo di una partita: anagrafica, rosters,
 * punteggio derivato per ogni set e la lista completa di azioni, sostituzioni
 * e timeout. Centralizza la logica altrimenti duplicata in MatchReportPage,
 * exportPdf ed exportCsv.
 */
export async function caricaRiepilogoPartita(matchId: string): Promise<RiepilogoPartita> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');

  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];

  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');

  const riepiloghi: RiepilogoSet[] = [];
  const tutteLeAzioni: Azione[] = [];
  const tutteLeRallies: Rally[] = [];
  const tutteLeSostituzioni: Sostituzione[] = [];
  const tutteITimeout: Timeout[] = [];

  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    const azioniPerRally = raggruppaPerRally(dati.azioni);
    const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni);
    riepiloghi.push({ set, punteggioA: stato.punteggioA, punteggioB: stato.punteggioB });
    tutteLeAzioni.push(...dati.azioni);
    tutteLeRallies.push(...dati.rallies);
    tutteLeSostituzioni.push(...dati.sostituzioni);
    tutteITimeout.push(...dati.timeouts);
  }

  return { match, giocatori, riepiloghi, tutteLeAzioni, tutteLeRallies, tutteLeSostituzioni, tutteITimeout };
}
