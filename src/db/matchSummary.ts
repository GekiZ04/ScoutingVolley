import { supabase } from '@/lib/supabase';
import { caricaDatiSet } from './scouting';
import { deriveSetState, raggruppaPerRally } from '@/domain/reducer';
import type { Azione, CorrezionePunteggio, Match, Player, Rally, SetPallavolo, Sostituzione, Timeout } from '@/domain/types';

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
  tutteLeCorrezioni: CorrezionePunteggio[];
}

/**
 * Carica in un'unica passata tutti i dati necessari per il report, gli export
 * e qualunque altra vista di riepilogo di una partita: anagrafica, rosters,
 * punteggio derivato per ogni set e la lista completa di azioni, sostituzioni
 * e timeout. Centralizza la logica altrimenti duplicata in MatchReportPage,
 * exportPdf ed exportCsv.
 */
export async function caricaRiepilogoPartita(matchId: string): Promise<RiepilogoPartita> {
  const { data: match, error: erroreMatch } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (erroreMatch) throw erroreMatch;
  if (!match) throw new Error('Partita non trovata');

  // In amichevole le due squadre sono la stessa: la rosa si carica una volta.
  const teamIds = [...new Set([match.squadraAId, match.squadraBId])];
  const risposte = await Promise.all(teamIds.map((id) => supabase.from('players').select('*').eq('teamId', id)));
  for (const r of risposte) if (r.error) throw r.error;
  const giocatori = risposte.flatMap((r) => r.data as Player[]).sort(
    (x, y) => x.numero - y.numero,
  );

  const { data: sets, error: erroreSets } = await supabase
    .from('sets')
    .select('*')
    .eq('matchId', matchId)
    .order('numero');
  if (erroreSets) throw erroreSets;

  const riepiloghi: RiepilogoSet[] = [];
  const tutteLeAzioni: Azione[] = [];
  const tutteLeRallies: Rally[] = [];
  const tutteLeSostituzioni: Sostituzione[] = [];
  const tutteITimeout: Timeout[] = [];
  const tutteLeCorrezioni: CorrezionePunteggio[] = [];

  for (const set of sets as SetPallavolo[]) {
    const dati = await caricaDatiSet(set.id);
    // Set aperti per errore e mai giocati (doppio tap su "Inizia partita"
    // prima della correzione): nei report sarebbero righe 0-0 e numeri
    // saltati. I set giocati vengono numerati in ordine solo per la vista.
    const maiGiocato =
      dati.rallies.length === 0 && dati.azioni.length === 0 && dati.sostituzioni.length === 0 && dati.timeouts.length === 0;
    if (maiGiocato) continue;
    const azioniPerRally = raggruppaPerRally(dati.azioni);
    const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni, dati.correzioniPunteggio);
    riepiloghi.push({
      set: { ...set, numero: riepiloghi.length + 1 },
      punteggioA: stato.punteggioA,
      punteggioB: stato.punteggioB,
    });
    tutteLeAzioni.push(...dati.azioni);
    tutteLeRallies.push(...dati.rallies);
    tutteLeSostituzioni.push(...dati.sostituzioni);
    tutteITimeout.push(...dati.timeouts);
    tutteLeCorrezioni.push(...(dati.correzioniPunteggio ?? []));
  }

  return { match: match as Match, giocatori, riepiloghi, tutteLeAzioni, tutteLeRallies, tutteLeSostituzioni, tutteITimeout, tutteLeCorrezioni };
}
